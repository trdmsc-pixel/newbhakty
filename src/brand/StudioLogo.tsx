/**
 * The studio's website logo, shared by the admin, Studio OS and the client portal.
 *
 * Source of truth: the website's navbar logo (site_settings.navbar_logo_url),
 * read over Supabase REST with the public anon key — so it doesn't touch any
 * app's auth session (the portal keeps its own). Cached in localStorage so it
 * shows instantly; falls back to the current logo, then to the text name.
 *
 * The site logo is designed for a dark background (white wordmark). On light
 * surfaces it's rendered as a solid black silhouette; on dark surfaces it's
 * shown as-is (or lightened if the logo itself is dark).
 */
import React, { useEffect, useState } from "react";
import { useLogoTone } from "../lib/logoTone";

const DEFAULT_LOGO = "/api/media/1795140062728-ue7slvsrx_white_logo.png";
const CACHE_KEY = "tcs_site_logo_url";

const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "") as string).trim().replace(/\/+$/, "");
const anonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") as string).trim();

let inflight: Promise<string | null> | null = null;
function fetchSiteLogo(): Promise<string | null> {
  if (!supabaseUrl || !anonKey) return Promise.resolve(null);
  inflight ??= fetch(`${supabaseUrl}/rest/v1/site_settings?key=eq.navbar_logo_url&select=value`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: Array<{ value?: string }>) => (rows?.[0]?.value || "").trim() || null)
    .catch(() => null);
  return inflight;
}

export function useSiteLogoUrl(): string {
  const [url, setUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(CACHE_KEY) || DEFAULT_LOGO;
    } catch {
      return DEFAULT_LOGO;
    }
  });
  useEffect(() => {
    let alive = true;
    fetchSiteLogo().then((u) => {
      if (!alive || !u) return;
      setUrl(u);
      try {
        localStorage.setItem(CACHE_KEY, u);
      } catch {
        /* ignore */
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return url;
}

export const StudioLogo: React.FC<{
  /** Background the logo sits on. */
  surface: "light" | "dark";
  /** Rendered height in px. */
  height?: number;
  /** Show only the ring mark (for collapsed sidebars). */
  markOnly?: boolean;
  className?: string;
}> = ({ surface, height = 22, markOnly = false, className = "" }) => {
  const url = useSiteLogoUrl();
  const tone = useLogoTone(surface === "dark" ? url : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (failed) {
    return (
      <span className={`font-bold tracking-[-0.02em] truncate ${className}`} style={{ fontFamily: '"Outfit", sans-serif', fontSize: height * 0.75 }}>
        {markOnly ? "TCS" : "The Chanting Studio"}
      </span>
    );
  }

  const filter = surface === "light" ? "brightness(0)" : tone === "dark" ? "brightness(0) invert(1)" : undefined;
  const img = (
    <img
      src={url}
      alt="The Chanting Studio"
      draggable={false}
      onError={() => setFailed(true)}
      style={{ height, width: "auto", maxWidth: markOnly ? "none" : "100%", filter, objectFit: "contain", objectPosition: "left center" }}
      className="block select-none"
    />
  );
  if (!markOnly) return <span className={`inline-flex items-center min-w-0 max-w-full ${className}`}>{img}</span>;
  // The wordmark starts with the ring mark — crop to roughly a square to show just the mark.
  return (
    <span className={`inline-flex overflow-hidden shrink-0 ${className}`} style={{ width: height * 0.88, height }} aria-label="The Chanting Studio">
      {img}
    </span>
  );
};
