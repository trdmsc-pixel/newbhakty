import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { 
  Home as HomeIcon, 
  Film, 
  Layers, 
  Calendar, 
  ArrowLeft, 
  Check, 
  Send,
  Volume2,
  VolumeX,
  Hourglass,
  RotateCcw,
  CheckCircle,
  MessageSquare,
  X,
  Loader2,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "../context/ToastContext";
import { useSiteData } from "../context/SiteDataContext";
import { optimizeVideoUrl, optimizeImageUrl, optimizeHeroVideoUrl } from "../lib/cloudinary";
import { trackEvent, trackMetaPixelEvent, trackMetaPixelCustomEvent } from "../lib/analytics";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import MilestoneSlider, { Milestone } from "./MilestoneSlider";

const COUNTRIES = [
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "US", name: "US / Canada", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" }
];

function playPingSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn("AudioContext failed to play ping:", err);
  }
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "admin" | "bot";
  text: string;
  media_url?: string;
  created_at: string;
  status?: "sending" | "delivered" | "read";
}

interface MobileAppViewProps {
  onExit: () => void;
  navigate?: (to: string) => void;
}

export default function MobileAppView({ onExit, navigate }: MobileAppViewProps) {
  const toast = useToast();
  const { 
    siteSettings, 
    portfolioWorks = [], 
    pricingTiers = [], 
    portfolioTabs = [], 
    brandLogos = [], 
    testimonials = [], 
    activePage, 
    setActivePage 
  } = useSiteData();

  const [activeTab, setActiveTab] = useState<"home" | "work" | "tiers" | "book" | "chat">("home");
  const [isNightMode, setIsNightMode] = useState(true);
  const [previewVideoWork, setPreviewVideoWork] = useState<any | null>(null);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [tabDirection, setTabDirection] = useState(0); // -1 left, 1 right for slide direction

  const isAI = activePage === "ai";

  // Dynamic Theme Matrix
  const theme = {
    bg: isNightMode ? "bg-[#050508] text-white" : "bg-[#f9f9f9] text-zinc-900",
    headerBg: isNightMode ? "bg-[#050508]/85 border-zinc-800/80 text-white" : "bg-[#f9f9f9]/85 border-zinc-200 text-zinc-900",
    card: isNightMode ? "bg-[#0c0c0f] border-zinc-800/70 text-white" : "bg-white border-zinc-200 text-zinc-900",
    text: isNightMode ? "text-white" : "text-zinc-900",
    subText: isNightMode ? "text-zinc-400" : "text-zinc-500",
    input: isNightMode ? "bg-zinc-900/40 border-zinc-800/80 text-white" : "bg-white border-zinc-200 text-zinc-900",
    
    // Dynamic Accent Colors (AI: Yellow, Live: Magenta/Fuchsia)
    accentText: isAI ? "text-yellow-500" : "text-fuchsia-500",
    accentBg: isAI 
      ? "bg-yellow-400 hover:bg-yellow-300 text-black shadow-yellow-400/10" 
      : "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-fuchsia-600/10",
    accentBorder: isAI ? "border-yellow-400/20 focus:border-yellow-400" : "border-fuchsia-500/20 focus:border-fuchsia-500",
    
    tabActive: isAI ? "text-[#f6e200]" : "text-fuchsia-500",
    tabBarBg: isNightMode ? "bg-black border-zinc-800" : "bg-white border-zinc-200"
  };

  // Helper to dynamically resolve page-specific keys
  const getSetting = (key: string, fallback: string = "") => {
    // Check app-scoped page setting first (e.g. app_page2_hero_title_1 or app_hero_title_1)
    const appKey = activePage === "live" ? `app_page2_${key}` : `app_${key}`;
    if (siteSettings[appKey] !== undefined && siteSettings[appKey] !== "") {
      return siteSettings[appKey];
    }
    // Check app-scoped global setting (e.g. app_booking_form_title)
    const appGlobalKey = `app_${key}`;
    if (siteSettings[appGlobalKey] !== undefined && siteSettings[appGlobalKey] !== "") {
      return siteSettings[appGlobalKey];
    }
    // Fallback to desktop page settings
    if (activePage === "live") {
      const page2Key = `page2_${key}`;
      if (siteSettings[page2Key] !== undefined && siteSettings[page2Key] !== "") {
        return siteSettings[page2Key];
      }
    }
    return siteSettings[key] || fallback;
  };

  // Tab order for directional animations
  const tabOrder: Array<typeof activeTab> = ["home", "work", "tiers", "book", "chat"];

  const changeTab = useCallback((nextTab: typeof activeTab) => {
    if (nextTab === activeTab) return;
    const currentIdx = tabOrder.indexOf(activeTab);
    const nextIdx = tabOrder.indexOf(nextTab);
    setTabDirection(nextIdx > currentIdx ? 1 : -1);
    setActiveTab(nextTab);
  }, [activeTab]);

  const handlePageToggle = useCallback((nextPage: "ai" | "live") => {
    if (nextPage === activePage) return;
    setTabDirection(nextPage === "live" ? 1 : -1);
    setActivePage(nextPage);
  }, [activePage, setActivePage]);

  // ── Meta Pixel: Track every virtual page navigation in the mobile app ──
  useEffect(() => {
    const fbq = (window as any).fbq;
    if (fbq) {
      fbq('track', 'PageView', {
        content_name: `Mobile App: ${activeTab}`,
        content_category: activePage === "live" ? "Live Action" : "AI Production",
        page: activePage,
        tab: activeTab,
      });
    }
  }, [activeTab, activePage]);

  // ── Meta Pixel: Track pipeline selection toggles ──
  useEffect(() => {
    if (activePage === "live") {
      trackMetaPixelCustomEvent("SelectedPhysicalPipeline", { source: "mobile_app_toggle", page: "live" });
    } else if (activePage === "ai") {
      trackMetaPixelCustomEvent("SelectedDigitalPipeline", { source: "mobile_app_toggle", page: "ai" });
    }
  }, [activePage]);

  // Hero variables
  const heroTitle1 = getSetting("hero_title_1", "The Next Epoch");
  const heroTitle2 = getSetting("hero_title_2", "of Cinema.");
  const heroTitle3 = getSetting("hero_title_3", "Synthesized.");
  const heroDescription = getSetting("hero_description", "We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers.");
  const rawHeroVideoBgUrl = getSetting("hero_video_bg_url", "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4");
  const heroVideoBgUrl = optimizeHeroVideoUrl(rawHeroVideoBgUrl);
  const isVideoBg = !heroVideoBgUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)/i);
  const heroBgOpacity = parseFloat(getSetting("hero_bg_opacity", "1"));

  const stat1Value = getSetting("hero_stat1_value", "400+");
  const stat1Label = getSetting("hero_stat1_label", "Synth Hours");
  const stat2Value = getSetting("hero_stat2_value", "8K UHD");
  const stat2Label = getSetting("hero_stat2_label", "Upscale Target");
  const stat3Value = getSetting("hero_stat3_value", "0%");
  const stat3Label = getSetting("hero_stat3_label", "Physical Camera");

  // Work Tab State variables
  const [activeTabId, setActiveTabId] = useState("");
  const [activeVideoId, setActiveVideoId] = useState("");
  const [unmutedVideoId, setUnmutedVideoId] = useState<string | null>(null);

  // Segmented capsule indicator refs + state
  const segmentedContainerRef = useRef<HTMLDivElement>(null);
  const segmentedBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [capsuleStyle, setCapsuleStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Measure active capsule position
  const measureCapsule = useCallback(() => {
    const container = segmentedContainerRef.current;
    const activeBtn = segmentedBtnRefs.current[activeTabId];
    if (container && activeBtn) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setCapsuleStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [activeTabId]);

  useLayoutEffect(() => {
    measureCapsule();
  }, [activeTabId, activePage, measureCapsule]);

  useEffect(() => {
    window.addEventListener("resize", measureCapsule);
    return () => window.removeEventListener("resize", measureCapsule);
  }, [measureCapsule]);

  // Sync activeTabId based on portfolioTabs and activePage
  useEffect(() => {
    const pageTabs = portfolioTabs.filter((t) => t.page === activePage);
    if (pageTabs.length > 0) {
      if (!pageTabs.some((t) => t.id === activeTabId)) {
        setActiveTabId(pageTabs[0].id);
      }
    } else {
      setActiveTabId("");
    }
  }, [portfolioTabs, activePage, activeTabId]);

  const activeTabDetails = portfolioTabs.find((t) => t.id === activeTabId) || portfolioTabs.filter((t) => t.page === activePage)[0];

  const activeWorks = portfolioWorks.filter((w) => {
    if (w.page !== activePage) return false;
    if (w.tab_id) {
      return w.tab_id === activeTabId;
    }
    return w.type === (activeTabDetails?.tab_type || "video");
  });

  useEffect(() => {
    if (activeWorks.length > 0) {
      if (activeTabDetails?.tab_type === "video") {
        if (!activeWorks.some((w) => w.id === activeVideoId)) {
          setActiveVideoId(activeWorks[0].id);
          setUnmutedVideoId(null);
        }
      }
    }
  }, [activeWorks, activeTabDetails, activeVideoId]);

  const getVideoThumbnail = (videoUrl: string): string => {
    if (!videoUrl) return "";
    if (videoUrl.includes("res.cloudinary.com")) {
      let optimized = videoUrl;
      if (optimized.includes("/video/upload/")) {
        optimized = optimized.replace("/video/upload/", "/video/upload/so_0,q_auto,f_auto,w_600/");
      }
      optimized = optimized.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
      return optimized;
    }
    return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
  };

  // Pricing Tiers State variables
  const [cardMilestones, setCardMilestones] = useState<Record<string, Milestone>>({});

  const handleMilestoneChange = (tierId: string, milestone: Milestone) => {
    setCardMilestones((prev) => ({ ...prev, [tierId]: milestone }));
  };

  const parsePrice = (priceStr: string): number => {
    const numericStr = priceStr.replace(/[^0-9.]/g, "");
    return parseFloat(numericStr) || 0;
  };

  const formatPrice = (value: number, originalStr: string): string => {
    const currencySymbol = originalStr.match(/^[^0-9]*/)?.[0] || "$";
    return `${currencySymbol}${Math.round(value).toLocaleString()}`;
  };

  const filteredTiers = pricingTiers.filter((t) => t.page === activePage);

  // Dynamic booking form parser
  const getFormFields = () => {
    try {
      const json = siteSettings.booking_form_fields_json;
      if (json) {
        return JSON.parse(json);
      }
    } catch (e) {
      console.error("Failed to parse booking_form_fields_json:", e);
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

  const formFields = React.useMemo(() => {
    return getFormFields();
  }, [siteSettings.booking_form_fields_json, activePage]);

  // Form value states
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("$5,000 - $10,000");
  const [selectedTier, setSelectedTier] = useState("Full Cinematic Production");
  
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [phoneCountry, setPhoneCountry] = useState<Record<string, string>>({});
  const [activeDropdownFieldId, setActiveDropdownFieldId] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Sync custom field structure
  useEffect(() => {
    const initialCustoms: Record<string, string> = {};
    const initialPhoneCountries: Record<string, string> = {};
    formFields.forEach((field: any) => {
      if (!["name", "company", "email", "budget", "selected_tier", "brief"].includes(field.id)) {
        if (field.type === "select" && field.options && field.options.length > 0) {
          initialCustoms[field.id] = field.options[0];
        } else if (field.type === "phone") {
          initialCustoms[field.id] = "";
          initialPhoneCountries[field.id] = "+91";
        } else {
          initialCustoms[field.id] = "";
        }
      }
    });
    setCustomFields(initialCustoms);
    setPhoneCountry(initialPhoneCountries);
  }, [formFields]);

  const getCustomFieldsText = () => {
    return formFields
      .filter((f: any) => !["name", "company", "email", "budget", "selected_tier", "brief"].includes(f.id))
      .map((f: any) => {
        if (f.type === "phone") {
          const code = phoneCountry[f.id] || "+91";
          const val = customFields[f.id] || "";
          return `${f.label}: ${code} ${val}`;
        }
        const val = customFields[f.id] || "";
        return `${f.label}: ${val}`;
      })
      .join("\n");
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    formFields.forEach((field: any) => {
      let val = "";
      if (field.id === "name") val = name;
      else if (field.id === "company") val = company;
      else if (field.id === "email") val = email;
      else if (field.id === "budget") val = budget;
      else if (field.id === "selected_tier") val = selectedTier;
      else if (field.id === "brief") val = brief;
      else val = customFields[field.id] || "";

      if (field.required && !val.trim()) {
        errors[field.id] = `${field.label} is required`;
      } else if (field.id === "name" && field.required && val.trim().length < 2) {
        errors.name = "Full Name is required (minimum 2 letters)";
      } else if (field.id === "email" && field.required && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.email = "Please supply a valid email address";
      } else if (field.id === "brief" && field.required && val.trim().length < 15) {
        errors.brief = "Please describe details in at least 15 characters";
      } else if (field.type === "phone") {
        const cleaned = val.replace(/\D/g, "");
        if (field.required && !cleaned) {
          errors[field.id] = `${field.label} is required`;
        } else if (cleaned && (cleaned.length < 6 || cleaned.length > 15)) {
          errors[field.id] = `${field.label} must be 6 to 15 digits`;
        }
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent("click", "Mobile App: Booking Form submitted", { name, email, selectedTier });
    if (!validate()) {
      toast.error("Please correct the form errors before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      let briefText = brief.trim();
      const customText = getCustomFieldsText();
      if (customText) {
        briefText += `\n\n[Additional Details]\n${customText}`;
      }

      const submissionData = {
        name: name.trim(),
        company: company.trim() || "Independent Venturer",
        email: email.trim(),
        brief: briefText,
        budget: budget,
        selected_tier: selectedTier,
        selectedTier: selectedTier,
        status: "Pending"
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("bookings").insert([submissionData]);
        if (error) throw new Error(error.message);
      } else {
        const existing = localStorage.getItem("bhakty_form_submissions");
        const list = existing ? JSON.parse(existing) : [];
        list.push({ id: `sub-${Date.now()}`, ...submissionData, submitted_at: new Date().toISOString() });
        localStorage.setItem("bhakty_form_submissions", JSON.stringify(list));
      }

      // Pixel Lead event with Advanced Matching
      const phoneField = formFields.find((f: any) => f.type === "phone");
      const phoneVal = phoneField ? `${phoneCountry[phoneField.id] || "+91"}${customFields[phoneField.id] || ""}`.replace(/\D/g, "") : undefined;
      
      const parseBudgetToNumeric = (bracket: string): number => {
        const numbers = bracket.match(/\d[\d,.]*/g);
        if (numbers && numbers.length > 0) {
          const lastNumStr = numbers[numbers.length - 1].replace(/,/g, "");
          const num = parseFloat(lastNumStr);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      trackMetaPixelEvent(
        "Lead", 
        {
          value: parseBudgetToNumeric(budget),
          currency: "USD",
          content_name: "Mobile Dynamic Lead Form Submit",
          content_category: selectedTier
        }, 
        {
          em: email.trim().toLowerCase(),
          fn: name.trim().toLowerCase(),
          ph: phoneVal
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitting(false);
      setShowSuccess(true);
      toast.success("Requirements submitted successfully!");
    } catch (err: any) {
      console.error("Mobile intake failed:", err);
      // Fallback
      try {
        let briefText = brief.trim();
        const customText = getCustomFieldsText();
        if (customText) {
          briefText += `\n\n[Additional Details]\n${customText}`;
        }
        const submissionData = {
          name: name.trim(),
          company: company.trim() || "Independent Venturer",
          email: email.trim(),
          brief: briefText,
          budget: budget,
          selected_tier: selectedTier,
          selectedTier: selectedTier,
          status: "Pending"
        };
        const existing = localStorage.getItem("bhakty_form_submissions");
        const list = existing ? JSON.parse(existing) : [];
        list.push({ id: `sub-${Date.now()}`, ...submissionData, submitted_at: new Date().toISOString() });
        localStorage.setItem("bhakty_form_submissions", JSON.stringify(list));
        
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setShowSuccess(true);
        toast.success("Requirements submitted (local backup synced)!");
      } catch (e) {
        setIsSubmitting(false);
        toast.error("Failed to submit booking requirements.");
      }
    }
  };

  const handleAcquireTier = (tierName: string) => {
    toast.success(`Pipeline spot requested for ${tierName}. Redirecting to booking form...`);
    setSelectedTier(tierName);
    if (tierName.includes("Short-Form")) {
      setBudget("$2,000 - $5,000");
    } else if (tierName.includes("Cinematic") || tierName.includes("Studio")) {
      setBudget("$5,000 - $10,000");
    } else {
      setBudget("$10,000+");
    }
    changeTab("book");
  };

  // Testimonials Auto-scroll
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const interval = setInterval(() => {
      setActiveTestimonialIdx(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const currentTestimonial = testimonials[activeTestimonialIdx];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-xs ${i < Math.round(rating) ? "text-yellow-500" : "text-gray-300"}`}>★</span>
    ));
  };

  // =========================================================================
  // INTEGRATED CHAT SYSTEM STATE ENGINE
  // =========================================================================
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInputText, setChatInputText] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [currentChatStep, setCurrentChatStep] = useState<number>(0);
  
  const [chatLeadName, setChatLeadName] = useState("");
  const [chatLeadEmail, setChatLeadEmail] = useState("");
  const [chatLeadPhone, setChatLeadPhone] = useState("");
  const [chatLeadErrors, setChatLeadErrors] = useState<Record<string, string>>({});

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  const determineBotStep = (session: any): number => {
    if (!session) return 0;
    if (!session.production_type) return 1;
    if (session.production_type === "AI" && !session.production_grade) return 2;
    if (!session.budget) return 3;
    if (!session.requirements_brief) return 4;
    return 5; // Free-chat with producer takeover
  };

  const resetForm = () => {
    setName("");
    setCompany("");
    setEmail("");
    setBrief("");
    setBudget("$5,000 - $10,000");
    setSelectedTier("Full Cinematic Production");
    setCustomFields({});
    setFormErrors({});
    setShowSuccess(false);
  };

  const getDynamicTypographyCss = () => {
    let css = "";
    
    // Headings / Display Font
    if (siteSettings.font_headings_family && siteSettings.font_headings_family !== "Default Theme Font") {
      css += `
        .font-display, h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6, .app-headings, .app-toggle-btn {
          font-family: "${siteSettings.font_headings_family}", sans-serif !important;
        }
      `;
    }
    
    // Paragraph / Sans Font
    if (siteSettings.font_paragraph_family && siteSettings.font_paragraph_family !== "Default Theme Font") {
      css += `
        body, html, p, span, li, a, .font-sans, button, .app-tab-text, .app-btn {
          font-family: "${siteSettings.font_paragraph_family}", sans-serif !important;
        }
      `;
    }

    // Individual H1-H6 tags
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach(tag => {
      const family = siteSettings[`font_${tag}_family`];
      if (family && family !== "Default Theme Font") {
        css += `
          ${tag}, .${tag} {
            font-family: "${family}", sans-serif !important;
          }
        `;
      }
    });

    return css;
  };

  // Initialize and check chat session
  useEffect(() => {
    const initializeChatSession = async () => {
      let savedSessionId = localStorage.getItem("chat_session_id");
      
      if (isSupabaseConfigured && supabase) {
        try {
          if (savedSessionId) {
            const { data: session } = await supabase
              .from("chat_sessions")
              .select("*")
              .eq("id", savedSessionId)
              .single();
            
            if (session) {
              setSessionId(session.id);
              setSessionData(session);
              setCurrentChatStep(determineBotStep(session));
              
              const { data: msgs } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("session_id", session.id)
                .order("created_at", { ascending: true });
              
              if (msgs) setMessages(msgs);
            } else {
              localStorage.removeItem("chat_session_id");
              savedSessionId = null;
            }
          }
        } catch (err) {
          console.warn("Supabase session check failed, using local storage:", err);
          savedSessionId = null;
        }
      }
      
      if (!savedSessionId) {
        const localSessId = localStorage.getItem("local_chat_session_id");
        if (localSessId) {
          setSessionId(localSessId);
          const localSess = localStorage.getItem(`local_chat_session_${localSessId}`);
          if (localSess) {
            const parsed = JSON.parse(localSess);
            setSessionData(parsed);
            setCurrentChatStep(determineBotStep(parsed));
          }
          const localMsgs = localStorage.getItem(`local_chat_messages_${localSessId}`);
          if (localMsgs) setMessages(JSON.parse(localMsgs));
        } else {
          setCurrentChatStep(0);
        }
      }
    };

    initializeChatSession();
  }, []);

  // Listen to postgres updates or storage events
  useEffect(() => {
    if (!sessionId || activeTab !== "chat") return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`chat_session_mobile_${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          async (payload) => {
            if (payload.eventType === "INSERT") {
              const newMsg = payload.new as ChatMessage;
              
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.sender === "admin") {
                playPingSound();
                try {
                  await supabase
                    .from("chat_messages")
                    .update({ status: "read" })
                    .eq("id", newMsg.id);
                } catch (e) {
                  console.warn("Failed to mark message as read:", e);
                }
              }
            } else if (payload.eventType === "UPDATE") {
              const updatedMsg = payload.new as ChatMessage;
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              );
            }
          }
        )
        .subscribe();

      const sessionChannel = supabase
        .channel(`chat_session_row_mobile_${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chat_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const updatedSess = payload.new;
            setSessionData(updatedSess);
            setCurrentChatStep(determineBotStep(updatedSess));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(sessionChannel);
      };
    } else {
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `local_chat_messages_updated_${sessionId}` || e.key === "local_chat_session_updated") {
          const localMsgs = localStorage.getItem(`local_chat_messages_${sessionId}`);
          if (localMsgs) {
            const parsed = JSON.parse(localMsgs) as ChatMessage[];
            setMessages((prev) => {
              const newAdminMsgs = parsed.filter(
                (m) => m.sender === "admin" && !prev.some((pm) => pm.id === m.id)
              );
              if (newAdminMsgs.length > 0) {
                playPingSound();
              }
              return parsed;
            });
          }
          
          const localSess = localStorage.getItem(`local_chat_session_${sessionId}`);
          if (localSess) {
            const parsedSess = JSON.parse(localSess);
            setSessionData(parsedSess);
            setCurrentChatStep(determineBotStep(parsedSess));
          }
        }
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    }
  }, [sessionId, activeTab]);

  // Scroll active chat screen to bottom
  useEffect(() => {
    if (activeTab === "chat") {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handleChatLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!chatLeadName.trim()) errors.name = "Name is required";
    if (!chatLeadEmail.trim() || !/\S+@\S+\.\S+/.test(chatLeadEmail)) errors.email = "Valid email is required";
    if (!chatLeadPhone.trim() || chatLeadPhone.replace(/\D/g, "").length < 6) errors.phone = "Phone must be 6+ digits";

    if (Object.keys(errors).length > 0) {
      setChatLeadErrors(errors);
      return;
    }

    setIsSendingChat(true);
    let newUserId = "";
    let newSessId = "";
    let sessionObj: any = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: userData, error: userErr } = await supabase
          .from("chat_users")
          .insert([{ name: chatLeadName.trim(), email: chatLeadEmail.trim(), phone: chatLeadPhone.trim() }])
          .select()
          .single();

        if (userErr) throw userErr;
        newUserId = userData.id;

        const { data: sessData, error: sessErr } = await supabase
          .from("chat_sessions")
          .insert([{ user_id: newUserId, status: "active", pause_ai: true, unread_count: 0 }])
          .select()
          .single();

        if (sessErr) throw sessErr;
        newSessId = sessData.id;
        sessionObj = sessData;

        const botMsg = {
          session_id: newSessId,
          sender: "bot",
          text: "Welcome to The Chanting Studio. Are you looking for AI production or Live-Action production?",
          status: "delivered"
        };
        await supabase.from("chat_messages").insert([botMsg]);
      } catch (err: any) {
        toast.error(`Database handshake error: ${err.message || err}`);
        setIsSendingChat(false);
        return;
      }
    } else {
      newUserId = `usr-${Date.now()}`;
      newSessId = `sess-${Date.now()}`;
      
      const userObj = { id: newUserId, name: chatLeadName.trim(), email: chatLeadEmail.trim(), phone: chatLeadPhone.trim() };
      sessionObj = {
        id: newSessId,
        user_id: newUserId,
        status: "active",
        pause_ai: true,
        unread_count: 0,
        production_type: null,
        production_grade: null,
        budget: null,
        requirements_brief: null
      };

      const greetingMsg: ChatMessage = {
        id: `msg-bot-g-${Date.now()}`,
        sender: "bot",
        text: "Welcome to The Chanting Studio. Are you looking for AI production or Live-Action production?",
        created_at: new Date().toISOString(),
        status: "delivered"
      };

      localStorage.setItem(`local_chat_user_${newUserId}`, JSON.stringify(userObj));
      localStorage.setItem(`local_chat_session_${newSessId}`, JSON.stringify(sessionObj));
      localStorage.setItem(`local_chat_messages_${newSessId}`, JSON.stringify([greetingMsg]));
      localStorage.setItem("local_chat_session_id", newSessId);
      
      setMessages([greetingMsg]);
    }

    trackMetaPixelEvent("Lead", { content_name: "Mobile App Chat Intake Start" }, {
      em: chatLeadEmail.trim().toLowerCase(),
      fn: chatLeadName.trim().toLowerCase(),
      ph: chatLeadPhone.trim().replace(/\D/g, "")
    });

    setSessionId(newSessId);
    setSessionData(sessionObj);
    setCurrentChatStep(1);
    setIsSendingChat(false);
    localStorage.setItem("chat_session_id", newSessId);
  };

  const handleChatBotStepAnswer = async (answerText: string, updates: Record<string, any>) => {
    if (!sessionId) return;
    setIsSendingChat(true);

    const userMsg = {
      session_id: sessionId,
      sender: "user" as const,
      text: answerText,
      status: "delivered" as const
    };

    let insertedUserMsg: ChatMessage | null = null;
    const updatedSess = { ...sessionData, ...updates };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: userMsgData } = await supabase
          .from("chat_messages")
          .insert([userMsg])
          .select()
          .single();
        insertedUserMsg = userMsgData;

        await supabase
          .from("chat_sessions")
          .update(updates)
          .eq("id", sessionId);
      } catch (err) {
        console.error("Database update error:", err);
      }
    } else {
      insertedUserMsg = {
        ...userMsg,
        id: `msg-user-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(`local_chat_session_${sessionId}`, JSON.stringify(updatedSess));
      localStorage.setItem("local_chat_session_updated", Date.now().toString());
    }

    setSessionData(updatedSess);
    const nextStep = determineBotStep(updatedSess);
    setCurrentChatStep(nextStep);

    let botText = "";
    if (nextStep === 2) {
      botText = "Which level of production do you need?";
    } else if (nextStep === 3) {
      botText = "What is your estimated budget for this project?";
    } else if (nextStep === 4) {
      botText = "Please provide a brief overview of your requirements.";
    } else if (nextStep === 5) {
      botText = "Thank you. Our producer will contact you shortly.";
    }

    if (botText) {
      const botMsg = {
        session_id: sessionId,
        sender: "bot" as const,
        text: botText,
        status: "delivered" as const
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: botMsgData } = await supabase
            .from("chat_messages")
            .insert([botMsg])
            .select()
            .single();
          if (botMsgData) {
            setMessages((prev) => [...prev, botMsgData]);
          }
        } catch (err) {
          console.error("Error inserting bot response:", err);
        }
      } else {
        const botMsgObj: ChatMessage = {
          ...botMsg,
          id: `msg-bot-${Date.now()}`,
          created_at: new Date().toISOString()
        };
        const localMsgs = JSON.parse(localStorage.getItem(`local_chat_messages_${sessionId}`) || "[]");
        const finalMsgs = [...localMsgs, insertedUserMsg, botMsgObj].filter(Boolean);
        localStorage.setItem(`local_chat_messages_${sessionId}`, JSON.stringify(finalMsgs));
        localStorage.setItem(`local_chat_messages_updated_${sessionId}`, Date.now().toString());
        setMessages(finalMsgs);
      }
    }

    setIsSendingChat(false);
  };

  const handleSendChatMessage = async () => {
    if (!chatInputText.trim()) return;
    if (!sessionId) return;

    setIsSendingChat(true);
    const text = chatInputText;
    setChatInputText("");

    const userMsg = {
      session_id: sessionId,
      sender: "user" as const,
      text: text,
      status: "delivered" as const
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("chat_messages").insert([userMsg]);
        
        const { data: sess } = await supabase
          .from("chat_sessions")
          .select("unread_count")
          .eq("id", sessionId)
          .single();
        
        await supabase
          .from("chat_sessions")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: (sess?.unread_count || 0) + 1
          })
          .eq("id", sessionId);
      } catch (err) {
        console.error("Failed to send chat message:", err);
      }
    } else {
      const userMsgObj: ChatMessage = {
        ...userMsg,
        id: `msg-user-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      const localMsgs = JSON.parse(localStorage.getItem(`local_chat_messages_${sessionId}`) || "[]");
      const finalMsgs = [...localMsgs, userMsgObj];
      localStorage.setItem(`local_chat_messages_${sessionId}`, JSON.stringify(finalMsgs));
      localStorage.setItem(`local_chat_messages_updated_${sessionId}`, Date.now().toString());
      setMessages(finalMsgs);

      const sessionObj = JSON.parse(localStorage.getItem(`local_chat_session_${sessionId}`) || "{}");
      sessionObj.unread_count = (sessionObj.unread_count || 0) + 1;
      sessionObj.last_message_at = new Date().toISOString();
      localStorage.setItem(`local_chat_session_${sessionId}`, JSON.stringify(sessionObj));
      localStorage.setItem("local_chat_session_updated", Date.now().toString());
    }

    setIsSendingChat(false);
  };

  const duplicatedLogos = [...brandLogos, ...brandLogos, ...brandLogos];

  return (
    <div className="h-[100dvh] md:min-h-screen w-full bg-zinc-950 flex items-center justify-center p-0 md:p-6 select-none font-sans overflow-hidden md:overflow-visible">
      
      <style>{getDynamicTypographyCss()}</style>

      {/* Dynamic continuous scrolling marquee animation style injections */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marqueeScrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .marquee-container-scroller {
          display: flex;
          width: max-content;
          animation: marqueeScrollLeft 22s linear infinite;
        }
        .marquee-container-scroller:hover {
          animation-play-state: paused;
        }
        @keyframes glassShine {
          0% { left: -100%; opacity: 0.15; }
          50% { opacity: 0.45; }
          100% { left: 100%; opacity: 0; }
        }
        .btn-glass-shine {
          position: relative;
          overflow: hidden;
        }
        .btn-glass-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.3) 30%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0.3) 70%,
            transparent
          );
          transform: skewX(-25deg);
          transition: none;
        }
        .btn-glass-shine:hover::after {
          animation: glassShine 0.85s ease-out;
        }
      ` }} />

      {/* Background decoration for desktop view */}
      <div className="absolute inset-0 z-0 bg-cover bg-center filter blur-3xl opacity-20" style={{ backgroundImage: `url('${heroVideoBgUrl}')` }} />

      {/* Frame Wrapper - Full Screen on mobile, mobile dimensions on desktop */}
      <div className={`relative z-10 w-full h-[100dvh] md:h-[840px] md:max-w-[400px] md:rounded-[3rem] md:border-8 md:border-zinc-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col transition-all duration-500 ${theme.bg}`}>
        
        {/* Sticky top Header - visible across ALL tabs */}
        <nav className={`sticky top-0 w-full z-40 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between shrink-0 transition-all duration-300 ${theme.headerBg}`}>
          {/* Left: Website Logo */}
          <div className="flex items-center">
            {siteSettings.logo_img_url ? (
              <img src={siteSettings.logo_img_url} alt="Logo" className="h-5 w-auto object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-3.5 h-3.5 rounded bg-gradient-to-r from-amber-300 to-violet-500" />
                <span className={`font-display font-semibold text-xs tracking-tight ${theme.text}`}>bhakty.studio</span>
              </div>
            )}
          </div>

          {/* Center: Small page switcher toggle */}
          <div className="relative flex items-center p-0.5 rounded-full bg-zinc-200/80 dark:bg-black/60 border border-zinc-300/20 dark:border-white/10 shrink-0" style={{ isolation: "isolate" }}>
            <button
              onClick={() => handlePageToggle("ai")}
              className={`px-2.5 py-1 rounded-full text-[8.5px] font-mono tracking-wider uppercase transition-all duration-300 select-none cursor-pointer whitespace-nowrap ${
                activePage === "ai"
                  ? "bg-yellow-400 text-black font-extrabold shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              AI Production
            </button>
            <button
              onClick={() => handlePageToggle("live")}
              className={`px-2.5 py-1 rounded-full text-[8.5px] font-mono tracking-wider uppercase transition-all duration-300 select-none cursor-pointer whitespace-nowrap ${
                activePage === "live"
                  ? "bg-fuchsia-600 text-white font-extrabold shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              Live Action
            </button>
          </div>

          {/* Right: Theme mode + Exit button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsNightMode(!isNightMode);
                trackEvent("click", "Mobile App: Toggled theme mode");
              }}
              className="p-1 text-xs hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 rounded-lg transition-colors cursor-pointer select-none"
              title={isNightMode ? "Toggle Day mode" : "Toggle Night mode"}
            >
              {isNightMode ? "☀️" : "🌙"}
            </button>

            {(window.location.pathname === "/mobile-app" || window.location.hash === "#mobile-app") && (
              <button
                type="button"
                onClick={onExit}
                className={`text-[9px] font-mono uppercase tracking-wider font-bold px-2 py-1 rounded hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm border ${
                  isNightMode 
                    ? "bg-white text-black border-transparent" 
                    : "bg-black text-white border-transparent"
                }`}
              >
                Exit
              </button>
            )}
          </div>
        </nav>

        {/* Scrollable Main tab Body */}
        <div className="flex-1 overflow-y-auto pb-4 hide-scrollbar relative flex flex-col">
          
          <AnimatePresence mode="wait" initial={false}>
          {activeTab === "home" && (
            <motion.div
              key={`home-${activePage}`}
              initial={{ opacity: 0, y: tabDirection * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tabDirection * -12 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
            <div className="space-y-0">
              {/* Hero Section */}
              <section className="relative w-full h-[64vh] flex flex-col justify-end p-4 pb-6 overflow-hidden">
                <div className="absolute inset-0 z-0">
                  {isVideoBg ? (
                    <video
                      src={heroVideoBgUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ opacity: heroBgOpacity }}
                    />
                  ) : (
                    <img 
                      alt="Hero Cinematic Still" 
                      className="w-full h-full object-cover" 
                      src={heroVideoBgUrl}
                      style={{ opacity: heroBgOpacity }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
                      }}
                    />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${isNightMode ? "from-[#050508]" : "from-[#f9f9f9]"}`}></div>
                </div>
                <div className="relative z-10 flex flex-col gap-3.5 w-full text-center">
                  <h1 className="font-semibold text-xl tracking-tight leading-tight font-display">
                    {heroTitle1}<br />
                    <span className={`italic font-serif block my-0.5 ${theme.accentText}`}>{heroTitle2}</span>
                    {heroTitle3}
                  </h1>
                  <p className={`text-[10px] leading-relaxed max-w-[280px] mx-auto font-light ${theme.subText}`}>
                    {heroDescription}
                  </p>
                  <div className="max-w-[260px] mx-auto w-full flex flex-col gap-2 mt-2">
                    <button 
                      onClick={() => changeTab("book")}
                      className={`w-full py-3 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer shadow-md btn-glass-shine ${theme.accentBg}`}
                    >
                      Book Creative Spot
                    </button>
                    <button 
                      onClick={() => changeTab("work")}
                      className={`w-full py-3 bg-transparent border text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer btn-glass-shine ${
                        isNightMode ? "border-white text-white hover:bg-white/5" : "border-black text-black hover:bg-zinc-100"
                      }`}
                    >
                      Explore Curation
                    </button>
                  </div>
                </div>
              </section>

              {/* Stats Counters */}
              <section className={`grid grid-cols-3 gap-3 py-4 text-center border-y ${
                isNightMode ? "bg-[#0b0b0e] border-zinc-800" : "bg-white border-zinc-200"
              }`}>
                <div>
                  <span className="block text-sm font-semibold">{stat1Value}</span>
                  <span className={`block text-[8px] font-mono uppercase tracking-wider mt-0.5 ${theme.subText}`}>{stat1Label}</span>
                </div>
                <div>
                  <span className="block text-sm font-semibold">{stat2Value}</span>
                  <span className={`block text-[8px] font-mono uppercase tracking-wider mt-0.5 ${theme.subText}`}>{stat2Label}</span>
                </div>
                <div>
                  <span className="block text-sm font-semibold">{stat3Value}</span>
                  <span className={`block text-[8px] font-mono uppercase tracking-wider mt-0.5 ${theme.subText}`}>{stat3Label}</span>
                </div>
              </section>

              {/* INFINITE SMOOTH SCROLLING BRAND MARQUEE */}
              {brandLogos && brandLogos.length > 0 && (
                <div className={`relative w-full overflow-hidden py-5 border-b ${
                  isNightMode ? "border-zinc-800 bg-zinc-950/20" : "border-zinc-200 bg-zinc-50/20"
                }`}>
                  <h4 className={`text-[8px] uppercase tracking-widest font-mono text-center mb-3.5 ${theme.subText}`}>
                    {siteSettings.brand_logos_title || "Trusted By Leading Brands"}
                  </h4>
                  <div className="relative w-full flex items-center overflow-hidden">
                    <div className="marquee-track-infinite flex items-center gap-8 pr-8 select-none">
                      <div className="marquee-container-scroller flex items-center gap-8">
                        {duplicatedLogos.map((logo, idx) => (
                          <img
                            key={idx}
                            src={logo.url}
                            alt={logo.name || "Brand"}
                            className="h-4.5 w-auto object-contain opacity-40 grayscale shrink-0 hover:opacity-100 hover:grayscale-0 transition-opacity duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          )}

          {activeTab === "work" && (
            <motion.div
              key={`work-${activePage}`}
              initial={{ opacity: 0, y: tabDirection * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tabDirection * -12 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
            <div className="p-4 py-5 space-y-5">
              <div className="flex flex-col gap-1 text-left">
                <h2 className="text-base font-bold tracking-tight font-display">Our Visual Curation</h2>
                <div className={`h-0.5 w-8 ${isNightMode ? (isAI ? "bg-yellow-400" : "bg-fuchsia-600") : "bg-black"}`}></div>
              </div>

              {/* Segmented Capsule Toggle for Work Categories */}
              {(() => {
                const pageTabs = portfolioTabs.filter(t => t.page === activePage);
                if (pageTabs.length === 0) return null;
                return (
                  <div className="flex justify-center pb-2">
                    <div
                      ref={segmentedContainerRef}
                      className={`relative inline-flex items-center p-1 rounded-full border backdrop-blur-sm ${
                        isNightMode ? "bg-zinc-900/80 border-zinc-800" : "bg-zinc-100 border-zinc-200"
                      }`}
                    >
                      {/* Sliding capsule indicator */}
                      <motion.div
                        className={`absolute top-1 bottom-1 rounded-full z-0 ${
                          isNightMode
                            ? (isAI ? "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.25)]" : "bg-fuchsia-600 shadow-[0_0_12px_rgba(192,38,211,0.25)]")
                            : "bg-black shadow-sm"
                        }`}
                        animate={{
                          left: capsuleStyle.left,
                          width: capsuleStyle.width,
                        }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                      {pageTabs.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        return (
                          <button
                            key={tab.id}
                            ref={(el) => { segmentedBtnRefs.current[tab.id] = el; }}
                            onClick={() => setActiveTabId(tab.id)}
                            className={`relative z-10 px-3.5 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors duration-200 select-none cursor-pointer border-none bg-transparent ${
                              isActive
                                ? isNightMode
                                  ? (isAI ? "text-black font-extrabold" : "text-white font-extrabold")
                                  : "text-white font-extrabold"
                                : isNightMode
                                  ? "text-zinc-400 hover:text-zinc-200"
                                  : "text-zinc-500 hover:text-zinc-800"
                            }`}
                          >
                            {tab.tab_title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Showcase Grid / List */}
              {activeWorks.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {activeWorks.map((work) => {
                      const isVideo = work.type === "video";

                      return (
                        <div
                          key={work.id}
                          onClick={() => {
                            if (isVideo) {
                              setPreviewVideoWork(work);
                              setIsPreviewMuted(true);
                              trackEvent("video_play", `App: Opened Video Preview popup: ${work.title}`, { workId: work.id, title: work.title });
                            } else {
                              trackEvent("click", `App: Clicked static image: ${work.title}`);
                            }
                          }}
                          className={`w-full aspect-square rounded-2xl overflow-hidden shadow-sm relative group cursor-pointer border hover:scale-[1.02] active:scale-95 transition-all duration-300 ${theme.card}`}
                        >
                          {/* Static Thumbnail Image */}
                          <img
                            src={optimizeImageUrl(work.imageUrl || getVideoThumbnail(work.videoUrl))}
                            alt={work.title}
                            className="w-full h-full object-cover"
                            draggable="false"
                            loading="lazy"
                          />
                          
                          {/* Dark Vignette Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

                          {/* Video Badge Icon if it's a video */}
                          {isVideo && (
                            <div className="absolute top-2.5 left-2.5 z-10 bg-black/60 backdrop-blur-xs p-1.5 rounded-full text-white/90">
                              <Film className="w-3.5 h-3.5" />
                            </div>
                          )}

                          <div className="absolute bottom-3 left-3 right-3 flex flex-col text-left pointer-events-none">
                            <span className="text-white font-bold text-[9.5px] truncate leading-tight drop-shadow-[0_1.5px_3px_rgba(0,0,0,0.85)] font-display">
                              {work.title}
                            </span>
                            <span className="text-zinc-300 font-mono text-[7px] uppercase tracking-wider truncate mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                              {work.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* INFINITE SMOOTH SCROLLING BRAND MARQUEE */}
                  {brandLogos && brandLogos.length > 0 && (
                    <div className={`relative w-full overflow-hidden py-5 mt-6 border-t ${
                      isNightMode ? "border-zinc-800 bg-zinc-950/20" : "border-zinc-200 bg-zinc-50/20"
                    }`}>
                      <h4 className={`text-[8px] uppercase tracking-widest font-mono text-center mb-3.5 ${theme.subText}`}>
                        {siteSettings.brand_logos_title || "Trusted By Leading Brands"}
                      </h4>
                      <div className="relative w-full flex items-center overflow-hidden">
                        <div className="marquee-track-infinite flex items-center gap-8 pr-8 select-none">
                          <div className="marquee-container-scroller flex items-center gap-8">
                            {duplicatedLogos.map((logo, idx) => (
                              <img
                                key={idx}
                                src={logo.url}
                                alt={logo.name || "Brand"}
                                className="h-4.5 w-auto object-contain opacity-40 grayscale shrink-0 hover:opacity-100 hover:grayscale-0 transition-opacity duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`flex flex-col items-center justify-center border border-dashed rounded-xl h-48 font-mono text-[10px] tracking-wide ${
                  isNightMode ? "border-zinc-800 bg-[#0a0a0c] text-zinc-500" : "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}>
                  No portfolio items found.
                </div>
              )}
            </div>
            </motion.div>
          )}

          {activeTab === "tiers" && (
            <motion.div
              key={`tiers-${activePage}`}
              initial={{ opacity: 0, y: tabDirection * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tabDirection * -12 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
            <div className="p-4 py-5 space-y-5">
              <div className="flex flex-col gap-1 items-center text-center">
                <h2 className="text-base font-bold tracking-tight font-display">Production Tiers</h2>
                <p className={`text-[10px] max-w-xs leading-relaxed ${theme.subText}`}>
                  Scalable solutions tailored for varying scales of creative ambition.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                {filteredTiers.length > 0 ? (
                  filteredTiers.map((tier) => {
                    const selectedMilestone = cardMilestones[tier.id];
                    const hasSlider = tier.is_slider_enabled && tier.slider_milestones && tier.slider_milestones.length > 0;
                    
                    let displayPrice = tier.price;
                    let displayOriginalPrice = tier.originalPrice;
                    
                    if (hasSlider && selectedMilestone) {
                      const parsedBase = parsePrice(tier.price);
                      if (parsedBase > 0) {
                        const discounted = parsedBase * (1 - selectedMilestone.discount / 100);
                        displayPrice = formatPrice(discounted, tier.price);
                        if (selectedMilestone.discount > 0) {
                          displayOriginalPrice = tier.price;
                        }
                      }
                    }

                    return (
                      <div 
                        key={tier.id}
                        className={`border rounded-2xl p-5 flex flex-col gap-4 shadow-sm text-left relative overflow-hidden transition-all duration-300 ${theme.card} ${
                          tier.popular 
                            ? isNightMode 
                              ? "border-yellow-400/50 ring-1 ring-yellow-400/30" 
                              : "border-yellow-400 ring-1 ring-yellow-400"
                            : ""
                        }`}
                      >
                        {tier.popular && (
                          <div className={`absolute top-0 right-0 font-bold text-[7px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-bl-lg ${
                            isAI ? "bg-[#f6e200] text-black" : "bg-fuchsia-600 text-white"
                          }`}>
                            POPULAR
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="text-xs font-bold font-display">{tier.name}</h3>
                            {tier.discountEnabled && tier.discountText && (
                              <span className="bg-emerald-500 text-white font-mono text-[7px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                {tier.discountText}
                              </span>
                            )}
                          </div>
                          
                          {tier.offerText && (
                            <div 
                              className="px-2.5 py-1.5 rounded text-[8px] font-black uppercase tracking-wider text-center mt-2"
                              style={{
                                color: tier.offerTextColor || "#ffffff",
                                background: tier.offerBgColor || (tier.popular ? "#000000" : (isAI ? "#ffd600" : "#ff007f"))
                              }}
                            >
                              {tier.offerText}
                            </div>
                          )}

                          <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
                            {displayOriginalPrice && (
                              <span className={`text-[10px] font-mono line-through ${theme.subText}`}>
                                {displayOriginalPrice}
                              </span>
                            )}
                            <span className="text-lg font-bold">{displayPrice}</span>
                            <span className={`text-[9px] font-mono ${theme.subText}`}>/ {tier.period}</span>
                          </div>
                          <p className={`text-[9px] mt-1 leading-relaxed ${theme.subText}`}>{tier.tagline}</p>
                        </div>

                        {/* Deliverables slider if enabled */}
                        {hasSlider && (
                          <div className={`my-2 border-t pt-2 ${isNightMode ? "border-zinc-800" : "border-zinc-100"}`}>
                            <MilestoneSlider
                              milestones={tier.slider_milestones || []}
                              basePrice={tier.price}
                              glowTheme={tier.glowTheme || (isAI ? "saffron" : "violet")}
                              onChange={(milestone) => handleMilestoneChange(tier.id, milestone)}
                            />
                          </div>
                        )}

                        <ul className={`flex flex-col gap-2 text-[10px] border-t pt-3 ${isNightMode ? "border-zinc-800 text-zinc-300" : "border-zinc-100 text-zinc-700"}`}>
                          {tier.deliverables.map((item, dIdx) => (
                            <li key={dIdx} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
                              <span className="leading-tight">{item}</span>
                            </li>
                          ))}
                        </ul>

                        <div className={`grid grid-cols-2 gap-2 border rounded-lg p-2.5 text-[9px] font-mono ${
                          isNightMode ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-100"
                        }`}>
                          <div className="flex flex-col gap-0.5">
                            <span className={`flex items-center gap-1 ${theme.subText}`}><Hourglass className="w-2.5 h-2.5" /> Wait</span>
                            <span className="font-medium">{tier.turnaround}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className={`flex items-center gap-1 ${theme.subText}`}><RotateCcw className="w-2.5 h-2.5" /> Revisions</span>
                            <span className="font-medium">{tier.revisionRound}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleAcquireTier(tier.name)}
                          className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${theme.accentBg}`}
                        >
                          {tier.buttonLabel || `Acquire ${tier.name.split(" ")[0]}`}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className={`flex flex-col items-center justify-center border border-dashed rounded-xl h-40 font-mono text-[10px] tracking-wide ${
                    isNightMode ? "border-zinc-800 bg-[#0a0a0c] text-zinc-500" : "border-zinc-200 bg-zinc-50 text-zinc-400"
                  }`}>
                    No production plans configured.
                  </div>
                )}
              </div>
            </div>
            </motion.div>
          )}

          {activeTab === "book" && (
            <motion.div
              key={`book-${activePage}`}
              initial={{ opacity: 0, y: tabDirection * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tabDirection * -12 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
            <div className="p-4 py-5 space-y-6">
              
              {/* Dynamic Testimonials */}
              {testimonials && testimonials.length > 0 && currentTestimonial && (
                <div className={`border rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px] text-left transition-all ${theme.card}`}>
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
                  <div className="flex gap-0.5 mb-2">
                    {renderStars(currentTestimonial.rating)}
                  </div>
                  <p className={`text-[10px] font-light leading-relaxed italic mb-3 ${theme.subText}`}>
                    "{currentTestimonial.text}"
                  </p>
                  <div className={`border-t pt-2 flex items-center justify-between ${isNightMode ? "border-zinc-800" : "border-zinc-100"}`}>
                    <div>
                      <p className="font-semibold text-[10px] leading-tight">{currentTestimonial.client_name}</p>
                      <p className={`text-[8px] font-mono uppercase tracking-wider mt-0.5 ${theme.subText}`}>
                        {currentTestimonial.role}{currentTestimonial.company ? ` · ${currentTestimonial.company}` : ""}
                      </p>
                    </div>
                    {testimonials.length > 1 && (
                      <div className="flex gap-1.5">
                        {testimonials.map((_, dotIdx) => (
                          <span 
                            key={dotIdx}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              dotIdx === activeTestimonialIdx 
                                ? isAI ? "bg-yellow-400 w-3" : "bg-fuchsia-600 w-3"
                                : isNightMode ? "bg-zinc-800" : "bg-zinc-200"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* INFINITE SMOOTH SCROLLING BRAND MARQUEE - Sandwiched in Book tab */}
              {brandLogos && brandLogos.length > 0 && (
                <div className={`relative w-full overflow-hidden py-4 my-2 border-y ${
                  isNightMode ? "border-zinc-800 bg-zinc-950/20" : "border-zinc-200 bg-zinc-50/20"
                }`}>
                  <h4 className={`text-[8px] uppercase tracking-widest font-mono text-center mb-3.5 ${theme.subText}`}>
                    {siteSettings.brand_logos_title || "Trusted By Leading Brands"}
                  </h4>
                  <div className="relative w-full flex items-center overflow-hidden">
                    {/* Fade Masks */}
                    <div className={`absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-r to-transparent ${
                      isNightMode ? "from-[#050508]" : "from-[#f9f9f9]"
                    }`} />
                    <div className={`absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none bg-gradient-to-l to-transparent ${
                      isNightMode ? "from-[#050508]" : "from-[#f9f9f9]"
                    }`} />

                    {/* Infinite marquee track */}
                    <div className="marquee-track-infinite flex items-center gap-8 pr-8 select-none">
                      <div className="marquee-container-scroller flex items-center gap-8">
                        {duplicatedLogos.map((logo, idx) => (
                          <img
                            key={idx}
                            src={logo.url}
                            alt={logo.name || "Brand"}
                            className="h-4.5 w-auto object-contain opacity-40 grayscale shrink-0 hover:opacity-100 hover:grayscale-0 transition-opacity duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSuccess ? (
                <div className={`border rounded-2xl p-6 text-center shadow-md space-y-4 ${theme.card}`}>
                  <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold font-display">Proposal Dispatched</h3>
                  <p className={`text-[10px] leading-relaxed ${theme.subText}`}>
                    Our orchestration model has ingested your project brief and budget brackets. A supervisor will resolve dynamic rendering schedules within 12 hours.
                  </p>
                  <button 
                    onClick={resetForm}
                    className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer ${theme.accentBg}`}
                  >
                    Submit Another Brief
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1 text-left">
                    <h2 className="text-base font-bold tracking-tight font-display">
                      {siteSettings.booking_form_title || "Book Creative Studio"}
                    </h2>
                    <p className={`text-[9px] leading-relaxed ${theme.subText}`}>
                      {siteSettings.booking_form_subtitle || "Supply your project brief below. Real-time rendering models resolve allocations within 12 hours."}
                    </p>
                  </div>

                  <form onSubmit={handleSubmitForm} className="flex flex-col gap-4 w-full">
                    {formFields.map((field: any) => {
                      const isName = field.id === "name";
                      const isCompany = field.id === "company";
                      const isEmail = field.id === "email";
                      const isBudget = field.id === "budget";
                      const isTier = field.id === "selected_tier";
                      const isBrief = field.id === "brief";

                      const fieldError = formErrors[field.id];

                      return (
                        <div key={field.id} className="flex flex-col gap-1 text-left">
                          <label className={`text-[9px] font-mono uppercase tracking-widest flex justify-between ${theme.subText}`} htmlFor={`app-form-${field.id}`}>
                            <span>{field.label} {field.required && "*"}</span>
                            {fieldError && <span className="text-red-500 text-[8px] font-sans lowercase">{fieldError}</span>}
                          </label>

                          {isBrief ? (
                            <textarea
                              id={`app-form-${field.id}`}
                              className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all resize-none font-sans ${theme.input} ${
                                fieldError ? "border-red-400 focus:border-red-500" : ""
                              }`}
                              placeholder={field.placeholder || "Project brief..."}
                              rows={4}
                              value={brief}
                              onChange={(e) => setBrief(e.target.value)}
                              required={field.required}
                            />
                          ) : isBudget ? (
                            <select
                              id={`app-form-${field.id}`}
                              className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all cursor-pointer font-sans ${theme.input}`}
                              value={budget}
                              onChange={(e) => setBudget(e.target.value)}
                            >
                              {(field.options || ["$2,000 - $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+"]).map((opt: string) => (
                                <option key={opt} className={isNightMode ? "bg-zinc-950 text-white" : "bg-white text-zinc-900"} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : isTier ? (
                            <select
                              id={`app-form-${field.id}`}
                              className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all cursor-pointer font-sans ${theme.input}`}
                              value={selectedTier}
                              onChange={(e) => setSelectedTier(e.target.value)}
                            >
                              {(field.options || ["Short-Form Creative", "Full Cinematic Production", "Enterprise Studio Pipeline", "Custom Collaborative"]).map((opt: string) => (
                                <option key={opt} className={isNightMode ? "bg-zinc-950 text-white" : "bg-white text-zinc-900"} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "select" ? (
                            <select
                              id={`app-form-${field.id}`}
                              className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all cursor-pointer font-sans ${theme.input}`}
                              value={customFields[field.id] || ""}
                              onChange={(e) => setCustomFields({ ...customFields, [field.id]: e.target.value })}
                            >
                              {field.options?.map((opt: string) => (
                                <option key={opt} className={isNightMode ? "bg-zinc-950 text-white" : "bg-white text-zinc-900"} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === "phone" ? (
                            <div className="flex gap-1.5 relative country-dropdown-container">
                              <button
                                type="button"
                                onClick={() => setActiveDropdownFieldId(activeDropdownFieldId === field.id ? null : field.id)}
                                className={`flex items-center gap-1 border rounded-lg px-2 py-2 text-xs select-none cursor-pointer ${theme.input}`}
                              >
                                <span>{COUNTRIES.find(c => c.dialCode === (phoneCountry[field.id] || "+91"))?.flag || "🇮🇳"}</span>
                                <span className={`font-mono text-[10px] ${theme.subText}`}>{phoneCountry[field.id] || "+91"}</span>
                              </button>
                              
                              {activeDropdownFieldId === field.id && (
                                <div className={`absolute top-10 left-0 border rounded-xl shadow-xl z-50 py-1 w-44 max-h-48 overflow-y-auto ${
                                  isNightMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
                                }`}>
                                  {COUNTRIES.map((c) => (
                                    <button
                                      key={c.code}
                                      type="button"
                                      onClick={() => {
                                        setPhoneCountry({ ...phoneCountry, [field.id]: c.dialCode });
                                        setActiveDropdownFieldId(null);
                                      }}
                                      className={`w-full text-left px-3 py-1.5 text-[10px] flex items-center gap-2 cursor-pointer border-none bg-transparent ${
                                        isNightMode ? "hover:bg-zinc-800 text-zinc-300 hover:text-white" : "hover:bg-zinc-50 text-zinc-700"
                                      }`}
                                    >
                                      <span>{c.flag}</span>
                                      <span className={`font-mono ${theme.subText}`}>{c.dialCode}</span>
                                      <span className="truncate">{c.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              <input
                                id={`app-form-${field.id}`}
                                className={`flex-1 border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all placeholder:text-zinc-300 font-sans ${theme.input} ${
                                  fieldError ? "border-red-400 focus:border-red-500" : ""
                                }`}
                                placeholder={field.placeholder || "Phone number..."}
                                type="tel"
                                value={customFields[field.id] || ""}
                                onChange={(e) => setCustomFields({ ...customFields, [field.id]: e.target.value })}
                                required={field.required}
                              />
                            </div>
                          ) : (
                            <input
                              id={`app-form-${field.id}`}
                              className={`w-full border rounded-lg px-3 py-2 text-xs focus:border-black dark:focus:border-white outline-none transition-all placeholder:text-zinc-300 font-sans ${theme.input} ${
                                fieldError ? "border-red-400 focus:border-red-500" : ""
                              }`}
                              placeholder={field.placeholder || "Write answer..."}
                              type={field.type || "text"}
                              value={
                                isName ? name : isCompany ? company : isEmail ? email : (customFields[field.id] || "")
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (isName) setName(val);
                                else if (isCompany) setCompany(val);
                                else if (isEmail) setEmail(val);
                                else setCustomFields({ ...customFields, [field.id]: val });
                              }}
                              required={field.required}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Dynamic styled Submit button */}
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className={`w-full mt-2 py-3 px-6 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-200 shadow-md flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 font-mono ${theme.accentBg}`}
                    >
                      {isSubmitting ? "Dispatching Brief..." : (
                        <>
                          <Send className="w-3.5 h-3.5" /> {siteSettings.booking_cta_text || "Submit Requirement"}
                        </>
                      )}
                    </button>

                    {/* WHATSAPP CONTACT LINK */}
                    <a
                      href="https://wa.me/919958194155"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-lg bg-[#128c7e] hover:bg-[#075e54] text-white flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(18,140,126,0.2)] hover:shadow-[0_0_18px_rgba(18,140,126,0.4)] transition-all border border-emerald-400/20 hover:border-emerald-400/40 cursor-pointer select-none font-mono text-[9px] uppercase tracking-wider font-bold mt-1 shrink-0"
                    >
                      <svg className="w-4 h-4 fill-current text-white shrink-0" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.067 2.877 1.216 3.076.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <span>Chat with us</span>
                    </a>
                  </form>
                </div>
              )}


              {/* Branded Footer relocated to Book tab bottom */}
              <footer className={`w-full p-6 pt-8 pb-16 border-t ${isNightMode ? "border-zinc-800 bg-[#08080b]" : "border-zinc-200 bg-zinc-50"}`}>
                <div className="flex flex-col gap-4 text-center">
                  <p className={`text-[9px] font-light leading-relaxed max-w-[280px] mx-auto ${theme.subText}`}>
                    {siteSettings.footer_copyright || "© 2026 bhakty.studio. All rights reserved."}
                  </p>
                  
                  <div className="flex justify-center gap-4 text-[8px] font-semibold uppercase tracking-wider text-zinc-400 mt-1 select-none">
                    <a className="hover:text-black dark:hover:text-white transition-colors" href="#">Instagram</a>
                    <span>•</span>
                    <a className="hover:text-black dark:hover:text-white transition-colors" href="#">Vimeo</a>
                    <span>•</span>
                    <a className="hover:text-black dark:hover:text-white transition-colors" href="#">LinkedIn</a>
                  </div>
                  
                  <div className="flex justify-center gap-2.5 text-[8px] font-mono text-zinc-500 mt-2 select-none flex-wrap border-t border-zinc-200/10 dark:border-zinc-800/50 pt-2">
                    <button 
                      onClick={() => {
                        if (navigate) navigate("/privacy");
                        else {
                          window.history.pushState({}, "", "/privacy");
                          window.dispatchEvent(new Event("popstate"));
                        }
                      }} 
                      className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                    <span>•</span>
                    <button 
                      onClick={() => {
                        if (navigate) navigate("/terms");
                        else {
                          window.history.pushState({}, "", "/terms");
                          window.dispatchEvent(new Event("popstate"));
                        }
                      }} 
                      className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Terms of Service
                    </button>
                    <span>•</span>
                    <button 
                      onClick={() => {
                        if (navigate) navigate("/refunds");
                        else {
                          window.history.pushState({}, "", "/refunds");
                          window.dispatchEvent(new Event("popstate"));
                        }
                      }} 
                      className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Refund Policy
                    </button>
                  </div>
                </div>
              </footer>

            </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: tabDirection * 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: tabDirection * -12 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 flex flex-col"
            >
            <div className="flex-1 flex flex-col overflow-hidden h-full">
              {currentChatStep === 0 ? (
                /* Chat Intake Form Screen */
                <form onSubmit={handleChatLeadSubmit} className="flex-1 flex flex-col justify-center p-6 space-y-4 text-left">
                  <div className="flex flex-col items-start mb-2">
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed border shadow-sm ${theme.card}`}>
                      <span>👋 Hello! Welcome to support. Enter your credentials below to start a live connection with our producers.</span>
                    </div>
                    <span className="text-[7px] font-mono text-zinc-400 uppercase mt-1 pl-1">Studio Concierge</span>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[9px] font-mono uppercase ${theme.subText}`}>Your Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Christopher Nolan"
                      value={chatLeadName}
                      onChange={(e) => setChatLeadName(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-all font-sans ${theme.input} ${
                        chatLeadErrors.name ? "border-red-500 focus:border-red-500" : theme.accentBorder
                      }`}
                    />
                    {chatLeadErrors.name && <span className="text-[8px] text-red-500 font-mono">{chatLeadErrors.name}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[9px] font-mono uppercase ${theme.subText}`}>Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. chris@studio.com"
                      value={chatLeadEmail}
                      onChange={(e) => setChatLeadEmail(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-all font-sans ${theme.input} ${
                        chatLeadErrors.email ? "border-red-500 focus:border-red-500" : theme.accentBorder
                      }`}
                    />
                    {chatLeadErrors.email && <span className="text-[8px] text-red-500 font-mono">{chatLeadErrors.email}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[9px] font-mono uppercase ${theme.subText}`}>Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +91 9999999999"
                      value={chatLeadPhone}
                      onChange={(e) => setChatLeadPhone(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-all font-sans ${theme.input} ${
                        chatLeadErrors.phone ? "border-red-500 focus:border-red-500" : theme.accentBorder
                      }`}
                    />
                    {chatLeadErrors.phone && <span className="text-[8px] text-red-500 font-mono">{chatLeadErrors.phone}</span>}
                  </div>

                  <button 
                    type="submit"
                    disabled={isSendingChat}
                    className={`w-full py-3 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-200 border cursor-pointer disabled:opacity-50 mt-4 flex items-center justify-center gap-1.5 ${theme.accentBg}`}
                  >
                    {isSendingChat ? "Ingesting data..." : "Start Chat"}
                  </button>
                </form>
              ) : (
                /* Chat Messages History Panel */
                <div className="flex-1 flex flex-col justify-between overflow-hidden h-[calc(100vh-8rem)] md:h-[710px]">
                  
                  {/* Messages container list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                    {messages.map((msg) => {
                      const isUser = msg.sender === "user";
                      const isBot = msg.sender === "bot";
                      
                      let receiptIcon = null;
                      if (isUser) {
                        if (msg.status === "sending") {
                          receiptIcon = <Loader2 className="w-2.5 h-2.5 animate-spin text-zinc-500" />;
                        } else {
                          receiptIcon = <Check className="w-3 h-3 text-emerald-500" />;
                        }
                      }

                      return (
                        <div 
                          key={msg.id}
                          className={`flex flex-col text-left ${isUser ? "items-end" : "items-start"}`}
                        >
                          <div 
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed border shadow-sm ${
                              isUser 
                                ? isAI ? "bg-yellow-400 border-yellow-400 text-black" : "bg-fuchsia-600 border-fuchsia-600 text-white" 
                                : isBot 
                                ? isNightMode ? "bg-[#0b0b0e] border-dashed border-zinc-800 text-zinc-300" : "bg-zinc-100 border-dashed border-zinc-200 text-zinc-700" 
                                : theme.card
                            }`}
                          >
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 pl-1 pr-1">
                            <span className="text-[8px] font-mono text-zinc-400 uppercase">
                              {isUser ? "You" : isBot ? "Studio Assistant" : "Studio Producer"} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now"}
                            </span>
                            {receiptIcon}
                          </div>
                        </div>
                      );
                    })}
                    {isSendingChat && (
                      <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[8px] uppercase pl-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Transmitting pipeline...</span>
                      </div>
                    )}
                    <div ref={chatMessagesEndRef} />
                  </div>

                  {/* Messaging bottom input row */}
                  <div className={`p-3 border-t flex flex-col gap-2 shrink-0 bg-opacity-95 ${
                    isNightMode ? "bg-black border-zinc-800" : "bg-[#f9f9f9] border-zinc-200"
                  }`}>
                    {currentChatStep === 1 ? (
                      /* STEP 1 CHOICES BUTTONS */
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleChatBotStepAnswer("AI Production", { production_type: "AI" })}
                          className={`py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all select-none cursor-pointer border ${theme.card} ${theme.accentText} ${theme.accentBorder}`}
                        >
                          AI Production
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("Live-Action Production", { production_type: "Live-Action", production_grade: "N/A" })}
                          className={`py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all select-none cursor-pointer border ${theme.card} ${theme.accentText} ${theme.accentBorder}`}
                        >
                          Live-Action
                        </button>
                      </div>
                    ) : currentChatStep === 2 ? (
                      /* STEP 2 CHOICES BUTTONS */
                      <div className="grid grid-cols-3 gap-1">
                        <button 
                          onClick={() => handleChatBotStepAnswer("Cinema-Grade", { production_grade: "Cinema-Grade" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all border ${theme.card}`}
                        >
                          Cinema
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("Studio-Grade", { production_grade: "Studio-Grade" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all border ${theme.card}`}
                        >
                          Studio
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("Content-Grade", { production_grade: "Content-Grade" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all border ${theme.card}`}
                        >
                          Content
                        </button>
                      </div>
                    ) : currentChatStep === 3 ? (
                      /* STEP 3 CHOICES BUTTONS */
                      <div className="grid grid-cols-2 gap-1.5">
                        <button 
                          onClick={() => handleChatBotStepAnswer("$2,000 - $5,000", { budget: "$2,000 - $5,000" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${theme.card}`}
                        >
                          $2K - $5K
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("$5,000 - $10,000", { budget: "$5,000 - $10,000" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${theme.card}`}
                        >
                          $5K - $10K
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("$10,000 - $25,000", { budget: "$10,000 - $25,000" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${theme.card}`}
                        >
                          $10K - $25K
                        </button>
                        <button 
                          onClick={() => handleChatBotStepAnswer("$25,000+", { budget: "$25,000+" })}
                          className={`py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider border ${theme.card}`}
                        >
                          $25K+
                        </button>
                      </div>
                    ) : (
                      /* FREE TEXT INPUT BAR */
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder={currentChatStep === 4 ? "Explain brief..." : "Type message..."}
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (currentChatStep === 4) {
                                handleChatBotStepAnswer(chatInputText, { requirements_brief: chatInputText, status: "active" });
                              } else {
                                handleSendChatMessage();
                              }
                            }
                          }}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs focus:outline-none transition-all font-sans ${theme.input} ${theme.accentBorder}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (currentChatStep === 4) {
                              handleChatBotStepAnswer(chatInputText, { requirements_brief: chatInputText, status: "active" });
                            } else {
                              handleSendChatMessage();
                            }
                          }}
                          className={`p-2 rounded-xl border-none transition-all flex items-center justify-center shrink-0 cursor-pointer ${theme.accentBg}`}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Bottom Navigation Bar with 5 TABS */}
        <nav className={`w-full z-40 border-t pb-safe shrink-0 shadow-2xl transition-all duration-300 ${theme.tabBarBg}`}>
          <div className="flex justify-between items-center h-16 px-1 select-none">
            {/* Home Tab Link */}
            <button 
              onClick={() => changeTab("home")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 cursor-pointer border-none bg-transparent ${
                activeTab === "home" ? theme.tabActive : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <HomeIcon className="w-4.5 h-4.5" />
              <span className="text-[7.5px] font-mono uppercase tracking-wider font-bold">Home</span>
            </button>

            {/* Work Tab Link */}
            <button 
              onClick={() => changeTab("work")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 cursor-pointer border-none bg-transparent ${
                activeTab === "work" ? theme.tabActive : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Film className="w-4.5 h-4.5" />
              <span className="text-[7.5px] font-mono uppercase tracking-wider font-bold">Work</span>
            </button>

            {/* Tiers Tab Link */}
            <button 
              onClick={() => changeTab("tiers")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 cursor-pointer border-none bg-transparent ${
                activeTab === "tiers" ? theme.tabActive : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Layers className="w-4.5 h-4.5" />
              <span className="text-[7.5px] font-mono uppercase tracking-wider font-bold">Tiers</span>
            </button>

            {/* Book Tab Link */}
            <button 
              onClick={() => changeTab("book")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 cursor-pointer border-none bg-transparent ${
                activeTab === "book" ? theme.tabActive : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Calendar className="w-4.5 h-4.5" />
              <span className="text-[7.5px] font-mono uppercase tracking-wider font-bold">Book</span>
            </button>

            {/* Chat Tab Link (Added 5th Tab) */}
            <button 
              onClick={() => changeTab("chat")}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 cursor-pointer border-none bg-transparent ${
                activeTab === "chat" ? theme.tabActive : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-4.5 h-4.5" />
                {/* Micro active notification dot if unread */}
                {activeTab !== "chat" && messages.some(m => m.sender === "admin" && m.status !== "read") && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-black animate-ping" />
                )}
              </div>
              <span className="text-[7.5px] font-mono uppercase tracking-wider font-bold">Chat</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Video Preview Modal Portal (Fixed centered popup overlay) */}
      {previewVideoWork && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => {
            setPreviewVideoWork(null);
            setIsPreviewMuted(true);
          }}
        >
          <div 
            className="relative w-full max-w-sm sm:max-w-md max-h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setPreviewVideoWork(null);
                setIsPreviewMuted(true);
              }}
              className="absolute -top-12 right-0 z-[110] bg-black/60 hover:bg-black/95 text-white p-2 rounded-full border border-white/10 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Mute button */}
            <button
              onClick={() => setIsPreviewMuted(!isPreviewMuted)}
              className="absolute -top-12 left-0 z-[110] bg-black/60 hover:bg-black/95 text-white px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 transition-all text-[9px] font-mono uppercase tracking-wider cursor-pointer"
            >
              {isPreviewMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            <video
              src={optimizeVideoUrl(previewVideoWork.videoUrl)}
              autoPlay
              loop
              playsInline
              muted={isPreviewMuted}
              className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
