/**
 * Delivery timeline for one project:
 *   Planned (manual)  — the promised delivery date + hard deadline, edited here.
 *   Projected         — the plan pushed out by real client approval behaviour
 *                       (computed in code: forecastEngine.computeProjectForecast).
 *   ✨ AI note         — optional: a short read of the situation and what to do / tell the client.
 */
import React, { useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarClock, Loader2, Sparkles, Copy } from "lucide-react";
import type { ProjectForecastResult } from "../forecastEngine";
import type { StudioProject } from "../types";
import { useStudioOS } from "../StudioOSContext";
import { studioApi } from "../api";

const HEALTH: Record<string, { label: string; bg: string; fg: string }> = {
  on_track: { label: "On track", bg: "#E7F7EE", fg: "#17663F" },
  tight: { label: "Tight", bg: "#FFF8E1", fg: "#8A5A00" },
  at_risk: { label: "At risk", bg: "#FFF3E0", fg: "#9A4A00" },
  late: { label: "Late", bg: "#FDECEC", fg: "#B42318" },
};

const fmt = (d?: string | null) => (d ? format(parseISO(d), "EEE d MMM yyyy") : "—");

export const DeliveryTimelineCard: React.FC<{ project: StudioProject; forecast: ProjectForecastResult }> = ({ project, forecast }) => {
  const { updateProject, pushToast, isOwner } = useStudioOS();
  const [ai, setAi] = useState<{ note: string; client_message: string; model?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const h = HEALTH[forecast.health] || HEALTH.on_track;
  const target = project.hard_deadline || project.promised_date;
  const vsTarget = target ? differenceInCalendarDays(parseISO(forecast.forecast_date), parseISO(target)) : null;

  const explain = async () => {
    setBusy(true);
    setError("");
    try {
      const j = await studioApi<any>("/api/studio-os/ai/timeline", {
        body: {
          project_id: project.id,
          timeline: {
            planned: forecast.planned_date,
            projected: forecast.forecast_date,
            hard_deadline: project.hard_deadline || null,
            shift_days: forecast.shift_days,
            client_delay_days: forecast.client_delay_days,
            projected_client_delay_days: forecast.projected_client_delay_days,
            studio_delay_days: forecast.studio_delay_days,
            pace: forecast.pace,
            reasons: forecast.reasons,
            stages: forecast.stages.map((s) => ({ name: s.name, status: s.status, approval: s.needs_approval, planned: s.planned_end, projected: s.projected_end, client_wait_days: s.client_wait_days })),
          },
        },
      });
      setAi(j);
    } catch (e: any) {
      setError(e?.message || "AI unavailable");
    } finally {
      setBusy(false);
    }
  };

  const dateInput = (label: string, value: string | undefined, onChange: (v: string | undefined) => void, hint: string) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }} title={hint}>
        {label}
      </span>
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="mt-1 w-full h-9 px-2.5 rounded-[10px] border text-[13px] sos-tabular"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
      />
    </label>
  );

  return (
    <div className="sos-card p-5 space-y-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color: "var(--sos-text-3)" }}>
          <CalendarClock className="w-4 h-4" style={{ color: "var(--sos-primary)" }} /> Delivery timeline
        </span>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: h.bg, color: h.fg }}>
          {h.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {dateInput("Planned delivery", project.promised_date, (v) => updateProject(project.id, { promised_date: v }), "The date you promise the client — shown in the portal")}
        {dateInput("Hard deadline", project.hard_deadline, (v) => updateProject(project.id, { hard_deadline: v }), "The client's absolute deadline")}
      </div>

      <div className="p-3.5 rounded-[14px] space-y-1" style={{ background: "var(--sos-surface-2)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>
          Projected delivery
        </p>
        <p className="sos-num text-[24px] font-semibold leading-tight" style={{ color: "var(--sos-text-1)" }}>
          {fmt(forecast.forecast_date)}
        </p>
        <p className="text-[12px]" style={{ color: forecast.shift_days > 0 ? "#9A4A00" : "var(--sos-text-2)" }}>
          {forecast.planned_date
            ? forecast.shift_days > 0
              ? `${forecast.shift_days} day${forecast.shift_days > 1 ? "s" : ""} after plan`
              : forecast.shift_days < 0
              ? `${-forecast.shift_days} days ahead of plan`
              : "On the planned date"
            : "Set a planned delivery date (or stage dates) to track against"}
          {vsTarget !== null && project.hard_deadline ? ` · ${vsTarget > 0 ? `${vsTarget}d past` : `${-vsTarget}d before`} the hard deadline` : ""}
        </p>
      </div>

      {(forecast.client_delay_days >= 1 || forecast.projected_client_delay_days >= 1 || forecast.studio_delay_days >= 1) && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Client so far", forecast.client_delay_days, "#B42318"],
            ["Client expected", forecast.projected_client_delay_days, "#9A4A00"],
            ["Studio", forecast.studio_delay_days, "var(--sos-text-2)"],
          ].map(([label, v, c]) => (
            <div key={label as string} className="p-2 rounded-[12px]" style={{ background: "var(--sos-surface-2)" }}>
              <p className="sos-num text-[18px] font-semibold" style={{ color: c as string }}>
                +{Math.round(Number(v))}d
              </p>
              <p className="text-[10px] font-semibold uppercase" style={{ color: "var(--sos-text-3)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {forecast.reasons.length > 0 && (
        <ul className="space-y-1">
          {forecast.reasons.slice(0, 6).map((r, i) => (
            <li key={i} className="text-[12px] leading-snug" style={{ color: "var(--sos-text-2)" }}>
              • {r}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
        Client pace: ~{forecast.pace.avg_wait_days}d per approval (plan allows {forecast.pace.allowance_days}d) · {forecast.pace.avg_rounds} rounds per stage
        {forecast.pace.samples ? ` · from ${forecast.pace.samples} approvals` : " · no history yet"}
      </p>

      {isOwner && (
        <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--sos-border)" }}>
          {!ai && (
            <button type="button" disabled={busy} onClick={explain} className="text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60" style={{ color: "var(--sos-primary)" }}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} What should I do about this timeline?
            </button>
          )}
          {error && <p className="text-[12px]" style={{ color: "#B42318" }}>{error}</p>}
          {ai && (
            <div className="space-y-2">
              <p className="text-[13px] leading-snug" style={{ color: "var(--sos-text-1)" }}>
                <Sparkles className="w-3.5 h-3.5 inline mr-1" style={{ color: "var(--sos-primary)" }} />
                {ai.note}
              </p>
              {ai.client_message && (
                <div className="p-3 rounded-[12px] space-y-1.5" style={{ background: "var(--sos-surface-2)" }}>
                  <p className="text-[11px] font-semibold uppercase" style={{ color: "var(--sos-text-3)" }}>
                    Message for the client
                  </p>
                  <p className="text-[12px] whitespace-pre-line" style={{ color: "var(--sos-text-1)" }}>
                    {ai.client_message}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(ai.client_message);
                      pushToast("Message copied", "success");
                    }}
                    className="text-[11px] font-semibold inline-flex items-center gap-1"
                    style={{ color: "var(--sos-primary)" }}
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              )}
              <button type="button" disabled={busy} onClick={explain} className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>
                {busy ? "Thinking…" : "Ask again"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
