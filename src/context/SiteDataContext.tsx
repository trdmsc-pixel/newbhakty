import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { VideoBlock, PricingTier, PortfolioTab } from "../types";
import { PORTFOLIO_VIDEOS, PRICING_TIERS } from "../data";

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export interface NavigationMenuItem {
  id: string;
  label: string;
  target_url: string;
  display_order: number;
}

export interface SiteSettings {
  [key: string]: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
  created_at?: string;
}

export interface BrandLogo {
  id: string;
  url: string;
  name: string;
  display_order: number;
  page?: string;
}

export interface Testimonial {
  id: string;
  client_name: string;
  role: string;
  company: string;
  text: string;
  video_url: string;
  rating: number;
  display_order: number;
}

interface SiteDataContextProps {
  isLoading: boolean;
  activePage: "ai" | "live";
  setActivePage: (page: "ai" | "live") => void;
  siteSettings: SiteSettings;
  navigationMenu: NavigationMenuItem[];
  portfolioWorks: VideoBlock[];
  pricingTiers: PricingTier[];
  portfolioTabs: PortfolioTab[];
  isUsingSupabase: boolean;
  mediaAssets: MediaAsset[];
  brandLogos: BrandLogo[];
  testimonials: Testimonial[];
  refreshAllData: () => Promise<void>;
  updateSiteSetting: (key: string, value: string) => Promise<boolean>;
  updateMultipleSiteSettings: (settings: SiteSettings) => Promise<boolean>;
  updateNavigationMenu: (menuItems: NavigationMenuItem[]) => Promise<boolean>;
  updatePortfolioWorks: (works: VideoBlock[]) => Promise<boolean>;
  updatePricingTiers: (tiers: PricingTier[]) => Promise<boolean>;
  updatePortfolioTabs: (tabs: PortfolioTab[]) => Promise<boolean>;
  addMediaAsset: (name: string, url: string, type: "image" | "video") => Promise<MediaAsset | null>;
  deleteMediaAsset: (id: string) => Promise<boolean>;
  updateBrandLogos: (logos: BrandLogo[]) => Promise<boolean>;
  updateTestimonials: (testimonials: Testimonial[]) => Promise<boolean>;
}

const SiteDataContext = createContext<SiteDataContextProps | undefined>(undefined);

// Initial fallback/default site settings
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  // Hero Section (Section 5.1 & 8)
  hero_eyebrow: "AI-NATIVE CINEMATIC STUDIO — DELHI → WORLDWIDE",
  hero_title: "Film-scale craft.\nAI-speed delivery.",
  hero_description: "Brand films, AI commercials, trailers and hybrid live-action VFX for brands, agencies and production houses.",
  hero_loop_url: "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781186188643-uz2iudjbk_seedance_2_0___tv_spot_ad___bmw23__bmw2_create_a_hyper_premium_cinematic_tv_spot_commercial_for_the_4k.webm",
  hero_poster_url: "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781188194291-p22sxzh5f_3_series_exterior_left_front_three_quarter.avif",
  hero_credit: "BMW 4K TV SPOT • DIRECTED BY THE CHANTING STUDIO",

  // Showreel Section (Section 5.2 & 8)
  showreel_video_url: "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781188825650-g9hzeknyz_banner.webm",
  showreel_poster_url: "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781187896400-j5gl1zley_freepik_high_budget_cinematic_stu_2846789120.jpg",
  showreel_duration: "0:45",
  showreel_aspect: "16:9",

  // Studio Capabilities / What We Make (Section 5.4 & 8)
  service_1_title: "Brand Films & TVCs",
  service_1_desc: "Hero films for launches and campaigns, built to cinema standards.",
  service_2_title: "AI Commercials",
  service_2_desc: "Product and fashion spots without the cost and wait of a full shoot.",
  service_3_title: "Trailers & Teasers",
  service_3_desc: "Synthetic trailers and teasers for films, series and pitches.",
  service_4_title: "Hybrid Live-Action + VFX",
  service_4_desc: "Live plates extended and finished with AI and VFX.",
  service_5_title: "Music Videos",
  service_5_desc: "Narrative and performance videos with a film-grade finish.",
  service_6_title: "For Agencies & Production Houses",
  service_6_desc: "Your AI unit on call: pitch films, previs and finished shots, white-label.",

  // Contact & Socials (Section 5.6 & 8)
  contact_email: "studio@thechantingstudio.in",
  whatsapp_number: "+919999999999",
  instagram_url: "https://instagram.com/thechantingstudio",
  linkedin_url: "https://www.linkedin.com/company/thechantingstudio",
  youtube_url: "https://youtube.com/@thechantingstudio",
  vimeo_url: "https://vimeo.com/thechantingstudio",
  behance_url: "",

  // Inquiry Form & Success State (Section 5.6 & 8)
  booking_success_message: "Your brief is with us. We'll be in touch shortly.",
  booking_form_fields_json: JSON.stringify([
    { id: "name", label: "Name", type: "text", placeholder: "Your full name", required: true },
    { id: "email", label: "Email", type: "email", placeholder: "name@company.com", required: true },
    { id: "company", label: "Company / Brand", type: "text", placeholder: "Company or brand", required: false },
    { id: "phone", label: "WhatsApp / Phone", type: "tel", placeholder: "Phone with country code", required: false },
    { id: "client_type", label: "You are", type: "chips", options: ["Brand", "Agency", "Production house", "Other"], required: false },
    { id: "selected_tier", label: "What are we making?", type: "chips", options: ["Brand film / TVC", "AI commercial", "Trailer / teaser", "Hybrid live-action + VFX", "Music video", "Something else"], required: true },
    { id: "budget", label: "Budget range", type: "select", options: ["Not sure yet", "Under ₹3 lakh", "₹3–10 lakh", "₹10–25 lakh", "₹25 lakh+", "International (USD)"], required: false },
    { id: "timeline", label: "Timeline", type: "chips", options: ["ASAP", "Within a month", "1–3 months", "Just exploring"], required: false },
    { id: "brief", label: "Tell us about the project", type: "textarea", placeholder: "The story, where it will run, any references or deadlines.", required: true },
    { id: "references", label: "Reference links", type: "url", placeholder: "Links to moodboards, references or pitch decks", required: false }
  ]),

  // SEO & OpenGraph (Section 8 & 9)
  seo_title: "The Chanting Studio — AI-Native Cinematic Studio, Delhi",
  seo_description: "Brand films, AI commercials, trailers and hybrid live-action VFX for brands, agencies and production houses. Delhi → Worldwide.",
  og_image_url: "/og.jpg",
  footer_copyright: "© 2026 Chaitravarna Ventures Pvt. Ltd. — The Chanting Studio",

  // Brand Marquee
  brand_logos_title: "TRUSTED BY",
  brand_logos_marquee_enabled: "true"
};

const DEFAULT_NAVIGATION_MENU: NavigationMenuItem[] = [
  { id: "menu-reel", label: "Reel", target_url: "#reel", display_order: 1 },
  { id: "menu-work", label: "Work", target_url: "#work", display_order: 2 },
  { id: "menu-studio", label: "Studio", target_url: "#studio", display_order: 3 },
  { id: "menu-contact", label: "Contact", target_url: "#contact", display_order: 4 }
];

const DEFAULT_PORTFOLIO_TABS: PortfolioTab[] = [
  { id: "default-commercials", tab_title: "Commercials", tab_type: "video", page: "home", display_order: 1 },
  { id: "default-trailers", tab_title: "Trailers & Teasers", tab_type: "video", page: "home", display_order: 2 },
  { id: "default-hybrid", tab_title: "Hybrid VFX", tab_type: "video", page: "home", display_order: 3 },
  { id: "default-music", tab_title: "Music Videos", tab_type: "video", page: "home", display_order: 4 }
];

const DEFAULT_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: "asset-1",
    name: "Studio Poster Frame",
    url: "/og.jpg",
    type: "image"
  }
];

export const SiteDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [activePage, setActivePage] = useState<"ai" | "live">("ai");
  
  // Synchronous local storage initializers to eliminate initial rendering flash and timing races
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    try {
      const stored = localStorage.getItem("bhakty_site_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SITE_SETTINGS, ...parsed };
      }
    } catch (e) {}
    return DEFAULT_SITE_SETTINGS;
  });
  const [navigationMenu, setNavigationMenu] = useState<NavigationMenuItem[]>(() => {
    try {
      const stored = localStorage.getItem("bhakty_navigation_menu");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return DEFAULT_NAVIGATION_MENU;
  });
  const [portfolioWorks, setPortfolioWorks] = useState<VideoBlock[]>(() => {
    try {
      const stored = localStorage.getItem("bhakty_portfolio_works");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return PORTFOLIO_VIDEOS.map(w => ({
      ...w,
      tab_id: w.tab_id || (w.type === "image" ? "default-ai-image" : "default-ai-video")
    }));
  });
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(() => {
    try {
      const stored = localStorage.getItem("bhakty_pricing_tiers");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return PRICING_TIERS;
  });
  const [portfolioTabs, setPortfolioTabs] = useState<PortfolioTab[]>(() => {
    try {
      const stored = localStorage.getItem("bhakty_portfolio_tabs");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_PORTFOLIO_TABS;
  });
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(DEFAULT_MEDIA_ASSETS);
  const [brandLogos, setBrandLogos] = useState<BrandLogo[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Load from Supabase
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    let success = false;

    if (isSupabaseConfigured && supabase) {
      try {
        // Fetch Site Settings
        const { data: settingsData, error: settingsError } = await supabase
          .from("site_settings")
          .select("key, value");

        // Fetch Navigation
        const { data: menuData, error: menuError } = await supabase
          .from("navigation_menu")
          .select("*")
          .order("display_order", { ascending: true });

        // Fetch Portfolio Works
        const { data: worksData, error: worksError } = await supabase
          .from("portfolio_works")
          .select("*")
          .order("display_order", { ascending: true });

        // Fetch Portfolio Tabs
        const { data: tabsData, error: tabsError } = await supabase
          .from("portfolio_tabs")
          .select("*")
          .order("display_order", { ascending: true });

        // Fetch Pricing Tiers
        const { data: pricingData, error: pricingError } = await supabase
          .from("pricing_tiers")
          .select("*")
          .order("display_order", { ascending: true });

        // Fetch Media Assets
        let fetchedAssets: MediaAsset[] = [];
        try {
          const { data: assetsData, error: assetsError } = await supabase
            .from("media_assets")
            .select("*")
            .order("created_at", { ascending: false });

          if (!assetsError && assetsData && assetsData.length > 0) {
            fetchedAssets = assetsData.map((a: any) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              type: a.type as "image" | "video",
              created_at: a.created_at
            }));
            setMediaAssets(fetchedAssets);
          }
        } catch (tableErr) {
          console.warn("Could not query 'media_assets' table from Supabase.", tableErr);
        }

        // Fetch Brand Logos
        try {
          const { data: logosData, error: logosError } = await supabase
            .from("brand_logos")
            .select("*")
            .order("display_order", { ascending: true });

          if (!logosError && logosData && logosData.length > 0) {
            setBrandLogos(logosData.map((l: any) => ({
              id: l.id,
              url: l.url,
              name: l.name || "",
              display_order: l.display_order || 0,
              page: l.page || "ai",
            })));
          }
        } catch (tableErr) {
          console.warn("Could not query 'brand_logos' table from Supabase.", tableErr);
        }

        // Fetch Testimonials
        try {
          const { data: testimonialsData, error: testimonialsError } = await supabase
            .from("testimonials")
            .select("*")
            .order("display_order", { ascending: true });

          if (!testimonialsError && testimonialsData && testimonialsData.length > 0) {
            setTestimonials(testimonialsData.map((t: any) => ({
              id: t.id,
              client_name: t.client_name || "",
              role: t.role || "",
              company: t.company || "",
              text: t.text || "",
              video_url: t.video_url || "",
              rating: t.rating || 5,
              display_order: t.display_order || 0,
            })));
          }
        } catch (tableErr) {
          console.warn("Could not query 'testimonials' table from Supabase.", tableErr);
        }

        // If queries succeeded, update state
        if (!settingsError && settingsData && settingsData.length > 0) {
          const settingsObj: SiteSettings = {};
          settingsData.forEach((item) => {
            settingsObj[item.key] = item.value;
          });
          const merged = { ...DEFAULT_SITE_SETTINGS, ...settingsObj };
          setSiteSettings(merged);
          localStorage.setItem("bhakty_site_settings", JSON.stringify(merged));
        }

        if (!menuError && menuData && menuData.length > 0) {
          setNavigationMenu(menuData);
          localStorage.setItem("bhakty_navigation_menu", JSON.stringify(menuData));
        }

        if (!worksError && worksData && worksData.length > 0) {
          const mappedWorks: VideoBlock[] = worksData.map((w) => ({
            id: w.id,
            title: w.title,
            category: w.category,
            videoUrl: w.video_url || "",
            highResVideoUrl: w.high_res_video_url || w.video_url || "",
            description: w.description || "",
            creator: w.creator || "bhakty.synth",
            duration: w.duration || "0:15",
            ratio: (w.ratio as any) || "landscape",
            aspectRatioClass: w.aspect_ratio_class || "aspect-video md:col-span-2",
            tags: Array.isArray(w.tags) ? w.tags : JSON.parse(w.tags || "[]"),
            type: w.type || "video",
            imageUrl: w.image_url || "",
            subtext: w.subtext || "",
            page: w.page || "ai",
            tab_id: w.tab_id || "",
          }));
          setPortfolioWorks(mappedWorks);
          localStorage.setItem("bhakty_portfolio_works", JSON.stringify(mappedWorks));
        }

        if (!pricingError && pricingData && pricingData.length > 0) {
          const mappedTiers: PricingTier[] = pricingData.map((t) => ({
            id: t.id,
            name: t.tier_name,
            tagline: t.tagline || "",
            price: t.price,
            period: t.period || "month",
            popular: t.popular || false,
            deliverables: Array.isArray(t.features) ? t.features : JSON.parse(t.features || "[]"),
            turnaround: t.turnaround || "5 working days",
            revisionRound: t.revision_round || "2 Rounds",
            glowTheme: (t.glow_theme as any) || "saffron",
            buttonLabel: t.button_label || "",
            buttonColor: t.button_color || "",
            buttonTextColor: t.button_text_color || "",
            discountEnabled: t.discount_enabled || false,
            discountText: t.discount_text || "",
            originalPrice: t.original_price || "",
            offerText: t.offer_text || "",
            offerTextColor: t.offer_text_color || "",
            offerBgColor: t.offer_bg_color || "",
            offerAnimation: t.offer_animation || "none",
            page: t.page || "ai",
            is_slider_enabled: t.is_slider_enabled || false,
            slider_milestones: Array.isArray(t.slider_milestones) 
              ? t.slider_milestones 
              : (typeof t.slider_milestones === "string" 
                  ? (() => { try { return JSON.parse(t.slider_milestones); } catch (e) { return []; } })()
                  : []),
          }));
          setPricingTiers(mappedTiers);
          localStorage.setItem("bhakty_pricing_tiers", JSON.stringify(mappedTiers));
        }

        if (!tabsError && tabsData && tabsData.length > 0) {
          const mappedTabs: PortfolioTab[] = tabsData.map((t) => ({
            id: t.id,
            tab_title: t.tab_title,
            tab_type: t.tab_type as "video" | "image",
            page: t.page || "ai",
            display_order: t.display_order || 0
          }));
          setPortfolioTabs(mappedTabs);
          localStorage.setItem("bhakty_portfolio_tabs", JSON.stringify(mappedTabs));
        } else if (!tabsData || tabsData.length === 0) {
          setPortfolioTabs(DEFAULT_PORTFOLIO_TABS);
          localStorage.setItem("bhakty_portfolio_tabs", JSON.stringify(DEFAULT_PORTFOLIO_TABS));
        }

        success = true;
      } catch (err) {
        console.warn("Could not load from Supabase database tables.", err);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshAllData = async () => {
    await loadData();
  };

  // 1. UPDATE SINGLE SITE SETTING
  const updateSiteSetting = async (key: string, value: string): Promise<boolean> => {
    setSiteSettings((prev) => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem("bhakty_site_settings", JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value }, { onConflict: "key" });
        if (error) {
          console.error("Supabase upsert setting error:", error);
          throw new Error(error.message);
        }
      } catch (e) {
        console.error("Supabase upsert setting exception:", e);
        throw e;
      }
    }
    return true;
  };

  // UPDATE MULTIPLE SITE SETTINGS BULK
  const updateMultipleSiteSettings = async (settings: SiteSettings): Promise<boolean> => {
    setSiteSettings((prev) => {
      const updated = { ...prev, ...settings };
      localStorage.setItem("bhakty_site_settings", JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
        const { error } = await supabase
          .from("site_settings")
          .upsert(rows, { onConflict: "key" });
        if (error) {
          console.error("Supabase bulk upsert settings error:", error);
          throw new Error(error.message);
        }
      } catch (e) {
        console.error("Supabase bulk upsert settings exception:", e);
        throw e;
      }
    }
    return true;
  };

  // 2. UPDATE ALL NAVIGATION MENU
  const updateNavigationMenu = async (menuItems: NavigationMenuItem[]): Promise<boolean> => {
    setNavigationMenu(menuItems);
    localStorage.setItem("bhakty_navigation_menu", JSON.stringify(menuItems));

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list
        const activeIds = menuItems.map(item => item.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase.from("navigation_menu").delete().not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase.from("navigation_menu").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (delErr) throw new Error(delErr.message);
        }

        for (const item of menuItems) {
          const payload: any = {
            label: item.label,
            target_url: item.target_url,
            display_order: item.display_order
          };
          let saveErr;
          if (isValidUUID(item.id)) {
            payload.id = item.id;
            const { error } = await supabase.from("navigation_menu").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("navigation_menu").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update menu items error", e);
        throw e;
      }
    }
    return true;
  };

  // 3. UPDATE PORTFOLIO WORKS
  const updatePortfolioWorks = async (works: VideoBlock[]): Promise<boolean> => {
    const taggedWorks = works.map(w => ({ ...w, page: activePage }));
    setPortfolioWorks(prev => {
      const otherPageWorks = prev.filter(w => (w.page || "ai") !== activePage);
      return [...otherPageWorks, ...taggedWorks];
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list for this page
        const activeIds = works.map(w => w.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase
            .from("portfolio_works")
            .delete()
            .eq("page", activePage)
            .not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase
            .from("portfolio_works")
            .delete()
            .eq("page", activePage);
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < works.length; i++) {
          const w = works[i];
          const payload: any = {
            title: w.title,
            category: w.category,
            video_url: w.videoUrl || "",
            high_res_video_url: w.highResVideoUrl || "",
            description: w.description || "",
            creator: w.creator || "bhakty.synth",
            duration: w.duration || "0:15",
            ratio: w.ratio || "landscape",
            aspect_ratio_class: w.aspectRatioClass || "aspect-video md:col-span-2",
            tags: w.tags || [],
            type: w.type || "video",
            image_url: w.imageUrl || "",
            subtext: w.subtext || "",
            page: activePage,
            display_order: i + 1,
            tab_id: w.tab_id || null
          };
          let saveErr;
          if (isValidUUID(w.id)) {
            payload.id = w.id;
            const { error } = await supabase.from("portfolio_works").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("portfolio_works").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update portfolio works error", e);
        throw e;
      }
    }
    return true;
  };

  // 4. UPDATE PRICING TIERS
  const updatePricingTiers = async (tiers: PricingTier[]): Promise<boolean> => {
    const taggedTiers = tiers.map(t => ({ ...t, page: activePage }));
    setPricingTiers(prev => {
      const otherPageTiers = prev.filter(t => (t.page || "ai") !== activePage);
      const updated = [...otherPageTiers, ...taggedTiers];
      localStorage.setItem("bhakty_pricing_tiers", JSON.stringify(updated));
      return updated;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list for this page
        const activeIds = tiers.map(t => t.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase
            .from("pricing_tiers")
            .delete()
            .eq("page", activePage)
            .not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase
            .from("pricing_tiers")
            .delete()
            .eq("page", activePage);
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i];
          const payload: any = {
            tier_name: t.name,
            tagline: t.tagline,
            price: t.price,
            period: t.period,
            popular: t.popular,
            features: t.deliverables,
            button_label: t.buttonLabel || (t.name === "Short-Form Creative" ? "Acquire Creative Pipeline" : (t.name === "Full Cinematic Studio" ? "Acquire Studio spot" : "Acquire Enterprise access")),
            button_color: t.buttonColor || "",
            button_text_color: t.buttonTextColor || "",
            discount_enabled: t.discountEnabled || false,
            discount_text: t.discountText || "",
            original_price: t.originalPrice || "",
            turnaround: t.turnaround,
            revision_round: t.revisionRound,
            glow_theme: t.glowTheme,
            offer_text: t.offerText || "",
            offer_text_color: t.offerTextColor || "",
            offer_bg_color: t.offerBgColor || "",
            offer_animation: t.offerAnimation || "none",
            page: activePage,
            display_order: i + 1,
            is_slider_enabled: t.is_slider_enabled || false,
            slider_milestones: t.slider_milestones || []
          };
          let saveErr;
          if (isValidUUID(t.id)) {
            payload.id = t.id;
            const { error } = await supabase.from("pricing_tiers").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("pricing_tiers").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update pricing tiers error", e);
        throw e;
      }
    }
    return true;
  };

  // 4b. UPDATE PORTFOLIO TABS
  const updatePortfolioTabs = async (tabs: PortfolioTab[]): Promise<boolean> => {
    const taggedTabs = tabs.map((t, idx) => ({ ...t, page: activePage, display_order: idx + 1 }));
    setPortfolioTabs(prev => {
      const otherPageTabs = prev.filter(t => (t.page || "ai") !== activePage);
      const merged = [...otherPageTabs, ...taggedTabs].sort((a, b) => a.display_order - b.display_order);
      localStorage.setItem("bhakty_portfolio_tabs", JSON.stringify(merged));
      return merged;
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list for this page
        const activeIds = tabs.map(t => t.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase
            .from("portfolio_tabs")
            .delete()
            .eq("page", activePage)
            .not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase
            .from("portfolio_tabs")
            .delete()
            .eq("page", activePage);
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < tabs.length; i++) {
          const t = tabs[i];
          const payload: any = {
            tab_title: t.tab_title,
            tab_type: t.tab_type,
            page: activePage,
            display_order: i + 1
          };
          let saveErr;
          if (isValidUUID(t.id)) {
            payload.id = t.id;
            const { error } = await supabase.from("portfolio_tabs").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("portfolio_tabs").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update portfolio tabs error", e);
        throw e;
      }
    }
    return true;
  };

  // 5. ADD MEDIA ASSET
  const addMediaAsset = async (name: string, url: string, type: "image" | "video"): Promise<MediaAsset | null> => {
    const newId = `asset-${Date.now()}`;
    const newAsset: MediaAsset = {
      id: newId,
      name,
      url,
      type,
      created_at: new Date().toISOString()
    };

    const updated = [newAsset, ...mediaAssets];
    setMediaAssets(updated);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("media_assets")
          .insert({ name, url, type })
          .select();

        if (error) {
          console.error("Supabase insert media asset error:", error);
          throw new Error(error.message);
        }

        if (data && data.length > 0) {
          const dbAsset: MediaAsset = {
            id: data[0].id,
            name: data[0].name,
            url: data[0].url,
            type: data[0].type as "image" | "video",
            created_at: data[0].created_at
          };
          setMediaAssets((prev) => [dbAsset, ...prev.filter((a) => a.id !== newId)]);
          return dbAsset;
        }
      } catch (e) {
        console.error("Supabase insert media asset exception:", e);
        throw e;
      }
    }
    return newAsset;
  };

  // 6. DELETE MEDIA ASSET
  const deleteMediaAsset = async (id: string): Promise<boolean> => {
    const updated = mediaAssets.filter((item) => item.id !== id);
    setMediaAssets(updated);

    if (isSupabaseConfigured && supabase && isValidUUID(id)) {
      try {
        const { error } = await supabase
          .from("media_assets")
          .delete()
          .eq("id", id);
        if (error) {
          console.error("Supabase delete media asset error:", error);
          throw new Error(error.message);
        }
      } catch (e) {
        console.error("Supabase delete media asset exception:", e);
        throw e;
      }
    }
    return true;
  };

  // 7. UPDATE BRAND LOGOS
  const updateBrandLogos = async (logos: BrandLogo[]): Promise<boolean> => {
    const taggedLogos = logos.map(l => ({ ...l, page: "ai" }));
    setBrandLogos(prev => {
      const otherPageLogos = prev.filter(l => (l.page || "ai") !== "ai");
      return [...otherPageLogos, ...taggedLogos];
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const activeIds = logos.map(l => l.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase
            .from("brand_logos")
            .delete()
            .eq("page", "ai")
            .not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase
            .from("brand_logos")
            .delete()
            .eq("page", "ai");
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < logos.length; i++) {
          const l = logos[i];
          const payload: any = {
            url: l.url,
            name: l.name || "",
            page: "ai",
            display_order: i + 1,
          };
          let saveErr;
          if (isValidUUID(l.id)) {
            payload.id = l.id;
            const { error } = await supabase.from("brand_logos").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("brand_logos").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update brand logos error", e);
        throw e;
      }
    }
    return true;
  };

  // 8. UPDATE TESTIMONIALS
  const updateTestimonials = async (items: Testimonial[]): Promise<boolean> => {
    setTestimonials(items);

    if (isSupabaseConfigured && supabase) {
      try {
        const activeIds = items.map(t => t.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase.from("testimonials").delete().not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase.from("testimonials").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (delErr) throw new Error(delErr.message);
        }

        for (let i = 0; i < items.length; i++) {
          const t = items[i];
          const payload: any = {
            client_name: t.client_name,
            role: t.role || "",
            company: t.company || "",
            text: t.text,
            video_url: t.video_url || "",
            rating: t.rating || 5,
            display_order: i + 1,
          };
          let saveErr;
          if (isValidUUID(t.id)) {
            payload.id = t.id;
            const { error } = await supabase.from("testimonials").upsert(payload, { onConflict: "id" });
            saveErr = error;
          } else {
            const { error } = await supabase.from("testimonials").insert(payload);
            saveErr = error;
          }
          if (saveErr) throw new Error(saveErr.message);
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update testimonials error", e);
        throw e;
      }
    }
    return true;
  };

  // Memoize filtered arrays to avoid reference changes on every provider render
  const filteredWorks = React.useMemo(() => portfolioWorks.filter((w) => (w.page || "ai") === activePage), [portfolioWorks, activePage]);
  const filteredTiers = React.useMemo(() => pricingTiers.filter((t) => (t.page || "ai") === activePage), [pricingTiers, activePage]);
  const filteredTabs = React.useMemo(() => portfolioTabs.filter((t) => (t.page || "ai") === activePage), [portfolioTabs, activePage]);
  const filteredLogos = React.useMemo(() => brandLogos.filter((l) => (l.page || "ai") === "ai"), [brandLogos]);

  // Memoize the full context value object
  const contextValue = React.useMemo(() => ({
    isLoading,
    activePage,
    setActivePage,
    siteSettings,
    navigationMenu,
    portfolioWorks: filteredWorks,
    pricingTiers: filteredTiers,
    portfolioTabs: filteredTabs,
    isUsingSupabase: isSupabaseConfigured,
    mediaAssets,
    brandLogos: filteredLogos,
    testimonials,
    refreshAllData,
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
  }), [
    isLoading,
    activePage,
    siteSettings,
    navigationMenu,
    filteredWorks,
    filteredTiers,
    filteredTabs,
    filteredLogos,
    testimonials,
    mediaAssets
  ]);

  return (
    <SiteDataContext.Provider value={contextValue}>
      {children}
    </SiteDataContext.Provider>
  );
};

export const useSiteData = () => {
  const context = useContext(SiteDataContext);
  if (context === undefined) {
    throw new Error("useSiteData must be used within a SiteDataProvider");
  }
  return context;
};
