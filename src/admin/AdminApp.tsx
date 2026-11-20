import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import "./ui/tokens.css";
import { tabTransition } from "./ui/motion";

// Context & Libs
import { useSiteData, NavigationMenuItem, MediaAsset, BrandLogo, Testimonial } from "../context/SiteDataContext";
import { useToast } from "../context/ToastContext";
import { uploadToCloudinary, isCloudinaryConfigured } from "../lib/cloudinary";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { VideoBlock, PortfolioTab as PortfolioTabType } from "../types";

// Shell & UI
import { AdminShell } from "./shell/AdminShell";
import { CommandItem } from "./ui/CommandPalette";
import { Wordmark } from "../components/brand/Wordmark";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/TextInput";
import { Field } from "./ui/Field";
import { Chip } from "./ui/Chip";

// Tabs
import { SettingsTab } from "./tabs/SettingsTab";
import { BrandLogosTab } from "./tabs/BrandLogosTab";
import { PortfolioTab } from "./tabs/PortfolioTab";
import { TestimonialsTab } from "./tabs/TestimonialsTab";
import { IntakeFormTab, IntakeFormField } from "./tabs/IntakeFormTab";
import { NavigationTab } from "./tabs/NavigationTab";
import { InquiriesTab, SubmissionItem } from "./tabs/InquiriesTab";
import { AssetsTab } from "./tabs/AssetsTab";
import { AnalyticsTab } from "./tabs/AnalyticsTab";
import { ClientAccessTab, ClientUser, ClientDeliverable, ClientTask } from "./tabs/ClientAccessTab";
import { LiveChatsTab, ChatSession, ChatMessage } from "./tabs/LiveChatsTab";
import { ChatSettingsTab } from "./tabs/ChatSettingsTab";

import {
  Lock,
  FileText,
  Film,
  Inbox,
  FolderOpen,
  BarChart3,
  Users,
  MessageSquare,
  Sliders,
  Upload,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";

// Notification Audio Context
let notificationAudioContext: AudioContext | null = null;

function getNotificationAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!notificationAudioContext) {
    notificationAudioContext = new AudioContextClass();
  }
  return notificationAudioContext;
}

function unlockNotificationAudio() {
  const ctx = getNotificationAudioContext();
  if (!ctx || ctx.state !== "suspended") return;
  ctx.resume().catch((err) => {
    console.warn("AudioContext failed to unlock notification sound:", err);
  });
}

function playToneSequence(notes: number[], stepSeconds: number, peakGain: number) {
  try {
    const ctx = getNotificationAudioContext();
    if (!ctx) return;
    const play = () => {
      const startTime = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime + idx * stepSeconds);
        gain.gain.setValueAtTime(0.0001, startTime + idx * stepSeconds);
        gain.gain.exponentialRampToValueAtTime(peakGain, startTime + idx * stepSeconds + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + (idx + 1) * stepSeconds);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime + idx * stepSeconds);
        osc.stop(startTime + (idx + 1) * stepSeconds);
      });
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch (err) {
    console.warn("Audio error:", err);
  }
}

const TAB_ORDER = [
  "settings",
  "brand_logos",
  "portfolio",
  "testimonials",
  "intake_form",
  "navigation",
  "submissions",
  "assets",
  "analytics",
  "client_access",
  "live_chats",
  "chat_settings",
];

export default function AdminApp({ onNavigateHome }: { onNavigateHome?: () => void }) {
  const {
    siteSettings,
    saveSettings,
    portfolioWorks,
    addPortfolioWork,
    updatePortfolioWork,
    deletePortfolioWork,
    portfolioTabs,
    addPortfolioTab,
    updatePortfolioTab,
    deletePortfolioTab,
    brandLogos,
    addBrandLogo,
    updateBrandLogo,
    deleteBrandLogo,
    testimonials,
    addTestimonial,
    updateTestimonial,
    deleteTestimonial,
    navigationMenu,
    addNavigationItem,
    updateNavigationItem,
    deleteNavigationItem,
    reorderNavigationItems,
    mediaAssets,
    addMediaAsset,
    deleteMediaAsset,
  } = useSiteData();

  const toast = useToast();

  // Authentication State
  const [email, setEmail] = useState(() => localStorage.getItem("tcs_admin_email") || "studio@thechantingstudio.in");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("bhakty_admin_auth") === "true" || sessionStorage.getItem("bhakty_admin_auth") === "true";
  });
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check Supabase user session
  useEffect(() => {
    let active = true;
    const checkUserSession = async () => {
      if (!supabase) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (active && session?.user) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn("Auth check error:", err);
      }
    };
    checkUserSession();

    const { data: authListener } = supabase?.auth?.onAuthStateChange((_event, session) => {
      if (active && session?.user) {
        setIsAuthenticated(true);
      }
    }) || { data: { subscription: null } };

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const envPass = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_ADMIN_PASSWORD : "") || "admin_bhakty_studio";
      let loginSuccess = false;

      // 1. Static password check
      if (password === envPass) {
        loginSuccess = true;
      }
      // 2. Supabase Auth fallback
      else if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password,
          });
          if (data && data.user && !error) {
            loginSuccess = true;
          }
        } catch (authErr) {
          console.warn("Supabase Auth validation failed:", authErr);
        }
      }

      if (loginSuccess) {
        setIsAuthenticated(true);
        localStorage.setItem("bhakty_admin_auth", "true");
        sessionStorage.setItem("bhakty_admin_auth", "true");
        sessionStorage.setItem("bhakty_admin_password", password);
        localStorage.setItem("tcs_admin_email", email.trim());
        setAuthError("");
        unlockNotificationAudio();
        toast.success("Studio Administrator authenticated.");
      } else {
        setAuthError("Invalid credentials. Please verify your password.");
        toast.error("Authentication failed.");
      }
    } catch (err: any) {
      setAuthError(err?.message || "Failed to authenticate.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn("Sign out error:", err);
      }
    }
    localStorage.removeItem("bhakty_admin_auth");
    sessionStorage.removeItem("bhakty_admin_auth");
    sessionStorage.removeItem("bhakty_admin_password");
    setIsAuthenticated(false);
    toast.success("Signed out of Studio Admin.");
  };

  // Active Tab & Direction Tracking
  const [activeTab, setActiveTab] = useState<string>("settings");
  const [tabDirection, setTabDirection] = useState<1 | -1>(1);

  const handleTabChange = (newTab: string) => {
    const oldIdx = TAB_ORDER.indexOf(activeTab);
    const newIdx = TAB_ORDER.indexOf(newTab);
    setTabDirection(newIdx >= oldIdx ? 1 : -1);
    setActiveTab(newTab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Site Settings Editing & Undo/Redo Stacks
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [settingsHistory, setSettingsHistory] = useState<Record<string, string>[]>([]);
  const [settingsFuture, setSettingsFuture] = useState<Record<string, string>[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (siteSettings && Object.keys(siteSettings).length > 0) {
      setEditSettings(siteSettings);
    }
  }, [siteSettings]);

  const handleSettingChange = (key: string, val: string) => {
    setSettingsHistory((prev) => [...prev.slice(-20), { ...editSettings }]);
    setSettingsFuture([]);
    setEditSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleUndoSettings = () => {
    if (settingsHistory.length === 0) return;
    const previous = settingsHistory[settingsHistory.length - 1];
    setSettingsFuture((prev) => [editSettings, ...prev]);
    setSettingsHistory((prev) => prev.slice(0, -1));
    setEditSettings(previous);
    toast.info("Undid previous edit");
  };

  const handleRedoSettings = () => {
    if (settingsFuture.length === 0) return;
    const next = settingsFuture[0];
    setSettingsHistory((prev) => [...prev, editSettings]);
    setSettingsFuture((prev) => prev.slice(1));
    setEditSettings(next);
    toast.info("Redid edit");
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await saveSettings(editSettings);
      toast.success("Published settings to live database!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const hasUnsavedSettings = JSON.stringify(editSettings) !== JSON.stringify(siteSettings);

  // Inquiries / Form Submissions
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  const fetchSubmissions = async () => {
    if (!supabase) return;
    setIsLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (data && !error) {
        setSubmissions(data);
      }
    } catch (err) {
      console.warn("Submissions fetch error:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubmissions();
    }
  }, [isAuthenticated]);

  const handleUpdateSubmissionStatus = async (id: string, status: string) => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
    if (!supabase) return;
    try {
      await supabase.from("form_submissions").update({ status }).eq("id", id);
      toast.success(`Inquiry marked as ${status}`);
    } catch (err) {
      console.warn("Status update error:", err);
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!confirm("Are you sure you want to delete this inquiry?")) return false;
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    if (!supabase) return true;
    try {
      await supabase.from("form_submissions").delete().eq("id", id);
      toast.success("Inquiry removed");
      return true;
    } catch (err) {
      console.warn("Delete error:", err);
      return false;
    }
  };

  // Intake Form Builder Fields
  const [intakeFields, setIntakeFields] = useState<IntakeFormField[]>([
    {
      id: "1",
      label: "Full Name",
      field_type: "text",
      placeholder: "Elena Rostova",
      is_required: true,
      order_index: 1,
    },
    {
      id: "2",
      label: "Work Email",
      field_type: "email",
      placeholder: "elena@brand.com",
      is_required: true,
      order_index: 2,
    },
    {
      id: "3",
      label: "Company / Studio",
      field_type: "text",
      placeholder: "Prestige Films",
      is_required: false,
      order_index: 3,
    },
    {
      id: "4",
      label: "Production Tier Scope",
      field_type: "select",
      placeholder: "Select commission model...",
      is_required: true,
      options: ["Commercial Spot", "Cinematic Campaign", "Flagship World-Building"],
      order_index: 4,
    },
    {
      id: "5",
      label: "Budget Tier Allocation",
      field_type: "budget",
      placeholder: "Select budget range...",
      is_required: true,
      options: ["₹15L–₹30L", "₹30L–₹60L", "Flagship ₹1Cr+"],
      order_index: 5,
    },
    {
      id: "6",
      label: "Project Vision & Creative Brief",
      field_type: "textarea",
      placeholder: "Describe the narrative concept and visual direction...",
      is_required: true,
      order_index: 6,
    },
  ]);

  const handleAddIntakeField = async (f: Partial<IntakeFormField>) => {
    const newField: IntakeFormField = {
      id: `field_${Date.now()}`,
      label: f.label || "New Question",
      field_type: f.field_type || "text",
      placeholder: f.placeholder || "",
      is_required: Boolean(f.is_required),
      options: f.options,
      order_index: intakeFields.length + 1,
    };
    setIntakeFields((prev) => [...prev, newField]);
    toast.success("Added field to inquiry form");
    return newField;
  };

  const handleUpdateIntakeField = async (id: string, updates: Partial<IntakeFormField>) => {
    setIntakeFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
    toast.info("Updated field configuration");
  };

  const handleDeleteIntakeField = async (id: string) => {
    setIntakeFields((prev) => prev.filter((f) => f.id !== id));
    toast.success("Removed field from form");
    return true;
  };

  // Client Access State
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);
  const [clientDeliverables, setClientDeliverables] = useState<ClientDeliverable[]>([]);
  const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);

  const fetchClientUsers = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("client_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setClientUsers(data);
    } catch (err) {
      console.warn("Client users fetch error:", err);
    }
  };

  const fetchClientDetails = async (clientId: string) => {
    if (!supabase) return;
    try {
      const [delRes, taskRes] = await Promise.all([
        supabase.from("client_deliverables").select("*").eq("client_id", clientId),
        supabase.from("client_tasks").select("*").eq("client_id", clientId),
      ]);
      if (delRes.data) setClientDeliverables(delRes.data);
      if (taskRes.data) setClientTasks(taskRes.data);
    } catch (err) {
      console.warn("Client details fetch error:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchClientUsers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedClient?.client_id) {
      fetchClientDetails(selectedClient.client_id);
    }
  }, [selectedClient?.client_id]);

  const handleCreateClientAccount = async (clientData: any) => {
    const generatedId = `CL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newAccount: ClientUser = {
      id: `usr_${Date.now()}`,
      client_id: generatedId,
      name: clientData.name,
      email: clientData.email,
      company_name: clientData.company,
      mobile_number: clientData.mobile,
      designation: clientData.designation,
      purpose: clientData.purpose,
      created_at: new Date().toISOString(),
    };

    setClientUsers((prev) => [newAccount, ...prev]);
    setSelectedClient(newAccount);

    if (supabase) {
      try {
        await supabase.from("client_users").insert({
          ...newAccount,
          password: clientData.password,
        });
      } catch (err) {
        console.warn("Supabase client insert error:", err);
      }
    }

    toast.success(`Registered client account ${generatedId}!`);
    return newAccount;
  };

  const handleDeleteClientAccount = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client account?")) return false;
    setClientUsers((prev) => prev.filter((c) => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
    if (supabase) {
      try {
        await supabase.from("client_users").delete().eq("id", id);
      } catch (err) {
        console.warn("Delete client error:", err);
      }
    }
    toast.success("Client account removed");
    return true;
  };

  const handleCreateDeliverable = async (d: Partial<ClientDeliverable>) => {
    const newD: ClientDeliverable = {
      id: `del_${Date.now()}`,
      client_id: d.client_id || "",
      title: d.title || "Deliverable",
      asset_url: d.asset_url || "",
      type: d.type || "video",
      version: d.version || "v1.0",
      notes: d.notes,
    };
    setClientDeliverables((prev) => [...prev, newD]);
    if (supabase) {
      try {
        await supabase.from("client_deliverables").insert(newD);
      } catch (err) {
        console.warn("Deliverable insert error:", err);
      }
    }
    toast.success("Assigned deliverable to client");
    return newD;
  };

  const handleDeleteDeliverable = async (id: string) => {
    setClientDeliverables((prev) => prev.filter((d) => d.id !== id));
    if (supabase) {
      try {
        await supabase.from("client_deliverables").delete().eq("id", id);
      } catch (err) {
        console.warn("Delete deliverable error:", err);
      }
    }
    toast.success("Removed deliverable");
    return true;
  };

  const handleCreateTask = async (t: Partial<ClientTask>) => {
    const newT: ClientTask = {
      id: `task_${Date.now()}`,
      client_id: t.client_id || "",
      title: t.title || "Milestone Task",
      status: t.status || "In Progress",
      progress: t.progress || 0,
    };
    setClientTasks((prev) => [...prev, newT]);
    if (supabase) {
      try {
        await supabase.from("client_tasks").insert(newT);
      } catch (err) {
        console.warn("Task insert error:", err);
      }
    }
    toast.success("Created milestone task");
    return newT;
  };

  const handleUpdateTask = async (id: string, progress: number, status: string) => {
    setClientTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress, status } : t))
    );
    if (supabase) {
      try {
        await supabase.from("client_tasks").update({ progress, status }).eq("id", id);
      } catch (err) {
        console.warn("Update task error:", err);
      }
    }
    toast.info("Updated task progress");
  };

  const handleDeleteTask = async (id: string) => {
    setClientTasks((prev) => prev.filter((t) => t.id !== id));
    if (supabase) {
      try {
        await supabase.from("client_tasks").delete().eq("id", id);
      } catch (err) {
        console.warn("Delete task error:", err);
      }
    }
    toast.success("Removed milestone");
    return true;
  };

  // Live Chats State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fetchChatSessions = async () => {
    if (!supabase) return;
    setChatLoading(true);
    try {
      const { data } = await supabase
        .from("chat_sessions")
        .select("*, chat_users(*)")
        .order("last_message_at", { ascending: false });
      if (data) {
        setChatSessions(data);
        if (data.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data[0].id);
        }
      }
    } catch (err) {
      console.warn("Chat sessions fetch error:", err);
    } finally {
      setChatLoading(false);
    }
  };

  const fetchChatMessages = async (sessionId: string) => {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (data) setChatMessages(data);
    } catch (err) {
      console.warn("Chat messages fetch error:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchChatSessions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchChatMessages(selectedSessionId);
    }
  }, [selectedSessionId]);

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId || !replyText.trim() || !supabase) return;

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      session_id: selectedSessionId,
      sender_type: "admin",
      message_text: replyText.trim(),
      created_at: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setReplyText("");

    try {
      await supabase.from("chat_messages").insert(newMsg);
      await supabase
        .from("chat_sessions")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: newMsg.message_text,
          unread_count: 0,
        })
        .eq("id", selectedSessionId);
      playToneSequence([440, 554.37, 659.25], 0.08, 0.04);
    } catch (err) {
      console.warn("Send reply error:", err);
    }
  };

  const handleToggleTakeover = async (sessionId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setChatSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, is_human_takeover: newVal } : s))
    );
    if (!supabase) return;
    try {
      await supabase
        .from("chat_sessions")
        .update({ is_human_takeover: newVal })
        .eq("id", sessionId);
      toast.info(`Human takeover ${newVal ? "activated" : "deactivated"}`);
    } catch (err) {
      console.warn("Takeover toggle error:", err);
    }
  };

  // Upload Modal State
  const [uploadModal, setUploadModal] = useState({
    active: false,
    filename: "",
    filesize: "",
    percentage: 0,
    statusText: "",
    targetKey: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenUpload = (targetKey: string = "") => {
    setUploadModal((prev) => ({ ...prev, targetKey }));
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadModal({
      active: true,
      filename: file.name,
      filesize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      percentage: 20,
      statusText: "Processing media buffer...",
      targetKey: uploadModal.targetKey,
    });

    try {
      setUploadModal((prev) => ({ ...prev, percentage: 60, statusText: "Distributing to CDN..." }));
      const uploadedUrl = await uploadToCloudinary(file);
      setUploadModal((prev) => ({ ...prev, percentage: 100, statusText: "Complete!" }));

      // Add to global media assets
      const isVideo = file.type.startsWith("video") || file.name.endsWith(".mp4") || file.name.endsWith(".webm");
      await addMediaAsset(file.name, uploadedUrl, isVideo ? "video" : "image");

      // If tied to a specific setting or work
      if (uploadModal.targetKey) {
        handleSettingChange(uploadModal.targetKey, uploadedUrl);
      }

      toast.success(`Uploaded ${file.name} successfully!`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed. Please verify credentials.");
    } finally {
      setTimeout(() => {
        setUploadModal((prev) => ({ ...prev, active: false }));
      }, 900);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Command Palette Items
  const commandItems: CommandItem[] = [
    {
      id: "tab_settings",
      title: "Hero, Showreel & Copy",
      subtitle: "Edit global headline, video loops, disciplines",
      shortcut: "G S",
      action: () => handleTabChange("settings"),
    },
    {
      id: "tab_brand_logos",
      title: "Brand Logos Marquee",
      subtitle: "Manage client ticker and brand partners",
      shortcut: "G L",
      action: () => handleTabChange("brand_logos"),
    },
    {
      id: "tab_portfolio",
      title: "Selected Work & Films",
      subtitle: "Curate 4K master films and accordion showcase",
      shortcut: "G W",
      action: () => handleTabChange("portfolio"),
    },
    {
      id: "tab_testimonials",
      title: "Testimonials & Reviews",
      subtitle: "Manage executive quotes and praise",
      shortcut: "G T",
      action: () => handleTabChange("testimonials"),
    },
    {
      id: "tab_intake_form",
      title: "Inquiry Form Builder",
      subtitle: "Configure client qualification questions",
      shortcut: "G F",
      action: () => handleTabChange("intake_form"),
    },
    {
      id: "tab_navigation",
      title: "Navigation Menu",
      subtitle: "Manage navbar links and anchors",
      shortcut: "G N",
      action: () => handleTabChange("navigation"),
    },
    {
      id: "tab_submissions",
      title: "Project Inquiries",
      subtitle: "Review incoming client briefs and budgets",
      shortcut: "⌘1",
      action: () => handleTabChange("submissions"),
    },
    {
      id: "tab_assets",
      title: "Media Assets Library",
      subtitle: "Upload and inspect global 4K videos and stills",
      shortcut: "⌘2",
      action: () => handleTabChange("assets"),
    },
    {
      id: "tab_analytics",
      title: "Analytics Intelligence",
      subtitle: "Track visitor telemetry and conversion",
      shortcut: "⌘3",
      action: () => handleTabChange("analytics"),
    },
    {
      id: "tab_client_access",
      title: "Client Access & Review Studio",
      subtitle: "Manage private client portal credentials and links",
      shortcut: "⌘4",
      action: () => handleTabChange("client_access"),
    },
    {
      id: "tab_live_chats",
      title: "Live Support Chats",
      subtitle: "Human takeover and live concierge messaging",
      shortcut: "⌘5",
      action: () => handleTabChange("live_chats"),
    },
    {
      id: "tab_chat_settings",
      title: "Chat Config",
      subtitle: "Configure studio bot persona and welcome text",
      shortcut: "G C",
      action: () => handleTabChange("chat_settings"),
    },
    {
      id: "act_upload",
      title: "Upload Media Asset",
      subtitle: "Upload 4K master film or poster to CDN",
      shortcut: "⌘U",
      action: () => handleOpenUpload(""),
    },
    {
      id: "act_publish",
      title: "Publish All Changes",
      subtitle: "Synchronize local draft edits to production",
      shortcut: "⌘S",
      action: () => handleSaveSettings(),
    },
    {
      id: "act_logout",
      title: "Sign Out of Studio Admin",
      subtitle: "Terminate authenticated administrator session",
      shortcut: "⌥Q",
      action: () => handleLogout(),
    },
  ];

  // 1. Unauthenticated Login Screen
  if (!isAuthenticated) {
    return (
      <div className="tcs-admin min-h-screen flex items-center justify-center p-6 bg-[#07080C] text-[#F4EFE6] select-none relative overflow-hidden">
        {/* Subtle Ambient Backlight Glow */}
        <div className="absolute w-[500px] h-[500px] bg-[#FF6A1F]/10 rounded-full filter blur-[140px] pointer-events-none" />

        <div className="w-full max-w-md rounded-[1.75rem] bg-[#11131A] border border-white/[0.12] p-8 sm:p-10 shadow-admin-floating relative z-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Wordmark capHeight={20} ringAnimation="spin-slow" />
            </div>
            <div>
              <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest">
                STUDIO ADMINISTRATOR
              </p>
              <h2 className="text-admin-h2 text-[#F4EFE6] font-semibold tracking-tight mt-1">
                Command Access
              </h2>
              <p className="text-admin-meta text-[#F4EFE6]/55 mt-1">
                Enter your administrative credentials to manage live production channels
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <Field label="Administrator Email">
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="studio@thechantingstudio.in"
                required
              />
            </Field>

            <Field label="Password Access Key">
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                required
              />
            </Field>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-admin-meta flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              loading={isLoggingIn}
              className="w-full !h-[3.25rem]"
              icon={<Lock className="w-4 h-4" />}
            >
              Authenticate & Open Studio
            </Button>
          </form>

          {onNavigateHome && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateHome}
                className="text-admin-meta text-[#F4EFE6]/50 hover:text-white transition-colors cursor-pointer"
              >
                ← Return to Live Website
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Authenticated Dashboard Screen
  return (
    <AdminShell
      activeTab={activeTab}
      onTabChange={handleTabChange}
      unreadInquiries={submissions.filter((s) => !s.status || s.status.toLowerCase() === "new" || s.status.toLowerCase() === "pending").length}
      unreadChats={chatSessions.filter((s) => s.unread_count > 0).length}
      unreadFeedback={0}
      userEmail={email}
      onLogout={handleLogout}
      commandItems={commandItems}
    >
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Tab content wrapped in AnimatePresence with direction-aware sliding fades */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          {...tabTransition(tabDirection)}
          className="w-full"
        >
          {activeTab === "settings" && (
            <SettingsTab
              editSettings={editSettings}
              onSettingChange={handleSettingChange}
              onSave={handleSaveSettings}
              isSaving={isSavingSettings}
              hasUnsaved={hasUnsavedSettings}
              onUndo={handleUndoSettings}
              onRedo={handleRedoSettings}
              canUndo={settingsHistory.length > 0}
              canRedo={settingsFuture.length > 0}
              mediaAssets={mediaAssets}
              onOpenUpload={(key) => handleOpenUpload(key)}
              totalFilms={portfolioWorks.length}
              filmsWithPosters={portfolioWorks.filter((w) => Boolean(w.imageUrl)).length}
              filmAvatars={portfolioWorks.slice(0, 5).map((w) => ({
                id: w.id,
                name: w.title,
                src: w.imageUrl,
              }))}
              totalLogos={brandLogos.length}
              activeLogos={brandLogos.filter((l) => l.is_active).length}
              logoAvatars={brandLogos.slice(0, 5).map((l) => ({
                id: l.id,
                name: l.name,
                src: l.logo_url,
              }))}
              totalInquiries={submissions.length}
              repliedInquiries={submissions.filter((s) => s.status?.toLowerCase() === "replied").length}
              inquiryAvatars={submissions.slice(0, 5).map((s) => ({
                id: s.id,
                name: s.full_name,
                initials: s.full_name?.slice(0, 2).toUpperCase(),
              }))}
              totalAssets={mediaAssets.length}
              clientCount={clientUsers.length}
              analyticsVisitors={412}
              liveChatCount={chatSessions.length}
              onSelectChannel={handleTabChange}
            />
          )}

          {activeTab === "brand_logos" && (
            <BrandLogosTab
              brandLogos={brandLogos}
              onAddLogo={addBrandLogo}
              onUpdateLogo={updateBrandLogo}
              onDeleteLogo={deleteBrandLogo}
              mediaAssets={mediaAssets}
              onOpenUpload={() => handleOpenUpload("")}
            />
          )}

          {activeTab === "portfolio" && (
            <PortfolioTab
              portfolioWorks={portfolioWorks}
              portfolioTabs={portfolioTabs}
              onAddWork={addPortfolioWork}
              onUpdateWork={updatePortfolioWork}
              onDeleteWork={deletePortfolioWork}
              onAddTab={addPortfolioTab}
              onUpdateTab={updatePortfolioTab}
              onDeleteTab={deletePortfolioTab}
              mediaAssets={mediaAssets}
              onOpenUpload={(workId) => handleOpenUpload(workId)}
            />
          )}

          {activeTab === "testimonials" && (
            <TestimonialsTab
              testimonials={testimonials}
              onAddTestimonial={addTestimonial}
              onUpdateTestimonial={updateTestimonial}
              onDeleteTestimonial={deleteTestimonial}
              mediaAssets={mediaAssets}
              onOpenUpload={() => handleOpenUpload("")}
            />
          )}

          {activeTab === "intake_form" && (
            <IntakeFormTab
              fields={intakeFields}
              onAddField={handleAddIntakeField}
              onUpdateField={handleUpdateIntakeField}
              onDeleteField={handleDeleteIntakeField}
            />
          )}

          {activeTab === "navigation" && (
            <NavigationTab
              navItems={navigationMenu}
              onAddItem={addNavigationItem}
              onUpdateItem={updateNavigationItem}
              onDeleteItem={deleteNavigationItem}
              onReorder={reorderNavigationItems}
            />
          )}

          {activeTab === "submissions" && (
            <InquiriesTab
              submissions={submissions}
              onUpdateStatus={handleUpdateSubmissionStatus}
              onDeleteSubmission={handleDeleteSubmission}
            />
          )}

          {activeTab === "assets" && (
            <AssetsTab
              assets={mediaAssets}
              onDeleteAsset={deleteMediaAsset}
              onTriggerUpload={() => handleOpenUpload("")}
            />
          )}

          {activeTab === "analytics" && <AnalyticsTab />}

          {activeTab === "client_access" && (
            <ClientAccessTab
              clientUsers={clientUsers}
              selectedClient={selectedClient}
              onSelectClient={setSelectedClient}
              deliverables={clientDeliverables}
              tasks={clientTasks}
              onCreateClient={handleCreateClientAccount}
              onDeleteClient={handleDeleteClientAccount}
              onCreateDeliverable={handleCreateDeliverable}
              onDeleteDeliverable={handleDeleteDeliverable}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === "live_chats" && (
            <LiveChatsTab
              sessions={chatSessions}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              messages={chatMessages}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onSendReply={handleSendAdminReply}
              onToggleTakeover={handleToggleTakeover}
              isLoading={chatLoading}
            />
          )}

          {activeTab === "chat_settings" && (
            <ChatSettingsTab
              editSettings={editSettings}
              onSettingChange={handleSettingChange}
              onSave={handleSaveSettings}
              isSaving={isSavingSettings}
              hasUnsaved={hasUnsavedSettings}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Floating Upload Progress Modal */}
      <AnimatePresence>
        {uploadModal.active && (
          <div className="fixed inset-0 z-[160] bg-[#07080C]/85 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              className="rounded-[1.75rem] bg-[#11131A] border border-white/20 p-8 max-w-md w-full text-center shadow-admin-floating relative"
            >
              <div className="w-16 h-16 rounded-full bg-[#FF6A1F]/15 border border-[#FF6A1F]/30 flex items-center justify-center mx-auto mb-4 text-[#FF6A1F]">
                <Upload className="w-8 h-8 animate-bounce" />
              </div>

              <h3 className="text-admin-h3 text-[#F4EFE6] font-semibold truncate mb-1">
                {uploadModal.filename}
              </h3>
              <p className="text-admin-meta font-mono text-xs text-[#F4EFE6]/50 mb-6">
                {uploadModal.filesize}
              </p>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#181B24] overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] transition-all duration-300"
                  style={{ width: `${uploadModal.percentage}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-admin-meta font-mono text-xs text-[#F4EFE6]/60">
                <span>{uploadModal.statusText}</span>
                <span className="font-bold text-white">{uploadModal.percentage}%</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
