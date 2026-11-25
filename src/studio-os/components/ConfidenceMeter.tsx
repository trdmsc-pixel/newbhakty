import React from "react";

export const ConfidenceMeter: React.FC<{ value: number }> = ({ value }) => {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * 5);
  return (
    <span className="inline-flex items-end gap-[2px]" title={`AI confidence ${Math.round(value * 100)}%`} aria-label={`Confidence ${Math.round(value * 100)}%`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{ height: 5 + i * 2, background: i < filled ? "var(--sos-text-2)" : "var(--sos-border)" }}
        />
      ))}
      <span className="ml-1 text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
        {Math.round(value * 100)}%
      </span>
    </span>
  );
};
