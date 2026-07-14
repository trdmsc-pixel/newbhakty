import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Film, Image as ImageIcon, Volume2, VolumeX, ChevronLeft, ChevronRight, X, Download } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { optimizeVideoUrl, optimizeImageUrl } from "../lib/cloudinary";
import { trackEvent } from "../lib/analytics";

export const getVideoThumbnail = (videoUrl: string): string => {
  if (!videoUrl) return "";
  if (videoUrl.includes("res.cloudinary.com")) {
    let optimized = videoUrl;
    if (optimized.includes("/video/upload/")) {
      optimized = optimized.replace("/video/upload/", "/video/upload/so_0,q_auto,f_auto,w_600/");
    }
    optimized = optimized.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
    return optimized;
  }
  return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80";
};

export default function ShowcaseGrid() {
  const { portfolioWorks = [], portfolioTabs = [], siteSettings, activePage } = useSiteData();

  const videoScrollRef = useRef<HTMLDivElement>(null);
  const imageScrollRef = useRef<HTMLDivElement>(null);

  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
    const container = ref.current;
    if (!container) return;
    dragStartPos.current = { x: e.pageX, y: e.pageY };
    isDragging.current = false;

    const startX = e.pageX - container.offsetLeft;
    const scrollLeft = container.scrollLeft;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = Math.abs(moveEvent.pageX - dragStartPos.current.x);
      const dy = Math.abs(moveEvent.pageY - dragStartPos.current.y);
      if (dx > 5 || dy > 5) {
        isDragging.current = true;
      }
      if (isDragging.current) {
        const x = moveEvent.pageX - container.offsetLeft;
        const walk = (x - startX) * 1.5;
        container.scrollLeft = scrollLeft - walk;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const scrollContainer = (direction: "left" | "right", ref: React.RefObject<HTMLDivElement | null>) => {
    const container = ref.current;
    if (!container) return;
    const scrollAmount = 350;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // State to track the active portfolio tab id
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [visibleCardIds, setVisibleCardIds] = useState<Set<string>>(new Set());

  // Default to the first available tab for this page, resetting when switching page context
  useEffect(() => {
    if (portfolioTabs.length > 0) {
      const isValid = portfolioTabs.some((t) => t.id === activeTabId);
      if (!isValid) {
        setActiveTabId(portfolioTabs[0].id);
      }
    } else {
      setActiveTabId("");
    }
  }, [portfolioTabs, activePage, activeTabId]);

  const activeTab = portfolioTabs.find((t) => t.id === activeTabId) || portfolioTabs[0];

  // Filter works matching the active tab ID, falling back to tab type if tab_id is unassigned
  const activeWorks = portfolioWorks.filter((w) => {
    if (w.tab_id) {
      return w.tab_id === activeTabId;
    }
    return w.type === (activeTab?.tab_type || "video");
  });

  // Accordion active item state
  const [activeVideoId, setActiveVideoId] = useState<string>("");
  const [unmutedVideoId, setUnmutedVideoId] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string>("");
  const [previewVideoWork, setPreviewVideoWork] = useState<any | null>(null);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Set up IntersectionObserver to track visible cards in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleCardIds((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const id = entry.target.getAttribute("data-card-id");
            if (id) {
              if (entry.intersectionRatio >= 0.5) {
                next.add(id);
              } else {
                next.delete(id);
              }
            }
          });
          return next;
        });
      },
      {
        threshold: [0.1, 0.5, 0.9],
        rootMargin: "-10% 0px -10% 0px",
      }
    );

    const observedElements = new Set<HTMLDivElement>();
    cardRefs.current.forEach((el) => {
      observer.observe(el);
      observedElements.add(el);
    });

    return () => {
      observedElements.forEach((el) => {
        try {
          observer.unobserve(el);
        } catch (e) {}
      });
      observer.disconnect();
    };
  }, [activeWorks]);

  // Refs for all video elements to control audio
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    if (el) {
      el.muted = id !== unmutedVideoId;
      el.defaultMuted = true;
      el.playsInline = true;
      videoRefs.current.set(id, el);
      
      // Snappy play/pause sync when ref mounts
      if (id === activeVideoId) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    } else {
      videoRefs.current.delete(id);
    }
  }, [unmutedVideoId, activeVideoId]);

  // Sync the DOM element's muted state and play/pause state dynamically
  useEffect(() => {
    videoRefs.current.forEach((el, id) => {
      if (el) {
        // Mute/unmute sync
        const shouldMute = id !== unmutedVideoId;
        if (el.muted !== shouldMute) {
          el.muted = shouldMute;
        }

        // Active video play/pause sync
        const isActive = id === activeVideoId;
        if (isActive) {
          el.play().catch((err) => {
            console.debug("Autoplay play() request was interrupted:", err);
          });
        } else {
          el.pause();
        }
      }
    });
  }, [unmutedVideoId, activeVideoId, activeWorks]);

  // Handle auto-defaulting active cards when activeWorks or activeTabId changes
  useEffect(() => {
    if (activeWorks.length > 0) {
      if (activeTab?.tab_type === "video") {
        if (!activeWorks.some(w => w.id === activeVideoId)) {
          setActiveVideoId(activeWorks[0].id);
          setUnmutedVideoId(null);
        }
      } else {
        if (!activeWorks.some(w => w.id === activeImageId)) {
          setActiveImageId(activeWorks[0].id);
        }
      }
    }
  }, [activeWorks, activeTab, activeVideoId, activeImageId]);

  // Handle video card click
  const handleVideoCardClick = (workId: string) => {
    if (isDragging.current) return;
    const work = activeWorks.find(w => w.id === workId);
    if (work) {
      setPreviewVideoWork(work);
      setIsPreviewMuted(false);
      trackEvent(
        "video_play", 
        `Desktop: Opened Video Preview popup: ${work.title}`, 
        { workId: work.id, title: work.title }
      );
    }
  };

  // When active video changes via hover, mute previous
  const handleVideoHover = (workId: string) => {
    if (isDragging.current) return;
    if (workId !== activeVideoId) {
      setActiveVideoId(workId);
      setUnmutedVideoId(null);
      const work = activeWorks.find(w => w.id === workId);
      if (work) {
        trackEvent(
          "video_play", 
          `Video Hover: ${work.title}`, 
          { workId: work.id, title: work.title, category: work.category }
        );
      }
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
          className="text-xs uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4"
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

      {/* TABS SELECTOR */}
      {portfolioTabs.length > 0 && (
        <div className="flex justify-center mb-12">
          <div className="relative flex items-center p-1.5 rounded-full bg-[#0a0a0c]/65 backdrop-blur-xl border border-white/5 shadow-2xl" style={{ isolation: "isolate" }}>
            {portfolioTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className="relative px-6 py-2.5 rounded-full text-xs font-mono tracking-wider uppercase transition-colors duration-300 select-none cursor-pointer focus:outline-none z-10"
                >
                  <span
                    className={`relative z-20 transition-colors duration-300 ${
                      isActive ? "text-white font-semibold" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {tab.tab_title}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-white/10 to-white/5 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)] overflow-hidden z-0"
                      style={{
                        willChange: "transform, opacity",
                        translateZ: 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 350,
                        damping: 22,
                        mass: 0.9,
                      }}
                    >
                      {/* Volumetric radial glow overlay */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.12)_0%,_transparent_65%)]" />
                    </motion.div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTENT AREA WITH ANIMATEPRESENCE */}
      <div className="relative min-h-[460px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTabId}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full"
          >
            {activeTab?.tab_type === "video" ? (
              activeWorks.length > 0 ? (
                <div className="relative group w-full">
                  <div 
                    ref={videoScrollRef}
                    onMouseDown={(e) => handleMouseDown(e, videoScrollRef)}
                    className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-none gap-4 pb-4 w-full h-[520px] md:h-[460px] select-none relative scroll-smooth cursor-grab active:cursor-grabbing"
                  >
                    {activeWorks.map((work) => {
                      const isActive = activeVideoId === work.id;
                      const isUnmuted = unmutedVideoId === work.id;
                      const isCardVisible = visibleCardIds.has(work.id);
                      const shouldRenderVideo = isActive && isCardVisible;

                      return (
                        <div
                          key={work.id}
                          onMouseEnter={() => handleVideoHover(work.id)}
                          onClick={() => handleVideoCardClick(work.id)}
                          className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] h-full relative cursor-pointer snap-start"
                        >
                          {/* Inner visual scaling wrapper container */}
                          <div
                            ref={(el) => {
                              if (el) {
                                cardRefs.current.set(work.id, el);
                              } else {
                                cardRefs.current.delete(work.id);
                              }
                            }}
                            data-card-id={work.id}
                            className={`absolute top-0 bottom-0 left-0 rounded-[2rem] overflow-hidden border border-white/5 bg-[#050508]/80 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                              isActive 
                                ? "z-30 shadow-2xl border-white/10 shadow-accent/5 opacity-100" 
                                : "z-10 opacity-65 hover:opacity-90 w-full"
                            }`}
                            style={{
                              width: isDesktop && isActive && aspectRatios[work.id]
                                ? `${460 * aspectRatios[work.id]}px`
                                : "100%",
                              transform: isDesktop && isActive ? "scale(1.02)" : "scale(1)",
                              pointerEvents: "none"
                            }}
                          >
                            {/* Media container */}
                            <div className="absolute inset-0 z-0 bg-black/45 overflow-hidden">
                              {shouldRenderVideo ? (
                                <video
                                  ref={(el) => setVideoRef(work.id, el)}
                                  src={optimizeVideoUrl(work.videoUrl)}
                                  muted={!isUnmuted}
                                  loop
                                  playsInline
                                  preload="none"
                                  onLoadedMetadata={(e) => {
                                    const video = e.currentTarget;
                                    if (video.videoWidth && video.videoHeight) {
                                      const ratio = video.videoWidth / video.videoHeight;
                                      setAspectRatios(prev => ({ ...prev, [work.id]: ratio }));
                                    }
                                  }}
                                  className="w-full h-full object-cover opacity-100 relative z-10"
                                />
                              ) : (
                                <img
                                  src={optimizeImageUrl(work.imageUrl || getVideoThumbnail(work.videoUrl))}
                                  alt={work.title}
                                  draggable="false"
                                  loading="lazy"
                                  onLoad={(e) => {
                                    const img = e.currentTarget;
                                    if (img.naturalWidth && img.naturalHeight) {
                                      const ratio = img.naturalWidth / img.naturalHeight;
                                      setAspectRatios(prev => ({ ...prev, [work.id]: ratio }));
                                    }
                                  }}
                                  className="w-full h-full object-cover opacity-80 relative z-10"
                                />
                              )}
                              {/* Dark overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-20" />
                            </div>

                            {/* "TOUCH TO PLAY" overlay for paused video thumbnails */}
                            <AnimatePresence>
                              {!isActive && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  transition={{ duration: 0.35, ease: "easeOut" }}
                                  className="absolute bottom-4 left-0 right-0 flex items-center justify-center z-30 pointer-events-none select-none"
                                >
                                  <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/90 bg-[#050508]/85 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/10 shadow-lg backdrop-blur-xs transition-all duration-300 select-none whitespace-nowrap">
                                    TOUCH TO PLAY
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Audio indicator icon at top-right when expanded and unmuted */}
                            {isActive && (
                              <div className="absolute top-4 right-4 z-30 pointer-events-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setUnmutedVideoId(prev => prev === work.id ? null : work.id);
                                  }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-wider transition-all duration-300 cursor-pointer hover:bg-white/10 border pointer-events-auto bg-white/5 border-white/10 text-gray-400"
                                >
                                  {isUnmuted ? (
                                    <Volume2 className="w-3.5 h-3.5 animate-pulse text-accent" />
                                  ) : (
                                    <VolumeX className="w-3.5 h-3.5" />
                                  )}
                                  <span className="hidden sm:inline">{isUnmuted ? "Sound On" : "Muted"}</span>
                                </button>
                              </div>
                            )}

                            {/* Bottom-left overlay info */}
                            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 z-20 pointer-events-none">
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
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation Arrows */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollContainer("left", videoScrollRef);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-[#050508]/45 hover:bg-[#050508]/85 border border-white/10 text-white/70 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollContainer("right", videoScrollRef);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-[#050508]/45 hover:bg-[#050508]/85 border border-white/10 text-white/70 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-white/5 rounded-[2rem] bg-[#050508]/40 h-[460px] text-gray-400 font-mono text-sm tracking-wide">
                  No video items found in this category.
                </div>
              )
            ) : (
              activeWorks.length > 0 ? (
                <div className="relative group w-full">
                  <div 
                    ref={imageScrollRef}
                    onMouseDown={(e) => handleMouseDown(e, imageScrollRef)}
                    className="flex flex-row overflow-x-auto snap-x snap-mandatory scrollbar-none gap-4 pb-4 w-full h-[520px] md:h-[460px] select-none relative scroll-smooth cursor-grab active:cursor-grabbing"
                  >
                    {activeWorks.map((work) => {
                      const isActive = activeImageId === work.id;
                      return (
                        <div
                          key={work.id}
                          onMouseEnter={() => {
                            if (isDragging.current) return;
                            if (work.id !== activeImageId) {
                              setActiveImageId(work.id);
                              trackEvent("click", `Image Hover: ${work.title}`, {
                                workId: work.id,
                                title: work.title,
                                category: work.category,
                              });
                            }
                          }}
                          onClick={() => {
                            if (isDragging.current) return;
                            if (!isActive) {
                              setActiveImageId(work.id);
                              trackEvent("click", `Image Click: ${work.title}`, {
                                workId: work.id,
                                title: work.title,
                                category: work.category,
                              });
                            }
                          }}
                          className="flex-shrink-0 w-[280px] sm:w-[320px] md:w-[360px] h-full relative cursor-pointer snap-start"
                        >
                          {/* Inner wrapper container */}
                          <div
                            className={`absolute top-0 bottom-0 left-0 rounded-[2rem] overflow-hidden border border-white/5 bg-[#050508]/80 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                              isActive 
                                ? "z-30 shadow-2xl border-white/10 shadow-accent/5 opacity-100" 
                                : "z-10 opacity-65 hover:opacity-90 w-full"
                            }`}
                            style={{
                              width: isDesktop && isActive && aspectRatios[work.id]
                                ? `${460 * aspectRatios[work.id]}px`
                                : "100%",
                              transform: isDesktop && isActive ? "scale(1.02)" : "scale(1)",
                              pointerEvents: "none"
                            }}
                          >
                            {/* Media container */}
                            <div className="absolute inset-0 z-0 bg-[#050508]/95 flex items-center justify-center overflow-hidden">
                              {/* Foreground crisp image */}
                              <img
                                src={optimizeImageUrl(work.imageUrl || work.videoUrl)}
                                alt={work.title}
                                draggable="false"
                                onLoad={(e) => {
                                  const img = e.currentTarget;
                                  if (img.naturalWidth && img.naturalHeight) {
                                    const ratio = img.naturalWidth / img.naturalHeight;
                                    setAspectRatios(prev => ({ ...prev, [work.id]: ratio }));
                                  }
                                }}
                                className="w-full h-full object-cover opacity-100 relative z-10"
                              />
                              {/* Dark overlay */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-20" />
                            </div>

                            {/* Bottom-left overlay info */}
                            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 z-20 pointer-events-none">
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
                        </div>
                      );
                    })}
                  </div>

                  {/* Navigation Arrows */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollContainer("left", imageScrollRef);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-[#050508]/45 hover:bg-[#050508]/85 border border-white/10 text-white/70 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrollContainer("right", imageScrollRef);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-[#050508]/45 hover:bg-[#050508]/85 border border-white/10 text-white/70 hover:text-white backdrop-blur-md transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center border border-white/5 rounded-[2rem] bg-[#050508]/40 h-[460px] text-gray-400 font-mono text-sm tracking-wide">
                  No image items found in this category.
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* PDF Download Button for Static Creative Portfolio */}
      {activeTab?.tab_type === "image" && siteSettings.portfolio_static_pdf_button_enabled === "true" && siteSettings.portfolio_static_pdf_url && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex justify-center mt-12 mb-4"
        >
          <a
            href={siteSettings.portfolio_static_pdf_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="animate-offer-shimmer relative inline-flex items-center justify-center px-8 py-3.5 rounded-full font-mono text-xs uppercase tracking-wider text-black bg-accent hover-glow-yellow transition-all duration-300 font-bold border border-accent/30 shadow-[0_0_25px_rgba(255,234,0,0.25)] select-none cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            {siteSettings.portfolio_static_pdf_button_text || "Download Creative Deck PDF"}
          </a>
        </motion.div>
      )}

      {/* Video Preview Modal Portal (Fixed centered popup overlay) */}
      {previewVideoWork && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => {
            setPreviewVideoWork(null);
            setIsPreviewMuted(true);
          }}
        >
          <div 
            className="relative w-full max-w-sm sm:max-w-md max-h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setPreviewVideoWork(null);
                setIsPreviewMuted(true);
              }}
              className="absolute -top-12 right-0 z-[110] bg-black/60 hover:bg-black/95 text-white p-2 rounded-full border border-white/10 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Mute button */}
            <button
              onClick={() => setIsPreviewMuted(!isPreviewMuted)}
              className="absolute -top-12 left-0 z-[110] bg-black/60 hover:bg-black/95 text-white px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 transition-all text-[9px] font-mono uppercase tracking-wider cursor-pointer"
            >
              {isPreviewMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sound On</span>
                </>
              )}
            </button>

            <video
              src={optimizeVideoUrl(previewVideoWork.videoUrl)}
              autoPlay
              loop
              playsInline
              muted={isPreviewMuted}
              className="max-w-full max-h-[70vh] rounded-2xl shadow-2xl border border-white/10 object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}
