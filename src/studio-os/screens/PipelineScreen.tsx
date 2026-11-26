import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";
import { ViewSwitcher } from "../components/ViewSwitcher";

/** Projects grouped by the stage they're currently in (the project-level board). */
export const PipelineScreen: React.FC = () => {
  const { projects, gates, clients, openProject, setNewProjectOpen } = useStudioOS();

  const columns = useMemo(() => {
    const open = projects.filter((p) => !["lost", "paid", "parked"].includes(p.status));
    const map = new Map<string, { code: string; name: string; order: number; items: typeof open }>();
    const leads = { code: "LEAD", name: "Leads & quotes", order: -1, items: [] as typeof open };
    const done = { code: "DONE", name: "Delivered", order: 99, items: [] as typeof open };
    for (const p of open) {
      if (p.status === "lead" || p.status === "quoted") {
        leads.items.push(p);
        continue;
      }
      const pg = gates.filter((g) => g.project_id === p.id).sort((a, b) => a.order_index - b.order_index);
      const current = pg.find((g) => g.status !== "approved" && g.status !== "skipped");
      if (!current || p.status === "delivered") {
        done.items.push(p);
        continue;
      }
      const key = current.code;
      const n = parseInt(current.code.replace(/\D/g, ""), 10);
      if (!map.has(key)) map.set(key, { code: current.code, name: current.name, order: Number.isFinite(n) ? n : current.order_index, items: [] });
      map.get(key)!.items.push(p);
    }
    return [leads, ...[...map.values()].sort((a, b) => a.order - b.order), done].filter((c) => c.items.length || c.code === "LEAD");
  }, [projects, gates]);

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="sos-display text-[32px] md:text-[36px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            Projects
          </h1>
          <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
            Every production by the stage it's in right now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitcher area="projects" />
          <button type="button" onClick={() => setNewProjectOpen(true)} className="sos-pill-btn inline-flex items-center gap-1.5 px-5 h-11 text-[14px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 sos-stagger">
        {columns.map((col) => (
          <div key={col.code} className="min-w-[260px] w-[260px] shrink-0 rounded-[24px] p-3.5 space-y-3" style={{ background: "var(--sos-surface-2)" }}>
            <div className="flex items-center justify-between px-1">
              <span className="min-w-0">
                <span className="block sos-display text-[15px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{col.name}</span>
                {!["LEAD", "DONE"].includes(col.code) && (
                  <span className="block text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>{col.code}</span>
                )}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold sos-tabular" style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}>
                {col.items.length}
              </span>
            </div>
            {col.items.map((p) => {
              const client = clients.find((c) => c.id === p.client_id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProject(p.id)}
                  className="sos-card w-full text-left p-4 space-y-2"
                  style={{ borderRadius: 20 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-bold truncate" style={{ color: "var(--sos-text-2)" }}>
                      {p.emoji} {p.code}
                    </span>
                    <HealthPill health={p.health} />
                  </div>
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>{p.title}</p>
                  <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>{client?.name}</p>
                  {p.forecast_date && (
                    <p className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                      Forecast {format(parseISO(p.forecast_date), "d MMM yyyy")}
                    </p>
                  )}
                </button>
              );
            })}
            {col.items.length === 0 && (
              <p className="text-[12px] px-1" style={{ color: "var(--sos-text-3)" }}>Nothing here.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
