import { useState } from "react";
import { motion } from "motion/react";
import { Film, Play, Sparkles, ChevronDown, Compass, CheckCircle, Flame, Star, Cpu } from "lucide-react";
import BackgroundGradients from "./components/BackgroundGradients";
import Navbar from "./components/Navbar";
import ShowcaseGrid from "./components/ShowcaseGrid";
import PricingSection from "./components/PricingSection";
import BookingForm from "./components/BookingForm";

export default function App() {
  const [selectedTier, setSelectedTier] = useState<string>("");

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

  return (
    <div className="relative min-h-screen font-sans selection:bg-[#E6C687]/30 selection:text-white overflow-hidden pb-16">
      
      {/* 2-3 MASSIVE SMOOTH GRADIENT BULBS */}
      <BackgroundGradients />

      {/* FLOATING HEADER BAR */}
      <Navbar />

      {/* HERO SECTION CONTAINER */}
      <section id="hero-section" className="relative pt-36 pb-20 md:py-40 z-10 px-4 md:px-8 max-w-7xl mx-auto flex flex-col items-center justify-between gap-16 lg:flex-row">
        
        {/* HERO LEFT: TEXTS */}
        <motion.div 
          className="w-full lg:w-3/5 text-left flex flex-col items-start"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Subtle micro identifier */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-[#E6C687] mb-6 shadow-md uppercase">
            <Cpu className="w-3 h-3 text-[#E6C687]" />
            Synthetic Arts Studio v4.1
          </div>

          <h1 className="font-display font-light text-5xl sm:text-6xl md:text-7xl tracking-tight leading-[1.05] text-white max-w-2xl mb-8">
            The Next Epoch <br />
            <span className="italic font-serif text-[#E6C687] text-6xl sm:text-7xl md:text-8xl font-normal">of Cinema.</span> <br />
            Synthesized.
          </h1>

          <p className="text-gray-400 text-sm md:text-base mb-8 max-w-lg leading-relaxed font-light">
            We are a high-tier creative agency building commercial assets, modular lookbooks, and synthetic cinematic trailers. From prompt orchestration to temporal coherence upscaling, bhakty.studio redefines moving media.
          </p>

          {/* CALL TO ACTION BUTTON BAR */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            {/* Main squishy booking trigger button */}
            <motion.button
              id="hero-cta-booking"
              onClick={() => scrollToSection("booking-section")}
              whileHover={{ 
                scale: 1.03,
                transition: { type: "spring", stiffness: 350, damping: 10 }
              }}
              whileTap={{ 
                scaleY: 0.9, 
                scaleX: 1.1,
                transition: { type: "spring", stiffness: 450, damping: 14 } 
              }}
              className="px-8 py-4 bg-gradient-to-r from-[#4A36B3] to-[#7a5ce0] text-white font-semibold font-display tracking-tight text-sm rounded-2xl hover:shadow-2xl hover:shadow-[#4A36B3]/30 cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              Book Creative Spot
            </motion.button>

            {/* Showcase guide navigation */}
            <button
              id="hero-cta-work"
              onClick={() => scrollToSection("work-section")}
              className="px-6 py-4 rounded-2xl glass-panel-light text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold font-display tracking-tight text-sm border border-white/5 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4 text-gray-400" />
              Explore Curation
            </button>
          </div>

          {/* SOCIAL PROOF STATS */}
          <div className="grid grid-cols-3 gap-8 border-t border-white/10 pt-8 mt-12 w-full max-w-md">
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                400+
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                Synth Hours
              </span>
            </div>
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1">
                8K UHD
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                Upscale Target
              </span>
            </div>
            <div>
              <span className="block text-xl md:text-2xl font-display font-medium text-white mb-1 text-[#E6C687]">
                0%
              </span>
              <span className="block text-[10px] font-mono uppercase text-gray-500 tracking-wide">
                Physical Camera
              </span>
            </div>
          </div>
        </motion.div>

        {/* HERO RIGHT: DYNAMIC COMPOSITED PREVIEW SCREEN */}
        <motion.div 
          className="w-full lg:w-2/5 flex items-center justify-center relative mt-8 lg:mt-0"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
        >
          {/* Subtle outer neon ring */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#4A36B3]/20 via-transparent to-[#E6C687]/20 rounded-3xl blur-2xl pointer-events-none" />

          {/* Floating showcase card */}
          <div className="glass-panel rounded-3xl p-4 w-full max-w-[420px] aspect-[4/5] relative border border-white/15 flex flex-col justify-between shadow-2xl overflow-hidden shadow-black/80">
            
            {/* Absolute background looping background for aesthetic depth */}
            <div className="absolute inset-0 z-0 opacity-70">
              <video
                src="https://assets.mixkit.co/videos/preview/mixkit-flowing-sand-particles-and-glowing-gold-lines-48281-large.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover rounded-3xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60" />
            </div>

            {/* COMPOSITED OVERLAY TEXT & BRANDING */}
            <div className="relative z-10 flex justify-between items-start">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[9px] font-mono text-white/95">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                DSD-04 RENDER LOOP
              </div>
              <div className="text-[10px] font-mono text-white/60 text-right bg-black/40 px-2 py-0.5 rounded border border-white/5">
                SEC_COORDS // 482813
              </div>
            </div>

            {/* ART PIECE SPECIFICATIONS BEZEL */}
            <div className="relative z-10">
              <div className="text-xs uppercase font-mono tracking-widest text-[#E6C687] bg-black/80 px-3 py-1 rounded-md border border-white/5 inline-block mb-3">
                bhakty design labs
              </div>
              
              <h3 className="font-display font-medium text-2xl text-white tracking-tight mb-2">
                Quantum Flow V4
              </h3>
              
              <p className="text-gray-300 text-xs font-light leading-relaxed mb-4">
                Interactive motion loop demonstrating dynamic particle density under localized AI friction triggers.
              </p>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400 bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8px]">Resolution</span>
                  <span className="text-white font-medium">3840 x 2160 pixels</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8px]">Frame rate</span>
                  <span className="text-[#E6C687] font-medium">60.00 FPS (Locked)</span>
                </div>
              </div>
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
      <footer className="mt-20 border-t border-white/10 pt-12 max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-10 pb-6 border-b border-white/5">
          
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5 mb-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-amber-300 to-violet-500" />
              <span className="font-display font-medium text-lg text-white tracking-tight">bhakty.studio</span>
            </div>
            <p className="text-gray-500 text-xs max-w-sm">
              Premium computational visualizers translating neural dimensions to pristine cinema assets.
            </p>
          </div>

          {/* METRIC CHIPS / INTERNALS */}
          <div className="flex flex-wrap gap-4 justify-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              © 2026 bhakty.studio
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#E6C687] bg-[#E6C687]/5 px-3 py-1.5 rounded-full border border-[#E6C687]/20">
              AI Powered Synthesis
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

    </div>
  );
}
