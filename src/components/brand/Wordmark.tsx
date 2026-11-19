import React from "react";
import { Ring } from "./Ring";

export interface WordmarkProps {
  className?: string;
  ringAnimation?: "none" | "draw" | "spin-slow";
  glow?: boolean;
  useSvgLogo?: boolean;
  capHeight?: number | string; // e.g. 15, "1rem", "1.25rem"
}

export const Wordmark: React.FC<WordmarkProps> = ({
  className = "",
  ringAnimation = "none",
  glow = false,
  useSvgLogo = false,
  capHeight,
}) => {
  if (useSvgLogo) {
    return (
      <img
        src="/brand/logo.svg"
        alt="The Chanting Studio"
        className={`h-auto max-h-full ${className}`}
      />
    );
  }

  return (
    <span
      role="banner"
      aria-label="The Chanting Studio"
      className={`inline-flex items-baseline font-display text-[var(--tcs-offwhite)] uppercase tracking-[0.12em] select-none whitespace-nowrap leading-none ${className}`}
      style={capHeight ? { fontSize: capHeight } : undefined}
    >
      {/* "THE" - Light 300 */}
      <span className="font-light font-[300] mr-[0.4em]">THE</span>

      {/* "CHANTING" - Bold 700 */}
      <span className="font-bold font-[700] mr-[0.4em]">CHANTING</span>

      {/* "STUDI" + Ring as the final 'O' */}
      <span className="inline-flex items-baseline font-light font-[300]">
        <span>STUDI</span>
        <span className="inline-block relative ml-[0.04em] self-center translate-y-[-0.04em]">
          <Ring
            size="0.74em"
            stroke={undefined}
            glow={glow}
            animate={ringAnimation}
          />
        </span>
      </span>
    </span>
  );
};

export default Wordmark;
