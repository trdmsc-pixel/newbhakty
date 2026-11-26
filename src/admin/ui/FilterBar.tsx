import React from "react";
import { Search } from "lucide-react";

export interface FilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  activeCount?: number;
  onClearFilters?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = "Search by keyword...",
  activeCount = 0,
  onClearFilters,
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-2 rounded-full bg-[var(--a-surface-1)] border border-[var(--a-line)] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 px-3 py-1 shrink-0">
          <span className="text-admin-label text-[var(--a-text-2)] font-semibold select-none">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[var(--a-accent-soft)] text-[var(--a-accent)] border border-[var(--a-accent)]/30">
              {activeCount}
            </span>
          )}
        </div>

        {children}

        {activeCount > 0 && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-admin-meta text-[var(--a-accent)] hover:text-[var(--a-accent)] underline cursor-pointer px-2 select-none"
          >
            Clear all
          </button>
        )}
      </div>

      {onSearchChange && (
        <div className="relative w-full sm:w-64 md:w-80 shrink-0">
          <Search className="w-4 h-4 text-[var(--a-text-3)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-[2.75rem] rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] pl-10 pr-4 text-admin-body text-sm text-[var(--a-text)] placeholder:text-[var(--a-text)]/35 focus:outline-none focus:border-[var(--a-blue)]"
          />
        </div>
      )}
    </div>
  );
};
