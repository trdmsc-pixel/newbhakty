import React from "react";
import { AIWriteButton, type AIWriteConfig } from "./AIWrite";

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  counter?: { current: number; max: number };
  warning?: string;
  onWarningClick?: () => void;
  className?: string;
  /** Adds a "Write with AI" button next to the label. */
  ai?: AIWriteConfig;
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
  ai,
  children,
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {(label || counter || warning || ai) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {label && (
              <label
                htmlFor={htmlFor}
                className="text-admin-label text-[var(--a-text)] font-semibold select-none"
              >
                {label}
              </label>
            )}
            {warning && (
              <button
                type="button"
                onClick={onWarningClick}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[var(--a-warn-bg)] text-[var(--a-warn-text)] border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                title="Click to highlight field text"
              >
                <span>⚠️ {warning}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
          {ai && <AIWriteButton {...ai} field={ai.field || label || "text"} />}
          {counter && (
            <span
              className={`text-admin-meta font-mono text-[12px] ${
                counter.current > counter.max
                  ? "text-[var(--a-danger-text)] font-bold"
                  : "text-[var(--a-text-3)]"
              }`}
            >
              {counter.current} / {counter.max}
            </span>
          )}
          </div>
        </div>
      )}

      <div>{children}</div>

      {error ? (
        <p className="text-admin-meta text-[var(--a-danger-text)] font-medium">{error}</p>
      ) : help ? (
        <p className="text-admin-meta text-[var(--a-text-3)]">{help}</p>
      ) : null}
    </div>
  );
};
