/**
 * Studio OS motion toolkit — calm, tactile, fast (150–240ms ease-out).
 * Every primitive honours prefers-reduced-motion.
 */
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, Clock } from "lucide-react";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const FAST = { duration: 0.2, ease: EASE };

/** Directional fade + 10px swipe for route/tab views. */
export const ScreenTransition: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, x: reduce ? 0 : 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: reduce ? 0 : -10 }}
        transition={{ duration: reduce ? 0.01 : 0.2, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/** Sliding active indicator for pills / segmented controls (shared layoutId). */
export const ActivePill: React.FC<{ layoutId: string; className?: string; style?: React.CSSProperties }> = ({ layoutId, className = "", style }) => {
  const reduce = useReducedMotion();
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={`absolute inset-0 ${className}`}
      style={{ borderRadius: 9999, zIndex: 0, ...style }}
      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
    />
  );
};

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export function useCoarsePointer() {
  const [c, setC] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const on = () => setC(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return c;
}

/** Modal: backdrop fade + bottom-sheet on mobile (damped spring, no bounce) / scale+fade on desktop. */
export const SheetModal: React.FC<{
  open: boolean;
  onClose: () => void;
  label: string;
  panelClassName: string;
  panelStyle?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ open, onClose, label, panelClassName, panelStyle, children }) => {
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const panel = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : mobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" }, transition: { type: "spring" as const, damping: 34, stiffness: 340, mass: 0.9 } }
    : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.18, ease: EASE } };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div role="dialog" aria-modal="true" aria-label={label} className={panelClassName} style={panelStyle} onClick={(e) => e.stopPropagation()} {...panel}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Circular complete button: green fill + check draw, then calls onComplete. */
export const CompleteCheck: React.FC<{ label: string; onComplete: () => void; done?: boolean }> = ({ label, onComplete, done }) => {
  const reduce = useReducedMotion();
  const [checking, setChecking] = useState(false);
  const on = checking || done;
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        if (checking) return;
        setChecking(true);
        window.setTimeout(onComplete, reduce ? 0 : 260);
      }}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      className="relative w-11 h-11 -m-2.5 flex items-center justify-center shrink-0 rounded-full"
    >
      <motion.span
        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
        animate={{ backgroundColor: on ? "#1F7A52" : "rgba(0,0,0,0)", borderColor: on ? "#1F7A52" : "var(--sos-text-3)" }}
        transition={{ duration: reduce ? 0 : 0.18, ease: EASE }}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: EASE, delay: reduce ? 0 : 0.04 }} />
        </svg>
      </motion.span>
    </motion.button>
  );
};

/**
 * Mobile swipe row: right (>72px) → Done (green), left (<-72px) → Snooze/Backlog (amber).
 * Drag only on coarse pointers so desktop clicks/text selection stay untouched.
 */
export const SwipeRow: React.FC<{
  onDone: () => void;
  onSnooze: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Optional overrides for the reveal labels (defaults: Done / Snooze). */
  doneLabel?: React.ReactNode;
  snoozeLabel?: React.ReactNode;
  snoozeBg?: string;
  radius?: number;
}> = ({ onDone, onSnooze, className, style, children, doneLabel, snoozeLabel, snoozeBg, radius = 18 }) => {
  const coarse = useCoarsePointer();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const doneOpacity = useTransform(x, [0, 72], [0, 1]);
  const snoozeOpacity = useTransform(x, [-72, 0], [1, 0]);
  if (!coarse) return <div className={className} style={style}>{children}</div>;
  return (
    <div className="relative overflow-hidden" style={{ borderRadius: radius }}>
      <motion.div className="absolute inset-0 flex items-center pl-5 text-[13px] font-semibold gap-1.5" style={{ background: "#1F7A52", color: "#fff", opacity: doneOpacity }} aria-hidden>
        {doneLabel ?? (<><Check className="w-4 h-4" /> Done</>)}
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-end pr-5 text-[13px] font-semibold gap-1.5" style={{ background: snoozeBg || "#B45309", color: "#fff", opacity: snoozeOpacity }} aria-hidden>
        {snoozeLabel ?? (<>Snooze <Clock className="w-4 h-4" /></>)}
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        style={{ x, ...style }}
        className={`relative ${className || ""}`}
        onDragEnd={(_, info) => {
          if (info.offset.x > 72) onDone();
          else if (info.offset.x < -72) onSnooze();
        }}
        transition={reduce ? { duration: 0 } : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
};

/** Smooth digit transitions for the focus timer. */
export const TickDigits: React.FC<{ value: string; className?: string; style?: React.CSSProperties }> = ({ value, className, style }) => {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-flex overflow-hidden ${className || ""}`} style={style}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: reduce ? 0 : "40%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduce ? 0 : "-40%", opacity: 0 }}
          transition={{ duration: reduce ? 0.01 : 0.18, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

/** Gentle breathing ring (active focus timer). */
export const BreathingRing: React.FC<{ active: boolean }> = ({ active }) => {
  const reduce = useReducedMotion();
  if (!active || reduce) return null;
  return (
    <motion.span
      aria-hidden
      className="absolute inset-0 rounded-full pointer-events-none"
      style={{ boxShadow: "0 0 0 3px rgba(31,122,82,0.35)" }}
      animate={{ scale: [1, 1.16, 1], opacity: [0.7, 0, 0.7] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
};

/**
 * Cursor-reactive sheen: one passive pointer listener sets --mx/--my on the
 * pill button or card under the cursor; CSS draws the highlight.
 */
export function usePointerGlow(rootSelector = ".studio-os-root") {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.(".sos-pill-btn, .sos-card") as HTMLElement | null;
      if (!target || !target.closest(rootSelector)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${e.clientX - r.left}px`);
        target.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
    };
  }, [rootSelector]);
}

/** Reusable motion pill button with tactile press feedback. */
export const InteractiveButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof motion.button>>(function InteractiveButton(
  { className = "", children, ...rest },
  ref
) {
  const reduce = useReducedMotion();
  return (
    <motion.button ref={ref} whileTap={reduce ? undefined : { scale: 0.97 }} transition={{ duration: 0.15, ease: EASE }} className={`sos-pill-btn ${className}`} {...rest}>
      {children}
    </motion.button>
  );
});
