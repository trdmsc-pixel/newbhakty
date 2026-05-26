import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Flame, Hourglass, RotateCcw, Sliders } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { PricingTier } from "../types";
import MilestoneSlider, { Milestone } from "./MilestoneSlider";

interface PricingSectionProps {
  onSelectTier: (tierName: string) => void;
}

export default function PricingSection({ onSelectTier }: PricingSectionProps) {
  const { pricingTiers = [], siteSettings, activePage } = useSiteData();
  const [sliderIndex, setSliderIndex] = useState<number>(1); // Default to "Full Cinematic Studio" (index 1)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cardMilestones, setCardMilestones] = useState<Record<string, Milestone>>({});

  const spotlightText = activePage === "live"
    ? (siteSettings.page2_pricing_spotlight_text || "Recommended")
    : (siteSettings.pricing_spotlight_text || "Recommended");

  const titleSize = activePage === "live"
    ? siteSettings.page2_pricing_title_size
    : siteSettings.pricing_title_size;

  const pricingSectionTitle = activePage === "live"
    ? (siteSettings.page2_pricing_title || "Production Tiers & Packages")
    : (siteSettings.pricing_title || "Production Tiers & Packages");

  const handleMilestoneChange = (tierId: string, milestone: Milestone) => {
    setCardMilestones(prev => ({ ...prev, [tierId]: milestone }));
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

  // Pricing formula helper functions
  const parsePrice = (priceStr: string): number => {
    const numericStr = priceStr.replace(/[^0-9.]/g, "");
    return parseFloat(numericStr) || 0;
  };

  const formatPrice = (value: number, originalStr: string): string => {
    const currencySymbol = originalStr.match(/^[^0-9]*/)?.[0] || "$";
    return `${currencySymbol}${Math.round(value).toLocaleString()}`;
  };

  return (
    <section id="pricing-section" className={`pt-8 pb-24 relative z-10 px-4 md:px-8 transition-all duration-500 ${
      siteSettings.website_full_width === "true" 
        ? "max-w-none w-full" 
        : "max-w-7xl mx-auto"
    }`}>
      
      {/* HEADER */}
      <div className="text-center mb-16">
        <motion.span 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4"
        >
          Acquisition Pipeline
        </motion.span>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6 pricing-title"
          style={titleSize ? { fontSize: titleSize } : undefined}
        >
          {pricingSectionTitle}
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

      {/* 3-COLUMN GLASS TIERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {pricingTiers.map((tier, index) => {
          // Whichever card is hovered gets highlighted. If no card is hovered, the selected card is highlighted.
          const isHighlighted = hoveredIndex !== null ? index === hoveredIndex : index === sliderIndex;

          const selectedMilestone = cardMilestones[tier.id];
          const hasSlider = tier.is_slider_enabled && tier.slider_milestones && tier.slider_milestones.length > 0;
          
          let displayPrice = tier.price;
          let displayOriginalPrice = tier.originalPrice;
          
          if (hasSlider && selectedMilestone) {
            const parsedBase = parsePrice(tier.price);
            if (parsedBase > 0) {
              const discounted = parsedBase * (1 - selectedMilestone.discount / 100);
              displayPrice = formatPrice(discounted, tier.price);
              if (selectedMilestone.discount > 0) {
                displayOriginalPrice = tier.price;
              }
            }
          }

          // Determine badge settings based on tier properties
          const getBadgeConfig = (glowTheme: string, tierId: string, discountText?: string) => {
            if (discountText) {
              const bgStart = siteSettings.discount_badge_gradient_start || "#10ac84";
              const bgEnd = siteSettings.discount_badge_gradient_end || "#01a3a4";
              const isGradient = siteSettings.discount_badge_gradient_enabled !== "false";
              const txtColor = siteSettings.discount_badge_text_color || "#ffffff";
              
              const darkenHex = (hex: string, percent: number) => {
                try {
                  const cleaned = hex.startsWith("#") ? hex : "#" + hex;
                  const num = parseInt(cleaned.replace("#",""), 16);
                  const amt = Math.round(2.55 * percent);
                  let R = (num >> 16) - amt;
                  let G = (num >> 8 & 0x00FF) - amt;
                  let B = (num & 0x0000FF) - amt;
                  R = R < 0 ? 0 : R > 255 ? 255 : R;
                  G = G < 0 ? 0 : G > 255 ? 255 : G;
                  B = B < 0 ? 0 : B > 255 ? 255 : B;
                  return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
                } catch (e) {
                  return "#0a6b51";
                }
              };

              const foldColor = darkenHex(bgStart, 30);

              return {
                text: discountText.toUpperCase(),
                gradient: "",
                customStyle: {
                  background: isGradient 
                    ? `linear-gradient(to bottom, ${bgStart}, ${bgEnd})`
                    : bgStart,
                  color: txtColor,
                  boxShadow: `0 8px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.4)`
                },
                textColor: "",
                fold: foldColor,
                glow: "rgba(0, 0, 0, 0.3)",
                iconColor: "",
                icon: Flame
              };
            }
            if (tierId === "short-form") {
              return {
                text: "BEST VALUE",
                gradient: "from-[#00b894] via-[#05c46b] to-[#10ac84]",
                glow: "rgba(29, 209, 161, 0.45)",
                fold: "#0a6b51",
                iconColor: "text-emerald-100",
                textColor: "text-white",
                icon: Flame
              };
            }
            if (tierId === "cinematic" || tier.popular) {
              return null;
            }
            if (tierId === "enterprise") {
              return {
                text: "ELITE SETUP",
                gradient: "from-[#a29bfe] via-[#6c5ce7] to-[#4834d4]",
                glow: "rgba(108, 92, 231, 0.45)",
                fold: "#271b80",
                iconColor: "text-indigo-100",
                textColor: "text-white",
                icon: Flame
              };
            }
            return null;
          };

          const badge = getBadgeConfig(tier.glowTheme, tier.id, tier.discountEnabled ? tier.discountText : undefined);

          return (
            <motion.div
              key={tier.id}
              id={`pricing-card-${tier.id}`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => setSliderIndex(index)}
              initial={{ opacity: 0.8, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              animate={{
                scale: isHighlighted ? 1.02 : 0.98,
                opacity: isHighlighted ? 1 : 0.65,
                borderColor: isHighlighted ? "rgba(255, 234, 0, 0.4)" : "rgba(255, 255, 255, 0.08)"
              }}
              transition={{ type: "spring", stiffness: 150, damping: 18 }}
              className={`rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 relative cursor-pointer shadow-xl border ${
                isHighlighted ? "bg-[#0b0c05] shadow-2xl border-accent/30" : "bg-[#070505]/45 border-white/5"
              }`}
            >
              {/* CARD ACCENT LINE */}
              {isHighlighted && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
              )}

              {/* 3D RIBBON OVERLAY BADGE */}
              {badge && (
                <motion.div
                  className="absolute -top-[14px] right-8 z-30 flex flex-col items-center pointer-events-none select-none"
                  animate={isHighlighted ? {
                    y: [0, -5, 0],
                    scale: [1, 1.03, 1],
                  } : {
                    y: 0,
                    scale: 1,
                  }}
                  transition={isHighlighted ? {
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : undefined}
                >
                  {/* Ribbon Body */}
                  <div
                    className={`relative px-2.5 pt-3.5 pb-4 text-center font-display font-black shadow-lg ${badge.gradient ? `bg-gradient-to-b ${badge.gradient}` : ""} ${badge.textColor || ""}`}
                    style={{
                      clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 50% 88%, 0% 100%)",
                      minWidth: "60px",
                      minHeight: "72px",
                      boxShadow: badge.customStyle?.boxShadow || `0 8px 20px ${badge.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                      ...(badge.customStyle || {})
                    }}
                  >
                    {/* Shimmer line effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent opacity-65 animate-pulse" />
                    
                    <badge.icon 
                      className={`w-3.5 h-3.5 mx-auto mb-1 ${badge.iconColor || ""} drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] animate-bounce`} 
                      style={badge.customStyle?.color ? { color: badge.customStyle.color } : undefined}
                    />
                    
                    <div className="flex flex-col gap-0.5 leading-none">
                      {badge.text.split(" ").map((word, wIdx) => (
                        <span
                          key={wIdx}
                          className={`text-[8px] uppercase tracking-wider font-extrabold font-sans`}
                          style={badge.customStyle?.color ? { color: badge.customStyle.color } : undefined}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 3D Fold Corners Behind Card Edge */}
                  <div
                    className="absolute z-[-1]"
                    style={{
                      left: "-6px",
                      top: "14px",
                      width: "6px",
                      height: "8px",
                      backgroundColor: badge.fold,
                      clipPath: "polygon(100% 0, 0 0, 100% 100%)"
                    }}
                  />
                  <div
                    className="absolute z-[-1]"
                    style={{
                      right: "-6px",
                      top: "14px",
                      width: "6px",
                      height: "8px",
                      backgroundColor: badge.fold,
                      clipPath: "polygon(0 0, 0 100%, 100% 0)"
                    }}
                  />
                </motion.div>
              )}

              <div>
                {/* 5th Image Box: Top Distinct Header Card Box */}
                <div className={`rounded-2xl p-6 mb-6 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                  isHighlighted 
                    ? "active-pricing-header text-black" 
                    : "bg-white/[0.02] border border-white/5 text-white"
                }`}>
                  {/* Decorative background chip inside header */}
                  {isHighlighted && (
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br from-white/20 to-transparent rounded-full filter blur-lg pointer-events-none" />
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className={`package-title h3 font-bold tracking-widest ${isHighlighted ? "text-black/60" : "text-accent"}`}>
                        {tier.name.toUpperCase().split(" ")[0]}
                      </h3>
                      {tier.popular && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-[#ffd600] to-[#ffaa00] text-black shadow-[0_0_12px_rgba(255,214,0,0.4)] border border-white/20 animate-pulse">
                          {spotlightText}
                        </span>
                      )}
                    </div>
                    
                    {/* Price read-out */}
                    <div className="flex items-baseline flex-wrap gap-2 mt-2 mb-3">
                      {displayOriginalPrice && (
                        <span className={`text-lg font-mono line-through mr-1 decoration-yellow-500/50 ${isHighlighted ? "text-black/40" : "text-gray-500"}`}>
                          {displayOriginalPrice}
                        </span>
                      )}
                      <div className="relative flex items-baseline overflow-visible">
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={displayPrice}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="text-4xl md:text-5xl font-display font-semibold tracking-tight inline-block whitespace-nowrap"
                          >
                            {displayPrice}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <span className={`font-mono text-xs ${isHighlighted ? "text-black/60" : "text-gray-400"} self-end pb-1`}>
                        / {tier.period}
                      </span>
                    </div>

                    {/* Offer Highlight Box */}
                    {tier.offerText && (
                      <div 
                        className={`offer-highlight mt-2 mb-3 px-3 py-1.5 rounded-xl text-center text-[10px] font-black uppercase tracking-widest ${
                          tier.offerAnimation === "pulse" 
                            ? "animate-offer-pulse" 
                            : (tier.offerAnimation === "shimmer" ? "animate-offer-shimmer" : "")
                        }`}
                        style={{
                          color: tier.offerTextColor || "#ffffff",
                          background: tier.offerBgColor || (isHighlighted ? "#000000" : "var(--color-accent)"),
                          border: "1px solid rgba(255,255,255,0.08)"
                        }}
                      >
                        {tier.offerText}
                      </div>
                    )}
                  </div>

                  <p className={`text-xs leading-relaxed mt-2 ${isHighlighted ? "text-black/75" : "text-gray-400"} min-h-[40px]`}>
                    {tier.tagline}
                  </p>
                </div>

                {/* MILESTONE SLIDER */}
                {hasSlider && (
                  <div className="px-2 mb-6">
                    <MilestoneSlider
                      milestones={tier.slider_milestones || []}
                      basePrice={tier.price}
                      glowTheme={tier.glowTheme}
                      onChange={(milestone) => handleMilestoneChange(tier.id, milestone)}
                    />
                  </div>
                )}

                {/* DELIVERABLES LIST */}
                <div className="space-y-4 mb-8 px-2">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-gray-400">
                    Syllabus of Execution
                  </h4>
                  <ul className="space-y-3">
                    {tier.deliverables.map((item, dIdx) => (
                      <li key={dIdx} className="flex items-start text-xs md:text-sm text-gray-300 gap-3">
                        <span className={`p-0.5 rounded-full bg-white/5 mt-0.5 border border-white/10 flex-shrink-0 ${isHighlighted ? "text-accent border-accent/30 bg-accent/5" : "text-gray-500"}`}>
                          <Check className="w-3 h-3" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* METADATA CHIPS REVISIONS / TURNAROUNDS */}
              <div className="px-2">
                <div className="grid grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-xl p-3.5 mb-6 text-xs font-mono">
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
                    isHighlighted 
                      ? "bg-accent text-black shadow-xl shadow-accent/10 hover-glow-yellow" 
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/10"
                  }`}
                >
                  {tier.buttonLabel || "Acquire Pipeline"}
                </button>
              </div>

            </motion.div>
          );
        })}
      </div>

      {/* NOTE PANEL */}
      {siteSettings.pricing_note_text && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-none px-0 mt-20"
        >
          <div className="glass-panel rounded-none border-x-0 py-4 px-12 md:px-16 border-y border-white/10 shadow-2xl relative overflow-hidden flex flex-row items-center gap-6 text-left bg-gradient-to-r from-yellow-950/10 via-black/60 to-yellow-950/5 bg-black/40">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full filter blur-2xl pointer-events-none" />
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-accent shrink-0">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-xs font-mono font-bold tracking-widest text-accent uppercase">Custom Scope & Integrations</h4>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed font-sans">
                {siteSettings.pricing_note_text}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
