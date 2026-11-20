import React from "react";
import { motion } from "motion/react";
import { pillSpring } from "./motion";

export interface SelectableCardItem {
  id: string;
  caption: string;
  title: string;
  count?: number | string;
  badge?: string;
}

export interface SelectableCardGroupProps {
  items: SelectableCardItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const SelectableCardGroup: React.FC<SelectableCardGroupProps> = ({
  items,
  selectedId,
  onSelect,
  className = "",
}) => {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 items-end ${className}`}>
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`w-full text-left rounded-[1.25rem] p-4 sm:p-5 transition-all duration-200 cursor-pointer select-none relative ${
              isSelected
                ? "bg-gradient-to-br from-[#FF6A1F] to-[#E8332A] text-white shadow-[0_16px_36px_rgba(255,106,31,0.35)] -translate-y-2 border border-white/25"
                : "bg-[#181B24] border border-white/[0.08] text-[#F4EFE6] hover:bg-[#20242F] hover:border-white/[0.18]"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className={`text-admin-meta font-mono uppercase tracking-wider text-[11px] ${
                  isSelected ? "text-white/80" : "text-[#F4EFE6]/55"
                }`}
              >
                {item.caption}
              </span>
              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-[#FF6A1F]/15 text-[#FFC93C] border border-[#FF6A1F]/30"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </div>

            <h4
              className={`text-admin-h3 font-semibold tracking-tight ${
                isSelected ? "text-white" : "text-[#F4EFE6]"
              }`}
            >
              {item.title}
            </h4>

            {item.count !== undefined && (
              <div
                className={`text-admin-h2 font-display mt-2 font-bold ${
                  isSelected ? "text-white" : "text-[#F4EFE6]/90"
                }`}
              >
                {item.count}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
