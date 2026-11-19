import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { VideoBlock } from "../types";
import { trackEvent } from "../lib/analytics";

export const getVideoThumbnail = (videoUrl: string): string => {
  if (!videoUrl) return "";
  if (videoUrl.includes("res.cloudinary.com")) {
    let optimized = videoUrl;
    if (optimized.includes("/video/upload/")) {
      optimized = optimized.replace("/video/upload/", "/video/upload/so_0,q_auto,f_auto,w_800/");
    }
    optimized = optimized.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
    return optimized;
  }
  return "";
};

const withStillFrameFragment = (url: string): string => {
  if (!url) return "";
  if (url.includes("#t=")) return url;
  return `${url}#t=0.5`;
};

const WorkVideoMedia: React.FC<{
  videoUrl: string;
  isHovered: boolean;
}> = ({ videoUrl, isHovered }) => {
  const tileVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const vid = tileVideoRef.current;
    if (!vid) return;
    if (isHovered) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isHovered]);

  return (
    <video
      ref={tileVideoRef}
      src={withStillFrameFragment(videoUrl)}
      muted
      loop
      playsInline
      preload="metadata"
      className="w-full h-full object-cover object-center transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-105 pointer-events-none"
    />
  );
};

export default function ShowcaseGrid() {
  const { siteSettings, portfolioWorks = [], portfolioTabs = [] } = useSiteData();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [lightboxWork, setLightboxWork] = useState<VideoBlock | null>(null);

  // Lightbox player controls state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lightboxContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);

  // Build sorted tabs: "All" + DB tabs in display_order
  const sortedTabs = [
    { id: "all", title: "All" },
    ...portfolioTabs
      .slice()
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      .map((t) => ({ id: t.id, title: t.tab_title })),
  ];

  // Filter works
  const filteredWorks = portfolioWorks.filter((work) => {
    if (selectedFilter === "all") return true;
    return work.tab_id === selectedFilter || work.category?.toLowerCase().includes(selectedFilter.toLowerCase());
  });

  // Deep linking via URL hash #work/{id}
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#work/")) {
        const id = hash.replace("#work/", "");
        const match = portfolioWorks.find((w) => w.id === id);
        if (match) setLightboxWork(match);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [portfolioWorks]);

  // Open Lightbox
  const openLightbox = (work: VideoBlock) => {
    setLightboxWork(work);
    setIsPlaying(true);
    setIsMuted(false);
    setProgress(0);
    window.history.pushState(null, "", `#work/${work.id}`);
    trackEvent("video_play", `work_view_${work.id}`, { title: work.title });
  };

  // Close Lightbox
  const closeLightbox = () => {
    setLightboxWork(null);
    if (window.location.hash.startsWith("#work/")) {
      window.history.pushState(null, "", "#work");
    }
  };

  // Lightbox Prev/Next
  const navigateLightbox = useCallback(
    (direction: "prev" | "next") => {
      if (!lightboxWork || filteredWorks.length <= 1) return;
      const currentIndex = filteredWorks.findIndex((w) => w.id === lightboxWork.id);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === "next"
          ? (currentIndex + 1) % filteredWorks.length
          : (currentIndex - 1 + filteredWorks.length) % filteredWorks.length;

      const nextWork = filteredWorks[nextIndex];
      setLightboxWork(nextWork);
      setProgress(0);
      window.history.pushState(null, "", `#work/${nextWork.id}`);
      trackEvent("video_play", `work_view_${nextWork.id}`, { title: nextWork.title });
    },
    [lightboxWork, filteredWorks]
  );

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (!lightboxWork) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowLeft") {
        navigateLightbox("prev");
      } else if (e.key === "ArrowRight") {
        navigateLightbox("next");
      } else if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxWork, navigateLightbox]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const el = lightboxContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const tot = videoRef.current.duration || 1;
    setCurrentTime(curr);
    setTotalDuration(tot);
    setProgress((curr / tot) * 100);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * (videoRef.current.duration || 0);
    setProgress(pos * 100);
  };

  const handleControlsMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <section id="work" className="relative w-full py-28 bg-[var(--tcs-night)] select-none">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-2">
              {siteSettings.work_eyebrow || "SELECTED WORK"}
            </p>
            <h2 className="tcs-h2 text-[var(--tcs-offwhite)]">
              {siteSettings.work_title || "Brands, worlds and everything between."}
            </h2>
          </div>

          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-dim)]">
            {filteredWorks.length} {filteredWorks.length === 1 ? "FILM" : "FILMS"}
          </p>
        </div>

        {/* Filter Chips */}
        {sortedTabs.length > 1 && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-4 mb-10 scrollbar-none">
            {sortedTabs.map((tab) => {
              const isActive = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id)}
                  className={`px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.12em] border transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] border-[var(--tcs-offwhite)] font-bold shadow-lg"
                      : "border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:text-[var(--tcs-offwhite)] hover:border-[var(--tcs-offwhite)]/40 bg-[var(--tcs-night-2)]/40"
                  }`}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>
        )}

        {/* 12-Column Editorial Grid with Varied Spans */}
        {filteredWorks.length > 0 ? (
          <LayoutGroup>
            <div className="grid grid-cols-12 gap-4 md:gap-5">
              {filteredWorks.map((work, idx) => {
                const patternIdx = idx % 5;
                // Varied editorial spans pattern: 8-col wide (16:9), 4-col tall (4:5), three 4-col (16:9)
                let spanClass = "col-span-12 md:col-span-4 aspect-video";
                if (patternIdx === 0) {
                  spanClass = "col-span-12 md:col-span-8 aspect-video";
                } else if (patternIdx === 1) {
                  spanClass = "col-span-12 md:col-span-4 aspect-[4/5]";
                } else if (work.ratio === "portrait") {
                  spanClass = "col-span-12 md:col-span-4 aspect-[4/5]";
                }

                const isHovered = activeHoverId === work.id;
                const isImage = work.type === "image";
                const mediaVideoUrl = work.videoUrl || work.highResVideoUrl || "";
                const imageSrc = work.imageUrl || work.highResVideoUrl || work.videoUrl || "";

                return (
                  <motion.div
                    key={work.id}
                    layout
                    data-cursor="view"
                    onClick={() => openLightbox(work)}
                    onMouseEnter={() => setActiveHoverId(work.id)}
                    onMouseLeave={() => setActiveHoverId(null)}
                    className={`relative rounded overflow-hidden bg-[var(--tcs-night-2)] border border-[var(--tcs-line)] group cursor-pointer ${spanClass}`}
                  >
                    {/* Still Frame from Video (plays on hover) or Image Work */}
                    {!isImage && mediaVideoUrl ? (
                      <WorkVideoMedia videoUrl={mediaVideoUrl} isHovered={isHovered} />
                    ) : imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={work.title}
                        loading="lazy"
                        className="w-full h-full object-cover object-center transition-transform duration-700 ease-[0.16,1,0.3,1] group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-[var(--tcs-night-2)]" />
                    )}

                    {/* Spectral Conic Border Sweep on Hover */}
                    <div
                      className="absolute inset-0 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20"
                      style={{
                        padding: 1,
                        background: "var(--tcs-spectrum-conic)",
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                        maskComposite: "exclude",
                      }}
                    />

                    {/* Bottom Scrim & Directorial Metadata */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5 md:p-6 z-20 pointer-events-none">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-1">
                        {[work.category, work.creator, "2026"].filter(Boolean).join(" — ")}
                      </p>
                      <h3 className="font-display font-medium text-lg md:text-xl text-[var(--tcs-offwhite)] tracking-tight">
                        {work.title}
                      </h3>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </LayoutGroup>
        ) : (
          /* Poetic Empty State (No stock footage) */
          <div className="py-24 px-8 border border-[var(--tcs-line)] rounded text-center bg-[var(--tcs-night-2)]/40 max-w-2xl mx-auto">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-dim)] mb-3">
              STUDIO ARCHIVE
            </p>
            <h3 className="font-display font-light text-2xl text-[var(--tcs-offwhite)] mb-3">
              Directorial curation in progress.
            </h3>
            <p className="font-sans text-[var(--tcs-muted)] text-sm mb-6 max-w-md mx-auto">
              Our active productions and private brand pitch reels are available upon request.
            </p>
            <a
              href="#contact"
              className="inline-block px-6 py-2.5 rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold hover:bg-white transition-all"
            >
              Request Private Screening
            </a>
          </div>
        )}
      </div>

      {/* Full-Screen Lightbox Player Modal */}
      <AnimatePresence>
        {lightboxWork && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseMove={handleControlsMove}
            className="fixed inset-0 z-[9995] bg-[#07080C]/96 backdrop-blur-2xl flex flex-col justify-between p-6 md:p-10"
          >
            {/* Top Navigation Bar in Lightbox */}
            <div className="flex items-center justify-between w-full max-w-[1600px] mx-auto z-50">
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)]">
                  {lightboxWork.category || "FILM"}
                </span>
                <span className="text-white/20">•</span>
                <span className="font-display font-medium text-sm text-[var(--tcs-offwhite)]">
                  {lightboxWork.title}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigateLightbox("prev")}
                  aria-label="Previous project"
                  className="p-2 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateLightbox("next")}
                  aria-label="Next project"
                  className="p-2 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  aria-label="Close viewer"
                  className="p-2 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Media Viewport */}
            <div
              ref={lightboxContainerRef}
              className="relative w-full max-w-[1400px] mx-auto flex-1 flex items-center justify-center my-4 overflow-hidden rounded border border-[var(--tcs-line)] bg-black"
            >
              {lightboxWork.type === "image" ? (
                <img
                  src={lightboxWork.videoUrl || lightboxWork.highResVideoUrl}
                  alt={lightboxWork.title}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={lightboxWork.highResVideoUrl || lightboxWork.videoUrl}
                    poster={getVideoThumbnail(lightboxWork.highResVideoUrl || lightboxWork.videoUrl) || undefined}
                    playsInline
                    autoPlay
                    onTimeUpdate={handleTimeUpdate}
                    onClick={togglePlayPause}
                    className="max-h-full max-w-full object-contain cursor-pointer"
                  />

                  {/* Player Controls */}
                  <motion.div
                    animate={{ opacity: showControls || !isPlaying ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 left-0 w-full p-6 pt-12 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto"
                  >
                    {/* Scrubbable Progress Bar with Spectrum */}
                    <div
                      onClick={handleSeek}
                      className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-3"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${progress}%`,
                          background: "var(--tcs-spectrum-linear)",
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[var(--tcs-offwhite)]">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={togglePlayPause}
                          className="hover:text-white transition-colors cursor-pointer"
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                        </button>
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="hover:text-white transition-colors cursor-pointer"
                        >
                          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <span className="font-mono text-xs text-[var(--tcs-muted)]">
                          {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>

            {/* Bottom Meta & Synopsis */}
            <div className="w-full max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="font-sans text-[var(--tcs-muted)] text-sm leading-relaxed mb-2">
                  {lightboxWork.description}
                </p>
                {lightboxWork.tags && lightboxWork.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lightboxWork.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--tcs-line)] text-[var(--tcs-dim)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="#contact"
                onClick={() => {
                  closeLightbox();
                  const el = document.getElementById("contact");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-5 py-2.5 rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold hover:bg-white transition-all whitespace-nowrap self-start md:self-auto"
              >
                Inquire About Similar Project →
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
