import React from "react";
import { motion } from "motion/react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}) => {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-[3rem] h-[1.75rem] rounded-full p-1 transition-colors duration-200 cursor-pointer relative shrink-0 ${
          checked
            ? "bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] shadow-md"
            : "bg-[var(--a-surface-3)] border border-[var(--a-line)]"
        }`}
      >
        <motion.div
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="w-[1.25rem] h-[1.25rem] rounded-full bg-[var(--a-inverse)] shadow-sm"
        />
      </button>
      {label && (
        <span className="text-admin-label text-[var(--a-text)] font-medium">
          {label}
        </span>
      )}
    </label>
  );
};
