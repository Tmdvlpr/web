import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import type { Booking, User } from "../../types";
import { BookingCard } from "./BookingCard";
import { HOUR_HEIGHT_PX, DAY_START_HOUR, DAY_END_HOUR, TOTAL_HOURS } from "./index";

interface DayColumnProps {
  date: Date;
  bookings: Booking[];
  currentUser: User | null;
  onSlotClick: (start: Date, end: Date) => void;
  onCardClick: (booking: Booking) => void;
  isToday: boolean;
}

function timeToPercent(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return ((hours - DAY_START_HOUR) / TOTAL_HOURS) * 100;
}

function nowPercent(): number {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  if (hours < DAY_START_HOUR || hours > DAY_END_HOUR) return -1;
  return ((hours - DAY_START_HOUR) / TOTAL_HOURS) * 100;
}

export function DayColumn({ date, bookings, currentUser, onSlotClick, onCardClick, isToday }: DayColumnProps) {
  const { isDark } = useTheme();
  const dayName = date.toLocaleDateString("ru-RU", { weekday: "short" });
  const dayNum  = date.getDate();
  const isPast  = date < new Date(new Date().setHours(0, 0, 0, 0));
  const [nowPct, setNowPct] = useState(nowPercent);
  const [hoverSlot, setHoverSlot] = useState<{ startPct: number; heightPct: number; label: string } | null>(null);

  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => setNowPct(nowPercent()), 60_000);
    return () => clearInterval(t);
  }, [isToday]);

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    const totalMinutes = TOTAL_HOURS * 60;
    const clickedMinute = DAY_START_HOUR * 60 + Math.round(fraction * totalMinutes / 30) * 30;
    const start = new Date(date);
    start.setHours(Math.floor(clickedMinute / 60), clickedMinute % 60, 0, 0);
    const end = new Date(start.getTime() + 3_600_000);
    onSlotClick(start, end);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientY - rect.top) / rect.height;
    const totalMinutes = TOTAL_HOURS * 60;
    const rawMinute = DAY_START_HOUR * 60 + Math.round(fraction * totalMinutes / 30) * 30;
    const snappedFrac = (rawMinute - DAY_START_HOUR * 60) / totalMinutes;
    const endFrac = Math.min(1, snappedFrac + 60 / totalMinutes);
    const endMinute = rawMinute + 60;
    const label = `${String(Math.floor(rawMinute / 60)).padStart(2, "0")}:${String(rawMinute % 60).padStart(2, "0")} – ${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
    setHoverSlot({ startPct: snappedFrac * 100, heightPct: (endFrac - snappedFrac) * 100, label });
  };

  // Colors derived from theme
  const todayHeaderBg   = isDark ? "rgba(168,85,247,0.08)" : "#f5f3ff";
  const headerBg        = isDark ? "rgba(5,5,15,0.95)" : "#ffffff";
  const todayNumStyle   = isDark
    ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 0 16px rgba(168,85,247,0.5)" }
    : { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 0 16px rgba(124,58,237,0.35)" };
  const pastNumColor    = isDark ? "#1e293b" : "#cbd5e1";
  const normalNumColor  = isDark ? "#94a3b8" : "#475569";
  const gridBg          = isPast
    ? (isDark ? "rgba(255,255,255,0.01)" : "#f8fafc")
    : isToday
      ? (isDark ? "rgba(168,85,247,0.02)" : "#faf9ff")
      : (isDark ? "transparent" : "#ffffff");
  const todayNameColor  = isDark ? "#c084fc" : "#7c3aed";
  const normalNameColor = isDark ? "#334155" : "#94a3b8";

  return (
    <div className="flex flex-col min-w-0" style={{ borderRight: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="text-center py-2 px-1 sticky top-0 z-10"
        style={{
          background: isToday ? todayHeaderBg : headerBg,
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(8px)",
        }}>
        <div className="text-xs uppercase tracking-widest font-semibold"
          style={{ color: isToday ? todayNameColor : normalNameColor }}>
          {dayName}
        </div>
        <div className="mx-auto w-8 h-8 flex items-center justify-center rounded-full mt-0.5 text-sm font-bold"
          style={isToday ? todayNumStyle : { color: isPast ? pastNumColor : normalNumColor }}>
          {dayNum}
        </div>
      </div>

      {/* Time grid */}
      <div
        className={`relative ${isPast ? "" : "cursor-crosshair"}`}
        style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px`, background: gridBg }}
        onClick={isPast ? undefined : handleColumnClick}
        onMouseMove={!isPast ? handleMouseMove : undefined}
        onMouseLeave={() => setHoverSlot(null)}
      >
        {/* Hour lines */}
        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => (
          <div key={i} className="absolute left-0 right-0"
            style={{ top: `${(i / TOTAL_HOURS) * 100}%`, borderTop: "1px solid var(--hour-line)" }} />
        ))}
        {/* Half-hour lines */}
        {Array.from({ length: TOTAL_HOURS }).map((_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0"
            style={{ top: `${((i + 0.5) / TOTAL_HOURS) * 100}%`, borderTop: "1px dashed var(--hour-dash)" }} />
        ))}

        {/* Hover slot preview */}
        {!isPast && hoverSlot && (
          <div className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: `${hoverSlot.startPct}%`,
              height: `${hoverSlot.heightPct}%`,
              background: isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.07)",
              borderLeft: "2px solid var(--primary)",
              borderRadius: "0 4px 4px 0",
            }}>
            <span className="absolute top-0.5 left-1.5 text-xs font-semibold leading-tight"
              style={{ color: "var(--primary)", opacity: 0.85 }}>
              {hoverSlot.label}
            </span>
          </div>
        )}

        {/* Current time indicator */}
        {isToday && nowPct >= 0 && (
          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowPct}%` }}>
            <div className="relative flex items-center">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full shrink-0 -ml-1.5"
                style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }}
              />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#ef4444,transparent)", opacity: 0.7 }} />
            </div>
          </div>
        )}

        {/* Booking cards */}
        <AnimatePresence>
          {bookings.map((b) => {
            const top    = timeToPercent(new Date(b.start_time));
            const height = timeToPercent(new Date(b.end_time)) - top;
            if (height <= 0) return null;
            return (
              <BookingCard key={b.id} booking={b} topPercent={top} heightPercent={height}
                currentUser={currentUser} onClick={() => onCardClick(b)} />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
