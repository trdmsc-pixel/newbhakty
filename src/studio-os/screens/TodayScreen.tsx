/**
 * Today — one calm, ranked view of the day.
 * 1. Client updates (live from the portal; chime + glow; only when new)
 * 2. Now (WIP-limited) with a slim focus timer
 * 3. Up next — one smart queue: client changes → overdue → replies owed →
 *    promises due → due today → urgent
 * Side: deadlines, waiting on clients, 7-day load.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowRight, Bell, BellOff, Check, Copy, Hourglass, MessageSquare, Moon, Pause, Play, Plus, RotateCcw, Square } from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { generateBriefSummary } from "../forecastEngine";
import { TaskStatusSelect } from "../components/TaskStatusSelect";
import { TeamLoadCard } from "../components/Team";
import { AIBriefCard } from "../components/AIBriefCard";
import { CLIENT_FOCUS_KEY, useClientPulse } from "../components/ClientPulse";
import { BreathingRing, CompleteCheck, EASE, SwipeRow, TickDigits } from "../motion";
import type { StudioTask } from "../types";

type QueueTag = "client" | "overdue" | "reply" | "promise" | "today" | "urgent";
const TAG: Record<QueueTag, { label: string; bg: string; fg: string; rank: number }> = {
  client: { label: "Client change", bg: "#FDECEC", fg: "#B42318", rank: 0 },
  overdue: { label: "Overdue", bg: "#FDECEC", fg: "#B42318", rank: 1 },
  reply: { label: "Reply owed", bg: "#EAF1FF", fg: "#1D4FD8", rank: 2 },
  promise: { label: "Promise", bg: "#FFF3E0", fg: "#9A4A00", rank: 3 },
  today: { label: "Due today", bg: "var(--sos-violet-soft)", fg: "var(--sos-primary)", rank: 4 },
  urgent: { label: "Urgent", bg: "#FFF3E0", fg: "#9A4A00", rank: 5 },
};

const Card: React.FC<{ title: string; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, right, className, children }) => (
  <section className={`sos-card p-5 md:p-6 ${className || ""}`}>
    <div className="flex items-center justify-between gap-2 mb-4">
      <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
        {title}
      </h2>
      {right}
    </div>
    {children}
  </section>
);

const Count: React.FC<{ n: number; tone?: "red" | "plain" }> = ({ n, tone = "plain" }) => (
  <span
    className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full sos-tabular"
    style={tone === "red" && n ? { background: "#FDECEC", color: "#B42318" } : { background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
  >
    {n}
  </span>
);

export const TodayScreen: React.FC = () => {
  const {
    tasks,
    projects,
    gates,
    clients,
    holidays,
    settings,
    toggleTaskDone,
    toggleTaskInNow,
    moveTaskToNextWeek,
    setQuickAddOpen,
    setEveningShutdownOpen,
    openProject,
    activeTimerTaskId,
    timerRunning,
    timerSeconds,
    startTimerForTask,
    toggleTimer,
    resetTimer,
    stopTimer,
    pushToast,
    updateTask,
    setRoute,
  } = useStudioOS();
  const { updates, unread, markRead, markAllRead, soundOn, setSoundOn } = useClientPulse();
  const [now, setNow] = useState(() => new Date());
  const [showAll, setShowAll] = useState(false);

  // Keep relative times and the closing countdown fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const todayIso = format(now, "yyyy-MM-dd");
  const projectOf = (id?: string) => projects.find((p) => p.id === id);

  // ---- Now -----------------------------------------------------------------
  const nowTasks = useMemo(() => tasks.filter((t) => t.is_in_now && t.status !== "done").slice(0, settings.wip_limit), [tasks, settings.wip_limit]);
  const nowFull = nowTasks.length >= settings.wip_limit;

  // ---- Up next: one ranked queue --------------------------------------------
  const queue = useMemo(() => {
    const items: Array<{ task: StudioTask; tag: QueueTag; note: string }> = [];
    for (const t of tasks) {
      if (t.status === "done" || t.is_in_now) continue;
      const due = t.due_date ? t.due_date.slice(0, 10) : null;
      const dueDays = due ? differenceInCalendarDays(parseISO(due), now) : null;
      const age = Math.max(1, differenceInCalendarDays(now, parseISO(t.created_at)));
      let tag: QueueTag | null = null;
      let note = "";
      if (t.source === "portal" && t.status !== "waiting_on_client") {
        tag = "client";
        note = t.promised_to_name ? `from ${t.promised_to_name}` : "from the portal";
      } else if (dueDays !== null && dueDays < 0 && t.status !== "waiting_on_client") {
        tag = "overdue";
        note = `${Math.abs(dueDays)}d late`;
      } else if (t.type === "reply_owed") {
        tag = "reply";
        note = `${t.promised_to_name || "Client"} · ${age}d`;
      } else if (t.type === "promise" && dueDays !== null && dueDays <= 2) {
        tag = "promise";
        note = `to ${t.promised_to_name || "client"} · ${dueDays === 0 ? "today" : dueDays === 1 ? "tomorrow" : format(parseISO(due!), "EEE d MMM")}`;
      } else if (dueDays === 0 || t.do_date === todayIso) {
        tag = "today";
      } else if (t.priority === "urgent" && t.status !== "waiting_on_client") {
        tag = "urgent";
      }
      if (tag) items.push({ task: t, tag, note });
    }
    return items.sort((a, b) => TAG[a.tag].rank - TAG[b.tag].rank || (a.task.due_date || "9999").localeCompare(b.task.due_date || "9999"));
  }, [tasks, now, todayIso]);
  const visibleQueue = showAll ? queue : queue.slice(0, 7);
  const clientChanges = queue.filter((q) => q.tag === "client").length;

  // ---- Side column ------------------------------------------------------------
  const deadlines = useMemo(
    () =>
      projects
        .filter((p) => p.hard_deadline && !["delivered", "paid", "lost", "parked"].includes(p.status))
        .map((p) => ({ project: p, daysLeft: differenceInCalendarDays(parseISO(p.hard_deadline!), now) }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5),
    [projects, now]
  );

  const waiting = useMemo(() => {
    const items: Array<{ id: string; label: string; who: string; days: number; projectId: string }> = [];
    for (const g of gates) {
      if (g.status !== "waiting_on_client") continue;
      const proj = projectOf(g.project_id);
      const client = clients.find((c) => c.id === proj?.client_id);
      items.push({
        id: g.id,
        label: `${proj?.code || ""} ${g.name}`.trim(),
        who: client?.contacts[0]?.name || client?.name || "Client",
        days: g.sent_for_approval_at ? Math.max(0, differenceInCalendarDays(now, parseISO(g.sent_for_approval_at))) : 0,
        projectId: g.project_id,
      });
    }
    for (const t of tasks) {
      if (t.status === "waiting_on_client" && !items.some((i) => i.projectId === t.project_id)) {
        items.push({ id: t.id, label: `${t.key} ${t.title}`, who: t.waiting_on_name || "Client", days: Math.max(0, differenceInCalendarDays(now, parseISO(t.updated_at))), projectId: t.project_id });
      }
    }
    return items.sort((a, b) => b.days - a.days).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gates, tasks, projects, clients, now]);

  const load = useMemo(() => {
    const horizon = addDays(now, 7);
    const windowTasks = tasks.filter((t) => {
      if (t.status === "done") return false;
      if (!t.do_date && !t.due_date) return t.is_in_now;
      return parseISO(t.do_date || t.due_date!) <= horizon;
    });
    const planned = Math.round(windowTasks.reduce((acc, t) => acc + (t.estimate_hours || 1), 0) * 10) / 10;
    const available = settings.work_hours_per_day * 7;
    const rank: Record<string, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
    const candidate =
      planned > available
        ? [...windowTasks].filter((t) => !t.is_in_now && t.source !== "portal").sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || b.estimate_hours - a.estimate_hours)[0] || null
        : null;
    return { planned, available, pct: Math.min(100, Math.round((planned / available) * 100)), overloaded: planned > available, candidate };
  }, [tasks, settings.work_hours_per_day, now]);

  // ---- Header -----------------------------------------------------------------
  const { closesInText, shutdownWindow } = useMemo(() => {
    const [hh, mm] = settings.studio_closes_at.split(":").map(Number);
    const close = new Date(now);
    close.setHours(hh || 21, mm || 30, 0, 0);
    const mins = Math.round((close.getTime() - now.getTime()) / 60000);
    if (mins <= 0) return { closesInText: "Evening shutdown", shutdownWindow: true };
    return { closesInText: `Closes in ${Math.floor(mins / 60)}h ${mins % 60}m`, shutdownWindow: mins <= 60 };
  }, [settings.studio_closes_at, now]);

  useEffect(() => {
    if (!shutdownWindow) return;
    try {
      if (localStorage.getItem("tcs_studio_os_shutdown_prompted") !== todayIso) {
        localStorage.setItem("tcs_studio_os_shutdown_prompted", todayIso);
        setEveningShutdownOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, [shutdownWindow, todayIso, setEveningShutdownOpen]);

  const brief = useMemo(() => generateBriefSummary({ projects, gates, tasks, clients, settings, holidays, today: now }), [projects, gates, tasks, clients, settings, holidays, now]);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning, Shyam" : hour < 17 ? "Good afternoon, Shyam" : "Good evening, Shyam";
  const headline = (() => {
    const bits: string[] = [];
    if (unread) bits.push(`${unread} new client update${unread > 1 ? "s" : ""}`);
    else if (clientChanges) bits.push(`${clientChanges} client change${clientChanges > 1 ? "s" : ""} to do`);
    const overdue = queue.filter((q) => q.tag === "overdue").length;
    if (overdue) bits.push(`${overdue} overdue`);
    const d = deadlines[0];
    if (d) bits.push(`${d.project.code} due ${d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d ago` : d.daysLeft === 0 ? "today" : `in ${d.daysLeft}d`}`);
    return bits.length ? bits.join(" · ") : "All calm. Pick what matters and go.";
  })();

  // ---- Timer --------------------------------------------------------------------
  const timerTask = tasks.find((t) => t.id === activeTimerTaskId);
  const hh = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(timerSeconds % 60).padStart(2, "0");
  const timerVisible = timerRunning || timerSeconds > 0;

  const projectFromUpdate = (title: string) => projects.find((p) => title.toUpperCase().startsWith(`${p.code.toUpperCase()} `));
  const unreadUpdates = updates.filter((u) => !u.read_at);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium mb-0.5" style={{ color: "var(--sos-text-3)" }}>
            {format(now, "EEEE, d MMMM")}
          </p>
          <h1 className="sos-display text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] leading-tight" style={{ color: "var(--sos-text-1)" }}>
            {greeting}
          </h1>
          <p className="text-[15px] mt-1" style={{ color: unread || clientChanges ? "#B42318" : "var(--sos-text-2)" }}>
            {headline}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(brief.briefText);
              pushToast("Morning brief copied", "info");
            }}
            className="sos-pill-btn h-10 px-3.5 text-[12px] font-medium border inline-flex items-center gap-1.5"
            style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}
            title="Copy the 07:30 brief (confidential projects masked)"
          >
            <Copy className="w-3.5 h-3.5" /> Brief
          </button>
          <button
            type="button"
            onClick={() => setEveningShutdownOpen(true)}
            className="sos-pill-btn inline-flex items-center gap-2 px-4 h-10"
            style={{ background: shutdownWindow ? "var(--sos-primary)" : "var(--sos-ink)", color: shutdownWindow ? "#FFFFFF" : "var(--sos-ink-text)" }}
          >
            <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className="text-[13px] font-medium sos-tabular">{closesInText}</span>
          </button>
        </div>
      </div>

      <AIBriefCard />

      {/* 1. Client updates — only when something new arrived */}
      <AnimatePresence initial={false}>
        {unreadUpdates.length > 0 && (
          <motion.section
            key="client-updates"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
            transition={{ duration: 0.24, ease: EASE }}
            className="sos-card p-5 md:p-6 sos-priority-glow"
            style={{ borderColor: "#F3B8B2" }}
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FDECEC] text-[#B42318]">
                  <Bell className="w-4 h-4 sos-ring-bell" />
                </span>
                <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                  Client updates
                </h2>
                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[#B42318] text-white sos-pulse-badge">{unreadUpdates.length} new</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSoundOn(!soundOn)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "var(--sos-text-3)" }} aria-label={soundOn ? "Mute the update chime" : "Turn the update chime on"} title={soundOn ? "Chime on" : "Chime off"}>
                  {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
                <button type="button" onClick={markAllRead} className="sos-pill-btn h-9 px-3 text-[12px] font-semibold" style={{ color: "var(--sos-text-2)" }}>
                  Mark all seen
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {unreadUpdates.map((u) => {
                  const proj = projectFromUpdate(u.title);
                  const approved = u.kind === "portal_approval";
                  const isMessage = u.kind === "portal_message";
                  const clientId = u.url?.match(/[?&]client=([0-9a-f-]{36})/)?.[1];
                  return (
                    <motion.div
                      key={u.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                      className="flex items-start gap-3 p-3.5 rounded-[16px]"
                      style={{ background: approved ? "#E7F7EE" : isMessage ? "var(--sos-violet-soft)" : "#FFF6F5" }}
                    >
                      <span className="mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: approved ? "var(--sos-green)" : isMessage ? "var(--sos-primary)" : "#B42318" }}>
                        {approved ? <Check className="w-4 h-4" /> : <MessageSquare className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-snug" style={{ color: "var(--sos-text-1)" }}>
                          {u.title}
                        </p>
                        {u.body && (
                          <p className="text-[13px] mt-0.5 line-clamp-2" style={{ color: "var(--sos-text-2)" }}>
                            {u.body}
                          </p>
                        )}
                        <p className="text-[11px] mt-1" style={{ color: "var(--sos-text-3)" }}>
                          {formatDistanceToNowStrict(parseISO(u.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                        {isMessage && clientId && (
                          <button
                            type="button"
                            onClick={() => {
                              markRead(u.id);
                              try {
                                sessionStorage.setItem(CLIENT_FOCUS_KEY, clientId);
                              } catch {
                                /* ignore */
                              }
                              setRoute("clients");
                            }}
                            className="sos-pill-btn h-8 px-3 text-[12px] font-semibold text-white"
                            style={{ background: "var(--sos-primary)" }}
                          >
                            Reply
                          </button>
                        )}
                        {proj && !isMessage && (
                          <button
                            type="button"
                            onClick={() => {
                              markRead(u.id);
                              openProject(proj.id);
                            }}
                            className="sos-pill-btn h-8 px-3 text-[12px] font-semibold text-white"
                            style={{ background: "var(--sos-ink)" }}
                          >
                            Open {proj.code}
                          </button>
                        )}
                        <button type="button" onClick={() => markRead(u.id)} className="sos-pill-btn h-8 px-3 text-[12px] font-medium border" style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)", background: "var(--sos-surface)" }}>
                          Seen
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main column */}
        <div className="lg:col-span-8 space-y-5">
          {/* 2. Now */}
          <Card
            title="Now"
            right={
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold sos-tabular" style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}>
                  {nowTasks.length} / {settings.wip_limit}
                </span>
                <button type="button" onClick={() => setQuickAddOpen(true)} className="sos-pill-btn inline-flex items-center gap-1.5 px-3.5 h-9 text-[13px] font-semibold text-white" style={{ background: "var(--sos-primary)" }}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            }
          >
            {/* Slim focus timer — only while timing */}
            <AnimatePresence initial={false}>
              {timerVisible && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex items-center gap-3 px-3.5 py-2.5 rounded-[16px]" style={{ background: timerRunning ? "#E7F7EE" : "var(--sos-surface-2)" }}>
                    <span className="relative w-2.5 h-2.5 shrink-0">
                      <span className="absolute inset-0 rounded-full" style={{ background: timerRunning ? "var(--sos-green)" : "var(--sos-text-3)" }} />
                      <BreathingRing active={timerRunning} />
                    </span>
                    <span className="sos-num text-[20px] font-semibold sos-tabular" style={{ color: "var(--sos-text-1)" }}>
                      <TickDigits value={hh} />:<TickDigits value={mm} />:<TickDigits value={ss} />
                    </span>
                    <span className="text-[13px] truncate flex-1 min-w-0" style={{ color: "var(--sos-text-2)" }}>
                      {timerTask ? `${timerTask.key} · ${timerTask.title}` : "Focus"}
                    </span>
                    <button type="button" onClick={toggleTimer} className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: "var(--sos-green)" }} aria-label={timerRunning ? "Pause" : "Resume"}>
                      {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <button type="button" onClick={resetTimer} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: "var(--sos-text-2)" }} aria-label="Reset timer">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={stopTimer} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ color: "var(--sos-text-2)" }} aria-label="Stop and log time">
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {nowTasks.length === 0 ? (
              <div className="sos-tile p-5 text-center text-[14px]" style={{ color: "var(--sos-text-2)" }}>
                Now is clear. Pull something from <strong>Up next</strong> below.
              </div>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {nowTasks.map((task) => {
                    const proj = projectOf(task.project_id);
                    const timing = activeTimerTaskId === task.id && timerRunning;
                    const fromClient = task.source === "portal";
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0, transition: { duration: 0.22, ease: EASE } }}
                        transition={{ duration: 0.2, ease: EASE }}
                        style={{ overflow: "hidden" }}
                      >
                        <SwipeRow
                          onDone={() => toggleTaskDone(task.id)}
                          onSnooze={() => {
                            updateTask(task.id, { is_in_now: false });
                            pushToast(`${task.key} moved out of Now`, "info");
                          }}
                          className="sos-tile p-3.5 md:p-4 flex items-center gap-3"
                          style={fromClient ? { boxShadow: "inset 3px 0 0 #B42318" } : undefined}
                        >
                          <CompleteCheck label={`Complete ${task.title}`} onComplete={() => toggleTaskDone(task.id)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button type="button" onClick={() => proj && openProject(proj.id)} className="text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}>
                                {proj?.emoji} {task.key}
                              </button>
                              {fromClient && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDECEC] text-[#B42318]">Client change</span>}
                              <TaskStatusSelect status={task.status} compact onChange={(next) => (next === "done" ? toggleTaskDone(task.id) : updateTask(task.id, { status: next }))} />
                              <span className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>~{task.estimate_hours}h</span>
                            </div>
                            <p className="text-[15px] font-semibold mt-1 leading-snug" style={{ color: "var(--sos-text-1)" }}>
                              {task.title}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => (timing ? toggleTimer() : startTimerForTask(task.id))}
                            className="sos-pill-btn shrink-0 inline-flex items-center gap-1.5 px-3 h-9 text-[12px] font-semibold"
                            style={timing ? { background: "var(--sos-green)", color: "#FFFFFF" } : { background: "var(--sos-surface)", color: "var(--sos-text-1)", border: "1px solid var(--sos-border)" }}
                          >
                            {timing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{timing ? "Focusing" : "Start"}</span>
                          </button>
                        </SwipeRow>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </Card>

          {/* 3. Up next — one ranked queue */}
          <Card title="Up next" right={<Count n={queue.length} tone={clientChanges ? "red" : "plain"} />}>
            {queue.length === 0 ? (
              <p className="text-[14px]" style={{ color: "var(--sos-text-3)" }}>
                Nothing urgent, overdue or owed. A good moment for deep work.
              </p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {visibleQueue.map(({ task, tag, note }) => {
                    const proj = projectOf(task.project_id);
                    const t = TAG[tag];
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] ${tag === "client" ? "sos-priority-glow" : ""}`}
                        style={{ background: tag === "client" ? "#FFF6F5" : "var(--sos-surface-2)" }}
                      >
                        <CompleteCheck label={tag === "reply" ? `Mark replied: ${task.title}` : `Complete ${task.title}`} onComplete={() => toggleTaskDone(task.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="font-semibold px-2 py-0.5 rounded-full" style={{ background: t.bg, color: t.fg }}>
                              {t.label}
                            </span>
                            <button type="button" onClick={() => proj && openProject(proj.id)} className="font-semibold" style={{ color: "var(--sos-text-3)" }}>
                              {proj?.emoji} {task.key}
                            </button>
                            {note && <span style={{ color: "var(--sos-text-3)" }}>· {note}</span>}
                          </div>
                          <p className="text-[14px] font-medium leading-snug mt-0.5 line-clamp-2 md:line-clamp-1" style={{ color: "var(--sos-text-1)" }} title={task.title}>
                            {task.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={nowFull}
                          onClick={() => toggleTaskInNow(task.id)}
                          className="sos-pill-btn shrink-0 h-8 px-2.5 md:px-3 text-[12px] font-semibold border disabled:opacity-40 inline-flex items-center gap-1"
                          style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)", background: "var(--sos-surface)" }}
                          title={nowFull ? `Now is full (${settings.wip_limit})` : "Move into Now"}
                        >
                          <span className="hidden sm:inline">Now</span> <ArrowRight className="w-3 h-3" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {queue.length > 7 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[13px] font-medium pt-1" style={{ color: "var(--sos-primary)" }}>
                    {showAll ? "Show less" : `Show all ${queue.length}`}
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="lg:col-span-4 space-y-5">
          <Card title="Deadlines" right={<Count n={deadlines.length} />}>
            <div className="space-y-1.5">
              {deadlines.length === 0 && <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>No hard deadlines set.</p>}
              {deadlines.map(({ project, daysLeft }) => {
                const color = project.health === "late" || daysLeft < 0 ? "#B42318" : project.health === "at_risk" || daysLeft <= 3 ? "#9A4A00" : "#17663F";
                return (
                  <button key={project.id} type="button" onClick={() => openProject(project.id)} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[14px] hover:brightness-[0.98]" style={{ background: "var(--sos-surface-2)" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>
                        {project.emoji} {project.code} <span className="font-normal" style={{ color: "var(--sos-text-3)" }}>· {project.title}</span>
                      </span>
                      {project.health === "late" && project.forecast_date && (
                        <span className="block text-[11px]" style={{ color: "#B42318" }}>Forecast {format(parseISO(project.forecast_date), "d MMM")}</span>
                      )}
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[15px] font-bold sos-tabular" style={{ color }}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? "Today" : `${daysLeft}d`}
                      </span>
                      <span className="block text-[11px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>{format(parseISO(project.hard_deadline!), "d MMM")}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Waiting on clients" right={<Hourglass className="w-4 h-4 text-[#9A4A00]" strokeWidth={1.75} />}>
            {waiting.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>Nothing blocked on clients.</p>
            ) : (
              <div className="space-y-1.5">
                {waiting.map((w) => (
                  <button key={w.id} type="button" onClick={() => openProject(w.projectId)} className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-[14px]" style={{ background: "#FFF8EE" }}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold truncate" style={{ color: "var(--sos-text-1)" }}>{w.label}</span>
                      <span className="block text-[12px] truncate" style={{ color: "#9A4A00" }}>{w.who}</span>
                    </span>
                    <span className="text-[12px] font-semibold sos-tabular shrink-0" style={{ color: w.days >= 3 ? "#B42318" : "#9A4A00" }}>
                      {w.days ? `${w.days}d` : "new"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Next 7 days">
            <div className="flex items-center justify-between text-[13px] mb-2">
              <span style={{ color: "var(--sos-text-2)" }}>Planned vs available</span>
              <span className="font-semibold sos-tabular" style={{ color: load.overloaded ? "#9A4A00" : "var(--sos-text-1)" }}>
                {load.planned}h / {load.available}h
              </span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
              <div className={`h-full rounded-full transition-all duration-300 ${load.overloaded ? "sos-stripe-amber" : "sos-stripe-green"}`} style={{ width: `${load.pct}%` }} />
            </div>
            {load.overloaded && load.candidate && (
              <div className="mt-3 p-3 rounded-[14px] bg-[#FFF3E0] text-[#9A5200] text-[12px] space-y-2">
                <p>
                  Over by {Math.round((load.planned - load.available) * 10) / 10}h. Move <strong>{load.candidate.key}</strong> ({load.candidate.estimate_hours}h) to next week?
                </p>
                <button type="button" onClick={() => moveTaskToNextWeek(load.candidate!.id)} className="sos-pill-btn inline-flex items-center gap-1 px-3 h-7 text-[11px] font-bold bg-[#9A4A00] text-white">
                  Move it <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <TeamLoadCard compact />
    </div>
  );
};
