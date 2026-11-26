import React from "react";
import { ArrowUpRight } from "lucide-react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  hover = false,
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-5 relative transition-all duration-150 ${
        hover ? "hover:border-[var(--a-line-strong)] hover:-translate-y-[2px]" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface SubTileProps {
  label: string;
  value: React.ReactNode;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  className?: string;
}

export const SubTile: React.FC<SubTileProps> = ({
  label,
  value,
  onAction,
  actionIcon = <ArrowUpRight className="w-4 h-4 text-[var(--a-text)]" />,
  actionLabel = "Open action",
  className = "",
}) => {
  return (
    <div
      className={`rounded-[1rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-4 sm:p-5 flex items-start justify-between gap-3 relative group transition-all duration-150 hover:border-[var(--a-line-strong)] ${className}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-admin-meta text-[var(--a-text-2)] font-medium mb-1 truncate">
          {label}
        </p>
        <div className="text-admin-h3 text-[var(--a-text)] font-semibold tracking-tight truncate">
          {value}
        </div>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionLabel}
          className="w-[2.25rem] h-[2.25rem] rounded-full bg-[var(--a-surface-2)] hover:bg-[var(--a-surface-3)] border border-[var(--a-line)] flex items-center justify-center shrink-0 transition-all cursor-pointer group-hover:scale-105"
        >
          {actionIcon}
        </button>
      )}
    </div>
  );
};
