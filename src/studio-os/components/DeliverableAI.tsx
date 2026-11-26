/**
 * AI tools for one deliverable version (Gemini, cached server-side):
 *  - Did we fix every note?  — checks the new cut against the client's last notes
 *  - What changed            — client-friendly summary (editable, then shown in the portal)
 *  - Shot log                — every shot with timecodes
 *  - Client sketches         — drawings the client made on paused frames
 */
import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Film, Loader2, PenLine, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { studioApi } from "../api";
import { parseTime, fmtTime } from "../../review/ReviewMedia";

type Kind = "note_check" | "change_summary" | "shot_log";
interface Insight {
  result: any;
  model?: string;
  created_at: string;
  cached?: boolean;
}

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  fixed: { label: "Fixed", bg: "#E7F7EE", fg: "#17663F" },
  partly: { label: "Partly", bg: "#FFF3E0", fg: "#9A4A00" },
  not_fixed: { label: "Missed", bg: "#FDECEC", fg: "#B42318" },
  cant_tell: { label: "Check", bg: "var(--sos-surface-2)", fg: "var(--sos-text-2)" },
};

const ENDPOINT: Record<Kind, string> = {
  note_check: "/api/studio-os/ai/note-check",
  change_summary: "/api/studio-os/ai/change-summary",
  shot_log: "/api/studio-os/ai/shot-log",
};

const Time: React.FC<{ t?: string; onSeek?: (s: number) => void }> = ({ t, onSeek }) => {
  const s = t ? parseTime(t) : null;
  if (s == null) return null;
  return (
    <button type="button" onClick={() => onSeek?.(s)} className="shrink-0 px-2 h-6 rounded-full text-[11px] font-semibold sos-tabular text-white" style={{ background: "var(--sos-primary)" }} title="Jump here">
      {t}
    </button>
  );
};

export const DeliverableAI: React.FC<{
  deliverableId: string;
  hasGate: boolean;
  onSeek?: (sec: number) => void;
  onMarkFixed?: (taskIds: string[]) => void;
}> = ({ deliverableId, hasGate, onSeek, onMarkFixed }) => {
  const [data, setData] = useState<Partial<Record<Kind, Insight>>>({});
  const [sketches, setSketches] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [published, setPublished] = useState<string | null>(null);
  const [busy, setBusy] = useState<Kind | "publish" | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Kind | "sketches" | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await studioApi<any>(`/api/studio-os/ai/insights?deliverable_id=${deliverableId}`);
      setData(j.insights || {});
      setSketches(j.sketches || []);
      setPublished(j.client_summary || null);
      setSummary(j.client_summary || j.insights?.change_summary?.result?.client_summary || "");
    } catch {
      /* AI not configured or offline — buttons still explain on click */
    }
  }, [deliverableId]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (kind: Kind, refresh = false) => {
    setBusy(kind);
    setError("");
    setOpen(kind);
    try {
      const j = await studioApi<Insight>(ENDPOINT[kind], { method: "POST", body: { deliverable_id: deliverableId, refresh } });
      setData((d) => ({ ...d, [kind]: j }));
      if (kind === "change_summary" && !published) setSummary(j.result?.client_summary || "");
    } catch (e: any) {
      setError(e?.message || "AI request failed");
    } finally {
      setBusy(null);
    }
  };

  const publish = async (text = summary) => {
    setBusy("publish");
    setError("");
    try {
      await studioApi("/api/studio-os/ai/change-summary/publish", { method: "POST", body: { deliverable_id: deliverableId, text } });
      setPublished(text.trim() || null);
    } catch (e: any) {
      setError(e?.message || "Couldn't save");
    } finally {
      setBusy(null);
    }
  };

  const btn = (kind: Kind, icon: React.ReactNode, label: string, show = true) =>
    show && (
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => (data[kind] ? setOpen(open === kind ? null : kind) : run(kind))}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold disabled:opacity-60"
        style={open === kind ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface)", color: "var(--sos-text-1)", border: "1px solid var(--sos-border)" }}
        title={data[kind] ? "Show the saved result" : "Runs once with Gemini, then it's saved"}
      >
        {busy === kind ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon} {label}
        {data[kind] && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--sos-green)" }} />}
      </button>
    );

  const current = open && open !== "sketches" ? data[open] : null;
  const check = data.note_check?.result;
  const fixedIds = (check?.items || []).filter((i: any) => i.status === "fixed" && i.kind === "task" && i.task_status !== "done").map((i: any) => i.id);

  return (
    <div className="rounded-[16px] p-3 space-y-2.5" style={{ background: "var(--sos-surface-2)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--sos-text-2)" }}>
          <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--sos-primary)" }} /> AI
        </span>
        {btn("note_check", <CheckCircle2 className="w-3.5 h-3.5" />, "Did we fix every note?", hasGate)}
        {btn("change_summary", <Wand2 className="w-3.5 h-3.5" />, "What changed")}
        {btn("shot_log", <Film className="w-3.5 h-3.5" />, "Shot log")}
        {sketches.length > 0 && (
          <button type="button" onClick={() => setOpen(open === "sketches" ? null : "sketches")} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold" style={open === "sketches" ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "#FFF3E0", color: "#9A4A00" }}>
            <PenLine className="w-3.5 h-3.5" /> Client sketches ({sketches.length})
          </button>
        )}
      </div>
      {error && <p className="text-[12px] px-3 py-2 rounded-[10px]" style={{ background: "#FDECEC", color: "#B42318" }}>{error}</p>}

      {open === "note_check" && check && (
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium" style={{ color: "var(--sos-text-1)" }}>{check.overall}</p>
          {(check.items || []).map((it: any, i: number) => {
            const st = STATUS[it.status] || STATUS.cant_tell;
            return (
              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-[12px]" style={{ background: "var(--sos-surface)" }}>
                <span className="shrink-0 px-2 h-6 rounded-full text-[11px] font-bold flex items-center" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]" style={{ color: "var(--sos-text-1)" }}>{it.note}</p>
                  {it.evidence && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>{it.evidence}</p>}
                </div>
                <Time t={it.timecode} onSeek={onSeek} />
              </div>
            );
          })}
          {fixedIds.length > 0 && onMarkFixed && (
            <button type="button" onClick={() => { onMarkFixed(fixedIds); setData((d) => ({ ...d, note_check: { ...d.note_check!, result: { ...check, items: check.items.map((x: any) => (fixedIds.includes(x.id) ? { ...x, task_status: "done" } : x)) } } })); }} className="h-8 px-3 rounded-full text-[12px] font-semibold text-white" style={{ background: "var(--sos-green)" }}>
              Mark the {fixedIds.length} fixed note{fixedIds.length > 1 ? "s" : ""} done
            </button>
          )}
        </div>
      )}

      {open === "change_summary" && data.change_summary && (
        <div className="space-y-2">
          <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Shown to the client under this version in the portal. Edit freely, then save.</p>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-[12px] border text-[13px]" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy !== null} onClick={() => publish()} className="h-8 px-3 rounded-full text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: "var(--sos-primary)" }}>
              {busy === "publish" ? "Saving…" : published ? "Update in portal" : "Show to client"}
            </button>
            {published && (
              <button type="button" disabled={busy !== null} onClick={() => publish("")} className="h-8 px-3 rounded-full text-[12px] font-medium" style={{ color: "var(--sos-text-2)" }}>
                Hide from client
              </button>
            )}
            {published && <span className="text-[11px]" style={{ color: "var(--sos-green)" }}>✓ visible in the portal</span>}
          </div>
          {(data.change_summary.result.changes || []).length > 0 && (
            <div className="space-y-1">
              {data.change_summary.result.changes.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
                  <Time t={c.timecode} onSeek={onSeek} /> <span>{c.change}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {open === "shot_log" && data.shot_log && (
        <div className="space-y-1">
          <p className="text-[13px]" style={{ color: "var(--sos-text-1)" }}>
            {data.shot_log.result.summary} {data.shot_log.result.duration && <span style={{ color: "var(--sos-text-3)" }}>· {data.shot_log.result.duration} · {(data.shot_log.result.shots || []).length} shots</span>}
          </p>
          <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
            {(data.shot_log.result.shots || []).map((s: any, i: number) => (
              <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 rounded-[10px] text-[12px]" style={{ background: "var(--sos-surface)" }}>
                <span className="w-6 shrink-0 sos-tabular" style={{ color: "var(--sos-text-3)" }}>{i + 1}</span>
                <Time t={s.start} onSeek={onSeek} />
                <span className="shrink-0 font-semibold w-12" style={{ color: "var(--sos-text-2)" }}>{s.shot}</span>
                <span className="flex-1 min-w-0" style={{ color: "var(--sos-text-1)" }}>
                  {s.description}
                  {(s.camera || s.audio || s.text_on_screen) && <span style={{ color: "var(--sos-text-3)" }}> — {[s.camera, s.audio, s.text_on_screen && `“${s.text_on_screen}”`].filter(Boolean).join(" · ")}</span>}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const rows = [["#", "Start", "End", "Shot", "Description", "Camera", "Audio", "On-screen text"], ...(data.shot_log!.result.shots || []).map((s: any, i: number) => [i + 1, s.start, s.end, s.shot, s.description, s.camera, s.audio, s.text_on_screen])];
              const csv = rows.map((r) => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = "shot-log.csv";
              a.click();
            }}
            className="text-[12px] font-semibold"
            style={{ color: "var(--sos-primary)" }}
          >
            Download CSV
          </button>
        </div>
      )}

      {open === "sketches" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sketches.map((s) => (
            <div key={s.id} className="rounded-[12px] p-2 space-y-1" style={{ background: "var(--sos-surface)" }}>
              <div className="rounded-[8px] overflow-hidden" style={{ background: "repeating-conic-gradient(#0001 0% 25%, transparent 0% 50%) 50% / 16px 16px" }}>
                <img src={s.image_data} alt="Client sketch" className="w-full h-auto" />
              </div>
              <div className="flex items-center gap-2">
                {s.timecode != null && <Time t={fmtTime(Number(s.timecode))} onSeek={onSeek} />}
                <p className="text-[12px] flex-1" style={{ color: "var(--sos-text-1)" }}>{s.ai_note || s.comment || "Sketch"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--sos-text-3)" }}>
          <span>
            {current.model} · {new Date(current.created_at).toLocaleString()}
          </span>
          <button type="button" disabled={busy !== null} onClick={() => run(open as Kind, true)} className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--sos-primary)" }}>
            <RefreshCw className="w-3 h-3" /> Run again
          </button>
        </div>
      )}
    </div>
  );
};
