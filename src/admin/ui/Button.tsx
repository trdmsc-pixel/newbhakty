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
      sm: "h-[2.5rem] px-4 text-admin-meta",
      md: "h-[3rem] px-6 text-admin-label",
      lg: "h-[3.5rem] px-8 text-admin-body-lg font-semibold",
    }[size];

    const variantClasses = {
      primary:
        "bg-[#F4EFE6] text-[#07080C] font-semibold hover:bg-white hover:shadow-[0_0_24px_rgba(255,106,31,0.35)] active:scale-[0.99]",
      accent:
        "bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white font-semibold shadow-md hover:brightness-110 active:scale-[0.99]",
      secondary:
        "bg-transparent border border-white/20 text-[#F4EFE6] font-medium hover:bg-[#181B24] hover:border-white/30 active:scale-[0.99]",
      ghost:
        "bg-transparent text-[#F4EFE6]/75 hover:bg-[#181B24] hover:text-[#F4EFE6]",
      danger:
        "bg-red-500/15 border border-red-500/30 text-red-300 font-semibold hover:bg-red-500/25 active:scale-[0.99]",
    }[variant];

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2.5 rounded-full font-sans transition-all duration-150 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed select-none ${sizeClasses} ${variantClasses} ${className}`}
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
