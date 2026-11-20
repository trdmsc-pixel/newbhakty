import React, { useState, useRef } from "react";
import { Upload, FolderOpen, Copy, Check, X, Film, Image as ImageIcon } from "lucide-react";
import { Tooltip } from "./Tooltip";
import { Button } from "./Button";

export interface MediaFieldProps {
  value: string;
  onChange: (url: string) => void;
  onOpenLibrary?: () => void;
  onUpload?: () => void;
  placeholder?: string;
  label?: string;
  type?: "image" | "video" | "auto";
  className?: string;
}

export const MediaField: React.FC<MediaFieldProps> = ({
  value,
  onChange,
  onOpenLibrary,
  onUpload,
  placeholder = "No media selected",
  label,
  type = "auto",
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const cleanUrl = (value || "").trim();
  const isVideo =
    type === "video" ||
    cleanUrl.endsWith(".mp4") ||
    cleanUrl.endsWith(".webm") ||
    cleanUrl.includes("video");

  const fileName = cleanUrl
    ? cleanUrl.split("/").pop()?.split("?")[0] || cleanUrl
    : placeholder;

  const handleCopy = () => {
    if (!cleanUrl) return;
    navigator.clipboard.writeText(cleanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      className={`rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 hover:border-white/[0.18] ${className}`}
    >
      {/* Thumbnail + Name details */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="w-[5rem] h-[2.8rem] rounded-[12px] bg-[#07080C] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner"
        >
          {cleanUrl ? (
            isVideo ? (
              <video
                ref={videoRef}
                src={cleanUrl}
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={cleanUrl}
                alt=""
                className="w-full h-full object-contain p-0.5 mix-blend-screen"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="text-[#F4EFE6]/30">
              {isVideo ? <Film className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {label && (
            <p className="text-admin-meta text-[#F4EFE6]/50 font-medium mb-0.5 truncate">
              {label}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Tooltip content={cleanUrl || "Empty"}>
              <span className="text-admin-body font-mono text-sm text-[#F4EFE6] font-medium truncate block max-w-[280px] sm:max-w-[360px]">
                {fileName}
              </span>
            </Tooltip>

            {cleanUrl && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy URL"
                className="p-1 rounded-full text-[#F4EFE6]/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        {onOpenLibrary && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenLibrary}
            icon={<FolderOpen className="w-3.5 h-3.5 text-[#FFC93C]" />}
          >
            Library
          </Button>
        )}

        {onUpload && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onUpload}
            icon={<Upload className="w-3.5 h-3.5 text-[#FF6A1F]" />}
          >
            Upload
          </Button>
        )}

        {cleanUrl && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear media"
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-red-500/20 text-[#F4EFE6]/70 hover:text-red-300 border border-white/[0.08] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
