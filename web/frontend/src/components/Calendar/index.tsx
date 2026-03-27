import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CalendarDragProvider } from "../../contexts/CalendarDragContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useBookings, useSlots, useUpdateBooking } from "../../hooks/useBookings";
import { bookingsApi } from "../../api/bookings";
import { Skeleton } from "../Common/Skeleton";
import type { Booking, SlotResponse, User } from "../../types";
import { DayColumn } from "./DayColumn";

interface CalendarProps {
  currentUser: User | null;
  onSlotClick: (start: Date, end: Date) => void;
  onCardClick: (booking: Booking) => void;
}

interface DayContainerProps {
  date: Date;
  dateStr: string;
  currentUser: User | null;
  onSlotClick: (start: Date, end: Date) => void;
  onCardClick: (booking: Booking) => void;
  isToday: boolean;
  searchQuery: string;
}

function DayContainer({ date, dateStr, currentUser, onSlotClick, onCardClick, isToday, searchQuery }: DayContainerProps) {
  const { data: bookings = [], isLoading } = useBookings(dateStr);
  const { data: slots = [] } = useSlots(dateStr);
  const { mutate: updateBooking } = useUpdateBooking();

  const handleBookingDrop = (booking: Booking, newStart: Date) => {
    const durationMs = new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    updateBooking({ id: booking.id, payload: { start_time: newStart.toISOString(), end_time: newEnd.toISOString() } });
  };

  if (isLoading && !bookings.length) {
    return (
      <div className="flex flex-col min-w-0" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="text-center py-2 px-1 sticky top-0 z-10"
          style={{ background: "var(--day-header)", borderBottom: "1px solid var(--border)", height: 56, flexShrink: 0 }} />
        <div style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px` }} />
      </div>
    );
  }

  const filtered = searchQuery
    ? (bookings as Booking[]).filter((b) =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : bookings as Booking[];
  return (
    <DayColumn date={date} bookings={filtered} freeSlots={slots as SlotResponse[]} currentUser={currentUser}
      onSlotClick={onSlotClick} onCardClick={onCardClick} onBookingDrop={handleBookingDrop} isToday={isToday} />
  );
}

function getWeekDates(anchor: Date): Date[] {
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISODate(d: Date): string { return d.toISOString().split("T")[0]; }

export const HOUR_HEIGHT_PX  = 64;
export const DAY_START_HOUR  = 7;
export const DAY_END_HOUR    = 22;
export const TOTAL_HOURS     = DAY_END_HOUR - DAY_START_HOUR;
export const HOURS           = Array.from({ length: TOTAL_HOURS }, (_, i) => i + DAY_START_HOUR);

/* ── Room status widget ── */
function RoomStatus() {
  const { isDark } = useTheme();
  const { data: active = [] } = useQuery({
    queryKey: ["bookings", "active"],
    queryFn: bookingsApi.getActive,
    refetchInterval: 60_000,
  });

  const now = Date.now();
  const current = active.find(
    (b) => new Date(b.start_time).getTime() <= now && new Date(b.end_time).getTime() >= now
  );
  const next = active.find((b) => new Date(b.start_time).getTime() > now);

  if (current) {
    const endTime = new Date(current.end_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{
          background: isDark ? "rgba(239,68,68,0.1)" : "#fff1f2",
          border: "1px solid #fecdd3",
          color: "#dc2626",
        }}>
        <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
        <span>Занята до {endTime}</span>
      </div>
    );
  }

  if (next) {
    const startTime = new Date(next.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const minsLeft = Math.round((new Date(next.start_time).getTime() - now) / 60_000);
    if (minsLeft <= 30) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: isDark ? "rgba(217,119,6,0.1)" : "#fffbeb", border: "1px solid #fde68a", color: "#d97706" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
          <span>Занята в {startTime}</span>
        </div>
      );
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
      style={{ background: isDark ? "rgba(22,163,74,0.1)" : "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d" }}>
      <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
        className="w-2 h-2 rounded-full" style={{ background: "#22c55e" }} />
      <span>Свободна</span>
    </div>
  );
}

export function Calendar({ currentUser, onSlotClick, onCardClick }: CalendarProps) {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen]   = useState(false);
  const weekDates  = getWeekDates(anchorDate);
  const today      = new Date();
  const gridRef    = useRef<HTMLDivElement>(null);
  const timeRef    = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const now = new Date();
    const offset = (now.getHours() + now.getMinutes() / 60 - DAY_START_HOUR) * HOUR_HEIGHT_PX;
    gridRef.current.scrollTop = Math.max(0, offset - 120);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const syncTime = (e: React.UIEvent<HTMLDivElement>) => {
    if (timeRef.current) timeRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const prevWeek = () => { const d = new Date(anchorDate); d.setDate(d.getDate() - 7); setAnchorDate(d); };
  const nextWeek = () => { const d = new Date(anchorDate); d.setDate(d.getDate() + 7); setAnchorDate(d); };

  const monthLabel = weekDates[0].toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  return (
    <CalendarDragProvider>
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 sticky top-0 z-20"
        style={{ height: 48, borderBottom: "1px solid var(--border)", background: "var(--toolbar)", backdropFilter: "blur(12px)" }}>

        {/* Navigation group */}
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchorDate(new Date())}
            className="px-3 h-7 text-xs font-semibold rounded-lg transition-all shrink-0"
            style={{ border: "1.5px solid var(--primary-border)", color: "var(--primary)", background: "var(--primary-light)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary)"; }}>
            Сегодня
          </button>
          <button onClick={prevWeek}
            className="w-7 h-7 flex items-center justify-center rounded-lg font-semibold transition-all shrink-0 text-base leading-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--elevated)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = ""; }}>
            ‹
          </button>
          <button onClick={nextWeek}
            className="w-7 h-7 flex items-center justify-center rounded-lg font-semibold transition-all shrink-0 text-base leading-none"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; e.currentTarget.style.background = "var(--elevated)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = ""; }}>
            ›
          </button>
        </div>

        {/* Month label / search */}
        {searchOpen ? (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 220, opacity: 1 }} style={{ overflow: "hidden" }}>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск встреч..."
              className="w-full text-xs rounded-lg px-3 py-1.5 outline-none"
              style={{ background: "var(--input-bg)", border: "1.5px solid var(--primary)", color: "var(--text)" }}
              onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setSearchOpen(false); } }}
            />
          </motion.div>
        ) : (
          <span className="text-sm font-bold capitalize" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>{monthLabel}</span>
        )}

        <div className="ml-auto flex items-center gap-3">
          <RoomStatus />

          <button
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearchQuery(""); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{
              color: searchQuery ? "var(--primary)" : "var(--text-muted)",
              background: searchQuery ? "var(--primary-light)" : "transparent",
            }}
            title="Поиск">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>

          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
            <span>сейчас</span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Time axis */}
        <div ref={timeRef} className="shrink-0 w-14 flex flex-col"
          style={{ overflowY: "hidden", background: "var(--time-axis)", borderRight: "1px solid var(--border)" }}>
          <div style={{ height: 56, flexShrink: 0, borderBottom: "1px solid var(--border)" }} />
          {HOURS.map((h) => (
            <div key={h} className="text-right pr-3 text-xs select-none shrink-0 flex items-start justify-end"
              style={{ height: `${HOUR_HEIGHT_PX}px`, color: "var(--text-muted)", paddingTop: 4, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {/* Scrollable day columns */}
        <div ref={gridRef} className="flex-1 overflow-auto" onScroll={syncTime}>
          <div className="grid grid-cols-7 min-w-[560px]" style={{ borderLeft: "1px solid var(--border)" }}>
            {weekDates.map((date) => {
              const dateStr = toISODate(date);
              const isToday = toISODate(date) === toISODate(today);
              return (
                <DayContainer key={dateStr} date={date} dateStr={dateStr}
                  currentUser={currentUser} onSlotClick={onSlotClick}
                  onCardClick={onCardClick} isToday={isToday} searchQuery={searchQuery} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </CalendarDragProvider>
  );
}
