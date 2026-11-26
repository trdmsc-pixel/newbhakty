import React from "react";

/** ✓ sent · ✓✓ delivered · ✓✓ (bright) read */
export const Receipt: React.FC<{ read?: string | null; delivered?: string | null; light?: boolean }> = ({ read, delivered, light }) => {
  const state = read ? "Read" : delivered ? "Delivered" : "Sent";
  const color = read ? (light ? "#BFF0FF" : "#1D9BF0") : light ? "rgba(255,255,255,0.7)" : "var(--sos-text-3)";
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color }} title={read ? `Read ${new Date(read).toLocaleString()}` : delivered ? `Delivered ${new Date(delivered).toLocaleString()}` : "Sent"}>
      <svg width={read || delivered ? 16 : 11} height="10" viewBox={read || delivered ? "0 0 16 10" : "0 0 11 10"} fill="none" aria-hidden>
        <path d="M1 5.5 4 8.5 10 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {(read || delivered) && <path d="M6 8.5 7 8.5 14 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      {state}
    </span>
  );
};
