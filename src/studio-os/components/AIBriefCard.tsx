/**
 * Today's brief — built from Studio OS data in code (instant, free, always works):
 * focus tasks, approvals waiting on clients, timeline risks, deadlines this week, replies owed.
 * "✨ Add AI read" optionally asks Gemini (fast tier) to add a headline + mail insights on top.
 */
import React, { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ChevronDown, Loader2, Mail, Sparkles } from "lucide-react";
import { studioApi } from "../api";
import { useStudioOS } from "../StudioOSContext";

const PRI: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const AIBriefCard: React.FC = () => {
  const { projects, gates, tasks, clients, getProjectForecast, openProject, supabaseSyncStatus, settings } = useStudioOS();
  const [open, setOpen] = useState(true);
  const [ai, setAi] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const brief = useMemo(() => {
    const today = new Date();
    const todayIso = format(today, "yyyy-MM-dd");
    const week = format(addDays(today, 7), "yyyy-MM-dd");
    const live = projects.filter((p) => !p.closed_at && ["active", "on_hold", "quoted", "lead"].includes(p.status));
    const code = (id: string | null | undefined) => projects.find((p) => p.id === id)?.code || "";
    const clientOf = (pid: string) => clients.find((c) => c.id === projects.find((p) => p.id === pid)?.client_id)?.name || "";
    const open = tasks.filter((t) => t.status !== "done" && live.some((p) => p.id === t.project_id));
    const due = (t: any) => (t.due_date ? String(t.due_date).slice(0, 10) : "");

    const focus = open
      .filter((t) => (due(t) && due(t) <= todayIso) || t.priority === "urgent" || t.is_in_now)
      .sort((a, b) => (due(a) || "9999").localeCompare(due(b) || "9999") || (PRI[a.priority] ?? 2) - (PRI[b.priority] ?? 2))
      .slice(0, 6)
      .map((t) => ({ project: code(t.project_id), pid: t.project_id, text: t.title, note: due(t) ? (due(t) < todayIso ? `overdue since ${format(parseISO(due(t)), "d MMM")}` : "due today") : t.priority }));

    const allowance = Number(settings.default_approval_latency_days) || 2;
    const waiting = gates
      .filter((g) => g.status === "waiting_on_client" && live.some((p) => p.id === g.project_id))
      .map((g) => {
        const days = g.sent_for_approval_at ? differenceInCalendarDays(today, parseISO(g.sent_for_approval_at)) : 0;
        return { project: code(g.project_id), pid: g.project_id, text: `${g.name} — ${clientOf(g.project_id)}`, note: `${days}d${days > allowance ? " · nudge" : ""}`, days };
      })
      .sort((a, b) => b.days - a.days);

    const risks = live
      .map((p) => ({ p, f: getProjectForecast(p.id) }))
      .filter((x) => x.f && (x.f.health === "late" || x.f.health === "at_risk"))
      .map(({ p, f }) => ({ project: p.code, pid: p.id, text: p.title, note: `${f!.health === "late" ? "late" : "at risk"} · now ${format(parseISO(f!.forecast_date), "d MMM")}${f!.reasons[0] ? ` — ${f!.reasons[0]}` : ""}` }));

    const deadlines = live
      .map((p) => ({ p, d: p.promised_date || p.hard_deadline }))
      .filter((x) => x.d && x.d >= todayIso && x.d <= week)
      .sort((a, b) => a.d!.localeCompare(b.d!))
      .map(({ p, d }) => ({ project: p.code, pid: p.id, text: p.title, note: format(parseISO(d!), "EEE d MMM") }));

    const replies = open
      .filter((t) => t.type === "reply_owed" || t.type === "promise")
      .sort((a, b) => (due(a) || "9999").localeCompare(due(b) || "9999"))
      .slice(0, 5)
      .map((t) => ({ project: code(t.project_id), pid: t.project_id, text: t.title, note: t.promised_to_name || (due(t) ? format(parseISO(due(t)), "d MMM") : "") }));

    const parts = [
      `${live.filter((p) => p.status === "active").length} active`,
      waiting.length ? `${waiting.length} waiting on clients` : "",
      risks.length ? `${risks.length} at risk` : "",
      focus.length ? `${focus.length} to do today` : "",
      deadlines.length ? `${deadlines.length} due this week` : "",
    ].filter(Boolean);
    return { headline: parts.join(" · "), focus, waiting, risks, deadlines, replies };
  }, [projects, gates, tasks, clients, getProjectForecast, settings]);

  const askAi = async () => {
    setBusy(true);
    setError("");
    try {
      const j = await studioApi<any>("/api/studio-os/ai/brief", { method: "POST", body: {} });
      setAi(j.brief?.result || null);
    } catch (e: any) {
      setError(e?.message || "AI is unavailable right now — the brief above is complete without it.");
    } finally {
      setBusy(false);
    }
  };

  const List: React.FC<{ title: string; rows: Array<{ project: string; pid?: string; text: string; note?: string }>; tone?: string; icon?: React.ReactNode }> = ({ title, rows, tone, icon }) =>
    rows.length ? (
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--sos-text-3)" }}>
          {icon}
          {title}
        </p>
        {rows.map((r, i) => (
          <button key={i} type="button" onClick={() => r.pid && openProject(r.pid)} className="w-full text-left text-[13px] leading-snug flex items-baseline gap-1.5 hover:opacity-80" style={{ color: "var(--sos-text-1)" }}>
            {r.project && <span className="font-semibold sos-tabular shrink-0" style={{ color: "var(--sos-primary)" }}>{r.project}</span>}
            <span className="min-w-0">
              {r.text}
              {r.note ? <span style={{ color: tone || "var(--sos-text-3)" }}> · {r.note}</span> : null}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  const empty = !brief.focus.length && !brief.waiting.length && !brief.risks.length && !brief.deadlines.length && !brief.replies.length;

  return (
    <section className="sos-card p-5 md:p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2.5 min-w-0 text-left">
          <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sos-surface-2)", color: "var(--sos-primary)" }}>
            <Sparkles className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Today's brief
            </h2>
            <p className="text-[13px] truncate" style={{ color: "var(--sos-text-2)" }}>{brief.headline || "All quiet"}</p>
          </div>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--sos-text-3)" }} />
        </button>
        {supabaseSyncStatus === "synced" && (
          <button type="button" disabled={busy} onClick={askAi} className="sos-pill-btn h-9 px-3 text-[12px] font-semibold border inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }} title="Gemini adds a read on mail and priorities">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {ai ? "Refresh AI read" : "Add AI read"}
          </button>
        )}
      </div>
      {open && (
        <>
          {empty && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Nothing urgent — no overdue tasks, approvals or risks today.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <List title="Focus today" rows={brief.focus} tone="#B42318" />
            <List title="Waiting on clients" rows={brief.waiting} tone="#9A4A00" />
            <List title="Timeline risks" rows={brief.risks} tone="#9A4A00" />
            <List title="Deadlines this week" rows={brief.deadlines} />
            <List title="Replies & promises" rows={brief.replies} />
          </div>
          {error && <p className="text-[12px] px-3 py-2 rounded-[10px]" style={{ background: "#FFF3E0", color: "#9A4A00" }}>{error}</p>}
          {ai && (
            <div className="p-3.5 rounded-[14px] space-y-3" style={{ background: "var(--sos-surface-2)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>✨ {ai.headline}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <List title="What the mail says" icon={<Mail className="w-3 h-3" />} rows={(ai.mail_status || []).map((r: any) => ({ project: r.project, text: r.status_from_mail, note: r.suggested_update }))} />
                <List title="Mail without a client" icon={<Mail className="w-3 h-3" />} rows={(ai.unmatched_mail || []).map((r: any) => ({ project: "", text: `${r.subject} (${r.from})`, note: r.suggestion }))} />
                <List title="AI focus" rows={(ai.focus || []).map((r: any) => ({ project: r.project, text: r.title, note: r.why }))} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
