import React, { useRef, useState, useEffect, useCallback } from "react";
import { animate } from "motion/react";

export interface Milestone {
  label: string;
  discount: number;
}

interface MilestoneSliderProps {
  milestones: Milestone[];
  basePrice: string;
  glowTheme: "saffron" | "violet" | "emerald";
  onChange: (milestone: Milestone) => void;
}

const parsePrice = (priceStr: string): number => {
  const numericStr = priceStr.replace(/[^0-9.]/g, "");
  return parseFloat(numericStr) || 0;
};

const formatPrice = (value: number, originalStr: string): string => {
  const currencySymbol = originalStr.match(/^[^0-9]*/)?.[0] || "$";
  return `${currencySymbol}${Math.round(value).toLocaleString()}`;
};

export default function MilestoneSlider({
  milestones,
  basePrice,
  glowTheme,
  onChange
}: MilestoneSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMilestoneIndex, setActiveMilestoneIndex] = useState(0);
  
  // High-performance direct DOM references and lightweight state variables
  const currentPctRef = useRef(0);
  const tickRefs = useRef<HTMLDivElement[]>([]);

  const parseBase = parsePrice(basePrice);

  // Debounced parent onChange execution ref to prevent pricing recalculation overloads during active dragging
  const debouncedOnChangeTimeout = useRef<any>(null);

  const triggerChangeDebounced = useCallback((milestone: Milestone) => {
    if (debouncedOnChangeTimeout.current) {
      clearTimeout(debouncedOnChangeTimeout.current);
    }
    debouncedOnChangeTimeout.current = setTimeout(() => {
      onChange(milestone);
    }, 80); // 80ms throttle/debounce
  }, [onChange]);

  // Synchronize initial milestone index and first selection
  useEffect(() => {
    if (milestones && milestones.length > 0) {
      onChange(milestones[0]);
    }
  }, []);

  // Add body class on dragging to disable backdrop blur filters dynamically on mobile
  useEffect(() => {
    if (isDragging) {
      document.body.classList.add("is-dragging-active");
    } else {
      document.body.classList.remove("is-dragging-active");
    }
    return () => {
      document.body.classList.remove("is-dragging-active");
    };
  }, [isDragging]);

  // Clean up debouncing timeout on unmount
  useEffect(() => {
    return () => {
      if (debouncedOnChangeTimeout.current) {
        clearTimeout(debouncedOnChangeTimeout.current);
      }
    };
  }, []);

  const activeColor = glowTheme === "emerald" 
    ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" 
    : (glowTheme === "saffron" ? "bg-amber-400 shadow-[0_0_12px_#fbbf24]" : "bg-cyan-400 shadow-[0_0_12px_#22d3ee]");

  const thumbColor = glowTheme === "emerald" 
    ? "border-emerald-400 bg-emerald-950/80 shadow-[0_0_15px_rgba(52,211,153,0.6)]" 
    : (glowTheme === "saffron" ? "border-amber-400 bg-amber-950/80 shadow-[0_0_15px_rgba(251,191,36,0.6)]" : "border-cyan-400 bg-cyan-950/80 shadow-[0_0_15px_rgba(34,211,238,0.6)]");

  // Synchronize CSS variable position on mount or when milestones/active index changes
  useEffect(() => {
    if (trackRef.current && milestones.length > 0) {
      const pct = (activeMilestoneIndex / (milestones.length - 1)) * 100;
      trackRef.current.style.setProperty("--slider-pct", `${pct}%`);
      currentPctRef.current = pct;
      
      // Direct DOM sync of initial ticks
      tickRefs.current.forEach((tick) => {
        if (!tick) return;
        const tickPct = parseFloat(tick.getAttribute("data-pct") || "0");
        if (tickPct <= pct) {
          tick.className = `w-[2px] h-3.5 rounded-full transition-all duration-150 ${activeColor}`;
        } else {
          tick.className = "w-[2px] h-3.5 rounded-full transition-all duration-150 bg-white/15";
        }
      });
    }
  }, [milestones, activeMilestoneIndex, activeColor]);

  // Update current active index and trigger debounced parent callback
  const handleMilestoneIndexUpdate = (pct: number, forceSync = false) => {
    if (!milestones || milestones.length === 0) return;
    const step = 100 / (milestones.length - 1);
    const index = Math.max(0, Math.min(milestones.length - 1, Math.round(pct / step)));
    
    if (index !== activeMilestoneIndex) {
      setActiveMilestoneIndex(index);
      if (forceSync) {
        if (debouncedOnChangeTimeout.current) {
          clearTimeout(debouncedOnChangeTimeout.current);
        }
        onChange(milestones[index]);
      } else {
        triggerChangeDebounced(milestones[index]);
      }
    }
  };

  const snapToNearestMilestone = (currentPct: number) => {
    if (!milestones || milestones.length <= 1) return;
    let nearestIndex = 0;
    let minDiff = 100;
    milestones.forEach((_, idx) => {
      const milestonePct = (idx / (milestones.length - 1)) * 100;
      const diff = Math.abs(currentPct - milestonePct);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = idx;
      }
    });

    const targetPct = (nearestIndex / (milestones.length - 1)) * 100;
    
    // Strict linear snapping tween animation on release (MouseUp / TouchEnd / click)
    animate(currentPct, targetPct, {
      type: "tween",
      duration: 0.15,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (trackRef.current) {
          trackRef.current.style.setProperty("--slider-pct", `${latest}%`);
        }
        tickRefs.current.forEach((tick) => {
          if (!tick) return;
          const tickPct = parseFloat(tick.getAttribute("data-pct") || "0");
          if (tickPct <= latest) {
            tick.className = `w-[2px] h-3.5 rounded-full transition-all duration-150 ${activeColor}`;
          } else {
            tick.className = "w-[2px] h-3.5 rounded-full transition-all duration-150 bg-white/15";
          }
        });
        currentPctRef.current = latest;
        const isFinal = latest === targetPct;
        handleMilestoneIndexUpdate(latest, isFinal);
      },
      onComplete: () => {
        setActiveMilestoneIndex(nearestIndex);
        if (debouncedOnChangeTimeout.current) {
          clearTimeout(debouncedOnChangeTimeout.current);
        }
        onChange(milestones[nearestIndex]);
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Bypassing touch pointer events to handle them via native passive touch listeners
    if (e.pointerType === "touch") return;

    const track = trackRef.current;
    if (!track || milestones.length <= 1) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);

    const updatePosition = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      
      // Direct DOM update of slider percentage CSS variable
      track.style.setProperty("--slider-pct", `${pct}%`);
      currentPctRef.current = pct;

      // Direct DOM update of ticks to avoid React re-renders during active drag
      tickRefs.current.forEach((tick) => {
        if (!tick) return;
        const tickPct = parseFloat(tick.getAttribute("data-pct") || "0");
        if (tickPct <= pct) {
          tick.className = `w-[2px] h-3.5 rounded-full transition-all duration-150 ${activeColor}`;
        } else {
          tick.className = "w-[2px] h-3.5 rounded-full transition-all duration-150 bg-white/15";
        }
      });

      handleMilestoneIndexUpdate(pct);
    };

    updatePosition(e.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePosition(moveEvent.clientX);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      setIsDragging(false);
      track.removeEventListener("pointermove", handlePointerMove);
      track.removeEventListener("pointerup", handlePointerUp);
      try {
        (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
      } catch (err) {}
      
      snapToNearestMilestone(currentPctRef.current);
    };

    track.addEventListener("pointermove", handlePointerMove);
    track.addEventListener("pointerup", handlePointerUp);
  };

  // Bind passive touch event listeners natively to prevent scroll lock and browser main thread lags
  useEffect(() => {
    const track = trackRef.current;
    if (!track || milestones.length <= 1) return;

    let isTouchDragging = false;

    const updatePosition = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      
      // Direct DOM update of slider percentage CSS variable
      track.style.setProperty("--slider-pct", `${pct}%`);
      currentPctRef.current = pct;

      // Direct DOM update of ticks
      tickRefs.current.forEach((tick) => {
        if (!tick) return;
        const tickPct = parseFloat(tick.getAttribute("data-pct") || "0");
        if (tickPct <= pct) {
          tick.className = `w-[2px] h-3.5 rounded-full transition-all duration-150 ${activeColor}`;
        } else {
          tick.className = "w-[2px] h-3.5 rounded-full transition-all duration-150 bg-white/15";
        }
      });

      handleMilestoneIndexUpdate(pct);
    };

    const handleTouchStart = (e: TouchEvent) => {
      isTouchDragging = true;
      setIsDragging(true);
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchDragging) return;
      if (e.touches.length > 0) {
        updatePosition(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      if (!isTouchDragging) return;
      isTouchDragging = false;
      setIsDragging(false);
      snapToNearestMilestone(currentPctRef.current);
    };

    track.addEventListener("touchstart", handleTouchStart, { passive: true });
    track.addEventListener("touchmove", handleTouchMove, { passive: true });
    track.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      track.removeEventListener("touchstart", handleTouchStart);
      track.removeEventListener("touchmove", handleTouchMove);
      track.removeEventListener("touchend", handleTouchEnd);
    };
  }, [milestones, basePrice, activeMilestoneIndex, activeColor]);

  const handleNodeClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (milestones.length <= 1) return;
    const targetPct = (idx / (milestones.length - 1)) * 100;
    snapToNearestMilestone(targetPct);
  };

  const numTicks = 35;
  const ticks = Array.from({ length: numTicks });

  return (
    <div className="w-full flex flex-col relative py-4 mb-4 select-none">
      {/* 1. Milestone Labels & Vertical Connectors Layer */}
      <div className="relative w-full h-[76px]">
        {milestones.map((m, idx) => {
          const pct = (idx / (milestones.length - 1)) * 100;
          const isActive = idx === activeMilestoneIndex;
          const discountedValue = parseBase * (1 - m.discount / 100);
          const displayPrice = parseBase > 0 ? formatPrice(discountedValue, basePrice) : basePrice;

          return (
            <div key={idx} className="absolute inset-0 pointer-events-none">
              {/* Pre-rendered, GPU-accelerated Milestone Label */}
              <div 
                className={`slider-milestone-pill glow-${glowTheme} ${isActive ? "is-active" : ""}`}
                style={{ left: `${pct}%` }}
              >
                <span className="text-[10px] font-sans font-bold tracking-tight text-white/90 leading-tight">
                  {m.label}
                </span>
                <span className="text-[9px] font-mono text-cyan-400 font-semibold mt-0.5 leading-none">
                  {m.discount > 0 ? `${displayPrice} (-${m.discount}%)` : displayPrice}
                </span>
              </div>

              {/* Vertical connector line */}
              <div 
                className={`absolute bottom-0 w-[1px] -translate-x-1/2 transition-all duration-300 ${
                  isActive ? "bg-cyan-400/50 h-[36px]" : "bg-white/10 h-[30px]"
                }`}
                style={{ left: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* 2. Slider Track & Spherical Milestone Nodes Layer */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative w-full h-8 flex items-center cursor-pointer select-none"
        style={{
          willChange: "transform, opacity",
          transform: "translate3d(0,0,0)",
          touchAction: "none"
        }}
      >
        {/* Track Ticks (Dashes) */}
        <div className="w-full h-2 flex justify-between items-center px-1">
          {ticks.map((_, i) => {
            const tickPct = (i / (numTicks - 1)) * 100;
            const isActive = tickPct <= currentPctRef.current;
            
            return (
              <div 
                key={i}
                ref={(el) => {
                  if (el) tickRefs.current[i] = el;
                }}
                data-pct={tickPct}
                className={`w-[2px] h-3.5 rounded-full transition-all duration-150 ${
                  isActive ? activeColor : "bg-white/15"
                }`}
              />
            );
          })}
        </div>

        {/* Pre-rendered, GPU-accelerated Milestone Nodes */}
        {milestones.map((_, idx) => {
          const pct = (idx / (milestones.length - 1)) * 100;
          const isActive = idx <= activeMilestoneIndex;

          return (
            <div
              key={idx}
              onClick={(e) => handleNodeClick(idx, e)}
              className={`slider-milestone-node glow-${glowTheme} ${isActive ? "is-active" : ""}`}
              style={{ left: `${pct}%` }}
            >
              {/* Central Dot */}
              <div className="w-[6px] h-[6px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
            </div>
          );
        })}

        {/* 3. Snappy linear Handle Thumb (1:1 tracking during drag, linear transition on snapping release) */}
        <div
          className={`absolute top-1/2 w-6 h-6 rounded-full border-2 cursor-grab active:cursor-grabbing z-20 flex items-center justify-center transition-opacity duration-300 ${thumbColor}`}
          style={{
            left: 0,
            transform: "translate3d(calc(var(--slider-pct, 0%) - 12px), -50%, 0)",
            willChange: "transform",
          }}
        >
          {/* Inner accent ring */}
          <div className="w-[10px] h-[10px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </div>
      </div>
    </div>
  );
}
