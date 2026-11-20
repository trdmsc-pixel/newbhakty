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
      className={`flex flex-wrap items-center justify-between gap-3 p-2 rounded-full bg-[#11131A] border border-white/[0.08] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 px-3 py-1 shrink-0">
          <span className="text-admin-label text-[#F4EFE6]/60 font-semibold select-none">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FF6A1F]/15 text-[#FFC93C] border border-[#FF6A1F]/30">
              {activeCount}
            </span>
          )}
        </div>

        {children}

        {activeCount > 0 && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-admin-meta text-[#FF6A1F] hover:text-[#FFC93C] underline cursor-pointer px-2 select-none"
          >
            Clear all
          </button>
        )}
      </div>

      {onSearchChange && (
        <div className="relative w-full sm:w-64 md:w-80 shrink-0">
          <Search className="w-4 h-4 text-[#F4EFE6]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-[2.75rem] rounded-full bg-[#181B24] border border-white/[0.08] pl-10 pr-4 text-admin-body text-sm text-[#F4EFE6] placeholder:text-[#F4EFE6]/35 focus:outline-none focus:border-[#FF6A1F]"
          />
        </div>
      )}
    </div>
  );
};
