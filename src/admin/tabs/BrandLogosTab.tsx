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
import { Plus, Trash2, GripVertical, Image as ImageIcon } from "lucide-react";

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
                { id: "grid", label: "Grid view" },
                { id: "list", label: "List view" },
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
        title={`Client Partners (${brandLogos.filter((l) => l.is_active).length} visible on site)`}
      >
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2"
              : "space-y-3 pt-2"
          }
        >
          {/* Dashed Add Logo Card First */}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="rounded-[1.25rem] border-2 border-dashed border-[var(--a-line-strong)] hover:border-[var(--a-accent)]/60 bg-[var(--a-surface-2)]/40 hover:bg-[var(--a-surface-2)] p-6 flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer min-h-[160px] group"
          >
            <div className="w-12 h-12 rounded-full bg-[var(--a-surface-2)] group-hover:bg-[var(--a-accent-soft)] text-[var(--a-text)] group-hover:text-[var(--a-accent)] flex items-center justify-center transition-colors">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-admin-label text-[var(--a-text)] font-semibold">
                Add partner logo
              </p>
              <p className="text-admin-meta text-[var(--a-text-3)] mt-0.5">
                PNG or SVG with transparent background
              </p>
            </div>
          </button>

          {/* Logo Cards */}
          {brandLogos.map((logo) => {
            return (
              <Card
                key={logo.id}
                className="flex flex-col justify-between gap-4 p-5"
              >
                <div>
                  {/* Off-white Chip container for logo display */}
                  <div className="w-full h-24 rounded-2xl bg-[var(--a-inverse)] flex items-center justify-center p-3 mb-4 shadow-sm overflow-hidden">
                    {logo.logo_url ? (
                      <img
                        src={logo.logo_url}
                        alt={logo.name}
                        className="max-h-16 w-auto max-w-full object-contain filter drop-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-[var(--a-inverse-text)]/40" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-admin-body-lg text-[var(--a-text)] font-semibold truncate">
                      {logo.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--a-line)]">
                  <Toggle
                    checked={logo.is_active}
                    onChange={(checked) =>
                      onUpdateLogo(logo.id, { is_active: checked })
                    }
                    label={logo.is_active ? "Visible" : "Hidden"}
                  />

                  <button
                    type="button"
                    onClick={() => onDeleteLogo(logo.id)}
                    aria-label={`Delete ${logo.name}`}
                    className="p-2 rounded-full text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
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
