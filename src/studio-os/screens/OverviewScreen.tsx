import React, { useMemo } from "react";
import { TeamLoadCard } from "../components/Team";
import { format, subDays, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";

export const OverviewScreen: React.FC = () => {
  const { tasks, projects, payments, gates, timeEntries, openProject, setRoute } = useStudioOS();

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const usdPending = payments
    .filter((p) => p.currency === "USD" && p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  // % of planned delivery gates approved across active & delivered projects
  const gateStats = useMemo(() => {
    const activeIds = new Set(
      projects.filter((p) => !["lost", "parked"].includes(p.status)).map((p) => p.id)
    );
    const planned = gates.filter(
      (g) => activeIds.has(g.project_id) && g.status !== "skipped" && !["G9", "G10"].includes(g.code)
    );
    const approved = planned.filter((g) => g.status === "approved").length;
    const pct = planned.length > 0 ? Math.round((approved / planned.length) * 100) : 0;
    return { approved, total: planned.length, pct };
  }, [projects, gates]);

  // Weekly Working Time Analysis (active vs pause hours over last 7 days from studio_time_entries)
  const weeklySeries = useMemo(() => {
    const today = new Date();
    const buckets: Array<{
      dateIso: string;
      day: string;
      activeHours: number;
      pauseHours: number;
    }> = [];

    for (let i = 6; i >= 0; i -= 1) {
      const dt = subDays(today, i);
      buckets.push({
        dateIso: format(dt, "yyyy-MM-dd"),
        day: format(dt, "EEE"),
        activeHours: 0,
        pauseHours: 0,
      });
    }

    const byDate = new Map(buckets.map((b) => [b.dateIso, b]));
    for (const te of timeEntries) {
      if (!te.started_at || !te.ended_at) continue;
      const start = parseISO(te.started_at);
      const end = parseISO(te.ended_at);
      const hrs = Math.max(0, (end.getTime() - start.getTime()) / 3600000);
      const dateIso = format(start, "yyyy-MM-dd");
      const bucket = byDate.get(dateIso);
      if (!bucket) continue;
      if (te.kind === "pause") bucket.pauseHours += hrs;
      else bucket.activeHours += hrs;
    }

    return buckets.map((b) => ({
      ...b,
      activeHours: Math.round(b.activeHours * 10) / 10,
      pauseHours: Math.round(b.pauseHours * 10) / 10,
    }));
  }, [timeEntries]);

  const weeklyTotals = useMemo(() => {
    const active = weeklySeries.reduce((s, d) => s + d.activeHours, 0);
    const pause = weeklySeries.reduce((s, d) => s + d.pauseHours, 0);
    return {
      active: Math.round(active * 10) / 10,
      pause: Math.round(pause * 10) / 10,
    };
  }, [weeklySeries]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1
            className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--sos-text-1)" }}
          >
            Overview
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Weekly studio rhythm, gate completion momentum, and live production health.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRoute("timeline")}
          className="sos-pill-btn px-4 h-10 text-[13px] font-semibold border self-start"
          style={{
            background: "var(--sos-surface)",
            borderColor: "var(--sos-border)",
            color: "var(--sos-text-1)",
          }}
        >
          Open Timeline Gantt →
        </button>
      </div>

      {/* Top Bento KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          className="rounded-[24px] p-6"
          style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
        >
          <p className="text-[13px] opacity-75">Open Tasks</p>
          <p className="sos-num text-[52px] font-semibold leading-none mt-2">{openCount}</p>
          <p className="text-[12px] opacity-70 mt-2">{doneCount} completed</p>
        </div>

        <div className="sos-card p-6">
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
            Active Productions
          </p>
          <p className="sos-num text-[52px] font-semibold leading-none mt-2" style={{ color: "var(--sos-text-1)" }}>
            {projects.filter((p) => p.status === "active").length}
          </p>
          <p className="text-[12px] mt-2" style={{ color: "var(--sos-text-3)" }}>
            {projects.filter((p) => p.status === "lead" || p.status === "quoted").length} in pipeline
          </p>
        </div>

        <div className="rounded-[24px] p-6" style={{ background: "var(--sos-yellow-card)", color: "#0F1115" }}>
          <p className="text-[13px] font-medium">USD Pipeline / Invoiced</p>
          <p className="sos-num text-[48px] font-semibold leading-none mt-2">${usdPending.toLocaleString()}</p>
          <p className="text-[12px] opacity-75 mt-2">Owner-only snapshot</p>
        </div>
      </div>

      {/* Monthly Striped Progress Bar ("% of planned gates approved") */}
      <section className="sos-card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Monthly Gate Progress
            </h2>
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              % of planned production gates approved across active &amp; delivered films
            </p>
          </div>
          <div className="text-right">
            <span className="sos-num text-[28px] font-semibold" style={{ color: "var(--sos-green)" }}>
              {gateStats.pct}%
            </span>
            <p className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
              {gateStats.approved} / {gateStats.total} gates approved
            </p>
          </div>
        </div>

        <div className="h-5 w-full rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
          <div
            className="h-full rounded-full sos-stripe-green transition-all duration-300"
            style={{ width: `${Math.min(100, gateStats.pct)}%` }}
          />
        </div>
      </section>

      {/* Weekly Working-Time Analysis Line Chart (Active vs Pause) */}
      <section className="sos-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Weekly Working-Time Analysis
            </h2>
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              Focus Timer logs from Supabase (`active` vs `pause` sessions over the last 7 days)
            </p>
          </div>
          <div className="flex items-center gap-4 text-[13px] sos-tabular">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--sos-primary)" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-[#5B3FE4]" />
              {weeklyTotals.active}h active
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#F59E0B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              {weeklyTotals.pause}h pause
            </span>
          </div>
        </div>

        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklySeries} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sos-border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--sos-text-3)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--sos-text-3)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                unit="h"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--sos-surface)",
                  border: "1px solid var(--sos-border)",
                  borderRadius: "16px",
                  color: "var(--sos-text-1)",
                  fontSize: "13px",
                }}
              />
              <Line
                type="monotone"
                dataKey="activeHours"
                name="Active focus (h)"
                stroke="#5B3FE4"
                strokeWidth={3}
                dot={{ r: 4, fill: "#5B3FE4", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="pauseHours"
                name="Pause / render breaks (h)"
                stroke="#F59E0B"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#F59E0B", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Project Health Poster Row */}
      <section className="sos-card p-6 space-y-4">
        <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Active Productions Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {projects
            .filter((p) => p.status === "active" || p.status === "on_hold")
            .map((p) => {
              const pGates = gates.filter((g) => g.project_id === p.id && !["G9", "G10"].includes(g.code));
              const doneGates = pGates.filter((g) => g.status === "approved").length;
              const pct = pGates.length ? Math.round((doneGates / pGates.length) * 100) : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProject(p.id)}
                  className="sos-tile p-4 text-left space-y-2.5 hover:brightness-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold truncate" style={{ color: "var(--sos-text-1)" }}>
                      {p.emoji} {p.code}
                    </span>
                    <HealthPill health={p.health} />
                  </div>
                  <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                    {p.title}
                  </p>
                  <div className="flex items-center justify-between text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                    <span>Est {p.forecast_date ? format(parseISO(p.forecast_date), "d MMM") : "—"}</span>
                    <span>{pct}% gates</span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>
      <TeamLoadCard />
    </div>
  );
};
