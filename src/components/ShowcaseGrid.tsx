import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Image as ImageIcon, Volume2, VolumeX, X } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";

export default function ShowcaseGrid() {
  const { portfolioWorks = [], siteSettings } = useSiteData();

  // Split works into videos and images
  const motionWorks = portfolioWorks.filter((w) => (w.type || "video") === "video");
  const staticWorks = portfolioWorks.filter((w) => w.type === "image");

  // Accordion active item state (defaults to the first item of each list)
  const [activeVideoId, setActiveVideoId] = useState<string>("");
  const [activeImageId, setActiveImageId] = useState<string>("");
  
  // Audio state: track which video is currently unmuted
  const [unmutedVideoId, setUnmutedVideoId] = useState<string | null>(null);
  
  // Image preview popup modal state
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  // Refs for all video elements to control audio
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      videoRefs.current.set(id, el);
    } else {
      videoRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (motionWorks.length > 0 && !activeVideoId) {
      setActiveVideoId(motionWorks[0].id);
    }
  }, [motionWorks, activeVideoId]);

  useEffect(() => {
    if (staticWorks.length > 0 && !activeImageId) {
      setActiveImageId(staticWorks[0].id);
    }
  }, [staticWorks, activeImageId]);

  // Mute all videos except the active unmuted one
  useEffect(() => {
    videoRefs.current.forEach((videoEl, id) => {
      if (id === unmutedVideoId) {
        videoEl.muted = false;
      } else {
        videoEl.muted = true;
      }
    });
  }, [unmutedVideoId]);

  // Handle video card click - toggle audio
  const handleVideoCardClick = (workId: string) => {
    if (activeVideoId === workId) {
      // Already active - toggle audio
      setUnmutedVideoId(prev => prev === workId ? null : workId);
    } else {
      // Switch to this card and unmute it
      setActiveVideoId(workId);
      setUnmutedVideoId(workId);
    }
  };

  // When active video changes via hover, mute previous
  const handleVideoHover = (workId: string) => {
    if (workId !== activeVideoId) {
      setActiveVideoId(workId);
      // Mute previous when switching via hover
      setUnmutedVideoId(null);
    }
  };

  return (
    <section
      id="work-section"
      className={`pt-24 pb-8 relative z-10 px-4 md:px-8 transition-all duration-500 mx-auto ${
        siteSettings.website_full_width === "true" ? "max-w-none w-full" : "max-w-7xl"
      }`}
    >
      {/* SECTION HEADER */}
      <div className="text-center mb-16">
        <motion.span
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase font-mono font-medium tracking-widest text-[#ffea00] bg-[#ffea00]/5 border border-[#ffea00]/15 rounded-full px-4 py-1.5 inline-block mb-4"
        >
          Visual Artifacts
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6"
        >
          Our Visual Curation
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base"
        >
          Explore a curation of hyper-aesthetic short-films and computational graphic design layers synthesized entirely by bhakty.studio.
        </motion.p>
      </div>

      <div className="space-y-20">
        {/* ==================================================== */}
        {/* SECTION 1: MOTION PORTFOLIO (VIDEOS ACCORDION)       */}
        {/* ==================================================== */}
        {motionWorks.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3 flex-wrap">
              <Film className="w-5 h-5 text-[#ffea00]" />
              <h3 className="font-display font-medium text-xl text-white">Motion Portfolio</h3>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider ml-2 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {motionWorks.length} Synths
              </span>
              <span className="text-[10px] font-mono text-gray-500 italic ml-auto hidden sm:inline">
                (Click on the thumbnail to enable sound)
              </span>
            </div>

            {/* Accordion List Wrapper */}
            <div className="flex flex-col md:flex-row gap-3.5 w-full h-[520px] md:h-[460px] overflow-hidden select-none">
              {motionWorks.map((work) => {
                const isActive = activeVideoId === work.id;
                const isUnmuted = unmutedVideoId === work.id;
                return (
                  <div
                    key={work.id}
                    onMouseEnter={() => handleVideoHover(work.id)}
                    onClick={() => handleVideoCardClick(work.id)}
                    className={`relative rounded-[2rem] overflow-hidden cursor-pointer border border-white/5 bg-[#050508]/80 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                      isActive 
                        ? "flex-[4] shadow-2xl border-white/10 shadow-[#ffea00]/5" 
                        : "flex-[0.5] hover:flex-[0.7] opacity-65 hover:opacity-90"
                    }`}
                  >
                    {/* Media container */}
                    <div className="absolute inset-0 z-0 bg-black/45">
                      <video
                        ref={(el) => setVideoRef(work.id, el)}
                        src={work.videoUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover opacity-80"
                      />
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
                    </div>

                    {/* Audio indicator icon at top-right when expanded and unmuted */}
                    {isActive && (
                      <div className="absolute top-4 right-4 z-30 pointer-events-none">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all duration-300 ${
                          isUnmuted 
                            ? "bg-[#ffea00]/20 border border-[#ffea00]/40 text-[#ffea00]" 
                            : "bg-white/5 border border-white/10 text-gray-400"
                        }`}>
                          {isUnmuted ? (
                            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                          ) : (
                            <VolumeX className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">{isUnmuted ? "Sound On" : "Muted"}</span>
                        </div>
                      </div>
                    )}

                    {/* Bottom-left overlay info */}
                    <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 z-20 pointer-events-none">
                      {/* Text details (Fades in dynamically) */}
                      <div 
                        className={`flex flex-col select-none transition-all duration-700 ${
                          isActive 
                            ? "opacity-100 translate-x-0 w-auto max-w-full" 
                            : "opacity-0 -translate-x-4 w-0 overflow-hidden"
                        }`}
                      >
                        <h4 className="font-display font-black text-base md:text-lg text-white tracking-tight truncate leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                          {work.title}
                        </h4>
                        <p className="text-[10px] text-gray-300 font-mono tracking-widest uppercase truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] mt-0.5">
                          {work.category}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* SECTION 2: STATIC DESIGN (IMAGES ACCORDION)          */}
        {/* ==================================================== */}
        {staticWorks.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <ImageIcon className="w-5 h-5 text-[#ffea00]" />
              <h3 className="font-display font-medium text-xl text-white">Static Design</h3>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider ml-2 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {staticWorks.length} Layers
              </span>
            </div>

            {/* Accordion List Wrapper */}
            <div className="flex flex-col md:flex-row gap-3.5 w-full h-[520px] md:h-[460px] overflow-hidden select-none">
              {staticWorks.map((work) => {
                const isActive = activeImageId === work.id;
                return (
                  <div
                    key={work.id}
                    onMouseEnter={() => setActiveImageId(work.id)}
                    onClick={() => {
                      if (isActive) {
                        setSelectedImage(work);
                      } else {
                        setActiveImageId(work.id);
                      }
                    }}
                    className={`relative rounded-[2rem] overflow-hidden cursor-pointer border border-white/5 bg-[#050508]/80 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                      isActive 
                        ? "flex-[4] shadow-2xl border-white/10 shadow-[#ffea00]/5" 
                        : "flex-[0.5] hover:flex-[0.7] opacity-65 hover:opacity-90"
                    }`}
                  >
                    {/* Media container: uses object-contain when active for original aspect ratios */}
                    <div className="absolute inset-0 z-0 bg-[#050508]/95 flex items-center justify-center">
                      <img
                        src={work.imageUrl || work.videoUrl}
                        alt={work.title}
                        draggable="false"
                        className={`transition-all duration-700 ${
                          isActive 
                            ? "w-full h-full object-contain p-6 opacity-100" 
                            : "w-full h-full object-cover opacity-75"
                        }`}
                      />
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
                    </div>

                    {/* Bottom-left overlay info */}
                    <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 z-20 pointer-events-none">
                      {/* Text details (Fades in dynamically) */}
                      <div 
                        className={`flex flex-col select-none transition-all duration-700 ${
                          isActive 
                            ? "opacity-100 translate-x-0 w-auto max-w-full" 
                            : "opacity-0 -translate-x-4 w-0 overflow-hidden"
                        }`}
                      >
                        <h4 className="font-display font-black text-base md:text-lg text-white tracking-tight truncate leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
                          {work.title}
                        </h4>
                        <p className="text-[10px] text-gray-300 font-mono tracking-widest uppercase truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] mt-0.5">
                          {work.category}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* COMPACT SECURE PREVIEW MODAL FOR IMAGES ONLY (z-index sits below top navigation bar) */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[9998] bg-[#050508]/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-panel-heavy rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col border border-white/10 p-4"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/60 border border-white/10 text-gray-300 hover:text-white hover:border-[#ffea00] transition-all duration-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Image Frame */}
              <div className="w-full overflow-hidden rounded-2xl flex items-center justify-center bg-black/40 p-2">
                <img
                  src={selectedImage.imageUrl || selectedImage.videoUrl}
                  alt={selectedImage.title}
                  draggable="false"
                  className="max-h-[60vh] object-contain rounded-xl w-full"
                />
              </div>

              {/* Text Meta info */}
              <div className="pt-4 px-2">
                <h4 className="font-display font-bold text-lg text-white tracking-tight leading-tight">
                  {selectedImage.title}
                </h4>
                <p className="text-xs text-gray-400 font-mono tracking-wide uppercase mt-1">
                  {selectedImage.category}
                </p>
                {selectedImage.description && (
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    {selectedImage.description}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
