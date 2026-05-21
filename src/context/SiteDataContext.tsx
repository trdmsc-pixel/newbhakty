import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { VideoBlock, PricingTier } from "../types";
import { PORTFOLIO_VIDEOS, PRICING_TIERS } from "../data";

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
  filename: string;
  url: string;
  cloudinary_public_id?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  tags: string[];
}

interface SiteDataContextProps {
  isLoading: boolean;
  siteSettings: SiteSettings;
  navigationMenu: NavigationMenuItem[];
  portfolioWorks: VideoBlock[];
  pricingTiers: PricingTier[];
  mediaAssets: MediaAsset[];
  isUsingSupabase: boolean;
  refreshAllData: () => Promise<void>;
  updateSiteSetting: (key: string, value: string) => Promise<boolean>;
  updateNavigationMenu: (menuItems: NavigationMenuItem[]) => Promise<boolean>;
  updatePortfolioWorks: (works: VideoBlock[]) => Promise<boolean>;
  updatePricingTiers: (tiers: PricingTier[]) => Promise<boolean>;
  addMediaAsset: (asset: Omit<MediaAsset, "id">) => Promise<MediaAsset | null>;
  deleteMediaAsset: (id: string) => Promise<boolean>;
}

const SiteDataContext = createContext<SiteDataContextProps | undefined>(undefined);

// Initial fallback/default site settings
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hero_badge_text: "Synthetic Arts Studio v4.1",
  hero_title_1: "The Next Epoch",
  hero_title_2: "of Cinema.",
  hero_title_3: "Synthesized.",
  hero_description: "We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers. From prompt orchestration to temporal coherence upscaling, bhakty.studio redefines moving media.",
  hero_cta_booking_text: "Book Creative Spot",
  hero_cta_work_text: "Explore Curation",
  hero_stat1_value: "400+",
  hero_stat1_label: "Synth Hours",
  hero_stat2_value: "8K UHD",
  hero_stat2_label: "Upscale Target",
  hero_stat3_value: "0%",
  hero_stat3_label: "Physical Camera",
  hero_video_bg_url: "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
  footer_copyright: "© 2026 bhakty.studio. Generative Temporal Coherence in Aesthetics.",
};

const DEFAULT_NAVIGATION_MENU: NavigationMenuItem[] = [
  { id: "menu-work", label: "Our Work", target_url: "work-section", display_order: 1 },
  { id: "menu-packages", label: "Production Tiers", target_url: "pricing-section", display_order: 2 }
];

const DEFAULT_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: "default-asset-1",
    filename: "Deep Space Particle Loop",
    url: "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
    mime_type: "video/mp4",
    tags: ["video", "background"]
  },
  {
    id: "default-asset-2",
    filename: "Studio Aura Cover Image",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    mime_type: "image/jpeg",
    tags: ["image", "cover"]
  }
];

export const SiteDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [navigationMenu, setNavigationMenu] = useState<NavigationMenuItem[]>(DEFAULT_NAVIGATION_MENU);
  const [portfolioWorks, setPortfolioWorks] = useState<VideoBlock[]>(PORTFOLIO_VIDEOS);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(PRICING_TIERS);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(DEFAULT_MEDIA_ASSETS);

  // Load from Supabase or LocalStorage cache
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

        // Fetch Pricing Tiers
        const { data: pricingData, error: pricingError } = await supabase
          .from("pricing_tiers")
          .select("*")
          .order("display_order", { ascending: true });

        // Fetch Media Assets
        const { data: assetsData, error: assetsError } = await supabase
          .from("media_assets")
          .select("*")
          .order("created_at", { ascending: false });

        if (!settingsError && settingsData) {
          const settingsObj: SiteSettings = {};
          settingsData.forEach((item) => {
            settingsObj[item.key] = item.value;
          });
          // Merge with defaults to ensure all keys exist
          setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...settingsObj });
        }

        if (!menuError && menuData && menuData.length > 0) {
          setNavigationMenu(menuData);
        }

        if (!worksError && worksData && worksData.length > 0) {
          const mappedWorks: VideoBlock[] = worksData.map((w) => ({
            id: w.id,
            title: w.title,
            category: w.category,
            videoUrl: w.video_url,
            highResVideoUrl: w.high_res_video_url || w.video_url,
            description: w.description,
            creator: w.creator || "bhakty.synth",
            duration: w.duration || "0:15",
            ratio: (w.ratio as any) || "landscape",
            aspectRatioClass: w.aspect_ratio_class || "aspect-video md:col-span-2",
            tags: Array.isArray(w.tags) ? w.tags : JSON.parse(w.tags || "[]")
          }));
          setPortfolioWorks(mappedWorks);
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
            glowTheme: (t.glow_theme as any) || "saffron"
          }));
          setPricingTiers(mappedTiers);
        }

        if (!assetsError && assetsData && assetsData.length > 0) {
          const mappedAssets: MediaAsset[] = assetsData.map((a) => ({
            id: a.id,
            filename: a.filename,
            url: a.url,
            cloudinary_public_id: a.cloudinary_public_id || undefined,
            mime_type: a.mime_type || undefined,
            file_size: a.file_size || undefined,
            width: a.width || undefined,
            height: a.height || undefined,
            tags: Array.isArray(a.tags) ? a.tags : []
          }));
          setMediaAssets(mappedAssets);
        }

        success = true;
      } catch (err) {
        console.warn("Could not load from Supabase database tables. Falling back to local storage.", err);
      }
    }

    if (!success) {
      // LocalStorage Cache Driver
      const cachedSettings = localStorage.getItem("bhakty_site_settings");
      if (cachedSettings) {
        try { setSiteSettings(JSON.parse(cachedSettings)); } catch {}
      }

      const cachedMenu = localStorage.getItem("bhakty_navigation_menu");
      if (cachedMenu) {
        try { setNavigationMenu(JSON.parse(cachedMenu)); } catch {}
      }

      const cachedWorks = localStorage.getItem("bhakty_portfolio_works");
      if (cachedWorks) {
        try { setPortfolioWorks(JSON.parse(cachedWorks)); } catch {}
      }

      const cachedPricing = localStorage.getItem("bhakty_pricing_tiers");
      if (cachedPricing) {
        try { setPricingTiers(JSON.parse(cachedPricing)); } catch {}
      }

      const cachedAssets = localStorage.getItem("bhakty_media_assets");
      if (cachedAssets) {
        try { setMediaAssets(JSON.parse(cachedAssets)); } catch {}
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
    const updatedSettings = { ...siteSettings, [key]: value };
    setSiteSettings(updatedSettings);
    localStorage.setItem("bhakty_site_settings", JSON.stringify(updatedSettings));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from("site_settings")
          .upsert({ key, value }, { onConflict: "key" });
        return !error;
      } catch (e) {
        console.error("Supabase upsert setting error", e);
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
        // Simple way: clear and write again, or save individually
        for (const item of menuItems) {
          const payload: any = {
            label: item.label,
            target_url: item.target_url,
            display_order: item.display_order
          };
          // If UUID looks generated, preserve it, else let supabase generate
          if (item.id && !item.id.startsWith("menu-")) {
            payload.id = item.id;
          }
          await supabase.from("navigation_menu").upsert(payload, { onConflict: "id" });
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update menu items error", e);
      }
    }
    return true;
  };

  // 3. UPDATE PORTFOLIO WORKS
  const updatePortfolioWorks = async (works: VideoBlock[]): Promise<boolean> => {
    setPortfolioWorks(works);
    localStorage.setItem("bhakty_portfolio_works", JSON.stringify(works));

    if (isSupabaseConfigured && supabase) {
      try {
        for (let i = 0; i < works.length; i++) {
          const w = works[i];
          const payload: any = {
            title: w.title,
            category: w.category,
            video_url: w.videoUrl,
            high_res_video_url: w.highResVideoUrl,
            description: w.description,
            creator: w.creator,
            duration: w.duration,
            ratio: w.ratio,
            aspect_ratio_class: w.aspectRatioClass,
            tags: w.tags,
            display_order: i + 1
          };
          // If valid uuid (more than 24 chars / has dashes) use it
          if (w.id.includes("-") && w.id.length > 15) {
            payload.id = w.id;
          }
          await supabase.from("portfolio_works").upsert(payload, { onConflict: "id" });
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update portfolio works error", e);
      }
    }
    return true;
  };

  // 4. UPDATE PRICING TIERS
  const updatePricingTiers = async (tiers: PricingTier[]): Promise<boolean> => {
    setPricingTiers(tiers);
    localStorage.setItem("bhakty_pricing_tiers", JSON.stringify(tiers));

    if (isSupabaseConfigured && supabase) {
      try {
        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i];
          const payload: any = {
            tier_name: t.name,
            tagline: t.tagline,
            price: t.price,
            period: t.period,
            popular: t.popular,
            features: t.deliverables,
            button_label: t.name === "Short-Form Creative" ? "Acquire Creative Pipeline" : (t.name === "Full Cinematic Studio" ? "Acquire Studio spot" : "Acquire Enterprise access"),
            turnaround: t.turnaround,
            revision_round: t.revisionRound,
            glow_theme: t.glowTheme,
            display_order: i + 1
          };
          if (t.id.includes("-") && t.id.length > 15) {
            payload.id = t.id;
          }
          await supabase.from("pricing_tiers").upsert(payload, { onConflict: "id" });
        }
        await loadData(true);
        return true;
      } catch (e) {
        console.error("Supabase update pricing tiers error", e);
      }
    }
    return true;
  };

  // 5. ADD MEDIA ASSET
  const addMediaAsset = async (asset: Omit<MediaAsset, "id">): Promise<MediaAsset | null> => {
    const tempId = `asset-${Date.now()}`;
    const newAsset: MediaAsset = { id: tempId, ...asset };

    // Optimistic update
    setMediaAssets(prev => [newAsset, ...prev]);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from("media_assets")
          .insert({
            filename: asset.filename,
            url: asset.url,
            cloudinary_public_id: asset.cloudinary_public_id || null,
            mime_type: asset.mime_type || null,
            file_size: asset.file_size || null,
            width: asset.width || null,
            height: asset.height || null,
            tags: asset.tags || [],
          })
          .select()
          .single();

        if (error) {
          console.error("Supabase insert media_asset error:", error);
          // Rollback optimistic update
          setMediaAssets(prev => prev.filter(a => a.id !== tempId));
          return null;
        }

        // Replace temp ID with real Supabase ID
        const realAsset: MediaAsset = {
          id: data.id,
          filename: data.filename,
          url: data.url,
          cloudinary_public_id: data.cloudinary_public_id || undefined,
          mime_type: data.mime_type || undefined,
          file_size: data.file_size || undefined,
          width: data.width || undefined,
          height: data.height || undefined,
          tags: Array.isArray(data.tags) ? data.tags : [],
        };
        setMediaAssets(prev => prev.map(a => a.id === tempId ? realAsset : a));

        // Also sync localStorage
        const currentAssets = JSON.parse(localStorage.getItem("bhakty_media_assets") || "[]");
        localStorage.setItem("bhakty_media_assets", JSON.stringify([realAsset, ...currentAssets]));

        return realAsset;
      } catch (e) {
        console.error("Error adding media asset:", e);
        setMediaAssets(prev => prev.filter(a => a.id !== tempId));
        return null;
      }
    }

    // LocalStorage fallback
    const currentAssets = JSON.parse(localStorage.getItem("bhakty_media_assets") || "[]");
    localStorage.setItem("bhakty_media_assets", JSON.stringify([newAsset, ...currentAssets]));
    return newAsset;
  };

  // 6. DELETE MEDIA ASSET
  const deleteMediaAsset = async (id: string): Promise<boolean> => {
    // Optimistic update
    setMediaAssets(prev => prev.filter(a => a.id !== id));

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from("media_assets").delete().eq("id", id);
        if (error) {
          console.error("Supabase delete media_asset error:", error);
          // Reload to restore state
          await loadData(true);
          return false;
        }
      } catch (e) {
        console.error("Error deleting media asset:", e);
        await loadData(true);
        return false;
      }
    }

    // LocalStorage sync
    const currentAssets = JSON.parse(localStorage.getItem("bhakty_media_assets") || "[]");
    localStorage.setItem("bhakty_media_assets", JSON.stringify(currentAssets.filter((a: any) => a.id !== id)));
    return true;
  };

  return (
    <SiteDataContext.Provider
      value={{
        isLoading,
        siteSettings,
        navigationMenu,
        portfolioWorks,
        pricingTiers,
        mediaAssets,
        isUsingSupabase: isSupabaseConfigured,
        refreshAllData,
        updateSiteSetting,
        updateNavigationMenu,
        updatePortfolioWorks,
        updatePricingTiers,
        addMediaAsset,
        deleteMediaAsset,
      }}
    >
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
