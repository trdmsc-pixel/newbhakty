/**
 * Client notification centre: bell + badge, a chime and a toast the moment the studio
 * shares something (realtime via studio_portal_notifications, RLS = own client only),
 * and a dropdown history. Opening the panel marks everything read.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCircle2, FileVideo, MessageSquare, Sparkles, X } from "lucide-react";
import { supabase } from "./portalSupabase";

export interface PortalNotification {
  id: string;
  project_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

let audioCtx: AudioContext | null = null;
/** Soft two-note chime (Web Audio — no file to load). Browsers allow it after the first tap. */
export function chime() {
  try {
    audioCtx ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t = audioCtx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.14 + 0.5);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + i * 0.14);
      o.stop(t + i * 0.14 + 0.55);
    });
    navigator.vibrate?.(30);
  } catch {
    /* audio unavailable */
  }
}

const ICON: Record<string, React.ReactNode> = {
  message: <MessageSquare className="w-4 h-4" />,
  review_ready: <Sparkles className="w-4 h-4" />,
  new_version: <FileVideo className="w-4 h-4" />,
  final_delivery: <FileVideo className="w-4 h-4" />,
  revision_addressed: <CheckCircle2 className="w-4 h-4" />,
};
const TONE: Record<string, string> = { review_ready: "#D97706", revision_addressed: "#16A34A", final_delivery: "#16A34A", message: "#5B3FE4" };

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
};

export function usePortalNotifications(enabled: boolean, onNew?: (n: PortalNotification) => void) {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const load = useCallback(async () => {
    if (!supabase || !enabled) return;
    const { data } = await supabase.from("studio_portal_notifications").select("id, project_id, kind, title, body, read_at, created_at").order("created_at", { ascending: false }).limit(40);
    const list = (data || []) as PortalNotification[];
    if (seen.current) {
      const fresh = list.filter((n) => !seen.current!.has(n.id) && !n.read_at);
      if (fresh.length) {
        chime();
        onNewRef.current?.(fresh[0]);
      }
    }
    seen.current = new Set(list.map((n) => n.id));
    setItems(list);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supabase) return;
    load();
    const ch = supabase
      .channel("portal-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "studio_portal_notifications" }, () => load())
      .subscribe();
    const t = window.setInterval(load, 45_000); // fallback if realtime drops
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      supabase?.removeChannel(ch);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, load]);

  const markRead = useCallback(async () => {
    if (!supabase || !items.some((n) => !n.read_at)) return;
    await supabase.rpc("portal_mark_notifications_read");
    setItems((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }, [items]);

  return { items, unread: items.filter((n) => !n.read_at).length, markRead, reload: load };
}

export const NotificationBell: React.FC<{ items: PortalNotification[]; unread: number; onOpenChange: (open: boolean) => void; onSelect: (n: PortalNotification) => void }> = ({ items, unread, onOpenChange, onSelect }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && (setOpen(false), onOpenChange(false));
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, onOpenChange]);
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          onOpenChange(!open);
        }}
        className="relative w-10 h-10 rounded-full flex items-center justify-center border transition-transform active:scale-95"
        style={{ borderColor: "var(--sos-border)", background: "var(--sos-surface)", color: unread ? "var(--sos-primary)" : "var(--sos-text-2)" }}
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
      >
        <Bell className={`w-[18px] h-[18px] ${unread ? "sos-ring-bell" : ""}`} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white sos-pulse-badge" style={{ background: "#E11D48" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute right-0 top-12 z-[80] w-[min(92vw,360px)] max-h-[70vh] overflow-y-auto rounded-[20px] border shadow-2xl p-2"
            style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)", transformOrigin: "top right" }}
          >
            <div className="flex items-center justify-between px-2.5 py-2">
              <p className="text-[14px] font-semibold" style={{ color: "var(--sos-text-1)" }}>Notifications</p>
              <button type="button" onClick={() => (setOpen(false), onOpenChange(false))} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {items.length === 0 && <p className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--sos-text-3)" }}>You're all caught up.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onSelect(n);
                  setOpen(false);
                  onOpenChange(false);
                }}
                className="w-full text-left flex items-start gap-3 px-2.5 py-2.5 rounded-[14px] hover:bg-black/[0.03]"
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: TONE[n.kind] || "#5B3FE4" }}>
                  {ICON[n.kind] || <Bell className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>{n.title}</span>
                  {n.body && <span className="block text-[12px] leading-snug line-clamp-2" style={{ color: "var(--sos-text-2)" }}>{n.body}</span>}
                  <span className="block text-[11px] mt-0.5" style={{ color: "var(--sos-text-3)" }}>{ago(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "#E11D48" }} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/** Slide-in toast for a new notification. */
export const NotificationToast: React.FC<{ n: PortalNotification | null; onClose: () => void; onOpen: (n: PortalNotification) => void }> = ({ n, onClose, onOpen }) => {
  useEffect(() => {
    if (!n) return;
    const t = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(t);
  }, [n, onClose]);
  return (
    <AnimatePresence>
      {n && (
        <motion.button
          type="button"
          onClick={() => (onOpen(n), onClose())}
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] w-[min(94vw,420px)] text-left flex items-start gap-3 p-3.5 rounded-[20px] shadow-2xl"
          style={{ background: "#16181D", color: "#fff", boxShadow: "0 18px 50px -12px rgba(91,63,228,0.6)" }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: TONE[n.kind] || "#5B3FE4" }}>
            {ICON[n.kind] || <Bell className="w-4 h-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{n.title}</span>
            {n.body && <span className="block text-[12px] text-white/70 line-clamp-2">{n.body}</span>}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
