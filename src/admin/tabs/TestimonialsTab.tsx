import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Panel } from "../ui/Panel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Drawer } from "../ui/Drawer";
import { Field } from "../ui/Field";
import { TextInput, TextArea } from "../ui/TextInput";
import { MediaField } from "../ui/MediaField";
import { Toggle } from "../ui/Toggle";
import { Testimonial, MediaAsset } from "../../context/SiteDataContext";
import { Plus, Trash2, Edit2, Star, User } from "lucide-react";

export interface TestimonialsTabProps {
  testimonials: Testimonial[];
  onAddTestimonial: (t: Partial<Testimonial>) => Promise<any>;
  onUpdateTestimonial: (id: string, updates: Partial<Testimonial>) => Promise<any>;
  onDeleteTestimonial: (id: string) => Promise<boolean>;
  mediaAssets: MediaAsset[];
  onOpenUpload: () => void;
}

export const TestimonialsTab: React.FC<TestimonialsTabProps> = ({
  testimonials,
  onAddTestimonial,
  onUpdateTestimonial,
  onDeleteTestimonial,
  mediaAssets,
  onOpenUpload,
}) => {
  const [editingItem, setEditingItem] = useState<Partial<Testimonial> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenAdd = () => {
    setEditingItem({
      client_name: "",
      company: "",
      quote: "",
      avatar_url: "",
      rating: 5,
      is_active: true,
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (t: Testimonial) => {
    setEditingItem(t);
    setIsDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.client_name || !editingItem?.quote) return;

    setIsSaving(true);
    if (editingItem.id) {
      await onUpdateTestimonial(editingItem.id, editingItem);
    } else {
      await onAddTestimonial(editingItem);
    }
    setIsSaving(false);
    setIsDrawerOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CLIENT REVIEWS & ENDORSEMENTS"
        title="Testimonials & Accolades"
        actions={
          <Button
            variant="accent"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
          >
            Add testimonial
          </Button>
        }
      />

      <Panel
        eyebrow="CURATED PRAISE"
        title={`Executive Feedback (${testimonials.filter((t) => t.is_active).length} visible)`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {testimonials.map((t) => (
            <Card
              key={t.id}
              className="flex flex-col justify-between gap-6 p-6 sm:p-7 relative group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-[var(--a-accent)]">
                    {Array.from({ length: t.rating || 5 }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-current" />
                    ))}
                  </div>

                  <Toggle
                    checked={t.is_active}
                    onChange={(checked) =>
                      onUpdateTestimonial(t.id, { is_active: checked })
                    }
                    label={t.is_active ? "Visible" : "Hidden"}
                  />
                </div>

                <blockquote className="text-admin-body-lg text-[var(--a-text)] leading-relaxed italic">
                  "{t.quote}"
                </blockquote>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4 border-t border-[var(--a-line)]">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--a-surface-3)] border border-[var(--a-line)] shrink-0 flex items-center justify-center">
                    {t.avatar_url ? (
                      <img
                        src={t.avatar_url}
                        alt={t.client_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-6 h-6 text-[var(--a-text-3)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-admin-label font-semibold text-[var(--a-text)] truncate">
                      {t.client_name}
                    </p>
                    <p className="text-admin-meta text-[var(--a-text-3)] truncate">
                      {t.company || "Executive Partner"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(t)}
                    aria-label="Edit testimonial"
                    className="p-2.5 rounded-full bg-[var(--a-surface-2)] hover:bg-[var(--a-surface-3)] text-[var(--a-text)] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteTestimonial(t.id)}
                    aria-label="Delete testimonial"
                    className="p-2.5 rounded-full bg-red-500/10 hover:bg-[var(--a-danger-bg)] text-[var(--a-danger-text)] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Panel>

      {/* Drawer Editor */}
      <Drawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingItem?.id ? "Edit Testimonial" : "Add Testimonial"}
        description="Share executive endorsement quotes from client partners"
      >
        {editingItem && (
          <form onSubmit={handleSave} className="space-y-6">
            <Field label="Client / Executive Name">
              <TextInput
                value={editingItem.client_name || ""}
                onChange={(e) =>
                  setEditingItem((prev) => ({ ...prev, client_name: e.target.value }))
                }
                placeholder="e.g. Elena Rostova"
                required
              />
            </Field>

            <Field label="Company / Role Title">
              <TextInput
                value={editingItem.company || ""}
                onChange={(e) =>
                  setEditingItem((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="e.g. Chief Marketing Officer, Prestige"
              />
            </Field>

            <Field label="Endorsement Quote" ai={{ field: "Client testimonial quote (polish grammar and flow only — keep the client's meaning and claims)", value: editingItem.quote || "", onApply: (t) => setEditingItem((prev) => ({ ...prev, quote: t })), context: `${editingItem.client_name || ""}, ${editingItem.company || ""}`, maxChars: 280 }}>
              <TextArea
                value={editingItem.quote || ""}
                onChange={(e) =>
                  setEditingItem((prev) => ({ ...prev, quote: e.target.value }))
                }
                placeholder="The synthetic precision and world-building calibre achieved by The Chanting Studio exceeded our expectations..."
                required
              />
            </Field>

            <Field label="Avatar Photo URL">
              <MediaField
                type="image"
                value={editingItem.avatar_url || ""}
                onChange={(url) =>
                  setEditingItem((prev) => ({ ...prev, avatar_url: url }))
                }
                placeholder="Direct headshot image URL"
              />
            </Field>

            <Field label="Star Rating (1-5)">
              <TextInput
                type="number"
                min="1"
                max="5"
                value={editingItem.rating || 5}
                onChange={(e) =>
                  setEditingItem((prev) => ({
                    ...prev,
                    rating: parseInt(e.target.value, 10) || 5,
                  }))
                }
              />
            </Field>

            <div className="pt-4 flex justify-end gap-3">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="accent" type="submit" loading={isSaving}>
                Save endorsement
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
};
