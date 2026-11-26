/**
 * Client portal extras: navigation tabs, the always-visible India studio clock,
 * a holiday calendar, messages to the studio and account settings.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clapperboard, KeyRound, Loader2, LogOut, MessageSquare, Send, UserRound } from "lucide-react";
import { supabase } from "./portalSupabase";

export type PortalTab = "projects" | "calendar" | "messages" | "account";
const EASE = [0.22, 1, 0.36, 1] as const;

export interface StudioInfo {
  timezone: string;
  opens_at: string;
  closes_at: string;
  work_days: number[];
  holidays: Array<{ date: string; name: string }>;
}

const DEFAULT_INFO: StudioInfo = { timezone: "Asia/Kolkata", opens_at: "10:00", closes_at: "21:30", work_days: [1, 2, 3, 4, 5, 6], holidays: [] };

export function useStudioInfo() {
  const [info, setInfo] = useState<StudioInfo>(DEFAULT_INFO);
  useEffect(() => {
    if (!supabase) return;
    supabase.rpc("portal_studio_info").then(({ data }) => {
      if (data) setInfo({ ...DEFAULT_INFO, ...(data as StudioInfo), holidays: (data as StudioInfo).holidays || [] });
    });
  }, []);
  return info;
}

// ---- Time-zone helpers -------------------------------------------------------
function partsIn(tz: string, d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  const iso = `${p.year}-${p.month}-${p.day}`;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) + 1;
  return { iso, hour, minute: Number(p.minute), second: Number(p.second), dow };
}
function offsetMinutes(tz: string, d: Date) {
  const p = partsIn(tz, d);
  const [y, m, day] = p.iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, day, p.hour, p.minute) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const addDaysIso = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
const dowOfIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
};
const prettyIso = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
};
const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export interface StudioStatus {
  open: boolean;
  label: string;
  detail: string;
  tone: "open" | "closed" | "holiday";
}

export function studioStatus(info: StudioInfo, now: Date): StudioStatus {
  const p = partsIn(info.timezone, now);
  const holidayOn = (iso: string) => info.holidays.find((h) => h.date === iso);
  const working = (iso: string) => info.work_days.includes(dowOfIso(iso)) && !holidayOn(iso);
  const nextOpen = (fromIso: string) => {
    for (let i = 1; i <= 21; i++) {
      const iso = addDaysIso(fromIso, i);
      if (working(iso)) return `${i === 1 ? "tomorrow" : prettyIso(iso)} at ${fmt12(info.opens_at)}`;
    }
    return "soon";
  };
  const mins = p.hour * 60 + p.minute;
  const h = holidayOn(p.iso);
  if (h) return { open: false, label: `Closed · ${h.name}`, detail: `Back ${nextOpen(p.iso)} IST`, tone: "holiday" };
  if (!info.work_days.includes(p.dow)) return { open: false, label: "Closed · Weekend", detail: `Back ${nextOpen(p.iso)} IST`, tone: "closed" };
  if (mins < toMin(info.opens_at)) return { open: false, label: "Opens soon", detail: `Today at ${fmt12(info.opens_at)} IST`, tone: "closed" };
  if (mins >= toMin(info.closes_at)) return { open: false, label: "Closed for the day", detail: `Opens ${nextOpen(p.iso)} IST`, tone: "closed" };
  return { open: true, label: "Studio open now", detail: `Until ${fmt12(info.closes_at)} IST`, tone: "open" };
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// ---- Studio clock (always visible) -------------------------------------------
export const StudioClock: React.FC<{ info: StudioInfo; compact?: boolean; onOpenCalendar?: () => void }> = ({ info, compact, onOpenCalendar }) => {
  const now = useNow(1000);
  const reduce = useReducedMotion();
  const p = partsIn(info.timezone, now);
  const status = studioStatus(info, now);
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const diff = offsetMinutes(info.timezone, now) - offsetMinutes(localTz, now);
  const sameZone = diff === 0;
  const diffLabel = sameZone ? "Same time as you" : `${Math.abs(diff) / 60 >= 1 ? `${Math.floor(Math.abs(diff) / 60)}h` : ""}${Math.abs(diff) % 60 ? ` ${Math.abs(diff) % 60}m` : ""} ${diff > 0 ? "ahead of" : "behind"} you`.trim();
  const nextHoliday = info.holidays.find((h) => h.date > p.iso);
  const color = status.tone === "open" ? "var(--sos-ok-text)" : status.tone === "holiday" ? "var(--sos-danger-text)" : "var(--sos-warn-text)";
  const bg = status.tone === "open" ? "var(--sos-ok-bg)" : status.tone === "holiday" ? "var(--sos-danger-bg)" : "var(--sos-warn-bg)";
  const hh = String(((p.hour + 11) % 12) + 1);
  const mm = String(p.minute).padStart(2, "0");
  const ss = String(p.second).padStart(2, "0");

  if (compact) {
    return (
      <button type="button" onClick={onOpenCalendar} className="w-full sos-card px-4 py-3 flex items-center gap-3 text-left">
        <span className="relative w-2.5 h-2.5 shrink-0">
          <span className="absolute inset-0 rounded-full" style={{ background: color }} />
          {status.open && !reduce && <motion.span className="absolute inset-0 rounded-full" style={{ background: color }} animate={{ scale: [1, 2.2], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold" style={{ color }}>{status.label}</span>
          <span className="block text-[11px] truncate" style={{ color: "var(--sos-text-3)" }}>{status.detail}</span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[15px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
            {hh}:{mm} <span className="text-[11px]">{p.hour < 12 ? "am" : "pm"}</span>
          </span>
          <span className="block text-[10px]" style={{ color: "var(--sos-text-3)" }}>India · {prettyIso(p.iso, { weekday: "short", day: "numeric", month: "short" })}</span>
        </span>
      </button>
    );
  }

  return (
    <div className="sos-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--sos-text-3)" }}>Time in India</p>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}>IST · UTC+5:30</span>
      </div>
      <div>
        <p className="sos-display font-semibold tracking-[-0.03em] leading-none sos-tabular" style={{ color: "var(--sos-text-1)" }}>
          <span className="text-[44px]">{hh}:{mm}</span>
          <span className="text-[20px] ml-1" style={{ color: "var(--sos-text-3)" }}>:{ss}</span>
          <span className="text-[16px] ml-1.5 font-medium" style={{ color: "var(--sos-text-3)" }}>{p.hour < 12 ? "am" : "pm"}</span>
        </p>
        <p className="text-[14px] mt-1.5 font-medium" style={{ color: "var(--sos-text-2)" }}>
          {prettyIso(p.iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <motion.div key={status.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }} className="flex items-center gap-2.5 px-3.5 py-3 rounded-[16px]" style={{ background: bg }}>
        <span className="relative w-2.5 h-2.5 shrink-0">
          <span className="absolute inset-0 rounded-full" style={{ background: color }} />
          {status.open && !reduce && <motion.span className="absolute inset-0 rounded-full" style={{ background: color }} animate={{ scale: [1, 2.4], opacity: [0.55, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold" style={{ color }}>{status.label}</span>
          <span className="block text-[12px]" style={{ color }}>{status.detail}</span>
        </span>
      </motion.div>
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="p-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
          <p style={{ color: "var(--sos-text-3)" }}>Studio hours</p>
          <p className="font-semibold" style={{ color: "var(--sos-text-1)" }}>{fmt12(info.opens_at)} – {fmt12(info.closes_at)}</p>
          <p style={{ color: "var(--sos-text-3)" }}>{info.work_days.length === 6 && !info.work_days.includes(7) ? "Mon – Sat" : info.work_days.length === 5 && !info.work_days.includes(6) ? "Mon – Fri" : `${info.work_days.length} days a week`}</p>
        </div>
        <div className="p-3 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
          <p style={{ color: "var(--sos-text-3)" }}>Your time</p>
          <p className="font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          <p className="truncate" style={{ color: "var(--sos-text-3)" }} title={localTz}>{diffLabel}</p>
        </div>
      </div>
      {nextHoliday && (
        <button type="button" onClick={onOpenCalendar} className="w-full flex items-center gap-2.5 text-left p-3 rounded-[14px] border" style={{ borderColor: "var(--sos-border)" }}>
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: "var(--sos-primary)" }} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px]" style={{ color: "var(--sos-text-3)" }}>Next studio holiday</span>
            <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{nextHoliday.name} · {prettyIso(nextHoliday.date)}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--sos-text-3)" }} />
        </button>
      )}
    </div>
  );
};

// ---- Tabs ----------------------------------------------------------------------
export const PortalNav: React.FC<{ tab: PortalTab; onTab: (t: PortalTab) => void; unread: number; awaiting: number }> = ({ tab, onTab, unread, awaiting }) => {
  const items: Array<{ id: PortalTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "projects", label: "Projects", icon: <Clapperboard className="w-4 h-4" />, badge: awaiting },
    { id: "calendar", label: "Calendar", icon: <CalendarDays className="w-4 h-4" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="w-4 h-4" />, badge: unread },
    { id: "account", label: "Account", icon: <UserRound className="w-4 h-4" /> },
  ];
  return (
    <nav className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--sos-canvas) 80%, transparent)" }} aria-label="Portal sections">
      <div className="flex gap-1 p-1 rounded-full overflow-x-auto no-scrollbar" style={{ background: "var(--sos-surface)", border: "1px solid var(--sos-border)", boxShadow: "var(--sos-shadow)" }} role="tablist">
        {items.map((it) => {
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(it.id)}
              className="relative flex-1 min-w-[84px] h-10 px-3 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"
              style={{ color: active ? "var(--sos-ink-text)" : "var(--sos-text-2)" }}
            >
              {active && <motion.span layoutId="portal-tab-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--sos-ink)" }} transition={{ duration: 0.24, ease: EASE }} />}
              <span className="relative z-[1] inline-flex items-center gap-1.5">
                {it.icon}
                <span>{it.label}</span>
                {it.badge ? <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#B42318] text-white text-[10px] font-bold flex items-center justify-center">{it.badge}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// ---- Calendar ------------------------------------------------------------------
export const CalendarTab: React.FC<{ info: StudioInfo }> = ({ info }) => {
  const now = useNow(60_000);
  const todayIso = partsIn(info.timezone, now).iso;
  const [ym, setYm] = useState(() => todayIso.slice(0, 7));
  const [dir, setDir] = useState(0);
  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = dowOfIso(first) - 1;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  const holidayMap = new Map(info.holidays.map((h) => [h.date, h.name]));
  const shift = (n: number) => {
    setDir(n);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setYm(d.toISOString().slice(0, 7));
  };
  const upcoming = info.holidays.filter((h) => h.date >= todayIso).slice(0, 8);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>Studio calendar</h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>When the studio is working, and the holidays when it's closed (India time).</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-5 items-start">
        <div className="sos-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => shift(-1)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={ym} initial={{ opacity: 0, y: dir * 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -dir * 6 }} transition={{ duration: 0.18 }} className="sos-display text-[18px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                {monthLabel}
              </motion.p>
            </AnimatePresence>
            <button type="button" onClick={() => shift(1)} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }} aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold mb-1" style={{ color: "var(--sos-text-3)" }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={ym} initial={{ opacity: 0, x: dir * 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -dir * 16 }} transition={{ duration: 0.2, ease: EASE }} className="grid grid-cols-7 gap-1">
              {cells.map((iso, i) => {
                if (!iso) return <span key={`e${i}`} />;
                const holiday = holidayMap.get(iso);
                const off = !info.work_days.includes(dowOfIso(iso));
                const today = iso === todayIso;
                return (
                  <div
                    key={iso}
                    title={holiday || (off ? "Studio closed (weekend)" : "Working day")}
                    className="aspect-square rounded-[12px] p-1 flex flex-col items-center justify-start text-[13px] relative"
                    style={{
                      background: holiday ? "var(--sos-danger-bg)" : off ? "var(--sos-surface-2)" : "transparent",
                      color: holiday ? "var(--sos-danger-text)" : off ? "var(--sos-text-3)" : "var(--sos-text-1)",
                      boxShadow: today ? "inset 0 0 0 2px var(--sos-primary)" : undefined,
                      fontWeight: today ? 700 : 500,
                    }}
                  >
                    <span className="sos-tabular">{Number(iso.slice(8))}</span>
                    {holiday && <span className="hidden sm:block text-[9px] leading-tight mt-0.5 line-clamp-2 text-center">{holiday}</span>}
                    {holiday && <span className="sm:hidden w-1 h-1 rounded-full mt-0.5" style={{ background: "var(--sos-danger-text)" }} />}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
          <div className="flex flex-wrap gap-3 mt-4 text-[11px]" style={{ color: "var(--sos-text-3)" }}>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "var(--sos-danger-bg)" }} /> Holiday (closed)</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "var(--sos-surface-2)" }} /> Weekend</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ boxShadow: "inset 0 0 0 2px var(--sos-primary)" }} /> Today in India</span>
          </div>
        </div>
        <div className="sos-card p-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--sos-text-3)" }}>Upcoming closures</p>
          {upcoming.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No holidays scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((h) => (
                <li key={h.date} className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-[12px] flex flex-col items-center justify-center shrink-0" style={{ background: "var(--sos-danger-bg)", color: "var(--sos-danger-text)" }}>
                    <span className="text-[9px] font-bold uppercase">{prettyIso(h.date, { month: "short" })}</span>
                    <span className="text-[15px] font-bold leading-none">{Number(h.date.slice(8))}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{h.name}</span>
                    <span className="block text-[11px]" style={{ color: "var(--sos-text-3)" }}>{prettyIso(h.date, { weekday: "long" })}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// ---- Messages ------------------------------------------------------------------
interface Msg {
  id: string;
  project_id: string | null;
  body: string;
  from_studio: boolean;
  author_name: string | null;
  created_at: string;
  read_by_client_at: string | null;
}

export function usePortalMessages(enabled: boolean) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const load = useCallback(async () => {
    if (!supabase || !enabled) return;
    const { data } = await supabase.from("portal_messages").select("*").order("created_at", { ascending: true }).limit(300);
    setMessages((data || []) as Msg[]);
  }, [enabled]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);
  const unread = messages.filter((m) => m.from_studio && !m.read_by_client_at).length;
  return { messages, unread, reload: load };
}

export const MessagesTab: React.FC<{ messages: Msg[]; reload: () => void; projects: Array<{ id: string; title: string }>; info: StudioInfo }> = ({ messages, reload, projects, info }) => {
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const status = studioStatus(info, new Date());

  useEffect(() => {
    const t = setInterval(reload, 12_000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages.some((m) => m.from_studio && !m.read_by_client_at)) supabase?.rpc("portal_mark_messages_read").then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const send = async () => {
    if (!supabase || !text.trim()) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("portal_send_message", { p_body: text.trim(), p_project_id: projectId || null });
    setBusy(false);
    if (err) return setError(err.message.includes("rate_limited") ? "That's a lot of messages — please wait a little and try again." : "Couldn't send. Please try again.");
    setText("");
    reload();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>Messages</h1>
        <p className="text-[14px]" style={{ color: "var(--sos-text-2)" }}>
          Write to the studio anytime. {status.open ? "The studio is open now — expect a reply soon." : `The studio is closed right now (${status.detail.replace(/^Back |^Opens /, "back ")}); we'll reply when we're in.`}
        </p>
      </div>
      <div className="sos-card p-4 md:p-5 space-y-4">
        <div className="max-h-[52vh] min-h-[200px] overflow-y-auto space-y-2.5 pr-1">
          {messages.length === 0 && (
            <div className="h-[200px] flex flex-col items-center justify-center text-center gap-2" style={{ color: "var(--sos-text-3)" }}>
              <MessageSquare className="w-6 h-6" />
              <p className="text-[14px]">No messages yet. Say hello, ask a question, or share a thought.</p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => {
              const proj = projects.find((p) => p.id === m.project_id);
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }} className={`flex ${m.from_studio ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-[18px] text-[14px] ${m.from_studio ? "rounded-bl-[6px]" : "rounded-br-[6px] text-white"}`}
                    style={m.from_studio ? { background: "var(--sos-surface-2)", color: "var(--sos-text-1)" } : { background: "var(--sos-primary)" }}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${m.from_studio ? "" : "text-white/75"}`} style={m.from_studio ? { color: "var(--sos-text-3)" } : undefined}>
                      {m.from_studio ? "The Chanting Studio" : "You"}
                      {proj ? ` · ${proj.title}` : ""} · {new Date(m.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
        <div className="space-y-2">
          {projects.length > 0 && (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-10 px-3 rounded-[12px] border text-[13px] max-w-full" style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }} aria-label="About which project">
              <option value="">General message</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>About: {p.title}</option>
              ))}
            </select>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
              }}
              rows={2}
              placeholder="Write a message to the studio…"
              className="flex-1 px-4 py-3 rounded-[16px] border text-[14px] resize-none"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
              aria-label="Message"
            />
            <button type="button" disabled={busy || !text.trim()} onClick={send} className="w-12 h-12 rounded-full flex items-center justify-center text-white disabled:opacity-40 shrink-0" style={{ background: "var(--sos-primary)" }} aria-label="Send">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-[13px] px-3.5 py-2.5 rounded-[12px]" style={{ background: "var(--sos-danger-bg)", color: "var(--sos-danger-text)" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

// ---- Account -------------------------------------------------------------------
export const AccountTab: React.FC<{ name?: string; organisation?: string; loginId?: string; onSignOut: () => void }> = ({ name, organisation, loginId, onSignOut }) => {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email || null));
  }, []);
  const realEmail = email && !email.endsWith("@clients.thechantingstudio.in") ? email : null;
  const field = "w-full h-12 px-4 rounded-[14px] border text-[15px]";
  const fieldStyle = { background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-1)" };

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The new passwords don't match." });
    if (!supabase || !email) return;
    setBusy(true);
    const check = await supabase.auth.signInWithPassword({ email, password: cur });
    if (check.error) {
      setBusy(false);
      return setMsg({ ok: false, text: "Your current password isn't right." });
    }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /different/i.test(error.message) ? "Choose a password different from your current one." : error.message });
    setCur("");
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Password updated." });
  };

  return (
    <div className="space-y-5">
      <h1 className="sos-display text-[28px] font-semibold tracking-[-0.02em]" style={{ color: "var(--sos-text-1)" }}>Account</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <div className="sos-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-bold" style={{ background: "var(--sos-primary)" }}>
              {(name || "C").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{name || "Client"}</p>
              <p className="text-[13px] truncate" style={{ color: "var(--sos-text-3)" }}>{organisation}</p>
            </div>
          </div>
          {loginId && (
            <div className="p-3.5 rounded-[14px]" style={{ background: "var(--sos-surface-2)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--sos-text-3)" }}>Client ID (your username)</p>
              <p className="text-[17px] font-semibold" style={{ color: "var(--sos-text-1)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{loginId}</p>
            </div>
          )}
          {realEmail && (
            <p className="text-[13px]" style={{ color: "var(--sos-text-2)" }}>
              You can also sign in with <strong>{realEmail}</strong>.
            </p>
          )}
          <button type="button" onClick={onSignOut} className="sos-pill-btn h-11 px-5 text-[14px] font-medium border inline-flex items-center gap-2" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}>
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
        <form onSubmit={change} className="sos-card p-5 space-y-3">
          <p className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--sos-text-1)" }}>
            <KeyRound className="w-4 h-4" /> Change password
          </p>
          <input type="text" name="username" autoComplete="username" value={loginId || email || ""} readOnly hidden />
          <input type="password" required autoComplete="current-password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} className={field} style={fieldStyle} aria-label="Current password" />
          <input type="password" required autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} className={field} style={fieldStyle} aria-label="New password" />
          <input type="password" required autoComplete="new-password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={field} style={fieldStyle} aria-label="Repeat new password" />
          {msg && (
            <p className="text-[13px] px-3.5 py-2.5 rounded-[12px] inline-flex items-center gap-1.5" style={msg.ok ? { background: "var(--sos-ok-bg)", color: "var(--sos-ok-text)" } : { background: "var(--sos-danger-bg)", color: "var(--sos-danger-text)" }} role="status">
              {msg.ok && <Check className="w-4 h-4" />} {msg.text}
            </p>
          )}
          <button type="submit" disabled={busy} className="sos-pill-btn w-full h-12 text-[15px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--sos-primary)" }}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Update password
          </button>
        </form>
      </div>
    </div>
  );
};

export const useIsLarge = () => {
  const [lg, setLg] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setLg(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return lg;
};

export const useMemoProjects = (projects: Array<{ id: string; title: string }>) => useMemo(() => projects.map((p) => ({ id: p.id, title: p.title })), [projects]);
