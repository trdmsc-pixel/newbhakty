import React, { useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { Flag, Sparkles } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { computeProjectForecast } from "../forecastEngine";
import { GateStatus, StudioGate } from "../types";
import { HealthPill } from "../components/StatusChip";

type ZoomLevel = "week" | "month" | "quarter";

const ZOOM_CONFIG: Record<ZoomLevel, { label: string; days: number; pxPerDay: number }> = {
  week: { label: "Week", days: 16, pxPerDay: 48 },
  month: { label: "Month", days: 35, pxPerDay: 24 },
  quarter: { label: "Quarter", days: 84, pxPerDay: 12 },
};

const GATE_BAR_COLORS: Record<GateStatus, { bg: string; text: string }> = {
  approved: { bg: "#3FA37A", text: "#FFFFFF" },
  in_work: { bg: "#2F6BFF", text: "#FFFFFF" },
  waiting_on_client: { bg: "#F59E0B", text: "#0F1115" },
  revising: { bg: "#EA580C", text: "#FFFFFF" },
  not_started: { bg: "#DCE3EE", text: "#374151" },
  skipped: { bg: "#E5E7EB", text: "#6B7280" },
};

export const TimelineScreen: React.FC = () => {
  const { projects, gates, clients, settings, holidays, updateGate, openProject, setRoute, darkMode } =
    useStudioOS();

  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [draftEstimates, setDraftEstimates] = useState<Record<string, number>>({});
  const dragRef = useRef<{
    gateId: string;
    startX: number;
    origEstimate: number;
    currentEstimate: number;
  } | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const cfg = ZOOM_CONFIG[zoom];
  const windowStart = useMemo(() => addDays(today, -3), [today]);
  const totalWidth = cfg.days * cfg.pxPerDay;
  const todayOffsetPx = 3 * cfg.pxPerDay;

  const visibleProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter === "active") return p.status === "active" || p.status === "on_hold";
      return !["lost", "parked"].includes(p.status);
    });
  }, [projects, statusFilter]);

  // Apply live draft estimate overrides while dragging
  const effectiveGates = useMemo(() => {
    const keys = Object.keys(draftEstimates);
    if (keys.length === 0) return gates;
    return gates.map((g) =>
      draftEstimates[g.id] !== undefined ? { ...g, estimate_days: draftEstimates[g.id] } : g
    );
  }, [gates, draftEstimates]);

  const dateTicks = useMemo(() => {
    const step = zoom === "week" ? 1 : zoom === "month" ? 3 : 7;
    const ticks: Array<{ offsetPx: number; label: string; isToday: boolean }> = [];
    for (let d = 0; d < cfg.days; d += step) {
      const dt = addDays(windowStart, d);
      ticks.push({
        offsetPx: d * cfg.pxPerDay,
        label: format(dt, zoom === "quarter" ? "d MMM" : "d MMM"),
        isToday: d === 3,
      });
    }
    return ticks;
  }, [cfg.days, cfg.pxPerDay, windowStart, zoom]);

  const handleEdgePointerDown = (e: React.PointerEvent<HTMLDivElement>, gate: StudioGate) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const orig = draftEstimates[gate.id] ?? gate.estimate_days;
    dragRef.current = {
      gateId: gate.id,
      startX: e.clientX,
      origEstimate: orig,
      currentEstimate: orig,
    };
  };

  const handleEdgePointerMove = (e: React.PointerEvent<HTMLDivElement>, gate: StudioGate) => {
    if (!dragRef.current || dragRef.current.gateId !== gate.id) return;
    const deltaX = e.clientX - dragRef.current.startX;
    const rawDeltaDays = deltaX / cfg.pxPerDay / Math.max(1, settings.overrun_factor);
    const nextEst = Math.max(0.5, Math.min(45, Math.round((dragRef.current.origEstimate + rawDeltaDays) * 2) / 2));
    dragRef.current.currentEstimate = nextEst;
    setDraftEstimates((prev) => ({ ...prev, [gate.id]: nextEst }));
  };

  const handleEdgePointerUp = (e: React.PointerEvent<HTMLDivElement>, gate: StudioGate) => {
    if (!dragRef.current || dragRef.current.gateId !== gate.id) return;
    const finalEst = dragRef.current.currentEstimate;
    const origEst = dragRef.current.origEstimate;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setDraftEstimates((prev) => {
      const copy = { ...prev };
      delete copy[gate.id];
      return copy;
    });
    if (finalEst !== origEst) {
      updateGate(gate.id, { estimate_days: finalEst });
    }
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Header + Board/Timeline/Table Switcher + Zoom */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h1
            className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--sos-text-1)" }}
          >
            Timeline
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Drag the right edge of any upcoming gate bar to adjust estimate days and recalculate delivery live.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Board / Timeline / Table Segmented Pill */}
          <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
            <button
              type="button"
              onClick={() => setRoute("board")}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium"
              style={{ color: "var(--sos-text-2)" }}
            >
              Board
            </button>
            <button
              type="button"
              className="px-4 py-1.5 rounded-full text-[13px] font-semibold text-white"
              style={{ background: "var(--sos-blue)" }}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => setRoute("table")}
              className="px-4 py-1.5 rounded-full text-[13px] font-medium"
              style={{ color: "var(--sos-text-2)" }}
            >
              Table
            </button>
          </div>

          {/* Week / Month / Quarter Zoom */}
          <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
            {(["week", "month", "quarter"] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoom(z)}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-colors"
                style={{
                  background: zoom === z ? "var(--sos-surface)" : "transparent",
                  color: zoom === z ? "var(--sos-text-1)" : "var(--sos-text-2)",
                }}
              >
                {ZOOM_CONFIG[z].label}
              </button>
            ))}
          </div>

          {/* Active vs All Filter */}
          <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
            {(["active", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className="px-3 py-1.5 rounded-full text-[12px] font-semibold capitalize transition-colors"
                style={{
                  background: statusFilter === f ? "var(--sos-surface)" : "transparent",
                  color: statusFilter === f ? "var(--sos-text-1)" : "var(--sos-text-2)",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#3FA37A]" /> Approved
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2F6BFF]" /> In Work
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B]" /> Waiting on Client
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#EA580C]" /> Revising
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Flag className="w-3.5 h-3.5" style={{ color: "var(--sos-ink)" }} /> Hard Deadline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed" style={{ borderColor: "var(--sos-primary)" }} /> Forecast
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#E5484D]">
          <span className="w-3 h-3 rounded bg-[#E5484D]/25 border border-[#E5484D]" /> Late overrun gap
        </span>
      </div>

      {/* Gantt Card */}
      <div className="sos-card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${260 + totalWidth}px` }}>
            {/* Top Axis Row */}
            <div
              className="flex border-b h-11 items-center"
              style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}
            >
              <div
                className="w-[240px] md:w-[270px] shrink-0 px-4 text-[12px] font-semibold uppercase tracking-wide sticky left-0 z-20 h-full flex items-center border-r"
                style={{
                  background: "var(--sos-surface-2)",
                  borderColor: "var(--sos-border)",
                  color: "var(--sos-text-3)",
                }}
              >
                Production
              </div>

              <div className="relative flex-1 h-full" style={{ width: `${totalWidth}px` }}>
                {dateTicks.map((t) => (
                  <span
                    key={t.offsetPx}
                    className="absolute top-1/2 -translate-y-1/2 text-[11px] sos-tabular font-medium"
                    style={{
                      left: `${t.offsetPx + 4}px`,
                      color: t.isToday ? "var(--sos-blue)" : "var(--sos-text-3)",
                    }}
                  >
                    {t.label}
                  </span>
                ))}

                {/* Blue "Today" Pill */}
                <div
                  className="absolute top-1.5 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm z-20"
                  style={{ left: `${todayOffsetPx}px`, background: "var(--sos-blue)" }}
                >
                  Today
                </div>
              </div>
            </div>

            {/* Project Rows */}
            <div className="relative divide-y" style={{ borderColor: "var(--sos-border)" }}>
              {/* Blue vertical Today line across all rows */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-[2px] z-10"
                style={{ left: `${270 + todayOffsetPx}px`, background: "var(--sos-blue)", opacity: 0.7 }}
              />

              {visibleProjects.map((project) => {
                const client = clients.find((c) => c.id === project.client_id);
                const liveForecast = computeProjectForecast(
                  project,
                  effectiveGates,
                  client,
                  settings,
                  holidays,
                  today
                );
                const forecastDt = parseISO(liveForecast.forecast_date);
                const deadlineDt = project.hard_deadline ? parseISO(project.hard_deadline) : null;

                const projGates = effectiveGates
                  .filter((g) => g.project_id === project.id && g.status !== "skipped" && !["G9", "G10"].includes(g.code))
                  .sort((a, b) => a.order_index - b.order_index);

                // Place approved gates right before Today and remaining gates spanning Today -> forecastDt
                const approvedGates = projGates.filter((g) => g.status === "approved");
                const remainingGates = projGates.filter((g) => g.status !== "approved");

                const forecastDayOffset = Math.max(1, differenceInCalendarDays(forecastDt, windowStart));
                const forecastPx = forecastDayOffset * cfg.pxPerDay;
                const deadlineDayOffset = deadlineDt
                  ? differenceInCalendarDays(deadlineDt, windowStart)
                  : null;
                const deadlinePx = deadlineDayOffset !== null ? deadlineDayOffset * cfg.pxPerDay : null;

                const isLate = Boolean(deadlinePx !== null && forecastPx > deadlinePx);

                const totalRawRemaining = remainingGates.reduce(
                  (sum, g) =>
                    sum +
                    Math.max(0.25, g.estimate_days) * settings.overrun_factor +
                    (g.needs_client_approval
                      ? client?.avg_approval_latency_days ?? settings.default_approval_latency_days
                      : 0),
                  0
                );
                const forecastSpanPx = Math.max(cfg.pxPerDay, forecastPx - todayOffsetPx);

                // Layout segments for remaining gates proportionally from Today to forecastPx
                let cursorPx = todayOffsetPx;
                const remainingBars = remainingGates.map((g) => {
                  const weight =
                    Math.max(0.25, g.estimate_days) * settings.overrun_factor +
                    (g.needs_client_approval
                      ? client?.avg_approval_latency_days ?? settings.default_approval_latency_days
                      : 0);
                  const wPx =
                    totalRawRemaining > 0
                      ? Math.max(14, (weight / totalRawRemaining) * forecastSpanPx)
                      : cfg.pxPerDay;
                  const seg = { gate: g, left: cursorPx, width: wPx };
                  cursorPx += wPx;
                  return seg;
                });

                // Condensed approved bars to the left of Today inside the -3d margin
                const recentApproved = approvedGates.slice(-2);
                const approvedBars = recentApproved.map((g, idx) => {
                  const slotWidth = Math.min(34, todayOffsetPx / Math.max(1, recentApproved.length));
                  return {
                    gate: g,
                    left: Math.max(4, todayOffsetPx - (recentApproved.length - idx) * slotWidth - 2),
                    width: Math.max(18, slotWidth - 3),
                  };
                });

                return (
                  <div
                    key={project.id}
                    className="flex items-center min-h-[78px]"
                    style={{ borderColor: "var(--sos-border)" }}
                  >
                    {/* Sticky Left Project Cell */}
                    <button
                      type="button"
                      onClick={() => openProject(project.id)}
                      className="w-[240px] md:w-[270px] shrink-0 px-4 py-3 text-left sticky left-0 z-20 border-r flex flex-col gap-1 hover:brightness-[0.98]"
                      style={{
                        background: "var(--sos-surface)",
                        borderColor: "var(--sos-border)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold truncate" style={{ color: "var(--sos-text-1)" }}>
                          {project.emoji} {project.code}
                        </span>
                        <HealthPill health={liveForecast.health} />
                      </div>
                      <p className="text-[12px] truncate font-medium" style={{ color: "var(--sos-text-2)" }}>
                        {project.title}
                      </p>
                      <p className="text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                        Est {format(forecastDt, "d MMM")}
                        {deadlineDt ? ` · Due ${format(deadlineDt, "d MMM")}` : ""}
                        {liveForecast.holiday_days > 0 ? ` · +${liveForecast.holiday_days}d hol` : ""}
                      </p>
                    </button>

                    {/* Horizontal Bar Track */}
                    <div className="relative flex-1 h-[78px]" style={{ width: `${totalWidth}px` }}>
                      {/* Red Gap Shading ONLY if Forecast > Deadline */}
                      {isLate && deadlinePx !== null && (
                        <div
                          className="absolute top-3 bottom-3 rounded-[10px] border border-[#E5484D]/50 pointer-events-none"
                          style={{
                            left: `${Math.max(0, deadlinePx)}px`,
                            width: `${Math.max(6, forecastPx - deadlinePx)}px`,
                            background: "rgba(229, 72, 77, 0.16)",
                          }}
                          title={`Projected ${differenceInCalendarDays(forecastDt, deadlineDt!)} days late`}
                        />
                      )}

                      {/* Approved mini-bars before Today */}
                      {approvedBars.map(({ gate, left, width }) => (
                        <div
                          key={gate.id}
                          title={`${gate.code} ${gate.name} (Approved)`}
                          onClick={() => openProject(project.id)}
                          className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer truncate px-1.5 shadow-xs"
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            backgroundColor: GATE_BAR_COLORS.approved.bg,
                            color: GATE_BAR_COLORS.approved.text,
                          }}
                        >
                          {gate.code}
                        </div>
                      ))}

                      {/* Remaining Interactive Gate Bars */}
                      {remainingBars.map(({ gate, left, width }) => {
                        const colors =
                          gate.status === "not_started" && darkMode
                            ? { bg: "#27272D", text: "#EDEDEF" }
                            : GATE_BAR_COLORS[gate.status];
                        const activeDraft = draftEstimates[gate.id];
                        return (
                          <div
                            key={gate.id}
                            title={`${gate.code} ${gate.name} · Est ${gate.estimate_days}d (drag right edge)`}
                            className="group absolute top-1/2 -translate-y-1/2 h-9 rounded-full flex items-center px-2.5 pr-3 select-none shadow-xs border border-black/5"
                            style={{
                              left: `${left}px`,
                              width: `${Math.max(16, width - 2)}px`,
                              backgroundColor: colors.bg,
                              color: colors.text,
                            }}
                          >
                            <span className="text-[11px] font-semibold truncate pointer-events-none">
                              {width > 56
                                ? `${gate.code} · ${gate.estimate_days}d`
                                : gate.code}
                            </span>

                            {activeDraft !== undefined && (
                              <span
                                className="absolute -top-6 right-0 px-2 py-0.5 rounded-full text-[10px] font-bold shadow"
                                style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
                              >
                                {activeDraft}d
                              </span>
                            )}

                            {/* Draggable Right Edge Handle */}
                            <div
                              onPointerDown={(e) => handleEdgePointerDown(e, gate)}
                              onPointerMove={(e) => handleEdgePointerMove(e, gate)}
                              onPointerUp={(e) => handleEdgePointerUp(e, gate)}
                              title="Drag to resize estimate days"
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center rounded-r-full opacity-70 group-hover:opacity-100"
                            >
                              <span className="w-0.5 h-3.5 rounded-full bg-current opacity-60" />
                            </div>
                          </div>
                        );
                      })}

                      {/* Hard Deadline Thin Black Flag Marker */}
                      {deadlinePx !== null && deadlinePx >= 0 && deadlinePx <= totalWidth && (
                        <div
                          className="absolute top-1.5 bottom-1.5 w-[2px] z-20 pointer-events-none"
                          style={{ left: `${deadlinePx}px`, background: "var(--sos-ink)" }}
                          title={`Hard Deadline: ${project.hard_deadline}`}
                        >
                          <div
                            className="absolute -top-0.5 left-0 px-1.5 py-0.5 rounded-r-full text-[9px] font-bold flex items-center gap-0.5 whitespace-nowrap"
                            style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
                          >
                            <Flag className="w-2.5 h-2.5" />
                            {format(deadlineDt!, "d MMM")}
                          </div>
                        </div>
                      )}

                      {/* Dashed Forecast End Vertical Marker */}
                      {forecastPx >= 0 && forecastPx <= totalWidth && (
                        <div
                          className="absolute top-2 bottom-2 border-l-2 border-dashed z-15 pointer-events-none"
                          style={{
                            left: `${forecastPx}px`,
                            borderColor: isLate ? "var(--sos-red)" : "var(--sos-primary)",
                          }}
                          title={`Predicted Forecast: ${liveForecast.forecast_date}`}
                        >
                          <span
                            className="absolute -bottom-0.5 left-1 text-[10px] font-bold whitespace-nowrap inline-flex items-center gap-0.5"
                            style={{ color: isLate ? "var(--sos-red)" : "var(--sos-primary)" }}
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            {format(forecastDt, "d MMM")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
