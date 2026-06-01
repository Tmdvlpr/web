import { useState } from "react";
import { ProfileEditModal } from "../Auth/ProfileEditModal";
import { useLocale } from "../../contexts/LocaleContext";
import type { User } from "../../types";

interface Props {
  workspaceId: number;
  myMemberId: number;
  user: User;
  onPositionSet: () => void;
}

export function PositionRequiredBanner({ workspaceId, myMemberId, user, onPositionSet }: Props) {
  const { t } = useLocale();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div
        className="w-full px-4 py-2.5 flex items-center justify-between gap-3"
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
