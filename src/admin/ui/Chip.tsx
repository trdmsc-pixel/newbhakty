import React from "react";

export type StatusPillType =
  | "new"
  | "replied"
  | "archived"
  | "draft"
  | "live"
  | "warning"
  | "danger"
  | "inverse"
  | "onInverse";

export interface ChipProps {
  status?: StatusPillType;
  label?: string;
  dot?: boolean;
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  status = "draft",
  label,
  dot = false,
  selected = false,
  className = "",
  children,
}) => {
  const content = children || label;

  if (selected) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 h-[2.25rem] px-3.5 rounded-full text-[13px] font-sans font-semibold bg-white/20 text-white border border-white/30 shrink-0 ${className}`}
      >
        {dot && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
        <span>{content}</span>
      </span>
    );
  }

  const statusClasses = {
    new: "bg-[var(--a-accent-soft)] text-[var(--a-accent)] border border-[var(--a-accent)]/30",
    replied: "bg-[var(--a-ok-bg)] text-[var(--a-ok-text)] border border-emerald-500/30",
    archived: "bg-[var(--a-surface-2)] text-[var(--a-text-3)] border border-[var(--a-line)]",
    draft: "bg-[var(--a-info-bg)] text-[var(--a-info-text)] border border-sky-500/30",
    live: "bg-[var(--a-ok-bg)] text-[var(--a-ok-text)] border border-emerald-500/30",
    warning: "bg-[var(--a-warn-bg)] text-[var(--a-warn-text)] border border-amber-500/30",
    danger: "bg-[var(--a-danger-bg)] text-[var(--a-danger-text)] border border-red-500/30",
    inverse: "bg-[var(--a-inverse)] text-[var(--a-inverse-text)] border border-transparent shadow-sm",
    // Chips sitting directly on an inverse (dark-in-light-mode) panel
    onInverse: "bg-[color:var(--a-inverse-line)] text-[var(--a-inverse-text)] border border-[color:var(--a-inverse-line)]",
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[2.25rem] px-3.5 rounded-full text-[13px] font-sans font-semibold shrink-0 select-none max-w-full min-w-0 ${statusClasses} ${className}`}
      title={typeof content === "string" ? content : undefined}
    >
      {dot && (
        <span
          className={`w-2 h-2 rounded-full ${
            status === "live" || status === "replied"
              ? "bg-emerald-400 animate-pulse"
              : status === "new"
              ? "bg-[var(--a-yellow-card)] animate-pulse"
              : "bg-current"
          }`}
        />
      )}
      <span className="truncate">{content}</span>
    </span>
  );
};
