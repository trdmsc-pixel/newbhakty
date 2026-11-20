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
      surface: "bg-[#181B24] border border-white/[0.08] text-[#F4EFE6] hover:bg-[#20242F] hover:border-white/[0.18]",
      ghost: "bg-transparent border border-transparent text-[#F4EFE6]/70 hover:bg-[#181B24] hover:text-white",
      inverse: "bg-[#F4EFE6] border border-black/10 text-[#07080C] hover:bg-white",
      danger: "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300",
      accent: "bg-[#FF6A1F]/15 border border-[#FF6A1F]/30 text-[#FF6A1F] hover:bg-[#FF6A1F]/25 hover:text-[#FFC93C]",
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
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-[1.25rem] px-1 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white text-[11px] font-mono font-bold flex items-center justify-center shadow-md animate-in zoom-in-50">
              {typeof badge === "number" || typeof badge === "string" ? badge : ""}
            </span>
          )}
        </button>
      </Tooltip>
    );
  }
);

IconButton.displayName = "IconButton";
