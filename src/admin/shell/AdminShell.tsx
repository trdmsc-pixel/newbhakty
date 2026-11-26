import React, { useState } from "react";
import { CommandPalette, CommandItem } from "../ui/CommandPalette";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Compass,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  Inbox,
  LogOut,
  Menu,
  MessageSquareQuote,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

export interface AdminShellProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadInquiries?: number;
  userEmail?: string;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  commandItems: CommandItem[];
  children: React.ReactNode;
}

export const MAIN_WEBSITE_TABS = [
  { id: "settings", label: "Hero & Copy", icon: FileText },
  { id: "brand_logos", label: "Brand Logos", icon: Building2 },
  { id: "portfolio", label: "Selected Work", icon: Film },
  { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { id: "intake_form", label: "Inquiry Form", icon: ClipboardList },
  { id: "navigation", label: "Navigation", icon: Compass },
];

export const AdminShell: React.FC<AdminShellProps> = ({
  activeTab,
  onTabChange,
  unreadInquiries = 0,
  userEmail = "studio@thechantingstudio.in",
  onLogout,
  darkMode,
  onToggleDarkMode,
  commandItems,
  children,
}) => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ⌘K / Ctrl+K global shortcut
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

  const channelItems = [
    { id: "submissions", label: "Inquiries", icon: Inbox, badge: unreadInquiries },
    { id: "assets", label: "Media Assets", icon: FolderOpen, badge: 0 },
    { id: "analytics", label: "Analytics", icon: BarChart3, badge: 0 },
  ];

  const handleSelect = (id: string) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className={`tcs-admin ${darkMode ? "tcs-admin-dark" : ""} p-0 md:p-4 lg:p-5`}>
      {/* Main 32px Rounded Studio OS Panel */}
      <div className="admin-panel-shell max-w-[1440px] mx-auto min-h-screen md:min-h-[calc(100vh-40px)] flex overflow-hidden">
        {/* Desktop / Tablet Collapsible Left Sidebar */}
        <aside
          className={`hidden md:flex flex-col justify-between border-r transition-all duration-200 shrink-0 ${
            sidebarCollapsed ? "w-[76px]" : "w-[252px]"
          }`}
          style={{ borderColor: "var(--a-line)", background: "var(--a-surface-1)" }}
        >
          <div className="p-4 space-y-6 overflow-y-auto">
            {/* Brand Header + Collapse */}
            <div className="flex items-center justify-between gap-2">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[13px] shrink-0"
                    style={{ background: "var(--a-inverse)", color: "var(--a-inverse-text)" }}
                  >
                    CS
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[16px] font-bold tracking-[-0.02em] truncate"
                      style={{ fontFamily: '"Outfit", sans-serif', color: "var(--a-text)" }}
                    >
                      Studio CMS
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--a-text-3)" }}>
                      The Chanting Studio
                    </p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:opacity-80 cursor-pointer"
                style={{ background: "var(--a-surface-2)", color: "var(--a-text-2)" }}
                aria-label="Toggle sidebar"
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>

            {/* WEBSITE Section */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p
                  className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--a-text-3)" }}
                >
                  Website
                </p>
              )}
              {MAIN_WEBSITE_TABS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="w-full flex items-center gap-2.5 px-3 h-10 rounded-full text-[14px] font-medium transition-colors cursor-pointer"
                    style={{
                      background: active ? "var(--a-blue)" : "transparent",
                      color: active ? "#FFFFFF" : "var(--a-text-2)",
                    }}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>

            {/* CHANNELS Section */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p
                  className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--a-text-3)" }}
                >
                  Channels
                </p>
              )}
              {channelItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="w-full flex items-center justify-between gap-2.5 px-3 h-10 rounded-full text-[14px] font-medium transition-colors cursor-pointer"
                    style={{
                      background: active ? "var(--a-blue)" : "transparent",
                      color: active ? "#FFFFFF" : "var(--a-text-2)",
                    }}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.badge > 0 && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          background: active ? "rgba(255,255,255,0.22)" : "var(--a-danger-bg)",
                          color: active ? "#FFFFFF" : "var(--a-danger-text)",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Bottom: Live Site, Light/Dark Toggle, Sign Out */}
          <div className="p-4 border-t space-y-2" style={{ borderColor: "var(--a-line)" }}>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title={sidebarCollapsed ? "Live site" : undefined}
              className="w-full flex items-center gap-2.5 px-3 h-9 rounded-full text-[13px] font-medium hover:opacity-80 transition-opacity"
              style={{ color: "var(--a-text-2)" }}
            >
              <ExternalLink className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span>Live site</span>}
            </a>

            <div className="flex items-center justify-between gap-2 pt-1">
              {/* Two-icon Sun / Moon pill matching Studio OS */}
              <div
                className="inline-flex items-center p-1 rounded-full"
                style={{ background: "var(--a-surface-2)" }}
              >
                <button
                  type="button"
                  onClick={() => darkMode && onToggleDarkMode()}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    background: !darkMode ? "var(--a-surface-1)" : "transparent",
                    color: !darkMode ? "var(--a-text)" : "var(--a-text-3)",
                  }}
                  aria-label="Light mode"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => !darkMode && onToggleDarkMode()}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                  style={{
                    background: darkMode ? "var(--a-surface-1)" : "transparent",
                    color: darkMode ? "var(--a-text)" : "var(--a-text-3)",
                  }}
                  aria-label="Dark mode"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>

              {!sidebarCollapsed && (
                <button
                  type="button"
                  onClick={onLogout}
                  title={`Sign out (${userEmail})`}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 cursor-pointer"
                  style={{ background: "var(--a-danger-bg)", color: "var(--a-danger-text)" }}
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Right Content Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header
            className="h-16 md:h-[72px] px-4 md:px-7 border-b flex items-center justify-between gap-3 shrink-0"
            style={{ borderColor: "var(--a-line)", background: "var(--a-surface-1)" }}
          >
            <div className="flex items-center gap-2.5 flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                style={{ background: "var(--a-surface-2)", color: "var(--a-text)" }}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search / Command Palette Pill */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2.5 px-4 h-10 rounded-full flex-1 text-left cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: "var(--a-surface-2)", color: "var(--a-text-3)" }}
              >
                <Search className="w-4 h-4 shrink-0" />
                <span className="text-[13px] truncate flex-1">Search sections or actions…</span>
                <kbd
                  className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded"
                  style={{ background: "var(--a-surface-1)", color: "var(--a-text-3)" }}
                >
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2.5">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[13px] font-semibold text-white transition-transform hover:-translate-y-[1px]"
                style={{ background: "var(--a-blue)" }}
              >
                <span>Live site</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div
                className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border"
                style={{ borderColor: "var(--a-line)" }}
              >
                <div
                  className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                  style={{ background: "var(--a-accent)" }}
                >
                  SS
                </div>
                <div className="leading-tight">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--a-text)" }}>
                    Shyam Sharma
                  </p>
                  <p className="text-[10px] truncate max-w-[130px]" style={{ color: "var(--a-text-3)" }}>
                    {userEmail}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Scroll Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-10">
            <div className="tcs-admin-container">{children}</div>
          </main>
        </div>
      </div>

      {/* Mobile Slide-Out Drawer (<768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute left-0 top-0 bottom-0 w-[84vw] max-w-[320px] flex flex-col shadow-2xl"
            style={{ background: "var(--a-surface-1)" }}
          >
            <div
              className="flex items-center justify-between px-5 h-16 border-b shrink-0"
              style={{ borderColor: "var(--a-line)" }}
            >
              <div>
                <p
                  className="text-[17px] font-bold"
                  style={{ fontFamily: '"Outfit", sans-serif', color: "var(--a-text)" }}
                >
                  Studio CMS
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--a-text-3)" }}>
                  {userEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "var(--a-surface-2)", color: "var(--a-text-2)" }}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              <div>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--a-text-3)" }}>
                  Website
                </p>
                <div className="space-y-0.5">
                  {MAIN_WEBSITE_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelect(t.id)}
                        className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium"
                        style={{
                          background: active ? "var(--a-blue)" : "transparent",
                          color: active ? "#FFFFFF" : "var(--a-text)",
                        }}
                      >
                        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--a-text-3)" }}>
                  Channels
                </p>
                <div className="space-y-0.5">
                  {channelItems.map((c) => {
                    const Icon = c.icon;
                    const active = activeTab === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelect(c.id)}
                        className="w-full flex items-center justify-between gap-2 px-3 h-12 rounded-[14px] text-[15px] font-medium"
                        style={{
                          background: active ? "var(--a-blue)" : "transparent",
                          color: active ? "#FFFFFF" : "var(--a-text)",
                        }}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                          {c.label}
                        </span>
                        {c.badge > 0 && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: "var(--a-danger-bg)", color: "var(--a-danger-text)" }}
                          >
                            {c.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t space-y-0.5" style={{ borderColor: "var(--a-line)" }}>
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium"
                  style={{ color: "var(--a-text)" }}
                >
                  {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                  {darkMode ? "Light mode" : "Dark mode"}
                </button>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium"
                  style={{ color: "var(--a-text)" }}
                >
                  <ExternalLink className="w-[18px] h-[18px]" /> Open live site
                </a>
              </div>
            </div>

            <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--a-line)" }}>
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-[14px] text-[15px] font-semibold"
                style={{ background: "var(--a-danger-bg)", color: "var(--a-danger-text)" }}
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Mobile Frosted Bottom Tab Bar (<768px) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 h-[72px] border-t flex items-center justify-around px-2 md:hidden backdrop-blur-xl"
        style={{
          background: darkMode ? "rgba(21,21,24,0.92)" : "rgba(255,255,255,0.92)",
          borderColor: "var(--a-line)",
        }}
      >
        {[
          { id: "settings", label: "Copy", icon: <FileText className="w-5 h-5" /> },
          { id: "portfolio", label: "Work", icon: <Film className="w-5 h-5" /> },
          { id: "submissions", label: "Inquiries", icon: <Inbox className="w-5 h-5" />, badge: unreadInquiries },
          { id: "assets", label: "Assets", icon: <FolderOpen className="w-5 h-5" /> },
          { id: "analytics", label: "Analytics", icon: <Sparkles className="w-5 h-5" /> },
        ].map((btn) => {
          const isActive = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handleSelect(btn.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl relative cursor-pointer"
              style={{ color: isActive ? "var(--a-accent)" : "var(--a-text-3)" }}
            >
              <div className="relative">
                {btn.icon}
                {Boolean(btn.badge && btn.badge > 0) && (
                  <span
                    className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ background: "var(--a-crimson)" }}
                  >
                    {btn.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold">{btn.label}</span>
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
