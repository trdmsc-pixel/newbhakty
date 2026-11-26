import React from "react";

export interface InversePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: React.ReactNode;
  actions?: React.ReactNode;
  headerBorder?: boolean;
}

export const InversePanel: React.FC<InversePanelProps> = ({
  eyebrow,
  title,
  actions,
  headerBorder = true,
  className = "",
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-[1.75rem] bg-[var(--a-inverse)] text-[var(--a-inverse-text)] border border-black/[0.08] p-6 sm:p-8 relative shadow-sm ${className}`}
      {...props}
    >
      {(eyebrow || title || actions) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${
            headerBorder ? "border-b border-black/[0.08] pb-5" : ""
          }`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-admin-eyebrow text-[var(--a-inverse-text)]/60 tracking-widest mb-1.5 font-mono">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-admin-h2 text-[var(--a-inverse-text)] tracking-tight">
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
