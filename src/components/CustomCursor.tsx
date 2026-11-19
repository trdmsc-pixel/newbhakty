import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";

export const CustomCursor: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [cursorType, setCursorType] = useState<"default" | "play" | "view">("default");
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion) return;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    setIsEnabled(true);
    document.body.classList.add("has-custom-cursor");

    const onMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);

      const target = e.target as HTMLElement | null;
      const cursorTarget = target?.closest("[data-cursor]");
      if (cursorTarget) {
        const type = cursorTarget.getAttribute("data-cursor") as "play" | "view";
        setCursorType(type || "default");
      } else {
        setCursorType("default");
      }
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    return () => {
      document.body.classList.remove("has-custom-cursor");
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, [isVisible, prefersReducedMotion]);

  if (!isEnabled || !isVisible) return null;

  const isExpanded = cursorType === "play" || cursorType === "view";
  const size = cursorType === "play" ? 80 : cursorType === "view" ? 64 : 10;

  return (
    <motion.div
      aria-hidden="true"
      className="fixed top-0 left-0 pointer-events-none z-[99999] flex items-center justify-center rounded-full select-none"
      animate={{
        x: pos.x - size / 2,
        y: pos.y - size / 2,
        width: size,
        height: size,
        backgroundColor: isExpanded ? "rgba(7, 8, 12, 0.9)" : "var(--tcs-offwhite)",
        borderColor: isExpanded ? "var(--tcs-offwhite)" : "transparent",
        borderWidth: isExpanded ? 1 : 0,
      }}
      transition={{
        type: "spring",
        damping: 32,
        stiffness: 400,
        mass: 0.2,
      }}
    >
      {cursorType === "play" && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-offwhite)] font-bold">
          PLAY
        </span>
      )}
      {cursorType === "view" && (
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--tcs-offwhite)] font-bold">
          VIEW
        </span>
      )}
    </motion.div>
  );
};

export default CustomCursor;
