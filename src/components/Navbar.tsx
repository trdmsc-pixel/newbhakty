import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Calendar, Compass, Layers, Menu, X } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

export default function Navbar() {
  const { siteSettings, navigationMenu } = useSiteData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = getActiveTheme(siteSettings.website_theme);

  const scrollToSection = (id: string) => {
    setMobileOpen(false);
    const element = document.getElementById(id);
    if (element) {
      // Offset calculated to align content beneath the top navbar in mobile
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - (window.innerWidth < 768 ? 80 : 40);
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
    }
  };

  // Shared Logo Render function
  const renderLogo = (isMobile: boolean) => {
    const isImage = !!siteSettings.logo_img_url;
    
    // Separate width and height fields for mobile, falling back gracefully
    const mobileWidth = siteSettings.logo_width_mobile || "auto";
    const mobileHeight = siteSettings.logo_height_mobile || "28px";
    
    const desktopWidth = siteSettings.logo_width || "auto";
    const desktopHeight = siteSettings.logo_height || "36px";

    if (isImage) {
      return (
        <img 
          src={siteSettings.logo_img_url} 
          alt="Brand Logo" 
          className="object-contain transition-transform duration-300 hover:scale-105"
          style={{
            padding: siteSettings.logo_padding || "0px",
            width: isMobile ? mobileWidth : desktopWidth,
            height: isMobile ? mobileHeight : desktopHeight,
            maxWidth: isMobile ? "160px" : "220px",
          }}
          referrerPolicy="no-referrer"
        />
      );
    }

    return (
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ffea00] to-[#cca300] flex items-center justify-center relative overflow-hidden shadow-md">
          <div className="absolute inset-[2px] bg-[#050508] rounded-xl flex items-center justify-center">
            <Film className="w-4 h-4 text-white/90" />
          </div>
        </div>
        <span className="font-display font-semibold text-sm tracking-tight text-white hidden sm:inline">bhakty.studio</span>
      </div>
    );
  };

  return (
    <>
      {/* ========================================== */}
      {/* 1. DESKTOP LEFT SIDEBAR NAVBAR             */}
      {/* ========================================== */}
      <aside 
        id="navbar-desktop"
        className={`hidden md:flex flex-col justify-between fixed left-0 top-0 bottom-0 w-64 h-screen z-50 p-6 border-r transition-all duration-300 ${theme.style.glassBg} ${theme.style.glassBorder}`}
      >
        <div className="space-y-10">
          {/* Logo Area */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} 
            className="flex items-center cursor-pointer group pt-2 px-1"
          >
            {renderLogo(false)}
          </div>

          {/* Navigation Links (Vertical Stack) */}
          <nav className="flex flex-col gap-2.5">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-2 px-2">Navigation Curation</p>
            {navigationMenu.map((item) => (
              <button 
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => scrollToSection(item.target_url)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/5 text-gray-300 hover:text-white group`}
              >
                {item.target_url === "work-section" ? (
                  <Compass className="w-4 h-4 text-gray-400 group-hover:text-[#ffea00] transition-colors" />
                ) : (
                  <Layers className="w-4 h-4 text-gray-400 group-hover:text-[#ffea00] transition-colors" />
                )}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop CTA Booking */}
        <div className="pt-6 border-t border-white/5">
          <button
            id="nav-btn-book"
            onClick={() => scrollToSection("booking-section")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-white hover:border-[#ffea00]/40 hover:text-[#ffea00] hover-glow-yellow transition-all duration-300 cursor-pointer shadow-md"
          >
            <Calendar className="w-3.5 h-3.5 text-[#ffea00]" />
            {siteSettings.hero_cta_booking_text || "Instant Consult"}
          </button>
        </div>
      </aside>

      {/* ========================================== */}
      {/* 2. MOBILE TOP HEADER (RESPONSIVE COLLAPSED)*/}
      {/* ========================================== */}
      <header 
        id="navbar-mobile"
        className={`md:hidden fixed top-0 left-0 right-0 h-16 z-50 px-4 flex items-center justify-between border-b transition-all duration-300 ${theme.style.glassBg} ${theme.style.glassBorder}`}
      >
        {/* Mobile Logo */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} 
          className="flex items-center cursor-pointer"
        >
          {renderLogo(true)}
        </div>

        {/* Hamburger Menu Trigger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Drawer Modal */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed inset-x-0 top-16 bottom-0 z-40 p-6 flex flex-col justify-between md:hidden ${theme.style.bodyBg.split(" ")[0]} bg-opacity-98 backdrop-blur-2xl border-t border-white/5`}
          >
            <div className="space-y-6 pt-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#ffea00] opacity-60">Curated Sections</p>
              
              <div className="flex flex-col gap-2">
                {navigationMenu.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => scrollToSection(item.target_url)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-sm font-semibold text-white bg-white/5 border border-white/5"
                  >
                    {item.target_url === "work-section" ? (
                      <Compass className="w-4 h-4 text-[#ffea00]" />
                    ) : (
                      <Layers className="w-4 h-4 text-[#ffea00]" />
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pb-8">
              <button
                onClick={() => scrollToSection("booking-section")}
                className="w-full py-4.5 rounded-xl bg-[#ffea00] hover-glow-yellow text-black font-semibold font-display tracking-tight text-center text-sm shadow-xl flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4 text-black" />
                {siteSettings.hero_cta_booking_text || "Instant Consult"}
              </button>
              
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full py-3 rounded-xl border border-white/10 text-gray-400 text-xs font-mono font-medium text-center"
              >
                Close Drawer Navigation
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
