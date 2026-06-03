import React, { createContext, createRef, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";

// ── Actual CorpMeet brand logo paths (from SplashScreen.tsx) ──────────────
const BRAND_BG   = "M 24 0 L 183.477 0 L 183.477 159.476 A 24 24 0 0 1 159.477 183.476 L 24 183.476 A 24 24 0 0 1 0 159.476 L 0 24 A 24 24 0 0 1 24 0 Z";
const BRAND_W1   = "M183.477 -0.000213652H24.1003C10.8448 -0.000213652 0 10.8442 0 24.1002V29.4577C4.35965 30.1241 9.2007 31.4108 14.4453 33.2707C30.9597 39.1299 51.5212 50.7097 73.5983 66.6973C91.5408 53.3303 108.051 43.7672 121.444 39.0204C134.526 34.3831 144.68 34.3293 150.36 39.7837C156.794 45.9587 156.535 58.3064 150.797 74.4786C144.935 90.9937 133.356 111.555 117.37 133.632C130.738 151.575 140.298 168.087 145.045 181.48C145.286 182.154 145.511 182.818 145.725 183.476H159.377C172.632 183.476 183.477 172.634 183.477 159.378V-0.000213652Z";
const BRAND_W2   = "M0 101.189V159.376C0 168.393 5.01728 176.29 12.3973 180.42C18.0218 180.586 24.8281 179.206 32.5683 176.422C48.3471 170.754 67.9784 159.273 89.4463 143.198C89.6156 143.069 89.8609 143.105 89.9921 143.275C90.1104 143.434 90.0894 143.658 89.949 143.793C83.9014 149.56 77.876 155.016 71.9314 160.131C65.8788 165.336 59.906 170.191 54.0732 174.655L54.0705 174.658L50.6656 177.231L50.6641 177.232L50.6599 177.235L50.6572 177.237C47.73 179.421 44.8397 181.502 41.9898 183.475H116.387C121.896 177.132 121.584 165.949 116.392 151.497C110.722 135.719 99.2405 116.088 83.1656 94.6182C83.0359 94.4481 83.071 94.2006 83.2423 94.0716C83.4017 93.9534 83.6256 93.9747 83.7592 94.1147H83.7611C89.5271 100.163 94.9865 106.19 100.101 112.134C105.16 118.017 109.887 123.825 114.25 129.503C121.803 114.774 126.675 101.709 128.415 91.1596C130.095 80.9622 128.849 73.1332 124.268 68.4527C118.097 62.1511 106.564 62.2476 91.463 67.6745C75.6841 73.3441 56.0556 84.8229 34.5862 100.899C34.4156 101.028 34.1715 100.994 34.0391 100.821C33.9217 100.663 33.943 100.438 34.0842 100.305H34.083C40.1287 94.5412 46.1515 89.0841 52.0938 83.9737C57.9766 78.9107 63.7907 74.1829 69.4702 69.8191C54.7411 62.2655 41.6766 57.3913 31.1279 55.6515C20.9285 53.9692 13.1007 55.2151 8.42024 59.7979C2.11631 65.9691 2.21587 77.5024 7.64207 92.6007C13.3097 108.38 24.7911 128.011 40.8664 149.476C40.9965 149.648 40.9587 149.894 40.7867 150.023C40.6299 150.143 40.4056 150.122 40.2706 149.979V149.982C34.5064 143.936 29.052 137.913 23.9397 131.971C18.7325 125.916 13.8754 119.941 9.4105 114.105L9.40821 114.104L6.83453 110.699L6.83148 110.697L6.83034 110.692L6.8269 110.69C4.42679 107.474 2.15065 104.304 0 101.189Z";

// ── SVG icon set ───────────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  video:    "M15 10l4.553-2.276A1 1 0 0121 8.67v6.66a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  grid:     "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  send:     "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
  users:    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  clip:     "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.585a4 4 0 00-5.656-5.657l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
  chart:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  globe:    "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
  bell:     "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  lock:     "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  shield:   "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  building: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  export:   "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4",
  mic:      "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z",
  sun:      "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  star:     "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
};

function Ic({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

// ── Scroll reveal context ──────────────────────────────────────────────────
const ScrollCtx = createContext<React.RefObject<HTMLDivElement | null>>(createRef());

function R({ children, delay = 0, dir = "up", spring = false }: { children: React.ReactNode; delay?: number; dir?: "up"|"left"|"right"|"scale"; spring?: boolean }) {
  const scrollRef = useContext(ScrollCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current, root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } },
      { root, threshold: 0.08, rootMargin: "0px 0px -20px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);
  const ini = dir==="left"  ? {opacity:0,x:-24,y:0,scale:1,filter:"blur(5px)"} :
              dir==="right" ? {opacity:0,x:24,y:0,scale:1,filter:"blur(5px)"} :
              dir==="scale" ? {opacity:0,x:0,y:8,scale:0.97,filter:"blur(6px)"} :
                              {opacity:0,x:0,y:24,scale:0.98,filter:"blur(5px)"};
  const transition = spring
    ? {type:"spring" as const,stiffness:180,damping:26,mass:1,delay:delay/1000,filter:{duration:0.28,ease:"easeOut"},opacity:{duration:0.22,ease:"easeOut"}}
    : {duration:0.55,ease:[0.16,1,0.3,1] as const,delay:delay/1000,filter:{duration:0.28,ease:"easeOut"},opacity:{duration:0.25,ease:"easeOut"}};
  return (
    <motion.div ref={ref}
      initial={ini}
      animate={on ? {opacity:1,x:0,y:0,scale:1,filter:"blur(0px)"} : ini}
      transition={transition}
      style={{height:"100%"}}
    >{children}</motion.div>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────
const Tag = ({ch}:{ch:React.ReactNode}) => (
  <span className="inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded mr-1 mt-1"
    style={{background:"var(--primary-light)",border:"1px solid var(--primary-border)",color:"var(--primary)"}}>{ch}</span>
);

const Note = ({ch}:{ch:React.ReactNode}) => (
  <div className="mt-4 rounded-md px-4 py-3 text-sm leading-relaxed text-center"
    style={{background:"var(--primary-light)",borderLeft:"3px solid var(--primary)",border:"1px solid var(--primary-border)",color:"var(--text-sec)"}}>{ch}</div>
);

const BList = ({items}:{items:{k:string;v:React.ReactNode}[]}) => (
  <ul style={{listStyle:"none",padding:0,margin:0}}>
    {items.map((it,i) => (
      <li key={i} className="relative py-2 pl-5"
        style={{fontSize:"var(--font-sm)",lineHeight:1.6,color:"var(--text-sec)",
          borderBottom:i<items.length-1?"1px solid var(--border-light)":"none"}}>
        <span className="absolute left-[3px] top-[16px] w-[5px] h-[5px] rounded-sm"
          style={{background:"var(--primary)",opacity:.75,display:"block"}}/>
        <b style={{color:"var(--text)",fontWeight:600}}>{it.k}</b>{" — "}{it.v}
      </li>
    ))}
  </ul>
);

function Step({n,title,desc}:{n:number;title:string;desc:string}) {
  const [hov,setHov] = useState(false);
  return (
    <div className="relative rounded-md pt-7 px-4 pb-4" onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"var(--elevated)",border:`1px solid ${hov?"var(--primary-border)":"var(--border)"}`,
        boxShadow:"var(--card-shadow)",transition:"border-color .15s,transform .2s",transform:hov?"translateY(-2px)":"none",height:"100%"}}>
      <div className="absolute -top-[13px] left-4 w-7 h-7 rounded-md flex items-center justify-center text-white font-extrabold text-xs"
        style={{background:"linear-gradient(135deg,var(--primary),var(--accent))",boxShadow:"0 4px 12px rgba(21,101,168,.35)"}}>{n}</div>
      <div className="font-bold mb-1.5 text-sm" style={{color:"var(--text)"}}>{title}</div>
      <div className="text-xs leading-relaxed" style={{color:"var(--text-muted)"}}>{desc}</div>
    </div>
  );
}

function Scene({who,text}:{who:string;text:string}) {
  const [hov,setHov] = useState(false);
  return (
    <div className="rounded-md px-4 py-3 mt-2" onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"var(--elevated)",border:`1px solid ${hov?"var(--primary-border)":"var(--border)"}`,transition:"border-color .15s"}}>
      <div className="text-xs font-bold mb-1" style={{color:"var(--primary)"}}>{who}</div>
      <div className="text-sm leading-relaxed" style={{color:"var(--text-sec)"}}>{text}</div>
    </div>
  );
}

function MockShell({title,children}:{title:string;children:React.ReactNode}) {
  return (
    <div className="rounded-md overflow-hidden" style={{background:"var(--elevated)",border:"1px solid var(--border)",boxShadow:"var(--card-shadow)",maxWidth:400,width:"100%"}}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{borderBottom:"1px solid var(--border)",background:"var(--surface)"}}>
        <span className="w-[8px] h-[8px] rounded-full block bg-red-400/80"/><span className="w-[8px] h-[8px] rounded-full block bg-amber-400/80"/><span className="w-[8px] h-[8px] rounded-full block bg-green-400/80"/>
        <span className="ml-1.5 text-xs font-medium" style={{color:"var(--text-muted)"}}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Mocks ──────────────────────────────────────────────────────────────────
function CalMock() {
  const E = ({g,t,ti}:{g:string;t:string;ti:string}) => (
    <div className={`rounded px-1.5 py-0.5 text-white overflow-hidden text-[10px] font-semibold leading-snug ${g}`}>
      {t}<div className="opacity-80 font-normal text-[9px]">{ti}</div>
    </div>
  );
  const Slot = () => <div className="rounded" style={{height:28,background:"var(--primary-light)",border:"1px dashed var(--primary-border)"}}/>;
  const Busy = () => <div className="rounded flex items-center px-1.5 text-[10px]" style={{height:28,background:"var(--border)",color:"var(--text-muted)",border:"1px solid var(--border)"}}>Занято</div>;
  return (
    <MockShell title="Календарь · эта неделя">
      <div className="p-3">
        <div className="grid mb-1" style={{gridTemplateColumns:"34px repeat(5,1fr)",gap:3}}>
          <div/>
          {["ПН 2","ВТ 3","СР 4","ЧТ 5","ПТ 6"].map(d=><div key={d} className="text-[10px] font-bold text-center" style={{color:"var(--text-muted)"}}>{d}</div>)}
        </div>
        <div className="grid" style={{gridTemplateColumns:"34px repeat(5,1fr)",gap:3}}>
          <div className="flex flex-col gap-[3px]">
            {["09:00","10:00","11:00","12:00"].map(h=><div key={h} style={{height:28,fontSize:9,color:"var(--text-muted)",textAlign:"right",paddingRight:4,lineHeight:"28px"}}>{h}</div>)}
          </div>
          <div className="flex flex-col gap-[3px]"><E g="bg-gradient-to-br from-blue-600 to-sky-500" t="Планёрка" ti="09:00–09:30"/><Slot/><E g="bg-gradient-to-br from-cyan-600 to-cyan-400" t="Demo" ti="11:00–12:00"/></div>
          <div className="flex flex-col gap-[3px]"><Slot/><E g="bg-gradient-to-br from-violet-600 to-violet-400" t="1-on-1" ti="10:00–10:30"/><Slot/></div>
          <div className="flex flex-col gap-[3px]"><Busy/><Slot/><Slot/></div>
          <div className="flex flex-col gap-[3px]"><Slot/><Slot/><E g="bg-gradient-to-br from-blue-600 to-sky-500" t="Созвон" ti="11:00–11:30"/></div>
          <div className="flex flex-col gap-[3px]"><Slot/><E g="bg-gradient-to-br from-violet-600 to-violet-400" t="Ретро" ti="10:00–11:00"/><Slot/></div>
        </div>
      </div>
    </MockShell>
  );
}

function BookMock() {
  const Chip = ({l,on}:{l:string;on?:boolean}) => (
    <span className="px-2 py-1 rounded text-xs font-medium"
      style={{background:on?"var(--primary)":"var(--surface)",border:`1px solid ${on?"var(--primary)":"var(--border)"}`,color:on?"#fff":"var(--text-sec)"}}>{l}</span>
  );
  const Pill = ({l}:{l:string}) => (
    <span className="inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2 py-0.5"
      style={{background:"var(--primary-light)",border:"1px solid var(--primary-border)",color:"var(--primary)"}}>{l} ✕</span>
  );
  const Lbl = ({t}:{t:string}) => <div className="mb-1 text-[10px] font-bold uppercase" style={{letterSpacing:"0.08em",color:"var(--text-muted)"}}>{t}</div>;
  return (
    <MockShell title="Новое бронирование">
      <div className="p-2.5 flex flex-col gap-1.5">
        <div><Lbl t="Название"/><div className="rounded-md px-2.5 py-1.5 text-xs" style={{background:"var(--input-bg)",border:"1px solid var(--input-border)",color:"var(--text)"}} >Планёрка команды</div></div>
        <div><Lbl t="Тип"/><div className="flex gap-1 flex-wrap"><Chip l="🏢 Офис"/><Chip l="🌐 Онлайн" on/><Chip l="🔀 Гибрид"/></div></div>
        <div><Lbl t="Длительность"/><div className="flex gap-1 flex-wrap"><Chip l="30м"/><Chip l="1ч" on/><Chip l="1.5ч"/><Chip l="2ч"/></div></div>
        <div><Lbl t="Повторение"/><div className="flex gap-1 flex-wrap"><Chip l="Нет" on/><Chip l="Каждый день"/><Chip l="Каждую неделю"/></div></div>
        <div><Lbl t="Гости"/><div className="flex gap-1 flex-wrap"><Pill l="@timur"/><Pill l="Анна П."/></div></div>
        <button className="rounded-md px-4 py-1.5 text-xs font-bold text-white mt-1 self-start"
          style={{background:"linear-gradient(135deg,#1565a8,#114e85)",boxShadow:"0 3px 10px rgba(21,101,168,.28)"}}>Забронировать</button>
      </div>
    </MockShell>
  );
}

function VideoMock() {
  const Tile = ({name,sp,bg}:{name:string;sp?:boolean;bg:string}) => (
    <div className="rounded-md relative flex items-center justify-center overflow-hidden"
      style={{aspectRatio:"16/10",background:"var(--surface)",border:`1px solid ${sp?"var(--success)":"var(--border)"}`,boxShadow:sp?"0 0 0 2px rgba(16,185,129,.2)":undefined}}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{background:bg}}>{name[0]}</div>
      <span className="absolute bottom-1 left-1 rounded px-1.5 text-white" style={{fontSize:9,background:"rgba(0,0,0,.48)"}}>{name}</span>
    </div>
  );
  const Btn = ({ch,danger,off}:{ch:string;danger?:boolean;off?:boolean}) => (
    <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs cursor-pointer"
      style={{background:danger?"var(--danger)":off?"rgba(239,68,68,.1)":"var(--elevated)",border:danger?"none":off?"1px solid rgba(239,68,68,.3)":"1px solid var(--border)",color:off?"var(--danger)":danger?"#fff":"inherit"}}>{ch}</div>
  );
  return (
    <MockShell title="🔒 Зашифровано · 12:34">
      <div className="p-2 grid grid-cols-3 gap-1.5">
        <Tile name="Тимур" sp bg="linear-gradient(135deg,var(--primary),var(--accent))"/>
        <Tile name="Анна" bg="linear-gradient(135deg,#7c3aed,#a78bfa)"/>
        <Tile name="Дмитрий" bg="linear-gradient(135deg,#0891b2,#22d3ee)"/>
      </div>
      <div className="flex justify-center gap-1.5 p-2" style={{borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
        <Btn ch="🎤"/><Btn ch="📷" off/><Btn ch="🖥️"/><Btn ch="💬"/><Btn ch="⏺" off/><Btn ch="📞" danger/>
      </div>
    </MockShell>
  );
}

function TgMock() {
  return (
    <MockShell title="Telegram · группа команды">
      <div className="p-3 flex flex-col gap-2">
        <div className="rounded-md px-3 py-2" style={{background:"var(--surface)",border:"1px solid var(--border)",borderTopLeftRadius:2,fontSize:12,lineHeight:1.6,color:"var(--text-sec)",maxWidth:"92%",whiteSpace:"pre-line"}}>
          <div className="text-xs font-bold mb-1" style={{color:"var(--primary)"}}>CorpMeet Bot</div>
          {"📅 Новое бронирование\n👤 Тимур\n📌 Планёрка\n🕐 2 июн 10:00 – 11:00"}
          <div className="mt-2 rounded-md inline-block px-2 py-1 text-xs font-bold"
            style={{background:"var(--primary-light)",border:"1px solid var(--primary-border)",color:"var(--primary)"}}>🎥 Подключиться</div>
        </div>
        <div className="rounded-md px-3 py-2" style={{background:"var(--surface)",border:"1px solid var(--border)",borderLeft:"3px solid #f59e0b",borderTopLeftRadius:2,fontSize:12,lineHeight:1.6,color:"var(--text-sec)",maxWidth:"92%",whiteSpace:"pre-line"}}>
          <div className="text-xs font-bold mb-1" style={{color:"var(--primary)"}}>CorpMeet Bot</div>
          {"⏰ Напоминание! Через 15 минут:\n📌 Планёрка · 10:00"}
        </div>
      </div>
    </MockShell>
  );
}

// ── Card component ─────────────────────────────────────────────────────────
function Card({icon,title,desc,accent,onClick,children}:{icon:string;title:string;desc?:string;accent?:boolean;onClick?:()=>void;children?:React.ReactNode}) {
  const [hov,setHov] = useState(false);
  const active = accent || hov;
  return (
    <div className="rounded-md p-4 flex flex-col h-full"
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{
        background:"var(--elevated)",
        border:`1px solid ${active?"var(--primary-border)":"var(--border)"}`,
        boxShadow:hov?"var(--card-shadow),0 4px 16px rgba(21,101,168,.07)":"var(--card-shadow)",
        transition:"border-color .15s,transform .2s,box-shadow .2s",
        transform:hov?"translateY(-2px)":"none",
        cursor:onClick?"pointer":"default"
      }}>
      <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 shrink-0"
        style={{
          background:active?"linear-gradient(135deg,var(--primary),var(--accent))":"var(--primary-light)",
          border:active?"none":"1px solid var(--primary-border)",
          color:active?"#fff":"var(--primary)",
          transition:"all .15s"
        }}>
        <Ic name={icon} size={15}/>
      </div>
      <div className="font-bold mb-2 leading-snug" style={{color:"var(--text)",fontSize:"var(--font-sm)"}}>{title}</div>
      {desc && <div className="leading-relaxed flex-1" style={{color:"var(--text-muted)",fontSize:"var(--font-sm)"}}>{desc}</div>}
      {children}
    </div>
  );
}

// ── transitions-dev CSS (avatar-group-hover + digit-pop-in) ───────────────
const ANIM_CSS = `
.t-avatar{transform-origin:center;transform:translateY(var(--shift,0px)) scale(var(--scale-active,1));transition:transform 300ms cubic-bezier(0.22,1,0.36,1);will-change:transform;}
@media(prefers-reduced-motion:reduce){.t-avatar{transition:none!important;transform:none!important;}}
@keyframes t-digit-pop-in{0%{transform:translateY(14px);opacity:0;filter:blur(3px);}100%{transform:none;opacity:1;filter:none;}}
.t-digit-group{display:inline-flex;align-items:baseline;}
.t-digit{display:inline-block;will-change:transform,opacity,filter;}
.t-digit-group.is-animating .t-digit{animation:t-digit-pop-in 600ms cubic-bezier(0.34,1.45,0.64,1) both;}
.t-digit-group.is-animating .t-digit[data-s="1"]{animation-delay:70ms;}
.t-digit-group.is-animating .t-digit[data-s="2"]{animation-delay:140ms;}
.t-digit-group.is-animating .t-digit[data-s="3"]{animation-delay:210ms;}
@media(prefers-reduced-motion:reduce){.t-digit-group .t-digit{animation:none!important;}}
`;

// ── HoverGrid — avatar-group-hover for card grids ──────────────────────────
function HoverGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const setShifts = (activeIdx: number | null, phase: "in" | "out") => {
    const root = rootRef.current; if (!root) return;
    const lift = -4, falloff = 0.5, scale = 1.015;
    const tf = "cubic-bezier(0.22,1,0.36,1)";
    root.querySelectorAll<HTMLElement>(".t-avatar").forEach((el, i) => {
      el.style.transitionTimingFunction = tf;
      el.style.transitionDuration = phase === "out" ? "300ms" : "200ms";
      if (activeIdx === null) {
        el.style.setProperty("--shift","0px");
        el.style.setProperty("--scale-active","1");
        return;
      }
      const d = Math.abs(i - activeIdx);
      el.style.setProperty("--shift", (lift * Math.pow(falloff, d)).toFixed(2) + "px");
      el.style.setProperty("--scale-active", i === activeIdx ? String(scale) : "1");
    });
  };
  return (
    <div ref={rootRef} onMouseLeave={() => setShifts(null, "out")}
      className="gap-3 mt-5"
      style={{ display:"grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: "1fr" }}>
      {React.Children.map(children, (child, i) => (
        <div key={i} className="t-avatar" onMouseEnter={() => setShifts(i, "in")} style={{height:"100%"}}>
          {child}
        </div>
      ))}
    </div>
  );
}

// ── AnimStat — digit-pop-in for statistics ─────────────────────────────────
function AnimStat({ big, small, idx = 0 }: { big: string; small: string; idx?: number }) {
  const scrollRef = useContext(ScrollCtx);
  const ref = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current, root = scrollRef.current, group = groupRef.current;
    if (!el || !root || !group) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        group.classList.remove("is-animating");
        void group.offsetHeight;
        group.classList.add("is-animating");
      } else { group.classList.remove("is-animating"); }
    }, { root, threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRef]);
  const chars = big.split("");
  return (
    <div ref={ref} style={{ transitionDelay: `${idx * 80}ms` }}>
      <span ref={groupRef} className="t-digit-group is-animating"
        style={{ fontSize: "clamp(18px,2.3vw,28px)", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>
        {chars.map((ch, i) => (
          <span key={i} className="t-digit"
            data-s={i >= chars.length - 2 ? String(chars.length - i) : undefined}>{ch}</span>
        ))}
      </span>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{small}</div>
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────
const PAD = "0 clamp(32px,5vw,72px)";

const Sec = ({ch,id}:{ch:React.ReactNode;id?:string}) => (
  <section id={id} style={{padding:"60px 0"}}>
    <div style={{padding:PAD}}>{ch}</div>
  </section>
);

const Div = () => (
  <div style={{margin:`0 clamp(32px,5vw,72px)`,height:1,position:"relative"}}>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent 0%,var(--border) 20%,var(--border) 80%,transparent 100%)"}}/>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:4,height:4,borderRadius:"50%",background:"var(--primary-border)",boxShadow:"0 0 6px var(--primary-border)"}}/>
  </div>
);

function Eyebrow({n,label}:{n:string;label:string}) {
  const {isDark} = useTheme();
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span style={{fontWeight:800,padding:"3px 10px",borderRadius:6,
        background:"linear-gradient(135deg,var(--primary),var(--accent))",color:"#fff",
        letterSpacing:"0.06em",fontSize:12,
        boxShadow:isDark
          ?"0 2px 10px rgba(91,163,223,.35),inset 0 1px 0 rgba(255,255,255,.15)"
          :"0 2px 10px rgba(21,101,168,.28),inset 0 1px 0 rgba(255,255,255,.25)"
      }}>{n}</span>
      <span style={{fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",fontSize:11,
        background:"linear-gradient(90deg,var(--primary),var(--accent))",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"
      }}>{label}</span>
    </div>
  );
}

function SH({ch,accent}:{ch:string;accent?:string}) {
  const base: React.CSSProperties = {fontSize:"clamp(20px,2.8vw,36px)",fontWeight:800,letterSpacing:"-0.018em",lineHeight:1.1,color:"var(--text)"};
  if (!accent) return <h2 style={base}>{ch}</h2>;
  const idx = ch.indexOf(accent);
  if (idx === -1) return <h2 style={base}>{ch}</h2>;
  return (
    <h2 style={base}>
      {ch.slice(0,idx)}
      <span style={{background:"linear-gradient(135deg,var(--primary) 0%,var(--accent) 100%)",
        WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
        color:"var(--primary)"}}>{accent}</span>
      {ch.slice(idx+accent.length)}
    </h2>
  );
}

// ── Logo mark — actual SVG brand icon ────────────────────────────────────
function LogoMark({size=28}:{size?:number}) {
  const {isDark} = useTheme();
  const bgFill   = isDark ? "#0f172a" : "#dbeafe";
  const wingFill = isDark ? "#ffffff" : "#1565a8";
  return (
    <div style={{width:size,height:size,borderRadius:size*0.2,overflow:"hidden",flexShrink:0,
      boxShadow:"0 4px 12px rgba(21,101,168,.38)",background:isDark?"#1565a8":"#dbeafe"}}>
      <svg viewBox="-4 -4 192 192" width={size} height={size} style={{display:"block"}}>
        <path d={BRAND_BG} fill={bgFill}/>
        <path d={BRAND_W1} fill={wingFill}/>
        <path d={BRAND_W2} fill={wingFill}/>
      </svg>
    </div>
  );
}

function LogoText({size=16}:{size?:number}) {
  const {isDark} = useTheme();
  const corpColor = isDark ? "#f8fafc" : "#1a1a1a";
  return (
    <span style={{fontWeight:800,fontSize:size,letterSpacing:"0.12em",fontVariant:"normal",textTransform:"none"}}>
      <span style={{color:corpColor}}>CORP</span><span style={{color:"#1565a8"}}>MEET</span>
    </span>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export function PresentationPanel({isOpen,onClose}:{isOpen:boolean;onClose:()=>void}) {
  const {isDark} = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const progRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el=scrollRef.current, bar=progRef.current;
    if (!el||!bar) return;
    const fn=()=>{const max=el.scrollHeight-el.clientHeight; bar.style.width=(max>0?el.scrollTop/max*100:0)+"%";};
    el.addEventListener("scroll",fn,{passive:true});
    return ()=>el.removeEventListener("scroll",fn);
  },[isOpen]);

  // Inject transitions-dev CSS once
  useEffect(() => {
    let el = document.getElementById("pres-anim") as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = "pres-anim"; document.head.appendChild(el); }
    el.textContent = ANIM_CSS;
    return () => { document.getElementById("pres-anim")?.remove(); };
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    const container = scrollRef.current;
    if (!el || !container) return;
    container.scrollTo({ top: el.offsetTop - 56, behavior: "smooth" });
  };

  useEffect(() => {
    if (!isOpen) return;
    const fn=(e:KeyboardEvent)=>{if(e.key==="Escape") onClose();};
    document.addEventListener("keydown",fn);
    return ()=>document.removeEventListener("keydown",fn);
  },[isOpen,onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div key="pres-backdrop"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            transition={{duration:0.4, ease:"easeOut"}}
            style={{position:"fixed",inset:0,zIndex:9989,background:"rgba(0,0,0,0.25)",backdropFilter:"blur(2px)"}}
            onClick={onClose}
          />
          {/* Panel — smooth fade + scale */}
          <motion.div key="pres"
            initial={{opacity:0,scale:0.97,filter:"blur(8px)"}}
            animate={{opacity:1,scale:1,filter:"blur(0px)"}}
            exit={{opacity:0,scale:0.98,filter:"blur(4px)"}}
            transition={{duration:0.5,ease:[0.16,1,0.3,1],filter:{duration:0.35,ease:"easeOut"}}}
            style={{position:"fixed",inset:0,zIndex:9990,background:"var(--bg)",display:"flex",flexDirection:"column",
              boxShadow:isDark?"-20px 0 60px rgba(0,0,0,.8)":"-8px 0 40px rgba(15,23,42,.12)"}}>

          {/* Topbar */}
          <div className="shrink-0 flex items-center justify-between" style={{height:52,padding:`0 clamp(20px,4vw,48px)`,borderBottom:"1px solid var(--border)",
            background:isDark?"var(--toolbar)":"var(--toolbar)",backdropFilter:"blur(var(--glass-blur))",WebkitBackdropFilter:"blur(var(--glass-blur))"}}>
            <div className="flex items-center gap-2.5">
              <LogoMark size={28}/>
              <LogoText size={16}/>
              <span className="text-[11px] font-bold rounded px-2 py-0.5"
                style={{background:"var(--elevated)",border:"1px solid var(--border)",color:"var(--text-muted)",letterSpacing:"0.04em"}}>v1.0</span>
            </div>
            <button onClick={onClose}
              className="flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5"
              style={{background:"var(--elevated)",border:"1px solid var(--border)",color:"var(--text-muted)",cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--primary-border)";e.currentTarget.style.color="var(--primary)";e.currentTarget.style.background="var(--primary-light)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-muted)";e.currentTarget.style.background="var(--elevated)";}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Закрыть
            </button>
          </div>

          {/* Progress */}
          <div ref={progRef} style={{height:2,width:"0%",background:"linear-gradient(90deg,var(--primary),var(--accent))",transition:"width .08s linear",flexShrink:0}}/>

          {/* Scroll area */}
          <ScrollCtx.Provider value={scrollRef}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">

            {/* ── HERO ──────────────────────────────────────────────── */}
            <div className="flex flex-col items-center justify-center text-center relative overflow-hidden"
              style={{minHeight:"calc(100vh - 54px)",padding:"60px 0 48px"}}>
              {/* Blob 1 — primary, slow drift + rotate */}
              <div style={{position:"absolute",width:800,height:500,top:-180,right:-120,borderRadius:"50%",
                background:isDark
                  ?"radial-gradient(ellipse,rgba(91,163,223,.18) 0%,rgba(56,189,248,.06) 60%,transparent 80%)"
                  :"radial-gradient(ellipse,rgba(21,101,168,.13) 0%,rgba(14,165,233,.05) 60%,transparent 80%)",
                filter:"blur(80px)",animation:"ppb1 14s ease-in-out infinite alternate",pointerEvents:"none"}}/>
              {/* Blob 2 — accent, faster, scale */}
              <div style={{position:"absolute",width:560,height:360,bottom:-100,left:-80,borderRadius:"50%",
                background:isDark
                  ?"radial-gradient(ellipse,rgba(56,189,248,.12) 0%,rgba(91,163,223,.04) 60%,transparent 80%)"
                  :"radial-gradient(ellipse,rgba(14,165,233,.10) 0%,rgba(21,101,168,.03) 60%,transparent 80%)",
                filter:"blur(70px)",animation:"ppb2 10s 3s ease-in-out infinite alternate",pointerEvents:"none"}}/>
              {/* Blob 3 — small central halo */}
              <div style={{position:"absolute",width:320,height:180,top:"50%",left:"50%",
                transform:"translate(-50%,-50%)",borderRadius:"50%",
                background:isDark
                  ?"radial-gradient(ellipse,rgba(91,163,223,.10) 0%,transparent 70%)"
                  :"radial-gradient(ellipse,rgba(21,101,168,.07) 0%,transparent 70%)",
                filter:"blur(50px)",animation:"ppb3 8s 1s ease-in-out infinite alternate",pointerEvents:"none"}}/>
              {/* Grid texture */}
              <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:isDark?0.03:0.02,
                backgroundImage:"linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)",
                backgroundSize:"48px 48px"}}/>
              <style>{`
                @keyframes ppb1{from{transform:translateY(0) rotate(0deg)}to{transform:translateY(-30px) rotate(3deg)}}
                @keyframes ppb2{from{transform:translateY(0) rotate(0deg) scale(1)}to{transform:translateY(-20px) rotate(-4deg) scale(1.08)}}
                @keyframes ppb3{from{transform:translate(-50%,-50%) scale(1)}to{transform:translate(-50%,-54%) scale(1.15)}}
              `}</style>

              <div className="relative flex flex-col items-center" style={{zIndex:1,maxWidth:"min(680px,90vw)"}}>
                <div style={{fontSize:"clamp(28px,4.5vw,52px)",fontWeight:800,letterSpacing:"-0.022em",lineHeight:1.07,color:"var(--text)"}}>
                  <motion.div initial={{opacity:0,y:24,filter:"blur(4px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}}
                    transition={{duration:0.55,ease:[0.16,1,0.3,1],delay:0.10}}>
                    Переговорные, встречи
                  </motion.div>
                  <motion.div initial={{opacity:0,y:24,filter:"blur(4px)"}} animate={{opacity:1,y:0,filter:"blur(0px)"}}
                    transition={{duration:0.55,ease:[0.16,1,0.3,1],delay:0.19}}>
                    и видеосвязь —{" "}
                    <span style={{background:"linear-gradient(135deg,var(--primary),var(--accent))",
                      WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>в одном месте</span>
                  </motion.div>
                </div>

                <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
                  transition={{duration:0.5,ease:[0.16,1,0.3,1],delay:0.28}}
                  style={{marginTop:14,fontSize:"clamp(13px,1.5vw,16px)",color:"var(--text-sec)",lineHeight:1.65,maxWidth:520}}>
                  Корпоративная платформа бронирования переговорных со встроенными видеоконференциями и Telegram-ботом.
                </motion.p>

                <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
                  transition={{duration:0.5,ease:[0.16,1,0.3,1],delay:0.36}}
                  className="flex gap-2 flex-wrap justify-center mt-5">
                  {([
                    {icon:"calendar", label:"Бронирование"},
                    {icon:"video",    label:"Видеовстречи"},
                    {icon:"send",     label:"Telegram"},
                    {icon:"grid",     label:"Пространства команд"},
                    {icon:"globe",    label:"РУ / УЗ"},
                  ] as {icon:string;label:string}[]).map(({icon,label})=>(
                    <span key={label} className="flex items-center gap-1.5 rounded-md text-xs font-semibold px-3 py-1.5"
                      style={{
                        background:isDark
                          ?"linear-gradient(135deg,rgba(28,28,46,0.9),rgba(40,40,64,0.9))"
                          :"linear-gradient(135deg,rgba(255,255,255,0.85),rgba(248,250,255,0.85))",
                        border:"1px solid var(--primary-border)",
                        color:"var(--text-sec)",
                        backdropFilter:"blur(8px)",
                        boxShadow:isDark
                          ?"0 2px 8px rgba(0,0,0,.25),inset 0 1px 0 rgba(91,163,223,.12)"
                          :"0 2px 8px rgba(21,101,168,.06),inset 0 1px 0 rgba(255,255,255,.9)"
                      }}>
                      <span style={{color:"var(--primary)",opacity:0.9,display:"flex"}}><Ic name={icon} size={13}/></span>
                      {label}
                    </span>
                  ))}
                </motion.div>
              </div>
            </div>

            <Div/>

            {/* ── 01 Problem ────────────────────────────────────────── */}
            <Sec ch={<>
              <R spring><Eyebrow n="01" label="Зачем это нужно"/>
                <SH ch="Знакомая боль с переговорными" accent="переговорными"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:580}}>Договорённости в чате, занятая комната «по факту», встречи в трёх разных сервисах. CorpMeet убирает этот хаос.</p>
              </R>
              <HoverGrid cols={3}>
                {[["calendar","Двойные брони","Две команды приходят в одну комнату — потому что расписания нет или оно в чьей-то голове."],
                  ["grid","Разрозненные сервисы","Календарь отдельно, видеозвонок отдельно, файлы где-то ещё. Ничего не связано."],
                  ["bell","Забытые встречи","Никто не напомнил вовремя — участники опаздывают или не приходят вовсе."],
                ].map(([ic,t,d],i)=><R key={t} delay={i*80}><Card icon={ic} title={t} desc={d}/></R>)}
              </HoverGrid>
              <R delay={180}><Note ch="CorpMeet объединяет расписание, видеосвязь, файлы и уведомления — встреча «живёт» в одном месте от брони до записи."/></R>
            </>}/>

            <Div/>

            {/* ── 02 Overview ───────────────────────────────────────── */}
            <Sec ch={<>
              <R spring><Eyebrow n="02" label="Обзор"/><SH ch="Что умеет CorpMeet" accent="CorpMeet"/></R>
              <HoverGrid cols={4}>
                {([["calendar","Бронирование","Недельная сетка, drag&drop, повторы, статус комнаты.","sec-07"],
                  ["video","Видеовстречи","LiveKit с E2EE, запись, экран, чат, blur фона, Krisp.","sec-09"],
                  ["building","Комнаты","Общие переговорные с режимами видимости и шерингом.","sec-06"],
                  ["grid","Пространства","Несколько компаний на платформе, роли, invite-коды.","sec-04"],
                  ["send","Telegram","Mini App, бот, уведомления в группу и личные напоминания.","sec-11"],
                  ["bell","Уведомления","Web push, RSVP, центр уведомлений с историей.","sec-12"],
                  ["users","Гости","Приглашение по @username, по должностям, гостевой вход.","sec-10"],
                  ["chart","Аналитика","Статистика встреч, топ организаторов, управление участниками.","sec-14"],
                  ["clip","Вложения","Файлы к брони и в чате встречи, вставка через Ctrl+V.","sec-08"],
                  ["export","Экспорт","Скачивание .ics и подписка на iCal-фид.","sec-14"],
                  ["globe","Локализация","Два языка (РУ/УЗ), любой часовой пояс.","sec-15"],
                  ["sun","Темы","Тёмная и светлая, синхронизация с системой.","sec-15"],
                ] as [string,string,string,string][]).map(([ic,t,d,target],i)=>(
                  <R key={t} delay={i*45}><Card icon={ic} title={t} desc={d} onClick={()=>scrollTo(target)}/></R>
                ))}
              </HoverGrid>
            </>}/>

            <Div/>

            {/* ── 03 Login ──────────────────────────────────────────── */}
            <Sec id="sec-03" ch={<>
              <R spring><Eyebrow n="03" label="Вход в систему"/><SH ch="Три способа войти" accent="Три"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)"}}>Авторизация через Telegram — никаких отдельных паролей.</p>
              </R>
              <HoverGrid cols={3}>
                {([["send","Telegram Mini App","Открываете бота @corpmeetbot и входите прямо внутри Telegram. Данные подтверждаются криптографической подписью.","основной"],
                  ["star","QR-код в браузере","На странице входа — QR. Сканируете телефоном, подтверждаете в боте — браузер авторизуется автоматически.","для десктопа"],
                  ["globe","«Открыть в браузере»","Из Mini App одним нажатием переходите в полную веб-версию. Ссылка одноразовая, действует несколько минут.","бесшовно"],
                ] as [string,string,string,string][]).map(([ic,t,d,tag],i)=>(
                  <R key={t} delay={i*70}><Card icon={ic} title={t} desc={d}><Tag ch={tag}/></Card></R>
                ))}
              </HoverGrid>
            </>}/>

            <Div/>

            {/* ── Quickstart ────────────────────────────────────────── */}
            <Sec id="sec-start" ch={<>
              <R spring><Eyebrow n="→" label="Быстрый старт"/><SH ch="Как начать пользоваться платформой" accent="начать"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:560}}>Пять шагов от первого открытия до первой видеовстречи.</p>
              </R>
              <HoverGrid cols={5}>
                {([
                  ["01","Войдите","Откройте @corpmeetbot в Telegram или отсканируйте QR-код в браузере."],
                  ["02","Создайте пространство","Введите название компании/команды и invite-код — или присоединитесь к существующему."],
                  ["03","Заполните профиль","Укажите имя и выберите должность — это нужно для приглашения на встречи."],
                  ["04","Забронируйте встречу","Нажмите на свободный слот в календаре, заполните форму и добавьте гостей."],
                  ["05","Начните видеозвонок","Откройте бронирование и нажмите «Подключиться» — встреча стартует в браузере."],
                ] as [string,string,string][]).map(([num,t,d],i)=>(
                  <R key={num} delay={i*60}>
                    <div className="rounded-md p-4 h-full flex flex-col" style={{background:"var(--elevated)",border:"1px solid var(--border)",boxShadow:"var(--card-shadow)"}}>
                      <div className="font-extrabold mb-3" style={{fontSize:28,color:"var(--primary)",lineHeight:1}}>{num}</div>
                      <div className="font-bold text-sm mb-1.5" style={{color:"var(--text)"}}>{t}</div>
                      <div className="text-xs leading-relaxed" style={{color:"var(--text-muted)"}}>{d}</div>
                    </div>
                  </R>
                ))}
              </HoverGrid>
            </>}/>

            <Div/>

            {/* ── 04 Spaces ─────────────────────────────────────────── */}
            <Sec id="sec-04" ch={<>
              <R spring><Eyebrow n="04" label="Пространства"/><SH ch="При первом входе — развилка" accent="развилка"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:560}}>«Пространство» — ваша компания или команда. Как воркспейсы в Slack: один пользователь, несколько пространств, быстрое переключение.</p>
              </R>
              <HoverGrid cols={3}>
                <R delay={60}><Step n={1} title="Создать своё" desc="Вводите название, выбираете часовой пояс — становитесь владельцем и получаете invite-код для коллег."/></R>
                <R delay={120}><Step n={2} title="Войти по коду" desc="Вводите invite-код пространства — заявка уходит админам, они одобряют вступление."/></R>
                <R delay={180}><Step n={3} title="Найти по названию" desc="Начинаете печатать — видите автодополнение и отправляете заявку на вступление."/></R>
              </HoverGrid>
              <R delay={240}><Note ch={<>Те же три кнопки показывает Telegram-бот после команды <b>/start</b>. В шапке приложения всегда есть селектор пространств.</>}/></R>
              <R delay={300}>
                <div className="mt-3 rounded-md p-4" style={{background:"var(--elevated)",border:"1px solid var(--border)"}}>
                  <div className="font-semibold mb-2" style={{fontSize:"var(--font-sm)",color:"var(--text)"}}>🔒 Приватность пространства</div>
                  <BList items={[
                    {k:"Только по invite-коду",v:"вступить можно только зная invite-код пространства — ссылка не публичная"},
                    {k:"Подтверждение администратора",v:"каждая заявка на вступление требует одобрения owner или admin"},
                    {k:"Привязка к Telegram-группе",v:"пространство привязывается к корпоративной Telegram-группе командой /bind — уведомления идут только в неё"},
                    {k:"Только участники группы",v:"вступить через бота могут только те, кто состоит в привязанной Telegram-группе компании"},
                  ]}/>
                </div>
              </R>
            </>}/>

            <Div/>

            {/* ── 05 Roles ──────────────────────────────────────────── */}
            <Sec id="sec-05" ch={<>
              <R spring><Eyebrow n="05" label="Роли"/><SH ch="Кто что может в пространстве" accent="может"/></R>
              <HoverGrid cols={4}>
                <R delay={60}><Card icon="star" title="Owner — владелец" desc="Создатель пространства. Может всё: настройки, удаление, передача владения. Один на пространство."/></R>
                <R delay={110}><Card icon="shield" title="Admin" desc="Управляет участниками, комнатами и бронями всех. Назначается владельцем."/></R>
                <R delay={160}><Card icon="users" title="Member — участник" desc="Бронирует, видит общий календарь пространства и доступные переговорные."/></R>
                <R delay={210}><Card icon="shield" title="Superadmin платформы" accent desc="Оператор сервиса с доступом ко всему: пользователи, все брони, аналитика, передача владения комнатами."/></R>
              </HoverGrid>
              <R delay={260}>
                <div className="mt-4 rounded-md p-4" style={{background:"var(--elevated)",border:"1px solid var(--border)"}}>
                  <div className="font-semibold mb-2" style={{fontSize:"var(--font-sm)",color:"var(--text)"}}>Приглашение коллег</div>
                  <BList items={[
                    {k:"Персональная ссылка",v:"по Telegram-ссылке, активируется при первом входе"},
                    {k:"По @username",v:"система находит пользователя и шлёт ему приглашение в Telegram"},
                    {k:"По invite-коду",v:"публичный код, любой желающий подаёт заявку"},
                    {k:"Заявки на вступление",v:"owner и admin аппрувят в отдельной вкладке"},
                  ]}/>
                </div>
              </R>
            </>}/>

            <Div/>

            {/* ── 06 Rooms ──────────────────────────────────────────── */}
            <Sec id="sec-06" ch={<>
              <R spring><Eyebrow n="06" label="Комнаты"/><SH ch="Переговорная — общий физический ресурс" accent="общий"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:560}}>Одну комнату могут бронировать несколько пространств — типично для общего бизнес-центра.</p>
              </R>
              <div className="grid gap-8 mt-5 items-start" style={{gridTemplateColumns:"1.1fr 0.9fr"}}>
                <R dir="left">
                  <BList items={[
                    {k:"Создают",v:"только owner и admin. Автор становится владельцем комнаты."},
                    {k:"Бронирует",v:"любой участник пространства, у которого есть доступ."},
                    {k:"Шеринг",v:<span>владелец делится по коду; получатель получает роль <b style={{color:"var(--text)",fontWeight:600}}>shared</b> — видит и бронирует, но не редактирует.</span>},
                    {k:"Глобальные пересечения",v:"занятый слот не отдаст другому пространству — никаких накладок."},
                    {k:"Передача и сброс кода",v:"владелец может сменить invite-код или передать владение другому пространству."},
                  ]}/>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[["open","По коду сразу"],["approval","С подтверждением"],["closed","Отключено"]].map(([k,v])=>(
                      <div key={k} className="rounded-md p-2.5" style={{background:"var(--elevated)",border:"1px solid var(--border)"}}>
                        <div className="font-bold text-xs" style={{color:"var(--text)"}}>{k}</div>
                        <div className="text-[11px] mt-0.5" style={{color:"var(--text-muted)"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </R>
                <R dir="right">
                  <div className="flex flex-col gap-2.5">
                    <Card icon="users" title='Режим "full"' desc="Все пространства видят детали чужих броней: название, организатор. Для офиса, где все знакомы."/>
                    <Card icon="lock" title='Режим "busy_only"' desc="Чужие брони — только плашка «Занято» без деталей. Для независимых компаний в коворкинге."/>
                  </div>
                </R>
              </div>
            </>}/>

            <Div/>

            {/* ── 07 Calendar ───────────────────────────────────────── */}
            <Sec id="sec-07" ch={<>
              <R spring><Eyebrow n="07" label="Календарь"/><SH ch="Главный экран — недельная сетка" accent="недельная сетка"/></R>
              <div className="grid gap-8 mt-5 items-center" style={{gridTemplateColumns:"minmax(auto,420px) 1fr"}}>
                <R dir="left"><CalMock/></R>
                <R dir="right"><BList items={[
                  {k:"Слоты по 30 минут",v:"клик по свободному слоту открывает форму с подставленным временем"},
                  {k:"Drag&drop и resize",v:"перетащите или растяните карточку встречи — время обновится"},
                  {k:"Виджет статуса",v:"«Свободна» / «Занята до 11:00» прямо над сеткой"},
                  {k:"Месячный вид",v:"переключение между недельным и месячным отображением"},
                  {k:"Фильтры и поиск",v:<><Tag ch="Все"/><Tag ch="Офис"/><Tag ch="Онлайн"/><Tag ch="Гибрид"/> + поиск по названию</>},
                  {k:"busy_only",v:"чужие брони видны как серая плашка «Занято» без деталей"},
                ]}/></R>
              </div>
            </>}/>

            <Div/>

            {/* ── 08 Booking ────────────────────────────────────────── */}
            <Sec id="sec-08" ch={<>
              <R spring><Eyebrow n="08" label="Создание встречи"/><SH ch="Одна форма — вся встреча" accent="Одна форма"/></R>
              <div className="grid gap-8 mt-5 items-center" style={{gridTemplateColumns:"minmax(auto,420px) 1fr"}}>
                <R dir="left"><BookMock/></R>
                <R dir="right"><BList items={[
                  {k:"Тип встречи",v:"Офис (комната), Онлайн (видео) или Гибрид — всё одновременно"},
                  {k:"Длительность",v:"пресеты 30м/1ч/1.5ч/2ч или точно вручную от 15 мин до 8 часов"},
                  {k:"Повторы",v:"ежедневно, еженедельно или свои дни недели; до 90 встреч в серии; занятые слоты автоматически пропускаются"},
                  {k:"Гости",v:"по @username/имени или сразу по должностям — все аналитики одним кликом"},
                  {k:"Вложения",v:"PDF, Word, Excel и другие файлы до 10 МБ, вставка через Ctrl+V"},
                  {k:"Напоминание",v:"за сколько минут предупредить (5, 15, 30 или 60 мин)"},
                  {k:"Предупреждение о накладках",v:"если выбранное время пересекается с другой встречей — предупреждение сразу"},
                ]}/></R>
              </div>
            </>}/>

            <Div/>

            {/* ── 09 Video ──────────────────────────────────────────── */}
            <Sec id="sec-09" ch={<>
              <R spring><Eyebrow n="09" label="Видеовстречи"/><SH ch="Полноценная конференция внутри продукта" accent="внутри продукта"/></R>
              <div className="grid gap-8 mt-5 items-center" style={{gridTemplateColumns:"minmax(auto,420px) 1fr"}}>
                <R dir="left"><VideoMock/></R>
                <R dir="right"><BList items={[
                  {k:"Камера, микрофон, экран",v:"стандартный набор управления участника"},
                  {k:"Blur фона",v:"размытие фона во время звонка — одна кнопка"},
                  {k:"Krisp — фильтр шума",v:"AI-фильтрация шума микрофона, не мешает коллегам"},
                  {k:"Чат с реакциями",v:"текстовый чат, эмодзи-реакции, поднятие руки 🖐"},
                  {k:"Файлы в чате",v:"обмен файлами до 20 МБ прямо во время звонка"},
                  {k:"Запись встречи",v:"организатор включает запись, потом скачивает MP4"},
                  {k:"E2EE и таймер 🔒",v:"сквозное шифрование LiveKit и таймер длительности встречи"},
                  {k:"Модерация",v:"организатор приглушает микрофон или удаляет участника"},
                ]}/></R>
              </div>
            </>}/>

            <Div/>

            {/* ── 10 Guest ──────────────────────────────────────────── */}
            <Sec id="sec-10" ch={<>
              <R spring><Eyebrow n="10" label="Гостевой вход"/><SH ch="Гости подключаются без регистрации" accent="без регистрации"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:540}}>Для внешних участников организатор создаёт ссылку-приглашение — аккаунт не нужен.</p>
              </R>
              <div className="flex flex-wrap mt-5">
                {[["1","Ссылка","Организатор копирует гостевую ссылку"],
                  ["2","Превью","Гость вводит имя и видит превью камеры/микро"],
                  ["3","Ожидание","«Ожидание подтверждения» у организатора"],
                  ["4","В эфире","Организатор впускает — гость сразу в комнате"],
                ].map(([ic,t,d],i)=>(
                  <React.Fragment key={t}>
                    {i>0 && <div className="flex items-center px-[5px]" style={{color:"var(--primary)",fontSize:14,opacity:.5}}>→</div>}
                    <R delay={i*70}>
                      <div className="flex-1 min-w-[110px] rounded-md border p-3 text-center"
                        style={{background:"var(--elevated)",borderColor:"var(--border)"}}>
                        <div className="font-extrabold" style={{fontSize:26,color:"var(--primary)",lineHeight:1,marginBottom:6}}>{ic}</div>
                        <div className="font-bold text-xs mb-1" style={{color:"var(--text)"}}>{t}</div>
                        <div style={{fontSize:11,color:"var(--text-muted)",lineHeight:1.5}}>{d}</div>
                      </div>
                    </R>
                  </React.Fragment>
                ))}
              </div>
              <R delay={280}><Note ch="Ссылка одноразовая и действует ограниченное время. Войти можно только когда организатор онлайн."/></R>
            </>}/>

            <Div/>

            {/* ── 11 Telegram ───────────────────────────────────────── */}
            <Sec id="sec-11" ch={<>
              <R spring><Eyebrow n="11" label="Telegram"/><SH ch="Уведомления туда, где команда уже сидит" accent="где команда"/></R>
              <div className="grid gap-8 mt-5 items-center" style={{gridTemplateColumns:"minmax(auto,420px) 1fr"}}>
                <R dir="left"><TgMock/></R>
                <R dir="right"><BList items={[
                  {k:"В группу пространства",v:"новые и изменённые встречи с кнопкой «Подключиться»"},
                  {k:"Личные напоминания",v:"организатору и всем гостям за N минут до начала"},
                  {k:"Приглашения гостям",v:"личное сообщение «Вас пригласили на встречу»"},
                  {k:"Уведомления об отмене",v:"если встречу удалили — все участники узнают сразу"},
                  {k:"Свой канал у каждого пространства",v:"компании не спамят друг другу"},
                  {k:"Привязка чата",v:<span>команда <b style={{color:"var(--text)"}}>/ bind &lt;код&gt;</b> привязывает группу к пространству</span>},
                ]}/></R>
              </div>
            </>}/>

            <Div/>

            {/* ── 12 Notifications ──────────────────────────────────── */}
            <Sec id="sec-12" ch={<>
              <R spring><Eyebrow n="12" label="Уведомления"/><SH ch="Напоминания и центр уведомлений" accent="центр уведомлений"/></R>
              <HoverGrid cols={3}>
                <R delay={60}><Card icon="bell" title="Web push" desc="Desktop-уведомления в браузере за 5, 15, 30 или 60 минут до встречи. Разрешение запрашивается один раз."/></R>
                <R delay={120}><Card icon="star" title="RSVP" desc="Из уведомления можно сразу принять или отклонить приглашение на встречу — без перехода в приложение."/></R>
                <R delay={180}><Card icon="users" title="Заявки на вступление" desc="При новом запросе на присоединение к пространству приходит уведомление с кнопкой «Одобрить»."/></R>
              </HoverGrid>
              <R delay={240}><Note ch="Центр уведомлений хранит историю за сессию. Пульсирующий индикатор в шапке показывает количество непрочитанных."/></R>
            </>}/>

            <Div/>

            {/* ── Feedback & Rights ─────────────────────────────────── */}
            <Sec id="sec-feedback" ch={<>
              <R spring><Eyebrow n="13" label="Для пользователя"/><SH ch="Обратная связь и права доступа" accent="права доступа"/></R>
              <div className="grid gap-6 mt-5 items-start" style={{gridTemplateColumns:"1fr 1fr"}}>
                <R dir="left">
                  <div className="font-semibold text-sm mb-3" style={{color:"var(--text)"}}>Как отправить обращение</div>
                  <BList items={[
                    {k:"Кнопка в меню",v:"Нажмите «Обратная связь» в боковом меню приложения"},
                    {k:"Текст обращения",v:"Опишите проблему или предложение в свободной форме"},
                    {k:"Скриншот",v:"При желании прикрепите снимок экрана — это ускорит решение"},
                    {k:"Статусы",v:<span>«Новое» → «В работе» → «Закрыто» — вы всегда видите статус своего обращения</span>},
                  ]}/>
                </R>
                <R dir="right">
                  <div className="font-semibold text-sm mb-3" style={{color:"var(--text)"}}>Что вы можете делать как участник</div>
                  <BList items={[
                    {k:"Просматривать",v:"общий календарь пространства и доступные переговорные"},
                    {k:"Бронировать",v:"встречи в любых доступных комнатах своего пространства"},
                    {k:"Приглашать",v:"гостей по @username, должностям или гостевой ссылке"},
                    {k:"Участвовать",v:"в видеозвонках, чате, обмениваться файлами"},
                    {k:"Экспортировать",v:"свои встречи в Google/Apple/Outlook через iCal-фид"},
                    {k:"Не можете",v:"удалять чужие встречи, управлять комнатами и пользователями"},
                  ]}/>
                </R>
              </div>
            </>}/>

            <Div/>

            {/* ── 13 Admin ──────────────────────────────────────────── */}
            <Sec id="sec-13" ch={<>
              <R spring><Eyebrow n="14" label="Управление"/><SH ch="Админка, аналитика и обратная связь" accent="Аналитика"/></R>
              <HoverGrid cols={3}>
                {([["chart","Аналитика","Встречи и участники по дням, топ-10 организаторов, период 7/30/90 дней. По пространству или по всей платформе."],
                  ["users","Пользователи","Список, роли, приглашение по @username, одобрение заявок, массовые операции."],
                  ["lock","Должности","Двуязычные должности (Начальник, PM, Аналитик, Программист, Дизайнер) для быстрого выбора гостей."],
                  ["bell","Обратная связь","Обращения с текстом и скриншотом. Статусы: Новое → В работе → Закрыто."],
                  ["export","Экспорт календаря","Скачивание .ics и подписка на iCal-фид — встречи в Google/Apple/Outlook Calendar."],
                  ["shield","Superadmin",<>Полный доступ ко всем пространствам, ко всем бронированиям, управление ролями пользователей платформы.</>],
                ] as [string,string,string|React.ReactNode][]).map(([ic,t,d],i)=>(
                  <R key={t as string} delay={i*40}><Card icon={ic} title={t as string} desc={typeof d==="string"?d:undefined}>{typeof d!=="string"?<div className="text-xs mt-1 leading-relaxed" style={{color:"var(--text-muted)"}}>{d}</div>:null}</Card></R>
                ))}
              </HoverGrid>
            </>}/>

            <Div/>

            {/* ── 14 Security ───────────────────────────────────────── */}
            <Sec id="sec-14" ch={<>
              <R spring><Eyebrow n="15" label="Безопасность"/><SH ch="Надёжность и защита данных" accent="защита"/></R>
              <div className="flex gap-8 flex-wrap mt-5">
                {[["E2EE","сквозное шифрование видео"],["PASETO","токены вместо JWT"],["15м–8ч","диапазон встреч"],["90","встреч в серии повторов"],["РУ / УЗ","два языка"]].map(([b,s],i)=>(
                  <AnimStat key={b} big={b} small={s} idx={i}/>
                ))}
              </div>
              <HoverGrid cols={3}>
                <R delay={60}><Card icon="shield" title="Защита доступа" desc="Вход по подписи Telegram, одноразовые ссылки, PASETO-токены с коротким TTL, проверка прав на каждый запрос."/></R>
                <R delay={110}><Card icon="lock" title="Приватность встреч" desc="E2EE-шифрование видеопотока и режим busy_only скрывают содержание встреч от других арендаторов здания."/></R>
                <R delay={160}><Card icon="calendar" title="Надёжность" desc="Безопасные миграции базы данных, фоновые задачи уведомлений каждые 60 секунд, изолированные пространства."/></R>
              </HoverGrid>
            </>}/>

            <Div/>

            {/* ── 15 Scenario ───────────────────────────────────────── */}
            <Sec id="sec-15" ch={<>
              <R spring><Eyebrow n="16" label="Сценарий"/><SH ch="Общий бизнес-центр — как это работает" accent="как это работает"/>
                <p className="mt-2 text-sm leading-relaxed" style={{color:"var(--text-sec)",maxWidth:560}}>Три компании в одном здании: «Альфа», «Бета», «Гамма». Три переговорки на этаже: «Москва», «Лондон», «Токио».</p>
              </R>
              <div className="mt-4">
                <R delay={60}><Scene who="«Альфа»" text="Регистрируется первой, создаёт пространство и все три комнаты — становится их владельцем. Привязывает свою Telegram-группу командой /bind."/></R>
                <R delay={120}><Scene who="«Бета»" text="Создаёт своё пространство. «Альфа» расшаривает все три комнаты по invite-коду — у «Беты» доступ с ролью shared. Она видит и бронирует, но не редактирует."/></R>
                <R delay={180}><Scene who="Бронь и конфликт" text="«Бета» бронирует «Москву» на 14:00–15:00. «Альфа» на то же время получает ошибку «Время занято». В режиме busy_only «Бета» видит только занятый слот — но не кем."/></R>
                <R delay={240}><Scene who="«Гамма»" text="Работает в своих кабинетах, ничего не расшаривает — своё пространство, свои приватные комнаты. Никого не видит и сама невидима для других."/></R>
              </div>
            </>}/>


          </div>
          </ScrollCtx.Provider>
        </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
