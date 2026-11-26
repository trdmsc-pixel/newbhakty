/**
 * Browser-side helpers for AI on admin uploads:
 *  - sampleFrames / frameAt: grab frames from a local video file (no upload needed)
 *  - pickPosterFrame: Gemini (smart) picks the best frame → full-res JPEG File
 *  - describeMedia:   Gemini (fast) writes alt text, SEO title/description and tags
 */
import { supabase } from "../../lib/supabase";

export async function adminAiHeaders(): Promise<Record<string, string>> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
  let adminKey = "";
  try {
    adminKey = sessionStorage.getItem("bhakty_admin_password") || "";
  } catch {
    /* ignore */
  }
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(adminKey ? { "x-admin-key": adminKey } : {}),
  };
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error("This browser can't read that video for frames."));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05));
    setTimeout(done, 4000);
  });
}

function grab(v: HTMLVideoElement, maxW: number, quality: number): string {
  const scale = Math.min(1, maxW / (v.videoWidth || maxW));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round((v.videoWidth || maxW) * scale));
  c.height = Math.max(2, Math.round((v.videoHeight || maxW * 0.5625) * scale));
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

export async function sampleFrames(file: File, n = 8): Promise<{ frames: string[]; times: number[]; video: HTMLVideoElement }> {
  const v = await loadVideo(file);
  const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
  const times = Array.from({ length: n }, (_, i) => d * (0.06 + (0.88 * i) / Math.max(1, n - 1)));
  const frames: string[] = [];
  for (const t of times) {
    await seek(v, t);
    frames.push(grab(v, 384, 0.7));
  }
  return { frames, times, video: v };
}

const dataUrlToFile = async (dataUrl: string, name: string) => new File([await (await fetch(dataUrl)).blob()], name, { type: "image/jpeg" });

/** Smart poster frame: returns a full-res JPEG File plus a small preview data URL. */
export async function pickPosterFrame(file: File): Promise<{ poster: File; preview: string; reason: string; time: number }> {
  const { frames, times, video } = await sampleFrames(file, 8);
  let index = Math.floor(frames.length / 3);
  let reason = "";
  try {
    const r = await fetch("/api/admin/ai/poster-pick", { method: "POST", headers: await adminAiHeaders(), body: JSON.stringify({ frames, name: file.name }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      index = j.index;
      reason = j.reason || "";
    } else reason = j.error || "";
  } catch {
    /* fall back to a frame a third of the way in */
  }
  await seek(video, times[index]);
  const full = grab(video, 1920, 0.88);
  URL.revokeObjectURL(video.src);
  const base = file.name.replace(/\.[^.]+$/, "");
  return { poster: await dataUrlToFile(full, `${base}_poster.jpg`), preview: frames[index], reason, time: times[index] };
}

/** Small JPEG preview of a local image file (for alt-text generation without re-downloading). */
export async function imagePreview(file: File, maxW = 768): Promise<string | undefined> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return undefined;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("bad image"));
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface MediaMeta {
  alt_text: string;
  seo_title: string;
  seo_description: string;
  tags: string[];
}

export async function describeMedia(body: { url: string; kind: "image" | "video"; name?: string; poster?: string; context?: string }): Promise<MediaMeta> {
  const r = await fetch("/api/admin/ai/media-meta", { method: "POST", headers: await adminAiHeaders(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "AI couldn't describe this file.");
  return j as MediaMeta;
}
