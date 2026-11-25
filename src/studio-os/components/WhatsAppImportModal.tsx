import React, { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { useInbox } from "../InboxContext";
import { studioApi } from "../api";
import { parseWhatsAppExport, waToPrompt } from "../whatsappParser";
import { ReviewItem, SplitReviewList, toReviewItems } from "./SplitReviewList";

export const WhatsAppImportModal: React.FC = () => {
  const { whatsAppImportOpen, setWhatsAppImportOpen, pushToast, reloadFromCloud } = useStudioOS();
  const { refresh } = useInbox();
  const [fileName, setFileName] = useState("");
  const [stats, setStats] = useState<{ messages: number; people: string[] } | null>(null);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!whatsAppImportOpen) return null;

  const close = () => {
    setWhatsAppImportOpen(false);
    setItems(null);
    setStats(null);
    setFileName("");
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    setItems(null);
    const text = await file.text();
    const messages = parseWhatsAppExport(text);
    if (!messages.length) {
      pushToast("That doesn't look like a WhatsApp export (.txt).", "warn");
      return;
    }
    setStats({ messages: messages.length, people: [...new Set(messages.map((m) => m.author))].slice(0, 6) });
    setBusy(true);
    try {
      const res = await studioApi<{ items: any[] }>("/api/studio-os/ai/parse", { body: { text: waToPrompt(messages) } });
      setItems(toReviewItems(res.items));
      if (!res.items.length) pushToast("No tasks, promises or approvals found.", "info");
    } catch (err: any) {
      pushToast(err?.message || "AI parsing failed", "warn");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    const selected = (items || []).filter((i) => i.checked && i.title.trim());
    if (!selected.length) return;
    setBusy(true);
    try {
      const res = await studioApi<{ tasksCreated: number; suggestions: number }>("/api/studio-os/inbox/import", {
        body: { source: "whatsapp", items: selected.map(({ kind, title, due_date, project_id, who, confidence }) => ({ kind, title, due_date, project_id, who, confidence })) },
      });
      pushToast(`Added ${res.tasksCreated} task(s)${res.suggestions ? ` · ${res.suggestions} in Inbox to confirm` : ""}`, "success");
      reloadFromCloud();
      refresh();
      close();
    } catch (err: any) {
      pushToast(err?.message || "Import failed", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4" onClick={close}>
      <div
        className="w-full md:max-w-2xl rounded-t-[28px] md:rounded-[28px] p-5 md:p-6 shadow-2xl border space-y-4"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Import WhatsApp chat
            </h3>
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              In WhatsApp: chat → ⋮ → More → Export chat → Without media. Upload the .txt here.
            </p>
          </div>
          <button type="button" onClick={close} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full p-5 rounded-[18px] border border-dashed flex items-center justify-center gap-3 text-[13px]"
          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface-2)" }}
        >
          {fileName ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
          {fileName ? `${fileName}${stats ? ` · ${stats.messages} messages · ${stats.people.join(", ")}` : ""}` : "Choose WhatsApp export (.txt)"}
        </button>

        {busy && !items && (
          <div className="flex items-center justify-center gap-2 py-6 text-[13px]" style={{ color: "var(--sos-text-3)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Reading the chat…
          </div>
        )}

        {items && items.length > 0 && <SplitReviewList items={items} onChange={setItems} />}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={close} className="sos-pill-btn px-4 h-11 text-[14px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !items?.some((i) => i.checked)}
            onClick={doImport}
            className="sos-pill-btn px-5 h-11 text-[14px] font-semibold text-white disabled:opacity-45 inline-flex items-center gap-2"
            style={{ background: "var(--sos-primary)" }}
          >
            {busy && items && <Loader2 className="w-4 h-4 animate-spin" />} Import selected
          </button>
        </div>
      </div>
    </div>
  );
};
