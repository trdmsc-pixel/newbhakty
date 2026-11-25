import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Clock, Folder, Loader2, Mic, Sparkles, Tag, Upload, UserCheck, Wand2, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { parseQuickAdd } from "../nlParser";
import { PriorityBadge, TaskStatusChip } from "./StatusChip";
import { studioApi } from "../api";
import { ReviewItem, SplitReviewList, toReviewItems } from "./SplitReviewList";

const isMultiItem = (text: string) => text.includes("\n") || text.trim().split(/\s+/).length > 24;

function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export const QuickAddModal: React.FC = () => {
  const {
    quickAddOpen,
    setQuickAddOpen,
    quickAddPrefill,
    projects,
    gates,
    clients,
    addTask,
    pushToast,
    reloadFromCloud,
    setWhatsAppImportOpen,
    supabaseSyncStatus,
  } = useStudioOS();
  const [input, setInput] = useState("");
  const [pinToNow, setPinToNow] = useState(false);
  const [multiText, setMultiText] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiReady = supabaseSyncStatus === "synced";

  const runSplit = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setAiBusy(true);
      try {
        const res = await studioApi<{ items: any[] }>("/api/studio-os/ai/parse", { body: { text } });
        setReviewItems(toReviewItems(res.items));
        if (!res.items.length) pushToast("Nothing actionable found — edit and try again.", "info");
      } catch (err: any) {
        pushToast(err?.message || "AI parsing is unavailable", "warn");
      } finally {
        setAiBusy(false);
      }
    },
    [pushToast]
  );

  useEffect(() => {
    if (quickAddOpen) {
      if (quickAddPrefill && isMultiItem(quickAddPrefill)) {
        setMultiText(quickAddPrefill);
        if (aiReady) runSplit(quickAddPrefill);
      } else if (quickAddPrefill) {
        setInput(quickAddPrefill);
      }
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setInput("");
      setPinToNow(false);
      setMultiText(null);
      setReviewItems(null);
      recognitionRef.current?.stop?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickAddOpen, quickAddPrefill]);

  // Hold-to-record voice capture (Web Speech API)
  const startListening = () => {
    const SR = getSpeechRecognition();
    if (!SR) {
      pushToast("Voice input isn't supported in this browser.", "warn");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.continuous = true;
    let transcript = "";
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += `${e.results[i][0].transcript} `;
      }
    };
    rec.onend = () => {
      setListening(false);
      const text = transcript.trim();
      if (!text) return;
      const words = text.split(/\s+/).length;
      if (words > 14 && aiReady) {
        setMultiText(text);
        runSplit(text);
      } else {
        setInput((prev) => (prev ? `${prev} ${text}` : text));
      }
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };
  const stopListening = () => recognitionRef.current?.stop?.();

  const importReviewed = async () => {
    const selected = (reviewItems || []).filter((i) => i.checked && i.title.trim());
    if (!selected.length) return;
    setAiBusy(true);
    try {
      const res = await studioApi<{ tasksCreated: number; suggestions: number }>("/api/studio-os/inbox/import", {
        body: { source: "manual", items: selected.map(({ kind, title, due_date, project_id, who, confidence }) => ({ kind, title, due_date, project_id, who, confidence })) },
      });
      pushToast(`Added ${res.tasksCreated} task(s)${res.suggestions ? ` · ${res.suggestions} in Inbox` : ""}`, "success");
      reloadFromCloud();
      setQuickAddOpen(false);
    } catch (err: any) {
      pushToast(err?.message || "Could not add tasks", "warn");
    } finally {
      setAiBusy(false);
    }
  };

  const parsed = useMemo(() => parseQuickAdd(input, projects, gates), [input, projects, gates]);

  if (!quickAddOpen) return null;

  const matchedProject =
    projects.find((p) => p.id === parsed.projectId) ||
    projects.find((p) => p.code === "INT") ||
    projects[0];
  const matchedClient = clients.find((c) => c.id === matchedProject?.client_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (multiText !== null) {
      if (reviewItems) importReviewed();
      else runSplit(multiText);
      return;
    }
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
        className="w-full md:max-w-2xl rounded-t-[28px] max-h-[92vh] overflow-y-auto md:rounded-[28px] p-5 md:p-6 shadow-2xl border"
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
                One line, or paste a whole message · hold 🎙 to talk · tokens: #ARC · Mon 30 Nov · 4h · !urgent · @client
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
          {multiText === null ? (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (isMultiItem(pasted)) {
                    e.preventDefault();
                    setMultiText(pasted);
                  }
                }}
                placeholder="e.g. Arculus USB version first draft Mon 30 Nov 4h #ARC !urgent @client"
                className="w-full pl-4 pr-14 py-3.5 text-[15px] rounded-[16px] border outline-none"
                style={{
                  background: "var(--sos-surface-2)",
                  borderColor: "var(--sos-border)",
                  color: "var(--sos-text-1)",
                }}
              />
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  startListening();
                }}
                onPointerUp={stopListening}
                onPointerLeave={() => listening && stopListening()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center select-none touch-none"
                style={{
                  background: listening ? "var(--sos-primary)" : "var(--sos-surface)",
                  color: listening ? "#fff" : "var(--sos-text-2)",
                }}
                aria-label="Hold to record"
                title="Hold to talk"
              >
                <Mic className={`w-4 h-4 ${listening ? "animate-pulse" : ""}`} />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {!reviewItems && (
                <textarea
                  value={multiText}
                  onChange={(e) => setMultiText(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 text-[14px] rounded-[16px] border outline-none resize-none"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
              )}
              {aiBusy && !reviewItems && (
                <p className="text-[13px] flex items-center gap-2" style={{ color: "var(--sos-text-3)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Splitting into tasks…
                </p>
              )}
              {reviewItems && <SplitReviewList items={reviewItems} onChange={setReviewItems} />}
              <button
                type="button"
                onClick={() => {
                  setMultiText(null);
                  setReviewItems(null);
                }}
                className="text-[12px] underline-offset-2 hover:underline"
                style={{ color: "var(--sos-text-3)" }}
              >
                Back to single line
              </button>
            </div>
          )}

          {/* Live Parsed Preview Chips */}
          {multiText === null && input.trim() && (
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {multiText === null ? (
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-2 text-[13px] cursor-pointer select-none" style={{ color: "var(--sos-text-2)" }}>
                  <input
                    type="checkbox"
                    checked={pinToNow}
                    onChange={(e) => setPinToNow(e.target.checked)}
                    className="w-4 h-4 accent-[#5B3FE4] rounded"
                  />
                  Add directly to Today&apos;s Now (max 3)
                </label>
                <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                  <button type="button" onClick={() => setMultiText(input)} className="inline-flex items-center gap-1 hover:underline">
                    <Wand2 className="w-3.5 h-3.5" /> Paste a message
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickAddOpen(false);
                      setWhatsAppImportOpen(true);
                    }}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <Upload className="w-3.5 h-3.5" /> WhatsApp .txt
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                {reviewItems ? "Review, untick anything wrong, then add." : "AI will split this into separate tasks."}
              </span>
            )}

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
                disabled={multiText === null ? !input.trim() : aiBusy || !multiText.trim() || !aiReady || (reviewItems !== null && !reviewItems.some((i) => i.checked))}
                className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white disabled:opacity-45 inline-flex items-center gap-2"
                style={{ background: "var(--sos-primary)" }}
              >
                {aiBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {multiText === null ? "Add Task" : reviewItems ? `Add ${reviewItems.filter((i) => i.checked).length} selected` : "Split with AI"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
