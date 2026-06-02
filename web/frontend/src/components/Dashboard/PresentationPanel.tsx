import React, { createContext, createRef, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";

// ── Scroll context (IO root) ───────────────────────────────────────────────
const ScrollCtx = createContext<React.RefObject<HTMLDivElement | null>>(createRef());

// ── Reveal item — Framer Motion + IO scoped to scroll container ───────────
function R({
  children,
  delay = 0,
  dir = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  dir?: "up" | "left" | "right" | "scale";
}) {
  const scrollRef = useContext(ScrollCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect(); } },
      { root, threshold: 0.06, rootMargin: "0px 0px -24px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);

  const initial =
    dir === "left"  ? { opacity: 0, x: -20, y: 0, scale: 1 } :
    dir === "right" ? { opacity: 0, x:  20, y: 0, scale: 1 } :
    dir === "scale" ? { opacity: 0, x: 0, y: 10, scale: 0.97 } :
                      { opacity: 0, x: 0, y: 18, scale: 1 };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={show ? { opacity: 1, x: 0, y: 0, scale: 1 } : initial}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

// ── Eyebrow ────────────────────────────────────────────────────────────────
function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-xs font-bold px-2 py-0.5 rounded"
        style={{ background: "var(--primary)", color: "#fff", letterSpacing: "0.1em" }}
      >{n}</span>
      <span
        className="text-xs font-bold uppercase"
        style={{ color: "var(--primary)", letterSpacing: "0.13em" }}
      >{label}</span>
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────
function SH({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "clamp(20px,2.8vw,36px)",
        fontWeight: 800,
        letterSpacing: "-0.016em",
        lineHeight: 1.1,
        color: "var(--text)",
      }}
    >{children}</h2>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
function Card({
  icon, title, desc, children, accent,
}: {
  icon: string; title: string; desc?: string; children?: React.ReactNode; accent?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="rounded-md p-4 transition-transform duration-200"
      style={{
        background: "var(--elevated)",
        border: `1px solid ${accent ? "var(--primary-border)" : hov ? "var(--primary-border)" : "var(--border)"}`,
        boxShadow: hov ? "0 4px 16px rgba(17,24,39,0.1)" : "var(--card-shadow)",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className="w-9 h-9 rounded-md flex items-center justify-center text-lg mb-3"
        style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)" }}
      >{icon}</div>
      <div className="font-bold mb-1.5" style={{ fontSize: 14, color: "var(--text)" }}>{title}</div>
      {desc && <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>{desc}</div>}
      {children}
    </div>
  );
}

// ── Tag ────────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded mr-1 mt-1.5"
      style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}
    >{children}</span>
  );
}

// ── Note ───────────────────────────────────────────────────────────────────
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-4 rounded-md px-4 py-3"
      style={{
        background: "var(--primary-light)",
        borderLeft: "3px solid var(--primary)",
        border: "1px solid var(--primary-border)",
        fontSize: 13,
        lineHeight: 1.65,
        color: "var(--text-sec)",
      }}
    >{children}</div>
  );
}

// ── Bullet list ────────────────────────────────────────────────────────────
function BList({ items }: { items: Array<{ k: string; v: React.ReactNode }> }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((it, i) => (
        <li
          key={i}
          className="relative py-[7px] pl-5"
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-sec)",
            borderBottom: i < items.length - 1 ? "1px solid var(--border-light)" : "none",
          }}
        >
          <span
            className="absolute left-[3px] top-[14px] w-[6px] h-[6px] rounded-[2px]"
            style={{ background: "var(--primary)", opacity: 0.7 }}
          />
          <b style={{ color: "var(--text)", fontWeight: 600 }}>{it.k}</b>
          {" — "}
          {it.v}
        </li>
      ))}
    </ul>
  );
}

// ── Step ───────────────────────────────────────────────────────────────────
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="relative rounded-md pt-7 px-4 pb-4"
      style={{
        background: "var(--elevated)",
        border: `1px solid ${hov ? "var(--primary-border)" : "var(--border)"}`,
        boxShadow: "var(--card-shadow)",
        transition: "border-color .15s ease, transform .2s ease",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        className="absolute -top-[13px] left-4 w-7 h-7 rounded-md flex items-center justify-center text-white font-extrabold"
        style={{
          background: "linear-gradient(135deg,var(--primary),var(--accent))",
          fontSize: 13,
          boxShadow: "0 4px 12px rgba(21,101,168,.38)",
        }}
      >{n}</div>
      <div className="font-bold mb-1" style={{ fontSize: 14, color: "var(--text)" }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)" }}>{desc}</div>
    </div>
  );
}

// ── Scene ──────────────────────────────────────────────────────────────────
function Scene({ who, text }: { who: string; text: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="rounded-md px-4 py-3 mt-2"
      style={{
        background: "var(--elevated)",
        border: `1px solid ${hov ? "var(--primary-border)" : "var(--border)"}`,
        transition: "border-color .15s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="text-xs font-bold mb-1" style={{ color: "var(--primary)" }}>{who}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-sec)" }}>{text}</div>
    </div>
  );
}

// ── Mock shell ─────────────────────────────────────────────────────────────
function MockShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ background: "var(--elevated)", border: "1px solid var(--border)", boxShadow: "var(--panel-shadow)" }}
    >
      <div
        className="flex items-center gap-[5px] px-3 py-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <span className="w-[9px] h-[9px] rounded-full block bg-red-500" />
        <span className="w-[9px] h-[9px] rounded-full block bg-amber-400" />
        <span className="w-[9px] h-[9px] rounded-full block bg-green-500" />
        <span className="ml-2" style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Calendar mock ──────────────────────────────────────────────────────────
function CalMock() {
  const Ev = ({ cls, t, time }: { cls: string; t: string; time: string }) => (
    <div className={`rounded px-[5px] py-[3px] text-white overflow-hidden ${cls}`} style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.3 }}>
      {t}<div style={{ fontSize: 9, opacity: 0.85, fontWeight: 500 }}>{time}</div>
    </div>
  );
  const Slot = () => (
    <div className="rounded" style={{ height: 28, background: "var(--primary-light)", border: "1px dashed var(--primary-border)" }} />
  );
  const Busy = () => (
    <div className="rounded flex items-center px-1.5" style={{ height: 28, background: "var(--border)", fontSize: 10, color: "var(--text-muted)", fontWeight: 500, border: "1px solid var(--border)" }}>
      Занято
    </div>
  );
  return (
    <MockShell title="Календарь · эта неделя">
      <div className="p-3">
        <div className="grid mb-1" style={{ gridTemplateColumns: "36px repeat(5,1fr)", gap: 3 }}>
          <div />
          {["ПН 2","ВТ 3","СР 4","ЧТ 5","ПТ 6"].map(d => (
            <div key={d} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{d}</div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "36px repeat(5,1fr)", gap: 3 }}>
          <div className="flex flex-col gap-[3px]">
            {["09:00","10:00","11:00","12:00"].map(h => (
              <div key={h} style={{ height: 28, fontSize: 9.5, color: "var(--text-muted)", textAlign: "right", paddingRight: 4, lineHeight: "28px" }}>{h}</div>
            ))}
          </div>
          <div className="flex flex-col gap-[3px]">
            <Ev cls="bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]" t="Планёрка" time="09:00–09:30"/>
            <Slot/><Ev cls="bg-gradient-to-br from-cyan-600 to-cyan-400" t="Demo" time="11:00–12:00"/>
          </div>
          <div className="flex flex-col gap-[3px]"><Slot/><Ev cls="bg-gradient-to-br from-violet-600 to-violet-400" t="1-on-1" time="10:00–10:30"/><Slot/></div>
          <div className="flex flex-col gap-[3px]"><Busy/><Slot/><Slot/></div>
          <div className="flex flex-col gap-[3px]"><Slot/><Slot/><Ev cls="bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]" t="Созвон" time="11:00–11:30"/></div>
          <div className="flex flex-col gap-[3px]"><Slot/><Ev cls="bg-gradient-to-br from-violet-600 to-violet-400" t="Ретро" time="10:00–11:00"/><Slot/></div>
        </div>
      </div>
    </MockShell>
  );
}

// ── Booking mock ───────────────────────────────────────────────────────────
function BookMock() {
  const Chip = ({ label, on }: { label: string; on?: boolean }) => (
    <span
      className="px-2 py-1 rounded text-xs font-semibold"
      style={{
        background: on ? "var(--primary)" : "var(--surface)",
        border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`,
        color: on ? "#fff" : "var(--text-sec)",
      }}
    >{label}</span>
  );
  const Pill = ({ label }: { label: string }) => (
    <span
      className="inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2 py-0.5"
      style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}
    >{label} ✕</span>
  );
  const Lbl = ({ t }: { t: string }) => (
    <div className="mb-1 text-xs font-bold uppercase" style={{ letterSpacing: "0.08em", color: "var(--text-muted)" }}>{t}</div>
  );
  return (
    <MockShell title="Новое бронирование">
      <div className="p-3 flex flex-col gap-2.5">
        <div><Lbl t="Название"/><div className="rounded-md px-2.5 py-1.5 text-xs" style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}>Планёрка команды</div></div>
        <div><Lbl t="Тип"/><div className="flex gap-1 flex-wrap"><Chip label="🏢 Офис"/><Chip label="🌐 Онлайн" on/><Chip label="🔀 Гибрид"/></div></div>
        <div><Lbl t="Длительность"/><div className="flex gap-1 flex-wrap"><Chip label="30м"/><Chip label="1ч" on/><Chip label="1.5ч"/><Chip label="2ч"/></div></div>
        <div><Lbl t="Повторение"/><div className="flex gap-1 flex-wrap"><Chip label="Нет" on/><Chip label="Каждый день"/><Chip label="Каждую неделю"/></div></div>
        <div><Lbl t="Гости"/><div className="flex gap-1 flex-wrap"><Pill label="👤 @timur"/><Pill label="👤 Анна П."/></div></div>
        <button
          className="w-full rounded-md py-2 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,.3)" }}
        >Забронировать</button>
      </div>
    </MockShell>
  );
}

// ── Video mock ─────────────────────────────────────────────────────────────
function VideoMock() {
  const Tile = ({ name, speaking, bg }: { name: string; speaking?: boolean; bg: string }) => (
    <div
      className="rounded-md relative flex items-center justify-center overflow-hidden"
      style={{
        aspectRatio: "16/10",
        background: "var(--surface)",
        border: `1px solid ${speaking ? "var(--success)" : "var(--border)"}`,
        boxShadow: speaking ? "0 0 0 2px rgba(16,185,129,.2)" : undefined,
      }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: bg }}>{name[0]}</div>
      <span className="absolute bottom-1 left-1 rounded px-1.5 text-white" style={{ fontSize: 9, background: "rgba(0,0,0,.48)" }}>{name}</span>
    </div>
  );
  const Btn = ({ ch, danger, off }: { ch: string; danger?: boolean; off?: boolean }) => (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center text-sm cursor-pointer"
      style={{
        background: danger ? "var(--danger)" : off ? "rgba(239,68,68,.1)" : "var(--elevated)",
        border: danger ? "none" : off ? "1px solid rgba(239,68,68,.3)" : "1px solid var(--border)",
        color: off ? "var(--danger)" : danger ? "#fff" : "inherit",
      }}
    >{ch}</div>
  );
  return (
    <MockShell title="🔒 Зашифровано · 12:34">
      <div className="p-2 grid grid-cols-3 gap-1.5">
        <Tile name="Тимур" speaking bg="linear-gradient(135deg,var(--primary),var(--accent))"/>
        <Tile name="Анна" bg="linear-gradient(135deg,#7c3aed,#a78bfa)"/>
        <Tile name="Дмитрий" bg="linear-gradient(135deg,#0891b2,#22d3ee)"/>
      </div>
      <div className="flex justify-center gap-1.5 px-2 pb-2" style={{ borderTop: "1px solid var(--border)", paddingTop: 8, background: "var(--surface)" }}>
        <Btn ch="🎤"/><Btn ch="📷" off/><Btn ch="🖥️"/><Btn ch="💬"/><Btn ch="⏺" off/><Btn ch="📞" danger/>
      </div>
    </MockShell>
  );
}

// ── Telegram mock ──────────────────────────────────────────────────────────
function TgMock() {
  return (
    <MockShell title="Telegram · группа команды">
      <div className="p-3 flex flex-col gap-2">
        <div className="rounded-md px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTopLeftRadius: 2, fontSize: 12, lineHeight: 1.65, color: "var(--text-sec)", maxWidth: "92%", whiteSpace: "pre-line" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "var(--primary)" }}>CorpMeet Bot</div>
          {"📅 Новое бронирование\n👤 Тимур\n📌 Планёрка\n🕐 2 июн 10:00 – 11:00"}
          <div className="mt-2 rounded-md inline-block px-2.5 py-1 text-xs font-bold" style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}>
            🎥 Подключиться к встрече
          </div>
        </div>
        <div className="rounded-md px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber,#f59e0b)", borderTopLeftRadius: 2, fontSize: 12, lineHeight: 1.65, color: "var(--text-sec)", maxWidth: "92%", whiteSpace: "pre-line" }}>
          <div className="text-xs font-bold mb-1" style={{ color: "var(--primary)" }}>CorpMeet Bot</div>
          {"⏰ Напоминание! Через 15 минут:\n📌 Планёрка · 10:00"}
        </div>
      </div>
    </MockShell>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────
function Div({ pad = "clamp(16px,4vw,52px)" }: { pad?: string }) {
  return <div style={{ margin: `0 ${pad}`, height: 1, background: "var(--border)" }} />;
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Sec({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ padding: "60px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 clamp(16px,4vw,52px)" }}>
        {children}
      </div>
    </section>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export function PresentationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { isDark } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const progRef   = useRef<HTMLDivElement>(null);

  // scroll progress bar
  useEffect(() => {
    const el = scrollRef.current;
    const bar = progRef.current;
    if (!el || !bar) return;
    const fn = () => {
      const max = el.scrollHeight - el.clientHeight;
      bar.style.width = (max > 0 ? el.scrollTop / max * 100 : 0) + "%";
    };
    el.addEventListener("scroll", fn, { passive: true });
    return () => el.removeEventListener("scroll", fn);
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [isOpen, onClose]);

  const StatItem = ({ big, small }: { big: string; small: string }) => (
    <div>
      <div style={{ fontSize: "clamp(18px,2.5vw,32px)", fontWeight: 800, background: "linear-gradient(135deg,var(--text),var(--primary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{big}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{small}</div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pres"
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed", inset: 0, zIndex: 9990,
            background: "var(--bg)",
            display: "flex", flexDirection: "column",
            boxShadow: isDark ? "-20px 0 60px rgba(0,0,0,.8)" : "-8px 0 40px rgba(15,23,42,.12)",
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 flex items-center justify-between px-[clamp(16px,4vw,52px)]"
            style={{
              height: 52,
              borderBottom: "1px solid var(--border)",
              background: isDark ? "rgba(10,10,18,0.82)" : "rgba(255,255,255,0.82)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5" style={{ fontWeight: 800, fontSize: 16 }}>
              <div
                className="rounded-[8px] flex items-center justify-center shrink-0"
                style={{ width: 28, height: 28, background: "linear-gradient(135deg,var(--primary),var(--accent))", boxShadow: "0 4px 12px rgba(21,101,168,.38)" }}
              >
                <span className="block border-[2.5px] border-white rounded-[4px]" style={{ width: 12, height: 12 }} />
              </div>
              <span style={{ color: "var(--text)" }}>Corp<span style={{ color: "var(--primary)" }}>Meet</span></span>
              <span
                className="text-xs font-bold rounded px-2 py-0.5"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", letterSpacing: "0.04em" }}
              >v1.0</span>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5 transition-colors"
              style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--primary-border)";
                e.currentTarget.style.color = "var(--primary)";
                e.currentTarget.style.background = "var(--primary-light)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "var(--elevated)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Закрыть
            </button>
          </div>

          {/* Progress bar */}
          <div
            ref={progRef}
            style={{ height: 2, width: "0%", background: "linear-gradient(90deg,var(--primary),var(--accent))", transition: "width .08s linear", flexShrink: 0 }}
          />

          {/* Scroll area */}
          <ScrollCtx.Provider value={scrollRef}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto">

              {/* ── HERO ────────────────────────────────────────────── */}
              <div
                className="flex flex-col items-center justify-center text-center relative overflow-hidden"
                style={{ minHeight: "calc(100vh - 54px)", padding: "60px 0 48px" }}
              >
                {/* bg blobs */}
                <div style={{ position: "absolute", width: 600, height: 380, top: -120, right: -80, borderRadius: "50%", background: isDark ? "rgba(91,163,223,.09)" : "rgba(21,101,168,.07)", filter: "blur(90px)", animation: "ppBlob 9s ease-in-out infinite alternate", pointerEvents: "none" }}/>
                <div style={{ position: "absolute", width: 420, height: 280, bottom: -70, left: -100, borderRadius: "50%", background: isDark ? "rgba(56,189,248,.06)" : "rgba(14,165,233,.05)", filter: "blur(90px)", animation: "ppBlob 9s 4s ease-in-out infinite alternate", pointerEvents: "none" }}/>
                <style>{`@keyframes ppBlob{from{transform:translateY(0)}to{transform:translateY(-20px)}}`}</style>

                <div className="relative flex flex-col items-center" style={{ zIndex: 1, maxWidth: "clamp(300px,90vw,700px)" }}>
                  <div
                    className="inline-flex items-center rounded text-xs font-bold px-3 py-[3px] mb-5"
                    style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", letterSpacing: "0.04em" }}
                  >v1.0 · Презентация платформы</div>

                  <div className="flex items-center gap-4 mb-5">
                    <div
                      className="flex items-center justify-center rounded-[15px]"
                      style={{ width: 56, height: 56, background: "linear-gradient(135deg,var(--primary),var(--accent))", boxShadow: "0 12px 32px rgba(21,101,168,.38)" }}
                    >
                      <span className="block border-[4px] border-white rounded-[7px]" style={{ width: 22, height: 22 }}/>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text)" }}>
                      Corp<span style={{ color: "var(--primary)" }}>Meet</span>
                    </div>
                  </div>

                  <h1
                    style={{
                      fontSize: "clamp(30px,5vw,56px)",
                      fontWeight: 800,
                      letterSpacing: "-0.022em",
                      lineHeight: 1.06,
                      background: "linear-gradient(120deg,var(--text) 15%,var(--primary) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >Переговорные, встречи<br/>и видеосвязь — в одном месте</h1>

                  <p style={{ marginTop: 12, fontSize: "clamp(13px,1.5vw,16px)", color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 520 }}>
                    Корпоративная платформа бронирования переговорных со встроенными видеоконференциями и Telegram-ботом.
                  </p>

                  <div className="flex gap-2 flex-wrap justify-center mt-5">
                    {["📅 Бронирование","🎥 Видеовстречи","✈️ Telegram-бот","🏢 Пространства команд","🌐 РУ / УЗ"].map(p => (
                      <span key={p} className="rounded-md text-xs font-semibold px-3 py-1.5" style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>{p}</span>
                    ))}
                  </div>
                </div>
              </div>

              <Div/>

              {/* ── 01 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="01" label="Зачем это нужно"/><SH>Знакомая боль с переговорными</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 580 }}>Договорённости в чате, занятая комната «по факту», встречи в трёх разных сервисах. CorpMeet убирает этот хаос.</p></R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1 max-md:grid-cols-2">
                  <R delay={60}><Card icon="🤯" title="Двойные брони" desc="Две команды приходят в одну комнату — потому что расписания нет или оно в чьей-то голове."/></R>
                  <R delay={120}><Card icon="🧩" title="Зоопарк сервисов" desc="Календарь отдельно, видеозвонок отдельно, файлы где-то ещё. Ничего не связано."/></R>
                  <R delay={180}><Card icon="⏰" title="Забытые встречи" desc="Никто не напомнил вовремя — участники опаздывают или не приходят вовсе."/></R>
                </div>
                <R delay={240}><Note>CorpMeet объединяет расписание, видеосвязь, файлы и уведомления так, чтобы встреча «жила» в одном месте — от брони до записи.</Note></R>
              </Sec>

              <Div/>

              {/* ── 02 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="02" label="Обзор"/><SH>Что умеет CorpMeet</SH></R>
                <div className="grid grid-cols-4 gap-3 mt-5 max-sm:grid-cols-1 max-md:grid-cols-2">
                  {([["📅","Календарь брони","Недельная сетка слотов, статус переговорной в реальном времени, drag&drop."],
                    ["🎥","Видеоконференции","Звонок в приложении: экран, чат, файлы, запись, E2EE-шифрование."],
                    ["🏢","Пространства","Несколько компаний на одной платформе, общие физические переговорные."],
                    ["✈️","Telegram","Вход через Mini App, уведомления в группу, личные напоминания."],
                    ["👥","Гости и должности","Приглашение по @username и должностям, гостевой вход без регистрации."],
                    ["📎","Материалы встречи","Вложения к брони, файлы в чате, повестка и заметки."],
                    ["📊","Аналитика","Управление пользователями, статистика, обратная связь."],
                    ["🌗","Удобство","Тёмная/светлая тема, два языка (РУ/УЗ), экспорт в iCal."],
                  ] as [string, string, string][]).map(([ic, t, d], i) => (
                    <R key={t} delay={i * 45}><Card icon={ic} title={t} desc={d}/></R>
                  ))}
                </div>
              </Sec>

              <Div/>

              {/* ── 03 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="03" label="Вход в систему"/><SH>Три способа войти</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65 }}>Авторизация завязана на Telegram — никаких отдельных паролей.</p></R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1 max-md:grid-cols-2">
                  {([["📱","Telegram Mini App","Открываете бота @corpmeetbot, нажимаете «Запустить». Данные подтверждаются подписью Telegram.","основной способ"],
                    ["🔳","QR-код в браузере","На странице входа — QR. Сканируете телефоном, подтверждаете в боте — браузер авторизуется.","для десктопа"],
                    ["🌐","«Открыть в браузере»","Из Mini App одним нажатием в полную веб-версию. Ссылка одноразовая.","бесшовно"],
                  ] as [string, string, string, string][]).map(([ic, t, d, tag], i) => (
                    <R key={t} delay={i * 70}><Card icon={ic} title={t} desc={d}><Tag>{tag}</Tag></Card></R>
                  ))}
                </div>
                <R delay={210}><Note>Для разработчиков есть отдельный <b>Dev-вход</b> без Telegram — для тестирования.</Note></R>
              </Sec>

              <Div/>

              {/* ── 04 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="04" label="Пространства"/><SH>При первом входе — развилка из трёх путей</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 580 }}>«Пространство» — это ваша команда или компания. Переключайтесь между ними, как воркспейсы в Slack или Notion.</p></R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1">
                  <R delay={60}><Step n={1} title="Создать своё" desc="Вводите название, выбираете часовой пояс — становитесь владельцем и получаете invite-код."/></R>
                  <R delay={120}><Step n={2} title="Войти по коду" desc="Вводите invite-код — заявка уходит админам, они подтверждают вступление."/></R>
                  <R delay={180}><Step n={3} title="Найти по названию" desc="Начинаете печатать — видите автодополнение и отправляете заявку."/></R>
                </div>
                <R delay={240}><Note>Те же три кнопки показывает и Telegram-бот после команды <b>/start</b>. В шапке приложения всегда есть селектор пространств.</Note></R>
              </Sec>

              <Div/>

              {/* ── 05 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="05" label="Роли"/><SH>Кто что может в пространстве</SH></R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1 max-md:grid-cols-2">
                  <R delay={60}><Card icon="👑" title="Owner — владелец" desc="Создатель пространства. Может всё: настройки, удаление, передача владения. Один на пространство."/></R>
                  <R delay={120}><Card icon="🛡️" title="Admin" desc="Управляет участниками, комнатами и бронями всех. Назначается владельцем."/></R>
                  <R delay={180}><Card icon="🙋" title="Member — участник" desc="Бронирует, видит общий календарь и комнаты. Никем не управляет."/></R>
                </div>
                <div className="grid gap-6 mt-6 items-start" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <R dir="left">
                    <div className="font-bold mb-2.5" style={{ fontSize: 14, color: "var(--text)" }}>Приглашение коллег</div>
                    <BList items={[
                      { k: "Персональная ссылка", v: "по Telegram-ссылке, активируется при первом входе" },
                      { k: "По @username", v: "система находит пользователя и шлёт ему приглашение" },
                      { k: "По invite-коду", v: "публичный код, любой желающий подаёт заявку" },
                      { k: "Заявки на вступление", v: "owner и admin аппрувят в отдельной вкладке" },
                    ]}/>
                  </R>
                  <R dir="right">
                    <Card icon="⭐" title="Superadmin" accent>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 4 }}>Оператор сервиса с доступом ко всему: пользователи, все брони, аналитика, передача владения комнатами.</p>
                    </Card>
                  </R>
                </div>
              </Sec>

              <Div/>

              {/* ── 06 ─────────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="06" label="Комнаты"/><SH>Комната — это общий физический ресурс</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 580 }}>Одну и ту же комнату могут бронировать несколько пространств — типично для общего бизнес-центра.</p></R>
                <div className="grid gap-8 mt-6 items-start" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
                  <R dir="left">
                    <BList items={[
                      { k: "Создают", v: "комнаты только owner и admin. Автор получает права владельца." },
                      { k: "Бронирует", v: "любой участник пространства с доступом к комнате." },
                      { k: "Шеринг", v: <span>владелец делится по коду; получатель получает роль <b style={{ color: "var(--text)", fontWeight: 600 }}>shared</b>: видит и бронирует, но не редактирует.</span> },
                      { k: "Пересечения глобальные", v: "занятый слот не отдаст другому пространству." },
                    ]}/>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[["open","По коду сразу"],["approval","С подтверждением"],["closed","Отключено"]].map(([k, v]) => (
                        <div key={k} className="rounded-md p-3" style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                          <div className="font-bold" style={{ fontSize: 12.5, color: "var(--text)" }}>{k}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </R>
                  <R dir="right">
                    <div className="flex flex-col gap-2.5">
                      <Card icon="👁️" title='Режим "full"' desc="Все пространства видят детали чужих броней. Для офиса, где все знакомы."/>
                      <Card icon="🕶️" title='Режим "busy_only"' desc="Чужие брони — только плашка «Занято» без деталей. Для независимых компаний."/>
                    </div>
                  </R>
                </div>
              </Sec>

              <Div/>

              {/* ── 07 Calendar ─────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="07" label="Календарь"/><SH>Главный экран — недельная сетка</SH></R>
                <div className="grid gap-8 mt-6 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <R dir="left"><CalMock/></R>
                  <R dir="right"><BList items={[
                    { k: "Слоты по 30 минут", v: "кликаете, форма открывается с подставленным временем" },
                    { k: "Виджет статуса", v: "«Свободна» / «Занята до 11:00» над сеткой" },
                    { k: "Drag&drop", v: "перетащили карточку — бронь обновилась" },
                    { k: "Фильтры", v: <><Tag>Все</Tag><Tag>Офис</Tag><Tag>Онлайн</Tag><Tag>Гибрид</Tag></> },
                    { k: "busy_only", v: "чужие брони как серая плашка без деталей" },
                  ]}/></R>
                </div>
              </Sec>

              <Div/>

              {/* ── 08 Booking ──────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="08" label="Создание встречи"/><SH>Одна форма — вся встреча</SH></R>
                <div className="grid gap-8 mt-6 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <R dir="left"><BookMock/></R>
                  <R dir="right"><BList items={[
                    { k: "Тип встречи", v: "Офис (комната), Онлайн (видео) или Гибрид" },
                    { k: "Длительность", v: "пресеты 30м/1ч/1.5ч/2ч или вручную от 15 мин до 8 ч" },
                    { k: "Повторы", v: "ежедневно, еженедельно или свои дни; до 90 встреч в серии" },
                    { k: "Гости", v: "по @username или сразу по должностям — все одним кликом" },
                    { k: "Материалы", v: "вложения PDF/Word/Excel до 10 МБ, вставка через Ctrl+V" },
                    { k: "Напоминание", v: "за сколько минут предупредить (по умолчанию 15)" },
                  ]}/></R>
                </div>
              </Sec>

              <Div/>

              {/* ── 09 Video ────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="09" label="Видеовстречи"/><SH>Полноценная видеоконференция внутри продукта</SH></R>
                <div className="grid gap-8 mt-6 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <R dir="left"><VideoMock/></R>
                  <R dir="right"><BList items={[
                    { k: "Камера, микрофон, экран", v: "стандартный набор управления" },
                    { k: "Чат с файлами", v: "текст, реакции, поднятие руки, файлы до 20 МБ" },
                    { k: "Запись встречи", v: "организатор включает запись, скачивает MP4" },
                    { k: "Таймер и E2EE 🔒", v: "таймер встречи и индикатор сквозного шифрования" },
                    { k: "Модерация", v: "организатор приглушает или удаляет участника" },
                    { k: "Раскладки", v: "сетка / фокус на спикере; зелёная рамка у говорящего" },
                  ]}/></R>
                </div>
              </Sec>

              <Div/>

              {/* ── 10 Guest ────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="10" label="Гостевой вход"/><SH>Гости подключаются без регистрации</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 560 }}>Для встречи с внешними участниками организатор создаёт ссылку-приглашение — аккаунт гостю не нужен.</p></R>
                <div className="flex flex-wrap mt-5 max-sm:flex-col">
                  {[["🔗","Ссылка","Организатор копирует гостевую ссылку"],
                    ["🎚️","Превью","Гость вводит имя и видит превью камеры"],
                    ["⏳","Ожидание","Запрос уходит организатору"],
                    ["✅","В эфире","Организатор впускает гостя"],
                  ].map(([ic, t, d], i) => (
                    <React.Fragment key={t}>
                      {i > 0 && <div className="flex items-center px-[5px]" style={{ color: "var(--primary)", fontSize: 16, opacity: 0.5 }}>→</div>}
                      <R delay={i * 70}>
                        <div className="flex-1 min-w-[120px] rounded-md border p-3 text-center" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{ic}</div>
                          <div className="font-bold mb-1" style={{ fontSize: 13, color: "var(--text)" }}>{t}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{d}</div>
                        </div>
                      </R>
                    </React.Fragment>
                  ))}
                </div>
                <R delay={280}><Note>Ссылка одноразовая. Войти можно только когда организатор онлайн — это защищает встречу от посторонних.</Note></R>
              </Sec>

              <Div/>

              {/* ── 11 Telegram ─────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="11" label="Telegram"/><SH>Уведомления приходят туда, где команда уже сидит</SH></R>
                <div className="grid gap-8 mt-6 items-center" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <R dir="left"><TgMock/></R>
                  <R dir="right">
                    <BList items={[
                      { k: "В группу пространства", v: "новые и изменённые встречи с ссылкой на видео" },
                      { k: "Личные напоминания", v: "организатору и всем гостям за 15 минут" },
                      { k: "Приглашения гостям", v: "личное сообщение «Вас пригласили»" },
                      { k: "Уведомления об отмене", v: "если встречу удалили" },
                      { k: "Свой канал у каждого пространства", v: "компании не спамят друг друга" },
                    ]}/>
                    <Note>Команды бота: <b>/start</b> — вход · <b>/bind &lt;код&gt;</b> — привязать группу · <b>/unbind</b> · <b>/chatid</b></Note>
                  </R>
                </div>
              </Sec>

              <Div/>

              {/* ── 12 Admin ────────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="12" label="Управление"/><SH>Админка, аналитика и обратная связь</SH></R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1 max-md:grid-cols-2">
                  {([["📊","Аналитика","Встречи по дням, топ-10 организаторов, период 7/30/90 дней."],
                    ["👥","Пользователи","Список, роли, приглашение по @username, массовые операции."],
                    ["💬","Обратная связь","Обращения со скриншотом. Статусы: Новое → В работе → Закрыто."],
                    ["🧑‍💼","Должности","Двуязычные (Начальник, PM, Аналитик, Программист, Дизайнер)."],
                    ["📆","Экспорт календаря","Скачивание .ics и iCal-фид — встречи в Google/Apple/Outlook."],
                    ["🔔","Веб-уведомления","Desktop-напоминания и центр уведомлений с RSVP."],
                  ] as [string, string, string][]).map(([ic, t, d], i) => (
                    <R key={t} delay={i * 50}><Card icon={ic} title={t} desc={d}/></R>
                  ))}
                </div>
              </Sec>

              <Div/>

              {/* ── 13 Security ─────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="13" label="Под капотом"/><SH>Безопасность и рамки</SH></R>
                <R delay={60}>
                  <div className="flex gap-6 flex-wrap mt-5">
                    {([["🔒 E2EE","сквозное шифрование видео"],["PASETO","токены вместо JWT"],["15м–8ч","длительность встречи"],["90","встреч в серии повторов"],["РУ/УЗ","два языка интерфейса"]] as [string,string][]).map(([b, s]) => (
                      <div key={b}>
                        <div style={{ fontSize: "clamp(18px,2.5vw,30px)", fontWeight: 800, background: "linear-gradient(135deg,var(--text),var(--primary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>{b}</div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{s}</div>
                      </div>
                    ))}
                  </div>
                </R>
                <div className="grid grid-cols-3 gap-3 mt-5 max-sm:grid-cols-1">
                  <R delay={80}><Card icon="🛡️" title="Защита доступа" desc="Вход по подписи Telegram, одноразовые ссылки с коротким сроком жизни."/></R>
                  <R delay={140}><Card icon="🔐" title="Приватность" desc="Шифрование видео и режим busy_only скрывают содержание встреч."/></R>
                  <R delay={200}><Card icon="⚙️" title="Надёжность" desc="Безопасные миграции БД, фоновые задачи уведомлений каждые 60 секунд."/></R>
                </div>
              </Sec>

              <Div/>

              {/* ── 14 Scenario ─────────────────────────────────────── */}
              <Sec>
                <R><Eyebrow n="14" label="Сценарий"/><SH>Общий бизнес-центр — как это работает вместе</SH><p style={{ marginTop: 8, fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 560 }}>Три компании в одном здании: «Альфа», «Бета», «Гамма». Три переговорки на этаже.</p></R>
                <div className="mt-4">
                  <R delay={60}><Scene who="«Альфа»" text="Регистрируется первой, создаёт пространство и все три комнаты — становится их владельцем."/></R>
                  <R delay={120}><Scene who="«Бета»" text="Создаёт своё пространство. «Альфа» расшаривает все три комнаты по invite-коду — у «Беты» доступ с ролью shared."/></R>
                  <R delay={180}><Scene who="Бронь и конфликт" text="«Бета» бронирует «Москву» на 14:00–15:00. «Альфа» на то же время получает ошибку «Время занято». В режиме busy_only «Бета» видит только, что слот занят, — но не кем."/></R>
                  <R delay={240}><Scene who="«Гамма»" text="Работает в своих кабинетах, ничего не расшаривает — своё пространство, свои приватные комнаты."/></R>
                </div>
              </Sec>

              <Div/>

              {/* ── Closing ─────────────────────────────────────────── */}
              <section style={{ padding: "80px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 600px 260px at 50% 50%,var(--primary-light),transparent 70%)", pointerEvents: "none" }}/>
                <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 clamp(16px,4vw,52px)", position: "relative", zIndex: 1 }}>
                  <R dir="scale">
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="flex items-center justify-center rounded-[15px]" style={{ width: 52, height: 52, background: "linear-gradient(135deg,var(--primary),var(--accent))", boxShadow: "0 12px 32px rgba(21,101,168,.38)" }}>
                        <span className="block border-[4px] border-white rounded-[7px]" style={{ width: 21, height: 21 }}/>
                      </div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--text)" }}>Corp<span style={{ color: "var(--primary)" }}>Meet</span></div>
                    </div>
                    <h2 style={{ fontSize: "clamp(18px,2.8vw,34px)", fontWeight: 800, letterSpacing: "-0.016em", background: "linear-gradient(120deg,var(--text) 15%,var(--primary) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", maxWidth: "18ch", margin: "0 auto" }}>
                      Бронь, встреча и видеосвязь — без переключения контекста
                    </h2>
                    <p style={{ margin: "10px auto 0", fontSize: 14, color: "var(--text-sec)", lineHeight: 1.65, maxWidth: 460 }}>
                      От клика по свободному слоту до записи видеовстречи — всё в одном продукте, прямо из Telegram.
                    </p>
                    <div className="flex gap-2 flex-wrap justify-center mt-4">
                      {["📅 Расписание без двойных броней","🎥 Видео с шифрованием","🏢 Общие комнаты","✈️ Telegram-уведомления"].map(p => (
                        <span key={p} className="rounded-md text-xs font-semibold px-3 py-1.5" style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>{p}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 28 }}>
                      <button
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold px-4 py-2"
                        style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary-border)"; e.currentTarget.style.color = "var(--primary)"; e.currentTarget.style.background = "var(--primary-light)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "var(--elevated)"; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                        Закрыть презентацию
                      </button>
                    </div>
                  </R>
                </div>
              </section>

            </div>
          </ScrollCtx.Provider>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
