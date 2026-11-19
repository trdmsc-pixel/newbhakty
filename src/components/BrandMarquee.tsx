import React, { useState } from "react";
import { useReducedMotion } from "motion/react";
import { useSiteData } from "../context/SiteDataContext";

export default function BrandMarquee() {
  const { siteSettings, brandLogos = [] } = useSiteData();
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Filter out placeholder or unpopulated brand entries
  const validLogos = brandLogos.filter(
    (logo) =>
      logo.url &&
      logo.name &&
      logo.name.trim() !== "" &&
      !logo.name.trim().toLowerCase().includes("new brand")
  );

  const titleText = siteSettings.brand_logos_title || "TRUSTED BY";

  // Real roster fallback if database is empty
  const defaultBrands = [
    { name: "Prestige" },
    { name: "United Colors of Benetton" },
    { name: "Borosil" },
    { name: "Dennison" },
    { name: "Fastrack" },
    { name: "Klieo" },
    { name: "Alcis" },
    { name: "Lenskart" },
    { name: "Flipkart" },
    { name: "GNC" },
    { name: "Fossil" },
  ];

  const displayLogos = validLogos.length > 0 ? validLogos : [];

  return (
    <div className="w-full flex flex-col items-center">
      {/* Label */}
      <div className="text-center mb-8 px-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--tcs-dim)]">
          {titleText}
        </p>
      </div>

      {/* Marquee Container */}
      <div
        className="relative w-full overflow-hidden flex justify-center py-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Edge Fade Masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-48 z-10 pointer-events-none bg-gradient-to-r from-[var(--tcs-night)] to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-48 z-10 pointer-events-none bg-gradient-to-l from-[var(--tcs-night)] to-transparent" />

        {prefersReducedMotion ? (
          /* Static grid under reduced motion */
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-14 max-w-5xl mx-auto px-6">
            {(displayLogos.length > 0 ? displayLogos : defaultBrands).map((brand: any, idx) => (
              <div key={idx} className="flex-shrink-0">
                {brand.url ? (
                  <img
                    src={brand.url}
                    alt={brand.name}
                    className="h-7 md:h-9 w-auto object-contain opacity-55 grayscale brightness-125"
                  />
                ) : (
                  <span className="font-display font-medium text-sm uppercase tracking-wider text-[var(--tcs-offwhite)]/55">
                    {brand.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* 40s Infinite Smooth Marquee */
          <div className="w-full overflow-hidden flex">
            <div
              className={`tcs-marquee-track items-center gap-14 md:gap-20 ${
                isHovered ? "animation-play-state-paused" : ""
              }`}
              style={isHovered ? { animationPlayState: "paused" } : {}}
            >
              {[...(displayLogos.length > 0 ? displayLogos : defaultBrands), ...(displayLogos.length > 0 ? displayLogos : defaultBrands)].map(
                (brand: any, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 opacity-55 hover:opacity-100 transition-opacity duration-300 cursor-default"
                  >
                    {brand.url ? (
                      <img
                        src={brand.url}
                        alt={brand.name}
                        draggable="false"
                        className="h-7 md:h-9 w-auto object-contain grayscale brightness-125 select-none"
                      />
                    ) : (
                      <span className="font-display font-medium text-sm md:text-base uppercase tracking-widest text-[var(--tcs-offwhite)] whitespace-nowrap">
                        {brand.name}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
