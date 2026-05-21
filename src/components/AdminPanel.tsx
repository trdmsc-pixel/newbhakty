import React, { useState } from "react";
import { motion } from "motion/react";
import { useSiteData, NavigationMenuItem } from "../context/SiteDataContext";
import { supabase } from "../lib/supabase";
import { VideoBlock, PricingTier } from "../types";
import BackgroundGradients from "./BackgroundGradients";
import { 
  Lock, Settings, Compass, HelpCircle, 
  Plus, Trash2, ArrowUp, ArrowDown, Save, 
  Upload, AlertTriangle, ArrowRight, ShieldCheck, Check, Edit2, Play, PlusCircle
} from "lucide-react";

export default function AdminPanel({ onNavigateHome }: { onNavigateHome: () => void }) {
  const {
    siteSettings,
    navigationMenu,
    portfolioWorks,
    pricingTiers,
    isUsingSupabase,
    updateSiteSetting,
    updateNavigationMenu,
    updatePortfolioWorks,
    updatePricingTiers,
  } = useSiteData();

  // Authentication State
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const envPass = import.meta.env.VITE_ADMIN_PASSWORD || "admin_bhakty_studio";
    if (password === envPass) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Unauthorized access key. Please verify security password.");
    }
  };

  // UI Navigation state
  const [activeTab, setActiveTab] = useState<"settings" | "navigation" | "portfolio" | "pricing" | "assets">("settings");
  const [saveStatus, setSaveStatus] = useState<{ [tab: string]: "idle" | "saving" | "saved" | "error" }>({
    settings: "idle",
    navigation: "idle",
    portfolio: "idle",
    pricing: "idle",
    assets: "idle",
  });

  // ----------------------------------------------------
  // TAB 5: GLOBAL ASSETS STATE & HANDLERS
  // ----------------------------------------------------
  const DEFAULT_ASSETS = [
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

  const getInitialAssets = () => {
    if (siteSettings.registered_assets) {
      try {
        return JSON.parse(siteSettings.registered_assets);
      } catch (err) {
        console.warn("Could not parse registered_assets, returning defaults", err);
      }
    }
    return DEFAULT_ASSETS;
  };

  const [assets, setAssets] = useState<{ id: string; name: string; url: string; type: string }[]>(getInitialAssets());
  const [newAssetUrl, setNewAssetUrl] = useState("");
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("image");
  const [localUploadProgress, setLocalUploadProgress] = useState("");

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setLocalUploadProgress(`Configuring binary stream: ${file.name}...`);

    let finalUrl = "";
    const fileType = file.type.startsWith("video/") ? "video" : "image";

    if (isUsingSupabase && supabase) {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `assets/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("bhakty-media")
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("bhakty-media")
          .getPublicUrl(filePath);

        finalUrl = publicUrl;
        setLocalUploadProgress("File uploaded successfully to 'bhakty-media' bucket!");
        setTimeout(() => setLocalUploadProgress(""), 4000);
      } catch (err: any) {
        setLocalUploadProgress(`Storage upload failure: ${err?.message || "Verify bucket setup."}`);
        setTimeout(() => setLocalUploadProgress(""), 8000);
        return;
      }
    } else {
      finalUrl = URL.createObjectURL(file);
      setLocalUploadProgress("Resource loaded locally! (Connect Supabase to persist files globally).");
      setTimeout(() => setLocalUploadProgress(""), 5000);
    }

    if (finalUrl) {
      const newAsset = {
        id: `asset-${Date.now()}`,
        name: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
        url: finalUrl,
        type: fileType
      };
      const updatedAssets = [...assets, newAsset];
      setAssets(updatedAssets);
      updateSiteSetting("registered_assets", JSON.stringify(updatedAssets));
    }
  };

  const handleAddCustomAsset = () => {
    if (!newAssetUrl || !newAssetName) return;
    const cleanUrl = newAssetUrl.trim();
    const cleanName = newAssetName.trim();
    const newAsset = {
      id: `asset-${Date.now()}`,
      name: cleanName,
      url: cleanUrl,
      type: newAssetType
    };
    const updatedAssets = [...assets, newAsset];
    setAssets(updatedAssets);
    updateSiteSetting("registered_assets", JSON.stringify(updatedAssets));
    setNewAssetUrl("");
    setNewAssetName("");
  };

  const handleDeleteAsset = (id: string) => {
    const updated = assets.filter(item => item.id !== id);
    setAssets(updated);
    updateSiteSetting("registered_assets", JSON.stringify(updated));
  };

  const handleSelectAssetForSetting = async (assetUrl: string, targetSetting: "hero_video_bg_url" | "logo_img_url") => {
    setSaveStatus(prev => ({ ...prev, assets: "saving" }));
    try {
      if (targetSetting === "hero_video_bg_url") {
        setEditSettings(p => ({ ...p, hero_video_bg_url: assetUrl }));
      } else if (targetSetting === "logo_img_url") {
        setEditSettings(p => ({ ...p, logo_img_url: assetUrl }));
      }
      
      const success = await updateSiteSetting(targetSetting, assetUrl);
      if (success) {
        setSaveStatus(prev => ({ ...prev, assets: "saved" }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, assets: "idle" })), 3000);
      } else {
        setSaveStatus(prev => ({ ...prev, assets: "error" }));
      }
    } catch {
      setSaveStatus(prev => ({ ...prev, assets: "error" }));
    }
  };

  const getStatusText = (tab: string) => {
    switch (saveStatus[tab]) {
      case "saving": return "Writing changes...";
      case "saved": return "Changes synchronized successfully!";
      case "error": return "Synchronization Error.";
      default: return "";
    }
  };

  // ----------------------------------------------------
  // TAB 1: SITE SETTINGS STATE & HANDLERS
  // ----------------------------------------------------
  const [editSettings, setEditSettings] = useState({ ...siteSettings });
  
  const handleSettingChange = (key: string, value: string) => {
    setEditSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaveStatus(prev => ({ ...prev, settings: "saving" }));
    try {
      for (const [key, val] of Object.entries(editSettings)) {
        await updateSiteSetting(key, val);
      }
      setSaveStatus(prev => ({ ...prev, settings: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, settings: "idle" })), 3000);
    } catch {
      setSaveStatus(prev => ({ ...prev, settings: "error" }));
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
    const newItem: NavigationMenuItem = {
      id: `menu-new-${Date.now()}`,
      label: "New section",
      target_url: "booking-section",
      display_order: editMenu.length + 1
    };
    setEditMenu(prev => [...prev, newItem]);
  };

  const deleteMenuItem = (id: string) => {
    setEditMenu(prev => prev.filter(item => item.id !== id).map((item, idx) => ({ ...item, display_order: idx + 1 })));
  };

  const saveMenu = async () => {
    setSaveStatus(prev => ({ ...prev, navigation: "saving" }));
    const success = await updateNavigationMenu(editMenu);
    if (success) {
      setSaveStatus(prev => ({ ...prev, navigation: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, navigation: "idle" })), 3000);
    } else {
      setSaveStatus(prev => ({ ...prev, navigation: "error" }));
    }
  };

  // ----------------------------------------------------
  // TAB 3: PORTFOLIO WORKS STATE & HANDLERS
  // ----------------------------------------------------
  const [editWorks, setEditWorks] = useState<VideoBlock[]>([...portfolioWorks]);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleWorkChange = (id: string, field: keyof VideoBlock, value: any) => {
    setEditWorks(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleTagsChange = (id: string, commaString: string) => {
    const tagsArr = commaString.split(",").map(t => t.trim()).filter(Boolean);
    handleWorkChange(id, "tags", tagsArr);
  };

  // Real Supabase storage uploader + simulated fallback
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>, workId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadProgress(`Configuring binary stream: ${file.name}...`);

    if (isUsingSupabase && supabase) {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        // Attempt direct bucket write inside Supabase storage 'bhakty-media'
        const { error: uploadError } = await supabase.storage
          .from("bhakty-media")
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("bhakty-media")
          .getPublicUrl(filePath);

        // Update video URL
        handleWorkChange(workId, "videoUrl", publicUrl);
        handleWorkChange(workId, "highResVideoUrl", publicUrl);
        setUploadProgress("Dynamic resource uploaded successfully to 'bhakty-media' bucket!");
        setTimeout(() => setUploadProgress(""), 4000);
      } catch (err: any) {
        setUploadProgress(`Storage upload failure: ${err?.message || "Verify your 'bhakty-media' bucket permissions."}`);
        setTimeout(() => setUploadProgress(""), 8000);
      }
    } else {
      // In Fallback environment, persist simulated assets
      const tempUrl = URL.createObjectURL(file);
      handleWorkChange(workId, "videoUrl", tempUrl);
      handleWorkChange(workId, "highResVideoUrl", tempUrl);
      setUploadProgress("Success: Resource loaded locally! (Connect Supabase to persist files globally).");
      setTimeout(() => setUploadProgress(""), 5000);
    }
  };

  const addWorkItem = () => {
    const newItem: VideoBlock = {
      id: `work-new-${Date.now()}`,
      title: "New Motion Piece",
      category: "AI Commercial / Fluid Dynamics",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
      highResVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4",
      description: "Generative media synthetics compiled organically.",
      creator: "bhakty.synth",
      duration: "0:15",
      ratio: "landscape",
      aspectRatioClass: "aspect-square md:col-span-1",
      tags: ["Fluid Simulation", "Neural Render"]
    };
    setEditWorks(prev => [...prev, newItem]);
  };

  const deleteWorkItem = (id: string) => {
    setEditWorks(prev => prev.filter(item => item.id !== id));
  };

  const moveWorkItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editWorks.length) return;

    const updated = [...editWorks];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setEditWorks(updated);
  };

  const saveWorks = async () => {
    setSaveStatus(prev => ({ ...prev, portfolio: "saving" }));
    const success = await updatePortfolioWorks(editWorks);
    if (success) {
      setSaveStatus(prev => ({ ...prev, portfolio: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, portfolio: "idle" })), 3000);
    } else {
      setSaveStatus(prev => ({ ...prev, portfolio: "error" }));
    }
  };

  // ----------------------------------------------------
  // TAB 4: PRICING TIERS STATE & HANDLERS
  // ----------------------------------------------------
  const [editPricing, setEditPricing] = useState<PricingTier[]>([...pricingTiers]);

  const handlePricingChange = (id: string, field: keyof PricingTier, value: any) => {
    setEditPricing(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
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
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, deliverables: [...item.deliverables, "New deliverable scope"] };
      }
      return item;
    }));
  };

  const deleteFeature = (id: string, index: number) => {
    setEditPricing(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, deliverables: item.deliverables.filter((_, idx) => idx !== index) };
      }
      return item;
    }));
  };

  const savePricing = async () => {
    setSaveStatus(prev => ({ ...prev, pricing: "saving" }));
    const success = await updatePricingTiers(editPricing);
    if (success) {
      setSaveStatus(prev => ({ ...prev, pricing: "saved" }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, pricing: "idle" })), 3000);
    } else {
      setSaveStatus(prev => ({ ...prev, pricing: "error" }));
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
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#4A36B3] to-[#E6C687] flex items-center justify-center relative shadow-lg">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display font-medium text-2xl tracking-tight text-white italic">
              bhakty<span className="text-[#E6C687]">.</span>admin
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
                className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#E6C687]/50 focus:ring-1 focus:ring-[#E6C687]/30 transition-all font-mono"
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
              className="w-full py-3.5 rounded-xl bg-[#E6C687] text-black font-semibold font-display tracking-tight hover:shadow-lg hover:shadow-[#E6C687]/20 hover:bg-[#ebd5ad] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Sign In <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <button
              type="button"
              onClick={() => {
                window.location.hash = "";
                window.history.pushState({}, "", "/");
                onNavigateHome();
              }}
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
    <div className="min-h-screen bg-[#050508] text-white flex flex-col pt-24 pb-16 px-4 md:px-8 relative">
      <BackgroundGradients />

      <div className="max-w-7xl w-full mx-auto relative z-10">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 pb-8 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display font-medium text-2xl md:text-3xl tracking-tighter italic text-white">
                bhakty<span className="text-[#E6C687]">.</span>admin
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#E6C687] bg-[#E6C687]/5 border border-[#E6C687]/20 rounded-full px-2.5 py-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#E6C687]" /> Connected
              </span>
            </div>
            <p className="text-gray-400 text-sm font-light mt-1.5">
              Manage database settings, menu anchors, motion artifacts, and production price tiers.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isUsingSupabase ? (
              <span className="text-xs text-emerald-400 font-mono bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/10">
                ● Live Supabase Connected
              </span>
            ) : (
              <span className="text-xs text-amber-400 font-mono bg-amber-500/5 px-3 py-1.5 rounded-lg border border-amber-500/10" title="Values persist instantly in localStorage fallback driver">
                ▲ LocalStorage Database Engaged
              </span>
            )}
            
             <button
              type="button"
              onClick={() => {
                window.location.hash = "";
                window.history.pushState({}, "", "/");
                onNavigateHome();
              }}
              className="text-xs md:text-sm font-medium font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 px-5  py-2 rounded-xl text-white hover:border-[#E6C687]/40 hover:text-[#E6C687] transition-all cursor-pointer"
            >
              Exit to Studio
            </button>
          </div>
        </div>

        {/* WORKSPACE LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* SIDEBAR TABS */}
          <div className="lg:col-span-1 space-y-2">
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === "settings"
                  ? "bg-white text-black font-semibold"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4" /> Global Copy & Media
            </button>
            <button
              onClick={() => setActiveTab("navigation")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === "navigation"
                  ? "bg-white text-black font-semibold"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              <Compass className="w-4 h-4" /> Navigation Menu
            </button>
            <button
              onClick={() => setActiveTab("portfolio")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === "portfolio"
                  ? "bg-white text-black font-semibold"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              <Play className="w-4 h-4" /> Portfolio Manager
            </button>
            <button
              onClick={() => setActiveTab("pricing")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === "pricing"
                  ? "bg-white text-black font-semibold"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              <ArrowDown className="w-4 h-4 rotate-45" /> Pricing packages
            </button>

            <button
              onClick={() => setActiveTab("assets")}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium text-left transition-all ${
                activeTab === "assets"
                  ? "bg-white text-black font-semibold"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              <Upload className="w-4 h-4" /> Global Assets Manager
            </button>

            {/* QUICK SCHEMA INST INSTRUCTIONS */}
            <div className="pt-6 mt-6 border-t border-white/5">
              <div className="glass-panel p-4 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-gray-300 font-mono">
                  <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                  <span>Configuring Supabase</span>
                </div>
                <p className="text-gray-500 leading-relaxed">
                  Provide <code className="text-amber-200/90 font-mono">VITE_SUPABASE_URL</code> alongside keys inside <code className="text-amber-200/90 font-mono">.env</code> to redirect queries from fallback structures into Supabase cloud databases automatically.
                </p>
              </div>
            </div>
          </div>

          {/* EDIT ZONE */}
          <div className="lg:col-span-3">
            <div className="glass-panel p-6 md:p-8 rounded-3xl border border-white/10 min-h-[500px]">
              
              {/* TAB 1: SITE SETTINGS */}
              {activeTab === "settings" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <h2 className="font-display font-medium text-xl text-white">
                      Global Text Copy & Hero Configuration
                    </h2>
                    <button
                      onClick={saveSettings}
                      disabled={saveStatus.settings === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#E6C687] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#fadfa8] transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Synchronize settings
                    </button>
                  </div>

                  {getStatusText("settings") && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      saveStatus.settings === "saved" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {getStatusText("settings")}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Video Background Source (Looping)</label>
                      <input
                        type="text"
                        value={editSettings.hero_video_bg_url}
                        onChange={(e) => handleSettingChange("hero_video_bg_url", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Micro Badge Text</label>
                      <input
                        type="text"
                        value={editSettings.hero_badge_text}
                        onChange={(e) => handleSettingChange("hero_badge_text", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Footer Copyright Text</label>
                      <input
                        type="text"
                        value={editSettings.footer_copyright}
                        onChange={(e) => handleSettingChange("footer_copyright", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 1</label>
                      <input
                        type="text"
                        value={editSettings.hero_title_1}
                        onChange={(e) => handleSettingChange("hero_title_1", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 2 (Serif)</label>
                      <input
                        type="text"
                        value={editSettings.hero_title_2}
                        onChange={(e) => handleSettingChange("hero_title_2", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Header Line 3</label>
                      <input
                        type="text"
                        value={editSettings.hero_title_3}
                        onChange={(e) => handleSettingChange("hero_title_3", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Main CTA Button Label</label>
                      <input
                        type="text"
                        value={editSettings.hero_cta_booking_text}
                        onChange={(e) => handleSettingChange("hero_cta_booking_text", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-mono uppercase text-gray-500 mb-2">Hero Subtitle Paragraph Description</label>
                      <textarea
                        value={editSettings.hero_description}
                        onChange={(e) => handleSettingChange("hero_description", e.target.value)}
                        rows={4}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#E6C687]/40 resize-none"
                      />
                    </div>

                    {/* Stats */}
                    <div className="border-t border-white/5 pt-6 md:col-span-2 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 1 Value</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat1_value}
                          onChange={(e) => handleSettingChange("hero_stat1_value", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat1_label}
                          onChange={(e) => handleSettingChange("hero_stat1_label", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 2 Value</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat2_value}
                          onChange={(e) => handleSettingChange("hero_stat2_value", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat2_label}
                          onChange={(e) => handleSettingChange("hero_stat2_label", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Stat 3 Value</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat3_value}
                          onChange={(e) => handleSettingChange("hero_stat3_value", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                        <label className="block text-[8px] font-mono uppercase text-gray-600 mt-1">Label</label>
                        <input
                          type="text"
                          value={editSettings.hero_stat3_label}
                          onChange={(e) => handleSettingChange("hero_stat3_label", e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 2: NAVIGATION */}
              {activeTab === "navigation" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <h2 className="font-display font-medium text-xl text-white">
                      Navigation Link Anchors
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={addMenuItem}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Add Item
                      </button>
                      <button
                        onClick={saveMenu}
                        disabled={saveStatus.navigation === "saving"}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E6C687] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#fadfa8] transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Synchronize menu
                      </button>
                    </div>
                  </div>

                  {getStatusText("navigation") && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      saveStatus.navigation === "saved" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {getStatusText("navigation")}
                    </div>
                  )}

                  <div className="space-y-4">
                    {editMenu.map((item, index) => (
                      <div 
                        key={item.id}
                        className="flex flex-col md:flex-row items-center gap-4 bg-black/30 border border-white/5 rounded-2xl p-4"
                      >
                        <div className="flex items-center gap-2 shrink-0">
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
                            <input
                              type="text"
                              value={item.target_url}
                              onChange={(e) => handleMenuChange(item.id, "target_url", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => deleteMenuItem(item.id)}
                          className="p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/30 text-red-400 hover:text-red-300 mt-4 md:mt-0 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* TAB 3: PORTFOLIO WORKS */}
              {activeTab === "portfolio" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <h2 className="font-display font-medium text-xl text-white">
                      Portfolio motion Artifacts Manager
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={addWorkItem}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-xs md:text-sm cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-[#E6C687]" /> Synthesize Work Card
                      </button>
                      <button
                        onClick={saveWorks}
                        disabled={saveStatus.portfolio === "saving"}
                        className="flex items-center gap-2 px-4 py-2 bg-[#E6C687] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#fadfa8] transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" /> Sync Portfolio
                      </button>
                    </div>
                  </div>

                  {getStatusText("portfolio") && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      saveStatus.portfolio === "saved" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {getStatusText("portfolio")}
                    </div>
                  )}

                  {uploadProgress && (
                    <div className="p-3.5 rounded-xl text-xs bg-amber-500/10 border border-amber-500/20 text-amber-200 font-mono flex items-center gap-2">
                      <div className="animate-pulse w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span>{uploadProgress}</span>
                    </div>
                  )}

                  <div className="space-y-6">
                    {editWorks.map((work, index) => (
                      <div 
                        key={work.id}
                        className="bg-black/30 border border-white/5 rounded-2xl p-4 md:p-6 space-y-4"
                      >
                        {/* Title bar with drag handles */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-[#E6C687] font-semibold">Artifact 0{index + 1}</span>
                            <span className="text-sm font-medium text-gray-300">{work.title}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => moveWorkItem(index, "up")}
                              disabled={index === 0}
                              className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => moveWorkItem(index, "down")}
                              disabled={index === editWorks.length - 1}
                              className="p-1.5 rounded-lg border border-white/5 hover:bg-white/5 text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteWorkItem(work.id)}
                              className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 text-red-400 hover:text-red-300 transition-colors ml-2"
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
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Category Label</label>
                            <input
                              type="text"
                              value={work.category}
                              onChange={(e) => handleWorkChange(work.id, "category", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Tags (Comma Separated)</label>
                            <input
                              type="text"
                              value={work.tags.join(", ")}
                              onChange={(e) => handleTagsChange(work.id, e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                              placeholder="Fluid Simulation, Luxury, AI Render"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Custom Video Source Link (MP4 URL)</label>
                            <input
                              type="text"
                              value={work.videoUrl}
                              onChange={(e) => {
                                handleWorkChange(work.id, "videoUrl", e.target.value);
                                handleWorkChange(work.id, "highResVideoUrl", e.target.value);
                              }}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-mono"
                            />
                          </div>

                          {/* DUAL DRAG AND DROP UPLOADER ZONE */}
                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Upload File (Supabase Storage)</label>
                            <div className="relative border border-dashed border-white/10 hover:border-[#E6C687]/40 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-gray-400 hover:text-white transition-all cursor-pointer">
                              <div className="flex items-center gap-2">
                                <Upload className="w-3.5 h-3.5 text-gray-400" />
                                <span>Select or drop video track</span>
                              </div>
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => handleVideoUpload(e, work.id)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Short Description / Subtext</label>
                            <textarea
                              value={work.description}
                              onChange={(e) => handleWorkChange(work.id, "description", e.target.value)}
                              rows={2}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white resize-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Grid Layout Weight (Responsive)</label>
                            <select
                              value={work.aspectRatioClass}
                              onChange={(e) => handleWorkChange(work.id, "aspectRatioClass", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                            >
                              <option value="aspect-video md:col-span-2">Dynamic Wide (2 Grid Units)</option>
                              <option value="aspect-square md:col-span-1">Perfect Square (1 Grid Unit)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-gray-500 mb-1">Duration Indicator</label>
                            <input
                              type="text"
                              value={work.duration}
                              onChange={(e) => handleWorkChange(work.id, "duration", e.target.value)}
                              className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                              placeholder="0:15"
                            />
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

              {/* TAB 4: PRICING PACKAGES */}
              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <h2 className="font-display font-medium text-xl text-white">
                      Production Pricing packages
                    </h2>
                    <button
                      onClick={savePricing}
                      disabled={saveStatus.pricing === "saving"}
                      className="flex items-center gap-2 px-4 py-2 bg-[#E6C687] text-black text-xs md:text-sm font-semibold rounded-xl hover:bg-[#fadfa8] transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Sync Pricing
                    </button>
                  </div>

                  {getStatusText("pricing") && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      saveStatus.pricing === "saved" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {getStatusText("pricing")}
                    </div>
                  )}

                  <div className="space-y-8">
                    {editPricing.map((tier) => (
                      <div 
                        key={tier.id}
                        className="bg-black/30 border border-white/5 rounded-2xl p-6 space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{
                              backgroundColor: tier.glowTheme === "emerald" ? "#10b981" : (tier.glowTheme === "saffron" ? "#E6C687" : "#4A36B3")
                            }} />
                            <span className="font-display font-semibold text-lg text-white">{tier.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tier.popular}
                                onChange={(e) => handlePricingChange(tier.id, "popular", e.target.checked)}
                                className="rounded border-white/10 text-[#E6C687] focus:ring-0 bg-transparent"
                              />
                              Recommend Spotlight
                            </label>
                          </div>
                        </div>

                        {/* Text values */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        </div>

                        {/* List Inputs (Deliverables feature lists) */}
                        <div className="space-y-2 border-t border-white/5 pt-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase text-gray-400">Deliverables Deliverable Scope</span>
                            <button
                              onClick={() => addFeature(tier.id)}
                              className="flex items-center gap-1 text-[10px] font-mono text-[#E6C687] bg-[#E6C687]/5 border border-[#E6C687]/20 px-2 py-0.5 rounded hover:bg-[#E6C687]/10"
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
                  </div>

                </div>
              )}

              {/* TAB 5: GLOBAL ASSETS MANAGER */}
              {activeTab === "assets" && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                    <div>
                      <h2 className="font-display font-medium text-xl text-white">
                        Global Assets Library
                      </h2>
                      <p className="text-gray-500 text-xs mt-1">
                        Upload media fragments or reference external URLs, then select which targets to populate.
                      </p>
                    </div>
                  </div>

                  {/* SAVE STATUS */}
                  {getStatusText("assets") && (
                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      saveStatus.assets === "saved" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {getStatusText("assets")}
                    </div>
                  )}

                  {/* ACTIVE CONFIGURATION ROLES */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/40 border border-white/5 p-6 rounded-2xl">
                    <div>
                      <h3 className="text-xs font-mono uppercase text-[#E6C687] mb-3 tracking-wide flex items-center gap-2">
                        <Play className="w-3.5 h-3.5" /> Hero Background (Img or Video)
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2 text-xs truncate bg-[#11111c] border border-white/5 rounded-xl px-4 py-3 text-gray-300">
                          <span className="text-gray-500 font-mono">Active Link:</span>
                          <span className="truncate flex-1 font-mono">{siteSettings.hero_video_bg_url || "Default Glowing Fluid Video"}</span>
                        </div>
                        <select
                          onChange={(e) => handleSelectAssetForSetting(e.target.value, "hero_video_bg_url")}
                          value={siteSettings.hero_video_bg_url || ""}
                          className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#E6C687]/50"
                        >
                          <option value="">-- Apply an Asset --</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.url}>{asset.name} ({asset.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-mono uppercase text-[#E6C687] mb-3 tracking-wide flex items-center gap-2">
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
                          className="w-full bg-[#11111c] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#E6C687]/50"
                        >
                          <option value="">-- Apply an Asset --</option>
                          {assets.map((asset) => (
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
                        <h3 className="text-sm font-semibold text-white mb-2">Upload Files to Supabase</h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                          Directly upload high-resolution images or .mp4 files into the <code className="text-amber-200/90 font-mono">bhakty-media</code> storage bucket.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-[#E6C687]/40 hover:bg-white/5 rounded-2xl py-8 px-4 cursor-pointer transition-all text-center">
                          <Upload className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-xs font-medium text-white">Click or Drop Asset File</span>
                          <span className="text-[10px] text-gray-500 mt-1 uppercase font-mono">Supports MP4, JPG, PNG, WEBP</span>
                          <input
                            type="file"
                            accept="image/*,video/mp4"
                            onChange={handleAssetUpload}
                            className="hidden"
                          />
                        </label>
                        {localUploadProgress && (
                          <div className="p-3 bg-white/5 border border-[#E1C58F]/20 text-[10px] font-mono text-amber-200 rounded-lg">
                            {localUploadProgress}
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
                              className="w-full py-2 bg-[#E6C687] text-black text-xs font-semibold rounded-xl hover:bg-[#fadfa8] transition-all cursor-pointer disabled:opacity-40"
                            >
                              Add Asset URL
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DECLARED ASSETS LIBRARY GRID */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase text-gray-400 tracking-wider">
                      Assets Collection Library ({assets.length} items)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {assets.map((item) => (
                        <div 
                          key={item.id}
                          className="bg-black/30 border border-white/5 rounded-2xl p-4 flex gap-4 items-center justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* THUMBNAIL PREVIEW */}
                            <div className="w-12 h-12 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                              {item.type === "video" ? (
                                <Play className="w-4 h-4 text-gray-500 font-bold" />
                              ) : (
                                <img src={item.url} alt="Thumb" className="w-full h-full object-cover animate-pulse" referrerPolicy="no-referrer" onError={(e) => { (e.target as any).src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=40&q=40" }} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 font-sans">
                              <h4 className="text-xs font-semibold text-white truncate">{item.name}</h4>
                              <p className="text-[9px] font-mono text-gray-500 uppercase truncate mt-0.5">{item.type} • {item.url}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <button
                              onClick={() => handleSelectAssetForSetting(item.url, "hero_video_bg_url")}
                              className="text-[9px] font-sans font-medium px-2 py-1 rounded bg-[#E6C687]/5 text-[#E6C687] border border-[#E6C687]/15 hover:bg-[#E6C687]/20"
                              title="Set as Hero Background Video / Image"
                            >
                              Background
                            </button>
                            <button
                              onClick={() => handleSelectAssetForSetting(item.url, "logo_img_url")}
                              className="text-[9px] font-sans font-medium px-2 py-1 rounded bg-[#E6C687]/5 text-[#E6C687] border border-[#E6C687]/15 hover:bg-[#E6C687]/20"
                              title="Set as Navbar Logo Image"
                            >
                              Logo
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(item.id)}
                              className="p-1 px-1.5 text-red-500 hover:text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-400/10 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
