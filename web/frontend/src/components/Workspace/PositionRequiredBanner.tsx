import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ProfileEditModal } from "../Auth/ProfileEditModal";
import { useLocale } from "../../contexts/LocaleContext";
import type { User } from "../../types";

// ── Inject shake animation CSS (idempotent) ──────────────────────────────────
const SHAKE_CSS = `
:root {
  --banner-shake-distance: 7px;
  --banner-shake-overshoot: 4px;
  --banner-shake-dur-a: 80ms;
  --banner-shake-dur-b: 60ms;
  --banner-shake-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
.pos-banner-shake {
  will-change: transform;
}
.pos-banner-shake.is-shaking {
  animation: pos-banner-shake-kf calc(
    var(--banner-shake-dur-a) * 2 + var(--banner-shake-dur-b) * 2
  ) linear;
}
@keyframes pos-banner-shake-kf {
  0%      { transform: translateX(0);                                          animation-timing-function: var(--banner-shake-ease); }
  28.57%  { transform: translateX(var(--banner-shake-distance));               animation-timing-function: var(--banner-shake-ease); }
  57.14%  { transform: translateX(calc(var(--banner-shake-distance) * -1));    animation-timing-function: var(--banner-shake-ease); }
  78.57%  { transform: translateX(var(--banner-shake-overshoot));              animation-timing-function: var(--banner-shake-ease); }
  100%    { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .pos-banner-shake { animation: none !important; transform: none !important; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("pos-banner-shake-styles")) {
  const el = document.createElement("style");
  el.id = "pos-banner-shake-styles";
  el.textContent = SHAKE_CSS;
  document.head.appendChild(el);
}

interface Props {
  workspaceId: number;
  myMemberId: number;
  user: User;
  onPositionSet: () => void;
}

export interface PositionBannerHandle {
  shake: () => void;
}

export const PositionRequiredBanner = forwardRef<PositionBannerHandle, Props>(
  function PositionRequiredBanner({ workspaceId, myMemberId, user, onPositionSet }, ref) {
    const { t } = useLocale();
    const [profileOpen, setProfileOpen] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      shake() {
        const el = bannerRef.current;
        if (!el) return;
        el.classList.remove("is-shaking");
        void el.offsetWidth; // force reflow
        el.classList.add("is-shaking");
        el.addEventListener("animationend", () => el.classList.remove("is-shaking"), { once: true });
      },
    }));

    return (
      <>
        <div
          ref={bannerRef}
          className="pos-banner-shake w-full px-4 py-2.5 flex items-center justify-between gap-3"
          style={{
            background: "rgba(234,179,8,0.1)",
            border: "1px solid rgba(234,179,8,0.3)",
            borderRadius: 6,
            flexShrink: 0,
          }}
        >
          <span className="text-xs font-medium" style={{ color: "#a16207" }}>
            {t("pos.requiredBanner")}
          </span>
          <button
            onClick={() => setProfileOpen(true)}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded transition-all"
            style={{
              background: "rgba(234,179,8,0.2)",
              color: "#a16207",
              border: "1px solid rgba(234,179,8,0.4)",
            }}
          >
            {t("pos.requiredAction")}
          </button>
        </div>

        <ProfileEditModal
          open={profileOpen}
          user={user}
          workspaceId={workspaceId}
          myMemberId={myMemberId}
          onClose={() => setProfileOpen(false)}
          onSaved={onPositionSet}
        />
      </>
    );
  }
);
