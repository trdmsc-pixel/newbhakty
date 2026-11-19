import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import BrandMarquee from "./BrandMarquee";

export const ClientsSection: React.FC = () => {
  const { testimonials = [] } = useSiteData();
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const total = testimonials.length;

  // Auto-advance every 7 seconds
  useEffect(() => {
    if (total <= 1 || isPaused || prefersReducedMotion) return;

    const interval = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % total);
    }, 7000);

    return () => clearInterval(interval);
  }, [total, isPaused, prefersReducedMotion]);

  const handlePrev = () => {
    if (total <= 1) return;
    setActiveIdx((prev) => (prev === 0 ? total - 1 : prev - 1));
  };

  const handleNext = () => {
    if (total <= 1) return;
    setActiveIdx((prev) => (prev + 1) % total);
  };

  const current = testimonials[activeIdx];

  return (
    <section id="clients" className="relative w-full py-28 bg-[var(--tcs-night)] select-none">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        {/* Trusted By Brand Marquee */}
        <div className="mb-24">
          <BrandMarquee />
        </div>

        {/* Testimonials Carousel (Only if testimonials exist) */}
        {total > 0 && current && (
          <div
            className="pt-16 border-t border-[var(--tcs-line)] max-w-4xl mx-auto"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {/* Spectral Progress Line (7s auto-advance) */}
            {!prefersReducedMotion && total > 1 && (
              <div className="w-full h-[2px] bg-[var(--tcs-line)] overflow-hidden rounded-full mb-12">
                <motion.div
                  key={activeIdx}
                  initial={{ width: "0%" }}
                  animate={{ width: isPaused ? undefined : "100%" }}
                  transition={{
                    duration: isPaused ? 0 : 7,
                    ease: "linear",
                  }}
                  className="h-full rounded-full"
                  style={{ background: "var(--tcs-spectrum-linear)" }}
                />
              </div>
            )}

            {/* Quote Container */}
            <div className="min-h-[160px] flex flex-col justify-center mb-8">
              <AnimatePresence mode="wait">
                <motion.blockquote
                  key={current.id || activeIdx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display font-light text-[clamp(1.5rem,2.5vw,2.5rem)] text-[var(--tcs-offwhite)] leading-snug tracking-tight mb-8"
                >
                  "{current.text}"
                </motion.blockquote>
              </AnimatePresence>

              {/* Attribution & Controls */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-offwhite)] font-semibold">
                    {current.client_name}
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--tcs-dim)] mt-0.5">
                    {[current.role, current.company].filter(Boolean).join(" • ")}
                  </p>
                </div>

                {total > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous quote"
                      className="p-2.5 rounded-full border border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:text-white hover:border-[var(--tcs-offwhite)]/40 transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next quote"
                      className="p-2.5 rounded-full border border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:text-white hover:border-[var(--tcs-offwhite)]/40 transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ClientsSection;
