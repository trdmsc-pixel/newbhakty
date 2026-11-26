import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { TaskStatus } from "../types";
import { TaskStatusChip } from "./StatusChip";
import { EASE } from "../motion";

export const TASK_STATUS_ORDER: Array<{ id: TaskStatus; hint: string }> = [
  { id: "backlog", hint: "Not planned yet" },
  { id: "todo", hint: "Planned, not started" },
  { id: "in_progress", hint: "Being worked on" },
  { id: "waiting_on_client", hint: "Ball is with the client" },
  { id: "in_review", hint: "Internal review" },
  { id: "revising", hint: "Changes in progress" },
  { id: "done", hint: "Finished" },
];

/**
 * Explicit status picker: clicking opens a menu; nothing changes until you choose.
 * The menu is portalled into .studio-os-root so it isn't clipped by scroll areas.
 */
export const TaskStatusSelect: React.FC<{
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
  compact?: boolean;
  label?: string;
}> = ({ status, onChange, compact, label = "Change status" }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuH = 7 * 44 + 16;
    const up = r.bottom + menuH > window.innerHeight - 8 && r.top > menuH;
    setPos({ top: up ? r.top - menuH - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 248), up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const root = typeof document !== "undefined" ? (document.querySelector(".studio-os-root") as HTMLElement | null) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 rounded-full min-h-[32px] hover:opacity-90"
      >
        <TaskStatusChip status={status} compact={compact} />
        <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--sos-text-3)" }} />
      </button>
      {root &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                role="listbox"
                aria-label="Task status"
                initial={{ opacity: 0, y: pos.up ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16, ease: EASE }}
                className="fixed z-[60] w-60 p-1.5 rounded-[16px] border shadow-xl"
                style={{ top: pos.top, left: pos.left, background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {TASK_STATUS_ORDER.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={s.id === status}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      if (s.id !== status) onChange(s.id);
                    }}
                    className="w-full min-h-[44px] px-2.5 rounded-[12px] flex items-center justify-between gap-2 text-left hover:bg-[var(--sos-surface-2)]"
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <TaskStatusChip status={s.id} compact />
                      <span className="text-[11px] pl-1" style={{ color: "var(--sos-text-3)" }}>{s.hint}</span>
                    </span>
                    {s.id === status && <Check className="w-4 h-4 shrink-0" style={{ color: "var(--sos-primary)" }} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          root
        )}
    </>
  );
};
