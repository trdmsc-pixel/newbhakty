/**
 * Site media (website videos, images, logos) — stored in the GitHub repo's
 * "media" branch, exactly as before.
 *
 * Stable URLs: /api/media/<file>. The route redirects to the file served
 * straight from GitHub (raw.githubusercontent.com), which supports range
 * requests and correct content types. jsDelivr is no longer used because it
 * refuses to serve any file from a GitHub branch larger than 50 MB, and the
 * media branch is now ~81 MB — that is what broke the site's videos.
 */
import type { Express, Request, Response } from "express";
import { getEnv, getServiceSupabase } from "./studioOsRoutes.js";

const GH_OWNER = "trdmsc-pixel";
const GH_REPO = "newbhakty";
const GH_BRANCH = "media";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/;

export const githubMediaUrl = (file: string) => `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${encodeURIComponent(file)}`;

// ---------------------------------------------------------------------------
// Google Drive video streaming for the review player.
// Google blocks other sites from streaming Drive files straight into a <video>, so the
// browser asks us instead; we fetch the requested byte range server-side and pass it on.
// Each response is capped at ~4 MB (Vercel's response limit) — browsers simply ask for the
// next range. Only Drive files that the studio has actually shared in Studio OS are served.
// ---------------------------------------------------------------------------
const DRIVE_ID = /^[\w-]{10,200}$/;
const CHUNK = 4 * 1000 * 1000;
const allowed = new Map<string, number>(); // id -> expiry
async function driveIdAllowed(id: string): Promise<boolean> {
  const exp = allowed.get(id);
  if (exp && exp > Date.now()) return true;
  const sb = getServiceSupabase();
  if (!sb) return false;
  const like = `%${id}%`;
  const checks = await Promise.all([
    sb.from("studio_deliverables").select("id").or(`url.ilike.${like},download_url.ilike.${like}`).is("archived_at", null).limit(1),
    sb.from("studio_asset_versions").select("id").ilike("url", like).is("archived_at", null).limit(1),
    sb.from("studio_shots").select("id").ilike("preview_url", like).is("archived_at", null).limit(1),
    sb.from("studio_projects").select("id").ilike("review_link_url", like).limit(1),
  ]);
  const ok = checks.some((r) => (r.data || []).length > 0);
  if (ok) {
    if (allowed.size > 2000) allowed.clear();
    allowed.set(id, Date.now() + 15 * 60_000);
  }
  return ok;
}

export function registerDriveStreamRoute(app: Express) {
  app.get("/api/media/drive/:id", async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!DRIVE_ID.test(id)) return res.status(400).send("Bad id");
    try {
      if (!(await driveIdAllowed(id))) return res.status(404).send("Not shared");
      const m = String(req.headers.range || "").match(/bytes=(\d*)-(\d*)/);
      const start = m && m[1] ? Number(m[1]) : 0;
      const wantEnd = m && m[2] ? Number(m[2]) : start + CHUNK - 1;
      const end = Math.min(wantEnd, start + CHUNK - 1);
      const up = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`, {
        headers: { Range: `bytes=${start}-${end}`, "User-Agent": "Mozilla/5.0 (compatible; StudioReviewPlayer/1.0)" },
        redirect: "follow",
      });
      const type = up.headers.get("content-type") || "";
      if (!up.ok || /text\/html/i.test(type)) return res.status(403).send("Drive file is not shared publicly");
      const buf = Buffer.from(await up.arrayBuffer());
      const range = up.headers.get("content-range");
      const total = range?.split("/")[1];
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Type", /octet-stream/i.test(type) || !type ? "video/mp4" : type);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("Content-Length", String(buf.length));
      if (up.status === 206 && range) {
        res.setHeader("Content-Range", range);
        return res.status(206).end(buf);
      }
      // Host ignored the range: send what we have as a partial response.
      const size = total && total !== "*" ? total : String(buf.length);
      res.setHeader("Content-Range", `bytes 0-${buf.length - 1}/${size}`);
      return res.status(buf.length < Number(size) ? 206 : 200).end(buf);
    } catch (err: any) {
      return res.status(502).send("Couldn't reach Google Drive");
    }
  });
}

export function registerMediaRoutes(app: Express) {
  registerDriveStreamRoute(app);
  app.get("/api/media/:file", (req: Request, res: Response) => {
    const file = String(req.params.file || "");
    if (!SAFE_NAME.test(file)) return res.status(400).send("Bad file name");
    // Files never change once uploaded (unique names), so the redirect can be cached.
    res.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
    return res.redirect(302, githubMediaUrl(file));
  });
}

/** Commit a new site media file to the GitHub "media" branch; returns its stable /api/media URL. */
export async function uploadSiteMedia(fileName: string, base64Content: string): Promise<string> {
  const token = getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_TOKEN");
  if (!token) throw new Error("GITHUB_TOKEN is not configured on this server environment.");
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const cleanName = fileName.replace(/[^a-zA-Z0-9.]/g, "_").toLowerCase();
  const finalFileName = `${uniqueId}_${cleanName}`;
  const response = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${finalFileName}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Node.js",
    },
    body: JSON.stringify({
      message: `Upload media asset via portfolio admin panel: ${finalFileName}`,
      content: base64Content,
      branch: GH_BRANCH,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as any)?.message || "GitHub API media upload error.");
  }
  return `/api/media/${finalFileName}`;
}

// ---------------------------------------------------------------------------
// Chunked uploads (files larger than Vercel's 4.5 MB request limit).
// Each chunk becomes a loose Git blob in the repo (not committed anywhere);
// "finish" joins them and commits the whole file to the media branch.
// ---------------------------------------------------------------------------
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const SHA = /^[0-9a-f]{40}$/;

function ghHeaders(token: string, accept = "application/vnd.github+json") {
  return { Authorization: `Bearer ${token}`, Accept: accept, "Content-Type": "application/json", "User-Agent": "tcs-site-media" };
}
const ghToken = () => {
  const t = getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_TOKEN");
  if (!t) throw new Error("GITHUB_TOKEN is not configured on this server environment.");
  return t;
};

export function registerMediaUploadRoutes(app: Express) {
  app.post("/api/media-upload/chunk", async (req: Request, res: Response) => {
    try {
      let data = String(req.body?.data || "");
      if (data.includes(";base64,")) data = data.split(";base64,").pop() || "";
      if (!data || data.length > 4_200_000) return res.status(400).json({ error: "Chunk missing or too large." });
      const r = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/blobs`, {
        method: "POST",
        headers: ghHeaders(ghToken()),
        body: JSON.stringify({ content: data, encoding: "base64" }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok || !j.sha) return res.status(502).json({ error: j?.message || "GitHub rejected the chunk." });
      return res.json({ sha: j.sha });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Chunk upload failed." });
    }
  });

  app.post("/api/media-upload/finish", async (req: Request, res: Response) => {
    try {
      const fileName = String(req.body?.fileName || "").trim();
      const parts: string[] = Array.isArray(req.body?.parts) ? req.body.parts : [];
      if (!fileName || !parts.length || parts.length > 40 || !parts.every((p) => SHA.test(p))) {
        return res.status(400).json({ error: "fileName and parts are required." });
      }
      const token = ghToken();
      const buffers: Buffer[] = new Array(parts.length);
      // Fetch the chunks back (4 at a time) as raw bytes.
      for (let i = 0; i < parts.length; i += 4) {
        await Promise.all(
          parts.slice(i, i + 4).map(async (sha, k) => {
            const r = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/git/blobs/${sha}`, { headers: ghHeaders(token, "application/vnd.github.raw") });
            if (!r.ok) throw new Error(`Could not read chunk ${i + k + 1} back from GitHub (${r.status}).`);
            buffers[i + k] = Buffer.from(await r.arrayBuffer());
          })
        );
      }
      const whole = Buffer.concat(buffers);
      if (whole.length > MAX_MEDIA_BYTES) return res.status(413).json({ error: `File is larger than ${MAX_MEDIA_BYTES / 1048576} MB.` });
      const url = await uploadSiteMedia(fileName, whole.toString("base64"));
      return res.json({ url, success: true, bytes: whole.length });
    } catch (err: any) {
      console.error("Media upload finish error:", err);
      return res.status(500).json({ error: err?.message || "Failed to assemble the upload." });
    }
  });
}
