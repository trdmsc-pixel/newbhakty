import React, { useEffect, useMemo, useState } from "react";
import { Check, Moon, Sparkles, Sun, X } from "lucide-react";
import { isToday, parseISO } from "date-fns";
import { useStudioOS } from "../StudioOSContext";

const OVERNIGHT_RENDER_ITEMS = [
  { id: "r1", label: "Queue Seedance 2.0 / Kling overnight video generation batch" },
  { id: "r2", label: "Start 4K upscaling & frame-interpolation overnight passes" },
  { id: "r3", label: "Confirm client review links & notes ready for 07:30 brief" },
  { id: "r4", label: "Verify backups & archive completed scene assets" },
];

export const EveningShutdownModal: React.FC = () => {
  const {
    eveningShutdownOpen,
    setEveningShutdownOpen,
    tasks,
    projects,
    settings,
    completeEveningShutdown,
  } = useStudioOS();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTomorrowIds, setSelectedTomorrowIds] = useState<string[]>([]);
  const [renderChecks, setRenderChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (eveningShutdownOpen) {
      setStep(1);
      const preselected = tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          if (a.is_in_now !== b.is_in_now) return a.is_in_now ? -1 : 1;
          const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, settings.wip_limit || 3)
        .map((t) => t.id);
      setSelectedTomorrowIds(preselected);
    }
  }, [eveningShutdownOpen, tasks, settings.wip_limit]);

  const completedToday = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status === "done" &&
          ((t.completed_at && isToday(parseISO(t.completed_at))) || isToday(parseISO(t.updated_at)))
      ),
    [tasks]
  );

  const candidateTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => {
          const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, 10),
    [tasks]
  );

  if (!eveningShutdownOpen) return null;

  const togglePick = (taskId: string) => {
    setSelectedTomorrowIds((prev) => {
      if (prev.includes(taskId)) return prev.filter((id) => id !== taskId);
      if (prev.length >= (settings.wip_limit || 3)) return prev;
      return [...prev, taskId];
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-[3px] p-0 md:p-4"
      onClick={() => setEveningShutdownOpen(false)}
    >
      <div
        className="w-full md:max-w-xl rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl border space-y-5"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
            >
              <Moon className="w-4 h-4" />
            </span>
            <div>
              <h3 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Evening Shutdown · Step {step} of 3
              </h3>
              <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                Closes cleanly before {settings.studio_closes_at} IST
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEveningShutdownOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
            aria-label="Close Evening Shutdown"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, title: "What got done" },
            { num: 2, title: `Pick tomorrow's ${settings.wip_limit}` },
            { num: 3, title: "Overnight renders" },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as 1 | 2 | 3)}
              className="px-3 py-2 rounded-[14px] text-[12px] font-semibold text-left transition-colors"
              style={{
                background: step === s.num ? "var(--sos-violet-soft)" : "var(--sos-surface-2)",
                color: step === s.num ? "var(--sos-primary)" : "var(--sos-text-3)",
              }}
            >
              {s.num}. {s.title}
            </button>
          ))}
        </div>

        {/* Step 1: What got done */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-[14px] font-medium" style={{ color: "var(--sos-text-2)" }}>
              {completedToday.length > 0
                ? `You completed ${completedToday.length} task${completedToday.length === 1 ? "" : "s"} today:`
                : "No tasks marked done today yet — review wins or carry forward cleanly."}
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {completedToday.length === 0 ? (
                <div className="sos-tile p-4 text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                  Focus time and progress stay saved in Studio OS automatically.
                </div>
              ) : (
                completedToday.map((t) => (
                  <div key={t.id} className="sos-tile p-3 flex items-center gap-2.5 text-[13px]">
                    <span className="w-5 h-5 rounded-full bg-[#1F7A52] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="font-semibold" style={{ color: "var(--sos-text-1)" }}>
                      {t.key}
                    </span>
                    <span className="truncate" style={{ color: "var(--sos-text-2)" }}>
                      {t.title}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white"
                style={{ background: "var(--sos-primary)" }}
              >
                Next: Pick tomorrow&apos;s {settings.wip_limit} →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Pick tomorrow's 3 */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[13px]">
              <span style={{ color: "var(--sos-text-2)" }}>
                Select up to {settings.wip_limit} tasks for tomorrow&apos;s calm Now card:
              </span>
              <span className="font-bold sos-tabular" style={{ color: "var(--sos-primary)" }}>
                {selectedTomorrowIds.length} / {settings.wip_limit}
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {candidateTasks.map((t) => {
                const picked = selectedTomorrowIds.includes(t.id);
                const proj = projects.find((p) => p.id === t.project_id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => togglePick(t.id)}
                    className="w-full text-left sos-tile p-3 flex items-center justify-between gap-2.5 border transition-colors"
                    style={{
                      borderColor: picked ? "var(--sos-primary)" : "transparent",
                      background: picked ? "var(--sos-violet-soft)" : "var(--sos-surface-2)",
                    }}
                  >
                    <div className="min-w-0">
                      <span className="text-[12px] font-bold" style={{ color: "var(--sos-primary)" }}>
                        {proj?.emoji} {t.key}
                      </span>
                      <p className="text-[13px] font-medium truncate" style={{ color: "var(--sos-text-1)" }}>
                        {t.title}
                      </p>
                    </div>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: picked ? "var(--sos-primary)" : "var(--sos-surface)",
                        color: picked ? "#FFFFFF" : "var(--sos-text-3)",
                      }}
                    >
                      {picked && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="sos-pill-btn px-4 h-11 text-[13px] font-medium border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white"
                style={{ background: "var(--sos-primary)" }}
              >
                Next: Overnight queue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Queue overnight renders? */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-[14px] font-medium" style={{ color: "var(--sos-text-2)" }}>
              Quick pre-sleep checklist before locking the studio:
            </p>
            <div className="space-y-2">
              {OVERNIGHT_RENDER_ITEMS.map((item) => {
                const checked = Boolean(renderChecks[item.id]);
                return (
                  <label
                    key={item.id}
                    className="sos-tile p-3.5 flex items-center gap-3 cursor-pointer text-[13px]"
                    style={{ color: "var(--sos-text-1)" }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRenderChecks((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className="w-4 h-4 accent-[#5B3FE4]"
                    />
                    <span className={checked ? "line-through opacity-60" : ""}>{item.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="sos-pill-btn px-4 h-11 text-[13px] font-medium border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => completeEveningShutdown(selectedTomorrowIds)}
                className="sos-pill-btn inline-flex items-center gap-2 px-6 h-11 text-[14px] font-semibold text-white"
                style={{ background: "#0E0E10" }}
              >
                <Moon className="w-4 h-4" /> Close Studio for Tonight
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const StudioClosedOverlay: React.FC = () => {
  const { studioClosedForToday, tasks, projects, reopenStudio } = useStudioOS();

  if (!studioClosedForToday) return null;

  const tomorrowThree = tasks.filter((t) => t.is_in_now && t.status !== "done").slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0B0D] text-[#EDEDEF] flex items-center justify-center p-5">
      <div className="w-full max-w-lg rounded-[32px] bg-[#151518] border border-[#26262B] p-7 md:p-9 space-y-6 text-center shadow-2xl">
        <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center bg-[#272235] text-[#7C66F0]">
          <Moon className="w-6 h-6" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-[#1C1C20] text-[#A1A1AA]">
            <Sparkles className="w-3.5 h-3.5 text-[#7C66F0]" /> Studio Closed
          </span>
          <h2 className="sos-display text-[32px] font-semibold mt-3 tracking-[-0.02em]">
            Done for tonight, Shyam.
          </h2>
          <p className="text-[14px] text-[#A1A1AA] mt-1">
            Tomorrow&apos;s {tomorrowThree.length} priorities are locked and ready for your 07:30 brief.
          </p>
        </div>

        <div className="space-y-2.5 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#71717A] px-1">
            Tomorrow&apos;s 3
          </p>
          {tomorrowThree.length === 0 ? (
            <div className="p-4 rounded-[18px] bg-[#1C1C20] text-[13px] text-[#A1A1AA]">
              Clean slate for tomorrow morning.
            </div>
          ) : (
            tomorrowThree.map((t, idx) => {
              const proj = projects.find((p) => p.id === t.project_id);
              return (
                <div
                  key={t.id}
                  className="p-4 rounded-[18px] bg-[#1C1C20] border border-[#26262B] flex items-center gap-3"
                >
                  <span className="w-7 h-7 rounded-full bg-[#272235] text-[#7C66F0] text-[12px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-[#A1A1AA]">
                      {proj?.emoji} {t.key}
                    </span>
                    <p className="text-[14px] font-medium text-[#EDEDEF] truncate">{t.title}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={reopenStudio}
          className="sos-pill-btn inline-flex items-center gap-2 px-6 h-11 text-[14px] font-semibold bg-white text-[#0E0E10]"
        >
          <Sun className="w-4 h-4" /> Reopen Studio
        </button>
      </div>
    </div>
  );
};
