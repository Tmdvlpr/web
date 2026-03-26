import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { authApi } from "../../api/auth";
import { storage } from "../../utils/storage";
import { useTelegram } from "../../hooks/useTelegram";
import LoadingSpinner from "../Common/LoadingSpinner";

/* ─────────────────────────────────────────────────────
   DEV BYPASS BUTTON
───────────────────────────────────────────────────── */
function DevLoginButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { access_token } = await authApi.devLogin();
      storage.setToken(access_token);
      navigate("/bookings", { replace: true });
    } catch {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
      style={{
        border: "1.5px dashed rgba(37,99,235,0.3)",
        color: "rgba(37,99,235,0.5)",
        background: "rgba(37,99,235,0.04)",
        letterSpacing: "0.04em",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(37,99,235,0.08)";
        e.currentTarget.style.borderColor = "rgba(37,99,235,0.5)";
        e.currentTarget.style.color = "rgba(37,99,235,0.8)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(37,99,235,0.04)";
        e.currentTarget.style.borderColor = "rgba(37,99,235,0.3)";
        e.currentTarget.style.color = "rgba(37,99,235,0.5)";
      }}
    >
      {loading ? "Входим..." : "DEV — войти без Telegram"}
    </button>
  );
}

/* ─────────────────────────────────────────────────────
   DIGITAL CIRCUIT CANVAS
───────────────────────────────────────────────────── */
function DigitalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tick = useRef(0);
  const velocityRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // track mouse position + velocity
    let lastMX = 0, lastMY = 0;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      const v = Math.sqrt(dx * dx + dy * dy) / 20;
      velocityRef.current = Math.min(v, 4);
      mouseRef.current = { x: e.clientX, y: e.clientY };
      lastMX = e.clientX; lastMY = e.clientY;
    };
    window.addEventListener("mousemove", onMove);

    const COLS = 18, ROWS = 11;
    type Node = { x: number; y: number; active: boolean; pulse: number };
    let nodes: Node[] = [];
    const buildNodes = () => {
      const W = canvas.width, H = canvas.height;
      nodes = [];
      for (let r = 0; r <= ROWS; r++)
        for (let c = 0; c <= COLS; c++)
          nodes.push({ x: (c / COLS) * W, y: (r / ROWS) * H, active: Math.random() > 0.55, pulse: Math.random() * Math.PI * 2 });
    };
    buildNodes();

    type DataParticle = { nx: number; ny: number; t: number; speed: number; horiz: boolean };
    const dataParticles: DataParticle[] = Array.from({ length: 55 }, () => ({
      nx: Math.floor(Math.random() * COLS), ny: Math.floor(Math.random() * ROWS),
      t: Math.random(), speed: 0.004 + Math.random() * 0.006, horiz: Math.random() > 0.5,
    }));

    type BinCol = { x: number; y: number; speed: number; chars: string[] };
    const binCols: BinCol[] = Array.from({ length: 22 }, () => ({
      x: Math.random() * window.innerWidth, y: -Math.random() * 400,
      speed: 0.4 + Math.random() * 0.8,
      chars: Array.from({ length: 10 }, () => String.fromCharCode(0x30 + Math.floor(Math.random() * 2))),
    }));

    let raf: number;
    let rebuildCooldown = 0;
    const draw = () => {
      tick.current++;
      // decay velocity smoothly each frame
      const vel = velocityRef.current;
      velocityRef.current *= 0.88;

      // rebuild node pattern on fast mouse movement (throttled)
      rebuildCooldown--;
      if (vel > 1.8 && rebuildCooldown <= 0) {
        rebuildCooldown = 18;
        buildNodes();
      }

      const W = canvas.width, H = canvas.height;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      ctx.clearRect(0, 0, W, H);

      // background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#e8f0fe"); bg.addColorStop(0.4, "#f0f7ff"); bg.addColorStop(1, "#e2eeff");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // ── circuit grid ──
      void (W / COLS); void (H / ROWS);
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const nd = nodes[r * (COLS + 1) + c];
          if (!nd) continue;
          if (c < COLS) {
            const nd2 = nodes[r * (COLS + 1) + c + 1];
            if (nd.active && nd2?.active) {
              ctx.beginPath(); ctx.moveTo(nd.x, nd.y); ctx.lineTo(nd2.x, nd2.y);
              ctx.strokeStyle = "rgba(59,130,246,0.12)"; ctx.lineWidth = 1; ctx.stroke();
            }
          }
          if (r < ROWS) {
            const nd3 = nodes[(r + 1) * (COLS + 1) + c];
            if (nd.active && nd3?.active) {
              ctx.beginPath(); ctx.moveTo(nd.x, nd.y); ctx.lineTo(nd3.x, nd3.y);
              ctx.strokeStyle = "rgba(99,102,241,0.10)"; ctx.lineWidth = 1; ctx.stroke();
            }
          }
        }
      }
      nodes.forEach(nd => {
        if (!nd.active) return;
        const pulse = 0.3 + Math.abs(Math.sin(nd.pulse + tick.current * 0.012)) * 0.5;
        // nodes near cursor glow brighter
        const dist = Math.sqrt((nd.x - mx) ** 2 + (nd.y - my) ** 2);
        const proximity = Math.max(0, 1 - dist / 220);
        const alpha = pulse * 0.5 + proximity * 0.55;
        const radius = 2 + proximity * 2.5;
        ctx.beginPath(); ctx.arc(nd.x, nd.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${alpha})`; ctx.fill();
      });

      // ── data particles ── (speed scales with mouse velocity)
      const vBoost = 1 + velocityRef.current * 2.5;
      dataParticles.forEach(p => {
        p.t += p.speed * vBoost;
        if (p.t > 1) { p.t = 0; p.nx = Math.floor(Math.random() * COLS); p.ny = Math.floor(Math.random() * ROWS); }
        const base = nodes[p.ny * (COLS + 1) + p.nx];
        const next = p.horiz ? nodes[p.ny * (COLS + 1) + Math.min(p.nx + 1, COLS)] : nodes[Math.min(p.ny + 1, ROWS) * (COLS + 1) + p.nx];
        if (!base || !next || !base.active || !next.active) return;
        const px = base.x + (next.x - base.x) * p.t;
        const py = base.y + (next.y - base.y) * p.t;
        const g2 = ctx.createRadialGradient(px, py, 0, px, py, 5);
        g2.addColorStop(0, "rgba(37,99,235,0.9)"); g2.addColorStop(1, "transparent");
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
        for (let t2 = 1; t2 <= 12; t2++) {
          const tp = Math.max(0, p.t - t2 * 0.012);
          const tx = base.x + (next.x - base.x) * tp;
          const ty = base.y + (next.y - base.y) * tp;
          ctx.beginPath(); ctx.arc(tx, ty, 2 * (1 - t2 / 12), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(37,99,235,${0.4 * (1 - t2 / 12)})`; ctx.fill();
        }
      });

      // ── binary rain ──
      ctx.font = "10px 'Courier New', monospace";
      binCols.forEach(bc => {
        bc.y += bc.speed * (1 + velocityRef.current * 1.5);
        if (bc.y > H + 200) { bc.y = -120; bc.x = Math.random() * W; }
        bc.chars.forEach((ch, i) => {
          const a = Math.max(0, 0.06 - i * 0.006);
          ctx.fillStyle = `rgba(37,99,235,${a})`; ctx.fillText(ch, bc.x, bc.y - i * 13);
        });
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

/* ─────────────────────────────────────────────────────
   CURSOR — crosshair only, no trail
───────────────────────────────────────────────────── */
function Cursor({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <div style={{ position: "absolute", left: mouseX, top: mouseY, transform: "translate(-50%,-50%)" }}>
        <div style={{ width: 20, height: 20, position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, marginTop: -0.5, background: "rgba(37,99,235,0.85)" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5, background: "rgba(37,99,235,0.85)" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 4, height: 4, borderRadius: "50%", background: "rgba(37,99,235,1)", transform: "translate(-50%,-50%)" }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   FLOATING CIRCUIT SHAPES
───────────────────────────────────────────────────── */
function CircuitShapes({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const shapes = useRef(Array.from({ length: 10 }, (_, i) => ({
    id: i, x: 5 + Math.random() * 90, y: 5 + Math.random() * 90,
    size: 16 + Math.random() * 28, rot: Math.random() * 360,
    speed: 0.2 + Math.random() * 0.4, depth: 0.2 + Math.random() * 0.8, type: i % 3,
  }))).current;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {shapes.map(s => {
        const px = (mouseX / (window.innerWidth  || 1) - 0.5) * 25 * s.depth;
        const py = (mouseY / (window.innerHeight || 1) - 0.5) * 25 * s.depth;
        return (
          <motion.div key={s.id} className="absolute" style={{ left: `${s.x}%`, top: `${s.y}%` }}
            animate={{ x: px, y: py, rotate: [s.rot, s.rot + 360], opacity: [0.06, 0.18, 0.06] }}
            transition={{
              x: { duration: 1.2, ease: "easeOut" }, y: { duration: 1.2, ease: "easeOut" },
              rotate: { duration: 25 / s.speed, repeat: Infinity, ease: "linear" },
              opacity: { duration: 4 + s.speed * 2, repeat: Infinity, ease: "easeInOut" },
            }}>
            <svg width={s.size} height={s.size} viewBox="0 0 24 24" fill="none">
              {s.type === 0 && <rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(37,99,235,0.8)" strokeWidth="1.5" />}
              {s.type === 1 && <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" stroke="rgba(99,102,241,0.8)" strokeWidth="1.5" />}
              {s.type === 2 && <><line x1="12" y1="2" x2="12" y2="22" stroke="rgba(37,99,235,0.6)" strokeWidth="1.5"/><line x1="2" y1="12" x2="22" y2="12" stroke="rgba(37,99,235,0.6)" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" stroke="rgba(99,102,241,0.8)" strokeWidth="1.5"/></>}
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}


/* ─────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────── */
export default function LoginPage() {
  const { isMiniApp, initData } = useTelegram();
  const navigate = useNavigate();
  const [rawMX, setRawMX] = useState(0);
  const [rawMY, setRawMY] = useState(0);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 80, damping: 20 });
  const smy = useSpring(my, { stiffness: 80, damping: 20 });
  const rotateX = useTransform(smy, [0, window.innerHeight], [6, -6]);
  const rotateY = useTransform(smx, [0, window.innerWidth], [-6, 6]);
  const px2 = useTransform(smx, [0, window.innerWidth],  [-5, 5]);
  const py2 = useTransform(smy, [0, window.innerHeight], [-5, 5]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setRawMX(e.clientX); setRawMY(e.clientY);
    mx.set(e.clientX); my.set(e.clientY);
  }, [mx, my]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => { window.removeEventListener("mousemove", handleMouseMove); };
  }, [handleMouseMove]);

  useEffect(() => {
    if (!isMiniApp) return;
    authApi.login(initData)
      .then(res => { storage.setToken(res.access_token); navigate("/bookings", { replace: true }); })
      .catch(() => navigate("/register", { replace: true }));
  }, [isMiniApp, initData, navigate]);

  if (isMiniApp) return <LoadingSpinner />;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ cursor: "none", background: "#e8f0fe" }}>
      <DigitalCanvas />
      <Cursor mouseX={rawMX} mouseY={rawMY} />
      <CircuitShapes mouseX={rawMX} mouseY={rawMY} />

      <div className="relative flex flex-col items-center justify-center min-h-screen px-4" style={{ zIndex: 2 }}>
        <motion.div
          style={{ x: px2, y: py2, rotateX, rotateY, transformPerspective: 1200, transformStyle: "preserve-3d" }}
          initial={{ opacity: 0, scale: 0.88, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full max-w-[480px]"
        >
          {/* glow */}
          <div className="absolute -inset-8 rounded-3xl pointer-events-none" style={{
            background: "radial-gradient(ellipse, rgba(37,99,235,0.16) 0%, transparent 70%)",
            filter: "blur(20px)",
          }} />

          {/* card */}
          <div className="relative rounded-2xl overflow-hidden" style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(37,99,235,0.2)",
            boxShadow: "0 24px 70px rgba(37,99,235,0.13), 0 0 0 1px rgba(99,102,241,0.07), inset 0 1px 0 rgba(255,255,255,1)",
            backdropFilter: "blur(24px)",
          }}>
            <div className="absolute top-0 inset-x-0 h-px" style={{
              background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.7), rgba(99,102,241,0.5), transparent)",
            }} />
            {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 ${cls}`} style={{ borderColor: "rgba(37,99,235,0.35)" }} />
            ))}

            <div className="p-10" style={{ transform: "translateZ(24px)" }}>

              {/* Logo */}
              <div className="flex flex-col items-center mb-7 gap-3">
                <div className="relative p-4 rounded-2xl" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.07), rgba(99,102,241,0.04))",
                  border: "1px solid rgba(37,99,235,0.12)",
                }}>
                  <motion.div className="absolute -inset-3 rounded-3xl pointer-events-none"
                    animate={{ opacity: [0.3, 0.75, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.22) 0%, transparent 70%)", filter: "blur(8px)" }}
                  />
                  <motion.img src="/logo.png" alt="UZINFOCOM" className="relative h-14 object-contain"
                    animate={{ filter: [
                      "drop-shadow(0 0 4px rgba(37,99,235,0.25))",
                      "drop-shadow(0 0 16px rgba(37,99,235,0.65))",
                      "drop-shadow(0 0 4px rgba(37,99,235,0.25))",
                    ]}}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.35))" }} />
                  <span style={{ color: "rgba(37,99,235,0.75)", fontSize: 16, letterSpacing: "0.24em" }} className="uppercase font-bold">CorpMeet</span>
                  <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.35), transparent)" }} />
                </div>
              </div>

              {/* Title */}
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="text-2xl font-bold text-center mb-2"
                style={{ color: "#0f172a", letterSpacing: "-0.01em" }}>
                Добро пожаловать!
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="text-center text-xs font-semibold mb-7"
                style={{ color: "rgba(37,99,235,0.5)", letterSpacing: "0.12em" }}>
                СИСТЕМА БРОНИРОВАНИЯ ПЕРЕГОВОРНЫХ
              </motion.p>

              <div className="mb-6 h-px" style={{
                background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.25), rgba(99,102,241,0.18), transparent)",
              }} />

              {/* Steps */}
              <div className="flex flex-col gap-4">
                {[
                  { n: 1, text: "Откройте бота @corpmeetbot в Telegram" },
                  { n: 2, text: 'Нажмите кнопку "Открыть приложение"' },
                  { n: 3, text: 'Внутри нажмите "Открыть в браузере"' },
                ].map((s, i) => (
                  <motion.div key={s.n} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.1 }} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold" style={{
                      background: "linear-gradient(135deg, #2563eb, #6366f1)",
                      color: "white", fontSize: 12,
                      boxShadow: "0 3px 10px rgba(37,99,235,0.38)",
                    }}>{s.n}</div>
                    <span className="text-base" style={{ color: "rgba(15,23,42,0.78)", lineHeight: 1.5, fontWeight: 450 }}>{s.text}</span>
                  </motion.div>
                ))}
              </div>

              {/* Dev bypass — only in development */}
              {import.meta.env.DEV && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                  className="mt-6">
                  <DevLoginButton />
                </motion.div>
              )}

              {/* Waiting */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}
                className="mt-4 flex items-center justify-center gap-2">
                {[0, 0.2, 0.4].map((d, i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "rgba(37,99,235,0.65)" }}
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: d }} />
                ))}
                <span className="text-xs ml-1.5 font-semibold" style={{ color: "rgba(37,99,235,0.45)", letterSpacing: "0.08em" }}>
                  ОЖИДАНИЕ АВТОРИЗАЦИИ
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          className="mt-5 flex items-center gap-3">
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.25))" }} />
          <span className="text-xs" style={{ color: "rgba(37,99,235,0.3)", letterSpacing: "0.06em" }}>
            Сессия создаётся автоматически
          </span>
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.25), transparent)" }} />
        </motion.div>
      </div>
    </div>
  );
}
