import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useToast } from "../context/ToastContext";
import { Wordmark } from "./brand/Wordmark";
import { Ring } from "./brand/Ring";
import {
  Lock,
  Mail,
  Phone,
  User,
  Send,
  ArrowLeft,
  LogOut,
  Clock,
  Play,
  Video,
  Image as ImageIcon,
  Check,
  HelpCircle,
  Tag,
  Calendar,
  Activity,
  Award,
  Bell,
  ExternalLink,
  CheckCircle2,
  FolderKanban
} from "lucide-react";

interface ClientAccessPanelProps {
  onNavigateHome: () => void;
}

interface ClientUser {
  id: string;
  client_id: string;
  name: string;
  email: string;
  mobile: string;
  company_name: string;
  designation: string;
  signing_up_for: string;
  heard_about_us: string;
  created_at: string;
}

interface ClientWork {
  id: string;
  client_user_id: string;
  title: string;
  url: string;
  type: "video" | "image";
  created_at: string;
}

interface ClientTask {
  id: string;
  client_user_id: string;
  task_name: string;
  progress: number;
  status: string;
  deadline: string;
  created_at: string;
}

interface ClientFeedback {
  id: string;
  client_user_id: string;
  work_id: string;
  comment: string;
  timestamp: string | null;
  tag: string | null;
  acknowledged: boolean;
  created_at: string;
}

function playClientChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(784, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

export default function ClientAccessPanel({ onNavigateHome }: ClientAccessPanelProps) {
  const toast = useToast();

  // Authentication & Session state
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<ClientUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Sign In inputs
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Sign Up inputs
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpMobile, setSignUpMobile] = useState("");
  const [signUpCompany, setSignUpCompany] = useState("");
  const [signUpDesignation, setSignUpDesignation] = useState("");
  const [signUpPurpose, setSignUpPurpose] = useState("");
  const [signUpSource, setSignUpSource] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Client Data State
  const [works, setWorks] = useState<ClientWork[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [feedbacks, setFeedbacks] = useState<ClientFeedback[]>([]);
  const [selectedWork, setSelectedWork] = useState<ClientWork | null>(null);

  // Feedback form state
  const [feedbackComment, setFeedbackComment] = useState("");
  const [videoTimestamp, setVideoTimestamp] = useState<string>("");
  const [imageTag, setImageTag] = useState<string>("VFX");

  // Media Player Ref
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const [, setCurrentTime] = useState(0);

  // Active Tab in Top Pill Bar
  const [activeDashboardTab, setActiveDashboardTab] = useState<"work" | "tasks" | "deals">("work");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return parseFloat(timeStr) || 0;
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionUser(session.user);
        fetchClientProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSessionUser(session.user);
        fetchClientProfile(session.user.id);
      } else {
        setSessionUser(null);
        setClientProfile(null);
        setWorks([]);
        setTasks([]);
        setFeedbacks([]);
        setSelectedWork(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchClientProfile = async (userId: string) => {
    if (!supabase) return;
    setIsDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setClientProfile(data);
        await fetchClientData(data.id);
      }
    } catch (err: any) {
      console.error("Error fetching client profile:", err);
      toast.error("Failed to load client profile details.");
    } finally {
      setIsDataLoading(false);
    }
  };

  const fetchClientData = async (clientUserId: string) => {
    if (!supabase) return;
    try {
      const { data: worksData, error: worksErr } = await supabase
        .from("client_work")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });
      if (worksErr) throw worksErr;
      setWorks(worksData || []);
      if (worksData && worksData.length > 0) {
        setSelectedWork(worksData[0]);
      }

      const { data: tasksData, error: tasksErr } = await supabase
        .from("client_tasks")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: true });
      if (tasksErr) throw tasksErr;
      setTasks(tasksData || []);

      const { data: feedbackData, error: feedbackErr } = await supabase
        .from("client_feedback")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });
      if (feedbackErr) throw feedbackErr;
      setFeedbacks(feedbackData || []);
    } catch (err: any) {
      console.error("Error fetching client operational data:", err);
      toast.error("Error synchronizing project dashboard assets.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Please provide both email and password.");
      return;
    }
    if (!supabase) {
      toast.error("Supabase connection is not initialized.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      if (data?.user) {
        playClientChime();
        toast.success("Client session validated. Welcome back.");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials. Please verify details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpName || !signUpEmail || !signUpPassword) {
      toast.error("Name, email and password are required fields.");
      return;
    }
    if (!supabase) {
      toast.error("Supabase integration is offline.");
      return;
    }
    setIsLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
      });
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) throw new Error("Failed to register new credential session.");

      const uniqueNum = Math.floor(10000 + Math.random() * 90000);
      const clientId = `CL-${uniqueNum}`;

      const { error: profileErr } = await supabase.from("client_users").insert({
        id: user.id,
        client_id: clientId,
        name: signUpName,
        email: signUpEmail,
        mobile: signUpMobile || null,
        company_name: signUpCompany || null,
        designation: signUpDesignation || null,
        signing_up_for: signUpPurpose || null,
        heard_about_us: signUpSource || null,
      });
      if (profileErr) throw profileErr;

      toast.success(`Account registered! Client ID assigned: ${clientId}.`);
      setAuthMode("login");
      setLoginEmail(signUpEmail);
      setLoginPassword("");
    } catch (err: any) {
      toast.error(err.message || "Sign up sequence encountered an error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      toast.info("Session terminated safely.");
    } catch {
      toast.error("Error signing out.");
    }
  };

  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setCurrentTime(videoPlayerRef.current.currentTime);
    }
  };

  const captureVideoTimestamp = () => {
    if (videoPlayerRef.current) {
      const formatted = formatTime(videoPlayerRef.current.currentTime);
      setVideoTimestamp(formatted);
      toast.info(`Pinned video segment at ${formatted}.`);
    } else {
      toast.warning("Video player is not initialized.");
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWork || !clientProfile || !supabase) return;
    if (!feedbackComment.trim()) {
      toast.error("Feedback description cannot be empty.");
      return;
    }

    try {
      const payload = {
        client_user_id: clientProfile.id,
        work_id: selectedWork.id,
        comment: feedbackComment.trim(),
        timestamp: selectedWork.type === "video" ? videoTimestamp || null : null,
        tag: selectedWork.type === "image" ? imageTag : null,
        acknowledged: false,
      };

      const { data, error } = await supabase
        .from("client_feedback")
        .insert(payload)
        .select();

      if (error) throw error;

      playClientChime();
      toast.success("Review note dispatched to the studio team.");
      setFeedbackComment("");
      setVideoTimestamp("");
      if (data && data[0]) {
        setFeedbacks((prev) => [data[0], ...prev]);
      }
    } catch (err: any) {
      console.error("Error submitting client feedback:", err);
      toast.error("Failed to commit feedback entry.");
    }
  };

  const seekToTimestamp = (ts: string) => {
    if (videoPlayerRef.current) {
      const secs = parseTimeToSeconds(ts);
      videoPlayerRef.current.currentTime = secs;
      videoPlayerRef.current.play().catch(() => {});
      toast.info(`Seeking cut to ${ts}`);
    }
  };

  const getAvatarChar = () => {
    if (clientProfile?.name) return clientProfile.name.charAt(0).toUpperCase();
    if (clientProfile?.company_name) return clientProfile.company_name.charAt(0).toUpperCase();
    return "C";
  };

  const handleSelectWork = (work: ClientWork) => {
    setSelectedWork(work);
    setVideoTimestamp("");
    setFeedbackComment("");
  };

  const completedTasksCount = tasks.filter((t) => t.status === "Completed" || t.progress >= 100).length;
  const avgProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / tasks.length)
      : 0;
  const acknowledgedCount = feedbacks.filter((f) => f.acknowledged).length;

  const portalTabs: Array<{ id: "work" | "tasks" | "deals"; label: string; count?: number }> = [
    { id: "work", label: "Creative Review", count: works.length },
    { id: "tasks", label: "Production Tasks", count: tasks.length },
    { id: "deals", label: "Contract & Status" },
  ];

  return (
    <div className="relative min-h-screen bg-[#07080C] text-[#F4EFE6] flex flex-col justify-between overflow-x-hidden selection:bg-[#FF6A1F]/30 selection:text-white">
      {/* Top Spectral Hairline */}
      <div className="w-full h-[2px] shrink-0" style={{ background: "var(--tcs-spectrum-linear)" }} />

      {/* Subtle Ambient Spectral Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] spectral-glow opacity-20 pointer-events-none -z-10" />

      {/* TOP FLOATING PILL NAVIGATION BAR (IMAGE 3 INSPIRED) */}
      <header className="sticky top-0 z-50 w-full bg-[#07080C]/85 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          {/* Left: Studio Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onNavigateHome}
              title="Back to Studio"
              className="w-9 h-9 rounded-full bg-[#141720] border border-white/[0.08] flex items-center justify-center text-[#F4EFE6]/70 hover:text-white hover:border-white/25 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Wordmark capHeight={13} ringAnimation="spin-slow" />
          </div>

          {/* Center: Floating Light Pill Navigation Bar (Logged-In) */}
          {sessionUser && (
            <nav className="hidden md:flex items-center bg-[#F4EFE6] text-[#07080C] rounded-full p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
              {portalTabs.map((tab) => {
                const isActive = activeDashboardTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDashboardTab(tab.id)}
                    className={`relative px-5 py-2 rounded-full text-xs font-mono uppercase tracking-[0.12em] font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                      isActive ? "text-white" : "text-[#07080C]/70 hover:text-[#07080C]"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="client-top-pill"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-full -z-0"
                        style={{
                          background: "linear-gradient(135deg, #FF6A1F 0%, #E8332A 100%)",
                          boxShadow: "0 4px 16px rgba(255, 106, 31, 0.35)",
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {tab.label}
                      {tab.count !== undefined && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isActive ? "bg-black/20 text-white" : "bg-black/10 text-[#07080C]"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right: Notification Bell + Profile / Sign Out */}
          <div className="flex items-center gap-2.5 shrink-0 relative">
            {sessionUser ? (
              <>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                  aria-label="Portal Updates"
                  className="relative w-10 h-10 rounded-full bg-[#141720] border border-white/[0.08] flex items-center justify-center text-[#F4EFE6]/80 hover:text-white hover:border-white/25 transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {acknowledgedCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF6A1F] text-[9px] font-mono font-bold text-white flex items-center justify-center">
                      {acknowledgedCount}
                    </span>
                  )}
                </button>

                <div className="hidden sm:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full bg-[#141720] border border-white/[0.08]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #FF6A1F, #C2187A)" }}
                  >
                    {getAvatarChar()}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-medium text-[#F4EFE6] truncate max-w-[120px]">
                      {clientProfile?.name || "Client"}
                    </p>
                    <p className="text-[10px] font-mono text-[#F4EFE6]/50">
                      {clientProfile?.client_id || "PORTAL"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-red-300 hover:text-white border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 px-4 py-2.5 rounded-full transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>

                {/* Notifications Popover */}
                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.97 }}
                      className="absolute right-0 top-14 w-80 sm:w-96 rounded-2xl bg-[#141720] border border-white/10 shadow-2xl p-4 z-50"
                    >
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
                        <span className="font-mono text-xs uppercase tracking-widest text-[#F4EFE6]">
                          Studio Updates
                        </span>
                        <span className="font-mono text-[10px] text-[#F4EFE6]/50">
                          {acknowledgedCount} acknowledged
                        </span>
                      </div>
                      <div className="space-y-2.5 max-h-64 overflow-y-auto">
                        {feedbacks.length === 0 ? (
                          <p className="text-xs text-[#F4EFE6]/50 py-4 text-center">
                            No review updates yet.
                          </p>
                        ) : (
                          feedbacks.slice(0, 6).map((fb) => (
                            <div
                              key={fb.id}
                              className="p-3 rounded-xl bg-[#0B0D13] border border-white/[0.06] text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] text-[#FFC93C]">
                                  {fb.timestamp ? `At ${fb.timestamp}` : fb.tag || "Review Note"}
                                </span>
                                <span
                                  className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded-full ${
                                    fb.acknowledged
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : "bg-[#FF6A1F]/15 text-[#FF6A1F]"
                                  }`}
                                >
                                  {fb.acknowledged ? "Acknowledged" : "In Review"}
                                </span>
                              </div>
                              <p className="text-[#F4EFE6]/80 line-clamp-2">{fb.comment}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <span className="text-[11px] font-mono text-[#F4EFE6]/60 uppercase tracking-widest bg-[#141720] px-4 py-2 rounded-full border border-white/[0.08]">
                🔒 Encrypted Client Portal
              </span>
            )}
          </div>
        </div>

        {/* Mobile Pill Switcher */}
        {sessionUser && (
          <div className="md:hidden px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
            {portalTabs.map((tab) => {
              const isActive = activeDashboardTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveDashboardTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#FF6A1F] text-white font-semibold"
                      : "bg-[#141720] text-[#F4EFE6]/70 border border-white/[0.08]"
                  }`}
                >
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-8 lg:px-10 py-8 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!sessionUser ? (
            /* AUTH GATEWAY */
            <motion.div
              key="auth-gateway"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg mx-auto"
            >
              <div className="bg-[#141720] p-7 sm:p-10 rounded-3xl border border-white/[0.08] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: "var(--tcs-spectrum-linear)" }} />

                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <Ring size={48} stroke={3} glow={true} animate="spin-slow" />
                  </div>
                  <h2 className="font-display font-medium text-2xl sm:text-3xl text-[#F4EFE6] tracking-tight">
                    {authMode === "login" ? "Client Portal Login" : "Create Client Account"}
                  </h2>
                  <p className="text-[#F4EFE6]/50 text-xs mt-2 font-mono uppercase tracking-[0.16em]">
                    {authMode === "login"
                      ? "Review cuts, pin frame timestamps, and track milestones"
                      : "Register your brand for private deliverable access"}
                  </p>
                </div>

                {authMode === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Email Address</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#F4EFE6]/40 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="client@company.com"
                          className="w-full pl-11 pr-4 py-3.5 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Password</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[#F4EFE6]/40 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-11 pr-4 py-3.5 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-[#F4EFE6] hover:bg-white text-[#07080C] font-semibold font-mono tracking-[0.16em] text-xs uppercase rounded-full transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
                    >
                      {isLoading ? "Signing In..." : "Enter Client Workspace →"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Full Name *</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#F4EFE6]/40 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full pl-11 pr-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Email *</label>
                        <input
                          type="email"
                          required
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">WhatsApp / Phone</label>
                        <input
                          type="text"
                          value={signUpMobile}
                          onChange={(e) => setSignUpMobile(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                          className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Company / Brand</label>
                        <input
                          type="text"
                          value={signUpCompany}
                          onChange={(e) => setSignUpCompany(e.target.value)}
                          placeholder="Brand or Agency"
                          className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Role</label>
                        <input
                          type="text"
                          value={signUpDesignation}
                          onChange={(e) => setSignUpDesignation(e.target.value)}
                          placeholder="Creative Director"
                          className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Production Type</label>
                      <select
                        value={signUpPurpose}
                        onChange={(e) => setSignUpPurpose(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] outline-none"
                      >
                        <option value="">Select production type</option>
                        <option value="Brand Film / TVC">Brand Film / TVC</option>
                        <option value="AI Commercial">AI Commercial</option>
                        <option value="Trailer / Teaser">Trailer / Teaser</option>
                        <option value="Hybrid Live-Action + VFX">Hybrid Live-Action + VFX</option>
                        <option value="Music Video">Music Video</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-mono tracking-wider text-[#F4EFE6]/70">Password *</label>
                      <input
                        type="password"
                        required
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-3 bg-[#0B0D13] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-[#F4EFE6] hover:bg-white text-[#07080C] font-semibold font-mono tracking-[0.14em] text-xs uppercase rounded-full transition-all disabled:opacity-50 cursor-pointer mt-2"
                    >
                      {isLoading ? "Registering..." : "Create Client Account"}
                    </button>
                  </form>
                )}

                <div className="mt-7 text-center border-t border-white/[0.08] pt-5">
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                    className="text-xs font-mono uppercase tracking-wider text-[#F4EFE6]/70 hover:text-white transition-colors cursor-pointer"
                  >
                    {authMode === "login"
                      ? "New client? Register & receive Client ID →"
                      : "← Back to Client Login"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* FULL-WIDTH BENTO CLIENT WORKSPACE (IMAGE 3 ARCHITECTURE) */
            <motion.div
              key="client-dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              {/* TOP PAGE HEADER ROW */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6]/50 mb-1">
                    {clientProfile?.company_name || "THE CHANTING STUDIO"} • {clientProfile?.client_id || "ACTIVE CLIENT"}
                  </p>
                  <h1 className="font-display font-medium text-3xl sm:text-4xl lg:text-5xl text-[#F4EFE6] tracking-tight">
                    Welcome, {clientProfile?.name?.split(" ")[0] || "Partner"}
                  </h1>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <a
                    href="https://wa.me/919958194155"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 rounded-full bg-[#F4EFE6] hover:bg-white text-[#07080C] font-mono text-xs uppercase tracking-[0.14em] font-semibold flex items-center gap-2 shadow-lg transition-all"
                  >
                    <span>Chat with Director</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* 2-CARD HERO BENTO METRICS ROW (60% / 40% SPLIT LIKE IMAGE 3) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT BENTO CARD (7 cols): Production Progress & Live Metrics */}
                <div className="lg:col-span-7 rounded-3xl bg-[#141720] border border-white/[0.07] p-6 sm:p-7 flex flex-col justify-between gap-6">
                  <div className="grid grid-cols-3 gap-4 sm:gap-8">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6]/50 mb-2">
                        Deliverables
                      </p>
                      <p className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EFE6]">
                        {works.length}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6]/50 mb-2">
                        Tasks Complete
                      </p>
                      <p className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EFE6]">
                        {completedTasksCount}
                        <span className="text-lg text-[#F4EFE6]/40 font-normal">/{tasks.length}</span>
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6]/50 mb-2">
                        Overall Progress
                      </p>
                      <p className="font-display text-3xl sm:text-4xl font-semibold text-[#FFC93C]">
                        {avgProgress}%
                      </p>
                    </div>
                  </div>

                  {/* Spectral Production Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-[#F4EFE6]/60">
                      <span>Pipeline Completion</span>
                      <span>{feedbacks.length} Review Notes Logged</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#0B0D13] rounded-full overflow-hidden p-0.5 border border-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(avgProgress, 6)}%`,
                          background: "var(--tcs-spectrum-linear)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* RIGHT BENTO CARD (5 cols): Active Production Tier & Quick Contact */}
                <div className="lg:col-span-5 rounded-3xl bg-[#141720] border border-white/[0.07] p-6 sm:p-7 flex flex-col justify-between gap-5 relative overflow-hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#F4EFE6]/50 mb-1.5">
                        Active Production Scope
                      </p>
                      <p className="font-display text-2xl sm:text-3xl font-medium text-[#F4EFE6] leading-tight">
                        {clientProfile?.signing_up_for || "Custom Studio Production"}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-mono text-[10px] uppercase tracking-wider shrink-0">
                      ● Active
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-[#0B0D13] border border-white/[0.06]">
                      <span className="block font-mono text-[10px] uppercase text-[#F4EFE6]/45 mb-1">Client Contact</span>
                      <span className="block text-xs sm:text-sm text-[#F4EFE6] truncate">{clientProfile?.email}</span>
                    </div>
                    <div
                      className="p-3.5 rounded-2xl text-white flex flex-col justify-between"
                      style={{
                        background: "linear-gradient(135deg, #FF6A1F 0%, #E8332A 100%)",
                      }}
                    >
                      <span className="block font-mono text-[10px] uppercase text-white/80">Direct Studio Line</span>
                      <a
                        href="https://wa.me/919958194155"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm font-semibold underline underline-offset-4 mt-1"
                      >
                        +91 9958194155 ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* MAIN WORKSPACE CONTENT BY TAB */}
              {isDataLoading ? (
                <div className="rounded-3xl bg-[#141720] border border-white/[0.07] p-20 flex flex-col items-center justify-center">
                  <Ring size={44} stroke={3} animate="spin-slow" />
                  <p className="text-[#F4EFE6]/60 text-xs font-mono uppercase tracking-[0.18em] mt-4">
                    Loading your studio deliverables...
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {activeDashboardTab === "work" && (
                    <motion.div
                      key="tab-work"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-3xl bg-[#141720] border border-white/[0.07] p-5 sm:p-7 space-y-6"
                    >
                      {/* Asset Switcher Strip */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#F4EFE6]/50">
                            Dispatched Cuts & Stills
                          </p>
                          <h2 className="font-display text-xl sm:text-2xl font-medium text-[#F4EFE6] mt-0.5">
                            {selectedWork ? selectedWork.title : "Select a Deliverable"}
                          </h2>
                        </div>

                        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                          {works.length === 0 ? (
                            <span className="text-sm text-[#F4EFE6]/50">No cuts dispatched yet.</span>
                          ) : (
                            works.map((work) => {
                              const isSel = selectedWork?.id === work.id;
                              return (
                                <button
                                  key={work.id}
                                  type="button"
                                  onClick={() => handleSelectWork(work)}
                                  className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                                    isSel
                                      ? "bg-[#F4EFE6] text-[#07080C] border-[#F4EFE6] font-semibold shadow-md"
                                      : "bg-[#0B0D13] text-[#F4EFE6]/75 border-white/10 hover:border-white/30 hover:text-white"
                                  }`}
                                >
                                  {work.type === "video" ? (
                                    <Video className="w-4 h-4" />
                                  ) : (
                                    <ImageIcon className="w-4 h-4" />
                                  )}
                                  <span>{work.title}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {selectedWork ? (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                          {/* LEFT (8 cols): Cinema-Sized Player + Generous Review Form */}
                          <div className="xl:col-span-8 space-y-5">
                            <div className="rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                              {selectedWork.type === "video" ? (
                                <video
                                  ref={videoPlayerRef}
                                  src={selectedWork.url}
                                  controls
                                  onTimeUpdate={handleTimeUpdate}
                                  className="w-full aspect-video object-contain bg-black"
                                />
                              ) : (
                                <img
                                  src={selectedWork.url}
                                  alt={selectedWork.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full max-h-[560px] object-contain bg-black"
                                />
                              )}

                              <div className="px-5 py-4 bg-[#0B0D13] border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-medium text-[#F4EFE6]">{selectedWork.title}</h3>
                                  <p className="text-xs font-mono text-[#F4EFE6]/50 uppercase tracking-wider mt-0.5">
                                    {selectedWork.type} deliverable
                                  </p>
                                </div>
                                <a
                                  href={selectedWork.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono uppercase tracking-wider text-[#F4EFE6] transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                  Open Source File <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>

                            {/* Generous Trace Review Input Card */}
                            <div className="rounded-2xl bg-[#0B0D13] border border-white/[0.08] p-5 sm:p-6 space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-[#FFC93C] font-semibold">
                                  Add Frame-Accurate Review Note
                                </h4>
                                <span className="text-xs font-mono text-[#F4EFE6]/45">
                                  Synced live with Studio Directors
                                </span>
                              </div>

                              <form onSubmit={submitFeedback} className="space-y-4">
                                {selectedWork.type === "video" ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                      type="button"
                                      onClick={captureVideoTimestamp}
                                      className="py-3 px-4 bg-[#141720] hover:bg-white/[0.08] border border-white/15 rounded-xl text-xs uppercase font-mono tracking-wider font-semibold text-[#F4EFE6] flex items-center justify-center gap-2 transition-all cursor-pointer"
                                    >
                                      <Clock className="w-4 h-4 text-[#FF6A1F]" /> Stamp Current Time
                                    </button>

                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={videoTimestamp}
                                        onChange={(e) => setVideoTimestamp(e.target.value)}
                                        placeholder="Timestamp MM:SS (e.g. 0:14)"
                                        className="w-full px-4 py-3 bg-[#141720] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm font-mono text-[#F4EFE6] placeholder-[#F4EFE6]/35 outline-none"
                                      />
                                      {videoTimestamp && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono bg-[#FF6A1F]/20 text-[#FF6A1F] px-2 py-0.5 rounded-full">
                                          Pinned
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 flex-wrap">
                                    {["VFX", "Coloring", "Crop & Layout", "CGI Assets", "Typography", "Timing"].map((tagOption) => (
                                      <button
                                        key={tagOption}
                                        type="button"
                                        onClick={() => setImageTag(tagOption)}
                                        className={`px-3.5 py-2 rounded-full border text-xs font-mono uppercase transition-all cursor-pointer ${
                                          imageTag === tagOption
                                            ? "bg-[#F4EFE6] text-[#07080C] border-[#F4EFE6] font-semibold"
                                            : "bg-[#141720] border-white/10 text-[#F4EFE6]/70 hover:text-white"
                                        }`}
                                      >
                                        {tagOption}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                <textarea
                                  rows={3}
                                  required
                                  value={feedbackComment}
                                  onChange={(e) => setFeedbackComment(e.target.value)}
                                  placeholder="Describe the edit, pacing note, grade adjustment, or audio change..."
                                  className="w-full px-4 py-3.5 bg-[#141720] border border-white/10 focus:border-[#FF6A1F] rounded-xl text-sm text-[#F4EFE6] placeholder-[#F4EFE6]/35 outline-none resize-none leading-relaxed"
                                />

                                <button
                                  type="submit"
                                  className="w-full py-3.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#07080C] font-semibold font-mono tracking-[0.16em] text-xs uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Send className="w-4 h-4" /> Dispatch Review Note
                                </button>
                              </form>
                            </div>
                          </div>

                          {/* RIGHT (4 cols): Spacious Markup Timeline */}
                          <div className="xl:col-span-4 rounded-2xl bg-[#0B0D13] border border-white/[0.08] p-5 sm:p-6 flex flex-col min-h-[480px]">
                            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
                              <h4 className="font-mono text-xs uppercase tracking-[0.16em] text-[#F4EFE6] font-semibold">
                                Markup Timeline
                              </h4>
                              <span className="text-xs font-mono bg-[#141720] border border-white/10 text-[#F4EFE6]/70 px-2.5 py-1 rounded-full">
                                {feedbacks.filter((f) => f.work_id === selectedWork.id).length} notes
                              </span>
                            </div>

                            <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[600px] pr-1">
                              {feedbacks.filter((f) => f.work_id === selectedWork.id).length === 0 ? (
                                <div className="text-center py-16 text-[#F4EFE6]/45 text-sm">
                                  No review notes logged on this cut yet.
                                </div>
                              ) : (
                                feedbacks
                                  .filter((f) => f.work_id === selectedWork.id)
                                  .map((feedback) => (
                                    <div
                                      key={feedback.id}
                                      className="p-4 bg-[#141720] border border-white/[0.07] rounded-2xl space-y-2.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        {selectedWork.type === "video" && feedback.timestamp ? (
                                          <button
                                            type="button"
                                            onClick={() => seekToTimestamp(feedback.timestamp!)}
                                            className="text-xs font-mono bg-[#FF6A1F]/15 hover:bg-[#FF6A1F]/25 border border-[#FF6A1F]/30 text-[#FFC93C] px-2.5 py-1 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors"
                                          >
                                            <Play className="w-3 h-3" /> {feedback.timestamp}
                                          </button>
                                        ) : feedback.tag ? (
                                          <span className="text-xs font-mono bg-white/[0.06] border border-white/10 text-[#F4EFE6] px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                            <Tag className="w-3 h-3" /> {feedback.tag}
                                          </span>
                                        ) : (
                                          <span className="text-xs font-mono text-[#F4EFE6]/40">General Note</span>
                                        )}

                                        <span
                                          className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full flex items-center gap-1 ${
                                            feedback.acknowledged
                                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                              : "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                                          }`}
                                        >
                                          {feedback.acknowledged ? (
                                            <>
                                              <Check className="w-3 h-3" /> Done
                                            </>
                                          ) : (
                                            <>
                                              <Clock className="w-3 h-3" /> Pending
                                            </>
                                          )}
                                        </span>
                                      </div>

                                      <p className="text-sm text-[#F4EFE6]/90 leading-relaxed">{feedback.comment}</p>

                                      <p className="text-[11px] font-mono text-[#F4EFE6]/40 text-right">
                                        {new Date(feedback.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-16 text-center text-[#F4EFE6]/50 text-sm">
                          Your studio deliverables will appear here once dispatched by the production team.
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeDashboardTab === "tasks" && (
                    <motion.div
                      key="tab-tasks"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-3xl bg-[#141720] border border-white/[0.07] p-6 sm:p-8 space-y-6"
                    >
                      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                        <div className="flex items-center gap-3">
                          <Activity className="w-5 h-5 text-[#FF6A1F]" />
                          <h2 className="font-display text-2xl font-medium text-[#F4EFE6]">Production Milestones</h2>
                        </div>
                        <span className="font-mono text-xs text-[#F4EFE6]/60 bg-[#0B0D13] px-3 py-1.5 rounded-full border border-white/10">
                          {tasks.length} Active Milestones
                        </span>
                      </div>

                      {tasks.length === 0 ? (
                        <div className="py-16 text-center text-[#F4EFE6]/50 text-sm">
                          No production milestones assigned yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-5 rounded-2xl bg-[#0B0D13] border border-white/[0.08] space-y-4 flex flex-col justify-between"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="text-base font-medium text-[#F4EFE6] leading-snug">
                                  {task.task_name}
                                </h3>
                                <span
                                  className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full shrink-0 ${
                                    task.status === "Completed"
                                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                      : task.status === "In Progress"
                                      ? "bg-[#FF6A1F]/15 text-[#FFC93C] border border-[#FF6A1F]/30"
                                      : "bg-white/[0.06] text-[#F4EFE6]/60 border border-white/10"
                                  }`}
                                >
                                  {task.status}
                                </span>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-mono text-[#F4EFE6]/60">
                                  <span>Completion</span>
                                  <span className="text-[#F4EFE6]">{task.progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-[#141720] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${task.progress}%`,
                                      background: "var(--tcs-spectrum-linear)",
                                    }}
                                  />
                                </div>
                              </div>

                              {task.deadline && (
                                <div className="flex items-center gap-2 text-xs font-mono text-[#F4EFE6]/50 pt-2 border-t border-white/[0.06]">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Target Delivery: {task.deadline}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeDashboardTab === "deals" && (
                    <motion.div
                      key="tab-deals"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-3xl bg-[#141720] border border-white/[0.07] p-6 sm:p-8 space-y-6"
                    >
                      <div className="flex items-center gap-3 border-b border-white/[0.08] pb-5">
                        <div className="w-11 h-11 rounded-2xl bg-[#0B0D13] border border-white/10 flex items-center justify-center">
                          <Award className="w-5 h-5 text-[#FFC93C]" />
                        </div>
                        <div>
                          <h2 className="font-display text-2xl font-medium text-[#F4EFE6]">
                            Active Production Agreement
                          </h2>
                          <p className="text-xs font-mono text-[#F4EFE6]/50 mt-0.5">
                            Scope, account credentials, and direct producer support
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="p-6 bg-[#0B0D13] border border-white/[0.08] rounded-2xl space-y-3">
                          <div className="text-xs uppercase font-mono tracking-[0.16em] text-[#FFC93C]">
                            Production Scope
                          </div>
                          <div className="font-display font-medium text-2xl text-[#F4EFE6]">
                            {clientProfile?.signing_up_for || "Custom Studio Production Agreement"}
                          </div>
                          <p className="text-[#F4EFE6]/70 text-sm leading-relaxed">
                            Your dedicated studio production pipeline covers creative direction, AI + live-action VFX production, color grading, sound design, and final master delivery.
                          </p>
                        </div>

                        <div className="p-6 bg-[#0B0D13] border border-white/[0.08] rounded-2xl space-y-3">
                          <div className="text-xs uppercase font-mono tracking-[0.16em] text-[#FFC93C]">
                            Account Metadata
                          </div>
                          <div className="space-y-3 font-mono text-sm">
                            <div className="flex justify-between">
                              <span className="text-[#F4EFE6]/50">Client ID</span>
                              <span className="text-[#F4EFE6]">{clientProfile?.client_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#F4EFE6]/50">Company</span>
                              <span className="text-[#F4EFE6]">{clientProfile?.company_name || "Independent"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#F4EFE6]/50">Registered</span>
                              <span className="text-[#F4EFE6]">
                                {clientProfile?.created_at
                                  ? new Date(clientProfile.created_at).toLocaleDateString()
                                  : "Active"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#F4EFE6]/50">Status</span>
                              <span className="text-emerald-400">● Synchronized</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-[#0B0D13] border border-white/[0.08] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-[#141720] border border-white/10 text-[#FF6A1F] shrink-0">
                            <HelpCircle className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-medium text-[#F4EFE6]">
                              Need schedule changes or direct director notes?
                            </h4>
                            <p className="text-[#F4EFE6]/60 text-sm mt-1">
                              Add frame-accurate timestamp comments on any cut, or message the director directly on WhatsApp.
                            </p>
                          </div>
                        </div>
                        <a
                          href="https://wa.me/919958194155"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-3 rounded-full bg-[#F4EFE6] hover:bg-white text-[#07080C] font-mono text-xs uppercase tracking-[0.14em] font-semibold shrink-0 transition-all"
                        >
                          Chat with Director ↗
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-white/[0.07] py-6 bg-[#07080C] mt-10">
        <div className="max-w-[1680px] mx-auto px-6 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-[#F4EFE6]/45">
          <div>© 2026 Chaitravarna Ventures Pvt. Ltd. — The Chanting Studio • Client Portal</div>
          <div className="flex gap-4">
            <span>Encrypted Client Workspace</span>
            <span>•</span>
            <span>Delhi → Worldwide</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
