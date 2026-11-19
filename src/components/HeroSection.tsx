import React, { useRef, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { optimizeHeroVideoUrl } from "../lib/cloudinary";

interface HeroSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  loopUrl?: string;
  posterUrl?: string;
  credit?: string;
  onWatchReel: () => void;
  onStartProject: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  eyebrow = "AI-NATIVE CINEMATIC STUDIO — DELHI → WORLDWIDE",
  title = "Film-scale craft.\nAI-speed delivery.",
  description = "Brand films, AI commercials, trailers and hybrid live-action VFX for brands, agencies and production houses.",
  loopUrl = "",
  posterUrl = "/og.jpg",
  credit = "",
  onWatchReel,
  onStartProject,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Optimized video source URL
  const optimizedVideoUrl = loopUrl ? optimizeHeroVideoUrl(loopUrl) : "";

  // Pause video when off-screen to conserve GPU resources
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !videoRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [optimizedVideoUrl]);

  // Parse lines for mask-up animation
  const titleLines = title.split("\n");

  return (
    <section
      id="top"
      ref={sectionRef}
      className="relative w-full h-[100svh] min-h-[640px] flex flex-col justify-end overflow-hidden bg-[var(--tcs-night)] select-none"
    >
      {/* Background Video / LCP Poster Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {optimizedVideoUrl && !prefersReducedMotion ? (
          <video
            ref={videoRef}
            src={optimizedVideoUrl}
            poster={posterUrl || "/og.jpg"}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <img
            src={posterUrl || "/og.jpg"}
            alt="The Chanting Studio Hero"
            // @ts-ignore
            fetchpriority="high"
            className="w-full h-full object-cover object-center"
          />
        )}

        {/* Studio Lighting Overlays: 20% night wash + bottom gradient fade */}
        <div className="absolute inset-0 bg-[var(--tcs-night)]/20" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--tcs-night) 0%, rgba(7, 8, 12, 0.7) 35%, transparent 60%)",
          }}
        />

        {/* Subtle spectral light leak backdrop */}
        <div className="absolute bottom-1/4 left-10 w-[500px] h-[300px] spectral-glow opacity-60" />
      </div>

      {/* Main Bottom-Left Content */}
      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 md:px-[6%] pb-12 md:pb-16 flex flex-col justify-end">
        {/* Eyebrow Label */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-4"
        >
          {eyebrow}
        </motion.p>

        {/* H1 Headline with Mask-up reveal */}
        <h1 className="tcs-h1 text-[var(--tcs-offwhite)] max-w-4xl mb-6">
          {titleLines.map((line, idx) => (
            <span key={idx} className="block overflow-hidden">
              <motion.span
                initial={prefersReducedMotion ? { opacity: 0 } : { y: "100%" }}
                animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
                transition={{
                  duration: 0.9,
                  delay: idx * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`block ${idx === 0 ? "font-light font-[300]" : "font-bold font-[700]"}`}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Directorial Sub-Copy */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-[var(--tcs-muted)] text-base md:text-lg max-w-xl leading-relaxed mb-8"
        >
          {description}
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center gap-4"
        >
          <button
            type="button"
            onClick={onWatchReel}
            className="px-6 py-3.5 rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold flex items-center gap-2 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>▶ Watch the reel</span>
          </button>

          <button
            type="button"
            onClick={onStartProject}
            className="px-6 py-3.5 rounded border border-[var(--tcs-line)] text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-widest hover:border-[var(--tcs-offwhite)]/60 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            Start a project
          </button>
        </motion.div>
      </div>

      {/* Frame Credit (Bottom-Right) */}
      {credit && (
        <div className="hidden lg:block absolute bottom-12 right-[6%] z-10 text-right">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)]">
            NOW PLAYING
          </p>
          <p className="font-mono text-xs text-[var(--tcs-muted)] mt-0.5">
            {credit}
          </p>
        </div>
      )}

      {/* Minimalist Scroll Cue */}
      <div className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-2 pointer-events-none opacity-60">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--tcs-dim)]">
          SCROLL
        </span>
        <div className="relative w-[1px] h-10 bg-[var(--tcs-line)] overflow-hidden">
          <motion.div
            animate={
              prefersReducedMotion
                ? {}
                : { y: ["0%", "250%"] }
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-[2px] -left-[0.5px] h-4 absolute top-0"
            style={{ background: "var(--tcs-spectrum-linear)" }}
          />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
