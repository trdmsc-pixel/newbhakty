import React, { useState } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "top",
  className = "",
}) => {
  const [visible, setVisible] = useState(false);

  if (!content) return children;

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute ${sideClasses} z-[120] pointer-events-none px-3 py-1.5 rounded-xl bg-[var(--a-inverse)] text-[var(--a-inverse-text)] text-admin-meta font-semibold shadow-lg whitespace-nowrap transition-all duration-150 animate-in fade-in`}
        >
          {content}
        </div>
      )}
    </div>
  );
};
