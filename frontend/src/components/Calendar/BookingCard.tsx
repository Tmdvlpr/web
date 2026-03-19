import { motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import type { Booking, User } from "../../types";

interface BookingCardProps {
  booking: Booking;
  topPercent: number;
  heightPercent: number;
  currentUser: User | null;
  onClick: () => void;
}

// Light theme — solid pastel with vibrant borders
const LIGHT_PALETTES = [
  { bg: "#f5f3ff", border: "#7c3aed", text: "#4c1d95", accent: "#7c3aed" },
  { bg: "#ecfeff", border: "#0891b2", text: "#164e63", accent: "#0891b2" },
  { bg: "#f0fdf4", border: "#16a34a", text: "#14532d", accent: "#16a34a" },
  { bg: "#fffbeb", border: "#d97706", text: "#78350f", accent: "#d97706" },
  { bg: "#fff1f2", border: "#e11d48", text: "#881337", accent: "#e11d48" },
  { bg: "#fdf4ff", border: "#c026d3", text: "#701a75", accent: "#c026d3" },
  { bg: "#eef2ff", border: "#4f46e5", text: "#1e1b4b", accent: "#4f46e5" },
  { bg: "#fff7ed", border: "#ea580c", text: "#7c2d12", accent: "#ea580c" },
];

// Dark theme — neon glow
const DARK_PALETTES = [
  { bg: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.7)",  text: "#e9d5ff", accent: "#a855f7" },
  { bg: "rgba(6,182,212,0.12)",   border: "rgba(6,182,212,0.7)",   text: "#a5f3fc", accent: "#06b6d4" },
  { bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.7)",  text: "#6ee7b7", accent: "#10b981" },
  { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.7)",  text: "#fde68a", accent: "#f59e0b" },
  { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.65)",  text: "#fecaca", accent: "#ef4444" },
  { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.65)", text: "#fbcfe8", accent: "#ec4899" },
  { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.65)", text: "#c7d2fe", accent: "#6366f1" },
  { bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.65)", text: "#fed7aa", accent: "#fb923c" },
];

export function BookingCard({ booking, topPercent, heightPercent, onClick }: BookingCardProps) {
  const { isDark } = useTheme();
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const p = palettes[booking.user_id % palettes.length];
  const startLabel = new Date(booking.start_time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const endLabel   = new Date(booking.end_time).toLocaleTimeString("ru-RU",   { hour: "2-digit", minute: "2-digit" });
  const isShort    = heightPercent < 6;

  const glowColor = isDark ? `${p.accent}40` : `${p.border}25`;

  return (
    <motion.div
      layoutId={`booking-${booking.id}`}
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18, type: "spring", stiffness: 340, damping: 22 }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      style={{
        position: "absolute",
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        left: 3, right: 3,
        background: p.bg,
        border: `1px solid ${p.border}50`,
        borderLeft: `3px solid ${p.border}`,
        borderRadius: 8,
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: isDark
          ? `0 0 12px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : `0 1px 4px ${glowColor}`,
      }}
      className="px-2 py-1"
    >
      {/* Hover shimmer for dark mode */}
      {isDark && (
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(135deg, ${glowColor} 0%, transparent 60%)` }} />
      )}

      {isShort ? (
        <p className="text-xs font-bold truncate leading-tight relative z-10" style={{ color: p.text }}>
          {booking.title} · {startLabel}
        </p>
      ) : (
        <div className="h-full flex flex-col gap-0.5 relative z-10">
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold truncate flex-1" style={{ color: p.text }}>{booking.title}</p>
            <div className="flex items-center gap-0.5 shrink-0">
              {booking.recurrence !== "none" && (
                <span className="text-xs font-semibold px-1 rounded" style={{ background: `${p.border}20`, color: p.accent }}>🔄</span>
              )}
              {booking.guests?.length > 0 && (
                <span className="text-xs font-semibold px-1 rounded" style={{ background: `${p.border}20`, color: p.accent }}>
                  👥{booking.guests.length}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs font-semibold" style={{ color: p.accent }}>{startLabel}–{endLabel}</p>
          <p className="text-xs truncate" style={{ color: `${p.text}99` }}>{booking.user.name}</p>
        </div>
      )}
    </motion.div>
  );
}
