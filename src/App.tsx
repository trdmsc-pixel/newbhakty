import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Play, Sparkles, ChevronDown, Compass, CheckCircle, Flame, Star, Cpu, Palette, Sliders, ArrowRight } from "lucide-react";
import BackgroundGradients from "./components/BackgroundGradients";
import Navbar from "./components/Navbar";
import ShowcaseGrid from "./components/ShowcaseGrid";
import PricingSection from "./components/PricingSection";
import BookingForm from "./components/BookingForm";
import InteractiveParticles from "./components/InteractiveParticles";
import BrandMarquee from "./components/BrandMarquee";
import AdminPanel from "./components/AdminPanel";
import MobileAppView from "./components/MobileAppView";
import ChatWidget from "./components/ChatWidget";
import LegalPage from "./components/LegalPages";
import { SiteDataProvider, useSiteData } from "./context/SiteDataContext";
import { ToastProvider } from "./context/ToastContext";
import { trackEvent, initializeMockAnalytics, trackMetaPixelEvent, trackMetaPixelCustomEvent } from "./lib/analytics";
import { getActiveTheme, WEB_THEMES } from "./lib/themes";
import { optimizeHeroVideoUrl } from "./lib/cloudinary";
import { supabase, isSupabaseConfigured } from "./lib/supabase";


function AppContent() {
  const { siteSettings, activePage } = useSiteData();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [path, setPath] = useState(window.location.pathname);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Zero-Overhead Visitor Location Tracking
  useEffect(() => {
    const trackVisitorLocation = async () => {
      try {
        if (sessionStorage.getItem("session_geo_logged") === "true") {
          return;
        }

        const res = await fetch("/api/edge-sync");
        if (!res.ok) {
          throw new Error("Failed to load locator API response");
        }
        
        let data = await res.json();
        
        // Fallback to client-side geolocation if edge headers are missing (e.g. local testing)
        if (!data.city || data.city === "Unknown City") {
          try {
            const geoRes = await fetch("https://ipapi.co/json/");
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              if (geoData.city) {
                data = {
                  city: geoData.city,
                  region: geoData.region || "Unknown Region",
                  country: geoData.country_name || geoData.country || "Unknown Country"
                };
              }
            }
          } catch (geoErr) {
            console.warn("Client-side geolocation API fallback failed:", geoErr);
          }
        }

        const city = data.city || "Unknown City";
        const region = data.region || "Unknown Region";
        const country = data.country || "Unknown Country";

        let deviceType = "desktop";
        const width = window.innerWidth;
        if (width < 768) {
          deviceType = "mobile";
        } else if (width < 1024) {
          deviceType = "tablet";
        }

        // Determine source_page
        let resolvedSource: "ai_production" | "live_action" | "mobile_app" = "ai_production";
        const isMobile = width < 1024;
        if (window.location.pathname === "/mobile-app" || window.location.hash === "#mobile-app" || (isMobile && window.location.pathname !== "/admin")) {
          resolvedSource = "mobile_app";
        } else {
          resolvedSource = activePage === "live" ? "live_action" : "ai_production";
        }

        if (isSupabaseConfigured && supabase) {
          const { error } = await supabase
            .from("visitor_locations")
            .insert({
              city,
              region,
              country,
              device_type: deviceType,
              source_page: resolvedSource
            });
            
          if (error) {
            console.error("Error writing visitor location to database:", error);
          }
        }
        
        sessionStorage.setItem("session_geo_logged", "true");
      } catch (err) {
        console.warn("Visitor location tracking aborted/failed:", err);
      }
    };

    trackVisitorLocation();
  }, [activePage]);

  const isMobileOrTablet = windowWidth < 1024;

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

  // Load dynamic Google Fonts based on siteSettings
  useEffect(() => {
    const fontsNeeded = new Set<string>();
    const textTypes = ["headings", "paragraph", "h1", "h2", "h3", "h4", "h5", "h6"];
    textTypes.forEach(type => {
      const font = siteSettings[`font_${type}_family`];
      if (font && font !== "Default Theme Font") {
        fontsNeeded.add(font);
      }
    });

    if (fontsNeeded.size > 0) {
      const googleFontsToLoad = Array.from(fontsNeeded)
        .filter(font => font !== "Cal Sans" && font !== "Google Sans")
        .map(font => `family=${font.replace(/ /g, "+")}:wght@300;400;500;600;700;800`);
      
      if (googleFontsToLoad.length > 0) {
        const linkId = "dynamic-google-fonts";
        let linkEl = document.getElementById(linkId) as HTMLLinkElement;
        if (!linkEl) {
          linkEl = document.createElement("link");
          linkEl.id = linkId;
          linkEl.rel = "stylesheet";
          document.head.appendChild(linkEl);
        }
        linkEl.href = `https://fonts.googleapis.com/css2?${googleFontsToLoad.join("&")}&display=swap`;
      }
    }
  }, [siteSettings]);

  // Base Meta Ads Pixel Initialization
  useEffect(() => {
    const pixelId = (siteSettings.meta_pixel_id || "").trim() || (import.meta.env.VITE_META_PIXEL_ID || "").trim();
    if (!pixelId) return;

    (window as any)._metaPixelId = pixelId;

    if (!(window as any).fbq) {
      /* eslint-disable */
      (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */

      (window as any).fbq('init', pixelId);
    }
  }, [siteSettings.meta_pixel_id]);

  // Listen for route transitions (path, page/activePage, hash) and fire PageView
  useEffect(() => {
    const fbq = (window as any).fbq;
    if (fbq) {
      fbq('track', 'PageView', {
        path: path,
        hash: hash,
        activePage: activePage
      });
      console.log(`[Meta Pixel] Tracked PageView: path=${path}, hash=${hash}, activePage=${activePage}`);
    }
  }, [path, hash, activePage]);

  // Track custom pipeline selections in page activePage updates
  useEffect(() => {
    if (activePage === "live") {
      trackMetaPixelCustomEvent("SelectedPhysicalPipeline", { source: "navbar_toggle", page: "live" });
    } else if (activePage === "ai") {
      trackMetaPixelCustomEvent("SelectedDigitalPipeline", { source: "navbar_toggle", page: "ai" });
    }
  }, [activePage]);

  // Synchronize active page pipeline to window for adblock-bypassed trackEvent detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any)._activePipeline = activePage === "live" ? "live_action" : "ai_production";
    }
  }, [activePage]);

  const navigate = (to: string) => {
    if (to.startsWith("#")) {
      window.location.hash = to;
      setHash(to);
    } else {
      window.history.pushState({}, "", to);
      setPath(to);
      setHash("");
    }
  };
  // ----------------------------------------------------
  // ROUTE DISPATCHER: LEGAL PAGES, ADMIN & MOBILE PREVIEW SYSTEM
  // ----------------------------------------------------
  if (path === "/privacy" || hash === "#privacy" || hash === "/privacy") {
    return <LegalPage type="privacy" onBack={() => navigate("/")} />;
  }

  if (path === "/terms" || hash === "#terms" || hash === "/terms") {
    return <LegalPage type="terms" onBack={() => navigate("/")} />;
  }

  if (path === "/refunds" || hash === "#refunds" || hash === "/refunds") {
    return <LegalPage type="refunds" onBack={() => navigate("/")} />;
  }

  if (path === "/admin" || hash === "#admin" || hash === "/admin") {
    return <AdminPanel onNavigateHome={() => navigate("/")} />;
  }

  if (path === "/mobile-app" || hash === "#mobile-app" || hash === "/mobile-app") {
    return <MobileAppView onExit={() => navigate("/")} navigate={navigate} />;
  }

  if (isMobileOrTablet) {
    return <MobileAppView onExit={() => {}} navigate={navigate} />;
  }

  return <DesktopWebsiteView path={path} hash={hash} navigate={navigate} />;
}

interface DesktopWebsiteViewProps {
  path: string;
  hash: string;
  navigate: (to: string) => void;
}

function DesktopWebsiteView({ path, hash, navigate }: DesktopWebsiteViewProps) {
  const [selectedTier, setSelectedTier] = useState<string>("");
  const { siteSettings, activePage } = useSiteData();
  const isNavbarFullWidth = activePage === "live"
    ? siteSettings.page2_navbar_full_width === "true"
    : siteSettings.navbar_full_width === "true";

  // Helper to dynamically resolve page-specific keys
  const getSetting = (key: string, fallback: string = "") => {
    if (activePage === "live") {
      const page2Key = `page2_${key}`;
      if (siteSettings[page2Key] !== undefined) return siteSettings[page2Key];
    }
    return siteSettings[key] || fallback;
  };

  // Dynamic Theme
  const theme = getActiveTheme(siteSettings.website_theme);

  // Light/Dark Mode state
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme_mode");
    return (saved === "light" || saved === "dark") ? saved : "dark";
  });

  useEffect(() => {
    if (themeMode === "light") {
      document.documentElement.classList.add("light-mode");
      document.body.classList.add("light-mode");
    } else {
      document.documentElement.classList.remove("light-mode");
      document.body.classList.remove("light-mode");
    }
    localStorage.setItem("theme_mode", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (activePage === "live") {
      document.body.classList.add("theme-live");
      document.documentElement.classList.add("theme-live");
    } else {
      document.body.classList.remove("theme-live");
      document.documentElement.classList.remove("theme-live");
    }
  }, [activePage]);

  const [isHeroVisible, setIsHeroVisible] = useState(true);

  // Monitor hero viewport intersection to unmount off-screen looping background video
  useEffect(() => {
    setIsHeroVisible(true);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setIsHeroVisible(entry.isIntersecting);
      });
    }, { threshold: 0.01 });

    const timer = setTimeout(() => {
      const heroEl = document.getElementById("hero-section");
      if (heroEl) observer.observe(heroEl);
    }, 1100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [activePage]);

  // Construct dynamic CSS rules for typography overrides
  const getDynamicTypographyCss = () => {
    let css = "";
    
    // Headings
    if (siteSettings.font_headings_family && siteSettings.font_headings_family !== "Default Theme Font") {
      css += `
        .font-display, h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6, .package-title, .offer-highlight, .pricing-title {
          font-family: "${siteSettings.font_headings_family}", sans-serif !important;
        }
      `;
    }
    if (siteSettings.font_headings_size) {
      css += `
        .font-display, h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6, .package-title, .offer-highlight, .pricing-title {
          font-size: ${siteSettings.font_headings_size} !important;
        }
      `;
    }
    if (siteSettings.font_headings_bold) {
      css += `
        .font-display, h1, h2, h3, h4, h5, h6, .h1, .h2, .h3, .h4, .h5, .h6, .package-title, .offer-highlight, .pricing-title {
          font-weight: ${siteSettings.font_headings_bold === "true" ? "bold" : "normal"} !important;
        }
      `;
    }

    // Paragraph
    if (siteSettings.font_paragraph_family && siteSettings.font_paragraph_family !== "Default Theme Font") {
      css += `
        body, html, p, span, li, a, .font-sans {
          font-family: "${siteSettings.font_paragraph_family}", sans-serif !important;
        }
      `;
    }
    if (siteSettings.font_paragraph_size) {
      css += `
        body, html, p, span, li, a, .font-sans {
          font-size: ${siteSettings.font_paragraph_size} !important;
        }
      `;
    }
    if (siteSettings.font_paragraph_bold) {
      css += `
        body, html, p, span, li, a, .font-sans {
          font-weight: ${siteSettings.font_paragraph_bold === "true" ? "bold" : "normal"} !important;
        }
      `;
    }

    // Individual H1-H6 tags
    ["h1", "h2", "h3", "h4", "h5", "h6"].forEach(tag => {
      const family = siteSettings[`font_${tag}_family`];
      const size = siteSettings[`font_${tag}_size`];
      const bold = siteSettings[`font_${tag}_bold`];
      
      if (family && family !== "Default Theme Font") {
        css += `
          ${tag}, .${tag} {
            font-family: "${family}", sans-serif !important;
          }
        `;
      }
      if (size) {
        css += `
          ${tag}, .${tag} {
            font-size: ${size} !important;
          }
        `;
      }
      if (bold) {
        css += `
          ${tag}, .${tag} {
            font-weight: ${bold === "true" ? "bold" : "normal"} !important;
          }
        `;
      }
    });

    return css;
  };

  // Scroll to hash on page load / mount
  useEffect(() => {
    const initialHash = window.location.hash;
    if (initialHash) {
      const targetId = initialHash.replace("#", "") + "-section";
      const exactId = initialHash.replace("#", "");
      
      const attemptScroll = () => {
        const el = document.getElementById(exactId) || document.getElementById(targetId);
        if (el) {
          const offsetTop = el.getBoundingClientRect().top + window.pageYOffset - 90;
          window.scrollTo({
            top: offsetTop,
            behavior: "smooth"
          });
          return true;
        }
        return false;
      };

      if (!attemptScroll()) {
        const timeout = setTimeout(attemptScroll, 800);
        return () => clearTimeout(timeout);
      }
    }
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

  // Spacing and layout control overrides for the hero section
  const heroStyle: React.CSSProperties = {
    paddingTop: isNavbarFullWidth 
      ? `calc(${getSetting("hero_padding_top") || "9rem"} + 40px)` 
      : getSetting("hero_padding_top") || undefined,
    paddingBottom: getSetting("hero_padding_bottom") || undefined,
    marginTop: isNavbarFullWidth ? "0px" : (getSetting("hero_margin_top") || undefined),
    marginBottom: getSetting("hero_margin_bottom") || undefined,
  };

  const heroTextStyle: React.CSSProperties = {
    maxWidth: getSetting("hero_text_width") || undefined,
    height: getSetting("hero_text_height") || undefined,
  };

  const rawHeroVideoBgUrl = getSetting("hero_video_bg_url", "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4");
  const heroVideoBgUrl = optimizeHeroVideoUrl(rawHeroVideoBgUrl);
  const heroCtaBookingColor = getSetting("hero_cta_booking_color");
  const heroCtaBookingTextColor = getSetting("hero_cta_booking_text_color");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`relative min-h-screen font-sans ${theme.style.bodyBg} transition-all duration-500 ease-in-out overflow-hidden pb-16 ${isNavbarFullWidth ? "pt-0" : "pt-24 md:pt-28"}`}
    >
      <style>{getDynamicTypographyCss()}</style>
      
      {/* 2-3 MASSIVE SMOOTH GRADIENT BULBS */}
      <BackgroundGradients />

      {/* FLOATING HEADER BAR */}
      <Navbar themeMode={themeMode} setThemeMode={setThemeMode} />

      {/* HERO SECTION CONTAINER WITH DYNAMIC EXIT/ENTRY SLIDE TRANSITIONS */}
      <AnimatePresence mode="wait">
        {activePage === "live" ? (
          <motion.div
            key="live-hero"
            initial={{ opacity: 0, x: 120, filter: "blur(20px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -120, filter: "blur(20px)" }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {/* REDESIGNED FULLSCREEN LIVE-ACTION HERO */}
            <section 
              id="hero-section" 
              className="relative w-full min-h-screen flex flex-col justify-center overflow-hidden"
              style={{
                marginTop: getSetting("hero_margin_top") || undefined,
                marginBottom: getSetting("hero_margin_bottom") || undefined,
              }}
            >
              {/* Full-screen Background Video/Image */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                {(!heroVideoBgUrl || !heroVideoBgUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)/i)) ? (
                  <video
                    src={heroVideoBgUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    style={{
                      opacity: getSetting("hero_bg_opacity", "1"),
                      filter: getSetting("hero_bg_blur", "none") === "none" ? "none" : `blur(${getSetting("hero_bg_blur") === "sm" ? "4px" : getSetting("hero_bg_blur") === "md" ? "12px" : "24px"})`
                    }}
                  />
                ) : (
                  <img
                    src={heroVideoBgUrl}
                    alt="Live-action Background"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    style={{
                      opacity: getSetting("hero_bg_opacity", "1"),
                      filter: getSetting("hero_bg_blur", "none") === "none" ? "none" : `blur(${getSetting("hero_bg_blur") === "sm" ? "4px" : getSetting("hero_bg_blur") === "md" ? "12px" : "24px"})`
                    }}
                  />
                )}
                {/* Dark Overlay Layer */}
                <div 
                  className="absolute inset-0 bg-black"
                  style={{
                    opacity: parseFloat(getSetting("hero_bg_overlay", "0.4"))
                  }}
                />
              </div>

              {/* Hero Content Container */}
              <div 
                className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 flex flex-col justify-center min-h-[calc(100vh-100px)]"
                style={{
                  paddingTop: isNavbarFullWidth 
                    ? `calc(${getSetting("hero_padding_top", "clamp(40px, 8vw, 72px)")} + 90px)` 
                    : getSetting("hero_padding_top", "clamp(40px, 8vw, 72px)")
                }}
              >
                {/* Left/Center/Right aligned Content Block */}
                <div 
                  className={`w-full flex flex-col ${
                    getSetting("hero_text_align", "left") === "center" 
                      ? "items-center text-center mx-auto" 
                      : getSetting("hero_text_align", "left") === "right"
                        ? "items-end text-right ml-auto"
                        : "items-start text-left mr-auto"
                  }`}
                  style={{
                    maxWidth: getSetting("hero_max_width", "560px")
                  }}
                >


                  {/* Hero Heading */}
                  <motion.h1 
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0, y: 28 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] } }
                    }}
                    className="font-display tracking-tight leading-[1.05] mb-6"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: getSetting("hero_title_size", "clamp(1.65rem, 5vw, 3rem)"),
                      letterSpacing: "-0.01em",
                      color: getSetting("hero_title_color", "#ffffff")
                    }}
                  >
                    {getSetting("hero_title_1", "Lock Down Your")} <br />
                    <span 
                      className="italic font-serif font-normal block my-1"
                      style={{
                        color: getSetting("hero_title_color_line2", "#ffffff"),
                        backgroundImage: "var(--accent-gradient)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent"
                      }}
                    >
                      {getSetting("hero_title_2", "Passwords with")}
                    </span>
                    {getSetting("hero_title_3", "Ironclad Security")}
                  </motion.h1>

                  {/* Hero Subtext */}
                  <motion.p 
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0, y: 28 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] } }
                    }}
                    className="mb-8 leading-[1.65]"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: getSetting("hero_subtitle_size", "clamp(0.9rem, 2.5vw, 1.1rem)"),
                      color: getSetting("hero_subtitle_color", "#ffffff"),
                      opacity: 0.8,
                      maxWidth: "100%"
                    }}
                  >
                    {getSetting("hero_description", "Zero stress, total control. VaultShield keeps you covered with unbreakable storage, one-tap access, and pro-grade tools for your non-stop world.")}
                  </motion.p>

                  {/* CTA Button */}
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0, y: 28 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] } }
                    }}
                  >
                    <motion.button
                      onClick={() => {
                        trackEvent("click", `CTA: Live Hero Booking clicked`);
                        scrollToSection("booking-section");
                      }}
                      whileHover={{ 
                        scale: 1.04,
                        filter: "brightness(1.1)"
                      }}
                      whileTap={{ scale: 0.96 }}
                      className="flex items-center justify-between gap-8 rounded-full font-semibold transition-all duration-300"
                      style={{
                        minWidth: "210px",
                        padding: "17px 24px",
                        background: getSetting("hero_cta_bg", "#7342E2"),
                        color: getSetting("hero_cta_color", "#ffffff"),
                        fontSize: getSetting("hero_cta_size", "clamp(0.9rem, 2vw, 1rem)"),
                        boxShadow: getSetting("hero_cta_glow", "true") === "true" 
                          ? `0 4px 24px ${getSetting("hero_cta_glow_color", "rgba(115,66,226,0.28)")}`
                          : "none"
                      }}
                    >
                      <span className="font-sans font-semibold tracking-tight">{getSetting("hero_cta_text", "Get It Free")}</span>
                      <ArrowRight className="w-4 h-4 text-white" />
                    </motion.button>
                  </motion.div>
                </div>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="ai-hero"
            initial={{ opacity: 0, x: -120, filter: "blur(20px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 120, filter: "blur(20px)" }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {/* ORIGINAL AI HERO SECTION */}
            <section 
              id="hero-section" 
              style={{...heroStyle, isolation: "isolate"}}
              className={`relative pt-36 pb-20 md:py-40 md:px-12 px-6 flex flex-col items-center justify-center text-center gap-16 overflow-hidden transition-all duration-500 ${
                isNavbarFullWidth
                  ? "w-full max-w-none rounded-none mt-0 border-none bg-[#0c0c16]/10 backdrop-blur-[4px]"
                  : `rounded-3xl mt-6 border border-white/[0.04] bg-[#0c0c16]/10 backdrop-blur-[4px] shadow-2xl ${
                      siteSettings.website_full_width === "true" 
                        ? "max-w-none w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] mx-4 md:mx-8" 
                        : "max-w-7xl mx-auto"
                    }`
              }`}
            >
              {/* Soft Looping background video or image centered in hero */}
              <div className="absolute inset-0 z-0 overflow-hidden opacity-30 pointer-events-none select-none">
                {(!heroVideoBgUrl || !heroVideoBgUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)/i)) ? (
                  <video
                    src={heroVideoBgUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={heroVideoBgUrl}
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
                style={heroTextStyle}
                className="w-full max-w-3xl text-center flex flex-col items-center relative z-10"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >


                <h1 className="font-display font-light text-5xl sm:text-6xl md:text-7xl tracking-tight leading-[1.05] text-white max-w-2xl mb-8">
                  {getSetting("hero_title_1", "The Next Epoch")} <br />
                  <span className="italic font-serif text-accent text-6xl sm:text-7xl md:text-8xl font-normal block my-1">
                    {getSetting("hero_title_2", "of Cinema.")}
                  </span>
                  {getSetting("hero_title_3", "Synthesized.")}
                </h1>

                <p className="text-gray-400 text-sm md:text-base mb-8 max-w-lg leading-relaxed font-light mx-auto">
                  {getSetting("hero_description", "We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers. From prompt orchestration to temporal coherence upscaling, bhakty.studio redefines moving media.")}
                </p>

                {/* CALL TO ACTION BUTTON BAR */}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
                  {/* Main squishy booking trigger button */}
                  <motion.button
                    id="hero-cta-booking"
                    onClick={() => {
                      trackEvent("click", `CTA: Book Creative Spot clicked (${activePage})`);
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
                      ...(heroCtaBookingColor ? { backgroundColor: heroCtaBookingColor, backgroundImage: "none" } : {}),
                      ...(heroCtaBookingTextColor ? { color: heroCtaBookingTextColor } : {})
                    }}
                    className="px-8 py-4 bg-accent hover-glow-yellow text-black font-semibold font-display tracking-tight text-sm rounded-full cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-black" style={heroCtaBookingTextColor ? { color: heroCtaBookingTextColor } : undefined} />
                    {getSetting("hero_cta_booking_text", "Book Creative Spot")}
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
                    {getSetting("hero_cta_work_text", "Explore Curation")}
                  </button>
                </div>

                {/* SOCIAL PROOF STATS */}
                <div className="grid grid-cols-3 gap-8 border-t border-white/10 pt-8 mt-12 w-full max-w-md font-sans mx-auto">
                  <div>
                    <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                      {getSetting("hero_stat1_value", "400+")}
                    </span>
                    <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                      {getSetting("hero_stat1_label", "Synth Hours")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                      {getSetting("hero_stat2_value", "8K UHD")}
                    </span>
                    <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                      {getSetting("hero_stat2_label", "Upscale Target")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1 text-accent">
                      {getSetting("hero_stat3_value", "0%")}
                    </span>
                    <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                      {getSetting("hero_stat3_label", "Physical Camera")}
                    </span>
                  </div>
                </div>
              </motion.div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SWIPE / SCROLL INDICATOR */}
      <div className="w-full flex justify-center pb-12">
        <motion.button 
          onClick={() => scrollToSection("work-section")}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1.5 text-gray-500 hover:text-accent text-[10px] font-mono uppercase tracking-widest transition-all cursor-pointer"
        >
          <span>Begin Odyssey</span>
          <ChevronDown className="w-4 h-4 text-gray-500 hover:text-accent" />
        </motion.button>
      </div>

      {/* BRAND LOGOS MARQUEE */}
      <BrandMarquee />

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
              className="text-[10px] uppercase font-mono tracking-widest text-accent bg-accent/5 px-3 py-1.5 rounded-full border border-accent/20 hover:bg-accent/15 transition-all cursor-pointer"
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
          <div className="flex gap-4 flex-wrap justify-center">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-gray-400 transition-colors">Return top</button>
            <span>•</span>
            <button onClick={() => scrollToSection("work-section")} className="hover:text-gray-400 transition-colors">Portfolios</button>
            <span>•</span>
            <button onClick={() => scrollToSection("pricing-section")} className="hover:text-gray-400 transition-colors">Licensing packages</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-gray-600 border-t border-white/5 pt-4 mt-4 w-full">
          <div>
            The Chanting Studio // Computational Visualizer Curation Framework.
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
            <button onClick={() => navigate("/privacy")} className="hover:text-gray-400 transition-colors">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => navigate("/terms")} className="hover:text-gray-400 transition-colors">Terms of Service</button>
            <span>•</span>
            <button onClick={() => navigate("/refunds")} className="hover:text-gray-400 transition-colors">Refund Policy</button>
          </div>
        </div>
      </footer>

      {/* CUSTOMER SUPPORT CONCIERGE CHAT WIDGET */}
      <ChatWidget />
    </motion.div>
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
