import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useSiteData } from "../context/SiteDataContext";

export const StudioSection: React.FC = () => {
  const { siteSettings } = useSiteData();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // 6 Studio Capabilities (Part A)
  const services = [
    {
      num: "01",
      title: siteSettings.service_1_title || "Brand Films & TVCs",
      desc: siteSettings.service_1_desc || "Hero films for launches and campaigns, built to cinema standards.",
    },
    {
      num: "02",
      title: siteSettings.service_2_title || "AI Commercials",
      desc: siteSettings.service_2_desc || "Product and fashion spots without the cost and wait of a full shoot.",
    },
    {
      num: "03",
      title: siteSettings.service_3_title || "Trailers & Teasers",
      desc: siteSettings.service_3_desc || "Synthetic trailers and teasers for films, series and pitches.",
    },
    {
      num: "04",
      title: siteSettings.service_4_title || "Hybrid Live-Action + VFX",
      desc: siteSettings.service_4_desc || "Live plates extended and finished with AI and VFX.",
    },
    {
      num: "05",
      title: siteSettings.service_5_title || "Music Videos",
      desc: siteSettings.service_5_desc || "Narrative and performance videos with a film-grade finish.",
    },
    {
      num: "06",
      title: siteSettings.service_6_title || "For Agencies & Production Houses",
      desc: siteSettings.service_6_desc || "Your AI unit on call: pitch films, previs and finished shots, white-label.",
    },
  ];

  // 4 Process Steps (Part B)
  const processSteps = [
    {
      step: "01",
      name: "Brief",
      detail: "You tell us the story and the deadline.",
    },
    {
      step: "02",
      name: "Look",
      detail: "Treatment, style frames and the visual world.",
    },
    {
      step: "03",
      name: "Make",
      detail: "AI, live action and VFX in one pipeline.",
    },
    {
      step: "04",
      name: "Deliver",
      detail: "Graded, sound-designed, in every format you need.",
    },
  ];

  return (
    <section id="studio" className="relative w-full py-28 bg-[var(--tcs-night)] select-none">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        {/* ========================================= */}
        {/* PART A: WHAT WE MAKE                      */}
        {/* ========================================= */}
        <div className="mb-28">
          <div className="max-w-3xl mb-14">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-2">
              WHAT WE MAKE
            </p>
            <h2 className="tcs-h2 text-[var(--tcs-offwhite)]">
              One studio. Every kind of frame.
            </h2>
          </div>

          {/* 6 Full-Width Service Rows */}
          <div className="w-full border-t border-[var(--tcs-line)]">
            {services.map((item, idx) => {
              const isHovered = hoveredRow === idx;
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredRow(idx)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="group relative w-full border-b border-[var(--tcs-line)] py-8 md:py-10 transition-colors duration-300 cursor-pointer overflow-hidden"
                >
                  {/* Subtle Background Hover Light Glow */}
                  <div
                    className={`absolute inset-0 bg-white/[0.02] transition-opacity duration-500 pointer-events-none ${
                      isHovered ? "opacity-100" : "opacity-0"
                    }`}
                  />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-baseline justify-between gap-4 md:gap-12">
                    {/* Left: Number & Title */}
                    <div className="flex items-baseline gap-6 md:gap-10 md:w-1/2">
                      <span
                        className={`font-mono text-sm uppercase tracking-wider font-semibold transition-colors duration-300 ${
                          isHovered
                            ? "text-[var(--tcs-gold)]"
                            : "text-[var(--tcs-dim)]"
                        }`}
                        style={
                          isHovered && !prefersReducedMotion
                            ? {
                                color: "var(--tcs-gold)",
                                textShadow: "0 0 12px rgba(255, 201, 60, 0.4)",
                              }
                            : {}
                        }
                      >
                        {item.num}
                      </span>
                      <h3 className="font-display font-medium text-xl md:text-2xl text-[var(--tcs-offwhite)] group-hover:text-white transition-colors">
                        {item.title}
                      </h3>
                    </div>

                    {/* Right: Description */}
                    <div className="md:w-1/2 pl-12 md:pl-0">
                      <p className="font-sans text-[var(--tcs-muted)] text-sm md:text-base leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================= */}
        {/* PART B: HOW WE WORK                       */}
        {/* ========================================= */}
        <div>
          <div className="max-w-3xl mb-14">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-2">
              HOW WE WORK
            </p>
            <h2 className="tcs-h2 text-[var(--tcs-offwhite)]">
              Directorial precision from brief to master.
            </h2>
          </div>

          {/* 4 Process Columns with Drawing Spectral Hairlines */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-8">
            {processSteps.map((step, idx) => (
              <div key={idx} className="relative pt-6">
                {/* Spectral Hairline Drawing in on Scroll */}
                <motion.div
                  initial={prefersReducedMotion ? { width: "100%" } : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.8, delay: idx * 0.12, ease: [0.65, 0, 0.35, 1] }}
                  style={{
                    originX: 0,
                    background: "var(--tcs-spectrum-linear)",
                  }}
                  className="absolute top-0 left-0 w-full h-[1.5px]"
                />

                <span className="font-mono text-2xl font-light text-[var(--tcs-offwhite)]/40 block mb-4">
                  {step.step}
                </span>

                <h3 className="font-display font-bold text-lg uppercase tracking-wide text-[var(--tcs-offwhite)] mb-2">
                  {step.name}
                </h3>

                <p className="font-sans text-[var(--tcs-muted)] text-sm leading-relaxed">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StudioSection;
