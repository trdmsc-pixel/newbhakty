/**
 * Client pulse — the live link between the portal, Gmail sync and Studio OS.
 * - Realtime on tasks / gates / inbox / mail threads / deliverables / projects
 *   reloads cloud state (debounced) so every screen stays current.
 * - Unread client updates (portal approvals & change requests) are tracked
 *   from studio_notifications, chime on arrival, badge the nav and surface at
 *   the top of Today until marked seen.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { useInbox } from "../InboxContext";

export interface ClientUpdate {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

interface PulseValue {
  updates: ClientUpdate[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
}

const PulseContext = createContext<PulseValue>({ updates: [], unread: 0, markRead: () => {}, markAllRead: () => {}, soundOn: true, setSoundOn: () => {} });
export const useClientPulse = () => useContext(PulseContext);

const SOUND_KEY = "sos_client_chime";

/** Soft two-note chime (no audio file needed). */
function chime() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [
      [880, 0],
      [1318.5, 0.14],
    ].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.6);
    });
    setTimeout(() => ctx.close().catch(() => null), 1200);
  } catch {
    /* audio unavailable */
  }
}

export const ClientPulseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { supabaseSyncStatus, reloadFromCloud, pushToast, isOwner } = useStudioOS();
  const { refresh: refreshInbox } = useInbox();
  const [updates, setUpdates] = useState<ClientUpdate[]>([]);
  const [soundOn, setSoundOnState] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = supabaseSyncStatus === "synced" && Boolean(supabase);

  const setSoundOn = (v: boolean) => {
    setSoundOnState(v);
    try {
      localStorage.setItem(SOUND_KEY, v ? "on" : "off");
    } catch {
      /* ignore */
    }
  };

  const loadUpdates = useCallback(async () => {
    if (!supabase) return;
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data } = await supabase
      .from("studio_notifications")
      .select("id, kind, title, body, created_at, read_at")
      .like("kind", "portal_%")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    setUpdates((data || []) as ClientUpdate[]);
  }, []);

  useEffect(() => {
    if (!live || !isOwner) return;
    loadUpdates();
    const reload = (ms = 900) => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => reloadFromCloud(), ms);
    };
    const inbox = () => {
      if (inboxTimer.current) clearTimeout(inboxTimer.current);
      inboxTimer.current = setTimeout(() => refreshInbox().catch(() => null), 700);
    };
    const channel = supabase!
      .channel("studio-os-pulse")
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_gates" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_tasks" }, () => reload(1200))
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_projects" }, () => reload(1200))
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_deliverables" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_inbox_items" }, () => {
        inbox();
        reload(1500);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "studio_email_threads" }, () => inbox())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "studio_notifications" }, (payload: any) => {
        const n = payload?.new as ClientUpdate | undefined;
        if (!n?.kind?.startsWith("portal_")) return;
        setUpdates((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 20));
        if (soundRef.current) chime();
        pushToast(n.title || "Client update from the portal", n.kind === "portal_approval" ? "success" : "warn");
        reload(500);
      })
      .subscribe();
    // Catch anything missed while the tab was asleep.
    const onFocus = () => {
      loadUpdates();
      reload(300);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      if (inboxTimer.current) clearTimeout(inboxTimer.current);
      window.removeEventListener("focus", onFocus);
      supabase?.removeChannel(channel);
    };
  }, [live, isOwner, loadUpdates, reloadFromCloud, refreshInbox, pushToast]);

  const markRead = useCallback((id: string) => {
    const at = new Date().toISOString();
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, read_at: at } : u)));
    supabase?.from("studio_notifications").update({ read_at: at }).eq("id", id).then(() => null);
  }, []);

  const markAllRead = useCallback(() => {
    const at = new Date().toISOString();
    const ids = updates.filter((u) => !u.read_at).map((u) => u.id);
    if (!ids.length) return;
    setUpdates((prev) => prev.map((u) => (u.read_at ? u : { ...u, read_at: at })));
    supabase?.from("studio_notifications").update({ read_at: at }).in("id", ids).then(() => null);
  }, [updates]);

  const unread = updates.filter((u) => !u.read_at).length;

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread ? `(${unread}) ${base}` : base;
  }, [unread]);

  return <PulseContext.Provider value={{ updates, unread, markRead, markAllRead, soundOn, setSoundOn }}>{children}</PulseContext.Provider>;
};
