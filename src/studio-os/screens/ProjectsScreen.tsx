import React, { useEffect, useMemo, useState } from "react";
import { SegToggle } from "../../review/SegToggle";
import { AnimatePresence, motion } from "motion/react";
import { SwipeRow } from "../motion";
import { usePortalPresence } from "../components/PortalPresence";

const STATUS_ORDER: StudioProject["status"][] = ["lead", "quoted", "active", "on_hold", "parked", "delivered", "paid", "lost"];
const SOFT_STATUS: Record<string, React.CSSProperties> = {
  lead: { background: "#E8F0FF", color: "#1D4FD8" },
  quoted: { background: "#E8F0FF", color: "#1D4FD8" },
  active: { background: "var(--sos-violet-soft)", color: "var(--sos-primary)" },
  on_hold: { background: "#FFF3E0", color: "#9A4A00" },
  parked: { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" },
  delivered: { background: "#E7F7EE", color: "#17663F" },
  paid: { background: "#E7F7EE", color: "#17663F" },
  lost: { background: "var(--sos-surface-2)", color: "var(--sos-text-3)" },
};
const STATUS_LABEL: Record<string, string> = { lead: "Lead", quoted: "Quoted", active: "Active", on_hold: "On hold", parked: "Parked", delivered: "Done · delivered", paid: "Paid", lost: "Lost / scrapped" };
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
  const { projects, clients, gates, tasks, openProject, setNewProjectOpen, updateProject, pushToast } = useStudioOS();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const setStatus = (ids: string[], status: StudioProject["status"]) => {
    const now = new Date().toISOString();
    for (const id of ids) {
      const closing = status === "delivered" || status === "paid";
      updateProject(id, closing ? { status, closed_at: now, health: "on_track" } : status === "active" ? { status, closed_at: undefined } : { status });
    }
    pushToast(`${ids.length} project${ids.length > 1 ? "s" : ""} → ${STATUS_LABEL[status]}`, "success");
  };
  const { supabaseSyncStatus } = useStudioOS();
  type PFilter = "active" | "waiting" | "risk" | "pipeline" | "paused" | "delivered" | "lost" | "all";
  const [filter, setFilter] = useState<PFilter>("active");
  const matches = (p: StudioProject, f: PFilter) => {
    const open = !p.closed_at && !["delivered", "paid", "lost"].includes(p.status);
    if (f === "active") return open && p.status === "active";
    if (f === "waiting") return open && gates.some((g) => g.project_id === p.id && g.status === "waiting_on_client");
    if (f === "risk") return open && (p.health === "late" || p.health === "at_risk");
    if (f === "pipeline") return p.status === "lead" || p.status === "quoted";
    if (f === "paused") return p.status === "on_hold" || p.status === "parked";
    if (f === "delivered") return !["lost"].includes(p.status) && (p.status === "delivered" || p.status === "paid" || Boolean(p.closed_at));
    if (f === "lost") return p.status === "lost";
    return true;
  };
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
  const [focusIdx, setFocusIdx] = useState(-1);
  const [sheetFor, setSheetFor] = useState<string[] | null>(null);
  type SavedView = { id: string; name: string; filter: string; client: string; mode: "list" | "cards" };
  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("sos-project-views") || "[]");
    } catch {
      return [];
    }
  });
  const persistViews = (v: SavedView[]) => {
    setViews(v);
    try {
      localStorage.setItem("sos-project-views", JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };
  const presence = usePortalPresence();
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
      if (!matches(p, filter)) return false;
      return true;
    });
  }, [projects, filter, clientFilter, gates]);

  // Keyboard: J/K or ↓/↑ move · X select · D done · S status · Enter open · Esc clear.
  useEffect(() => {
    if (mode !== "list") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      const k = e.key.toLowerCase();
      const cur = filtered[focusIdx];
      if (k === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (k === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(0, i - 1));
      } else if (k === "x" && cur) {
        toggleSel(cur.id);
      } else if (k === "d" && (selected.size || cur)) {
        setStatus(selected.size ? [...selected] : [cur!.id], "delivered");
        setSelected(new Set());
      } else if (k === "s" && (selected.size || cur)) {
        setSheetFor(selected.size ? [...selected] : [cur!.id]);
      } else if (e.key === "Enter" && cur) {
        openProject(cur.id);
      } else if (e.key === "Escape") {
        setSelected(new Set());
        setSheetFor(null);
        setFocusIdx(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filtered, focusIdx, selected]);
  useEffect(() => {
    if (focusIdx >= 0) document.getElementById(`sos-prow-${filtered[focusIdx]?.id}`)?.scrollIntoView({ block: "nearest" });
  }, [focusIdx, filtered]);

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
      <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider shrink-0 mr-1" style={{ color: "var(--sos-text-3)" }}>Views</span>
        {views.map((v) => {
          const on = v.filter === filter && v.client === clientFilter && v.mode === mode;
          return (
            <span key={v.id} className="group shrink-0 inline-flex items-center h-8 rounded-full border text-[12px] font-semibold overflow-hidden" style={on ? { background: "var(--sos-violet-soft)", color: "var(--sos-primary)", borderColor: "transparent" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)", borderColor: "var(--sos-border)" }}>
              <button type="button" onClick={() => { setFilter(v.filter as PFilter); setClientFilter(v.client); setMode(v.mode); }} className="pl-3 pr-2 h-full">
                ★ {v.name}
              </button>
              <button type="button" onClick={() => persistViews(views.filter((x) => x.id !== v.id))} className="pr-2.5 pl-0.5 h-full opacity-50 hover:opacity-100" aria-label={`Delete view ${v.name}`}>×</button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const cl = clients.find((c) => c.id === clientFilter)?.name;
            const name = window.prompt("Name this view", [cl, filter !== "all" ? filter.replace("risk", "at risk").replace("waiting", "waiting on client") : ""].filter(Boolean).join(" · ") || "My view");
            if (name?.trim()) persistViews([...views, { id: String(Date.now()), name: name.trim().slice(0, 40), filter, client: clientFilter, mode }]);
          }}
          className="shrink-0 h-8 px-3 rounded-full border border-dashed text-[12px] font-semibold"
          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
        >
          + Save current view
        </button>
      </div>
      <div className="w-full flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
        {(
          [
            { id: "active", label: "Active", tone: "var(--sos-primary)" },
            { id: "waiting", label: "Waiting on client", tone: "#D97706" },
            { id: "risk", label: "At risk", tone: "#DC2626" },
            { id: "pipeline", label: "Leads & quotes", tone: "#2563EB" },
            { id: "paused", label: "Paused", tone: "#64748B" },
            { id: "delivered", label: "Delivered", tone: "#16A34A" },
            { id: "lost", label: "Lost", tone: "#94A3B8" },
            { id: "all", label: "All", tone: "var(--sos-text-2)" },
          ] as const
        ).map((t) => {
          const count = projects.filter((p) => (!clientFilter || p.client_id === clientFilter) && matches(p, t.id)).length;
          if (!count && t.id !== "all" && t.id !== "active" && filter !== t.id) return null;
          const on = filter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className="relative shrink-0 h-9 pl-3 pr-2 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5 border transition-colors"
              style={on ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)", borderColor: "var(--sos-ink)" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)", borderColor: "var(--sos-border)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.tone }} />
              {t.label}
              <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center sos-tabular" style={{ background: on ? "rgba(255,255,255,0.18)" : "var(--sos-surface-2)" }}>{count}</span>
            </button>
          );
        })}
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
        <div className="ml-auto">
          <SegToggle id="sos-projects-mode" size="sm" value={mode} onChange={setMode} options={[{ id: "list", label: "List" }, { id: "cards", label: "Cards" }]} />
        </div>
      </div>

      {mode === "list" && (
        <div key={`${filter}-${clientFilter}`} className="space-y-2 sos-rows">
          {filtered.length === 0 && <p className="p-5 text-[13px]" style={{ color: "var(--sos-text-3)" }}>No projects here.</p>}
          {filtered.map((p, idx) => {
            const client = clients.find((c) => c.id === p.client_id);
            const pGates = gates.filter((g) => g.project_id === p.id);
            const approved = pGates.filter((g) => g.status === "approved" || g.status === "skipped").length;
            const pct = pGates.length ? Math.round((approved / pGates.length) * 100) : 0;
            const current = pGates.slice().sort((a, b) => a.order_index - b.order_index).find((g) => g.status !== "approved" && g.status !== "skipped");
            const openTaskCount = tasks.filter((t) => t.project_id === p.id && t.status !== "done").length;
            const badge = projectStatusBadge(p, pGates);
            const due = p.forecast_date || p.promised_date || p.hard_deadline;
            const waiting = current?.status === "waiting_on_client";
            const viewers = presence[p.id] || [];
            return (
              <SwipeRow
                key={p.id}
                radius={20}
                onDone={() => setStatus([p.id], "delivered")}
                onSnooze={() => setSheetFor([p.id])}
                doneLabel={<>✓ Mark done</>}
                snoozeLabel={<>Status ⋯</>}
                snoozeBg="#5B3FE4"
                style={{ background: "var(--sos-surface)" }}
              >
              <div
                id={`sos-prow-${p.id}`}
                role="button"
                tabIndex={0}
                onClick={() => openProject(p.id)}
                onMouseEnter={() => setFocusIdx(idx)}
                onKeyDown={(e) => e.key === "Enter" && openProject(p.id)}
                className="group w-full text-left flex items-center gap-4 p-3 pr-4 rounded-[20px] cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                style={{ ["--i" as any]: Math.min(idx, 14), background: selected.has(p.id) ? "var(--sos-violet-soft)" : "var(--sos-surface)", boxShadow: focusIdx === idx ? "0 0 0 2px rgba(124,92,255,0.45), 0 10px 26px -16px rgba(91,63,228,0.6)" : "0 0 0 1px var(--sos-border), 0 1px 2px rgba(15,17,21,0.04)" }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSel(p.id)}
                  className="w-4 h-4 shrink-0 accent-[#5B3FE4] cursor-pointer"
                  aria-label={`Select ${p.code}`}
                />
                <ProjectThumb candidates={thumbCandidates(p.cover_image_url, deliverables[p.id] || [])} resolveUrl={resolveStudioReviewUrl} emoji={p.emoji} className="sos-row-thumb w-[84px] h-14 rounded-[14px] shrink-0 overflow-hidden" style={{ background: "var(--sos-surface-2)" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold sos-tabular shrink-0" style={{ color: "var(--sos-primary)" }}>{p.code}</span>
                    <span className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{p.title}</span>
                    {p.is_confidential && <Lock className="w-3 h-3 shrink-0 text-[#5B3FE4]" />}
                    {viewers.length > 0 && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-bold" style={{ background: "#E7F7EE", color: "#17663F" }} title={viewers.map((v) => `${v.name}: ${v.activity}`).join("\n")}>
                        <span className="sos-live-dot" style={{ width: 6, height: 6 }} /> {viewers[0].name.split(" ")[0]} {viewers[0].activity.startsWith("Reviewing") ? "reviewing" : "viewing"} now
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] truncate flex items-center gap-1.5" style={{ color: waiting ? "#9A4A00" : "var(--sos-text-3)" }}>
                    {waiting && <span className="sos-live-dot shrink-0" style={{ color: "#F59E0B" }} />}
                    {client?.name || "—"} · {current ? `${current.name}${waiting ? " · waiting on client" : ""}` : "All stages done"}
                    {openTaskCount ? ` · ${openTaskCount} open` : ""}
                  </p>
                </div>
                <div className="hidden sm:block w-28 shrink-0">
                  <div className="sos-bar h-1.5" style={{ ["--i" as any]: Math.min(idx, 14) }}>
                    <span className={pct === 100 ? "done" : ""} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] mt-1 sos-tabular" style={{ color: "var(--sos-text-3)" }}>{approved}/{pGates.length} stages</p>
                </div>
                <div className="text-right shrink-0 w-24">
                  <p className="text-[13px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{due ? format(parseISO(due), "d MMM") : "—"}</p>
                  <HealthPill health={p.health} />
                </div>
                <select
                  value={p.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setStatus([p.id], e.target.value as StudioProject["status"])}
                  className="hidden md:block h-8 pl-3 pr-7 rounded-full text-[12px] font-semibold shrink-0 cursor-pointer transition-shadow hover:shadow-[0_0_0_3px_rgba(124,92,255,0.15)]"
                  style={SOFT_STATUS[p.status] || SOFT_STATUS.active}
                  aria-label={`Status of ${p.code}`}
                  title="Change status"
                >
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>{STATUS_LABEL[st]}</option>
                  ))}
                </select>
              </div>
              </SwipeRow>
            );
          })}
        </div>
      )}

      {mode === "list" && filtered.length > 0 && (
        <p className="hidden md:block text-[11px] -mt-2" style={{ color: "var(--sos-text-3)" }}>
          <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>J</kbd>/<kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>K</kbd> move · <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>X</kbd> select · <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>D</kbd> done · <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>S</kbd> status · <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>⏎</kbd> open · <kbd className="px-1 rounded border" style={{ borderColor: "var(--sos-border)" }}>Esc</kbd> clear
        </p>
      )}
      <p className="md:hidden text-[11px] -mt-2" style={{ color: "var(--sos-text-3)" }}>Swipe a project right to mark it done, left to change its status.</p>

      <AnimatePresence>
        {sheetFor && (
          <motion.div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheetFor(null)}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="w-full md:max-w-sm rounded-t-[26px] md:rounded-[26px] p-4 space-y-1.5 shadow-2xl"
              style={{ background: "var(--sos-surface)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto w-10 h-1 rounded-full mb-2 md:hidden" style={{ background: "var(--sos-border)" }} />
              <p className="text-[13px] font-semibold px-2 pb-1" style={{ color: "var(--sos-text-1)" }}>
                Set status · {sheetFor.length === 1 ? projects.find((x) => x.id === sheetFor[0])?.code : `${sheetFor.length} projects`}
              </p>
              {STATUS_ORDER.map((st) => (
                <button key={st} type="button" onClick={() => { setStatus(sheetFor, st); setSheetFor(null); setSelected(new Set()); }} className="w-full text-left h-11 px-3 rounded-[14px] text-[14px] font-medium hover:bg-black/[0.04]" style={{ color: st === "lost" ? "#B42318" : "var(--sos-text-1)" }}>
                  {STATUS_LABEL[st]}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center gap-2 pl-4 pr-2 py-2 rounded-full text-[13px] font-medium max-w-[calc(100vw-24px)]"
            style={{ background: "#16181D", color: "#fff", boxShadow: "0 18px 50px -12px rgba(91,63,228,0.55), 0 0 0 1px rgba(255,255,255,0.06)" }}
          >
            <span className="font-semibold">{selected.size} selected</span>
            <button type="button" onClick={() => setSelected(new Set(filtered.map((p) => p.id)))} className="h-8 px-3 rounded-full text-[12px] hover:bg-white/10">Select all ({filtered.length})</button>
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                setStatus([...selected], e.target.value as StudioProject["status"]);
                setSelected(new Set());
              }}
              className="h-8 pl-3 pr-7 rounded-full text-[12px] font-semibold cursor-pointer"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
              aria-label="Set status for selected"
            >
              <option value="" style={{ color: "#000" }}>Set status…</option>
              {STATUS_ORDER.map((st) => (
                <option key={st} value={st} style={{ color: "#000" }}>{STATUS_LABEL[st]}</option>
              ))}
            </select>
            <button type="button" onClick={() => { setStatus([...selected], "delivered"); setSelected(new Set()); }} className="h-8 px-3.5 rounded-full text-[12px] font-semibold" style={{ background: "linear-gradient(135deg, #22C55E, #17A34A)" }}>
              ✓ Mark done
            </button>
            <button type="button" onClick={() => { if (window.confirm(`Mark ${selected.size} project(s) as lost / scrapped?`)) { setStatus([...selected], "lost"); setSelected(new Set()); } }} className="h-8 px-3.5 rounded-full text-[12px] font-semibold" style={{ background: "rgba(239,68,68,0.9)" }}>
              Scrap
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10" aria-label="Clear selection">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

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
