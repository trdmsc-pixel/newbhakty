import React, { useEffect, useMemo, useState } from "react";
import { StageHistoryButton, StageNoteBox, StageTimelineList, useStageTimeline } from "../components/StageHistory";
import { usePortalPresence } from "../components/PortalPresence";
import { DeliveryTimelineCard } from "../components/DeliveryTimelineCard";
import { ActivePill } from "../motion";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ChevronDown, Calendar, Check, CheckCircle2, Diamond, Film, Lock, Minus, Plus, RotateCcw, Send, Sparkles, UserPlus } from "lucide-react";
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
import { GateStatus, GenerationBlockStatus, type StudioGate, type StudioTask, type StudioProject } from "../types";

const GATE_LABEL: Record<GateStatus, string> = { not_started: "Not started", in_work: "In work", waiting_on_client: "Awaiting client review", revising: "Revising", approved: "Completed", skipped: "Skipped" };
const GATE_TONE: Record<GateStatus, { bg: string; fg: string }> = {
  not_started: { bg: "var(--sos-surface-2)", fg: "var(--sos-text-2)" },
  in_work: { bg: "#E8F0FF", fg: "#1D4FD8" },
  waiting_on_client: { bg: "#FFF3E0", fg: "#9A4A00" },
  revising: { bg: "#FDF2F8", fg: "#BE185D" },
  approved: { bg: "#E7F7EE", fg: "#17663F" },
  skipped: { bg: "var(--sos-surface-2)", fg: "var(--sos-text-3)" },
};
/** Milestone status as a coloured dropdown pill. */
export const GateStatusSelect: React.FC<{ status: GateStatus; needsApproval?: boolean; onChange: (s: GateStatus) => void }> = ({ status, needsApproval, onChange }) => {
  const t = GATE_TONE[status];
  return (
    <span className="relative inline-flex items-center">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as GateStatus)}
        className="appearance-none h-7 pl-3 pr-7 rounded-full text-[12px] font-semibold cursor-pointer transition-shadow hover:shadow-[0_0_0_3px_rgba(91,63,228,0.12)]"
        style={{ background: t.bg, color: t.fg }}
        aria-label="Milestone status"
        title="Change status — the client portal shows it"
      >
        {(["not_started", "in_work", ...(needsApproval ? (["waiting_on_client", "revising"] as GateStatus[]) : []), "approved", "skipped"] as GateStatus[]).map((s) => (
          <option key={s} value={s}>{s === "waiting_on_client" && status !== s ? "Send for client review…" : GATE_LABEL[s]}</option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none" style={{ color: t.fg }} />
    </span>
  );
};

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

/** One milestone in the Client changes tab: status, the client's change requests, and the full back-and-forth. */
const MilestoneCommsCard: React.FC<{ project: StudioProject; gate: StudioGate; tasks: StudioTask[]; defaultOpen: boolean; onStatus: (s: GateStatus) => void; onTask: (id: string, st: "todo" | "in_progress" | "done") => void; onSend: () => void }> = ({ project, gate, tasks, defaultOpen, onStatus, onTask, onSend }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const tl = useStageTimeline(project, gate);
  const openRevs = tasks.filter((t) => t.status !== "done").length;
  return (
    <div className="sos-card overflow-hidden" style={{ boxShadow: gate.status === "waiting_on_client" ? "0 0 0 1.5px rgba(245,158,11,0.45), 0 12px 30px -16px rgba(245,158,11,0.5)" : undefined }}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="text-[11px] font-bold sos-tabular shrink-0" style={{ color: "var(--sos-primary)" }}>{gate.code}</span>
          <span className="text-[15px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{gate.name}</span>
          {openRevs > 0 && <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#9A4A00" }}>{openRevs} open change{openRevs > 1 ? "s" : ""}</span>}
          {tl.events && tl.events.length > 0 && <span className="shrink-0 text-[11px]" style={{ color: "var(--sos-text-3)" }}>· {tl.events.length} event{tl.events.length > 1 ? "s" : ""}</span>}
          <ChevronDown className={`w-4 h-4 shrink-0 ml-auto transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--sos-text-3)" }} />
        </button>
        <GateStatusSelect status={gate.status} needsApproval={gate.needs_client_approval} onChange={onStatus} />
        {gate.needs_client_approval && gate.status !== "approved" && (
          <button type="button" onClick={onSend} className="sos-jelly inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px]">
            <Send className="w-3.5 h-3.5" /> {gate.status === "waiting_on_client" ? "Resend" : "Send for review"}
          </button>
        )}
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          <RevisionChecklist gate={gate} tasks={tasks} onStatus={onTask} />
          <StageTimelineList events={tl.events} compact />
          <StageNoteBox gate={gate} canSend={Boolean(project.client_id)} note={tl.note} setNote={tl.setNote} busy={tl.busy} send={tl.send} />
        </div>
      )}
    </div>
  );
};

const ClientChangesTab: React.FC<{ project: StudioProject; gates: StudioGate[]; tasks: StudioTask[]; onStatus: (gateId: string, s: GateStatus) => void; onTask: (id: string, st: "todo" | "in_progress" | "done") => void; onSend: (gateId: string) => void }> = ({ project, gates, tasks, onStatus, onTask, onSend }) => {
  const [all, setAll] = React.useState(false);
  const revs = tasks.filter((t) => t.source === "portal" && !t.archived_at);
  const active = gates.filter((g) => g.status !== "not_started" || revs.some((t) => t.gate_id === g.id));
  const shown = all ? gates : active;
  const open = revs.filter((t) => t.status !== "done").length;
  const waiting = gates.filter((g) => g.status === "waiting_on_client");
  return (
    <div className="space-y-4">
      <div className="sos-card sos-hero p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Client changes & communication</h2>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>Every milestone: its status (as the client sees it), their change requests, and everything sent and received.</p>
        </div>
        <div className="flex gap-6 ml-auto">
          {[
            ["Open changes", open, open ? "#9A4A00" : "var(--sos-text-1)"],
            ["Awaiting client", waiting.length, waiting.length ? "#D97706" : "var(--sos-text-1)"],
            ["Addressed", revs.filter((t) => t.status === "done").length, "#17663F"],
          ].map(([k, v, c]) => (
            <div key={k as string}>
              <p className="sos-num text-[26px] font-semibold leading-none" style={{ color: c as string }}>{v as number}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--sos-text-3)" }}>{k}</p>
            </div>
          ))}
        </div>
      </div>
      {shown.map((g) => (
        <MilestoneCommsCard
          key={g.id}
          project={project}
          gate={g}
          tasks={revs.filter((t) => t.gate_id === g.id)}
          defaultOpen={g.status === "waiting_on_client" || g.status === "revising" || revs.some((t) => t.gate_id === g.id && t.status !== "done")}
          onStatus={(st) => onStatus(g.id, st)}
          onTask={onTask}
          onSend={() => onSend(g.id)}
        />
      ))}
      {gates.length > active.length && (
        <button type="button" onClick={() => setAll((v) => !v)} className="text-[13px] font-semibold" style={{ color: "var(--sos-primary)" }}>
          {all ? "Hide milestones that haven't started" : `Show all ${gates.length} milestones`}
        </button>
      )}
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

  const [tab, setTab] = useState<"approvals" | "changes" | "overview" | "generation" | "list" | "board" | "emails" | "deliverables" | "money">("approvals");
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

  /** Every milestone status change is visible in the client portal, so completing / un-completing asks first. */
  const handleGateStatusChange = (gateId: string, status: GateStatus) => {
    const g = projectGates.find((x) => x.id === gateId);
    if (!g || g.status === status) return;
    if (status === "waiting_on_client") {
      setSendGateId(gateId); // goes through "Send for approval" so the client gets the file + note
      return;
    }
    const shown = project?.portal_visible && g.portal_visible;
    if (status === "approved" && !window.confirm(`Mark "${g.name}" as completed?${shown ? "\n\nThis shows as completed in the client portal." : ""}`)) return;
    if (g.status === "approved" && !window.confirm(`Remove the completion from "${g.name}" and set it to ${GATE_LABEL[status]}?${shown ? "\n\nThe client portal will show it as not completed again." : ""}`)) return;
    updateGate(gateId, { status });
    pushToast(`${g.name} → ${GATE_LABEL[status]}${shown ? " · client portal updated" : ""}`, "success");
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
      <div className="sos-card sos-hero p-5 md:p-7">
        <span className="sos-orb" style={{ width: 260, height: 260, top: -140, right: -60, background: "radial-gradient(circle, rgba(124,92,255,0.22), transparent 70%)" }} />
        <div className="relative z-[1] flex flex-col xl:flex-row xl:items-end justify-between gap-5">
          <div className="min-w-0 space-y-3">
            {/* Eyebrow: code · client · type */}
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--sos-text-3)" }}>
              <span className="px-2 py-0.5 rounded-md sos-tabular" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>{project.code}</span>
              {client && (
                <button type="button" onClick={() => setRoute("clients")} className="hover:underline" style={{ color: "var(--sos-text-2)" }}>
                  {client.name}
                </button>
              )}
              <span aria-hidden>·</span>
              <span className="capitalize">{project.type.replace(/_/g, " ")}</span>
              {project.is_confidential && (
                <span className="inline-flex items-center gap-1" style={{ color: "var(--sos-primary)" }}>
                  <Lock className="w-3 h-3" /> Confidential
                </span>
              )}
            </div>

            {/* Title with a quiet project switcher */}
            <div className="relative inline-flex items-center gap-2 max-w-full group">
              <h1 className="sos-display text-[28px] md:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1] min-w-0" style={{ color: "var(--sos-text-1)" }}>
                <span className="mr-2">{project.emoji}</span>
                {project.title}
              </h1>
              <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors group-hover:bg-black/[0.05]" style={{ color: "var(--sos-text-3)" }} aria-hidden>
                <ChevronDown className="w-4 h-4" />
              </span>
              <select
                value={project.id}
                onChange={(e) => openProject(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                aria-label="Switch project"
                title="Switch project"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              {isClosed ? (
                <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-semibold" style={{ background: "#E7F7EE", color: "#17663F" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed & closed · {format(parseISO(project.closed_at!), "d MMM yyyy")}
                </span>
              ) : (
                <HealthPill health={project.health} />
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    updateProject(project.id, { portal_visible: !project.portal_visible });
                    pushToast(project.portal_visible ? "Hidden from the client portal" : "Now visible in the client portal", "success");
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold transition-colors"
                  style={project.portal_visible ? { background: "#E7F7EE", color: "#17663F" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}
                  title="Whether the client can see this project in their portal"
                >
                  <span className={project.portal_visible ? "sos-live-dot" : "w-1.5 h-1.5 rounded-full"} style={{ width: 6, height: 6, background: project.portal_visible ? undefined : "var(--sos-text-3)", color: "#1F7A52" }} />
                  {project.portal_visible ? "Live in client portal" : "Hidden from portal"}
                </button>
              )}
              {(presence[project.id] || []).map((v, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-semibold" style={{ background: "#E7F7EE", color: "#17663F" }} title={`Since ${new Date(v.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}>
                  <span className="sos-live-dot" style={{ width: 6, height: 6 }} /> {v.name.split(" ")[0]} · {v.activity.toLowerCase()} now
                </span>
              ))}
              {isOwner && project.portal_visible && project.status !== "lost" && client && !client.contacts.some((ct) => ct.is_portal_user) && (
                <button type="button" onClick={() => setRoute("clients")} className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-semibold" style={{ background: "#FFF3E0", color: "#9A4A00" }} title="Create a portal login for this client in Clients">
                  No portal login yet →
                </button>
              )}
            </div>

            {/* Key facts */}
            <dl className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
              {[
                ["Planned delivery", project.promised_date ? format(parseISO(project.promised_date), "d MMM yyyy") : "Not set"],
                ["Hard deadline", project.hard_deadline ? format(parseISO(project.hard_deadline), "d MMM yyyy") : "—"],
                ...(isOwner ? [["Fee", feeDisplay]] : []),
                ["Updated", format(parseISO(project.updated_at), "d MMM")],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{k}</dt>
                  <dd className="text-[14px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Team + actions */}
          <div className="flex flex-wrap items-center gap-3 xl:justify-end shrink-0">
            <div className="flex items-center gap-2 pr-1">
              <MemberStack memberIds={[project.owner_member_id, ...projectTeamIds, ...tasks.filter((t) => t.project_id === project.id && t.status !== "done").map((t) => t.assignee_member_id)]} size={32} />
            </div>
            <button
              type="button"
              onClick={() => (isOwner ? setAssignOpen(true) : pushToast("Only the studio owner can change the project team", "info"))}
              className="sos-jelly sos-jelly-ghost inline-flex items-center gap-2 h-11 px-5 text-[13px]"
            >
              <UserPlus className="w-4 h-4" /> Team
            </button>
            {isOwner &&
              (isClosed ? (
                <button type="button" onClick={reopenProject} className="sos-jelly sos-jelly-ink inline-flex items-center gap-2 h-11 px-5 text-[13px]">
                  <RotateCcw className="w-4 h-4" /> Reopen
                </button>
              ) : (
                <button type="button" onClick={closeProject} className="sos-jelly sos-jelly-green inline-flex items-center gap-2 h-11 px-5 text-[13px]">
                  <CheckCircle2 className="w-4 h-4" /> Complete & close
                </button>
              ))}
          </div>
        </div>

        {/* Project Tabs */}
        <div className="relative z-[1] mt-6">
          <div className="sos-tabbar" role="tablist">
            {(
              [
                { id: "approvals", label: "Milestones" },
                { id: "changes", label: "Client changes", badge: tasks.filter((t) => t.project_id === project.id && t.source === "portal" && t.status !== "done" && !t.archived_at).length },
                { id: "overview", label: "Overview" },
                { id: "list", label: `Tasks (${projectTasks.filter((t) => t.status !== "done").length})` },
                { id: "board", label: "Board" },
                { id: "deliverables", label: "Files & versions" },
                { id: "emails", label: "Emails" },
                ...(isOwner ? ([{ id: "money", label: "Money" }] as const) : []),
              ] as Array<{ id: typeof tab; label: string; badge?: number }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="relative shrink-0 px-4 h-10 rounded-full text-[13px] font-semibold transition-colors duration-200 inline-flex items-center gap-1.5"
                style={{ color: tab === t.id ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
              >
                {tab === t.id && <ActivePill layoutId="sos-project-tab" style={{ background: "var(--sos-ink)", boxShadow: "0 6px 18px -8px rgba(15,17,21,0.6)" }} />}
                <span className="relative z-[1]">{t.label}</span>
                {t.badge ? (
                  <span className="relative z-[1] min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white sos-pulse-badge" style={{ background: "#E11D48" }}>{t.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
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
                          <GateStatusSelect status={g.status} needsApproval={g.needs_client_approval} onChange={(st) => handleGateStatusChange(g.id, st)} />
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

                      <StageHistoryButton project={project} gate={g} />
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

          {tab === "changes" && (
            <ClientChangesTab
              project={project}
              gates={projectGates}
              tasks={projectTasks}
              onStatus={handleGateStatusChange}
              onTask={(id, st) => updateTask(id, { status: st, ...(st === "done" ? { completed_at: new Date().toISOString(), is_in_now: false } : { completed_at: undefined }) })}
              onSend={(gid) => setSendGateId(gid)}
            />
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
