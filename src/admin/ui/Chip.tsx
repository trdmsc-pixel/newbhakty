import React from "react";

export type StatusPillType =
  | "new"
  | "replied"
  | "archived"
  | "draft"
  | "live"
  | "warning"
  | "danger"
  | "inverse";

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
    new: "bg-[#FF6A1F]/15 text-[#FFC93C] border border-[#FF6A1F]/30",
    replied: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    archived: "bg-white/[0.06] text-[#F4EFE6]/55 border border-white/[0.08]",
    draft: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
    live: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    danger: "bg-red-500/15 text-red-300 border border-red-500/30",
    inverse: "bg-white text-[#07080C] border border-black/10 shadow-sm",
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[2.25rem] px-3.5 rounded-full text-[13px] font-sans font-semibold shrink-0 select-none ${statusClasses} ${className}`}
    >
      {dot && (
        <span
          className={`w-2 h-2 rounded-full ${
            status === "live" || status === "replied"
              ? "bg-emerald-400 animate-pulse"
              : status === "new"
              ? "bg-[#FFC93C] animate-pulse"
              : "bg-current"
          }`}
        />
      )}
      <span>{content}</span>
    </span>
  );
};
