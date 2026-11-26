import React from "react";

export interface DetailPanelProps {
  columns?: {
    label: string;
    value: React.ReactNode;
  }[];
  className?: string;
  children: React.ReactNode;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  columns,
  className = "",
  children,
}) => {
  return (
    <div
      className={`rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line)] p-6 sm:p-8 flex flex-col justify-between relative space-y-6 ${className}`}
    >
      {columns && columns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[var(--a-line)] pb-6">
          {columns.map((col, idx) => (
            <div key={idx} className="min-w-0">
              <p className="text-admin-meta text-[var(--a-text-3)] font-medium mb-1 truncate">
                {col.label}
              </p>
              <div className="text-admin-h2 text-[var(--a-text)] font-semibold truncate tracking-tight">
                {col.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-6">{children}</div>
    </div>
  );
};
