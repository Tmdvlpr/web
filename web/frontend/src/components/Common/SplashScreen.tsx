import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";

interface SplashScreenProps {
  onFinish: () => void;
  userName?: string | null;
}

const WORD = "CORPMEET";
const ACCENT_FROM = 4;
const BRAND = "#1565a8";

export function SplashScreen({ onFinish, userName }: SplashScreenProps) {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [revealed, setRevealed] = useState(0);

  const w1Ref = useRef<SVGRectElement>(null);
  const w2Ref = useRef<SVGRectElement>(null);
  const iconRef = useRef<SVGGElement>(null);
  const bgRef = useRef<SVGRectElement>(null);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const play = useCallback(() => {
    const bg = bgRef.current;
    const iconEl = iconRef.current;
    const w1 = w1Ref.current;
    const w2 = w2Ref.current;
    if (!bg || !iconEl || !w1 || !w2) return;

    // Reset
    bg.style.transition = "none";
    bg.setAttribute("opacity", "0");
    iconEl.style.transition = "none";
    iconEl.style.transform = "scale(1)";
    w1.setAttribute("width", "0"); w1.setAttribute("x", "0");
    w2.setAttribute("width", "0"); w2.setAttribute("x", "184");
    bg.getBBox();

    setTimeout(() => {
      bg.style.transition = "opacity 0.5s ease";
      bg.setAttribute("opacity", "1");
    }, 100);

    setTimeout(() => {
      const start = performance.now();
      const dur = 1200;
      function wipeAnim(now: number) {
        const t = Math.min((now - start) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        const w = Math.round(184 * e);
        w1!.setAttribute("width", String(w));
        w2!.setAttribute("x", String(184 - w));
        w2!.setAttribute("width", String(w));
        if (t < 1) {
          requestAnimationFrame(wipeAnim);
        } else {
          iconEl!.style.transition = "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
          iconEl!.style.transform = "scale(1.06)";
          setTimeout(() => {
            iconEl!.style.transition = "transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)";
            iconEl!.style.transform = "scale(1)";
          }, 400);
        }
      }
      requestAnimationFrame(wipeAnim);
    }, 450);

    // Letter-by-letter reveal in Manrope
    setTimeout(() => {
      let i = 0;
      const tick = () => {
        i += 1;
        setRevealed(i);
        if (i < WORD.length) setTimeout(tick, 90);
      };
      tick();
    }, 1700);

    // Hold then fade
    setTimeout(() => setFading(true), 3600);
    setTimeout(() => { setVisible(false); onFinishRef.current(); }, 4400);
  }, []);

  useEffect(() => {
    const t = setTimeout(play, 200);
    return () => clearTimeout(t);
  }, [play]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: isDark ? "#0b0f1a" : "#f1f5f9" }}
        >
          {/* SVG Icon with wipe-in */}
          <svg viewBox="-4 -4 192 192" width="220" height="220" style={{ overflow: "visible" }}>
            <defs>
              <clipPath id="splash-clip"><rect x="0" y="0" width="183.477" height="183.476" rx="24" /></clipPath>
              <clipPath id="splash-wipe1"><rect ref={w1Ref} x="0" y="0" width="0" height="184" /></clipPath>
              <clipPath id="splash-wipe2"><rect ref={w2Ref} x="184" y="0" width="0" height="184" /></clipPath>
            </defs>
            <g ref={iconRef} style={{ transformOrigin: "92px 92px" }}>
              <rect
                ref={bgRef}
                x="0" y="0" width="183.477" height="183.476" rx="24"
                fill={isDark ? "#1e293b" : "#ffffff"}
                stroke={isDark ? "#334155" : "#e0e0e0"}
                strokeWidth="1"
                opacity="0"
              />
              <g clipPath="url(#splash-clip)">
                <g clipPath="url(#splash-wipe1)">
                  <path d="M183.477 -0.000213652H24.1003C10.8448 -0.000213652 0 10.8442 0 24.1002V29.4577C4.35965 30.1241 9.2007 31.4108 14.4453 33.2707C30.9597 39.1299 51.5212 50.7097 73.5983 66.6973C91.5408 53.3303 108.051 43.7672 121.444 39.0204C134.526 34.3831 144.68 34.3293 150.36 39.7837C156.794 45.9587 156.535 58.3064 150.797 74.4786C144.935 90.9937 133.356 111.555 117.37 133.632C130.738 151.575 140.298 168.087 145.045 181.48C145.286 182.154 145.511 182.818 145.725 183.476H159.377C172.632 183.476 183.477 172.634 183.477 159.378V-0.000213652Z" fill={BRAND} />
                </g>
                <g clipPath="url(#splash-wipe2)">
                  <path d="M0 101.189V159.376C0 168.393 5.01728 176.29 12.3973 180.42C18.0218 180.586 24.8281 179.206 32.5683 176.422C48.3471 170.754 67.9784 159.273 89.4463 143.198C89.6156 143.069 89.8609 143.105 89.9921 143.275C90.1104 143.434 90.0894 143.658 89.949 143.793C83.9014 149.56 77.876 155.016 71.9314 160.131C65.8788 165.336 59.906 170.191 54.0732 174.655L54.0705 174.658L50.6656 177.231L50.6641 177.232L50.6599 177.235L50.6572 177.237C47.73 179.421 44.8397 181.502 41.9898 183.475H116.387C121.896 177.132 121.584 165.949 116.392 151.497C110.722 135.719 99.2405 116.088 83.1656 94.6182C83.0359 94.4481 83.071 94.2006 83.2423 94.0716C83.4017 93.9534 83.6256 93.9747 83.7592 94.1147H83.7611C89.5271 100.163 94.9865 106.19 100.101 112.134C105.16 118.017 109.887 123.825 114.25 129.503C121.803 114.774 126.675 101.709 128.415 91.1596C130.095 80.9622 128.849 73.1332 124.268 68.4527C118.097 62.1511 106.564 62.2476 91.463 67.6745C75.6841 73.3441 56.0556 84.8229 34.5862 100.899C34.4156 101.028 34.1715 100.994 34.0391 100.821C33.9217 100.663 33.943 100.438 34.0842 100.305H34.083C40.1287 94.5412 46.1515 89.0841 52.0938 83.9737C57.9766 78.9107 63.7907 74.1829 69.4702 69.8191C54.7411 62.2655 41.6766 57.3913 31.1279 55.6515C20.9285 53.9692 13.1007 55.2151 8.42024 59.7979C2.11631 65.9691 2.21587 77.5024 7.64207 92.6007C13.3097 108.38 24.7911 128.011 40.8664 149.476C40.9965 149.648 40.9587 149.894 40.7867 150.023C40.6299 150.143 40.4056 150.122 40.2706 149.979V149.982C34.5064 143.936 29.052 137.913 23.9397 131.971C18.7325 125.916 13.8754 119.941 9.4105 114.105L9.40821 114.104L6.83453 110.699L6.83148 110.697L6.83034 110.692L6.8269 110.69C4.42679 107.474 2.15065 104.304 0 101.189Z" fill={BRAND} />
                </g>
              </g>
            </g>
          </svg>

          {/* Manrope wordmark with staggered reveal */}
          <div
            style={{
              marginTop: 36,
              fontFamily: "Manrope, sans-serif",
              fontWeight: 800,
              fontSize: 38,
              letterSpacing: "0.18em",
              display: "flex",
              gap: 2,
            }}
          >
            {WORD.split("").map((ch, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={i < revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{
                  color: i < ACCENT_FROM ? (isDark ? "#f8fafc" : "#1a1a1a") : BRAND,
                  display: "inline-block",
                }}
              >
                {ch}
              </motion.span>
            ))}
          </div>

          {/* Personal greeting after wordmark */}
          {userName && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={revealed >= WORD.length ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.45, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{
                marginTop: 24,
                fontFamily: "Manrope, sans-serif",
                fontWeight: 500,
                fontSize: 16,
                letterSpacing: "0.02em",
                color: isDark ? "rgba(248,250,252,0.78)" : "rgba(26,26,26,0.72)",
                textAlign: "center",
                padding: "0 24px",
              }}
            >
              Добро пожаловать, <span style={{ fontWeight: 700, color: BRAND }}>{userName}</span>!
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
