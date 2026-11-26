import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotificationBell, NotificationToast, usePortalNotifications, type PortalNotification } from "./PortalNotifications";
import { SegToggle } from "../review/SegToggle";
import { StudioLogo } from "../brand/StudioLogo";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  Check,
  Clock,
  Download,
  FileText,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Play,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./portalSupabase";
import { AccountTab, CalendarTab, MessagesTab, PortalAssistant, PortalNav, StudioClock, useIsLarge, usePortalMessages, useStudioInfo, type PortalTab } from "./PortalExtras";
import { AnimatePresence, motion } from "motion/react";
import { ReviewMedia, type ReviewMediaHandle, type NoteRef, fmtTime, parseTime, noteLine, parseMedia } from "../review/ReviewMedia";
import { SketchOverlay, VoiceNoteButton } from "./PortalReviewTools";
import { ProjectThumb, thumbCandidates, downloadHref, isStreamOnly } from "../review/ProjectThumb";
import "../studio-os/studio-os.css";

// ---------------------------------------------------------------------------
// Types (mirror the portal_* views — no internal fields exist on these)
// ---------------------------------------------------------------------------
interface PortalProject {
  id: string;
  code: string;
  title: string;
  type: string;
  status: string;
  hard_deadline: string | null;
  promised_date: string | null;
  forecast_date: string | null;
  health: "on_track" | "tight" | "at_risk" | "late";
  cover_image_url: string | null;
  emoji: string | null;
  review_link_url: string | null;
  current_stage: string | null;
  updated_at: string;
  closed_at: string | null;
}
interface PortalGate {
  id: string;
  project_id: string;
  order_index: number;
  name: string;
  needs_client_approval: boolean;
  status: "not_started" | "in_work" | "waiting_on_client" | "approved" | "revising" | "skipped";
  started_at: string | null;
  sent_for_approval_at: string | null;
  approved_at: string | null;
  revision_round: number;
  revisions_included: number;
  client_comment: string | null;
  due_date?: string | null;
}
interface PortalRevision {
  id: string;
  project_id: string;
  gate_id: string | null;
  title: string;
  round: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}
interface PortalTask {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
}
interface PortalDeliverable {
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
interface PortalInvoice {
  id: string;
  project_id: string;
  invoice_no: string | null;
  amount: number;
  currency: string;
  tds_amount: number | null;
  status: string;
  sent_at: string | null;
  due_at: string | null;
  received_at: string | null;
  file_url: string | null;
}

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  try {
    return format(parseISO(d), "d MMM yyyy");
  } catch {
    return null;
  }
};
const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
/** Delivery date shown to clients: only the studio's planned date (the internal projection stays private). */
const milestoneDate = (p: PortalProject) => p.promised_date || p.hard_deadline || null;
/** True when the studio's internal forecast suggests the planned date could slip (no date is revealed). */
const plannedMoved = (p: PortalProject) => Boolean(p.promised_date) && (p.health === "late" || p.health === "at_risk");

type PortalFilter = "all" | "in_progress" | "awaiting" | "delivered" | "closed" | "proposal" | "paused";
const FILTERS: Array<{ id: PortalFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "in_progress", label: "In progress" },
  { id: "awaiting", label: "Awaiting your approval" },
  { id: "delivered", label: "Delivered" },
  { id: "closed", label: "Completed & closed" },
  { id: "proposal", label: "Proposals" },
  { id: "paused", label: "Paused" },
];
/** Which bucket a project belongs to (one each, most specific first). */
function projectBucket(p: PortalProject, gates: PortalGate[]): Exclude<PortalFilter, "all"> {
  if (p.closed_at) return "closed";
  if (p.status === "delivered" || p.status === "paid") return "delivered";
  if (gates.some((g) => g.status === "waiting_on_client")) return "awaiting";
  if (p.status === "lead" || p.status === "quoted") return "proposal";
  if (p.status === "on_hold" || p.status === "parked") return "paused";
  return "in_progress";
}
/** Share of visible stages approved (closed/delivered = 100%). */
function projectProgress(p: PortalProject, gates: PortalGate[]): number {
  if (p.closed_at || p.status === "delivered" || p.status === "paid") return 100;
  if (!gates.length) return 0;
  const done = gates.filter((g) => g.status === "approved" || g.status === "skipped").length;
  return Math.round((done / gates.length) * 100);
}

const ProgressBar: React.FC<{ value: number; label?: string }> = ({ value, label }) => (
  <div>
    <div className="flex items-center justify-between text-[11px] mb-1 sos-tabular" style={{ color: "var(--sos-text-3)" }}>
      <span>{label || "Progress"}</span>
      <span className="font-semibold" style={{ color: value === 100 ? "#17663F" : "var(--sos-text-2)" }}>{value}%</span>
    </div>
    <div className="sos-bar h-2 w-full" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={value === 100 ? "done" : ""} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const HEALTH: Record<PortalProject["health"], { label: string; bg: string; text: string }> = {
  on_track: { label: "On track", bg: "#E7F7EE", text: "#17663F" },
  tight: { label: "On track", bg: "#E7F7EE", text: "#17663F" },
  at_risk: { label: "On track", bg: "#E7F7EE", text: "#17663F" },
  late: { label: "Timeline tight", bg: "#FFF8E1", text: "#8A5A00" },
};
const TYPE_LABEL: Record<string, string> = {
  ad_film: "Ad film",
  explainer: "Explainer",
  music_video: "Music video",
  series: "Series",
  trailer: "Trailer",
  reel: "Reel",
  own_film: "Film",
  internal: "Project",
};

const Pill: React.FC<{ bg: string; text: string; children: React.ReactNode }> = ({ bg, text, children }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap" style={{ background: bg, color: text }}>
    {children}
  </span>
);

const Brand: React.FC<{ onSignOut?: () => void; who?: string; extra?: React.ReactNode }> = ({ onSignOut, who, extra }) => (
  <header className="flex items-center justify-between gap-3 py-5">
    <div className="min-w-0">
      <StudioLogo surface="light" height={24} />
      <p className="text-[12px] mt-1" style={{ color: "var(--sos-text-3)" }}>
        Client portal
      </p>
    </div>
    {onSignOut && (
      <div className="flex items-center gap-2">
        {who && (
          <span className="hidden sm:inline text-[12px]" style={{ color: "var(--sos-text-3)" }}>
            {who}
          </span>
        )}
        {extra}
        <button
          type="button"
          onClick={onSignOut}
          className="sos-pill-btn h-9 px-3.5 text-[13px] font-medium border inline-flex items-center gap-1.5"
          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    )}
  </header>
);

const Footer = () => (
  <footer className="py-10 text-center space-y-1">
    <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
      Delivery dates move day-for-day with approval time.
    </p>
    <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>
      Questions? Write to the studio at studio@thechantingstudio.in
    </p>
  </footer>
);

// ---------------------------------------------------------------------------
// Login: Client ID (or email) + password, or an emailed sign-in link
// ---------------------------------------------------------------------------
const fieldCls = "w-full h-12 px-4 rounded-[14px] border text-[15px]";
const fieldStyle: React.CSSProperties = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };
const ErrorNote: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FDECEC", color: "#B42318" }} role="alert">
    {text}
  </p>
);

const PortalLogin: React.FC = () => {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't sign in.");
      const { error } = await supabase!.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (error) throw new Error(error.message);
      setState("idle");
    } catch (err: any) {
      setMessage(err?.message || "Couldn't sign in.");
      setState("error");
    }
  };

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not send the link.");
      setMessage(data.message);
      setState("sent");
    } catch (err: any) {
      setMessage(err?.message || "Could not send the link.");
      setState("error");
    }
  };

  const switchTo = (m: "password" | "link") => {
    setMode(m);
    setState("idle");
    setMessage("");
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <Brand />
      <div className="sos-card p-7 md:p-8 space-y-6 mt-6">
        <div>
          <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            Your productions
          </h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--sos-text-2)" }}>
            Follow progress, review cuts and approve stages with the studio.
          </p>
        </div>

        {mode === "password" ? (
          <form onSubmit={signIn} className="space-y-4">
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Client ID or email
              </span>
              <input
                required
                autoComplete="username"
                autoCapitalize="characters"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="TCS-XXXXXX"
                className={fieldCls}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Password
              </span>
              <input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} style={fieldStyle} />
            </label>
            {state === "error" && <ErrorNote text={message} />}
            <button
              type="submit"
              disabled={state === "busy"}
              className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-primary)" }}
            >
              {state === "busy" && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
            </button>
            <div className="flex items-center justify-between text-[12px]">
              <button type="button" onClick={() => switchTo("link")} className="font-medium" style={{ color: "var(--sos-primary)" }}>
                Email me a sign-in link instead
              </button>
              <span style={{ color: "var(--sos-text-3)" }}>Forgot it? Ask the studio.</span>
            </div>
          </form>
        ) : state === "sent" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[18px] flex gap-3" style={{ background: "var(--sos-violet-soft)" }}>
              <Mail className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--sos-primary)" }} />
              <div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                  Check your inbox
                </p>
                <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
                  {message} The link signs you in on this device.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => switchTo("password")} className="text-[12px] font-medium" style={{ color: "var(--sos-primary)" }}>
              Sign in with Client ID instead
            </button>
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Work email
              </span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={fieldCls} style={fieldStyle} />
            </label>
            {state === "error" && <ErrorNote text={message} />}
            <button
              type="submit"
              disabled={state === "busy"}
              className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-primary)" }}
            >
              {state === "busy" && <Loader2 className="w-4 h-4 animate-spin" />} Email me a sign-in link
            </button>
            <button type="button" onClick={() => switchTo("password")} className="text-[12px] font-medium" style={{ color: "var(--sos-primary)" }}>
              Sign in with Client ID and password
            </button>
          </form>
        )}
        <p className="text-[12px] text-center" style={{ color: "var(--sos-text-3)" }}>
          Access is by invitation from the studio.
        </p>
      </div>
      <Footer />
    </div>
  );
};

// ---------------------------------------------------------------------------
// First sign-in: choose your own password
// ---------------------------------------------------------------------------
const SetPassword: React.FC<{ loginId?: string; name?: string; onDone: () => void; onSignOut: () => void }> = ({ loginId, name, onDone, onSignOut }) => {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    const { error: err } = await supabase!.auth.updateUser({ password: pw });
    if (err) {
      setBusy(false);
      return setError(/different/i.test(err.message) ? "Choose a password different from the temporary one." : err.message);
    }
    await supabase!.rpc("portal_password_was_set");
    setBusy(false);
    onDone();
  };

  return (
    <div className="max-w-md mx-auto px-4">
      <Brand onSignOut={onSignOut} />
      <form onSubmit={submit} className="sos-card p-7 md:p-8 space-y-5 mt-6">
        <div>
          <h1 className="sos-display text-[26px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            {name ? `Welcome, ${name.split(" ")[0]}` : "Welcome"}
          </h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--sos-text-2)" }}>
            Choose your own password to finish setting up your account.
          </p>
        </div>
        {loginId && (
          <div className="p-3.5 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>Your Client ID</p>
            <p className="text-[17px] font-semibold" style={{ color: "var(--sos-text-1)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{loginId}</p>
          </div>
        )}
        <input type="text" name="username" autoComplete="username" value={loginId || ""} readOnly hidden />
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>New password</span>
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={fieldCls} style={fieldStyle} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>Repeat password</span>
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={fieldCls} style={fieldStyle} />
        </label>
        {error && <ErrorNote text={error} />}
        <button type="submit" disabled={busy} className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--sos-primary)" }}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save password
        </button>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------
function portalBadge(project: PortalProject, gates: PortalGate[]): { label: string; bg: string; fg: string } {
  if (project.closed_at) return { label: "✓ Completed & closed", bg: "#1F7A52", fg: "#FFFFFF" };
  if (project.status === "delivered" || project.status === "paid") return { label: "✓ Delivered", bg: "#1F7A52", fg: "#FFFFFF" };
  if (gates.some((g) => g.status === "waiting_on_client")) return { label: "Awaiting your approval", bg: "#FFFFFF", fg: "#9A4A00" };
  if (gates.some((g) => g.status === "revising")) return { label: "Revising your notes", bg: "#5B3FE4", fg: "#FFFFFF" };
  if (project.status === "on_hold") return { label: "On hold", bg: "#9A4A00", fg: "#FFFFFF" };
  if (project.status === "quoted" || project.status === "lead") return { label: "Proposal", bg: "#2563EB", fg: "#FFFFFF" };
  if (project.status === "parked") return { label: "Paused", bg: "#9A4A00", fg: "#FFFFFF" };
  return { label: "In progress", bg: "rgba(15,17,21,0.72)", fg: "#FFFFFF" };
}

/** The client's own change requests, grouped by stage and round, with a live status for each. */
const RevisionTracker: React.FC<{ gates: PortalGate[]; revisions: PortalRevision[] }> = ({ gates, revisions }) => {
  const [showOld, setShowOld] = useState(false);
  if (!revisions.length) return null;
  const groups = new Map<string, PortalRevision[]>();
  for (const r of revisions) {
    const k = `${r.gate_id || "general"}|${r.round}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }
  const ordered = [...groups.entries()].sort((a, b) => (b[1][0].created_at > a[1][0].created_at ? 1 : -1));
  const latestPerGate = new Set<string>();
  const visible = ordered.filter(([k]) => {
    const gate = k.split("|")[0];
    if (latestPerGate.has(gate)) return showOld;
    latestPerGate.add(gate);
    return true;
  });
  const statusOf = (r: PortalRevision, approved: boolean) =>
    approved ? { label: "Approved", bg: "#E7F7EE", fg: "#17663F", icon: "✓" } : r.status === "done" ? { label: "Addressed", bg: "#E7F7EE", fg: "#17663F", icon: "✓" } : ["in_progress", "in_review", "revising"].includes(r.status) ? { label: "In progress", bg: "#E8F0FF", fg: "#1D4FD8", icon: "●" } : { label: "Received", bg: "var(--sos-surface-2)", fg: "var(--sos-text-2)", icon: "○" };
  return (
    <div className="sos-card sos-aurora sos-aurora-glow overflow-hidden p-5 md:p-6 space-y-4">
      <span className="sos-orb" style={{ width: 200, height: 200, top: -90, right: -60, background: "radial-gradient(circle, rgba(124,92,255,0.3), transparent 70%)" }} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Your requested changes</h2>
          <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>Each note you sent, and where it stands with the studio — updated live.</p>
        </div>
        {ordered.length > visible.length || showOld ? (
          <button type="button" onClick={() => setShowOld((v) => !v)} className="text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
            {showOld ? "Latest rounds only" : "Show earlier rounds"}
          </button>
        ) : null}
      </div>
      {visible.map(([k, list]) => {
        const gate = gates.find((g) => g.id === k.split("|")[0]);
        const approved = gate?.status === "approved";
        const done = list.filter((r) => approved || r.status === "done").length;
        const pct = Math.round((done / list.length) * 100);
        return (
          <div key={k} className="space-y-2">
            <div className="flex items-center gap-3">
              <p className="text-[13px] font-semibold shrink-0" style={{ color: "var(--sos-text-1)" }}>
                {gate?.name || "General"} <span style={{ color: "var(--sos-text-3)" }}>· round {list[0].round}</span>
              </p>
              <div className="sos-bar h-1.5 flex-1">
                <span className={pct === 100 ? "done" : ""} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[12px] font-semibold sos-tabular shrink-0" style={{ color: pct === 100 ? "#17663F" : "var(--sos-text-2)" }}>
                {approved ? "Approved" : `${done}/${list.length} addressed`}
              </span>
            </div>
            <ul className="space-y-1.5 sos-rows">
              {list.map((r, i) => {
                const st = statusOf(r, approved);
                return (
                  <li key={r.id} className="flex items-start gap-3 px-3.5 py-2.5 rounded-[14px]" style={{ background: "var(--sos-surface-2)", ["--i" as any]: i }}>
                    <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: st.bg === "var(--sos-surface-2)" ? "var(--sos-surface)" : st.bg, color: st.fg }}>{st.icon}</span>
                    <span className="flex-1 min-w-0 text-[14px] leading-snug" style={{ color: "var(--sos-text-1)" }}>{r.title}</span>
                    <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: st.bg === "var(--sos-surface-2)" ? "var(--sos-surface)" : st.bg, color: st.fg }}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

/** Delivery date, highlighted, with a plain-language note on how reviews affect it. */
const DeliveryPanel: React.FC<{ project: PortalProject; gates: PortalGate[]; done: boolean }> = ({ project, gates, done }) => {
  const h = HEALTH[project.health] || HEALTH.on_track;
  const date = done ? project.closed_at || null : milestoneDate(project);
  const waiting = gates.find((g) => g.status === "waiting_on_client");
  const waitDays = waiting?.sent_for_approval_at ? Math.max(0, Math.floor((Date.now() - new Date(waiting.sent_for_approval_at).getTime()) / 86_400_000)) : 0;
  let note = "";
  if (done) note = project.closed_at ? "Thank you — all final files are in Deliverables." : "Delivered by the studio.";
  else if (waiting) note = waitDays >= 2 ? `${waiting.name} has been with you for ${waitDays} days. The delivery date moves about a day for each extra day of review — approving soon keeps it on track.` : `${waiting.name} is ready for your review. Quick feedback keeps the delivery date on track.`;
  else if (plannedMoved(project)) note = "Review times shape the schedule. If upcoming reviews take longer than planned, this date may move a little later — we'll always confirm any change with you first.";
  else if (date) note = "On schedule. The date updates automatically as each stage is approved.";
  else note = "The studio will confirm the delivery date shortly.";
  const tone = done ? { bg: "#E7F7EE", fg: "#17663F", orb: "rgba(34,197,94,0.45)", cls: "sos-aurora-green" } : waiting && waitDays >= 2 ? { bg: "#FFF8EE", fg: "#9A4A00", orb: "rgba(245,158,11,0.45)", cls: "sos-aurora-amber" } : { bg: "var(--sos-violet-soft)", fg: "var(--sos-primary)", orb: "rgba(124,92,255,0.5)", cls: "" };
  return (
    <div className={`sos-aurora ${tone.cls} relative overflow-hidden p-5 md:p-6 flex flex-col justify-center gap-2 border-t md:border-t-0 md:border-l md:rounded-r-[inherit]`} style={{ background: tone.bg, borderColor: "var(--sos-border)" }}>
      <span className="sos-orb" style={{ width: 200, height: 200, top: -80, right: -70, background: `radial-gradient(circle, ${tone.orb}, transparent 70%)` }} />
      <span className="sos-orb" style={{ width: 140, height: 140, bottom: -70, left: -30, background: `radial-gradient(circle, ${tone.orb}, transparent 70%)`, animationDelay: "-5s", opacity: 0.35 }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5" style={{ color: tone.fg }}>
          {!done && <span className="sos-live-dot" />}
          {done ? (project.closed_at ? "Completed" : "Delivered") : "Expected delivery"}
        </span>
        {!done && <Pill bg={h.bg} text={h.text}>{h.label}</Pill>}
      </div>
      <p key={date || "tbc"} className="sos-display sos-pop sos-gradient-text text-[36px] font-semibold leading-none sos-tabular">
        {date ? format(parseISO(date), "d MMM") : "TBC"}
      </p>
      {date && <p className="text-[13px] font-medium" style={{ color: "var(--sos-text-2)" }}>{format(parseISO(date), "EEEE, yyyy")}</p>}
      <p className="text-[12px] leading-snug" style={{ color: "var(--sos-text-2)" }}>{note}</p>
    </div>
  );
};

const ProjectRow: React.FC<{ project: PortalProject; gates: PortalGate[]; deliverables: PortalDeliverable[]; onOpen: () => void; index?: number }> = ({ project, gates, deliverables, onOpen, index = 0 }) => {
  const done = Boolean(project.closed_at) || project.status === "delivered" || project.status === "paid";
  const badge = portalBadge(project, gates);
  const progress = projectProgress(project, gates);
  const date = done ? null : milestoneDate(project);
  return (
    <button type="button" onClick={onOpen} className="sos-row w-full text-left flex items-center gap-3.5 px-4 py-3.5" style={{ ["--i" as any]: Math.min(index, 14) }}>
      <ProjectThumb candidates={thumbCandidates(project.cover_image_url, deliverables)} resolveUrl={resolveReviewUrl} emoji={project.emoji} className="sos-row-thumb w-[72px] h-12 rounded-[12px] shrink-0 overflow-hidden" style={{ background: "var(--sos-violet-soft)" }} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{project.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="sos-bar h-1.5 w-20 sm:w-28 shrink-0" style={{ ["--i" as any]: Math.min(index, 14) }}>
            <span className={progress === 100 ? "done" : ""} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
            {TYPE_LABEL[project.type] || "Project"} · {done ? (project.closed_at ? "Completed" : "Delivered") : project.current_stage || "Getting started"}
          </span>
        </div>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0" style={{ background: badge.bg, color: badge.fg }}>
        {gates.some((g) => g.status === "waiting_on_client") && <span className="sos-live-dot" />}
        {badge.label}
      </span>
      <span className="text-[13px] font-semibold sos-tabular shrink-0 w-[70px] text-right" style={{ color: "var(--sos-text-1)" }}>{date ? fmtDate(date).replace(/ \d{4}$/, "") : "—"}</span>
      <ChevronRight className="sos-row-chevron w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
    </button>
  );
};

const ProjectCard: React.FC<{ project: PortalProject; gates: PortalGate[]; deliverables: PortalDeliverable[]; onOpen: () => void }> = ({ project, gates, deliverables, onOpen }) => {
  const h = HEALTH[project.health] || HEALTH.on_track;
  const date = fmtDate(milestoneDate(project));
  const done = Boolean(project.closed_at) || project.status === "delivered" || project.status === "paid";
  const badge = portalBadge(project, gates);
  const hasFinal = deliverables.some((d) => d.is_final);
  const progress = projectProgress(project, gates);
  const doneStages = gates.filter((g) => g.status === "approved" || g.status === "skipped").length;
  return (
    <button type="button" onClick={onOpen} className="sos-card overflow-hidden text-left transition-transform hover:-translate-y-0.5">
      <ProjectThumb
        candidates={thumbCandidates(project.cover_image_url, deliverables)}
        resolveUrl={resolveReviewUrl}
        emoji={project.emoji}
        className="h-28"
        style={{ background: "var(--sos-violet-soft)" }}
      >
        <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm" style={{ background: badge.bg, color: badge.fg }}>
          {badge.label}
        </span>
        {hasFinal && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/95 text-[#17663F] shadow-sm">
            <Download className="w-3 h-3" /> Final files ready
          </span>
        )}
      </ProjectThumb>
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
              {TYPE_LABEL[project.type] || "Project"}
            </p>
            <h3 className="sos-display text-[16px] font-semibold leading-tight line-clamp-2" style={{ color: "var(--sos-text-1)" }}>
              {project.title}
            </h3>
          </div>
          {done ? <Pill bg="#E7F7EE" text="#17663F">{project.closed_at ? "Closed" : "Delivered"}</Pill> : <Pill bg={h.bg} text={h.text}>{h.label}</Pill>}
        </div>
        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          <span className="truncate">{project.closed_at ? `Completed ${fmtDate(project.closed_at)}` : done ? "Complete" : project.current_stage || "Getting started"}</span>
          {date && !done && (
            <span className="sos-tabular shrink-0 inline-flex items-center gap-1" style={{ color: "var(--sos-text-3)" }}>
              <Clock className="w-3.5 h-3.5" /> {date}
            </span>
          )}
        </div>
        <ProgressBar value={progress} label={gates.length ? `${Math.min(doneStages, gates.length)} of ${gates.length} stages` : "Progress"} />
      </div>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Project view
// ---------------------------------------------------------------------------
const Stepper: React.FC<{ gates: PortalGate[] }> = ({ gates }) => (
  <div className="sos-card p-5 md:p-6">
    <h2 className="sos-display text-[18px] font-semibold mb-4" style={{ color: "var(--sos-text-1)" }}>
      Production stages
    </h2>
    <ol className="space-y-0">
      {gates.map((g, i) => {
        const done = g.status === "approved" || g.status === "skipped";
        const current = ["in_work", "waiting_on_client", "revising"].includes(g.status);
        const date = done ? fmtDate(g.approved_at || g.started_at) : g.due_date ? `due ${fmtDate(g.due_date)}` : current ? fmtDate(g.sent_for_approval_at || g.started_at) : null;
        const label =
          g.status === "approved" ? "Approved" : g.status === "skipped" ? "Skipped" : g.status === "waiting_on_client" ? "Awaiting your review" : g.status === "revising" ? "Revising" : g.status === "in_work" ? "In progress" : "Upcoming";
        return (
          <li key={g.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold"
                style={{
                  background: done ? "var(--sos-green)" : current ? "var(--sos-primary)" : "var(--sos-surface-2)",
                  color: done || current ? "#FFFFFF" : "var(--sos-text-3)",
                }}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </span>
              {i < gates.length - 1 && <span className="w-[2px] flex-1 min-h-[18px] my-1" style={{ background: done ? "var(--sos-green)" : "var(--sos-border)" }} />}
            </div>
            <div className="pb-4 min-w-0 flex-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: current || done ? "var(--sos-text-1)" : "var(--sos-text-3)" }}>
                  {g.name}
                </p>
                <p className="text-[12px]" style={{ color: g.status === "waiting_on_client" ? "#9A4A00" : "var(--sos-text-3)" }}>
                  {label}
                </p>
              </div>
              {date && (
                <span className="text-[12px] sos-tabular shrink-0" style={{ color: "var(--sos-text-3)" }}>
                  {date}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);

const resolveReviewUrl = async (url: string) => {
  if (!supabase || !url.startsWith("storage://studio-review/")) return null;
  const { data } = await supabase.storage.from("studio-review").createSignedUrl(url.replace("storage://studio-review/", ""), 3600);
  return data?.signedUrl || null;
};

const ApprovalCard: React.FC<{
  gate: PortalGate;
  previewUrl: string | null;
  /** "What changed in this version" (written by the studio with AI). */
  summary?: string | null;
  onDone: (msg: string) => void;
}> = ({ gate, previewUrl, summary, onDone }) => {
  const [sketch, setSketch] = useState<{ time?: number } | null>(null);
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState<Array<NoteRef & { id: number; t: string }>>([]);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const player = useRef<ReviewMediaHandle>(null);
  const media = parseMedia(previewUrl);
  const isVideo = media?.kind === "youtube" || media?.kind === "vimeo";
  const isImage = media?.kind === "image";
  const nextId = useRef(1);
  const addTimedNote = async () => {
    setMode("changes");
    const t = await player.current?.getTime();
    player.current?.pause();
    const id = nextId.current++;
    setNotes((prev) => [...prev, { id, time: t ?? undefined, t: t != null ? fmtTime(t) : "", text: "" }]);
    setActiveNote(id);
  };
  const addPin = (x: number, y: number) => {
    setMode("changes");
    const id = nextId.current++;
    setNotes((prev) => [...prev, { id, t: "", text: "", pin: { n: prev.filter((n) => n.pin).length + 1, x, y } }]);
    setActiveNote(id);
  };
  const [busy, setBusy] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState("");
  const nextRound = gate.revision_round + 1;
  const included = gate.revisions_included;

  const after = async (action: "approved" | "changes", projectId: string, taskIds?: string[]) => {
    const token = (await supabase!.auth.getSession()).data.session?.access_token;
    await fetch("/api/portal/after-action", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ project_id: projectId, gate_id: gate.id, action, task_ids: taskIds }),
    }).catch(() => {});
  };

  const approve = async () => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("portal_approve_gate", { p_gate_id: gate.id, p_comment: comment.trim() || null });
    if (err) {
      setError(err.message.includes("not_awaiting") ? "This stage was already updated — refreshing." : "Could not record your approval. Please try again.");
      setBusy(false);
      onDone("");
      return;
    }
    await after("approved", (data as any).project_id);
    setBusy(false);
    onDone(`Thank you — ${gate.name} is approved. The studio has been notified.`);
  };

  const requestChanges = async () => {
    if (!supabase) return;
    const lines = [
      ...comment
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      ...notes
        .filter((n) => n.text.trim())
        .map((n) => noteLine({ pin: n.pin, time: n.pin ? undefined : n.t.trim() ? parseTime(n.t) ?? undefined : undefined, text: n.text.trim() })),
    ];
    if (!lines.length) {
      setError("Please describe the changes you'd like.");
      return;
    }
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("portal_request_changes", { p_gate_id: gate.id, p_comment: lines.join("\n") });
    if (err) {
      setError(err.message.includes("not_awaiting") ? "This stage was already updated — refreshing." : "Could not send your notes. Please try again.");
      setBusy(false);
      onDone("");
      return;
    }
    await after("changes", (data as any).project_id, (data as any).task_ids || []);
    setBusy(false);
    onDone("Thanks — your notes are with the studio. We'll share the revised version here.");
  };

  return (
    <div className="sos-card p-5 md:p-6 space-y-4" style={{ borderColor: "#F5D9A8" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#9A4A00" }}>
            Awaiting your approval
          </p>
          <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
            {gate.name}
          </h2>
        </div>
        <span className="text-[12px] sos-tabular px-3 py-1 rounded-full" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>
          Revision round {gate.revision_round} of {included} included
        </span>
      </div>

      {previewUrl && (
        <div className="space-y-2">
          {summary && (
            <div className="px-4 py-3 rounded-[14px] space-y-1" style={{ background: "var(--sos-surface-2)" }}>
              <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>What changed in this version</p>
              <p className="text-[14px] whitespace-pre-line leading-relaxed" style={{ color: "var(--sos-text-1)" }}>{summary}</p>
            </div>
          )}
          {(() => {
            const mediaEl = (
              <ReviewMedia
                ref={player}
                url={previewUrl}
                resolveUrl={resolveReviewUrl}
                onImageClick={isImage && !sketch ? addPin : undefined}
                pins={notes.filter((n) => n.pin).map((n) => ({ ...n.pin!, active: n.id === activeNote }))}
              />
            );
            return sketch ? (
              <SketchOverlay
                gateId={gate.id}
                mediaUrl={previewUrl}
                time={sketch.time}
                timeLabel={sketch.time != null ? fmtTime(sketch.time) : undefined}
                onCancel={() => setSketch(null)}
                onDone={(text) => {
                  const id = nextId.current++;
                  setMode("changes");
                  setNotes((prev) => [...prev, { id, time: sketch.time, t: sketch.time != null ? fmtTime(sketch.time) : "", text: `✏️ ${text}` }]);
                  setActiveNote(id);
                  setSketch(null);
                }}
              >
                {mediaEl}
              </SketchOverlay>
            ) : (
              mediaEl
            );
          })()}
          {!sketch && (isVideo || isImage) && (
            <div className="flex flex-wrap gap-2">
              {isVideo && (
                <button
                  type="button"
                  onClick={addTimedNote}
                  className="sos-pill-btn h-10 px-4 text-[13px] font-semibold border inline-flex items-center gap-2"
                  style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
                >
                  <Clock className="w-4 h-4" /> Add a note at this moment
                </button>
              )}
              <VoiceNoteButton
                stage={gate.name}
                onStart={async () => {
                  if (!isVideo) return undefined;
                  const t = await player.current?.getTime();
                  player.current?.pause();
                  return t != null ? fmtTime(t) : undefined;
                }}
                onText={(text, t) => {
                  const id = nextId.current++;
                  setMode("changes");
                  setNotes((prev) => [...prev, { id, time: t ? parseTime(t) ?? undefined : undefined, t: t || "", text: `🎙 ${text}` }]);
                  setActiveNote(id);
                }}
                onError={setError}
              />
              <button
                type="button"
                onClick={async () => {
                  const t = isVideo ? await player.current?.getTime() : null;
                  player.current?.pause();
                  setSketch({ time: t ?? undefined });
                }}
                className="sos-pill-btn h-10 px-4 text-[13px] font-semibold border inline-flex items-center gap-2"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
                title={isVideo ? "Pause where you want, then draw on the frame" : "Draw on the image"}
              >
                ✏️ Draw on {isVideo ? "the frame" : "the image"}
              </button>
            </div>
          )}
          {isImage && (
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              Tap anywhere on the image to pin a note to that spot.
            </p>
          )}
        </div>
      )}
      {!previewUrl && (
        <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
          The studio will attach the review link here.
        </p>
      )}

      {mode === "idle" ? (
        <div className="space-y-3">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional note for the studio"
            className="w-full px-4 py-3 rounded-[14px] border text-[14px] resize-none"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={approve}
              className="sos-pill-btn h-12 px-6 text-[15px] font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-green)" }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("changes")}
              className="sos-pill-btn h-12 px-6 text-[15px] font-medium border inline-flex items-center justify-center gap-2"
              style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
            >
              <MessageSquare className="w-4 h-4" /> Request changes
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {nextRound > included && (
            <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FFF3E0", color: "#9A4A00" }}>
              This would be round {nextRound}; {included} rounds are included. The studio will confirm any effect on time or scope.
            </p>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder={"What would you like changed? One point per line works best."}
            className="w-full px-4 py-3 rounded-[14px] border text-[14px] resize-none"
            style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
          />
          {comment.trim().length > 8 && (
            <button
              type="button"
              disabled={polishing}
              onClick={async () => {
                setPolishing(true);
                setError("");
                try {
                  const token = (await supabase!.auth.getSession()).data.session?.access_token;
                  const r = await fetch("/api/portal/ai/polish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ text: comment, stage: gate.name }),
                  });
                  const j = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(j.error || "Couldn't tidy the notes.");
                  setComment((j.points as string[]).map((p, i) => `${i + 1}. ${p}`).join("\n"));
                } catch (e: any) {
                  setError(e?.message || "Couldn't tidy the notes.");
                } finally {
                  setPolishing(false);
                }
              }}
              className="text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
              style={{ color: "var(--sos-primary)" }}
              title="AI rewrites your notes as clear, numbered change requests — you can edit before sending"
            >
              {polishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <span aria-hidden>✨</span>} Tidy my notes into clear points
            </button>
          )}
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="flex items-center gap-2">
                {n.pin ? (
                  <span className="w-20 h-10 rounded-[12px] text-[13px] font-semibold flex items-center justify-center shrink-0 text-white" style={{ background: n.id === activeNote ? "#B42318" : "var(--sos-primary)" }}>
                    Pin {n.pin.n}
                  </span>
                ) : (
                  <div className="flex items-center shrink-0">
                    <input
                      value={n.t}
                      onChange={(e) => setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, t: e.target.value } : x)))}
                      placeholder="0:12"
                      aria-label="Timestamp"
                      className="w-20 h-10 px-3 rounded-[12px] border text-[13px] sos-tabular"
                      style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                    />
                    {isVideo && n.t && parseTime(n.t) !== null && (
                      <button type="button" onClick={() => player.current?.seek(parseTime(n.t)!)} className="w-9 h-10 flex items-center justify-center" style={{ color: "var(--sos-primary)" }} aria-label={`Play from ${n.t}`}>
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                <input
                  autoFocus={n.id === activeNote}
                  value={n.text}
                  onFocus={() => setActiveNote(n.id)}
                  onChange={(e) => setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, text: e.target.value } : x)))}
                  placeholder={n.pin ? "What should change here?" : "Note at this moment"}
                  className="flex-1 min-w-0 h-10 px-3 rounded-[12px] border text-[13px]"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
                <button type="button" onClick={() => setNotes((prev) => prev.filter((x) => x.id !== n.id))} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: "var(--sos-text-3)" }} aria-label="Remove note">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {isVideo ? (
              <button type="button" onClick={addTimedNote} className="text-[13px] font-medium inline-flex items-center gap-1" style={{ color: "var(--sos-primary)" }}>
                <Plus className="w-4 h-4" /> Note at the current moment
              </button>
            ) : !isImage ? (
              <button
                type="button"
                onClick={() => {
                  const id = nextId.current++;
                  setNotes((prev) => [...prev, { id, t: "", text: "" }]);
                  setActiveNote(id);
                }}
                className="text-[13px] font-medium inline-flex items-center gap-1"
                style={{ color: "var(--sos-primary)" }}
              >
                <Plus className="w-4 h-4" /> Add timestamp note
              </button>
            ) : null}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={requestChanges}
              className="sos-pill-btn h-12 px-6 text-[15px] font-semibold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send notes to the studio
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className="sos-pill-btn h-12 px-6 text-[15px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FDECEC", color: "#B42318" }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Final delivery (download the finished files)
// ---------------------------------------------------------------------------
const FinalDeliveryItem: React.FC<{ d: PortalDeliverable }> = ({ d }) => {
  const [busy, setBusy] = useState(false);
  const [watch, setWatch] = useState(false);
  const source = d.download_url || d.url;
  const streamOnly = !d.download_url && isStreamOnly(d.url);
  const download = async () => {
    setBusy(true);
    const href = await downloadHref(source, resolveReviewUrl);
    setBusy(false);
    if (!href) return setWatch(true);
    const a = document.createElement("a");
    a.href = href;
    a.download = d.title || "";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-[16px]" style={{ background: "var(--sos-surface-2)" }}>
        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#E7F7EE", color: "#17663F" }}>
          <Check className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{d.title}</p>
          <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
            {[d.version, `Delivered ${fmtDate(d.created_at)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setWatch((w) => !w)} className="sos-pill-btn h-10 px-4 text-[13px] font-semibold border inline-flex items-center gap-1.5" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}>
            <Play className="w-4 h-4" /> {watch ? "Hide" : "Watch"}
          </button>
          {!streamOnly && (
            <button type="button" disabled={busy} onClick={download} className="sos-pill-btn h-10 px-4 text-[13px] font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-60" style={{ background: "var(--sos-green)" }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download
            </button>
          )}
        </div>
      </div>
      {streamOnly && (
        <p className="text-[12px] px-1" style={{ color: "var(--sos-text-3)" }}>
          This file is streamed — ask the studio if you need the master file to download.
        </p>
      )}
      {watch && <ReviewMedia url={d.url} resolveUrl={resolveReviewUrl} />}
    </div>
  );
};

const FinalDelivery: React.FC<{ project: PortalProject; finals: PortalDeliverable[] }> = ({ project, finals }) => (
  <div className="sos-card p-5 md:p-6 space-y-4" style={{ borderColor: "#BDE5CE" }}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#17663F" }}>
          {project.closed_at ? "Project complete" : "Final delivery"}
        </p>
        <h2 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
          Your final files
        </h2>
      </div>
      {project.closed_at && (
        <Pill bg="#E7F7EE" text="#17663F">Completed & closed · {fmtDate(project.closed_at)}</Pill>
      )}
    </div>
    {finals.length ? (
      <div className="space-y-3">
        {finals.map((d) => (
          <FinalDeliveryItem key={d.id} d={d} />
        ))}
      </div>
    ) : (
      <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
        The studio is preparing your final files — they'll appear here to download.
      </p>
    )}
  </div>
);

const ProjectView: React.FC<{
  project: PortalProject;
  gates: PortalGate[];
  deliverables: PortalDeliverable[];
  invoices: PortalInvoice[];
  tasks?: PortalTask[];
  revisions?: PortalRevision[];
  viewerName?: string;
  onBack: () => void;
  onChanged: () => void;
}> = ({ project, gates, deliverables, invoices, tasks = [], revisions = [], viewerName, onBack, onChanged }) => {
  const [flash, setFlash] = useState("");
  const [openDeliverable, setOpenDeliverable] = useState<string | null>(null);
  const h = HEALTH[project.health] || HEALTH.on_track;
  const done = Boolean(project.closed_at) || project.status === "delivered" || project.status === "paid";
  const awaiting = gates.filter((g) => g.status === "waiting_on_client");
  // Live presence: let the studio see this project is open (private channel, own client only).
  const activity = awaiting.length ? `Reviewing ${awaiting[0].name}` : "Viewing the project";
  useEffect(() => {
    const cid = (project as any).client_id as string | undefined;
    if (!supabase || !cid) return;
    const ch = supabase.channel(`presence:client:${cid}`, { config: { private: true, presence: { key: `c-${Math.random().toString(36).slice(2, 8)}` } } });
    const meta = () => ({ role: "client", name: viewerName || "Client", project_id: project.id, project_title: project.title, activity, at: new Date().toISOString() });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track(meta()).catch(() => {});
    });
    const onVis = () => (document.visibilityState === "visible" ? ch.track(meta()).catch(() => {}) : ch.untrack().catch(() => {}));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      ch.untrack().catch(() => {});
      supabase?.removeChannel(ch);
    };
  }, [project.id, activity, viewerName]);
  const previewFor = (gateId: string) =>
    [...deliverables].filter((d) => d.gate_id === gateId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.url || project.review_link_url;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-[13px] font-medium inline-flex items-center gap-1.5" style={{ color: "var(--sos-text-2)" }}>
        <ArrowLeft className="w-4 h-4" /> All projects
      </button>

      <motion.div className="sos-card overflow-hidden" initial={{ opacity: 0, y: 14, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div className="grid md:grid-cols-[1fr_320px]">
          <div className="p-5 md:p-6 space-y-4 min-w-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
                {TYPE_LABEL[project.type] || "Project"}
              </p>
              <h1 className="sos-display text-[24px] md:text-[28px] font-semibold tracking-[-0.02em] leading-tight" style={{ color: "var(--sos-text-1)" }}>
                {project.emoji} {project.title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-1)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: done ? "var(--sos-green)" : "var(--sos-primary)" }} />
                {project.closed_at ? "Completed & closed" : done ? "Delivered" : project.current_stage || "Getting started"}
              </span>
              {awaiting.length > 0 && (
                <span className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold" style={{ background: "#FFF3E0", color: "#9A4A00" }}>
                  Your review needed
                </span>
              )}
            </div>
            <ProgressBar
              value={projectProgress(project, gates)}
              label={`${gates.filter((g) => g.status === "approved" || g.status === "skipped").length} of ${gates.length} stages complete`}
            />
          </div>
          <DeliveryPanel project={project} gates={gates} done={done} />
        </div>
      </motion.div>

      {(project.closed_at || deliverables.some((d) => d.is_final)) && (
        <FinalDelivery
          project={project}
          finals={[...deliverables].filter((d) => d.is_final).sort((a, b) => b.created_at.localeCompare(a.created_at))}
        />
      )}

      {flash && (
        <div className="p-4 rounded-[18px] text-[14px] font-medium" style={{ background: "#E7F7EE", color: "#17663F" }}>
          {flash}
        </div>
      )}

      <RevisionTracker gates={gates} revisions={revisions} />

      {awaiting.map((g) => (
        <ApprovalCard
          key={g.id}
          gate={g}
          previewUrl={previewFor(g.id)}
          summary={[...deliverables].filter((d) => d.gate_id === g.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.client_summary}
          onDone={(msg) => {
            if (msg) setFlash(msg);
            onChanged();
          }}
        />
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <Stepper gates={gates} />
          {tasks.length > 0 && (
            <div className="sos-card p-5 md:p-6">
              <h2 className="sos-display text-[18px] font-semibold mb-3" style={{ color: "var(--sos-text-1)" }}>
                Milestones & to-dos
              </h2>
              <div className="space-y-1.5">
                {[...tasks]
                  .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || (a.due_date || "9999").localeCompare(b.due_date || "9999"))
                  .map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-[14px]" style={{ background: "var(--sos-surface-2)", opacity: t.status === "done" ? 0.6 : 1 }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: t.status === "done" ? "var(--sos-green)" : "var(--sos-surface)", color: "#fff", border: t.status === "done" ? "none" : "1.5px solid var(--sos-border)" }}>
                        {t.status === "done" && <Check className="w-3 h-3" />}
                      </span>
                      <span className="flex-1 min-w-0 text-[14px]" style={{ color: "var(--sos-text-1)", textDecoration: t.status === "done" ? "line-through" : undefined }}>
                        {t.title}
                      </span>
                      <span className="text-[12px] sos-tabular shrink-0" style={{ color: "var(--sos-text-3)" }}>
                        {t.status === "done" ? `done ${fmtDate(t.completed_at)}` : t.due_date ? `due ${fmtDate(t.due_date)}` : ""}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-3 space-y-5">
          <div className="sos-card p-5 md:p-6">
            <h2 className="sos-display text-[18px] font-semibold mb-3" style={{ color: "var(--sos-text-1)" }}>
              Deliverables &amp; versions
            </h2>
            {deliverables.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                Shared files and versions will appear here.
              </p>
            ) : (
              <div className="space-y-1.5">
                {[...deliverables]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((d) => (
                    <div key={d.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setOpenDeliverable(openDeliverable === d.id ? null : d.id)}
                      className="w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-[14px] hover:opacity-90"
                      style={{ background: "var(--sos-surface-2)" }}
                      aria-expanded={openDeliverable === d.id}
                    >
                      <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
                      <span className="flex-1 min-w-0 text-[14px] font-medium truncate" style={{ color: "var(--sos-text-1)" }}>
                        {d.title}
                      </span>
                      {d.version && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}>
                          {d.version}
                        </span>
                      )}
                      <span className="text-[12px] sos-tabular hidden sm:inline" style={{ color: "var(--sos-text-3)" }}>
                        {fmtDate(d.created_at)}
                      </span>
                      <Play className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sos-text-3)" }} />
                    </button>
                    {openDeliverable === d.id && d.client_summary && (
                      <div className="px-4 py-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
                        <p className="text-[12px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--sos-text-3)" }}>What changed in this version</p>
                        <p className="text-[13px] whitespace-pre-line" style={{ color: "var(--sos-text-1)" }}>{d.client_summary}</p>
                      </div>
                    )}
                    {openDeliverable === d.id && <ReviewMedia url={d.url} resolveUrl={resolveReviewUrl} />}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="sos-card p-5 md:p-6">
            <h2 className="sos-display text-[18px] font-semibold mb-3" style={{ color: "var(--sos-text-1)" }}>
              Invoices
            </h2>
            {invoices.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                No invoices yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {invoices.map((i) => {
                  const chip =
                    i.status === "paid"
                      ? { bg: "#E7F7EE", text: "#17663F", label: "Paid" }
                      : i.status === "overdue"
                      ? { bg: "#FFF3E0", text: "#9A4A00", label: "Due" }
                      : i.status === "partly_paid"
                      ? { bg: "#E8F0FF", text: "#1D4FD8", label: "Part paid" }
                      : { bg: "#E8F0FF", text: "#1D4FD8", label: "Sent" };
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-3.5 py-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                          {money(Number(i.amount), i.currency)}
                        </p>
                        <p className="text-[12px] truncate" style={{ color: "var(--sos-text-3)" }}>
                          {[i.invoice_no, i.due_at ? `due ${fmtDate(i.due_at)}` : null, i.received_at ? `paid ${fmtDate(i.received_at)}` : null].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Pill bg={chip.bg} text={chip.text}>{chip.label}</Pill>
                      {i.file_url && (
                        <a href={i.file_url} target="_blank" rel="noreferrer noopener" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }} aria-label="Download invoice">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function PortalApp({ onNavigateHome }: { onNavigateHome: () => void }) {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [contact, setContact] = useState<{ ok: boolean; name?: string; organisation?: string; login_id?: string; must_set_password?: boolean } | null>(null);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [gates, setGates] = useState<PortalGate[]>([]);
  const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
  const [portalTasks, setPortalTasks] = useState<PortalTask[]>([]);
  const [revisions, setRevisions] = useState<PortalRevision[]>([]);
  const [toast, setToast] = useState<PortalNotification | null>(null);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.search).get("project"));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<PortalTab>(() => (new URLSearchParams(window.location.search).get("tab") as PortalTab) || "projects");
  const [listFilter, setListFilter] = useState<PortalFilter>("all");
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState<"recent" | "due" | "name">("recent");
  const [listMode, setListModeState] = useState<"list" | "cards">(() => {
    try {
      return (localStorage.getItem("portal-list-mode") as "list" | "cards") || "list";
    } catch {
      return "list";
    }
  });
  const setListMode = (m: "list" | "cards") => {
    setListModeState(m);
    try {
      localStorage.setItem("portal-list-mode", m);
    } catch {
      /* ignore */
    }
  };
  const isLarge = useIsLarge();
  const studioInfo = useStudioInfo();
  const portalReady = signedIn && Boolean(contact?.ok) && !contact?.must_set_password;
  const { messages, unread, reload: reloadMessages } = usePortalMessages(portalReady);

  useEffect(() => {
    document.title = "Client portal — The Chanting Studio";
    if (!isSupabaseConfigured || !supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setChecking(false);
    });
    const sub = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const link = await supabase.rpc("portal_link_contact");
    const info = (link.data as any) || { ok: false };
    setContact(info);
    if (info.ok) {
      const [p, g, d, i] = await Promise.all([
        supabase.from("portal_projects").select("*").order("updated_at", { ascending: false }),
        supabase.from("portal_gates").select("*").order("order_index"),
        supabase.from("portal_deliverables").select("*"),
        supabase.from("portal_invoices").select("*").order("sent_at", { ascending: false, nullsFirst: false }),
      ]);
      const [t, rv] = await Promise.all([supabase.from("portal_tasks").select("*"), supabase.from("portal_revisions").select("*").order("created_at")]);
      setPortalTasks(t.error ? [] : ((t.data || []) as PortalTask[]));
      setRevisions(rv.error ? [] : ((rv.data || []) as PortalRevision[]));
      setProjects((p.data || []) as PortalProject[]);
      setGates((g.data || []) as PortalGate[]);
      setDeliverables((d.data || []) as PortalDeliverable[]);
      setInvoices((i.data || []) as PortalInvoice[]);
    }
    setLoading(false);
  }, []);
  // New notification → chime (inside the hook), toast, and refresh the project data.
  const notif = usePortalNotifications(Boolean(contact?.ok), (n) => {
    setToast(n);
    load();
  });
  const closeToast = useCallback(() => setToast(null), []);
  const openNotification = (n: PortalNotification) => {
    notif.markRead();
    if (n.kind === "message") setTab("messages");
    else if (n.project_id) {
      setTab("projects");
      setSelected(n.project_id);
    }
  };

  useEffect(() => {
    if (!signedIn) return;
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [signedIn, load]);

  useEffect(() => {
    const url = tab !== "projects" ? `/portal?tab=${tab}` : selected ? `/portal?project=${selected}` : "/portal";
    if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, "", url);
  }, [selected, tab]);

  const signOut = async () => {
    await supabase?.auth.signOut().catch(() => {});
    setSignedIn(false);
    setContact(null);
    setSelected(null);
    setTab("projects");
  };

  const awaitingByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gates) if (g.status === "waiting_on_client") m.set(g.project_id, (m.get(g.project_id) || 0) + 1);
    return m;
  }, [gates]);

  const project = projects.find((p) => p.id === selected);

  const bucketCounts = useMemo(() => {
    const c: Partial<Record<PortalFilter, number>> = {};
    for (const p of projects) {
      const b = projectBucket(p, gates.filter((g) => g.project_id === p.id));
      c[b] = (c[b] || 0) + 1;
    }
    return c;
  }, [projects, gates]);

  const visibleProjects = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (listFilter !== "all" && projectBucket(p, gates.filter((g) => g.project_id === p.id)) !== listFilter) return false;
      return !q || `${p.title} ${p.current_stage || ""} ${TYPE_LABEL[p.type] || ""}`.toLowerCase().includes(q);
    });
    return list.sort((a, b) =>
      listSort === "name"
        ? a.title.localeCompare(b.title)
        : listSort === "due"
        ? (milestoneDate(a) || "9999").localeCompare(milestoneDate(b) || "9999")
        : b.updated_at.localeCompare(a.updated_at)
    );
  }, [projects, gates, listFilter, listQuery, listSort]);

  return (
    <div className="studio-os-root">
      {checking ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--sos-primary)" }} />
        </div>
      ) : !signedIn ? (
        <PortalLogin />
      ) : contact?.ok && contact.must_set_password ? (
        <SetPassword loginId={contact.login_id} name={contact.name} onSignOut={signOut} onDone={() => setContact({ ...contact, must_set_password: false })} />
      ) : contact && !contact.ok ? (
        <div className="max-w-md mx-auto px-4">
          <Brand onSignOut={signOut} />
          <div className="sos-card p-7 space-y-3 mt-6">
            <h1 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              No projects shared yet
            </h1>
            <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
              This account doesn't have portal access right now. If you were expecting it, please contact the studio.
            </p>
            <button type="button" onClick={onNavigateHome} className="text-[13px] font-medium" style={{ color: "var(--sos-primary)" }}>
              Visit thechantingstudio.in
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <Brand
            onSignOut={signOut}
            who={contact?.organisation}
            extra={
              contact?.ok ? (
                <NotificationBell
                  items={notif.items}
                  unread={notif.unread}
                  onOpenChange={(o) => o && notif.markRead()}
                  onSelect={openNotification}
                />
              ) : null
            }
          />
          <NotificationToast n={toast} onClose={closeToast} onOpen={openNotification} />
          <PortalNav
            tab={tab}
            onTab={(t) => {
              setTab(t);
              if (t !== "projects") setSelected(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            unread={unread}
            awaiting={gates.filter((g) => g.status === "waiting_on_client").length}
          />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 mt-4 items-start">
            <div className="min-w-0 space-y-4">
              {!isLarge && <StudioClock info={studioInfo} compact onOpenCalendar={() => setTab("calendar")} />}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {tab === "calendar" ? (
                    <CalendarTab info={studioInfo} />
                  ) : tab === "messages" ? (
                    <MessagesTab messages={messages} reload={reloadMessages} projects={projects.map((p) => ({ id: p.id, title: p.title }))} info={studioInfo} />
                  ) : tab === "account" ? (
                    <AccountTab name={contact?.name} organisation={contact?.organisation} loginId={contact?.login_id} onSignOut={signOut} />
                  ) : (
                    <>
          {loading && !projects.length ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--sos-primary)" }} />
            </div>
          ) : project ? (
            <ProjectView
              project={project}
              gates={gates.filter((g) => g.project_id === project.id)}
              deliverables={deliverables.filter((d) => d.project_id === project.id)}
              invoices={invoices.filter((i) => i.project_id === project.id)}
              tasks={portalTasks.filter((t) => t.project_id === project.id)}
              revisions={revisions.filter((r) => r.project_id === project.id)}
              viewerName={contact?.name}
              onBack={() => setSelected(null)}
              onChanged={load}
            />
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="sos-display text-[30px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
                  {contact?.name ? `Hello, ${contact.name.split(" ")[0]}` : "Your projects"}
                </h1>
                <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
                  Everything the studio is making for {contact?.organisation || "you"}.
                </p>
              </div>
              {projects.length > 0 && (
                <div className="space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1" role="tablist" aria-label="Filter projects">
                    {FILTERS.filter((f) => f.id === "all" || bucketCounts[f.id]).map((f) => {
                      const active = listFilter === f.id;
                      const count = f.id === "all" ? projects.length : bucketCounts[f.id] || 0;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setListFilter(f.id)}
                          className="relative shrink-0 h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 border"
                          style={active ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)", borderColor: "var(--sos-ink)" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)", borderColor: "var(--sos-border)" }}
                        >
                          {f.label}
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center" style={active ? { background: "rgba(255,255,255,0.18)" } : { background: "var(--sos-surface-2)" }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex items-center gap-2 h-11 px-4 rounded-full border flex-1 min-w-0" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}>
                      <Search className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
                      <input value={listQuery} onChange={(e) => setListQuery(e.target.value)} placeholder="Search your projects…" aria-label="Search projects" className="flex-1 min-w-0 bg-transparent outline-none text-[14px]" style={{ color: "var(--sos-text-1)" }} />
                    </div>
                    <select value={listSort} onChange={(e) => setListSort(e.target.value as typeof listSort)} aria-label="Sort projects" className="h-11 px-4 rounded-full border text-[14px]" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
                      <option value="recent">Recently updated</option>
                      <option value="due">Delivery date</option>
                      <option value="name">Name</option>
                    </select>
                    <div className="shrink-0 self-start sm:self-auto">
                      <SegToggle id="portal-list-mode" value={listMode} onChange={setListMode} options={[{ id: "list", label: "List" }, { id: "cards", label: "Cards" }]} />
                    </div>
                  </div>
                </div>
              )}
              {projects.length === 0 ? (
                <div className="sos-card p-8 text-center text-[14px]" style={{ color: "var(--sos-text-3)" }}>
                  The studio hasn't shared a project here yet.
                </div>
              ) : visibleProjects.length === 0 ? (
                <div className="sos-card p-8 text-center text-[14px]" style={{ color: "var(--sos-text-3)" }}>
                  No projects match.{" "}
                  <button type="button" onClick={() => { setListFilter("all"); setListQuery(""); }} style={{ color: "var(--sos-primary)" }}>Show all</button>
                </div>
              ) : listMode === "list" ? (
                <div key={`${listFilter}-${listSort}`} className="sos-card overflow-hidden divide-y sos-rows" style={{ borderColor: "var(--sos-border)" }}>
                  {visibleProjects.map((p, i) => (
                    <ProjectRow key={p.id} index={i} project={p} gates={gates.filter((g) => g.project_id === p.id)} deliverables={deliverables.filter((d) => d.project_id === p.id)} onOpen={() => setSelected(p.id)} />
                  ))}
                </div>
              ) : (
                <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sos-stagger">
                  {visibleProjects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      gates={gates.filter((g) => g.project_id === p.id)}
                      deliverables={deliverables.filter((d) => d.project_id === p.id)}
                      onOpen={() => setSelected(p.id)}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {isLarge && (
              <aside className="sticky top-20 space-y-4">
                <StudioClock info={studioInfo} onOpenCalendar={() => setTab("calendar")} />
                <button
                  type="button"
                  onClick={() => setTab("messages")}
                  className="w-full sos-card p-4 flex items-center gap-3 text-left"
                >
                  <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Message the studio</span>
                    <span className="block text-[12px]" style={{ color: "var(--sos-text-3)" }}>{unread ? `${unread} new repl${unread > 1 ? "ies" : "y"}` : "Questions, ideas, anything"}</span>
                  </span>
                  {unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#B42318] text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
                </button>
              </aside>
            )}
          </div>
          <Footer />
          <PortalAssistant />
        </div>
      )}
    </div>
  );
}
