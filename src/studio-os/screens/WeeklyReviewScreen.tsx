import React, { useMemo } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2, Plus, Sparkles, Wallet } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";

export const WeeklyReviewScreen: React.FC = () => {
  const {
    projects,
    gates,
    payments,
    settings,
    realOverrunCalibration,
    applyCalibratedOverrunFactor,
    getProjectForecast,
    openProject,
    addTask,
    pushToast,
  } = useStudioOS();

  const today = useMemo(() => new Date(), []);

  const forecastRows = useMemo(() => {
    return projects
      .filter((p) => !["delivered", "paid", "lost", "parked"].includes(p.status))
      .map((p) => {
        const f = getProjectForecast(p.id);
        const deltaDays =
          f && p.hard_deadline
            ? differenceInCalendarDays(parseISO(f.forecast_date), parseISO(p.hard_deadline))
            : null;
        return { project: p, forecast: f, deltaDays };
      });
  }, [projects, getProjectForecast]);

  const gateActualRows = useMemo(() => {
    return gates
      .filter((g) => g.status === "approved" && typeof g.actual_days === "number" && g.estimate_days > 0)
      .map((g) => {
        const proj = projects.find((p) => p.id === g.project_id);
        const ratio = Math.round(((g.actual_days || 0) / g.estimate_days) * 100) / 100;
        return { gate: g, project: proj, ratio };
      })
      .slice(0, 16);
  }, [gates, projects]);

  const staleLeads = useMemo(() => {
    return projects
      .filter((p) => p.status === "lead" || p.status === "quoted")
      .map((p) => {
        const touchIso = p.last_client_touch_at || p.updated_at;
        const silentDays = Math.max(0, differenceInCalendarDays(today, parseISO(touchIso)));
        return { project: p, silentDays };
      })
      .filter((x) => x.silentDays > 14)
      .sort((a, b) => b.silentDays - a.silentDays);
  }, [projects, today]);

  const outstandingInvoices = useMemo(() => {
    return payments.filter((pay) => pay.status !== "paid");
  }, [payments]);

  const handleScheduleFollowUp = (projectId: string, code: string, title: string) => {
    addTask({
      project_id: projectId,
      title: `Follow up stale lead: ${title}`,
      type: "follow_up",
      status: "todo",
      priority: "high",
      do_date: format(today, "yyyy-MM-dd"),
      due_date: format(today, "yyyy-MM-dd"),
      estimate_hours: 0.5,
      is_in_now: false,
    });
    pushToast(`Added follow-up task for ${code}`, "success");
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold mb-2"
            style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
          >
            Sunday 18:00 IST Cadence
          </span>
          <h1
            className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--sos-text-1)" }}
          >
            Weekly Review
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Calibrate forecast velocity, inspect gate actuals vs estimates, revive quiet leads, and track unpaid invoices.
          </p>
        </div>
      </div>

      {/* Overrun Calibration Banner */}
      <section className="sos-card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-primary)" }}>
            Velocity Calibration
          </p>
          <p className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Your real overrun factor:{" "}
            <span className="sos-tabular" style={{ color: "var(--sos-primary)" }}>
              {realOverrunCalibration.ratio}×
            </span>{" "}
            <span className="text-[14px] font-normal" style={{ color: "var(--sos-text-2)" }}>
              (from {realOverrunCalibration.gateCount} approved gates ·{" "}
              {realOverrunCalibration.totalActual}d actual vs {realOverrunCalibration.totalEstimated}d est.)
            </span>
          </p>
          <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
            Current forecast setting: <strong>{settings.overrun_factor}×</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={applyCalibratedOverrunFactor}
          disabled={
            realOverrunCalibration.gateCount === 0 ||
            realOverrunCalibration.ratio === settings.overrun_factor
          }
          className="sos-pill-btn inline-flex items-center gap-1.5 px-5 h-11 text-[13px] font-semibold text-white disabled:opacity-45 shrink-0"
          style={{ background: "var(--sos-primary)" }}
        >
          <Sparkles className="w-4 h-4" />
          {realOverrunCalibration.ratio === settings.overrun_factor
            ? "Already Applied"
            : `Apply ${realOverrunCalibration.ratio}×`}
        </button>
      </section>

      {/* Forecast vs Deadline */}
      <section className="sos-card p-5 md:p-6 space-y-4">
        <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Forecast vs Hard Deadline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {forecastRows.map(({ project, forecast, deltaDays }) => (
            <button
              key={project.id}
              type="button"
              onClick={() => openProject(project.id)}
              className="sos-tile p-4 text-left flex items-center justify-between gap-3 hover:brightness-[0.98]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold" style={{ color: "var(--sos-text-1)" }}>
                    {project.emoji} {project.code}
                  </span>
                  <HealthPill health={project.health} />
                </div>
                <p className="text-[14px] font-medium truncate mt-1" style={{ color: "var(--sos-text-1)" }}>
                  {project.title}
                </p>
                <p className="text-[12px] sos-tabular mt-0.5" style={{ color: "var(--sos-text-3)" }}>
                  {forecast?.explanation}
                </p>
              </div>

              <div className="text-right shrink-0 sos-tabular">
                <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                  Est {forecast ? format(parseISO(forecast.forecast_date), "d MMM") : "—"}
                </p>
                <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                  Due {project.hard_deadline ? format(parseISO(project.hard_deadline), "d MMM") : "Open"}
                </p>
                {deltaDays !== null && (
                  <p
                    className="text-[11px] font-bold mt-0.5"
                    style={{ color: deltaDays > 0 ? "var(--sos-red)" : "var(--sos-green)" }}
                  >
                    {deltaDays > 0 ? `+${deltaDays}d late` : `${Math.abs(deltaDays)}d buffer`}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Estimate vs Actual per Gate */}
        <section className="sos-card p-5 md:p-6 lg:col-span-6 space-y-4">
          <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            Gate Estimate vs Actual ({gateActualRows.length})
          </h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {gateActualRows.map(({ gate, project, ratio }) => (
              <div key={gate.id} className="sos-tile p-3 flex items-center justify-between gap-2 text-[13px]">
                <div className="min-w-0">
                  <span className="font-bold" style={{ color: "var(--sos-primary)" }}>
                    {project?.code} · {gate.code}
                  </span>{" "}
                  <span className="font-medium truncate" style={{ color: "var(--sos-text-1)" }}>
                    {gate.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 sos-tabular">
                  <span style={{ color: "var(--sos-text-3)" }}>Est {gate.estimate_days}d</span>
                  <span className="font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    Act {gate.actual_days}d
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: ratio > 1.5 ? "#FFF3E0" : "#E7F7EE",
                      color: ratio > 1.5 ? "#9A4A00" : "#17663F",
                    }}
                  >
                    {ratio}×
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stale Leads & Outstanding Invoices */}
        <div className="lg:col-span-6 space-y-5">
          {/* Stale Leads (>14 days silent) */}
          <section className="sos-card p-5 md:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Stale Leads (&gt;14d silent)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold bg-[#FFF3E0] text-[#9A4A00]">
                {staleLeads.length}
              </span>
            </div>

            {staleLeads.length === 0 ? (
              <p className="text-[13px] inline-flex items-center gap-1.5" style={{ color: "var(--sos-green)" }}>
                <CheckCircle2 className="w-4 h-4" /> All leads contacted within 14 days.
              </p>
            ) : (
              <div className="space-y-2.5">
                {staleLeads.map(({ project, silentDays }) => (
                  <div key={project.id} className="sos-tile p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                        {project.emoji} {project.title}
                      </p>
                      <p className="text-[12px] text-[#9A4A00] sos-tabular">
                        Silent for {silentDays} days · Status: {project.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleScheduleFollowUp(project.id, project.code, project.title)}
                      className="sos-pill-btn inline-flex items-center gap-1 px-3.5 h-8 text-[12px] font-semibold text-white shrink-0"
                      style={{ background: "var(--sos-primary)" }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Follow up
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Outstanding Invoices */}
          <section className="sos-card p-5 md:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="sos-display text-[20px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
                <Wallet className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />
                Outstanding Invoices
              </h2>
              <span
                className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold"
                style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
              >
                {outstandingInvoices.length}
              </span>
            </div>

            <div className="space-y-2">
              {outstandingInvoices.map((inv) => {
                const proj = projects.find((p) => p.id === inv.project_id);
                const overdue = inv.status === "overdue";
                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => proj && openProject(proj.id)}
                    className="w-full text-left sos-tile p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                        {inv.invoice_no || "Draft Invoice"} · {proj?.emoji} {proj?.code}
                      </p>
                      <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
                        {inv.notes || (inv.due_at ? `Due ${inv.due_at}` : "Draft")}
                      </p>
                    </div>
                    <div className="text-right shrink-0 sos-tabular">
                      <p className="text-[14px] font-bold" style={{ color: "var(--sos-text-1)" }}>
                        {proj?.is_confidential
                          ? "Confidential"
                          : inv.currency === "USD"
                          ? `$${inv.amount.toLocaleString()}`
                          : inv.currency === "EUR"
                          ? `€${inv.amount.toLocaleString()}`
                          : `₹${inv.amount.toLocaleString("en-IN")}`}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase"
                        style={{ color: overdue ? "var(--sos-red)" : "var(--sos-text-3)" }}
                      >
                        {overdue && <AlertCircle className="w-3 h-3" />}
                        {inv.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
