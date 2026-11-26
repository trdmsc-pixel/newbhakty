import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Chip } from "./Chip";

export interface SectionAccordionProps {
  id: string;
  number: string;
  title: string;
  summary?: string;
  emptyCount?: number;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}

export const SectionAccordion: React.FC<SectionAccordionProps> = ({
  id,
  number,
  title,
  summary,
  emptyCount = 0,
  isOpen,
  onToggle,
  className = "",
  children,
}) => {
  return (
    <div
      className={`rounded-[1.75rem] bg-[var(--a-surface-1)] border transition-all duration-200 ${
        isOpen
          ? "border-[var(--a-line-strong)] shadow-lg"
          : "border-[var(--a-line)] hover:border-[var(--a-line-strong)] overflow-hidden"
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left cursor-pointer transition-colors hover:bg-[var(--a-surface-2)]"
      >
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-[2.5rem] h-[2.5rem] rounded-full bg-[var(--a-accent-soft)] border border-[var(--a-accent)]/30 text-[var(--a-accent)] font-mono font-bold text-admin-meta flex items-center justify-center shrink-0">
            {number}
          </span>
          <div className="min-w-0">
            <h3 className="text-admin-h3 text-[var(--a-text)] font-semibold tracking-tight truncate">
              {title}
            </h3>
            {summary && (
              <p className="text-admin-meta text-[var(--a-text-3)] truncate mt-0.5">
                {summary}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {emptyCount > 0 ? (
            <Chip status="warning">
              {emptyCount} empty {emptyCount === 1 ? "field" : "fields"}
            </Chip>
          ) : (
            <Chip status="replied">Complete</Chip>
          )}

          <div
            className={`w-[2.5rem] h-[2.5rem] rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] flex items-center justify-center text-[var(--a-text-2)] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[var(--a-accent)]" : ""
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="p-6 sm:p-8 pt-2 sm:pt-4 border-t border-[var(--a-line)]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
