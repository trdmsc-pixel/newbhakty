import React, { useMemo, useState } from "react";
import { GmailScanButton } from "../components/GmailScanButton";
import { ViewSwitcher } from "../components/ViewSwitcher";
import { TaskStatusSelect } from "../components/TaskStatusSelect";
import { ActivePill, SwipeRow } from "../motion";
import { format, parseISO } from "date-fns";
import { Check, Clock, Eye, EyeOff, Plus, Search, Trash2, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { PriorityBadge, TaskStatusChip } from "../components/StatusChip";
import { AssigneePicker } from "../components/Team";
import { TaskStatus } from "../types";

const STATUS_CYCLE: TaskStatus[] = ["backlog", "todo", "in_progress", "waiting_on_client", "in_review", "done"];

export const TableScreen: React.FC<{ projectFilterId?: string }> = ({ projectFilterId }) => {
  const { tasks, projects, gates, clients, updateTask, deleteTasks, setQuickAddOpen, openProject, setRoute, pushToast } = useStudioOS();
  const [tab, setTab] = useState<"all" | "done" | "backlog">("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilterId && t.project_id !== projectFilterId) return false;
      if (tab === "done" && t.status !== "done") return false;
      if (tab === "backlog" && t.status !== "backlog") return false;
      if (tab === "all" && t.status === "done") return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, projectFilterId, tab, query]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((t) => t.id));
  };

  const setStatus = (id: string, next: TaskStatus) => {
    const task = tasks.find((x) => x.id === id);
    if (!task) return;
    const patch: Partial<typeof task> = { status: next };
    if (next === "done") patch.is_in_now = false;
    if (next === "waiting_on_client" && !task.waiting_on_name) {
      const proj = projects.find((p) => p.id === task.project_id);
      const client = clients.find((c) => c.id === proj?.client_id);
      patch.waiting_on_name = client?.contacts[0]?.name || client?.name || "Client";
    }
    updateTask(id, patch);
  };

  const handleBulkMoveDone = () => {
    selectedIds.forEach((id) => updateTask(id, { status: "done", is_in_now: false }));
    pushToast(`Marked ${selectedIds.length} tasks done`, "success");
    setSelectedIds([]);
  };

  const handleBulkSnooze = () => {
    selectedIds.forEach((id) => updateTask(id, { status: "backlog", is_in_now: false }));
    pushToast(`Moved ${selectedIds.length} tasks to Backlog`, "info");
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    deleteTasks(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5 pb-20">
      {!projectFilterId && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
              Tasks
            </h1>
            <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
              Pick a status from each row's menu, or select rows for bulk actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher area="tasks" />
            <GmailScanButton target="tasks" />
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white"
              style={{ background: "var(--sos-primary)" }}
            >
              <Plus className="w-4 h-4" /> Quick Add
            </button>
          </div>
        </div>
      )}

      {/* Segmented Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
          {(["all", "done", "backlog"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative px-4 py-1.5 min-h-[36px] rounded-full text-[13px] font-semibold capitalize transition-colors duration-200"
              style={{
                color: tab === t ? "var(--sos-text-1)" : "var(--sos-text-2)",
              }}
              aria-pressed={tab === t}
            >
              {tab === t && <ActivePill layoutId="sos-table-tab" style={{ background: "var(--sos-surface)", boxShadow: "0 1px 2px rgba(16,24,40,0.08)" }} />}
              <span className="relative z-[1]">{t}</span>
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-2 px-3.5 h-10 rounded-full border w-full sm:w-64"
          style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--sos-text-3)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search key or title..."
            className="w-full bg-transparent outline-none text-[13px]"
            style={{ color: "var(--sos-text-1)" }}
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block sos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                className="text-[12px] font-semibold border-b"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              >
                <th className="py-3.5 pl-5 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-[#5B3FE4] rounded"
                  />
                </th>
                <th className="py-3.5 px-3">Key</th>
                <th className="py-3.5 px-3">Name</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Assignee</th>
                <th className="py-3.5 px-3">Due</th>
                <th className="py-3.5 px-3" title="Show this task and its due date in the client portal">Client</th>
                <th className="py-3.5 px-3">Priority</th>
                <th className="py-3.5 px-3">Project / Gate</th>
                <th className="py-3.5 pr-5 pl-3 text-right">Est.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const proj = projects.find((p) => p.id === task.project_id);
                const gate = gates.find((g) => g.id === task.gate_id);
                const checked = selectedIds.includes(task.id);
                return (
                  <tr
                    key={task.id}
                    className="border-b last:border-b-0 transition-colors hover:bg-black/[0.015]"
                    style={{ borderColor: "var(--sos-border)" }}
                  >
                    <td className="py-3.5 pl-5 pr-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(task.id)}
                        className="w-4 h-4 accent-[#5B3FE4] rounded"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-[12px] font-semibold sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                      {task.key}
                    </td>
                    <td className="py-3.5 px-3 max-w-md">
                      <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>
                        {task.title}
                      </p>
                    </td>
                    <td className="py-3.5 px-3">
                      <TaskStatusSelect status={task.status} onChange={(next) => setStatus(task.id, next)} />
                    </td>
                    <td className="py-3.5 px-3">
                      <AssigneePicker value={task.assignee_member_id} onChange={(id) => updateTask(task.id, { assignee_member_id: id })} size={28} />
                    </td>
                    <td className="py-3.5 px-3 text-[13px] sos-tabular whitespace-nowrap" style={{ color: "var(--sos-text-2)" }}>
                      <input
                        type="date"
                        value={task.due_date ? task.due_date.slice(0, 10) : ""}
                        onChange={(e) => updateTask(task.id, { due_date: e.target.value || undefined, do_date: e.target.value || undefined })}
                        className="h-8 px-2 rounded-[10px] border text-[12px] sos-tabular bg-transparent"
                        style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                        aria-label={`Due date for ${task.key}`}
                      />
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { portal_visible: !task.portal_visible })}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={task.portal_visible ? { background: "var(--sos-violet-soft)", color: "var(--sos-primary)" } : { color: "var(--sos-text-3)" }}
                        title={task.portal_visible ? "Visible to the client (title, status, due date) — click to hide" : "Hidden from the client — click to show in the portal"}
                        aria-pressed={task.portal_visible}
                      >
                        {task.portal_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-3.5 px-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() => proj && openProject(proj.id)}
                        className="text-[12px] font-medium hover:underline"
                        style={{ color: "var(--sos-text-2)" }}
                      >
                        {proj?.emoji} {proj?.code}
                        {gate ? ` · ${gate.code}` : ""}
                      </button>
                    </td>
                    <td className="py-3.5 pr-5 pl-3 text-right text-[13px] sos-tabular" style={{ color: "var(--sos-text-2)" }}>
                      {task.estimate_hours}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {filtered.map((task) => {
          const proj = projects.find((p) => p.id === task.project_id);
          return (
            <SwipeRow
              key={task.id}
              onDone={() => updateTask(task.id, { status: "done", is_in_now: false })}
              onSnooze={() => {
                updateTask(task.id, { status: "backlog", is_in_now: false });
                pushToast(`Snoozed ${task.key} to Backlog`, "info");
              }}
              className="sos-card p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "var(--sos-text-3)" }}>
                  {proj?.emoji} {task.key}
                </span>
                <TaskStatusSelect status={task.status} compact onChange={(next) => setStatus(task.id, next)} />
              </div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                {task.title}
              </p>
              <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                <PriorityBadge priority={task.priority} />
                <span className="flex items-center gap-1.5">
                  <button type="button" onClick={() => updateTask(task.id, { portal_visible: !task.portal_visible })} className="w-7 h-7 rounded-full flex items-center justify-center" style={task.portal_visible ? { background: "var(--sos-violet-soft)", color: "var(--sos-primary)" } : { color: "var(--sos-text-3)" }} aria-label={task.portal_visible ? "Hide from client" : "Show to client"}>
                    {task.portal_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="date"
                    value={task.due_date ? task.due_date.slice(0, 10) : ""}
                    onChange={(e) => updateTask(task.id, { due_date: e.target.value || undefined, do_date: e.target.value || undefined })}
                    className="h-8 px-2 rounded-[10px] border text-[13px] sos-tabular bg-transparent"
                    style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                    aria-label={`Due date for ${task.key}`}
                  />
                </span>
              </div>
            </SwipeRow>
          );
        })}
      </div>

      {/* Floating Black Bulk-Action Pill Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl text-[13px] font-medium"
            style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
          >
            <button type="button" onClick={() => setSelectedIds([])} className="inline-flex items-center gap-1.5">
              <X className="w-4 h-4" />
              <span className="sos-tabular font-semibold">{selectedIds.length} selected</span>
            </button>
            <span className="opacity-25">|</span>
            <button type="button" onClick={handleBulkMoveDone} className="inline-flex items-center gap-1.5 hover:opacity-80">
              <Check className="w-4 h-4 text-[#4CC38A]" /> Mark Done
            </button>
            <button type="button" onClick={handleBulkSnooze} className="inline-flex items-center gap-1.5 hover:opacity-80">
              <Clock className="w-4 h-4 text-[#FBBF24]" /> Backlog
            </button>
            <button type="button" onClick={handleBulkDelete} className="inline-flex items-center gap-1.5 hover:opacity-80 text-[#F2555A]">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
