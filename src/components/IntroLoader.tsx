import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Ring } from "./brand/Ring";

interface IntroLoaderProps {
  onComplete?: () => void;
}

export const IntroLoader: React.FC<IntroLoaderProps> = ({ onComplete }) => {
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (prefersReducedMotion) return false;
    return !sessionStorage.getItem("tcs_intro_seen");
  });
  const [ringBloomed, setRingBloomed] = useState(false);
  const [showLetters, setShowLetters] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      onComplete?.();
      return;
    }

    const t1 = setTimeout(() => setRingBloomed(true), 700);
    const t2 = setTimeout(() => setShowLetters(true), 900);
    const t3 = setTimeout(() => {
      setIsVisible(false);
      try {
        sessionStorage.setItem("tcs_intro_seen", "true");
      } catch (e) {}
      onComplete?.();
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const brandText = "THE CHANTING STUDIO";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="intro-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-[var(--tcs-night)] pointer-events-none select-none"
        >
          {/* Ring */}
          <div className="relative mb-6">
            <Ring
              size={56}
              stroke={5}
              glow={ringBloomed}
              animate="draw"
            />
          </div>

          {/* Staggered Wordmark */}
          <div className="overflow-hidden flex items-center justify-center font-display text-sm tracking-[0.16em] uppercase text-[var(--tcs-offwhite)]">
            {brandText.split("").map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={showLetters ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.025,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={char === " " ? "w-2" : "inline-block"}
              >
                {char}
              </motion.span>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroLoader;
