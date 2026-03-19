import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ActiveMeetings } from "./components/ActiveMeetings";
import { BookingModal } from "./components/BookingModal";
import { Calendar } from "./components/Calendar";
import { InteractiveStripe } from "./components/InteractiveStripe";
import { QRLoginPage } from "./components/QRLoginPage";
import { useTheme } from "./contexts/ThemeContext";
import { authApi, bookingsApi } from "./lib/api";
import type { Booking, User } from "./types";

// ── Web notification reminders ────────────────────────────────────────────────
function useWebReminders(user: User | undefined) {
  const notifiedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    const check = async () => {
      if (Notification.permission !== "granted") return;
      const today = new Date().toISOString().split("T")[0];
      try {
        const bookings = await bookingsApi.getByDate(today);
        const now = Date.now();
        for (const b of bookings) {
          const diff = new Date(b.start_time).getTime() - now;
          if (diff > 0 && diff <= 15 * 60_000 && !notifiedRef.current.has(b.id)) {
            notifiedRef.current.add(b.id);
            new Notification("⏰ Встреча через 15 минут", {
              body: `${b.title} · ${new Date(b.start_time).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}`,
              icon: "/logo.png",
            });
          }
        }
      } catch { /* ignore */ }
    };
    check();
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [user]);
}


// ── Toast ─────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: "success" | "error" | "info" }
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
        error:   { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  text: "#f87171" },
        info:    { bg: "rgba(99,102,241,0.15)",  border: "rgba(139,92,246,0.4)",  text: "#a78bfa" },
      }
    : {
        success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" },
        error:   { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
        info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb" },
      };
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const c = colors[t.type];
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1   }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="px-4 py-3 rounded-2xl text-sm font-semibold"
              style={{
                background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.1)",
                backdropFilter: isDark ? "blur(16px)" : undefined,
              }}>
              {t.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <motion.button
      onClick={toggle}
      whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all text-base"
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      style={{ border: "1px solid var(--border)", background: "var(--elevated)", color: "var(--text-sec)" }}>
      <AnimatePresence mode="wait">
        <motion.span key={isDark ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
          transition={{ duration: 0.18 }}>
          {isDark ? "☀️" : "🌙"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: authApi.getMe,
    enabled: !!localStorage.getItem("access_token"),
    retry: false,
  });
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();
  const { toasts, add: addToast } = useToasts();
  const { isDark } = useTheme();
  const typedUser = user as User | undefined;

  useWebReminders(typedUser);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeOpen,  setActiveOpen]  = useState(false);
  const [slotStart,   setSlotStart]   = useState<Date | undefined>();
  const [slotEnd,     setSlotEnd]     = useState<Date | undefined>();
  const [editBooking, setEditBooking] = useState<Booking | null>(null);

  const handleAuth = async (token: string) => {
    localStorage.setItem("access_token", token);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const handleLogout = () => { localStorage.removeItem("access_token"); queryClient.clear(); };

  const handleSlotClick = (start: Date, end: Date) => {
    setEditBooking(null); setSlotStart(start); setSlotEnd(end); setModalOpen(true);
  };

  const handleCardClick = (booking: Booking) => {
    setEditBooking(booking); setSlotStart(undefined); setSlotEnd(undefined); setModalOpen(true);
  };

  const handleModalClose = () => { setModalOpen(false); setEditBooking(null); };

  const canEdit   = editBooking ? (typedUser?.id === editBooking.user_id || typedUser?.role === "admin") : false;
  const canDelete = canEdit;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!user) return <QRLoginPage onAuth={handleAuth} />;

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-2.5 shrink-0 relative overflow-visible"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--header)",
          backdropFilter: "blur(20px)",
          boxShadow: isDark ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
        }}>

        {/* Interactive gradient stripe */}
        <InteractiveStripe edge="bottom" />

        <div className="flex items-center gap-3">
          <motion.div
            animate={{ boxShadow: ["0 0 12px rgba(124,58,237,0.3)", "0 0 24px rgba(124,58,237,0.6)", "0 0 12px rgba(124,58,237,0.3)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="rounded-xl overflow-hidden">
            <img src="/logo.png" alt="Logo" className="w-8 h-8" />
          </motion.div>
          <div>
            <div className="font-black text-base tracking-tight leading-none" style={{ color: "var(--text)" }}>
              Meet<span style={{ background: "linear-gradient(90deg,#7c3aed,#06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>aholic</span>
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Бронирование переговорной</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => handleSlotClick(new Date(), new Date(Date.now() + 3_600_000))}
            whileHover={{ scale: 1.04, boxShadow: "0 6px 28px rgba(124,58,237,0.5)" }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
            <span className="text-base leading-none">＋</span> Забронировать
          </motion.button>

          <motion.button
            onClick={() => setActiveOpen(true)}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}
            title="Активные встречи"
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
            <div className="w-2 h-2 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{typedUser?.name}</span>
          </motion.button>

          <ThemeToggle />

          <button onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--elevated)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-muted)"; }}>
            Выйти
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Calendar currentUser={typedUser ?? null} onSlotClick={handleSlotClick} onCardClick={handleCardClick} />
      </main>

      <ActiveMeetings isOpen={activeOpen} onClose={() => setActiveOpen(false)} onCardClick={handleCardClick} />

      <BookingModal
        isOpen={modalOpen} onClose={handleModalClose}
        initialStart={slotStart} initialEnd={slotEnd}
        editBooking={editBooking} canEdit={canEdit} canDelete={canDelete}
        onSuccess={(msg) => addToast(msg)} onError={(msg) => addToast(msg, "error")}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}
