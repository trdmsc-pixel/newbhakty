/**
 * Turn a review / site media URL into Gemini input parts (server-side).
 *
 *  - YouTube links  → fileData { fileUri } (Gemini watches public/unlisted videos directly)
 *  - Direct video files (/api/media/…, .mp4/.mov/.webm) → uploaded once to the Gemini
 *    File API (kept ~47 h by Google; cached per URL in this instance)
 *  - Images (direct links, /api/media/…, storage://studio-review/…) → inline base64
 *  - Vimeo / Google Drive / Frame.io → unsupported (no file access); callers explain this.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BASE = "https://generativelanguage.googleapis.com";
const env = (k: string) => (typeof process.env[k] === "string" ? process.env[k]!.trim() : "");
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i;
const MAX_INLINE = 15 * 1024 * 1024;
const MAX_UPLOAD = 60 * 1024 * 1024;

export class MediaUnsupported extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "MediaUnsupported";
  }
}

export type MediaKind = "youtube" | "video" | "image";
export interface MediaInput {
  kind: MediaKind;
  parts: any[];
  label: string;
}

const fileCache = new Map<string, { uri: string; mime: string; until: number }>();

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com"))
      return u.searchParams.get("v") || u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1] || null;
  } catch {
    /* not a URL */
  }
  return null;
}

/** /api/media/<file> → the GitHub raw URL it redirects to; everything else unchanged. */
export function absoluteMediaUrl(url: string): string {
  const m = url.match(/^(?:https?:\/\/[^/]+)?\/api\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,250})$/);
  if (m) return `https://raw.githubusercontent.com/trdmsc-pixel/newbhakty/media/${encodeURIComponent(m[1])}`;
  return url;
}

async function fetchBytes(url: string, max: number): Promise<{ buf: Buffer; mime: string }> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new MediaUnsupported(`Couldn't download the file (HTTP ${r.status}).`);
  const len = Number(r.headers.get("content-length") || 0);
  if (len && len > max) throw new MediaUnsupported(`The file is too large for AI (${Math.round(len / 1048576)} MB).`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > max) throw new MediaUnsupported(`The file is too large for AI (${Math.round(buf.length / 1048576)} MB).`);
  let mime = (r.headers.get("content-type") || "").split(";")[0].trim();
  if (!mime || mime === "application/octet-stream" || mime === "text/plain") {
    const ext = (url.match(/\.([a-z0-9]+)(\?|#|$)/i)?.[1] || "").toLowerCase();
    mime =
      { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif" }[ext] ||
      "application/octet-stream";
  }
  return { buf, mime };
}

/** Upload bytes to the Gemini File API and wait until it's ACTIVE. */
export async function geminiUploadFile(buf: Buffer, mime: string, name: string, waitMs = 40_000): Promise<string> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buf.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: name.slice(0, 120) } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!start.ok || !uploadUrl) throw new Error(`Gemini file upload failed to start (HTTP ${start.status}).`);
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Length": String(buf.length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: new Uint8Array(buf),
  });
  const j: any = await up.json().catch(() => ({}));
  if (!up.ok || !j?.file?.name) throw new Error(`Gemini file upload failed (HTTP ${up.status}).`);
  let file = j.file;
  const deadline = Date.now() + waitMs;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const g = await fetch(`${BASE}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key } });
    file = await g.json().catch(() => file);
  }
  if (file.state === "FAILED") throw new Error("Gemini couldn't process this video file.");
  if (file.state !== "ACTIVE") throw new Error("The video is still processing at Google — try again in a minute.");
  return String(file.uri);
}

/**
 * Build Gemini parts for a media URL.
 * clip: optional {start,end} seconds for videos (YouTube & uploaded files).
 */
export async function mediaInput(
  rawUrl: string,
  opts: { sb?: SupabaseClient | null; clip?: { start: number; end: number }; allowVideo?: boolean } = {}
): Promise<MediaInput> {
  const url = String(rawUrl || "").trim();
  if (!url) throw new MediaUnsupported("No media link on this version.");
  const meta = opts.clip ? { videoMetadata: { startOffset: `${Math.max(0, Math.floor(opts.clip.start))}s`, endOffset: `${Math.max(1, Math.ceil(opts.clip.end))}s` } } : {};

  const yt = youtubeId(url);
  if (yt) {
    if (opts.allowVideo === false) throw new MediaUnsupported("Video not allowed here.");
    return { kind: "youtube", label: "YouTube video", parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${yt}`, mimeType: "video/*" }, ...meta }] };
  }

  if (url.startsWith("storage://studio-review/")) {
    if (!opts.sb) throw new MediaUnsupported("Private file — storage access not configured.");
    const { data } = await opts.sb.storage.from("studio-review").createSignedUrl(url.replace("storage://studio-review/", ""), 600);
    if (!data?.signedUrl) throw new MediaUnsupported("Couldn't open the private file.");
    const { buf, mime } = await fetchBytes(data.signedUrl, MAX_INLINE);
    if (!mime.startsWith("image/")) throw new MediaUnsupported("Only images are supported from private review uploads.");
    return { kind: "image", label: "image", parts: [{ inlineData: { mimeType: mime, data: buf.toString("base64") } }] };
  }

  const abs = absoluteMediaUrl(url);
  let host = "";
  try {
    host = new URL(abs).hostname;
  } catch {
    throw new MediaUnsupported("That isn't a valid link.");
  }
  if (/vimeo\.com$/.test(host)) throw new MediaUnsupported("AI can't watch Vimeo links (Vimeo doesn't share the file). Use a YouTube (unlisted is fine) link or upload the file.");
  if (/drive\.google\.com$|docs\.google\.com$/.test(host)) throw new MediaUnsupported("AI can't open Google Drive links. Use a YouTube (unlisted) link or upload the file.");
  if (/frame\.io$|f\.io$/.test(host)) throw new MediaUnsupported("AI can't open Frame.io links. Use a YouTube (unlisted) link or upload the file.");

  if (IMAGE_EXT.test(abs)) {
    const { buf, mime } = await fetchBytes(abs, MAX_INLINE);
    return { kind: "image", label: "image", parts: [{ inlineData: { mimeType: mime, data: buf.toString("base64") } }] };
  }
  if (VIDEO_EXT.test(abs) || /raw\.githubusercontent\.com$/.test(host)) {
    if (opts.allowVideo === false) throw new MediaUnsupported("Video not allowed here.");
    const cached = fileCache.get(abs);
    if (cached && cached.until > Date.now()) return { kind: "video", label: "video file", parts: [{ fileData: { fileUri: cached.uri, mimeType: cached.mime }, ...meta }] };
    const { buf, mime } = await fetchBytes(abs, MAX_UPLOAD);
    if (mime.startsWith("image/")) return { kind: "image", label: "image", parts: [{ inlineData: { mimeType: mime, data: buf.toString("base64") } }] };
    if (!mime.startsWith("video/")) throw new MediaUnsupported("That link isn't a video or image file.");
    const uri = await geminiUploadFile(buf, mime, abs.split("/").pop() || "video");
    fileCache.set(abs, { uri, mime, until: Date.now() + 46 * 3600_000 });
    return { kind: "video", label: "video file", parts: [{ fileData: { fileUri: uri, mimeType: mime }, ...meta }] };
  }
  throw new MediaUnsupported("AI can watch YouTube links and uploaded video/image files. This link type isn't supported.");
}

/** First text reply from a generateContent response. */
export function replyText(data: any): string {
  return (data?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => (p.thought ? "" : p.text || ""))
    .join("")
    .trim();
}

export function parseJsonLoose<T = any>(text: string): T | null {
  const s = String(text || "").replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fallthrough */
      }
    }
  }
  return null;
}
