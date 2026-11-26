import React, { createContext, useContext, useRef, useState } from "react";
import { Upload, FolderOpen, Copy, Check, X, Film, Image as ImageIcon, Link2, Loader2 } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { Button } from "./Button";
import { uploadToCloudinary, MEDIA_UPLOAD_LIMIT_MB } from "../../lib/cloudinary";
import { describeMedia, imagePreview, pickPosterFrame, type MediaMeta } from "./mediaAI";

/**
 * Lets the admin shell register every upload in the global asset library,
 * without each tab having to wire it up.
 */
export const MediaUploadContext = createContext<{ onUploaded?: (name: string, url: string, kind: "image" | "video") => void | Promise<unknown> }>({});

export const uploadLimitHint = (type: "image" | "video" | "auto" = "auto") =>
  type === "video"
    ? `Max ${MEDIA_UPLOAD_LIMIT_MB} MB per file · MP4 / WebM / MOV · videos over 8 MB are optimised automatically`
    : type === "image"
    ? `Max ${MEDIA_UPLOAD_LIMIT_MB} MB per file · JPG / PNG / WebP / AVIF / GIF / SVG`
    : `Max ${MEDIA_UPLOAD_LIMIT_MB} MB per file · images or videos`;

export interface MediaFieldProps {
  value: string;
  onChange: (url: string) => void;
  onOpenLibrary?: () => void;
  /** @deprecated Uploads are handled inside MediaField; kept for compatibility. */
  onUpload?: () => void;
  placeholder?: string;
  label?: string;
  type?: "image" | "video" | "auto";
  className?: string;
  /** Called with an AI-picked poster frame (already uploaded) after a video upload. */
  onPoster?: (url: string) => void;
  /** What this media is used for (helps the AI write alt text / SEO). */
  aiContext?: string;
}

const looksLikeVideo = (url: string) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || /youtu\.?be|vimeo\.com/i.test(url);

export const MediaField: React.FC<MediaFieldProps> = ({
  value,
  onChange,
  onOpenLibrary,
  placeholder = "No media selected",
  label,
  type = "auto",
  className = "",
  onPoster,
  aiContext,
}) => {
  const [ai, setAi] = useState<{ busy: string; meta?: MediaMeta; poster?: { url: string; preview: string; reason: string }; error?: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const { onUploaded } = useContext(MediaUploadContext);
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [linkMode, setLinkMode] = useState(false);
  const [draft, setDraft] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cleanUrl = (value || "").trim();
  const isVideo = type === "video" || (type === "auto" && looksLikeVideo(cleanUrl));
  const isEmbed = /youtu\.?be|vimeo\.com/i.test(cleanUrl);
  const fileName = cleanUrl ? cleanUrl.split("/").pop()?.split("?")[0] || cleanUrl : placeholder;
  const accept = type === "video" ? "video/*" : type === "image" ? "image/*" : "image/*,video/*";

  const handleCopy = () => {
    if (!cleanUrl) return;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFile = async (file: File) => {
    const tooBig = file.size > MEDIA_UPLOAD_LIMIT_MB * 1024 * 1024 * (file.type.startsWith("video/") ? 4 : 1);
    // Videos above the limit can still shrink during optimisation; images cannot.
    if (tooBig) {
      toast.error(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${MEDIA_UPLOAD_LIMIT_MB} MB per file.`);
      return;
    }
    setBusy(true);
    setProgress("Preparing…");
    try {
      const url = await uploadToCloudinary(file, (p) => setProgress(p));
      onChange(url);
      const kind = file.type.startsWith("video") || /\.(mp4|webm|mov)$/i.test(file.name) ? "video" : "image";
      try {
        await onUploaded?.(file.name, url, kind);
      } catch {
        /* library registration is best-effort; the field already has the file */
      }
      toast.success(`Uploaded ${file.name} — applied to this field. Remember to save.`);
      void runAI(file, url, kind);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed.");
    } finally {
      setBusy(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** After upload: smart poster frame (videos) + alt text / SEO / tags (Gemini). Best-effort. */
  const runAI = async (file: File, url: string, kind: "image" | "video") => {
    try {
      let preview: string | undefined;
      let poster: { url: string; preview: string; reason: string } | undefined;
      if (kind === "video") {
        setAi({ busy: "Picking the best poster frame…" });
        const pick = await pickPosterFrame(file);
        const posterUrl = await uploadToCloudinary(pick.poster);
        try {
          await onUploaded?.(pick.poster.name, posterUrl, "image");
        } catch {
          /* best-effort */
        }
        poster = { url: posterUrl, preview: pick.preview, reason: pick.reason };
        preview = pick.preview;
        setAi({ busy: "Writing alt text & SEO…", poster });
      } else {
        setAi({ busy: "Writing alt text & SEO…" });
        preview = await imagePreview(file);
      }
      const meta = await describeMedia({ url, kind, name: file.name, poster: preview, context: aiContext || label });
      setAi({ busy: "", meta, poster });
    } catch (e: any) {
      setAi((a) => ({ ...(a || {}), busy: "", error: e?.message || "AI step skipped" }));
    }
  };

  const copy = (k: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(""), 1500);
  };

  const applyLink = () => {
    const url = draft.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/api\/media\/|\/)/i.test(url)) {
      toast.error("Paste a full link (https://…) or a /api/media/… path.");
      return;
    }
    onChange(url);
    setLinkMode(false);
    setDraft("");
  };

  return (
    <div className={`rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-3 sm:p-4 space-y-3 transition-all duration-150 hover:border-[var(--a-line-strong)] ${className}`}>
      <div className="flex flex-col gap-3">
        {/* Thumbnail + Name details */}
        <div className="flex items-center gap-3.5 min-w-0 w-full overflow-hidden">
          <div
            onMouseEnter={() => videoRef.current?.play().catch(() => {})}
            onMouseLeave={() => {
              if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
              }
            }}
            className="w-[5rem] h-[2.8rem] rounded-[12px] bg-[var(--a-surface-2)] border border-[var(--a-line)] overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner"
          >
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin text-[var(--a-accent)]" />
            ) : cleanUrl && !isEmbed ? (
              isVideo ? (
                <video ref={videoRef} src={cleanUrl} muted loop playsInline preload="metadata" className="w-full h-full object-cover" />
              ) : (
                <img src={cleanUrl} alt="" className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
              )
            ) : (
              <div className="text-[var(--a-text-3)]">{isVideo ? <Film className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}</div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {label && <p className="text-admin-meta text-[var(--a-text-3)] font-medium mb-0.5 truncate">{label}</p>}
            <div className="flex items-center gap-2 min-w-0">
              <span
                title={cleanUrl || "Empty"}
                className="text-admin-body font-mono text-sm text-[var(--a-text)] font-medium truncate block min-w-0 flex-1"
              >
                {busy ? progress || "Uploading…" : fileName}
              </span>
              {cleanUrl && !busy && (
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy URL"
                  className="p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] hover:bg-[var(--a-surface-2)] transition-colors cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[var(--a-ok-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onOpenLibrary && (
            <Button size="sm" variant="secondary" onClick={onOpenLibrary} icon={<FolderOpen className="w-3.5 h-3.5 text-[var(--a-accent)]" />}>
              Library
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(cleanUrl);
              setLinkMode((v) => !v);
            }}
            icon={<Link2 className="w-3.5 h-3.5 text-[var(--a-accent)]" />}
          >
            Paste link
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => !busy && fileRef.current?.click()}
            icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-[var(--a-accent)]" />}
          >
            {busy ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {cleanUrl && !busy && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear media"
              className="w-8 h-8 rounded-full bg-[var(--a-surface-2)] hover:bg-[var(--a-danger-bg)] text-[var(--a-text-2)] hover:text-[var(--a-danger-text)] border border-[var(--a-line)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {linkMode && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") setLinkMode(false);
            }}
            placeholder={type === "video" ? "https://… .mp4 / .webm, YouTube or Vimeo link, or /api/media/…" : "https://… image link or /api/media/…"}
            className="flex-1 min-w-0 h-10 px-3.5 rounded-[12px] border border-[var(--a-line)] bg-[var(--a-surface)] text-[var(--a-text)] text-sm font-mono outline-none focus:border-[var(--a-accent)]"
            aria-label="Media link"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={applyLink}>
              Apply link
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setLinkMode(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {ai && (
        <div className="rounded-[14px] border border-[var(--a-line)] bg-[var(--a-surface-1)] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--a-text)] inline-flex items-center gap-1.5">
              {ai.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--a-accent)]" /> : <span aria-hidden>✨</span>} {ai.busy || "AI for this upload"}
            </p>
            {!ai.busy && (
              <button type="button" onClick={() => setAi(null)} aria-label="Close" className="p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {ai.poster && (
            <div className="flex items-center gap-3">
              <img src={ai.poster.preview} alt="Suggested poster frame" className="w-28 h-auto rounded-[8px] border border-[var(--a-line)]" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[12px] text-[var(--a-text-2)]">Poster frame{ai.poster.reason ? ` — ${ai.poster.reason}` : ""}</p>
                <div className="flex flex-wrap gap-1.5">
                  {onPoster && (
                    <Button size="sm" variant="primary" onClick={() => { onPoster(ai.poster!.url); toast.success("Poster applied — remember to save."); }}>
                      Use as poster
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => copy("poster", ai.poster!.url)}>
                    {copiedKey === "poster" ? "Copied" : "Copy poster link"}
                  </Button>
                </div>
              </div>
            </div>
          )}
          {ai.meta && (
            <div className="space-y-1.5 text-[12px]">
              {([
                ["Alt text", ai.meta.alt_text],
                ["SEO title", ai.meta.seo_title],
                ["SEO description", ai.meta.seo_description],
                ["Tags", ai.meta.tags.join(", ")],
              ] as const).map(([k, v]) =>
                v ? (
                  <div key={k} className="flex items-start gap-2">
                    <span className="w-24 shrink-0 text-[var(--a-text-3)]">{k}</span>
                    <span className="flex-1 min-w-0 text-[var(--a-text)]">{v}</span>
                    <button type="button" onClick={() => copy(k, v)} className="shrink-0 p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] cursor-pointer" aria-label={`Copy ${k}`}>
                      {copiedKey === k ? <Check className="w-3.5 h-3.5 text-[var(--a-ok-text)]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : null
              )}
              <p className="text-[11px] text-[var(--a-text-3)]">Saved to this file in the asset library.</p>
            </div>
          )}
          {ai.error && <p className="text-[12px] text-[var(--a-text-3)]">{ai.error}</p>}
        </div>
      )}

      <p className="text-[11px] text-[var(--a-text-3)]">{uploadLimitHint(type as "image" | "video" | "auto")}</p>
    </div>
  );
};
