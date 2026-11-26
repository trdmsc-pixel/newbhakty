import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import "./ui/tokens.css";
import { tabTransition } from "./ui/motion";

// Context & Libs
import { useSiteData, NavigationMenuItem, MediaAsset, BrandLogo, Testimonial } from "../context/SiteDataContext";
import { useToast } from "../context/ToastContext";
import { uploadToCloudinary, isCloudinaryConfigured } from "../lib/cloudinary";
import { MediaUploadContext } from "./ui/MediaField";
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
];

export default function AdminApp({ onNavigateHome }: { onNavigateHome?: () => void }) {
  const {
    siteSettings,
    portfolioWorks,
    portfolioTabs = [],
    brandLogos,
    testimonials,
    navigationMenu,
    mediaAssets,
    updateSiteSetting,
    updateMultipleSiteSettings,
    updateNavigationMenu,
    updatePortfolioWorks,
    updatePortfolioTabs,
    updateBrandLogos,
    updateTestimonials,
    addMediaAsset,
    deleteMediaAsset,
    refreshAllData,
  } = useSiteData();

  const toast = useToast();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem("tcs_admin_dark") === "true"; } catch { return false; }
  });
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("tcs_admin_dark", String(next)); } catch {}
      return next;
    });
  };

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
  const [editSettings, setEditSettings] = useState<Record<string, string>>(() => ({ ...(siteSettings || {}) }));
  const [hasInitializedSettings, setHasInitializedSettings] = useState(false);
  const [settingsHistory, setSettingsHistory] = useState<Record<string, string>[]>([]);
  const [settingsFuture, setSettingsFuture] = useState<Record<string, string>[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!hasInitializedSettings && siteSettings && Object.keys(siteSettings).length > 0) {
      setEditSettings({ ...siteSettings });
      setHasInitializedSettings(true);
    }
  }, [siteSettings, hasInitializedSettings]);

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
      const ok = await updateMultipleSiteSettings(editSettings);
      if (ok !== false) {
        toast.success("Published settings to live database!");
        setSettingsFuture([]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const hasUnsavedSettings = useMemo(() => {
    if (!siteSettings || !editSettings) return false;
    const allKeys = new Set([...Object.keys(siteSettings), ...Object.keys(editSettings)]);
    for (const k of allKeys) {
      if ((siteSettings[k] ?? "") !== (editSettings[k] ?? "")) {
        return true;
      }
    }
    return false;
  }, [siteSettings, editSettings]);

  // Global shortcut (⌘S / Ctrl+S) to publish edits
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveSettings();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editSettings, updateMultipleSiteSettings]);

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
    const updated = [...intakeFields, newField];
    setIntakeFields(updated);
    handleSettingChange("booking_form_fields_json", JSON.stringify(updated));
    toast.success("Added field to inquiry form draft");
    return newField;
  };

  const handleUpdateIntakeField = async (id: string, updates: Partial<IntakeFormField>) => {
    const updated = intakeFields.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setIntakeFields(updated);
    handleSettingChange("booking_form_fields_json", JSON.stringify(updated));
    toast.info("Updated field configuration in draft");
  };

  const handleDeleteIntakeField = async (id: string) => {
    const updated = intakeFields.filter((f) => f.id !== id);
    setIntakeFields(updated);
    handleSettingChange("booking_form_fields_json", JSON.stringify(updated));
    toast.success("Removed field from form draft");
    return true;
  };

  // Portfolio Works & Tabs Handlers
  const handleAddWork = async (w: Partial<VideoBlock>) => {
    const newWork: VideoBlock = {
      id: "work_" + Date.now(),
      title: w.title || "Untitled Film",
      category: w.category || "Commercial",
      creator: w.creator || "The Chanting Studio",
      videoUrl: w.videoUrl || "",
      highResVideoUrl: w.highResVideoUrl || w.videoUrl || "",
      imageUrl: w.imageUrl || "",
      duration: w.duration || "01:00",
      ratio: (w.ratio as any) || "landscape",
      aspectRatioClass: w.aspectRatioClass || "aspect-video",
      tags: w.tags || ["AI Production"],
      tab_id: w.tab_id || portfolioTabs[0]?.id || "commercials",
      description: w.description || "",
      page: "ai",
      ...w,
    };
    const updated = [...portfolioWorks, newWork];
    await updatePortfolioWorks(updated);
    toast.success("Added film to curation");
    return newWork;
  };

  const handleUpdateWork = async (id: string, updates: Partial<VideoBlock>) => {
    const updated = portfolioWorks.map((w) =>
      w.id === id ? { ...w, ...updates } : w
    );
    await updatePortfolioWorks(updated);
    toast.success("Saved film details");
    return true;
  };

  const handleDeleteWork = async (id: string) => {
    if (!confirm("Are you sure you want to remove this film from the portfolio?")) return false;
    const updated = portfolioWorks.filter((w) => w.id !== id);
    await updatePortfolioWorks(updated);
    toast.success("Film removed from curation");
    return true;
  };

  const handleAddTab = async (type: "video" | "image") => {
    const newTab: PortfolioTabType = {
      id: "tab_" + Date.now(),
      tab_title: type === "video" ? "New Reel" : "New Curation",
      tab_type: type,
      page: "ai",
      display_order: portfolioTabs.length + 1,
    };
    const updated = [...portfolioTabs, newTab];
    await updatePortfolioTabs(updated);
    toast.success("Added portfolio category tab");
    return newTab;
  };

  const handleUpdateTab = async (id: string, name: string) => {
    const updated = portfolioTabs.map((t) =>
      t.id === id ? { ...t, tab_title: name } : t
    );
    await updatePortfolioTabs(updated);
    toast.success("Updated portfolio tab title");
    return true;
  };

  const handleDeleteTab = async (id: string) => {
    if (!confirm("Delete this portfolio category? Films under this category will remain.")) return false;
    const updated = portfolioTabs.filter((t) => t.id !== id);
    await updatePortfolioTabs(updated);
    toast.success("Portfolio category removed");
    return true;
  };

  // Brand Logos Handlers
  const handleAddBrandLogo = async (name: string, logoUrl: string) => {
    const newLogo: BrandLogo = {
      id: "logo_" + Date.now(),
      name,
      url: logoUrl,
      display_order: brandLogos.length + 1,
      page: "ai",
      is_visible: true,
      display_mode: "auto",
    };
    const updated = [...brandLogos, newLogo];
    await updateBrandLogos(updated);
    toast.success(`Added ${name} to brand marquee`);
    return newLogo;
  };

  const handleUpdateBrandLogo = async (id: string, updates: Partial<BrandLogo>) => {
    const updated = brandLogos.map((l) =>
      l.id === id ? { ...l, ...updates } : l
    );
    await updateBrandLogos(updated);
    toast.success("Updated brand logo");
    return true;
  };

  const handleDeleteBrandLogo = async (id: string) => {
    if (!confirm("Remove this client logo from the marquee?")) return false;
    const updated = brandLogos.filter((l) => l.id !== id);
    await updateBrandLogos(updated);
    toast.success("Client logo removed");
    return true;
  };

  // Testimonials Handlers
  const handleAddTestimonial = async (t: Partial<Testimonial>) => {
    const newT: Testimonial = {
      id: "testimonial_" + Date.now(),
      client_name: t.client_name || "Client Name",
      role: t.role || "Director",
      company: t.company || "Brand Partner",
      text: (t as any).quote || t.text || "Outstanding cinematic work.",
      video_url: t.video_url || "",
      rating: t.rating || 5,
      display_order: testimonials.length + 1,
      ...t,
    };
    const updated = [...testimonials, newT];
    await updateTestimonials(updated);
    toast.success("Added client endorsement");
    return newT;
  };

  const handleUpdateTestimonial = async (id: string, updates: Partial<Testimonial>) => {
    const updated = testimonials.map((t) =>
      t.id === id ? { ...t, ...updates } : t
    );
    await updateTestimonials(updated);
    toast.success("Updated endorsement");
    return true;
  };

  const handleDeleteTestimonial = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return false;
    const updated = testimonials.filter((t) => t.id !== id);
    await updateTestimonials(updated);
    toast.success("Testimonial removed");
    return true;
  };

  // Navigation Links Handlers
  const handleAddNavItem = async (item: Partial<NavigationMenuItem>) => {
    const newItem: NavigationMenuItem = {
      id: "nav_" + Date.now(),
      label: item.label || "New Link",
      target_url: (item as any).href || item.target_url || "#",
      display_order: navigationMenu.length + 1,
      is_visible: true,
      ...item,
    };
    const updated = [...navigationMenu, newItem];
    await updateNavigationMenu(updated);
    toast.success("Added navigation link");
    return newItem;
  };

  const handleUpdateNavItem = async (id: string, updates: Partial<NavigationMenuItem>) => {
    const updated = navigationMenu.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    await updateNavigationMenu(updated);
    toast.success("Updated navigation link");
    return true;
  };

  const handleDeleteNavItem = async (id: string) => {
    if (!confirm("Delete this navigation item?")) return false;
    const updated = navigationMenu.filter((item) => item.id !== id);
    await updateNavigationMenu(updated);
    toast.success("Navigation link removed");
    return true;
  };

  const handleReorderNavItems = async (newOrder: NavigationMenuItem[]) => {
    const reordered = newOrder.map((item, idx) => ({
      ...item,
      display_order: idx + 1,
    }));
    await updateNavigationMenu(reordered);
    toast.success("Reordered navigation links");
    return true;
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
      <div className="tcs-admin min-h-screen flex items-center justify-center p-6 bg-[var(--a-surface-2)] text-[var(--a-text)] select-none relative overflow-hidden">
        {/* Subtle Ambient Backlight Glow */}
        <div className="absolute w-[500px] h-[500px] bg-[var(--a-accent-soft)] rounded-full filter blur-[140px] pointer-events-none" />

        <div className="w-full max-w-md rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line)] p-8 sm:p-10 shadow-admin-floating relative z-10 space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Wordmark capHeight={20} ringAnimation="spin-slow" />
            </div>
            <div>
              <p className="text-admin-eyebrow text-[var(--a-accent)] font-mono tracking-widest">
                STUDIO ADMINISTRATOR
              </p>
              <h2 className="text-admin-h2 text-[var(--a-text)] font-semibold tracking-tight mt-1">
                Command Access
              </h2>
              <p className="text-admin-meta text-[var(--a-text-3)] mt-1">
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
              <div className="p-3.5 rounded-xl bg-[var(--a-danger-bg)] border border-red-500/30 text-[var(--a-danger-text)] text-admin-meta flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--a-danger-text)]" />
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
                className="text-admin-meta text-[var(--a-text-3)] hover:text-[var(--a-text)] transition-colors cursor-pointer"
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
      userEmail={email}
      onLogout={handleLogout}
      darkMode={darkMode}
      onToggleDarkMode={toggleDarkMode}
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
      <MediaUploadContext.Provider value={{ onUploaded: (name, url, kind) => addMediaAsset(name, url, kind) }}>
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
              activeLogos={brandLogos.filter((l) => l.is_visible !== false).length}
              logoAvatars={brandLogos.slice(0, 5).map((l) => ({
                id: l.id,
                name: l.name,
                src: l.url,
              }))}
              totalInquiries={submissions.length}
              repliedInquiries={submissions.filter((s) => s.status?.toLowerCase() === "replied").length}
              inquiryAvatars={submissions.slice(0, 5).map((s) => ({
                id: s.id,
                name: s.full_name,
                initials: s.full_name?.slice(0, 2).toUpperCase(),
              }))}
              totalAssets={mediaAssets.length}
              analyticsVisitors={412}
              onSelectChannel={handleTabChange}
            />
          )}

          {activeTab === "brand_logos" && (
            <BrandLogosTab
              brandLogos={brandLogos}
              onAddLogo={handleAddBrandLogo}
              onUpdateLogo={handleUpdateBrandLogo}
              onDeleteLogo={handleDeleteBrandLogo}
              mediaAssets={mediaAssets}
              onOpenUpload={() => handleOpenUpload("")}
            />
          )}

          {activeTab === "portfolio" && (
            <PortfolioTab
              portfolioWorks={portfolioWorks}
              portfolioTabs={portfolioTabs}
              onAddWork={handleAddWork}
              onUpdateWork={handleUpdateWork}
              onDeleteWork={handleDeleteWork}
              onAddTab={handleAddTab}
              onUpdateTab={handleUpdateTab}
              onDeleteTab={handleDeleteTab}
              mediaAssets={mediaAssets}
              onOpenUpload={(workId) => handleOpenUpload(workId)}
            />
          )}

          {activeTab === "testimonials" && (
            <TestimonialsTab
              testimonials={testimonials}
              onAddTestimonial={handleAddTestimonial}
              onUpdateTestimonial={handleUpdateTestimonial}
              onDeleteTestimonial={handleDeleteTestimonial}
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
              onAddItem={handleAddNavItem}
              onUpdateItem={handleUpdateNavItem}
              onDeleteItem={handleDeleteNavItem}
              onReorder={handleReorderNavItems}
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

        </motion.div>
      </AnimatePresence>
      </MediaUploadContext.Provider>

      {/* Floating Upload Progress Modal */}
      <AnimatePresence>
        {uploadModal.active && (
          <div className="fixed inset-0 z-[160] bg-black/40 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              className="rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line-strong)] p-8 max-w-md w-full text-center shadow-admin-floating relative"
            >
              <div className="w-16 h-16 rounded-full bg-[var(--a-accent-soft)] border border-[var(--a-accent)]/30 flex items-center justify-center mx-auto mb-4 text-[var(--a-accent)]">
                <Upload className="w-8 h-8 animate-bounce" />
              </div>

              <h3 className="text-admin-h3 text-[var(--a-text)] font-semibold truncate mb-1">
                {uploadModal.filename}
              </h3>
              <p className="text-admin-meta font-mono text-xs text-[var(--a-text-3)] mb-6">
                {uploadModal.filesize}
              </p>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[var(--a-surface-2)] overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] transition-all duration-300"
                  style={{ width: `${uploadModal.percentage}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-admin-meta font-mono text-xs text-[var(--a-text-2)]">
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
