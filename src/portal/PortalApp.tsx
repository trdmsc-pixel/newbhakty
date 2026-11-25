import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { toEmbed } from "./embed";
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
}
interface PortalDeliverable {
  id: string;
  project_id: string;
  gate_id: string | null;
  title: string;
  url: string;
  version: string | null;
  created_at: string;
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
const milestoneDate = (p: PortalProject) => p.promised_date || p.forecast_date || p.hard_deadline;

const HEALTH: Record<PortalProject["health"], { label: string; bg: string; text: string }> = {
  on_track: { label: "On track", bg: "#E7F7EE", text: "#22875A" },
  tight: { label: "On track", bg: "#E7F7EE", text: "#22875A" },
  at_risk: { label: "Watching closely", bg: "#FFF3E0", text: "#C26A00" },
  late: { label: "Date under review", bg: "#FFF3E0", text: "#C26A00" },
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

const Brand: React.FC<{ onSignOut?: () => void; who?: string }> = ({ onSignOut, who }) => (
  <header className="flex items-center justify-between gap-3 py-5">
    <div>
      <p className="sos-display text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
        The Chanting Studio
      </p>
      <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
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
// Login (magic link, portal contacts only — enforced server-side)
// ---------------------------------------------------------------------------
const PortalLogin: React.FC = () => {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
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
        {state === "sent" ? (
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
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--sos-text-2)" }}>
                Work email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full h-12 px-4 rounded-[14px] border text-[15px]"
                style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              />
            </label>
            {state === "error" && (
              <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FDECEC", color: "#E5484D" }}>
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--sos-primary)" }}
            >
              {state === "sending" && <Loader2 className="w-4 h-4 animate-spin" />} Email me a sign-in link
            </button>
            <p className="text-[12px] text-center" style={{ color: "var(--sos-text-3)" }}>
              Access is by invitation from the studio.
            </p>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------
const ProjectCard: React.FC<{ project: PortalProject; awaiting: number; onOpen: () => void }> = ({ project, awaiting, onOpen }) => {
  const h = HEALTH[project.health] || HEALTH.on_track;
  const date = fmtDate(milestoneDate(project));
  const done = project.status === "delivered" || project.status === "paid";
  return (
    <button type="button" onClick={onOpen} className="sos-card overflow-hidden text-left transition-transform hover:-translate-y-0.5">
      <div
        className="h-40 flex items-center justify-center text-[44px] relative"
        style={{
          background: project.cover_image_url ? `center / cover no-repeat url("${project.cover_image_url}")` : "var(--sos-violet-soft)",
        }}
      >
        {!project.cover_image_url && <span>{project.emoji || "🎬"}</span>}
        {awaiting > 0 && (
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: "#FFFFFF", color: "#C26A00" }}>
            Awaiting your approval
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
              {TYPE_LABEL[project.type] || "Project"}
            </p>
            <h3 className="sos-display text-[19px] font-semibold leading-tight line-clamp-2" style={{ color: "var(--sos-text-1)" }}>
              {project.title}
            </h3>
          </div>
          {done ? <Pill bg="#E7F7EE" text="#22875A">Delivered</Pill> : <Pill bg={h.bg} text={h.text}>{h.label}</Pill>}
        </div>
        <div className="flex items-center justify-between text-[13px]" style={{ color: "var(--sos-text-2)" }}>
          <span className="truncate">{done ? "Complete" : project.current_stage || "Getting started"}</span>
          {date && !done && (
            <span className="sos-tabular shrink-0 inline-flex items-center gap-1" style={{ color: "var(--sos-text-3)" }}>
              <Clock className="w-3.5 h-3.5" /> {date}
            </span>
          )}
        </div>
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
        const date = done || current ? fmtDate(g.approved_at || g.sent_for_approval_at || g.started_at) : null;
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
                <p className="text-[12px]" style={{ color: g.status === "waiting_on_client" ? "#C26A00" : "var(--sos-text-3)" }}>
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

const Preview: React.FC<{ url: string | null }> = ({ url }) => {
  const embed = toEmbed(url);
  if (!embed) return null;
  if (embed.kind === "iframe") {
    return (
      <div className="rounded-[18px] overflow-hidden bg-black aspect-video">
        <iframe
          src={embed.src}
          title="Review preview"
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      </div>
    );
  }
  return (
    <a
      href={embed.src}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center justify-between gap-3 p-4 rounded-[18px] border"
      style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface-2)" }}
    >
      <span className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
        Open review on {embed.host}
      </span>
      <ExternalLink className="w-4 h-4" style={{ color: "var(--sos-text-2)" }} />
    </a>
  );
};

const ApprovalCard: React.FC<{
  gate: PortalGate;
  previewUrl: string | null;
  onDone: (msg: string) => void;
}> = ({ gate, previewUrl, onDone }) => {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState<Array<{ t: string; text: string }>>([]);
  const [busy, setBusy] = useState(false);
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
      ...notes.filter((n) => n.text.trim()).map((n) => `${n.t.trim() ? `[${n.t.trim()}] ` : ""}${n.text.trim()}`),
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
          <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "#C26A00" }}>
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

      <Preview url={previewUrl} />
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
            <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FFF3E0", color: "#C26A00" }}>
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
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={n.t}
                  onChange={(e) => setNotes((prev) => prev.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))}
                  placeholder="0:12"
                  className="w-20 h-10 px-3 rounded-[12px] border text-[13px] sos-tabular"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
                <input
                  value={n.text}
                  onChange={(e) => setNotes((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  placeholder="Note at this moment"
                  className="flex-1 h-10 px-3 rounded-[12px] border text-[13px]"
                  style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                />
                <button type="button" onClick={() => setNotes((prev) => prev.filter((_, j) => j !== i))} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label="Remove note">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setNotes((prev) => [...prev, { t: "", text: "" }])} className="text-[13px] font-medium inline-flex items-center gap-1" style={{ color: "var(--sos-primary)" }}>
              <Plus className="w-4 h-4" /> Add timestamp note
            </button>
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
        <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "#FDECEC", color: "#E5484D" }}>
          {error}
        </p>
      )}
    </div>
  );
};

const ProjectView: React.FC<{
  project: PortalProject;
  gates: PortalGate[];
  deliverables: PortalDeliverable[];
  invoices: PortalInvoice[];
  onBack: () => void;
  onChanged: () => void;
}> = ({ project, gates, deliverables, invoices, onBack, onChanged }) => {
  const [flash, setFlash] = useState("");
  const h = HEALTH[project.health] || HEALTH.on_track;
  const done = project.status === "delivered" || project.status === "paid";
  const awaiting = gates.filter((g) => g.status === "waiting_on_client");
  const previewFor = (gateId: string) =>
    [...deliverables].filter((d) => d.gate_id === gateId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.url || project.review_link_url;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="text-[13px] font-medium inline-flex items-center gap-1.5" style={{ color: "var(--sos-text-2)" }}>
        <ArrowLeft className="w-4 h-4" /> All projects
      </button>

      <div className="sos-card p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>
            {TYPE_LABEL[project.type] || "Project"}
          </p>
          <h1 className="sos-display text-[28px] md:text-[32px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>
            {project.emoji} {project.title}
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--sos-text-2)" }}>
            {done ? "Delivered by the studio" : `Currently: ${project.current_stage || "getting started"}`}
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1.5">
          {done ? <Pill bg="#E7F7EE" text="#22875A">Delivered</Pill> : <Pill bg={h.bg} text={h.text}>{h.label}</Pill>}
          {!done && milestoneDate(project) && (
            <p className="text-[13px] sos-tabular" style={{ color: "var(--sos-text-2)" }}>
              Expected delivery <strong>{fmtDate(milestoneDate(project))}</strong>
            </p>
          )}
        </div>
      </div>

      {flash && (
        <div className="p-4 rounded-[18px] text-[14px] font-medium" style={{ background: "#E7F7EE", color: "#22875A" }}>
          {flash}
        </div>
      )}

      {awaiting.map((g) => (
        <ApprovalCard
          key={g.id}
          gate={g}
          previewUrl={previewFor(g.id)}
          onDone={(msg) => {
            if (msg) setFlash(msg);
            onChanged();
          }}
        />
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <Stepper gates={gates} />
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
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-3 px-3.5 py-3 rounded-[14px] hover:opacity-90"
                      style={{ background: "var(--sos-surface-2)" }}
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
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sos-text-3)" }} />
                    </a>
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
                      ? { bg: "#E7F7EE", text: "#22875A", label: "Paid" }
                      : i.status === "overdue"
                      ? { bg: "#FFF3E0", text: "#C26A00", label: "Due" }
                      : i.status === "partly_paid"
                      ? { bg: "#E8F0FF", text: "#2F6BFF", label: "Part paid" }
                      : { bg: "#E8F0FF", text: "#2F6BFF", label: "Sent" };
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
  const [contact, setContact] = useState<{ ok: boolean; name?: string; organisation?: string } | null>(null);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [gates, setGates] = useState<PortalGate[]>([]);
  const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.search).get("project"));
  const [loading, setLoading] = useState(false);

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
      setProjects((p.data || []) as PortalProject[]);
      setGates((g.data || []) as PortalGate[]);
      setDeliverables((d.data || []) as PortalDeliverable[]);
      setInvoices((i.data || []) as PortalInvoice[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [signedIn, load]);

  useEffect(() => {
    const url = selected ? `/portal?project=${selected}` : "/portal";
    if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, "", url);
  }, [selected]);

  const signOut = async () => {
    await supabase?.auth.signOut().catch(() => {});
    setSignedIn(false);
    setContact(null);
    setSelected(null);
  };

  const awaitingByProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gates) if (g.status === "waiting_on_client") m.set(g.project_id, (m.get(g.project_id) || 0) + 1);
    return m;
  }, [gates]);

  const project = projects.find((p) => p.id === selected);

  return (
    <div className="studio-os-root">
      {checking ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--sos-primary)" }} />
        </div>
      ) : !signedIn ? (
        <PortalLogin />
      ) : contact && !contact.ok ? (
        <div className="max-w-md mx-auto px-4">
          <Brand onSignOut={signOut} />
          <div className="sos-card p-7 space-y-3 mt-6">
            <h1 className="sos-display text-[22px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              No projects shared yet
            </h1>
            <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
              This email doesn't have portal access. If you were expecting it, ask the studio to send you an invitation.
            </p>
            <button type="button" onClick={onNavigateHome} className="text-[13px] font-medium" style={{ color: "var(--sos-primary)" }}>
              Visit thechantingstudio.in
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 md:px-6">
          <Brand onSignOut={signOut} who={contact?.organisation} />
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
              {projects.length === 0 ? (
                <div className="sos-card p-8 text-center text-[14px]" style={{ color: "var(--sos-text-3)" }}>
                  The studio hasn't shared a project here yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {projects.map((p) => (
                    <ProjectCard key={p.id} project={p} awaiting={awaitingByProject.get(p.id) || 0} onOpen={() => setSelected(p.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
          <Footer />
        </div>
      )}
    </div>
  );
}
