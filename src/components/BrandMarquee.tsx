import { useRef, useEffect, useState } from "react";
import { useSiteData } from "../context/SiteDataContext";

export default function BrandMarquee() {
  const { siteSettings, brandLogos = [], activePage } = useSiteData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const direction = siteSettings.marquee_direction === "right" ? "right" : "left";
  
  // Global settings
  const titleText = siteSettings.brand_logos_title || "Trusted By Leading Brands";
  const titleSize = siteSettings.brand_logos_title_size || "text-xs";
  const marqueeEnabled = siteSettings.brand_logos_marquee_enabled !== "false";

  // If no logos, don't render
  if (brandLogos.length === 0) return null;

  // Duplicate logos for seamless infinite scroll (only needed if marquee is enabled)
  const duplicatedLogos = marqueeEnabled ? [...brandLogos, ...brandLogos, ...brandLogos] : brandLogos;

  return (
    <section className="relative z-10 py-8 md:py-12 overflow-hidden w-full flex flex-col items-center">
      {/* Subtle section label */}
      <div className="text-center mb-8 px-4 w-full">
        <h4 className={`${titleSize} uppercase font-display font-medium tracking-widest text-gray-400 md:tracking-[0.2em]`}>
          {titleText}
        </h4>
      </div>

      {/* Marquee or Center Grid container */}
      {marqueeEnabled ? (
        <div 
          className="relative w-full group flex justify-center"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Left fade gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-r from-[#050508] to-transparent" />
          {/* Right fade gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-[#050508] to-transparent" />

          {/* Scrolling track */}
          <div className="w-full overflow-hidden flex justify-center">
            <div
              ref={scrollRef}
              className={`flex items-center gap-12 md:gap-16 ${
                isHovered ? "marquee-paused" : ""
              } ${direction === "right" ? "marquee-track-right" : "marquee-track-left"}`}
              style={{
                width: "fit-content",
              }}
            >
              {duplicatedLogos.map((logo, idx) => (
                <div
                  key={`${logo.id}-${idx}`}
                  className="flex-shrink-0 relative group/logo cursor-default"
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 rounded-xl bg-accent/0 group-hover/logo:bg-accent/5 transition-all duration-500 blur-xl scale-150 pointer-events-none" />
                  
                  <img
                    src={logo.url}
                    alt={logo.name || "Brand Logo"}
                    draggable="false"
                    className="h-8 md:h-10 w-auto object-contain opacity-40 group-hover/logo:opacity-80 transition-all duration-500 grayscale group-hover/logo:grayscale-0 select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Static Centered Layout when Marquee is Off */
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 w-full max-w-5xl mx-auto px-6 z-10">
          {brandLogos.map((logo) => (
            <div
              key={logo.id}
              className="relative group/logo cursor-default flex-shrink-0"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-xl bg-accent/0 group-hover/logo:bg-accent/5 transition-all duration-500 blur-xl scale-150 pointer-events-none" />
              
              <img
                src={logo.url}
                alt={logo.name || "Brand Logo"}
                draggable="false"
                className="h-8 md:h-10 w-auto object-contain opacity-40 group-hover/logo:opacity-80 transition-all duration-500 grayscale group-hover/logo:grayscale-0 select-none"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
