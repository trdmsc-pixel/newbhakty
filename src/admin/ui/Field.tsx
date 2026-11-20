import React from "react";

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  counter?: { current: number; max: number };
  warning?: string;
  onWarningClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  help,
  error,
  counter,
  warning,
  onWarningClick,
  className = "",
  children,
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {(label || counter || warning) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {label && (
              <label
                htmlFor={htmlFor}
                className="text-admin-label text-[#F4EFE6]/90 font-semibold select-none"
              >
                {label}
              </label>
            )}
            {warning && (
              <button
                type="button"
                onClick={onWarningClick}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                title="Click to highlight field text"
              >
                <span>⚠️ {warning}</span>
              </button>
            )}
          </div>

          {counter && (
            <span
              className={`text-admin-meta font-mono text-[12px] ${
                counter.current > counter.max
                  ? "text-red-400 font-bold"
                  : "text-[#F4EFE6]/45"
              }`}
            >
              {counter.current} / {counter.max}
            </span>
          )}
        </div>
      )}

      <div>{children}</div>

      {error ? (
        <p className="text-admin-meta text-red-400 font-medium">{error}</p>
      ) : help ? (
        <p className="text-admin-meta text-[#F4EFE6]/45">{help}</p>
      ) : null}
    </div>
  );
};
