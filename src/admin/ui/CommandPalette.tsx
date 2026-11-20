import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { Search, Compass, Film, Image, MessageSquare, BarChart3, Users, Settings, FolderOpen, Send, Lock } from "lucide-react";

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  items,
}) => {
  const [query, setQuery] = useState("");

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Command Palette" description="Navigate to any studio panel or run actions instantly (⌘K)">
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-5 h-5 text-[#F4EFE6]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tabs, actions, or tools..."
            autoFocus
            className="w-full h-[3.25rem] rounded-full bg-[#181B24] border border-white/[0.12] pl-12 pr-5 text-admin-body text-[#F4EFE6] placeholder:text-[#F4EFE6]/40 focus:outline-none focus:border-[#FF6A1F]"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-admin-meta text-[#F4EFE6]/45">
              No results found for "{query}"
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-[1.25rem] hover:bg-[#181B24] text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] group-hover:bg-[#FF6A1F]/20 text-[#F4EFE6] group-hover:text-[#FF6A1F] flex items-center justify-center shrink-0 transition-colors">
                    {item.icon || <Compass className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-admin-body font-semibold text-[#F4EFE6] truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-admin-meta text-[#F4EFE6]/50 truncate">
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {item.shortcut && (
                  <span className="text-admin-meta font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#F4EFE6]/60">
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
};
