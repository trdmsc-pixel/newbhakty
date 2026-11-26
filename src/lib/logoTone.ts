/**
 * Detect whether a logo is "dark" (would disappear on the site's dark background).
 * Samples the logo on a small canvas, ignoring transparent pixels, and averages
 * perceived luminance. Results are cached per URL in localStorage.
 * Needs the image host to allow CORS (GitHub raw and Wikimedia do); if it can't
 * be read the result is "unknown" and the logo is left untouched.
 */
import { useEffect, useState } from "react";

export type LogoTone = "dark" | "light" | "unknown";
export type LogoDisplayMode = "auto" | "original" | "light";

const CACHE_KEY = "tcs_logo_tone_v1";
const memory = new Map<string, LogoTone>();
const pending = new Map<string, Promise<LogoTone>>();

function readCache(): Record<string, LogoTone> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeCache(url: string, tone: LogoTone) {
  try {
    const c = readCache();
    c[url] = tone;
    const keys = Object.keys(c);
    if (keys.length > 300) delete c[keys[0]];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

export function analyzeLogoTone(url: string): Promise<LogoTone> {
  if (!url) return Promise.resolve("unknown");
  const hit = memory.get(url) ?? readCache()[url];
  if (hit) {
    memory.set(url, hit);
    return Promise.resolve(hit);
  }
  const existing = pending.get(url);
  if (existing) return existing;
  const job = new Promise<LogoTone>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const done = (tone: LogoTone) => {
      memory.set(url, tone);
      if (tone !== "unknown") writeCache(url, tone);
      pending.delete(url);
      resolve(tone);
    };
    img.onload = () => {
      try {
        const size = 64;
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
        const w = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
        const h = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return done("unknown");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        let weight = 0;
        let opaque = 0;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3] / 255;
          if (a < 0.15) continue;
          opaque++;
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          sum += lum * a;
          weight += a;
        }
        const total = data.length / 4;
        if (!weight) return done("unknown");
        const avg = sum / weight;
        // A logo on a solid (non-transparent) background brings its own contrast — leave it.
        const solidBackground = opaque / total > 0.97;
        done(!solidBackground && avg < 0.42 ? "dark" : "light");
      } catch {
        done("unknown"); // tainted canvas (no CORS) or decode error
      }
    };
    img.onerror = () => done("unknown");
    img.src = url;
  });
  pending.set(url, job);
  return job;
}

/** React hook: the tone of a logo (re-runs when the URL changes). */
export function useLogoTone(url?: string | null): LogoTone {
  const [tone, setTone] = useState<LogoTone>(() => (url ? memory.get(url) ?? readCache()[url] ?? "unknown" : "unknown"));
  useEffect(() => {
    let alive = true;
    if (!url) {
      setTone("unknown");
      return;
    }
    analyzeLogoTone(url).then((t) => alive && setTone(t));
    return () => {
      alive = false;
    };
  }, [url]);
  return tone;
}

/** CSS filter that renders a logo for the dark website background. */
export function logoFilter(mode: LogoDisplayMode | undefined, tone: LogoTone): string | undefined {
  const m = mode || "auto";
  if (m === "light" || (m === "auto" && tone === "dark")) return "brightness(0) invert(1)";
  return undefined;
}
