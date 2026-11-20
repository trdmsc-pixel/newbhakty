import React, { useState, useMemo } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Panel } from "../ui/Panel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { FilterBar } from "../ui/FilterBar";
import { SegmentedPills } from "../ui/SegmentedPills";
import { Drawer } from "../ui/Drawer";
import { Chip } from "../ui/Chip";
import { MediaAsset } from "../../context/SiteDataContext";
import {
  Upload,
  Copy,
  Check,
  Trash2,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Plus,
} from "lucide-react";

export interface AssetsTabProps {
  assets: MediaAsset[];
  onDeleteAsset: (id: string) => Promise<boolean>;
  onTriggerUpload: () => void;
}

export const AssetsTab: React.FC<AssetsTabProps> = ({
  assets,
  onDeleteAsset,
  onTriggerUpload,
}) => {
  const [activeType, setActiveType] = useState("all");
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      if (activeType === "video" && item.type !== "video") return false;
      if (activeType === "image" && item.type !== "image" && item.type) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchUrl = item.url.toLowerCase().includes(q);
        if (!matchName && !matchUrl) return false;
      }
      return true;
    });
  }, [assets, activeType, search]);

  const handleCopyUrl = (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="GLOBAL DIGITAL ASSETS"
        title="Media Assets Library"
        actions={
          <div className="flex items-center gap-3">
            <SegmentedPills
              options={[
                { id: "grid", label: "Grid view" },
                { id: "list", label: "List view" },
              ]}
              activeId={viewMode}
              onChange={setViewMode}
            />

            <Button
              variant="accent"
              onClick={onTriggerUpload}
              icon={<Upload className="w-4 h-4" />}
            >
              Upload assets
            </Button>
          </div>
        }
      />

      {/* Large Dashed Drop-Zone Panel at the Top */}
      <button
        type="button"
        onClick={onTriggerUpload}
        className="w-full rounded-[1.75rem] border-2 border-dashed border-white/20 hover:border-[#FF6A1F] bg-[#11131A]/60 hover:bg-[#11131A] p-8 sm:p-12 flex flex-col items-center justify-center text-center transition-all cursor-pointer group shadow-sm"
      >
        <div className="w-16 h-16 rounded-full bg-white/[0.06] group-hover:bg-[#FF6A1F]/20 text-[#F4EFE6] group-hover:text-[#FF6A1F] flex items-center justify-center mb-4 transition-all group-hover:scale-110">
          <Upload className="w-8 h-8" />
        </div>
        <h3 className="text-admin-h2 font-semibold text-[#F4EFE6]">
          Drop media files here or click to upload
        </h3>
        <p className="text-admin-body text-[#F4EFE6]/55 max-w-md mt-1.5">
          Upload 4K Master videos (MP4, WebM) or high-resolution imagery up to 100MB with automatic CDN distribution
        </p>
      </button>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter assets by name or URL..."
          activeCount={search ? 1 : 0}
          onClearFilters={() => setSearch("")}
        >
          <SegmentedPills
            options={[
              { id: "all", label: "All Assets", count: assets.length },
              {
                id: "video",
                label: "Videos",
                count: assets.filter((a) => a.type === "video").length,
              },
              {
                id: "image",
                label: "Images",
                count: assets.filter((a) => a.type === "image" || !a.type).length,
              },
            ]}
            activeId={activeType}
            onChange={setActiveType}
          />
        </FilterBar>

        {/* Assets Grid / List */}
        <Panel
          eyebrow="LIBRARY REPOSITORY"
          title={`All Assets (${filteredAssets.length})`}
        >
          {filteredAssets.length === 0 ? (
            <div className="py-16 text-center text-[#F4EFE6]/50">
              No assets match your search criteria.
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
              {filteredAssets.map((asset) => {
                const isVideo =
                  asset.type === "video" ||
                  asset.url.endsWith(".mp4") ||
                  asset.url.endsWith(".webm");

                return (
                  <Card
                    key={asset.id}
                    hover
                    onClick={() => setSelectedAsset(asset)}
                    className="cursor-pointer flex flex-col justify-between overflow-hidden p-4 group"
                  >
                    <div>
                      {/* 16:9 Thumbnail Frame */}
                      <div className="w-full aspect-video rounded-[1rem] bg-[#07080C] border border-white/10 overflow-hidden relative mb-3.5 flex items-center justify-center">
                        {isVideo ? (
                          <video
                            src={asset.url}
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        ) : (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/60 text-white backdrop-blur-sm">
                          {isVideo ? "VIDEO" : "IMAGE"}
                        </span>
                      </div>

                      <p className="text-admin-label font-semibold text-[#F4EFE6] truncate">
                        {asset.name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.08] mt-3">
                      <button
                        type="button"
                        onClick={(e) => handleCopyUrl(e, asset.url, asset.id)}
                        className="inline-flex items-center gap-1.5 text-admin-meta text-[#F4EFE6]/70 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedId === asset.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteAsset(asset.id);
                        }}
                        aria-label="Delete asset"
                        className="p-1.5 rounded-full text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] hover:border-white/20 p-4 flex items-center justify-between gap-4 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-14 h-10 rounded-lg bg-[#07080C] overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                      {asset.type === "video" ? (
                        <Film className="w-4 h-4 text-[#FF6A1F]" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-[#FFC93C]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-admin-label font-semibold text-[#F4EFE6] truncate">
                        {asset.name}
                      </p>
                      <p className="text-admin-meta font-mono text-xs text-[#F4EFE6]/45 truncate mt-0.5">
                        {asset.url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopyUrl(e, asset.url, asset.id)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/10 text-admin-meta text-[#F4EFE6] cursor-pointer"
                    >
                      {copiedId === asset.id ? "Copied ✓" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await onDeleteAsset(asset.id);
                      }}
                      className="p-2 rounded-full text-red-400 hover:bg-red-500/15 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Selected Asset Details Drawer */}
      <Drawer
        open={Boolean(selectedAsset)}
        onClose={() => setSelectedAsset(null)}
        title="Asset Inspection"
        description="Detailed metadata, format specifications, and direct link"
      >
        {selectedAsset && (
          <div className="space-y-6">
            <div className="w-full aspect-video rounded-[1.25rem] bg-[#07080C] border border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
              {selectedAsset.type === "video" ? (
                <video
                  src={selectedAsset.url}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={selectedAsset.url}
                  alt={selectedAsset.name}
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-admin-meta text-[#F4EFE6]/50">File Name</p>
                <p className="text-admin-h3 text-[#F4EFE6] font-semibold mt-0.5">
                  {selectedAsset.name}
                </p>
              </div>

              <div>
                <p className="text-admin-meta text-[#F4EFE6]/50">Direct CDN Link</p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={selectedAsset.url}
                    className="w-full h-11 rounded-xl bg-[#181B24] border border-white/10 px-3 text-admin-meta font-mono text-xs text-[#F4EFE6]"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => handleCopyUrl(e, selectedAsset.url, selectedAsset.id)}
                  >
                    {copiedId === selectedAsset.id ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-admin-meta text-[#F4EFE6]/50">Type</p>
                <Chip
                  status={selectedAsset.type === "video" ? "draft" : "new"}
                  label={(selectedAsset.type || "image").toUpperCase()}
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <a
                  href={selectedAsset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-admin-meta text-[#FF6A1F] hover:underline"
                >
                  <span>Open raw link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await onDeleteAsset(selectedAsset.id);
                    setSelectedAsset(null);
                  }}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Delete Asset
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
