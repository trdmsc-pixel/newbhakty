/**
 * Project thumbnails and download links, shared by Studio OS and the client portal.
 * Thumbnails are generated from what was shared in the project: a manual cover
 * wins; otherwise the newest final/shared deliverable (YouTube/Vimeo/Drive
 * thumbnails, images, or a frame from a direct video file).
 */
import React, { useEffect, useMemo, useState } from "react";
import { parseMedia } from "./ReviewMedia";

type Thumb = { kind: "img" | "video"; src: string };

const VIDEO_FILE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const driveId = (url: string) => url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/)?.[1];

/** Best thumbnail for one media URL (storage:// is resolved by the caller). */
export function thumbFor(url?: string | null): Thumb | null {
  if (!url) return null;
  const m = parseMedia(url);
  if (m?.kind === "youtube" && m.id) return { kind: "img", src: `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg` };
  if (m?.kind === "vimeo" && m.id) return { kind: "img", src: `https://vumbnail.com/${m.id}.jpg` };
  const d = driveId(url);
  if (d) return { kind: "img", src: `https://drive.google.com/thumbnail?id=${d}&sz=w800` };
  if (m?.kind === "image") return { kind: "img", src: url };
  if (VIDEO_FILE.test(url)) return { kind: "video", src: url.includes("#t=") ? url : `${url}#t=1` };
  return null;
}

export interface DeliverableLike {
  url: string;
  is_final?: boolean;
  download_url?: string | null;
  created_at: string;
}

/** Candidate thumbnail sources for a project, best first. */
export function thumbCandidates(cover: string | null | undefined, deliverables: DeliverableLike[]): string[] {
  const sorted = [...deliverables].sort((a, b) => Number(Boolean(b.is_final)) - Number(Boolean(a.is_final)) || b.created_at.localeCompare(a.created_at));
  const urls = [cover, ...sorted.flatMap((d) => [d.url, d.download_url])].filter((u): u is string => Boolean(u));
  return Array.from(new Set(urls)).filter((u) => thumbFor(u) || u.startsWith("storage://"));
}

/** Direct-download link where the host allows it; null for stream-only hosts (YouTube/Vimeo). */
export async function downloadHref(url: string, resolveUrl?: (u: string) => Promise<string | null>): Promise<string | null> {
  if (url.startsWith("storage://")) return (await resolveUrl?.(url)) ?? null;
  const d = driveId(url);
  if (d) return `https://drive.google.com/uc?export=download&id=${d}`;
  if (/dropbox\.com/i.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.set("dl", "1");
      return u.toString();
    } catch {
      return url;
    }
  }
  const m = parseMedia(url);
  if (m?.kind === "youtube" || m?.kind === "vimeo") return null;
  return url;
}

export const isStreamOnly = (url: string) => {
  const k = parseMedia(url)?.kind;
  return k === "youtube" || k === "vimeo";
};

/** Thumbnail box: tries each candidate until one loads; falls back to the emoji. */
export const ProjectThumb: React.FC<{
  candidates: string[];
  resolveUrl?: (u: string) => Promise<string | null>;
  emoji?: string | null;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ candidates, resolveUrl, emoji, className = "", style, children }) => {
  const key = candidates.join("|");
  const [idx, setIdx] = useState(0);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  useEffect(() => setIdx(0), [key]);

  useEffect(() => {
    let alive = true;
    const url = candidates[idx];
    if (!url) {
      setThumb(null);
      return;
    }
    (async () => {
      const resolved = url.startsWith("storage://") ? await resolveUrl?.(url) : url;
      const t = resolved ? (url.startsWith("storage://") ? { kind: "img" as const, src: resolved } : thumbFor(resolved)) : null;
      if (!alive) return;
      if (t) setThumb(t);
      else setIdx((i) => i + 1);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, idx]);

  const next = () => setIdx((i) => i + 1);
  const media = useMemo(() => {
    if (!thumb) return null;
    if (thumb.kind === "video") {
      return <video src={thumb.src} muted playsInline preload="metadata" onError={next} className="absolute inset-0 w-full h-full object-cover" />;
    }
    return <img src={thumb.src} alt="" loading="lazy" onError={next} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumb]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {media || <div className="absolute inset-0 flex items-center justify-center text-[40px]">{emoji || "🎬"}</div>}
      {children}
    </div>
  );
};
