import React from "react";
import { useStudioOS } from "../StudioOSContext";
import { ConfidenceMeter } from "./ConfidenceMeter";

export type SplitKind = "task" | "promise" | "deadline" | "approval" | "payment";

export interface ReviewItem {
  key: string;
  checked: boolean;
  kind: SplitKind;
  title: string;
  due_date: string | null;
  project_id: string | null;
  who: string | null;
  confidence: number;
}

const KIND_META: Record<SplitKind, { label: string; bg: string; text: string }> = {
  task: { label: "Task", bg: "#E8F0FF", text: "#1D4FD8" },
  promise: { label: "Promise", bg: "#FFF3E0", text: "#9A4A00" },
  deadline: { label: "Deadline", bg: "#FFF1E6", text: "#C2410C" },
  approval: { label: "Approval", bg: "#E7F7EE", text: "#17663F" },
  payment: { label: "Payment", bg: "#F1F2F4", text: "#5F6672" },
};

export function toReviewItems(items: any[]): ReviewItem[] {
  return items.map((it, i) => ({
    key: `${i}-${it.title}`,
    checked: (it.confidence ?? 0.7) >= 0.55,
    kind: it.kind,
    title: it.title,
    due_date: it.due_date || null,
    project_id: it.project_id || null,
    who: it.who || null,
    confidence: it.confidence ?? 0.7,
  }));
}

export const SplitReviewList: React.FC<{ items: ReviewItem[]; onChange: (items: ReviewItem[]) => void }> = ({ items, onChange }) => {
  const { projects } = useStudioOS();
  const update = (key: string, patch: Partial<ReviewItem>) => onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const allChecked = items.length > 0 && items.every((i) => i.checked);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--sos-text-3)" }}>
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={allChecked} onChange={(e) => onChange(items.map((i) => ({ ...i, checked: e.target.checked })))} className="w-4 h-4 accent-[#5B3FE4]" />
          {items.filter((i) => i.checked).length} of {items.length} selected
        </label>
        <span>Approvals, deadlines &amp; payments go to Inbox for a final check.</span>
      </div>
      <div className="max-h-[46vh] overflow-y-auto space-y-2 pr-1">
        {items.map((it) => {
          const m = KIND_META[it.kind] || KIND_META.task;
          return (
            <div key={it.key} className="p-3 rounded-[16px] border space-y-2" style={{ borderColor: "var(--sos-border)", background: it.checked ? "var(--sos-surface)" : "var(--sos-surface-2)", opacity: it.checked ? 1 : 0.6 }}>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={it.checked} onChange={(e) => update(it.key, { checked: e.target.checked })} className="w-4 h-4 accent-[#5B3FE4] shrink-0" />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0" style={{ background: m.bg, color: m.text }}>
                  {m.label}
                </span>
                <input
                  value={it.title}
                  onChange={(e) => update(it.key, { title: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-medium"
                  style={{ color: "var(--sos-text-1)" }}
                />
                <ConfidenceMeter value={it.confidence} />
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <select
                  value={it.project_id || ""}
                  onChange={(e) => update(it.key, { project_id: e.target.value || null })}
                  className="h-8 px-2 rounded-[10px] border text-[12px] max-w-[220px]"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                >
                  <option value="">Internal</option>
                  {projects
                    .filter((p) => !["lost", "paid"].includes(p.status))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {p.code} · {p.title}
                      </option>
                    ))}
                </select>
                <input
                  type="date"
                  value={it.due_date || ""}
                  onChange={(e) => update(it.key, { due_date: e.target.value || null })}
                  className="h-8 px-2 rounded-[10px] border text-[12px] sos-tabular"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                />
                {it.who && (
                  <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
                    {it.who}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
