import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { Panel } from "../ui/Panel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { TextInput } from "../ui/TextInput";
import { Toggle } from "../ui/Toggle";
import { Chip } from "../ui/Chip";
import { Wordmark } from "../../components/brand/Wordmark";
import { NavigationMenuItem } from "../../context/SiteDataContext";
import { Plus, Trash2, ArrowUp, ArrowDown, Compass } from "lucide-react";

export interface NavigationTabProps {
  navItems: NavigationMenuItem[];
  onAddItem: (item: Partial<NavigationMenuItem>) => Promise<any>;
  onUpdateItem: (id: string, updates: Partial<NavigationMenuItem>) => Promise<any>;
  onDeleteItem: (id: string) => Promise<boolean>;
  onReorder: (newOrder: NavigationMenuItem[]) => Promise<any>;
}

export const NavigationTab: React.FC<NavigationTabProps> = ({
  navItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorder,
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newHref, setNewHref] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newHref.trim()) return;

    await onAddItem({
      label: newLabel.trim(),
      target_url: newHref.trim(),
      is_visible: true,
      order_index: navItems.length + 1,
    });

    setNewLabel("");
    setNewHref("");
    setAddModalOpen(false);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= navItems.length) return;

    const copy = [...navItems];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);

    const reordered = copy.map((item, idx) => ({
      ...item,
      order_index: idx + 1,
    }));

    await onReorder(reordered);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="HEADER ARCHITECTURE"
        title="Navigation Menu"
        actions={
          <Button
            variant="accent"
            onClick={() => setAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add nav link
          </Button>
        }
      />

      {/* Live Mini-Preview of Navbar at top */}
      <div className="rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line)] p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--a-line)] pb-4">
          <span className="text-admin-eyebrow text-[var(--a-accent)] font-mono">
            LIVE NAVBAR SIMULATION
          </span>
          <Chip status="live" dot label="Realtime" />
        </div>

        <div className="w-full h-16 rounded-full bg-[#0B0B0D] border border-white/10 px-6 flex items-center justify-between gap-4 shadow-inner overflow-hidden">
          <Wordmark capHeight={14} ringAnimation="spin-slow" />

          <div className="flex items-center gap-6 overflow-x-auto scrollbar-none py-1">
            {navItems
              .filter((n) => n.is_visible !== false)
              .map((item) => (
                <span
                  key={item.id}
                  className="text-admin-meta font-mono uppercase tracking-wider text-white/75 whitespace-nowrap"
                >
                  {item.label}
                </span>
              ))}
          </div>

          <div className="shrink-0 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-admin-meta font-mono text-xs text-white">
            Inquire
          </div>
        </div>
      </div>

      {/* Reorderable List of Nav Items */}
      <Panel
        eyebrow="LINK HIERARCHY"
        title={`Menu Links (${navItems.length})`}
      >
        <div className="space-y-3 pt-2">
          {navItems.map((item, idx) => (
            <Card
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, "up")}
                    aria-label="Move up"
                    className="p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === navItems.length - 1}
                    onClick={() => handleMove(idx, "down")}
                    aria-label="Move down"
                    className="p-1 rounded-full text-[var(--a-text-3)] hover:text-[var(--a-text)] disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-admin-body-lg font-semibold text-[var(--a-text)] truncate">
                      {item.label}
                    </span>
                    <Chip status="draft" label={item.target_url} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--a-line)]">
                <Toggle
                  checked={item.is_visible !== false}
                  onChange={(checked) =>
                    onUpdateItem(item.id, { is_visible: checked })
                  }
                  label={item.is_visible !== false ? "Visible" : "Hidden"}
                />

                <button
                  type="button"
                  onClick={() => onDeleteItem(item.id)}
                  aria-label="Delete link"
                  className="p-2 rounded-full text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Panel>

      {/* Add Nav Item Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Navigation Item"
        description="Configure menu label and page anchor link (e.g. #work, #capabilities)"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <Field label="Navigation Label">
            <TextInput
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Selected Work, Capabilities, Studio"
              required
            />
          </Field>

          <Field label="Anchor Link / URL">
            <TextInput
              value={newHref}
              onChange={(e) => setNewHref(e.target.value)}
              placeholder="e.g. #work, #reel, #capabilities, #contact"
              required
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
            <Button variant="accent" type="submit">
              Add Nav Item
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
