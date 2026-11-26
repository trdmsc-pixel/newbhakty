import React from "react";
import { motion } from "motion/react";
import { LayoutGrid } from "lucide-react";
import { pillSpring } from "../ui/motion";

export interface TabItem {
  id: string;
  label: string;
}

export interface TopPillNavProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onOpenCommandPalette: () => void;
  className?: string;
}

export const TopPillNav: React.FC<TopPillNavProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onOpenCommandPalette,
  className = "",
}) => {
  return (
    <nav
      aria-label="Admin Navigation"
      role="tablist"
      className={`h-[3.5rem] px-2 py-1.5 rounded-full bg-[var(--a-inverse)] shadow-admin-floating flex items-center gap-1.5 border border-black/10 select-none ${className}`}
    >
      {/* Grid command palette launcher button */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        title="Open Command Palette (⌘K)"
        aria-label="Open Command Palette"
        className="w-[2.5rem] h-[2.5rem] rounded-full bg-black/[0.08] hover:bg-black/[0.16] text-[var(--a-inverse-text)] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
      >
        <LayoutGrid className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-black/15 mx-0.5 shrink-0" />

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 sm:px-4.5 py-2 rounded-full text-admin-label font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer shrink-0 z-10 ${
                isActive
                  ? "text-white"
                  : "text-[var(--a-inverse-text)]/65 hover:text-[var(--a-inverse-text)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="admin-top-nav-active-pill"
                  transition={pillSpring}
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] shadow-md z-[-1]"
                />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
