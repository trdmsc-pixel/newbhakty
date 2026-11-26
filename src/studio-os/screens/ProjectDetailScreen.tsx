import React, { useEffect, useMemo, useState } from "react";
import { usePortalPresence } from "../components/PortalPresence";
import { DeliveryTimelineCard } from "../components/DeliveryTimelineCard";
import { ActivePill } from "../motion";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Calendar, Check, CheckCircle2, Diamond, Film, Lock, Minus, Plus, RotateCcw, Send, Sparkles, UserPlus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { GateStatusChip, HealthPill, StackedAvatars } from "../components/StatusChip";
import { BoardScreen } from "./BoardScreen";
import { TableScreen } from "./TableScreen";
import { ProjectEmailsTab } from "../components/ProjectEmailsTab";
import { AssignMembersModal, MemberStack } from "../components/Team";
import { ProjectMoneyTab } from "../components/Money";
import { supabase } from "../../lib/supabase";
import { ProjectDeliverablesTab, SendForApprovalModal } from "../components/ProjectDeliverables";
import { computeGenerationEstimate } from "../forecastEngine";
import { GateStatus, GenerationBlockStatus, type StudioGate, type StudioTask } from "../types";

const REV_STATUS: Array<{ id: "todo" | "in_progress" | "done"; label: string; bg: string; fg: string }> = [
  { id: "todo", label: "To do", bg: "var(--sos-surface-2)", fg: "var(--sos-text-2)" },
  { id: "in_progress", label: "In progress", bg: "#E8F0FF", fg: "#1D4FD8" },
  { id: "done", label: "Addressed", bg: "#E7F7EE", fg: "#17663F" },
];

/** The client's change requests for one stage, as a live checklist. The client sees every status change. */
const RevisionChecklist: React.FC<{ gate: StudioGate; tasks: StudioTask[]; onStatus: (id: string, st: "todo" | "in_progress" | "done") => void }> = ({ gate, tasks, onStatus }) => {
  const [showAll, setShowAll] = React.useState(false);
  if (!tasks.length) return null;
  const round = (t: StudioTask) => Number(String(t.source_ref || "").match(/:r(\d+)$/)?.[1] || 1);
  const maxRound = Math.max(...tasks.map(round));
  const list = (showAll ? tasks : tasks.filter((t) => round(t) === maxRound)).slice().sort((a, b) => round(b) - round(a) || a.created_at.localeCompare(b.created_at));
  const current = tasks.filter((t) => round(t) === maxRound);
  const done = current.filter((t) => t.status === "done").length;
  const approved = gate.status === "approved";
  return (
    <div className="ml-4 sm:ml-10 -mt-1 mb-1 p-3 rounded-[16px] border-l-2 space-y-1.5" style={{ background: "var(--sos-surface-2)", borderColor: approved ? "var(--sos-green)" : done === current.length ? "var(--sos-green)" : "#F59E0B" }}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Client changes · round {maxRound}
        </p>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full sos-tabular" style={approved || done === current.length ? { background: "#E7F7EE", color: "#17663F" } : { background: "#FFF3E0", color: "#9A4A00" }}>
          {approved ? "Approved by client" : `${done}/${current.length} addressed`}
        </span>
        <div className="sos-bar h-1.5 flex-1 min-w-[60px] max-w-[160px]">
          <span className={done === current.length ? "done" : ""} style={{ width: `${current.length ? Math.round((done / current.length) * 100) : 0}%` }} />
        </div>
        {tasks.length > current.length && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[11px] font-semibold ml-auto" style={{ color: "var(--sos-primary)" }}>
            {showAll ? "Latest round only" : "All rounds"}
          </button>
        )}
      </div>
      {list.map((t) => {
        const st = REV_STATUS.find((x) => x.id === (t.status === "done" ? "done" : ["in_progress", "in_review", "revising"].includes(t.status) ? "in_progress" : "todo"))!;
        const title = t.title.replace(/^.*? R\d+:\s*/, "");
        return (
          <div key={t.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 px-2.5 py-2 rounded-[12px]" style={{ background: "var(--sos-surface)" }}>
            <span className="flex-1 min-w-[160px] text-[13px]" style={{ color: "var(--sos-text-1)", textDecoration: st.id === "done" ? "line-through" : undefined, opacity: st.id === "done" ? 0.7 : 1 }}>
              {showAll && <span className="text-[10px] font-bold mr-1.5" style={{ color: "var(--sos-text-3)" }}>R{round(t)}</span>}
              {title}
            </span>
            <div className="inline-flex p-0.5 rounded-full shrink-0" style={{ background: "var(--sos-surface-2)" }}>
              {REV_STATUS.map((o) => (
                <button key={o.id} type="button" onClick={() => onStatus(t.id, o.id)} className="h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors" style={st.id === o.id ? { background: o.bg === "var(--sos-surface-2)" ? "var(--sos-surface)" : o.bg, color: o.fg, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "var(--sos-text-3)" }}>
                  {o.id === "done" ? "✓ Addressed" : o.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[10.5px]" style={{ color: "var(--sos-text-3)" }}>The client sees each status live and gets a notification when you mark a change addressed.</p>
    </div>
  );
};

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
    updateProject,
    updateTask,
    initGenerationBlocks,
    addGenerationBlock,
    updateGenerationBlock,
    getProjectForecast,
    setQuickAddOpen,
    pushToast,
    isOwner,
    supabaseSyncStatus,
    setRoute,
  } = useStudioOS();
  const [assignOpen, setAssignOpen] = useState(false);
  const [projectTeamIds, setProjectTeamIds] = useState<string[]>([]);
  useEffect(() => {
    if (!selectedProjectId || supabaseSyncStatus !== "synced" || !supabase) return;
    supabase
      .from("studio_project_members")
      .select("member_id")
      .eq("project_id", selectedProjectId)
      .then(({ data }) => setProjectTeamIds((data || []).map((r: any) => r.member_id)));
  }, [selectedProjectId, supabaseSyncStatus, assignOpen]);

  const [tab, setTab] = useState<"approvals" | "overview" | "generation" | "list" | "board" | "emails" | "deliverables" | "money">("approvals");
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
  const presence = usePortalPresence();

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
  const isClosed = Boolean(project.closed_at);
  const openTaskList = tasks.filter((t) => t.project_id === project.id && t.status !== "done");
  const openGateList = projectGates.filter((g) => g.status !== "approved" && g.status !== "skipped");

  const closeProject = () => {
    const lines = [
      `Complete and close ${project.code} — ${project.title}?`,
      "",
      "• The client portal will show it as Completed & closed",
      openGateList.length ? `• ${openGateList.length} remaining stage${openGateList.length > 1 ? "s" : ""} will be marked approved` : null,
      openTaskList.length ? `• ${openTaskList.length} open task${openTaskList.length > 1 ? "s" : ""} will be marked done` : null,
      "• Mark the final file(s) in Deliverables so the client can download them",
    ].filter(Boolean);
    if (!window.confirm(lines.join("\n"))) return;
    const now = new Date().toISOString();
    for (const g of openGateList) updateGate(g.id, { status: "approved", approved_at: g.approved_at || now });
    for (const t of openTaskList) updateTask(t.id, { status: "done", is_in_now: false });
    updateProject(project.id, { status: project.status === "paid" ? "paid" : "delivered", closed_at: now, health: "on_track" });
    pushToast(`${project.code} completed & closed`, "success");
    setTab("deliverables");
  };
  const reopenProject = () => {
    if (!window.confirm(`Reopen ${project.code}? It will show as active again in the client portal.`)) return;
    updateProject(project.id, { status: "active", closed_at: undefined });
    pushToast(`${project.code} reopened`, "info");
  };

  return (
    <div className="space-y-6">
      {sendGate && project && <SendForApprovalModal project={project} gate={sendGate} onClose={() => setSendGateId(null)} />}
      {assignOpen && project && <AssignMembersModal project={project} onClose={() => setAssignOpen(false)} />}
      <button
        type="button"
        onClick={() => (window.history.state?.sosRoute && window.history.length > 1 ? window.history.back() : setRoute("projects"))}
        className="group inline-flex items-center gap-1.5 h-9 pl-2.5 pr-3.5 -mb-2 rounded-full text-[13px] font-semibold transition-colors hover:bg-black/[0.04]"
        style={{ color: "var(--sos-text-2)" }}
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back
      </button>
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
              {project && (presence[project.id] || []).map((v, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: "#E7F7EE", color: "#17663F" }} title={`Since ${new Date(v.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}>
                  <span className="sos-live-dot" style={{ width: 6, height: 6 }} /> {v.name.split(" ")[0]} · {v.activity.toLowerCase()} now
                </span>
              ))}
              {isClosed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold" style={{ background: "#E7F7EE", color: "#17663F" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed & closed · {format(parseISO(project.closed_at!), "d MMM yyyy")}
                </span>
              ) : (
                <HealthPill health={project.health} />
              )}
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
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    updateProject(project.id, { portal_visible: !project.portal_visible });
                    pushToast(project.portal_visible ? "Hidden from the client portal" : "Now visible in the client portal", "success");
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                  style={project.portal_visible ? { background: "#E7F7EE", color: "#17663F" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}
                  title="Whether the client can see this project in their portal"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.portal_visible ? "#1F7A52" : "var(--sos-text-3)" }} />
                  {project.portal_visible ? "Shown in client portal" : "Hidden from client portal"}
                </button>
              )}
              {isOwner && project.portal_visible && project.status !== "lost" && client && !client.contacts.some((ct) => ct.is_portal_user) && (
                <button
                  type="button"
                  onClick={() => setRoute("clients")}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                  style={{ background: "#FFF3E0", color: "#9A4A00" }}
                  title="Create a portal login for this client in Clients"
                >
                  {client.name} has no portal login yet →
                </button>
              )}
              <span>Code: <strong className="sos-tabular">{project.code}</strong></span>
              {isOwner && <span>Fee (owner only): <strong className="sos-tabular">{feeDisplay}</strong></span>}
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
              <MemberStack
                memberIds={[project.owner_member_id, ...projectTeamIds, ...tasks.filter((t) => t.project_id === project.id && t.status !== "done").map((t) => t.assignee_member_id)]}
                size={34}
              />
            </div>
            {isOwner &&
              (isClosed ? (
                <button type="button" onClick={reopenProject} className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
                  <RotateCcw className="w-4 h-4" /> Reopen
                </button>
              ) : (
                <button type="button" onClick={closeProject} className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white" style={{ background: "var(--sos-green)" }}>
                  <CheckCircle2 className="w-4 h-4" /> Complete & close
                </button>
              ))}
            <button
              type="button"
              onClick={() => (isOwner ? setAssignOpen(true) : pushToast("Only the studio owner can change the project team", "info"))}
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
              ...(isOwner ? ([{ id: "money", label: "Money" }] as const) : []),
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative px-4 py-2 min-h-[40px] rounded-full text-[13px] font-semibold transition-colors duration-200"
              style={{
                background: "var(--sos-surface-2)",
                color: tab === t.id ? "var(--sos-ink-text)" : "var(--sos-text-2)",
              }}
              aria-pressed={tab === t.id}
            >
              {tab === t.id && <ActivePill layoutId="sos-project-tab" style={{ background: "var(--sos-ink)" }} />}
              <span className="relative z-[1]">{t.label}</span>
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
                    ◆ marks client approval gates. Set each stage&apos;s due date — the timeline shifts automatically when the client takes longer to approve.
                  </p>
                </div>
                <span className="sos-num text-[14px] font-semibold px-3 py-1 rounded-full bg-[#E7F7EE] text-[#17663F]">
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
                  <React.Fragment key={g.id}>
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
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#9A4A00]"
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
                          {(() => {
                            const st = forecast?.stages.find((x) => x.gate_id === g.id);
                            if (!st) return null;
                            if (st.done) return st.client_wait_days != null ? <span className="sos-tabular">client took {st.client_wait_days}d</span> : null;
                            const moved = st.planned_end && st.projected_end !== st.planned_end;
                            return (
                              <span className="sos-tabular" style={{ color: moved ? "#9A4A00" : undefined }} title={st.planned_is_manual ? "Manual date" : "From estimates"}>
                                {st.planned_end ? `plan ${format(parseISO(st.planned_end), "d MMM")}` : ""}
                                {moved ? ` → now ${format(parseISO(st.projected_end), "d MMM")}` : ""}
                                {g.status === "waiting_on_client" && st.client_wait_days != null ? ` · waiting ${st.client_wait_days}d` : ""}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--sos-text-2)" }} title="Planned end date for this stage (shown in the client portal)">
                        Due
                        <input
                          type="date"
                          value={g.due_date || ""}
                          onChange={(e) => updateGate(g.id, { due_date: e.target.value || undefined })}
                          className="h-8 px-2 rounded-[10px] border text-[12px] sos-tabular"
                          style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                        />
                      </label>
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
                  <RevisionChecklist gate={g} tasks={tasks.filter((t) => t.gate_id === g.id && t.source === "portal" && !t.archived_at)} onStatus={(id, st) => updateTask(id, { status: st, ...(st === "done" ? { completed_at: new Date().toISOString(), is_in_now: false } : { completed_at: undefined }) })} />
                  </React.Fragment>
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
                                ? "#1F7A52"
                                : st === "generating"
                                ? "#1D4FD8"
                                : st === "rejected"
                                ? "#B42318"
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
          {tab === "money" && isOwner && <ProjectMoneyTab project={project} />}
        </div>

        {/* Right Rail: Forecast + Next Milestone + Recent Activity */}
        <aside className="lg:col-span-4 space-y-5">
          {forecast && <DeliveryTimelineCard project={project} forecast={forecast} />}
          {nextGate && (
            <div className="sos-card px-5 py-3.5 text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              Next milestone: <strong style={{ color: "var(--sos-text-1)" }}>{nextGate.code} {nextGate.name}</strong>
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
                    style={{ background: a.actor === "client" ? "#1D4FD8" : "#5B3FE4" }}
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
