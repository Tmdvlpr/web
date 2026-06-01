import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { workspacesApi } from "../../api/workspaces";
import { useLocale } from "../../contexts/LocaleContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { WorkspacePosition } from "../../types";

interface Draft {
  ru: string;
  uz: string;
}

interface Props {
  workspaceId: number;
  myMemberId: number;
  onComplete: () => void;
}

const OVERLAY_INITIAL = { opacity: 0 } as const;
const OVERLAY_ANIMATE = { opacity: 1 } as const;
const MODAL_INITIAL = { opacity: 0, scale: 0.96 } as const;
const MODAL_ANIMATE = { opacity: 1, scale: 1 } as const;
const MODAL_TRANSITION = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } as const;

export function PositionSetupModal({ workspaceId, myMemberId, onComplete }: Props) {
  const { t, locale } = useLocale();
  const { isDark } = useTheme();

  const [step, setStep] = useState<"create" | "select">("create");
  const [drafts, setDrafts] = useState<Draft[]>([{ ru: "", uz: "" }]);
  const [positions, setPositions] = useState<WorkspacePosition[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledDrafts = drafts.filter(d => d.ru.trim() && d.uz.trim());
  const canProceedCreate = filledDrafts.length > 0;

  const updateDraft = (index: number, field: "ru" | "uz", value: string) => {
    setDrafts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const addDraft = () => setDrafts(prev => [...prev, { ru: "", uz: "" }]);

  const removeDraft = (index: number) => {
    setDrafts(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreatePositions = async () => {
    if (!canProceedCreate) return;
    setSaving(true);
    setError(null);
    try {
      const created: WorkspacePosition[] = [];
      for (const d of filledDrafts) {
        const pos = await workspacesApi.createPosition(workspaceId, { name_ru: d.ru.trim(), name_uz: d.uz.trim() });
        created.push(pos);
      }
      setPositions(created);
      setStep("select");
    } catch {
      setError("Не удалось создать должности. Попробуйте снова.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPosition = async () => {
    if (!selectedPositionId) return;
    setSaving(true);
    setError(null);
    try {
      await workspacesApi.updateMemberProfile(workspaceId, myMemberId, { position_id: selectedPositionId });
      onComplete();
    } catch {
      setError("Не удалось сохранить должность. Попробуйте снова.");
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
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>
              {t("pos.setupTitle")}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-sec)" }}>
              {t("pos.setupSubtitle")}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            {(["create", "select"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step === s ? "var(--primary)" : (step === "select" && s === "create" ? "rgba(21,101,168,0.2)" : "var(--elevated)"),
                    color: step === s ? "#fff" : (step === "select" && s === "create" ? "var(--primary)" : "var(--text-muted)"),
                    border: `1.5px solid ${step === s ? "var(--primary)" : (step === "select" && s === "create" ? "var(--primary)" : "var(--border)")}`,
                  }}
                >
                  {step === "select" && s === "create" ? "✓" : i + 1}
                </div>
                <span className="text-xs font-medium" style={{ color: step === s ? "var(--text)" : "var(--text-muted)" }}>
                  {s === "create" ? t("pos.stepCreate") : t("pos.stepSelect")}
                </span>
                {i === 0 && <div className="flex-1 h-px mx-1" style={{ background: "var(--border)", minWidth: 20 }} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === "create" && (
              <motion.div key="create" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
                  {drafts.map((draft, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={draft.ru}
                          onChange={e => updateDraft(idx, "ru", e.target.value)}
                          placeholder={t("pos.nameRuLabel")}
                          className="w-full text-sm rounded-md px-3 py-2"
                          style={{ background: "var(--input-bg)", border: "1.5px solid var(--input-border)", color: "var(--text)", outline: "none" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
                        />
                        <input
                          type="text"
                          value={draft.uz}
                          onChange={e => updateDraft(idx, "uz", e.target.value)}
                          placeholder={t("pos.nameUzLabel")}
                          className="w-full text-sm rounded-md px-3 py-2"
                          style={{ background: "var(--input-bg)", border: "1.5px solid var(--input-border)", color: "var(--text)", outline: "none" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--input-border)"; }}
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

                <button
                  type="button"
                  onClick={addDraft}
                  className="text-xs font-medium mb-5"
                  style={{ color: "var(--primary)" }}
                >
                  {t("pos.addAnother")}
                </button>

                {error && (
                  <p className="text-xs mb-3 px-3 py-2 rounded font-medium"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCreatePositions}
                  disabled={!canProceedCreate || saving}
                  className="w-full py-2.5 rounded text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,0.25)" }}
                >
                  {saving ? "Создаём…" : "Далее →"}
                </button>
              </motion.div>
            )}

            {step === "select" && (
              <motion.div key="select" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <div className="flex flex-col gap-1.5 mb-5">
                  {positions.map(pos => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setSelectedPositionId(pos.id)}
                      className="w-full text-left px-3 py-2 rounded text-sm font-medium transition-all"
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

                {error && (
                  <p className="text-xs mb-3 px-3 py-2 rounded font-medium"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSelectPosition}
                  disabled={!selectedPositionId || saving}
                  className="w-full py-2.5 rounded text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#1565a8,#114e85)", boxShadow: "0 4px 16px rgba(21,101,168,0.25)" }}
                >
                  {saving ? "Сохраняем…" : t("pos.continueToWorkspace")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
