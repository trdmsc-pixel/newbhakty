import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { OverviewBento } from "../shell/OverviewBento";
import { Panel } from "../ui/Panel";
import { SegmentedPills } from "../ui/SegmentedPills";
import { SectionAccordion } from "../ui/SectionAccordion";
import { Field } from "../ui/Field";
import { TextInput, TextArea } from "../ui/TextInput";
import { MediaField } from "../ui/MediaField";
import { Select } from "../ui/Select";
import { StickyActionBar } from "../ui/StickyActionBar";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Undo, Redo, Save, ExternalLink } from "lucide-react";
import { AvatarItem } from "../ui/AvatarStack";
import { MediaAsset } from "../../context/SiteDataContext";

const OLD_WORDING_PHRASES = [
  "prompt orchestration",
  "temporal coherence",
  "synthetic",
  "Book Creative",
  "Synth",
  "Odyssey",
];

export const hasOldWording = (val?: string) => {
  if (!val) return false;
  const lower = val.toLowerCase();
  return OLD_WORDING_PHRASES.some((p) => lower.includes(p.toLowerCase()));
};

export interface SettingsTabProps {
  editSettings: Record<string, string>;
  onSettingChange: (key: string, val: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasUnsaved: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mediaAssets: MediaAsset[];
  onOpenUpload: (targetSetting: string) => void;

  // Overview metrics
  totalFilms: number;
  filmsWithPosters: number;
  filmAvatars: AvatarItem[];
  totalLogos: number;
  activeLogos: number;
  logoAvatars: AvatarItem[];
  totalInquiries: number;
  repliedInquiries: number;
  inquiryAvatars: AvatarItem[];
  totalAssets: number;
  analyticsVisitors: number;
  onSelectChannel: (tab: string) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  editSettings,
  onSettingChange,
  onSave,
  isSaving,
  hasUnsaved,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  mediaAssets,
  onOpenUpload,
  totalFilms,
  filmsWithPosters,
  filmAvatars,
  totalLogos,
  activeLogos,
  logoAvatars,
  totalInquiries,
  repliedInquiries,
  inquiryAvatars,
  totalAssets,
  analyticsVisitors,
  onSelectChannel,
}) => {
  const [activeSection, setActiveSection] = useState("00");
  const [openSections, setOpenSections] = useState<string[]>([
    "00",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
  ]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const sectionPills = [
    { id: "00", label: "Branding" },
    { id: "01", label: "Hero" },
    { id: "02", label: "Showreel" },
    { id: "03", label: "Selected Work" },
    { id: "04", label: "Capabilities" },
    { id: "05", label: "Inquiry Form" },
    { id: "06", label: "Social Outreach" },
    { id: "07", label: "Footer & Legal" },
  ];

  const handleSectionJump = (id: string) => {
    setActiveSection(id);
    if (!openSections.includes(id)) {
      setOpenSections((prev) => [...prev, id]);
    }
    const el = document.getElementById(`settings-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const imageOptions = [
    { value: "", label: "Default Studio Asset (Built-in)" },
    ...mediaAssets
      .filter((a) => a.type === "image" || !a.type)
      .map((a) => ({
        value: a.url,
        label: a.name,
        meta: "Global Media Asset",
        previewUrl: a.url,
      })),
  ];

  const videoOptions = [
    { value: "", label: "Default Studio Showreel Loop" },
    ...mediaAssets
      .filter((a) => a.type === "video")
      .map((a) => ({
        value: a.url,
        label: a.name,
        meta: "Video Asset",
        previewUrl: a.url,
      })),
  ];

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <PageHeader
        eyebrow="STUDIO CONTENT MANAGEMENT"
        title="Hero, Showreel & Copy"
        hasUnsavedChanges={hasUnsaved}
        actions={
          <div className="flex items-center gap-2">
            <IconButton
              label="Undo edit"
              shortcut="⌘Z"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo className="w-5 h-5" />
            </IconButton>

            <IconButton
              label="Redo edit"
              shortcut="⌘⇧Z"
              disabled={!canRedo}
              onClick={onRedo}
            >
              <Redo className="w-5 h-5" />
            </IconButton>

            <Button
              variant="accent"
              loading={isSaving}
              onClick={onSave}
              icon={<Save className="w-4 h-4" />}
            >
              {isSaving ? "Publishing..." : "Publish changes"}
            </Button>
          </div>
        }
      />

      {/* 4.3 Overview Bento (Website at a glance + Studio channels) */}
      <OverviewBento
        totalFilms={totalFilms}
        filmsWithPosters={filmsWithPosters}
        filmAvatars={filmAvatars}
        totalLogos={totalLogos}
        activeLogos={activeLogos}
        logoAvatars={logoAvatars}
        totalInquiries={totalInquiries}
        repliedInquiries={repliedInquiries}
        inquiryAvatars={inquiryAvatars}
        totalAssets={totalAssets}
        analyticsVisitors={analyticsVisitors}
        onSelectChannel={onSelectChannel}
      />

      {/* Main Website Content Panel with Floating Segmented Pills */}
      <div className="relative pt-6">
        <SegmentedPills
          options={sectionPills}
          activeId={activeSection}
          onChange={handleSectionJump}
          variant="floating"
        />

        <Panel
          eyebrow="LIVE WEBSITE CONTENT"
          title="Studio Sections & Global Copy"
          actions={
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setOpenSections((prev) =>
                  prev.length === 8
                    ? []
                    : ["00", "01", "02", "03", "04", "05", "06", "07"]
                )
              }
            >
              {openSections.length === 8 ? "Collapse all" : "Expand all"}
            </Button>
          }
        >
          <div className="space-y-6 pt-2">
            {/* 00: Site Branding & Logos */}
            <div id="settings-sec-00">
              <SectionAccordion
                id="00"
                number="00"
                title="Site Branding & Logos (Navbar & Footer)"
                summary="Manage the primary top navigation logo and the giant footer signature mark"
                isOpen={openSections.includes("00")}
                onToggle={() => toggleSection("00")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Field
                      label="Top Navigation Bar Logo"
                      help="Replaces the default vector wordmark in the top fixed navbar"
                    >
                      <MediaField
                        value={editSettings.navbar_logo_url || ""}
                        onChange={(val) => onSettingChange("navbar_logo_url", val)}
                        onUpload={() => onOpenUpload("navbar_logo_url")}
                        placeholder="Default animated Studio Wordmark"
                      />
                    </Field>
                    <Field label="Or select from assets">
                      <Select
                        value={editSettings.navbar_logo_url || ""}
                        onChange={(val) => onSettingChange("navbar_logo_url", val)}
                        options={imageOptions}
                        placeholder="Choose Navbar Logo..."
                      />
                    </Field>

                    <Field
                      label="Navbar Logo Size / Height"
                      help="Use slider to resize the logo and make it larger or smaller (Default: 34px)"
                    >
                      <div className="space-y-3 p-4 rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--a-text-2)] text-admin-meta">Logo Height:</span>
                          <span className="font-mono font-bold text-[var(--a-accent)] bg-[var(--a-accent-soft)] border border-[var(--a-accent)]/30 px-3 py-1 rounded-full text-admin-meta">
                            {editSettings.navbar_logo_height || "34"} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="72"
                          step="2"
                          value={parseInt(editSettings.navbar_logo_height || "34", 10)}
                          onChange={(e) => onSettingChange("navbar_logo_height", e.target.value)}
                          className="w-full accent-[#FF6A1F] h-2 bg-[var(--a-surface-2)] rounded-lg cursor-pointer"
                        />
                        <div className="flex items-center justify-between gap-2 pt-1">
                          {[
                            { label: "Compact", val: "26" },
                            { label: "Default", val: "34" },
                            { label: "Medium", val: "44" },
                            { label: "Large", val: "56" },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => onSettingChange("navbar_logo_height", preset.val)}
                              className={`flex-1 py-1.5 rounded-full text-admin-eyebrow font-mono transition-all cursor-pointer border ${
                                (editSettings.navbar_logo_height || "34") === preset.val
                                  ? "bg-[var(--a-accent-soft)] border-[var(--a-accent)] text-[var(--a-text)] font-bold"
                                  : "bg-[var(--a-surface-2)] border-[var(--a-line)] text-[var(--a-text-2)] hover:text-[var(--a-text)] hover:border-[var(--a-line-strong)]"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Field>
                  </div>

                  <div className="space-y-4">
                    <Field
                      label="Footer Giant Signature Logo"
                      help="Replaces the giant wordmark above the 3-column footer"
                    >
                      <MediaField
                        value={editSettings.footer_logo_url || editSettings.logo_img_url || ""}
                        onChange={(val) => {
                          onSettingChange("footer_logo_url", val);
                          onSettingChange("logo_img_url", val);
                        }}
                        onUpload={() => onOpenUpload("footer_logo_url")}
                        placeholder="Default giant THE CHANTING STUDIO signature"
                      />
                    </Field>
                    <Field label="Or select from assets">
                      <Select
                        value={editSettings.footer_logo_url || editSettings.logo_img_url || ""}
                        onChange={(val) => {
                          onSettingChange("footer_logo_url", val);
                          onSettingChange("logo_img_url", val);
                        }}
                        options={imageOptions}
                        placeholder="Choose Footer Logo..."
                      />
                    </Field>

                    <Field
                      label="Footer Logo Size / Height"
                      help="Use slider to resize the giant signature logo above the footer (Default: 110px)"
                    >
                      <div className="space-y-3 p-4 rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--a-text-2)] text-admin-meta">Logo Height:</span>
                          <span className="font-mono font-bold text-[var(--a-accent)] bg-[var(--a-accent-soft)] border border-[var(--a-accent)]/30 px-3 py-1 rounded-full text-admin-meta">
                            {editSettings.footer_logo_height || "110"} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="180"
                          step="5"
                          value={parseInt(editSettings.footer_logo_height || "110", 10)}
                          onChange={(e) => onSettingChange("footer_logo_height", e.target.value)}
                          className="w-full accent-[#FF6A1F] h-2 bg-[var(--a-surface-2)] rounded-lg cursor-pointer"
                        />
                        <div className="flex items-center justify-between gap-2 pt-1">
                          {[
                            { label: "Compact", val: "75" },
                            { label: "Default", val: "110" },
                            { label: "Prominent", val: "140" },
                            { label: "Grand", val: "175" },
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => onSettingChange("footer_logo_height", preset.val)}
                              className={`flex-1 py-1.5 rounded-full text-admin-eyebrow font-mono transition-all cursor-pointer border ${
                                (editSettings.footer_logo_height || "110") === preset.val
                                  ? "bg-[var(--a-accent-soft)] border-[var(--a-accent)] text-[var(--a-text)] font-bold"
                                  : "bg-[var(--a-surface-2)] border-[var(--a-line)] text-[var(--a-text-2)] hover:text-[var(--a-text)] hover:border-[var(--a-line-strong)]"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Field>
                  </div>
                </div>
              </SectionAccordion>
            </div>

            {/* 01: Hero Section */}
            <div id="settings-sec-01">
              <SectionAccordion
                id="01"
                number="01"
                title="Hero Section (#top)"
                summary={editSettings.hero_headline || "Main editorial cinema headline"}
                isOpen={openSections.includes("01")}
                onToggle={() => toggleSection("01")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field
                    label="Editorial Title"
                    counter={{
                      current: (editSettings.hero_headline || "").length,
                      max: 60,
                    }}
                    warning={
                      hasOldWording(editSettings.hero_headline)
                        ? "Contains old wording"
                        : undefined
                    }
                  >
                    <TextInput
                      value={editSettings.hero_headline || ""}
                      onChange={(e) => onSettingChange("hero_headline", e.target.value)}
                      placeholder="The Next Epoch of Cinema, Synthesized."
                    />
                  </Field>

                  <Field
                    label="Editorial Eyebrow / Supertitle"
                    help="Small tracked category pill above headline"
                  >
                    <TextInput
                      value={editSettings.hero_supertitle || ""}
                      onChange={(e) => onSettingChange("hero_supertitle", e.target.value)}
                      placeholder="AI COMMERCIAL PRODUCTION · DELHI & WORLDWIDE"
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field
                      label="Hero Description & Positioning Statement"
                      counter={{
                        current: (editSettings.hero_subheadline || "").length,
                        max: 180,
                      }}
                      warning={
                        hasOldWording(editSettings.hero_subheadline)
                          ? "Contains old wording"
                          : undefined
                      }
                    >
                      <TextArea
                        value={editSettings.hero_subheadline || ""}
                        onChange={(e) => onSettingChange("hero_subheadline", e.target.value)}
                        placeholder="Film-grade commercials, brand films, and visual world-building for visionary agencies..."
                      />
                    </Field>
                  </div>

                  <Field label="Hero Background Loop Video">
                    <MediaField
                      type="video"
                      value={editSettings.hero_video_bg_url || ""}
                      onChange={(val) => onSettingChange("hero_video_bg_url", val)}
                      onUpload={() => onOpenUpload("hero_video_bg_url")}
                      placeholder="Direct mp4 / webm CDN link"
                    />
                  </Field>

                  <Field label="Hero Video Poster Fallback">
                    <MediaField
                      type="image"
                      value={editSettings.hero_poster_url || ""}
                      onChange={(val) => onSettingChange("hero_poster_url", val)}
                      onUpload={() => onOpenUpload("hero_poster_url")}
                      placeholder="Cover frame for instant loading"
                    />
                  </Field>
                </div>
              </SectionAccordion>
            </div>

            {/* 02: Showreel Showcase */}
            <div id="settings-sec-02">
              <SectionAccordion
                id="02"
                number="02"
                title="Showreel Showcase (#reel)"
                summary="Flagship cinema showreel player URL and poster stills"
                isOpen={openSections.includes("02")}
                onToggle={() => toggleSection("02")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Showreel Video Master URL (4K UHD)">
                    <MediaField
                      type="video"
                      value={editSettings.showreel_video_url || ""}
                      onChange={(val) => onSettingChange("showreel_video_url", val)}
                      onUpload={() => onOpenUpload("showreel_video_url")}
                      placeholder="4K showreel video file"
                    />
                  </Field>

                  <Field label="Showreel Poster Still">
                    <MediaField
                      type="image"
                      value={editSettings.showreel_poster_url || ""}
                      onChange={(val) => onSettingChange("showreel_poster_url", val)}
                      onUpload={() => onOpenUpload("showreel_poster_url")}
                      placeholder="High-resolution poster image"
                    />
                  </Field>
                </div>
              </SectionAccordion>
            </div>

            {/* 03: Selected Work Section */}
            <div id="settings-sec-03">
              <SectionAccordion
                id="03"
                number="03"
                title="Selected Work Section (#work)"
                summary="Title, curation intro, and portfolio gallery metadata"
                isOpen={openSections.includes("03")}
                onToggle={() => toggleSection("03")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Work Section Title">
                    <TextInput
                      value={editSettings.work_title || ""}
                      onChange={(e) => onSettingChange("work_title", e.target.value)}
                      placeholder="Selected Work"
                    />
                  </Field>

                  <Field label="Work Section Subtitle">
                    <TextInput
                      value={editSettings.work_subtitle || ""}
                      onChange={(e) => onSettingChange("work_subtitle", e.target.value)}
                      placeholder="Brand Films · AI Commercials · Trailers"
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Curation Overview Statement">
                      <TextArea
                        value={editSettings.work_intro || ""}
                        onChange={(e) => onSettingChange("work_intro", e.target.value)}
                        placeholder="Every film synthesized at The Chanting Studio is built at 4K UHD master resolution..."
                      />
                    </Field>
                  </div>
                </div>
              </SectionAccordion>
            </div>

            {/* 04: Capabilities & Process */}
            <div id="settings-sec-04">
              <SectionAccordion
                id="04"
                number="04"
                title="Capabilities & Process (#capabilities, #process)"
                summary="Production studio disciplines, pipeline phases, and editorial copy"
                isOpen={openSections.includes("04")}
                onToggle={() => toggleSection("04")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Capabilities Title">
                    <TextInput
                      value={editSettings.capabilities_title || ""}
                      onChange={(e) => onSettingChange("capabilities_title", e.target.value)}
                      placeholder="Capabilities & Disciplines"
                    />
                  </Field>

                  <Field label="Capabilities Subtitle">
                    <TextInput
                      value={editSettings.capabilities_subtitle || ""}
                      onChange={(e) => onSettingChange("capabilities_subtitle", e.target.value)}
                      placeholder="From prompt orchestration to post-grade"
                    />
                  </Field>

                  <Field label="Process Title">
                    <TextInput
                      value={editSettings.process_title || ""}
                      onChange={(e) => onSettingChange("process_title", e.target.value)}
                      placeholder="Studio Production Process"
                    />
                  </Field>

                  <Field label="Process Subtitle">
                    <TextInput
                      value={editSettings.process_subtitle || ""}
                      onChange={(e) => onSettingChange("process_subtitle", e.target.value)}
                      placeholder="Four-stage synthetic pipeline"
                    />
                  </Field>
                </div>
              </SectionAccordion>
            </div>

            {/* 05: Booking & Inquiry */}
            <div id="settings-sec-05">
              <SectionAccordion
                id="05"
                number="05"
                title="Booking & Inquiry Form (#contact)"
                summary="Inquiry headline, qualification parameters, and conversion copy"
                isOpen={openSections.includes("05")}
                onToggle={() => toggleSection("05")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Inquiry Headline">
                    <TextInput
                      value={editSettings.booking_title || ""}
                      onChange={(e) => onSettingChange("booking_title", e.target.value)}
                      placeholder="Initiate a Project Inquiry"
                    />
                  </Field>

                  <Field
                    label="Inquiry Subtitle"
                    warning={
                      hasOldWording(editSettings.booking_subtitle)
                        ? "Contains old wording"
                        : undefined
                    }
                  >
                    <TextInput
                      value={editSettings.booking_subtitle || ""}
                      onChange={(e) => onSettingChange("booking_subtitle", e.target.value)}
                      placeholder="Direct executive briefing with the studio director"
                    />
                  </Field>
                </div>
              </SectionAccordion>
            </div>

            {/* 06: Social & Direct Outreach */}
            <div id="settings-sec-06">
              <SectionAccordion
                id="06"
                number="06"
                title="Social & Direct Outreach"
                summary="Official studio email, director WhatsApp (+91 9958194155), and channels"
                isOpen={openSections.includes("06")}
                onToggle={() => toggleSection("06")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Official Studio Email">
                    <TextInput
                      value={editSettings.contact_email || ""}
                      onChange={(e) => onSettingChange("contact_email", e.target.value)}
                      placeholder="studio@thechantingstudio.in"
                    />
                  </Field>

                  <Field label="Director WhatsApp Contact">
                    <TextInput
                      value={editSettings.whatsapp_number || ""}
                      onChange={(e) => onSettingChange("whatsapp_number", e.target.value)}
                      placeholder="+919958194155"
                    />
                  </Field>

                  <Field label="Instagram URL">
                    <TextInput
                      value={editSettings.instagram_url || ""}
                      onChange={(e) => onSettingChange("instagram_url", e.target.value)}
                      placeholder="https://instagram.com/thechantingstudio"
                    />
                  </Field>

                  <Field label="LinkedIn URL">
                    <TextInput
                      value={editSettings.linkedin_url || ""}
                      onChange={(e) => onSettingChange("linkedin_url", e.target.value)}
                      placeholder="https://linkedin.com/company/thechantingstudio"
                    />
                  </Field>

                  <Field label="YouTube URL">
                    <TextInput
                      value={editSettings.youtube_url || ""}
                      onChange={(e) => onSettingChange("youtube_url", e.target.value)}
                      placeholder="https://youtube.com/@thechantingstudio"
                    />
                  </Field>

                  <Field label="Vimeo URL">
                    <TextInput
                      value={editSettings.vimeo_url || ""}
                      onChange={(e) => onSettingChange("vimeo_url", e.target.value)}
                      placeholder="https://vimeo.com/thechantingstudio"
                    />
                  </Field>
                </div>
              </SectionAccordion>
            </div>

            {/* 07: Global Footer, Legal & SEO */}
            <div id="settings-sec-07">
              <SectionAccordion
                id="07"
                number="07"
                title="Global Footer, Legal & SEO"
                summary="Copyright, meta description, studio location, and legal links"
                isOpen={openSections.includes("07")}
                onToggle={() => toggleSection("07")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Studio Location">
                    <TextInput
                      value={editSettings.studio_location || ""}
                      onChange={(e) => onSettingChange("studio_location", e.target.value)}
                      placeholder="New Delhi, India"
                    />
                  </Field>

                  <Field label="Copyright Statement">
                    <TextInput
                      value={editSettings.copyright_text || ""}
                      onChange={(e) => onSettingChange("copyright_text", e.target.value)}
                      placeholder="© 2026 THE CHANTING STUDIO. ALL RIGHTS RESERVED."
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Global Meta Description (SEO)">
                      <TextArea
                        value={editSettings.meta_description || ""}
                        onChange={(e) => onSettingChange("meta_description", e.target.value)}
                        placeholder="The Chanting Studio is a premier AI-native cinematic production studio in Delhi..."
                      />
                    </Field>
                  </div>
                </div>
              </SectionAccordion>
            </div>
          </div>
        </Panel>
      </div>

      {/* Sticky Action Bar */}
      {hasUnsaved && (
        <StickyActionBar
          floating
          summaries={[
            {
              label: "Local draft",
              value: <span className="text-[var(--a-accent)]">Unsaved changes</span>,
            },
            {
              label: "Sync target",
              value: "thechantingstudio.in",
            },
          ]}
          actions={
            <div className="flex items-center gap-3">
              <IconButton
                label="Undo"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo className="w-5 h-5" />
              </IconButton>

              <IconButton
                label="Redo"
                disabled={!canRedo}
                onClick={onRedo}
              >
                <Redo className="w-5 h-5" />
              </IconButton>

              <Button
                variant="accent"
                loading={isSaving}
                onClick={onSave}
                icon={<Save className="w-4 h-4" />}
              >
                {isSaving ? "Publishing..." : "Publish changes"}
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
};
