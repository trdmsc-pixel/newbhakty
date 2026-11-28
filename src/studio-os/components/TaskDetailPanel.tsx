/**
 * Task detail: description, subtasks (child tasks), dependencies ("blocked by"),
 * client to-do + portal visibility. Opens from a task title in the Tasks list.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Link2, Lock, Plus, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import type { StudioTask } from "../types";

/** A task is blocked while any task it depends on is not done. */
export const blockersOf = (t: StudioTask, all: StudioTask[]) => (t.depends_on || []).map((id) => all.find((x) => x.id === id)).filter((x): x is StudioTask => Boolean(x && x.status !== "done"));

export const TaskDetailPanel: React.FC<{ taskId: string | null; onClose: () => void }> = ({ taskId, onClose }) => {
  const { tasks, projects, updateTask, addTask, pushToast } = useStudioOS();
  const task = tasks.find((t) => t.id === taskId) || null;
  const [sub, setSub] = useState("");
  const [desc, setDesc] = useState("");
  const [depQuery, setDepQuery] = useState("");
  useEffect(() => setDesc(task?.description || ""), [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!taskId) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [taskId, onClose]);
  const subtasks = useMemo(() => (task ? tasks.filter((t) => t.parent_task_id === task.id) : []), [tasks, task]);
  const deps = useMemo(() => (task ? (task.depends_on || []).map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as StudioTask[] : []), [tasks, task]);
  const candidates = useMemo(() => {
    if (!task) return [];
    const q = depQuery.trim().toLowerCase();
    return tasks
      .filter((t) => t.id !== task.id && t.parent_task_id !== task.id && !(task.depends_on || []).includes(t.id) && !(t.depends_on || []).includes(task.id) && t.status !== "done")
      .filter((t) => (q ? `${t.key} ${t.title}`.toLowerCase().includes(q) : t.project_id === task.project_id))
      .slice(0, 8);
  }, [tasks, task, depQuery]);
  if (!task) return null;
  const proj = projects.find((p) => p.id === task.project_id);
  const blockers = blockersOf(task, tasks);
  const addSub = () => {
    if (!sub.trim()) return;
    const t = addTask({ title: sub.trim(), project_id: task.project_id, gate_id: task.gate_id, type: "task", status: "todo", priority: task.priority, estimate_hours: 1, is_in_now: false } as any);
    updateTask(t.id, { parent_task_id: task.id, portal_visible: task.portal_visible, responsibility: task.responsibility });
    setSub("");
  };
  const done = subtasks.filter((s) => s.status === "done").length;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80] bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 inset-y-0 w-full sm:w-[520px] overflow-y-auto overscroll-contain p-5 space-y-5 shadow-2xl"
          style={{ background: "var(--sos-surface)" }}
          role="dialog"
          aria-label={`Task ${task.key}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-3)" }}>{proj?.emoji} {task.key} · {proj?.title}</p>
              <input defaultValue={task.title} onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(task.id, { title: e.target.value.trim() })} className="w-full mt-1 text-[20px] font-semibold bg-transparent outline-none" style={{ color: "var(--sos-text-1)" }} aria-label="Title" />
            </div>
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>

          {blockers.length > 0 && (
            <p className="text-[13px] px-3 py-2 rounded-[12px] inline-flex items-center gap-2" style={{ background: "#FDECEC", color: "#B42318" }}>
              <Lock className="w-4 h-4" /> Blocked by {blockers.map((b) => b.key).join(", ")}
            </p>
          )}

          <textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (task.description || "") && updateTask(task.id, { description: desc || undefined })} placeholder="Description" className="w-full px-3 py-2.5 rounded-[14px] border text-[14px] bg-transparent outline-none" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Subtasks {subtasks.length > 0 && <span style={{ color: "var(--sos-text-3)" }}>· {done}/{subtasks.length}</span>}</h3>
            </div>
            {subtasks.length > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(done / subtasks.length) * 100}%`, background: "var(--sos-green)" }} />
              </div>
            )}
            {subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 p-2.5 rounded-[12px]" style={{ background: "var(--sos-surface-2)" }}>
                <button type="button" onClick={() => updateTask(s.id, s.status === "done" ? { status: "todo", completed_at: undefined } : { status: "done", completed_at: new Date().toISOString(), is_in_now: false })} className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={s.status === "done" ? { background: "var(--sos-green)", color: "#fff" } : { border: "1.5px solid var(--sos-border)" }} aria-label={s.status === "done" ? "Mark not done" : "Mark done"}>
                  {s.status === "done" && <Check className="w-3 h-3" />}
                </button>
                <span className="flex-1 min-w-0 text-[13px] truncate" style={{ color: "var(--sos-text-1)", textDecoration: s.status === "done" ? "line-through" : undefined }}>{s.title}</span>
                <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{s.key}</span>
                <button type="button" onClick={() => updateTask(s.id, { parent_task_id: undefined })} className="shrink-0" style={{ color: "var(--sos-text-3)" }} aria-label="Detach subtask" title="Make it a normal task"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSub()} placeholder="Add a subtask…" className="flex-1 h-10 px-3 rounded-[12px] border text-[13px] bg-transparent outline-none" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />
              <button type="button" onClick={addSub} className="sos-jelly w-10 h-10 inline-flex items-center justify-center" aria-label="Add subtask"><Plus className="w-4 h-4" /></button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Depends on</h3>
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>This task stays blocked until these are done.</p>
            {deps.map((d) => (
              <div key={d.id} className="flex items-center gap-2.5 p-2.5 rounded-[12px]" style={{ background: "var(--sos-surface-2)" }}>
                <Link2 className="w-4 h-4 shrink-0" style={{ color: d.status === "done" ? "var(--sos-green)" : "#B42318" }} />
                <span className="flex-1 min-w-0 text-[13px] truncate" style={{ color: "var(--sos-text-1)" }}>{d.key} · {d.title}</span>
                <span className="text-[11px] font-semibold" style={{ color: d.status === "done" ? "var(--sos-green)" : "#B42318" }}>{d.status === "done" ? "done" : "open"}</span>
                <button type="button" onClick={() => updateTask(task.id, { depends_on: (task.depends_on || []).filter((x) => x !== d.id) })} style={{ color: "var(--sos-text-3)" }} aria-label="Remove dependency"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <input value={depQuery} onChange={(e) => setDepQuery(e.target.value)} placeholder="Search tasks to add as a dependency…" className="w-full h-10 px-3 rounded-[12px] border text-[13px] bg-transparent outline-none" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c) => (
                <button key={c.id} type="button" onClick={() => { updateTask(task.id, { depends_on: [...(task.depends_on || []), c.id] }); setDepQuery(""); pushToast(`${task.key} now waits for ${c.key}`, "info"); }} className="h-8 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1 max-w-full" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
                  <Plus className="w-3 h-3 shrink-0" /> <span className="truncate">{c.key} · {c.title}</span>
                </button>
              ))}
            </div>
          </section>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
};
