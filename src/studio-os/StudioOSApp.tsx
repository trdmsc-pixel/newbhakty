import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { UpdateBanner } from "./components/UpdateBanner";
import { StudioLogo } from "../brand/StudioLogo";
import {
  ArrowLeft,
  Bell,
  CalendarRange,
  ClipboardCheck,
  FolderKanban,
  Inbox,
  Kanban,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Table2,
  Users,
  Wallet,
  CalendarCheck2,
  Loader2,
  Mail,
  RotateCcw,
  Menu,
  X,
} from "lucide-react";
import { StudioOSProvider, useStudioOS } from "./StudioOSContext";
import { TodayScreen } from "./screens/TodayScreen";
import { BoardScreen } from "./screens/BoardScreen";
const TimelineScreen = lazy(() => import("./screens/TimelineScreen").then((m) => ({ default: m.TimelineScreen })));
import { TableScreen } from "./screens/TableScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { PipelineScreen } from "./screens/PipelineScreen";
import { ProjectDetailScreen } from "./screens/ProjectDetailScreen";
const OverviewScreen = lazy(() => import("./screens/OverviewScreen").then((m) => ({ default: m.OverviewScreen })));
const WeeklyReviewScreen = lazy(() => import("./screens/WeeklyReviewScreen").then((m) => ({ default: m.WeeklyReviewScreen })));
const ClientsScreen = lazy(() => import("./screens/SecondaryScreens").then((m) => ({ default: m.ClientsScreen })));
const SettingsScreen = lazy(() => import("./screens/SecondaryScreens").then((m) => ({ default: m.SettingsScreen })));
import { QuickAddModal } from "./components/QuickAddModal";
import { WhatsAppImportModal } from "./components/WhatsAppImportModal";
import { ClientPulseProvider, useClientPulse } from "./components/ClientPulse";
const MailScreen = lazy(() => import("./screens/MailScreen").then((m) => ({ default: m.MailScreen })));
const StudioCopilot = lazy(() => import("./components/StudioCopilot").then((m) => ({ default: m.StudioCopilot })));
const MoneyScreen = lazy(() => import("./screens/MoneyScreen").then((m) => ({ default: m.MoneyScreen })));
import { InboxProvider, useInbox } from "./InboxContext";
import { NewProjectModal } from "./components/NewProjectModal";
import { EveningShutdownModal, StudioClosedOverlay } from "./components/EveningShutdownModal";
import { StackedAvatars } from "./components/StatusChip";
import { StudioRoute } from "./types";
import { AnimatePresence, motion } from "motion/react";
import { ActivePill, EASE, ScreenTransition, usePointerGlow } from "./motion";
import { studioApi } from "./api";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import "./studio-os.css";

const OWNER_EMAILS = new Set([
  "shyam@thechantingstudio.in",
  "studio@thechantingstudio.in",
  "accounts@thechantingstudio.in",
]);

function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return OWNER_EMAILS.has(email.trim().toLowerCase());
}

const StudioOSShell: React.FC<{
  onNavigateHome: () => void;
  userEmail: string;
  onLogout: () => void;
}> = ({ onNavigateHome, userEmail, onLogout }) => {
  const {
    route,
    setRoute,
    projects,
    selectedProjectId,
    openProject,
    darkMode,
    toggleDarkMode,
    searchQuery,
    setSearchQuery,
    setQuickAddOpen,
    setNewProjectOpen,
    toasts,
    pushToast,
    undoLast,
    openQuickAdd,
    viewer,
    isOwner,
    members,
  } = useStudioOS();
  const me = members.find((m) => m.id === viewer.memberId);
  const meName = me?.name || viewer.name || "Shyam Sharma";
  const meInitials = me?.initials || meName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel = { owner: "Founder", producer: "Producer", artist: "Artist", editor: "Editor", music: "Music" }[viewer.role] || "Team";
  const { unread: clientUnread } = useClientPulse();
  usePointerGlow();
  // Unread + important mail count for the sidebar pill (owner only, calm polling).
  const [mailCount, setMailCount] = useState(0);
  useEffect(() => {
    if (!isOwner) return;
    // Load mail once in the background and keep it fresh (every 10 min), so the Mail tab opens instantly.
    import("./screens/MailScreen").then((m) => m.prefetchMail()).catch(() => {});
    // Email major client notifications (ready for review, new version, final files) right after they happen.
    let flushTimer: number | null = null;
    const flush = () => {
      if (flushTimer) window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => studioApi("/api/studio-os/portal-notify/flush", { method: "POST", body: {} }).catch(() => {}), 2500);
    };
    flush();
    const notifyCh = supabase
      ?.channel("studio-portal-notify")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "studio_portal_notifications" }, (p: any) => {
        if (p?.new?.email_status === "pending") flush();
      })
      .subscribe();
    let alive = true;
    const tick = () =>
      studioApi<{ unread_important: number }>("/api/studio-os/mail/counts")
        .then((r) => alive && setMailCount(r.unread_important || 0))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 180_000);
    return () => {
      alive = false;
      clearInterval(t);
      if (flushTimer) window.clearTimeout(flushTimer);
      if (notifyCh) supabase?.removeChannel(notifyCh);
    };
  }, [isOwner]);

  // Android share target (/studio-os?share=1&title=&text=&url=) and Gmail OAuth return (?gmail=status)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let touched = false;
    if (params.get("share") || window.location.pathname.startsWith("/studio-os/share")) {
      const shared = [params.get("title"), params.get("text"), params.get("url")]
        .map((v) => (v || "").trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join("\n");
      if (shared) openQuickAdd(shared);
      touched = true;
    }
    const gmail = params.get("gmail");
    if (gmail) {
      try {
        sessionStorage.setItem("sos_gmail_result", JSON.stringify({ status: gmail, detail: params.get("detail") || "" }));
      } catch {
        /* ignore */
      }
      pushToast(gmail === "connected" ? "Gmail connected" : "Gmail connection didn't finish — details in Settings", gmail === "connected" ? "success" : "warn");
      setRoute("settings");
      touched = true;
    }
    if (touched) window.history.replaceState({}, "", "/studio-os");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Close the mobile menu whenever the route changes.
  useEffect(() => setMobileMenuOpen(false), [route, selectedProjectId]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gPrefixRef = useRef<number>(0);

  // Register PWA manifest + service worker when inside Studio OS
  useEffect(() => {
    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (!existingManifest) {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/studio-os-manifest.json";
      document.head.appendChild(link);
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  // Global Keyboard Shortcuts: N new task, / search, G T Today, G B Board, G P Projects, Cmd/Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if (inInput) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLast();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if (key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (key === "g") {
        gPrefixRef.current = Date.now();
        return;
      }
      if (Date.now() - gPrefixRef.current < 900) {
        if (key === "t") setRoute("today");
        else if (key === "b") setRoute("table");
        else if (key === "p") setRoute("projects");
        else if (key === "m") setRoute("mail");
        gPrefixRef.current = 0;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setQuickAddOpen, setRoute, undoLast]);

  type NavItem = { id: StudioRoute; label: string; icon: React.ReactNode; badge?: string; urgent?: boolean; group: string; matches?: StudioRoute[] };
  const navItems: NavItem[] = [
    // My work — tasks and messages
    { group: "My work", id: "today", label: "Today", icon: <CalendarCheck2 className="w-[18px] h-[18px]" strokeWidth={1.75} />, badge: clientUnread > 0 ? String(clientUnread) : undefined, urgent: clientUnread > 0 },
    { group: "My work", id: "table", label: "Tasks", matches: ["board", "table"], icon: <Kanban className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { group: "My work", id: "mail", label: "Mail", icon: <Mail className="w-[18px] h-[18px]" strokeWidth={1.75} />, badge: mailCount > 0 ? String(mailCount) : undefined },
    // Productions — projects and clients
    { group: "Productions", id: "projects", label: "Projects", matches: ["projects", "pipeline", "timeline", "project_detail"], icon: <FolderKanban className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { group: "Productions", id: "clients", label: "Clients", icon: <Users className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    // Studio — big picture
    { group: "Studio", id: "overview", label: "Overview", icon: <LayoutDashboard className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { group: "Studio", id: "weekly_review", label: "Weekly Review", icon: <ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.75} />, badge: "Sun" },
    { group: "Studio", id: "money", label: "Money", icon: <Wallet className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  ];

  const OWNER_ONLY: StudioRoute[] = ["inbox", "mail", "money", "weekly_review", "clients"];
  const visibleNav = isOwner ? navItems : navItems.filter((n) => !OWNER_ONLY.includes(n.id));
  const navGroups = ["My work", "Productions", "Studio"]
    .map((g) => ({ group: g, items: visibleNav.filter((n) => n.group === g) }))
    .filter((g) => g.items.length);
  const pinnedProjects = projects.filter((p) => p.pinned);

  return (
    <div className={`studio-os-root ${darkMode ? "studio-os-dark" : ""} p-0 md:p-4 lg:p-5`}>
      {/* Outer Rounded White Main Panel */}
      <div className="sos-panel max-w-[1440px] mx-auto min-h-screen md:min-h-[calc(100vh-40px)] flex overflow-hidden">
        {/* Desktop / Tablet Left Sidebar */}
        <aside
          className={`hidden md:flex flex-col justify-between border-r transition-all duration-200 shrink-0 ${
            sidebarCollapsed ? "w-[76px]" : "w-[256px]"
          }`}
          style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)" }}
        >
          <div className="p-4 space-y-6 overflow-y-auto">
            {/* Brand + Collapse */}
            <div className="flex items-center justify-between gap-2">
              {sidebarCollapsed ? null : (
                <div className="min-w-0 flex-1">
                  <StudioLogo surface={darkMode ? "dark" : "light"} height={22} />
                  <p className="text-[11px] mt-1 truncate" style={{ color: "var(--sos-text-3)" }}>
                    Studio OS
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:opacity-80"
                style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
                aria-label="Toggle sidebar"
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>

            {/* GENERAL nav */}
            <div className="space-y-1">
              {navGroups.map(({ group, items }) => (
              <div key={group} className="space-y-1 pb-2">
              {!sidebarCollapsed && (
                <p className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                  {group}
                </p>
              )}
              {items.map((item) => {
                const active = item.matches ? item.matches.includes(route) && !(route === "project_detail" && pinnedProjects.some((p) => p.id === selectedProjectId)) : route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoute(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="relative w-full flex items-center justify-between gap-2.5 px-3 h-10 rounded-full text-[14px] font-medium transition-colors duration-200"
                    style={{
                      color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)",
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <ActivePill layoutId="sos-sidebar-pill" style={{ background: "var(--sos-ink)" }} />}
                    <span className="relative z-[1] flex items-center gap-2.5 min-w-0">
                      {item.icon}
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.badge && (
                      <span
                        className={`relative z-[1] px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.urgent ? "sos-pulse-badge" : ""}`}
                        style={item.urgent ? { background: "#B42318", color: "#FFFFFF" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {sidebarCollapsed && item.urgent && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B42318] sos-pulse-badge" aria-hidden />}
                  </button>
                );
              })}
              </div>
              ))}
            </div>

            {/* MY WORKSPACE pinned projects */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 pb-1">
                {!sidebarCollapsed && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                    Pinned projects
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setNewProjectOpen(true)}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:opacity-80"
                  style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
                  aria-label="New project"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {pinnedProjects.map((p) => {
                const active = route === "project_detail" && selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p.id)}
                    title={sidebarCollapsed ? p.title : undefined}
                    className="w-full flex items-center gap-2.5 px-3 h-9 rounded-full text-[13px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--sos-violet-soft)" : "transparent",
                      color: active ? "var(--sos-primary)" : "var(--sos-text-2)",
                    }}
                  >
                    <span className="text-[15px] shrink-0">{p.emoji}</span>
                    {!sidebarCollapsed && <span className="truncate">{p.title}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar Bottom: Settings, Theme Toggle, Website Link, Logout */}
          <div className="p-4 border-t space-y-2" style={{ borderColor: "var(--sos-border)" }}>
            <button
              type="button"
              onClick={() => setRoute("settings")}
              className="w-full flex items-center gap-2.5 px-3 h-9 rounded-full text-[13px] font-medium"
              style={{
                background: route === "settings" ? "var(--sos-surface-2)" : "transparent",
                color: "var(--sos-text-2)",
              }}
            >
              <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span>Settings</span>}
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full flex items-center gap-2.5 px-3 h-9 rounded-full text-[13px] font-medium"
              style={{ color: "var(--sos-text-3)" }}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {!sidebarCollapsed && <span>Public Website</span>}
            </button>

            <div className="flex items-center justify-between gap-2 pt-2">
              {/* Two-icon Sun/Moon pill */}
              <div
                className="inline-flex items-center p-1 rounded-full"
                style={{ background: "var(--sos-surface-2)" }}
              >
                <button
                  type="button"
                  onClick={() => darkMode && toggleDarkMode()}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: !darkMode ? "var(--sos-surface)" : "transparent",
                    color: !darkMode ? "var(--sos-text-1)" : "var(--sos-text-3)",
                  }}
                  aria-label="Light mode"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => !darkMode && toggleDarkMode()}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: darkMode ? "var(--sos-surface)" : "transparent",
                    color: darkMode ? "var(--sos-text-1)" : "var(--sos-text-3)",
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
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80"
                  style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header
            className="h-16 md:h-[72px] px-4 md:px-7 border-b flex items-center justify-between gap-3 shrink-0"
            style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)" }}
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden relative w-10 h-10 -ml-1 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="w-5 h-5" />
              {(clientUnread > 0 || mailCount > 0) && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B42318]" aria-hidden />}
            </button>
            {/* Search Pill */}
            <div
              className="flex items-center gap-2 px-4 h-10 rounded-full flex-1 max-w-md"
              style={{ background: "var(--sos-surface-2)" }}
            >
              <Search className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) setRoute("table");
                }}
                placeholder="Search tasks or press N to quick-add..."
                className="w-full bg-transparent outline-none text-[13px]"
                style={{ color: "var(--sos-text-1)" }}
              />
              <kbd
                className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded"
                style={{ background: "var(--sos-surface)", color: "var(--sos-text-3)" }}
              >
                /
              </kbd>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2.5">
              <div className="hidden lg:flex items-center gap-2">
                <StackedAvatars
                  items={members.filter((m) => m.is_active).map((m) => ({ initials: m.initials, color: m.color, name: m.name }))}
                  size={30}
                />
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("sos:copilot-toggle"))}
                  className="sos-pill-btn inline-flex items-center gap-1.5 px-3 md:px-4 h-9 text-[13px] font-semibold border"
                  style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
                  aria-label="Open Studio Copilot (Ctrl+J)"
                  title="Studio Copilot · ⌘/Ctrl+J"
                >
                  <span aria-hidden>✨</span>
                  <span className="hidden md:inline">Studio Copilot</span>
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}>⌘J</kbd>
                </button>
              )}

              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="hidden md:inline-flex sos-pill-btn items-center gap-1.5 px-4 h-9 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-blue)" }}
              >
                <Plus className="w-4 h-4" /> New Task
              </button>

              <button
                type="button"
                onClick={() => {
                  if (clientUnread > 0) {
                    setRoute("today");
                    return;
                  }
                  const lateCount = projects.filter((p) => p.health === "late").length;
                  if (lateCount > 0) {
                    setRoute("timeline");
                    pushToast(`${lateCount} project(s) with late forecast`, "warn");
                  } else {
                    pushToast("All calm — no new client updates.", "info");
                  }
                }}
                className="relative w-9 h-9 rounded-full flex items-center justify-center border"
                style={{ borderColor: clientUnread ? "#B42318" : "var(--sos-border)", color: clientUnread ? "#B42318" : "var(--sos-text-2)" }}
                aria-label={clientUnread ? `${clientUnread} new client updates` : "Notifications"}
              >
                <Bell className={`w-4 h-4 ${clientUnread ? "sos-ring-bell" : ""}`} strokeWidth={1.75} />
                {clientUnread > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B42318] text-white text-[10px] font-bold flex items-center justify-center sos-pulse-badge">
                    {clientUnread}
                  </span>
                ) : (
                  projects.some((p) => p.health === "late") && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B42318]" />
                )}
              </button>

              <div
                className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border"
                style={{ borderColor: "var(--sos-border)" }}
              >
                <div
                  className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                  style={{ background: me?.color || "#5B3FE4" }}
                >
                  {meInitials}
                </div>
                <div className="leading-tight">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    {meName}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--sos-text-3)" }}>
                    {roleLabel}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Active Screen */}
          <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-8">
            <Suspense
              fallback={
                <div className="py-24 flex justify-center" aria-busy="true">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--sos-primary)" }} />
                </div>
              }
            >
            <ScreenTransition id={route === "project_detail" ? `project-${selectedProjectId}` : route}>
            {route === "today" && <TodayScreen />}
            {route === "board" && <BoardScreen />}
            {route === "timeline" && <TimelineScreen />}
            {route === "table" && <TableScreen />}
            {route === "projects" && <ProjectsScreen />}
            {route === "pipeline" && <PipelineScreen />}
            {route === "project_detail" && <ProjectDetailScreen />}
            {route === "weekly_review" && <WeeklyReviewScreen />}
            {route === "clients" && <ClientsScreen />}
            {route === "overview" && <OverviewScreen />}
            {route === "settings" && (
              <SettingsScreen onInstallPWA={handleInstallPWA} canInstallPWA={Boolean(deferredPrompt)} />
            )}
            {route === "inbox" && (isOwner ? <MailScreen /> : <TodayScreen />)}
            {route === "money" && (isOwner ? <MoneyScreen /> : <TodayScreen />)}
            {route === "mail" && (isOwner ? <MailScreen /> : <TodayScreen />)}
            </ScreenTransition>
            </Suspense>
          </main>
        </div>
      </div>

      {isOwner && (
        <Suspense fallback={null}>
          <StudioCopilot />
        </Suspense>
      )}

      {/* Mobile Frosted Bottom Tab Bar (<768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[72px] px-3 border-t flex items-center justify-around backdrop-blur-xl"
        style={{
          background: darkMode ? "rgba(21,21,24,0.92)" : "rgba(255,255,255,0.92)",
          borderColor: "var(--sos-border)",
        }}
      >
        <button
          type="button"
          onClick={() => setRoute("today")}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "today" ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <span className="relative">
            <CalendarCheck2 className="w-5 h-5" />
            {clientUnread > 0 && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[#B42318] ring-2 ring-white sos-pulse-badge" aria-label={`${clientUnread} new client updates`} />}
          </span>
          Today
        </button>
        <button
          type="button"
          onClick={() => setRoute("table")}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "board" || route === "table" ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <Kanban className="w-5 h-5" />
          Tasks
        </button>

        {/* Big Violet Quick Add Button */}
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="w-13 h-13 -mt-5 rounded-full flex items-center justify-center text-white shadow-lg"
          style={{ background: "var(--sos-primary)" }}
          aria-label="Quick Add Task"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => setRoute(isOwner ? "mail" : "table")}
          className="relative flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "mail" || (!isOwner && route === "table") ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          {isOwner ? <Mail className="w-5 h-5" /> : <Table2 className="w-5 h-5" />}
          {isOwner ? "Mail" : "Table"}
          {isOwner && mailCount > 0 && (
            <span
              className="absolute -top-1 left-1/2 ml-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center sos-tabular"
              style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
            >
              {mailCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setRoute("projects")}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: ["projects", "pipeline", "timeline", "project_detail"].includes(route) ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <FolderKanban className="w-5 h-5" />
          Projects
        </button>
      </nav>

      {/* Mobile slide-out menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            className="md:hidden fixed inset-0 z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileMenuOpen(false)} />
            <motion.nav
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute left-0 top-0 bottom-0 w-[84vw] max-w-[320px] flex flex-col shadow-2xl"
              style={{ background: "var(--sos-surface)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 34, stiffness: 360, mass: 0.9 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) setMobileMenuOpen(false);
              }}
            >
              <div className="flex items-center justify-between px-5 h-16 border-b shrink-0" style={{ borderColor: "var(--sos-border)" }}>
                <div className="min-w-0">
                  <StudioLogo surface={darkMode ? "dark" : "light"} height={20} />
                  <p className="text-[11px] mt-1 truncate" style={{ color: "var(--sos-text-3)" }}>Studio OS · {userEmail || "The Chanting Studio"}</p>
                </div>
                <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close menu">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                {navGroups.map(({ group, items }) => (
                  <div key={group}>
                    <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{group}</p>
                    <div className="space-y-0.5">
                      {items.map((item, i) => {
                        const active = item.matches ? item.matches.includes(route) : route === item.id;
                        return (
                          <motion.button
                            key={item.id}
                            type="button"
                            onClick={() => setRoute(item.id)}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * i, duration: 0.2, ease: EASE }}
                            className="w-full flex items-center justify-between gap-2 px-3 h-12 rounded-[14px] text-[15px] font-medium"
                            style={{ background: active ? "var(--sos-ink)" : "transparent", color: active ? "var(--sos-ink-text)" : "var(--sos-text-1)" }}
                            aria-current={active ? "page" : undefined}
                          >
                            <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${item.urgent ? "sos-pulse-badge" : ""}`}
                                style={item.urgent ? { background: "#B42318", color: "#FFFFFF" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="space-y-0.5 pt-1 border-t" style={{ borderColor: "var(--sos-border)" }}>
                  <button type="button" onClick={() => setRoute("settings")} className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium mt-2" style={{ background: route === "settings" ? "var(--sos-ink)" : "transparent", color: route === "settings" ? "var(--sos-ink-text)" : "var(--sos-text-1)" }}>
                    <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} /> Settings
                  </button>
                  <button type="button" onClick={toggleDarkMode} className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium" style={{ color: "var(--sos-text-1)" }}>
                    {darkMode ? <Sun className="w-[18px] h-[18px]" strokeWidth={1.75} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />} {darkMode ? "Light mode" : "Dark mode"}
                  </button>
                  <button type="button" onClick={onNavigateHome} className="w-full flex items-center gap-3 px-3 h-12 rounded-[14px] text-[15px] font-medium" style={{ color: "var(--sos-text-1)" }}>
                    <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.75} /> Back to website
                  </button>
                </div>
              </div>
              <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--sos-border)" }}>
                <button type="button" onClick={onLogout} className="w-full flex items-center justify-center gap-2 h-12 rounded-[14px] text-[15px] font-semibold" style={{ background: "var(--sos-danger-bg)", color: "var(--sos-danger-text)" }}>
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals & Evening Shutdown Ritual */}
      <QuickAddModal />
      <UpdateBanner />
      <WhatsAppImportModal />
      <NewProjectModal />
      <EveningShutdownModal />
      <StudioClosedOverlay />

      {/* Calm Toasts */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-50 space-y-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={{ opacity: 0, y: 14, x: 10 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.16 } }}
              transition={{ duration: 0.22, ease: EASE }}
              className={`px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg flex items-center gap-3 ${t.action ? "pointer-events-auto" : ""}`}
              style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={t.action.onClick}
                  className="-my-1 -mr-1.5 px-3 h-7 rounded-full text-[12px] font-bold inline-flex items-center gap-1"
                  style={{ background: "color-mix(in srgb, var(--sos-ink-text) 14%, transparent)", color: "var(--sos-ink-text)" }}
                  title="Undo (⌘/Ctrl+Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function StudioOSApp({ onNavigateHome }: { onNavigateHome: () => void }) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(() => localStorage.getItem("tcs_studio_os_email") || "studio@thechantingstudio.in");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    let active = true;
    // Owner by email, or any active studio_members row (team access, Phase 5).
    const resolve = async (email: string | null) => {
      if (!email || !supabase) return null;
      if (isOwnerEmail(email)) return email;
      const { data } = await supabase.rpc("studio_os_whoami");
      return (data as any)?.ok ? email : null;
    };
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setCheckingAuth(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const allowed = await resolve(data.session?.user?.email || null);
        if (active) setUserEmail(allowed);
        if (active && data.session && !allowed) setAuthError("This account isn't on the Studio OS team. Ask the studio owner for an invite.");
      } catch {
        // ignore
      } finally {
        if (active) setCheckingAuth(false);
      }
    };
    init();

    const sub = supabase?.auth?.onAuthStateChange((_event, session) => {
      resolve(session?.user?.email || null).then((allowed) => {
        if (active) setUserEmail(allowed);
      });
    });

    return () => {
      active = false;
      sub?.data?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const normalized = emailInput.trim().toLowerCase();

    if (!isSupabaseConfigured || !supabase) {
      setAuthError("Supabase Auth is not configured in this environment.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password: passwordInput,
      });
      if (error || !data?.user) {
        setAuthError(error?.message || "Invalid email or password.");
      } else {
        localStorage.setItem("tcs_studio_os_email", normalized);
        const email = data.user.email || normalized;
        let allowed = isOwnerEmail(email);
        if (!allowed) {
          const { data: who } = await supabase.rpc("studio_os_whoami");
          allowed = Boolean((who as any)?.ok);
        }
        if (allowed) setUserEmail(email);
        else {
          await supabase.auth.signOut().catch(() => {});
          setAuthError("This account isn't on the Studio OS team. Ask the studio owner for an invite.");
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || "Sign-in failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const sendMagicLink = async () => {
    setAuthError("");
    const email = emailInput.trim().toLowerCase();
    if (!email || !supabase) return;
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/studio-os`, shouldCreateUser: false },
    });
    setIsLoggingIn(false);
    setAuthError(error ? "Couldn't send a link — is this email on the team?" : "Check your inbox for a sign-in link.");
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("tcs_studio_os_phase2_v1");
    } catch {
      /* ignore */
    }
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUserEmail(null);
  };

  if (checkingAuth) {
    return (
      <div className="studio-os-root flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-[#5B3FE4]" />
      </div>
    );
  }

  if (!userEmail) {
    return (
      <div className="studio-os-root flex items-center justify-center p-4">
        <div className="sos-card w-full max-w-md p-7 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
              <Lock className="w-5 h-5" />
            </div>
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-[12px] font-medium inline-flex items-center gap-1"
              style={{ color: "var(--sos-text-3)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to website
            </button>
          </div>

          <div>
            <StudioLogo surface="light" height={26} className="mb-4" />
            <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
              Studio OS
            </h1>
            <p className="text-[14px] mt-1" style={{ color: "var(--sos-text-2)" }}>
              Private production workspace for The Chanting Studio. Team access only.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="studio@thechantingstudio.in"
                className="w-full h-11 px-4 rounded-[14px] border text-[14px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your Supabase owner password"
                className="w-full h-11 px-4 rounded-[14px] border text-[14px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>

            {authError && (
              <p
                className={`text-[13px] px-3.5 py-2.5 rounded-[12px] ${
                  authError.startsWith("Check") ? "bg-[#EEEBFD] text-[#5B3FE4]" : "bg-[#FDECEC] text-[#B42318]"
                }`}
              >
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-primary)" }}
            >
              {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoggingIn ? "Signing in..." : "Enter Studio OS"}
            </button>
            <button
              type="button"
              onClick={sendMagicLink}
              disabled={isLoggingIn}
              className="w-full h-11 text-[13px] font-medium rounded-full"
              style={{ color: "var(--sos-text-2)" }}
            >
              Team member? Email me a sign-in link
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StudioOSProvider>
      <InboxProvider>
        <ClientPulseProvider>
          <StudioOSShell onNavigateHome={onNavigateHome} userEmail={userEmail} onLogout={handleLogout} />
        </ClientPulseProvider>
      </InboxProvider>
    </StudioOSProvider>
  );
}
