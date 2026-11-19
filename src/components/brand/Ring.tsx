import React, { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface RingProps {
  size?: number | string;
  stroke?: number;
  glow?: boolean;
  animate?: "none" | "draw" | "spin-slow";
  className?: string;
  style?: React.CSSProperties;
}

export const Ring: React.FC<RingProps> = ({
  size = 24,
  stroke,
  glow = false,
  animate = "none",
  className = "",
  style = {},
}) => {
  const prefersReducedMotion = useReducedMotion();
  const maskId = useId();

  // If size is a number, we can compute proportional stroke default (e.g. 10-12% of diameter)
  const numericSize = typeof size === "number" ? size : parseFloat(size) || 24;
  const strokeWidth = stroke !== undefined ? stroke : Math.max(1.5, Math.round(numericSize * 0.11));
  const radius = 50 - (strokeWidth / numericSize) * 50;
  const circumference = 2 * Math.PI * radius;

  const isSpinning = animate === "spin-slow" && !prefersReducedMotion;
  const isDrawing = animate === "draw" && !prefersReducedMotion;

  // Render SVG with conic-gradient via SVG mask to guarantee clean stroke-dash draw & cross-browser support
  return (
    <div
      aria-hidden="true"
      className={`relative inline-block select-none pointer-events-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      {/* Background Glow layer if glow === true */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "var(--tcs-spectrum-conic)",
            WebkitMask: `radial-gradient(circle at center, transparent calc(50% - ${strokeWidth}px), black calc(50% - ${strokeWidth}px + 0.5px))`,
            mask: `radial-gradient(circle at center, transparent calc(50% - ${strokeWidth}px), black calc(50% - ${strokeWidth}px + 0.5px))`,
            filter: `blur(${Math.min(strokeWidth, 8)}px)`,
            opacity: 0.6,
          }}
        />
      )}

      {/* Main Conic Ring */}
      <motion.div
        className="w-full h-full rounded-full relative"
        animate={
          isSpinning
            ? { rotate: 360 }
            : {}
        }
        transition={
          isSpinning
            ? { duration: 60, ease: "linear", repeat: Infinity }
            : {}
        }
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full overflow-visible"
          style={{ transform: "rotate(-90deg)" }}
        >
          <defs>
            <mask id={maskId}>
              {isDrawing ? (
                <motion.circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={(strokeWidth / numericSize) * 100}
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: 0.9,
                    ease: [0.65, 0, 0.35, 1],
                  }}
                  strokeLinecap="round"
                />
              ) : (
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={(strokeWidth / numericSize) * 100}
                />
              )}
            </mask>
          </defs>

          {/* foreignObject-free conic gradient representation using CSS background masked by SVG */}
          <g mask={`url(#${maskId})`}>
            {/* 8 smooth overlapping gradient arcs matching the exact spectral stops */}
            {/* 0 deg: #FFF6E0, 60 deg: #FFC93C, 90 deg: #FF6A1F, 150 deg: #E8332A, 180 deg: #C2187A, 240 deg: #1F4BFF, 300 deg: #2EC5FF, 360 deg: #FFF6E0 */}
            <circle cx="50" cy="50" r="48" fill="#FFF6E0" opacity="0.9" />
            <path d="M 50 50 L 50 0 A 50 50 0 0 1 93.3 25 Z" fill="#FFC93C" />
            <path d="M 50 50 L 93.3 25 A 50 50 0 0 1 100 50 Z" fill="#FF6A1F" />
            <path d="M 50 50 L 100 50 A 50 50 0 0 1 75 93.3 Z" fill="#E8332A" />
            <path d="M 50 50 L 75 93.3 A 50 50 0 0 1 50 100 Z" fill="#C2187A" />
            <path d="M 50 50 L 50 100 A 50 50 0 0 1 6.7 75 Z" fill="#1F4BFF" />
            <path d="M 50 50 L 6.7 75 A 50 50 0 0 1 6.7 25 Z" fill="#2EC5FF" />
            <path d="M 50 50 L 6.7 25 A 50 50 0 0 1 50 0 Z" fill="#FFF6E0" />
          </g>
        </svg>

        {/* Crisp HTML/CSS conic layer overlay for seamless ultra-high-definition blend */}
        {!isDrawing && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "var(--tcs-spectrum-conic)",
              WebkitMask: `radial-gradient(circle at center, transparent calc(50% - ${strokeWidth}px), black calc(50% - ${strokeWidth}px + 0.5px))`,
              mask: `radial-gradient(circle at center, transparent calc(50% - ${strokeWidth}px), black calc(50% - ${strokeWidth}px + 0.5px))`,
            }}
          />
        )}
      </motion.div>
    </div>
  );
};

export default Ring;
