import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      className = "",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-9 px-4 text-admin-meta",
      md: "h-11 px-5 text-admin-label",
      lg: "h-12 px-7 text-admin-body-lg font-semibold",
    }[size];

    const variantClasses = {
      primary:
        "bg-[var(--a-accent)] text-white font-semibold hover:brightness-105 hover:-translate-y-[1px] active:scale-[0.98]",
      accent:
        "bg-[var(--a-blue)] text-white font-semibold hover:brightness-105 hover:-translate-y-[1px] active:scale-[0.98]",
      secondary:
        "bg-[var(--a-surface-1)] border border-[var(--a-line-strong)] text-[var(--a-text)] font-medium hover:bg-[var(--a-surface-2)] active:scale-[0.98]",
      ghost:
        "bg-transparent text-[var(--a-text-2)] hover:bg-[var(--a-surface-2)] hover:text-[var(--a-text)]",
      danger:
        "bg-[var(--a-danger-bg)] border border-transparent text-[var(--a-danger-text)] font-semibold hover:opacity-90 active:scale-[0.98]",
    }[variant];

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-full transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
