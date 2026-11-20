import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check } from "lucide-react";

export interface StudioSelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface StudioSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: StudioSelectOption[];
  placeholder?: string;
  className?: string;
}

export const StudioSelect: React.FC<StudioSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener("mousedown", handleOutside);
    }
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-sans text-left transition-all duration-200 cursor-pointer border ${
          open
            ? "bg-[#171B27] border-[#FF6A1F]/70 shadow-[0_0_0_3px_rgba(255,106,31,0.16)] text-[#F4EFE6]"
            : "bg-[#12151F] border-white/[0.11] hover:border-white/25 text-[#F4EFE6]"
        }`}
      >
        <span className={`truncate ${selected ? "text-[#F4EFE6]" : "text-[#F4EFE6]/45"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[#F4EFE6]/60 transition-transform duration-200 ${
            open ? "rotate-180 text-[#FF6A1F]" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-[90] rounded-2xl bg-[#11141E]/98 backdrop-blur-xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.75)] p-1.5 max-h-64 overflow-y-auto"
          >
            {options.length === 0 ? (
              <div className="px-3.5 py-3 text-xs font-mono text-[#F4EFE6]/45 text-center">
                No options available
              </div>
            ) : (
              options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-sans text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#FF6A1F]/15 text-[#F4EFE6] font-medium"
                        : "text-[#F4EFE6]/80 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.meta && (
                        <span className="block text-[11px] font-mono text-[#F4EFE6]/45 truncate">
                          {opt.meta}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#FF6A1F] shrink-0" />}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioSelect;
