/**
 * Site media (website videos, images, logos).
 *
 * Stable URLs: /api/media/<file>. The route redirects to the file in the public
 * Supabase Storage bucket "site-media". Files that were uploaded earlier to the
 * GitHub "media" branch (served by jsDelivr until that branch passed jsDelivr's
 * 50 MB package limit) are copied into storage on first request, so nothing has
 * to be migrated by hand.
 */
import type { Express, Request, Response } from "express";
import { getEnv, getServiceSupabase } from "./studioOsRoutes.js";

export const SITE_MEDIA_BUCKET = "site-media";
const GH_OWNER = "trdmsc-pixel";
const GH_REPO = "newbhakty";
const GH_BRANCH = "media";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/;

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};
export const mimeFor = (name: string) => MIME[name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";

const supabaseUrl = () => (getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL")).replace(/\/+$/, "");
export const publicMediaUrl = (file: string) => `${supabaseUrl()}/storage/v1/object/public/${SITE_MEDIA_BUCKET}/${encodeURIComponent(file)}`;

// Files known to be in storage (per warm function instance).
const present = new Set<string>();
const copying = new Map<string, Promise<boolean>>();

async function existsInStorage(file: string): Promise<boolean> {
  if (present.has(file)) return true;
  const r = await fetch(publicMediaUrl(file), { method: "HEAD" }).catch(() => null);
  if (r?.ok) present.add(file);
  return Boolean(r?.ok);
}

/** Copy one file from the GitHub media branch into storage. */
async function copyFromGitHub(file: string): Promise<boolean> {
  const sb = getServiceSupabase();
  if (!sb) return false;
  const token = getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_TOKEN");
  const r = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${encodeURIComponent(file)}?ref=${GH_BRANCH}`, {
    headers: {
      Accept: "application/vnd.github.raw",
      "User-Agent": "tcs-site-media",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!r.ok) return false;
  const bytes = Buffer.from(await r.arrayBuffer());
  const { error } = await sb.storage.from(SITE_MEDIA_BUCKET).upload(file, bytes, { contentType: mimeFor(file), upsert: true, cacheControl: "31536000" });
  if (error) {
    console.warn(`[media] storage upload failed for ${file}: ${error.message}`);
    return false;
  }
  present.add(file);
  return true;
}

export function registerMediaRoutes(app: Express) {
  app.get("/api/media/:file", async (req: Request, res: Response) => {
    const file = String(req.params.file || "");
    if (!SAFE_NAME.test(file)) return res.status(400).send("Bad file name");
    try {
      let ok = await existsInStorage(file);
      if (!ok) {
        let job = copying.get(file);
        if (!job) {
          job = copyFromGitHub(file).finally(() => copying.delete(file));
          copying.set(file, job);
        }
        ok = await job;
      }
      if (!ok) return res.status(404).set("Cache-Control", "no-store").send("Not found");
      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
      return res.redirect(302, publicMediaUrl(file));
    } catch (err: any) {
      console.warn(`[media] ${file}: ${err?.message}`);
      return res.status(502).set("Cache-Control", "no-store").send("Media unavailable");
    }
  });
}

/** Upload a new site media file to storage; returns its stable /api/media URL. */
export async function uploadSiteMedia(fileName: string, bytes: Buffer): Promise<string> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const cleanName = fileName.replace(/[^a-zA-Z0-9.]/g, "_").toLowerCase().slice(-160);
  const finalName = `${uniqueId}_${cleanName}`;
  const { error } = await sb.storage.from(SITE_MEDIA_BUCKET).upload(finalName, bytes, { contentType: mimeFor(finalName), upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  present.add(finalName);
  return `/api/media/${finalName}`;
}
