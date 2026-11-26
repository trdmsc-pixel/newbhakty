/**
 * "Scan Gmail" — reads recent client mail and creates missing clients / projects / tasks
 * (server: POST /api/studio-os/mail/scan). Safe to run again: duplicates are skipped.
 */
import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mail, X } from "lucide-react";
import { studioApi } from "../api";
import { useStudioOS } from "../StudioOSContext";

type Target = "clients" | "projects" | "tasks";
const COPY: Record<Target, { what: string; days: number[] }> = {
  clients: { what: "new clients and their contacts", days: [30, 60, 90, 180] },
  projects: { what: "new projects (with stages) — and their clients if missing", days: [30, 60, 90, 180] },
  tasks: { what: "to-dos, promises and replies owed on your projects", days: [7, 14, 30, 60] },
};

interface Result {
  scanned: number;
  days: number;
  created: Array<{ kind: string; label: string; id: string }>;
  skipped: string[];
  errors: string[];
  message?: string;
}

export const GmailScanButton: React.FC<{ target: Target }> = ({ target }) => {
  const { isOwner, supabaseSyncStatus, reloadFromCloud, pushToast } = useStudioOS();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(target === "tasks" ? 14 : 60);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !busy && box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, busy]);

  if (!isOwner || supabaseSyncStatus !== "synced") return null;

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await studioApi<Result>("/api/studio-os/mail/scan", { body: { target, days } });
      setResult(r);
      if (r.created.length) {
        await reloadFromCloud();
        pushToast(`Gmail scan added ${r.created.length} ${r.created.length === 1 ? "item" : "items"}`, "success");
      }
    } catch (e: any) {
      setError(e?.message || "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-10 text-[13px] font-semibold border"
        style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
        title={`Scan Gmail for ${COPY[target].what}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />} Scan Gmail
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] sos-card p-4 space-y-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              Reads your client mail and adds <b style={{ color: "var(--sos-text-1)" }}>{COPY[target].what}</b>. Anything already here is skipped. Edit details afterwards.
            </p>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="p-1 rounded-full shrink-0" style={{ color: "var(--sos-text-3)" }} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={busy} className="h-9 px-3 rounded-full border text-[13px]" style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} aria-label="How far back">
              {COPY[target].days.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </select>
            <button type="button" disabled={busy} onClick={run} className="sos-pill-btn h-9 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: "var(--sos-primary)" }}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} {busy ? "Reading mail…" : "Scan now"}
            </button>
          </div>
          {busy && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Takes 20–40 seconds.</p>}
          {error && <p className="text-[12px] px-3 py-2 rounded-[10px]" style={{ background: "#FDECEC", color: "#B42318" }}>{error}</p>}
          {result && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                {result.message || `Read ${result.scanned} client threads from the last ${result.days} days.`}
              </p>
              {result.created.length === 0 && !result.message && <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>Nothing new to add — you're up to date.</p>}
              {result.created.map((c) => (
                <p key={c.id} className="text-[13px] flex items-start gap-1.5" style={{ color: "var(--sos-text-1)" }}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--sos-green)" }} />
                  <span>
                    <span className="text-[11px] font-semibold uppercase mr-1" style={{ color: "var(--sos-text-3)" }}>{c.kind}</span>
                    {c.label}
                  </span>
                </p>
              ))}
              {result.skipped.length > 0 && (
                <details className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                  <summary className="cursor-pointer">Skipped {result.skipped.length}</summary>
                  {result.skipped.map((s, i) => (
                    <p key={i}>• {s}</p>
                  ))}
                </details>
              )}
              {result.errors.map((e, i) => (
                <p key={i} className="text-[12px]" style={{ color: "#9A4A00" }}>
                  {e}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
