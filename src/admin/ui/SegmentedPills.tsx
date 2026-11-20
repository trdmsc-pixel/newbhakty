import React from "react";
import { motion } from "motion/react";
import { pillSpring } from "./motion";

export interface SegmentedPillOption {
  id: string;
  label: string;
  count?: number | string;
}

export interface SegmentedPillsProps {
  options: SegmentedPillOption[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "inline" | "floating" | "inverse";
  className?: string;
  layoutId?: string;
}

export const SegmentedPills: React.FC<SegmentedPillsProps> = ({
  options,
  activeId,
  onChange,
  variant = "inline",
  className = "",
  layoutId = "admin-segmented-pill",
}) => {
  const containerClasses = {
    inline: "bg-[#07080C] border border-white/[0.08]",
    floating:
      "absolute left-1/2 -top-[1.625rem] -translate-x-1/2 z-20 bg-[#07080C] border border-white/[0.14] shadow-admin-floating",
    inverse: "bg-[#07080C] border border-white/[0.12] shadow-sm",
  }[variant];

  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1.5 p-1.5 rounded-full overflow-x-auto max-w-full scrollbar-none select-none ${containerClasses} ${className}`}
    >
      {options.map((option) => {
        const isActive = option.id === activeId;

        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(option.id)}
            className={`relative px-4 sm:px-5 py-2 rounded-full text-admin-label font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer shrink-0 z-10 flex items-center gap-2 ${
              isActive ? "text-white font-semibold" : "text-[#F4EFE6]/65 hover:text-white"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={pillSpring}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] shadow-md z-[-1]"
              />
            )}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-mono font-bold leading-none ${
                  isActive
                    ? "bg-black/25 text-white"
                    : "bg-white/[0.08] text-[#F4EFE6]/75"
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
