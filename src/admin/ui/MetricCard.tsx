import React from "react";
import { ProgressBar } from "./ProgressBar";
import { AvatarStack, AvatarItem } from "./AvatarStack";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  delta?: {
    text: string;
    positive?: boolean;
  };
  progress?: {
    value: number;
    tone?: "ember-gold" | "crimson-magenta" | "blue-cyan" | "spectrum";
  };
  avatars?: AvatarItem[];
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  delta,
  progress,
  avatars,
  className = "",
}) => {
  return (
    <div
      className={`rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-5 flex flex-col justify-between transition-all duration-150 hover:border-[var(--a-line-strong)] ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-admin-meta text-[var(--a-text-2)] font-medium truncate">
            {label}
          </p>
          {delta && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                delta.positive
                  ? "bg-[var(--a-ok-bg)] text-[var(--a-ok-text)] border border-emerald-500/25"
                  : "bg-[var(--a-danger-bg)] text-[var(--a-danger-text)] border border-red-500/25"
              }`}
            >
              {delta.text}
            </span>
          )}
        </div>
        <div className="text-admin-h1-metric text-[var(--a-text)] tracking-tight mb-4">
          {value}
        </div>
      </div>

      {(progress || avatars) && (
        <div className="space-y-3 pt-2">
          {progress && (
            <ProgressBar value={progress.value} tone={progress.tone || "ember-gold"} />
          )}
          {avatars && avatars.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <AvatarStack items={avatars} />
              <span className="text-admin-meta text-[var(--a-text-3)] font-mono text-[11px]">
                {progress ? `${Math.round(progress.value)}%` : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
