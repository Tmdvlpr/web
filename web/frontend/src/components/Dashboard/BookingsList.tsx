import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { InteractiveStripe } from "../Common/InteractiveStripe";
import { MeetingListSkeleton } from "../Common/Skeleton";
import { useTheme } from "../../contexts/ThemeContext";
import { bookingsApi } from "../../api/bookings";
import { usersApi } from "../../api/users";
import type { Booking } from "../../types";


interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCardClick: (b: Booking) => void;
}

const PALETTES = ["#7c3aed","#0891b2","#16a34a","#d97706","#e11d48","#c026d3","#4f46e5","#ea580c"];
function color(uid: number) { return PALETTES[uid % PALETTES.length]; }

function fmtRange(start: string, end: string) {
  const s = new Date(start).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  const e = new Date(end).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  return `${s} — ${e}`;
}

function fmtDiff(diffMinutes: number): string {
  if (diffMinutes < 60) return `Через ${diffMinutes} мин`;
  if (diffMinutes < 24 * 60) {
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return m === 0 ? `Через ${h} ч` : `Через ${h} ч ${m} мин`;
  }
  const d = Math.floor(diffMinutes / (24 * 60));
  return `Через ${d} д`;
}

function statusLabel(b: Booking): { label: string; color: string; bg: string } {
  const now = Date.now();
  const s   = new Date(b.start_time).getTime();
  const e   = new Date(b.end_time).getTime();
  if (now >= s && now <= e) return { label: "Сейчас", color: "#15803d", bg: "rgba(22,163,74,0.1)" };
  const diff = Math.round((s - now) / 60_000);
  if (diff <= 15)       return { label: fmtDiff(diff), color: "#d97706", bg: "rgba(217,119,6,0.1)" };
  if (diff <= 24 * 60)  return { label: fmtDiff(diff), color: "#6b6b8a", bg: "rgba(107,107,138,0.1)" };
  return { label: fmtDiff(diff), color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d     = new Date(iso);
  const today = new Date();
  const tom   = new Date(); tom.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Сегодня";
  if (sameDay(d, tom))   return "Завтра";
  return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

interface DayGroup { label: string; bookings: Booking[] }

function ExportFooter({ isDark }: { isDark: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: getFeed, isPending: feedLoading } = useMutation({
    mutationFn: usersApi.getFeedToken,
    onSuccess: (token) => {
      queryClient.setQueryData(["feedToken"], token);
      const url = bookingsApi.getFeedUrl(token);
      navigator.clipboard.writeText(url).then(() => {
        setFeedCopied(true);
        setTimeout(() => setFeedCopied(false), 2500);
      });
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try { await bookingsApi.exportHistory(); } finally { setExporting(false); }
  };

  return (
    <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          Обновляется каждые 30 сек
        </p>
        <motion.button
          onClick={handleExport} disabled={exporting}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all"
          style={{
            background: isDark ? "rgba(124,58,237,0.12)" : "#f5f3ff",
            border: isDark ? "1px solid rgba(124,58,237,0.3)" : "1px solid #ddd6fe",
            color: "var(--primary)",
          }}>
          {exporting ? "⏳" : "📅"} {exporting ? "Загрузка..." : "История .ics"}
        </motion.button>
      </div>
      <motion.button
        onClick={() => getFeed()}
        disabled={feedLoading}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all"
        style={{
          background: feedCopied
            ? (isDark ? "rgba(34,197,94,0.12)" : "#f0fdf4")
            : (isDark ? "rgba(8,145,178,0.1)" : "#ecfeff"),
          border: feedCopied
            ? (isDark ? "1px solid rgba(34,197,94,0.3)" : "1px solid #bbf7d0")
            : (isDark ? "1px solid rgba(8,145,178,0.3)" : "1px solid #a5f3fc"),
          color: feedCopied ? "#15803d" : "#0891b2",
        }}>
        {feedLoading ? "⏳" : feedCopied ? "✅ Ссылка скопирована!" : "🔗 Скопировать ссылку iCal-фида"}
      </motion.button>
    </div>
  );
}

export function ActiveMeetings({ isOpen, onClose, onCardClick }: Props) {
  const { isDark } = useTheme();
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "active"],
    queryFn: bookingsApi.getActive,
    enabled: isOpen,
    refetchInterval: isOpen ? 30_000 : false,
  });

  const groups: DayGroup[] = [];
  for (const b of bookings) {
    const k = dayKey(b.start_time);
    const existing = groups.find(g => g.label === dayLabel(b.start_time) && dayKey(g.bookings[0].start_time) === k);
    if (existing) existing.bookings.push(b);
    else groups.push({ label: dayLabel(b.start_time), bookings: [b] });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" onClick={onClose}
            style={{ background: isDark ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.3)", backdropFilter: "blur(4px)" }} />

          <motion.div key="panel"
            initial={{ opacity: 0, x: 340 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 340 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 flex flex-col"
            style={{
              background: "var(--panel)",
              borderLeft: "1px solid var(--border)",
              boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,0.8)" : "-8px 0 40px rgba(15,23,42,0.12)",
            }}>

            <InteractiveStripe />

            <div className="flex items-center justify-between px-5 py-4 mt-1"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: "var(--text)" }}>Мои встречи</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>На ближайший месяц</p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-xl transition-all"
                style={{ color: "var(--text-muted)", background: "var(--elevated)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}>×</button>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
              {isLoading ? (
                <MeetingListSkeleton />
              ) : groups.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Встреч нет</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>На ближайший месяц всё свободно</p>
                </div>
              ) : groups.map((group) => (
                <div key={group.label}>
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-2 mt-1">
                    <span className="text-xs font-bold capitalize" style={{ color: "var(--primary)" }}>
                      {group.label}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {group.bookings.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.bookings.map((b) => {
                      const c     = color(b.user_id);
                      const st    = statusLabel(b);
                      const isNow = Date.now() >= new Date(b.start_time).getTime() && Date.now() <= new Date(b.end_time).getTime();
                      return (
                        <motion.div key={b.id}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => { onCardClick(b); onClose(); }}
                          className="rounded-xl p-3.5 cursor-pointer transition-all"
                          style={{
                            background: isNow ? `${c}0d` : "var(--elevated)",
                            border: `1px solid ${isNow ? c + "40" : "var(--border)"}`,
                            boxShadow: isNow ? `0 0 20px ${c}15` : "none",
                          }}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm font-bold leading-tight" style={{ color: "var(--text)" }}>{b.title}</p>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}>
                              {st.label}
                            </span>
                          </div>
                          {b.description && (
                            <p className="text-xs mb-1.5 line-clamp-1" style={{ color: "var(--text-sec)" }}>{b.description}</p>
                          )}
                          <p className="text-xs font-semibold mb-1.5" style={{ color: c }}>{fmtRange(b.start_time, b.end_time)}</p>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: c }}>{b.user.display_name[0]}</div>
                            <span className="text-xs" style={{ color: "var(--text-sec)" }}>{b.user.display_name}</span>
                            {b.user.username && (
                              <a href={`https://t.me/${b.user.username}`} target="_blank" rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs ml-auto font-medium hover:underline" style={{ color: "#0891b2" }}>
                                @{b.user.username}
                              </a>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <ExportFooter isDark={isDark} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
