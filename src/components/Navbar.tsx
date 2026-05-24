import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Calendar, Compass, Layers, Menu, X, Sun, Moon } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

interface NavbarProps {
  themeMode: "dark" | "light";
  setThemeMode: React.Dispatch<React.SetStateAction<"dark" | "light">>;
}

export default function Navbar({ themeMode, setThemeMode }: NavbarProps) {
  const { siteSettings, navigationMenu } = useSiteData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSection, setActiveSection] = useState("hero-section");
  const theme = getActiveTheme(siteSettings.website_theme);

  useEffect(() => {
    const handleScroll = () => {
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
    };
  }, []);

  const scrollToSection = (id: string) => {
    setMobileOpen(false);
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
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#ffea00] to-[#cca300] flex items-center justify-center relative overflow-hidden shadow-sm">
          <div className="absolute inset-[1px] bg-[#050508] rounded-lg flex items-center justify-center">
            <Film className="w-3 h-3 text-[#ffea00]" />
          </div>
        </div>
        <span className="font-display font-semibold text-xs tracking-tight text-white hidden md:inline">bhakty.studio</span>
      </div>
    );
  };

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl z-[9999]">
        {/* Floating Capsule Bar */}
        <motion.div 
          animate={{
            scale: isScrolled ? 0.96 : 1,
            paddingTop: isScrolled ? "8px" : "12px",
            paddingBottom: isScrolled ? "8px" : "12px",
          }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className={`w-full rounded-full flex items-center justify-between border shadow-2xl transition-all duration-300 ${
            themeMode === "light" 
              ? "bg-[#faf9f6]/85 border-black/10 backdrop-blur-xl" 
              : "bg-black/75 border-white/10 backdrop-blur-xl"
          } px-4 md:px-6`}
        >
          {/* LEFT: macOS colored window control dots & Logo */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e] hover:brightness-110 transition-all" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123] hover:brightness-110 transition-all" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29] hover:brightness-110 transition-all" />
            </div>
            
            <div onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center cursor-pointer">
              {renderLogo(isMobile)}
            </div>
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
                      className="absolute inset-0 rounded-full bg-[#ffea00]/10 border border-[#ffea00]/30 -z-10"
                      style={{
                        boxShadow: "0 0 15px rgba(255, 234, 0, 0.4)",
                      }}
                    />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* RIGHT: Light/Dark mode glassy toggle slider & Instant Consult CTA */}
          <div className="flex items-center gap-3">
            {/* Sliding Capsule Toggle Button (Image 2 style) */}


            {/* Desktop CTA (Book Consultation) */}
            <button
              onClick={() => scrollToSection("booking-section")}
              className="hidden sm:flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-white hover:border-[#ffea00]/40 hover:text-[#ffea00] hover-glow-yellow transition-all duration-300 cursor-pointer shadow-md"
            >
              <Calendar className="w-3.5 h-3.5 text-[#ffea00]" />
              <span className="truncate">{siteSettings.hero_cta_booking_text || "Instant Consult"}</span>
            </button>

            {/* Mobile Hamburger toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
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
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#ffea00] opacity-80">Curated Sections</p>
              
              <div className="flex flex-col gap-2">
                {navigationMenu.map((item) => {
                  const isActive = activeSection === item.target_url;
                  return (
                    <button 
                      key={item.id}
                      onClick={() => scrollToSection(item.target_url)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all duration-200 ${
                        isActive 
                          ? "bg-[#ffea00]/10 border border-[#ffea00]/30 text-[#ffea00]" 
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
                className="w-full py-3.5 rounded-xl bg-[#ffea00] hover-glow-yellow text-black font-semibold font-display tracking-tight text-center text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
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
