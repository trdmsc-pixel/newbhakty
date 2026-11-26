import React from "react";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  badge?: number | string | boolean;
  shortcut?: string;
  size?: "sm" | "md" | "lg";
  variant?: "surface" | "ghost" | "inverse" | "danger" | "accent";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      badge,
      shortcut,
      size = "md",
      variant = "surface",
      className = "",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "w-[2.25rem] h-[2.25rem] text-[1.125rem]",
      md: "w-[2.75rem] h-[2.75rem] text-[1.25rem]",
      lg: "w-[3.25rem] h-[3.25rem] text-[1.375rem]",
    }[size];

    const variantClasses = {
      surface: "bg-[var(--a-surface-2)] border border-[var(--a-line)] text-[var(--a-text)] hover:bg-[var(--a-surface-3)] hover:border-[var(--a-line-strong)]",
      ghost: "bg-transparent border border-transparent text-[var(--a-text-2)] hover:bg-[var(--a-surface-2)] hover:text-[var(--a-text)]",
      inverse: "bg-[var(--a-inverse)] border border-[color:var(--a-inverse-line)] text-[var(--a-inverse-text)] hover:opacity-85",
      danger: "bg-red-500/10 border border-red-500/20 text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] hover:text-[var(--a-danger-text)]",
      accent: "bg-[var(--a-accent-soft)] border border-[var(--a-accent)]/30 text-[var(--a-accent)] hover:bg-[var(--a-accent)]/25 hover:text-[var(--a-accent)]",
    }[variant];

    const tooltipContent = shortcut ? `${label} (${shortcut})` : label;

    return (
      <Tooltip content={tooltipContent}>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          disabled={disabled}
          className={`relative inline-flex items-center justify-center rounded-full shrink-0 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
          {...props}
        >
          {children}

          {badge !== undefined && badge !== false && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-[1.25rem] px-1 rounded-full bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] text-white text-[11px] font-mono font-bold flex items-center justify-center shadow-md animate-in zoom-in-50">
              {typeof badge === "number" || typeof badge === "string" ? badge : ""}
            </span>
          )}
        </button>
      </Tooltip>
    );
  }
);

IconButton.displayName = "IconButton";
