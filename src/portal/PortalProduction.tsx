/**
 * Client portal — Creative Production OS.
 * Everything here reads the client-filtered portal_* views / RLS tables and acts only
 * through portal_* RPCs. Studio OS owns every record; this is the controlled window into it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, Clapperboard, Columns2, Download, FileText, GitPullRequestArrow, Image as ImageIcon,
  Inbox, ListChecks, Loader2, Lock, Mail, MessageSquare, Paperclip, PenLine, Plus, Printer, Reply, RotateCcw, Send, Sparkles, Upload, X,
} from "lucide-react";
import { supabase } from "./portalSupabase";
import { uploadResumable } from "./resumableUpload";
import { ReviewMedia, type ReviewMediaHandle, fmtTime } from "../review/ReviewMedia";
import { Receipt } from "../review/Receipt";

// ───────────────────────────────────────────────────────────── shared
const EASE = [0.22, 1, 0.36, 1] as const;
const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const x = new Date(d.length === 10 ? `${d}T00:00:00` : d);
  return isNaN(x.getTime()) ? "" : x.toLocaleDateString([], { day: "numeric", month: "short", year: x.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
};
const fieldCls = "w-full px-3.5 rounded-[12px] border text-[14px] outline-none focus:border-[var(--sos-primary)]";
const fieldStyle: React.CSSProperties = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };
const Tone = {
  grey: ["var(--sos-surface-2)", "var(--sos-text-2)"],
  violet: ["#EEEBFD", "#4B33C9"],
  amber: ["#FFF3E0", "#9A4A00"],
  green: ["#E7F7EE", "#17663F"],
  red: ["#FDECEC", "#B42318"],
  blue: ["#E6F0FF", "#1E4FB8"],
} as const;
const Chip: React.FC<{ t: keyof typeof Tone; children: React.ReactNode }> = ({ t, children }) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: Tone[t][0], color: Tone[t][1] }}>{children}</span>
);
const Card: React.FC<{ title: React.ReactNode; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, sub, right, children, className }) => (
  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className={`sos-card p-5 md:p-6 space-y-4 ${className || ""}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{title}</h2>
        {sub && <p className="text-[13px] mt-0.5" style={{ color: "var(--sos-text-2)" }}>{sub}</p>}
      </div>
      {right}
    </div>
    {children}
  </motion.section>
);
const Empty: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="text-center py-10 rounded-[18px]" style={{ background: "var(--sos-surface-2)" }}>
    <span className="inline-flex mb-2" style={{ color: "var(--sos-text-3)" }}>{icon}</span>
    <p className="text-[14px] max-w-sm mx-auto" style={{ color: "var(--sos-text-2)" }}>{text}</p>
  </div>
);
const errText = (m?: string) =>
  /not_permitted/.test(m || "") ? "Your account can view this but not approve it — ask your team admin or the studio." : /comment_required/.test(m || "") ? "Please tell the studio what to change." : /not_awaiting/.test(m || "") ? "This was already handled — refreshing." : "Something went wrong. Please try again.";

export const resolvePortalUrl = async (url: string) => {
  if (!url.startsWith("storage://studio-review/") || !supabase) return url;
  const { data } = await supabase.storage.from("studio-review").createSignedUrl(url.replace("storage://studio-review/", ""), 3600);
  return data?.signedUrl || "";
};

/** The signed-in contact's permission (Studio OS sets it). */
export function usePortalRole() {
  const [me, setMe] = useState<{ role: string; email_kinds: string[] | null } | null>(null);
  useEffect(() => {
    supabase?.rpc("portal_me").then(({ data, error }) => setMe(error ? { role: "admin", email_kinds: null } : ((data as any) || { role: "admin", email_kinds: null })));
  }, []);
  const role = me?.role || "admin";
  return { role, canApprove: role === "admin" || role === "approver", canComment: role !== "viewer" && role !== "finance", canFinance: role === "admin" || role === "finance", emailKinds: me?.email_kinds ?? null, loaded: Boolean(me) };
}

// ───────────────────────────────────────────────────────────── types
export interface PAsset {
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
  updated_at: string;
}
interface PVersion {
  id: string;
  asset_id: string;
  version: number;
  label: string | null;
  url: string | null;
  notes: string | null;
  created_at: string;
}
interface PShot {
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
  client_status: string;
  preview_url: string | null;
  final_url: string | null;
  sort: number;
}
interface PChange {
  id: string;
  project_id: string;
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
}
interface PApproval {
  id: string;
  project_id: string;
  entity_type: string;
  entity_name: string | null;
  decision: string;
  comment: string | null;
  contact_name: string | null;
  created_at: string;
}
export interface PDeliverable {
  id: string;
  project_id: string;
  gate_id: string | null;
  title: string;
  url: string;
  version: string | null;
  created_at: string;
  is_final: boolean;
  download_url: string | null;
  client_summary?: string | null;
}
export interface PMsg {
  id: string;
  project_id: string | null;
  body: string;
  from_studio: boolean;
  author_name: string | null;
  created_at: string;
  read_by_client_at: string | null;
  read_by_studio_at?: string | null;
  delivered_to_studio_at?: string | null;
  gate_id?: string | null;
  parent_id?: string | null;
  kind?: string;
  subject?: string | null;
  attachments?: Array<{ name: string; path: string; size?: number }>;
}

function useRows<T>(table: string, filter: (q: any) => any, deps: unknown[], order = "created_at") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await filterRef.current(supabase.from(table).select("*")).order(order, { ascending: true });
    setRows(error ? [] : ((data || []) as T[]));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, order, ...deps]);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  return { rows, loading, reload: load };
}

// ───────────────────────────────────────────────────────────── sections
export type ProjectSection = "overview" | "creative" | "production" | "assets" | "reviews" | "activity";
export const SECTIONS: Array<{ id: ProjectSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "creative", label: "Creative Hub" },
  { id: "production", label: "Production" },
  { id: "assets", label: "Characters & Assets" },
  { id: "reviews", label: "Reviews & Approvals" },
  { id: "activity", label: "Activity" },
];
export const SectionBar: React.FC<{ value: ProjectSection; onChange: (s: ProjectSection) => void; badges?: Partial<Record<ProjectSection, number>> }> = ({ value, onChange, badges = {} }) => (
  <div className="sos-tabbar lg:sticky lg:top-16 z-20" role="tablist" aria-label="Project sections">
    {SECTIONS.map((s) => {
      const on = value === s.id;
      return (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(s.id)}
          className="relative shrink-0 px-4 h-10 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors"
          style={{ color: on ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
        >
          {on && <motion.span layoutId="portal-section-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--sos-ink)", boxShadow: "0 6px 18px -8px rgba(15,17,21,0.6)" }} transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="relative z-[1]">{s.label}</span>
          {badges[s.id] ? <span className="relative z-[1] min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white sos-pulse-badge" style={{ background: "#E11D48" }}>{badges[s.id]}</span> : null}
        </button>
      );
    })}
  </div>
);

/** Counts for section badges (things waiting on the client). */
export function useSectionBadges(projectId: string, refreshKey = 0) {
  const [b, setB] = useState<Partial<Record<ProjectSection, number>>>({});
  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("portal_assets").select("kind").eq("project_id", projectId).eq("status", "in_review"),
      supabase.from("portal_shots").select("id").eq("project_id", projectId).eq("client_status", "in_review"),
      supabase.from("studio_change_requests").select("id").eq("project_id", projectId).eq("status", "proposed"),
    ]).then(([a, s, c]) => {
      const assets = (a.data || []) as Array<{ kind: string }>;
      const creative = assets.filter((x) => CREATIVE.some((k) => k.id === x.kind)).length;
      setB({ creative, assets: assets.length - creative, production: (s.data || []).length, reviews: (c.data || []).length });
    });
  }, [projectId, refreshKey]);
  return b;
}

// ───────────────────────────────────────────────────────────── attention required
interface AttnGate {
  id: string;
  project_id: string;
  name: string;
  status: string;
  sent_for_approval_at: string | null;
}
interface AttnTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
  responsibility?: string;
}
export const AttentionRequired: React.FC<{
  projects: Array<{ id: string; title: string }>;
  gates: AttnGate[];
  tasks: AttnTask[];
  unreadMessages: number;
  refreshKey?: number;
  onOpen: (projectId: string, section?: ProjectSection) => void;
  onOpenMessages: () => void;
  onChanged: () => void;
}> = ({ projects, gates, tasks, unreadMessages, refreshKey = 0, onOpen, onOpenMessages, onChanged }) => {
  const { canApprove } = usePortalRole();
  const [extra, setExtra] = useState<{ assets: PAsset[]; shots: PShot[]; crs: PChange[] }>({ assets: [], shots: [], crs: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const loadExtra = useCallback(async () => {
    if (!supabase) return;
    const [a, s, c] = await Promise.all([
      supabase.from("portal_assets").select("*").eq("status", "in_review"),
      supabase.from("portal_shots").select("*").eq("client_status", "in_review"),
      supabase.from("studio_change_requests").select("*").eq("status", "proposed"),
    ]);
    setExtra({ assets: (a.data || []) as PAsset[], shots: (s.data || []) as PShot[], crs: (c.data || []) as PChange[] });
  }, []);
  useEffect(() => {
    loadExtra();
  }, [loadExtra, refreshKey]);
  const title = (pid: string) => projects.find((p) => p.id === pid)?.title || "";
  const waiting = gates.filter((g) => g.status === "waiting_on_client" && projects.some((p) => p.id === g.project_id));
  const todos = tasks.filter((t) => t.responsibility === "client" && t.status !== "done" && projects.some((p) => p.id === t.project_id));
  const shotsByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of extra.shots) m.set(s.project_id, (m.get(s.project_id) || 0) + 1);
    return [...m.entries()];
  }, [extra.shots]);
  const total = waiting.length + todos.length + extra.assets.length + shotsByProject.length + extra.crs.length + (unreadMessages ? 1 : 0);
  if (!total) return null;

  const approveGate = async (g: AttnGate) => {
    if (!supabase || !window.confirm(`Approve "${g.name.replace(/^Ep \d+ · /, "")}"? The studio moves on to the next stage.`)) return;
    setBusy(g.id);
    setErr("");
    const { data, error } = await supabase.rpc("portal_approve_gate", { p_gate_id: g.id, p_comment: null });
    if (!error) {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      fetch("/api/portal/after-action", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ project_id: (data as any)?.project_id || g.project_id, gate_id: g.id, action: "approved" }) }).catch(() => {});
    } else setErr(errText(error.message));
    setBusy(null);
    onChanged();
  };
  const doneTask = async (t: AttnTask) => {
    if (!supabase) return;
    setBusy(t.id);
    const { error } = await supabase.rpc("portal_complete_task", { p_task: t.id, p_done: true, p_note: null });
    if (error) setErr(errText(error.message));
    setBusy(null);
    onChanged();
  };

  const Row: React.FC<{ icon: React.ReactNode; color: string; title: string; sub: string; children?: React.ReactNode }> = ({ icon, color, title: t, sub, children }) => (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-[16px]" style={{ background: "var(--sos-surface)", boxShadow: "0 0 0 1px var(--sos-border)" }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: color }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{t}</p>
        <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>{sub}</p>
      </div>
      <div className="flex gap-2 shrink-0">{children}</div>
    </div>
  );

  return (
    <div className="sos-card sos-aurora sos-aurora-amber sos-aurora-glow p-5 space-y-3 overflow-hidden">
      <span className="sos-orb" style={{ width: 240, height: 240, top: -120, right: -60, background: "radial-gradient(circle, rgba(245,158,11,0.28), transparent 70%)" }} />
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, #FBBF24, #F59E0B)" }}><Sparkles className="w-4 h-4" /></span>
        <div>
          <h2 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Your attention required · {total}</h2>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>Reviews, approvals and to-dos the studio is waiting on.</p>
        </div>
      </div>
      {err && <p className="text-[13px] px-3 py-2 rounded-[12px]" style={{ background: "#FDECEC", color: "#B42318" }}>{err}</p>}
      <div className="grid gap-2 xl:grid-cols-2">
        {waiting.map((g) => (
          <Row key={g.id} icon={<Clapperboard className="w-4 h-4" />} color="#F59E0B" title={`Review ${g.name.replace(/^Ep (\d+) · /, "Episode $1 · ")}`} sub={`${title(g.project_id)}${g.sent_for_approval_at ? ` · sent ${fmtDate(g.sent_for_approval_at)}` : ""}`}>
            <button type="button" onClick={() => onOpen(g.project_id, "overview")} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px]">Review</button>
            {canApprove && (
              <button type="button" disabled={busy === g.id} onClick={() => approveGate(g)} className="sos-jelly sos-jelly-green h-9 px-4 text-[13px] inline-flex items-center gap-1.5 disabled:opacity-60">
                {busy === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
              </button>
            )}
          </Row>
        ))}
        {extra.assets.map((a) => {
          const creative = CREATIVE.some((k) => k.id === a.kind);
          return (
            <Row key={a.id} icon={creative ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />} color="#7C3AED" title={`Approve ${KIND_LABEL[a.kind] ? `${KIND_LABEL[a.kind].toLowerCase()}: ` : ""}${a.name}`} sub={title(a.project_id)}>
              <button type="button" onClick={() => onOpen(a.project_id, creative ? "creative" : "assets")} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5">Open <ArrowRight className="w-3.5 h-3.5" /></button>
            </Row>
          );
        })}
        {shotsByProject.map(([pid, n]) => (
          <Row key={`shots-${pid}`} icon={<Clapperboard className="w-4 h-4" />} color="#0EA5E9" title={`${n} shot${n > 1 ? "s" : ""} ready for your review`} sub={title(pid)}>
            <button type="button" onClick={() => onOpen(pid, "production")} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5">Review <ArrowRight className="w-3.5 h-3.5" /></button>
          </Row>
        ))}
        {extra.crs.map((c) => (
          <Row key={c.id} icon={<GitPullRequestArrow className="w-4 h-4" />} color="#D97706" title={`Respond to change proposal: ${c.title}`} sub={`${title(c.project_id)} · ${c.proposed_amount ? `${c.currency} ${Number(c.proposed_amount).toLocaleString()}` : "no extra cost"}${c.proposed_days ? ` · +${c.proposed_days} days` : ""}`}>
            <button type="button" onClick={() => onOpen(c.project_id, "reviews")} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5">Respond <ArrowRight className="w-3.5 h-3.5" /></button>
          </Row>
        ))}
        {todos.map((t) => (
          <Row key={t.id} icon={<ListChecks className="w-4 h-4" />} color="#16A34A" title={t.title} sub={`${title(t.project_id)}${t.due_date ? ` · due ${fmtDate(t.due_date)}` : ""}`}>
            <button type="button" onClick={() => onOpen(t.project_id, "overview")} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px]">Open</button>
            <button type="button" disabled={busy === t.id} onClick={() => doneTask(t)} className="sos-jelly sos-jelly-green h-9 px-4 text-[13px] inline-flex items-center gap-1.5">
              {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Done
            </button>
          </Row>
        ))}
        {unreadMessages > 0 && (
          <Row icon={<Mail className="w-4 h-4" />} color="#5B3FE4" title={`${unreadMessages} new message${unreadMessages > 1 ? "s" : ""} from the studio`} sub="Read and reply">
            <button type="button" onClick={onOpenMessages} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5">Open <ArrowRight className="w-3.5 h-3.5" /></button>
          </Row>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────── creative hub + bible
export const CREATIVE = [
  { id: "brief", label: "Creative brief" },
  { id: "concept", label: "Concepts" },
  { id: "treatment", label: "Treatment" },
  { id: "script", label: "Script" },
  { id: "screenplay", label: "Screenplay" },
  { id: "storyboard", label: "Storyboard" },
  { id: "shot_list", label: "Shot list" },
  { id: "moodboard", label: "Moodboard" },
  { id: "art_direction", label: "Art direction" },
  { id: "vo_script", label: "Voice-over script" },
  { id: "music_ref", label: "Music references" },
];
export const BIBLE = [
  { id: "character", label: "Characters" },
  { id: "environment", label: "Environments" },
  { id: "costume", label: "Costumes" },
  { id: "prop", label: "Props" },
  { id: "vehicle", label: "Vehicles" },
  { id: "brand", label: "Brand assets" },
  { id: "background", label: "Backgrounds" },
  { id: "palette", label: "Colour palettes" },
  { id: "cinematography", label: "Cinematography" },
];
export const KIND_LABEL: Record<string, string> = Object.fromEntries([...CREATIVE, ...BIBLE].map((k) => [k.id, k.label.replace(/s$/, "")]));
const ASSET_STATUS: Record<string, { label: string; t: keyof typeof Tone }> = {
  in_review: { label: "Awaiting your approval", t: "amber" },
  approved: { label: "Approved", t: "green" },
  changes_requested: { label: "Changes requested", t: "red" },
  locked: { label: "Approved · locked", t: "violet" },
};

const isImg = (u?: string | null) => Boolean(u && (u.startsWith("storage://studio-review/") || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)));
const Img: React.FC<{ url: string | null; className?: string; alt?: string }> = ({ url, className, alt = "" }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    if (url && isImg(url)) resolvePortalUrl(url).then((u) => !off && setSrc(u || null));
    else setSrc(null);
    return () => {
      off = true;
    };
  }, [url]);
  return src ? (
    <img src={src} alt={alt} loading="lazy" className={`object-cover ${className || ""}`} />
  ) : (
    <span className={`flex items-center justify-center ${className || ""}`} style={{ background: "linear-gradient(135deg, var(--sos-violet-soft), var(--sos-surface-2))" }}>
      {url ? <FileText className="w-6 h-6" style={{ color: "var(--sos-primary)" }} /> : <ImageIcon className="w-6 h-6" style={{ color: "var(--sos-text-3)" }} />}
    </span>
  );
};

const AssetReview: React.FC<{ a: PAsset; versions: PVersion[]; onDone: () => void }> = ({ a, versions, onDone }) => {
  const { canApprove } = usePortalRole();
  const [vId, setVId] = useState(a.current_version_id || versions[0]?.id || null);
  const [mode, setMode] = useState<null | "changes">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = versions.find((x) => x.id === vId) || versions[0];
  const decide = async (approve: boolean) => {
    if (!supabase) return;
    if (approve && !window.confirm(`Approve "${a.name}"${v ? ` (${v.label || `v${v.version}`})` : ""}? The studio will treat it as the official reference.`)) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("portal_review_asset", { p_asset: a.id, p_version: v?.id || null, p_approve: approve, p_comment: note.trim() || null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    setMode(null);
    setNote("");
    onDone();
  };
  const open = async (url: string) => window.open((await resolvePortalUrl(url)) || url, "_blank", "noopener");
  return (
    <div className="space-y-3">
      {v?.url && (isImg(v.url) ? (
        <button type="button" onClick={() => open(v.url!)} className="block w-full rounded-[16px] overflow-hidden" aria-label="Open full size">
          <Img url={v.url} className="w-full max-h-[480px]" alt={a.name} />
        </button>
      ) : (
        <button type="button" onClick={() => open(v.url!)} className="sos-jelly sos-jelly-ghost h-10 px-4 text-[13px] inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Open {v.label || "document"}</button>
      ))}
      {versions.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {versions.map((x) => (
            <button key={x.id} type="button" onClick={() => setVId(x.id)} className="h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1" style={x.id === v?.id ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
              {x.label || `v${x.version}`} {x.id === a.approved_version_id && <CheckCircle2 className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
      {a.description && <p className="text-[14px] whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}>{a.description}</p>}
      {Object.entries(a.details || {}).filter(([, val]) => val).length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Object.entries(a.details).filter(([, val]) => val).map(([k, val]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{k}</dt>
              <dd className="text-[13px]" style={{ color: "var(--sos-text-1)" }}>{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {a.downloadable && v?.url && (
        <button type="button" onClick={() => open(v.url!)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--sos-primary)" }}><Download className="w-4 h-4" /> Download</button>
      )}
      {a.status === "in_review" && canApprove && (
        mode === "changes" ? (
          <div className="space-y-2">
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change? Be as specific as you like." className={`${fieldCls} py-2.5`} style={fieldStyle} />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => decide(false)} className="sos-jelly sos-jelly-amber h-10 px-4 text-[13px] inline-flex items-center gap-1.5">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send changes</button>
              <button type="button" onClick={() => setMode(null)} className="sos-jelly sos-jelly-ghost h-10 px-4 text-[13px]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => decide(true)} className="sos-jelly sos-jelly-green h-10 px-5 text-[13px] inline-flex items-center gap-1.5">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve</button>
            <button type="button" onClick={() => setMode("changes")} className="sos-jelly sos-jelly-ghost h-10 px-5 text-[13px] inline-flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Request changes</button>
          </div>
        )
      )}
      {a.status === "in_review" && !canApprove && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Your team's approver can approve this.</p>}
      {a.status === "locked" && <p className="text-[12px] inline-flex items-center gap-1.5" style={{ color: "var(--sos-text-3)" }}><Lock className="w-3.5 h-3.5" /> Locked as the official reference — the studio keeps every shot consistent with it.</p>}
      {err && <p className="text-[13px]" style={{ color: "#B42318" }}>{err}</p>}
    </div>
  );
};

export const AssetLibrary: React.FC<{ projectId: string; mode: "creative" | "bible"; onChanged?: () => void }> = ({ projectId, mode, onChanged }) => {
  const kinds = mode === "creative" ? CREATIVE : BIBLE;
  const { rows: all, loading, reload } = useRows<PAsset>("portal_assets", (q) => q.eq("project_id", projectId), [projectId], "updated_at");
  const assets = all.filter((a) => kinds.some((k) => k.id === a.kind));
  const [versions, setVersions] = useState<PVersion[]>([]);
  const [kind, setKind] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase || !assets.length) return;
    supabase.from("portal_asset_versions").select("*").in("asset_id", assets.map((a) => a.id)).order("version", { ascending: false }).then(({ data }) => setVersions((data || []) as PVersion[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const shown = assets.filter((a) => kind === "all" || a.kind === kind);
  const present = kinds.filter((k) => assets.some((a) => a.kind === k.id));
  const pending = assets.filter((a) => a.status === "in_review").length;
  const done = () => {
    reload();
    onChanged?.();
  };
  return (
    <div className="space-y-5">
      <Card
        title={mode === "creative" ? "Creative Hub" : "Characters & visual bible"}
        sub={mode === "creative" ? "Briefs, scripts, storyboards and moodboards the studio has shared — review and approve each one." : "The official look of your film: characters, locations, costumes and props. Approved references keep every shot consistent."}
        right={pending ? <Chip t="amber">{pending} awaiting you</Chip> : undefined}
      >
        {present.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {[{ id: "all", label: "All" }, ...present].map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)} className="shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold border" style={kind === k.id ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)", borderColor: "var(--sos-ink)" } : { borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
                {k.label}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--sos-primary)" }} /></div>
        ) : !assets.length ? (
          <Empty icon={mode === "creative" ? <FileText className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />} text={mode === "creative" ? "The studio will share the brief, script and storyboards here as they're ready." : "Character sheets and location references appear here once the studio publishes them."} />
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((a, i) => {
              const vs = versions.filter((v) => v.asset_id === a.id);
              const cur = vs.find((v) => v.id === a.current_version_id) || vs[0];
              const st = ASSET_STATUS[a.status] || ASSET_STATUS.approved;
              const open = openId === a.id;
              return (
                <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }} className={`rounded-[20px] border overflow-hidden ${open ? "sm:col-span-2 2xl:col-span-3" : ""}`} style={{ borderColor: a.status === "in_review" ? "#F59E0B" : "var(--sos-border)", background: "var(--sos-surface)" }}>
                  <button type="button" onClick={() => setOpenId(open ? null : a.id)} className="w-full text-left">
                    {!open && <Img url={cur?.url || null} className="w-full aspect-[4/3]" alt={a.name} />}
                    <div className="p-3.5 flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{KIND_LABEL[a.kind]}</p>
                        <p className="text-[15px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{a.name}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Chip t={st.t}>{st.label}</Chip>
                          {vs.length > 1 && <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{vs.length} versions</span>}
                        </div>
                      </div>
                      {open ? <ChevronDown className="w-4 h-4 mt-1" style={{ color: "var(--sos-text-3)" }} /> : <ChevronRight className="w-4 h-4 mt-1" style={{ color: "var(--sos-text-3)" }} />}
                    </div>
                  </button>
                  {open && <div className="px-3.5 pb-4"><AssetReview a={a} versions={vs} onDone={done} /></div>}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
      {mode === "creative" && assets.length > 0 && <DecisionRegister assets={all} />}
    </div>
  );
};

const DecisionRegister: React.FC<{ assets: PAsset[] }> = ({ assets }) => (
  <Card title="Creative decision register" sub="Every creative decision on this project and where it stands.">
    <div className="divide-y" style={{ borderColor: "var(--sos-border)" }}>
      {assets.map((a) => {
        const st = ASSET_STATUS[a.status] || ASSET_STATUS.approved;
        return (
          <div key={a.id} className="flex items-center gap-3 py-2.5">
            <span className="text-[14px] font-medium flex-1 min-w-0 truncate" style={{ color: "var(--sos-text-1)" }}>{KIND_LABEL[a.kind]}: {a.name}</span>
            <Chip t={a.status === "in_review" ? "amber" : st.t}>{a.status === "in_review" ? "Pending" : st.label}</Chip>
          </div>
        );
      })}
    </div>
  </Card>
);

// ───────────────────────────────────────────────────────────── production (shots)
const SHOT_CLIENT: Record<string, { label: string; t: keyof typeof Tone }> = {
  not_started: { label: "Not started", t: "grey" },
  in_production: { label: "In production", t: "violet" },
  in_review: { label: "Your review", t: "amber" },
  revising: { label: "Revising", t: "red" },
  approved: { label: "Approved", t: "green" },
};
export const ProductionPanel: React.FC<{ projectId: string; onChanged?: () => void }> = ({ projectId, onChanged }) => {
  const { canApprove } = usePortalRole();
  const { rows: shots, loading, reload } = useRows<PShot>("portal_shots", (q) => q.eq("project_id", projectId), [projectId], "sort");
  const [ep, setEp] = useState<number | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const episodes = [...new Set(shots.map((s) => s.episode).filter((e): e is number => e != null))].sort((a, b) => Number(a) - Number(b)) as number[];
  const list = shots.filter((s) => ep === "all" || s.episode === ep);
  const groups = useMemo(() => {
    const m = new Map<string, PShot[]>();
    for (const s of list) {
      const k = [s.episode != null && episodes.length > 1 && ep === "all" ? `Episode ${s.episode}` : null, s.sequence ? `Sequence ${s.sequence}` : null, s.scene ? `Scene ${s.scene}` : null].filter(Boolean).join(" · ") || "Shots";
      (m.get(k) || m.set(k, []).get(k)!).push(s);
    }
    return [...m.entries()];
  }, [list, episodes.length, ep]);
  const counts = Object.entries(SHOT_CLIENT).map(([id, v]) => ({ id, ...v, n: shots.filter((s) => s.client_status === id).length })).filter((x) => x.n);
  const pct = shots.length ? Math.round((shots.filter((s) => s.client_status === "approved").length / shots.length) * 100) : 0;
  const review = async (s: PShot, approve: boolean) => {
    if (!supabase) return;
    if (approve && !window.confirm(`Approve shot ${s.shot_code}?`)) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("portal_review_shot", { p_shot: s.id, p_approve: approve, p_comment: note.trim() || null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    setNote("");
    reload();
    onChanged?.();
  };
  return (
    <Card title="Production tracker" sub="Every sequence, scene and shot, live from the studio." right={shots.length ? <Chip t="green">{pct}% approved</Chip> : undefined}>
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--sos-primary)" }} /></div>
      ) : !shots.length ? (
        <Empty icon={<Clapperboard className="w-7 h-7" />} text="Shot-by-shot tracking appears here once production begins. Until then, follow the stages in Overview." />
      ) : (
        <>
          <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: "var(--sos-surface-2)" }}>
            {counts.map((c) => (
              <span key={c.id} style={{ width: `${(c.n / shots.length) * 100}%`, background: Tone[c.t][1], opacity: c.id === "not_started" ? 0.25 : 0.85 }} title={`${c.label}: ${c.n}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">{counts.map((c) => <Chip key={c.id} t={c.t}>{c.label} · {c.n}</Chip>)}</div>
          {episodes.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(["all", ...episodes] as Array<number | "all">).map((e) => (
                <button key={String(e)} type="button" onClick={() => setEp(e)} className="shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold" style={ep === e ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
                  {e === "all" ? "All episodes" : `Ep ${e}`}
                </button>
              ))}
            </div>
          )}
          {err && <p className="text-[13px]" style={{ color: "#B42318" }}>{err}</p>}
          <div className="space-y-4">
            {groups.map(([label, items]) => (
              <div key={label} className="space-y-1.5">
                <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{label}</p>
                <div className="grid gap-1.5 lg:grid-cols-2">
                  {items.map((s) => {
                    const st = SHOT_CLIENT[s.client_status] || SHOT_CLIENT.not_started;
                    const open = openId === s.id;
                    return (
                      <div key={s.id} className={`rounded-[14px] ${open ? "lg:col-span-2" : ""}`} style={{ background: "var(--sos-surface-2)", boxShadow: s.client_status === "in_review" ? "inset 3px 0 0 #F59E0B" : undefined }}>
                        <button type="button" onClick={() => setOpenId(open ? null : s.id)} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5">
                          <span className="sos-num text-[12px] font-bold shrink-0" style={{ color: "var(--sos-primary)" }}>{s.shot_code}</span>
                          <span className="text-[14px] flex-1 min-w-0 truncate" style={{ color: "var(--sos-text-1)" }}>{s.title || "Shot"}</span>
                          {s.duration_s ? <span className="text-[12px] hidden sm:inline" style={{ color: "var(--sos-text-3)" }}>{s.duration_s}s</span> : null}
                          <Chip t={st.t}>{st.label}</Chip>
                        </button>
                        {open && (
                          <div className="px-3.5 pb-3.5 space-y-3">
                            {(s.final_url || s.preview_url) && <ReviewMedia url={(s.final_url || s.preview_url)!} resolveUrl={resolvePortalUrl} />}
                            {s.description && <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>{s.description}</p>}
                            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>{[s.camera_angle && `Angle: ${s.camera_angle}`, s.camera_move && `Move: ${s.camera_move}`, s.duration_s && `${s.duration_s}s`].filter(Boolean).join(" · ")}</p>
                            {s.client_status === "in_review" && canApprove && (
                              <div className="space-y-2">
                                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the studio (needed for changes)" className={`${fieldCls} h-10`} style={fieldStyle} />
                                <div className="flex gap-2">
                                  <button type="button" disabled={busy} onClick={() => review(s, true)} className="sos-jelly sos-jelly-green h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Approve shot</button>
                                  <button type="button" disabled={busy} onClick={() => review(s, false)} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Request changes</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

// ───────────────────────────────────────────────────────────── review studio (timecoded comments, A/B)
interface RComment {
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
export const ReviewStudio: React.FC<{ projectId: string; clientId: string; deliverables: PDeliverable[] }> = ({ projectId, clientId, deliverables }) => {
  const { canComment } = usePortalRole();
  const versions = useMemo(() => [...deliverables].sort((a, b) => b.created_at.localeCompare(a.created_at)), [deliverables]);
  const [aId, setAId] = useState<string | null>(versions[0]?.id || null);
  const [bId, setBId] = useState<string | null>(null);
  const a = versions.find((d) => d.id === aId) || versions[0];
  const b = versions.find((d) => d.id === bId) || null;
  const playerA = useRef<ReviewMediaHandle>(null);
  const playerB = useRef<ReviewMediaHandle>(null);
  const { rows: comments, reload } = useRows<RComment>("studio_review_comments", (q) => q.eq("project_id", projectId), [projectId]);
  const [text, setText] = useState("");
  const [stamp, setStamp] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  if (!versions.length) return <Card title="Video review"><Empty icon={<Clapperboard className="w-7 h-7" />} text="Versions the studio shares appear here, with frame-accurate comments." /></Card>;
  const mine = comments.filter((c) => c.deliverable_id === a?.id);
  const roots = mine.filter((c) => !c.parent_id && (showResolved || !c.resolved_at)).sort((x, y) => (x.timecode ?? 1e9) - (y.timecode ?? 1e9));
  /** Read the exact playhead time and write it into the comment ("At 01:24 — "). */
  const insertStamp = async () => {
    const t = await playerA.current?.getTime();
    if (t == null) return setErr("Play the video, pause where you want, then tap the timestamp button.");
    setErr("");
    const sec = Math.round(t * 10) / 10;
    const tag = `At ${fmtTime(sec)} — `;
    const el = textRef.current;
    const pos = el ? el.selectionStart ?? text.length : text.length;
    const before = text.slice(0, pos);
    const next = `${before}${before && !/\s$/.test(before) ? "\n" : ""}${tag}${text.slice(pos)}`;
    setText(next);
    if (stamp == null) setStamp(sec);
    requestAnimationFrame(() => {
      if (!el) return;
      const at = next.indexOf(tag, Math.max(0, pos - 1)) + tag.length;
      el.focus();
      el.setSelectionRange(at, at);
    });
  };
  const post = async () => {
    if (!supabase || !a || !text.trim()) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("portal_add_review_comment", { p_deliverable: a.id, p_body: text.trim(), p_timecode: stamp, p_parent: null, p_frame_path: null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    setText("");
    setStamp(null);
    reload();
  };
  const sendReply = async (root: RComment) => {
    const body = (reply[root.id] || "").trim();
    if (!supabase || !body) return;
    const { error } = await supabase.rpc("portal_add_review_comment", { p_deliverable: root.deliverable_id, p_body: body, p_timecode: null, p_parent: root.id, p_frame_path: null });
    if (error) return setErr(errText(error.message));
    setReply((r) => ({ ...r, [root.id]: "" }));
    reload();
  };
  const resolve = async (c: RComment, v: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.rpc("portal_resolve_review_comment", { p_comment: c.id, p_resolved: v });
    if (error) return setErr(errText(error.message));
    reload();
  };
  const syncB = async () => {
    const t = await playerA.current?.getTime();
    if (t != null) playerB.current?.seek(t);
  };
  return (
    <Card
      title="Video review studio"
      sub="Pause on any frame, leave a comment at that exact moment, and compare versions side by side."
      right={
        versions.length > 1 ? (
          <button type="button" onClick={() => setBId(b ? null : versions.find((v) => v.id !== a?.id)?.id || null)} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px] inline-flex items-center gap-1.5">
            <Columns2 className="w-4 h-4" /> {b ? "Single view" : "Compare versions"}
          </button>
        ) : undefined
      }
    >
      <div className={`grid gap-4 ${b ? "xl:grid-cols-2" : "xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]"}`}>
        <div className="space-y-2 min-w-0">
          <select value={a?.id} onChange={(e) => setAId(e.target.value)} className={`${fieldCls} h-10`} style={fieldStyle} aria-label="Version">
            {versions.map((d) => <option key={d.id} value={d.id}>{d.title} {d.version || ""} · {fmtDate(d.created_at)}</option>)}
          </select>
          {a && <ReviewMedia ref={playerA} url={a.url} resolveUrl={resolvePortalUrl} />}
          {a?.client_summary && <p className="text-[13px] px-3 py-2 rounded-[12px] whitespace-pre-line" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}><b>What changed:</b> {a.client_summary}</p>}
        </div>
        {b ? (
          <div className="space-y-2 min-w-0">
            <div className="flex gap-2">
              <select value={b.id} onChange={(e) => setBId(e.target.value)} className={`${fieldCls} h-10 flex-1`} style={fieldStyle} aria-label="Compare with">
                {versions.filter((v) => v.id !== a?.id).map((d) => <option key={d.id} value={d.id}>{d.title} {d.version || ""} · {fmtDate(d.created_at)}</option>)}
              </select>
              <button type="button" onClick={syncB} className="sos-jelly sos-jelly-ghost h-10 px-3 text-[12px] shrink-0" title="Jump this player to the same moment as the left one">Sync time</button>
            </div>
            <ReviewMedia ref={playerB} url={b.url} resolveUrl={resolvePortalUrl} />
          </div>
        ) : (
          <div className="space-y-3 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold" style={{ color: "var(--sos-text-1)" }}>Comments · {mine.filter((c) => !c.parent_id && !c.resolved_at).length} open</p>
              <label className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--sos-text-3)" }}><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} /> Resolved</label>
            </div>
            {canComment && (
              <div className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={insertStamp} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5" title="Pause the video where you want the change, then tap — the exact time is added to your comment">
                    <Clapperboard className="w-4 h-4" /> Add timestamp
                  </button>
                  <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Pause on the moment, tap, then write what to change.</span>
                </div>
                <textarea ref={textRef} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. At 01:24 — the costume changes between these two shots; keep it as in the approved reference." className={`${fieldCls} py-2`} style={{ ...fieldStyle, background: "var(--sos-surface)" }} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && post()} />
                <button type="button" disabled={busy || !text.trim()} onClick={post} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Comment</button>
              </div>
            )}
            {err && <p className="text-[13px]" style={{ color: "#B42318" }}>{err}</p>}
            <div className="space-y-2 max-h-[520px] overflow-y-auto overscroll-contain pr-1">
              {!roots.length && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No comments on this version yet.</p>}
              {roots.map((c) => {
                const replies = mine.filter((r) => r.parent_id === c.id);
                return (
                  <div key={c.id} className="p-3 rounded-[14px] space-y-1.5" style={{ background: "var(--sos-surface-2)", opacity: c.resolved_at ? 0.6 : 1 }}>
                    <div className="flex items-start gap-2">
                      {c.timecode != null && (
                        <button type="button" onClick={() => playerA.current?.seek(Number(c.timecode))} className="sos-num shrink-0 h-6 px-2 rounded-full text-[11px] font-bold" style={{ background: "var(--sos-primary)", color: "#fff" }}>{fmtTime(Number(c.timecode))}</button>
                      )}
                      <p className="text-[13px] flex-1 min-w-0 whitespace-pre-wrap" style={{ color: "var(--sos-text-1)" }}><b>{c.from_studio ? "Studio" : c.author_name || "You"}:</b> <StampedText text={c.body} onSeek={(t) => playerA.current?.seek(t)} /></p>
                      {canComment && (
                        <button type="button" onClick={() => resolve(c, !c.resolved_at)} className="shrink-0" style={{ color: c.resolved_at ? "var(--sos-text-3)" : "#17663F" }} title={c.resolved_at ? "Reopen" : "Mark resolved"} aria-label={c.resolved_at ? "Reopen" : "Mark resolved"}>
                          {c.resolved_at ? <RotateCcw className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {c.frame_path && <FrameThumb path={c.frame_path} />}
                    {replies.map((r) => (
                      <p key={r.id} className="ml-4 text-[13px] whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}><Reply className="inline w-3 h-3 mr-1" /><b>{r.from_studio ? "Studio" : r.author_name || "You"}:</b> {r.body}</p>
                    ))}
                    {canComment && !c.resolved_at && (
                      <div className="ml-4 flex gap-1.5">
                        <input value={reply[c.id] || ""} onChange={(e) => setReply((x) => ({ ...x, [c.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && sendReply(c)} placeholder="Reply…" className={`${fieldCls} h-8 text-[13px]`} style={{ ...fieldStyle, background: "var(--sos-surface)" }} />
                        <button type="button" onClick={() => sendReply(c)} className="sos-jelly w-8 h-8 inline-flex items-center justify-center shrink-0" aria-label="Send reply"><Send className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
/** Turn "01:24" / "1:02:10" in comment text into buttons that seek the player. */
export const StampedText: React.FC<{ text: string; onSeek?: (s: number) => void }> = ({ text, onSeek }) => {
  const parts = text.split(/(\b\d{1,2}:\d{2}(?::\d{2})?\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0 || !onSeek) return <React.Fragment key={i}>{p}</React.Fragment>;
        const secs = p.split(":").map(Number).reduce((a, n) => a * 60 + n, 0);
        return (
          <button key={i} type="button" onClick={() => onSeek(secs)} className="sos-num inline-flex items-center h-5 px-1.5 mx-0.5 rounded-full text-[11px] font-bold align-baseline" style={{ background: "var(--sos-primary)", color: "#fff" }}>
            {p}
          </button>
        );
      })}
    </>
  );
};
const FrameThumb: React.FC<{ path: string }> = ({ path }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    supabase?.storage.from("client-uploads").createSignedUrl(path, 3600).then(({ data }) => setSrc(data?.signedUrl || null));
  }, [path]);
  return src ? <img src={src} alt="Attached frame" className="max-h-36 rounded-[10px]" /> : null;
};

// ───────────────────────────────────────────────────────────── change requests + approvals history
const CR_STATUS: Record<string, { label: string; t: keyof typeof Tone }> = {
  submitted: { label: "Sent to studio", t: "blue" },
  under_review: { label: "Studio reviewing", t: "blue" },
  proposed: { label: "Proposal — your decision", t: "amber" },
  accepted: { label: "Accepted", t: "green" },
  rejected: { label: "Declined", t: "grey" },
  withdrawn: { label: "Withdrawn", t: "grey" },
  done: { label: "Done", t: "violet" },
};
export const ChangeRequestsCard: React.FC<{ projectId: string; onChanged?: () => void }> = ({ projectId, onChanged }) => {
  const { canApprove } = usePortalRole();
  const { rows, reload } = useRows<PChange>("studio_change_requests", (q) => q.eq("project_id", projectId), [projectId]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!supabase || title.trim().length < 2) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("portal_submit_change_request", { p_project: projectId, p_title: title.trim(), p_description: desc.trim() || null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    setTitle("");
    setDesc("");
    setOpen(false);
    reload();
    onChanged?.();
  };
  const decide = async (c: PChange, accept: boolean) => {
    if (!supabase) return;
    if (!window.confirm(accept ? `Accept this proposal?\n\n${c.proposed_amount ? `${c.currency} ${Number(c.proposed_amount).toLocaleString()}` : "No extra cost"}${c.proposed_days ? ` · +${c.proposed_days} days` : ""}\n\nThe studio will update the scope, invoice and timeline.` : "Decline this proposal? Your original scope stays as it is.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("portal_decide_change_request", { p_id: c.id, p_accept: accept, p_comment: (comment[c.id] || "").trim() || null });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    reload();
    onChanged?.();
  };
  const list = [...rows].reverse();
  return (
    <Card
      title="Scope change requests"
      sub="Need something beyond the agreed scope? Ask here — the studio replies with any cost and time impact for you to accept or decline."
      right={canApprove && !open ? <button type="button" onClick={() => setOpen(true)} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> New request</button> : undefined}
    >
      {open && (
        <div className="space-y-2 p-3 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What would you like to change? (e.g. Add a 15-second cut-down)" className={`${fieldCls} h-11`} style={{ ...fieldStyle, background: "var(--sos-surface)" }} />
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Details (optional)" className={`${fieldCls} py-2.5`} style={{ ...fieldStyle, background: "var(--sos-surface)" }} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || title.trim().length < 2} onClick={submit} className="sos-jelly h-10 px-4 text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to studio</button>
            <button type="button" onClick={() => setOpen(false)} className="sos-jelly sos-jelly-ghost h-10 px-4 text-[13px]">Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="text-[13px]" style={{ color: "#B42318" }}>{err}</p>}
      {!list.length && !open && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No change requests.</p>}
      <div className="space-y-2">
        {list.map((c) => {
          const st = CR_STATUS[c.status] || CR_STATUS.submitted;
          return (
            <div key={c.id} className="p-3.5 rounded-[16px] space-y-2" style={{ background: "var(--sos-surface-2)", boxShadow: c.status === "proposed" ? "inset 3px 0 0 #F59E0B" : undefined }}>
              <div className="flex flex-wrap items-start gap-2">
                <p className="text-[14px] font-semibold flex-1 min-w-0" style={{ color: "var(--sos-text-1)" }}>{c.title}</p>
                <Chip t={st.t}>{st.label}</Chip>
              </div>
              {c.description && <p className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}>{c.description}</p>}
              {["proposed", "accepted", "rejected", "done"].includes(c.status) && (c.proposed_amount != null || c.proposed_days != null || c.proposal_note) && (
                <div className="p-3 rounded-[12px]" style={{ background: "var(--sos-surface)" }}>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                    Studio proposal: {c.proposed_amount ? `${c.currency} ${Number(c.proposed_amount).toLocaleString()}` : "no extra cost"}{c.proposed_days ? ` · +${c.proposed_days} working days` : ""}
                  </p>
                  {c.proposal_note && <p className="text-[13px] mt-0.5" style={{ color: "var(--sos-text-2)" }}>{c.proposal_note}</p>}
                </div>
              )}
              {c.status === "proposed" && canApprove && (
                <div className="space-y-2">
                  <input value={comment[c.id] || ""} onChange={(e) => setComment((x) => ({ ...x, [c.id]: e.target.value }))} placeholder="Comment (optional)" className={`${fieldCls} h-10`} style={{ ...fieldStyle, background: "var(--sos-surface)" }} />
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => decide(c, true)} className="sos-jelly sos-jelly-green h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Accept</button>
                    <button type="button" disabled={busy} onClick={() => decide(c, false)} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px]">Decline</button>
                  </div>
                </div>
              )}
              <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{c.contact_name || "You"} · {fmtDate(c.created_at)}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const DECISION: Record<string, { label: string; t: keyof typeof Tone }> = {
  approved: { label: "Approved", t: "green" },
  changes_requested: { label: "Changes requested", t: "red" },
  accepted: { label: "Accepted", t: "green" },
  rejected: { label: "Declined", t: "grey" },
};
export const ApprovalHistoryCard: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { rows } = useRows<PApproval>("studio_approvals", (q) => q.eq("project_id", projectId), [projectId]);
  const list = [...rows].reverse();
  return (
    <Card title="Approval history" sub="Every decision made on this project — who, when and on what.">
      {!list.length ? (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Approvals you make will be recorded here.</p>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: "var(--sos-border)" }} />
          {list.map((a) => {
            const d = DECISION[a.decision] || DECISION.approved;
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2" style={{ borderColor: Tone[d.t][1], background: "var(--sos-surface)" }} />
                <p className="text-[14px]" style={{ color: "var(--sos-text-1)" }}>
                  <b>{a.entity_name || "Item"}</b> <Chip t={d.t}>{d.label}</Chip>
                </p>
                <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>{a.contact_name || "Client"} · {new Date(a.created_at).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                {a.comment && <p className="text-[13px] italic mt-0.5" style={{ color: "var(--sos-text-2)" }}>“{a.comment}”</p>}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
};

// ───────────────────────────────────────────────────────────── activity + report
interface ActGate {
  id: string;
  name: string;
  status: string;
  approved_at: string | null;
  sent_for_approval_at: string | null;
  due_date?: string | null;
}
export const ActivityPanel: React.FC<{
  project: { id: string; title: string; code?: string; status: string; promised_date: string | null; current_stage: string | null; closed_at: string | null };
  gates: ActGate[];
  deliverables: PDeliverable[];
  messages: PMsg[];
  tasks: Array<{ title: string; status: string; due_date: string | null; responsibility?: string }>;
}> = ({ project, gates, deliverables, messages, tasks }) => {
  const { rows: approvals } = useRows<PApproval>("studio_approvals", (q) => q.eq("project_id", project.id), [project.id]);
  const { rows: uploads } = useRows<{ id: string; name: string; contact_name: string | null; created_at: string }>("studio_client_uploads", (q) => q.eq("project_id", project.id), [project.id]);
  const items = useMemo(() => {
    const out: Array<{ at: string; icon: React.ReactNode; color: string; text: string; sub?: string }> = [];
    for (const d of deliverables) out.push({ at: d.created_at, icon: <Clapperboard className="w-3.5 h-3.5" />, color: "#7C3AED", text: `${d.is_final ? "Final files delivered" : "New version shared"}: ${d.title} ${d.version || ""}` });
    for (const g of gates) {
      if (g.sent_for_approval_at) out.push({ at: g.sent_for_approval_at, icon: <Sparkles className="w-3.5 h-3.5" />, color: "#D97706", text: `${g.name} sent for your review` });
    }
    for (const a of approvals) out.push({ at: a.created_at, icon: a.decision === "approved" || a.decision === "accepted" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />, color: a.decision === "approved" || a.decision === "accepted" ? "#16A34A" : "#DC2626", text: `${a.contact_name || "You"} ${(DECISION[a.decision]?.label || a.decision).toLowerCase()} ${a.entity_name || ""}`, sub: a.comment || undefined });
    for (const m of messages.filter((x) => x.project_id === project.id)) {
      if (m.kind === "meeting_note") out.push({ at: m.created_at, icon: <FileText className="w-3.5 h-3.5" />, color: "#0EA5E9", text: `Meeting notes: ${m.subject || ""}`, sub: m.body.slice(0, 220) });
      else if (m.kind === "announcement") out.push({ at: m.created_at, icon: <Sparkles className="w-3.5 h-3.5" />, color: "#5B3FE4", text: `Announcement: ${m.subject || ""}`, sub: m.body.slice(0, 220) });
      else out.push({ at: m.created_at, icon: <MessageSquare className="w-3.5 h-3.5" />, color: m.from_studio ? "#5B3FE4" : "#0EA5E9", text: m.from_studio ? "Studio sent a message" : `${m.author_name || "You"} sent a message`, sub: m.body.slice(0, 160) });
    }
    for (const u of uploads) out.push({ at: u.created_at, icon: <Upload className="w-3.5 h-3.5" />, color: "#0891B2", text: `${u.contact_name || "You"} uploaded ${u.name}` });
    return out.sort((x, y) => y.at.localeCompare(x.at));
  }, [deliverables, gates, approvals, messages, uploads, project.id]);

  const print = () => {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const done = gates.filter((g) => g.status === "approved" || g.status === "skipped").length;
    const st = (s: string) => ({ approved: "Completed", waiting_on_client: "Awaiting your review", in_work: "In progress", revising: "Revising", not_started: "Not started", skipped: "Skipped" } as Record<string, string>)[s] || s;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(project.title)} — Project report</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#16181D;max-width:820px;margin:32px auto;padding:0 24px;font-size:13px;line-height:1.5}h1{font-size:24px;margin:0}h2{font-size:15px;margin:26px 0 8px;border-bottom:1px solid #E6E8EE;padding-bottom:4px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #F0F1F5;vertical-align:top}th{color:#6B7080;font-weight:600}.muted{color:#6B7080}.bar{height:8px;background:#EEF0F4;border-radius:8px;overflow:hidden}.bar span{display:block;height:100%;background:#5B3FE4}</style></head><body>
<p class="muted">The Chanting Studio · Project report · ${esc(new Date().toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" }))}</p>
<h1>${esc(project.title)}</h1>
<p>${project.closed_at ? "Completed & closed" : esc(project.current_stage || project.status)}${project.promised_date ? ` · Planned delivery ${esc(fmtDate(project.promised_date))}` : ""}</p>
<div class="bar"><span style="width:${gates.length ? Math.round((done / gates.length) * 100) : 0}%"></span></div><p class="muted">${done} of ${gates.length} stages complete</p>
<h2>Production stages</h2><table><tr><th>Stage</th><th>Status</th><th>Due</th><th>Completed</th></tr>${gates.map((g) => `<tr><td>${esc(g.name)}</td><td>${esc(st(g.status))}</td><td>${esc(fmtDate(g.due_date))}</td><td>${esc(fmtDate(g.approved_at))}</td></tr>`).join("")}</table>
<h2>Outstanding approvals</h2>${gates.filter((g) => g.status === "waiting_on_client").map((g) => `<p>• ${esc(g.name)}</p>`).join("") || '<p class="muted">None</p>'}
<h2>Your to-dos</h2>${tasks.filter((t) => t.responsibility === "client" && t.status !== "done").map((t) => `<p>• ${esc(t.title)}${t.due_date ? ` — due ${esc(fmtDate(t.due_date))}` : ""}</p>`).join("") || '<p class="muted">None</p>'}
<h2>Deliverables</h2><table><tr><th>File</th><th>Version</th><th>Shared</th></tr>${deliverables.map((d) => `<tr><td>${esc(d.title)}${d.is_final ? " (final)" : ""}</td><td>${esc(d.version || "")}</td><td>${esc(fmtDate(d.created_at))}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">None yet</td></tr>'}</table>
<h2>Decisions & approvals</h2><table><tr><th>Item</th><th>Decision</th><th>By</th><th>Date</th></tr>${approvals.map((a) => `<tr><td>${esc(a.entity_name || "")}</td><td>${esc(DECISION[a.decision]?.label || a.decision)}${a.comment ? `<br><span class="muted">${esc(a.comment)}</span>` : ""}</td><td>${esc(a.contact_name || "")}</td><td>${esc(fmtDate(a.created_at))}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">None yet</td></tr>'}</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
    const w = window.open("", "_blank", "noopener=no");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Card title="Project activity" sub="Everything that has happened on this project, newest first." right={<button type="button" onClick={print} className="sos-jelly sos-jelly-ghost h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><Printer className="w-4 h-4" /> Project report (PDF)</button>}>
      {!items.length ? (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Activity appears here as the project moves.</p>
      ) : (
        <ol className="relative space-y-3.5 pl-6">
          <span className="absolute left-[11px] top-1 bottom-1 w-px" style={{ background: "var(--sos-border)" }} />
          {items.slice(0, 80).map((it, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }} className="relative">
              <span className="absolute -left-6 top-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-white" style={{ background: it.color }}>{it.icon}</span>
              <p className="text-[14px]" style={{ color: "var(--sos-text-1)" }}>{it.text}</p>
              {it.sub && <p className="text-[13px] line-clamp-3 whitespace-pre-wrap" style={{ color: "var(--sos-text-2)" }}>{it.sub}</p>}
              <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{new Date(it.at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
            </motion.li>
          ))}
        </ol>
      )}
    </Card>
  );
};

// ───────────────────────────────────────────────────────────── mail-style messages
export const MailInbox: React.FC<{ messages: PMsg[]; reload: () => void; projects: Array<{ id: string; title: string }>; clientId?: string; statusLine?: string; initialProject?: string | null }> = ({ messages, reload, projects, clientId, statusLine, initialProject }) => {
  const threads = useMemo(() => {
    const roots = messages.filter((m) => !m.parent_id);
    const ids = new Set(roots.map((r) => r.id));
    const list = roots.map((r) => {
      const replies = messages.filter((m) => m.parent_id === r.id);
      const all = [r, ...replies];
      const last = all[all.length - 1];
      return { root: r, all, last, unread: all.some((m) => m.from_studio && !m.read_by_client_at) };
    });
    // Orphans (parent not visible) become their own threads.
    for (const m of messages) if (m.parent_id && !ids.has(m.parent_id)) list.push({ root: m, all: [m], last: m, unread: m.from_studio && !m.read_by_client_at });
    return list.sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  }, [messages]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [projectId, setProjectId] = useState(initialProject || "");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sendPct, setSendPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const thread = threads.find((t) => t.root.id === openId) || null;
  const title = (pid?: string | null) => projects.find((p) => p.id === pid)?.title;
  useEffect(() => {
    if (thread?.unread && supabase) supabase.rpc("portal_mark_messages_read").then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
  const uploadAll = async (): Promise<Array<{ name: string; path: string; size: number }>> => {
    if (!files.length || !supabase || !clientId) return [];
    const out = [];
    for (const f of files.slice(0, 10)) {
      if (f.size > 50 * 1024 * 1024) throw new Error(`${f.name} is over 50 MB.`);
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-100);
      const path = `${clientId}/${projectId || "general"}/mail/${crypto.randomUUID()}-${safe}`;
      await uploadResumable("client-uploads", path, f, (p) => setSendPct(Math.round(p * 100)));
      out.push({ name: f.name, path, size: f.size });
    }
    return out;
  };
  const send = async () => {
    if (!supabase || (!body.trim() && !files.length)) return;
    setBusy(true);
    setErr("");
    try {
      const attachments = await uploadAll();
      const replyTo = thread && !composing ? thread.root : null;
      const { error } = await supabase.rpc("portal_send_thread_message", {
        p_body: body.trim() || "(attachment)",
        p_project_id: replyTo ? replyTo.project_id : projectId || null,
        p_subject: replyTo ? (replyTo.subject ? (/^re:/i.test(replyTo.subject) ? replyTo.subject : `Re: ${replyTo.subject}`) : null) : subject.trim() || null,
        p_parent: replyTo ? replyTo.id : null,
        p_attachments: attachments,
      });
      if (error) throw new Error(/rate_limited/.test(error.message) ? "That's a lot of messages — please wait a little and try again." : "Couldn't send. Please try again.");
      setBody("");
      setSubject("");
      setFiles([]);
      setComposing(false);
      reload();
    } catch (e: any) {
      setErr(e?.message || "Couldn't send.");
    } finally {
      setBusy(false);
      setSendPct(null);
    }
  };
  const openAtt = async (path: string) => {
    const { data } = (await supabase?.storage.from("client-uploads").createSignedUrl(path, 600)) || { data: null };
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  const Composer = (
    <div className="space-y-2">
      {(composing || !thread) && (
        <>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={`${fieldCls} h-11`} style={fieldStyle} />
          {projects.length > 0 && (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${fieldCls} h-11`} style={fieldStyle} aria-label="About which project">
              <option value="">General</option>
              {projects.map((p) => <option key={p.id} value={p.id}>About: {p.title}</option>)}
            </select>
          )}
        </>
      )}
      <textarea rows={composing || !thread ? 6 : 3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={thread && !composing ? "Write a reply…" : "Write your message…"} className={`${fieldCls} py-2.5`} style={fieldStyle} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && send()} />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px]" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
              <Paperclip className="w-3 h-3" /> {f.name.slice(0, 28)}
              <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Remove attachment"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || (!body.trim() && !files.length)} onClick={send} className="sos-jelly h-10 px-5 text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {busy && sendPct != null ? `Uploading ${sendPct}%` : "Send"}</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="sos-jelly sos-jelly-ghost h-10 px-3 text-[13px] inline-flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Attach</button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files || [])].slice(0, 10)); e.target.value = ""; }} />
        {composing && <button type="button" onClick={() => setComposing(false)} className="ml-auto text-[13px]" style={{ color: "var(--sos-text-3)" }}>Discard</button>}
      </div>
      {err && <p className="text-[13px]" style={{ color: "#B42318" }}>{err}</p>}
    </div>
  );
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 pb-3">
        {thread && !composing ? (
          <button type="button" onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--sos-text-2)" }}><ChevronRight className="w-4 h-4 rotate-180" /> Inbox</button>
        ) : (
          <div>
            <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Messages</h2>
            {statusLine && <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>{statusLine}</p>}
          </div>
        )}
        {!composing && (
          <button type="button" onClick={() => { setComposing(true); setOpenId(null); }} className="sos-jelly h-9 px-4 text-[13px] inline-flex items-center gap-1.5"><PenLine className="w-4 h-4" /> New message</button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
        {composing ? (
          Composer
        ) : thread ? (
          <div className="space-y-3">
            <h3 className="text-[17px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{thread.root.subject || (thread.root.kind === "meeting_note" ? "Meeting notes" : thread.root.kind === "announcement" ? "Announcement" : "Message")}</h3>
            {title(thread.root.project_id) && <Chip t="violet">{title(thread.root.project_id)}</Chip>}
            {thread.all.map((m) => (
              <div key={m.id} className="p-3.5 rounded-[16px] space-y-1" style={{ background: m.from_studio ? "var(--sos-surface)" : "var(--sos-violet-soft)", boxShadow: "0 0 0 1px var(--sos-border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{m.from_studio ? "The Chanting Studio" : m.author_name || "You"}</span>
                  <span className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--sos-text-3)" }}>
                    {new Date(m.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {!m.from_studio && <Receipt read={m.read_by_studio_at || null} delivered={m.delivered_to_studio_at || null} />}
                  </span>
                </div>
                <p className="text-[14px] whitespace-pre-wrap break-words" style={{ color: "var(--sos-text-1)" }}>{m.body}</p>
                {!!m.attachments?.length && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {m.attachments.map((a) => (
                      <button key={a.path} type="button" onClick={() => openAtt(a.path)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium" style={{ background: "var(--sos-surface-2)", color: "var(--sos-primary)" }}><Paperclip className="w-3 h-3" /> {a.name}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="pt-1">{Composer}</div>
          </div>
        ) : !threads.length ? (
          <div className="space-y-4">
            <Empty icon={<Inbox className="w-7 h-7" />} text="No messages yet. Write to the studio — it arrives like an email and they reply here." />
            {Composer}
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((t, i) => (
              <motion.button
                key={t.root.id}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.02 }}
                onClick={() => setOpenId(t.root.id)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-[16px] transition-colors hover:bg-[var(--sos-surface-2)]"
                style={t.unread ? { background: "var(--sos-violet-soft)" } : undefined}
              >
                <span className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: t.last.from_studio ? "linear-gradient(135deg, #8B6CFF, #5B3FE4)" : "#0EA5E9" }}>{t.last.from_studio ? "TCS" : "You"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`text-[14px] truncate ${t.unread ? "font-bold" : "font-semibold"}`} style={{ color: "var(--sos-text-1)" }}>{t.root.subject || (t.root.kind === "meeting_note" ? "Meeting notes" : t.root.kind === "announcement" ? "Announcement" : t.root.from_studio ? "From the studio" : "Your message")}</span>
                    {t.all.length > 1 && <span className="text-[11px] shrink-0" style={{ color: "var(--sos-text-3)" }}>{t.all.length}</span>}
                    <span className="ml-auto text-[11px] shrink-0" style={{ color: "var(--sos-text-3)" }}>{fmtDate(t.last.created_at)}</span>
                  </span>
                  <span className="block text-[13px] truncate" style={{ color: "var(--sos-text-2)" }}>{title(t.root.project_id) ? `${title(t.root.project_id)} — ` : ""}{t.last.body}</span>
                </span>
                {t.unread && <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: "#E11D48" }} />}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Top-bar Messages button + right-side mail drawer (replaces the floating bubble). */
export const MessagesButton: React.FC<{ unread: number; open: boolean; setOpen: (o: boolean) => void; children: React.ReactNode }> = ({ unread, open, setOpen, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpen]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative h-10 pl-3 pr-3.5 rounded-full border inline-flex items-center gap-2 text-[13px] font-semibold transition-colors hover:bg-[var(--sos-surface-2)]" style={{ borderColor: unread ? "var(--sos-primary)" : "var(--sos-border)", color: unread ? "var(--sos-primary)" : "var(--sos-text-2)", background: "var(--sos-surface)" }} aria-label={unread ? `Messages, ${unread} unread` : "Messages"}>
        <Mail className="w-4 h-4" />
        <span className="hidden sm:inline">Messages</span>
        {unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center text-white sos-pulse-badge" style={{ background: "#E11D48" }}>{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 inset-y-0 w-full sm:w-[560px] flex flex-col shadow-2xl"
              style={{ background: "var(--sos-canvas)", paddingBottom: "env(safe-area-inset-bottom)" }}
              role="dialog"
              aria-label="Messages"
            >
              <div className="flex items-center justify-between px-5 pt-4">
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>Goes to the studio like an email</span>
                <button type="button" onClick={() => setOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }} aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 min-h-0 px-5 pt-3 pb-5">{children}</div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ───────────────────────────────────────────────────────────── account: email kinds + role
const KIND_OPTS = [
  { id: "review_ready", label: "Something is ready for my review" },
  { id: "new_version", label: "A new version is shared" },
  { id: "final_delivery", label: "Final files are delivered" },
  { id: "message", label: "The studio sends a message or proposal" },
];
const ROLE_LABEL: Record<string, string> = { admin: "Admin — full access", approver: "Approver — review & approve", reviewer: "Reviewer — comment only", finance: "Finance — invoices", viewer: "Viewer — read only" };
export const EmailKindsCard: React.FC = () => {
  const { role, emailKinds, loaded } = usePortalRole();
  const [sel, setSel] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (loaded) setSel(emailKinds || KIND_OPTS.map((k) => k.id));
  }, [loaded, emailKinds]);
  const toggle = async (id: string) => {
    if (!supabase || !sel || role !== "admin") return;
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    setSaving(true);
    await supabase.rpc("portal_set_email_kinds", { p_kinds: next });
    setSaving(false);
  };
  return (
    <div className="sos-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--sos-text-1)" }}>What should we email you about?</h2>
          <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>Your access: <b>{ROLE_LABEL[role] || role}</b>{role !== "admin" ? " · your team admin can change these" : ""}</p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--sos-text-3)" }} />}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {KIND_OPTS.map((k) => {
          const on = sel?.includes(k.id) ?? true;
          return (
            <button key={k.id} type="button" disabled={role !== "admin" || !sel} onClick={() => toggle(k.id)} className="text-left flex items-center gap-2.5 p-3 rounded-[14px] border transition-colors disabled:opacity-70" style={on ? { borderColor: "var(--sos-primary)", background: "var(--sos-violet-soft)" } : { borderColor: "var(--sos-border)" }} aria-pressed={on}>
              <span className="w-5 h-5 rounded-[6px] flex items-center justify-center shrink-0" style={on ? { background: "var(--sos-primary)", color: "#fff" } : { border: "1.5px solid var(--sos-border)" }}>{on && <Check className="w-3.5 h-3.5" />}</span>
              <span className="text-[13px]" style={{ color: "var(--sos-text-1)" }}>{k.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[12px] inline-flex items-center gap-1.5" style={{ color: "var(--sos-text-3)" }}><AlertCircle className="w-3.5 h-3.5" /> You'll always see everything in the portal and the bell.</p>
    </div>
  );
};

// ───────────────────────────────────────────────────────────── gantt timeline (Studio OS dates only)
interface GGate {
  id: string;
  project_id: string;
  name: string;
  status: string;
  order_index: number;
  started_at: string | null;
  approved_at: string | null;
  sent_for_approval_at: string | null;
  due_date?: string | null;
  episode?: number | null;
}
const DAY = 86400000;
const toMs = (d?: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).getTime() : NaN);
export const ProjectGantt: React.FC<{ projects: Array<{ id: string; title: string; promised_date: string | null; closed_at: string | null; status: string }>; gates: GGate[]; onOpen: (id: string) => void }> = ({ projects, gates, onOpen }) => {
  const active = projects.filter((p) => !p.closed_at && !["delivered", "paid"].includes(p.status));
  const rows = active
    .map((p) => {
      const gs = gates.filter((g) => g.project_id === p.id && !g.episode).sort((a, b) => a.order_index - b.order_index);
      let cursor = NaN;
      const bars = gs
        .map((g) => {
          const end = toMs(g.approved_at) || toMs(g.due_date);
          const start = toMs(g.started_at) || cursor || (Number.isFinite(end) ? end - 3 * DAY : NaN);
          if (Number.isFinite(end)) cursor = end;
          return Number.isFinite(start) && Number.isFinite(end) ? { g, start: Math.min(start, end), end: Math.max(end, start + DAY / 2) } : null;
        })
        .filter(Boolean) as Array<{ g: GGate; start: number; end: number }>;
      return { p, bars, delivery: toMs(p.promised_date) };
    })
    .filter((r) => r.bars.length || Number.isFinite(r.delivery));
  if (!rows.length) return null;
  const all = rows.flatMap((r) => [...r.bars.flatMap((b) => [b.start, b.end]), r.delivery]).filter(Number.isFinite);
  const now = Date.now();
  const min = Math.min(...all, now) - 2 * DAY;
  const max = Math.max(...all, now) + 3 * DAY;
  const pct = (t: number) => ((t - min) / (max - min)) * 100;
  const months: Array<{ at: number; label: string }> = [];
  for (let d = new Date(min); d.getTime() <= max; d.setDate(d.getDate() + 1)) if (d.getDate() === 1 || d.getTime() === min) months.push({ at: d.getTime(), label: d.toLocaleDateString([], { month: "short", day: d.getDate() === 1 ? undefined : "numeric" }) });
  const color = (st: string) => (st === "approved" || st === "skipped" ? "#16A34A" : st === "waiting_on_client" ? "#F59E0B" : st === "revising" ? "#DC2626" : st === "in_work" ? "#5B3FE4" : "#C9CCD6");
  return (
    <Card title="Production timeline" sub="Stage dates set by the studio. Green done · purple in progress · amber your review · grey upcoming. The diamond is the planned delivery.">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[640px] space-y-3">
          <div className="relative h-5 ml-[180px]">
            {months.map((m) => (
              <span key={m.at} className="absolute text-[11px] font-semibold -translate-x-1/2" style={{ left: `${pct(m.at)}%`, color: "var(--sos-text-3)" }}>{m.label}</span>
            ))}
          </div>
          {rows.map(({ p, bars, delivery }) => (
            <div key={p.id} className="flex items-center gap-3">
              <button type="button" onClick={() => onOpen(p.id)} className="w-[168px] shrink-0 text-left text-[13px] font-semibold truncate hover:underline" style={{ color: "var(--sos-text-1)" }}>{p.title}</button>
              <div className="relative flex-1 h-8 rounded-full" style={{ background: "var(--sos-surface-2)" }}>
                <span className="absolute top-0 bottom-0 w-px" style={{ left: `${pct(now)}%`, background: "#E11D48" }} title="Today" />
                {bars.map(({ g, start, end }) => (
                  <span key={g.id} className="absolute top-1.5 h-5 rounded-full" style={{ left: `${pct(start)}%`, width: `${Math.max(0.8, pct(end) - pct(start))}%`, background: color(g.status), opacity: 0.9 }} title={`${g.name}: ${fmtDate(new Date(start).toISOString())} → ${fmtDate(new Date(end).toISOString())}`} />
                ))}
                {Number.isFinite(delivery) && <span className="absolute top-1/2 w-3.5 h-3.5 rotate-45 -translate-y-1/2 -translate-x-1/2 border-2" style={{ left: `${pct(delivery)}%`, background: "#fff", borderColor: "#16A34A" }} title={`Planned delivery ${fmtDate(new Date(delivery).toISOString())}`} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
