import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, X } from "lucide-react";
import { Ring } from "./brand/Ring";
import { trackEvent } from "../lib/analytics";

interface ShowreelSectionProps {
  videoUrl?: string;
  posterUrl?: string;
  duration?: string;
  aspect?: "2.39" | "16:9";
  eyebrow?: string;
  title?: string;
  onStartProject?: () => void;
  onSeeWork?: () => void;
  externalTriggerPlay?: boolean;
  onResetTrigger?: () => void;
}

export const ShowreelSection: React.FC<ShowreelSectionProps> = ({
  videoUrl = "",
  posterUrl = "/og.jpg",
  duration = "1:15",
  aspect = "16:9",
  eyebrow = "SHOWREEL 2026",
  title = "Every frame, directed.",
  onStartProject,
  onSeeWork,
  externalTriggerPlay = false,
  onResetTrigger,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTheatreMode, setIsTheatreMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHoveringIdle, setIsHoveringIdle] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const trackedMilestones = useRef<Set<number>>(new Set());
  const prefersReducedMotion = useReducedMotion();

  const isVimeo = videoUrl.includes("vimeo.com");
  const useVideoStillFrame = Boolean(videoUrl && !isVimeo && (!posterUrl || posterUrl === "/og.jpg"));

  useEffect(() => {
    const vid = idleVideoRef.current;
    if (!vid || !useVideoStillFrame) return;
    if (isHoveringIdle && !isTheatreMode) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isHoveringIdle, isTheatreMode, useVideoStillFrame]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Launch Theatre Mode & Play
  const startPlayback = useCallback(() => {
    setIsTheatreMode(true);
    setIsPlaying(true);
    setIsEnded(false);

    // Track start event
    if (!trackedMilestones.current.has(0)) {
      trackedMilestones.current.add(0);
      trackEvent("video_play", "reel_play", { url: videoUrl });
      try {
        (window as any).fbq?.("trackCustom", "ShowreelPlay");
      } catch (e) {}
    }

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [videoUrl]);

  // Handle external trigger from Hero "Watch the reel"
  useEffect(() => {
    if (externalTriggerPlay) {
      const el = document.getElementById("reel");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      startPlayback();
      onResetTrigger?.();
    }
  }, [externalTriggerPlay, startPlayback, onResetTrigger]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isTheatreMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsTheatreMode(false);
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.pause();
      } else if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === "m" || e.key === "M") {
        toggleMute();
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "ArrowLeft") {
        if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
      } else if (e.key === "ArrowRight") {
        if (videoRef.current) videoRef.current.currentTime = Math.min(totalDuration, videoRef.current.currentTime + 5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTheatreMode, totalDuration]);

  // Auto-hide controls after 2s of inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isEnded) {
        setShowControls(false);
      }
    }, 2000);
  };

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
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
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

    // Milestones tracking
    const ratio = curr / tot;
    if (ratio >= 0.25 && !trackedMilestones.current.has(25)) {
      trackedMilestones.current.add(25);
      trackEvent("video_play", "reel_25");
    }
    if (ratio >= 0.50 && !trackedMilestones.current.has(50)) {
      trackedMilestones.current.add(50);
      trackEvent("video_play", "reel_50");
    }
    if (ratio >= 0.75 && !trackedMilestones.current.has(75)) {
      trackedMilestones.current.add(75);
      trackEvent("video_play", "reel_75");
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setIsEnded(true);
    setShowControls(true);
    if (!trackedMilestones.current.has(100)) {
      trackedMilestones.current.add(100);
      trackEvent("video_play", "reel_complete");
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = pos * (videoRef.current.duration || 0);
    videoRef.current.currentTime = target;
    setProgress(pos * 100);
  };

  const exitTheatre = () => {
    setIsTheatreMode(false);
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.pause();
  };

  return (
    <>
      <section id="reel" className="relative w-full py-20 bg-[var(--tcs-night)] overflow-hidden select-none">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 mb-8">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-2">
            {eyebrow}
          </p>
          <h2 className="tcs-h2 text-[var(--tcs-offwhite)]">
            {title}
          </h2>
        </div>

        {/* 100vw Cinema Screen Frame */}
        <div
          ref={containerRef}
          data-cursor="play"
          onClick={startPlayback}
          onMouseEnter={() => setIsHoveringIdle(true)}
          onMouseLeave={() => setIsHoveringIdle(false)}
          onMouseMove={handleMouseMove}
          className={`relative w-full border-y border-[var(--tcs-line)] bg-black overflow-hidden group cursor-pointer ${
            aspect === "2.39" ? "aspect-[2.39/1]" : "aspect-video"
          } max-h-[85vh]`}
        >
          {/* Idle Frame: Still frame from actual showreel video (auto-plays muted on hover) or custom poster */}
          <div className="absolute inset-0 overflow-hidden">
            {useVideoStillFrame ? (
              <video
                ref={idleVideoRef}
                src={videoUrl.includes("#t=") ? videoUrl : `${videoUrl}#t=1.0`}
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover object-center brightness-75 group-hover:brightness-95 transition-all duration-500 pointer-events-none"
              />
            ) : (
              <motion.img
                src={posterUrl || "/og.jpg"}
                alt="Showreel Poster"
                animate={
                  prefersReducedMotion
                    ? {}
                    : { scale: [1, 1.08] }
                }
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "linear",
                }}
                className="w-full h-full object-cover object-center brightness-75 group-hover:brightness-90 transition-all duration-500"
              />
            )}
          </div>

          {/* Center Play Button & Metadata */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 pointer-events-none">
            <div className="relative transform group-hover:scale-110 transition-transform duration-300">
              <Ring size={72} stroke={4} glow={true} animate="spin-slow" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play className="w-6 h-6 text-[var(--tcs-offwhite)] fill-[var(--tcs-offwhite)] translate-x-0.5" />
              </div>
            </div>

            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-offwhite)] font-medium">
              PLAY REEL — {duration}
            </p>
          </div>
        </div>
      </section>

      {/* Theatre Mode Full-Screen Projection Modal */}
      <AnimatePresence>
        {isTheatreMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseMove={handleMouseMove}
            className="fixed inset-0 z-[9990] bg-[#07080C]/94 backdrop-blur-2xl flex items-center justify-center"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={exitTheatre}
              aria-label="Exit theatre mode"
              className="absolute top-6 right-6 z-50 p-2.5 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all cursor-pointer bg-black/40 backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Video Player Container */}
            <div
              className={`relative w-full max-w-[96vw] ${
                aspect === "2.39" ? "aspect-[2.39/1]" : "aspect-video"
              } max-h-[90vh] bg-black rounded overflow-hidden shadow-2xl border border-[var(--tcs-line)]`}
            >
              {isVimeo ? (
                <iframe
                  src={`${videoUrl}?autoplay=1&dnt=1&title=0&byline=0&portrait=0`}
                  title="Showreel"
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-particle-glowing-fluid-background-48280-large.mp4"}
                  poster={posterUrl || "/og.jpg"}
                  playsInline
                  autoPlay
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  onClick={togglePlayPause}
                  className="w-full h-full object-contain cursor-pointer"
                />
              )}

              {/* End Card Overlay */}
              <AnimatePresence>
                {isEnded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#07080C]/90 flex flex-col items-center justify-center p-8 z-30"
                  >
                    <Ring size={64} stroke={4} glow={true} animate="spin-slow" className="mb-4" />
                    <h3 className="font-display font-bold text-2xl uppercase tracking-wider text-[var(--tcs-offwhite)] mb-2">
                      The Chanting Studio
                    </h3>
                    <p className="font-sans text-[var(--tcs-muted)] text-sm mb-6">
                      Film-scale craft. AI-speed delivery.
                    </p>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          exitTheatre();
                          onStartProject?.();
                        }}
                        className="px-6 py-3 rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold hover:bg-white transition-all cursor-pointer"
                      >
                        Start a project
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          exitTheatre();
                          onSeeWork?.();
                        }}
                        className="px-6 py-3 rounded border border-[var(--tcs-line)] text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-widest hover:border-white transition-all cursor-pointer"
                      >
                        See the work
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Custom Player Controls */}
              {!isVimeo && (
                <motion.div
                  animate={{ opacity: showControls || !isPlaying ? 1 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-0 left-0 w-full p-6 pt-12 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-auto"
                >
                  {/* Progress Bar with Spectral Linear Fill */}
                  <div
                    onClick={handleSeek}
                    className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer mb-4 relative group/bar"
                  >
                    <div
                      className="h-full relative rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: "var(--tcs-spectrum-linear)",
                      }}
                    />
                  </div>

                  {/* Buttons & Time */}
                  <div className="flex items-center justify-between text-[var(--tcs-offwhite)]">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={togglePlayPause}
                        aria-label={isPlaying ? "Pause" : "Play"}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>

                      <button
                        type="button"
                        onClick={toggleMute}
                        aria-label={isMuted ? "Unmute" : "Mute"}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>

                      <span className="font-mono text-xs tracking-wider text-[var(--tcs-muted)]">
                        {formatTime(currentTime)} / {formatTime(totalDuration || 75)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                      >
                        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ShowreelSection;
