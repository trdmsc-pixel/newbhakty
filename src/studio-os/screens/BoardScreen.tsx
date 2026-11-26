import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ActivePill, EASE } from "../motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CheckSquare, Flag, Plus, Search, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { StudioTask, TaskStatus } from "../types";
import { HealthPill, TaskStatusChip } from "../components/StatusChip";
import { AssigneePicker } from "../components/Team";

const BOARD_COLUMNS: Array<{ id: TaskStatus; label: string; badgeBg: string; badgeText: string }> = [
  { id: "backlog", label: "Backlog", badgeBg: "#F1F2F4", badgeText: "#5F6672" },
  { id: "todo", label: "To Do", badgeBg: "#E8F0FF", badgeText: "#1D4FD8" },
  { id: "in_progress", label: "In Progress", badgeBg: "#E7F7EE", badgeText: "#17663F" },
  { id: "waiting_on_client", label: "Waiting on Client", badgeBg: "#FFF3E0", badgeText: "#9A4A00" },
  { id: "in_review", label: "In Review", badgeBg: "#EEEBFD", badgeText: "#5B3FE4" },
  { id: "done", label: "Done", badgeBg: "#E7F7EE", badgeText: "#17663F" },
];

const DraggableTaskCard: React.FC<{
  task: StudioTask;
  projectCode: string;
  projectEmoji: string;
  onOpenProject: () => void;
}> = ({ task, projectCode, projectEmoji, onOpenProject }) => {
  const { updateTask } = useStudioOS();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(2deg)` : undefined,
    opacity: isDragging ? 0.45 : 1,
    boxShadow: isDragging ? "0 18px 40px -16px rgba(16,24,40,0.35)" : undefined,
    background: "var(--sos-surface)",
    borderColor: "var(--sos-border)",
  };

  const today = new Date();
  let dueColor = "#17663F";
  let dueText = "";
  if (task.due_date) {
    const diff = differenceInCalendarDays(parseISO(task.due_date), today);
    dueText = format(parseISO(task.due_date), "d MMM");
    if (diff <= 1) dueColor = "#B42318";
    else if (diff <= 3) dueColor = "#F59E0B";
  }

  const doneCount = task.checklist.filter((c) => c.done).length;

  return (
    <motion.div layout="position" layoutId={`board-card-${task.id}`} transition={{ duration: 0.22, ease: EASE }}>
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-4 rounded-[20px] border shadow-sm cursor-grab active:cursor-grabbing space-y-2.5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <TaskStatusChip status={task.status} compact />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenProject();
          }}
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
        >
          {projectEmoji} {projectCode}
        </button>
      </div>

      <h4 className="text-[15px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>
        {task.title}
      </h4>

      {task.description && (
        <p className="text-[13px] line-clamp-2 leading-relaxed" style={{ color: "var(--sos-text-2)" }}>
          {task.description}
        </p>
      )}

      {task.waiting_on_name && task.status === "waiting_on_client" && (
        <p className="text-[12px] font-medium text-[#9A4A00]">Waiting on {task.waiting_on_name}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--sos-border)" }}>
        <AssigneePicker value={task.assignee_member_id} onChange={(id) => updateTask(task.id, { assignee_member_id: id })} size={26} />
        <div className="flex items-center gap-3 text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
          {task.checklist.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="w-3.5 h-3.5" />
              {doneCount}/{task.checklist.length}
            </span>
          )}
          {dueText && (
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: dueColor }}>
              <Flag className="w-3 h-3" />
              {dueText}
            </span>
          )}
        </div>
      </div>
    </div>
    </motion.div>
  );
};

const DroppableColumn: React.FC<{
  columnId: TaskStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}> = ({ columnId, label, badgeBg, badgeText, count, onAdd, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[290px] w-[290px] md:w-[310px] shrink-0 rounded-[24px] p-3.5 flex flex-col gap-3 transition-colors duration-200 ${isOver ? "sos-drop-active" : ""}`}
      style={{
        background: isOver ? "var(--sos-violet-soft)" : "var(--sos-surface-2)",
        border: isOver ? "1.5px dashed var(--sos-primary)" : "1.5px solid transparent",
      }}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="sos-display text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            {label}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold sos-tabular"
            style={{ background: badgeBg, color: badgeText }}
          >
            {count}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80"
          style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
          aria-label={`Add task to ${label}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3 min-h-[120px]">{children}</div>
    </div>
  );
};

export const BoardScreen: React.FC<{ projectFilterId?: string }> = ({ projectFilterId }) => {
  const { tasks, projects, gates, clients, updateTask, setQuickAddOpen, openProject, setRoute } = useStudioOS();
  const [groupBy, setGroupBy] = useState<"status" | "gate">("status");
  const [localSearch, setLocalSearch] = useState("");
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>("in_progress");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [waitingPrompt, setWaitingPrompt] = useState<{ taskId: string; defaultName: string } | null>(null);
  const [waitingInput, setWaitingInput] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilterId && t.project_id !== projectFilterId) return false;
      if (localSearch.trim()) {
        const q = localSearch.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, projectFilterId, localSearch]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const nextStatus = String(over.id) as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === nextStatus) return;

    if (nextStatus === "waiting_on_client") {
      const proj = projects.find((p) => p.id === task.project_id);
      const client = clients.find((c) => c.id === proj?.client_id);
      const defaultName = client?.contacts[0]?.name || client?.name || "";
      setWaitingInput(defaultName);
      setWaitingPrompt({ taskId, defaultName });
    } else {
      updateTask(taskId, { status: nextStatus });
    }
  };

  const confirmWaiting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitingPrompt) return;
    updateTask(waitingPrompt.taskId, {
      status: "waiting_on_client",
      waiting_on_name: waitingInput.trim() || waitingPrompt.defaultName || "Client",
    });
    setWaitingPrompt(null);
  };

  const activeTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;

  return (
    <div className="space-y-5">
      {/* Header + Segmented View Switcher */}
      {!projectFilterId && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
              Board
            </h1>
            <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
              Drag cards across stages. Dropping into Waiting on Client logs who holds the ball.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
              <button
                type="button"
                className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-blue)" }}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setRoute("timeline")}
                className="px-4 py-1.5 rounded-full text-[13px] font-medium"
                style={{ color: "var(--sos-text-2)" }}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setRoute("table")}
                className="px-4 py-1.5 rounded-full text-[13px] font-medium"
                style={{ color: "var(--sos-text-2)" }}
              >
                Table
              </button>
            </div>

            <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
              <button
                type="button"
                onClick={() => setGroupBy("status")}
                className="relative px-3.5 py-1.5 min-h-[36px] rounded-full text-[12px] font-semibold transition-colors duration-200"
                style={{
                  color: groupBy === "status" ? "var(--sos-text-1)" : "var(--sos-text-2)",
                }}
                aria-pressed={groupBy === "status"}
              >
                {groupBy === "status" && <ActivePill layoutId="sos-board-group" style={{ background: "var(--sos-surface)" }} />}
                <span className="relative z-[1]">By Status</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupBy("gate")}
                className="relative px-3.5 py-1.5 min-h-[36px] rounded-full text-[12px] font-semibold transition-colors duration-200"
                style={{
                  color: groupBy === "gate" ? "var(--sos-text-1)" : "var(--sos-text-2)",
                }}
                aria-pressed={groupBy === "gate"}
              >
                {groupBy === "gate" && <ActivePill layoutId="sos-board-group" style={{ background: "var(--sos-surface)" }} />}
                <span className="relative z-[1]">Projects by Gate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 px-3.5 h-10 rounded-full border w-full max-w-xs"
          style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
          <input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter board tasks..."
            className="w-full bg-transparent outline-none text-[13px]"
            style={{ color: "var(--sos-text-1)" }}
          />
        </div>

        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold text-white shrink-0"
          style={{ background: "var(--sos-green)" }}
        >
          <Plus className="w-4 h-4" /> Add Task
        </button>
      </div>

      {/* Group by Gate: Project Poster Board */}
      {groupBy === "gate" && !projectFilterId ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9"].map((gateCode) => {
            const matchingProjects = projects.filter((p) => {
              const pGates = gates.filter((g) => g.project_id === p.id);
              const current = pGates.find((g) => g.status !== "approved" && g.status !== "skipped");
              return current?.code === gateCode;
            });
            return (
              <div
                key={gateCode}
                className="min-w-[260px] w-[260px] shrink-0 rounded-[24px] p-3.5 space-y-3"
                style={{ background: "var(--sos-surface-2)" }}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="sos-display text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    {gateCode}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold sos-tabular"
                    style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                  >
                    {matchingProjects.length}
                  </span>
                </div>
                {matchingProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p.id)}
                    className="w-full text-left p-4 rounded-[20px] border space-y-2 hover:shadow-md transition-shadow"
                    style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold" style={{ color: "var(--sos-text-2)" }}>
                        {p.emoji} {p.code}
                      </span>
                      <HealthPill health={p.health} />
                    </div>
                    <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>
                      {p.title}
                    </p>
                    {p.forecast_date && (
                      <p className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                        Forecast: {format(parseISO(p.forecast_date), "d MMM yyyy")}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Mobile column switcher chips */}
          <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1">
            {BOARD_COLUMNS.map((col) => {
              const active = mobileColumn === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setMobileColumn(col.id)}
                  className="px-3.5 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap shrink-0"
                  style={{
                    background: active ? "var(--sos-ink)" : "var(--sos-surface-2)",
                    color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)",
                  }}
                >
                  {col.label}
                </button>
              );
            })}
          </div>

          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {BOARD_COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) =>
                  col.id === "in_review"
                    ? t.status === "in_review" || t.status === "revising"
                    : t.status === col.id
                );
                return (
                  <div key={col.id} className={mobileColumn === col.id ? "block" : "hidden md:block"}>
                    <DroppableColumn
                      columnId={col.id}
                      label={col.label}
                      badgeBg={col.badgeBg}
                      badgeText={col.badgeText}
                      count={colTasks.length}
                      onAdd={() => setQuickAddOpen(true)}
                    >
                      {colTasks.map((t) => {
                        const proj = projects.find((p) => p.id === t.project_id);
                        return (
                          <DraggableTaskCard
                            key={t.id}
                            task={t}
                            projectCode={proj?.code || "INT"}
                            projectEmoji={proj?.emoji || "🎬"}
                            onOpenProject={() => proj && openProject(proj.id)}
                          />
                        );
                      })}
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div
                  className="p-4 rounded-[20px] border shadow-2xl w-[280px] rotate-2"
                  style={{ background: "var(--sos-surface)", borderColor: "var(--sos-primary)" }}
                >
                  <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    {activeTask.title}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* Waiting on Client Prompt Modal */}
      {waitingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={confirmWaiting}
            className="w-full max-w-sm rounded-[24px] p-5 border shadow-2xl space-y-4"
            style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Who are we waiting on?
              </h3>
              <button type="button" onClick={() => setWaitingPrompt(null)}>
                <X className="w-4 h-4" style={{ color: "var(--sos-text-3)" }} />
              </button>
            </div>
            <input
              autoFocus
              value={waitingInput}
              onChange={(e) => setWaitingInput(e.target.value)}
              placeholder="Client contact name..."
              className="w-full h-11 px-3.5 rounded-[14px] border text-[14px]"
              style={{
                background: "var(--sos-surface-2)",
                borderColor: "var(--sos-border)",
                color: "var(--sos-text-1)",
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setWaitingPrompt(null)}
                className="sos-pill-btn px-4 h-10 text-[13px] border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="sos-pill-btn px-5 h-10 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-primary)" }}
              >
                Move to Waiting
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
