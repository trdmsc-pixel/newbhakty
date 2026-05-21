import { motion } from "motion/react";
import { Film, Calendar, Compass, Layers } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";

export default function Navbar() {
  const { siteSettings, navigationMenu } = useSiteData();

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

  return (
    <motion.header 
      id="navbar"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.2 }}
      className="fixed top-5 left-0 right-0 z-50 px-4 md:px-8 mx-auto max-w-7xl"
    >
      <div className="glass-panel rounded-full px-6 py-4 flex items-center justify-between shadow-2xl shadow-black/40">
        
        {/* LOGO */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} 
          className="flex items-center gap-2 cursor-pointer group"
          id="nav-logo"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#4A36B3] to-[#E6C687] flex items-center justify-center relative overflow-hidden">
            {/* Liquid overlay inner element */}
            <div className="absolute inset-[2px] bg-[#050508] rounded-full flex items-center justify-center overflow-hidden">
              {siteSettings.logo_img_url ? (
                <img 
                  src={siteSettings.logo_img_url} 
                  alt="Custom Logo" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Film className="w-3.5 h-3.5 text-white/90 group-hover:scale-110 transition-transform duration-300" />
              )}
            </div>
            {/* Spinning/pulsing aura boundary */}
            <div className="absolute inset-0 bg-transparent group-hover:bg-gradient-to-tr group-hover:rotate-180 transition-all duration-700 pointer-events-none" />
          </div>
          <span className="font-display font-medium text-xl md:text-2xl tracking-tighter italic text-white group-hover:text-[#E6C687] transition-colors duration-200">
            bhakty<span className="text-[#E6C687]">.</span>studio
          </span>
        </div>

        {/* ANCHOR NAV LINKS (DYNAMIC) */}
        <nav className="hidden md:flex items-center gap-1">
          {navigationMenu.map((item) => (
            <button 
              key={item.id}
              id={`nav-link-${item.id}`}
              onClick={() => scrollToSection(item.target_url)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-300"
            >
              {item.target_url === "work-section" ? (
                <Compass className="w-4 h-4 text-gray-400" />
              ) : (
                <Layers className="w-4 h-4 text-gray-400" />
              )}
              {item.label}
            </button>
          ))}
        </nav>

        {/* CALL TO ACTION BUTTON */}
        <div className="flex items-center gap-3">
          <button
            id="nav-btn-book"
            onClick={() => scrollToSection("booking-section")}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-medium font-display tracking-tight bg-gradient-to-r from-white/10 to-white/5 border border-white/10 text-white hover:border-[#E6C687]/40 hover:text-[#E6C687] transition-all duration-300 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            {siteSettings.hero_cta_booking_text || "Instant Consult"}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

