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
import { getEnv } from "./studioOsRoutes.js";

const GH_OWNER = "trdmsc-pixel";
const GH_REPO = "newbhakty";
const GH_BRANCH = "media";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/;

export const githubMediaUrl = (file: string) => `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${encodeURIComponent(file)}`;

export function registerMediaRoutes(app: Express) {
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
