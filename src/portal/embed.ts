/** Turn a review link into an embeddable URL where the host allows it. */
export function toEmbed(url: string | null | undefined): { kind: "iframe" | "link"; src: string; host: string } | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return { kind: "link", src: url, host: u.hostname };
  const host = u.hostname.replace(/^www\./, "");

  // Vimeo: vimeo.com/123456789[/hash]
  const vimeo = host === "vimeo.com" && u.pathname.match(/^\/(\d+)(?:\/([a-z0-9]+))?/i);
  if (vimeo) {
    const h = vimeo[2] || u.searchParams.get("h");
    return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}${h ? `?h=${h}` : ""}`, host: "Vimeo" };
  }
  if (host === "player.vimeo.com") return { kind: "iframe", src: url, host: "Vimeo" };

  // YouTube
  const ytId = host === "youtu.be" ? u.pathname.slice(1) : host.endsWith("youtube.com") ? u.searchParams.get("v") : null;
  if (ytId) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}`, host: "YouTube" };

  // Google Drive file
  const drive = host === "drive.google.com" && u.pathname.match(/\/file\/d\/([^/]+)/);
  if (drive) return { kind: "iframe", src: `https://drive.google.com/file/d/${drive[1]}/preview`, host: "Google Drive" };

  // Frame.io review links generally refuse embedding → open in a new tab
  if (host.endsWith("frame.io") || host === "f.io") return { kind: "link", src: url, host: "Frame.io" };

  return { kind: "link", src: url, host };
}
