import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Panel } from "../ui/Panel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { TextInput } from "../ui/TextInput";
import { MediaField } from "../ui/MediaField";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Toggle";
import { SegmentedPills } from "../ui/SegmentedPills";
import { BrandLogo, MediaAsset } from "../../context/SiteDataContext";
import { Plus, Trash2, Image as ImageIcon, Search, Sparkles } from "lucide-react";
import { logoFilter, useLogoTone, type LogoDisplayMode } from "../../lib/logoTone";

const SITE_BG = "#0B0B0D"; // the website's dark background — previews match what visitors see

/** Logo rendered exactly as the website will show it. */
const SiteLogo: React.FC<{ logo: BrandLogo; className?: string }> = ({ logo, className = "" }) => {
  const tone = useLogoTone(logo.display_mode === "original" ? null : logo.url);
  const lighten = logoFilter(logo.display_mode, tone);
  if (!logo.url) return <ImageIcon className="w-7 h-7 text-white/40" />;
  return (
    <img
      src={logo.url}
      alt={logo.name}
      loading="lazy"
      className={`object-contain select-none ${className}`}
      style={{ filter: lighten || (logo.display_mode === "original" ? undefined : "grayscale(1) brightness(1.5) contrast(1.25)") }}
    />
  );
};

const ToneNote: React.FC<{ logo: BrandLogo }> = ({ logo }) => {
  const tone = useLogoTone(logo.url);
  const mode = logo.display_mode || "auto";
  const text =
    mode === "light" ? "Always shown light" : mode === "original" ? "Original colours" : tone === "dark" ? "Dark logo → shown light" : tone === "light" ? "Reads well on dark" : "Checking…";
  return (
    <span className={`inline-flex items-center gap-1 text-admin-meta ${mode === "auto" && tone === "dark" ? "text-[var(--a-accent)]" : "text-[var(--a-text-3)]"}`}>
      {mode === "auto" && tone === "dark" && <Sparkles className="w-3 h-3" />} {text}
    </span>
  );
};

const ModePicker: React.FC<{ value?: LogoDisplayMode; onChange: (m: LogoDisplayMode) => void }> = ({ value = "auto", onChange }) => (
  <div className="inline-flex p-0.5 rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)]" role="radiogroup" aria-label="How the logo is shown on the website">
    {(["auto", "original", "light"] as LogoDisplayMode[]).map((m) => (
      <button
        key={m}
        type="button"
        role="radio"
        aria-checked={value === m}
        onClick={() => onChange(m)}
        className={`px-2.5 h-7 rounded-full text-[11px] font-semibold capitalize transition-colors ${value === m ? "bg-[var(--a-inverse)] text-[var(--a-inverse-text)]" : "text-[var(--a-text-2)] hover:text-[var(--a-text)]"}`}
      >
        {m}
      </button>
    ))}
  </div>
);

export interface BrandLogosTabProps {
  brandLogos: BrandLogo[];
  onAddLogo: (name: string, logoUrl: string) => Promise<any>;
  onUpdateLogo: (id: string, updates: Partial<BrandLogo>) => Promise<any>;
  onDeleteLogo: (id: string) => Promise<boolean>;
  mediaAssets: MediaAsset[];
  onOpenUpload: () => void;
}

export const BrandLogosTab: React.FC<BrandLogosTabProps> = ({
  brandLogos,
  onAddLogo,
  onUpdateLogo,
  onDeleteLogo,
  mediaAssets,
  onOpenUpload,
}) => {
  const [viewMode, setViewMode] = useState("grid");
  const [query, setQuery] = useState("");
  const visibleCount = brandLogos.filter((l) => l.is_visible !== false).length;
  const shown = brandLogos.filter((l) => !query.trim() || l.name.toLowerCase().includes(query.trim().toLowerCase()));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingLogo, setEditingLogo] = useState<BrandLogo | null>(null);

  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;

    setIsSubmitting(true);
    await onAddLogo(newName.trim(), newUrl.trim());
    setNewName("");
    setNewUrl("");
    setIsSubmitting(false);
    setAddModalOpen(false);
  };

  const imageOptions = [
    { value: "", label: "Select from Global Assets Library..." },
    ...mediaAssets
      .filter((a) => a.type === "image" || !a.type)
      .map((a) => ({
        value: a.url,
        label: a.name,
        meta: "Global Asset",
        previewUrl: a.url,
      })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CLIENT ROSTER & SOCIAL PROOF"
        title="Brand Logos Marquee"
        actions={
          <div className="flex items-center gap-3">
            <SegmentedPills
              options={[
                { id: "grid", label: "Grid" },
                { id: "list", label: "List" },
                { id: "preview", label: "Marquee preview" },
              ]}
              activeId={viewMode}
              onChange={setViewMode}
            />

            <Button
              variant="accent"
              onClick={() => setAddModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add partner logo
            </Button>
          </div>
        }
      />

      <Panel
        eyebrow="ACTIVE MARQUEE SEQUENCE"
        title={`Client Partners (${visibleCount} of ${brandLogos.length} visible on site)`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4">
          <div className="flex items-center gap-2 h-10 px-4 rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--a-text-3)] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brands…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[var(--a-text)]"
              aria-label="Search brands"
            />
          </div>
          <p className="text-admin-meta text-[var(--a-text-3)]">
            Previews show exactly how logos appear on the site’s dark background. Auto lightens dark logos.
          </p>
        </div>

        {viewMode === "preview" ? (
          <div className="rounded-[1.25rem] overflow-hidden border border-[var(--a-line)]" style={{ background: SITE_BG }}>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 pt-6">Trusted by</p>
            <div className="relative overflow-hidden py-6">
              <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, ${SITE_BG}, transparent)` }} />
              <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none" style={{ background: `linear-gradient(to left, ${SITE_BG}, transparent)` }} />
              <div className="tcs-marquee-track items-center gap-12" style={{ display: "flex", width: "max-content" }}>
                {[...shown, ...shown].filter((l) => l.is_visible !== false).map((logo, i) => (
                  <div key={`${logo.id}-${i}`} className="h-12 w-36 flex items-center justify-center px-2 opacity-80 shrink-0">
                    <SiteLogo logo={logo} className="max-h-8 max-w-full" />
                  </div>
                ))}
              </div>
            </div>
            {shown.some((l) => l.is_visible === false) && (
              <p className="text-center text-[11px] text-white/45 pb-5">Hidden logos are left out of this preview.</p>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="divide-y divide-[var(--a-line)] rounded-[1.25rem] border border-[var(--a-line)] overflow-hidden">
            {shown.map((logo) => (
              <div key={logo.id} className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 bg-[var(--a-surface-1)]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-24 h-12 rounded-xl flex items-center justify-center p-2 shrink-0" style={{ background: SITE_BG }}>
                    <SiteLogo logo={logo} className="max-h-8 max-w-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-admin-body font-semibold text-[var(--a-text)] truncate">{logo.name}</p>
                    <ToneNote logo={logo} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <ModePicker value={logo.display_mode} onChange={(m) => onUpdateLogo(logo.id, { display_mode: m })} />
                  <Toggle
                    checked={logo.is_visible !== false}
                    onChange={(checked) => onUpdateLogo(logo.id, { is_visible: checked })}
                    label={logo.is_visible !== false ? "Visible" : "Hidden"}
                  />
                  <button type="button" onClick={() => onDeleteLogo(logo.id)} aria-label={`Delete ${logo.name}`} className="p-2 rounded-full text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setAddModalOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-admin-label font-semibold text-[var(--a-accent)] bg-[var(--a-surface-1)] hover:bg-[var(--a-surface-2)]">
              <Plus className="w-4 h-4" /> Add partner logo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="rounded-[1.25rem] border-2 border-dashed border-[var(--a-line-strong)] hover:border-[var(--a-accent)]/60 bg-[var(--a-surface-2)]/40 hover:bg-[var(--a-surface-2)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer min-h-[160px] group"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--a-surface-2)] group-hover:bg-[var(--a-accent-soft)] text-[var(--a-text)] group-hover:text-[var(--a-accent)] flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-admin-label text-[var(--a-text)] font-semibold">Add partner logo</p>
                <p className="text-admin-meta text-[var(--a-text-3)] mt-0.5">PNG or SVG with transparent background · max 50 MB</p>
              </div>
            </button>

            {shown.map((logo) => (
              <Card key={logo.id} className={`flex flex-col justify-between gap-3 p-5 ${logo.is_visible === false ? "opacity-60" : ""}`}>
                <div>
                  <div className="w-full h-24 rounded-2xl flex items-center justify-center p-3 mb-3 overflow-hidden" style={{ background: SITE_BG }}>
                    <SiteLogo logo={logo} className="max-h-14 w-auto max-w-full" />
                  </div>
                  <p className="text-admin-body-lg text-[var(--a-text)] font-semibold truncate">{logo.name}</p>
                  <ToneNote logo={logo} />
                </div>
                <ModePicker value={logo.display_mode} onChange={(m) => onUpdateLogo(logo.id, { display_mode: m })} />
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--a-line)]">
                  <Toggle
                    checked={logo.is_visible !== false}
                    onChange={(checked) => onUpdateLogo(logo.id, { is_visible: checked })}
                    label={logo.is_visible !== false ? "Visible" : "Hidden"}
                  />
                  <button type="button" onClick={() => onDeleteLogo(logo.id)} aria-label={`Delete ${logo.name}`} className="p-2 rounded-full text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Panel>

      {/* Add Partner Logo Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Partner Brand Logo"
        description="Add a new brand to the homepage client ticker with high contrast rendering"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <Field label="Brand / Company Name">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Prestige, United Colors of Benetton"
              required
            />
          </Field>

          <Field label="Logo Image URL (SVG or High-Res PNG)">
            <MediaField
              value={newUrl}
              onChange={setNewUrl}
              placeholder="Paste direct logo CDN link"
            />
          </Field>

          <Field label="Or select from existing assets">
            <Select
              value={newUrl}
              onChange={setNewUrl}
              options={imageOptions}
              placeholder="Choose logo from library..."
            />
          </Field>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit" loading={isSubmitting}>
              Add to Marquee
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
