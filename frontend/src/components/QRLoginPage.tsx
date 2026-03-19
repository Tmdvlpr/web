import { useEffect, useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { authApi } from "../lib/api";
import type { QRSession } from "../types";

interface QRLoginPageProps {
  onAuth: (token: string) => void;
}

const POLL_INTERVAL_MS = 2000;
const QR_LIFETIME_MS = 10 * 60 * 1000;

/* ─── Single physics orb ─── */
interface OrbProps {
  baseX: number; baseY: number;
  size: number; color: string; blur: number;
  depth: number; floatDur: number; delay: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}
function Orb({ baseX, baseY, size, color, blur, depth, floatDur, delay, mouseX, mouseY }: OrbProps) {
  const smx = useSpring(mouseX, { stiffness: 15 + depth * 8, damping: 20 });
  const smy = useSpring(mouseY, { stiffness: 15 + depth * 8, damping: 20 });
  const dx = useTransform(smx, [-1, 1], [depth * 80, -depth * 80]);
  const dy = useTransform(smy, [-1, 1], [depth * 80, -depth * 80]);

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        left: `${baseX}%`, top: `${baseY}%`,
        x: dx, y: dy,
        translateX: "-50%", translateY: "-50%",
        background: color,
        filter: `blur(${blur}px)`,
      }}
      animate={{ scale: [1, 1.15, 0.92, 1] }}
      transition={{ duration: floatDur, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

/* ─── Floating dot ─── */
function Dot({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, background: "rgba(255,255,255,0.25)" }}
      animate={{ y: [0, -40, 0], opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay: delay * 0.7 }}
    />
  );
}

const ORBS: Omit<OrbProps, "mouseX" | "mouseY">[] = [
  { baseX: 8,  baseY: 18, size: 420, color: "rgba(21,101,192,0.55)",  blur: 80, depth: 1.4, floatDur: 9,  delay: 0 },
  { baseX: 88, baseY: 12, size: 320, color: "rgba(30,136,229,0.45)",  blur: 70, depth: 0.9, floatDur: 11, delay: 2 },
  { baseX: 6,  baseY: 82, size: 280, color: "rgba(13,71,161,0.5)",    blur: 65, depth: 1.6, floatDur: 13, delay: 1 },
  { baseX: 92, baseY: 78, size: 360, color: "rgba(66,165,245,0.35)",  blur: 75, depth: 0.7, floatDur: 10, delay: 3 },
  { baseX: 50, baseY: 95, size: 240, color: "rgba(21,101,192,0.4)",   blur: 60, depth: 1.1, floatDur: 8,  delay: 1.5 },
  { baseX: 50, baseY: 5,  size: 200, color: "rgba(100,181,246,0.3)",  blur: 55, depth: 0.5, floatDur: 12, delay: 4 },
];

const DOTS = Array.from({ length: 28 }, (_, i) => ({
  x: 5 + (i * 37 + i * 11) % 90,
  y: 5 + (i * 53 + i * 7) % 90,
  delay: (i * 0.35) % 5,
}));

export function QRLoginPage({ onAuth }: QRLoginPageProps) {
  const [session, setSession] = useState<QRSession | null>(null);
  const [status, setStatus] = useState<"loading" | "pending" | "success" | "expired">("loading");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Card 3D tilt
  const smCardX = useSpring(mouseX, { stiffness: 80, damping: 30 });
  const smCardY = useSpring(mouseY, { stiffness: 80, damping: 30 });
  const cardRotateY = useTransform(smCardX, [-1, 1], [-8, 8]);
  const cardRotateX = useTransform(smCardY, [-1, 1], [6, -6]);

  // Logo parallax (opposite direction)
  const logoX = useTransform(smCardX, [-1, 1], [12, -12]);
  const logoY = useTransform(smCardY, [-1, 1], [8, -8]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseX.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    mouseY.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }, [mouseX, mouseY]);

  const startSession = async () => {
    setStatus("loading");
    setSession(null);
    try {
      const s = await authApi.createQRSession();
      setSession(s);
      setStatus("pending");
    } catch {
      setStatus("expired");
    }
  };

  useEffect(() => { startSession(); }, []);

  useEffect(() => {
    if (status !== "pending" || !session) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await authApi.pollQRSession(session.token);
        if (res.status === "authenticated" && res.access_token) {
          clearInterval(pollRef.current!); clearTimeout(expiryRef.current!);
          setStatus("success"); onAuth(res.access_token);
        } else if (res.status === "expired") {
          clearInterval(pollRef.current!); setStatus("expired");
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);
    expiryRef.current = setTimeout(() => {
      clearInterval(pollRef.current!); setStatus("expired");
    }, QR_LIFETIME_MS);
    return () => { clearInterval(pollRef.current!); clearTimeout(expiryRef.current!); };
  }, [status, session, onAuth]);

  const deepLink = session ? `https://t.me/${session.bot_name}?start=${session.token}` : "";

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #0d2250 0%, #0a1a3e 35%, #071228 65%, #0d2250 100%)" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { mouseX.set(0); mouseY.set(0); }}
    >
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,136,229,0.2) 0%, transparent 70%)" }}
      />

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        {ORBS.map((o, i) => <Orb key={i} {...o} mouseX={mouseX} mouseY={mouseY} />)}
      </div>

      {/* Dots */}
      <div className="absolute inset-0 pointer-events-none">
        {DOTS.map((d, i) => <Dot key={i} {...d} />)}
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-4 w-full max-w-sm">

        {/* Logo + title */}
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div style={{ x: logoX, y: logoY }}>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              {/* Glow ring behind logo */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.15, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ background: "rgba(30,136,229,0.35)", filter: "blur(18px)", borderRadius: 20 }}
              />
              <img src="/logo.png" alt="Meetaholic" className="relative w-20 h-20 drop-shadow-2xl" />
            </motion.div>
          </motion.div>

          <div className="text-center">
            <h1 className="text-[52px] font-black leading-none tracking-tight">
              <span className="text-white">Meet</span>
              <span style={{
                background: "linear-gradient(90deg, #42A5F5 0%, #90CAF9 50%, #42A5F5 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer 3s linear infinite",
              }}>aholic</span>
            </h1>
            <p className="text-blue-300/60 text-sm mt-2 tracking-widest uppercase font-medium">
              Бронирование переговорной
            </p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            rotateX: cardRotateX,
            rotateY: cardRotateY,
            transformPerspective: 900,
            transformStyle: "preserve-3d",
          }}
          className="w-full rounded-3xl"
        >
          {/* Glass card */}
          <div className="relative rounded-3xl overflow-hidden" style={{
            background: "linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.2), 0 0 60px rgba(21,101,192,0.2)",
            backdropFilter: "blur(24px)",
          }}>
            {/* Top shimmer line */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            }} />

            <div className="p-8 flex flex-col items-center gap-6">
              <AnimatePresence mode="wait">
                {status === "loading" && (
                  <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-56 h-56 flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-[#42A5F5] border-t-transparent rounded-full animate-spin" />
                  </motion.div>
                )}

                {status === "pending" && session && (
                  <motion.div key="qr"
                    initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    {/* Outer glow */}
                    <div className="absolute -inset-3 rounded-3xl pointer-events-none"
                      style={{ background: "rgba(21,101,192,0.25)", filter: "blur(16px)" }} />

                    {/* QR wrapper */}
                    <div className="relative rounded-2xl p-3.5 bg-white"
                      style={{ boxShadow: "0 12px 40px rgba(21,101,192,0.5)" }}>
                      <QRCodeSVG
                        value={deepLink} size={210}
                        fgColor="#1565C0" bgColor="#ffffff"
                        level="H"
                        imageSettings={{ src: "/logo.png", height: 48, width: 48, excavate: true }}
                      />
                    </div>

                    {/* Scan line */}
                    <motion.div
                      className="absolute left-3.5 right-3.5 h-0.5 pointer-events-none"
                      style={{ background: "linear-gradient(90deg, transparent, #1E88E5, #42A5F5, #1E88E5, transparent)", boxShadow: "0 0 8px #1E88E5" }}
                      animate={{ top: ["14px", "224px", "14px"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Corner brackets */}
                    {[
                      "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                      "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                      "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                      "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
                    ].map((cls, i) => (
                      <motion.div key={i}
                        className={`absolute w-6 h-6 border-[#1E88E5] ${cls}`}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
                      />
                    ))}

                    {/* Pulse ring */}
                    <motion.div
                      className="absolute -inset-0.5 rounded-2xl border border-[#1565C0]/50 pointer-events-none"
                      animate={{ scale: [1, 1.05, 1], opacity: [0.7, 0, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>
                )}

                {status === "success" && (
                  <motion.div key="ok"
                    initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 18 }}
                    className="w-56 h-56 flex flex-col items-center justify-center gap-4">
                    <motion.div
                      animate={{ boxShadow: ["0 0 20px rgba(21,101,192,0.4)", "0 0 50px rgba(21,101,192,0.8)", "0 0 20px rgba(21,101,192,0.4)"] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-24 h-24 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(21,101,192,0.2)", border: "2px solid #1565C0" }}
                    >
                      <svg className="w-12 h-12 text-[#42A5F5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                    <p className="text-[#42A5F5] font-bold text-lg">Авторизовано!</p>
                  </motion.div>
                )}

                {status === "expired" && (
                  <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-56 h-56 flex flex-col items-center justify-center gap-5">
                    <div className="w-18 h-18 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <svg className="w-9 h-9 text-blue-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-blue-200/60 text-sm mb-4">QR-код устарел</p>
                      <motion.button onClick={startSession}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                        className="px-8 py-2.5 text-sm font-bold text-white rounded-2xl"
                        style={{ background: "linear-gradient(135deg,#1565C0,#1E88E5)", boxShadow: "0 6px 20px rgba(21,101,192,0.5)" }}>
                        Обновить
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Steps */}
              {status === "pending" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }} className="w-full flex flex-col gap-3">
                  <p className="text-white/80 text-sm text-center font-semibold tracking-wide">
                    Войдите через Telegram
                  </p>
                  {[
                    ["1", "Откройте камеру в Telegram"],
                    ["2", "Наведите на QR-код"],
                    ["3", "Подтвердите в боте"],
                  ].map(([n, t], i) => (
                    <motion.div key={n}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="flex items-center gap-3 text-sm text-blue-200/70"
                    >
                      <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white"
                        style={{ background: "rgba(21,101,192,0.5)", border: "1px solid rgba(30,136,229,0.6)" }}>
                        {n}
                      </span>
                      {t}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          className="text-blue-300/30 text-xs tracking-widest uppercase">
          Только для участников группы
        </motion.p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </div>
  );
}
