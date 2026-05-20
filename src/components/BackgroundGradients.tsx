import { motion } from "motion/react";

export default function BackgroundGradients() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Background base radial fade */}
      <div className="absolute inset-0 bg-[#050508]" />
      
      {/* Saffron/Gold Fluid Glow Orb (Top Left - Center area) */}
      <motion.div
        className="absolute w-[450px] md:w-[700px] h-[450px] md:h-[700px] bg-[#E6C687]/15 rounded-full filter blur-[100px] md:blur-[140px] animate-mesh-1"
        style={{
          top: "-5%",
          left: "5%",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />

      {/* Cosmic Violet Fluid Glow Orb (Bottom Right area) */}
      <motion.div
        className="absolute w-[500px] md:w-[850px] h-[500px] md:h-[850px] bg-[#4A36B3]/20 rounded-full filter blur-[110px] md:blur-[150px] animate-mesh-2"
        style={{
          bottom: "10%",
          right: "-10%",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5 }}
      />

      {/* Center Subtle Violet Fill Orb */}
      <motion.div
        className="absolute w-[350px] md:w-[600px] h-[350px] md:h-[600px] bg-[#4A36B3]/10 rounded-full filter blur-[100px] md:blur-[120px]"
        style={{
          top: "40%",
          left: "40%",
          transform: "translate(-50%, -50%)",
        }}
        animate={{
          scale: [1, 1.1, 0.95, 1],
          opacity: [0.6, 0.8, 0.7, 0.6],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Subtle digital stars pattern overlay to emphasize Sci-Fi AI element */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h1v1H0V0zm40 40h1v1h-1v-1zm40 0h1v1h-1v-1zM0 80h1v1H0v-1zm40 0h1v1h-1v-1zm40 0h1v1h-1v-1zM20 20h1v1h-1v-1zm40 0h1v1h-1v-1zM20 60h1v1h-1v-1zm40 0h1v1h-1v-1z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "80px 80px"
        }}
      />
    </div>
  );
}
