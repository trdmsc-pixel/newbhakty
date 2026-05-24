import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useSiteData } from "../context/SiteDataContext";

export interface BrandLogo {
  id: string;
  url: string;
  name: string;
  display_order: number;
}

export default function BrandMarquee() {
  const { siteSettings, brandLogos = [] } = useSiteData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const direction = siteSettings.marquee_direction === "right" ? "right" : "left";

  // If no logos, don't render
  if (brandLogos.length === 0) return null;

  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...brandLogos, ...brandLogos, ...brandLogos];

  return (
    <section className="relative z-10 py-8 md:py-12 overflow-hidden">
      {/* Subtle section label */}
      <div className="text-center mb-6">
        <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-gray-500">
          Trusted By Leading Brands
        </span>
      </div>

      {/* Marquee container with fade edges */}
      <div 
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left fade gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-r from-[#050508] to-transparent" />
        {/* Right fade gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-[#050508] to-transparent" />

        {/* Scrolling track */}
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
              <div className="absolute inset-0 rounded-xl bg-[#ffea00]/0 group-hover/logo:bg-[#ffea00]/5 transition-all duration-500 blur-xl scale-150 pointer-events-none" />
              
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
    </section>
  );
}
