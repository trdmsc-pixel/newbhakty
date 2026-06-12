import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSiteData, NavigationMenuItem, MediaAsset, BrandLogo, Testimonial } from "../context/SiteDataContext";
import { useToast } from "../context/ToastContext";
import { uploadToCloudinary, isCloudinaryConfigured } from "../lib/cloudinary";
import { VideoBlock, PricingTier, PortfolioTab } from "../types";
import BackgroundGradients from "./BackgroundGradients";
import { 
  Lock, Settings, Compass, HelpCircle, 
  Plus, Trash2, ArrowUp, ArrowDown, Save, 
  Upload, AlertTriangle, ArrowRight, ShieldCheck, CheckCheck, Check, Edit2, Play, PlusCircle,
  Undo, Redo, GripVertical, Sparkles, BrainCircuit, FileText, BarChart3, Video, Loader2,
  Palette, Sliders, Image, MessageSquare, Send, Type, ChevronDown, ChevronUp, X
} from "lucide-react";

import { WEB_THEMES, getActiveTheme } from "../lib/themes";
import AnalyticsDashboard from "./AnalyticsDashboard";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const generateUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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

function playToneSequence(notes: number[], stepSeconds: number, peakGain: number, warnLabel: string) {
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
        
        gain.gain.setValueAtTime(0, startTime + idx * stepSeconds);
        gain.gain.linearRampToValueAtTime(peakGain, startTime + idx * stepSeconds + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * stepSeconds + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime + idx * stepSeconds);
        osc.stop(startTime + idx * stepSeconds + 0.5);
      });
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(play).catch((err) => {
        console.warn(`AudioContext failed to play ${warnLabel} sound:`, err);
      });
      return;
    }

    play();
  } catch (err) {
    console.warn(`AudioContext failed to play ${warnLabel} sound:`, err);
  }
}

function playChatNotificationSound() {
  playToneSequence([587.33, 880], 0.1, 0.2, "chat");
}

function playIntakeNotificationSound() {
  playToneSequence([261.63, 329.63, 392.00, 523.25], 0.12, 0.15, "intake");
}

export default function AdminPanel({ onNavigateHome }: { onNavigateHome: () => void }) {
  const {
    siteSettings,
    navigationMenu,
    portfolioWorks,
    portfolioTabs = [],
    pricingTiers,
    isUsingSupabase,
    mediaAssets,
    brandLogos,
    testimonials,
    updateSiteSetting,
    updateMultipleSiteSettings,
    updateNavigationMenu,
    updatePortfolioWorks,
    updatePricingTiers,
    updatePortfolioTabs,
    addMediaAsset,
    deleteMediaAsset,
    updateBrandLogos,
    updateTestimonials,
    activePage,
    setActivePage,
  } = useSiteData();



  const [isLightMode, setIsLightMode] = useState<boolean>(() => {
    return localStorage.getItem("bhakty_admin_light_mode") === "true";
  });

  const toggleLightMode = () => {
    const next = !isLightMode;
    setIsLightMode(next);
    localStorage.setItem("bhakty_admin_light_mode", String(next));
    toast.success(`Switched to ${next ? "Day" : "Night"} Mode.`);
  };

  const theme = getActiveTheme(siteSettings.website_theme);
  const toast = useToast();

  // Authentication State
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("bhakty_admin_auth") === "true" || sessionStorage.getItem("bhakty_admin_auth") === "true";
  });
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const envPass = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_ADMIN_PASSWORD : "") || "admin_bhakty_studio";
      let loginSuccess = false;

      // 1. Verify static environment variable password
      if (password === envPass) {
        loginSuccess = true;
      }
      // 2. Fallback: Authenticate against Supabase Auth using email studio@bhakty.life
      else if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: "studio@bhakty.life",
            password: password
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
        setAuthError("");
        unlockNotificationAudio();
        toast.success("Security access granted. Welcome to Axiom Core.");
      } else {
        setAuthError("Unauthorized access key. Please verify security password.");
        toast.error("Security access validation failed.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // UI Navigation state
  const [activeTab, setActiveTab] = useState<"settings" | "navigation" | "portfolio" | "pricing" | "assets" | "submissions" | "analytics" | "intake_form" | "brand_logos" | "testimonials" | "live_chats" | "chat_settings">("settings");

  useEffect(() => {
    if (!isAuthenticated) return;

    const unlock = () => unlockNotificationAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [isAuthenticated]);

  // Chat console states
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [chatSessionsLoading, setChatSessionsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of support messages whenever chatMessages changes
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Synchronize siteSettings with local editSettings when context loads/updates
  useEffect(() => {
    if (siteSettings) {
      setEditSettings(prev => ({ ...prev, ...siteSettings }));
    }
  }, [siteSettings]);

  // Page Scope State for Scoped Settings, Forms, Portfolios, etc.
  const [adminPageScope, setAdminPageScope] = useState<"ai" | "live" | "app">(activePage);

  const getScopeStyle = () => {
    if (adminPageScope === "live") {
      return {
        accentBg: "bg-pink-600 hover:bg-pink-500 text-white",
        focusBorder: "focus:border-pink-500/40",
        focusRing: "focus:ring-pink-500/20",
        headingText: "text-pink-500",
        labelText: "text-pink-400",
        label: "Live-Action Production",
      };
    } else if (adminPageScope === "app") {
      return {
        accentBg: "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20",
        focusBorder: "focus:border-violet-500/40",
        focusRing: "focus:ring-violet-500/20",
        headingText: "text-violet-400",
        labelText: "text-violet-400/90",
        label: "Mobile App Version",
      };
    } else {
      return {
        accentBg: "bg-[#ffea00] hover:bg-[#ffcc00] text-black",
        focusBorder: "focus:border-[#ffea00]/40",
        focusRing: "focus:ring-[#ffea00]/20",
        headingText: "text-yellow-400",
        labelText: "text-yellow-400/90",
        label: "AI Production",
      };
    }
  };
  const scopeStyle = getScopeStyle();

  // Global Assets state for tabs & collapse/expand toggles
  const [assetTabFilter, setAssetTabFilter] = useState<"all" | "image" | "video">("all");
  const [isAssetLibraryExpanded, setIsAssetLibraryExpanded] = useState<boolean>(true);

  // Declare portfolio and pricing edit states here so they can be referenced in useEffect hooks
  const [editWorks, setEditWorks] = useState<VideoBlock[]>([]);
  const [editPricing, setEditPricing] = useState<PricingTier[]>([]);

  // Synchronize local states when context data changes (e.g. active page switches)
  useEffect(() => {
    if (portfolioWorks) {
      setEditWorks([...portfolioWorks]);
    }
  }, [portfolioWorks]);

  useEffect(() => {
    if (pricingTiers) {
      setEditPricing([...pricingTiers]);
    }
  }, [pricingTiers]);

  useEffect(() => {
    if (portfolioTabs) {
      setEditTabs([...portfolioTabs]);
      if (portfolioTabs.length > 0) {
        if (!adminActiveTabId || !portfolioTabs.some(t => t.id === adminActiveTabId)) {
          setAdminActiveTabId(portfolioTabs[0].id);
        }
      } else {
        setAdminActiveTabId("");
      }
    }
  }, [portfolioTabs]);

  // Scoped setting helpers
  const handleSettingChangeScoped = (baseKey: string, value: string) => {
    let key = baseKey;
    if ([
      "hero_badge_text", "hero_title_1", "hero_title_2", "hero_title_3", "hero_description",
      "hero_cta_booking_text", "hero_cta_work_text", "hero_stat1_value", "hero_stat1_label",
      "hero_stat2_value", "hero_stat2_label", "hero_stat3_value", "hero_stat3_label",
      "hero_video_bg_url", "hero_padding_top", "hero_bg_opacity", "hero_bg_blur",
      "hero_bg_overlay", "hero_text_align", "hero_max_width", "hero_title_size",
      "hero_subtitle_size", "hero_title_color", "hero_title_color_line2", "hero_subtitle_color",
      "hero_cta_text", "hero_cta_bg", "hero_cta_color", "hero_cta_size", "hero_cta_glow",
      "hero_cta_glow_color", "hero_cta_icon", "navbar_full_width"
    ].includes(baseKey)) {
      if (adminPageScope === "live") {
        key = `page2_${baseKey}`;
      } else if (adminPageScope === "app") {
        key = `app_${baseKey}`;
      } else {
        key = baseKey;
      }
    }
    setEditSettings(prev => ({ ...prev, [key]: value }));
  };

  const getSettingValueScoped = (baseKey: string, fallback: string = "") => {
    let key = baseKey;
    if ([
      "hero_badge_text", "hero_title_1", "hero_title_2", "hero_title_3", "hero_description",
      "hero_cta_booking_text", "hero_cta_work_text", "hero_stat1_value", "hero_stat1_label",
      "hero_stat2_value", "hero_stat2_label", "hero_stat3_value", "hero_stat3_label",
      "hero_video_bg_url", "hero_padding_top", "hero_bg_opacity", "hero_bg_blur",
      "hero_bg_overlay", "hero_text_align", "hero_max_width", "hero_title_size",
      "hero_subtitle_size", "hero_title_color", "hero_title_color_line2", "hero_subtitle_color",
      "hero_cta_text", "hero_cta_bg", "hero_cta_color", "hero_cta_size", "hero_cta_glow",
      "hero_cta_glow_color", "hero_cta_icon", "navbar_full_width"
    ].includes(baseKey)) {
      if (adminPageScope === "live") {
        key = `page2_${baseKey}`;
      } else if (adminPageScope === "app") {
        key = `app_${baseKey}`;
      } else {
        key = baseKey;
      }
    }
    return editSettings[key] || fallback;
  };

  // Brand Logos & Testimonials Edit State
  const [editLogos, setEditLogos] = useState<BrandLogo[]>([]);
  const [editTestimonials, setEditTestimonials] = useState<Testimonial[]>([]);

  const [uploadModal, setUploadModal] = useState<{
    active: boolean;
    filename: string;
    filesize: string;
    percentage: number;
    statusText: string;
  }>({
    active: false,
    filename: "",
    filesize: "",
    percentage: 0,
    statusText: "",
  });

  const runUploadWithModal = async (
    file: File, 
    uploadFn: () => Promise<string>,
    options?: { fileIndex?: number; totalFiles?: number }
  ): Promise<string> => {
    const sizeKb = (file.size / 1024).toFixed(2) + " KB";
    const prefix = options && options.fileIndex && options.totalFiles ? `[${options.fileIndex}/${options.totalFiles}] ` : "";
    setUploadModal({
      active: true,
      filename: file.name,
      filesize: sizeKb,
      percentage: 0,
      statusText: `${prefix}Initiating upload handshake...`,
    });

    const interval = setInterval(() => {
      setUploadModal((prev) => {
        if (!prev.active) {
          clearInterval(interval);
          return prev;
        }
        if (prev.percentage < 92) {
          const increment = Math.max(1, Math.floor(Math.random() * 6));
          const nextPercent = Math.min(92, prev.percentage + increment);
          return {
            ...prev,
            percentage: nextPercent,
            statusText: prefix + (nextPercent < 30 ? "Negotiating security cipher keys..." :
                       nextPercent < 60 ? "Transporting file segments to GitHub CDN..." :
                       "Syncing cache nodes at edges..."),
          };
        }
        return prev;
      });
    }, 150);

    try {
      const url = await uploadFn();
      clearInterval(interval);
      setUploadModal((prev) => ({
        ...prev,
        percentage: 100,
        statusText: `${prefix}Ingestion and edge cache syncing completed!`,
      }));
      await new Promise((resolve) => setTimeout(resolve, 800));
      setUploadModal((prev) => ({ ...prev, active: false }));
      return url;
    } catch (err: any) {
      clearInterval(interval);
      setUploadModal((prev) => ({
        ...prev,
        percentage: 0,
        statusText: `${prefix}Handshake rejected: ${err?.message || "Unknown Error"}`,
      }));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setUploadModal((prev) => ({ ...prev, active: false }));
      throw err;
    }
  };
  const [saveStatus, setSaveStatus] = useState<{ [tab: string]: "idle" | "saving" | "saved" | "error" }>({
    settings: "idle",
    navigation: "idle",
    portfolio: "idle",
    pricing: "idle",
    assets: "idle",
    submissions: "idle",
    analytics: "idle",
    intake_form: "idle",
  });

  // Undo / Redo stacks
  const [settingsHistory, setSettingsHistory] = useState<any[]>([]);
  const [settingsFuture, setSettingsFuture] = useState<any[]>([]);

  const [menuHistory, setMenuHistory] = useState<any[]>([]);
  const [menuFuture, setMenuFuture] = useState<any[]>([]);

  const [worksHistory, setWorksHistory] = useState<any[]>([]);
  const [worksFuture, setWorksFuture] = useState<any[]>([]);

  const [pricingHistory, setPricingHistory] = useState<any[]>([]);
  const [pricingFuture, setPricingFuture] = useState<any[]>([]);

  // Drag-and-drop targets
  const [dragOverIdxMenu, setDragOverIdxMenu] = useState<number | null>(null);
  const [dragOverIdxWorks, setDragOverIdxWorks] = useState<number | null>(null);
  const [dragOverIdxPricing, setDragOverIdxPricing] = useState<number | null>(null);

  // Dynamic portfolio tabs manager states
  const [editTabs, setEditTabs] = useState<PortfolioTab[]>([]);
  const [adminActiveTabId, setAdminActiveTabId] = useState<string>("");
  const [showAddTabModal, setShowAddTabModal] = useState(false);

  // Creative Intake (Form Submissions) State
  const [submissionsList, setSubmissionsList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("bhakty_form_submissions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load, poll and subscribe to bookings (Creative Intake Submissions)
  useEffect(() => {
    let isMounted = true;

    const loadSubmissions = async (notifyOnNew = true) => {
      if (isUsingSupabase && supabase) {
        try {
          const { data, error } = await supabase
            .from("bookings")
            .select("*")
            .order("created_at", { ascending: false });
          
          if (error) {
            console.error("Error fetching bookings from Supabase:", error);
            return;
          }
          if (data && isMounted) {
            setSubmissionsList(prevList => {
              if (notifyOnNew && prevList.length > 0) {
                // Check if there are new entries
                const newEntries = data.filter(item => !prevList.some(p => p.id === item.id));
                if (newEntries.length > 0) {
                  playIntakeNotificationSound();
                  toast.success("New Creative Intake proposal received!");
                }
              }
              return data;
            });
          }
        } catch (e) {
          console.error("Error in loadSubmissions:", e);
        }
      } else {
        // LocalStorage fallback check
        try {
          const stored = localStorage.getItem("bhakty_form_submissions");
          const data = stored ? JSON.parse(stored) : [];
          setSubmissionsList(prevList => {
            if (notifyOnNew && prevList.length > 0) {
              const newEntries = data.filter((item: any) => !prevList.some(p => p.id === item.id));
              if (newEntries.length > 0) {
                playIntakeNotificationSound();
                toast.success("New Local Creative Intake proposal logged!");
              }
            }
            return data;
          });
        } catch (err) {
          console.error("Error loading local submissions:", err);
        }
      }
    };

    loadSubmissions();
    const interval = setInterval(loadSubmissions, 4000);

    let bookingsChannel: any;
    if (isUsingSupabase && supabase) {
      bookingsChannel = supabase
        .channel("admin_bookings_realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
          },
          (payload) => {
            const newSubmission = payload.new;
            if (newSubmission) {
              playIntakeNotificationSound();
              toast.success("New Creative Intake proposal received!");
              setSubmissionsList(prevList => (
                prevList.some((item: any) => item.id === newSubmission.id)
                  ? prevList
                  : [newSubmission, ...prevList]
              ));
            }
            loadSubmissions(false);
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (bookingsChannel) {
        supabase.removeChannel(bookingsChannel);
      }
    };
  }, [isUsingSupabase]);

  useEffect(() => {
    if (brandLogos) {
      setEditLogos([...brandLogos]);
    }
  }, [brandLogos]);

  useEffect(() => {
    if (testimonials) {
      setEditTestimonials([...testimonials]);
    }
  }, [testimonials]);

  // Load and poll chat sessions
  useEffect(() => {
    let isMounted = true;
    setChatSessionsLoading(true);

    const fetchSessions = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from("chat_sessions")
            .select(`
              *,
              chat_users:user_id (
                name,
                email,
                phone
              )
            `)
            .order("last_message_at", { ascending: false });

          if (error) {
            console.error("Error fetching chat sessions:", error);
            return;
          }
          if (data && isMounted) {
            setChatSessions(prevSessions => {
              if (prevSessions.length > 0) {
                let shouldPlaySound = false;
                data.forEach(newSess => {
                  const oldSess = prevSessions.find(s => s.id === newSess.id);
                  if (oldSess) {
                    if (newSess.unread_count > oldSess.unread_count) {
                      shouldPlaySound = true;
                    }
                  } else if (newSess.unread_count > 0) {
                    shouldPlaySound = true;
                  }
                });
                if (shouldPlaySound) {
                  playChatNotificationSound();
                }
              }
              return data;
            });
          }
        } catch (e) {
          console.error("Error in fetchSessions:", e);
        } finally {
          if (isMounted) setChatSessionsLoading(false);
        }
      } else {
        // LocalStorage fallback
        try {
          const sessionsMap: Record<string, any> = {};
          // Scan all localStorage keys
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("local_chat_messages_")) {
              const sessId = key.substring("local_chat_messages_".length);
              const msgsStr = localStorage.getItem(key);
              if (msgsStr) {
                const msgs = JSON.parse(msgsStr);
                const lastMsg = msgs[msgs.length - 1];
                
                const sessStr = localStorage.getItem(`local_chat_session_${sessId}`);
                const sessionObj = sessStr ? JSON.parse(sessStr) : {};
                
                const userStr = sessionObj.user_id ? localStorage.getItem(`local_chat_user_${sessionObj.user_id}`) : null;
                const userObj = userStr ? JSON.parse(userStr) : null;
                
                sessionsMap[sessId] = {
                  ...sessionObj,
                  id: sessId,
                  created_at: sessionObj.created_at || msgs[0]?.created_at || new Date().toISOString(),
                  last_message_at: sessionObj.last_message_at || lastMsg?.created_at || new Date().toISOString(),
                  email: sessionObj.email || userObj?.email || null,
                  status: sessionObj.status || "active",
                  pause_ai: sessionObj.pause_ai || false,
                  unread_count: sessionObj.unread_count || 0,
                  last_message_text: lastMsg?.text || "",
                  chat_users: userObj
                };
              }
            }
          }
          
          // Sort by last_message_at descending
          const sessionsList = Object.values(sessionsMap).sort((a: any, b: any) => 
            new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
          );
          
          if (isMounted) {
            setChatSessions(prevSessions => {
              if (prevSessions.length > 0) {
                let shouldPlaySound = false;
                sessionsList.forEach(newSess => {
                  const oldSess = prevSessions.find(s => s.id === newSess.id);
                  if (oldSess) {
                    if (newSess.unread_count > oldSess.unread_count) {
                      shouldPlaySound = true;
                    }
                  } else if (newSess.unread_count > 0) {
                    shouldPlaySound = true;
                  }
                });
                if (shouldPlaySound) {
                  playChatNotificationSound();
                }
              }
              return sessionsList;
            });
            setChatSessionsLoading(false);
          }
        } catch (err) {
          console.error("Error loading local sessions:", err);
          if (isMounted) setChatSessionsLoading(false);
        }
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);

    // Subscribe to chat_sessions updates
    let sessionChannel: any;
    if (isSupabaseConfigured && supabase) {
      sessionChannel = supabase
        .channel("admin_chat_sessions_list")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_sessions",
          },
          () => {
            fetchSessions();
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (sessionChannel) {
        supabase.removeChannel(sessionChannel);
      }
    };
  }, []);

  // Load and poll selected session messages
  useEffect(() => {
    if (activeTab !== "live_chats" || !selectedSessionId) {
      setChatMessages([]);
      return;
    }

    let isMounted = true;
    
    const fetchMessages = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("session_id", selectedSessionId)
            .order("created_at", { ascending: true });

          if (error) {
            console.error("Error fetching chat messages:", error);
            return;
          }
          if (data && isMounted) {
            setChatMessages(data);
          }
        } catch (e) {
          console.error("Error in fetchMessages:", e);
        }
      } else {
        // LocalStorage fallback
        try {
          const msgsStr = localStorage.getItem(`local_chat_messages_${selectedSessionId}`);
          if (msgsStr && isMounted) {
            setChatMessages(JSON.parse(msgsStr));
          }
        } catch (err) {
          console.error("Error loading local messages:", err);
        }
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    // Subscribe to chat_messages changes for the active session
    let messageChannel: any;
    if (isSupabaseConfigured && supabase) {
      messageChannel = supabase
        .channel(`admin_chat_session_${selectedSessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `session_id=eq.${selectedSessionId}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newMsg = payload.new;
              if (isMounted) {
                setChatMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
              }
            } else if (payload.eventType === "UPDATE") {
              const updatedMsg = payload.new;
              if (isMounted) {
                setChatMessages((prev) =>
                  prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
                );
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (messageChannel) {
        supabase.removeChannel(messageChannel);
      }
    };
  }, [activeTab, selectedSessionId]);

  // Mark session as read (set unread_count to 0) and mark client messages as read when opened by admin
  useEffect(() => {
    if (activeTab !== "live_chats" || !selectedSessionId) return;

    const markAsRead = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from("chat_sessions")
            .update({ unread_count: 0 })
            .eq("id", selectedSessionId);
            
          await supabase
            .from("chat_messages")
            .update({ status: "read" })
            .eq("session_id", selectedSessionId)
            .eq("sender", "user")
            .neq("status", "read");
        } catch (e) {
          console.warn("Failed to update status/unread in Supabase:", e);
        }
      } else {
        localStorage.setItem(`local_chat_unread_${selectedSessionId}`, "0");
        const localMsgs = localStorage.getItem(`local_chat_messages_${selectedSessionId}`);
        if (localMsgs) {
          const parsed = JSON.parse(localMsgs);
          const updated = parsed.map((m: any) => m.sender === "user" ? { ...m, status: "read" } : m);
          localStorage.setItem(`local_chat_messages_${selectedSessionId}`, JSON.stringify(updated));
          localStorage.setItem(`local_chat_messages_updated_${selectedSessionId}`, Date.now().toString());
        }
      }
    };

    markAsRead();
  }, [activeTab, selectedSessionId, chatMessages.length]);

  const togglePauseAi = async (sessId: string, currentPauseVal: boolean) => {
    const newVal = !currentPauseVal;
    
    // Update local state first for fast response
    setChatSessions(prev => 
      prev.map(s => s.id === sessId ? { ...s, pause_ai: newVal } : s)
    );
    
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("chat_sessions")
          .update({ pause_ai: newVal })
          .eq("id", sessId);

        if (error) throw error;
        toast.success(newVal ? "AI Concierge paused. You have taken control." : "AI Concierge resumed.");
      } catch (err: any) {
        console.error("Failed to toggle pause_ai in Supabase:", err);
        toast.error("Failed to update status in database.");
        // Revert local state
        setChatSessions(prev => 
          prev.map(s => s.id === sessId ? { ...s, pause_ai: currentPauseVal } : s)
        );
      }
    } else {
      localStorage.setItem(`local_chat_pause_${sessId}`, newVal.toString());
      toast.success(newVal ? "Local AI Concierge paused. You have taken control." : "Local AI Concierge resumed.");
    }
  };

  const handleSendAdminReply = async () => {
    if (!selectedSessionId || !adminReplyText.trim()) return;
    
    const replyText = adminReplyText.trim();
    setAdminReplyText("");
    
    // Generate a temporary message object to update the UI instantly
    const newMsg = {
      id: `msg-admin-temp-${Date.now()}`,
      session_id: selectedSessionId,
      sender: "admin" as const,
      text: replyText,
      created_at: new Date().toISOString(),
      status: "sending" as const
    };
    
    setChatMessages(prev => [...prev, newMsg]);

    if (isSupabaseConfigured && supabase) {
      try {
        // Automatically pause AI on takeover if not already paused
        const { error: msgErr } = await supabase
          .from("chat_messages")
          .insert([{
            session_id: selectedSessionId,
            sender: "admin",
            text: replyText,
            status: "delivered"
          }]);
        
        if (msgErr) throw msgErr;

        // Update session meta: pause_ai to true (takeover), update last_message_at
        const { error: sessErr } = await supabase
          .from("chat_sessions")
          .update({ 
            pause_ai: true, 
            last_message_at: new Date().toISOString() 
          })
          .eq("id", selectedSessionId);

        if (sessErr) throw sessErr;
        
        // Update local session list if needed
        setChatSessions(prev => 
          prev.map(s => s.id === selectedSessionId ? { ...s, pause_ai: true, last_message_at: newMsg.created_at } : s)
        );

        toast.success("Message dispatched. AI paused.");
      } catch (err: any) {
        console.error("Failed to send admin reply in Supabase:", err);
        toast.error("Failed to dispatch message to database.");
      }
    } else {
      // LocalStorage fallback
      try {
        const msgsStr = localStorage.getItem(`local_chat_messages_${selectedSessionId}`);
        const msgs = msgsStr ? JSON.parse(msgsStr) : [];
        const fullMsg = {
          id: `msg-admin-${Date.now()}`,
          sender: "admin",
          text: replyText,
          created_at: new Date().toISOString(),
          status: "delivered" as const
        };
        msgs.push(fullMsg);
        localStorage.setItem(`local_chat_messages_${selectedSessionId}`, JSON.stringify(msgs));
        localStorage.setItem(`local_chat_pause_${selectedSessionId}`, "true");
        
        // Refresh local messages
        setChatMessages(msgs);
        
        // Refresh local sessions
        setChatSessions(prev => 
          prev.map(s => s.id === selectedSessionId ? { ...s, pause_ai: true, last_message_at: fullMsg.created_at } : s)
        );
        
        toast.success("Local reply saved. AI paused.");
      } catch (e) {
        console.error("Local reply saving failed:", e);
      }
    }
  };



  // AI Video Synthesizer States
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoAspect, setVideoAspect] = useState("landscape");
  const [isSynthesizingVideo, setIsSynthesizingVideo] = useState(false);
  const [videoSynthProgress, setVideoSynthProgress] = useState(0);
  const [synthesizedVideoUrl, setSynthesizedVideoUrl] = useState("");
  const [synthesizedTags, setSynthesizedTags] = useState<string[]>([]);

  // Intake Form Customization States
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editFieldLabel, setEditFieldLabel] = useState("");
  const [editFieldPlaceholder, setEditFieldPlaceholder] = useState("");
  const [editFieldRequired, setEditFieldRequired] = useState(false);
  const [editFieldOptionsText, setEditFieldOptionsText] = useState("");

  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "email" | "textarea" | "select" | "phone">("text");
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptionsText, setNewFieldOptionsText] = useState("");

  const updateSubmissionStatus = async (id: string, newStatus: string) => {
    const updated = submissionsList.map((sub: any) => 
      sub.id === id ? { ...sub, status: newStatus } : sub
    );
    setSubmissionsList(updated);

    if (isUsingSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("bookings")
          .update({ status: newStatus })
          .eq("id", id);
        if (error) {
          console.error("Failed to update status in Supabase:", error);
          toast.error("Failed to update status in database.");
          return;
        }
      } catch (err) {
        console.error("Failed to update status in Supabase:", err);
        toast.error("Failed to update status in database.");
        return;
      }
    } else {
      localStorage.setItem("bhakty_form_submissions", JSON.stringify(updated));
    }
    toast.success(`Brief status successfully updated to: ${newStatus}`);
  };

  const deleteSubmission = async (id: string) => {
    const updated = submissionsList.filter((sub: any) => sub.id !== id);
    setSubmissionsList(updated);

    if (isUsingSupabase && supabase) {
      try {
        const { error } = await supabase
          .from("bookings")
          .delete()
          .eq("id", id);
        if (error) {
          console.error("Failed to delete from Supabase:", error);
          toast.error("Failed to remove record from database.");
          return;
        }
      } catch (err) {
        console.error("Failed to delete from Supabase:", err);
        toast.error("Failed to remove record from database.");
        return;
      }
    } else {
      localStorage.setItem("bhakty_form_submissions", JSON.stringify(updated));
    }
    toast.success("Ingestion record removed from register.");
  };



  // ----------------------------------------------------
  // TAB 5: GLOBAL ASSETS STATE & HANDLERS (Cloudinary Uploaders)
  // ----------------------------------------------------
  const [selectedAssetFiles, setSelectedAssetFiles] = useState<{ id: string; file: File; customName: string; type: "image" | "video" }[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [newAssetUrl, setNewAssetUrl] = useState("");
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("image");


  // Show selected files and configure default names/types before upload in Assets
  const handleAssetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newItems = Array.from(files).map((file: File) => {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const fileType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        return {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          customName: cleanName,
          type: fileType
        };
      });
      setSelectedAssetFiles((prev) => [...prev, ...newItems]);
      toast.info(`Added ${newItems.length} file(s) to the upload queue.`);
      e.target.value = ""; // Clear input value
    }
  };

  const handleQueueNameChange = (id: string, name: string) => {
    setSelectedAssetFiles((prev) => prev.map((item) => item.id === id ? { ...item, customName: name } : item));
  };

  const handleQueueTypeChange = (id: string, type: "image" | "video") => {
    setSelectedAssetFiles((prev) => prev.map((item) => item.id === id ? { ...item, type } : item));
  };

  const removeQueueItem = (id: string) => {
    setSelectedAssetFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAssetUpload = async () => {
    if (selectedAssetFiles.length === 0) {
      toast.warning("Please choose one or more files first.");
      return;
    }

    // Limit check: Allow files up to 100 MB before compression (will be compressed client-side to fit within the 25 MB GitHub limit)
    const maxLimitMb = 100;

    const oversizedFiles = selectedAssetFiles.filter(item => item.file.size > maxLimitMb * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      const details = oversizedFiles.map(i => `${i.file.name} (${(i.file.size / 1024 / 1024).toFixed(1)} MB)`).join(", ");
      toast.error(`Error: File size too large! The maximum selectable file size is ${maxLimitMb} MB. Oversized files: ${details}`);
      return;
    }

    setIsUploadingAsset(true);
    let successCount = 0;
    
    try {
      for (let i = 0; i < selectedAssetFiles.length; i++) {
        const item = selectedAssetFiles[i];
        const fileIndex = i + 1;
        const totalFiles = selectedAssetFiles.length;
        
        const uploadedUrl = await runUploadWithModal(
          item.file,
          () => uploadToCloudinary(item.file),
          { fileIndex, totalFiles }
        );

        const newAsset = await addMediaAsset(
          item.customName || item.file.name,
          uploadedUrl,
          item.type
        );

        if (newAsset) {
          successCount++;
        }
      }

      if (successCount === selectedAssetFiles.length) {
        toast.success(`Success: Successfully uploaded and persisted all ${successCount} asset(s)!`);
      } else {
        toast.warning(`Uploaded ${successCount} of ${selectedAssetFiles.length} asset(s).`);
      }
      setSelectedAssetFiles([]);
    } catch (err: any) {
      toast.error(`Upload error: ${err?.message || "Verify your GitHub/Supabase setup & connection."}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleBulkAction = async (actionType: string) => {
    if (selectedAssetIds.length === 0) {
      toast.warning("No assets selected for bulk action.");
      return;
    }

    const selectedAssets = mediaAssets.filter(asset => selectedAssetIds.includes(asset.id));
    if (selectedAssets.length === 0) return;

    if (actionType === "portfolio_create_individual") {
      recordWorksHistory();
      const activeTabObj = editTabs.find(t => t.id === adminActiveTabId) || editTabs[0];
      const newItems: VideoBlock[] = selectedAssets.map(asset => {
        const isVideo = asset.type === "video";
        return {
          id: generateUUID(),
          title: asset.name,
          category: isVideo ? "AI Commercial / Fluid Dynamics" : "Graphic Design / Brand Curation",
          videoUrl: isVideo ? asset.url : "",
          highResVideoUrl: isVideo ? asset.url : "",
          imageUrl: isVideo ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80" : asset.url,
          description: `${asset.type === "video" ? "Motion piece" : "Static asset"} uploaded and assigned to portfolio.`,
          creator: "bhakty.synth",
          duration: isVideo ? "0:15" : "",
          ratio: "landscape",
          aspectRatioClass: "aspect-square md:col-span-1",
          tags: isVideo ? ["Fluid Simulation", "Neural Render"] : ["Static Design", "Graphic Design"],
          type: asset.type,
          tab_id: adminActiveTabId || activeTabObj?.id || ""
        };
      });
      setEditWorks(prev => [...prev, ...newItems]);
      toast.success(`Generated ${newItems.length} portfolio card(s) under the active portfolio tab! Click 'Sync Portfolio' to save.`);
      setSelectedAssetIds([]);
    } else if (actionType === "navigation_add") {
      recordMenuHistory();
      const newItems: NavigationMenuItem[] = selectedAssets.map((asset, index) => ({
        id: generateUUID(),
        label: asset.name,
        target_url: asset.url,
        display_order: editMenu.length + index + 1
      }));
      setEditMenu(prev => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} item(s) to Navigation Menu! Click 'Synchronize menu' to save.`);
      setSelectedAssetIds([]);
    } else if (actionType === "brand_logos_add") {
      const imageAssets = selectedAssets.filter(a => a.type === "image");
      if (imageAssets.length === 0) {
        toast.warning("Only images can be added to the Brand Logos Marquee.");
        return;
      }
      const newLogos = imageAssets.map((asset, index) => ({
        id: generateUUID(),
        url: asset.url,
        name: asset.name,
        display_order: editLogos.length + index + 1
      }));
      setEditLogos(prev => [...prev, ...newLogos]);
      toast.success(`Added ${newLogos.length} image(s) to Brand Logos Marquee!`);
      setSelectedAssetIds([]);
    } else if (actionType.startsWith("setting_assign_")) {
      const settingKey = actionType.replace("setting_assign_", "");
      const firstAsset = selectedAssets[0];
      recordSettingsHistory();
      
      let resolvedKey = settingKey;
      if (settingKey === "hero_video_bg_url") {
        resolvedKey = adminPageScope === "live" ? "page2_hero_video_bg_url" : adminPageScope === "app" ? "app_hero_video_bg_url" : "hero_video_bg_url";
      } else if (settingKey === "logo_img_url") {
        resolvedKey = adminPageScope === "app" ? "app_logo_img_url" : "logo_img_url";
      }

      setEditSettings(prev => ({
        ...prev,
        [resolvedKey]: firstAsset.url
      }));
      toast.success(`Assigned '${firstAsset.name}' to ${resolvedKey}! Click 'Synchronize settings' to save.`);
      setSelectedAssetIds([]);
    } else if (actionType === "delete_selected") {
      if (window.confirm(`Are you sure you want to delete ${selectedAssets.length} selected asset(s) from the library?`)) {
        let deletedCount = 0;
        for (const asset of selectedAssets) {
          const success = await deleteMediaAsset(asset.id);
          if (success) deletedCount++;
        }
        toast.success(`Removed ${deletedCount} asset(s) from Library.`);
        setSelectedAssetIds([]);
      }
    }
  };

  const handleAddCustomAsset = async () => {
    if (!newAssetUrl || !newAssetName) {
      toast.warning("Please configure both an organic Name and direct URL link.");
      return;
    }
    const cleanUrl = newAssetUrl.trim();
    const cleanName = newAssetName.trim();
    
    const newAsset = await addMediaAsset(cleanName, cleanUrl, newAssetType as "image" | "video");
    if (newAsset) {
      toast.success(`External asset line '${cleanName}' registered successfully!`);
      setNewAssetUrl("");
      setNewAssetName("");
    } else {
      toast.error("Could not register custom asset URL link.");
    }
  };

  const handleDeleteAsset = async (id: string) => {
    const success = await deleteMediaAsset(id);
    if (success) {
      toast.success("Asset removed from Library.");
    } else {
      toast.error("Could not remove the specified resource.");
    }
  };

  const handleSelectAssetForSetting = async (assetUrl: string, targetSetting: "hero_video_bg_url" | "logo_img_url") => {
    const resolvedKey = targetSetting === "hero_video_bg_url" 
      ? (adminPageScope === "live" ? "page2_hero_video_bg_url" : adminPageScope === "app" ? "app_hero_video_bg_url" : "hero_video_bg_url") 
      : (adminPageScope === "app" ? "app_logo_img_url" : targetSetting);
    setSaveStatus(prev => ({ ...prev, assets: "saving" }));
    toast.info(`Applying selected asset to ${resolvedKey.includes("hero_video_bg_url") ? "Hero Background" : "Navbar Logo"}...`);
    
    try {
      setEditSettings(p => ({ ...p, [resolvedKey]: assetUrl }));
      
      const success = await updateSiteSetting(resolvedKey, assetUrl);
      if (success) {
        setSaveStatus(prev => ({ ...prev, assets: "saved" }));
        toast.success(`Setting '${resolvedKey}' successfully modified!`);
        setTimeout(() => setSaveStatus(prev => ({ ...prev, assets: "idle" })), 3000);
      } else {
        setSaveStatus(prev => ({ ...prev, assets: "error" }));
        toast.error("Validation error saving settings.");
      }
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, assets: "error" }));
      toast.error(`Error saving: ${err?.message || "Unknown error."}`);
    }
  };

  // ----------------------------------------------------
  // HISTORICAL UNDO / REDO MANAGEMENTS
  // ----------------------------------------------------
  const recordSettingsHistory = (pivotState = editSettings) => {
    setSettingsHistory(prev => {
      const nextHistory = [...prev, JSON.parse(JSON.stringify(pivotState))];
      if (nextHistory.length > 30) nextHistory.shift();
      return nextHistory;
    });
    setSettingsFuture([]);
  };

  const triggerSettingsUndo = () => {
    if (settingsHistory.length === 0) return;
    const previous = settingsHistory[settingsHistory.length - 1];
    setSettingsFuture(prev => [JSON.parse(JSON.stringify(editSettings)), ...prev]);
    setSettingsHistory(prev => prev.slice(0, prev.length - 1));
    setEditSettings(previous);
    toast.success("Settings change reverted.");
  };

  const triggerSettingsRedo = () => {
    if (settingsFuture.length === 0) return;
    const next = settingsFuture[0];
    setSettingsHistory(prev => [...prev, JSON.parse(JSON.stringify(editSettings))]);
    setSettingsFuture(prev => prev.slice(1));
    setEditSettings(next);
    toast.success("Settings change re-applied.");
  };

  const recordMenuHistory = (pivotState = editMenu) => {
    setMenuHistory(prev => {
      const nextHistory = [...prev, JSON.parse(JSON.stringify(pivotState))];
      if (nextHistory.length > 30) nextHistory.shift();
      return nextHistory;
    });
    setMenuFuture([]);
  };

  const triggerMenuUndo = () => {
    if (menuHistory.length === 0) return;
    const previous = menuHistory[menuHistory.length - 1];
    setMenuFuture(prev => [JSON.parse(JSON.stringify(editMenu)), ...prev]);
    setMenuHistory(prev => prev.slice(0, prev.length - 1));
    setEditMenu(previous);
    toast.success("Navigation menu reverted.");
  };

  const triggerMenuRedo = () => {
    if (menuFuture.length === 0) return;
    const next = menuFuture[0];
    setMenuHistory(prev => [...prev, JSON.parse(JSON.stringify(editMenu))]);
    setMenuFuture(prev => prev.slice(1));
    setEditMenu(next);
    toast.success("Navigation menu re-applied.");
  };

  const recordWorksHistory = (pivotState = { works: editWorks, tabs: editTabs }) => {
    setWorksHistory(prev => {
      const nextHistory = [...prev, JSON.parse(JSON.stringify(pivotState))];
      if (nextHistory.length > 30) nextHistory.shift();
      return nextHistory;
    });
    setWorksFuture([]);
  };

  const triggerWorksUndo = () => {
    if (worksHistory.length === 0) return;
    const previous = worksHistory[worksHistory.length - 1];
    setWorksFuture(prev => [JSON.parse(JSON.stringify({ works: editWorks, tabs: editTabs })), ...prev]);
    setWorksHistory(prev => prev.slice(0, prev.length - 1));
    setEditWorks(previous.works || []);
    setEditTabs(previous.tabs || []);
    toast.success("Portfolio layout state reverted.");
  };

  const triggerWorksRedo = () => {
    if (worksFuture.length === 0) return;
    const next = worksFuture[0];
    setWorksHistory(prev => [...prev, JSON.parse(JSON.stringify({ works: editWorks, tabs: editTabs }))]);
    setWorksFuture(prev => prev.slice(1));
    setEditWorks(next.works || []);
    setEditTabs(next.tabs || []);
    toast.success("Portfolio layout state re-applied.");
  };

  const recordPricingHistory = (pivotState = editPricing) => {
    setPricingHistory(prev => {
      const nextHistory = [...prev, JSON.parse(JSON.stringify(pivotState))];
      if (nextHistory.length > 30) nextHistory.shift();
      return nextHistory;
    });
    setPricingFuture([]);
  };

  const triggerPricingUndo = () => {
    if (pricingHistory.length === 0) return;
    const previous = pricingHistory[pricingHistory.length - 1];
    setPricingFuture(prev => [JSON.parse(JSON.stringify(editPricing)), ...prev]);
    setPricingHistory(prev => prev.slice(0, prev.length - 1));
    setEditPricing(previous);
    toast.success("Pricing tiers state reverted.");
  };

  const triggerPricingRedo = () => {
    if (pricingFuture.length === 0) return;
    const next = pricingFuture[0];
    setPricingHistory(prev => [...prev, JSON.parse(JSON.stringify(editPricing))]);
    setPricingFuture(prev => prev.slice(1));
    setEditPricing(next);
    toast.success("Pricing tiers state re-applied.");
  };

  // ----------------------------------------------------
  // TAB 1: SITE SITE SETTINGS CONFIGURATION
  // ----------------------------------------------------
  const [editSettings, setEditSettings] = useState({ ...siteSettings });
  
  const handleSettingChange = (key: string, value: string) => {
    setEditSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaveStatus(prev => ({ ...prev, settings: "saving" }));
    toast.info("Synchronizing site configurations to persistence index...");
    try {
      await updateMultipleSiteSettings(editSettings);
      setSaveStatus(prev => ({ ...prev, settings: "saved" }));
      toast.success("Site configurations successfully updated!");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, settings: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, settings: "error" }));
      toast.error(`Configuration synchronization failed: ${err?.message || "Unknown error"}`);
    }
  };

  // ----------------------------------------------------
  // TAB 8: INTAKE FORM CONFIGURATION HELPER FUNCTIONS
  // ----------------------------------------------------
  const getIntakeFields = (): any[] => {
    try {
      if (editSettings.booking_form_fields_json) {
        return JSON.parse(editSettings.booking_form_fields_json);
      }
    } catch (e) {
      console.error("Failed to parse booking_form_fields_json in AdminPanel:", e);
    }
    return [
      { id: "name", label: "Your Identity / Name", type: "text", placeholder: "e.g. Cassian Andor", required: true },
      { id: "company", label: "Company / Studio", type: "text", placeholder: "e.g. Coruscant Arts Ltd", required: false },
      { id: "email", label: "Communication Mail", type: "email", placeholder: "e.g. cassian@bhakty.net", required: true },
      { id: "budget", label: "Estimated Budget Bracket", type: "select", options: ["$2,000 - $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+"], required: true },
      { id: "selected_tier", label: "Target Production Pipeline", type: "select", options: ["Short-Form Creative", "Full Cinematic Production", "Enterprise Studio Pipeline", "Custom Collaborative"], required: true },
      { id: "brief", label: "Project Dimensional Brief", type: "textarea", placeholder: "Give details about your visual aesthetic, temporal consistency expectations, targeted platforms or dynamic sound direction...", required: true }
    ];
  };

  const isCoreField = (id: string) => {
    return ["name", "company", "email", "budget", "selected_tier", "brief"].includes(id);
  };

  const updateFieldsInSettings = (newFields: any[]) => {
    setEditSettings(prev => ({
      ...prev,
      booking_form_fields_json: JSON.stringify(newFields)
    }));
  };

  const handleAddIntakeField = () => {
    if (!newFieldLabel.trim()) {
      toast.error("Field label is required.");
      return;
    }
    recordSettingsHistory();
    const cleanId = "custom_" + newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_").substring(0, 15) + "_" + Math.random().toString(36).substring(2, 6);
    
    let optionsArray: string[] = [];
    if (newFieldType === "select") {
      optionsArray = newFieldOptionsText.split(",").map(o => o.trim()).filter(Boolean);
      if (optionsArray.length === 0) {
        toast.error("Please supply at least one option for selection field.");
        return;
      }
    }

    const newField = {
      id: cleanId,
      label: newFieldLabel.trim(),
      type: newFieldType,
      placeholder: newFieldPlaceholder.trim(),
      required: newFieldRequired,
      ...(newFieldType === "select" ? { options: optionsArray } : {})
    };

    const currentFields = getIntakeFields();
    const updated = [...currentFields, newField];
    updateFieldsInSettings(updated);

    // Reset state
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldPlaceholder("");
    setNewFieldRequired(false);
    setNewFieldOptionsText("");
    toast.success(`Custom field "${newField.label}" added to configuration list.`);
  };

  const handleDeleteIntakeField = (id: string) => {
    if (isCoreField(id)) {
      toast.error("Core ingestion fields cannot be deleted.");
      return;
    }
    recordSettingsHistory();
    const currentFields = getIntakeFields();
    const updated = currentFields.filter((f: any) => f.id !== id);
    updateFieldsInSettings(updated);
    toast.success("Field successfully removed.");
  };

  const handleMoveIntakeField = (index: number, direction: "up" | "down") => {
    recordSettingsHistory();
    const currentFields = getIntakeFields();
    const updated = [...currentFields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    
    // Swap
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    updateFieldsInSettings(updated);
  };

  const handleStartEditField = (field: any) => {
    setEditingFieldId(field.id);
    setEditFieldLabel(field.label);
    setEditFieldPlaceholder(field.placeholder || "");
    setEditFieldRequired(field.required || false);
    if (field.type === "select" && field.options) {
      setEditFieldOptionsText(field.options.join(", "));
    } else {
      setEditFieldOptionsText("");
    }
  };

  const handleSaveEditField = (id: string) => {
    if (!editFieldLabel.trim()) {
      toast.error("Field label cannot be empty.");
      return;
    }
    recordSettingsHistory();
    const currentFields = getIntakeFields();
    
    const updated = currentFields.map((f: any) => {
      if (f.id === id) {
        let optionsArray: string[] = [];
        if (f.type === "select") {
          optionsArray = editFieldOptionsText.split(",").map(o => o.trim()).filter(Boolean);
          if (optionsArray.length === 0) {
            toast.error("Please supply at least one option.");
            return f;
          }
        }
        return {
          ...f,
          label: editFieldLabel.trim(),
          placeholder: editFieldPlaceholder.trim(),
          required: editFieldRequired,
          ...(f.type === "select" ? { options: optionsArray } : {})
        };
      }
      return f;
    });

    updateFieldsInSettings(updated);
    setEditingFieldId(null);
    toast.success("Field customizations stored in staging.");
  };

  const saveIntakeFormSettings = async () => {
    setSaveStatus(prev => ({ ...prev, intake_form: "saving" }));
    toast.info("Synchronizing intake form configurations...");
    try {
      await updateMultipleSiteSettings(editSettings);
      setSaveStatus(prev => ({ ...prev, intake_form: "saved" }));
      toast.success("Intake form configurations successfully updated!");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, intake_form: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, intake_form: "error" }));
      toast.error(`Ingestion configuration synchronization failed: ${err?.message || "Unknown error"}`);
    }
  };

  // ----------------------------------------------------
  // BRAND LOGOS HANDLERS
  // ----------------------------------------------------
  const [selectedBrandLogoFiles, setSelectedBrandLogoFiles] = useState<{ [logoId: string]: File | null }>({});
  const [isUploadingBrandLogoId, setIsUploadingBrandLogoId] = useState<string | null>(null);

  const handleBrandLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>, logoId: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedBrandLogoFiles(prev => ({ ...prev, [logoId]: file }));
      toast.info(`Selected logo file: ${file.name}. Ready to upload.`);
    }
  };

  const handleBrandLogoUpload = async (logoId: string) => {
    const file = selectedBrandLogoFiles[logoId];
    if (!file) {
      toast.warning("Choose a file first.");
      return;
    }
    setIsUploadingBrandLogoId(logoId);
    try {
      const url = await runUploadWithModal(file, () => uploadToCloudinary(file));
      setEditLogos(prev => prev.map(l => l.id === logoId ? { ...l, url } : l));
      setSelectedBrandLogoFiles(prev => ({ ...prev, [logoId]: null }));
      toast.success("Logo uploaded successfully!");
    } catch (err: any) {
      toast.error(`Logo upload failed: ${err.message || err}`);
    } finally {
      setIsUploadingBrandLogoId(null);
    }
  };

  const addBrandLogo = () => {
    const newLogo: BrandLogo = {
      id: "logo-temp-" + Date.now(),
      url: "",
      name: "New Brand",
      display_order: editLogos.length + 1
    };
    setEditLogos(prev => [...prev, newLogo]);
  };

  const deleteBrandLogo = (id: string) => {
    setEditLogos(prev => prev.filter(l => l.id !== id).map((l, idx) => ({ ...l, display_order: idx + 1 })));
  };

  const moveBrandLogo = (index: number, direction: "up" | "down") => {
    const updated = [...editLogos];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setEditLogos(updated.map((l, idx) => ({ ...l, display_order: idx + 1 })));
  };

  const saveBrandLogos = async () => {
    setSaveStatus(prev => ({ ...prev, brand_logos: "saving" }));
    try {
      await updateBrandLogos(editLogos);
      await updateMultipleSiteSettings(editSettings);
      setSaveStatus(prev => ({ ...prev, brand_logos: "saved" }));
      toast.success("Brand logos successfully synchronized!");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, brand_logos: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, brand_logos: "error" }));
      toast.error(`Failed to sync brand logos: ${err.message || err}`);
    }
  };

  // ----------------------------------------------------
  // TESTIMONIALS HANDLERS
  // ----------------------------------------------------
  const [selectedTestimonialFiles, setSelectedTestimonialFiles] = useState<{ [tId: string]: File | null }>({});
  const [isUploadingTestimonialId, setIsUploadingTestimonialId] = useState<string | null>(null);

  const handleTestimonialFileChange = (e: React.ChangeEvent<HTMLInputElement>, tId: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedTestimonialFiles(prev => ({ ...prev, [tId]: file }));
      toast.info(`Selected testimonial video: ${file.name}. Ready to upload.`);
    }
  };

  const handleTestimonialUpload = async (tId: string) => {
    const file = selectedTestimonialFiles[tId];
    if (!file) {
      toast.warning("Choose a file first.");
      return;
    }
    setIsUploadingTestimonialId(tId);
    try {
      const url = await runUploadWithModal(file, () => uploadToCloudinary(file));
      setEditTestimonials(prev => prev.map(t => t.id === tId ? { ...t, video_url: url } : t));
      setSelectedTestimonialFiles(prev => ({ ...prev, [tId]: null }));
      toast.success("Testimonial video uploaded successfully!");
    } catch (err: any) {
      toast.error(`Video upload failed: ${err.message || err}`);
    } finally {
      setIsUploadingTestimonialId(null);
    }
  };

  const addTestimonial = () => {
    const newTestimonial: Testimonial = {
      id: "testimonial-temp-" + Date.now(),
      client_name: "John Doe",
      role: "Founder & CEO",
      company: "Acme Corp",
      text: "This creative studio completely transformed our brand aesthetics. Truly premium orchestration.",
      video_url: "",
      rating: 5,
      display_order: editTestimonials.length + 1
    };
    setEditTestimonials(prev => [...prev, newTestimonial]);
  };

  const deleteTestimonial = (id: string) => {
    setEditTestimonials(prev => prev.filter(t => t.id !== id).map((t, idx) => ({ ...t, display_order: idx + 1 })));
  };

  const moveTestimonial = (index: number, direction: "up" | "down") => {
    const updated = [...editTestimonials];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    setEditTestimonials(updated.map((t, idx) => ({ ...t, display_order: idx + 1 })));
  };

  const saveTestimonials = async () => {
    setSaveStatus(prev => ({ ...prev, testimonials: "saving" }));
    try {
      await updateTestimonials(editTestimonials);
      setSaveStatus(prev => ({ ...prev, testimonials: "saved" }));
      toast.success("Testimonials successfully synchronized!");
      setTimeout(() => setSaveStatus(prev => ({ ...prev, testimonials: "idle" })), 3000);
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, testimonials: "error" }));
      toast.error(`Failed to sync testimonials: ${err.message || err}`);
    }
  };

  // ----------------------------------------------------
  // TAB 2: NAVIGATION MENU STATE & HANDLERS
  // ----------------------------------------------------
  const [editMenu, setEditMenu] = useState<NavigationMenuItem[]>([...navigationMenu]);

  const handleMenuChange = (id: string, field: "label" | "target_url", value: string) => {
    setEditMenu(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addMenuItem = () => {
    recordMenuHistory();
    const newItem: NavigationMenuItem = {
      id: generateUUID(),
      label: "New section",
      target_url: "booking-section",
      display_order: editMenu.length + 1
    };
    setEditMenu(prev => [...prev, newItem]);
  };

  const deleteMenuItem = (id: string) => {
    recordMenuHistory();
    setEditMenu(prev => prev.filter(item => item.id !== id).map((item, idx) => ({ ...item, display_order: idx + 1 })));
  };

  const saveMenu = async () => {
    setSaveStatus(prev => ({ ...prev, navigation: "saving" }));
    toast.info("Applying navigation modifications to core index...");
    try {
      // Synchronize site settings (like navbar_full_width) alongside menu links
      await updateMultipleSiteSettings(editSettings);
      const success = await updateNavigationMenu(editMenu);
      if (success) {
        setSaveStatus(prev => ({ ...prev, navigation: "saved" }));
        toast.success("Navigation modifications successfully applied!");
        setTimeout(() => setSaveStatus(prev => ({ ...prev, navigation: "idle" })), 3000);
      } else {
        setSaveStatus(prev => ({ ...prev, navigation: "error" }));
        toast.error("Failed to update navigation menu details.");
      }
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, navigation: "error" }));
      toast.error(`Failed to update navigation menu: ${err?.message || "Unknown error"}`);
    }
  };

  // ----------------------------------------------------
  // TAB 3: PORTFOLIO WORKS STATE & HANDLERS
  // ----------------------------------------------------
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Portfolio explicit upload states
  const [selectedPortfolioFiles, setSelectedPortfolioFiles] = useState<{ [workId: string]: File | null }>({});
  const [isUploadingPortfolioId, setIsUploadingPortfolioId] = useState<string | null>(null);


  const handleWorkChange = (id: string, field: keyof VideoBlock, value: any) => {
    setEditWorks(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleTagsChange = (id: string, commaString: string) => {
    const tagsArr = commaString.split(",").map(t => t.trim()).filter(Boolean);
    handleWorkChange(id, "tags", tagsArr);
  };

  const handlePortfolioFileChange = (e: React.ChangeEvent<HTMLInputElement>, workId: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedPortfolioFiles(prev => ({ ...prev, [workId]: file }));
      const targetWork = editWorks.find(w => w.id === workId);
      const isImage = targetWork?.type === "image";
      toast.info(`Selected: ${file.name}. Click 'Upload' button to start.`);
    }
  };

  const handlePortfolioUpload = async (workId: string) => {
    const file = selectedPortfolioFiles[workId];
    if (!file) {
      toast.warning("Please choose a local file first.");
      return;
    }

    const isImageFile = file.type.startsWith("image/");

    setIsUploadingPortfolioId(workId);
    try {
      recordWorksHistory();
      const uploadedUrl = await runUploadWithModal(file, () => 
        uploadToCloudinary(file)
      );
      if (isImageFile) {
        handleWorkChange(workId, "imageUrl", uploadedUrl);
      } else {
        handleWorkChange(workId, "videoUrl", uploadedUrl);
        handleWorkChange(workId, "highResVideoUrl", uploadedUrl);
      }
      
      setSelectedPortfolioFiles(prev => ({ ...prev, [workId]: null }));
      toast.success(`File '${file.name}' successfully uploaded!`);
    } catch (err: any) {
      toast.error(`File upload failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsUploadingPortfolioId(null);
    }
  };

  const addWorkItem = () => {
    recordWorksHistory();
    const activeTabObj = editTabs.find(t => t.id === adminActiveTabId) || editTabs[0];
    const isImageTab = activeTabObj?.tab_type === "image";
    
    if (isImageTab) {
      const newItem: VideoBlock = {
        id: generateUUID(),
        title: "New Static Work",
        category: "Graphic Design / Brand Curation",
        videoUrl: "",
        highResVideoUrl: "",
        description: "Static visual content synthesized organically.",
        creator: "bhakty.synth",
        duration: "",
        ratio: "landscape",
        aspectRatioClass: "aspect-square md:col-span-1",
        tags: ["Static Design", "Graphic Design"],
        type: "image",
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        subtext: "Brand identity layout",
        tab_id: adminActiveTabId || activeTabObj?.id || ""
      };
      setEditWorks(prev => [...prev, newItem]);
    } else {
      const newItem: VideoBlock = {
        id: generateUUID(),
        title: "New Motion Piece",
        category: "AI Commercial / Fluid Dynamics",
        videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
        highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
        description: "Generative media synthetics compiled organically.",
        creator: "bhakty.synth",
        duration: "0:15",
        ratio: "landscape",
        aspectRatioClass: "aspect-square md:col-span-1",
        tags: ["Fluid Simulation", "Neural Render"],
        type: "video",
        tab_id: adminActiveTabId || activeTabObj?.id || ""
      };
      setEditWorks(prev => [...prev, newItem]);
    }
  };

  const deleteWorkItem = (id: string) => {
    recordWorksHistory();
    setEditWorks(prev => prev.filter(item => item.id !== id));
  };

  const addPortfolioTab = (type: "video" | "image") => {
    recordWorksHistory();
    const newTab: PortfolioTab = {
      id: generateUUID(),
      tab_title: type === "video" ? "New Video Portfolio" : "New Static Image Portfolio",
      tab_type: type,
      page: adminPageScope,
      display_order: editTabs.length + 1
    };
    setEditTabs(prev => [...prev, newTab]);
    setAdminActiveTabId(newTab.id);
    setShowAddTabModal(false);
    toast.success(`New ${type} portfolio tab added!`);
  };

  const handleTabTitleChange = (id: string, newTitle: string) => {
    recordWorksHistory();
    setEditTabs(prev => prev.map(t => t.id === id ? { ...t, tab_title: newTitle } : t));
  };

  const deletePortfolioTab = (id: string) => {
    recordWorksHistory();
    setEditWorks(prev => prev.filter(w => w.tab_id !== id));
    setEditTabs(prev => prev.filter(t => t.id !== id));
    toast.success("Portfolio tab deleted.");
  };

  const moveTab = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editTabs.length) return;

    recordWorksHistory();
    const updated = [...editTabs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    // Update display_order
    updated.forEach((t, idx) => {
      t.display_order = idx + 1;
    });
    
    setEditTabs(updated);
    toast.success("Portfolio tab order adjusted.");
  };

  const handleAIVideoSynthesis = async () => {
    if (!videoPrompt.trim()) {
      toast.error("Please enter a custom video prompt description first.");
      return;
    }
    setIsSynthesizingVideo(true);
    setVideoSynthProgress(5);
    setSynthesizedVideoUrl("");
    
    try {
      // 1) Trigger endpoint
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt.trim(),
          aspectRatio: videoAspect === "landscape" ? "16:9" : videoAspect === "portrait" ? "9:16" : "1:1",
          duration: "5s"
        })
      });
      
      if (!res.ok) throw new Error("Synthesis initialization failed");
      const initData = await res.json();
      const taskId = initData.taskId;
      
      if (initData.fallback && initData.message) {
        toast.info(initData.message);
      }
      
      // 2) Poll status every 2 seconds
      let pollIndex = 0;
      const pollInterval = setInterval(async () => {
        pollIndex++;
        // Simulate a smooth progress bar
        setVideoSynthProgress(prev => {
          const limit = pollIndex * 15;
          return prev < limit ? Math.min(prev + 12, 95) : prev;
        });

        try {
          const statusRes = await fetch(`/api/video-status?taskId=${taskId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setVideoSynthProgress(100);
              setTimeout(() => {
                setSynthesizedVideoUrl(statusData.videoUrl);
                setSynthesizedTags(statusData.tags || ["Generative", "Veo AI"]);
                setIsSynthesizingVideo(false);
                toast.success("AI Cinematic clip synthesized successfully!");
              }, 600);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setIsSynthesizingVideo(false);
              toast.error("AI synthesis process interrupted.");
            }
          }
        } catch (e) {
          console.error("Failed to fetch task progress status:", e);
        }

        // Failsafe timeout
        if (pollIndex > 30) {
          clearInterval(pollInterval);
          setIsSynthesizingVideo(false);
          toast.error("Synthesis task timed out.");
        }
      }, 2000);
      
    } catch (err: any) {
      toast.error(err?.message || "AI Video generation failure.");
      setIsSynthesizingVideo(false);
    }
  };

  const commitSynthesizedVideo = () => {
    if (!synthesizedVideoUrl) return;
    recordWorksHistory();
    const activeTabObj = editTabs.find(t => t.id === adminActiveTabId) || editTabs[0];
    const newItem: VideoBlock = {
      id: `work-ai-${Date.now()}`,
      title: "AI Synthesis: " + (videoPrompt.trim().slice(0, 18) || "Veo") + "...",
      category: "Generative AI Preview",
      videoUrl: synthesizedVideoUrl,
      highResVideoUrl: synthesizedVideoUrl,
      description: videoPrompt.trim(),
      creator: "bhakty.veo-ai",
      duration: "0:05",
      ratio: videoAspect,
      aspectRatioClass: videoAspect === "landscape" ? "aspect-video md:col-span-2" : "aspect-square md:col-span-1",
      tags: synthesizedTags.length > 0 ? synthesizedTags : ["Generative", "DeepMind", "Veo"],
      tab_id: adminActiveTabId || activeTabObj?.id || ""
    };
    
    setEditWorks(prev => [newItem, ...prev]);
    toast.success("AI video asset successfully injected to your active Portfolio list!");
    // Clear synth inputs
    setVideoPrompt("");
    setSynthesizedVideoUrl("");
  };

  const moveWorkItem = (index: number, direction: "up" | "down") => {
    const activeTabObj = editTabs.find(t => t.id === adminActiveTabId) || editTabs[0];
    const filteredIndices = editWorks
      .map((w, idx) => ({ ...w, idx }))
      .filter((w) => {
        if (w.tab_id) {
          return w.tab_id === adminActiveTabId;
        }
        return w.type === (activeTabObj?.tab_type || "video");
      })
      .map(item => item.idx);

    const filteredIndex = filteredIndices.indexOf(index);
    if (filteredIndex === -1) return;

    const targetFilteredIndex = direction === "up" ? filteredIndex - 1 : filteredIndex + 1;
    if (targetFilteredIndex < 0 || targetFilteredIndex >= filteredIndices.length) return;

    const targetIndex = filteredIndices[targetFilteredIndex];

    recordWorksHistory();
    const updated = [...editWorks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setEditWorks(updated);
  };

  const saveWorks = async () => {
    setSaveStatus(prev => ({ ...prev, portfolio: "saving" }));
    toast.info("Re-indexing portfolio works and tabs in backend storage...");
    try {
      if (editSettings.portfolio_license_button_text !== siteSettings.portfolio_license_button_text) {
        await updateSiteSetting("portfolio_license_button_text", editSettings.portfolio_license_button_text || "Acquire License");
      }
      
      // Save dynamic tabs
      const tabsSuccess = await updatePortfolioTabs(editTabs);
      if (!tabsSuccess) throw new Error("Failed to save portfolio tabs");

      // Save works
      const success = await updatePortfolioWorks(editWorks);
      if (success) {
        setSaveStatus(prev => ({ ...prev, portfolio: "saved" }));
        toast.success("Portfolio layout and tabs successfully updated!");
        setTimeout(() => setSaveStatus(prev => ({ ...prev, portfolio: "idle" })), 3000);
      } else {
        setSaveStatus(prev => ({ ...prev, portfolio: "error" }));
        toast.error("Failed to re-index portfolio works.");
      }
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, portfolio: "error" }));
      toast.error(`Failed to update portfolio layout: ${err?.message || "Unknown error"}`);
    }
  };

  // ----------------------------------------------------
  // TAB 4: PRICING TIERS STATE & HANDLERS
  // ----------------------------------------------------
  const handlePricingChange = (id: string, field: keyof PricingTier, value: any) => {
    setEditPricing(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const movePricingItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editPricing.length) return;

    recordPricingHistory();
    const updated = [...editPricing];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setEditPricing(updated);
    toast.success("Pricing package order adjusted.");
  };

  const handleFeaturesChange = (id: string, index: number, value: string) => {
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        const updatedFeatures = [...item.deliverables];
        updatedFeatures[index] = value;
        return { ...item, deliverables: updatedFeatures };
      }
      return item;
    }));
  };

  const addFeature = (id: string) => {
    recordPricingHistory();
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, deliverables: [...item.deliverables, "New deliverable scope"] };
      }
      return item;
    }));
  };

  const deleteFeature = (id: string, index: number) => {
    recordPricingHistory();
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, deliverables: item.deliverables.filter((_, idx) => idx !== index) };
      }
      return item;
    }));
  };

  const handleMilestonesChange = (id: string, index: number, field: "label" | "discount", value: any) => {
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        const milestones = [...(item.slider_milestones || [])];
        milestones[index] = { ...milestones[index], [field]: value };
        return { ...item, slider_milestones: milestones };
      }
      return item;
    }));
  };

  const addMilestone = (id: string) => {
    recordPricingHistory();
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        const milestones = [...(item.slider_milestones || [])];
        return { ...item, slider_milestones: [...milestones, { label: "New Milestone", discount: 0 }] };
      }
      return item;
    }));
  };

  const deleteMilestone = (id: string, index: number) => {
    recordPricingHistory();
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        const milestones = (item.slider_milestones || []).filter((_, idx) => idx !== index);
        return { ...item, slider_milestones: milestones };
      }
      return item;
    }));
  };

  const savePricing = async () => {
    setSaveStatus(prev => ({ ...prev, pricing: "saving" }));
    toast.info("Updating production tier packages and discount badge settings...");
    try {
      const discountSettingsToSave: Record<string, string> = {};
      const discountKeys = [
        "discount_badge_gradient_start",
        "discount_badge_gradient_end",
        "discount_badge_text_color",
        "discount_badge_gradient_enabled",
        "pricing_spotlight_text",
        "page2_pricing_spotlight_text",
        "pricing_title_size",
        "page2_pricing_title_size",
        "pricing_title",
        "page2_pricing_title"
      ];
      discountKeys.forEach(key => {
        if (editSettings[key] !== siteSettings[key]) {
          discountSettingsToSave[key] = editSettings[key] || "";
        }
      });

      if (Object.keys(discountSettingsToSave).length > 0) {
        await updateMultipleSiteSettings(discountSettingsToSave);
      }

      if (editSettings.pricing_note_text !== siteSettings.pricing_note_text) {
        await updateSiteSetting("pricing_note_text", editSettings.pricing_note_text || "");
      }
      const success = await updatePricingTiers(editPricing);
      if (success) {
        setSaveStatus(prev => ({ ...prev, pricing: "saved" }));
        toast.success("Production tiers and discount configurations synchronized!");
        setTimeout(() => setSaveStatus(prev => ({ ...prev, pricing: "idle" })), 3000);
      } else {
        setSaveStatus(prev => ({ ...prev, pricing: "error" }));
        toast.error("Failed to update pricing package rates.");
      }
    } catch (err: any) {
      setSaveStatus(prev => ({ ...prev, pricing: "error" }));
      toast.error(`Failed to update pricing packages: ${err?.message || "Unknown error"}`);
    }
  };


  // ----------------------------------------------------
  // UI RENDERING
  // ----------------------------------------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 relative">
        <BackgroundGradients />
        
        {/* LOGIN CONTAINER */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10 border border-white/10 shadow-2xl"
        >
          {/* LOGO */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4A36B3] to-[#ffea00] flex items-center justify-center relative shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display font-medium text-2xl tracking-tight text-white italic">
              bhakty<span className="text-[#ffea00]">.</span>admin
            </h1>
            <p className="text-gray-500 font-mono text-xs uppercase tracking-widest text-center">
              Axiom Core Gatekeeper
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-2 tracking-wide">
                Security Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ffea00]/50 focus:ring-1 focus:ring-[#ffea00]/30 transition-all font-mono"
              />
            </div>

            {authError && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-[#ffea00] text-black font-semibold font-display tracking-tight hover:shadow-lg hover:shadow-[#ffea00]/20 hover:bg-[#ffea00] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? "Verifying Authorization..." : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs text-gray-500 hover:text-white transition-colors uppercase tracking-widest font-mono cursor-pointer"
            >
              Return to Website
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`w-screen h-screen ${isLightMode ? "admin-light-mode" : theme.style.bodyBg} flex flex-col overflow-hidden relative transition-colors duration-500 font-sans`}>
      <BackgroundGradients />

      {/* HEADER SECTION (Sticky Top) */}
      <div className="sticky top-0 z-50 w-full bg-black/40 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-20">
        <div className="md:w-1/3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-display font-medium text-xl md:text-2xl tracking-tighter italic text-white">
              bhakty<span className="text-[#ffea00]">.</span>admin
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#ffea00] bg-[#ffea00]/5 border border-[#ffea00]/20 rounded-full px-2.5 py-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#ffea00]" /> Connected
            </span>
          </div>
          <p className="text-gray-400 text-[11px] font-light mt-1 text-left">
            Manage database settings, menu anchors, motion artifacts, and production price tiers.
          </p>
        </div>

        {/* Center: Active Workspace Scope Toggle Selector */}
        <div className="flex flex-col items-center justify-center md:w-1/3 my-2 md:my-0">
          <span className="text-[8px] sm:text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-1.5 font-bold">Active Workspace Scope</span>
          <div className="relative flex items-center p-1 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl w-full max-w-[280px] sm:max-w-sm">
            <div className="relative flex w-full">
              {/* Sliding Background Capsule */}
              <motion.div
                className={`absolute top-0 bottom-0 left-0 w-1/3 rounded-full bg-gradient-to-r shadow-[0_0_15px_rgba(255,255,255,0.15)] backdrop-blur-sm ${
                  adminPageScope === "ai" 
                    ? "from-[#ffea00]/80 to-[#ffb700]/80" 
                    : adminPageScope === "live"
                    ? "from-fuchsia-500 to-pink-600"
                    : "from-violet-500 to-purple-600"
                }`}
                animate={{ x: adminPageScope === "ai" ? "0%" : adminPageScope === "live" ? "100%" : "200%" }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
              <button
                onClick={() => {
                  setAdminPageScope("ai");
                  setActivePage("ai");
                  toast.success("Switched editing scope to AI Production page.");
                }}
                className={`relative z-10 w-1/3 py-1.5 text-[8px] sm:text-[9.5px] font-mono uppercase tracking-wider font-bold transition-colors duration-300 text-center cursor-pointer ${
                  adminPageScope === "ai" ? "text-black" : "text-gray-400 hover:text-white"
                }`}
              >
                AI Prod
              </button>
              <button
                onClick={() => {
                  setAdminPageScope("live");
                  setActivePage("live");
                  toast.success("Switched editing scope to Live-action Production page.");
                }}
                className={`relative z-10 w-1/3 py-1.5 text-[8px] sm:text-[9.5px] font-mono uppercase tracking-wider font-bold transition-colors duration-300 text-center cursor-pointer ${
                  adminPageScope === "live" ? "text-black" : "text-gray-400 hover:text-white"
                }`}
              >
                Live Action
              </button>
              <button
                onClick={() => {
                  setAdminPageScope("app");
                  toast.success("Switched editing scope to Mobile App Version settings.");
                }}
                className={`relative z-10 w-1/3 py-1.5 text-[8px] sm:text-[9.5px] font-mono uppercase tracking-wider font-bold transition-colors duration-300 text-center cursor-pointer ${
                  adminPageScope === "app" ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                App Version
              </button>
            </div>
          </div>
        </div>

        <div className="md:w-1/3 flex items-center justify-start md:justify-end gap-3 flex-wrap">
          {isUsingSupabase ? (
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
              ● Live Supabase Connected
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-mono bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10" title="Values persist instantly in localStorage fallback driver">
              ▲ LocalStorage Database Engaged
            </span>
          )}
          
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-[11px] font-medium font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 px-4 py-2 rounded-xl text-white hover:border-[#ffea00]/40 hover:text-[#ffea00] transition-all cursor-pointer"
          >
            Exit to Studio
          </button>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("bhakty_admin_auth");
              sessionStorage.removeItem("bhakty_admin_auth");
              setIsAuthenticated(false);
              toast.success("Security access terminated. Logged out.");
            }}
            className="text-[11px] font-medium font-display tracking-tight bg-red-950/20 border border-red-500/25 px-4 py-2 rounded-xl text-red-300 hover:border-red-500 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Lock className="w-3 h-3" /> Logout
          </button>

          {/* Responsive Day/Night Theme Toggle Switch */}
          <button
            type="button"
            onClick={toggleLightMode}
            className="relative w-12 h-6.5 rounded-full transition-all duration-300 cursor-pointer flex items-center p-0.5 border"
            style={{
              background: isLightMode ? "rgba(240, 240, 240, 0.8)" : "rgba(10, 10, 15, 0.6)",
              borderColor: isLightMode ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
            }}
            title={isLightMode ? "Switch to Night Mode" : "Switch to Day Mode"}
          >
            <motion.div
              layout
              className="w-5 h-5 rounded-full transition-all duration-300 relative flex items-center justify-center text-[10px]"
              style={{
                marginLeft: isLightMode ? "auto" : "0px",
                background: isLightMode 
                  ? "linear-gradient(135deg, #ff9e00, #ff6d00)" 
                  : "linear-gradient(135deg, #7342e2, #2b5cf6)",
                boxShadow: isLightMode 
                  ? "0 0 10px rgba(255, 109, 0, 0.6)" 
                  : "0 0 10px rgba(115, 66, 226, 0.6)",
              }}
            >
              {isLightMode ? "☀️" : "🌙"}
            </motion.div>
          </button>
        </div>
      </div>

      {/* WORKSPACE LAYOUT (Full width flex) */}
      <div className="flex flex-1 overflow-hidden w-full relative z-10">
        
        {/* SIDEBAR NAVIGATION (Sticky left navigation track) */}
        <aside className="sticky left-0 h-full w-72 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur-md p-5 flex flex-col gap-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "settings"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Settings className="w-3.5 h-3.5" /> Global Copy & Media
          </button>
          
          <button
            onClick={() => setActiveTab("navigation")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "navigation"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Compass className="w-3.5 h-3.5" /> Navigation Menu
          </button>

          <button
            onClick={() => setActiveTab("portfolio")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "portfolio"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Play className="w-3.5 h-3.5" /> Portfolio Manager
          </button>

          <button
            onClick={() => setActiveTab("pricing")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "pricing"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <ArrowDown className="w-3.5 h-3.5 rotate-45" /> Pricing packages
          </button>

          <button
            onClick={() => setActiveTab("assets")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "assets"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Upload className="w-3.5 h-3.5" /> Global Assets Manager
          </button>

          <button
            onClick={() => setActiveTab("submissions")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "submissions"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-3.5 h-3.5 shrink-0" /> 
              <span className="truncate">Creative Intake Entries</span>
            </div>
            {(() => {
              const pendingCount = submissionsList.filter((sub: any) => sub.status === "Pending" || !sub.status).length;
              if (pendingCount > 0) {
                return (
                  <span className="shrink-0 ml-2 bg-red-500 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                );
              }
              return null;
            })()}
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "analytics"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Real-time Analytics Board
          </button>

          <button
            onClick={() => setActiveTab("intake_form")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "intake_form"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Sliders className="w-3.5 h-3.5" /> Ingestion Form Config
          </button>

          <button
            onClick={() => setActiveTab("brand_logos")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "brand_logos"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Image className="w-3.5 h-3.5" /> Brand Logos Manager
          </button>

          <button
            onClick={() => setActiveTab("testimonials")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "testimonials"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Testimonials Manager
          </button>

          <button
            onClick={() => setActiveTab("live_chats")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "live_chats"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <BrainCircuit className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Live Chats Console</span>
            </div>
            {chatSessions.reduce((acc, s) => acc + (s.unread_count || 0), 0) > 0 && (
              <span className="px-2 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                {chatSessions.reduce((acc, s) => acc + (s.unread_count || 0), 0)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("chat_settings")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-sans uppercase tracking-wider font-bold transition-all duration-300 relative border ${
              activeTab === "chat_settings"
                ? "bg-white/10 text-white border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                : "text-gray-400 hover:text-white bg-black/30 border-white/5 hover:border-white/15 hover:bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(12px)" }}
          >
            <Sliders className="w-3.5 h-3.5" /> Chat Widget Config
          </button>

          {/* QUICK SCHEMA INST INSTRUCTIONS */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="glass-panel p-3.5 rounded-2xl text-[10px] space-y-2">
              <div className="flex items-center gap-1.5 text-gray-300 font-mono">
                <HelpCircle className="w-3 h-3 text-gray-400" />
                <span>Configuring Supabase</span>
              </div>
              <p className="text-gray-500 leading-relaxed text-left">
                Provide <code className="text-amber-200/90 font-mono text-[9px]">VITE_SUPABASE_URL</code> inside <code className="text-amber-200/90 font-mono text-[9px]">.env</code> to redirect queries into Supabase automatically.
              </p>
            </div>
          </div>
        </aside>

        {/* CENTRAL MAIN CONTENT WINDOW WRAPPER */}
        <main className="flex-1 h-full overflow-y-auto p-6 md:p-10 relative">

          {/* EDIT ZONE (Wrapped in a Framer Motion animation layer for hardware-accelerated fade transitions) */}
          <motion.div
            key={adminPageScope}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 min-h-[500px]"
          >
              
              {/* TAB 1: SITE SETTINGS */}
              {activeTab === "settings" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="font-display font-medium text-xl text-white">
                        Global Text Copy & Hero Configuration
                      </h2>
                      
                      {/* Undo / Redo controls */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={triggerSettingsUndo}
                          disabled={settingsHistory.length === 0}
                          title="Undo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Undo className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={triggerSettingsRedo}
                          disabled={settingsFuture.length === 0}
                          title="Redo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Redo className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={saveSettings}
                      disabled={saveStatus.settings === "saving"}
                      className={`flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-semibold rounded-xl transition-all cursor-pointer shrink-0 ml-auto sm:ml-0 ${scopeStyle.accentBg}`}
                    >
                      <Save className="w-4 h-4" /> Synchronize settings
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" onFocusCapture={() => recordSettingsHistory()}>
                    {adminPageScope === "live" ? (
                      <>
                        <div className="md:col-span-2 border-b border-white/5 pb-2 mb-2">
                          <h4 className="text-sm font-semibold text-pink-500 font-display">Live-Action Viewport Background Settings</h4>
                        </div>
                        
                        <div className="md:col-span-2 space-y-3">
                          <label className="block text-xs font-mono uppercase text-gray-500">Hero Video/Image Source URL</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Custom Media URL</label>
                              <input
                                type="text"
                                value={getSettingValueScoped("hero_video_bg_url")}
                                onChange={(e) => handleSettingChangeScoped("hero_video_bg_url", e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500/40 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Choose from Assets Library</label>
                              <select
                                value={getSettingValueScoped("hero_video_bg_url") || ""}
                                onChange={(e) => handleSettingChangeScoped("hero_video_bg_url", e.target.value)}
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500/40"
                              >
                                <option value="">-- Apply an Asset --</option>
                                {mediaAssets.map((asset) => (
                                  <option key={asset.id} value={asset.url}>
                                    {asset.name} ({asset.type})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Dark Overlay Opacity (0.0 to 1.0)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_bg_overlay", "0.4")}
                            onChange={(e) => handleSettingChangeScoped("hero_bg_overlay", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Cinematic Blur Effect</label>
                          <select
                            value={getSettingValueScoped("hero_bg_blur", "none")}
                            onChange={(e) => handleSettingChangeScoped("hero_bg_blur", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          >
                            <option value="none">No Blur (Default)</option>
                            <option value="sm">Subtle Blur (sm)</option>
                            <option value="md">Medium Blur (md)</option>
                            <option value="lg">Heavy Blur (lg)</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 border-b border-white/5 pb-2 mb-2 mt-4">
                          <h4 className="text-sm font-semibold text-pink-500 font-display">Hero Typography & Alignment Settings</h4>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Micro Badge Text</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_badge_text")}
                            onChange={(e) => handleSettingChangeScoped("hero_badge_text", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Text Alignment Position</label>
                          <select
                            value={getSettingValueScoped("hero_text_align", "left")}
                            onChange={(e) => handleSettingChangeScoped("hero_text_align", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          >
                            <option value="left">Left Aligned (Mockup)</option>
                            <option value="center">Centered</option>
                            <option value="right">Right Aligned</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Line 1</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_1")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_1", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Title Size (CSS clamp or px)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_size", "clamp(1.65rem, 5vw, 3rem)")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_size", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Line 2 (Serif/Middle)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_2")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_2", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Title Color - Lines 1 & 3 (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_title_color", "#ffffff")}
                              onChange={(e) => handleSettingChangeScoped("hero_title_color", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_title_color").startsWith('#') && getSettingValueScoped("hero_title_color").length === 7 ? getSettingValueScoped("hero_title_color") : "#ffffff"}
                              onChange={(e) => handleSettingChangeScoped("hero_title_color", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Line 3</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_3")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_3", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Heading Title Color - Line 2 (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_title_color_line2", "#ffffff")}
                              onChange={(e) => handleSettingChangeScoped("hero_title_color_line2", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_title_color_line2").startsWith('#') && getSettingValueScoped("hero_title_color_line2").length === 7 ? getSettingValueScoped("hero_title_color_line2") : "#ffffff"}
                              onChange={(e) => handleSettingChangeScoped("hero_title_color_line2", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Subtitle Paragraph Description</label>
                          <textarea
                            value={getSettingValueScoped("hero_description")}
                            onChange={(e) => handleSettingChangeScoped("hero_description", e.target.value)}
                            rows={3}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Subtitle Font Size (CSS clamp or px)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_subtitle_size", "clamp(0.9rem, 2.5vw, 1.1rem)")}
                            onChange={(e) => handleSettingChangeScoped("hero_subtitle_size", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Subtitle Text Color (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_subtitle_color", "#ffffff")}
                              onChange={(e) => handleSettingChangeScoped("hero_subtitle_color", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_subtitle_color").startsWith('#') && getSettingValueScoped("hero_subtitle_color").length === 7 ? getSettingValueScoped("hero_subtitle_color") : "#ffffff"}
                              onChange={(e) => handleSettingChangeScoped("hero_subtitle_color", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Padding Top Spacing</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_padding_top", "clamp(40px, 8vw, 72px)")}
                            onChange={(e) => handleSettingChangeScoped("hero_padding_top", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Text Column Max Width</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_max_width", "560px")}
                            onChange={(e) => handleSettingChangeScoped("hero_max_width", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                          />
                        </div>

                        <div className="md:col-span-2 border-b border-white/5 pb-2 mb-2 mt-4">
                          <h4 className="text-sm font-semibold text-pink-500 font-display">Hero CTA Button Settings</h4>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Label Text</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_cta_text", "Get It Free")}
                            onChange={(e) => handleSettingChangeScoped("hero_cta_text", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Background Color (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_cta_bg", "#7342E2")}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_bg", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_cta_bg").startsWith('#') && getSettingValueScoped("hero_cta_bg").length === 7 ? getSettingValueScoped("hero_cta_bg") : "#7342e2"}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_bg", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Text Color (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_cta_color", "#ffffff")}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_color", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_cta_color").startsWith('#') && getSettingValueScoped("hero_cta_color").length === 7 ? getSettingValueScoped("hero_cta_color") : "#ffffff"}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_color", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Text Size</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_cta_size", "clamp(0.9rem, 2vw, 1rem)")}
                            onChange={(e) => handleSettingChangeScoped("hero_cta_size", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Glow (true/false)</label>
                          <select
                            value={getSettingValueScoped("hero_cta_glow", "true")}
                            onChange={(e) => handleSettingChangeScoped("hero_cta_glow", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40"
                          >
                            <option value="true">Glow Enabled</option>
                            <option value="false">Glow Disabled</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">CTA Button Glow Shadow Color (RGBA)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_cta_glow_color", "rgba(115,66,226,0.28)")}
                            onChange={(e) => handleSettingChangeScoped("hero_cta_glow_color", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500/40 font-mono"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="md:col-span-2 space-y-3">
                          <label className="block text-xs font-mono uppercase text-gray-500">Hero Video Background Source (Looping)</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Custom Media URL</label>
                              <input
                                type="text"
                                value={getSettingValueScoped("hero_video_bg_url")}
                                onChange={(e) => handleSettingChangeScoped("hero_video_bg_url", e.target.value)}
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none ${scopeStyle.focusBorder} font-mono`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Choose from Assets Library</label>
                              <select
                                value={getSettingValueScoped("hero_video_bg_url") || ""}
                                onChange={(e) => handleSettingChangeScoped("hero_video_bg_url", e.target.value)}
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none ${scopeStyle.focusBorder}`}
                              >
                                <option value="">-- Apply an Asset --</option>
                                {mediaAssets.map((asset) => (
                                  <option key={asset.id} value={asset.url}>
                                    {asset.name} ({asset.type})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Micro Badge Text</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_badge_text")}
                            onChange={(e) => handleSettingChangeScoped("hero_badge_text", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Footer Copyright Text</label>
                          <input
                            type="text"
                            value={editSettings.footer_copyright}
                            onChange={(e) => handleSettingChange("footer_copyright", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 1</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_1")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_1", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 2 (Serif)</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_2")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_2", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 3</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_title_3")}
                            onChange={(e) => handleSettingChangeScoped("hero_title_3", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Main CTA Button Label</label>
                          <input
                            type="text"
                            value={getSettingValueScoped("hero_cta_booking_text")}
                            onChange={(e) => handleSettingChangeScoped("hero_cta_booking_text", e.target.value)}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder}`}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Main CTA Button Color (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_cta_booking_color")}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_booking_color", e.target.value)}
                              placeholder="e.g. #ffea00"
                              className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder} font-mono`}
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_cta_booking_color") && getSettingValueScoped("hero_cta_booking_color").startsWith('#') && getSettingValueScoped("hero_cta_booking_color").length === 7 ? getSettingValueScoped("hero_cta_booking_color") : "#ffea00"}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_booking_color", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Main CTA Button Text Color (HEX)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_cta_booking_text_color")}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_booking_text_color", e.target.value)}
                              placeholder="e.g. #FFFFFF"
                              className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder} font-mono`}
                            />
                            <input
                              type="color"
                              value={getSettingValueScoped("hero_cta_booking_text_color") && getSettingValueScoped("hero_cta_booking_text_color").startsWith('#') && getSettingValueScoped("hero_cta_booking_text_color").length === 7 ? getSettingValueScoped("hero_cta_booking_text_color") : "#FFFFFF"}
                              onChange={(e) => handleSettingChangeScoped("hero_cta_booking_text_color", e.target.value)}
                              className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Subtitle Paragraph Description</label>
                          <textarea
                            value={getSettingValueScoped("hero_description")}
                            onChange={(e) => handleSettingChangeScoped("hero_description", e.target.value)}
                            rows={4}
                            className={`w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none ${scopeStyle.focusBorder} resize-none`}
                          />
                        </div>

                        {/* Stats */}
                        <div className="border-t border-white/5 pt-6 md:col-span-2 grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 1 Value</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat1_value")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat1_value", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                            <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat1_label")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat1_label", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 2 Value</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat2_value")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat2_value", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                            <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat2_label")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat2_label", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 3 Value</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat3_value")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat3_value", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                            <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                            <input
                              type="text"
                              value={getSettingValueScoped("hero_stat3_label")}
                              onChange={(e) => handleSettingChangeScoped("hero_stat3_label", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                        </div>

                        {/* HERO SPACING & LAYOUT CONTROLS */}
                        <div className="border-t border-white/5 pt-6 md:col-span-2">
                          <h3 className={`text-sm font-semibold ${scopeStyle.headingText} font-display mb-3`}>Hero Section Spacing & Layout Controls</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Padding Top</label>
                              <input
                                type="text"
                                value={editSettings.hero_padding_top || ""}
                                onChange={(e) => handleSettingChange("hero_padding_top", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Padding Bottom</label>
                              <input
                                type="text"
                                value={editSettings.hero_padding_bottom || ""}
                                onChange={(e) => handleSettingChange("hero_padding_bottom", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Margin Top</label>
                              <input
                                type="text"
                                value={editSettings.hero_margin_top || ""}
                                onChange={(e) => handleSettingChange("hero_margin_top", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Margin Bottom</label>
                              <input
                                type="text"
                                value={editSettings.hero_margin_bottom || ""}
                                onChange={(e) => handleSettingChange("hero_margin_bottom", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Text Area Max Width</label>
                              <input
                                type="text"
                                value={editSettings.hero_text_width || ""}
                                onChange={(e) => handleSettingChange("hero_text_width", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Text Area Max Height</label>
                              <input
                                type="text"
                                value={editSettings.hero_text_height || ""}
                                onChange={(e) => handleSettingChange("hero_text_height", e.target.value)}
                                placeholder="default"
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 ${scopeStyle.focusBorder}`}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* BRAND / PARAMS: NAVIGATION LOGO STYLING */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <h3 className="text-sm font-semibold text-gray-300 font-display mb-3">Logo Appearance Attributes (Navbar logo)</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Logo URL Resource Link</label>
                          <input
                            type="text"
                            value={editSettings.logo_img_url || ""}
                            onChange={(e) => handleSettingChange("logo_img_url", e.target.value)}
                            placeholder="e.g. https://domain.com/logo.png"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Navbar Logo Width (e.g. auto, 120px)</label>
                          <input
                            type="text"
                            value={editSettings.logo_width || ""}
                            onChange={(e) => handleSettingChange("logo_width", e.target.value)}
                            placeholder="auto"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Navbar Logo Height (e.g. 36px, 48px)</label>
                          <input
                            type="text"
                            value={editSettings.logo_height || ""}
                            onChange={(e) => handleSettingChange("logo_height", e.target.value)}
                            placeholder="36px"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Mobile Logo Width (e.g. auto, 80px)</label>
                          <input
                            type="text"
                            value={editSettings.logo_width_mobile || ""}
                            onChange={(e) => handleSettingChange("logo_width_mobile", e.target.value)}
                            placeholder="auto"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Mobile Logo Height (e.g. 24px, 32px)</label>
                          <input
                            type="text"
                            value={editSettings.logo_height_mobile || ""}
                            onChange={(e) => handleSettingChange("logo_height_mobile", e.target.value)}
                            placeholder="28px"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Navbar Logo CSS Padding (e.g. 0px, 4px 8px)</label>
                          <input
                            type="text"
                            value={editSettings.logo_padding || ""}
                            onChange={(e) => handleSettingChange("logo_padding", e.target.value)}
                            placeholder="0px"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* INTERACTIVE WEBSITE THEME SWITCHER TABLE */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-4 h-4 text-[#ffea00]" />
                        <h3 className="text-sm font-semibold text-gray-300 font-display">Active Global Website Theme</h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                        {WEB_THEMES.map((themeOption) => {
                          const isCurrent = (editSettings.website_theme || "obsidian_cyber") === themeOption.id;
                          return (
                            <button
                              key={themeOption.id}
                              type="button"
                              onClick={() => {
                                handleSettingChange("website_theme", themeOption.id);
                                toast.info(`Applied preview theme: ${themeOption.name}`);
                              }}
                              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                                isCurrent 
                                  ? "bg-[#ffea00]/15 border-[#ffea00] text-white" 
                                  : "bg-black/40 border-white/5 hover:border-white/20 text-gray-400 hover:text-white"
                              }`}
                            >
                              <span className="font-mono text-[9px] uppercase tracking-widest text-[#ffea00] opacity-80">
                                {themeOption.type}
                              </span>
                              <span className="text-xs font-semibold truncate w-full">{themeOption.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* FULL WIDTH OPTION */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders className="w-4 h-4 text-[#ffea00]" />
                        <h3 className="text-sm font-semibold text-gray-300 font-display">Website Dimension Configuration</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 max-w-2xl leading-relaxed font-light">
                        Control the maximum stretching limits of page blocks. Full-width mode allows all curated sections to scale to the complete outer margins of your client viewer without overlaying or interfering with the navigation bars.
                      </p>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            handleSettingChange("website_full_width", "false");
                            toast.info("Switched to Default Moderate Width spacing (max 1280px / 7xl).");
                          }}
                          className={`flex-1 py-3.5 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                            (editSettings.website_full_width !== "true")
                              ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                              : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          Default Moderate (7xl Max Width)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSettingChange("website_full_width", "true");
                            toast.info("Switched website layout to Full Width Cinematic stretch mode.");
                          }}
                          className={`flex-1 py-3.5 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                            (editSettings.website_full_width === "true")
                              ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                              : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          Cinematic Full Width (Edge-to-Edge)
                        </button>
                      </div>
                    </div>

                    {/* GLOBAL NAVIGATION BAR SIZING */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Sliders className="w-4 h-4 text-[#ffea00]" />
                        <h3 className="text-sm font-semibold text-gray-300 font-display">Global Navigation Bar Sizing</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 max-w-2xl leading-relaxed font-light">
                        Configure the design spacing of the main navigation bar. Toggling full-width stretches the header to screen boundaries, disabling borders and pill-style roundings for a modern cinematic borderless look.
                      </p>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            handleSettingChangeScoped("navbar_full_width", "false");
                            toast.info(`Switched ${adminPageScope === "live" ? "Live Action" : "AI Production"} navigation to Compact Floating Capsule.`);
                          }}
                          className={`flex-1 py-3.5 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                            (getSettingValueScoped("navbar_full_width") !== "true")
                              ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                              : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          Compact Floating Capsule (Default)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleSettingChangeScoped("navbar_full_width", "true");
                            toast.info(`Switched ${adminPageScope === "live" ? "Live Action" : "AI Production"} navigation to Cinematic Full Width.`);
                          }}
                          className={`flex-1 py-3.5 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                            (getSettingValueScoped("navbar_full_width") === "true")
                              ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                              : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                          }`}
                        >
                          Cinematic Full Width (Edge-to-Edge)
                        </button>
                      </div>
                    </div>

                    {/* BACKGROUND GRADIENT TINT SETTINGS */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-4 h-4 text-[#ffea00]" />
                        <h3 className="text-sm font-semibold text-gray-300 font-display">Background Gradient Tint Customization</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 max-w-2xl leading-relaxed font-light">
                        Customize the background ambient gradient tints for the AI Production page and the Live Action page.
                      </p>
                      
                      <div className="space-y-6">
                        {/* AI Production Page Gradients */}
                        <div>
                          <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ffea00] uppercase mb-3">AI Production Page (Page 1) Tints</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 1 (Default: #7e22ce)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.bg_gradient_color_1 || "#7e22ce"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_1", e.target.value)}
                                  placeholder="#7e22ce"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.bg_gradient_color_1 && editSettings.bg_gradient_color_1.startsWith('#') && editSettings.bg_gradient_color_1.length === 7 ? editSettings.bg_gradient_color_1 : "#7e22ce"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_1", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 2 (Default: #3b82f6)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.bg_gradient_color_2 || "#3b82f6"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_2", e.target.value)}
                                  placeholder="#3b82f6"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.bg_gradient_color_2 && editSettings.bg_gradient_color_2.startsWith('#') && editSettings.bg_gradient_color_2.length === 7 ? editSettings.bg_gradient_color_2 : "#3b82f6"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_2", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 3 (Default: #000000)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.bg_gradient_color_3 || "#000000"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_3", e.target.value)}
                                  placeholder="#000000"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.bg_gradient_color_3 && editSettings.bg_gradient_color_3.startsWith('#') && editSettings.bg_gradient_color_3.length === 7 ? editSettings.bg_gradient_color_3 : "#000000"}
                                  onChange={(e) => handleSettingChange("bg_gradient_color_3", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Live Action Page Gradients */}
                        <div>
                          <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ffea00] uppercase mb-3">Live Action Page (Page 2) Tints</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 1 (Default: #b91c1c)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.page2_bg_gradient_color_1 || "#b91c1c"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_1", e.target.value)}
                                  placeholder="#b91c1c"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.page2_bg_gradient_color_1 && editSettings.page2_bg_gradient_color_1.startsWith('#') && editSettings.page2_bg_gradient_color_1.length === 7 ? editSettings.page2_bg_gradient_color_1 : "#b91c1c"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_1", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 2 (Default: #d97706)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.page2_bg_gradient_color_2 || "#d97706"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_2", e.target.value)}
                                  placeholder="#d97706"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.page2_bg_gradient_color_2 && editSettings.page2_bg_gradient_color_2.startsWith('#') && editSettings.page2_bg_gradient_color_2.length === 7 ? editSettings.page2_bg_gradient_color_2 : "#d97706"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_2", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1.5">Color 3 (Default: #000000)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editSettings.page2_bg_gradient_color_3 || "#000000"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_3", e.target.value)}
                                  placeholder="#000000"
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                />
                                <input
                                  type="color"
                                  value={editSettings.page2_bg_gradient_color_3 && editSettings.page2_bg_gradient_color_3.startsWith('#') && editSettings.page2_bg_gradient_color_3.length === 7 ? editSettings.page2_bg_gradient_color_3 : "#000000"}
                                  onChange={(e) => handleSettingChange("page2_bg_gradient_color_3", e.target.value)}
                                  className="w-10 h-8 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* TYPOGRAPHY & FONT CUSTOMIZATION */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Type className="w-4 h-4 text-[#ffea00]" />
                        <h3 className="text-sm font-semibold text-gray-300 font-display">Typography & Font Customization</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4 max-w-2xl leading-relaxed font-light">
                        Configure font selection, text size, and bold toggle globally across the website. Standard web-safe fallback configurations are applied automatically.
                      </p>

                      <div className="space-y-6">
                        {[
                          { key: "headings", label: "Global Headings (h1, h2, h3, h4, h5, h6)" },
                          { key: "paragraph", label: "Paragraphs & Body Text (p, span, li, a)" },
                          { key: "h1", label: "H1 Element Overrides" },
                          { key: "h2", label: "H2 Element Overrides" },
                          { key: "h3", label: "H3 Element Overrides" },
                          { key: "h4", label: "H4 Element Overrides" },
                          { key: "h5", label: "H5 Element Overrides" },
                          { key: "h6", label: "H6 Element Overrides" }
                        ].map((elem) => {
                          const fontVal = editSettings[`font_${elem.key}_family`] || "Default Theme Font";
                          const sizeVal = editSettings[`font_${elem.key}_size`] || "";
                          const boldVal = editSettings[`font_${elem.key}_bold`] === "true";

                          return (
                            <div key={elem.key} className="bg-black/20 border border-white/[0.03] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                              <div>
                                <label className="block text-[11px] font-mono uppercase text-gray-400 mb-1">{elem.label}</label>
                                <span className="text-[10px] text-gray-500 font-mono">Select active family</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
                                <div>
                                  <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Font Family</label>
                                  <select
                                    value={fontVal}
                                    onChange={(e) => handleSettingChange(`font_${elem.key}_family`, e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40"
                                  >
                                    {[
                                      "Default Theme Font",
                                      "Outfit",
                                      "Plus Jakarta Sans",
                                      "DM Sans",
                                      "Lexend",
                                      "Urbanist",
                                      "Lexend Deca",
                                      "Krona One",
                                      "Cal Sans",
                                      "Google Sans",
                                      "Anton SC",
                                      "Poppins"
                                    ].map((font) => (
                                      <option key={font} value={font}>
                                        {font}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex gap-4 items-end">
                                  <div className="flex-1">
                                    <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Font Size (e.g. 2rem, 28px)</label>
                                    <input
                                      type="text"
                                      value={sizeVal}
                                      onChange={(e) => handleSettingChange(`font_${elem.key}_size`, e.target.value)}
                                      placeholder="Default size"
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                                    />
                                  </div>
                                  <div className="flex items-center pb-2">
                                    <label className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={boldVal}
                                        onChange={(e) => handleSettingChange(`font_${elem.key}_bold`, e.target.checked ? "true" : "false")}
                                        className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                                      />
                                      Bold
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: NAVIGATION */}
              {activeTab === "navigation" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="font-display font-medium text-xl text-white">
                        Navigation Link Anchors
                      </h2>
                      
                      {/* Undo / Redo controls */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={triggerMenuUndo}
                          disabled={menuHistory.length === 0}
                          title="Undo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Undo className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={triggerMenuRedo}
                          disabled={menuFuture.length === 0}
                          title="Redo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Redo className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button
                         onClick={addMenuItem}
                         className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                       >
                         <Plus className="w-4 h-4" /> Add Item
                       </button>
                       <button
                         onClick={saveMenu}
                         disabled={saveStatus.navigation === "saving"}
                         className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer"
                       >
                         <Save className="w-4 h-4" /> Synchronize menu
                       </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 font-mono italic">
                    💡 Drag items using any container spot to intuitively arrange their priority list rank, or use typing focus to record restore states.
                  </p>

                  <div 
                    className="space-y-4" 
                    onFocusCapture={() => recordMenuHistory()}
                  >
                    {editMenu.map((item, index) => (
                      <div 
                        key={item.id}
                        draggable="true"
                        onDragStart={(e) => {
                          recordMenuHistory();
                          e.dataTransfer.setData("text/plain", index.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverIdxMenu(index);
                        }}
                        onDragEnd={() => setDragOverIdxMenu(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"));
                          if (!isNaN(sourceIdx) && sourceIdx !== index) {
                            const updated = [...editMenu];
                            const [removed] = updated.splice(sourceIdx, 1);
                            updated.splice(index, 0, removed);
                            setEditMenu(updated.map((u, i) => ({ ...u, display_order: i + 1 })));
                            toast.success("Navigation order rearranged.");
                          }
                          setDragOverIdxMenu(null);
                        }}
                        className={`flex flex-col md:flex-row items-center gap-4 border p-4 rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-300 ${
                          dragOverIdxMenu === index 
                            ? "bg-purple-950/25 border-purple-500/50 scale-[0.99] shadow-inner" 
                            : "bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 shrink-0 select-none">
                          <GripVertical className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                          <span className="text-xs font-mono text-gray-500">0{index + 1}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Menu Label</label>
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => handleMenuChange(item.id, "label", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Target Element ID Link</label>
                            <select
                              value={item.target_url}
                              onChange={(e) => handleMenuChange(item.id, "target_url", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-[#ffea00]/40"
                            >
                              <option value="hero-section" className="bg-zinc-950 text-white">Hero Section (hero-section)</option>
                              <option value="work-section" className="bg-zinc-950 text-white">Work Showcase (work-section)</option>
                              <option value="pricing-section" className="bg-zinc-950 text-white">Production Tiers (pricing-section)</option>
                              <option value="booking-section" className="bg-zinc-950 text-white">Booking Portal (booking-section)</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteMenuItem(item.id)}
                          className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300 mt-4 md:mt-0 transition-colors shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* NAVIGATION BAR WIDTH CONFIGURATION */}
                  <div className="border-t border-white/5 pt-6 mt-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Sliders className="w-4 h-4 text-[#ffea00]" />
                      <h3 className="text-sm font-semibold text-gray-300 font-display">
                        Navigation Bar Width Mode ({adminPageScope === "live" ? "Live Action" : "AI Production"})
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 max-w-2xl leading-relaxed font-light">
                      Configure whether the navigation bar is shown as a floating capsule in the middle of the screen or stretches edge-to-edge as a full-width cinematic bar.
                    </p>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          handleSettingChangeScoped("navbar_full_width", "false");
                          toast.info(`Set ${adminPageScope === "live" ? "Live Action" : "AI Production"} navigation bar mode to Compact Floating Capsule. Press 'Synchronize menu' to save.`);
                        }}
                        className={`flex-1 py-3 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                          (getSettingValueScoped("navbar_full_width") !== "true")
                            ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                            : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        Compact Floating Capsule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSettingChangeScoped("navbar_full_width", "true");
                          toast.info(`Set ${adminPageScope === "live" ? "Live Action" : "AI Production"} navigation bar mode to Cinematic Full Width. Press 'Synchronize menu' to save.`);
                        }}
                        className={`flex-1 py-3 px-4 rounded-xl border text-center font-display font-medium text-xs sm:text-sm tracking-tight transition-all cursor-pointer ${
                          (getSettingValueScoped("navbar_full_width") === "true")
                            ? "bg-[#ffea00] text-black font-semibold border-transparent shadow shadow-amber-400/25"
                            : "bg-black/40 border-white/5 text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        Cinematic Full-Width
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: PORTFOLIO WORKS */}
              {activeTab === "portfolio" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="font-display font-medium text-xl text-white">
                        Portfolio motion Artifacts Manager
                      </h2>
                      
                      {/* Undo / Redo controls */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={triggerWorksUndo}
                          disabled={worksHistory.length === 0}
                          title="Undo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Undo className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={triggerWorksRedo}
                          disabled={worksFuture.length === 0}
                          title="Redo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Redo className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addWorkItem}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-[#ffea00]" /> Synthesize Work Card
                      </button>
                      <button
                        onClick={saveWorks}
                        disabled={saveStatus.portfolio === "saving"}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Sync Portfolio
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Tabs Manager Section */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 md:p-6 mb-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white font-display">Manage Portfolio Tabs</h4>
                        <p className="text-xs text-gray-500">Add, rename, reorder, or delete your portfolio tabs.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddTabModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ffea00] hover:bg-[#ffcc00] text-black rounded-xl text-xs font-semibold cursor-pointer transition-all"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Add New Tab
                      </button>
                    </div>

                    {/* Tabs list */}
                    <div className="space-y-3">
                      {editTabs.map((tab, idx) => (
                        <div 
                          key={tab.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 border border-white/5 rounded-xl p-3"
                        >
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <span className="text-xs font-mono text-gray-600 bg-white/5 border border-white/10 w-6 h-6 rounded-full flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div className="flex flex-col gap-1 w-full sm:w-64">
                              <input
                                type="text"
                                value={tab.tab_title}
                                onChange={(e) => handleTabTitleChange(tab.id, e.target.value)}
                                className="bg-black/50 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#ffea00]/50"
                                placeholder="Tab Title"
                              />
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-white/5 bg-white/5 text-gray-400">
                              {tab.tab_type}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {/* Move Up */}
                            <button
                              type="button"
                              onClick={() => moveTab(idx, "up")}
                              disabled={idx === 0}
                              className="p-1.5 rounded bg-white/5 text-gray-400 hover:text-white border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            {/* Move Down */}
                            <button
                              type="button"
                              onClick={() => moveTab(idx, "down")}
                              disabled={idx === editTabs.length - 1}
                              className="p-1.5 rounded bg-white/5 text-gray-400 hover:text-white border border-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => deletePortfolioTab(tab.id)}
                              className="p-1.5 rounded bg-red-950/20 text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-red-900/35 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {editTabs.length === 0 && (
                        <div className="text-center py-6 text-xs text-gray-500 font-mono">
                          No portfolio tabs defined. Click "Add New Tab" to create one.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Editing Tab Selector */}
                  <div className="space-y-2 mb-6">
                    <span className="text-xs text-gray-400 font-mono uppercase tracking-wider block">Editing Works Under Tab:</span>
                    <div className="flex flex-wrap gap-2 p-1 bg-black/40 border border-white/5 rounded-xl w-fit">
                      {editTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setAdminActiveTabId(tab.id)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold font-display transition-all cursor-pointer ${
                            adminActiveTabId === tab.id
                              ? "bg-white text-black shadow-lg"
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {tab.tab_title} ({tab.tab_type})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Licensing CTA config panel */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 md:p-6 mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-white font-display">License CTA Button Text</h4>
                        <p className="text-xs text-gray-500">Customize the action text displayed on the portfolio preview modals.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <input
                          type="text"
                          value={editSettings.portfolio_license_button_text || ""}
                          onChange={(e) => handleSettingChange("portfolio_license_button_text", e.target.value)}
                          placeholder="Acquire License"
                          className="w-full md:w-64 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#ffea00]/50"
                        />
                        <button
                          onClick={saveWorks}
                          disabled={saveStatus.portfolio === "saving"}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all cursor-pointer whitespace-nowrap"
                        >
                          Sync Text
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 font-mono italic">
                    💡 Drag work blocks using their background bounds to arrange showcase grids, or use typing focus to track automatic restore points.
                  </p>

                  <div 
                    className="space-y-6"
                    onFocusCapture={() => recordWorksHistory()}
                  >
                    {editWorks
                      .map((work, idx) => ({ work, idx }))
                      .filter(({ work }) => {
                        const activeTabObj = editTabs.find(t => t.id === adminActiveTabId) || editTabs[0];
                        if (work.tab_id) {
                          return work.tab_id === adminActiveTabId;
                        }
                        return work.type === (activeTabObj?.tab_type || "video");
                      })
                      .map(({ work, idx: index }, filteredIndex, filteredArray) => {
                        const isImage = work.type === "image";
                        return (
                          <div 
                            key={work.id}
                            draggable="true"
                            onDragStart={(e) => {
                              recordWorksHistory();
                              e.dataTransfer.setData("text/plain", index.toString());
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverIdxWorks(index);
                            }}
                            onDragEnd={() => setDragOverIdxWorks(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"));
                              if (!isNaN(sourceIdx) && sourceIdx !== index) {
                                const updated = [...editWorks];
                                const [removed] = updated.splice(sourceIdx, 1);
                                updated.splice(index, 0, removed);
                                setEditWorks(updated);
                                toast.success("Portfolio artifact order adjusted.");
                              }
                              setDragOverIdxWorks(null);
                            }}
                            className={`border p-4 md:p-6 rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-300 space-y-4 ${
                              dragOverIdxWorks === index 
                                ? "bg-purple-950/25 border-purple-500/50 scale-[0.99] shadow-inner" 
                                : "bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                            }`}
                          >
                            {/* Title bar with drag handles */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-3">
                              <div className="flex items-center gap-3 select-none">
                                <GripVertical className="w-4 h-4 text-gray-500" />
                                <span className="text-xs font-mono text-[#ffea00] font-semibold">Artifact 0{filteredIndex + 1}</span>
                                <span className="text-sm font-medium text-gray-300">{work.title}</span>
                              </div>

                              <div className="flex items-center gap-2 select-none">
                                <button
                                  onClick={() => moveWorkItem(index, "up")}
                                  disabled={filteredIndex === 0}
                                  className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => moveWorkItem(index, "down")}
                                  disabled={filteredIndex === filteredArray.length - 1}
                                  className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteWorkItem(work.id)}
                                  className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400 hover:text-red-300 transition-colors ml-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Input Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Title</label>
                                <input
                                  type="text"
                                  value={work.title}
                                  onChange={(e) => handleWorkChange(work.id, "title", e.target.value)}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-sans"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Category Label</label>
                                <input
                                  type="text"
                                  value={work.category}
                                  onChange={(e) => handleWorkChange(work.id, "category", e.target.value)}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-sans"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[10px] font-mono uppercase text-gray-500">Tags (Comma Separated)</label>
                                </div>
                                <input
                                  type="text"
                                  value={(work.tags || []).join(", ")}
                                  onChange={(e) => handleTagsChange(work.id, e.target.value)}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                  placeholder="Fluid Simulation, Luxury, AI Render"
                                />
                              </div>

                              {!isImage ? (
                                <>
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Custom Video Source Link (MP4 URL)</label>
                                    <input
                                      type="text"
                                      value={work.videoUrl || ""}
                                      onChange={(e) => {
                                        handleWorkChange(work.id, "videoUrl", e.target.value);
                                        handleWorkChange(work.id, "highResVideoUrl", e.target.value);
                                      }}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Choose from Video Assets</label>
                                    <select
                                      onChange={(e) => {
                                        const selectedUrl = e.target.value;
                                        if (selectedUrl) {
                                          handleWorkChange(work.id, "videoUrl", selectedUrl);
                                          handleWorkChange(work.id, "highResVideoUrl", selectedUrl);
                                        }
                                      }}
                                      value={work.videoUrl || ""}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/50 font-sans"
                                    >
                                      <option value="">-- Apply a Video Asset --</option>
                                      {mediaAssets.filter(asset => asset.type === "video").map((asset) => (
                                        <option key={asset.id} value={asset.url}>
                                          {asset.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Custom Video Thumbnail (App & Desktop)</label>
                                    <input
                                      type="text"
                                      value={work.imageUrl || ""}
                                      onChange={(e) => handleWorkChange(work.id, "imageUrl", e.target.value)}
                                      placeholder="https://cdn.jsdelivr.net/... or choose below"
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Choose from Image Assets for Thumbnail</label>
                                    <select
                                      onChange={(e) => {
                                        const selectedUrl = e.target.value;
                                        if (selectedUrl) {
                                          handleWorkChange(work.id, "imageUrl", selectedUrl);
                                        }
                                      }}
                                      value={work.imageUrl || ""}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/50 font-sans"
                                    >
                                      <option value="">-- Apply a Thumbnail Asset --</option>
                                      {mediaAssets.filter(asset => asset.type === "image").map((asset) => (
                                        <option key={asset.id} value={asset.url}>
                                          {asset.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* DUAL DRAG AND DROP UPLOADER ZONE */}
                                  <div className="md:col-span-2 space-y-3">
                                    <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Upload File (GitHub CDN)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="relative border border-dashed border-white/10 hover:border-[#ffea00]/40 rounded-xl px-4 py-2 flex flex-col gap-2 text-xs text-gray-400 transition-all">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Upload className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="truncate max-w-[120px] text-gray-300">
                                              {selectedPortfolioFiles[work.id] && !selectedPortfolioFiles[work.id].type.startsWith("image/")
                                                ? `Video: ${selectedPortfolioFiles[work.id]?.name}` 
                                                : "No video selected"}
                                            </span>
                                          </div>
                                          <div className="relative cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded text-[10px] text-white">
                                            <span>Choose Video</span>
                                            <input
                                              type="file"
                                              accept="video/*"
                                              onChange={(e) => handlePortfolioFileChange(e, work.id)}
                                              className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div className="relative border border-dashed border-white/10 hover:border-[#ffea00]/40 rounded-xl px-4 py-2 flex flex-col gap-2 text-xs text-gray-400 transition-all">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Upload className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="truncate max-w-[120px] text-gray-300">
                                              {selectedPortfolioFiles[work.id] && selectedPortfolioFiles[work.id].type.startsWith("image/")
                                                ? `Thumbnail: ${selectedPortfolioFiles[work.id]?.name}` 
                                                : "No image selected"}
                                            </span>
                                          </div>
                                          <div className="relative cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded text-[10px] text-white">
                                            <span>Choose Image</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={(e) => handlePortfolioFileChange(e, work.id)}
                                              className="absolute inset-0 opacity-0 cursor-pointer"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {selectedPortfolioFiles[work.id] && (
                                      <button
                                        type="button"
                                        onClick={() => handlePortfolioUpload(work.id)}
                                        disabled={isUploadingPortfolioId === work.id}
                                        className="w-full mt-1 bg-[#ffea00] text-black text-[10px] font-semibold py-1.5 rounded hover:bg-[#ffcc00] transition-all cursor-pointer disabled:opacity-40"
                                      >
                                        {isUploadingPortfolioId === work.id 
                                          ? "Uploading File..." 
                                          : `Upload Selected ${selectedPortfolioFiles[work.id].type.startsWith("image/") ? "Thumbnail Image" : "Video Track"}`}
                                      </button>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Custom Image URL</label>
                                    <input
                                      type="text"
                                      value={work.imageUrl || ""}
                                      onChange={(e) => handleWorkChange(work.id, "imageUrl", e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Choose from Image Assets</label>
                                    <select
                                      onChange={(e) => {
                                        const selectedUrl = e.target.value;
                                        if (selectedUrl) {
                                          handleWorkChange(work.id, "imageUrl", selectedUrl);
                                        }
                                      }}
                                      value={work.imageUrl || ""}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/50 font-sans"
                                    >
                                      <option value="">-- Apply an Image Asset --</option>
                                      {mediaAssets.filter(asset => asset.type === "image").map((asset) => (
                                        <option key={asset.id} value={asset.url}>
                                          {asset.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* DUAL DRAG AND DROP UPLOADER ZONE */}
                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Upload File (GitHub CDN)</label>
                                    <div className="relative border border-dashed border-white/10 hover:border-[#ffea00]/40 rounded-xl px-4 py-2 flex flex-col gap-2 text-xs text-gray-400 transition-all">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Upload className="w-3.5 h-3.5 text-gray-400" />
                                          <span className="truncate max-w-[200px] text-gray-300">
                                            {selectedPortfolioFiles[work.id] 
                                              ? `Selected: ${selectedPortfolioFiles[work.id]?.name}` 
                                              : "No image selected"}
                                          </span>
                                        </div>
                                        <div className="relative cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded text-[10px] text-white">
                                          <span>Choose File</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePortfolioFileChange(e, work.id)}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                          />
                                        </div>
                                      </div>
                                      
                                      {selectedPortfolioFiles[work.id] && (
                                        <button
                                          type="button"
                                          onClick={() => handlePortfolioUpload(work.id)}
                                          disabled={isUploadingPortfolioId === work.id}
                                          className="w-full mt-1 bg-[#ffea00] text-black text-[10px] font-semibold py-1.5 rounded hover:bg-[#ffcc00] transition-all cursor-pointer disabled:opacity-40"
                                        >
                                          {isUploadingPortfolioId === work.id 
                                            ? "Uploading Image..." 
                                            : "Upload Image File"}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="md:col-span-2">
                                <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Short Description / Subtext</label>
                                <textarea
                                  value={work.description || ""}
                                  onChange={(e) => handleWorkChange(work.id, "description", e.target.value)}
                                  rows={2}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white resize-none font-sans"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Grid Layout Weight (Responsive)</label>
                                <select
                                  value={work.aspectRatioClass}
                                  onChange={(e) => handleWorkChange(work.id, "aspectRatioClass", e.target.value)}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-sans"
                                >
                                  <option value="aspect-video md:col-span-2">Dynamic Wide (2 Grid Units)</option>
                                  <option value="aspect-square md:col-span-1">Perfect Square (1 Grid Unit)</option>
                                </select>
                              </div>

                              {!isImage ? (
                                <div>
                                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Duration Indicator</label>
                                  <input
                                    type="text"
                                    value={work.duration || ""}
                                    onChange={(e) => handleWorkChange(work.id, "duration", e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                                    placeholder="0:15"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Subtext / Spec Sheet Note</label>
                                  <input
                                    type="text"
                                    value={work.subtext || ""}
                                    onChange={(e) => handleWorkChange(work.id, "subtext", e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                                    placeholder="e.g. 4000x3000 PNG"
                                  />
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Custom Tab Type Selection Modal */}
                  {showAddTabModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                      <div className="bg-[#0b0b0e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <h4 className="font-display font-medium text-lg text-white mb-2">Create New Portfolio Tab</h4>
                        <p className="text-xs text-gray-400 mb-6">
                          Select the layout format for this tab. Video tabs render the fluid accordion player, and Static Image tabs render layout creatives.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <button
                            type="button"
                            onClick={() => addPortfolioTab("video")}
                            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-white/5 bg-black/40 hover:bg-white/5 hover:border-white/10 text-center transition-all group cursor-pointer"
                          >
                            <Video className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                            <div>
                              <span className="block text-xs font-semibold text-white">Video Portfolio</span>
                              <span className="block text-[10px] text-gray-500 mt-1">Accordion fluid player</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => addPortfolioTab("image")}
                            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-white/5 bg-black/40 hover:bg-white/5 hover:border-white/10 text-center transition-all group cursor-pointer"
                          >
                            <Image className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                            <div>
                              <span className="block text-xs font-semibold text-white">Static Image Portfolio</span>
                              <span className="block text-[10px] text-gray-500 mt-1">Image showcase grid</span>
                            </div>
                          </button>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowAddTabModal(false)}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white cursor-pointer transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: PRICING PACKAGES */}
              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div className="flex items-center gap-4">
                      <h2 className="font-display font-medium text-xl text-white">
                        Production Pricing packages
                      </h2>
                      
                      {/* Undo / Redo controls */}
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                        <button
                          type="button"
                          onClick={triggerPricingUndo}
                          disabled={pricingHistory.length === 0}
                          title="Undo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Undo className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={triggerPricingRedo}
                          disabled={pricingFuture.length === 0}
                          title="Redo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                        >
                          <Redo className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={savePricing}
                      disabled={saveStatus.pricing === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Sync Pricing
                    </button>
                  </div>

                  {/* DISCOUNT BADGE CONTROLS */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Sliders className="w-4 h-4 text-[#ffea00]" />
                      <h3 className="text-sm font-semibold text-gray-300 font-display">Discount Badge Color & Gradient Configuration</h3>
                    </div>
                    <p className="text-xs text-gray-400 max-w-2xl leading-relaxed font-light">
                      Customize the visual aesthetics of the pricing discount ribbon badges. Adjust gradient colors, text colors, and choose whether to apply a gradient or a solid color. Note: these settings are saved when you click "Sync Pricing" above.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Gradient Start / Solid Color (HEX)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editSettings.discount_badge_gradient_start || "#10ac84"}
                            onChange={(e) => handleSettingChange("discount_badge_gradient_start", e.target.value)}
                            placeholder="#10ac84"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                          <input
                            type="color"
                            value={editSettings.discount_badge_gradient_start && editSettings.discount_badge_gradient_start.startsWith('#') && editSettings.discount_badge_gradient_start.length === 7 ? editSettings.discount_badge_gradient_start : "#10ac84"}
                            onChange={(e) => handleSettingChange("discount_badge_gradient_start", e.target.value)}
                            className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Gradient End Color (HEX)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editSettings.discount_badge_gradient_end || "#01a3a4"}
                            onChange={(e) => handleSettingChange("discount_badge_gradient_end", e.target.value)}
                            placeholder="#01a3a4"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                          <input
                            type="color"
                            value={editSettings.discount_badge_gradient_end && editSettings.discount_badge_gradient_end.startsWith('#') && editSettings.discount_badge_gradient_end.length === 7 ? editSettings.discount_badge_gradient_end : "#01a3a4"}
                            onChange={(e) => handleSettingChange("discount_badge_gradient_end", e.target.value)}
                            className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Badge Text Color (HEX)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editSettings.discount_badge_text_color || "#ffffff"}
                            onChange={(e) => handleSettingChange("discount_badge_text_color", e.target.value)}
                            placeholder="#ffffff"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                          <input
                            type="color"
                            value={editSettings.discount_badge_text_color && editSettings.discount_badge_text_color.startsWith('#') && editSettings.discount_badge_text_color.length === 7 ? editSettings.discount_badge_text_color : "#ffffff"}
                            onChange={(e) => handleSettingChange("discount_badge_text_color", e.target.value)}
                            className="w-12 h-10 bg-black/40 border border-white/5 rounded-xl p-1 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <label className="text-xs font-mono text-gray-400 uppercase flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editSettings.discount_badge_gradient_enabled !== "false"}
                          onChange={(e) => handleSettingChange("discount_badge_gradient_enabled", e.target.checked ? "true" : "false")}
                          className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                        />
                        Enable Gradient Fill
                      </label>
                    </div>
                  </div>

                  {/* PRICING SYSTEM SETTINGS */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Sliders className="w-4 h-4 text-[#ffea00]" />
                      <h3 className="text-sm font-semibold text-gray-300 font-display">Pricing Title & Spotlight Text Size Controls</h3>
                    </div>
                    <p className="text-xs text-gray-400 max-w-2xl leading-relaxed font-light">
                      Configure the spotlight text (for recommended tier badges) and pricing table header text size independently for both AI Production and Live Action pages.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* AI Production Page settings */}
                      <div className="space-y-4 border-r border-white/5 pr-0 md:pr-6">
                        <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ffea00] uppercase">AI Production Page (Page 1) Settings</h4>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Spotlight Badge Text (e.g. Recommended, Best Value)</label>
                          <input
                            type="text"
                            value={editSettings.pricing_spotlight_text || ""}
                            onChange={(e) => handleSettingChange("pricing_spotlight_text", e.target.value)}
                            placeholder="Recommended"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Pricing Title Font Size (e.g. 3rem, 42px)</label>
                          <input
                            type="text"
                            value={editSettings.pricing_title_size || ""}
                            onChange={(e) => handleSettingChange("pricing_title_size", e.target.value)}
                            placeholder="Default (3rd/5th size)"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Pricing Section Title Text</label>
                          <input
                            type="text"
                            value={editSettings.pricing_title || ""}
                            onChange={(e) => handleSettingChange("pricing_title", e.target.value)}
                            placeholder="Production Tiers & Packages"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40"
                          />
                        </div>
                      </div>

                      {/* Live Action Page settings */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-mono font-bold tracking-widest text-[#ffea00] uppercase">Live Action Page (Page 2) Settings</h4>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Spotlight Badge Text (e.g. Recommended, Best Value)</label>
                          <input
                            type="text"
                            value={editSettings.page2_pricing_spotlight_text || ""}
                            onChange={(e) => handleSettingChange("page2_pricing_spotlight_text", e.target.value)}
                            placeholder="Recommended"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Pricing Title Font Size (e.g. 3rem, 42px)</label>
                          <input
                            type="text"
                            value={editSettings.page2_pricing_title_size || ""}
                            onChange={(e) => handleSettingChange("page2_pricing_title_size", e.target.value)}
                            placeholder="Default (3rd/5th size)"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1.5">Pricing Section Title Text</label>
                          <input
                            type="text"
                            value={editSettings.page2_pricing_title || ""}
                            onChange={(e) => handleSettingChange("page2_pricing_title", e.target.value)}
                            placeholder="Production Tiers & Packages"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/40"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="space-y-8"
                    onFocusCapture={() => recordPricingHistory()}
                  >
                    <p className="text-xs text-gray-500 font-mono italic">
                      💡 Drag package blocks using their background bounds to arrange their sequence in the website's pricing section, or use the Up/Down arrow buttons.
                    </p>

                    {editPricing.map((tier, index) => (
                      <div 
                        key={tier.id}
                        draggable="true"
                        onDragStart={(e) => {
                          recordPricingHistory();
                          e.dataTransfer.setData("text/plain", index.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverIdxPricing(index);
                        }}
                        onDragEnd={() => setDragOverIdxPricing(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceIdx = parseInt(e.dataTransfer.getData("text/plain"));
                          if (!isNaN(sourceIdx) && sourceIdx !== index) {
                            const updated = [...editPricing];
                            const [removed] = updated.splice(sourceIdx, 1);
                            updated.splice(index, 0, removed);
                            setEditPricing(updated);
                            toast.success("Pricing package sequence adjusted.");
                          }
                          setDragOverIdxPricing(null);
                        }}
                        className={`border p-6 rounded-2xl cursor-grab active:cursor-grabbing transition-all duration-300 space-y-4 ${
                          dragOverIdxPricing === index 
                            ? "bg-purple-950/25 border-purple-500/50 scale-[0.99] shadow-inner" 
                            : "bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div className="flex items-center gap-3 select-none">
                            <GripVertical className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-mono text-[#ffea00] font-semibold">Package 0{index + 1}</span>
                            <span className="w-2.5 h-2.5 rounded-full" style={{
                              backgroundColor: tier.glowTheme === "emerald" ? "#10b981" : (tier.glowTheme === "saffron" ? "#ffea00" : "#4A36B3")
                            }} />
                            <span className="font-display font-semibold text-lg text-white">{tier.name}</span>
                          </div>

                          <div className="flex items-center gap-3 select-none">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => movePricingItem(index, "up")}
                                disabled={index === 0}
                                className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => movePricingItem(index, "down")}
                                disabled={index === editPricing.length - 1}
                                className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="w-[1px] h-4 bg-white/10 mx-1" />

                            <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tier.popular}
                                onChange={(e) => handlePricingChange(tier.id, "popular", e.target.checked)}
                                className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                              />
                              Recommend Spotlight
                            </label>
                          </div>
                        </div>

                        {/* Text values */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Package Title</label>
                            <input
                              type="text"
                              value={tier.name}
                              onChange={(e) => handlePricingChange(tier.id, "name", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Package Cost</label>
                            <input
                              type="text"
                              value={tier.price}
                              onChange={(e) => handlePricingChange(tier.id, "price", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Original Price (Strikethrough)</label>
                            <input
                              type="text"
                              value={tier.originalPrice || ""}
                              onChange={(e) => handlePricingChange(tier.id, "originalPrice", e.target.value)}
                              placeholder="e.g. $2,500"
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Payment Period</label>
                            <input
                              type="text"
                              value={tier.period}
                              onChange={(e) => handlePricingChange(tier.id, "period", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                              placeholder="month, project, unique setup"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Aura Theme Accent</label>
                            <select
                              value={tier.glowTheme}
                              onChange={(e) => handlePricingChange(tier.id, "glowTheme", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            >
                              <option value="emerald">Emerald Aura (Saffron Accent)</option>
                              <option value="saffron">Golden Saffron</option>
                              <option value="violet">Cyber Violet</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <label className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tier.discountEnabled || false}
                                onChange={(e) => handlePricingChange(tier.id, "discountEnabled", e.target.checked)}
                                className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                              />
                              Enable Discount Badge
                            </label>
                          </div>

                          <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <label className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tier.is_slider_enabled || false}
                                onChange={(e) => handlePricingChange(tier.id, "is_slider_enabled", e.target.checked)}
                                className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                              />
                              Enable Milestone Slider
                            </label>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Discount Badge Text</label>
                            <input
                              type="text"
                              disabled={!tier.discountEnabled}
                              value={tier.discountText || ""}
                              onChange={(e) => handlePricingChange(tier.id, "discountText", e.target.value)}
                              placeholder="e.g. 20% OFF"
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-40"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">CTA Button Label</label>
                            <input
                              type="text"
                              value={tier.buttonLabel || ""}
                              onChange={(e) => handlePricingChange(tier.id, "buttonLabel", e.target.value)}
                              placeholder="e.g. Acquire Creative Pipeline"
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">CTA Button Accent Color</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tier.buttonColor || ""}
                                onChange={(e) => handlePricingChange(tier.id, "buttonColor", e.target.value)}
                                placeholder="e.g. #ffea00"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                              />
                              <input
                                type="color"
                                value={tier.buttonColor && tier.buttonColor.startsWith('#') && tier.buttonColor.length === 7 ? tier.buttonColor : "#ffea00"}
                                onChange={(e) => handlePricingChange(tier.id, "buttonColor", e.target.value)}
                                className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">CTA Button Text Color</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tier.buttonTextColor || ""}
                                onChange={(e) => handlePricingChange(tier.id, "buttonTextColor", e.target.value)}
                                placeholder="e.g. #000000"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                              />
                              <input
                                type="color"
                                value={tier.buttonTextColor && tier.buttonTextColor.startsWith('#') && tier.buttonTextColor.length === 7 ? tier.buttonTextColor : "#000000"}
                                onChange={(e) => handlePricingChange(tier.id, "buttonTextColor", e.target.value)}
                                className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                              />
                            </div>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Package Tagline Description</label>
                            <input
                              type="text"
                              value={tier.tagline}
                              onChange={(e) => handlePricingChange(tier.id, "tagline", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Production Speed</label>
                            <input
                              type="text"
                              value={tier.turnaround}
                              onChange={(e) => handlePricingChange(tier.id, "turnaround", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                              placeholder="5 working days"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Revision Iterations</label>
                            <input
                              type="text"
                              value={tier.revisionRound}
                              onChange={(e) => handlePricingChange(tier.id, "revisionRound", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                              placeholder="2 Rounds"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Offer / Deal Highlight Text</label>
                            <input
                              type="text"
                              value={tier.offerText || ""}
                              onChange={(e) => handlePricingChange(tier.id, "offerText", e.target.value)}
                              placeholder="e.g. SPECIAL OFFER: 20% OFF FIRST MONTH"
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Offer Text Color (HEX)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tier.offerTextColor || ""}
                                onChange={(e) => handlePricingChange(tier.id, "offerTextColor", e.target.value)}
                                placeholder="#ffffff"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                              />
                              <input
                                type="color"
                                value={tier.offerTextColor && tier.offerTextColor.startsWith('#') && tier.offerTextColor.length === 7 ? tier.offerTextColor : "#ffffff"}
                                onChange={(e) => handlePricingChange(tier.id, "offerTextColor", e.target.value)}
                                className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Offer Background Color/Gradient</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={tier.offerBgColor || ""}
                                onChange={(e) => handlePricingChange(tier.id, "offerBgColor", e.target.value)}
                                placeholder="e.g. #ffea00 or linear-gradient(...)"
                                className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                              />
                              <input
                                type="color"
                                value={tier.offerBgColor && tier.offerBgColor.startsWith('#') && tier.offerBgColor.length === 7 ? tier.offerBgColor : "#ffea00"}
                                onChange={(e) => handlePricingChange(tier.id, "offerBgColor", e.target.value)}
                                className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Offer Animation</label>
                            <select
                              value={tier.offerAnimation || "none"}
                              onChange={(e) => handlePricingChange(tier.id, "offerAnimation", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            >
                              <option value="none">None (Static)</option>
                              <option value="pulse">Pulse Glow</option>
                              <option value="shimmer">Gradient Shimmer</option>
                            </select>
                          </div>
                        </div>

                        {/* Milestone Slider Config */}
                        {tier.is_slider_enabled && (
                          <div className="space-y-3 border-t border-white/5 pt-4">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase text-gray-400">Milestone Pricing Steps</span>
                              <button
                                type="button"
                                onClick={() => addMilestone(tier.id)}
                                className="flex items-center gap-1 text-[10px] font-mono text-[#ffea00] bg-[#ffea00]/5 border border-[#ffea00]/20 px-2 py-0.5 rounded hover:bg-[#ffea00]/10 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Add milestone step
                              </button>
                            </div>

                            <div className="space-y-2">
                              {(tier.slider_milestones || []).map((milestone, mIdx) => (
                                <div key={mIdx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-black/10 border border-white/[0.03] p-2.5 rounded-xl items-end">
                                  <div>
                                    <label className="block text-[8px] font-mono uppercase text-gray-500 mb-1">Milestone Label (e.g. 10 Videos)</label>
                                    <input
                                      type="text"
                                      value={milestone.label}
                                      onChange={(e) => handleMilestonesChange(tier.id, mIdx, "label", e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                                      placeholder="e.g. 10 Videos"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[8px] font-mono uppercase text-gray-500 mb-1">Discount Rate (0 - 100%)</label>
                                    <input
                                      type="number"
                                      value={milestone.discount}
                                      onChange={(e) => handleMilestonesChange(tier.id, mIdx, "discount", parseInt(e.target.value) || 0)}
                                      className="w-full bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white"
                                      placeholder="e.g. 20"
                                      min="0"
                                      max="100"
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => deleteMilestone(tier.id, mIdx)}
                                      className="px-2.5 py-1.5 text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" /> Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(tier.slider_milestones || []).length === 0 && (
                                <p className="text-[10px] text-gray-500 italic">No milestones defined. Click "Add milestone step" above to configure.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* List Inputs (Deliverables feature lists) */}
                        <div className="space-y-2 border-t border-white/5 pt-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase text-gray-400">Deliverables Deliverable Scope</span>
                            <button
                              onClick={() => addFeature(tier.id)}
                              className="flex items-center gap-1 text-[10px] font-mono text-[#ffea00] bg-[#ffea00]/5 border border-[#ffea00]/20 px-2 py-0.5 rounded hover:bg-[#ffea00]/10"
                            >
                              <Plus className="w-3 h-3" /> Add feature scope
                            </button>
                          </div>

                          <div className="space-y-2">
                            {tier.deliverables.map((feature, featureIdx) => (
                              <div key={featureIdx} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={feature}
                                  onChange={(e) => handleFeaturesChange(tier.id, featureIdx, e.target.value)}
                                  className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white"
                                />
                                <button
                                  onClick={() => deleteFeature(tier.id, featureIdx)}
                                  className="p-2 text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-xl"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    ))}

                    {/* Pricing Tier Note Panel Customize */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4 mt-6">
                      <div className="border-b border-white/5 pb-3">
                        <span className="font-display font-semibold text-lg text-white">Pricing Note Panel Description</span>
                        <p className="text-xs text-gray-500 mt-1">
                          This copy displays below the pricing tiers grid on the main website page.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-2">Note Panel Text</label>
                        <textarea
                          rows={3}
                          value={editSettings.pricing_note_text || ""}
                          onChange={(e) => handleSettingChange("pricing_note_text", e.target.value)}
                          placeholder="e.g. All packages can be customized. Contact support for tailored SLA requirements and priority processing speeds."
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40 resize-none font-sans"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 5: GLOBAL ASSETS MANAGER */}
              {activeTab === "assets" && (
                <div className="space-y-8">
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Global Assets Library
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Upload media fragments or reference external URLs, then select which targets to populate.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setSaveStatus(prev => ({ ...prev, assets: "saving" }));
                        toast.info("Synchronizing and safeguarding assets pipeline...");
                        
                        setTimeout(async () => {
                          try {
                            if (editSettings.hero_video_bg_url) {
                              await updateSiteSetting("hero_video_bg_url", editSettings.hero_video_bg_url);
                            }
                            if (editSettings.page2_hero_video_bg_url) {
                              await updateSiteSetting("page2_hero_video_bg_url", editSettings.page2_hero_video_bg_url);
                            }
                            if (editSettings.logo_img_url) {
                              await updateSiteSetting("logo_img_url", editSettings.logo_img_url);
                            }
                            setSaveStatus(prev => ({ ...prev, assets: "saved" }));
                            toast.success("Assets synchronized safely & CDN cache updated.");
                            setTimeout(() => setSaveStatus(prev => ({ ...prev, assets: "idle" })), 2000);
                          } catch (e: any) {
                            setSaveStatus(prev => ({ ...prev, assets: "error" }));
                            toast.error("Synchronize error. Re-try in a brief moment.");
                          }
                        }, 800);
                      }}
                      disabled={saveStatus.assets === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                    >
                      {saveStatus.assets === "saving" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Synchronizing...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Synchronize Assets</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* ACTIVE CONFIGURATION ROLES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/40 border border-white/5 p-6 rounded-2xl">
                    <div>
                      <h3 className="text-xs font-mono uppercase text-[#ffea00] mb-3 tracking-wide flex items-center gap-2">
                        <Play className="w-3.5 h-3.5" /> Hero Background (Img or Video) {adminPageScope === "live" ? "(Live Action)" : "(AI Production)"}
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs truncate bg-[#11111c] border border-white/5 rounded-xl px-4 py-3 text-gray-300">
                          <span className="text-gray-500 font-mono">Active Link:</span>
                          <span className="truncate flex-1 font-mono">
                            {(adminPageScope === "live" ? siteSettings.page2_hero_video_bg_url : siteSettings.hero_video_bg_url) || "Default Glowing Fluid Video"}
                          </span>
                        </div>
                        <select
                          onChange={(e) => handleSelectAssetForSetting(e.target.value, "hero_video_bg_url")}
                          value={(adminPageScope === "live" ? siteSettings.page2_hero_video_bg_url : siteSettings.hero_video_bg_url) || ""}
                          className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/50"
                        >
                          <option value="">-- Apply an Asset --</option>
                          {mediaAssets.map((asset) => (
                            <option key={asset.id} value={asset.url}>{asset.name} ({asset.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-mono uppercase text-[#ffea00] mb-3 tracking-wide flex items-center gap-2">
                        <Compass className="w-3.5 h-3.5" /> Navbar Logo Brand Image
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs truncate bg-[#11111c] border border-white/5 rounded-xl px-4 py-3 text-gray-300">
                          <span className="text-gray-500 font-mono">Active Link:</span>
                          <span className="truncate flex-1 font-mono">{siteSettings.logo_img_url || "Default Vector Movie Icon"}</span>
                        </div>
                        <select
                          onChange={(e) => handleSelectAssetForSetting(e.target.value, "logo_img_url")}
                          value={siteSettings.logo_img_url || ""}
                          className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/50"
                        >
                          <option value="">-- Apply an Asset --</option>
                          {mediaAssets.map((asset) => (
                            <option key={asset.id} value={asset.url}>{asset.name} ({asset.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ASSET UPLOAD & ADD SECTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* DRAG & DROP / FILE SELECTION */}
                    <div className="bg-[#11111c]/60 border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-white">Upload Files to GitHub CDN</h3>
                          {isCloudinaryConfigured ? (
                            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                              ● Connected
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 font-mono bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                              ▲ Unconfigured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                          Directly upload high-resolution images or .mp4 files into the high performance GitHub CDN network.
                        </p>
                        {!isCloudinaryConfigured && (
                          <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-amber-300 text-[11px] leading-relaxed">
                            <strong>Warning:</strong> GITHUB_TOKEN not configured on server. Uploading a file will create a temporary local preview URL that won't work on other devices or after reloading.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-[#ffea00]/40 hover:bg-white/5 rounded-2xl py-6 px-4 cursor-pointer transition-all text-center">
                          <Upload className="w-6 h-6 text-gray-400 mb-2" />
                          <span className="text-xs font-medium text-white">
                            Click or Drop Asset Files
                          </span>
                          <span className="text-[10px] text-gray-500 mt-1 uppercase font-mono">Supports MP4, JPG, PNG, WEBP (Select Multiple)</span>
                          <input
                            type="file"
                            accept="image/*,video/mp4"
                            multiple
                            onChange={handleAssetFileChange}
                            className="hidden"
                          />
                        </label>

                        {/* Selected Files Queue */}
                        {selectedAssetFiles.length > 0 && (
                          <div className="space-y-2 mt-4 max-h-60 overflow-y-auto pr-1">
                            <span className="text-[10px] font-mono uppercase text-gray-400 block mb-1">Upload Queue ({selectedAssetFiles.length} files)</span>
                            {selectedAssetFiles.map((item) => (
                              <div key={item.id} className="bg-black/30 border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative">
                                <button
                                  type="button"
                                  onClick={() => removeQueueItem(item.id)}
                                  className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                  title="Remove from queue"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                
                                <div className="flex items-center gap-2 min-w-0 pr-6">
                                  <span className="text-[10px] text-gray-500 font-mono shrink-0 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                    {item.file.type.split('/')[1] || "file"}
                                  </span>
                                  <span className="text-xs font-medium text-gray-300 truncate font-mono">
                                    {(item.file.size / 1024).toFixed(1)} KB - {item.file.name}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-1">
                                  <div className="col-span-2">
                                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-0.5">Asset Name</label>
                                    <input
                                      type="text"
                                      value={item.customName}
                                      onChange={(e) => handleQueueNameChange(item.id, e.target.value)}
                                      placeholder="Asset Name"
                                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-mono text-gray-500 uppercase mb-0.5">Type</label>
                                    <select
                                      value={item.type}
                                      onChange={(e) => handleQueueTypeChange(item.id, e.target.value as "image" | "video")}
                                      className="w-full bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white"
                                    >
                                      <option value="image">Image</option>
                                      <option value="video">Video</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={handleAssetUpload}
                              disabled={isUploadingAsset}
                              className="w-full mt-2 py-2.5 bg-[#ffea00] text-black text-xs font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer disabled:opacity-40"
                            >
                              {isUploadingAsset ? "Uploading Queue to GitHub CDN..." : `Upload ${selectedAssetFiles.length} Assets to GitHub CDN`}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MANUALLY ADD URL */}
                    <div className="bg-[#11111c]/60 border border-white/5 rounded-2xl p-6 space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-2">Link External Stream URLs</h3>
                        <p className="text-xs text-gray-500 leading-relaxed font-light">
                          Reference external files hosted online (like Unsplash background layout keys or direct CDN links).
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Asset Meta Name</label>
                          <input
                            type="text"
                            value={newAssetName}
                            onChange={(e) => setNewAssetName(e.target.value)}
                            placeholder="e.g. Cyberpunk Grid Layout"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Direct Resource URL</label>
                          <input
                            type="text"
                            value={newAssetUrl}
                            onChange={(e) => setNewAssetUrl(e.target.value)}
                            placeholder="https://images.unsplash.com/photo-..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Asset Type</label>
                            <select
                              value={newAssetType}
                              onChange={(e) => setNewAssetType(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                            >
                              <option value="image">Image Format</option>
                              <option value="video">MP4 Video Format</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={handleAddCustomAsset}
                              disabled={!newAssetUrl || !newAssetName}
                              className="w-full py-2 bg-[#ffea00] text-black text-xs font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer disabled:opacity-40"
                            >
                              Add Asset URL
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DECLARED ASSETS LIBRARY GRID - CATEGORIZED & COLLAPSIBLE */}
                  <div className="bg-[#11111c]/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => setIsAssetLibraryExpanded(!isAssetLibraryExpanded)}
                      className="w-full flex items-center justify-between p-4 bg-[#11111c]/80 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#ffea00]" />
                        <span className="text-xs font-mono uppercase text-gray-200 tracking-wider font-bold">
                          Assets Collection Library ({mediaAssets.filter(item => {
                            if (assetTabFilter === "image") return item.type === "image";
                            if (assetTabFilter === "video") return item.type === "video";
                            return true;
                          }).length} of {mediaAssets.length} items)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAssetLibraryExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isAssetLibraryExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-4">
                            {/* Filters Tab Row */}
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 p-1 bg-black/45 border border-white/5 rounded-xl w-fit">
                                  {(["all", "image", "video"] as const).map((filter) => (
                                    <button
                                      key={filter}
                                      type="button"
                                      onClick={() => setAssetTabFilter(filter)}
                                      className={`px-3.5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider font-bold transition-all cursor-pointer ${
                                        assetTabFilter === filter
                                          ? "bg-[#ffea00] text-black shadow-lg shadow-[#ffea00]/10"
                                          : "text-gray-400 hover:text-white hover:bg-white/5"
                                      }`}
                                    >
                                      {filter === "all" ? "All Formats" : filter === "image" ? "Images Only" : "Videos Only"}
                                    </button>
                                  ))}
                                </div>

                                {/* Selection actions / Toggle select all */}
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const visibleAssetIds = mediaAssets.filter(item => {
                                        if (assetTabFilter === "image") return item.type === "image";
                                        if (assetTabFilter === "video") return item.type === "video";
                                        return true;
                                      }).map(item => item.id);
                                      
                                      const allSelected = visibleAssetIds.every(id => selectedAssetIds.includes(id));
                                      if (allSelected) {
                                        setSelectedAssetIds(prev => prev.filter(id => !visibleAssetIds.includes(id)));
                                      } else {
                                        setSelectedAssetIds(prev => Array.from(new Set([...prev, ...visibleAssetIds])));
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-all"
                                  >
                                    {mediaAssets.filter(item => {
                                      if (assetTabFilter === "image") return item.type === "image";
                                      if (assetTabFilter === "video") return item.type === "video";
                                      return true;
                                    }).every(item => selectedAssetIds.includes(item.id)) ? "Deselect All" : "Select All Visible"}
                                  </button>
                                </div>
                              </div>

                              {/* BULK ACTION PANEL */}
                              {selectedAssetIds.length > 0 && (
                                <div className="bg-[#11111c] border border-[#ffea00]/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2 font-mono text-gray-300">
                                    <span className="w-2 h-2 rounded-full bg-[#ffea00] animate-pulse"></span>
                                    <span>Selected <strong>{selectedAssetIds.length}</strong> asset(s)</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleBulkAction(e.target.value);
                                          e.target.value = ""; // Reset
                                        }
                                      }}
                                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#ffea00]"
                                    >
                                      <option value="">-- Choose Bulk Action / Assignment --</option>
                                      <optgroup label="Portfolio Manager">
                                        <option value="portfolio_create_individual">Create New Portfolio Cards (one per asset)</option>
                                      </optgroup>
                                      <optgroup label="Navigation Menu">
                                        <option value="navigation_add">Add Selected to Navigation Menu links</option>
                                      </optgroup>
                                      <optgroup label="Global Copy & Media Settings">
                                        <option value="setting_assign_hero_video_bg_url">Assign first asset to Hero Video Background</option>
                                        <option value="setting_assign_logo_img_url">Assign first asset to Navbar Logo Image</option>
                                      </optgroup>
                                      <optgroup label="Brand Logos Marquee">
                                        <option value="brand_logos_add">Add selected image(s) to Brand Logos Marquee</option>
                                      </optgroup>
                                      <optgroup label="Danger Zone">
                                        <option value="delete_selected">Delete selected assets from Library</option>
                                      </optgroup>
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() => setSelectedAssetIds([])}
                                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-all cursor-pointer font-sans"
                                    >
                                      Cancel Selection
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Files Grid */}
                            {mediaAssets.filter(item => {
                              if (assetTabFilter === "image") return item.type === "image";
                              if (assetTabFilter === "video") return item.type === "video";
                              return true;
                            }).length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {mediaAssets
                                  .filter(item => {
                                    if (assetTabFilter === "image") return item.type === "image";
                                    if (assetTabFilter === "video") return item.type === "video";
                                    return true;
                                  })
                                  .map((item) => (
                                    <div 
                                      key={item.id}
                                      className={`bg-black/30 border rounded-2xl p-4 flex gap-3 items-center justify-between transition-all duration-300 ${
                                        selectedAssetIds.includes(item.id) 
                                          ? "border-[#ffea00]/40 bg-white/[0.02] shadow-[0_0_15px_rgba(255,234,0,0.03)]" 
                                          : "border-white/5 hover:border-white/10"
                                      }`}
                                    >
                                      {/* SELECTION CHECKBOX */}
                                      <input
                                        type="checkbox"
                                        checked={selectedAssetIds.includes(item.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedAssetIds(prev => [...prev, item.id]);
                                          } else {
                                            setSelectedAssetIds(prev => prev.filter(id => id !== item.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded border-white/15 bg-black/40 text-[#ffea00] focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0 transition-colors"
                                      />

                                      {/* THUMBNAIL PREVIEW & META */}
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-12 h-12 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                          {item.type === "video" ? (
                                            <Play className="w-4 h-4 text-gray-500 font-bold" />
                                          ) : (
                                            <img 
                                              src={item.url} 
                                              alt="Thumb" 
                                              className="w-full h-full object-cover" 
                                              referrerPolicy="no-referrer" 
                                              onError={(e) => { 
                                                (e.target as any).src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=40&q=40";
                                              }} 
                                            />
                                          )}
                                        </div>

                                        <div className="min-w-0 flex-1 font-sans">
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                                            {item.url.startsWith("blob:") && (
                                              <span className="text-[8px] uppercase tracking-wider font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                                                Temp Preview
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[9px] font-mono text-gray-500 uppercase truncate mt-0.5">{item.type} • {item.url}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                        <button
                                          onClick={() => handleSelectAssetForSetting(item.url, "hero_video_bg_url")}
                                          className="text-[9px] font-sans font-medium px-2 py-1 rounded bg-[#ffea00]/5 text-[#ffea00] border border-[#ffea00]/15 hover:bg-[#ffea00]/20 cursor-pointer"
                                          title="Set as Hero Background Video / Image"
                                        >
                                          Background
                                        </button>
                                        <button
                                          onClick={() => handleSelectAssetForSetting(item.url, "logo_img_url")}
                                          className="text-[9px] font-sans font-medium px-2 py-1 rounded bg-[#ffea00]/5 text-[#ffea00] border border-[#ffea00]/15 hover:bg-[#ffea00]/20 cursor-pointer"
                                          title="Set as Navbar Logo Image"
                                        >
                                          Logo
                                        </button>
                                        <button
                                          onClick={() => handleDeleteAsset(item.id)}
                                          className="p-1 px-1.5 text-red-500 hover:text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-400/10 rounded cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center border border-white/5 rounded-2xl bg-black/20 h-28 text-gray-500 font-mono text-xs tracking-wide">
                                No media assets found matching the selected type filter.
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* TAB 6: CREATIVE INTAKE SUBMISSIONS */}
              {activeTab === "submissions" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Creative Intake Submissions
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Review high fidelity inquiries, manage pipeline progress, and invoke Gemini AI to generate conceptual orchestration analysis.
                      </p>
                    </div>
                    <span className="text-xs text-purple-400 font-mono bg-purple-500/5 border border-purple-500/20 px-3 py-1.5 rounded-xl">
                      Axiom Engine Online
                    </span>
                  </div>

                  {submissionsList.length === 0 ? (
                    <div className="text-center py-12 bg-black/20 border border-white/5 rounded-2xl p-8">
                      <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <h3 className="text-sm font-semibold text-white">No entries registered yet</h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto leading-relaxed font-light">
                        Inbound client brief configurations from the booking portal will organize instantly under this registry block.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {submissionsList.map((sub, sIdx) => (
                        <div 
                          key={sub.id || sIdx}
                          className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-5 hover:border-white/10 transition-all duration-300 pointer-events-auto"
                        >
                          {/* Client Detail Ribbon */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-display font-bold text-base text-white">{sub.fullName || sub.name}</h3>
                                {sub.company && (
                                  <span className="text-[10px] font-mono text-[#ffea00] bg-[#ffea00]/5 border border-[#ffea00]/15 px-2 py-0.5 rounded-lg">
                                    {sub.company}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-gray-500 mt-0.5">{sub.email} • {sub.createdAt || sub.created_at || sub.submitted_at ? new Date(sub.createdAt || sub.created_at || sub.submitted_at).toLocaleString() : "Date Unknown"}</p>
                            </div>

                            {/* Status Updater */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono uppercase text-gray-500">Pipeline:</span>
                              <select
                                value={sub.status || "Pending"}
                                onChange={(e) => updateSubmissionStatus(sub.id, e.target.value)}
                                className="bg-[#11111c] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-[#ffea00] focus:outline-none"
                              >
                                <option value="Pending">Pending Audit</option>
                                <option value="Reviewed">Under Review</option>
                                <option value="In Dialogue">In Dialogue</option>
                                <option value="Project Active">Project Active</option>
                                <option value="Discarded">Archived</option>
                              </select>

                              <button
                                onClick={() => deleteSubmission(sub.id)}
                                className="p-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-100 hover:text-red-300 cursor-pointer"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Details Content Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-2">
                              <h4 className="text-[10px] font-mono uppercase text-gray-500">Project Brief Synopsis</h4>
                              <div className="bg-[#11111c]/50 border border-white/5 p-4 rounded-xl text-xs md:text-sm text-gray-300 leading-relaxed max-h-[160px] overflow-y-auto whitespace-pre-wrap font-light">
                                {sub.brief}
                              </div>
                            </div>

                            <div className="space-y-4">
                              {/* Selected Package Info */}
                              <div className="space-y-1 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                                <h4 className="text-[10px] font-mono uppercase text-gray-500">Selected package rate</h4>
                                <p className="text-xs font-semibold text-white mt-0.5">{sub.selectedTier || "Custom Inquiring / Discovery"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: REAL-TIME ANALYTICS REPORT BOARD */}
              {activeTab === "analytics" && (
                <AnalyticsDashboard />
              )}

              {/* TAB 8: CUSTOM INTAKE FORM CONFIGURATION */}
              {activeTab === "intake_form" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Ingestion Form Customization
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Configure the layout, styling, and schema fields of the creative intake submission form.
                      </p>
                    </div>
                    <button
                      onClick={saveIntakeFormSettings}
                      disabled={saveStatus.intake_form === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer shrink-0 ml-auto sm:ml-0"
                    >
                      {saveStatus.intake_form === "saving" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Synchronize fields
                        </>
                      )}
                    </button>
                  </div>

                  {/* FORM TEXTS & HERO SETUP */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <span className="font-display font-semibold text-sm text-white uppercase tracking-wider">Form Copy & Call-To-Action</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Form Main Title</label>
                        <input
                          type="text"
                          value={getSettingValueScoped("booking_form_title", "Book Creative Studio")}
                          onChange={(e) => handleSettingChangeScoped("booking_form_title", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Form CTA Button Text</label>
                        <input
                          type="text"
                          value={getSettingValueScoped("booking_cta_text", "Request Synthesis Pipeline")}
                          onChange={(e) => handleSettingChangeScoped("booking_cta_text", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Form Subtitle Description</label>
                        <textarea
                          rows={2}
                          value={getSettingValueScoped("booking_form_subtitle")}
                          onChange={(e) => handleSettingChangeScoped("booking_form_subtitle", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Form CTA Accent Color</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={getSettingValueScoped("booking_cta_color")}
                            onChange={(e) => handleSettingChangeScoped("booking_cta_color", e.target.value)}
                            placeholder="e.g. #7a5ce0 (defaults to gradient)"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                          <input
                            type="color"
                            value={getSettingValueScoped("booking_cta_color") && getSettingValueScoped("booking_cta_color").startsWith('#') && getSettingValueScoped("booking_cta_color").length === 7 ? getSettingValueScoped("booking_cta_color") : "#7a5ce0"}
                            onChange={(e) => handleSettingChangeScoped("booking_cta_color", e.target.value)}
                            className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Form CTA Text Color</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={getSettingValueScoped("booking_cta_text_color")}
                            onChange={(e) => handleSettingChangeScoped("booking_cta_text_color", e.target.value)}
                            placeholder="e.g. #FFFFFF"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                          <input
                            type="color"
                            value={getSettingValueScoped("booking_cta_text_color") && getSettingValueScoped("booking_cta_text_color").startsWith('#') && getSettingValueScoped("booking_cta_text_color").length === 7 ? getSettingValueScoped("booking_cta_text_color") : "#FFFFFF"}
                            onChange={(e) => handleSettingChangeScoped("booking_cta_text_color", e.target.value)}
                            className="w-8 h-8 bg-black/40 border border-white/5 rounded-lg p-0.5 cursor-pointer shrink-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTIVE FORM FIELDS LIST */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <span className="font-display font-semibold text-sm text-white uppercase tracking-wider">Dynamic Fields Ingestion Schema</span>
                      <p className="text-gray-500 text-[10px] mt-0.5">
                        Core fields cannot be deleted or converted to different types, but labels, options, and placeholders can be fully customized.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {getIntakeFields().map((field: any, index: number) => {
                        const isCore = isCoreField(field.id);
                        const isEditing = editingFieldId === field.id;

                        return (
                          <div
                            key={field.id}
                            className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3 transition-all hover:border-white/10"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white font-sans">{field.label}</span>
                                  {field.required && (
                                    <span className="text-[8px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">
                                      Required
                                    </span>
                                  )}
                                  {isCore ? (
                                    <span className="text-[8px] font-mono bg-[#ffea00]/10 text-[#ffea00] border border-[#ffea00]/20 px-1.5 py-0.5 rounded">
                                      Core Ingestion ID: {field.id}
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded">
                                      Custom Ingestion ID: {field.id}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono uppercase mt-1">
                                  Type: {field.type} {field.placeholder ? `• Placeholder: "${field.placeholder}"` : ""}
                                </p>
                                {field.type === "select" && field.options && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {field.options.map((opt: string) => (
                                      <span key={opt} className="text-[9px] bg-white/5 border border-white/10 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {/* Order buttons */}
                                <button
                                  type="button"
                                  onClick={() => handleMoveIntakeField(index, "up")}
                                  disabled={index === 0}
                                  className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                                  title="Move Field Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveIntakeField(index, "down")}
                                  disabled={index === getIntakeFields().length - 1}
                                  className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                                  title="Move Field Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditField(field)}
                                  className="p-1.5 text-[#ffea00] hover:text-[#ffcc00] bg-[#ffea00]/5 border border-[#ffea00]/15 rounded-lg hover:bg-[#ffea00]/10 transition-all cursor-pointer"
                                  title="Edit Field Configuration"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIntakeField(field.id)}
                                  disabled={isCore}
                                  className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                                  title={isCore ? "Core fields cannot be deleted" : "Delete Field"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Inline edit details block */}
                            {isEditing && (
                              <div className="bg-black/50 border border-amber-500/20 rounded-lg p-4 space-y-3 mt-2 animate-fadeIn">
                                <div className="text-[10px] font-mono text-[#ffea00] uppercase border-b border-white/5 pb-1">
                                  Modify Field Configuration
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[9px] font-mono uppercase text-gray-400 mb-1">Field Label / Title</label>
                                    <input
                                      type="text"
                                      value={editFieldLabel}
                                      onChange={(e) => setEditFieldLabel(e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-mono uppercase text-gray-400 mb-1">Placeholder Text</label>
                                    <input
                                      type="text"
                                      value={editFieldPlaceholder}
                                      onChange={(e) => setEditFieldPlaceholder(e.target.value)}
                                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40"
                                    />
                                  </div>

                                  {field.type === "select" && (
                                    <div className="md:col-span-2">
                                      <label className="block text-[9px] font-mono uppercase text-gray-400 mb-1">
                                        Options List (Comma-separated)
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={editFieldOptionsText}
                                        onChange={(e) => setEditFieldOptionsText(e.target.value)}
                                        placeholder="e.g. Option A, Option B, Option C"
                                        className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/40 resize-none font-sans"
                                      />
                                    </div>
                                  )}

                                  <div className="flex items-center gap-2 mt-2">
                                    <label className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={editFieldRequired}
                                        onChange={(e) => setEditFieldRequired(e.target.checked)}
                                        className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                                      />
                                      Required Field
                                    </label>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingFieldId(null)}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-[10px] hover:text-white transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditField(field.id)}
                                    className="px-3 py-1.5 bg-amber-500 text-black font-semibold rounded-lg text-[10px] hover:bg-amber-400 transition-all cursor-pointer"
                                  >
                                    Apply Changes
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ADD CUSTOM FIELD COMPONENT */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <span className="font-display font-semibold text-sm text-white uppercase tracking-wider">Add Custom Ingestion Field</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Field Label / Title</label>
                        <input
                          type="text"
                          value={newFieldLabel}
                          onChange={(e) => setNewFieldLabel(e.target.value)}
                          placeholder="e.g. Targeted Release Platform"
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Field Type</label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value as any)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 cursor-pointer"
                          style={{ colorScheme: "dark" }}
                        >
                          <option value="text">Text Input (single line)</option>
                          <option value="email">Email Input</option>
                          <option value="textarea">Textarea (multiple lines)</option>
                          <option value="select">Dropdown Select Menu</option>
                          <option value="phone">Mobile Number with Country Selector</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Placeholder Copy</label>
                        <input
                          type="text"
                          value={newFieldPlaceholder}
                          onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                          placeholder="e.g. YouTube, TikTok, Instagram..."
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40"
                        />
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-[10px] font-mono text-gray-400 uppercase flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                            className="rounded border-white/10 text-[#ffea00] focus:ring-0 bg-transparent"
                          />
                          Make Field Required
                        </label>
                      </div>

                      {newFieldType === "select" && (
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">
                            Selection Options (Comma-separated)
                          </label>
                          <textarea
                            rows={2}
                            value={newFieldOptionsText}
                            onChange={(e) => setNewFieldOptionsText(e.target.value)}
                            placeholder="e.g. YouTube, TikTok, Cinema Screen, Interactive App"
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ffea00]/40 resize-none font-sans"
                          />
                        </div>
                      )}

                      <div className="md:col-span-2 pt-2">
                        <button
                          type="button"
                          onClick={handleAddIntakeField}
                          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer ml-auto"
                        >
                          <PlusCircle className="w-4 h-4" /> Add Field to Staging
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: BRAND LOGOS MANAGER */}
              {activeTab === "brand_logos" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Brand Logos Management
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Upload and manage client/brand logos displayed in the infinite horizontal marquee.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addBrandLogo}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Logo
                      </button>
                      <button
                        onClick={saveBrandLogos}
                        disabled={saveStatus.brand_logos === "saving"}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer shrink-0"
                      >
                        {saveStatus.brand_logos === "saving" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> Synchronize logos
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Logos Section Configuration block */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="border-b border-white/5 pb-3">
                      <span className="font-display font-semibold text-sm text-white uppercase tracking-wider">Global Logos Section Config</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Section Title Text</label>
                        <input
                          type="text"
                          value={getSettingValueScoped("brand_logos_title")}
                          onChange={(e) => handleSettingChangeScoped("brand_logos_title", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40"
                          placeholder={adminPageScope === "ai" ? "Trusted By Leading Brands" : "Trusted By Industry Leaders"}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Title Font Size Class</label>
                        <select
                          value={getSettingValueScoped("brand_logos_title_size", "text-xs")}
                          onChange={(e) => handleSettingChangeScoped("brand_logos_title_size", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ffea00]/40"
                        >
                          <option value="text-xs">text-xs (Extra Small)</option>
                          <option value="text-sm">text-sm (Small)</option>
                          <option value="text-base">text-base (Regular)</option>
                          <option value="text-lg">text-lg (Large)</option>
                          <option value="text-xl">text-xl (Extra Large)</option>
                          <option value="text-2xl">text-2xl (2XL)</option>
                          <option value="text-3xl">text-3xl (3XL)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-6 border-t border-white/5 pt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 font-mono uppercase tracking-wider">Marquee Motion:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSettingChangeScoped("brand_logos_marquee_enabled", "true")}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              getSettingValueScoped("brand_logos_marquee_enabled", "true") === "true"
                                ? "bg-[#ffea00] text-black border-[#ffea00]"
                                : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                            }`}
                          >
                            Enabled
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSettingChangeScoped("brand_logos_marquee_enabled", "false")}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              getSettingValueScoped("brand_logos_marquee_enabled", "true") === "false"
                                ? "bg-[#ffea00] text-black border-[#ffea00]"
                                : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                            }`}
                          >
                            Disabled (Center Static)
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 font-mono uppercase tracking-wider">Marquee Flow Direction:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateSiteSetting("marquee_direction", "left")}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              siteSettings.marquee_direction === "left"
                                ? "bg-[#ffea00] text-black border-[#ffea00]"
                                : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                            }`}
                          >
                            Scroll Left
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSiteSetting("marquee_direction", "right")}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              siteSettings.marquee_direction === "right"
                                ? "bg-[#ffea00] text-black border-[#ffea00]"
                                : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                            }`}
                          >
                            Scroll Right
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Brand Logos List */}
                  <div className="space-y-4">
                    {editLogos.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-gray-500 text-sm">No brand logos configured yet. Click "Add Logo" to start.</p>
                      </div>
                    ) : (
                      editLogos.map((logo, index) => (
                        <div
                          key={logo.id}
                          className="bg-black/30 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4 hover:border-white/10 transition-all"
                        >
                          {/* Image preview box */}
                          <div className="w-24 h-16 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {logo.url ? (
                              <img
                                src={logo.url}
                                alt={logo.name || "Brand logo preview"}
                                className="w-full h-full object-contain p-2"
                              />
                            ) : (
                              <Image className="w-6 h-6 text-gray-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-3 w-full">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Brand/Client Name</label>
                                <input
                                  type="text"
                                  value={logo.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditLogos(prev => prev.map(l => l.id === logo.id ? { ...l, name: val } : l));
                                  }}
                                  className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                  placeholder="e.g. Acme Corp"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Logo Image URL</label>
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={logo.url}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setEditLogos(prev => prev.map(l => l.id === logo.id ? { ...l, url: val } : l));
                                      }}
                                      className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                      placeholder="Direct logo link"
                                    />
                                    
                                    {/* File Upload Trigger */}
                                    <div className="relative shrink-0">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleBrandLogoFileChange(e, logo.id)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                      />
                                      <button
                                        type="button"
                                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all flex items-center gap-1 cursor-pointer h-full"
                                      >
                                        <Upload className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Select from assets dropdown */}
                                  <select
                                    value={logo.url || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditLogos(prev => prev.map(l => l.id === logo.id ? { ...l, url: val } : l));
                                    }}
                                    className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#ffea00]/50 font-sans"
                                  >
                                    <option value="">-- Or Select from Assets Library --</option>
                                    {mediaAssets.filter(asset => asset.type === "image").map((asset) => (
                                      <option key={asset.id} value={asset.url}>
                                        {asset.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Show selected file name and upload button if present */}
                            {selectedBrandLogoFiles[logo.id] && (
                              <div className="flex items-center justify-between bg-purple-950/20 border border-purple-500/20 px-3 py-2 rounded-xl text-xs">
                                <span className="text-gray-300 truncate max-w-xs">
                                  Selected: {selectedBrandLogoFiles[logo.id]?.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleBrandLogoUpload(logo.id)}
                                  disabled={isUploadingBrandLogoId === logo.id}
                                  className="flex items-center gap-1 px-3 py-1 bg-[#ffea00] text-black font-semibold rounded-lg hover:bg-[#ffcc00] transition-all cursor-pointer"
                                >
                                  {isUploadingBrandLogoId === logo.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                                    </>
                                  ) : (
                                    <>Upload to CDN</>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Control arrows/delete */}
                          <div className="flex items-center gap-1 shrink-0 ml-auto md:ml-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => moveBrandLogo(index, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBrandLogo(index, "down")}
                              disabled={index === editLogos.length - 1}
                              className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteBrandLogo(logo.id)}
                              className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 10: TESTIMONIALS MANAGER */}
              {activeTab === "testimonials" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Testimonials Management
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Add, edit, and arrange customer reviews and video testimonials.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addTestimonial}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Testimonial
                      </button>
                      <button
                        onClick={saveTestimonials}
                        disabled={saveStatus.testimonials === "saving"}
                        className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer shrink-0"
                      >
                        {saveStatus.testimonials === "saving" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" /> Synchronize testimonials
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Testimonials List */}
                  <div className="space-y-4">
                    {editTestimonials.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-gray-500 text-sm">No testimonials configured yet. Click "Add Testimonial" to start.</p>
                      </div>
                    ) : (
                      editTestimonials.map((testimonial, index) => (
                        <div
                          key={testimonial.id}
                          className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-white/10 transition-all"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                            <span className="font-mono text-xs text-[#ffea00] uppercase tracking-wider">
                              Testimonial Slot #{index + 1}
                            </span>
                            
                            <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                              <button
                                type="button"
                                onClick={() => moveTestimonial(index, "up")}
                                disabled={index === 0}
                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTestimonial(index, "down")}
                                disabled={index === editTestimonials.length - 1}
                                className="p-1.5 text-gray-400 hover:text-white bg-white/5 border border-white/5 rounded-lg disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTestimonial(testimonial.id)}
                                className="p-1.5 text-red-500 hover:text-red-400 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Client/Author Name</label>
                              <input
                                type="text"
                                value={testimonial.client_name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, client_name: val } : t));
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                placeholder="e.g. John Doe"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Role / Position</label>
                              <input
                                type="text"
                                value={testimonial.role}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, role: val } : t));
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                placeholder="e.g. Founder & CEO"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Company / Studio</label>
                              <input
                                type="text"
                                value={testimonial.company}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, company: val } : t));
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                placeholder="e.g. Acme Corp"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Quote Text Content</label>
                              <textarea
                                rows={3}
                                value={testimonial.text}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, text: val } : t));
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none"
                                placeholder="What the client said about their rendering schedule..."
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Rating Stars (1 to 5)</label>
                              <select
                                value={testimonial.rating}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, rating: val } : t));
                                }}
                                className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer"
                                style={{ colorScheme: "dark" }}
                              >
                                <option value="5">5 Stars</option>
                                <option value="4.5">4.5 Stars</option>
                                <option value="4">4 Stars</option>
                                <option value="3">3 Stars</option>
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[9px] font-mono uppercase text-gray-500 mb-1">Optional Video Testimonial URL</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={testimonial.video_url}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditTestimonials(prev => prev.map(t => t.id === testimonial.id ? { ...t, video_url: val } : t));
                                  }}
                                  className="w-full bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                  placeholder="Direct MP4 video URL"
                                />

                                {/* File Upload Trigger */}
                                <div className="relative shrink-0">
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => handleTestimonialFileChange(e, testimonial.id)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                  />
                                  <button
                                    type="button"
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 hover:text-white transition-all flex items-center gap-1 cursor-pointer h-full"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Show selected file name and upload button if present */}
                          {selectedTestimonialFiles[testimonial.id] && (
                            <div className="flex items-center justify-between bg-purple-950/20 border border-purple-500/20 px-3 py-2 rounded-xl text-xs">
                              <span className="text-gray-300 truncate max-w-xs">
                                Selected: {selectedTestimonialFiles[testimonial.id]?.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleTestimonialUpload(testimonial.id)}
                                disabled={isUploadingTestimonialId === testimonial.id}
                                className="flex items-center gap-1 px-3 py-1 bg-[#ffea00] text-black font-semibold rounded-lg hover:bg-[#ffcc00] transition-all cursor-pointer"
                              >
                                {isUploadingTestimonialId === testimonial.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading...
                                  </>
                                ) : (
                                  <>Upload Video to CDN</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 11: LIVE CHATS HUMAN TAKEOVER CONSOLE */}
              {activeTab === "live_chats" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display font-medium text-xl text-white">
                      Live Customer Support Console
                    </h2>
                    <p className="text-gray-500 text-xs mt-1">
                      Monitor active client sessions, check historical interactions, toggle manual takeover, and reply directly as a producer.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* SESSIONS LIST */}
                    <div className="lg:col-span-1 space-y-3">
                      <h3 className="font-display font-medium text-sm text-gray-300 uppercase tracking-wider text-left">
                        Sessions ({chatSessions.length})
                      </h3>
                      
                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {chatSessionsLoading ? (
                          <div className="flex items-center justify-center py-12 text-gray-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            <span className="text-xs font-mono">Loading sessions...</span>
                          </div>
                        ) : chatSessions.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs font-sans">
                            No active chat sessions found.
                          </div>
                        ) : (
                          chatSessions.map((session) => {
                            const isSelected = selectedSessionId === session.id;
                            const formattedTime = new Date(session.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            const clientName = session.chat_users?.name || "Anonymous Client";
                            const clientID = session.id;
                            return (
                              <div
                                key={session.id}
                                onClick={() => setSelectedSessionId(session.id)}
                                className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 border text-left ${
                                  isSelected
                                    ? "bg-accent/15 border-accent shadow-[0_0_15px_rgba(var(--color-accent-rgb-custom),0.15)]"
                                    : "bg-white/[0.02] border-white/10 hover:bg-white/5"
                                }`}
                              >
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                  <div className="flex flex-col min-w-0">
                                    <span className={`text-xs font-bold truncate ${isSelected ? "text-accent" : "text-white"}`}>
                                      {clientName}
                                    </span>
                                    <span className="text-[9px] font-mono text-gray-500 truncate mt-0.5">
                                      ID: {clientID}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono text-gray-500 shrink-0 uppercase mt-0.5">
                                    {formattedTime}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400 truncate line-clamp-1 mb-2">
                                  {session.last_message_text || "Attachment or empty message"}
                                </p>
                                <div className="flex justify-between items-center">
                                  {session.unread_count > 0 && (
                                    <span className="w-5 h-5 rounded-full bg-red-500 text-white font-mono text-[9px] font-bold flex items-center justify-center border border-black shadow ml-auto animate-pulse">
                                      {session.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* MESSAGES VIEWPORT */}
                    <div className="lg:col-span-2 flex flex-col min-h-[400px]">
                      {selectedSessionId ? (
                        <>
                          {/* Chat Session Header */}
                          {(() => {
                            const activeSess = chatSessions.find(s => s.id === selectedSessionId);
                            if (!activeSess) return null;
                            const u = activeSess.chat_users;
                            return (
                              <div className="space-y-0">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white/[0.02] border border-white/10 rounded-t-2xl p-4 gap-4">
                                  <div className="text-left">
                                    <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                                      {u?.name || "Anonymous Client"}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                      Session ID: {activeSess.id}
                                    </p>
                                    <p className="text-[9px] text-gray-500 font-sans mt-0.5">
                                      Created: {new Date(activeSess.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                {/* Lead Information Grid Panel */}
                                <div className="bg-black/35 border-x border-white/10 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans text-left text-gray-300 border-b">
                                  <div className="space-y-1">
                                    <h5 className="text-[9px] font-mono uppercase text-gray-500">Contact Details</h5>
                                    <p className="text-white font-medium">{u?.name || "N/A"}</p>
                                    <p className="text-gray-400">{u?.email || activeSess.email || "N/A"}</p>
                                    <p className="text-gray-400">{u?.phone || "N/A"}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <h5 className="text-[9px] font-mono uppercase text-gray-500 font-semibold">Intake Info</h5>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      <div>
                                        <span className="text-gray-500 text-[8px] block">Pipeline Type</span>
                                        <span className="text-accent uppercase font-mono text-[9px] font-bold">
                                          {activeSess.production_type || "bot flow incomplete"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 text-[8px] block">Grade/Tier</span>
                                        <span className="text-white uppercase font-mono text-[9px] font-semibold">
                                          {activeSess.production_grade || "N/A"}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 text-[8px] block">Est. Budget</span>
                                        <span className="text-emerald-400 font-mono text-[9px] font-medium">
                                          {activeSess.budget || "N/A"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {activeSess.requirements_brief && (
                                    <div className="md:col-span-2 space-y-1 bg-white/[0.02] border border-white/5 p-2 rounded-lg mt-1">
                                      <h5 className="text-[9px] font-mono uppercase text-gray-500">Intake Requirements Brief</h5>
                                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed italic">{activeSess.requirements_brief}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Message List viewport */}
                          <div className="flex-1 min-h-[300px] max-h-[360px] overflow-y-auto p-4 bg-black/40 border-x border-b border-white/10 space-y-4">
                            {chatMessages.length === 0 ? (
                              <div className="flex items-center justify-center h-full text-gray-500 text-xs font-mono">
                                No messages in this session.
                              </div>
                            ) : (
                              chatMessages.map((msg) => {
                                const isUser = msg.sender === "user";
                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex flex-col ${isUser ? "items-start" : "items-end"}`}
                                  >
                                    <div
                                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed text-white relative border border-white/5 shadow-md text-left ${
                                        isUser
                                          ? "bg-white/[0.04]"
                                          : msg.sender === "admin"
                                          ? "bg-accent/15 border-accent/25"
                                          : msg.sender === "bot"
                                          ? "bg-white/[0.02] border-dashed border-white/10"
                                          : "bg-purple-950/20 border-purple-500/25"
                                      }`}
                                    >
                                      {msg.media_url && (
                                        <div className="mb-2 max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                          <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                                            <img src={msg.media_url} alt="Attached Media" className="w-full h-auto object-cover max-h-40 hover:opacity-80 transition-opacity" />
                                          </a>
                                        </div>
                                      )}
                                      <span className="whitespace-pre-wrap">{msg.text}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 pl-1 pr-1">
                                      <span className="text-[8px] font-mono text-gray-500 uppercase">
                                        {isUser ? "Client" : msg.sender === "admin" ? "You (Producer)" : "Assistant"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {msg.sender === "admin" && (
                                        msg.status === "read" ? (
                                          <CheckCheck className="w-3 h-3 text-emerald-500" />
                                        ) : msg.status === "sending" ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-500" />
                                        ) : (
                                          <Check className="w-3 h-3 text-cyan-500" />
                                        )
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Send reply box */}
                          <div className="flex items-center gap-2 mt-3">
                            <textarea
                              value={adminReplyText}
                              onChange={(e) => setAdminReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendAdminReply();
                                }
                              }}
                              placeholder="Type reply and press Enter..."
                              className="flex-1 bg-black/40 border border-white/10 hover:border-white/20 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-accent font-sans min-h-[50px] max-h-[100px] resize-none text-left"
                            />
                            <button
                              onClick={handleSendAdminReply}
                              disabled={!adminReplyText.trim()}
                              className="p-3.5 bg-accent text-black hover:bg-accent-dark rounded-2xl disabled:opacity-40 transition-all cursor-pointer shrink-0"
                            >
                              <Send className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl p-8 text-center text-gray-500 min-h-[400px]">
                          <MessageSquare className="w-8 h-8 mb-3 text-gray-600" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">No Session Selected</h4>
                          <p className="text-[11px] text-gray-400 max-w-xs mt-2 leading-relaxed font-sans">
                            Select an active customer support session from the list on the left to review their messages, toggle human takeover mode, and write back.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 12: CHAT WIDGET CONFIGURATION & THEMING */}
              {activeTab === "chat_settings" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-4 mb-6 gap-4">
                    <div className="text-left">
                      <h2 className="font-display font-medium text-xl text-white">
                        Chat Widget Configuration & Theming
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Customize launcher label and colors to match your brand theme.
                      </p>
                    </div>
                    <button
                      onClick={saveSettings}
                      disabled={saveStatus.settings === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#ffea00] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#ffcc00] transition-all cursor-pointer shrink-0"
                    >
                      {saveStatus.settings === "saving" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Synchronizing...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" /> Synchronize settings
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" onFocusCapture={() => recordSettingsHistory()}>
                    {/* Widget General Configuration */}
                    <div className="space-y-4 bg-white/[0.01] border border-white/5 rounded-2xl p-5 text-left">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2 mb-3">General Content settings</h3>
                      
                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono uppercase text-gray-500">Launcher Text Label</label>
                        <input
                          type="text"
                          value={editSettings.chat_launcher_label || "Ask AI"}
                          onChange={(e) => handleSettingChange("chat_launcher_label", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-sans"
                          placeholder="e.g. Ask AI"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-mono uppercase text-gray-500">AI Fallback Rate-Limit Message</label>
                        <textarea
                          value={editSettings.chat_ai_fallback_message || "I am processing high volumes. I have alerted our human producers—please leave your email!"}
                          onChange={(e) => handleSettingChange("chat_ai_fallback_message", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-sans min-h-[80px]"
                          placeholder="Rate limit/quota fallback message..."
                        />
                      </div>
                    </div>

                    {/* Chat Panel Window Theme */}
                    <div className="space-y-4 bg-white/[0.01] border border-white/5 rounded-2xl p-5 md:col-span-2 text-left font-sans">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2 mb-3">Chat Interface Window & Bubbles Theme</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Widget Background (Solid/Glass)</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={editSettings.chat_theme_bg && editSettings.chat_theme_bg.startsWith('#') && editSettings.chat_theme_bg.length === 7 ? editSettings.chat_theme_bg : "#0c0c16"}
                              onChange={(e) => handleSettingChange("chat_theme_bg", e.target.value)}
                              className="w-10 h-10 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden shrink-0"
                            />
                            <input
                              type="text"
                              value={editSettings.chat_theme_bg || "#0c0c16"}
                              onChange={(e) => handleSettingChange("chat_theme_bg", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Primary Theme Accent Color</label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={editSettings.chat_theme_primary && editSettings.chat_theme_primary.startsWith('#') && editSettings.chat_theme_primary.length === 7 ? editSettings.chat_theme_primary : "#7342e2"}
                              onChange={(e) => handleSettingChange("chat_theme_primary", e.target.value)}
                              className="w-10 h-10 bg-transparent border-0 cursor-pointer rounded-lg overflow-hidden shrink-0"
                            />
                            <input
                              type="text"
                              value={editSettings.chat_theme_primary || "#7342e2"}
                              onChange={(e) => handleSettingChange("chat_theme_primary", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">User Message Bubble Style</label>
                          <input
                            type="text"
                            value={editSettings.chat_theme_bubble_user || "rgba(115, 66, 226, 0.25)"}
                            onChange={(e) => handleSettingChange("chat_theme_bubble_user", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
                            placeholder="e.g. rgba(115, 66, 226, 0.25) or hex color"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">AI Response Bubble Style</label>
                          <input
                            type="text"
                            value={editSettings.chat_theme_bubble_ai || "rgba(255, 255, 255, 0.05)"}
                            onChange={(e) => handleSettingChange("chat_theme_bubble_ai", e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
                            placeholder="e.g. rgba(255, 255, 255, 0.05) or hex color"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </main>

          {/* CUSTOM GLOWING UPLOAD MODAL (Replicating Image 4 style) */}
          <AnimatePresence>
            {uploadModal.active && (
              <div className="fixed inset-0 z-[999] bg-[#050508]/85 backdrop-blur-2xl flex items-center justify-center p-4">
                {/* Red Glowing Halo/Backlight Behind Card */}
                <div className="absolute w-[350px] h-[350px] bg-red-600/15 rounded-full filter blur-[120px] pointer-events-none animate-pulse" />
                
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: "spring", stiffness: 150, damping: 18 }}
                  className="glass-panel-heavy rounded-3xl p-8 max-w-md w-full border border-red-500/25 relative flex flex-col items-center text-center shadow-2xl bg-[#080203]/90"
                >
                  {/* Top glossy edge line */}
                  <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                  
                  {/* File Icon Block */}
                  <div className="w-16 h-16 rounded-2xl bg-red-950/20 border border-red-500/20 flex items-center justify-center mb-6 relative overflow-hidden">
                    <FileText className="w-8 h-8 text-red-500" />
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 border border-white/10 text-[7px] font-mono text-white tracking-widest uppercase">
                      {uploadModal.filename.split('.').pop() || "FILE"}
                    </div>
                  </div>

                  {/* File Name & Size */}
                  <h3 className="font-display font-medium text-lg text-white mb-1 truncate max-w-xs">
                    {uploadModal.filename}
                  </h3>
                  <p className="text-gray-400 font-mono text-[10px] uppercase tracking-wider mb-6">
                    {uploadModal.filesize}
                  </p>

                  {/* Progress Bar Container */}
                  <div className="w-full bg-[#110506] border border-white/5 rounded-full p-1 mb-4 relative overflow-hidden">
                    {/* Progress bar track fill */}
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-red-600 to-red-400 relative transition-all duration-300 ease-out"
                      style={{ width: `${uploadModal.percentage}%` }}
                    >
                      {/* Bright Laser-tipped white highlight */}
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#fff]" />
                    </div>
                  </div>

                  {/* Progress readouts */}
                  <div className="flex justify-between items-center w-full mb-1">
                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest animate-pulse">
                      {uploadModal.percentage === 100 ? "Syncing CDN..." : "Uploading..."}
                    </span>
                    <span className="text-sm font-display font-semibold text-white">
                      {uploadModal.percentage}%
                    </span>
                  </div>

                  <p className="text-[10px] text-red-400 font-mono italic mt-2 text-center max-w-xs line-clamp-1">
                    {uploadModal.statusText}
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
