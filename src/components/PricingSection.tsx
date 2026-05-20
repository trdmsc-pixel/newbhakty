import React, { useState } from "react";
import { motion } from "motion/react";
import { Check, Flame, Sliders, Hourglass, RotateCcw, CornerDownRight } from "lucide-react";
import { PRICING_TIERS } from "../data";
import { PricingTier } from "../types";

interface PricingSectionProps {
  onSelectTier: (tierName: string) => void;
}

export default function PricingSection({ onSelectTier }: PricingSectionProps) {
  const [sliderIndex, setSliderIndex] = useState<number>(1); // Default to "Full Cinematic Studio" (index 1)

  const activeTier = PRICING_TIERS[sliderIndex];

  // Map theme values to precise glow aesthetics
  const getThemeColors = (theme: "saffron" | "violet" | "emerald") => {
    switch (theme) {
      case "saffron":
        return {
          glow: "shadow-[#E6C687]/15 border-[#E6C687]/40",
          text: "text-[#E6C687]",
          badge: "bg-[#E6C687]/10 text-[#E6C687] border-[#E6C687]/20",
          button: "bg-white text-black hover:bg-[#E6C687]",
          accentLine: "bg-gradient-to-r from-transparent via-[#E6C687]/50 to-transparent",
        };
      case "violet":
        return {
          glow: "shadow-[#4A36B3]/30 border-[#4A36B3]/30",
          text: "text-violet-400",
          badge: "bg-[#4A36B3]/20 text-violet-300 border-[#4A36B3]/30",
          button: "bg-violet-950/40 border border-violet-500/30 text-white hover:bg-violet-600 hover:text-white",
          accentLine: "bg-gradient-to-r from-transparent via-violet-500/50 to-transparent",
        };
      case "emerald":
        return {
          glow: "shadow-emerald-500/10 border-emerald-500/20",
          text: "text-emerald-400",
          badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
          button: "bg-emerald-950/40 border border-emerald-500/30 text-white hover:bg-emerald-600 hover:text-white",
          accentLine: "bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent",
        };
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderIndex(parseInt(e.target.value));
  };

  const selectPackage = (tier: PricingTier) => {
    onSelectTier(tier.name);
    const element = document.getElementById("booking-section");
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
    }
  };

  return (
    <section id="pricing-section" className="py-24 relative z-10 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <div className="text-center mb-16">
        <motion.span 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase font-mono font-medium tracking-widest text-[#E6C687] bg-[#E6C687]/5 border border-[#E6C687]/15 rounded-full px-4 py-1.5 inline-block mb-4"
        >
          Acquisition Pipeline
        </motion.span>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6"
        >
          Production Tiers & Packages
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base mb-10"
        >
          Whether deploying rapid content layers or full cinematic campaigns, we synchronize custom diffusion pipelines around your brand.
        </motion.p>
      </div>

      {/* INTERACTIVE PIPELINE SLIDER TOOL */}
      <div className="max-w-xl mx-auto mb-16 px-4">
        <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-[#E6C687] uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Dynamic Scale Controller
            </span>
            <span className="text-xs text-gray-400 font-mono">
              Level {sliderIndex + 1}: <span className="text-white font-medium">{activeTier.name}</span>
            </span>
          </div>

          {/* DYNAMIC PIPELINE SLIDER CONTROL */}
          <div className="relative mt-2 mb-6">
            <input
              type="range"
              min="0"
              max="2"
              step="1"
              value={sliderIndex}
              onChange={handleSliderChange}
              className="w-full h-1 bg-[#151525] rounded-full appearance-none cursor-pointer accent-[#E6C687]"
              style={{
                background: "linear-gradient(to right, #4A36B3 0%, #E6C687 100%)",
                height: "6px"
              }}
            />
            {/* Custom slider steps */}
            <div className="flex justify-between mt-2.5 px-1 text-[10px] font-mono text-gray-400">
              <span className={sliderIndex === 0 ? "text-white font-semibold" : ""}>Short-Form</span>
              <span className={sliderIndex === 1 ? "text-white font-semibold" : ""}>Cinematic Studio</span>
              <span className={sliderIndex === 2 ? "text-white font-semibold" : ""}>Enterprise Pipeline</span>
            </div>
          </div>

          {/* DYNAMIC SCALE READOUT */}
          <div className="text-center pt-2 text-xs text-gray-400 border-t border-white/5 flex justify-center items-center gap-1">
            <CornerDownRight className="w-3.5 h-3.5 text-amber-300" />
            Slide coordinate to toggle and focus the core architectural package below.
          </div>
        </div>
      </div>

      {/* 3-COLUMN GLASS TIERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
        {PRICING_TIERS.map((tier, index) => {
          const isActive = index === sliderIndex;
          const theme = getThemeColors(tier.glowTheme);

          return (
            <motion.div
              key={tier.id}
              id={`pricing-card-${tier.id}`}
              onClick={() => setSliderIndex(index)}
              initial={{ opacity: 0.8, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              whileHover={{
                scale: 1.03,
                transition: { type: "spring", stiffness: 120, damping: 10 }
              }}
              animate={{
                scale: isActive ? 1.02 : 0.98,
                opacity: isActive ? 1 : 0.65,
                borderColor: isActive ? "rgba(230, 198, 135, 0.4)" : "rgba(255, 255, 255, 0.08)"
              }}
              transition={{ type: "spring", stiffness: 150, damping: 18 }}
              className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative overflow-hidden cursor-pointer shadow-xl ${
                isActive ? `glass-panel shadow-2xl ${theme.glow}` : "glass-panel-light"
              }`}
            >
              {/* DECORATIVE BACKGROUND CHIPS */}
              {isActive && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#E6C687]/15 to-[#4A36B3]/15 rounded-full filter blur-xl pointer-events-none" />
              )}

              {/* CARD ACCENT LINE */}
              {isActive && (
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${theme.accentLine}`} />
              )}

              <div>
                {/* HEADER ROW */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    {tier.popular && (
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#E6C687] bg-[#E6C687]/10 px-3 py-1.5 rounded-full border border-[#E6C687]/20 flex items-center gap-1.5 mb-3.5">
                        <Flame className="w-3 h-3 text-[#E6C687] animate-pulse" />
                        Most Recommended
                      </span>
                    )}
                    <div className="text-[#E6C687] font-mono text-xs font-bold tracking-widest mb-1">
                      0{index + 1}
                    </div>
                    <h3 className="font-display font-medium text-2xl text-white tracking-tight">
                      {tier.name}
                    </h3>
                  </div>
                  <span className={`text-[10px] uppercase font-mono font-semibold px-2.5 py-1 rounded border ${theme.badge}`}>
                    {tier.glowTheme} scale
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-6 leading-relaxed min-h-[40px]">
                  {tier.tagline}
                </p>

                {/* PRICE AREA */}
                <div className="flex items-baseline gap-2 mb-8 border-b border-white/5 pb-6">
                  <span className="text-4xl md:text-5xl font-display font-semibold text-white tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-gray-400 font-mono text-xs">
                    / {tier.period}
                  </span>
                </div>

                {/* DELIVERABLES LIST */}
                <div className="space-y-4 mb-8">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-gray-400">
                    Syllabus of Execution
                  </h4>
                  <ul className="space-y-3">
                    {tier.deliverables.map((item, index) => (
                      <li key={index} className="flex items-start text-xs md:text-sm text-gray-300 gap-3">
                        <span className={`p-0.5 rounded-full bg-white/5 mt-0.5 border border-white/10 flex-shrink-0 ${isActive ? theme.text : "text-gray-500"}`}>
                          <Check className="w-3 h-3" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* METADATA CHIPS REVISIONS / TURNAROUNDS */}
              <div>
                <div className="grid grid-cols-2 gap-4 bg-black/20 border border-white/5 rounded-xl p-3.5 mb-6 text-xs font-mono">
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 font-light flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5 text-gray-500" /> Wait period
                    </span>
                    <span className="text-gray-100 font-medium">{tier.turnaround}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 font-light flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-gray-500" /> Iterations
                    </span>
                    <span className="text-gray-100 font-medium">{tier.revisionRound}</span>
                  </div>
                </div>

                {/* CALL TO ACTION BUTTON */}
                <button
                  type="button"
                  id={`pricing-btn-${tier.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectPackage(tier);
                  }}
                  className={`w-full py-3.5 rounded-2xl font-semibold font-display tracking-tight text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${
                    isActive 
                      ? theme.button + " shadow-xl shadow-[#E6C687]/5" 
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  Acquire Pipeline
                </button>
              </div>

            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
