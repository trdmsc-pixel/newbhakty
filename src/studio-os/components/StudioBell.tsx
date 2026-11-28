/**
 * Studio OS bell — a pop-out panel listing every client update from the portal
 * (approvals, change requests, comments, uploads, messages, tasks), like the portal's bell.
 * Clicking an item lands on the exact project tab + item.
 */
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bell, BellOff, CheckCircle2, FileUp, GitPullRequestArrow, ListChecks, MessageSquare, MessagesSquare, RotateCcw } from "lucide-react";
import { useClientPulse, useOpenUpdate } from "./ClientPulse";

const META: Record<string, { icon: React.ReactNode; color: string }> = {
  portal_approval: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#16A34A" },
  portal_changes: { icon: <RotateCcw className="w-3.5 h-3.5" />, color: "#DC2626" },
  portal_changes_over: { icon: <RotateCcw className="w-3.5 h-3.5" />, color: "#B42318" },
  portal_message: { icon: <MessagesSquare className="w-3.5 h-3.5" />, color: "#5B3FE4" },
  portal_upload: { icon: <FileUp className="w-3.5 h-3.5" />, color: "#0891B2" },
  portal_comment: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: "#E11D48" },
  portal_change_request: { icon: <GitPullRequestArrow className="w-3.5 h-3.5" />, color: "#D97706" },
  portal_task: { icon: <ListChecks className="w-3.5 h-3.5" />, color: "#0EA5E9" },
};

export const StudioBell: React.FC = () => {
  const { updates, unread, markAllRead, soundOn, setSoundOn } = useClientPulse();
  const openUpdate = useOpenUpdate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center border"
        style={{ borderColor: unread ? "#B42318" : "var(--sos-border)", color: unread ? "#B42318" : "var(--sos-text-2)" }}
        aria-label={unread ? `${unread} new client updates` : "Notifications"}
        aria-expanded={open}
      >
        <Bell className={`w-4 h-4 ${unread ? "sos-ring-bell" : ""}`} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B42318] text-white text-[10px] font-bold flex items-center justify-center sos-pulse-badge">{unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{ transformOrigin: "top right" }}
            className="sos-pop-panel absolute right-0 top-11 z-50 w-[min(92vw,400px)] rounded-[22px] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--sos-border)" }}>
              <p className="text-[15px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Client updates {unread > 0 && <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#B42318] text-white">{unread} new</span>}
              </p>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSoundOn(!soundOn)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={soundOn ? "Mute chime" : "Turn chime on"}>
                  {soundOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                {unread > 0 && (
                  <button type="button" onClick={markAllRead} className="h-8 px-2.5 rounded-full text-[12px] font-semibold" style={{ color: "var(--sos-primary)" }}>
                    Mark all read
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain p-1.5">
              {!updates.length && <p className="text-[13px] text-center py-10" style={{ color: "var(--sos-text-3)" }}>All calm — nothing from clients in the last 14 days.</p>}
              {updates.map((u, i) => {
                const m = META[u.kind] || META.portal_message;
                return (
                  <motion.button
                    key={u.id}
                    type="button"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.02 }}
                    onClick={() => {
                      setOpen(false);
                      openUpdate(u);
                    }}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-[16px] transition-colors hover:bg-[var(--sos-surface-2)]"
                    style={u.read_at ? undefined : { background: "var(--sos-violet-soft)" }}
                  >
                    <span className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: m.color }}>{m.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>{u.title}</span>
                      {u.body && <span className="block text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--sos-text-2)" }}>{u.body}</span>}
                      <span className="block text-[11px] mt-1" style={{ color: "var(--sos-text-3)" }}>{formatDistanceToNowStrict(parseISO(u.created_at), { addSuffix: true })}</span>
                    </span>
                    {!u.read_at && <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: "#B42318" }} />}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
