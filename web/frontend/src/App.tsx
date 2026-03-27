import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { bookingsApi } from "./api/bookings";
import LoginPage from "./components/Auth/LoginPage";
import RegistrationPage from "./components/Auth/RegistrationPage";
import SessionAuthPage from "./components/Auth/SessionAuthPage";
import { Calendar } from "./components/Calendar";
import { InteractiveStripe } from "./components/Common/InteractiveStripe";
import { ActiveMeetings } from "./components/Dashboard/BookingsList";
import { BookingModal } from "./components/Dashboard/BookingModal";
import { NotificationCenter, addNotification, getReminderMinutes } from "./components/Dashboard/NotificationCenter";
import { AdminPanel } from "./components/Dashboard/AdminPanel";
import OpenInBrowserButton from "./components/MiniApp/OpenInBrowserButton";
import { useTheme } from "./contexts/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import { useTelegram } from "./hooks/useTelegram";
import type { Booking } from "./types";

// ── Web notification reminders ──────────────────────────────────────────────
function useWebReminders(isAuthenticated: boolean) {
  // notifiedRef: Set of "bookingId-reminderMinutes" strings to avoid double-firing
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAuthenticated) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const check = async () => {
      if (Notification.permission !== "granted") return;
      const today = new Date().toISOString().split("T")[0];
      const reminderMins = getReminderMinutes();
      try {
        const bookings = await bookingsApi.getByDate(today);
        const now = Date.now();
        for (const b of bookings) {
          const startMs = new Date(b.start_time).getTime();
          for (const mins of reminderMins) {
            const key = `${b.id}-${mins}`;
            const diff = startMs - now;
            const threshold = mins * 60_000;
            if (diff > 0 && diff <= threshold && !notifiedRef.current.has(key)) {
              notifiedRef.current.add(key);
              const label = mins < 60 ? `${mins} минут` : `${mins / 60} час`;
              const title = `⏰ Встреча через ${label}`;
              const body = `${b.title} · ${new Date(b.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
              new Notification(title, { body, icon: "/logo.png" });
              addNotification({
                id: key,
                title,
                body,
                time: Date.now(),
                bookingId: b.id,
                reminderMinutes: mins,
              });
            }
          }
        }
      } catch {
        /* ignore */
      }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);
}

// ── Toast ────────────────────────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}
let _tid = 0;

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = (message: string, type: Toast["type"] = "success") => {
    const id = ++_tid;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  return { toasts, add };
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  const { isDark } = useTheme();
  const colors: Record<Toast["type"], { bg: string; border: string; text: string }> = isDark
    ? {
        success: { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", text: "#34d399" },
        error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)", text: "#f87171" },
        info: { bg: "rgba(99,102,241,0.15)", border: "rgba(139,92,246,0.4)", text: "#a78bfa" },
      }
    : {
        success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
        error: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
        info: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb" },
      };
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="px-4 py-3 rounded-2xl text-sm font-semibold"
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.text,
                boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.1)",
                backdropFilter: isDark ? "blur(16px)" : undefined,
              }}
            >
              {t.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Theme toggle ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm"
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      style={{
        border: "1px solid var(--border)",
        background: "var(--elevated)",
        color: "var(--text-sec)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={isDark ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
          transition={{ duration: 0.18 }}
        >
          {isDark ? "☀️" : "🌙"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const { user, logout } = useAuth();
  const { isMiniApp: miniApp } = useTelegram();
  const { isDark } = useTheme();
  const { toasts, add: addToast } = useToasts();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [slotStart, setSlotStart] = useState<Date | undefined>();
  const [slotEnd, setSlotEnd] = useState<Date | undefined>();
  const [editBooking, setEditBooking] = useState<Booking | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSlotClick = (start: Date, end: Date) => {
    setEditBooking(null);
    setSlotStart(start);
    setSlotEnd(end);
    setModalOpen(true);
  };

  const handleCardClick = (booking: Booking) => {
    setEditBooking(booking);
    setSlotStart(undefined);
    setSlotEnd(undefined);
    setModalOpen(true);
  };

  const canEdit = editBooking
    ? user?.id === editBooking.user_id || user?.role === "admin"
    : false;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 shrink-0 relative overflow-visible"
        style={{
          height: 60,
          borderBottom: "1px solid var(--border)",
          background: "var(--header)",
          backdropFilter: "blur(20px)",
          boxShadow: isDark
            ? "0 1px 0 rgba(255,255,255,0.04)"
            : "0 2px 16px rgba(0,0,0,0.05)",
          zIndex: 30,
        }}
      >
        <InteractiveStripe edge="bottom" />

        {/* Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <motion.div
            animate={{ boxShadow: ["0 0 8px rgba(109,40,217,0.2)","0 0 20px rgba(109,40,217,0.5)","0 0 8px rgba(109,40,217,0.2)"] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="rounded-xl overflow-hidden shrink-0"
          >
            <img src="/logo.png" alt="Logo" className="w-9 h-9" />
          </motion.div>
          <div>
            <div className="leading-none" style={{ fontFamily: "Unbounded, sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "0.07em" }}>
              <span style={{ color: "var(--text)" }}>CORP</span>
              <span style={{ background: "linear-gradient(100deg,#6d28d9,#0ea5e9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>MEET</span>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 10, letterSpacing: "0.06em", marginTop: 2, textTransform: "uppercase" }}>
              Переговорная
            </div>
          </div>
        </div>

        {/* Center: primary action */}
        <motion.button
          onClick={() => handleSlotClick(new Date(), new Date(Date.now() + 3_600_000))}
          whileHover={{ scale: 1.03, boxShadow: "0 6px 24px rgba(109,40,217,0.50)" }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg,#6d28d9,#8b5cf6)",
            boxShadow: "0 3px 14px rgba(109,40,217,0.38)",
            letterSpacing: "0.01em",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Забронировать
        </motion.button>

        {/* Right: user + controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* My meetings button — shows avatar + label */}
          <motion.button
            onClick={() => setActiveOpen(true)}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text)" }}
            title="Мои встречи"
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-border)"; e.currentTarget.style.background = "var(--primary-light)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--elevated)"; }}
          >
            {/* Avatar */}
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#6d28d9,#8b5cf6)" }}>
              {user?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex flex-col items-start leading-none gap-0.5">
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Мои встречи</span>
              <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{user?.display_name}</span>
            </div>
          </motion.button>

          {/* Icon group */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
            <motion.button onClick={() => setNotifOpen(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all"
              title="Уведомления"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-muted)"; }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </motion.button>

            {user?.role === "admin" && (
              <motion.button onClick={() => setAdminOpen(true)} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-all"
                title="Панель администратора"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-muted)"; }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </motion.button>
            )}

            {miniApp && <OpenInBrowserButton />}

            <ThemeToggle />
          </div>

          <button onClick={handleLogout}
            className="text-xs px-2.5 py-1.5 rounded-xl transition-all font-medium"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = isDark ? "rgba(239,68,68,0.1)" : "#fff5f5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = ""; }}>
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Calendar
          currentUser={user ?? null}
          onSlotClick={handleSlotClick}
          onCardClick={handleCardClick}
        />
      </main>

      <ActiveMeetings
        isOpen={activeOpen}
        onClose={() => setActiveOpen(false)}
        onCardClick={handleCardClick}
      />

      <NotificationCenter
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
      />

      {user?.role === "admin" && (
        <AdminPanel
          isOpen={adminOpen}
          onClose={() => setAdminOpen(false)}
        />
      )}

      <BookingModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditBooking(null);
        }}
        initialStart={slotStart}
        initialEnd={slotEnd}
        editBooking={editBooking}
        canEdit={canEdit}
        canDelete={canEdit}
        onSuccess={(msg) => addToast(msg)}
        onError={(msg) => addToast(msg, "error")}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated } = useAuth();
  useWebReminders(isAuthenticated);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegistrationPage />} />
      <Route path="/auth/session/:sessionToken" element={<SessionAuthPage />} />
      <Route
        path="/bookings"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/bookings" : "/login"} replace />}
      />
    </Routes>
  );
}
