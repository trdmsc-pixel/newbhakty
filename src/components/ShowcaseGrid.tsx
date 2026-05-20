import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, X, User, Clock, Tag, Volume2, Info, Share2 } from "lucide-react";
import { VideoBlock } from "../types";
import { PORTFOLIO_VIDEOS } from "../data";

export default function ShowcaseGrid() {
  const [selectedVideo, setSelectedVideo] = useState<VideoBlock | null>(null);
  const [isHoveredId, setIsHoveredId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>("All Projects");

  const categories = ["All Projects", "AI Commercial", "Sci-Fi Cinematic", "Motion Art", "Concept Stage"];

  const filteredVideos = selectedTab === "All Projects"
    ? PORTFOLIO_VIDEOS
    : PORTFOLIO_VIDEOS.filter(v => v.category.includes(selectedTab));

  return (
    <section id="work-section" className="py-24 relative z-10 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* SECTION HEADER */}
      <div className="text-center mb-16">
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
          className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6"
        >
          Synthesized Motion Artifacts
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base"
        >
          Explore a curation of hyper-aesthetic short-films, digital lookbooks, and computational environments synthesized entirely by bhakty.studio.
        </motion.p>
      </div>

      {/* FILTER TABS */}
      <div className="flex flex-wrap justify-center items-center gap-2 mb-12">
        {categories.map((category) => (
          <button
            key={category}
            id={`filter-tab-${category.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setSelectedTab(category)}
            className={`px-5 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-300 ${
              selectedTab === category
                ? "bg-white text-black shadow-lg shadow-white/10"
                : "text-gray-400 hover:text-white glass-panel-light hover:bg-white/5"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* PORTFOLIO GRID */}
      <motion.div 
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8 min-h-[400px]"
      >
        <AnimatePresence mode="popLayout">
          {filteredVideos.map((video) => (
            <motion.div
              layout
              key={video.id}
              id={`portfolio-card-${video.id}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ 
                scale: 1.03,
                transition: { type: "spring", stiffness: 150, damping: 12 }
              }}
              onHoverStart={() => setIsHoveredId(video.id)}
              onHoverEnd={() => setIsHoveredId(null)}
              onClick={() => setSelectedVideo(video)}
              className={`group relative overflow-hidden rounded-2xl glass-panel shadow-xl cursor-all-scroll ${video.aspectRatioClass}`}
            >
              
              {/* VIDEO FRAME RENDER */}
              <div className="absolute inset-0 z-0 bg-black/40">
                <video
                  src={video.videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover opacity-80 group-hover:scale-[1.04] transition-transform duration-1000 ease-out"
                />
              </div>

              {/* OVERLAY GRADIENTS */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-90" />
              
              {/* SHADOW PULSING GLOW ON HOVER */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#4A36B3]/30 via-[#4A36B3]/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-15" />

              {/* CONTENT LAYER */}
              <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-8">
                
                {/* TOP BAR */}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-mono tracking-widest uppercase bg-white/10 backdrop-blur-md text-white/95 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                    <Tag className="w-3 h-3 text-[#E6C687]" />
                    {video.tags[0]}
                  </span>
                  <span className="text-xs font-mono text-white/70 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md border border-white/5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-white/50" />
                    {video.duration}
                  </span>
                </div>

                {/* BOTTOM BRANDING & DETAILS */}
                <div>
                  <h3 className="font-display font-medium text-xl md:text-2xl text-white tracking-tight mb-2 group-hover:text-[#E6C687] transition-all duration-300">
                    {video.title}
                  </h3>
                  
                  <p className="text-xs md:text-sm text-gray-300 line-clamp-2 max-w-sm mb-4 opacity-0 group-hover:opacity-100 duration-300 transition-all transform translate-y-2 group-hover:translate-y-0">
                    {video.description}
                  </p>

                  <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2">
                    <span className="text-xs font-mono text-gray-400 font-light flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                      {video.creator}
                    </span>
                    
                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-md group-hover:bg-[#E6C687] group-hover:text-black transition-all duration-300 group-hover:scale-110">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {/* FULL SCREEN GLASS OVERLAY MODAL */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            id="video-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#050508]/85 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <motion.div
              id="video-modal-card"
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
              className="glass-panel-heavy rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl relative flex flex-col md:flex-row border border-white/15"
            >
              
              {/* CLOSE BUTTON */}
              <button
                id="close-modal-btn"
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-black/50 border border-white/15 text-gray-300 hover:text-white hover:bg-black/80 hover:scale-110 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>

              {/* MEDIA WORKSPACE PANEL */}
              <div className="w-full md:w-2/3 bg-black/80 aspect-video md:aspect-auto md:h-[550px] relative flex items-center justify-center">
                <video
                  src={selectedVideo.highResVideoUrl}
                  autoPlay
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
                
                {/* Direct audio watermark note */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 px-3 py-1 rounded-md text-[10px] font-mono text-[#E6C687]/90 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-[#E6C687]" />
                  Internal Audio Stream Active
                </div>
              </div>

              {/* META INFORMATION SIDEBAR */}
              <div className="w-full md:w-1/3 p-6 md:p-8 flex flex-col justify-between bg-[#0e0e16]/80 text-left border-t md:border-t-0 md:border-l border-white/15">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-300/90 border border-amber-300/20 bg-amber-300/5 px-2.5 py-1 rounded-md mb-4 inline-block">
                    {selectedVideo.category.split(" / ")[0]}
                  </span>
                  
                  <h3 className="font-display font-medium text-2xl text-white tracking-tight mb-3">
                    {selectedVideo.title}
                  </h3>
                  
                  <p className="text-gray-300 text-sm leading-relaxed mb-6">
                    {selectedVideo.description}
                  </p>

                  {/* DETAILS CARD */}
                  <div className="space-y-3.5 bg-black/30 border border-white/5 rounded-xl p-4.5 mb-6">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-light flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-500" /> Lead Synth
                      </span>
                      <span className="text-gray-100 font-mono font-medium">{selectedVideo.creator}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-light flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-gray-500" /> Loop Period
                      </span>
                      <span className="text-gray-100 font-mono font-medium">{selectedVideo.duration}s cycles</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-light flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-gray-500" /> Compression
                      </span>
                      <span className="text-[#E6C687] font-mono font-medium">Native MP4 H.264</span>
                    </div>
                  </div>

                  {/* SYSTEM TAGS */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {selectedVideo.tags.map((tag, i) => (
                      <span key={i} className="text-[10px] font-mono text-gray-400 bg-white/5 px-2.5 py-1 rounded">
                        #{tag.toLowerCase().replace(/\s+/g, '')}
                      </span>
                    ))}
                  </div>
                </div>

                {/* MODAL INTERACTIONS FOOTER */}
                <div className="pt-4 border-t border-white/5 flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedVideo.videoUrl);
                      alert("Stream URL copied to clipboard!");
                    }}
                    className="flex-1 py-2.5 rounded-xl glass-panel-light hover:bg-white/10 text-white font-medium text-xs font-display flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Copy Stream
                  </button>
                  <button
                    onClick={() => {
                      const signup = document.getElementById("booking-section");
                      setSelectedVideo(null);
                      if (signup) {
                        setTimeout(() => {
                          signup.scrollIntoView({ behavior: "smooth" });
                        }, 200);
                      }
                    }}
                    className="flex-[1.2] py-2.5 rounded-xl bg-white text-black hover:bg-[#E6C687] transition-all duration-300 font-semibold text-xs font-display flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Acquire License
                  </button>
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
