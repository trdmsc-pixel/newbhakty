import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Calendar, Compass, Layers, Menu, X, Sun, Moon, Cpu } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

interface NavbarProps {
  themeMode: "dark" | "light";
  setThemeMode: React.Dispatch<React.SetStateAction<"dark" | "light">>;
}

export default function Navbar({ themeMode, setThemeMode }: NavbarProps) {
  const { siteSettings, navigationMenu, activePage, setActivePage } = useSiteData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState("hero-section");
  const theme = getActiveTheme(siteSettings.website_theme);
  const isFullWidth = activePage === "live"
    ? siteSettings.page2_navbar_full_width === "true"
    : siteSettings.navbar_full_width === "true";

  useEffect(() => {
    let scrollTimeout: any = null;
    let lastScrollTime = 0;
    const throttleDelay = 100; // 100ms throttle to prevent CPU reflow storms

    const handleScroll = () => {
      const now = Date.now();
      
      const run = () => {
        setIsScrolled(window.scrollY > 40);

        // Scroll Spy active section
        const sections = ["hero-section", "work-section", "pricing-section", "booking-section"];
        const scrollPos = window.scrollY + 180;
        for (const sectionId of sections) {
          const el = document.getElementById(sectionId);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPos >= top && scrollPos < top + height) {
              setActiveSection(sectionId);
              break;
            }
          }
        }
      };

      if (now - lastScrollTime >= throttleDelay) {
        run();
        lastScrollTime = now;
      } else {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          run();
          lastScrollTime = Date.now();
        }, throttleDelay - (now - lastScrollTime));
      }
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    
    // Initial trigger
    handleScroll();
    handleResize();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMobileOpen(false);
    const hashTarget = id.replace("-section", "");
    window.history.pushState(null, "", `#${hashTarget}`);
    
    const element = document.getElementById(id);
    if (element) {
      // Offset calculated to align content beneath the top navbar
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - (isScrolled ? 75 : 90);
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
    }
  };

  // Shared Logo Render function
  const renderLogo = (isMobileLogo: boolean) => {
    const isImage = !!siteSettings.logo_img_url;
    
    const mobileWidth = siteSettings.logo_width_mobile || "auto";
    const mobileHeight = siteSettings.logo_height_mobile || "24px";
    
    const desktopWidth = siteSettings.logo_width || "auto";
    const desktopHeight = siteSettings.logo_height || "28px";

    if (isImage) {
      return (
        <img 
          src={siteSettings.logo_img_url} 
          alt="Brand Logo" 
          className="object-contain transition-transform duration-300 hover:scale-105"
          style={{
            padding: siteSettings.logo_padding || "0px",
            width: isMobileLogo ? mobileWidth : desktopWidth,
            height: isMobileLogo ? mobileHeight : desktopHeight,
            maxWidth: isMobileLogo ? "120px" : "160px",
          }}
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div className="flex items-center gap-1.5 cursor-pointer">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-accent to-accent-dark flex items-center justify-center relative overflow-hidden shadow-sm">
          <div className="absolute inset-[1px] bg-[#050508] rounded-lg flex items-center justify-center">
            <Film className="w-3 h-3 text-accent" />
          </div>
        </div>
        <span className="font-display font-semibold text-xs tracking-tight text-white hidden md:inline">bhakty.studio</span>
      </div>
    );
  };

  // Shared Toggle Render to avoid repetition
  const renderActivePageToggle = (isMobileMenu = false) => {
    if (isMobileMenu) {
      return (
        <div 
          onClick={() => {
            setActivePage(activePage === "ai" ? "live" : "ai");
            setTimeout(() => setMobileOpen(false), 250);
          }}
          className="relative flex items-center w-full h-12 bg-black/40 border border-white/10 rounded-full p-1 cursor-pointer select-none overflow-visible"
        >
          <div className="absolute -inset-[2px] bg-gradient-to-r from-[#db2777] via-[#9333ea] to-[#db2777] blur-[6px] rounded-full opacity-50 -z-10" />
          
          <div className={`w-1/2 text-center text-xs font-display font-bold uppercase tracking-wider z-10 flex items-center justify-center gap-1.5 transition-colors duration-300 ${
            activePage === "ai" ? "text-black" : "text-gray-400"
          }`}>
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Prod</span>
          </div>
          
          <div className={`w-1/2 text-center text-xs font-display font-bold uppercase tracking-wider z-10 flex items-center justify-center gap-1.5 transition-colors duration-300 ${
            activePage === "live" ? "text-white" : "text-gray-400"
          }`}>
            <Film className="w-3.5 h-3.5" />
            <span>Live Action</span>
          </div>

          <motion.div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full border border-white/30 shadow-lg"
            animate={{
              left: activePage === "ai" ? "4px" : "calc(50% + 0px)",
            }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              background: activePage === "ai"
                ? "radial-gradient(circle at 30% 30%, rgba(255, 234, 0, 0.95) 0%, rgba(204, 163, 0, 0.95) 60%, rgba(128, 117, 0, 1) 100%)"
                : "radial-gradient(circle at 30% 30%, rgba(219, 39, 119, 0.95) 0%, rgba(147, 51, 234, 0.95) 60%, rgba(115, 66, 226, 1) 100%)",
              boxShadow: activePage === "ai"
                ? "0 0 12px rgba(255, 234, 0, 0.5), inset 0 1.5px 3px rgba(255, 255, 255, 0.5)"
                : "0 0 12px rgba(219, 39, 119, 0.5), inset 0 1.5px 3px rgba(255, 255, 255, 0.5)",
              willChange: "transform, opacity",
              translateZ: 0
            }}
          />
        </div>
      );
    }

    return (
      <div 
        onClick={() => setActivePage(activePage === "ai" ? "live" : "ai")}
        className="relative flex items-center w-[160px] h-[38px] bg-black/40 border border-white/10 rounded-full p-1 cursor-pointer select-none overflow-visible group shrink-0"
      >
        {/* Back-glow Effect - Magenta Glow */}
        <div 
          className="absolute -inset-[3px] bg-gradient-to-r from-[#db2777] via-[#9333ea] to-[#db2777] blur-[8px] rounded-full opacity-60 group-hover:opacity-100 transition-opacity duration-300 -z-10" 
        />
        
        {/* Sliding glass orb container */}
        <div className="relative w-full h-full flex items-center">
          <motion.div
            animate={{
              x: activePage === "ai" ? 0 : 122, // 160px width - 30px orb width - 8px padding
            }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className="absolute w-[30px] h-[30px] rounded-full flex items-center justify-center border border-white/30 shadow-lg overflow-hidden cursor-pointer"
            style={{
              background: activePage === "ai" 
                ? "radial-gradient(circle at 30% 30%, rgba(255, 234, 0, 0.95) 0%, rgba(204, 163, 0, 0.95) 60%, rgba(128, 117, 0, 1) 100%)"
                : "radial-gradient(circle at 30% 30%, rgba(219, 39, 119, 0.95) 0%, rgba(147, 51, 234, 0.95) 60%, rgba(115, 66, 226, 1) 100%)",
              boxShadow: activePage === "ai"
                ? "0 0 15px rgba(255, 234, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.3)"
                : "0 0 15px rgba(219, 39, 119, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.3)",
              willChange: "transform, opacity",
              translateZ: 0
            }}
          >
            {/* Gloss highlight */}
            <div className="absolute top-0.5 left-1 w-2.5 h-1.5 bg-white/40 rounded-full filter blur-[0.5px]" />
            {activePage === "ai" ? (
              <Cpu className="w-3.5 h-3.5 text-black" />
            ) : (
              <Film className="w-3.5 h-3.5 text-white" />
            )}
          </motion.div>

          {/* Text Labels under the orb */}
          <div className="w-full flex justify-between items-center px-3.5 text-[10px] font-display font-bold uppercase tracking-wider text-white select-none">
            {activePage === "ai" ? (
              <>
                <span className="opacity-0 w-[30px]" />
                <span className="animate-fade-in">AI Prod</span>
              </>
            ) : (
              <>
                <span className="animate-fade-in">Live Action</span>
                <span className="opacity-0 w-[30px]" />
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 w-full z-[9999] flex justify-center pointer-events-none">
        {/* Floating Capsule Bar / Edge-to-Edge Bar */}
        <motion.div 
          layout
          animate={{
            scale: (isScrolled && !isFullWidth) ? 0.96 : 1,
            paddingTop: isScrolled ? "8px" : (isFullWidth ? "16px" : "12px"),
            paddingBottom: isScrolled ? "8px" : (isFullWidth ? "16px" : "12px"),
            minHeight: isFullWidth
              ? (isScrolled ? "56px" : "72px")
              : (isScrolled ? "52px" : "62px"),
          }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className={`flex items-center justify-between transition-colors duration-300 ${
            isFullWidth
              ? `w-full max-w-none mt-0 mx-0 rounded-none border-none pointer-events-auto shadow-none ${
                  isScrolled
                    ? (themeMode === "light" ? "bg-[#faf9f6]/95 shadow-md" : "bg-black/90 shadow-md")
                    : "bg-gradient-to-b from-black/95 via-black/50 to-transparent"
                }`
              : `mt-4 mx-4 w-[calc(100%-2rem)] max-w-5xl rounded-full border border-white/10 pointer-events-auto shadow-2xl ${
                  themeMode === "light" 
                    ? "bg-[#faf9f6]/85 backdrop-blur-xl" 
                    : "bg-black/75 backdrop-blur-xl"
                }`
          } ${isFullWidth ? "px-6 md:px-12" : "px-4 md:px-6"}`}
        >
          {/* LEFT: Logo & Optional Switcher Toggle (Compact Mode Only) */}
          <div className="flex items-center gap-4">
            <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center cursor-pointer">
              {renderLogo(isMobile)}
            </div>
            
            {/* Custom Glassmatic Toggle (Left side in Compact mode) */}
            {!isFullWidth && renderActivePageToggle(false)}
          </div>

          {/* CENTER: Neumorphic tab pills (Desktop only) */}
          <div className="hidden md:flex items-center gap-2.5 bg-black/20 dark:bg-black/30 border border-white/5 dark:border-white/5 rounded-full px-3 py-1.5 shadow-inner">
            {navigationMenu.map((item) => {
              const isActive = activeSection === item.target_url;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.target_url)}
                  className={`relative px-4 py-1.5 rounded-full text-xs font-semibold font-display tracking-tight transition-all duration-300 select-none cursor-pointer ${
                    isActive 
                      ? "text-white shadow-neumorphic-pill-active bg-white/[0.03]" 
                      : "text-gray-400 hover:text-gray-200 shadow-neumorphic-pill"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-glow"
                      className="absolute inset-0 rounded-full bg-accent/10 border border-accent/30 -z-10"
                      style={{
                        boxShadow: "0 0 15px var(--color-accent-glow)",
                        willChange: "transform, opacity",
                        translateZ: 0
                      }}
                    />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* RIGHT: Switcher Toggle (Full Width Mode Only), Book CTA, and Hamburger */}
          <div className="flex items-center gap-3">
            {/* Custom Glassmatic Toggle (Right side in Full Width mode) */}
            {isFullWidth && (
              <div className="hidden md:flex">
                {renderActivePageToggle(false)}
              </div>
            )}

            {/* Desktop CTA (Book Consultation) */}
            <button
              onClick={() => scrollToSection("booking-section")}
              className="hidden sm:flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-white hover:border-accent/40 hover:text-accent hover-glow-yellow transition-all duration-300 cursor-pointer shadow-md"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span className="truncate">{siteSettings.hero_cta_booking_text || "Instant Consult"}</span>
            </button>

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 text-gray-300 hover:text-accent transition-all cursor-pointer"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </motion.div>
      </div>

      {/* MOBILE DRAWER NAVIGATION */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed inset-x-4 top-20 z-[9998] p-5 rounded-3xl flex flex-col justify-between border shadow-2xl backdrop-blur-2xl ${
              themeMode === "light" 
                ? "bg-[#faf9f6]/95 border-black/10 text-black" 
                : "bg-black/95 border-white/10 text-white"
            }`}
          >
            <div className="space-y-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-accent opacity-80">Active Mode</p>
              {/* Glassmatic Switch for Mobile */}
              {renderActivePageToggle(true)}

              <p className="text-[10px] font-mono uppercase tracking-widest text-accent opacity-80 mt-4">Curated Sections</p>
              
              <div className="flex flex-col gap-2">
                {navigationMenu.map((item) => {
                  const isActive = activeSection === item.target_url;
                  return (
                    <button 
                      key={item.id}
                      onClick={() => scrollToSection(item.target_url)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 ${
                        isActive 
                          ? "bg-accent/10 border border-accent/30 text-accent" 
                          : "bg-white/5 dark:bg-white/5 border border-transparent text-gray-300 hover:text-white"
                      }`}
                    >
                      {item.target_url === "work-section" ? (
                        <Compass className="w-4 h-4" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-6 mt-4 border-t border-white/5 dark:border-white/5">
              <button
                onClick={() => scrollToSection("booking-section")}
                className="w-full py-3.5 rounded-xl bg-accent hover-glow-yellow text-black font-semibold font-display tracking-tight text-center text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-black" />
                {siteSettings.hero_cta_booking_text || "Instant Consult"}
              </button>
              
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-2.5 rounded-xl border border-white/10 dark:border-white/10 text-gray-400 text-xs font-mono font-medium text-center cursor-pointer"
              >
                Close Navigation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
