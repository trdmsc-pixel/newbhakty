import React from "react";
import { Check, Clock, Hourglass, Pause } from "lucide-react";
import { GateStatus, ProjectHealth, TaskPriority, TaskStatus } from "../types";

const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; bg: string; text: string; dot?: string; icon?: "hourglass" | "check" }
> = {
  backlog: { label: "Backlog", bg: "#F1F2F4", text: "#5F6672", dot: "#9AA0AA" },
  todo: { label: "To do", bg: "#E8F0FF", text: "#1D4FD8", dot: "#1D4FD8" },
  in_progress: { label: "In progress", bg: "#E7F7EE", text: "#17663F", dot: "#17663F" },
  waiting_on_client: {
    label: "Waiting on client",
    bg: "#FFF3E0",
    text: "#9A4A00",
    icon: "hourglass",
  },
  in_review: { label: "In review", bg: "#EEEBFD", text: "#5B3FE4", dot: "#5B3FE4" },
  revising: { label: "Revising", bg: "#FFF1E6", text: "#C2410C", dot: "#C2410C" },
  done: { label: "Done", bg: "#E7F7EE", text: "#17663F", icon: "check" },
};

export const TaskStatusChip: React.FC<{
  status: TaskStatus;
  compact?: boolean;
  onClick?: () => void;
}> = ({ status, compact, onClick }) => {
  const m = TASK_STATUS_META[status] || TASK_STATUS_META.todo;
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{ backgroundColor: m.bg, color: m.text }}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-[12px]"
      } ${onClick ? "cursor-pointer hover:opacity-85 transition-opacity" : ""}`}
    >
      {m.icon === "hourglass" ? (
        <Hourglass className="w-3 h-3 shrink-0" strokeWidth={2} />
      ) : m.icon === "check" ? (
        <Check className="w-3 h-3 shrink-0" strokeWidth={2.25} />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.dot }} />
      )}
      {m.label}
    </Comp>
  );
};

const GATE_STATUS_META: Record<
  GateStatus,
  { label: string; bg: string; text: string; icon?: "hourglass" | "check" | "pause" }
> = {
  not_started: { label: "Not Started", bg: "#F1F2F4", text: "#5F6672" },
  in_work: { label: "In Work", bg: "#E8F0FF", text: "#1D4FD8" },
  waiting_on_client: { label: "Waiting on Client", bg: "#FFF3E0", text: "#9A4A00", icon: "hourglass" },
  approved: { label: "Approved", bg: "#E7F7EE", text: "#17663F", icon: "check" },
  revising: { label: "Revising", bg: "#FFF1E6", text: "#C2410C" },
  skipped: { label: "Skipped", bg: "#E9F2FF", text: "#1D4FD8", icon: "pause" },
};

export const GateStatusChip: React.FC<{ status: GateStatus }> = ({ status }) => {
  const m = GATE_STATUS_META[status] || GATE_STATUS_META.not_started;
  return (
    <span
      style={{ backgroundColor: m.bg, color: m.text }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap"
    >
      {m.icon === "hourglass" ? (
        <Hourglass className="w-3 h-3" strokeWidth={2} />
      ) : m.icon === "check" ? (
        <Check className="w-3 h-3" strokeWidth={2.25} />
      ) : m.icon === "pause" ? (
        <Pause className="w-3 h-3" strokeWidth={2} />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.text }} />
      )}
      {m.label}
    </span>
  );
};

const HEALTH_META: Record<ProjectHealth, { label: string; bg: string; text: string; dot: string }> = {
  on_track: { label: "On Track", bg: "#E7F7EE", text: "#17663F", dot: "#17663F" },
  tight: { label: "Tight", bg: "#E8F0FF", text: "#1D4FD8", dot: "#1D4FD8" },
  at_risk: { label: "At Risk", bg: "#FFF3E0", text: "#9A4A00", dot: "#F59E0B" },
  late: { label: "Late", bg: "#FDECEC", text: "#B42318", dot: "#B42318" },
};

export const HealthPill: React.FC<{ health: ProjectHealth }> = ({ health }) => {
  const m = HEALTH_META[health] || HEALTH_META.on_track;
  return (
    <span
      style={{ backgroundColor: m.bg, color: m.text }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap"
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.dot }} />
      {m.label}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const color =
    priority === "urgent"
      ? "#C2410C"
      : priority === "high"
      ? "#F59E0B"
      : priority === "normal"
      ? "#1D4FD8"
      : "#9AA0AA";
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color }}>
      <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
      {label}
    </span>
  );
};

export const StackedAvatars: React.FC<{
  items: Array<{ initials: string; color: string; name?: string }>;
  size?: number;
}> = ({ items, size = 32 }) => {
  const visible = items.slice(0, 3);
  const overflow = items.length - visible.length;
  return (
    <div className="flex items-center">
      {visible.map((item, idx) => (
        <div
          key={`${item.initials}-${idx}`}
          title={item.name}
          style={{
            width: size,
            height: size,
            backgroundColor: item.color,
            marginLeft: idx === 0 ? 0 : -10,
            borderColor: "var(--sos-surface)",
          }}
          className="rounded-full border-2 flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
        >
          {item.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: size,
            height: size,
            marginLeft: -10,
            backgroundColor: "var(--sos-surface-2)",
            color: "var(--sos-text-2)",
            borderColor: "var(--sos-surface)",
          }}
          className="rounded-full border-2 flex items-center justify-center text-[11px] font-semibold shrink-0"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
