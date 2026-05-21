import { motion } from "motion/react";
import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

export default function BackgroundGradients() {
  const { siteSettings } = useSiteData();
  const theme = getActiveTheme(siteSettings.website_theme);
  
  // Extract background color class
  const bgClass = theme.style.bodyBg.split(" ").find(c => c.startsWith("bg-")) || "bg-[#050508]";

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Background base radial fade matching theme background */}
      <div className={`absolute inset-0 ${bgClass} transition-colors duration-500`} />
      
      {/* Mesh Glow 1 (Top Left area) */}
      <motion.div
        className={`absolute w-[450px] md:w-[700px] h-[450px] md:h-[700px] rounded-full filter blur-[100px] md:blur-[140px] animate-mesh-1 opacity-70`}
        style={{
          top: "-5%",
          left: "5%",
          background: theme.type === "dark" 
            ? "radial-gradient(circle, rgba(230,198,135,0.15) 0%, rgba(74,54,179,0.05) 100%)"
            : "radial-gradient(circle, rgba(168,85,247,0.08) 0%, rgba(230,198,135,0.03) 100%)"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ duration: 2 }}
      />

      {/* Mesh Glow 2 (Bottom Right area) */}
      <motion.div
        className="absolute w-[500px] md:w-[850px] h-[500px] md:h-[850px] rounded-full filter blur-[110px] md:blur-[150px] animate-mesh-2 opacity-60"
        style={{
          bottom: "10%",
          right: "-10%",
          background: theme.type === "dark"
            ? "radial-gradient(circle, rgba(74,54,179,0.18) 0%, rgba(230,198,135,0.03) 100%)"
            : "radial-gradient(circle, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.02) 100%)"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ duration: 2.5 }}
      />

      {/* Center Subtle Theme Gradient Glow Orb */}
      <motion.div
        className="absolute w-[350px] md:w-[600px] h-[350px] md:h-[600px] rounded-full filter blur-[100px] md:blur-[120px] opacity-40"
        style={{
          top: "40%",
          left: "40%",
          transform: "translate(-50%, -50%)",
          background: theme.type === "dark"
            ? "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)"
        }}
        animate={{
          scale: [1, 1.1, 0.95, 1],
          opacity: [0.4, 0.6, 0.5, 0.4],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
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
