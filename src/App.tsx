import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Film, Play, Sparkles, ChevronDown, Compass, CheckCircle, Flame, Star, Cpu, Palette, Sliders } from "lucide-react";
import BackgroundGradients from "./components/BackgroundGradients";
import Navbar from "./components/Navbar";
import ShowcaseGrid from "./components/ShowcaseGrid";
import PricingSection from "./components/PricingSection";
import BookingForm from "./components/BookingForm";
import InteractiveParticles from "./components/InteractiveParticles";
import AdminPanel from "./components/AdminPanel";
import { SiteDataProvider, useSiteData } from "./context/SiteDataContext";
import { ToastProvider } from "./context/ToastContext";
import { trackEvent, initializeMockAnalytics } from "./lib/analytics";
import { getActiveTheme, WEB_THEMES } from "./lib/themes";


function AppContent() {
  const [selectedTier, setSelectedTier] = useState<string>("");
  const { siteSettings, isLoading, updateSiteSetting } = useSiteData();
  const [showThemePanel, setShowThemePanel] = useState(false);

  // Dynamic Theme
  const theme = getActiveTheme(siteSettings.website_theme);

  // Simple and ultra-resilient single-page router state
  const [path, setPath] = useState(window.location.pathname);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
      setHash(window.location.hash);
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    initializeMockAnalytics();
    
    // Set up dynamic IntersectionObserver for targeting sections of landing experience
    const trackedSections = ["hero-section", "work-section", "pricing-section", "booking-section"];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          trackEvent("scroll", `Section viewed: ${entry.target.id}`, { ratio: Math.round(entry.intersectionRatio * 100) });
        }
      });
    }, { threshold: 0.15 });

    // Delay observer start slightly to make sure page elements are fully mounted
    const delayObserve = setTimeout(() => {
      trackedSections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 1200);

    return () => {
      clearTimeout(delayObserve);
      observer.disconnect();
    };
  }, []);


  const navigate = (to: string) => {
    if (to.startsWith("#")) {
      window.location.hash = to;
      setHash(to);
    } else {
      // Clear physical URL hash and update path
      window.history.pushState({}, "", to);
      setPath(to);
      setHash("");
    }
  };

  const handleSelectTier = (tierName: string) => {
    setSelectedTier(tierName);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
    }
  };

  // Loader Bezel - Wait for persistence data to load from Supabase / LocalStorage
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center p-6 relative">
        <BackgroundGradients />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-full border-t-2 border-r-2 border-[#E6C687] animate-spin" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Initializing Studio Engine...</span>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ROUTE DISPATCHER: ADMIN SYSTEM
  // ----------------------------------------------------
  if (path === "/admin" || hash === "#admin" || hash === "/admin") {
    return <AdminPanel onNavigateHome={() => navigate("/")} />;
  }

  return (
    <div className={`relative min-h-screen font-sans ${theme.style.bodyBg} transition-colors duration-500 overflow-hidden pb-16 md:pl-64`}>
      
      {/* 2-3 MASSIVE SMOOTH GRADIENT BULBS */}
      <BackgroundGradients />

      {/* FLOATING HEADER BAR */}
      <Navbar />

      {/* HERO SECTION CONTAINER */}
      <section 
        id="hero-section" 
        className={`relative pt-36 pb-20 md:py-40 md:px-12 px-6 flex flex-col items-center justify-center text-center gap-16 rounded-3xl overflow-hidden mt-6 border border-white/[0.04] bg-[#0c0c16]/10 backdrop-blur-[4px] shadow-2xl transition-all duration-500 ${
          siteSettings.website_full_width === "true" 
            ? "max-w-none w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] mx-4 md:mx-8" 
            : "max-w-7xl mx-auto"
        }`}
      >
        {/* Soft Looping background video or image centered in hero */}
        <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none select-none">
          {(!siteSettings.hero_video_bg_url || !siteSettings.hero_video_bg_url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i)) ? (
            <video
              src={siteSettings.hero_video_bg_url || "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4"}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={siteSettings.hero_video_bg_url}
              alt="Studio Background"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          {/* Subtle darkness layers so fonts pop beautifully */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#050508]/90 via-transparent to-[#050508]/90" />
          <div className="absolute inset-0 bg-[#050508]/40" />
        </div>

        {/* Dynamic mouse-reactive interactive particles overlay */}
        <InteractiveParticles />

        {/* HERO CONTENT: CENTERED TEXTS & STATS */}
        <motion.div 
          className="w-full max-w-3xl text-center flex flex-col items-center relative z-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Subtle micro identifier */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-[#E6C687] mb-6 shadow-md uppercase">
            <Cpu className="w-3 h-3 text-[#E6C687]" />
            {siteSettings.hero_badge_text || "Synthetic Arts Studio v4.1"}
          </div>

          <h1 className="font-display font-light text-5xl sm:text-6xl md:text-7xl tracking-tight leading-[1.05] text-white max-w-2xl mb-8">
            {siteSettings.hero_title_1 || "The Next Epoch"} <br />
            <span className="italic font-serif text-[#E6C687] text-6xl sm:text-7xl md:text-8xl font-normal block my-1">
              {siteSettings.hero_title_2 || "of Cinema."}
            </span>
            {siteSettings.hero_title_3 || "Synthesized."}
          </h1>

          <p className="text-gray-400 text-sm md:text-base mb-8 max-w-lg leading-relaxed font-light mx-auto">
            {siteSettings.hero_description || "We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers. From prompt orchestration to temporal coherence upscaling, bhakty.studio redefines moving media."}
          </p>

          {/* CALL TO ACTION BUTTON BAR */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
            {/* Main squishy booking trigger button */}
            <motion.button
              id="hero-cta-booking"
              onClick={() => {
                trackEvent("click", "CTA: Book Creative Spot clicked");
                scrollToSection("booking-section");
              }}
              whileHover={{ 
                scale: 1.03,
                transition: { type: "spring", stiffness: 350, damping: 10 }
              }}
              whileTap={{ 
                scaleY: 0.9, 
                scaleX: 1.1,
                transition: { type: "spring", stiffness: 450, damping: 14 } 
              }}
              style={{
                ...(siteSettings.hero_cta_booking_color ? { backgroundColor: siteSettings.hero_cta_booking_color, backgroundImage: "none" } : {}),
                ...(siteSettings.hero_cta_booking_text_color ? { color: siteSettings.hero_cta_booking_text_color } : {})
              }}
              className="px-8 py-4 bg-gradient-to-r from-[#4A36B3] to-[#7a5ce0] text-white font-semibold font-display tracking-tight text-sm rounded-2xl hover:shadow-2xl hover:shadow-[#4A36B3]/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-200" style={siteSettings.hero_cta_booking_text_color ? { color: siteSettings.hero_cta_booking_text_color } : undefined} />
              {siteSettings.hero_cta_booking_text || "Book Creative Spot"}
            </motion.button>

            {/* Showcase guide navigation */}
            <button
              id="hero-cta-work"
              onClick={() => {
                trackEvent("click", "CTA: Explore Curation clicked");
                scrollToSection("work-section");
              }}
              className="px-6 py-4 rounded-2xl glass-panel-light text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold font-display tracking-tight text-sm border border-white/5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-gray-400" />
              {siteSettings.hero_cta_work_text || "Explore Curation"}
            </button>
          </div>

          {/* SOCIAL PROOF STATS */}
          <div className="grid grid-cols-3 gap-8 border-t border-white/10 pt-8 mt-12 w-full max-w-md font-sans mx-auto">
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                {siteSettings.hero_stat1_value || "400+"}
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                {siteSettings.hero_stat1_label || "Synth Hours"}
              </span>
            </div>
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                {siteSettings.hero_stat2_value || "8K UHD"}
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                {siteSettings.hero_stat2_label || "Upscale Target"}
              </span>
            </div>
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1 text-[#E6C687]">
                {siteSettings.hero_stat3_value || "0%"}
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                {siteSettings.hero_stat3_label || "Physical Camera"}
              </span>
            </div>
          </div>
        </motion.div>

      </section>

      {/* SWIPE / SCROLL INDICATOR */}
      <div className="w-full flex justify-center pb-12">
        <motion.button 
          onClick={() => scrollToSection("work-section")}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1.5 text-gray-500 hover:text-[#E6C687] text-[10px] font-mono uppercase tracking-widest transition-all cursor-pointer"
        >
          <span>Begin Odyssey</span>
          <ChevronDown className="w-4 h-4 text-gray-500 hover:text-[#E6C687]" />
        </motion.button>
      </div>

      {/* THE INTEGRATED PORTFOLIO SHOWCASE GRID */}
      <ShowcaseGrid />

      {/* PRICING SYSTEM & INTERACTIVE PACKAGES SLIDER */}
      <PricingSection onSelectTier={handleSelectTier} />

      {/* BOOKING INTAKE SYSTEM */}
      <BookingForm initialTier={selectedTier} />

      {/* THE BRANDED FOOTER PANEL */}
      <footer className={`mt-20 border-t border-white/10 pt-12 px-4 md:px-8 relative z-10 transition-all duration-500 ${
        siteSettings.website_full_width === "true" 
          ? "max-w-none w-full" 
          : "max-w-7xl mx-auto"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-10 pb-6 border-b border-white/5">
          
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5 mb-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              {siteSettings.logo_img_url ? (
                <img 
                  src={siteSettings.logo_img_url} 
                  alt="Footer Logo" 
                  className="object-contain"
                  style={{
                    height: "28px",
                    width: "auto"
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <div className="w-6 h-6 rounded bg-gradient-to-r from-amber-300 to-violet-500" />
                  <span className="font-display font-medium text-lg text-white tracking-tight">bhakty.studio</span>
                </>
              )}
            </div>
            <p className="text-gray-500 text-xs max-w-sm mt-1">
              Premium computational visualizers translating neural dimensions to pristine cinema assets.
            </p>
          </div>

          {/* METRIC CHIPS / INTERNALS */}
          <div className="flex flex-wrap gap-4 justify-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              {siteSettings.footer_copyright || "© 2026 bhakty.studio"}
            </span>
            <span 
              onClick={() => navigate("#admin")}
              className="text-[10px] uppercase font-mono tracking-widest text-[#E6C687] bg-[#E6C687]/5 px-3 py-1.5 rounded-full border border-[#E6C687]/20 hover:bg-[#E6C687]/15 transition-all cursor-pointer"
            >
              🔐 Administrator Login
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-violet-300 bg-violet-600/5 px-3 py-1.5 rounded-full border border-violet-500/20">
              Studio Location // Global Client Access
            </span>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-gray-600">
          <div>
            All generative pipelines run on proprietary fine-tunes. Real-time media licensed under CC-BY v4.0.
          </div>
          <div className="flex gap-4">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-gray-400 transition-colors">Return top</button>
            <span>•</span>
            <button onClick={() => scrollToSection("work-section")} className="hover:text-gray-400 transition-colors">Portfolios</button>
            <span>•</span>
            <button onClick={() => scrollToSection("pricing-section")} className="hover:text-gray-400 transition-colors">Licensing packages</button>
          </div>
        </div>
      </footer>

      {/* FLOATING QUICK THEME SWITCHER OVERLAY */}
      <div className="fixed bottom-6 left-6 z-45">
        <button
          onClick={() => setShowThemePanel(!showThemePanel)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full backdrop-blur-md bg-black/80 hover:bg-black border border-white/10 hover:border-[#E6C687]/65 text-xs font-semibold text-white/95 shadow-2xl transition-all cursor-pointer"
        >
          <Palette className={`w-4 h-4 text-[#E6C687] ${showThemePanel ? "rotate-90 animate-pulse" : ""} transition-transform duration-300`} />
          Theme Selector
        </button>

        {showThemePanel && (
          <div className="absolute bottom-14 left-0 mt-2 p-2 bg-[#0d0d15] border border-white/10 rounded-2xl shadow-2xl w-64 max-h-80 overflow-y-auto z-50 text-left font-sans space-y-1">
            <h4 className="text-[10px] font-mono uppercase text-gray-500 p-2 border-b border-white/5 flex justify-between items-center">
              <span>Dynamic Website Themes</span>
              <span className="text-[8px] bg-[#E6C687]/15 text-[#E6C687] px-1.5 py-0.5 rounded font-bold font-mono">10 DECORATIONS</span>
            </h4>
            
            <div className="py-1 max-h-56 overflow-y-auto">
              {WEB_THEMES.map((t) => {
                const isActive = (siteSettings.website_theme || "obsidian_cyber") === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      updateSiteSetting("website_theme", t.id);
                      trackEvent("click", `Theme switched: ${t.name}`);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive 
                        ? "bg-[#E6C687]/15 text-white border border-[#E6C687]/30" 
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className={`w-2 h-2 rounded-full ${t.type === 'dark' ? 'bg-indigo-500' : 'bg-amber-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function App() {
  return (
    <SiteDataProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SiteDataProvider>
  );
}

