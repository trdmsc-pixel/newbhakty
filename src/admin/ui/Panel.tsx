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
      className={`rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 relative ${className}`}
      {...props}
    >
      {(eyebrow || title || actions) && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 ${
            headerBorder ? "border-b border-white/[0.08] pb-5" : ""
          }`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-admin-eyebrow text-[#FF6A1F] tracking-widest mb-1.5 font-mono">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-admin-h2 text-[#F4EFE6] tracking-tight">
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
