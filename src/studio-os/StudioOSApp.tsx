import React, { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { StudioOSProvider, useStudioOS } from "./StudioOSContext";
import { TodayScreen } from "./screens/TodayScreen";
import { BoardScreen } from "./screens/BoardScreen";
import { TimelineScreen } from "./screens/TimelineScreen";
import { TableScreen } from "./screens/TableScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { ProjectDetailScreen } from "./screens/ProjectDetailScreen";
import { OverviewScreen } from "./screens/OverviewScreen";
import { WeeklyReviewScreen } from "./screens/WeeklyReviewScreen";
import { ClientsScreen, PhasePlaceholderScreen, SettingsScreen } from "./screens/SecondaryScreens";
import { QuickAddModal } from "./components/QuickAddModal";
import { WhatsAppImportModal } from "./components/WhatsAppImportModal";
import { RealtimeBridge } from "./components/RealtimeBridge";
import { InboxScreen } from "./screens/InboxScreen";
import { InboxProvider, useInbox } from "./InboxContext";
import { NewProjectModal } from "./components/NewProjectModal";
import { EveningShutdownModal, StudioClosedOverlay } from "./components/EveningShutdownModal";
import { StackedAvatars } from "./components/StatusChip";
import { StudioRoute } from "./types";
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
    openQuickAdd,
  } = useStudioOS();
  const { pendingCount } = useInbox();

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
      const messages: Record<string, string> = {
        connected: "Gmail connected — first sync within 15 minutes.",
        denied: "Google sign-in was cancelled.",
        expired: "Sign-in link expired — please try again.",
        no_refresh_token: "Google didn't return a refresh token — remove Studio OS access in your Google account and reconnect.",
        bad_scope: "Unexpected Google permissions — connection refused.",
      };
      pushToast(messages[gmail] || "Gmail connection failed — please retry.", gmail === "connected" ? "success" : "warn");
      setRoute("settings");
      touched = true;
    }
    if (touched) window.history.replaceState({}, "", "/studio-os");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        else if (key === "b") setRoute("board");
        else if (key === "p") setRoute("projects");
        else if (key === "i") setRoute("inbox");
        gPrefixRef.current = 0;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setQuickAddOpen, setRoute]);

  const navItems: Array<{ id: StudioRoute; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "today", label: "Today", icon: <CalendarCheck2 className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "inbox", label: "Inbox", icon: <Inbox className="w-[18px] h-[18px]" strokeWidth={1.75} />, badge: pendingCount > 0 ? String(pendingCount) : undefined },
    { id: "projects", label: "Projects", icon: <FolderKanban className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "board", label: "Board", icon: <Kanban className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "timeline", label: "Timeline", icon: <CalendarRange className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "table", label: "Table", icon: <Table2 className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "weekly_review", label: "Weekly Review", icon: <ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.75} />, badge: "Sun" },
    { id: "clients", label: "Clients", icon: <Users className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
    { id: "money", label: "Money", icon: <Wallet className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  ];

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
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="sos-display text-[17px] font-bold tracking-[-0.02em] truncate" style={{ color: "var(--sos-text-1)" }}>
                    Studio OS
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>
                    The Chanting Studio
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
              {!sidebarCollapsed && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                  General
                </p>
              )}
              {navItems.map((item) => {
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoute(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="w-full flex items-center justify-between gap-2.5 px-3 h-10 rounded-full text-[14px] font-medium transition-colors"
                    style={{
                      background: active ? "var(--sos-ink)" : "transparent",
                      color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)",
                    }}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.icon}
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCollapsed && item.badge && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* MY WORKSPACE pinned projects */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-3 pb-1">
                {!sidebarCollapsed && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                    My Workspace
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
                <StackedAvatars items={[{ initials: "SS", color: "#5B3FE4", name: "Shyam Sharma" }]} size={30} />
              </div>

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
                  const lateCount = projects.filter((p) => p.health === "late").length;
                  if (lateCount > 0) {
                    setRoute("timeline");
                    pushToast(`${lateCount} project(s) with late forecast`, "warn");
                  } else {
                    pushToast("All calm — no late forecasts.", "info");
                  }
                }}
                className="relative w-9 h-9 rounded-full flex items-center justify-center border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                {projects.some((p) => p.health === "late") && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E5484D]" />
                )}
              </button>

              <div
                className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border"
                style={{ borderColor: "var(--sos-border)" }}
              >
                <div className="w-7 h-7 rounded-full bg-[#5B3FE4] text-white text-[11px] font-bold flex items-center justify-center">
                  SS
                </div>
                <div className="leading-tight">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    Shyam Sharma
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--sos-text-3)" }}>
                    Founder
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Active Screen */}
          <main className="flex-1 overflow-y-auto p-4 md:p-7 pb-24 md:pb-8">
            {route === "today" && <TodayScreen />}
            {route === "board" && <BoardScreen />}
            {route === "timeline" && <TimelineScreen />}
            {route === "table" && <TableScreen />}
            {route === "projects" && <ProjectsScreen />}
            {route === "project_detail" && <ProjectDetailScreen />}
            {route === "weekly_review" && <WeeklyReviewScreen />}
            {route === "clients" && <ClientsScreen />}
            {route === "overview" && <OverviewScreen />}
            {route === "settings" && (
              <SettingsScreen onInstallPWA={handleInstallPWA} canInstallPWA={Boolean(deferredPrompt)} />
            )}
            {route === "inbox" && <InboxScreen />}
            {route === "money" && (
              <PhasePlaceholderScreen
                title="Money & Invoices"
                phase="Phase 5"
                description="Multi-currency invoices (INR/USD/EUR), TDS tracking, and the feature-flagged Expenses ledger will launch in Phase 5."
                icon="money"
              />
            )}
          </main>
        </div>
      </div>

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
          <CalendarCheck2 className="w-5 h-5" />
          Today
        </button>
        <button
          type="button"
          onClick={() => setRoute("board")}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "board" ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <Kanban className="w-5 h-5" />
          Board
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
          onClick={() => setRoute("inbox")}
          className="relative flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "inbox" ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <Inbox className="w-5 h-5" />
          Inbox
          {pendingCount > 0 && (
            <span
              className="absolute -top-1 left-1/2 ml-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-semibold flex items-center justify-center sos-tabular"
              style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setRoute("projects")}
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium"
          style={{ color: route === "projects" || route === "project_detail" ? "var(--sos-primary)" : "var(--sos-text-3)" }}
        >
          <FolderKanban className="w-5 h-5" />
          Projects
        </button>
      </nav>

      {/* Modals & Evening Shutdown Ritual */}
      <RealtimeBridge />
      <QuickAddModal />
      <WhatsAppImportModal />
      <NewProjectModal />
      <EveningShutdownModal />
      <StudioClosedOverlay />

      {/* Calm Toasts */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-4 py-2.5 rounded-full text-[13px] font-medium shadow-lg"
            style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
          >
            {t.message}
          </div>
        ))}
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
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (active) setCheckingAuth(false);
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email || null;
        if (active && email && isOwnerEmail(email)) {
          setUserEmail(email);
        }
      } catch {
        // ignore
      } finally {
        if (active) setCheckingAuth(false);
      }
    };
    init();

    const sub = supabase?.auth?.onAuthStateChange((_event, session) => {
      const email = session?.user?.email || null;
      if (active) {
        setUserEmail(email && isOwnerEmail(email) ? email : null);
      }
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

    if (!isOwnerEmail(normalized)) {
      setAuthError("Access denied. Studio OS is private to Shyam Sharma (owner account only).");
      return;
    }

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
        setUserEmail(data.user.email || normalized);
      }
    } catch (err: any) {
      setAuthError(err?.message || "Sign-in failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
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
            <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
              Studio OS
            </h1>
            <p className="text-[14px] mt-1" style={{ color: "var(--sos-text-2)" }}>
              Private production workspace for The Chanting Studio. Owner access only.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Owner Email
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
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter your Supabase owner password"
                className="w-full h-11 px-4 rounded-[14px] border text-[14px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </div>

            {authError && (
              <p className="text-[13px] px-3.5 py-2.5 rounded-[12px] bg-[#FDECEC] text-[#E5484D]">
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
          </form>
        </div>
      </div>
    );
  }

  return (
    <StudioOSProvider>
      <InboxProvider>
        <StudioOSShell onNavigateHome={onNavigateHome} userEmail={userEmail} onLogout={handleLogout} />
      </InboxProvider>
    </StudioOSProvider>
  );
}
