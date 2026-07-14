import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useToast } from "../context/ToastContext";
import { 
  Lock, Mail, Phone, Building, User, Sparkles, Send, 
  ArrowLeft, LogOut, CheckCircle2, Clock, Play, Video, 
  Image as ImageIcon, Eye, MessageSquare, Plus, Check, HelpCircle,
  Tag, Calendar, CircleDot, ChevronRight, Activity, Award
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
  const [currentTime, setCurrentTime] = useState(0);

  // Active Tab in Panel Dashboard
  const [activeDashboardTab, setActiveDashboardTab] = useState<"work" | "deals">("work");

  // Format timestamp (seconds to MM:SS)
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Parse MM:SS to seconds
  const parseTimeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return parseFloat(timeStr) || 0;
  };

  // Monitor auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Get current session
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

  // Fetch client user details
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
        // Load operational client data
        await fetchClientData(data.id);
      } else {
        // Handle auth user exists but no profile row yet (e.g. edge cases)
        console.warn("Auth user logged in, but client profile row is missing.");
      }
    } catch (err: any) {
      console.error("Error fetching client profile:", err);
      toast.error("Failed to load client profile details.");
    } finally {
      setIsDataLoading(false);
    }
  };

  // Fetch works, tasks, and feedbacks
  const fetchClientData = async (clientUserId: string) => {
    if (!supabase) return;
    try {
      // 1. Fetch Work links
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

      // 2. Fetch Tasks assigned to studio
      const { data: tasksData, error: tasksErr } = await supabase
        .from("client_tasks")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: true });
      if (tasksErr) throw tasksErr;
      setTasks(tasksData || []);

      // 3. Fetch Client feedbacks
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

  // Handle Login
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
        toast.success("Client session validated. Welcome back.");
      }
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials. Please verify details.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Sign Up (Generates dynamic CL-XXXXX ID)
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
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
      });

      if (authErr) throw authErr;

      const user = authData?.user;
      if (!user) {
        throw new Error("Failed to register new credential session.");
      }

      // Generate unique client ID (CL-XXXXX)
      const uniqueNum = Math.floor(10000 + Math.random() * 90000);
      const clientId = `CL-${uniqueNum}`;

      // 2. Insert profile record in client_users table
      const { error: profileErr } = await supabase
        .from("client_users")
        .insert({
          id: user.id,
          client_id: clientId,
          name: signUpName,
          email: signUpEmail,
          mobile: signUpMobile || null,
          company_name: signUpCompany || null,
          designation: signUpDesignation || null,
          signing_up_for: signUpPurpose || null,
          heard_about_us: signUpSource || null
        });

      if (profileErr) {
        // Rollback auth user if profile insertion failed
        console.error("Profile insertion failed, cleanup required:", profileErr);
        throw profileErr;
      }

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

  // Sign out helper
  const handleSignOut = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      toast.info("Session terminated safely.");
    } catch (err) {
      toast.error("Error signing out.");
    }
  };

  // Video time update event handler
  const handleTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setCurrentTime(videoPlayerRef.current.currentTime);
    }
  };

  // Pin current video time to feedback
  const captureVideoTimestamp = () => {
    if (videoPlayerRef.current) {
      const formatted = formatTime(videoPlayerRef.current.currentTime);
      setVideoTimestamp(formatted);
      toast.info(`Pinned video segment at ${formatted}.`);
    } else {
      toast.warning("Video player is not initialized.");
    }
  };

  // Handle Feedback Submission
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
        timestamp: selectedWork.type === "video" ? (videoTimestamp || null) : null,
        tag: selectedWork.type === "image" ? imageTag : null,
        acknowledged: false
      };

      const { data, error } = await supabase
        .from("client_feedback")
        .insert(payload)
        .select();

      if (error) throw error;

      toast.success("Feedback added! Our curators will review and update progress.");
      setFeedbackComment("");
      setVideoTimestamp("");
      
      // Refresh feedbacks
      if (data && data[0]) {
        setFeedbacks(prev => [data[0], ...prev]);
      }
    } catch (err: any) {
      console.error("Error submitting client feedback:", err);
      toast.error("Failed to commit feedback entry.");
    }
  };

  // Seek video to specific comment timestamp
  const seekToTimestamp = (ts: string) => {
    if (videoPlayerRef.current) {
      const secs = parseTimeToSeconds(ts);
      videoPlayerRef.current.currentTime = secs;
      videoPlayerRef.current.play().catch(() => {});
      toast.info(`Seeking review track to ${ts}`);
    }
  };

  // Get letter avatar
  const getAvatarChar = () => {
    if (clientProfile?.name) return clientProfile.name.charAt(0).toUpperCase();
    if (clientProfile?.company_name) return clientProfile.company_name.charAt(0).toUpperCase();
    return "C";
  };

  // Select active work to trace
  const handleSelectWork = (work: ClientWork) => {
    setSelectedWork(work);
    setVideoTimestamp("");
    setFeedbackComment("");
  };

  return (
    <div className="relative min-h-screen bg-[#050508] text-white flex flex-col justify-between selection:bg-violet-500/30 selection:text-violet-200">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* HEADER BAR */}
      <header className="w-full border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-xs font-mono tracking-widest text-gray-400 hover:text-white uppercase transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-accent" /> Back to Studio
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-gradient-to-r from-amber-300 to-violet-500" />
            <span className="font-display font-medium text-sm text-white tracking-tight uppercase">
              The Chanting Studio // Client Access
            </span>
          </div>

          {sessionUser ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs font-mono tracking-widest text-red-400 hover:text-red-300 uppercase transition-colors border border-red-500/10 hover:border-red-500/20 bg-red-500/5 px-3.5 py-1.5 rounded-full"
            >
              <LogOut className="w-3 h-3" /> Log Out
            </button>
          ) : (
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/10">
              🔒 Encrypted Gateway
            </span>
          )}
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-8 flex flex-col justify-center">
        
        <AnimatePresence mode="wait">
          {!sessionUser ? (
            /* ========================================================================= */
            /* GATEWAY / SIGN-IN & SIGN-UP MODULE                                        */
            /* ========================================================================= */
            <motion.div
              key="auth-gateway"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="glass-panel-heavy p-8 rounded-3xl border border-white/10 relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-600 via-amber-400 to-violet-600" />
                
                <div className="text-center mb-8">
                  <div className="w-12 h-12 rounded-full bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-5 h-5 text-violet-400 animate-pulse" />
                  </div>
                  <h2 className="font-display font-light text-2xl text-white tracking-tight">
                    {authMode === "login" ? "Global Client Gateway" : "Create Client Account"}
                  </h2>
                  <p className="text-gray-500 text-xs mt-1 font-mono uppercase tracking-wider">
                    {authMode === "login" ? "Sign in to manage and view deliverables" : "Register company and design specifications"}
                  </p>
                </div>

                {authMode === "login" ? (
                  /* LOGIN FORM */
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Mail Identity</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="client@company.com"
                          className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Password Key</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold font-display tracking-wide text-xs uppercase rounded-xl transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-6"
                    >
                      {isLoading ? "Validating Session..." : "Acquire Access"}
                    </button>
                  </form>
                ) : (
                  /* SIGN UP FORM */
                  <form onSubmit={handleSignUp} className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Full Identity / Name *</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={signUpName}
                          onChange={(e) => setSignUpName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          placeholder="name@agency.com"
                          className="w-full px-3 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Mobile Number</label>
                        <input
                          type="text"
                          value={signUpMobile}
                          onChange={(e) => setSignUpMobile(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                          className="w-full px-3 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Company Name</label>
                        <input
                          type="text"
                          value={signUpCompany}
                          onChange={(e) => setSignUpCompany(e.target.value)}
                          placeholder="Acme Studios"
                          className="w-full px-3 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Designation</label>
                        <input
                          type="text"
                          value={signUpDesignation}
                          onChange={(e) => setSignUpDesignation(e.target.value)}
                          placeholder="Creative Lead"
                          className="w-full px-3 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">What are you signing up for?</label>
                      <select
                        value={signUpPurpose}
                        onChange={(e) => setSignUpPurpose(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-black/70 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm text-gray-300 outline-none"
                      >
                        <option value="">Select an option</option>
                        <option value="Short-Form Ads">Short-Form Creative Ads</option>
                        <option value="Cinema Grade Ads">Full Cinematic Production</option>
                        <option value="Fine-Tune Style Models">Custom style LoRA/fine-tunes</option>
                        <option value="Enterprise Curation">Enterprise Visual Pipeline</option>
                        <option value="Other">Other Custom Inquiry</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Where did you hear about us?</label>
                      <input
                        type="text"
                        value={signUpSource}
                        onChange={(e) => setSignUpSource(e.target.value)}
                        placeholder="Google, Twitter, Colleague, Showcase..."
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Security Password *</label>
                      <input
                        type="password"
                        required
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2.5 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-sm transition-all text-white placeholder-gray-600 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold font-display tracking-wide text-xs uppercase rounded-xl transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {isLoading ? "Registering Core Profile..." : "Submit Registration"}
                    </button>
                  </form>
                )}

                {/* Switch Login / Sign Up */}
                <div className="mt-6 text-center border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
                    className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                  >
                    {authMode === "login" 
                      ? "Request registration & setup client ID" 
                      : "Already have client credentials? Gateway Login"}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ========================================================================= */
            /* DASHBOARD / LOGGED-IN EXPERIENCE                                          */
            /* ========================================================================= */
            <motion.div
              key="client-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full min-h-[70vh]"
            >
              
              {/* SIDEBAR PANEL: PROFILE & ASSIGNED TASKS (cols: 4) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Profile Card */}
                <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center relative">
                  <div className="absolute top-4 right-4 bg-violet-600/10 border border-violet-500/30 text-violet-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full">
                    {clientProfile?.client_id || "CL-PENDING"}
                  </div>
                  
                  {/* Dynamic letter avatar */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-500 to-violet-800 flex items-center justify-center text-2xl font-display font-bold text-white shadow-lg shadow-violet-500/20 mb-3 border border-white/20 select-none">
                    {getAvatarChar()}
                  </div>
                  
                  <h3 className="font-display font-medium text-lg leading-snug">{clientProfile?.name || "Client"}</h3>
                  <p className="text-gray-500 text-xs font-mono">{clientProfile?.designation || "Creative partner"} @ {clientProfile?.company_name || "Enterprise"}</p>
                  
                  <div className="w-full border-t border-white/5 my-4 pt-4 text-left space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-500" /> Email</span>
                      <span className="text-white truncate max-w-[200px] font-mono">{clientProfile?.email}</span>
                    </div>
                    {clientProfile?.mobile && (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-500" /> Phone</span>
                        <span className="text-white font-mono">{clientProfile.mobile}</span>
                      </div>
                    )}
                    {clientProfile?.signing_up_for && (
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-gray-500" /> Deal Tier</span>
                        <span className="text-accent font-medium">{clientProfile.signing_up_for}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Studio Tasks list */}
                <div className="glass-panel p-6 rounded-3xl border border-white/10">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                    <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-violet-400" /> Studio Tasks Track
                    </h3>
                    <span className="text-[10px] font-mono bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded">
                      {tasks.length} Active
                    </span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 text-xs">
                      No active tasks currently dispatched by curators.
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {tasks.map((task) => (
                        <div key={task.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-semibold text-white leading-tight">{task.task_name}</span>
                            <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 ${
                              task.status === "Completed" 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : task.status === "In Progress"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-gray-500/10 text-gray-400 border border-gray-500/10"
                            }`}>
                              {task.status}
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono text-gray-500">
                              <span>Progress</span>
                              <span>{task.progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-violet-600 to-indigo-400 transition-all duration-500"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>

                          {task.deadline && (
                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-500">
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span>Target Delivery: {task.deadline}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* MAIN CONTENT WORKSPACE: DELIVERABLES & TRACING (cols: 8) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Horizontal Navigation Tabs */}
                <div className="flex gap-3 border-b border-white/10 pb-4">
                  <button
                    onClick={() => setActiveDashboardTab("work")}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold font-display tracking-wider uppercase transition-all flex items-center gap-2 border ${
                      activeDashboardTab === "work"
                        ? "bg-violet-600 text-white border-violet-500/40 shadow-md shadow-violet-600/10"
                        : "text-gray-400 hover:text-white bg-white/5 border-transparent hover:bg-white/10"
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" /> Creative Take-and-Trace
                  </button>
                  <button
                    onClick={() => setActiveDashboardTab("deals")}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold font-display tracking-wider uppercase transition-all flex items-center gap-2 border ${
                      activeDashboardTab === "deals"
                        ? "bg-violet-600 text-white border-violet-500/40 shadow-md shadow-violet-600/10"
                        : "text-gray-400 hover:text-white bg-white/5 border-transparent hover:bg-white/10"
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" /> Active Contract & Status
                  </button>
                </div>

                {isDataLoading ? (
                  <div className="glass-panel p-16 rounded-3xl border border-white/10 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mb-4" />
                    <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Synchronizing secure client node...</p>
                  </div>
                ) : activeDashboardTab === "work" ? (
                  
                  /* ========================================================================= */
                  /* WORK FEEDBACK TAB                                                         */
                  /* ========================================================================= */
                  <div className="space-y-6">
                    
                    {/* Work selector strip */}
                    <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-2">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-gray-500">Dispatched Project Assets</div>
                      <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
                        {works.length === 0 ? (
                          <div className="text-gray-600 text-xs py-1">No shared render assets dispatched for your account.</div>
                        ) : (
                          works.map((work) => (
                            <button
                              key={work.id}
                              onClick={() => handleSelectWork(work)}
                              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold tracking-tight transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                                selectedWork?.id === work.id
                                  ? "bg-white/10 text-white border-white/20"
                                  : "bg-black/35 text-gray-400 border-white/5 hover:text-gray-200 hover:border-white/10"
                              }`}
                            >
                              {work.type === "video" ? <Video className="w-3.5 h-3.5 text-violet-400" /> : <ImageIcon className="w-3.5 h-3.5 text-amber-400" />}
                              {work.title}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {selectedWork && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* Media Display Viewer (cols: 7) */}
                        <div className="lg:col-span-7 space-y-4">
                          <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden bg-black/80 relative">
                            {selectedWork.type === "video" ? (
                              <div className="aspect-video w-full flex items-center justify-center">
                                <video
                                  ref={videoPlayerRef}
                                  src={selectedWork.url}
                                  controls
                                  onTimeUpdate={handleTimeUpdate}
                                  className="w-full h-full object-contain aspect-video"
                                />
                              </div>
                            ) : (
                              <div className="aspect-video w-full flex items-center justify-center overflow-hidden">
                                <img
                                  src={selectedWork.url}
                                  alt={selectedWork.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-contain aspect-video max-h-[400px]"
                                />
                              </div>
                            )}
                            <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold truncate max-w-[250px]">{selectedWork.title}</h4>
                                <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{selectedWork.type} Asset</p>
                              </div>
                              <a
                                href={selectedWork.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono uppercase text-gray-300 hover:text-white transition-colors"
                              >
                                View Raw URL
                              </a>
                            </div>
                          </div>

                          {/* Trace Feedback Form */}
                          <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
                            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-violet-400">Submit Trace Review</h4>
                            
                            <form onSubmit={submitFeedback} className="space-y-3">
                              {/* Conditionally render video/image helper fields */}
                              {selectedWork.type === "video" ? (
                                <div className="grid grid-cols-2 gap-3 items-center">
                                  <button
                                    type="button"
                                    onClick={captureVideoTimestamp}
                                    className="py-2.5 px-3 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 rounded-xl text-[10px] uppercase font-mono tracking-wider font-bold text-violet-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                  >
                                    <Clock className="w-3.5 h-3.5" /> Stamp Current Time
                                  </button>
                                  
                                  <div className="relative">
                                    <input
                                      type="text"
                                      value={videoTimestamp}
                                      onChange={(e) => setVideoTimestamp(e.target.value)}
                                      placeholder="MM:SS (e.g. 0:12)"
                                      className="w-full px-3 py-2 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-xl text-xs font-mono text-white placeholder-gray-600 outline-none"
                                    />
                                    {videoTimestamp && (
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono bg-violet-500/20 text-violet-300 px-1 py-0.5 rounded">
                                        Pinned
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-mono tracking-wider text-gray-500">Feedback Categorization Tag</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {["VFX", "Coloring", "Crop & Layout", "CGI Assets", "Typography", "Speed/Timing"].map((tagOption) => (
                                      <button
                                        key={tagOption}
                                        type="button"
                                        onClick={() => setImageTag(tagOption)}
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase transition-all cursor-pointer ${
                                          imageTag === tagOption
                                            ? "bg-amber-400/15 border-amber-400 text-amber-300 font-bold"
                                            : "bg-black/40 border-white/5 text-gray-500 hover:text-gray-300"
                                        }`}
                                      >
                                        {tagOption}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <textarea
                                  rows={3}
                                  required
                                  value={feedbackComment}
                                  onChange={(e) => setFeedbackComment(e.target.value)}
                                  placeholder="Describe required changes or review feedback for our designers..."
                                  className="w-full px-4 py-3 bg-black/50 border border-white/10 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 rounded-2xl text-xs transition-all text-white placeholder-gray-600 outline-none resize-none"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold font-display tracking-widest text-[10px] uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Send className="w-3 h-3" /> Dispatch Review Comment
                              </button>
                            </form>
                          </div>

                        </div>

                        {/* Existing Feedback Timeline (cols: 5) */}
                        <div className="lg:col-span-5 space-y-4">
                          <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col min-h-[350px]">
                            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-gray-400 border-b border-white/5 pb-3 mb-3 flex justify-between items-center">
                              <span>Markup Timeline</span>
                              <span className="text-[10px] font-mono bg-white/5 border border-white/10 text-gray-500 px-2 py-0.5 rounded">
                                {feedbacks.filter(f => f.work_id === selectedWork.id).length} Entries
                              </span>
                            </h4>

                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[450px] pr-1">
                              {feedbacks.filter(f => f.work_id === selectedWork.id).length === 0 ? (
                                <div className="text-center py-12 text-gray-600 text-xs">
                                  No feedback logged for this render asset yet.
                                </div>
                              ) : (
                                feedbacks
                                  .filter((f) => f.work_id === selectedWork.id)
                                  .map((feedback) => (
                                    <div 
                                      key={feedback.id} 
                                      className={`p-3 bg-white/[0.01] border border-white/5 rounded-2xl space-y-1.5 transition-all relative ${
                                        feedback.acknowledged ? "border-emerald-500/10" : ""
                                      }`}
                                    >
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="flex items-center gap-1.5">
                                          {selectedWork.type === "video" && feedback.timestamp ? (
                                            <button
                                              onClick={() => seekToTimestamp(feedback.timestamp!)}
                                              className="text-[9px] font-mono bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                              <Play className="w-2.5 h-2.5 shrink-0" /> {feedback.timestamp}
                                            </button>
                                          ) : feedback.tag ? (
                                            <span className="text-[8px] font-mono bg-amber-400/10 border border-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                              <Tag className="w-2.5 h-2.5 shrink-0" /> {feedback.tag}
                                            </span>
                                          ) : null}
                                        </div>

                                        <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 ${
                                          feedback.acknowledged 
                                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                                            : "bg-amber-500/10 text-amber-400 border border-amber-500/15"
                                        }`}>
                                          {feedback.acknowledged ? (
                                            <><Check className="w-2 h-2" /> Acknowledged</>
                                          ) : (
                                            <><Clock className="w-2 h-2" /> Pending Review</>
                                          )}
                                        </span>
                                      </div>

                                      <p className="text-xs text-gray-300 leading-normal font-sans font-light select-none">
                                        {feedback.comment}
                                      </p>
                                      
                                      <div className="text-[8px] text-gray-600 text-right font-mono">
                                        {new Date(feedback.created_at).toLocaleDateString()}
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                ) : (
                  
                  /* ========================================================================= */
                  /* DEALS & CONTRACT TAB                                                      */
                  /* ========================================================================= */
                  <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                        <Award className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h3 className="font-display font-medium text-lg">Active Studio contract agreements</h3>
                        <p className="text-gray-500 text-xs font-mono">Project specifications, milestones and SLAs</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3">
                        <div className="text-[10px] uppercase font-mono tracking-widest text-violet-400">Active Service Tier</div>
                        <div className="font-display font-light text-2xl text-white">
                          {clientProfile?.signing_up_for || "Cinema Grade Ads Agreement"}
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed">
                          Your active agency subscription guarantees up to 8K AI video upscaling, custom prompt orchestrations, and temporal coherence stabilization.
                        </p>
                      </div>

                      <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl space-y-3">
                        <div className="text-[10px] uppercase font-mono tracking-widest text-violet-400">Account Identity / Metadata</div>
                        <div className="space-y-2 font-mono text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Client ID:</span>
                            <span className="text-white">{clientProfile?.client_id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Node Registered:</span>
                            <span className="text-white">{clientProfile?.created_at ? new Date(clientProfile.created_at).toLocaleDateString() : "Active"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Status Node:</span>
                            <span className="text-emerald-400">Synchronized // ACTIVE</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-2xl flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400 shrink-0">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold">Need custom changes to your deliverables schedule?</h4>
                        <p className="text-gray-500 text-[11px] leading-relaxed">
                          You can easily add tracing review comments directly on your deliverables above. If you have custom budget changes, SLA updates, or need direct audio adjustments, please contact our concierge system using the bottom-right chat bubble.
                        </p>
                      </div>
                    </div>
                  </div>

                )}

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* FOOTER METRICS */}
      <footer className="w-full border-t border-white/5 py-6 bg-black/60 backdrop-blur-sm mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-gray-600">
          <div>
            Generative Temporal Coherence in Visual Curation // thechantingstudio.in
          </div>
          <div className="flex gap-4">
            <span>Client SLA Node v1.12</span>
            <span>•</span>
            <span>Secure WebSockets Active</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
