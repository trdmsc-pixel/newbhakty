import React from "react";
import { motion } from "motion/react";
import { Chip, StatusPillType } from "./Chip";

export interface ListRowProps {
  id: string;
  avatar?: React.ReactNode;
  primary: string;
  secondary?: string;
  badge?: {
    status?: StatusPillType;
    label: string;
  };
  value?: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  id,
  avatar,
  primary,
  secondary,
  badge,
  value,
  isSelected = false,
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-[4.5rem] px-5 rounded-full flex items-center justify-between gap-4 text-left transition-all duration-150 cursor-pointer select-none relative ${
        isSelected
          ? "bg-[var(--a-surface-2)] text-[var(--a-text)] shadow-md border border-black/20"
          : "bg-transparent text-[var(--a-inverse-text)] hover:bg-black/[0.04] border border-transparent"
      } ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {avatar && (
          <div className="w-[2.75rem] h-[2.75rem] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-black/10">
            {avatar}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-admin-body-lg font-semibold truncate ${
              isSelected ? "text-[var(--a-text)]" : "text-[var(--a-inverse-text)]"
            }`}
          >
            {primary}
          </p>
          {secondary && (
            <p
              className={`text-admin-meta truncate mt-0.5 ${
                isSelected ? "text-[var(--a-text-2)]" : "text-[var(--a-inverse-text)]/55"
              }`}
            >
              {secondary}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {badge && (
          <Chip
            status={isSelected ? "inverse" : badge.status || "draft"}
            label={badge.label}
          />
        )}
        {value && (
          <span
            className={`text-admin-label font-mono font-semibold ${
              isSelected ? "text-[var(--a-accent)]" : "text-[var(--a-inverse-text)]/85"
            }`}
          >
            {value}
          </span>
        )}
      </div>
    </button>
  );
};
