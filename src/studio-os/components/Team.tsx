import React, { useEffect, useMemo, useRef, useState } from "react";
import { endOfWeek, parseISO, startOfWeek } from "date-fns";
import { Check, Loader2, Lock, UserPlus, Users, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useStudioOS } from "../StudioOSContext";
import { StackedAvatars } from "./StatusChip";
import { StudioMember, StudioProject } from "../types";

export const ROLE_LABEL: Record<StudioMember["role"], string> = {
  owner: "Owner",
  producer: "Producer",
  artist: "Artist",
  editor: "Editor",
  music: "Music",
};

const toAvatar = (m: StudioMember) => ({ initials: m.initials, color: m.color, name: m.name });

/** Stacked avatars for a set of member ids (-10px overlap, 2px ring, +N bubble). */
export const MemberStack: React.FC<{ memberIds: Array<string | undefined | null>; size?: number; max?: number }> = ({ memberIds, size = 28 }) => {
  const { members } = useStudioOS();
  const items = useMemo(() => {
    const ids = [...new Set(memberIds.filter(Boolean) as string[])];
    return ids.map((id) => members.find((m) => m.id === id)).filter(Boolean).map((m) => toAvatar(m as StudioMember));
  }, [memberIds, members]);
  if (!items.length) return null;
  return <StackedAvatars items={items} size={size} />;
};

/** Compact assignee picker used on Board cards, Table rows and Quick Add. */
export const AssigneePicker: React.FC<{
  value?: string | null;
  onChange: (memberId: string) => void;
  size?: number;
  disabled?: boolean;
  label?: string;
}> = ({ value, onChange, size = 28, disabled, label = "Assign" }) => {
  const { members } = useStudioOS();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = members.filter((m) => m.is_active);
  const current = members.find((m) => m.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="min-w-[44px] min-h-[44px] -m-2 p-2 inline-flex items-center justify-center rounded-full disabled:cursor-default"
        aria-label={current ? `Assigned to ${current.name}. Change assignee` : label}
        title={current ? current.name : label}
      >
        {current ? (
          <StackedAvatars items={[toAvatar(current)]} size={size} />
        ) : (
          <span
            className="rounded-full border-2 border-dashed flex items-center justify-center"
            style={{ width: size, height: size, borderColor: "var(--sos-border)", color: "var(--sos-text-3)" }}
          >
            <UserPlus className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute z-40 top-full left-0 mt-1 w-56 p-1.5 rounded-[16px] border shadow-xl"
          style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }}
          role="listbox"
        >
          {active.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m.id === value}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-2.5 rounded-[12px] text-left hover:bg-[var(--sos-surface-2)]"
            >
              <StackedAvatars items={[toAvatar(m)]} size={26} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                  {m.name}
                </span>
                <span className="block text-[11px]" style={{ color: "var(--sos-text-3)" }}>
                  {ROLE_LABEL[m.role]}
                </span>
              </span>
              {m.id === value && <Check className="w-4 h-4" style={{ color: "var(--sos-primary)" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Owner-only: assign members to a project (+ explicit confidential grant). */
export const AssignMembersModal: React.FC<{ project: StudioProject; onClose: () => void }> = ({ project, onClose }) => {
  const { members, clients, pushToast, reloadFromCloud } = useStudioOS();
  const [rows, setRows] = useState<Array<{ member_id: string; can_view_confidential: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const client = clients.find((c) => c.id === project.client_id);
  const confidential = project.is_confidential || Boolean(client?.is_confidential);
  const team = members.filter((m) => m.is_active && m.role !== "owner");

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("studio_project_members").select("member_id, can_view_confidential").eq("project_id", project.id);
    setRows((data || []) as any);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const toggle = async (memberId: string) => {
    if (!supabase) return;
    setBusy(memberId);
    const assigned = rows.some((r) => r.member_id === memberId);
    const { error } = assigned
      ? await supabase.from("studio_project_members").delete().eq("project_id", project.id).eq("member_id", memberId)
      : await supabase.from("studio_project_members").insert({ project_id: project.id, member_id: memberId });
    setBusy(null);
    if (error) return pushToast(error.message, "warn");
    await load();
    reloadFromCloud();
  };

  const toggleGrant = async (memberId: string, value: boolean) => {
    if (!supabase) return;
    setBusy(memberId);
    await supabase.from("studio_project_members").update({ can_view_confidential: value }).eq("project_id", project.id).eq("member_id", memberId);
    setBusy(null);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 md:p-4" onClick={onClose}>
      <div className="w-full md:max-w-md rounded-t-[28px] md:rounded-[28px] p-6 shadow-2xl border space-y-4" style={{ background: "var(--sos-surface)", borderColor: "var(--sos-border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Project team · {project.code}
            </h3>
            <p className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
              Members only see projects they're assigned to. Fees and invoices stay owner-only.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {confidential && (
          <p className="text-[12px] px-3 py-2 rounded-[12px] inline-flex items-center gap-1.5" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
            <Lock className="w-3.5 h-3.5" /> Confidential — assigned members also need “Can view” to open it.
          </p>
        )}
        {loading ? (
          <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Loading…</p>
        ) : team.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
            No team members yet — add them in Settings → Team.
          </p>
        ) : (
          <div className="space-y-1.5">
            {team.map((m) => {
              const row = rows.find((r) => r.member_id === m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-3 min-h-[52px] rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
                  <StackedAvatars items={[toAvatar(m)]} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{m.name}</p>
                    <p className="text-[11px]" style={{ color: "var(--sos-text-3)" }}>{ROLE_LABEL[m.role]}</p>
                  </div>
                  {row && confidential && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-medium min-h-[44px]" style={{ color: "var(--sos-text-2)" }}>
                      <input type="checkbox" checked={row.can_view_confidential} onChange={(e) => toggleGrant(m.id, e.target.checked)} className="w-4 h-4 accent-[#5B3FE4]" />
                      Can view
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => toggle(m.id)}
                    className="min-h-[44px] px-3.5 rounded-full text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                    style={row ? { background: "var(--sos-ink)", color: "var(--sos-ink-text)" } : { background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                  >
                    {busy === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : row ? <Check className="w-3.5 h-3.5" /> : null}
                    {row ? "Assigned" : "Assign"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/** Team Load: this week's planned hours vs weekly capacity per active member. */
export const TeamLoadCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { members, tasks, settings } = useStudioOS();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const rows = members
    .filter((m) => m.is_active)
    .map((m) => {
      const planned = tasks
        .filter((t) => t.assignee_member_id === m.id && t.status !== "done" && t.status !== "backlog")
        .filter((t) => {
          const d = t.do_date || (t.due_date ? t.due_date.slice(0, 10) : undefined);
          if (!d) return t.is_in_now;
          const date = parseISO(d);
          return date <= weekEnd; // overdue work counts against this week
        })
        .reduce((sum, t) => sum + Math.max(0, (t.estimate_hours || 0) - (t.actual_hours || 0)), 0);
      const capacity = (m.hourly_capacity || settings.work_hours_per_day || 7) * 5;
      return { m, planned: Math.round(planned * 10) / 10, capacity, pct: capacity ? planned / capacity : 0 };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <section className="sos-card p-5 md:p-6 space-y-4" aria-label="Team load this week">
      <div className="flex items-center justify-between">
        <h2 className="sos-display text-[18px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
          <Users className="w-4 h-4" style={{ color: "var(--sos-primary)" }} /> Team load
        </h2>
        <span className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
          {weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {weekEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>
      <div className={compact ? "space-y-2.5" : "space-y-3"}>
        {rows.map(({ m, planned, capacity, pct }) => {
          const over = pct > 1;
          const tone = over ? "var(--sos-amber)" : pct > 0.85 ? "var(--sos-blue)" : "var(--sos-green)";
          return (
            <div key={m.id} className="flex items-center gap-3">
              <StackedAvatars items={[toAvatar(m)]} size={compact ? 26 : 30} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{m.name}</span>
                  <span className="sos-tabular shrink-0" style={{ color: over ? "#B45309" : "var(--sos-text-2)" }}>
                    {planned}h / {capacity}h
                  </span>
                </div>
                <div className="h-2 mt-1 rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.name} load`}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: tone }} />
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No active members.</p>
        )}
      </div>
    </section>
  );
};
