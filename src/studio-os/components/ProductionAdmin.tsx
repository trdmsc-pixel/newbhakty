/**
 * Studio OS administration for the Creative Production OS features.
 * Studio OS is the only writer: everything here edits studio_* tables directly (owner RLS);
 * the client portal reads filtered portal_* views and acts through portal_* RPCs.
 *
 *  - ShotsAdmin            Production tracker (episode → sequence → scene → shot)
 *  - AssetsAdmin           Creative Hub + Character & Visual Bible + decision register
 *  - ChangeRequestsAdmin   Review, price and propose client change requests
 *  - ApprovalHistory       Every client decision (stages, assets, shots, change requests)
 *  - ReviewCommentsAdmin   Timecoded client comments on versions — reply, resolve
 *  - ProjectMessagesPanel  Project messages / announcements / meeting notes with threads & attachments
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import {
  Check, CheckCircle2, ChevronDown, ChevronRight, Clapperboard, Eye, EyeOff, FileText, Image as ImageIcon, Loader2, Lock, MessageSquare,
  Paperclip, Plus, Reply, RotateCcw, Send, Sparkles, Trash2, Upload, X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import type { StudioGate, StudioProject } from "../types";
import { resolveStudioReviewUrl, uploadReviewImage, useProjectDeliverables } from "./ProjectDeliverables";

// ───────────────────────────────────────────────────────────── shared bits
const card = "sos-card p-5 md:p-6 space-y-4";
const input = "h-10 px-3 rounded-[12px] border text-[13px] bg-transparent outline-none focus:border-[var(--sos-primary)]";
const area = "w-full px-3 py-2 rounded-[12px] border text-[13px] bg-transparent outline-none focus:border-[var(--sos-primary)]";
const fieldStyle: React.CSSProperties = { borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" };
const H2: React.FC<{ children: React.ReactNode; sub?: string; right?: React.ReactNode }> = ({ children, sub, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{children}</h2>
      {sub && <p className="text-[13px] mt-0.5" style={{ color: "var(--sos-text-2)" }}>{sub}</p>}
    </div>
    {right}
  </div>
);
const Chip: React.FC<{ tone: [string, string]; children: React.ReactNode }> = ({ tone, children }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: tone[0], color: tone[1] }}>{children}</span>
);
const TONES = {
  grey: ["#F1F2F5", "#5B5F6B"],
  violet: ["#EEEBFD", "#4B33C9"],
  blue: ["#E6F0FF", "#1E4FB8"],
  amber: ["#FFF3E0", "#9A4A00"],
  green: ["#E7F7EE", "#17663F"],
  red: ["#FDECEC", "#B42318"],
} as const satisfies Record<string, [string, string]>;

/** Realtime-refreshing select for one project-scoped table. */
function useLive<T>(table: string, projectId: string, select = "*", order = "created_at", extra?: (q: any) => any) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const extraRef = useRef(extra);
  extraRef.current = extra;
  const load = useCallback(async () => {
    if (!supabase) return;
    let q = supabase.from(table).select(select).eq("project_id", projectId).is("archived_at", null);
    if (extraRef.current) q = extraRef.current(q);
    const { data } = await q.order(order, { ascending: true });
    setRows((data || []) as T[]);
    setLoading(false);
  }, [table, projectId, select, order]);
  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase
      .channel(`live-${table}-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [load, table, projectId]);
  return { rows, loading, reload: load, setRows };
}

/** Scroll to + flash an element marked data-focus="<kind:id>" once data is on screen. */
export function useFocusFlash(focus: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!focus || !ready) return;
    const t = window.setTimeout(() => {
      const el = document.querySelector(`[data-focus="${CSS.escape(focus)}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("sos-focus-flash");
      window.setTimeout(() => el.classList.remove("sos-focus-flash"), 2600);
    }, 250);
    return () => window.clearTimeout(t);
  }, [focus, ready]);
}

// ───────────────────────────────────────────────────────────── shots
export interface Shot {
  id: string;
  project_id: string;
  episode: number | null;
  sequence: string | null;
  scene: string | null;
  shot_code: string;
  title: string | null;
  description: string | null;
  camera_angle: string | null;
  camera_move: string | null;
  duration_s: number | null;
  status: string;
  preview_deliverable_id: string | null;
  final_deliverable_id: string | null;
  preview_url: string | null;
  assignee_member_id: string | null;
  internal_notes: string | null;
  sort: number;
  portal_visible: boolean;
}
export const SHOT_STATUS: Array<{ id: string; label: string; tone: keyof typeof TONES; client: string }> = [
  { id: "not_started", label: "Not started", tone: "grey", client: "Not started" },
  { id: "in_development", label: "In development", tone: "violet", client: "In production" },
  { id: "in_production", label: "In production", tone: "violet", client: "In production" },
  { id: "generating", label: "Generating", tone: "violet", client: "In production" },
  { id: "post_production", label: "Post-production", tone: "blue", client: "In production" },
  { id: "internal_review", label: "Internal review", tone: "blue", client: "In production" },
  { id: "client_review", label: "Client review", tone: "amber", client: "Awaiting your review" },
  { id: "revision_requested", label: "Revision requested", tone: "red", client: "Revising" },
  { id: "approved", label: "Approved", tone: "green", client: "Approved" },
  { id: "completed", label: "Completed", tone: "green", client: "Approved" },
  { id: "blocked", label: "Blocked", tone: "red", client: "In production" },
];
const shotStatus = (id: string) => SHOT_STATUS.find((s) => s.id === id) || SHOT_STATUS[0];

export const ShotsAdmin: React.FC<{ project: StudioProject; gates: StudioGate[]; focus?: string }> = ({ project, focus }) => {
  const { pushToast, members } = useStudioOS();
  const { rows: shots, loading, reload } = useLive<Shot>("studio_shots", project.id, "*", "sort");
  const { items: deliverables } = useProjectDeliverables(project.id);
  const [assets, setAssets] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [links, setLinks] = useState<Array<{ shot_id: string; asset_id: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [epFilter, setEpFilter] = useState<number | "all">("all");
  const [form, setForm] = useState({ episode: "", sequence: "", scene: "", title: "", camera_angle: "", camera_move: "", duration_s: "" });
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  useFocusFlash(focus, !loading);

  const loadLinks = useCallback(async () => {
    if (!supabase) return;
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from("studio_assets").select("id, name, kind").eq("project_id", project.id).is("archived_at", null).in("kind", ["character", "environment", "costume", "prop", "vehicle", "background"]),
      supabase.from("studio_shot_assets").select("shot_id, asset_id"),
    ]);
    setAssets((a || []) as any);
    setLinks((l || []) as any);
  }, [project.id]);
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const nextCode = (seq?: string, scene?: string) => {
    const base = [seq, scene].filter(Boolean).join("-") || "SH";
    const n = shots.filter((s) => s.shot_code.startsWith(base)).length + 1;
    return `${base}-${String(n * 10).padStart(3, "0")}`;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const seq = form.sequence.trim() || null;
    const scene = form.scene.trim() || null;
    const { error } = await supabase.from("studio_shots").insert({
      project_id: project.id,
      episode: form.episode ? Number(form.episode) : null,
      sequence: seq,
      scene,
      shot_code: nextCode(seq || undefined, scene || undefined),
      title: form.title.trim() || null,
      camera_angle: form.camera_angle.trim() || null,
      camera_move: form.camera_move.trim() || null,
      duration_s: form.duration_s ? Number(form.duration_s) : null,
      sort: shots.length,
    });
    if (error) return pushToast(error.message, "warn");
    setForm((f) => ({ ...f, title: "", camera_angle: "", camera_move: "", duration_s: "" }));
    pushToast("Shot added", "success");
    reload();
  };

  /** Paste a shot list: one shot per line — "SEQ | SCENE | Title | angle | move | seconds". */
  const addBulk = async () => {
    if (!supabase) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 300);
    if (!lines.length) return;
    let i = shots.length;
    const counters = new Map<string, number>();
    const rows = lines.map((l) => {
      const [sequence, scene, title, camera_angle, camera_move, dur] = l.split("|").map((x) => x.trim());
      const base = [sequence, scene].filter(Boolean).join("-") || "SH";
      const n = (counters.get(base) ?? shots.filter((s) => s.shot_code.startsWith(base)).length) + 1;
      counters.set(base, n);
      return {
        project_id: project.id,
        episode: form.episode ? Number(form.episode) : null,
        sequence: sequence || null,
        scene: scene || null,
        title: title || null,
        camera_angle: camera_angle || null,
        camera_move: camera_move || null,
        duration_s: dur && !isNaN(Number(dur)) ? Number(dur) : null,
        shot_code: `${base}-${String(n * 10).padStart(3, "0")}`,
        sort: i++,
      };
    });
    const { error } = await supabase.from("studio_shots").insert(rows);
    if (error) return pushToast(error.message, "warn");
    setBulkText("");
    setShowBulk(false);
    pushToast(`${rows.length} shots added`, "success");
    reload();
  };

  const update = async (id: string, patch: Partial<Shot>) => {
    if (!supabase) return;
    const shot = shots.find((s) => s.id === id);
    if (patch.status === "client_review" && shot && !shot.preview_deliverable_id && !shot.preview_url && !patch.preview_url && !patch.preview_deliverable_id) {
      if (!window.confirm(`Send ${shot.shot_code} for client review without a preview attached?`)) return;
    }
    const { error } = await supabase.from("studio_shots").update(patch).eq("id", id);
    if (error) return pushToast(error.message, "warn");
    reload();
  };
  const bulkStatus = async (status: string) => {
    if (!supabase || !selected.length) return;
    if (!window.confirm(`Set ${selected.length} shot(s) to ${shotStatus(status).label}?${status === "client_review" ? "\n\nThe client will see them as awaiting review." : ""}`)) return;
    const { error } = await supabase.from("studio_shots").update({ status }).in("id", selected);
    if (error) return pushToast(error.message, "warn");
    setSelected([]);
    pushToast("Shots updated", "success");
    reload();
  };
  const remove = async (s: Shot) => {
    if (!supabase || !window.confirm(`Remove shot ${s.shot_code}?`)) return;
    await supabase.from("studio_shots").update({ archived_at: new Date().toISOString() }).eq("id", s.id);
    reload();
  };
  const toggleAsset = async (shotId: string, assetId: string) => {
    if (!supabase) return;
    const has = links.some((l) => l.shot_id === shotId && l.asset_id === assetId);
    if (has) await supabase.from("studio_shot_assets").delete().eq("shot_id", shotId).eq("asset_id", assetId);
    else await supabase.from("studio_shot_assets").insert({ shot_id: shotId, asset_id: assetId });
    loadLinks();
  };

  const episodes = useMemo(() => [...new Set(shots.map((s) => s.episode).filter((e): e is number => e != null))].sort((a, b) => Number(a) - Number(b)) as number[], [shots]);
  const visible = shots.filter((s) => epFilter === "all" || s.episode === epFilter);
  const groups = useMemo(() => {
    const m = new Map<string, Shot[]>();
    for (const s of visible) {
      const k = [s.episode != null ? `Ep ${s.episode}` : null, s.sequence ? `Seq ${s.sequence}` : null, s.scene ? `Scene ${s.scene}` : null].filter(Boolean).join(" · ") || "Unsorted";
      (m.get(k) || m.set(k, []).get(k)!).push(s);
    }
    return [...m.entries()];
  }, [visible]);
  const counts = SHOT_STATUS.map((st) => ({ ...st, n: shots.filter((s) => s.status === st.id).length })).filter((x) => x.n);
  const done = shots.filter((s) => s.status === "approved" || s.status === "completed").length;
  const totalDur = shots.reduce((a, s) => a + (Number(s.duration_s) || 0), 0);

  return (
    <div className={card}>
      <H2
        sub="Episode → sequence → scene → shot. Clients see a simplified status, the preview you attach, and never internal notes."
        right={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowBulk((v) => !v)} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-9 px-3 text-[12px]">
              <FileText className="w-3.5 h-3.5" /> Paste shot list
            </button>
          </div>
        }
      >
        Production tracker
      </H2>

      {shots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={TONES.green}>{done}/{shots.length} approved</Chip>
          {totalDur > 0 && <Chip tone={TONES.grey}>{Math.floor(totalDur / 60)}:{String(Math.round(totalDur % 60)).padStart(2, "0")} total</Chip>}
          {counts.map((c) => (
            <Chip key={c.id} tone={TONES[c.tone]}>{c.label} · {c.n}</Chip>
          ))}
        </div>
      )}

      {showBulk && (
        <div className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
          <p className="text-[12px]" style={{ color: "var(--sos-text-2)" }}>One shot per line: <code>SEQ | SCENE | Title | angle | move | seconds</code> (episode from the field below).</p>
          <textarea rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} className={area} style={fieldStyle} placeholder={"A | 1 | Krishna lifts the hill | wide | slow push in | 6\nA | 1 | Villagers gather | low angle | static | 4"} />
          <button type="button" onClick={addBulk} className="sos-jelly inline-flex items-center gap-1.5 h-9 px-4 text-[12px]"><Plus className="w-3.5 h-3.5" /> Add shots</button>
        </div>
      )}

      <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-8 gap-2">
        <input className={input} style={fieldStyle} placeholder="Ep" inputMode="numeric" value={form.episode} onChange={(e) => setForm({ ...form, episode: e.target.value.replace(/\D/g, "") })} />
        <input className={input} style={fieldStyle} placeholder="Sequence" value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} />
        <input className={input} style={fieldStyle} placeholder="Scene" value={form.scene} onChange={(e) => setForm({ ...form, scene: e.target.value })} />
        <input className={`${input} col-span-2`} style={fieldStyle} placeholder="Shot title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={input} style={fieldStyle} placeholder="Angle" value={form.camera_angle} onChange={(e) => setForm({ ...form, camera_angle: e.target.value })} />
        <input className={input} style={fieldStyle} placeholder="Move" value={form.camera_move} onChange={(e) => setForm({ ...form, camera_move: e.target.value })} />
        <div className="flex gap-2">
          <input className={`${input} w-full`} style={fieldStyle} placeholder="Sec" inputMode="decimal" value={form.duration_s} onChange={(e) => setForm({ ...form, duration_s: e.target.value })} />
          <button type="submit" className="sos-jelly shrink-0 w-10 h-10 inline-flex items-center justify-center" aria-label="Add shot"><Plus className="w-4 h-4" /></button>
        </div>
      </form>

      {episodes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...episodes] as Array<number | "all">).map((e) => (
            <button key={String(e)} type="button" onClick={() => setEpFilter(e)} className="h-8 px-3 rounded-full text-[12px] font-semibold" style={epFilter === e ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
              {e === "all" ? "All episodes" : `Ep ${e}`}
            </button>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-[14px]" style={{ background: "var(--sos-violet-soft)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>{selected.length} selected</span>
          <select className={`${input} h-8`} style={fieldStyle} value="" onChange={(e) => e.target.value && bulkStatus(e.target.value)}>
            <option value="">Set status…</option>
            {SHOT_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button type="button" onClick={() => setSelected([])} className="text-[12px] font-semibold" style={{ color: "var(--sos-text-2)" }}>Clear</button>
        </div>
      )}

      {loading ? (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Loading…</p>
      ) : !shots.length ? (
        <div className="text-center py-8 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
          <Clapperboard className="w-7 h-7 mx-auto mb-2" style={{ color: "var(--sos-text-3)" }} />
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>No shots yet. Add one above or paste a shot list.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([label, list]) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={list.every((s) => selected.includes(s.id))}
                  onChange={(e) => setSelected((prev) => (e.target.checked ? [...new Set([...prev, ...list.map((s) => s.id)])] : prev.filter((id) => !list.some((s) => s.id === id))))}
                  aria-label={`Select ${label}`}
                />
                <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{label} · {list.length}</p>
              </div>
              {list.map((s) => {
                const st = shotStatus(s.status);
                const open = openId === s.id;
                const linked = links.filter((l) => l.shot_id === s.id).map((l) => assets.find((a) => a.id === l.asset_id)).filter(Boolean) as typeof assets;
                return (
                  <div key={s.id} data-focus={`shot:${s.id}`} className="rounded-[14px] border transition-shadow" style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)" }}>
                    <div className="flex items-center gap-2.5 p-2.5">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} aria-label={`Select ${s.shot_code}`} />
                      <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="min-w-0 flex-1 text-left flex items-center gap-2">
                        {open ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />}
                        <span className="sos-num text-[12px] font-bold shrink-0" style={{ color: "var(--sos-primary)" }}>{s.shot_code}</span>
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--sos-text-1)" }}>{s.title || "Untitled shot"}</span>
                        <span className="hidden md:inline text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>{[s.camera_angle, s.camera_move, s.duration_s ? `${s.duration_s}s` : null].filter(Boolean).join(" · ")}</span>
                      </button>
                      {linked.length > 0 && <span className="hidden lg:inline text-[11px] truncate max-w-[160px]" style={{ color: "var(--sos-text-3)" }}>{linked.map((a) => a.name).join(", ")}</span>}
                      {!s.portal_visible && <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sos-text-3)" }} aria-label="Hidden from client" />}
                      <select value={s.status} onChange={(e) => update(s.id, { status: e.target.value })} className="h-8 px-2 rounded-full text-[12px] font-semibold border-0 outline-none cursor-pointer" style={{ background: TONES[st.tone][0], color: TONES[st.tone][1] }} aria-label="Shot status">
                        {SHOT_STATUS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </div>
                    {open && (
                      <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[13px]">
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Title</span>
                          <input className={`${input} w-full`} style={fieldStyle} defaultValue={s.title || ""} onBlur={(e) => e.target.value !== (s.title || "") && update(s.id, { title: e.target.value || null })} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Assignee</span>
                          <select className={`${input} w-full`} style={fieldStyle} value={s.assignee_member_id || ""} onChange={(e) => update(s.id, { assignee_member_id: e.target.value || null })}>
                            <option value="">Unassigned</option>
                            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1 md:col-span-2">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Description (client sees this)</span>
                          <textarea rows={2} className={area} style={fieldStyle} defaultValue={s.description || ""} onBlur={(e) => e.target.value !== (s.description || "") && update(s.id, { description: e.target.value || null })} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Preview (shared version)</span>
                          <select className={`${input} w-full`} style={fieldStyle} value={s.preview_deliverable_id || ""} onChange={(e) => update(s.id, { preview_deliverable_id: e.target.value || null })}>
                            <option value="">— none —</option>
                            {deliverables.map((d) => <option key={d.id} value={d.id}>{d.title} {d.version || ""}{d.shared_with_client ? "" : " (not shared)"}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>…or preview link</span>
                          <input className={`${input} w-full`} style={fieldStyle} placeholder="https://…" defaultValue={s.preview_url || ""} onBlur={(e) => e.target.value !== (s.preview_url || "") && update(s.id, { preview_url: e.target.value || null })} />
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Final footage</span>
                          <select className={`${input} w-full`} style={fieldStyle} value={s.final_deliverable_id || ""} onChange={(e) => update(s.id, { final_deliverable_id: e.target.value || null })}>
                            <option value="">— none —</option>
                            {deliverables.map((d) => <option key={d.id} value={d.id}>{d.title} {d.version || ""}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Internal notes (never shown to client)</span>
                          <input className={`${input} w-full`} style={fieldStyle} defaultValue={s.internal_notes || ""} onBlur={(e) => e.target.value !== (s.internal_notes || "") && update(s.id, { internal_notes: e.target.value || null })} />
                        </label>
                        {assets.length > 0 && (
                          <div className="md:col-span-2 space-y-1">
                            <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>Characters & references in this shot</span>
                            <div className="flex flex-wrap gap-1.5">
                              {assets.map((a) => {
                                const on = links.some((l) => l.shot_id === s.id && l.asset_id === a.id);
                                return (
                                  <button key={a.id} type="button" onClick={() => toggleAsset(s.id, a.id)} className="h-7 px-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-1" style={on ? { background: "var(--sos-primary)", color: "#fff" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
                                    {on && <Check className="w-3 h-3" />} {a.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                          <button type="button" onClick={() => update(s.id, { portal_visible: !s.portal_visible })} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-8 px-3 text-[12px]">
                            {s.portal_visible ? <><EyeOff className="w-3.5 h-3.5" /> Hide from client</> : <><Eye className="w-3.5 h-3.5" /> Show to client</>}
                          </button>
                          <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Client sees: <b>{st.client}</b></span>
                          <button type="button" onClick={() => remove(s)} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#B42318" }}>
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────── assets (creative hub + bible)
export const BIBLE_KINDS = [
  { id: "character", label: "Characters", fields: ["Costume", "Accessories", "Hair & face", "Props", "Front / side / back"] },
  { id: "environment", label: "Environments", fields: ["Location", "Architecture", "Lighting", "Weather", "Atmosphere", "Day / night"] },
  { id: "costume", label: "Costumes", fields: ["Worn by", "Fabric", "Colours"] },
  { id: "prop", label: "Props", fields: ["Used by", "Material"] },
  { id: "vehicle", label: "Vehicles", fields: ["Type", "Colours"] },
  { id: "brand", label: "Brand assets", fields: ["Usage"] },
  { id: "background", label: "Backgrounds", fields: ["Used in"] },
  { id: "palette", label: "Colour palettes", fields: ["Colours (hex)"] },
  { id: "cinematography", label: "Cinematography refs", fields: ["Lens", "Movement", "Grade"] },
] as const;
export const CREATIVE_KINDS = [
  { id: "brief", label: "Creative brief" },
  { id: "concept", label: "Concept" },
  { id: "treatment", label: "Treatment" },
  { id: "script", label: "Script" },
  { id: "screenplay", label: "Screenplay" },
  { id: "storyboard", label: "Storyboard" },
  { id: "shot_list", label: "Shot list" },
  { id: "moodboard", label: "Moodboard" },
  { id: "art_direction", label: "Art direction" },
  { id: "vo_script", label: "Voice-over script" },
  { id: "music_ref", label: "Music reference" },
] as const;
export const ASSET_KIND_LABEL: Record<string, string> = Object.fromEntries([...BIBLE_KINDS, ...CREATIVE_KINDS].map((k) => [k.id, k.label.replace(/s$/, "")]));
export const ASSET_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  draft: { label: "Draft (internal)", tone: "grey" },
  in_review: { label: "Client review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  changes_requested: { label: "Changes requested", tone: "red" },
  locked: { label: "Locked", tone: "violet" },
};

interface Asset {
  id: string;
  project_id: string;
  kind: string;
  name: string;
  description: string | null;
  details: Record<string, string>;
  status: string;
  current_version_id: string | null;
  approved_version_id: string | null;
  downloadable: boolean;
  portal_visible: boolean;
  sort: number;
  updated_at: string;
}
interface AssetVersion {
  id: string;
  asset_id: string;
  version: number;
  label: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
}

const isImage = (u?: string | null) => Boolean(u && (/^storage:\/\/studio-review\//.test(u) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)));
const Thumb: React.FC<{ url: string | null; className?: string }> = ({ url, className }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    if (url && isImage(url)) resolveStudioReviewUrl(url).then((u) => !off && setSrc(u || null));
    else setSrc(null);
    return () => {
      off = true;
    };
  }, [url]);
  return src ? (
    <img src={src} alt="" className={`object-cover ${className || ""}`} loading="lazy" />
  ) : (
    <span className={`flex items-center justify-center ${className || ""}`} style={{ background: "var(--sos-surface-2)" }}>
      {url ? <FileText className="w-5 h-5" style={{ color: "var(--sos-text-3)" }} /> : <ImageIcon className="w-5 h-5" style={{ color: "var(--sos-text-3)" }} />}
    </span>
  );
};

export const AssetsAdmin: React.FC<{ project: StudioProject; focus?: string }> = ({ project, focus }) => {
  const { pushToast } = useStudioOS();
  const { rows: assets, loading, reload } = useLive<Asset>("studio_assets", project.id, "*", "sort");
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [section, setSection] = useState<"creative" | "bible" | "register">("bible");
  const [kind, setKind] = useState<string>("character");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);
  useFocusFlash(focus, !loading);

  useEffect(() => {
    if (!focus?.startsWith("asset:") || !assets.length) return;
    const a = assets.find((x) => `asset:${x.id}` === focus);
    if (a) {
      setSection(CREATIVE_KINDS.some((k) => k.id === a.kind) ? "creative" : "bible");
      setKind(a.kind);
      setOpenId(a.id);
    }
  }, [focus, assets]);

  const loadVersions = useCallback(async () => {
    if (!supabase || !assets.length) return setVersions([]);
    const { data } = await supabase.from("studio_asset_versions").select("*").in("asset_id", assets.map((a) => a.id)).is("archived_at", null).order("version", { ascending: false });
    setVersions((data || []) as AssetVersion[]);
  }, [assets]);
  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const kinds = section === "creative" ? CREATIVE_KINDS : BIBLE_KINDS;
  useEffect(() => {
    if (section !== "register" && !kinds.some((k) => k.id === kind)) setKind(kinds[0].id);
  }, [section, kinds, kind]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newName.trim()) return;
    const { data, error } = await supabase.from("studio_assets").insert({ project_id: project.id, kind, name: newName.trim(), sort: assets.length }).select("id").single();
    if (error) return pushToast(error.message, "warn");
    setNewName("");
    setOpenId(data.id);
    reload();
  };
  const patch = async (id: string, p: Partial<Asset>) => {
    if (!supabase) return;
    const { error } = await supabase.from("studio_assets").update(p).eq("id", id);
    if (error) return pushToast(error.message, "warn");
    reload();
  };
  const addVersion = async (a: Asset, url: string, label?: string) => {
    if (!supabase) return;
    const next = (versions.filter((v) => v.asset_id === a.id)[0]?.version || 0) + 1;
    const { data, error } = await supabase.from("studio_asset_versions").insert({ asset_id: a.id, version: next, url, label: label || `v${next}` }).select("id").single();
    if (error) return pushToast(error.message, "warn");
    await supabase.from("studio_assets").update({ current_version_id: data.id, ...(a.status === "approved" || a.status === "locked" ? {} : {}) }).eq("id", a.id);
    pushToast(`v${next} added to ${a.name}`, "success");
    await loadVersions();
    reload();
  };
  const onFile = async (f: File | undefined) => {
    const a = assets.find((x) => x.id === uploadFor.current);
    if (!f || !a) return;
    setBusy(a.id);
    try {
      const url = await uploadReviewImage(project.id, f);
      await addVersion(a, url, f.name.replace(/\.[^.]+$/, ""));
    } catch (err: any) {
      pushToast(err?.message || "Upload failed", "warn");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const sendForReview = async (a: Asset) => {
    if (!a.current_version_id && !window.confirm(`Send "${a.name}" for review without a version attached?`)) return;
    if (!window.confirm(`Publish "${a.name}" to the client portal and ask for approval?\n\nThe client gets a notification and an email.`)) return;
    await patch(a.id, { status: "in_review", portal_visible: true });
    pushToast(`${a.name} sent for client review`, "success");
  };

  const filtered = assets.filter((a) => a.kind === kind);
  const registerRows = assets.filter((a) => a.status !== "draft");

  return (
    <div className={card}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <H2 sub="The studio controls every official reference. Clients review and approve what you publish — they can never overwrite it.">Creative Hub & Visual Bible</H2>

      <div className="flex flex-wrap gap-1.5">
        {([
          ["bible", "Characters & assets"],
          ["creative", "Creative documents"],
          ["register", `Decision register · ${registerRows.length}`],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setSection(id)} className="h-9 px-4 rounded-full text-[13px] font-semibold" style={section === id ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
            {label}
          </button>
        ))}
      </div>

      {section === "register" ? (
        registerRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--sos-text-3)" }}>
                  <th className="py-2 pr-3 font-semibold">Decision</th>
                  <th className="py-2 pr-3 font-semibold">Type</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Approved version</th>
                </tr>
              </thead>
              <tbody>
                {registerRows.map((a) => {
                  const st = ASSET_STATUS[a.status] || ASSET_STATUS.draft;
                  const v = versions.find((x) => x.id === a.approved_version_id);
                  return (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--sos-border)" }}>
                      <td className="py-2 pr-3 font-medium" style={{ color: "var(--sos-text-1)" }}>{a.name}</td>
                      <td className="py-2 pr-3" style={{ color: "var(--sos-text-2)" }}>{ASSET_KIND_LABEL[a.kind]}</td>
                      <td className="py-2 pr-3"><Chip tone={TONES[st.tone]}>{st.label}</Chip></td>
                      <td className="py-2" style={{ color: "var(--sos-text-2)" }}>{v ? `${v.label || `v${v.version}`}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Nothing published yet. Send a character, location or document for review and its decision shows here.</p>
        )
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {kinds.map((k) => {
              const n = assets.filter((a) => a.kind === k.id).length;
              return (
                <button key={k.id} type="button" onClick={() => setKind(k.id)} className="shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border" style={kind === k.id ? { borderColor: "var(--sos-primary)", color: "var(--sos-primary)", background: "var(--sos-violet-soft)" } : { borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                  {k.label}{n ? ` · ${n}` : ""}
                </button>
              );
            })}
          </div>
          <form onSubmit={create} className="flex gap-2">
            <input className={`${input} flex-1`} style={fieldStyle} placeholder={`New ${ASSET_KIND_LABEL[kind]?.toLowerCase() || "item"} name`} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="sos-jelly inline-flex items-center gap-1.5 h-10 px-4 text-[13px]"><Plus className="w-4 h-4" /> Add</button>
          </form>

          {loading ? null : !filtered.length ? (
            <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>None yet.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filtered.map((a) => {
                const st = ASSET_STATUS[a.status] || ASSET_STATUS.draft;
                const vs = versions.filter((v) => v.asset_id === a.id);
                const cur = vs.find((v) => v.id === a.current_version_id) || vs[0];
                const open = openId === a.id;
                const fieldsFor = (BIBLE_KINDS.find((k) => k.id === a.kind)?.fields || []) as readonly string[];
                return (
                  <div key={a.id} data-focus={`asset:${a.id}`} className="rounded-[18px] border overflow-hidden" style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)" }}>
                    <button type="button" onClick={() => setOpenId(open ? null : a.id)} className="w-full text-left flex items-center gap-3 p-3">
                      <Thumb url={cur?.url || null} className="w-14 h-14 rounded-[12px] shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{a.name}</span>
                        <span className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Chip tone={TONES[st.tone]}>{st.label}</Chip>
                          {vs.length > 0 && <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{vs.length} version{vs.length > 1 ? "s" : ""}</span>}
                          {!a.portal_visible && <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>· hidden</span>}
                        </span>
                      </span>
                      {open ? <ChevronDown className="w-4 h-4" style={{ color: "var(--sos-text-3)" }} /> : <ChevronRight className="w-4 h-4" style={{ color: "var(--sos-text-3)" }} />}
                    </button>
                    {open && (
                      <div className="px-3 pb-3 space-y-3">
                        <textarea rows={2} className={area} style={fieldStyle} placeholder="Description (client sees this once published)" defaultValue={a.description || ""} onBlur={(e) => e.target.value !== (a.description || "") && patch(a.id, { description: e.target.value || null })} />
                        {fieldsFor.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {fieldsFor.map((f) => (
                              <label key={f} className="space-y-0.5">
                                <span className="text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>{f}</span>
                                <input className={`${input} w-full h-9`} style={fieldStyle} defaultValue={a.details?.[f] || ""} onBlur={(e) => (e.target.value || "") !== (a.details?.[f] || "") && patch(a.id, { details: { ...(a.details || {}), [f]: e.target.value } })} />
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>Versions</p>
                          {vs.map((v) => (
                            <div key={v.id} className="flex items-center gap-2 text-[13px]">
                              <Thumb url={v.url} className="w-9 h-9 rounded-[8px] shrink-0" />
                              <button type="button" onClick={async () => v.url && window.open((await resolveStudioReviewUrl(v.url)) || v.url, "_blank", "noopener")} className="min-w-0 flex-1 text-left truncate" style={{ color: "var(--sos-text-1)" }}>
                                {v.label || `v${v.version}`} <span style={{ color: "var(--sos-text-3)" }}>· {format(parseISO(v.created_at), "d MMM")}</span>
                              </button>
                              {a.approved_version_id === v.id && <Chip tone={TONES.green}><CheckCircle2 className="w-3 h-3" /> approved</Chip>}
                              {a.current_version_id !== v.id && (
                                <button type="button" onClick={() => patch(a.id, { current_version_id: v.id })} className="text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>Make current</button>
                              )}
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={busy === a.id} onClick={() => { uploadFor.current = a.id; fileRef.current?.click(); }} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-8 px-3 text-[12px]">
                              {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload image
                            </button>
                            <button type="button" onClick={() => { const u = window.prompt("Link to this version (Drive, Frame.io, PDF, YouTube…)"); if (u && /^https?:\/\//.test(u.trim())) addVersion(a, u.trim()); }} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-8 px-3 text-[12px]">
                              <Paperclip className="w-3.5 h-3.5" /> Add link
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--sos-border)" }}>
                          {a.status !== "in_review" && a.status !== "locked" && (
                            <button type="button" onClick={() => sendForReview(a)} className="sos-jelly sos-jelly-amber inline-flex items-center gap-1.5 h-8 px-3 text-[12px] mt-2"><Send className="w-3.5 h-3.5" /> Send for client review</button>
                          )}
                          {a.status === "approved" && (
                            <button type="button" onClick={() => patch(a.id, { status: "locked" })} className="sos-jelly sos-jelly-ink inline-flex items-center gap-1.5 h-8 px-3 text-[12px] mt-2"><Lock className="w-3.5 h-3.5" /> Lock reference</button>
                          )}
                          {a.status === "locked" && (
                            <button type="button" onClick={() => window.confirm(`Unlock "${a.name}"? It goes back to Approved.`) && patch(a.id, { status: "approved" })} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-8 px-3 text-[12px] mt-2"><RotateCcw className="w-3.5 h-3.5" /> Unlock</button>
                          )}
                          {a.status !== "draft" && (
                            <button type="button" onClick={() => patch(a.id, { portal_visible: !a.portal_visible })} className="sos-jelly sos-jelly-ghost inline-flex items-center gap-1.5 h-8 px-3 text-[12px] mt-2">
                              {a.portal_visible ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Show</>}
                            </button>
                          )}
                          <label className="inline-flex items-center gap-1.5 text-[12px] mt-2" style={{ color: "var(--sos-text-2)" }}>
                            <input type="checkbox" checked={a.downloadable} onChange={(e) => patch(a.id, { downloadable: e.target.checked })} /> Client can download
                          </label>
                          <button type="button" onClick={() => window.confirm(`Remove "${a.name}"?`) && patch(a.id, { archived_at: new Date().toISOString() } as any)} className="ml-auto mt-2 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#B42318" }}>
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                        <ApprovalHistory projectId={project.id} entityId={a.id} compact />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────── approvals log
interface Approval {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  decision: string;
  comment: string | null;
  contact_name: string | null;
  created_at: string;
}
const DECISION: Record<string, { label: string; tone: keyof typeof TONES }> = {
  approved: { label: "Approved", tone: "green" },
  changes_requested: { label: "Changes requested", tone: "red" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Declined", tone: "red" },
};
export const ApprovalHistory: React.FC<{ projectId: string; entityId?: string; compact?: boolean }> = ({ projectId, entityId, compact }) => {
  const { rows } = useLive<Approval>("studio_approvals", projectId, "*", "created_at", entityId ? (q) => q.eq("entity_id", entityId) : undefined);
  const list = [...rows].reverse();
  if (compact && !list.length) return null;
  const body = (
    <div className="space-y-1.5">
      {!list.length && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No client decisions recorded yet.</p>}
      {list.map((a) => {
        const d = DECISION[a.decision] || DECISION.approved;
        return (
          <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
            <Chip tone={TONES[d.tone]}>{d.label}</Chip>
            <span className="min-w-0 flex-1" style={{ color: "var(--sos-text-1)" }}>
              {!compact && <b>{a.entity_name || a.entity_type}</b>} <span style={{ color: "var(--sos-text-2)" }}>by {a.contact_name || "client"} · {format(parseISO(a.created_at), "d MMM yyyy, HH:mm")}</span>
              {a.comment && <span className="block mt-0.5 italic" style={{ color: "var(--sos-text-2)" }}>“{a.comment}”</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
  if (compact) return <div className="pt-2 border-t space-y-1.5" style={{ borderColor: "var(--sos-border)" }}><p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>Client decisions</p>{body}</div>;
  return (
    <div className={card}>
      <H2 sub="Every approval and decision the client made in the portal — who, when, on which version.">Approval history</H2>
      {body}
    </div>
  );
};

// ───────────────────────────────────────────────────────────── change requests
interface ChangeRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  proposed_amount: number | null;
  currency: string | null;
  proposed_days: number | null;
  proposal_note: string | null;
  contact_name: string | null;
  client_comment: string | null;
  created_at: string;
  decided_at: string | null;
}
const CR_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  submitted: { label: "New", tone: "red" },
  under_review: { label: "Reviewing", tone: "blue" },
  proposed: { label: "Proposal sent", tone: "amber" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Declined", tone: "grey" },
  withdrawn: { label: "Withdrawn", tone: "grey" },
  done: { label: "Done", tone: "violet" },
};
export const ChangeRequestsAdmin: React.FC<{ project: StudioProject; focus?: string }> = ({ project, focus }) => {
  const { pushToast } = useStudioOS();
  const { rows, loading, reload } = useLive<ChangeRequest>("studio_change_requests", project.id);
  const [proposeId, setProposeId] = useState<string | null>(null);
  const [p, setP] = useState({ amount: "", days: "", note: "" });
  useFocusFlash(focus, !loading);
  if (!rows.length) return null;
  const set = async (id: string, patch: Record<string, unknown>, msg: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("studio_change_requests").update(patch).eq("id", id);
    if (error) return pushToast(error.message, "warn");
    pushToast(msg, "success");
    reload();
  };
  const propose = async (cr: ChangeRequest) => {
    if (!window.confirm(`Send this proposal to the client?\n\n${p.amount ? `${project.currency} ${p.amount}` : "No extra cost"}${p.days ? ` · +${p.days} days` : ""}\n\nNothing changes in invoices or dates until you update them yourself.`)) return;
    await set(cr.id, { status: "proposed", proposed_amount: p.amount ? Number(p.amount) : null, currency: project.currency, proposed_days: p.days ? Number(p.days) : null, proposal_note: p.note.trim() || null, proposed_at: new Date().toISOString() }, "Proposal sent to the client");
    setProposeId(null);
    setP({ amount: "", days: "", note: "" });
  };
  const list = [...rows].reverse();
  return (
    <div className={card}>
      <H2 sub="Scope changes the client asked for. Review, propose cost & time, and the client accepts or declines. Accepting never edits invoices or dates — you get a task to do it.">
        Change requests · {list.filter((r) => ["submitted", "under_review"].includes(r.status)).length} open
      </H2>
      <div className="space-y-2.5">
        {list.map((cr) => {
          const st = CR_STATUS[cr.status] || CR_STATUS.submitted;
          return (
            <div key={cr.id} data-focus={`cr:${cr.id}`} className="p-3.5 rounded-[16px] border space-y-2" style={{ borderColor: "var(--sos-border)" }}>
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{cr.title}</p>
                  <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>{cr.contact_name || "Client"} · {formatDistanceToNowStrict(parseISO(cr.created_at), { addSuffix: true })}</p>
                </div>
                <Chip tone={TONES[st.tone]}>{st.label}</Chip>
              </div>
              {cr.description && <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}>{cr.description}</p>}
              {cr.status === "proposed" || cr.status === "accepted" || cr.status === "rejected" ? (
                <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
                  Proposal: <b>{cr.proposed_amount ? `${cr.currency} ${Number(cr.proposed_amount).toLocaleString()}` : "no extra cost"}</b>{cr.proposed_days ? ` · +${cr.proposed_days} days` : ""}{cr.proposal_note ? ` — ${cr.proposal_note}` : ""}
                  {cr.client_comment && <span className="block italic mt-0.5">Client: “{cr.client_comment}”</span>}
                </p>
              ) : null}
              {proposeId === cr.id ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input className={input} style={fieldStyle} placeholder={`Extra cost (${project.currency})`} inputMode="decimal" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} />
                  <input className={input} style={fieldStyle} placeholder="Extra days" inputMode="numeric" value={p.days} onChange={(e) => setP({ ...p, days: e.target.value.replace(/\D/g, "") })} />
                  <input className={`${input} col-span-2`} style={fieldStyle} placeholder="Note to client" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} />
                  <div className="col-span-2 md:col-span-4 flex gap-2">
                    <button type="button" onClick={() => propose(cr)} className="sos-jelly inline-flex items-center gap-1.5 h-9 px-4 text-[12px]"><Send className="w-3.5 h-3.5" /> Send proposal</button>
                    <button type="button" onClick={() => setProposeId(null)} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[12px]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cr.status === "submitted" && <button type="button" onClick={() => set(cr.id, { status: "under_review" }, "Marked as reviewing")} className="sos-jelly sos-jelly-ghost h-8 px-3 text-[12px]">Mark reviewing</button>}
                  {["submitted", "under_review", "proposed"].includes(cr.status) && (
                    <button type="button" onClick={() => { setProposeId(cr.id); setP({ amount: cr.proposed_amount ? String(cr.proposed_amount) : "", days: cr.proposed_days ? String(cr.proposed_days) : "", note: cr.proposal_note || "" }); }} className="sos-jelly sos-jelly-amber h-8 px-3 text-[12px]">
                      {cr.status === "proposed" ? "Revise proposal" : "Propose cost & time"}
                    </button>
                  )}
                  {["submitted", "under_review"].includes(cr.status) && <button type="button" onClick={() => window.confirm("Decline this request?") && set(cr.id, { status: "rejected", decided_at: new Date().toISOString() }, "Request declined")} className="sos-jelly sos-jelly-ghost h-8 px-3 text-[12px]">Decline</button>}
                  {cr.status === "accepted" && <button type="button" onClick={() => set(cr.id, { status: "done" }, "Change marked done")} className="sos-jelly sos-jelly-green h-8 px-3 text-[12px]">Mark done</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────── review comments
interface ReviewComment {
  id: string;
  deliverable_id: string;
  parent_id: string | null;
  timecode: number | null;
  frame_path: string | null;
  body: string;
  from_studio: boolean;
  author_name: string | null;
  resolved_at: string | null;
  created_at: string;
}
export const fmtTC = (s: number | null | undefined) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);

export const ReviewCommentsAdmin: React.FC<{ projectId: string; focus?: string; onSeek?: (deliverableId: string, s: number) => void }> = ({ projectId, focus, onSeek }) => {
  const { pushToast } = useStudioOS();
  const { rows, loading, reload } = useLive<ReviewComment>("studio_review_comments", projectId);
  const { items: deliverables } = useProjectDeliverables(projectId);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [frames, setFrames] = useState<Record<string, string>>({});
  useFocusFlash(focus, !loading);
  useEffect(() => {
    const need = rows.filter((r) => r.frame_path && !frames[r.id]);
    if (!need.length || !supabase) return;
    Promise.all(need.map(async (r) => [r.id, (await supabase!.storage.from("client-uploads").createSignedUrl(r.frame_path!, 3600)).data?.signedUrl || ""] as const)).then((pairs) =>
      setFrames((prev) => ({ ...prev, ...Object.fromEntries(pairs) }))
    );
  }, [rows, frames]);
  if (!rows.length) return null;
  const roots = rows.filter((r) => !r.parent_id);
  const open = roots.filter((r) => !r.resolved_at);
  const byDeliv = new Map<string, ReviewComment[]>();
  for (const r of roots.filter((r) => showResolved || !r.resolved_at)) (byDeliv.get(r.deliverable_id) || byDeliv.set(r.deliverable_id, []).get(r.deliverable_id)!).push(r);
  for (const list of byDeliv.values()) list.sort((a, b) => (a.timecode ?? 1e9) - (b.timecode ?? 1e9));

  const send = async (root: ReviewComment) => {
    const text = (reply[root.id] || "").trim();
    if (!supabase || !text) return;
    const { error } = await supabase.from("studio_review_comments").insert({ project_id: projectId, deliverable_id: root.deliverable_id, parent_id: root.id, body: text, from_studio: true, author_name: "The Chanting Studio" });
    if (error) return pushToast(error.message, "warn");
    setReply((r) => ({ ...r, [root.id]: "" }));
    pushToast("Reply sent — the client gets a ring", "success");
    reload();
  };
  const resolve = async (c: ReviewComment, v: boolean) => {
    if (!supabase) return;
    await supabase.from("studio_review_comments").update({ resolved_at: v ? new Date().toISOString() : null }).eq("id", c.id);
    reload();
  };

  return (
    <div className={card}>
      <H2
        sub="Frame-accurate notes clients leave on a version. Reply, then resolve when it's fixed."
        right={
          <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--sos-text-2)" }}>
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Show resolved
          </label>
        }
      >
        Review comments · {open.length} open
      </H2>
      {!byDeliv.size && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>All comments resolved.</p>}
      {[...byDeliv.entries()].map(([did, list]) => {
        const d = deliverables.find((x) => x.id === did);
        return (
          <div key={did} data-focus={`deliverable:${did}`} className="space-y-2 rounded-[16px] p-2 -m-2">
            <p className="text-[13px] font-bold" style={{ color: "var(--sos-text-1)" }}>{d ? `${d.title} ${d.version || ""}` : "Version"}</p>
            {list.map((c) => {
              const replies = rows.filter((r) => r.parent_id === c.id);
              return (
                <div key={c.id} className="p-3 rounded-[14px] space-y-2" style={{ background: "var(--sos-surface-2)", opacity: c.resolved_at ? 0.65 : 1 }}>
                  <div className="flex items-start gap-2">
                    {c.timecode != null && (
                      <button type="button" onClick={() => onSeek?.(did, Number(c.timecode))} className="sos-num shrink-0 h-6 px-2 rounded-full text-[11px] font-bold" style={{ background: "var(--sos-primary)", color: "#fff" }}>{fmtTC(Number(c.timecode))}</button>
                    )}
                    <p className="min-w-0 flex-1 text-[13px] whitespace-pre-wrap" style={{ color: "var(--sos-text-1)" }}>
                      <b>{c.author_name || "Client"}:</b> {c.body}
                    </p>
                    <button type="button" onClick={() => resolve(c, !c.resolved_at)} className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: c.resolved_at ? "var(--sos-text-3)" : "#17663F" }}>
                      {c.resolved_at ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</>}
                    </button>
                  </div>
                  {frames[c.id] && <img src={frames[c.id]} alt="Frame the client marked" className="max-h-40 rounded-[10px]" />}
                  {replies.map((r) => (
                    <p key={r.id} className="ml-6 text-[13px] whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}>
                      <Reply className="inline w-3 h-3 mr-1" /> <b>{r.from_studio ? "Studio" : r.author_name || "Client"}:</b> {r.body}
                    </p>
                  ))}
                  {!c.resolved_at && (
                    <div className="ml-6 flex gap-2">
                      <input className={`${input} flex-1 h-9`} style={fieldStyle} placeholder="Reply to the client…" value={reply[c.id] || ""} onChange={(e) => setReply((r) => ({ ...r, [c.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && send(c)} />
                      <button type="button" onClick={() => send(c)} className="sos-jelly w-9 h-9 inline-flex items-center justify-center" aria-label="Send reply"><Send className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────────────────────────────────────────── project messages (threads, kinds, attachments)
interface PortalMsg {
  id: string;
  client_id: string;
  project_id: string | null;
  parent_id: string | null;
  kind: string;
  subject: string | null;
  body: string;
  from_studio: boolean;
  author_name: string | null;
  attachments: Array<{ name: string; path: string; size?: number }>;
  created_at: string;
  read_by_client_at: string | null;
  read_by_studio_at: string | null;
}
const KIND_LABEL: Record<string, string> = { message: "Message", announcement: "Announcement", meeting_note: "Meeting notes" };

export const ProjectMessagesPanel: React.FC<{ project: StudioProject }> = ({ project }) => {
  const { pushToast } = useStudioOS();
  const { rows, reload } = useLive<PortalMsg>("studio_portal_messages", project.id);
  const [kind, setKind] = useState<"message" | "announcement" | "meeting_note">("message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<PortalMsg | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const unread = rows.filter((m) => !m.from_studio && !m.read_by_studio_at).map((m) => m.id);
    if (unread.length && supabase) {
      const now = new Date().toISOString();
      supabase.from("studio_portal_messages").update({ read_by_studio_at: now, delivered_to_studio_at: now }).in("id", unread).then(() => null);
    }
  }, [rows]);
  const openAttachment = async (path: string) => {
    const { data } = (await supabase?.storage.from("client-uploads").createSignedUrl(path, 600)) || { data: null };
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  const send = async () => {
    if (!supabase || !body.trim() || !project.client_id) return;
    setBusy(true);
    const { error } = await supabase.from("studio_portal_messages").insert({
      client_id: project.client_id,
      project_id: project.id,
      body: body.trim(),
      subject: replyTo ? replyTo.subject && !/^re:/i.test(replyTo.subject) ? `Re: ${replyTo.subject}` : replyTo.subject : subject.trim() || null,
      kind: replyTo ? "message" : kind,
      parent_id: replyTo ? replyTo.parent_id || replyTo.id : null,
      from_studio: true,
      author_name: "The Chanting Studio",
      via: "studio",
    });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setBody("");
    setSubject("");
    setReplyTo(null);
    pushToast(kind === "message" || replyTo ? "Sent — the client gets a ring and an email" : `${KIND_LABEL[kind]} posted to the portal`, "success");
    reload();
  };
  const threads = useMemo(() => {
    const roots = rows.filter((m) => !m.parent_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return roots.map((r) => ({ root: r, replies: rows.filter((m) => m.parent_id === r.id) }));
  }, [rows]);
  if (!project.client_id) return null;
  return (
    <div className={card}>
      <H2 sub="Portal messages for this project, threaded like email. Post announcements and meeting notes with decisions for the client.">Messages & notes</H2>
      <div className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
        {replyTo ? (
          <p className="text-[12px] flex items-center gap-2" style={{ color: "var(--sos-text-2)" }}>
            <Reply className="w-3.5 h-3.5" /> Replying to {replyTo.from_studio ? "your" : `${replyTo.author_name || "client"}'s`} {replyTo.subject ? `“${replyTo.subject}”` : "message"}
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="w-3.5 h-3.5" /></button>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(["message", "announcement", "meeting_note"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className="h-8 px-3 rounded-full text-[12px] font-semibold" style={kind === k ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)" }}>
                {KIND_LABEL[k]}
              </button>
            ))}
            <input className={`${input} flex-1 min-w-[180px] h-8`} style={fieldStyle} placeholder={kind === "meeting_note" ? "Meeting title, e.g. Kick-off call 28 Nov" : "Subject"} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}
        <textarea rows={kind === "meeting_note" && !replyTo ? 5 : 3} className={area} style={fieldStyle} placeholder={kind === "meeting_note" && !replyTo ? "Summary\n\nDecisions:\n• …\n\nNext steps:\n• …" : "Write to the client…"} value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="button" disabled={busy || !body.trim()} onClick={send} className="sos-jelly inline-flex items-center gap-1.5 h-9 px-4 text-[12px]">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {replyTo ? "Send reply" : kind === "message" ? "Send" : "Post"}
        </button>
      </div>
      {!threads.length && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No messages on this project yet.</p>}
      <div className="space-y-2.5">
        {threads.slice(0, 30).map(({ root, replies }) => (
          <div key={root.id} className="p-3 rounded-[16px] border space-y-2" style={{ borderColor: "var(--sos-border)", background: root.kind !== "message" ? "var(--sos-violet-soft)" : undefined }}>
            {[root, ...replies].map((m, i) => (
              <div key={m.id} className={i ? "ml-5 pt-2 border-t" : ""} style={{ borderColor: "var(--sos-border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  {i === 0 && m.kind !== "message" && <Chip tone={TONES.violet}>{m.kind === "meeting_note" ? <Sparkles className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />} {KIND_LABEL[m.kind]}</Chip>}
                  <span className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{m.from_studio ? "Studio" : m.author_name || "Client"}</span>
                  {i === 0 && m.subject && <span className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>· {m.subject}</span>}
                  <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{format(parseISO(m.created_at), "d MMM, HH:mm")}{m.from_studio ? (m.read_by_client_at ? " · read" : " · not read yet") : ""}</span>
                </div>
                <p className="text-[13px] whitespace-pre-wrap mt-0.5" style={{ color: "var(--sos-text-2)" }}>{m.body}</p>
                {m.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.attachments.map((a) => (
                      <button key={a.path} type="button" onClick={() => openAttachment(a.path)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium" style={{ background: "var(--sos-surface-2)", color: "var(--sos-primary)" }}>
                        <Paperclip className="w-3 h-3" /> {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setReplyTo(root)} className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
              <Reply className="w-3.5 h-3.5" /> Reply
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
