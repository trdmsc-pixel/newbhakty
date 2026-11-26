import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Lock, Plus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";

export const ProjectsScreen: React.FC = () => {
  const { projects, clients, gates, tasks, openProject, setNewProjectOpen } = useStudioOS();
  const [filter, setFilter] = useState<"active" | "pipeline" | "delivered" | "all">("active");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (filter === "active") return p.status === "active" || p.status === "on_hold";
      if (filter === "pipeline") return p.status === "lead" || p.status === "quoted";
      if (filter === "delivered") return p.status === "delivered" || p.status === "paid";
      return true;
    });
  }, [projects, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            Projects
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Every production with live forecast date, health status, and current gate.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="sos-pill-btn inline-flex items-center gap-1.5 px-5 h-11 text-[14px] font-semibold text-white self-start"
          style={{ background: "var(--sos-primary)" }}
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex p-1 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
        {(
          [
            { id: "active", label: "Active" },
            { id: "pipeline", label: "Leads & Quotes" },
            { id: "delivered", label: "Delivered" },
            { id: "all", label: "All" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className="px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors"
            style={{
              background: filter === t.id ? "var(--sos-surface)" : "transparent",
              color: filter === t.id ? "var(--sos-text-1)" : "var(--sos-text-2)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Poster Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sos-stagger">
        {filtered.map((p) => {
          const client = clients.find((c) => c.id === p.client_id);
          const pGates = gates.filter((g) => g.project_id === p.id);
          const approved = pGates.filter((g) => g.status === "approved").length;
          const pct = pGates.length ? Math.round((approved / pGates.length) * 100) : 0;
          const currentGate = pGates.find((g) => g.status !== "approved" && g.status !== "skipped");
          const openTaskCount = tasks.filter((t) => t.project_id === p.id && t.status !== "done").length;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p.id)}
              className="sos-card p-5 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold"
                    style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}
                  >
                    {p.emoji} {p.code}
                    {p.is_confidential && <Lock className="w-3 h-3 text-[#5B3FE4]" />}
                  </span>
                  <HealthPill health={p.health} />
                </div>

                <div>
                  <h3 className="sos-display text-[20px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>
                    {p.title}
                  </h3>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--sos-text-2)" }}>
                    {client?.name}
                  </p>
                </div>

                {currentGate && (
                  <p className="text-[12px] font-medium" style={{ color: "var(--sos-text-2)" }}>
                    Stage: <strong style={{ color: "var(--sos-text-1)" }}>{currentGate.code} {currentGate.name}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2.5 pt-3 border-t" style={{ borderColor: "var(--sos-border)" }}>
                <div className="flex items-center justify-between text-[12px] sos-tabular" style={{ color: "var(--sos-text-2)" }}>
                  <span>
                    Forecast: <strong style={{ color: "var(--sos-text-1)" }}>{p.forecast_date ? format(parseISO(p.forecast_date), "d MMM") : "—"}</strong>
                  </span>
                  <span>
                    Deadline: <strong style={{ color: p.health === "late" ? "var(--sos-red)" : "var(--sos-text-1)" }}>{p.hard_deadline ? format(parseISO(p.hard_deadline), "d MMM") : "Open"}</strong>
                  </span>
                </div>
                <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
                  <div className="h-full rounded-full sos-stripe-green" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                  <span>{approved}/{pGates.length} gates approved</span>
                  <span>{openTaskCount} open tasks</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
