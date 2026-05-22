import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, X, User, Clock, Tag, Info, Eye, Image as ImageIcon } from "lucide-react";
import { VideoBlock } from "../types";
import { useSiteData } from "../context/SiteDataContext";
import { trackEvent } from "../lib/analytics";

export default function ShowcaseGrid() {
  const { portfolioWorks = [], siteSettings } = useSiteData();
  const [selectedWork, setSelectedWork] = useState<VideoBlock | null>(null);

  const [isHoveredId, setIsHoveredId] = useState<string | null>(null);
  const [activeTypeTab, setActiveTypeTab] = useState<"video" | "image">("video");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("All Projects");
  const [loadingVideos, setLoadingVideos] = useState<Record<string, boolean>>({});
  const [modalVideoLoading, setModalVideoLoading] = useState(true);

  // Filter works by primary type (video/image)
  const typeFilteredWorks = portfolioWorks.filter((w) => {
    const itemType = w.type || "video";
    return itemType === activeTypeTab;
  });

  // Dynamically extract categories present in current list
  const categories: string[] = [
    "All Projects",
    ...(Array.from(new Set(typeFilteredWorks.map((w) => w.category).filter(Boolean))) as string[]),
  ];

  // Filter works by dynamic category tab
  const filteredWorks = selectedCategoryTab === "All Projects"
    ? typeFilteredWorks
    : typeFilteredWorks.filter((w) => w.category === selectedCategoryTab);

  return (
    <section
      id="work-section"
      className={`pt-24 pb-8 relative z-10 px-4 md:px-8 transition-all duration-500 ${
        siteSettings.website_full_width === "true"
          ? "max-w-none w-full"
          : "max-w-7xl mx-auto"
      }`}
    >
      {/* SECTION HEADER */}
      <div className="text-center mb-12">
        <motion.span
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase font-mono font-medium tracking-widest text-[#E6C687] bg-[#E6C687]/5 border border-[#E6C687]/15 rounded-full px-4 py-1.5 inline-block mb-4"
        >
          Selected Works
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6 animate-pulse"
        >
          {activeTypeTab === "video" ? "Synthesized Motion Artifacts" : "Static Design & UGC"}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base"
        >
          {activeTypeTab === "video"
            ? "Explore a curation of hyper-aesthetic short-films, digital lookbooks, and computational environments synthesized entirely by bhakty.studio."
            : "Browse high-fidelity graphic layouts, social static assets, and computational art layers optimized for spatial platforms."}
        </motion.p>
      </div>

      {/* PRIMARY TYPE SWITCHER TABS */}
      <div className="flex justify-center items-center gap-4 mb-8">
        <button
          onClick={() => {
            setActiveTypeTab("video");
            setSelectedCategoryTab("All Projects");
            trackEvent("click", "Portfolio Type Switcher: Video");
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
            activeTypeTab === "video"
              ? "bg-[#E6C687] text-black shadow-lg shadow-[#E6C687]/20 border border-[#E6C687]/30"
              : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5 border border-white/5"
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Motion Portfolio
        </button>
        <button
          onClick={() => {
            setActiveTypeTab("image");
            setSelectedCategoryTab("All Projects");
            trackEvent("click", "Portfolio Type Switcher: Image");
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer ${
            activeTypeTab === "image"
              ? "bg-[#E6C687] text-black shadow-lg shadow-[#E6C687]/20 border border-[#E6C687]/30"
              : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5 border border-white/5"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Static Design
        </button>
      </div>

      {/* DYNAMIC CATEGORY FILTER TABS (Only shown if multiple categories exist) */}
      {categories.length > 2 && (
        <div className="flex flex-wrap justify-center items-center gap-2 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              id={`filter-tab-${category.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => {
                setSelectedCategoryTab(category);
                trackEvent("click", "Portfolio Filter Tab clicked", { category });
              }}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                selectedCategoryTab === category
                  ? "bg-white text-black shadow-lg shadow-white/10"
                  : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* PORTFOLIO GRID */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8 min-h-[300px]"
      >
        <AnimatePresence mode="popLayout">
          {filteredWorks.map((work) => {
            const isImage = work.type === "image";
            return (
              <motion.div
                layout
                key={work.id}
                id={`portfolio-card-${work.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 150, damping: 12 },
                }}
                onHoverStart={() => {
                  setIsHoveredId(work.id);
                  if (!isImage) {
                    trackEvent("video_play", `Video hover simulation initiated: ${work.title}`);
                  }
                }}
                onHoverEnd={() => setIsHoveredId(null)}
                onClick={() => {
                  setSelectedWork(work);
                  trackEvent("click", `Portfolio modal opened: ${work.title}`, { id: work.id });
                }}
                className={`group relative overflow-hidden rounded-2xl glass-panel shadow-xl cursor-pointer ${
                  work.aspectRatioClass || "aspect-video md:col-span-2"
                }`}
              >
                {/* MEDIA FRAME */}
                <div className="absolute inset-0 z-0 bg-black/40">
                  {isImage ? (
                    <div className="w-full h-full relative">
                      <img
                        src={work.imageUrl || work.videoUrl}
                        alt={work.title}
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-[1.04] transition-transform duration-1000 ease-out"
                      />
                      {/* Anti-right-click empty overlay */}
                      <div className="absolute inset-0 z-10 bg-transparent" />
                    </div>
                  ) : (
                    <video
                      src={work.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      onContextMenu={(e) => e.preventDefault()}
                      onLoadStart={() => setLoadingVideos((prev) => ({ ...prev, [work.id]: true }))}
                      onCanPlay={() => setLoadingVideos((prev) => ({ ...prev, [work.id]: false }))}
                      onPlaying={() => setLoadingVideos((prev) => ({ ...prev, [work.id]: false }))}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-[1.04] transition-transform duration-1000 ease-out"
                    />
                  )}
                </div>

                {/* LOADING OVERLAY (VIDEOS ONLY) */}
                {!isImage && loadingVideos[work.id] && (
                  <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-[#050508]/65 backdrop-blur-xs">
                    <div className="relative flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border border-[#E6C687]/20 border-t-[#E6C687] animate-spin" />
                    </div>
                    <span className="text-[8px] font-mono uppercase tracking-widest text-[#E6C687] mt-2.5">
                      Rendering Stream
                    </span>
                  </div>
                )}

                {/* GRADIENTS OVERLAYS */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-90" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#4A36B3]/20 via-[#4A36B3]/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-15" />

                {/* CARD CONTENT */}
                <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-8">
                  {/* TOP CARD CHIPS */}
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-white/10 backdrop-blur-md text-white/95 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                      <Tag className="w-3 h-3 text-[#E6C687]" />
                      {work.category || (isImage ? "Static Design" : "Video")}
                    </span>
                    {work.subtext ? (
                      <span className="text-xs font-mono text-[#E6C687]/90 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-white/5 flex items-center gap-1">
                        {work.subtext}
                      </span>
                    ) : (
                      !isImage && (
                        <span className="text-xs font-mono text-white/70 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-white/5 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-white/50" />
                          {work.duration}
                        </span>
                      )
                    )}
                  </div>

                  {/* BOTTOM INFO */}
                  <div>
                    <h3 className="font-display font-medium text-xl md:text-2xl text-white tracking-tight mb-2 group-hover:text-[#E6C687] transition-all duration-300">
                      {work.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-300 line-clamp-2 max-w-sm mb-4 opacity-0 group-hover:opacity-100 duration-300 transition-all transform translate-y-2 group-hover:translate-y-0">
                      {work.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
                      <span className="text-xs font-mono text-gray-400 font-light flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        {work.creator || "bhakty.synth"}
                      </span>

                      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-md group-hover:bg-[#E6C687] group-hover:text-black transition-all duration-300 group-hover:scale-110">
                        {isImage ? <Eye className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* PREMIUM FULLSCREEN OVERLAY MODAL */}
      <AnimatePresence>
        {selectedWork && (
          <motion.div
            id="portfolio-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#050508]/90 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <motion.div
              id="portfolio-modal-card"
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
              className="glass-panel-heavy rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row border border-white/15"
            >
              {/* CLOSE BUTTON */}
              <button
                id="close-modal-btn"
                onClick={() => setSelectedWork(null)}
                className="absolute top-4 right-4 z-[60] p-2.5 rounded-full bg-black/60 border border-white/20 text-gray-300 hover:text-white hover:bg-black/90 hover:scale-110 hover:border-[#E6C687] transition-all duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* MEDIA CONTAINER */}
              <div className="w-full md:w-2/3 bg-black/90 aspect-video md:aspect-auto md:h-[550px] relative flex items-center justify-center overflow-hidden">
                {selectedWork.type === "image" ? (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={selectedWork.imageUrl || selectedWork.videoUrl}
                      alt={selectedWork.title}
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full h-full object-contain"
                    />
                    {/* Transparent download protection overlay */}
                    <div className="absolute inset-0 z-10 bg-transparent" />
                  </div>
                ) : (
                  <>
                    <video
                      src={selectedWork.highResVideoUrl || selectedWork.videoUrl}
                      autoPlay
                      controls
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                      playsInline
                      disablePictureInPicture
                      onLoadStart={() => setModalVideoLoading(true)}
                      onCanPlay={() => setModalVideoLoading(false)}
                      onPlaying={() => setModalVideoLoading(false)}
                      className="w-full h-full object-contain"
                    />

                    {/* MODAL BUFFERING LOAD STATE */}
                    {modalVideoLoading && (
                      <div className="absolute inset-0 z-40 bg-[#050508]/90 flex flex-col items-center justify-center">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border border-violet-500/20 border-t-[#E6C687] animate-spin" />
                        </div>
                        <span className="text-[10px] font-mono tracking-widest text-[#E6C687] uppercase mt-4">
                          BUFFERING TEMPORAL FLOW...
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* SIDEBAR DESCRIPTION */}
              <div className="w-full md:w-1/3 p-6 md:p-8 flex flex-col justify-between bg-[#0e0e16]/95 text-left border-t md:border-t-0 md:border-l border-white/15">
                <div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-300/90 border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 rounded-md mb-4 inline-block">
                      {selectedWork.category || (selectedWork.type === "image" ? "Static Design" : "Video")}
                    </span>
                  </motion.div>

                  <motion.h3
                    className="font-display font-medium text-2xl text-white tracking-tight mb-3"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, type: "spring", stiffness: 100 }}
                  >
                    {selectedWork.title}
                  </motion.h3>

                  <motion.p
                    className="text-gray-300 text-sm leading-relaxed mb-6 font-light"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                  >
                    {selectedWork.description}
                  </motion.p>

                  {/* INFO PANEL */}
                  <motion.div
                    className="space-y-3.5 bg-black/35 border border-white/5 rounded-xl p-4.5 mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-light flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-500" /> Lead Artist
                      </span>
                      <span className="text-gray-100 font-mono font-medium">
                        {selectedWork.creator || "bhakty.synth"}
                      </span>
                    </div>

                    {selectedWork.type === "image" ? (
                      selectedWork.subtext && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 font-light flex items-center gap-2">
                            <Info className="w-3.5 h-3.5 text-gray-500" /> Detail
                          </span>
                          <span className="text-gray-100 font-mono font-medium">{selectedWork.subtext}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-light flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-500" /> Loop Duration
                        </span>
                        <span className="text-gray-100 font-mono font-medium">{selectedWork.duration}s</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-light flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-gray-500" /> Medium Format
                      </span>
                      <span className="text-[#E6C687] font-mono font-medium">
                        {selectedWork.type === "image" ? "Lossless Raster WebP" : "Native MP4 H.264"}
                      </span>
                    </div>
                  </motion.div>

                  {/* SYSTEM TAGS */}
                  <motion.div
                    className="flex flex-wrap gap-1.5 mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                  >
                    {(selectedWork.tags || []).map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded border border-white/5"
                      >
                        #{tag.toLowerCase().replace(/\s+/g, "")}
                      </span>
                    ))}
                  </motion.div>
                </div>

                {/* MODAL INTERACTIONS FOOTER */}
                <motion.div
                  className="pt-4 border-t border-white/5 flex gap-3"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <button
                    onClick={() => {
                      const signup = document.getElementById("booking-section");
                      setSelectedWork(null);
                      trackEvent("click", "Acquire License clicked", {
                        title: selectedWork.title,
                        category: selectedWork.category,
                      });
                      if (signup) {
                        setTimeout(() => {
                          signup.scrollIntoView({ behavior: "smooth" });
                        }, 200);
                      }
                    }}
                    className="w-full py-3 rounded-xl bg-white text-black hover:bg-[#E6C687] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 font-semibold text-xs font-display flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-[#E6C687]/20"
                  >
                    {siteSettings.portfolio_license_button_text || "Acquire License"}
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
