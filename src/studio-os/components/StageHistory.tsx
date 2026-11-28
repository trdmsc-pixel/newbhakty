/**
 * Everything that happened on one stage, in one timeline:
 * notes you (or Claude) sent, versions shared, "sent for review", what the client was
 * notified / emailed, the client's change requests (with status) and approvals.
 * Also lets you send a new note on this stage.
 */
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { Bot, CheckCircle2, FileVideo, History, Loader2, Mail, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import type { StudioGate, StudioProject } from "../types";

interface Ev {
  at: string;
  kind: "note" | "client_msg" | "version" | "sent" | "notified" | "client_changes" | "approved" | "addressed" | "ai";
  title: string;
  body?: string;
  meta?: string;
}

const STYLE: Record<Ev["kind"], { icon: React.ReactNode; color: string; side: "studio" | "client" | "system" }> = {
  note: { icon: <Send className="w-3.5 h-3.5" />, color: "#5B3FE4", side: "studio" },
  client_msg: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "#0EA5E9", side: "client" },
  version: { icon: <FileVideo className="w-3.5 h-3.5" />, color: "#7C3AED", side: "studio" },
  sent: { icon: <Sparkles className="w-3.5 h-3.5" />, color: "#D97706", side: "studio" },
  notified: { icon: <Mail className="w-3.5 h-3.5" />, color: "#64748B", side: "system" },
  client_changes: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "#DC2626", side: "client" },
  approved: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#16A34A", side: "client" },
  addressed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#16A34A", side: "studio" },
  ai: { icon: <Bot className="w-3.5 h-3.5" />, color: "#5B3FE4", side: "studio" },
};

const EMAIL_LABEL: Record<string, string> = { sent: "emailed", pending: "email queued", failed: "email failed", skipped: "no email", none: "portal only" };

export function useStageEventCount(gateId: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("studio_portal_messages")
      .select("id", { count: "exact", head: true })
      .eq("gate_id", gateId)
      .is("archived_at", null)
      .then(({ count }) => setN(count || 0));
  }, [gateId]);
  return n;
}

export const StageHistoryButton: React.FC<{ project: StudioProject; gate: StudioGate }> = ({ project, gate }) => {
  const [open, setOpen] = useState(false);
  const notes = useStageEventCount(gate.id);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sos-pill-btn inline-flex items-center gap-1 px-3 h-8 text-[12px] font-semibold border"
        style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
        title="Notes, versions, emails and client replies for this stage"
      >
        <History className="w-3 h-3" /> History{notes ? ` · ${notes}` : ""}
      </button>
      <AnimatePresence>{open && <StageHistoryDrawer project={project} gate={gate} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
};

/** Loads one stage's full back-and-forth and sends stage notes. */
export function useStageTimeline(project: StudioProject, gate: StudioGate) {
  const { pushToast } = useStudioOS();
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return setEvents([]);
    const [msgs, vers, notifs, tasks, acts] = await Promise.all([
      supabase.from("studio_portal_messages").select("body, from_studio, author_name, via, created_at, read_by_client_at").eq("gate_id", gate.id).is("archived_at", null),
      supabase.from("studio_deliverables").select("title, version, url, shared_with_client, is_final, created_at").eq("gate_id", gate.id).is("archived_at", null),
      supabase.from("studio_portal_notifications").select("kind, title, email_status, read_at, created_at").eq("gate_id", gate.id),
      supabase.from("studio_tasks").select("title, status, source_ref, created_at, completed_at").eq("gate_id", gate.id).eq("source", "portal").is("archived_at", null),
      supabase.from("studio_activity_log").select("actor, actor_name, action, at, entity_id, diff").or(`entity_id.eq.${gate.id},entity_id.eq.${project.id}`).order("at", { ascending: false }).limit(200),
    ]);
    const ev: Ev[] = [];
    for (const m of msgs.data || []) {
      ev.push(
        m.from_studio
          ? { at: m.created_at, kind: m.via === "claude" ? "ai" : "note", title: m.via === "claude" ? "Note sent via Claude" : "Note sent to client", body: m.body, meta: m.read_by_client_at ? `read ${format(parseISO(m.read_by_client_at), "d MMM, HH:mm")}` : "not read yet" }
          : { at: m.created_at, kind: "client_msg", title: `${m.author_name || "Client"} wrote`, body: m.body }
      );
    }
    for (const d of vers.data || []) ev.push({ at: d.created_at, kind: "version", title: `${d.is_final ? "Final files" : "Version"} ${d.version || ""} ${d.shared_with_client ? "shared" : "added (not shared)"}`, body: d.title });
    for (const n of notifs.data || []) ev.push({ at: n.created_at, kind: n.kind === "review_ready" ? "sent" : "notified", title: n.kind === "review_ready" ? "Sent for client review" : `Client notified: ${n.title}`, meta: `${EMAIL_LABEL[n.email_status] || n.email_status}${n.read_at ? " · seen in portal" : ""}` });
    const rounds = new Map<string, any[]>();
    for (const t of tasks.data || []) {
      const r = String(t.source_ref || "").match(/:r(\d+)$/)?.[1] || "1";
      (rounds.get(r) || rounds.set(r, []).get(r)!).push(t);
      if (t.status === "done" && t.completed_at) ev.push({ at: t.completed_at, kind: "addressed", title: "Change addressed", body: t.title.replace(/^.*? R\d+:\s*/, "") });
    }
    for (const [r, list] of rounds) ev.push({ at: list[0].created_at, kind: "client_changes", title: `Client requested changes · round ${r}`, body: list.map((t) => `• ${t.title.replace(/^.*? R\d+:\s*/, "")}`).join("\n"), meta: `${list.filter((t) => t.status === "done").length}/${list.length} addressed` });
    for (const a of acts.data || []) {
      const mentions = a.entity_id === gate.id || String(a.action || "").toLowerCase().includes(gate.name.toLowerCase());
      if (!mentions) continue;
      if (a.actor === "client" && /approved/i.test(a.action)) ev.push({ at: a.at, kind: "approved", title: `${a.actor_name || "Client"} approved`, body: (a.diff as any)?.comment || undefined });
      else if (a.actor === "ai") ev.push({ at: a.at, kind: "ai", title: `${a.actor_name || "AI"}: ${a.action}` });
    }
    ev.sort((a, b) => b.at.localeCompare(a.at));
    setEvents(ev);
  }, [gate.id, gate.name, project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!supabase || !note.trim() || !project.client_id) return;
    setBusy(true);
    const { error } = await supabase.from("studio_portal_messages").insert({ client_id: project.client_id, project_id: project.id, gate_id: gate.id, body: note.trim(), from_studio: true, author_name: "The Chanting Studio", via: "studio" });
    setBusy(false);
    if (error) return pushToast(error.message, "warn");
    setNote("");
    pushToast("Note sent — the client is notified (email follows in a minute)", "success");
    load();
  };

  return { events, note, setNote, busy, send };
}

/** Timeline list (newest first). */
export const StageTimelineList: React.FC<{ events: Ev[] | null; compact?: boolean }> = ({ events, compact }) => (
  <>
    {!events && <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--sos-text-3)" }} />}
    {events && events.length === 0 && <p className="text-[13px] text-center py-6" style={{ color: "var(--sos-text-3)" }}>Nothing sent or received on this stage yet.</p>}
    <ol className={`relative ${compact ? "space-y-2" : "space-y-3"} sos-rows`}>
      {(compact ? events?.slice(0, 6) : events)?.map((e, i) => {
        const st = STYLE[e.kind];
        return (
          <li key={i} className={`flex gap-3 ${st.side === "client" ? "flex-row-reverse text-right" : ""}`} style={{ ["--i" as any]: Math.min(i, 14) }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5" style={{ background: st.color, boxShadow: `0 4px 12px -4px ${st.color}` }}>{st.icon}</span>
            <div className="min-w-0 flex-1 p-3 rounded-[14px]" style={{ background: st.side === "client" ? "rgba(14,165,233,0.07)" : st.side === "system" ? "var(--sos-surface-2)" : "rgba(91,63,228,0.06)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{e.title}</p>
              {e.body && <p className="text-[13px] whitespace-pre-wrap mt-0.5" style={{ color: "var(--sos-text-2)" }}>{e.body}</p>}
              <p className="text-[11px] mt-1" style={{ color: "var(--sos-text-3)" }}>
                {format(parseISO(e.at), "EEE d MMM, HH:mm")}
                {e.meta ? ` · ${e.meta}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  </>
);

/** Note composer for a stage. */
export const StageNoteBox: React.FC<{ gate: StudioGate; canSend: boolean; note: string; setNote: (v: string) => void; busy: boolean; send: () => void }> = ({ gate, canSend, note, setNote, busy, send }) => (
  <div className="space-y-2">
    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={4000} placeholder={`Send a note about ${gate.name}…`} className="w-full px-3.5 py-2.5 rounded-[14px] border text-[14px] resize-none" style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} />
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>Shows in their portal (with a ring) and is emailed after 1 min.</span>
      <button type="button" disabled={busy || !note.trim() || !canSend} onClick={send} className="sos-jelly inline-flex items-center gap-1.5 h-9 px-4 text-[13px] disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send note
      </button>
    </div>
  </div>
);

const StageHistoryDrawer: React.FC<{ project: StudioProject; gate: StudioGate; onClose: () => void }> = ({ project, gate, onClose }) => {
  const { events, note, setNote, busy, send } = useStageTimeline(project, gate);
  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full sm:max-w-[460px] flex flex-col shadow-2xl"
        style={{ background: "var(--sos-surface)" }}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b" style={{ borderColor: "var(--sos-border)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>{project.code} · stage history</p>
            <h3 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>{gate.name}</h3>
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>What you sent, what they said, and what they were notified about.</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          <StageTimelineList events={events} />
        </div>
        <div className="p-4 border-t" style={{ borderColor: "var(--sos-border)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <StageNoteBox gate={gate} canSend={Boolean(project.client_id)} note={note} setNote={setNote} busy={busy} send={send} />
        </div>
      </motion.aside>
    </motion.div>
  );
};
