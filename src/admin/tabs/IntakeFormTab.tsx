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
import { SelectableCardGroup } from "../ui/SelectableCardGroup";
import { Plus, Trash2, GripVertical, CheckCircle2, Send, Sparkles } from "lucide-react";

export interface IntakeFormField {
  id: string;
  label: string;
  field_type: "text" | "email" | "select" | "textarea" | "budget";
  placeholder?: string;
  is_required: boolean;
  options?: string[];
  order_index?: number;
}

export interface IntakeFormTabProps {
  fields: IntakeFormField[];
  onAddField: (f: Partial<IntakeFormField>) => Promise<any>;
  onUpdateField: (id: string, updates: Partial<IntakeFormField>) => Promise<any>;
  onDeleteField: (id: string) => Promise<boolean>;
}

export const IntakeFormTab: React.FC<IntakeFormTabProps> = ({
  fields,
  onAddField,
  onUpdateField,
  onDeleteField,
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<string>("text");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [newOptionsText, setNewOptionsText] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const options =
      newType === "select" || newType === "budget"
        ? newOptionsText
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    await onAddField({
      label: newLabel.trim(),
      field_type: newType as any,
      placeholder: newPlaceholder.trim(),
      is_required: newRequired,
      options,
    });

    setNewLabel("");
    setNewPlaceholder("");
    setNewOptionsText("");
    setAddModalOpen(false);
  };

  const fieldTypes = [
    { id: "text", caption: "Standard Input", title: "Single-line Text" },
    { id: "email", caption: "Validated Input", title: "Email Address" },
    { id: "textarea", caption: "Multi-line Area", title: "Detailed Brief" },
    { id: "select", caption: "Dropdown Select", title: "Option Choices" },
    { id: "budget", caption: "Tier Selector", title: "Budget Tiers" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CLIENT QUALIFICATION PIPELINE"
        title="Inquiry Form Builder"
        actions={
          <Button
            variant="accent"
            onClick={() => setAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Add question / field
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Fields List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Panel
            eyebrow="ACTIVE INTAKE SEQUENCE"
            title={`Configured Fields (${fields.length})`}
          >
            <div className="space-y-4 pt-2">
              {fields.map((f, idx) => (
                <Card
                  key={f.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] font-mono text-xs font-bold text-[var(--a-text-2)] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-admin-label font-semibold text-[var(--a-text)] truncate">
                          {f.label}
                        </span>
                        <Chip status="draft" label={f.field_type.toUpperCase()} />
                        {f.is_required && (
                          <span className="text-admin-meta text-[var(--a-accent)] text-xs font-mono font-bold">
                            *Required
                          </span>
                        )}
                      </div>
                      <p className="text-admin-meta text-[var(--a-text-3)] truncate">
                        Placeholder: "{f.placeholder || "None"}"
                      </p>
                      {f.options && f.options.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {f.options.map((opt, oIdx) => (
                            <span
                              key={oIdx}
                              className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[var(--a-surface-2)] text-[var(--a-text-2)]"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--a-line)]">
                    <Toggle
                      checked={f.is_required}
                      onChange={(checked) =>
                        onUpdateField(f.id, { is_required: checked })
                      }
                      label="Required"
                    />

                    <button
                      type="button"
                      onClick={() => onDeleteField(f.id)}
                      aria-label="Delete field"
                      className="p-2 rounded-full text-[var(--a-danger-text)] hover:bg-[var(--a-danger-bg)] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right Column: Live Form Interactive Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-[1.75rem] bg-[var(--a-surface-2)] border-2 border-[var(--a-line-strong)] p-6 sm:p-8 shadow-admin-floating space-y-6">
            <div className="border-b border-[var(--a-line)] pb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-admin-eyebrow text-[var(--a-accent)] font-mono">
                  LIVE WEBSITE PREVIEW
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="text-admin-h2 text-[var(--a-text)] font-semibold tracking-tight mt-1">
                Initiate a Project Inquiry
              </h3>
              <p className="text-admin-meta text-[var(--a-text-2)] mt-1">
                Direct executive brief with the studio director
              </p>
            </div>

            <div className="space-y-4">
              {fields.map((f) => (
                <div key={f.id} className="space-y-1.5">
                  <label className="block text-admin-label text-[var(--a-text-2)] font-medium">
                    {f.label}{" "}
                    {f.is_required && <span className="text-[var(--a-accent)]">*</span>}
                  </label>
                  {f.field_type === "textarea" ? (
                    <div className="h-20 rounded-2xl bg-[var(--a-surface-2)] border border-[var(--a-line)] p-3 text-admin-meta text-[var(--a-text-3)]">
                      {f.placeholder || "Enter brief details..."}
                    </div>
                  ) : f.field_type === "budget" || f.field_type === "select" ? (
                    <div className="h-12 rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] px-4 flex items-center justify-between text-admin-meta text-[var(--a-text-3)]">
                      <span>{f.placeholder || "Select option..."}</span>
                      <span>▾</span>
                    </div>
                  ) : (
                    <div className="h-12 rounded-full bg-[var(--a-surface-2)] border border-[var(--a-line)] px-4 flex items-center text-admin-meta text-[var(--a-text-3)]">
                      {f.placeholder || "Enter value..."}
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-2">
                <div className="w-full h-12 rounded-full bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] text-white font-semibold flex items-center justify-center gap-2 shadow-md">
                  <span>Send Project Inquiry</span>
                  <Send className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Field Dialog */}
      <Dialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Form Question / Field"
        description="Choose a question type and configure requirements"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <Field label="Choose Field Type">
            <SelectableCardGroup
              items={fieldTypes}
              selectedId={newType}
              onSelect={setNewType}
            />
          </Field>

          <Field label="Question / Label Text">
            <TextInput
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Brand Name, Production Scope, Project Budget"
              required
            />
          </Field>

          <Field label="Input Placeholder Text">
            <TextInput
              value={newPlaceholder}
              onChange={(e) => setNewPlaceholder(e.target.value)}
              placeholder="e.g. Elena Rostova / Prestige"
            />
          </Field>

          {(newType === "select" || newType === "budget") && (
            <Field
              label="Option Choices (comma separated)"
              help="Enter choices separated by commas"
            >
              <TextInput
                value={newOptionsText}
                onChange={(e) => setNewOptionsText(e.target.value)}
                placeholder="₹15L–₹30L, ₹30L–₹60L, Flagship ₹1Cr+"
              />
            </Field>
          )}

          <div className="pt-2">
            <Toggle
              checked={newRequired}
              onChange={setNewRequired}
              label="This field is mandatory for submission"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit">
              Add Field
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
