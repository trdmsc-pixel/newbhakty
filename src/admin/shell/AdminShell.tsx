import React, { useState } from "react";
import { Wordmark } from "../../components/brand/Wordmark";
import { TopPillNav } from "./TopPillNav";
import { IconRail } from "./IconRail";
import { CommandPalette, CommandItem } from "../ui/CommandPalette";
import { ChevronDown, FileText, Film, Inbox, FolderOpen, Menu, X, Sparkles } from "lucide-react";

export interface AdminShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadInquiries?: number;
  userEmail?: string;
  onLogout: () => void;
  commandItems: CommandItem[];
  children: React.ReactNode;
}

export const MAIN_WEBSITE_TABS = [
  { id: "settings", label: "Hero & Copy" },
  { id: "brand_logos", label: "Brand Logos" },
  { id: "portfolio", label: "Selected Work" },
  { id: "testimonials", label: "Testimonials" },
  { id: "intake_form", label: "Inquiry Form" },
  { id: "navigation", label: "Navigation" },
];

export const AdminShell: React.FC<AdminShellProps> = ({
  activeTab,
  onTabChange,
  unreadInquiries = 0,
  userEmail,
  onLogout,
  commandItems,
  children,
}) => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownPillOpen, setDropdownPillOpen] = useState(false);

  // ⌘K global shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeTabMeta =
    MAIN_WEBSITE_TABS.find((t) => t.id === activeTab) || {
      id: activeTab,
      label:
        activeTab === "submissions"
          ? "Inquiries"
          : activeTab === "assets"
          ? "Media Assets"
          : activeTab === "analytics"
          ? "Analytics"
          : "Studio Workspace",
    };

  return (
    <div className="tcs-admin min-h-screen flex flex-col bg-[#07080C] text-[#F4EFE6] select-none">
      {/* 4.1 Sticky Header (5.5rem, full width, 85% + blur) */}
      <header className="sticky top-0 z-40 w-full h-[5.5rem] bg-[#07080C]/85 backdrop-blur-xl border-b border-white/[0.08] flex items-center">
        <div className="w-full px-4 sm:px-8 lg:px-10 flex items-center justify-between gap-4">
          {/* Left: Brand Wordmark (20px cap height) + Studio CMS */}
          <div className="flex items-center gap-3.5 shrink-0">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center group transition-opacity hover:opacity-90"
            >
              <Wordmark capHeight={20} ringAnimation="spin-slow" />
            </a>

            <div className="h-5 w-px bg-white/10 hidden sm:block shrink-0" />

            <span className="text-admin-meta text-[#F4EFE6]/50 font-mono hidden sm:inline-block">
              Studio CMS
            </span>
          </div>

          {/* Center: Top Pill Nav (≥1280px) */}
          <div className="hidden xl:flex items-center justify-center flex-1">
            <TopPillNav
              tabs={MAIN_WEBSITE_TABS}
              activeTab={activeTab}
              onTabChange={onTabChange}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            />
          </div>

          {/* Center collapse (<1280px & ≥768px): Dropdown Pill */}
          <div className="hidden md:flex xl:hidden relative">
            <button
              type="button"
              onClick={() => setDropdownPillOpen((prev) => !prev)}
              className="h-[3rem] px-5 rounded-full bg-[#F4EFE6] text-[#07080C] font-semibold text-admin-label flex items-center gap-2.5 shadow-md cursor-pointer"
            >
              <span>{activeTabMeta.label}</span>
              <ChevronDown className="w-4 h-4 text-[#07080C]/70" />
            </button>

            {dropdownPillOpen && (
              <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-56 rounded-[1.25rem] bg-[#181B24] border border-white/[0.16] shadow-admin-floating p-2 animate-in fade-in zoom-in-95">
                {MAIN_WEBSITE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onTabChange(t.id);
                      setDropdownPillOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-admin-label font-medium transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? "bg-[#FF6A1F]/20 text-[#FF6A1F] font-semibold"
                        : "text-[#F4EFE6]/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Icon Rail (≥768px) */}
          <div className="hidden md:flex items-center">
            <IconRail
              activeTab={activeTab}
              onTabChange={onTabChange}
              unreadInquiries={unreadInquiries}
              userEmail={userEmail}
              onLogout={onLogout}
            />
          </div>

          {/* Mobile menu hamburger (<768px) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle menu"
              className="w-11 h-11 rounded-full bg-[#181B24] border border-white/[0.08] text-[#F4EFE6] flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Sheet (<768px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[5.5rem] z-50 bg-[#07080C]/95 backdrop-blur-2xl p-6 flex flex-col justify-between overflow-y-auto md:hidden animate-in fade-in">
          <div className="space-y-6">
            <div>
              <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest mb-3">
                WEBSITE SECTIONS
              </p>
              <div className="grid grid-cols-1 gap-2">
                {MAIN_WEBSITE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onTabChange(t.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-2xl text-admin-body font-semibold transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? "bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white"
                        : "bg-[#181B24] text-[#F4EFE6]/80 hover:bg-[#20242F]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest mb-3">
                STUDIO CHANNELS
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "submissions", label: "Inquiries", badge: unreadInquiries },
                  { id: "assets", label: "Assets" },
                  { id: "analytics", label: "Analytics" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onTabChange(c.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`p-3.5 rounded-2xl text-admin-body text-left border cursor-pointer ${
                      activeTab === c.id
                        ? "bg-[#FF6A1F]/20 border-[#FF6A1F]/40 text-[#FFC93C] font-semibold"
                        : "bg-[#181B24] border-white/[0.08] text-[#F4EFE6]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{c.label}</span>
                      {Boolean(c.badge && c.badge > 0) && (
                        <span className="w-5 h-5 rounded-full bg-[#FF6A1F] text-white text-[10px] font-bold flex items-center justify-center">
                          {c.badge}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between">
            <span className="text-admin-meta text-[#F4EFE6]/50 font-mono text-xs truncate">
              {userEmail}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-admin-label font-semibold cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 w-full pb-28 md:pb-20">
        <div className="tcs-admin-container">{children}</div>
      </main>

      {/* Mobile Bottom Tab Bar (<768px, 5.25rem tall) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 h-[5.25rem] bg-[#07080C]/90 backdrop-blur-2xl border-t border-white/[0.08] flex items-center justify-around px-2 md:hidden">
        {[
          { id: "settings", label: "Copy", icon: <FileText className="w-5 h-5" /> },
          { id: "portfolio", label: "Work", icon: <Film className="w-5 h-5" /> },
          {
            id: "submissions",
            label: "Inquiries",
            icon: <Inbox className="w-5 h-5" />,
            badge: unreadInquiries,
          },
          { id: "assets", label: "Assets", icon: <FolderOpen className="w-5 h-5" /> },
          { id: "analytics", label: "Analytics", icon: <Sparkles className="w-5 h-5" /> },
        ].map((btn) => {
          const isActive = activeTab === btn.id;

          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => onTabChange(btn.id)}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-colors cursor-pointer relative ${
                isActive ? "text-[#FF6A1F]" : "text-[#F4EFE6]/50 hover:text-white"
              }`}
            >
              <div className="relative">
                {btn.icon}
                {Boolean(btn.badge && btn.badge > 0) && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                    {btn.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-sans font-semibold">
                {btn.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Command Palette Dialog (⌘K) */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
};
