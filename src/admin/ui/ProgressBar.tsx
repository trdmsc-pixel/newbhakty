import React, { useEffect, useState } from "react";

export interface ProgressBarProps {
  value: number; // 0 to 100
  tone?: "ember-gold" | "crimson-magenta" | "blue-cyan" | "spectrum";
  inverse?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = "ember-gold",
  inverse = false,
  className = "",
}) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(Math.min(100, Math.max(0, value)));
    }, 50);
    return () => clearTimeout(timer);
  }, [value]);

  const toneGradients = {
    "ember-gold": "linear-gradient(90deg, #FF6A1F 0%, #FFC93C 100%)",
    "crimson-magenta": "linear-gradient(90deg, #E8332A 0%, #C2187A 100%)",
    "blue-cyan": "linear-gradient(90deg, #1F4BFF 0%, #2EC5FF 100%)",
    "spectrum": "linear-gradient(90deg, #FF6A1F 0%, #FFC93C 30%, #34D399 60%, #2EC5FF 100%)",
  }[tone];

  return (
    <div
      className={`h-[0.5rem] w-full rounded-full overflow-hidden relative ${
        inverse ? "bg-[color:var(--a-inverse-line)]" : "bg-[var(--a-surface-2)]"
      } ${className}`}
    >
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: `${width}%`,
          background: toneGradients,
        }}
      />
    </div>
  );
};
