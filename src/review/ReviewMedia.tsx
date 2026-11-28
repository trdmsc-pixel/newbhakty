/**
 * Review media shared by the client portal and Studio OS.
 * - YouTube / Vimeo play inline through their player APIs, so we can read the
 *   exact playhead for timestamped notes and seek to a note's timestamp.
 * - Images (direct links or private storage://studio-review/… uploads) support
 *   numbered pins placed by clicking.
 * Notes travel as plain text lines: "[1:23] note" or "[Pin 2 · 34%,58%] note".
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";

/** "Open original" + "Download" under every video, pointing at the source host (Drive, Dropbox, file…). */
export function originalLinks(url: string): { open: string; download: string | null; host: string } | null {
  const m = parseMedia(url);
  if (!m || m.kind === "image" || m.kind === "link") return null;
  if (m.host === "Google Drive" && m.id) return { open: `https://drive.google.com/file/d/${m.id}/view`, download: `https://drive.google.com/uc?export=download&id=${m.id}`, host: "Google Drive" };
  if (m.host === "Dropbox") {
    try {
      const u = new URL(url);
      u.searchParams.delete("raw");
      u.searchParams.set("dl", "1");
      return { open: url, download: u.toString(), host: "Dropbox" };
    } catch {
      return { open: url, download: null, host: "Dropbox" };
    }
  }
  if (m.kind === "youtube" || m.kind === "vimeo") return { open: url, download: null, host: m.host };
  if (m.kind === "video") return { open: url, download: url, host: m.host };
  return { open: url, download: null, host: m.host };
}
const LinkBar: React.FC<{ url: string }> = ({ url }) => {
  const l = originalLinks(url);
  if (!l) return null;
  const btn = "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors hover:bg-[var(--sos-surface-2)]";
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <a href={l.open} target="_blank" rel="noreferrer noopener" className={btn} style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
        <ExternalLink className="w-4 h-4" /> Open on {l.host}
      </a>
      {l.download && (
        <a href={l.download} target="_blank" rel="noreferrer noopener" className={btn} style={{ borderColor: "var(--sos-border)", color: "var(--sos-primary)", background: "var(--sos-surface)" }}>
          <Download className="w-4 h-4" /> Download
        </a>
      )}
    </div>
  );
};

export type MediaKind = "youtube" | "vimeo" | "video" | "image" | "iframe" | "link";
export interface ParsedMedia {
  kind: MediaKind;
  id?: string;
  hash?: string;
  src: string;
  host: string;
  /** For "video": the host's own viewer, used if the file can't be streamed directly. */
  fallback?: string;
}
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;

export function parseMedia(url?: string | null): ParsedMedia | null {
  if (!url) return null;
  if (url.startsWith("storage://")) return { kind: "image", src: url, host: "Image" };
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  if (u.protocol !== "https:") return { kind: "link", src: url, host };
  if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1).split("/")[0]
        : u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1] || "";
    if (id) return { kind: "youtube", id, src: url, host: "YouTube" };
  }
  const vimeo = (host === "vimeo.com" && u.pathname.match(/^\/(?:.*\/)?(\d+)(?:\/([a-z0-9]+))?/i)) || (host === "player.vimeo.com" && u.pathname.match(/\/video\/(\d+)/));
  if (vimeo) return { kind: "vimeo", id: vimeo[1], hash: (vimeo as RegExpMatchArray)[2] || u.searchParams.get("h") || undefined, src: url, host: "Vimeo" };
  if (IMAGE_EXT.test(u.pathname)) return { kind: "image", src: url, host };
  // Google Drive: stream the file into our own player (needs "Anyone with the link"); Drive's viewer is the fallback.
  const driveId =
    (host === "drive.google.com" && (u.pathname.match(/\/file\/d\/([\w-]{10,})/)?.[1] || ((u.pathname === "/open" || u.pathname === "/uc") && u.searchParams.get("id")))) ||
    (host === "drive.usercontent.google.com" && u.searchParams.get("id")) ||
    null;
  if (driveId)
    return {
      kind: "video",
      id: driveId,
      // Streamed through our server (Google blocks direct cross-site playback).
      src: `/api/media/drive/${encodeURIComponent(driveId)}`,
      fallback: `https://drive.google.com/file/d/${driveId}/preview`,
      host: "Google Drive",
    };
  if (host.endsWith("dropbox.com") && VIDEO_EXT.test(u.pathname)) {
    u.searchParams.delete("dl");
    u.searchParams.set("raw", "1");
    return { kind: "video", src: u.toString(), host: "Dropbox" };
  }
  if (VIDEO_EXT.test(u.pathname)) return { kind: "video", src: url, host };
  if (host.endsWith("frame.io") || host === "f.io") return { kind: "link", src: url, host: "Frame.io" };
  return { kind: "link", src: url, host };
}

// ---- Timecodes & note lines -------------------------------------------------
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
export function parseTime(t: string): number | null {
  const parts = t.trim().split(":").map(Number);
  if (!parts.length || parts.some((n) => Number.isNaN(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
export interface NoteRef {
  time?: number;
  pin?: { n: number; x: number; y: number };
  text: string;
}
const TIME_TAG = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*/;
const PIN_TAG = /\[Pin (\d+) · (\d{1,3})%,(\d{1,3})%\]\s*/;
/** Find a timestamp or pin tag anywhere in a line (task titles carry a prefix). */
export function parseNote(line: string): NoteRef | null {
  // Text is whatever follows the tag (drops a "Fine cut R2: " task prefix).
  const t = line.match(TIME_TAG);
  if (t) return { time: parseTime(t[1]) ?? undefined, text: line.slice((t.index || 0) + t[0].length).trim() };
  const p = line.match(PIN_TAG);
  if (p) return { pin: { n: Number(p[1]), x: Number(p[2]), y: Number(p[3]) }, text: line.slice((p.index || 0) + p[0].length).trim() };
  return null;
}
export const noteLine = (n: NoteRef) =>
  n.pin ? `[Pin ${n.pin.n} · ${Math.round(n.pin.x)}%,${Math.round(n.pin.y)}%] ${n.text}` : n.time !== undefined ? `[${fmtTime(n.time)}] ${n.text}` : n.text;

// ---- Player API loaders -----------------------------------------------------
function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    const s = existing || Object.assign(document.createElement("script"), { src, async: true });
    const done = () => {
      const wait = () => (ready() ? resolve() : setTimeout(wait, 50));
      wait();
    };
    s.addEventListener("load", done);
    s.addEventListener("error", () => reject(new Error("Player failed to load")));
    if (!existing) document.head.appendChild(s);
    else done();
  });
}
const w = () => window as any;
const loadYouTube = () => loadScript("https://www.youtube.com/iframe_api", () => Boolean(w().YT?.Player));
const loadVimeo = () => loadScript("https://player.vimeo.com/api/player.js", () => Boolean(w().Vimeo?.Player));

export interface ReviewMediaHandle {
  /** Current playhead in seconds (null for images / unsupported hosts). */
  getTime: () => Promise<number | null>;
  seek: (sec: number) => void;
  pause: () => void;
  supportsTime: boolean;
}

interface Props {
  url: string;
  /** Turn storage://… into a signed https url. */
  resolveUrl?: (url: string) => Promise<string | null>;
  pins?: Array<{ n: number; x: number; y: number; active?: boolean }>;
  /** When set, clicking an image drops a pin at that spot. */
  onImageClick?: (x: number, y: number) => void;
  className?: string;
}

export const ReviewMedia = forwardRef<ReviewMediaHandle, Props>(function ReviewMedia({ url, resolveUrl, pins = [], onImageClick, className }, ref) {
  const media = parseMedia(url);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const videoEl = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  useEffect(() => {
    setVideoFailed(false);
    setVideoReady(false);
  }, [media?.src]);
  const ownPlayer = media?.kind === "video" && !videoFailed;

  useImperativeHandle(
    ref,
    () => ({
      supportsTime: media?.kind === "youtube" || media?.kind === "vimeo" || ownPlayer,
      getTime: async () => {
        if (media?.kind === "video") return ownPlayer && videoEl.current ? videoEl.current.currentTime : null;
        const p = player.current;
        if (!p) return null;
        try {
          if (media?.kind === "youtube") return Number(p.getCurrentTime?.() ?? 0);
          if (media?.kind === "vimeo") return Number(await p.getCurrentTime());
        } catch {
          /* player not ready */
        }
        return null;
      },
      seek: (sec: number) => {
        if (media?.kind === "video") {
          const v = videoEl.current;
          if (v && ownPlayer) {
            v.currentTime = sec;
            v.play().catch(() => null);
          }
          mount.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          videoEl.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        const p = player.current;
        if (!p) return;
        if (media?.kind === "youtube") {
          p.seekTo?.(sec, true);
          p.playVideo?.();
        } else if (media?.kind === "vimeo") {
          p.setCurrentTime(sec).then(() => p.play()).catch(() => null);
        }
        mount.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      pause: () => {
        if (media?.kind === "video") return void videoEl.current?.pause();
        const p = player.current;
        if (media?.kind === "youtube") p?.pauseVideo?.();
        else if (media?.kind === "vimeo") p?.pause?.().catch(() => null);
      },
    }),
    [media?.kind, ownPlayer]
  );

  // Video players
  useEffect(() => {
    if (!media || (media.kind !== "youtube" && media.kind !== "vimeo") || !mount.current) return;
    let cancelled = false;
    const el = document.createElement("div");
    el.className = "w-full h-full";
    mount.current.innerHTML = "";
    mount.current.appendChild(el);
    setError("");
    (async () => {
      try {
        if (media.kind === "youtube") {
          await loadYouTube();
          if (cancelled) return;
          player.current = new (w().YT.Player)(el, {
            videoId: media.id,
            host: "https://www.youtube-nocookie.com",
            width: "100%",
            height: "100%",
            playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          });
        } else {
          await loadVimeo();
          if (cancelled) return;
          const frame = document.createElement("iframe");
          frame.src = `https://player.vimeo.com/video/${media.id}?dnt=1${media.hash ? `&h=${media.hash}` : ""}`;
          frame.allow = "autoplay; fullscreen; picture-in-picture";
          frame.allowFullscreen = true;
          frame.title = "Review video";
          frame.className = "w-full h-full";
          el.appendChild(frame);
          player.current = new (w().Vimeo.Player)(frame);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Couldn't load the player");
      }
    })();
    return () => {
      cancelled = true;
      try {
        player.current?.destroy?.();
      } catch {
        /* ignore */
      }
      player.current = null;
    };
  }, [media?.kind, media?.id, media?.hash]);

  // Images (resolve private storage links)
  useEffect(() => {
    if (media?.kind !== "image") return;
    let cancelled = false;
    setImgSrc(null);
    (async () => {
      const src = media.src.startsWith("storage://") ? await (resolveUrl?.(media.src) ?? Promise.resolve(null)) : media.src;
      if (!cancelled) {
        if (src) setImgSrc(src);
        else setError("This image is no longer available.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media?.kind, media?.src, resolveUrl]);

  if (!media) return null;

  if (media.kind === "youtube" || media.kind === "vimeo") {
    return (
      <div className={className}>
      <div className={`sos-media rounded-[18px] overflow-hidden bg-black relative w-full`} style={{ aspectRatio: "16 / 9" }}>
        <div ref={mount} className="absolute inset-0 [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&>div]:w-full [&>div]:h-full" />
        {error && <p className="absolute inset-x-0 bottom-0 p-3 text-[12px] text-white/80 bg-black/60">{error}</p>}
      </div>
      <LinkBar url={url} />
      </div>
    );
  }

  if (media.kind === "image") {
    return (
      <div className={`rounded-[18px] overflow-hidden relative ${className || ""}`} style={{ background: "var(--sos-surface-2)" }}>
        {!imgSrc && !error && (
          <div className="aspect-video flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--sos-text-3)" }} />
          </div>
        )}
        {error && <p className="p-4 text-[13px]" style={{ color: "var(--sos-text-3)" }}>{error}</p>}
        {imgSrc && (
          <div
            className={`relative ${onImageClick ? "cursor-crosshair" : ""}`}
            onClick={(e) => {
              if (!onImageClick) return;
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              onImageClick(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
            }}
          >
            <img src={imgSrc} alt="Shared for review" className="w-full h-auto max-h-[78vh] object-contain block select-none mx-auto" draggable={false} />
            {pins.map((p) => (
              <span
                key={p.n}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center text-white shadow-lg ring-2 ring-white transition-transform"
                style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.active ? "#B42318" : "var(--sos-primary)", transform: `translate(-50%,-50%) scale(${p.active ? 1.2 : 1})` }}
              >
                {p.n}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (media.kind === "video") {
    if (videoFailed && media.fallback) {
      return (
        <div className={`space-y-1.5 ${className || ""}`}>
          <div className="sos-media rounded-[18px] overflow-hidden bg-black relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <iframe src={media.fallback} title="Review preview" loading="lazy" className="absolute inset-0 w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
          </div>
          <p className="text-[12px] px-1" style={{ color: "var(--sos-text-3)" }}>Playing in {media.host}'s viewer — type the time you see when adding a timestamp.</p>
          <LinkBar url={url} />
        </div>
      );
    }
    if (videoFailed) {
      return (
        <a href={url} target="_blank" rel="noreferrer noopener" className={`flex items-center justify-between gap-3 p-4 rounded-[18px] border ${className || ""}`} style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}>
          <span className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Open video on {media.host}</span>
          <ExternalLink className="w-4 h-4" style={{ color: "var(--sos-text-2)" }} />
        </a>
      );
    }
    return (
      <div className={className}>
      <div className="sos-media rounded-[18px] overflow-hidden bg-black relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <video
          ref={videoEl}
          key={media.src}
          src={media.src}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          className="absolute inset-0 w-full h-full object-contain bg-black"
          onLoadedMetadata={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
        />
        {!videoReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none text-white/80">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[12px]">Loading video from {media.host}…</span>
          </div>
        )}
      </div>
      <LinkBar url={url} />
      </div>
    );
  }

  if (media.kind === "iframe") {
    return (
      <div className={className}>
      <div className={`sos-media rounded-[18px] overflow-hidden bg-black relative w-full`} style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={media.src}
          title="Review preview"
          loading="lazy"
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      </div>
      <LinkBar url={url} />
      </div>
    );
  }

  return (
    <a
      href={media.src}
      target="_blank"
      rel="noreferrer noopener"
      className={`flex items-center justify-between gap-3 p-4 rounded-[18px] border ${className || ""}`}
      style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}
    >
      <span className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
        Open review on {media.host}
      </span>
      <ExternalLink className="w-4 h-4" style={{ color: "var(--sos-text-2)" }} />
    </a>
  );
});
