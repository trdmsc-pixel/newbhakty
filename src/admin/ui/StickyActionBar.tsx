import React from "react";

export interface StickyActionSummary {
  label: string;
  value: React.ReactNode;
}

export interface StickyActionBarProps {
  summaries?: StickyActionSummary[];
  actions?: React.ReactNode;
  floating?: boolean;
  className?: string;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  summaries,
  actions,
  floating = false,
  className = "",
}) => {
  return (
    <div
      className={`${
        floating
          ? "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1200px]"
          : "w-full"
      } ${className}`}
    >
      <div className="rounded-[24px] bg-[var(--a-surface-2)] border border-[var(--a-line-strong)] p-4 sm:px-6 sm:py-4 shadow-admin-floating flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-xl">
        {summaries && summaries.length > 0 ? (
          <div className="flex items-center gap-6 divide-x divide-[var(--a-line)] overflow-x-auto scrollbar-none py-1">
            {summaries.map((item, idx) => (
              <div key={idx} className={`${idx > 0 ? "pl-6" : ""} shrink-0 min-w-0`}>
                <p className="text-admin-meta text-[var(--a-text-3)] font-medium truncate">
                  {item.label}
                </p>
                <div className="text-admin-h3 text-[var(--a-text)] font-semibold truncate mt-0.5">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div />
        )}

        {actions && (
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
