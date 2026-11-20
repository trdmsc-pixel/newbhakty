import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
  previewUrl?: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className = "",
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) {
      window.addEventListener("mousedown", handleOutside);
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const selected = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.meta && opt.meta.toLowerCase().includes(q))
    );
  }, [options, search]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 rounded-full text-admin-body text-left transition-all duration-150 cursor-pointer border ${
          compact ? "h-[2.75rem] px-4" : "h-[3.25rem] px-5"
        } ${
          open
            ? "bg-[#20242F] border-[#FF6A1F] shadow-[0_0_0_3px_rgba(255,106,31,0.45)] text-[#F4EFE6]"
            : "bg-[#181B24] border-white/[0.08] hover:border-white/[0.18] text-[#F4EFE6]"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selected?.previewUrl && (
            <img
              src={selected.previewUrl}
              alt=""
              className="w-7 h-7 rounded-lg object-contain bg-[#07080C] border border-white/10 p-0.5 shrink-0"
              referrerPolicy="no-referrer"
            />
          )}
          <span
            className={`truncate ${
              selected ? "text-[#F4EFE6] font-semibold" : "text-[#F4EFE6]/45"
            }`}
          >
            {selected ? selected.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[#FF6A1F]" : "text-[#F4EFE6]/60"
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[130] rounded-[1.25rem] bg-[#181B24] border border-white/20 shadow-admin-floating overflow-hidden"
          >
            {options.length > 5 && (
              <div className="p-2.5 border-b border-white/10 bg-[#11131A]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#F4EFE6]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter options..."
                    autoFocus
                    className="w-full !pl-9 !pr-3 !py-2 !text-admin-meta !rounded-full bg-[#181B24] border border-white/10 text-[#F4EFE6] placeholder:text-[#F4EFE6]/40 focus:outline-none focus:border-[#FF6A1F]"
                  />
                </div>
              </div>
            )}

            <div className="p-2 max-h-72 overflow-y-auto space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-4 text-admin-meta text-[#F4EFE6]/55 text-center">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={`${opt.value}-${opt.label}`}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-full text-admin-body text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#FF6A1F]/15 border border-[#FF6A1F]/40 text-[#F4EFE6] font-semibold"
                          : "border border-transparent text-[#F4EFE6]/80 hover:bg-[#20242F] hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {opt.previewUrl && (
                          <img
                            src={opt.previewUrl}
                            alt=""
                            className="w-7 h-7 rounded-lg object-contain bg-[#07080C] border border-white/10 p-0.5 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <span className="block truncate">{opt.label}</span>
                          {opt.meta && (
                            <span className="block text-admin-eyebrow text-[#F4EFE6]/50 truncate mt-0.5">
                              {opt.meta}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#FF6A1F] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
