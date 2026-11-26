/**
 * Live client presence (Supabase Realtime, private channels).
 * The portal tracks itself on `presence:client:<clientId>` while a project is open;
 * Studio OS (owner) listens to every client's channel. RLS on realtime.messages
 * keeps each client on its own topic.
 */
import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";

export interface Viewer {
  name: string;
  project_id: string;
  project_title?: string;
  activity: string;
  at: string;
}

type Map = Record<string, Viewer[]>;
let state: Map = {};
const listeners = new Set<(m: Map) => void>();
const channels = new Map<string, RealtimeChannel>();
const perClient = new Map<string, Viewer[]>();

function rebuild() {
  const next: Map = {};
  for (const list of perClient.values()) for (const v of list) (next[v.project_id] ||= []).push(v);
  state = next;
  listeners.forEach((l) => l(state));
}

function ensure(clientIds: string[]) {
  if (!supabase) return;
  for (const id of clientIds) {
    if (channels.has(id)) continue;
    const ch = supabase.channel(`presence:client:${id}`, { config: { private: true, presence: { key: `studio-${Math.random().toString(36).slice(2, 8)}` } } });
    ch.on("presence", { event: "sync" }, () => {
      const raw = ch.presenceState() as Record<string, any[]>;
      const viewers: Viewer[] = [];
      for (const metas of Object.values(raw)) for (const m of metas) if (m?.project_id && m.role === "client") viewers.push(m as Viewer);
      perClient.set(id, viewers);
      rebuild();
    });
    ch.subscribe();
    channels.set(id, ch);
  }
}

/** project_id → clients viewing it right now. */
export function usePortalPresence(): Map {
  const { clients, isOwner, supabaseSyncStatus } = useStudioOS();
  const [m, setM] = useState<Map>(state);
  useEffect(() => {
    listeners.add(setM);
    return () => {
      listeners.delete(setM);
    };
  }, []);
  const ids = clients.filter((c) => c.contacts?.some((x: any) => x.is_portal_user || x.has_portal_login)).map((c) => c.id).join(",");
  useEffect(() => {
    if (!isOwner || supabaseSyncStatus !== "synced" || !ids) return;
    ensure(ids.split(","));
  }, [ids, isOwner, supabaseSyncStatus]);
  return m;
}
