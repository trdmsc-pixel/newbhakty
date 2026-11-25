import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, Check, Diamond, Film, Lock, Minus, Plus, Send, Sparkles, UserPlus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { GateStatusChip, HealthPill, StackedAvatars } from "../components/StatusChip";
import { BoardScreen } from "./BoardScreen";
import { TableScreen } from "./TableScreen";
import { ProjectEmailsTab } from "../components/ProjectEmailsTab";
import { ProjectDeliverablesTab, SendForApprovalModal } from "../components/ProjectDeliverables";
import { computeGenerationEstimate } from "../forecastEngine";
import { GateStatus, GenerationBlockStatus } from "../types";

export const ProjectDetailScreen: React.FC = () => {
  const {
    projects,
    selectedProjectId,
    openProject,
    clients,
    gates,
    tasks,
    activity,
    settings,
    generationBlocks,
    updateGate,
    initGenerationBlocks,
    addGenerationBlock,
    updateGenerationBlock,
    getProjectForecast,
    setQuickAddOpen,
    pushToast,
  } = useStudioOS();

  const [tab, setTab] = useState<"approvals" | "overview" | "generation" | "list" | "board" | "emails" | "deliverables">("approvals");
  const [sendGateId, setSendGateId] = useState<string | null>(null);
  const project = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const client = clients.find((c) => c.id === project?.client_id);
  const projectGates = useMemo(
    () =>
      gates
        .filter((g) => g.project_id === project?.id)
        .sort((a, b) => a.order_index - b.order_index),
    [gates, project?.id]
  );
  const projectTasks = useMemo(() => tasks.filter((t) => t.project_id === project?.id), [tasks, project?.id]);
  const projectBlocks = useMemo(
    () =>
      generationBlocks
        .filter((b) => b.project_id === project?.id)
        .sort((a, b) => a.block_number - b.block_number),
    [generationBlocks, project?.id]
  );
  const genEstimate = useMemo(
    () => computeGenerationEstimate(projectBlocks, settings),
    [projectBlocks, settings]
  );
  const forecast = project ? getProjectForecast(project.id) : null;

  if (!project) return null;

  const approvedCount = projectGates.filter((g) => g.status === "approved").length;
  const progressPct = projectGates.length ? Math.round((approvedCount / projectGates.length) * 100) : 0;
  const nextGate = projectGates.find((g) => g.status !== "approved" && g.status !== "skipped");

  const feeDisplay = project.fee_amount
    ? project.currency === "USD"
      ? `$${project.fee_amount.toLocaleString()}`
      : project.currency === "EUR"
      ? `€${project.fee_amount.toLocaleString()}`
      : `₹${project.fee_amount.toLocaleString("en-IN")}`
    : "—";

  const handleGateStatusChange = (gateId: string, status: GateStatus) => {
    updateGate(gateId, { status });
    pushToast(`Updated gate to ${status.replace(/_/g, " ")}`, "success");
  };

  const sendGate = projectGates.find((g) => g.id === sendGateId);

  return (
    <div className="space-y-6">
      {sendGate && project && <SendForApprovalModal project={project} gate={sendGate} onClose={() => setSendGateId(null)} />}
      {/* Project Header */}
      <div className="sos-card p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={project.id}
                onChange={(e) => openProject(e.target.value)}
                className="sos-display text-[26px] md:text-[32px] font-semibold tracking-[-0.02em] bg-transparent outline-none cursor-pointer pr-2 max-w-full"
                style={{ color: "var(--sos-text-1)" }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.title}
                  </option>
                ))}
              </select>
              <HealthPill health={project.health} />
              {project.is_confidential && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                  style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
                >
                  <Lock className="w-3 h-3" /> Confidential
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              <span>Client: <strong>{client?.name}</strong></span>
              <span>Code: <strong className="sos-tabular">{project.code}</strong></span>
              <span>Fee (owner only): <strong className="sos-tabular">{feeDisplay}</strong></span>
              <span>
                Last updated:{" "}
                <strong className="sos-tabular">{format(parseISO(project.updated_at), "d MMM yyyy")}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                Assigned
              </span>
              <StackedAvatars items={[{ initials: "SS", color: "#5B3FE4", name: "Shyam Sharma" }]} size={34} />
            </div>
            <button
              type="button"
              onClick={() => pushToast("Team member assignment unlocks in Phase 5", "info")}
              className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
              style={{ background: "var(--sos-primary)" }}
            >
              <UserPlus className="w-4 h-4" /> Assign Member
            </button>
          </div>
        </div>

        {/* Project Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t" style={{ borderColor: "var(--sos-border)" }}>
          {(
            [
              { id: "approvals", label: "Approvals & Gates" },
              { id: "generation", label: `Generation (${projectBlocks.length})` },
              { id: "overview", label: "Overview" },
              { id: "list", label: `List (${projectTasks.length})` },
              { id: "board", label: "Board" },
              { id: "deliverables", label: "Deliverables" },
              { id: "emails", label: "Emails" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="px-4 py-2 rounded-full text-[13px] font-semibold transition-colors"
              style={{
                background: tab === t.id ? "var(--sos-ink)" : "var(--sos-surface-2)",
                color: tab === t.id ? "var(--sos-ink-text)" : "var(--sos-text-2)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content + Right Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          {tab === "approvals" && (
            <div className="sos-card p-5 md:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    Production Gate Rail (G0 → G10)
                  </h2>
                  <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
                    ◆ marks client approval gates. Adjusting any gate&apos;s estimate days recomputes the live forecast instantly.
                  </p>
                </div>
                <span className="sos-num text-[14px] font-semibold px-3 py-1 rounded-full bg-[#E7F7EE] text-[#22875A]">
                  {progressPct}% complete
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
                <div className="h-full rounded-full sos-stripe-green transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>

              {/* Gate Rows */}
              <div className="space-y-2.5">
                {projectGates.map((g) => (
                  <div
                    key={g.id}
                    className="sos-tile p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleGateStatusChange(g.id, g.status === "approved" ? "in_work" : "approved")
                        }
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                        style={{
                          background: g.status === "approved" ? "var(--sos-green)" : "var(--sos-surface)",
                          color: g.status === "approved" ? "#FFFFFF" : "var(--sos-text-3)",
                          border: g.status === "approved" ? "none" : "1.5px solid var(--sos-border)",
                        }}
                        aria-label={`Toggle ${g.name} approved`}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[12px] font-bold sos-tabular" style={{ color: "var(--sos-primary)" }}>
                            {g.code}
                          </span>
                          <span className="text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                            {g.name}
                          </span>
                          {g.needs_client_approval && (
                            <span
                              title="Requires client approval"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#C26A00]"
                            >
                              <Diamond className="w-2.5 h-2.5 fill-current" /> Approval
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                          <GateStatusChip status={g.status} />
                          <span className="sos-tabular">
                            Rev {g.revision_round} of {g.revisions_included} included
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                        Est.
                        <input
                          type="number"
                          min={0}
                          max={60}
                          step={0.5}
                          value={g.estimate_days}
                          onChange={(e) =>
                            updateGate(g.id, { estimate_days: Math.max(0, parseFloat(e.target.value) || 0) })
                          }
                          className="w-16 h-8 px-2 text-center rounded-[10px] border text-[13px] font-semibold sos-tabular"
                          style={{
                            background: "var(--sos-surface)",
                            borderColor: "var(--sos-border)",
                            color: "var(--sos-text-1)",
                          }}
                        />
                        d
                      </label>

                      {g.status === "approved" && (
                        <label className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                          Act.
                          <input
                            type="number"
                            min={0.5}
                            max={90}
                            step={0.5}
                            value={g.actual_days ?? g.estimate_days}
                            onChange={(e) =>
                              updateGate(g.id, { actual_days: Math.max(0.5, parseFloat(e.target.value) || 0.5) })
                            }
                            className="w-14 h-8 px-1.5 text-center rounded-[10px] border text-[12px] font-semibold sos-tabular"
                            style={{
                              background: "var(--sos-surface)",
                              borderColor: "var(--sos-border)",
                              color: "var(--sos-green)",
                            }}
                          />
                          d
                        </label>
                      )}

                      {g.needs_client_approval && g.status !== "approved" && (
                        <button
                          type="button"
                          onClick={() => setSendGateId(g.id)}
                          className="sos-pill-btn inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold border"
                          style={{
                            background: "var(--sos-surface)",
                            borderColor: "var(--sos-border)",
                            color: "var(--sos-blue)",
                          }}
                        >
                          <Send className="w-3 h-3" /> {g.status === "waiting_on_client" ? "Resend" : "Send for approval"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="sos-card p-5 md:p-6 space-y-4">
              <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Project Brief &amp; Specs
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sos-tile p-4">
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Runtime</p>
                  <p className="sos-num text-[22px] font-semibold mt-1" style={{ color: "var(--sos-text-1)" }}>
                    {project.runtime_seconds ? `${Math.floor(project.runtime_seconds / 60)}:${String(project.runtime_seconds % 60).padStart(2, "0")}` : "TBD"}
                  </p>
                </div>
                <div className="sos-tile p-4">
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Versions</p>
                  <p className="sos-num text-[22px] font-semibold mt-1" style={{ color: "var(--sos-text-1)" }}>
                    {project.versions}
                  </p>
                </div>
                <div className="sos-tile p-4">
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Hard Deadline</p>
                  <p className="sos-num text-[18px] font-semibold mt-1" style={{ color: "var(--sos-text-1)" }}>
                    {project.hard_deadline ? format(parseISO(project.hard_deadline), "d MMM yyyy") : "Open"}
                  </p>
                </div>
                <div className="sos-tile p-4">
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Open Tasks</p>
                  <p className="sos-num text-[22px] font-semibold mt-1" style={{ color: "var(--sos-text-1)" }}>
                    {projectTasks.filter((t) => t.status !== "done").length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-green)" }}
              >
                <Plus className="w-4 h-4" /> Add Task to {project.code}
              </button>
            </div>
          )}

          {tab === "generation" && (
            <div className="sos-card p-5 md:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    AI Generation Blocks ({settings.block_seconds}s units)
                  </h2>
                  <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
                    {genEstimate.keepers} / {genEstimate.total} keepers · {genEstimate.totalTakes} total takes · Est{" "}
                    <strong className="sos-tabular" style={{ color: "var(--sos-primary)" }}>
                      {genEstimate.remainingDays}d remaining
                    </strong>{" "}
                    ({settings.takes_per_keeper} takes/keeper · {settings.work_hours_per_day}h/day)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {projectBlocks.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => initGenerationBlocks(project.id)}
                      className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
                      style={{ background: "var(--sos-primary)" }}
                    >
                      <Film className="w-4 h-4" />
                      Auto-generate {Math.max(1, Math.ceil((project.runtime_seconds || 60) / (settings.block_seconds || 20)) * (project.versions || 1))} blocks
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addGenerationBlock(project.id)}
                      className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-9 text-[13px] font-semibold text-white"
                      style={{ background: "var(--sos-green)" }}
                    >
                      <Plus className="w-4 h-4" /> Add Block
                    </button>
                  )}
                </div>
              </div>

              {projectBlocks.length === 0 ? (
                <div className="sos-tile p-8 text-center space-y-2" style={{ color: "var(--sos-text-2)" }}>
                  <p className="text-[14px] font-medium">
                    No generation blocks initialized for {project.code}.
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                    Click Auto-generate above to create ceil({project.runtime_seconds || 60}s / {settings.block_seconds}s) × {project.versions || 1} version(s).
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projectBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="sos-tile p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 sos-tabular"
                          style={{ background: "var(--sos-surface)", color: "var(--sos-text-1)" }}
                        >
                          #{b.block_number}
                        </span>
                        <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={b.label || ""}
                            onChange={(e) => updateGenerationBlock(b.id, { label: e.target.value })}
                            placeholder="Scene / block description..."
                            className="h-9 px-3 rounded-[10px] border text-[13px] font-medium"
                            style={{
                              background: "var(--sos-surface)",
                              borderColor: "var(--sos-border)",
                              color: "var(--sos-text-1)",
                            }}
                          />
                          <input
                            value={b.prompt_ref || ""}
                            onChange={(e) => updateGenerationBlock(b.id, { prompt_ref: e.target.value })}
                            placeholder="Prompt ref..."
                            className="h-9 px-3 rounded-[10px] border text-[12px] sos-tabular"
                            style={{
                              background: "var(--sos-surface)",
                              borderColor: "var(--sos-border)",
                              color: "var(--sos-text-2)",
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Takes Counter */}
                        <div
                          className="inline-flex items-center gap-1 px-2 h-8 rounded-full border text-[12px] sos-tabular"
                          style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
                        >
                          <button
                            type="button"
                            onClick={() => updateGenerationBlock(b.id, { takes: Math.max(0, b.takes - 1) })}
                            className="w-5 h-5 rounded-full flex items-center justify-center hover:opacity-70"
                            aria-label="Decrease takes"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-1 font-semibold" style={{ color: "var(--sos-text-1)" }}>
                            {b.takes} takes
                          </span>
                          <button
                            type="button"
                            onClick={() => updateGenerationBlock(b.id, { takes: b.takes + 1 })}
                            className="w-5 h-5 rounded-full flex items-center justify-center hover:opacity-70"
                            aria-label="Increase takes"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Status Pills */}
                        <div className="inline-flex p-0.5 rounded-full" style={{ background: "var(--sos-surface)" }}>
                          {(["planned", "generating", "keeper", "rejected"] as GenerationBlockStatus[]).map((st) => {
                            const active = b.status === st;
                            const activeBg =
                              st === "keeper"
                                ? "#3FA37A"
                                : st === "generating"
                                ? "#2F6BFF"
                                : st === "rejected"
                                ? "#E5484D"
                                : "var(--sos-ink)";
                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() => updateGenerationBlock(b.id, { status: st })}
                                className="px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors"
                                style={{
                                  background: active ? activeBg : "transparent",
                                  color: active ? "#FFFFFF" : "var(--sos-text-3)",
                                }}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "list" && <TableScreen projectFilterId={project.id} />}
          {tab === "board" && <BoardScreen projectFilterId={project.id} />}
          {tab === "emails" && <ProjectEmailsTab projectId={project.id} />}
          {tab === "deliverables" && <ProjectDeliverablesTab project={project} gates={projectGates} />}
        </div>

        {/* Right Rail: Forecast + Next Milestone + Recent Activity */}
        <aside className="lg:col-span-4 space-y-5">
          {forecast && (
            <div className="sos-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>
                  Live Forecast
                </span>
                <HealthPill health={forecast.health} />
              </div>
              <div className="flex items-baseline gap-2">
                <Calendar className="w-5 h-5" style={{ color: "var(--sos-primary)" }} />
                <span className="sos-num text-[28px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                  {format(parseISO(forecast.forecast_date), "d MMM yyyy")}
                </span>
              </div>
              <p
                className="text-[12px] p-3 rounded-[14px] sos-tabular"
                style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1.5" style={{ color: "var(--sos-primary)" }} />
                {forecast.explanation}
              </p>
              {nextGate && (
                <div className="pt-2 border-t text-[13px]" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                  Next milestone: <strong style={{ color: "var(--sos-text-1)" }}>{nextGate.code} {nextGate.name}</strong>
                </div>
              )}
            </div>
          )}

          <div className="sos-card p-5 space-y-3">
            <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Recent activity
            </h3>
            <div className="space-y-3">
              {activity.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
                    style={{ background: a.actor === "client" ? "#2F6BFF" : "#5B3FE4" }}
                  >
                    {a.actor_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p style={{ color: "var(--sos-text-1)" }}>
                      <strong>{a.actor_name}</strong>{" "}
                      <span style={{ color: "var(--sos-text-2)" }}>{a.action}</span>
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--sos-text-3)" }}>
                      {format(parseISO(a.at), "d MMM, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
