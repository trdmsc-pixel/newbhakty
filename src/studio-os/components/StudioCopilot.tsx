/**
 * Studio OS Copilot — owner-only Gemini assistant.
 * Collapsed (top-bar trigger, ⌘/Ctrl+J) → docked drawer (420px, full sheet on
 * mobile) → focus mode (820px centered). Chat lives in sessionStorage only.
 * Attachments are ephemeral context: ≤3 MB inline for one request, larger
 * files stream browser → Gemini File API and are deleted after the turn.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, FileText, Loader2, Maximize2, Minimize2, Paperclip, Plus, Sparkles, Undo2, X } from "lucide-react";
import { studioApi } from "../api";
import { useStudioOS } from "../StudioOSContext";
import { useInbox } from "../InboxContext";
import { EASE } from "../motion";

type Mode = "closed" | "drawer" | "focus";

interface PlanAction {
  id: string;
  tool: string;
  args: any;
  title: string;
  lines: string[];
}
interface ActionResult {
  id: string;
  ok: boolean;
  message: string;
  undo?: any[];
}
interface Msg {
  id: string;
  role: "user" | "model";
  text: string;
  files?: string[];
  actions?: PlanAction[];
  plan?: { status: "pending" | "applying" | "applied" | "cancelled" | "undone"; selected: string[]; results?: ActionResult[] };
  error?: boolean;
}
type Attachment =
  | { id: string; kind: "inline"; name: string; mime: string; size: number; data: string }
  | { id: string; kind: "file"; name: string; mime: string; size: number; uri: string; file_name: string }
  | { id: string; kind: "uploading"; name: string; mime: string; size: number };

const STORE = "sos_copilot_chat_v1";
const INLINE_MAX = 3 * 1024 * 1024; // base64 inflates ~33%; Vercel caps request bodies at 4.5 MB
const FILE_MAX = 50 * 1024 * 1024;
const OPEN_EVENT = "sos:copilot-toggle";

const STARTERS = [
  "What should I focus on right now?",
  "Analyze late/at-risk projects",
  "Check unread important emails & draft replies",
  "Rebalance my next 7 days",
];

export function toggleCopilot() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const uid = () => (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2);

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};
function mimeOf(f: File) {
  if (f.type) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || "text/plain";
}
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function readBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });
}

// --- tiny safe markdown (no innerHTML) --------------------------------------
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`} style={{ color: "var(--sos-text-1)" }}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}-${i++}`} className="px-1 py-0.5 rounded text-[12px]" style={{ background: "var(--sos-surface-2)" }}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
const Markdown: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(
      <L key={`l${blocks.length}`} className={`${list.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-1`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>
        ))}
      </L>
    );
    list = null;
  };
  text.split("\n").forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const head = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || num) {
      const ordered = Boolean(num);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || num)![1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    if (head) blocks.push(<p key={idx} className="text-[13px] font-semibold pt-1" style={{ color: "var(--sos-text-1)" }}>{inline(head[1], `h${idx}`)}</p>);
    else blocks.push(<p key={idx}>{inline(line, `p${idx}`)}</p>);
  });
  flush();
  return <div className="space-y-2">{blocks}</div>;
};

// --- component ---------------------------------------------------------------
export const StudioCopilot: React.FC = () => {
  const { route, selectedProjectId, projects, reloadFromCloud, pushToast } = useStudioOS();
  const { refresh: refreshInbox } = useInbox();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("closed");
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<Attachment[]>([]);
  attachRef.current = attachments;

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-60)));
    } catch {
      /* storage full / private mode */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, busy, reduce]);

  // ⌘/Ctrl+J + top-bar trigger + Esc
  useEffect(() => {
    const toggle = () => setMode((m) => (m === "closed" ? "drawer" : "closed"));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setMode((m) => (m === "focus" ? "drawer" : m === "drawer" ? "closed" : m));
      }
    };
    window.addEventListener(OPEN_EVENT, toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (mode !== "closed") window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [mode]);

  // Never leave uploaded files behind on Gemini if the tab closes.
  useEffect(() => {
    const cleanup = () => {
      for (const a of attachRef.current) if (a.kind === "file") void deleteRemote(a.file_name);
    };
    window.addEventListener("pagehide", cleanup);
    return () => window.removeEventListener("pagehide", cleanup);
  }, []);

  const deleteRemote = (name: string) => studioApi("/api/studio-os/copilot/file", { method: "DELETE", body: { name } }).catch(() => null);

  const removeAttachment = (a: Attachment) => {
    if (a.kind === "file") void deleteRemote(a.file_name);
    setAttachments((list) => list.filter((x) => x.id !== a.id));
  };

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      if (f.size > FILE_MAX) {
        pushToast(`${f.name} is over 50 MB`, "warn");
        continue;
      }
      if (attachRef.current.length >= 6) {
        pushToast("Up to 6 files per message", "warn");
        break;
      }
      const id = uid();
      const mime = mimeOf(f);
      const inlineUsed = attachRef.current.reduce((s, a) => s + (a.kind === "inline" ? a.size : 0), 0);
      setAttachments((l) => [...l, { id, kind: "uploading", name: f.name, mime, size: f.size }]);
      try {
        if (f.size + inlineUsed <= INLINE_MAX) {
          const data = await readBase64(f);
          setAttachments((l) => l.map((a) => (a.id === id ? { id, kind: "inline", name: f.name, mime, size: f.size, data } : a)));
        } else {
          const { upload_url } = await studioApi<{ upload_url: string }>("/api/studio-os/copilot/upload-session", { body: { name: f.name, mime, size: f.size } });
          const up = await fetch(upload_url, { method: "POST", headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: f });
          const j: any = await up.json().catch(() => ({}));
          if (!up.ok || !j?.file?.name) throw new Error("Upload to Gemini failed");
          let state = j.file.state;
          let uri = j.file.uri;
          for (let i = 0; state === "PROCESSING" && i < 60; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const s = await studioApi<{ state: string; uri: string }>(`/api/studio-os/copilot/file-status?name=${encodeURIComponent(j.file.name)}`);
            state = s.state;
            uri = s.uri || uri;
          }
          if (state !== "ACTIVE") {
            void deleteRemote(j.file.name);
            throw new Error("Gemini couldn't process this file");
          }
          // If the user removed it meanwhile, clean up immediately.
          if (!attachRef.current.some((a) => a.id === id)) {
            void deleteRemote(j.file.name);
            continue;
          }
          setAttachments((l) => l.map((a) => (a.id === id ? { id, kind: "file", name: f.name, mime: j.file.mimeType || mime, size: f.size, uri, file_name: j.file.name } : a)));
        }
      } catch (err: any) {
        setAttachments((l) => l.filter((a) => a.id !== id));
        pushToast(err?.message || `Couldn't attach ${f.name}`, "warn");
      }
    }
  };

  const viewCode = useMemo(() => projects.find((p) => p.id === selectedProjectId)?.code, [projects, selectedProjectId]);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      const ready = attachments.filter((a) => a.kind !== "uploading") as Exclude<Attachment, { kind: "uploading" }>[];
      if (busy || (!text && !ready.length)) return;
      if (attachments.some((a) => a.kind === "uploading")) return pushToast("Still uploading…", "info");
      const userMsg: Msg = { id: uid(), role: "user", text: text || "Please analyse the attachment.", files: ready.map((a) => a.name) };
      const history = [...messages, userMsg];
      setMessages(history);
      setInput("");
      setAttachments([]); // files are per-turn; the server deletes Gemini uploads after this request
      setBusy(true);
      try {
        const res = await studioApi<{ text: string; actions: PlanAction[] }>("/api/studio-os/copilot/chat", {
          body: {
            messages: history
              .filter((m) => !m.error)
              .slice(-20)
              .map((m) => ({ role: m.role, text: m.text + (m.plan?.status === "applied" ? "\n[Action plan applied]" : "") })),
            attachments: ready.map((a) =>
              a.kind === "inline" ? { kind: "inline", name: a.name, mime: a.mime, data: a.data } : { kind: "file", name: a.name, mime: a.mime, uri: a.uri, file_name: a.file_name }
            ),
            view: { route, project_code: route === "project_detail" ? viewCode : undefined },
          },
        });
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "model",
            text: res.text,
            actions: res.actions?.length ? res.actions : undefined,
            plan: res.actions?.length ? { status: "pending", selected: res.actions.map((a) => a.id) } : undefined,
          },
        ]);
      } catch (err: any) {
        setMessages((m) => [...m, { id: uid(), role: "model", text: err?.message || "Copilot is unavailable right now.", error: true }]);
      } finally {
        setBusy(false);
      }
    },
    [attachments, busy, input, messages, pushToast, route, viewCode]
  );

  const patchPlan = (msgId: string, plan: Partial<NonNullable<Msg["plan"]>>) =>
    setMessages((list) => list.map((m) => (m.id === msgId && m.plan ? { ...m, plan: { ...m.plan, ...plan } } : m)));

  const refreshAll = async () => {
    await Promise.all([reloadFromCloud().catch(() => null), refreshInbox().catch(() => null)]);
  };

  const apply = async (msg: Msg, ids: string[]) => {
    const chosen = (msg.actions || []).filter((a) => ids.includes(a.id));
    if (!chosen.length) return;
    patchPlan(msg.id, { status: "applying" });
    try {
      const { results } = await studioApi<{ results: ActionResult[] }>("/api/studio-os/copilot/apply", { body: { actions: chosen.map(({ id, tool, args }) => ({ id, tool, args })) } });
      patchPlan(msg.id, { status: "applied", results, selected: ids });
      const failed = results.filter((r) => !r.ok).length;
      pushToast(failed ? `Applied with ${failed} issue${failed > 1 ? "s" : ""}` : "Applied", failed ? "warn" : "success");
      await refreshAll();
    } catch (err: any) {
      patchPlan(msg.id, { status: "pending" });
      pushToast(err?.message || "Couldn't apply", "warn");
    }
  };

  const undo = async (msg: Msg) => {
    const steps = (msg.plan?.results || []).flatMap((r) => r.undo || []);
    if (!steps.length) return;
    patchPlan(msg.id, { status: "applying" });
    try {
      await studioApi("/api/studio-os/copilot/undo", { body: { undo: steps } });
      patchPlan(msg.id, { status: "undone" });
      pushToast("Undone", "success");
      await refreshAll();
    } catch (err: any) {
      patchPlan(msg.id, { status: "applied" });
      pushToast(err?.message || "Couldn't undo", "warn");
    }
  };

  const newChat = () => {
    for (const a of attachments) if (a.kind === "file") void deleteRemote(a.file_name);
    setAttachments([]);
    setMessages([]);
    setInput("");
    try {
      sessionStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
  };

  const focus = mode === "focus";
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12 } }
    : focus
    ? { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.2, ease: EASE } }
    : { initial: { x: 40, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 40, opacity: 0 }, transition: { duration: 0.22, ease: EASE } };

  return (
    <AnimatePresence>
      {mode !== "closed" && (
        <>
          {focus && (
            <motion.div
              key="copilot-backdrop"
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMode("drawer")}
            />
          )}
          <motion.aside
            key={`copilot-${mode}`}
            role="dialog"
            aria-label="Studio Copilot"
            aria-modal={focus}
            className={
              focus
                ? "fixed z-[61] inset-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[820px] md:max-w-[calc(100vw-48px)] md:h-[86vh] md:rounded-[28px] flex flex-col border shadow-2xl"
                : "fixed z-[61] inset-0 md:inset-auto md:right-3 md:top-3 md:bottom-3 md:w-[420px] md:rounded-[24px] flex flex-col border shadow-2xl"
            }
            style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
            }}
            {...panelMotion}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0" style={{ borderColor: "var(--sos-border)" }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-primary)" }}>
                <Sparkles className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Studio Copilot</p>
                <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>Meta Muse · sees your live workspace · changes need your OK</p>
              </div>
              <button type="button" onClick={newChat} className="sos-pill-btn h-9 px-3 text-[12px] font-medium border inline-flex items-center gap-1" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                <Plus className="w-3.5 h-3.5" /> New chat
              </button>
              <button type="button" onClick={() => setMode(focus ? "drawer" : "focus")} className="hidden md:flex w-9 h-9 rounded-full items-center justify-center" style={{ color: "var(--sos-text-2)" }} aria-label={focus ? "Dock to side" : "Focus mode"}>
                {focus ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button type="button" onClick={() => setMode("closed")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-2)" }} aria-label="Close Copilot">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-[13.5px] leading-relaxed" style={{ color: "var(--sos-text-2)" }} aria-live="polite">
              {messages.length === 0 && (
                <div className="pt-6 space-y-4">
                  <div>
                    <p className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>What can I take off your plate?</p>
                    <p className="text-[13px] mt-1" style={{ color: "var(--sos-text-3)" }}>I read your projects, gates, tasks, clients and mail. I'll only propose changes — you decide what's applied.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {STARTERS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="sos-pill-btn text-left px-4 py-3 rounded-[16px] border text-[13px] font-medium" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex flex-col items-end gap-1">
                    {m.files?.length ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {m.files.map((f) => (
                          <span key={f} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-3)" }}>
                            <FileText className="w-3 h-3" /> {f}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="max-w-[85%] px-3.5 py-2.5 rounded-[18px] rounded-br-[6px] text-white whitespace-pre-wrap" style={{ background: "var(--sos-primary)" }}>
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-3">
                    <div className={m.error ? "px-3.5 py-2.5 rounded-[14px]" : ""} style={m.error ? { background: "#FFF1E6", color: "#9A3412" } : undefined}>
                      <Markdown text={m.text} />
                    </div>
                    {m.actions && m.plan && <PlanCard msg={m} onToggle={(id) => patchPlan(m.id, { selected: m.plan!.selected.includes(id) ? m.plan!.selected.filter((x) => x !== id) : [...m.plan!.selected, id] })} onApply={(ids) => apply(m, ids)} onCancel={() => patchPlan(m.id, { status: "cancelled" })} onUndo={() => undo(m)} />}
                  </div>
                )
              )}

              {busy && (
                <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading your workspace…
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t px-3 pt-2.5 pb-3 shrink-0 space-y-2" style={{ borderColor: "var(--sos-border)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-8 rounded-full border text-[12px] max-w-full" style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                      {a.kind === "uploading" ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate max-w-[140px]">{a.name}</span>
                      <span className="shrink-0" style={{ color: "var(--sos-text-3)" }}>{a.kind === "uploading" ? `Uploading ${fmtSize(a.size)}` : "Context only · Not saved"}</span>
                      <button type="button" onClick={() => removeAttachment(a)} className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" aria-label={`Remove ${a.name}`} style={{ color: "var(--sos-text-3)" }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className={`flex items-end gap-1.5 rounded-[20px] border px-2 py-1.5 ${dragOver ? "sos-drop-active" : ""}`} style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}>
                <button type="button" onClick={() => fileRef.current?.click()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: "var(--sos-text-2)" }} aria-label="Attach a file (not saved)">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) void addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Ask, or drop a brief/PDF/video…"
                  aria-label="Message Studio Copilot"
                  className="flex-1 bg-transparent outline-none resize-none text-[14px] py-2 max-h-40"
                  style={{ color: "var(--sos-text-1)", fieldSizing: "content" } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => send()}
                  disabled={busy || (!input.trim() && !attachments.some((a) => a.kind !== "uploading"))}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40"
                  style={{ background: "var(--sos-primary)" }}
                  aria-label="Send"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] px-1" style={{ color: "var(--sos-text-3)" }}>
                Files are used for this message only and never stored. Emails are saved as drafts, never sent.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const PlanCard: React.FC<{
  msg: Msg;
  onToggle: (id: string) => void;
  onApply: (ids: string[]) => void;
  onCancel: () => void;
  onUndo: () => void;
}> = ({ msg, onToggle, onApply, onCancel, onUndo }) => {
  const plan = msg.plan!;
  const actions = msg.actions!;
  const pending = plan.status === "pending";
  const resultFor = (id: string) => plan.results?.find((r) => r.id === id);
  const canUndo = plan.status === "applied" && (plan.results || []).some((r) => r.undo?.length);
  return (
    <div className="rounded-[18px] border overflow-hidden" style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)" }}>
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}>
        <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-2)" }}>Action plan</p>
        <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
          {plan.status === "pending" ? `${plan.selected.length}/${actions.length} selected` : plan.status === "applying" ? "Working…" : plan.status === "applied" ? "Applied" : plan.status === "undone" ? "Undone" : "Cancelled"}
        </span>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--sos-border)" }}>
        {actions.map((a) => {
          const r = resultFor(a.id);
          const on = plan.selected.includes(a.id);
          return (
            <li key={a.id} className="px-3.5 py-2.5 flex gap-2.5" style={{ borderColor: "var(--sos-border)", opacity: !pending && !on ? 0.5 : 1 }}>
              {pending ? (
                <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} className="mt-1 w-4 h-4 shrink-0 accent-[var(--sos-primary)]" aria-label={`Select: ${a.title}`} />
              ) : (
                <span className="mt-0.5 w-4 h-4 shrink-0 flex items-center justify-center" style={{ color: r ? (r.ok ? "var(--sos-green)" : "#B42318") : "var(--sos-text-3)" }}>
                  {r ? r.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" /> : null}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{a.title}</p>
                {a.lines.filter(Boolean).slice(0, 10).map((l, i) => (
                  <p key={i} className="text-[12px] break-words" style={{ color: "var(--sos-text-2)" }}>{l}</p>
                ))}
                {r && <p className="text-[12px] mt-0.5" style={{ color: r.ok ? "var(--sos-green)" : "#B42318" }}>{r.message}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {(pending || canUndo || plan.status === "applying") && (
        <div className="px-3.5 py-2.5 flex flex-wrap gap-2 justify-end border-t" style={{ borderColor: "var(--sos-border)" }}>
          {plan.status === "applying" && <Loader2 className="w-4 h-4 animate-spin self-center" style={{ color: "var(--sos-text-3)" }} />}
          {pending && (
            <>
              <button type="button" onClick={onCancel} className="sos-pill-btn h-9 px-3.5 text-[12px] font-medium" style={{ color: "var(--sos-text-2)" }}>Cancel</button>
              {actions.length > 1 && (
                <button type="button" disabled={!plan.selected.length} onClick={() => onApply(plan.selected)} className="sos-pill-btn h-9 px-3.5 text-[12px] font-semibold border disabled:opacity-40" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
                  Apply selected
                </button>
              )}
              <button type="button" onClick={() => onApply(actions.map((a) => a.id))} className="sos-pill-btn h-9 px-4 text-[12px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
                Apply all
              </button>
            </>
          )}
          {canUndo && (
            <button type="button" onClick={onUndo} className="sos-pill-btn h-9 px-3.5 text-[12px] font-semibold border inline-flex items-center gap-1.5" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
};
