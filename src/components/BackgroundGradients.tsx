import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

export default function BackgroundGradients() {
  const { siteSettings, activePage } = useSiteData();
  const theme = getActiveTheme(siteSettings.website_theme);
  
  // Extract background color class
  const bgClass = theme.style.bodyBg.split(" ").find(c => c.startsWith("bg-")) || "bg-[#050508]";

  // Resolve dynamic gradient colors based on page
  const isLive = activePage === "live";
  const color1 = isLive 
    ? (siteSettings.page2_bg_gradient_color_1 || "#b91c1c") 
    : (siteSettings.bg_gradient_color_1 || "#7e22ce");
  const color2 = isLive 
    ? (siteSettings.page2_bg_gradient_color_2 || "#d97706") 
    : (siteSettings.bg_gradient_color_2 || "#3b82f6");
  const color3 = isLive 
    ? (siteSettings.page2_bg_gradient_color_3 || "#000000") 
    : (siteSettings.bg_gradient_color_3 || "#000000");

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    try {
      const cleaned = hex.startsWith("#") ? hex : "#" + hex;
      const num = parseInt(cleaned.replace("#", ""), 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch (e) {
      return `rgba(255, 255, 255, ${alpha})`;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" style={{ isolation: "isolate", contain: "strict" }}>
      {/* Background base radial fade matching theme background */}
      <div className={`absolute inset-0 ${bgClass} transition-colors duration-500`} />
      
      {/* Mesh Glow 1 (Top Left area) — CSS-only fade-in + looping drift */}
      <div
        className="absolute w-[450px] md:w-[700px] h-[450px] md:h-[700px] rounded-full filter blur-[100px] md:blur-[140px] animate-mesh-1"
        style={{
          top: "-5%",
          left: "5%",
          background: `radial-gradient(circle, ${hexToRgba(color1, 0.15)} 0%, transparent 100%)`,
          opacity: 0.8,
          willChange: "transform",
        }}
      />

      {/* Mesh Glow 2 (Bottom Right area) — CSS-only fade-in + looping drift */}
      <div
        className="absolute w-[500px] md:w-[850px] h-[500px] md:h-[850px] rounded-full filter blur-[110px] md:blur-[150px] animate-mesh-2"
        style={{
          bottom: "10%",
          right: "-10%",
          background: `radial-gradient(circle, ${hexToRgba(color2, 0.12)} 0%, transparent 100%)`,
          opacity: 0.7,
          willChange: "transform",
        }}
      />

      {/* Center Subtle Theme Gradient Glow Orb — Pure CSS animation replaces infinite Framer Motion loop */}
      <div
        className="absolute w-[350px] md:w-[600px] h-[350px] md:h-[600px] rounded-full filter blur-[100px] md:blur-[120px] animate-gradient-pulse"
        style={{
          top: "40%",
          left: "40%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${hexToRgba(color3, 0.1)} 0%, transparent 75%)`,
          willChange: "transform, opacity",
        }}
      />
      
      {/* Subtle digital stars pattern overlay to emphasize Sci-Fi AI element */}
      <div 
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h1v1H0V0zm40 40h1v1h-1v-1zm40 0h1v1h-1v-1zM0 80h1v1H0v-1zm40 0h1v1h-1v-1zm40 0h1v1h-1v-1zM20 20h1v1h-1v-1zm40 0h1v1h-1v-1zM20 60h1v1h-1v-1zm40 0h1v1h-1v-1z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "80px 80px"
        }}
      />
    </div>
  );
}

