import React, { useState, useRef, useEffect } from "react";
import {
  Inbox,
  FolderOpen,
  BarChart3,
  Users,
  MessageSquare,
  Sliders,
  ExternalLink,
  LogOut,
  User,
} from "lucide-react";
import { IconButton } from "../ui/IconButton";
import { Button } from "../ui/Button";

export interface IconRailProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadInquiries?: number;
  unreadChats?: number;
  unreadFeedback?: number;
  userEmail?: string;
  onLogout: () => void;
  className?: string;
}

export const IconRail: React.FC<IconRailProps> = ({
  activeTab,
  onTabChange,
  unreadInquiries = 0,
  unreadChats = 0,
  unreadFeedback = 0,
  userEmail = "studio@thechantingstudio.in",
  onLogout,
  className = "",
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      window.addEventListener("mousedown", handleOutside);
    }
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [userMenuOpen]);

  return (
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      {/* Round utility icon buttons with tooltips & badges */}
      <IconButton
        label="Project Inquiries"
        shortcut="⌘1"
        badge={unreadInquiries > 0 ? unreadInquiries : undefined}
        variant={activeTab === "submissions" ? "accent" : "surface"}
        onClick={() => onTabChange("submissions")}
      >
        <Inbox className="w-5 h-5" />
      </IconButton>

      <IconButton
        label="Media Assets Library"
        shortcut="⌘2"
        variant={activeTab === "assets" ? "accent" : "surface"}
        onClick={() => onTabChange("assets")}
      >
        <FolderOpen className="w-5 h-5" />
      </IconButton>

      <IconButton
        label="Analytics Intelligence"
        shortcut="⌘3"
        variant={activeTab === "analytics" ? "accent" : "surface"}
        onClick={() => onTabChange("analytics")}
      >
        <BarChart3 className="w-5 h-5" />
      </IconButton>

      <IconButton
        label="Client Access & Review Studio"
        shortcut="⌘4"
        badge={unreadFeedback > 0 ? unreadFeedback : undefined}
        variant={activeTab === "client_access" ? "accent" : "surface"}
        onClick={() => onTabChange("client_access")}
      >
        <Users className="w-5 h-5" />
      </IconButton>

      <IconButton
        label="Live Support Chats"
        shortcut="⌘5"
        badge={unreadChats > 0 ? unreadChats : undefined}
        variant={activeTab === "live_chats" ? "accent" : "surface"}
        onClick={() => onTabChange("live_chats")}
      >
        <MessageSquare className="w-5 h-5" />
      </IconButton>

      <IconButton
        label="Concierge & Chat Config"
        variant={activeTab === "chat_settings" ? "accent" : "surface"}
        onClick={() => onTabChange("chat_settings")}
      >
        <Sliders className="w-5 h-5" />
      </IconButton>

      <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block shrink-0" />

      {/* Live site ↗ pill button */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center gap-2 h-[2.75rem] px-4 rounded-full bg-[#181B24] border border-white/[0.08] hover:bg-[#20242F] text-[#F4EFE6] text-admin-label font-medium transition-colors"
      >
        <span>Live site</span>
        <ExternalLink className="w-3.5 h-3.5 text-[#FF6A1F]" />
      </a>

      {/* Avatar / Logout menu */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen((prev) => !prev)}
          title="Account profile & sign out"
          aria-label="User account menu"
          className="w-[2.75rem] h-[2.75rem] rounded-full bg-gradient-to-br from-[#FF6A1F]/20 to-[#E8332A]/20 border border-[#FF6A1F]/30 text-[#FFC93C] flex items-center justify-center font-mono font-bold text-xs hover:border-[#FF6A1F] transition-all cursor-pointer shadow-sm"
        >
          <User className="w-5 h-5" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-[140] w-64 rounded-[1.25rem] bg-[#181B24] border border-white/[0.16] shadow-admin-floating p-2 animate-in fade-in zoom-in-95">
            <div className="px-4 py-3 border-b border-white/[0.08]">
              <p className="text-admin-meta text-[#F4EFE6]/50 font-medium">Signed in as</p>
              <p className="text-admin-body text-xs font-mono text-[#F4EFE6] truncate mt-0.5">
                {userEmail}
              </p>
            </div>

            <div className="p-1">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-admin-label font-medium text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
