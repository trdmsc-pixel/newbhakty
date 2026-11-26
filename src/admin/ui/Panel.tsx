import React from "react";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  headerBorder?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  eyebrow,
  title,
  actions,
  headerBorder = false,
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line)] p-6 sm:p-8 relative ${className}`}
      {...props}
    >
      {(eyebrow || title || actions) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${
            headerBorder ? "border-b border-[var(--a-line)] pb-5" : ""
          }`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-admin-eyebrow text-[var(--a-accent)] tracking-widest mb-1.5 font-mono">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-admin-h2 text-[var(--a-text)] tracking-tight">
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
