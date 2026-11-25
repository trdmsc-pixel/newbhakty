import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Clock, Folder, Sparkles, Tag, UserCheck, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { parseQuickAdd } from "../nlParser";
import { PriorityBadge, TaskStatusChip } from "./StatusChip";

export const QuickAddModal: React.FC = () => {
  const { quickAddOpen, setQuickAddOpen, projects, gates, clients, addTask } = useStudioOS();
  const [input, setInput] = useState("");
  const [pinToNow, setPinToNow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickAddOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setInput("");
      setPinToNow(false);
    }
  }, [quickAddOpen]);

  const parsed = useMemo(() => parseQuickAdd(input, projects, gates), [input, projects, gates]);

  if (!quickAddOpen) return null;

  const matchedProject =
    projects.find((p) => p.id === parsed.projectId) ||
    projects.find((p) => p.code === "INT") ||
    projects[0];
  const matchedClient = clients.find((c) => c.id === matchedProject?.client_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    addTask({
      title: parsed.title,
      project_id: matchedProject.id,
      gate_id: parsed.gateId,
      type: parsed.type,
      status: parsed.status,
      priority: parsed.priority,
      do_date: parsed.dueDate,
      due_date: parsed.dueDate,
      estimate_hours: parsed.estimateHours,
      promised_to_name: parsed.promisedToClient ? matchedClient?.contacts[0]?.name || matchedClient?.name : undefined,
      waiting_on_name: parsed.waitingOnClient ? matchedClient?.contacts[0]?.name || matchedClient?.name : undefined,
      is_in_now: pinToNow,
    });
    setQuickAddOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4"
      onClick={() => setQuickAddOpen(false)}
    >
      <div
        className="w-full md:max-w-xl rounded-t-[28px] md:rounded-[28px] p-5 md:p-6 shadow-2xl border"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
            >
              <Sparkles className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Quick Add
              </h3>
              <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                One line — tokens: #ARC · Mon 30 Nov · 4h · !urgent · @client · &gt;waiting · g:storyboard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuickAddOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80"
            style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
            aria-label="Close Quick Add"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Arculus USB version first draft Mon 30 Nov 4h #ARC !urgent @client"
            className="w-full px-4 py-3.5 text-[15px] rounded-[16px] border outline-none"
            style={{
              background: "var(--sos-surface-2)",
              borderColor: "var(--sos-border)",
              color: "var(--sos-text-1)",
            }}
          />

          {/* Live Parsed Preview Chips */}
          {input.trim() && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
              >
                <Folder className="w-3.5 h-3.5" />
                {matchedProject?.emoji} {matchedProject?.code}
              </span>

              {parsed.dueLabel && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{ background: "#E8F0FF", color: "#2F6BFF" }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {parsed.dueLabel}
                </span>
              )}

              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium sos-tabular"
                style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
              >
                <Clock className="w-3.5 h-3.5" />
                {parsed.estimateHours}h
              </span>

              <TaskStatusChip status={parsed.status} compact />
              <PriorityBadge priority={parsed.priority} />

              {parsed.promisedToClient && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{ background: "#FFF3E0", color: "#C26A00" }}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Promise to {matchedClient?.contacts[0]?.name || matchedClient?.name}
                </span>
              )}

              {parsed.gateHint && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                  style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
                >
                  <Tag className="w-3.5 h-3.5" />
                  {parsed.gateHint}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer select-none" style={{ color: "var(--sos-text-2)" }}>
              <input
                type="checkbox"
                checked={pinToNow}
                onChange={(e) => setPinToNow(e.target.checked)}
                className="w-4 h-4 accent-[#5B3FE4] rounded"
              />
              Add directly to Today&apos;s Now (max 3)
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="sos-pill-btn px-4 h-11 text-[14px] font-medium border"
                style={{
                  background: "var(--sos-surface)",
                  borderColor: "var(--sos-border)",
                  color: "var(--sos-text-2)",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white disabled:opacity-45"
                style={{ background: "var(--sos-primary)" }}
              >
                Add Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
