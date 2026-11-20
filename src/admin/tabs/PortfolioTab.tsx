import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { InversePanel } from "../ui/InversePanel";
import { DetailPanel } from "../ui/DetailPanel";
import { ListRow } from "../ui/ListRow";
import { SegmentedPills } from "../ui/SegmentedPills";
import { SubTile } from "../ui/SubTile";
import { StickyActionBar } from "../ui/StickyActionBar";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Drawer } from "../ui/Drawer";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { TextInput, TextArea } from "../ui/TextInput";
import { MediaField } from "../ui/MediaField";
import { Select } from "../ui/Select";
import { VideoBlock, PortfolioTab as PortfolioTabType } from "../../types";
import { MediaAsset } from "../../context/SiteDataContext";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Layers,
  Save,
  Film,
  Play,
  Video,
  Image as ImageIcon,
} from "lucide-react";

export interface PortfolioTabProps {
  portfolioWorks: VideoBlock[];
  portfolioTabs: PortfolioTabType[];
  onAddWork: (work: Partial<VideoBlock>) => Promise<any>;
  onUpdateWork: (id: string, updates: Partial<VideoBlock>) => Promise<any>;
  onDeleteWork: (id: string) => Promise<boolean>;
  onAddTab: (type: "video" | "image") => Promise<any>;
  onUpdateTab: (id: string, name: string) => Promise<any>;
  onDeleteTab: (id: string) => Promise<boolean>;
  mediaAssets: MediaAsset[];
  onOpenUpload: (targetId: string) => void;
}

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  portfolioWorks,
  portfolioTabs,
  onAddWork,
  onUpdateWork,
  onDeleteWork,
  onAddTab,
  onUpdateTab,
  onDeleteTab,
  mediaAssets,
  onOpenUpload,
}) => {
  const [activeTabFilter, setActiveTabFilter] = useState("all");
  const [selectedWorkId, setSelectedWorkId] = useState<string>(
    portfolioWorks[0]?.id || ""
  );
  const [tabDrawerOpen, setTabDrawerOpen] = useState(false);
  const [addTabModalOpen, setAddTabModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered films
  const filteredWorks = portfolioWorks.filter((w) =>
    activeTabFilter === "all" ? true : w.tab_id === activeTabFilter
  );

  const selectedWork =
    portfolioWorks.find((w) => w.id === selectedWorkId) || filteredWorks[0] || null;

  // Local editing state for selected film
  const [editFilm, setEditFilm] = useState<Partial<VideoBlock>>({});

  React.useEffect(() => {
    if (selectedWork) {
      setEditFilm(selectedWork);
    }
  }, [selectedWork?.id]);

  const handleFieldChange = (key: keyof VideoBlock, val: any) => {
    setEditFilm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSaveSelectedFilm = async () => {
    if (!selectedWork?.id) return;
    setIsSaving(true);
    await onUpdateWork(selectedWork.id, editFilm);
    setIsSaving(false);
  };

  const handleCreateNewFilm = async () => {
    const newFilm: Partial<VideoBlock> = {
      title: "Untitled Production Film",
      category: "Brand Film",
      videoUrl: "",
      imageUrl: "",
      tab_id: portfolioTabs[0]?.id || "default",
      duration: "0:45",
      creator: "New Client",
    };
    const created = await onAddWork(newFilm);
    if (created?.id) {
      setSelectedWorkId(created.id);
    }
  };

  const tabPills = [
    { id: "all", label: "All Works", count: portfolioWorks.length },
    ...portfolioTabs.map((t) => ({
      id: t.id,
      label: t.tab_title,
      count: portfolioWorks.filter((w) => w.tab_id === t.id).length,
    })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="PORTFOLIO & CURATION"
        title="Selected Work & Films"
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setTabDrawerOpen(true)}
              icon={<Layers className="w-4 h-4 text-[#FF6A1F]" />}
            >
              Manage tabs ({portfolioTabs.length})
            </Button>

            <Button
              variant="accent"
              onClick={handleCreateNewFilm}
              icon={<Plus className="w-4 h-4" />}
            >
              Add new film
            </Button>
          </div>
        }
      />

      {/* 5 / 7 Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Master Column: InversePanel (5 columns) */}
        <div className="lg:col-span-5 relative pt-4">
          <SegmentedPills
            options={tabPills}
            activeId={activeTabFilter}
            onChange={setActiveTabFilter}
            variant="floating"
          />

          <InversePanel
            eyebrow="PRODUCTION ROSTER"
            title={`Films (${filteredWorks.length})`}
            headerBorder={true}
          >
            <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1">
              {filteredWorks.length === 0 ? (
                <div className="py-12 text-center text-[#07080C]/55">
                  No works configured in this tab.
                </div>
              ) : (
                filteredWorks.map((work) => {
                  const isSelected = (selectedWork?.id || "") === work.id;

                  return (
                    <ListRow
                      key={work.id}
                      id={work.id}
                      primary={work.title}
                      secondary={`${work.category || "Film"} · ${
                        work.duration || "0:30"
                      }`}
                      isSelected={isSelected}
                      onClick={() => setSelectedWorkId(work.id)}
                      avatar={
                        work.imageUrl ? (
                          <img
                            src={work.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Film className="w-5 h-5 text-current opacity-60" />
                        )
                      }
                      badge={{
                        status: isSelected ? "inverse" : "draft",
                        label: work.creator || "Studio",
                      }}
                    />
                  );
                })
              )}
            </div>
          </InversePanel>
        </div>

        {/* Right Detail Column: DetailPanel (7 columns) */}
        <div className="lg:col-span-7">
          {selectedWork ? (
            <DetailPanel
              columns={[
                {
                  label: "Film Title",
                  value: editFilm.title || "Untitled",
                },
                {
                  label: "Category",
                  value: editFilm.category || "Commercial",
                },
                {
                  label: "Client",
                  value: editFilm.creator || "Studio",
                },
              ]}
            >
              {/* 16:9 Video / Poster Preview Frame */}
              <div className="w-full aspect-video rounded-[1.25rem] bg-[#07080C] border border-white/10 overflow-hidden relative shadow-inner flex items-center justify-center">
                {editFilm.videoUrl ? (
                  <video
                    src={editFilm.videoUrl}
                    poster={editFilm.imageUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : editFilm.imageUrl ? (
                  <img
                    src={editFilm.imageUrl}
                    alt=""
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center text-[#F4EFE6]/40 p-6">
                    <Film className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-admin-meta">No media URL assigned yet</p>
                  </div>
                )}
              </div>

              {/* SubTile quick metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SubTile
                  label="Category"
                  value={editFilm.category || "Brand Film"}
                />
                <SubTile
                  label="Duration"
                  value={editFilm.duration || "0:45"}
                />
                <SubTile
                  label="Creator"
                  value={editFilm.creator || "Studio"}
                />
                <SubTile
                  label="Format"
                  value={editFilm.ratio || "landscape"}
                />
              </div>

              {/* Editable Fields */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Film Title">
                    <TextInput
                      value={editFilm.title || ""}
                      onChange={(e) => handleFieldChange("title", e.target.value)}
                      placeholder="e.g. Prestige Synthetic Odyssey"
                    />
                  </Field>

                  <Field label="Client / Creator">
                    <TextInput
                      value={editFilm.creator || ""}
                      onChange={(e) => handleFieldChange("creator", e.target.value)}
                      placeholder="e.g. United Colors of Benetton"
                    />
                  </Field>

                  <Field label="Category / Genre">
                    <TextInput
                      value={editFilm.category || ""}
                      onChange={(e) => handleFieldChange("category", e.target.value)}
                      placeholder="e.g. AI Commercial, Luxury Brand Film"
                    />
                  </Field>

                  <Field label="Duration / Run Time">
                    <TextInput
                      value={editFilm.duration || ""}
                      onChange={(e) => handleFieldChange("duration", e.target.value)}
                      placeholder="e.g. 0:45, 1:12"
                    />
                  </Field>

                  <Field label="Portfolio Tab Assignment">
                    <Select
                      value={editFilm.tab_id || portfolioTabs[0]?.id || ""}
                      onChange={(val) => handleFieldChange("tab_id", val)}
                      options={portfolioTabs.map((t) => ({
                        value: t.id,
                        label: t.tab_title,
                      }))}
                    />
                  </Field>

                  <Field label="Aspect Ratio Format">
                    <Select
                      value={editFilm.ratio || "landscape"}
                      onChange={(val) => handleFieldChange("ratio", val as any)}
                      options={[
                        { value: "landscape", label: "Landscape (16:9 Cinema)" },
                        { value: "portrait", label: "Portrait (9:16 Vertical)" },
                        { value: "video-post", label: "Video Post (4:5 Social)" },
                      ]}
                    />
                  </Field>
                </div>

                <Field label="Direct 4K Video Master URL">
                  <MediaField
                    type="video"
                    value={editFilm.videoUrl || ""}
                    onChange={(val) => handleFieldChange("videoUrl", val)}
                    onUpload={() => onOpenUpload(selectedWork.id)}
                    placeholder="Direct MP4 / WEBM video stream link"
                  />
                </Field>

                <Field label="Cover Poster Frame URL">
                  <MediaField
                    type="image"
                    value={editFilm.imageUrl || ""}
                    onChange={(val) => handleFieldChange("imageUrl", val)}
                    onUpload={() => onOpenUpload(selectedWork.id)}
                    placeholder="Poster image still link"
                  />
                </Field>

                <Field label="Editorial Narrative / Logline">
                  <TextArea
                    value={editFilm.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Describe the conceptual world-building and production synthesis..."
                  />
                </Field>
              </div>

              {/* Sticky Action Bar */}
              <StickyActionBar
                summaries={[
                  {
                    label: "Selected Film",
                    value: editFilm.title || "Untitled",
                  },
                  {
                    label: "Tab",
                    value:
                      portfolioTabs.find((t) => t.id === editFilm.tab_id)?.tab_title ||
                      "Default",
                  },
                ]}
                actions={
                  <div className="flex items-center gap-2">
                    <IconButton
                      label="Delete Film"
                      variant="danger"
                      onClick={() => onDeleteWork(selectedWork.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>

                    <Button
                      variant="accent"
                      loading={isSaving}
                      onClick={handleSaveSelectedFilm}
                      icon={<Save className="w-4 h-4" />}
                    >
                      {isSaving ? "Saving..." : "Save film"}
                    </Button>
                  </div>
                }
              />
            </DetailPanel>
          ) : (
            <div className="rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-12 text-center text-[#F4EFE6]/50">
              No film selected. Click an item on the left or add a new film.
            </div>
          )}
        </div>
      </div>

      {/* Tab Management Drawer */}
      <Drawer
        open={tabDrawerOpen}
        onClose={() => setTabDrawerOpen(false)}
        title="Portfolio Tabs Management"
        description="Create, reorder, or rename categories for the curated work gallery"
      >
        <div className="space-y-4">
          <Button
            variant="accent"
            onClick={() => setAddTabModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            className="w-full"
          >
            Create new portfolio tab
          </Button>

          <div className="space-y-3 pt-4">
            {portfolioTabs.map((tab) => (
              <div
                key={tab.id}
                className="p-4 rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={tab.tab_title}
                    onChange={(e) => onUpdateTab(tab.id, e.target.value)}
                    placeholder="Tab name..."
                  />
                </div>

                <IconButton
                  label="Delete Tab"
                  variant="danger"
                  onClick={() => onDeleteTab(tab.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* Add Tab Type Modal */}
      <Dialog
        open={addTabModalOpen}
        onClose={() => setAddTabModalOpen(false)}
        title="Create New Portfolio Tab"
        description="Select the layout format for this curated section"
      >
        <div className="grid grid-cols-2 gap-4 my-6">
          <button
            type="button"
            onClick={async () => {
              await onAddTab("video");
              setAddTabModalOpen(false);
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] hover:border-[#FF6A1F] text-center transition-all cursor-pointer group"
          >
            <Video className="w-8 h-8 text-[#FF6A1F] group-hover:scale-110 transition-transform" />
            <div>
              <span className="block text-admin-label text-[#F4EFE6] font-semibold">
                Video Cinema
              </span>
              <span className="block text-admin-meta text-[#F4EFE6]/50 mt-1">
                Accordion fluid player
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={async () => {
              await onAddTab("image");
              setAddTabModalOpen(false);
            }}
            className="flex flex-col items-center gap-3 p-6 rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] hover:border-[#FF6A1F] text-center transition-all cursor-pointer group"
          >
            <ImageIcon className="w-8 h-8 text-[#FFC93C] group-hover:scale-110 transition-transform" />
            <div>
              <span className="block text-admin-label text-[#F4EFE6] font-semibold">
                Static Visuals
              </span>
              <span className="block text-admin-meta text-[#F4EFE6]/50 mt-1">
                Visual artwork grid
              </span>
            </div>
          </button>
        </div>
      </Dialog>
    </div>
  );
};
