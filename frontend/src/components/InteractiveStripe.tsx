import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useState } from "react";

interface Pulse { id: number; x: number }

export function InteractiveStripe({ edge = "top" }: { edge?: "top" | "bottom" }) {
  const mouseX    = useMotionValue(0.5);
  const springX   = useSpring(mouseX, { stiffness: 60, damping: 18 });
  const gradientPos = useTransform(springX, [0, 1], ["0% 50%", "100% 50%"]);
  const [pulses,  setPulses]  = useState<Pulse[]>([]);
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x  = ((e.clientX - rect.left) / rect.width) * 100;
    const id = Date.now();
    setPulses(p => [...p, { id, x }]);
    setTimeout(() => setPulses(p => p.filter(pulse => pulse.id !== id)), 900);
  };

  return (
    <div
      className={`absolute ${edge === "bottom" ? "bottom-0" : "top-0"} left-0 right-0 overflow-visible ${edge === "top" ? "rounded-t-2xl" : ""}`}
      style={{ height: hovered ? "5px" : "3px", transition: "height 0.2s ease", cursor: "crosshair", zIndex: 10 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      <motion.div
        className={`absolute inset-0 ${edge === "top" ? "rounded-t-2xl" : ""}`}
        style={{
          background: "linear-gradient(90deg,#7c3aed,#06b6d4,#a855f7,#e11d48,#f59e0b,#7c3aed)",
          backgroundSize: "300% 100%",
          backgroundPosition: gradientPos,
          boxShadow: hovered
            ? "0 0 16px rgba(124,58,237,0.7), 0 0 32px rgba(6,182,212,0.4)"
            : "0 0 8px rgba(124,58,237,0.4)",
        }}
      />
      <AnimatePresence>
        {pulses.map(pulse => (
          <motion.div
            key={pulse.id}
            className="absolute pointer-events-none"
            style={{ left: `${pulse.x}%`, top: "50%", translateX: "-50%", translateY: "-50%" }}
            initial={{ width: 0, height: 0, opacity: 0.9 }}
            animate={{ width: 120, height: 120, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="w-full h-full rounded-full" style={{
              background: "radial-gradient(circle, rgba(168,85,247,0.6) 0%, rgba(6,182,212,0.3) 40%, transparent 70%)"
            }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
