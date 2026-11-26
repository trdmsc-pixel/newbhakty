import React, { useEffect, useMemo, useState } from "react";
import { GmailScanButton } from "../components/GmailScanButton";
import { supabase } from "../../lib/supabase";
import { ProjectThumb, thumbCandidates, type DeliverableLike } from "../../review/ProjectThumb";
import { resolveStudioReviewUrl } from "../components/ProjectDeliverables";
import type { StudioGate, StudioProject } from "../types";

/** Status shown on a project thumbnail. */
export function projectStatusBadge(p: StudioProject, pGates: StudioGate[]): { label: string; bg: string; fg: string } {
  if (p.closed_at) return { label: "✓ Completed & closed", bg: "#1F7A52", fg: "#FFFFFF" };
  if (p.status === "paid") return { label: "✓ Delivered · Paid", bg: "#1F7A52", fg: "#FFFFFF" };
  if (p.status === "delivered") return { label: "✓ Delivered", bg: "#1F7A52", fg: "#FFFFFF" };
  if (p.status === "lost") return { label: "Lost", bg: "rgba(15,17,21,0.75)", fg: "#FFFFFF" };
  if (p.status === "parked" || p.status === "on_hold") return { label: p.status === "parked" ? "Parked" : "On hold", bg: "#9A4A00", fg: "#FFFFFF" };
  if (p.status === "lead" || p.status === "quoted") return { label: p.status === "lead" ? "Lead" : "Quoted", bg: "#2563EB", fg: "#FFFFFF" };
  if (pGates.some((g) => g.status === "waiting_on_client")) return { label: "Awaiting client approval", bg: "#B45309", fg: "#FFFFFF" };
  if (pGates.some((g) => g.status === "revising")) return { label: "Revising", bg: "#5B3FE4", fg: "#FFFFFF" };
  return { label: "In production", bg: "rgba(15,17,21,0.75)", fg: "#FFFFFF" };
}
import { ViewSwitcher } from "../components/ViewSwitcher";
import { format, parseISO } from "date-fns";
import { Lock, Plus } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill } from "../components/StatusChip";

export const ProjectsScreen: React.FC = () => {
  const { projects, clients, gates, tasks, openProject, setNewProjectOpen } = useStudioOS();
  const { supabaseSyncStatus } = useStudioOS();
  const [filter, setFilter] = useState<"active" | "pipeline" | "delivered" | "all">("active");
  const [mode, setModeState] = useState<"cards" | "list">(() => {
    try {
      return (localStorage.getItem("sos-projects-mode") as "cards" | "list") || "list";
    } catch {
      return "list";
    }
  });
  const setMode = (m: "cards" | "list") => {
    setModeState(m);
    try {
      localStorage.setItem("sos-projects-mode", m);
    } catch {
      /* ignore */
    }
  };
  const [clientFilter, setClientFilter] = useState<string>("");
  const [deliverables, setDeliverables] = useState<Record<string, DeliverableLike[]>>({});
  useEffect(() => {
    if (supabaseSyncStatus !== "synced" || !supabase) return;
    supabase
      .from("studio_deliverables")
      .select("project_id, url, is_final, download_url, created_at")
      .is("archived_at", null)
      .then(({ data }) => {
        const map: Record<string, DeliverableLike[]> = {};
        for (const d of (data || []) as Array<DeliverableLike & { project_id: string }>) (map[d.project_id] ||= []).push(d);
        setDeliverables(map);
      });
  }, [supabaseSyncStatus]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (clientFilter && p.client_id !== clientFilter) return false;
      if (filter === "active") return (p.status === "active" || p.status === "on_hold") && !p.closed_at;
      if (filter === "pipeline") return p.status === "lead" || p.status === "quoted";
      if (filter === "delivered") return p.status === "delivered" || p.status === "paid" || Boolean(p.closed_at);
      return true;
    });
  }, [projects, filter, clientFilter]);

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

        <div className="flex flex-wrap items-center gap-2 self-start">
        <ViewSwitcher area="projects" />
        <GmailScanButton target="projects" />
        <button
          type="button"
          onClick={() => setNewProjectOpen(true)}
          className="sos-pill-btn inline-flex items-center gap-1.5 px-5 h-11 text-[14px] font-semibold text-white"
          style={{ background: "var(--sos-primary)" }}
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
        </div>
      </div>

      {/* Filter Tabs + client filter + view mode */}
      <div className="flex flex-wrap items-center gap-2">
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
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-10 pl-3.5 pr-8 rounded-full border text-[13px] font-semibold max-w-[220px]"
          style={{ background: clientFilter ? "var(--sos-violet-soft)" : "var(--sos-surface)", borderColor: "var(--sos-border)", color: clientFilter ? "var(--sos-primary)" : "var(--sos-text-2)" }}
          aria-label="Filter by client"
        >
          <option value="">All clients</option>
          {[...clients]
            .filter((c) => projects.some((p) => p.client_id === c.id))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({projects.filter((p) => p.client_id === c.id).length})
              </option>
            ))}
        </select>
        <div className="inline-flex p-1 rounded-full ml-auto" style={{ background: "var(--sos-surface-2)" }}>
          {(["list", "cards"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold capitalize" style={{ background: mode === m ? "var(--sos-surface)" : "transparent", color: mode === m ? "var(--sos-text-1)" : "var(--sos-text-2)" }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "list" && (
        <div className="sos-card overflow-hidden divide-y" style={{ borderColor: "var(--sos-border)" }}>
          {filtered.length === 0 && <p className="p-5 text-[13px]" style={{ color: "var(--sos-text-3)" }}>No projects here.</p>}
          {filtered.map((p) => {
            const client = clients.find((c) => c.id === p.client_id);
            const pGates = gates.filter((g) => g.project_id === p.id);
            const approved = pGates.filter((g) => g.status === "approved" || g.status === "skipped").length;
            const pct = pGates.length ? Math.round((approved / pGates.length) * 100) : 0;
            const current = pGates.slice().sort((a, b) => a.order_index - b.order_index).find((g) => g.status !== "approved" && g.status !== "skipped");
            const openTaskCount = tasks.filter((t) => t.project_id === p.id && t.status !== "done").length;
            const badge = projectStatusBadge(p, pGates);
            const due = p.forecast_date || p.promised_date || p.hard_deadline;
            const waiting = current?.status === "waiting_on_client";
            return (
              <button key={p.id} type="button" onClick={() => openProject(p.id)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]" style={{ borderColor: "var(--sos-border)" }}>
                <ProjectThumb candidates={thumbCandidates(p.cover_image_url, deliverables[p.id] || [])} resolveUrl={resolveStudioReviewUrl} emoji={p.emoji} className="w-14 h-10 rounded-[10px] shrink-0" style={{ background: "var(--sos-surface-2)" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold sos-tabular shrink-0" style={{ color: "var(--sos-primary)" }}>{p.code}</span>
                    <span className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{p.title}</span>
                    {p.is_confidential && <Lock className="w-3 h-3 shrink-0 text-[#5B3FE4]" />}
                  </div>
                  <p className="text-[12px] truncate" style={{ color: waiting ? "#9A4A00" : "var(--sos-text-3)" }}>
                    {client?.name || "—"} · {current ? `${current.name}${waiting ? " · waiting on client" : ""}` : "All stages done"}
                    {openTaskCount ? ` · ${openTaskCount} open` : ""}
                  </p>
                </div>
                <div className="hidden sm:block w-28 shrink-0">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--sos-primary)" }} />
                  </div>
                  <p className="text-[10px] mt-1 sos-tabular" style={{ color: "var(--sos-text-3)" }}>{approved}/{pGates.length} stages</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-[13px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{due ? format(parseISO(due), "d MMM") : "—"}</p>
                  <HealthPill health={p.health} />
                </div>
                <span className="hidden md:inline px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Poster Cards Grid */}
      {mode === "cards" && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sos-stagger">
        {filtered.map((p) => {
          const client = clients.find((c) => c.id === p.client_id);
          const pGates = gates.filter((g) => g.project_id === p.id);
          const approved = pGates.filter((g) => g.status === "approved").length;
          const pct = pGates.length ? Math.round((approved / pGates.length) * 100) : 0;
          const currentGate = pGates.find((g) => g.status !== "approved" && g.status !== "skipped");
          const openTaskCount = tasks.filter((t) => t.project_id === p.id && t.status !== "done").length;
          const badge = projectStatusBadge(p, pGates);

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openProject(p.id)}
              className="sos-card p-5 text-left flex flex-col justify-between gap-4 hover:-translate-y-0.5 overflow-hidden"
            >
              <ProjectThumb
                candidates={thumbCandidates(p.cover_image_url, deliverables[p.id] || [])}
                resolveUrl={resolveStudioReviewUrl}
                emoji={p.emoji}
                className="-mx-5 -mt-5 h-36"
                style={{ background: "var(--sos-surface-2)" }}
              >
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-sm" style={{ background: badge.bg, color: badge.fg }}>
                  {badge.label}
                </span>
              </ProjectThumb>
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
      </div>}
    </div>
  );
};
