/** Segmented control with a spring-animated sliding pill (shared by Studio OS + portal). */
import React from "react";
import { motion } from "motion/react";

export function SegToggle<T extends string>({ value, options, onChange, id, size = "md" }: { value: T; options: Array<{ id: T; label: React.ReactNode }>; onChange: (v: T) => void; id: string; size?: "sm" | "md" }) {
  return (
    <div className="sos-seg border" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }} role="tablist">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`relative ${size === "sm" ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]"} rounded-full font-semibold capitalize transition-colors duration-200`}
            style={{ color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--sos-ink)", boxShadow: "0 4px 14px -4px rgba(15,17,21,0.45)" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-[1]">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
