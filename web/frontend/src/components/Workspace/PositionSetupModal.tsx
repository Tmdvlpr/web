import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { roomsApi } from "../../api/rooms";
import { workspacesApi } from "../../api/workspaces";
import { useLocale } from "../../contexts/LocaleContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import type { WorkspacePosition } from "../../types";

interface Draft {
  ru: string;
  uz: string;
}

interface Props {
  workspaceId: number;
  myMemberId: number;
  onComplete: () => void;
  onCancel?: () => void;
  initialStep?: Step;
}

type Step = "create" | "select" | "room";

const STEPS: { key: Step; labelKey: "pos.stepCreate" | "pos.stepSelect" | "pos.stepRoom" }[] = [
  { key: "create", labelKey: "pos.stepCreate" },
  { key: "select", labelKey: "pos.stepSelect" },
  { key: "room",   labelKey: "pos.stepRoom" },
];

const OVERLAY_INITIAL = { opacity: 0 } as const;
const OVERLAY_ANIMATE = { opacity: 1 } as const;
const MODAL_INITIAL = { opacity: 0, scale: 0.96 } as const;
const MODAL_ANIMATE = { opacity: 1, scale: 1 } as const;
const MODAL_TRANSITION = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } as const;

function PosInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full text-sm rounded-md px-3 py-2"
      style={{
        background: "var(--input-bg)",
        border: "1.5px solid var(--input-border)",
        color: "var(--text)",
        outline: "none",
        boxShadow: "none",
      }}
      onFocus={e => {
        e.currentTarget.style.setProperty("border-color", "var(--input-border)", "important");
        e.currentTarget.style.setProperty("outline", "none", "important");
        e.currentTarget.style.setProperty("box-shadow", "none", "important");
        props.onFocus?.(e);
      }}
      onBlur={e => {
        e.currentTarget.style.removeProperty("border-color");
        props.onBlur?.(e);
      }}
    />
  );
}

export function PositionSetupModal({ workspaceId, myMemberId, onComplete, onCancel, initialStep = "create" }: Props) {
  const { t, locale, setLocale } = useLocale();
  const { isDark } = useTheme();
  const { logout } = useAuth();

  const [step, setStep] = useState<Step>(initialStep);
  const [drafts, setDrafts] = useState<Draft[]>([{ ru: "", uz: "" }]);
  const [positions, setPositions] = useState<WorkspacePosition[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledDrafts = drafts.filter(d => d.ru.trim() && d.uz.trim());
  const canProceedCreate = filledDrafts.length > 0;
  const stepIndex = STEPS.findIndex(s => s.key === step);

  const updateDraft = (index: number, field: "ru" | "uz", value: string) => {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };
  const addDraft = () => setDrafts(prev => [...prev, { ru: "", uz: "" }]);
  const removeDraft = (index: number) => setDrafts(prev => prev.filter((_, i) => i !== index));

  const handleCreatePositions = async () => {
    if (!canProceedCreate) return;
    setSaving(true); setError(null);
    try {
      const created: WorkspacePosition[] = [];
      for (const d of filledDrafts) {
        created.push(await workspacesApi.createPosition(workspaceId, { name_ru: d.ru.trim(), name_uz: d.uz.trim() }));
      }
      setPositions(created);
      setStep("select");
    } catch {
      setError(t("pos.errPositions"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPosition = async () => {
    if (!selectedPositionId) return;
    setSaving(true); setError(null);
    try {
      await workspacesApi.updateMemberProfile(workspaceId, myMemberId, { position_id: selectedPositionId });
      setStep("room");
    } catch {
      setError(t("pos.errPosition"));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    setSaving(true); setError(null);
    try {
      await roomsApi.create({ name: roomName.trim(), description: roomDesc.trim() || undefined, workspace_id: workspaceId });
      onComplete();
    } catch {
      setError(t("pos.errRoom"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      key="pos-setup-overlay"
      initial={OVERLAY_INITIAL}
      animate={OVERLAY_ANIMATE}
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: isDark ? "rgba(2,6,23,0.92)" : "rgba(248,250,252,0.96)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={MODAL_INITIAL}
        animate={MODAL_ANIMATE}
        transition={MODAL_TRANSITION}
        className="w-full max-w-lg rounded-md"
        style={{
          background: "var(--modal)",
          border: "1px solid var(--border)",
          boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 24px 64px rgba(15,23,42,0.18)",
        }}
      >
        <div className="px-7 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>
                {t("pos.setupTitle")}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-sec)" }}>
                {t("pos.setupSubtitle")}
              </p>
            </div>
            {/* Language + logout + cancel controls */}
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                type="button"
                onClick={() => setLocale(locale === "ru" ? "uz" : "ru")}
                className="px-2.5 py-1 rounded text-xs font-bold transition-all"
                style={{
                  background: "var(--elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-sec)",
                }}
              >
                {locale === "ru" ? "УЗ" : "РУ"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-7 h-7 flex items-center justify-center rounded transition-all"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                title={t("nav.logout")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-7 h-7 flex items-center justify-center rounded transition-all"
                  style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  title={t("common.cancel")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = s.key === step;
              return (
                <div key={s.key} className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: active ? "var(--primary)" : done ? "rgba(21,101,168,0.15)" : "var(--elevated)",
                      color: active ? "#fff" : done ? "var(--primary)" : "var(--text-muted)",
                      border: `1.5px solid ${active ? "var(--primary)" : done ? "var(--primary)" : "var(--border)"}`,
                    }}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span className="text-xs font-medium truncate" style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
                    {t(s.labelKey)}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div className="shrink-0 h-px w-6" style={{ background: "var(--border)" }} />
                  )}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Step 1: Create positions ── */}
            {step === "create" && (
              <motion.div key="create" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
                  {drafts.map((draft, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 flex flex-col gap-2">
                        <PosInput
                          type="text"
                          value={draft.ru}
                          onChange={e => updateDraft(idx, "ru", e.target.value)}
                          placeholder={t("pos.nameRuLabel")}
                        />
                        <PosInput
                          type="text"
                          value={draft.uz}
                          onChange={e => updateDraft(idx, "uz", e.target.value)}
                          placeholder={t("pos.nameUzLabel")}
                        />
                      </div>
                      {drafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDraft(idx)}
                          className="mt-1 w-7 h-7 flex items-center justify-center rounded text-xs shrink-0"
                          style={{ color: "var(--text-muted)", background: "var(--elevated)", border: "1px solid var(--border)" }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addDraft} className="text-xs font-medium mb-5" style={{ color: "var(--primary)" }}>
                  {t("pos.addAnother")}
                </button>

                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="button"
                  onClick={handleCreatePositions}
                  disabled={!canProceedCreate || saving}
                  className="w-full py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,0.25)" }}
                >
                  {saving ? t("pos.creating") : t("pos.nextStep")}
                </button>
              </motion.div>
            )}

            {/* ── Step 2: Select own position ── */}
            {step === "select" && (
              <motion.div key="select" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="flex flex-col gap-1.5 mb-5">
                  {positions.map(pos => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setSelectedPositionId(pos.id)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all"
                      style={{
                        background: selectedPositionId === pos.id ? "var(--primary)" : "var(--elevated)",
                        border: `1.5px solid ${selectedPositionId === pos.id ? "var(--primary)" : "var(--border)"}`,
                        color: selectedPositionId === pos.id ? "#fff" : "var(--text)",
                      }}
                    >
                      {locale === "ru" ? pos.name_ru : pos.name_uz}
                    </button>
                  ))}
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="button"
                  onClick={handleSelectPosition}
                  disabled={!selectedPositionId || saving}
                  className="w-full py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,0.25)" }}
                >
                  {saving ? t("pos.saving") : t("pos.nextStep")}
                </button>
              </motion.div>
            )}

            {/* ── Step 3: Create room ── */}
            {step === "room" && (
              <motion.div key="room" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="flex flex-col gap-3 mb-5">
                  <PosInput
                    type="text"
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                    placeholder={t("ws.rooms.namePh")}
                    autoFocus
                  />
                  <PosInput
                    type="text"
                    value={roomDesc}
                    onChange={e => setRoomDesc(e.target.value)}
                    placeholder={t("ws.rooms.descPh")}
                  />
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={!roomName.trim() || saving}
                  className="w-full py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,0.25)" }}
                >
                  {saving ? t("pos.creating") : t("pos.createRoom")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs mb-3 px-3 py-2 rounded-md font-medium"
      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
      {children}
    </p>
  );
}
