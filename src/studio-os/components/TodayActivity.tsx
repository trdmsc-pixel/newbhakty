/**
 * Today screen:
 *  - "Sent / received today" across all projects (same sources as stage history):
 *    notes & messages both ways, versions shared, reviews requested, client approvals & change requests.
 *  - Unanswered notes: studio notes the client hasn't read after 48 h, with a one-tap nudge.
 */
import React, { useCallback, useEffect, useState } from "react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, BellRing, CheckCircle2, FileVideo, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";

interface Item {
  at: string;
  dir: "out" | "in";
  icon: React.ReactNode;
  color: string;
  text: string;
  pid: string | null;
}
interface Unread {
  id: string;
  client_id: string;
  project_id: string | null;
  gate_id: string | null;
  body: string;
  created_at: string;
  nudged_at: string | null;
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const TodayActivityInner: React.FC = () => {
  const { projects, gates, clients, openProject, supabaseSyncStatus, isOwner, pushToast } = useStudioOS();
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState<Unread[]>([]);
  const [nudging, setNudging] = useState<string | null>(null);

  const code = useCallback((id: string | null) => projects.find((p) => p.id === id)?.code || "", [projects]);
  const clientName = useCallback((id: string | null) => clients.find((c) => c.id === id)?.name || "Client", [clients]);
  const gateName = useCallback((id: string | null) => gates.find((g) => g.id === id)?.name || "", [gates]);

  const load = useCallback(async () => {
    if (!supabase || supabaseSyncStatus !== "synced" || !isOwner) return;
    const since = startOfToday();
    const before48h = new Date(Date.now() - 48 * 3600_000).toISOString();
    const [msgs, vers, notifs, acts, tasks, old] = await Promise.all([
      supabase.from("studio_portal_messages").select("from_studio, via, body, author_name, client_id, project_id, gate_id, created_at").gte("created_at", since).is("archived_at", null),
      supabase.from("studio_deliverables").select("title, version, project_id, shared_with_client, is_final, created_at").gte("created_at", since).eq("shared_with_client", true).is("archived_at", null),
      supabase.from("studio_portal_notifications").select("kind, title, project_id, created_at").eq("kind", "review_ready").gte("created_at", since),
      supabase.from("studio_activity_log").select("actor, actor_name, action, entity_id, at").eq("actor", "client").gte("at", since),
      supabase.from("studio_tasks").select("project_id, source_ref, created_at").eq("source", "portal").gte("created_at", since),
      supabase.from("studio_portal_messages").select("id, client_id, project_id, gate_id, body, created_at, nudged_at").eq("from_studio", true).is("read_by_client_at", null).is("archived_at", null).not("body", "like", "Gentle reminder%").lte("created_at", before48h).order("created_at").limit(20),
    ]);
    const out: Item[] = [];
    for (const m of msgs.data || [])
      out.push(
        m.from_studio
          ? { at: m.created_at, dir: "out", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "#5B3FE4", text: `${m.via === "claude" ? "Claude sent" : "You sent"} a note${m.gate_id ? ` on ${gateName(m.gate_id)}` : ""} to ${clientName(m.client_id)}`, pid: m.project_id }
          : { at: m.created_at, dir: "in", icon: <MessageSquare className="w-3.5 h-3.5" />, color: "#0EA5E9", text: `${m.author_name || clientName(m.client_id)}: “${String(m.body).slice(0, 70)}${String(m.body).length > 70 ? "…" : ""}”`, pid: m.project_id }
      );
    for (const d of vers.data || []) out.push({ at: d.created_at, dir: "out", icon: <FileVideo className="w-3.5 h-3.5" />, color: "#7C3AED", text: `${d.is_final ? "Final files" : `Version ${d.version || ""}`} shared · ${d.title}`, pid: d.project_id });
    for (const n of notifs.data || []) out.push({ at: n.created_at, dir: "out", icon: <Sparkles className="w-3.5 h-3.5" />, color: "#D97706", text: `Sent for review · ${n.title.replace(/ is ready for your review$/, "")}`, pid: n.project_id });
    const roundSeen = new Set<string>();
    for (const t of tasks.data || []) {
      const k = String(t.source_ref || "");
      if (roundSeen.has(k)) continue;
      roundSeen.add(k);
      out.push({ at: t.created_at, dir: "in", icon: <ArrowDownLeft className="w-3.5 h-3.5" />, color: "#DC2626", text: `Change request received`, pid: t.project_id });
    }
    for (const a of acts.data || [])
      if (/approved/i.test(a.action)) {
        const g = gates.find((x) => x.id === a.entity_id);
        out.push({ at: a.at, dir: "in", icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#16A34A", text: `${a.actor_name || "Client"} ${a.action}`, pid: g?.project_id || null });
      }
    out.sort((a, b) => b.at.localeCompare(a.at));
    setItems(out);
    setUnread((old.data || []) as Unread[]);
  }, [supabaseSyncStatus, isOwner, gateName, clientName, gates]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 120_000);
    return () => window.clearInterval(t);
  }, [load]);

  const nudge = async (u: Unread) => {
    if (!supabase) return;
    setNudging(u.id);
    const sentOn = new Date(u.created_at).toLocaleDateString([], { day: "numeric", month: "short" });
    const about = u.gate_id ? ` about ${gateName(u.gate_id)}` : "";
    const { error } = await supabase.from("studio_portal_messages").insert({
      client_id: u.client_id,
      project_id: u.project_id,
      gate_id: u.gate_id,
      body: `Gentle reminder — we sent you a note${about} on ${sentOn}. Have a look when you get a moment:\n\n“${u.body.slice(0, 300)}${u.body.length > 300 ? "…" : ""}”`,
      from_studio: true,
      author_name: "The Chanting Studio",
      via: "studio",
    });
    if (!error) await supabase.from("studio_portal_messages").update({ nudged_at: new Date().toISOString() }).eq("id", u.id);
    setNudging(null);
    if (error) return pushToast(error.message, "warn");
    pushToast("Nudge sent — they'll get a ring and an email", "success");
    load();
  };

  if (!isOwner || supabaseSyncStatus !== "synced" || (!items?.length && !unread.length)) return null;
  const outN = items?.filter((i) => i.dir === "out").length || 0;
  const inN = items?.filter((i) => i.dir === "in").length || 0;

  return (
    <section className="sos-card p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="sos-display text-[17px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Sent & received today</h2>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#5B3FE4" }}>
          <ArrowUpRight className="w-3.5 h-3.5" /> {outN} sent
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "#0EA5E9" }}>
          <ArrowDownLeft className="w-3.5 h-3.5" /> {inN} received
        </span>
      </div>

      {unread.length > 0 && (
        <div className="p-3 rounded-[16px] space-y-1.5" style={{ background: "#FFF8EE", border: "1px solid rgba(245,158,11,0.25)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#9A4A00" }}>
            <BellRing className="w-3.5 h-3.5" /> Not read after 48 h · {unread.length}
          </p>
          {unread.slice(0, 5).map((u) => (
            <div key={u.id} className="flex items-center gap-2.5 text-[13px]">
              <button type="button" onClick={() => u.project_id && openProject(u.project_id)} className="min-w-0 flex-1 text-left truncate" style={{ color: "var(--sos-text-1)" }}>
                <span className="font-semibold" style={{ color: "var(--sos-primary)" }}>{code(u.project_id)}</span> {clientName(u.client_id)} · “{u.body.slice(0, 60)}” <span style={{ color: "var(--sos-text-3)" }}>· {formatDistanceToNowStrict(parseISO(u.created_at), { addSuffix: true })}</span>
              </button>
              {u.nudged_at ? (
                <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--sos-text-3)" }}>nudged {formatDistanceToNowStrict(parseISO(u.nudged_at), { addSuffix: true })}</span>
              ) : (
                <button type="button" disabled={nudging === u.id} onClick={() => nudge(u)} className="sos-jelly sos-jelly-amber shrink-0 inline-flex items-center gap-1 h-7 px-3 text-[11px]">
                  {nudging === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />} Nudge
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 sos-rows">
          {items.slice(0, 30).map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => it.pid && openProject(it.pid)}
              className="shrink-0 max-w-[280px] text-left flex items-start gap-2 p-2.5 rounded-[14px] border transition-transform hover:-translate-y-0.5"
              style={{ borderColor: "var(--sos-border)", background: it.dir === "in" ? "rgba(14,165,233,0.05)" : "rgba(91,63,228,0.05)", ["--i" as any]: Math.min(i, 14) }}
            >
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: it.color }}>{it.icon}</span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold leading-snug line-clamp-2" style={{ color: "var(--sos-text-1)" }}>
                  {code(it.pid) && <span style={{ color: "var(--sos-primary)" }}>{code(it.pid)} </span>}
                  {it.text}
                </span>
                <span className="block text-[10.5px] mt-0.5" style={{ color: "var(--sos-text-3)" }}>
                  {it.dir === "in" ? "received" : "sent"} · {new Date(it.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export const TodayActivity = React.memo(TodayActivityInner);
