import React, { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO } from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hourglass,
  Mail,
  MessageCircle,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Sparkles,
} from "lucide-react";
import { useStudioOS } from "../StudioOSContext";
import { HealthPill, TaskStatusChip } from "../components/StatusChip";

export const TodayScreen: React.FC = () => {
  const {
    tasks,
    projects,
    gates,
    clients,
    settings,
    toggleTaskDone,
    toggleTaskInNow,
    setQuickAddOpen,
    openProject,
    activeTimerTaskId,
    timerRunning,
    timerSeconds,
    startTimerForTask,
    toggleTimer,
    resetTimer,
    stopTimer,
  } = useStudioOS();

  const today = useMemo(() => new Date(), []);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [weekOffset, setWeekOffset] = useState(0);

  // 1. Now tasks (strict WIP limit = settings.wip_limit, default 3)
  const nowTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.is_in_now && t.status !== "done")
        .slice(0, settings.wip_limit),
    [tasks, settings.wip_limit]
  );

  // Candidate tasks to promote to Now if fewer than 3
  const suggestedForNow = useMemo(
    () =>
      tasks
        .filter((t) => !t.is_in_now && t.status !== "done" && t.status !== "waiting_on_client")
        .sort((a, b) => (a.priority === "urgent" ? -1 : b.priority === "urgent" ? 1 : 0))
        .slice(0, 3),
    [tasks]
  );

  // 2. Promised by you (next 48h or open promises)
  const promises = useMemo(
    () =>
      tasks
        .filter((t) => t.type === "promise" && t.status !== "done")
        .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))
        .slice(0, 4),
    [tasks]
  );

  // 3. Replies owed
  const repliesOwed = useMemo(
    () =>
      tasks
        .filter((t) => t.type === "reply_owed" && t.status !== "done")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [tasks]
  );

  // 4. Waiting on clients (from gates + waiting tasks)
  const waitingGates = useMemo(() => {
    const items: Array<{ id: string; label: string; clientName: string; days: number; projectId: string }> = [];
    for (const g of gates) {
      if (g.status === "waiting_on_client") {
        const proj = projects.find((p) => p.id === g.project_id);
        const client = clients.find((c) => c.id === proj?.client_id);
        const days = g.sent_for_approval_at
          ? Math.max(1, differenceInCalendarDays(today, parseISO(g.sent_for_approval_at)))
          : 2;
        items.push({
          id: g.id,
          label: g.name,
          clientName: client?.contacts[0]?.name || client?.name || "Client",
          days,
          projectId: g.project_id,
        });
      }
    }
    for (const t of tasks) {
      if (t.status === "waiting_on_client" && !items.some((i) => i.projectId === t.project_id)) {
        const proj = projects.find((p) => p.id === t.project_id);
        const days = Math.max(1, differenceInCalendarDays(today, parseISO(t.updated_at)));
        items.push({
          id: t.id,
          label: proj?.code || t.key,
          clientName: t.waiting_on_name || "Client",
          days,
          projectId: t.project_id,
        });
      }
    }
    return items.slice(0, 6);
  }, [gates, tasks, projects, clients, today]);

  // 5. Next 5 Deadlines
  const upcomingDeadlines = useMemo(
    () =>
      projects
        .filter((p) => p.hard_deadline && !["delivered", "paid", "lost", "parked"].includes(p.status))
        .map((p) => ({
          project: p,
          daysLeft: differenceInCalendarDays(parseISO(p.hard_deadline!), today),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5),
    [projects, today]
  );

  // 6. Load meter (next 7 days)
  const loadStats = useMemo(() => {
    const horizon = addDays(today, 7);
    const planned = tasks
      .filter((t) => {
        if (t.status === "done") return false;
        if (!t.do_date && !t.due_date) return t.is_in_now;
        const d = parseISO(t.do_date || t.due_date!);
        return d <= horizon;
      })
      .reduce((acc, t) => acc + (t.estimate_hours || 1), 0);
    const available = settings.work_hours_per_day * 7;
    const pct = Math.min(130, Math.round((planned / available) * 100));
    return { planned: Math.round(planned * 10) / 10, available, pct, overloaded: planned > available };
  }, [tasks, settings.work_hours_per_day, today]);

  // 7. Date strip for Upcoming Tasks
  const stripDays = useMemo(() => {
    const base = addDays(today, weekOffset * 7 - 1);
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, [today, weekOffset]);

  const selectedDayTasks = useMemo(() => {
    const iso = format(selectedDay, "yyyy-MM-dd");
    return tasks
      .filter((t) => t.status !== "done" && (t.do_date === iso || t.due_date === iso))
      .slice(0, 5);
  }, [tasks, selectedDay]);

  // 8. Studio closes countdown
  const closesInText = useMemo(() => {
    const [hh, mm] = settings.studio_closes_at.split(":").map(Number);
    const closeDt = new Date(today);
    closeDt.setHours(hh || 21, mm || 30, 0, 0);
    const diffMins = Math.round((closeDt.getTime() - today.getTime()) / 60000);
    if (diffMins <= 0) return "Studio closed for tonight";
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `Studio closes in ${h}h ${m}m`;
  }, [settings.studio_closes_at, today]);

  // Focus Timer display
  const activeTimerTask = tasks.find((t) => t.id === activeTimerTaskId) || nowTasks[0];
  const displaySecs = timerSeconds;
  const timerH = String(Math.floor(displaySecs / 3600)).padStart(2, "0");
  const timerM = String(Math.floor((displaySecs % 3600) / 60)).padStart(2, "0");
  const timerS = String(displaySecs % 60).padStart(2, "0");

  // Greeting
  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning, Shyam" : hour < 17 ? "Good afternoon, Shyam" : "Good evening, Shyam";
  const topDeadline = upcomingDeadlines[0];
  const statusLine = topDeadline
    ? `${nowTasks.length} thing${nowTasks.length === 1 ? "" : "s"} in Now. ${topDeadline.project.code} deadline in ${
        topDeadline.daysLeft >= 0 ? `${topDeadline.daysLeft} days` : `${Math.abs(topDeadline.daysLeft)}d overdue`
      } — ${topDeadline.project.health.replace("_", " ")}.`
    : `${nowTasks.length} thing${nowTasks.length === 1 ? "" : "s"} in Now. Everything calm and clear.`;

  return (
    <div className="space-y-6">
      {/* Calm Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium mb-1" style={{ color: "var(--sos-text-3)" }}>
            {format(today, "EEEE, d MMMM yyyy")} · Asia/Kolkata
          </p>
          <h1
            className="sos-display text-[32px] md:text-[38px] font-semibold tracking-[-0.02em] leading-tight"
            style={{ color: "var(--sos-text-1)" }}
          >
            {greeting}
          </h1>
          <p className="text-[15px] mt-1" style={{ color: "var(--sos-text-2)" }}>
            {statusLine}
          </p>
        </div>

        {/* Studio Closes Black Pill Card */}
        <div
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full self-start md:self-auto"
          style={{ background: "var(--sos-ink)", color: "var(--sos-ink-text)" }}
        >
          <Moon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          <span className="text-[13px] font-medium sos-tabular">{closesInText}</span>
        </div>
      </div>

      {/* Bento Grid — 12 columns on desktop, single column on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. NOW (Max 3 tasks, WIP limit enforced) — 7 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="sos-display text-[24px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                  Now
                </h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[12px] font-semibold sos-tabular"
                  style={{ background: "var(--sos-violet-soft)", color: "var(--sos-primary)" }}
                >
                  {nowTasks.length} / {settings.wip_limit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="sos-pill-btn inline-flex items-center gap-1.5 px-3.5 h-9 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-primary)" }}
              >
                <Plus className="w-4 h-4" /> Quick Add
              </button>
            </div>

            {nowTasks.length === 0 ? (
              <div
                className="sos-tile p-5 text-center space-y-3"
                style={{ color: "var(--sos-text-2)" }}
              >
                <Sparkles className="w-6 h-6 mx-auto" style={{ color: "var(--sos-green)" }} />
                <p className="text-[14px] font-medium">Now is clear. Pick up to {settings.wip_limit} tasks below or enjoy the calm.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestedForNow.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleTaskInNow(s.id)}
                      className="sos-pill-btn px-3 py-1.5 text-[12px] font-medium border"
                      style={{
                        background: "var(--sos-surface)",
                        borderColor: "var(--sos-border)",
                        color: "var(--sos-text-1)",
                      }}
                    >
                      + {s.key}: {s.title.slice(0, 32)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {nowTasks.map((task) => {
                  const proj = projects.find((p) => p.id === task.project_id);
                  const isActiveTimer = activeTimerTaskId === task.id && timerRunning;
                  return (
                    <div
                      key={task.id}
                      className="sos-tile p-4 flex items-center gap-3.5 transition-all hover:brightness-[0.99]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTaskDone(task.id)}
                        aria-label={`Complete ${task.title}`}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors hover:border-[#3FA37A] hover:bg-[#E7F7EE]"
                        style={{ borderColor: "var(--sos-text-3)" }}
                      >
                        <Check className="w-3.5 h-3.5 opacity-0 hover:opacity-100 text-[#22875A]" strokeWidth={2.5} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => proj && openProject(proj.id)}
                            className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "var(--sos-surface)", color: "var(--sos-text-2)" }}
                          >
                            {proj?.emoji} {task.key}
                          </button>
                          <TaskStatusChip status={task.status} compact />
                          <span className="text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                            ~{task.estimate_hours}h
                          </span>
                        </div>
                        <p
                          className="text-[15px] md:text-[16px] font-semibold mt-1 leading-snug"
                          style={{ color: "var(--sos-text-1)" }}
                        >
                          {task.title}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => (isActiveTimer ? toggleTimer() : startTimerForTask(task.id))}
                        className="sos-pill-btn shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 text-[12px] font-semibold"
                        style={{
                          background: isActiveTimer ? "var(--sos-green)" : "var(--sos-surface)",
                          color: isActiveTimer ? "#FFFFFF" : "var(--sos-text-1)",
                          border: isActiveTimer ? "none" : "1px solid var(--sos-border)",
                        }}
                      >
                        {isActiveTimer ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {isActiveTimer ? "Focus" : "Start"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Load Meter inside bottom of Now card or cleanly below */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--sos-border)" }}>
            <div className="flex items-center justify-between text-[13px] mb-2">
              <span className="font-medium" style={{ color: "var(--sos-text-2)" }}>
                Next 7 days load
              </span>
              <span
                className="font-semibold sos-tabular"
                style={{ color: loadStats.overloaded ? "var(--sos-amber)" : "var(--sos-text-1)" }}
              >
                {loadStats.planned}h planned / {loadStats.available}h available
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full overflow-hidden" style={{ background: "var(--sos-surface-2)" }}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  loadStats.overloaded ? "sos-stripe-amber" : "sos-stripe-green"
                }`}
                style={{ width: `${Math.min(100, loadStats.pct)}%` }}
              />
            </div>
          </div>
        </section>

        {/* 2. FOCUS TIMER (Time tracking card) — 5 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="sos-display text-[24px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                Time tracking
              </h2>
              <span
                className="px-3 py-1 rounded-full text-[12px] font-medium"
                style={{
                  background: timerRunning ? "#E7F7EE" : "var(--sos-surface-2)",
                  color: timerRunning ? "#22875A" : "var(--sos-text-2)",
                }}
              >
                {timerRunning ? "● Active" : "Ready"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 my-4">
              {[
                { val: timerH, unit: "h" },
                { val: timerM, unit: "m" },
                { val: timerS, unit: "s" },
              ].map((seg) => (
                <div key={seg.unit} className="sos-tile py-5 px-3 text-center">
                  <span
                    className="sos-num text-[42px] md:text-[52px] font-semibold tracking-[-0.03em] leading-none"
                    style={{ color: "var(--sos-text-1)" }}
                  >
                    {seg.val}
                  </span>
                  <span className="sos-display text-[18px] font-medium ml-0.5" style={{ color: "var(--sos-text-3)" }}>
                    {seg.unit}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[13px] truncate text-center" style={{ color: "var(--sos-text-2)" }}>
              {activeTimerTask ? `Focusing on ${activeTimerTask.key}: ${activeTimerTask.title}` : "Pick a task in Now to focus"}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              type="button"
              onClick={resetTimer}
              className="sos-pill-btn w-11 h-11 flex items-center justify-center border"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              aria-label="Reset timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleTimer}
              className="sos-pill-btn w-14 h-14 flex items-center justify-center text-white shadow-md"
              style={{ background: "var(--sos-green)" }}
              aria-label={timerRunning ? "Pause timer" : "Start timer"}
            >
              {timerRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={stopTimer}
              className="sos-pill-btn w-11 h-11 flex items-center justify-center border"
              style={{ background: "var(--sos-surface-2)", borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
              aria-label="Stop and log time"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* 3. DEADLINES (Yellow highlight bento card) — 4 cols */}
        <section
          className="rounded-[24px] p-5 md:p-6 lg:col-span-4 flex flex-col justify-between"
          style={{ background: "var(--sos-yellow-card)", color: "#0F1115" }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="sos-display text-[24px] font-semibold">Deadlines</h2>
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-black/10">
                Next {upcomingDeadlines.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {upcomingDeadlines.map(({ project, daysLeft }) => {
                const isLate = project.health === "late" || daysLeft < 0;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => openProject(project.id)}
                    className="w-full text-left flex items-center justify-between p-3 rounded-[16px] bg-white/75 hover:bg-white transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: isLate
                              ? "#E5484D"
                              : project.health === "at_risk"
                              ? "#F59E0B"
                              : "#22875A",
                          }}
                        />
                        <span className="text-[13px] font-bold truncate">
                          {project.emoji} {project.code}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#5F6672] truncate mt-0.5">{project.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className="sos-num text-[22px] font-bold leading-none"
                        style={{ color: isLate ? "#E5484D" : "#0F1115" }}
                      >
                        {daysLeft >= 0 ? `${daysLeft}d` : `${Math.abs(daysLeft)}d`}
                      </span>
                      <p className="text-[11px] text-[#5F6672] sos-tabular">
                        {project.hard_deadline ? format(parseISO(project.hard_deadline), "d MMM") : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. UPCOMING TASKS (Date strip + day timeline) — 8 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="sos-display text-[24px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Upcoming Tasks
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center border"
                style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-2)" }}
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setQuickAddOpen(true)}
                className="sos-pill-btn inline-flex items-center gap-1.5 px-4 h-9 text-[13px] font-semibold text-white"
                style={{ background: "var(--sos-green)" }}
              >
                <Plus className="w-4 h-4" /> Add New Task
              </button>
            </div>
          </div>

          {/* Date Strip with Black Selected Pill */}
          <div className="grid grid-cols-7 gap-1.5 mb-5">
            {stripDays.map((d) => {
              const selected = isSameDay(d, selectedDay);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className="py-2.5 rounded-[18px] flex flex-col items-center justify-center transition-colors"
                  style={{
                    background: selected ? "var(--sos-ink)" : "transparent",
                    color: selected ? "var(--sos-ink-text)" : "var(--sos-text-2)",
                  }}
                >
                  <span className="text-[11px] font-medium opacity-75">{format(d, "EEE")}</span>
                  <span className="sos-num text-[17px] font-semibold mt-0.5">{format(d, "d")}</span>
                  {isToday && !selected && (
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: "var(--sos-blue)" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Day Timeline */}
          <div className="relative pl-14 space-y-3">
            {/* Dotted vertical guide */}
            <div
              className="absolute left-[46px] top-2 bottom-2 border-l border-dashed"
              style={{ borderColor: "var(--sos-border)" }}
            />

            {/* Current time indicator */}
            <div className="relative flex items-center gap-3 py-1">
              <span
                className="absolute -left-14 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white sos-tabular"
                style={{ background: "var(--sos-blue)" }}
              >
                {format(today, "HH:mm")}
              </span>
              <div className="w-full h-[2px]" style={{ background: "var(--sos-blue)" }} />
            </div>

            {selectedDayTasks.length === 0 ? (
              <p className="text-[13px] py-4" style={{ color: "var(--sos-text-3)" }}>
                No scheduled tasks on {format(selectedDay, "EEE d MMM")}. Click &ldquo;Add New Task&rdquo; to plan this day.
              </p>
            ) : (
              selectedDayTasks.map((t, idx) => {
                const proj = projects.find((p) => p.id === t.project_id);
                const slotHour = `${String(10 + idx * 2).padStart(2, "0")}:00`;
                return (
                  <div key={t.id} className="relative flex items-center gap-3">
                    <span className="absolute -left-14 text-[12px] sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                      {slotHour}
                    </span>
                    <span
                      className="w-3 h-3 rounded-full border-2 shrink-0 -ml-[13px] z-10"
                      style={{ borderColor: "var(--sos-blue)", background: "var(--sos-surface)" }}
                    />
                    <div
                      className="flex-1 sos-tile px-4 py-2.5 flex items-center justify-between gap-2 cursor-pointer"
                      onClick={() => proj && openProject(proj.id)}
                    >
                      <div className="min-w-0">
                        <span className="text-[14px] font-semibold truncate block" style={{ color: "var(--sos-text-1)" }}>
                          {t.title}
                        </span>
                        <span className="text-[12px]" style={{ color: "var(--sos-text-3)" }}>
                          {proj?.emoji} {t.key} · {t.estimate_hours}h
                        </span>
                      </div>
                      <TaskStatusChip status={t.status} compact />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 5. PROMISED BY YOU (Amber accent) — 4 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Promised by you
            </h2>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFF3E0] text-[#C26A00]">
              {promises.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {promises.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                No pending promises.
              </p>
            ) : (
              promises.map((p) => {
                const proj = projects.find((pr) => pr.id === p.project_id);
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-[16px] border-l-4"
                    style={{ background: "var(--sos-surface-2)", borderLeftColor: "var(--sos-amber)" }}
                  >
                    <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                      <span className="font-semibold inline-flex items-center gap-1" style={{ color: "var(--sos-text-2)" }}>
                        {p.channel === "whatsapp" ? (
                          <MessageCircle className="w-3.5 h-3.5 text-[#22875A]" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-[#2F6BFF]" />
                        )}
                        {p.promised_to_name || "Client"}
                      </span>
                      <span className="sos-tabular font-semibold text-[#C26A00]">
                        {p.due_date ? format(parseISO(p.due_date), "d MMM") : "Soon"}
                      </span>
                    </div>
                    <p className="text-[14px] font-medium leading-snug" style={{ color: "var(--sos-text-1)" }}>
                      {p.title}
                    </p>
                    <span className="text-[11px] mt-1 inline-block" style={{ color: "var(--sos-text-3)" }}>
                      {proj?.emoji} {p.key}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 6. REPLIES OWED — 4 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Replies owed
            </h2>
            <span
              className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
              style={{ background: "var(--sos-surface-2)", color: "var(--sos-text-2)" }}
            >
              {repliesOwed.length}
            </span>
          </div>
          <div className="space-y-2.5">
            {repliesOwed.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                Inbox zero — nobody waiting on a reply.
              </p>
            ) : (
              repliesOwed.map((r) => {
                const days = Math.max(1, differenceInCalendarDays(today, parseISO(r.created_at)));
                return (
                  <div key={r.id} className="sos-tile p-3.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
                        {r.promised_to_name || "Client"}{" "}
                        <span className="font-normal sos-tabular" style={{ color: "var(--sos-text-3)" }}>
                          · {days}d
                        </span>
                      </p>
                      <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--sos-text-2)" }}>
                        {r.title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTaskDone(r.id)}
                      className="sos-pill-btn shrink-0 px-3 h-8 text-[12px] font-semibold border"
                      style={{
                        background: "var(--sos-surface)",
                        borderColor: "var(--sos-border)",
                        color: "var(--sos-blue)",
                      }}
                    >
                      Mark replied
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 7. WAITING ON CLIENTS — 4 cols */}
        <section className="sos-card p-5 md:p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="sos-display text-[20px] font-semibold" style={{ color: "var(--sos-text-1)" }}>
              Waiting on clients
            </h2>
            <Hourglass className="w-4 h-4 text-[#C26A00]" strokeWidth={1.75} />
          </div>
          <div className="flex flex-wrap gap-2">
            {waitingGates.length === 0 ? (
              <p className="text-[13px]" style={{ color: "var(--sos-text-3)" }}>
                No approvals currently blocked on clients.
              </p>
            ) : (
              waitingGates.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => openProject(w.projectId)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium bg-[#FFF3E0] text-[#C26A00] hover:opacity-90 transition-opacity"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{w.label}</span>
                  <span className="opacity-60">·</span>
                  <span className="font-semibold">{w.clientName}</span>
                  <span className="opacity-60">·</span>
                  <span className="sos-tabular">{w.days}d</span>
                </button>
              ))
            )}
          </div>

          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--sos-border)" }}>
            <p className="text-[12px] font-medium mb-2" style={{ color: "var(--sos-text-3)" }}>
              Active Projects Health
            </p>
            <div className="flex flex-wrap gap-2">
              {projects
                .filter((p) => p.status === "active")
                .slice(0, 4)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openProject(p.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border"
                    style={{ borderColor: "var(--sos-border)", color: "var(--sos-text-1)" }}
                  >
                    <span>{p.emoji} {p.code}</span>
                    <HealthPill health={p.health} />
                  </button>
                ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
