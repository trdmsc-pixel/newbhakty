import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { VideoBlock, PricingTier } from "../types";
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

interface SiteDataContextProps {
  isLoading: boolean;
  siteSettings: SiteSettings;
  navigationMenu: NavigationMenuItem[];
  portfolioWorks: VideoBlock[];
  pricingTiers: PricingTier[];
  isUsingSupabase: boolean;
  mediaAssets: MediaAsset[];
  refreshAllData: () => Promise<void>;
  updateSiteSetting: (key: string, value: string) => Promise<boolean>;
  updateMultipleSiteSettings: (settings: SiteSettings) => Promise<boolean>;
  updateNavigationMenu: (menuItems: NavigationMenuItem[]) => Promise<boolean>;
  updatePortfolioWorks: (works: VideoBlock[]) => Promise<boolean>;
  updatePricingTiers: (tiers: PricingTier[]) => Promise<boolean>;
  addMediaAsset: (name: string, url: string, type: "image" | "video") => Promise<MediaAsset | null>;
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
    id: "asset-1",
    name: "Deep Space Particle Loop",
    url: "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4",
    type: "video"
  },
  {
    id: "asset-2",
    name: "Nebula Ocean Waves Loop",
    url: "https://assets.mixkit.co/videos/preview/mixkit-wave-looping-glowing-underwater-science-background-48282-large.mp4",
    type: "video"
  },
  {
    id: "asset-3",
    name: "Studio Aura Cover Image",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    type: "image"
  },
  {
    id: "asset-4",
    name: "Futuristic Glass Abstract Logo",
    url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=150&h=150&q=80",
    type: "image"
  }
];

export const SiteDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Synchronous local storage initializers to eliminate initial rendering flash and timing races
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [navigationMenu, setNavigationMenu] = useState<NavigationMenuItem[]>(DEFAULT_NAVIGATION_MENU);
  const [portfolioWorks, setPortfolioWorks] = useState<VideoBlock[]>(PORTFOLIO_VIDEOS);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>(PRICING_TIERS);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(DEFAULT_MEDIA_ASSETS);

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

        // If queries succeeded, update state
        if (!settingsError && settingsData && settingsData.length > 0) {
          const settingsObj: SiteSettings = {};
          settingsData.forEach((item) => {
            settingsObj[item.key] = item.value;
          });
          const merged = { ...DEFAULT_SITE_SETTINGS, ...settingsObj };
          setSiteSettings(merged);
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
    setSiteSettings((prev) => ({ ...prev, [key]: value }));

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
    setSiteSettings((prev) => ({ ...prev, ...settings }));

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
    setPortfolioWorks(works);

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list
        const activeIds = works.map(w => w.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase.from("portfolio_works").delete().not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase.from("portfolio_works").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (delErr) throw new Error(delErr.message);
        }

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
    setPricingTiers(tiers);

    if (isSupabaseConfigured && supabase) {
      try {
        // First delete any items not in the updated list
        const activeIds = tiers.map(t => t.id).filter(isValidUUID);
        if (activeIds.length > 0) {
          const { error: delErr } = await supabase.from("pricing_tiers").delete().not("id", "in", `(${activeIds.join(",")})`);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { error: delErr } = await supabase.from("pricing_tiers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
            button_label: t.name === "Short-Form Creative" ? "Acquire Creative Pipeline" : (t.name === "Full Cinematic Studio" ? "Acquire Studio spot" : "Acquire Enterprise access"),
            turnaround: t.turnaround,
            revision_round: t.revisionRound,
            glow_theme: t.glowTheme,
            display_order: i + 1
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

  return (
    <SiteDataContext.Provider
      value={{
        isLoading,
        siteSettings,
        navigationMenu,
        portfolioWorks,
        pricingTiers,
        isUsingSupabase: isSupabaseConfigured,
        mediaAssets,
        refreshAllData,
        updateSiteSetting,
        updateMultipleSiteSettings,
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
