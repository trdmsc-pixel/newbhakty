import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { studioApi } from "./api";
import { useStudioOS } from "./StudioOSContext";

export type InboxItemSource = "gmail" | "whatsapp" | "website" | "portal" | "manual" | "claude_task";
export type InboxItemAction =
  | "create_task"
  | "create_promise"
  | "approve_gate"
  | "update_payment"
  | "log_payment"
  | "new_lead"
  | "reply_owed"
  | "update_deadline"
  | "update_task_status"
  | "ignore";

export interface InboxItem {
  id: string;
  source: InboxItemSource;
  title: string | null;
  summary: string | null;
  raw_text: string;
  received_at: string;
  suggested_action: InboxItemAction | null;
  confidence: number;
  matched_client_id: string | null;
  matched_project_id: string | null;
  status: "pending" | "auto_applied" | "accepted" | "dismissed" | "undone";
  payload: Record<string, any> | null;
  sender: string | null;
  gmail_account: string | null;
  thread_id: string | null;
  resolved_at: string | null;
}

export interface EmailThread {
  id: string;
  gmail_account: string;
  thread_id: string;
  subject: string | null;
  client_id: string | null;
  project_id: string | null;
  last_from: "client" | "studio" | null;
  last_message_at: string | null;
  last_sender_email: string | null;
  last_sender_name: string | null;
  needs_reply: boolean;
  draft_id: string | null;
  draft_message_id: string | null;
  summary: string | null;
  reply_owed_task_id: string | null;
  message_count: number;
}

export interface GmailAccount {
  id: string;
  email: string;
  label: string | null;
  is_personal: boolean;
  connected_at: string | null;
  needs_reconnect: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  messages_processed: number;
  is_active: boolean;
  granted_scopes?: string | null;
}

interface InboxContextValue {
  pending: InboxItem[];
  autoUpdates: InboxItem[];
  pendingCount: number;
  loading: boolean;
  available: boolean;
  refresh: () => Promise<void>;
  accept: (id: string, edits?: Record<string, any>) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  undo: (id: string) => Promise<void>;
  acceptAllHigh: () => Promise<void>;
  busyIds: Set<string>;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export const InboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { supabaseSyncStatus, reloadFromCloud, pushToast } = useStudioOS();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const available = supabaseSyncStatus === "synced" && Boolean(supabase);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!available || !supabase || inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("studio_inbox_items")
        .select("id, source, title, summary, raw_text, received_at, suggested_action, confidence, matched_client_id, matched_project_id, status, payload, sender, gmail_account, thread_id, resolved_at")
        .is("archived_at", null)
        .or(`status.eq.pending,and(status.in.(auto_applied,accepted,undone),received_at.gte.${since})`)
        .order("received_at", { ascending: false })
        .limit(200);
      setItems((data || []) as InboxItem[]);
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [available]);

  useEffect(() => {
    refresh();
    if (!available) return;
    const t = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, available]);

  const withBusy = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  }, []);

  const accept = useCallback(
    (id: string, edits?: Record<string, any>) =>
      withBusy(id, async () => {
        try {
          await studioApi(`/api/studio-os/inbox/${id}/accept`, { body: { edits } });
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "accepted", payload: { ...(i.payload || {}), ...(edits || {}) } } : i)));
          pushToast("Applied", "success");
          reloadFromCloud();
        } catch (err: any) {
          pushToast(err?.message || "Could not apply", "warn");
        }
      }),
    [withBusy, pushToast, reloadFromCloud]
  );

  const dismiss = useCallback(
    (id: string) =>
      withBusy(id, async () => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        await studioApi(`/api/studio-os/inbox/${id}/dismiss`, { body: {} }).catch(() => refresh());
      }),
    [withBusy, refresh]
  );

  const undo = useCallback(
    (id: string) =>
      withBusy(id, async () => {
        try {
          await studioApi(`/api/studio-os/inbox/${id}/undo`, { body: {} });
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "undone" } : i)));
          pushToast("Undone", "info");
          reloadFromCloud();
        } catch (err: any) {
          pushToast(err?.message || "Could not undo", "warn");
        }
      }),
    [withBusy, pushToast, reloadFromCloud]
  );

  const acceptAllHigh = useCallback(async () => {
    try {
      const res = await studioApi<{ accepted: number; failed: string[] }>("/api/studio-os/inbox/accept-all-high", { body: {} });
      pushToast(res.failed.length ? `Applied ${res.accepted} · ${res.failed.length} need a look` : `Applied ${res.accepted}`, res.failed.length ? "warn" : "success");
      await refresh();
      reloadFromCloud();
    } catch (err: any) {
      pushToast(err?.message || "Could not apply", "warn");
    }
  }, [pushToast, refresh, reloadFromCloud]);

  const value = useMemo<InboxContextValue>(() => {
    const pending = items.filter((i) => i.status === "pending");
    const autoUpdates = items.filter((i) => i.status !== "pending");
    return { pending, autoUpdates, pendingCount: pending.length, loading, available, refresh, accept, dismiss, undo, acceptAllHigh, busyIds };
  }, [items, loading, available, refresh, accept, dismiss, undo, acceptAllHigh, busyIds]);

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
};

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error("useInbox must be used inside InboxProvider");
  return ctx;
}

export function gmailThreadUrl(account: string, threadId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#all/${threadId}`;
}

export function gmailDraftUrl(account: string, draftMessageId: string) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(account)}#drafts?compose=${draftMessageId}`;
}
