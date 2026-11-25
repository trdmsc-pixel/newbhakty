import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  HolidayRegion,
  ProjectHealth,
  StudioClient,
  StudioGate,
  StudioGenerationBlock,
  StudioHoliday,
  StudioProject,
  StudioSettings,
  StudioTask,
} from "./types.js";

export interface ProjectForecastResult {
  forecast_date: string;
  health: ProjectHealth;
  remaining_work_days: number;
  approval_wait_days: number;
  holiday_days: number;
  holiday_names: string[];
  explanation: string;
}

export function getClientHolidayRegion(timezone?: string | null): HolidayRegion {
  if (!timezone) return "IN";
  const tz = timezone.toLowerCase();
  if (tz.includes("argentina") || tz.includes("buenos_aires")) return "AR";
  if (tz.includes("america/")) return "US";
  return "IN";
}

/**
 * Forecast Engine (Phase 2)
 * Computes realistic predicted delivery date including:
 * remaining_work_days × overrun_factor + approval_wait_days + region holiday_days.
 */
export function computeProjectForecast(
  project: StudioProject,
  gates: StudioGate[],
  client: StudioClient | undefined,
  settings: StudioSettings,
  holidaysOrToday?: StudioHoliday[] | Date,
  maybeToday: Date = new Date()
): ProjectForecastResult {
  const holidays = Array.isArray(holidaysOrToday) ? holidaysOrToday : [];
  const today = holidaysOrToday instanceof Date ? holidaysOrToday : maybeToday;

  if (project.status === "delivered" || project.status === "paid") {
    const d = project.hard_deadline || format(today, "yyyy-MM-dd");
    return {
      forecast_date: d,
      health: "on_track",
      remaining_work_days: 0,
      approval_wait_days: 0,
      holiday_days: 0,
      holiday_names: [],
      explanation: "Project already delivered.",
    };
  }

  const projectGates = gates.filter(
    (g) => g.project_id === project.id && g.status !== "approved" && g.status !== "skipped"
  );

  // Exclude G9/G10 invoice/paid from delivery forecast
  const deliveryGates = projectGates.filter((g) => !["G9", "G10"].includes(g.code));

  const rawWorkDays = deliveryGates.reduce((acc, g) => acc + (g.estimate_days || 0), 0);
  const remainingWorkDays = Math.round(rawWorkDays * settings.overrun_factor * 10) / 10;

  const remainingApprovalGates = deliveryGates.filter((g) => g.needs_client_approval).length;
  const latency = client?.avg_approval_latency_days ?? settings.default_approval_latency_days;
  const approvalWaitDays = Math.round(remainingApprovalGates * latency * 10) / 10;

  const baseCalendarDays = Math.max(1, Math.ceil(remainingWorkDays + approvalWaitDays));

  // Count public holidays in studio region (IN) + client's timezone region + GLOBAL across window
  const applicableRegions = new Set<HolidayRegion>([
    "IN",
    "GLOBAL",
    getClientHolidayRegion(client?.timezone),
  ]);
  const holidayByDate = new Map<string, string>();
  for (const h of holidays) {
    if (!h.is_active || !applicableRegions.has(h.region)) continue;
    const dateKey = h.holiday_date.slice(0, 10);
    if (!holidayByDate.has(dateKey)) {
      holidayByDate.set(dateKey, `${h.name} (${h.region})`);
    }
  }

  let cursor = today;
  let countedWorkSpan = 0;
  let holidayDays = 0;
  const matchedHolidays: string[] = [];
  let safety = 0;

  while (countedWorkSpan < baseCalendarDays && safety < 120) {
    safety += 1;
    cursor = addDays(cursor, 1);
    const iso = format(cursor, "yyyy-MM-dd");
    const holidayLabel = holidayByDate.get(iso);
    if (holidayLabel) {
      holidayDays += 1;
      matchedHolidays.push(holidayLabel);
    } else {
      countedWorkSpan += 1;
    }
  }

  const forecastDt = cursor;
  const forecastDateStr = format(forecastDt, "yyyy-MM-dd");

  let health: ProjectHealth = "on_track";
  if (project.hard_deadline) {
    const deadlineDt = parseISO(project.hard_deadline);
    const deltaDays = differenceInCalendarDays(forecastDt, deadlineDt);
    if (deltaDays <= -3) health = "on_track";
    else if (deltaDays <= 0) health = "tight";
    else if (deltaDays <= 3) health = "at_risk";
    else health = "late";
  }

  const holidayPart = holidayDays > 0 ? ` + ${holidayDays}d holiday` : "";
  const explanation = `${rawWorkDays}d work × ${settings.overrun_factor} + ${remainingApprovalGates} approvals × ${latency}d${holidayPart}`;

  return {
    forecast_date: forecastDateStr,
    health,
    remaining_work_days: remainingWorkDays,
    approval_wait_days: approvalWaitDays,
    holiday_days: holidayDays,
    holiday_names: matchedHolidays,
    explanation,
  };
}

/**
 * Calibrate Studio Overrun Factor from completed approved gates (actual_days / estimate_days).
 */
export function computeRealOverrunCalibration(gates: StudioGate[]): {
  ratio: number;
  gateCount: number;
  totalEstimated: number;
  totalActual: number;
} {
  const calibrated = gates.filter(
    (g) =>
      g.status === "approved" &&
      typeof g.actual_days === "number" &&
      g.actual_days > 0 &&
      g.estimate_days > 0
  );

  if (calibrated.length === 0) {
    return { ratio: 1.6, gateCount: 0, totalEstimated: 0, totalActual: 0 };
  }

  const totalEstimated = calibrated.reduce((sum, g) => sum + g.estimate_days, 0);
  const totalActual = calibrated.reduce((sum, g) => sum + (g.actual_days || 0), 0);
  const rawRatio = totalEstimated > 0 ? totalActual / totalEstimated : 1.6;
  const clamped = Math.min(3.5, Math.max(1.0, Math.round(rawRatio * 10) / 10));

  return {
    ratio: clamped,
    gateCount: calibrated.length,
    totalEstimated: Math.round(totalEstimated * 10) / 10,
    totalActual: Math.round(totalActual * 10) / 10,
  };
}

/**
 * Estimate remaining AI generation days from non-keeper blocks, takes_per_keeper, and work_hours_per_day.
 */
export function computeGenerationEstimate(
  blocks: StudioGenerationBlock[],
  settings: StudioSettings
): {
  total: number;
  keepers: number;
  rejected: number;
  generating: number;
  totalTakes: number;
  remainingDays: number;
} {
  const total = blocks.length;
  const keepers = blocks.filter((b) => b.status === "keeper").length;
  const rejected = blocks.filter((b) => b.status === "rejected").length;
  const generating = blocks.filter((b) => b.status === "generating").length;
  const totalTakes = blocks.reduce((s, b) => s + (b.takes || 0), 0);
  const remainingBlocks = blocks.filter((b) => b.status !== "keeper").length;
  // ~15 min (0.25h) average per prompt + Seedance generation + review take
  const hoursRemaining = remainingBlocks * (settings.takes_per_keeper || 3) * 0.25;
  const remainingDays =
    Math.round((hoursRemaining / Math.max(1, settings.work_hours_per_day || 7)) * 10) / 10;

  return { total, keepers, rejected, generating, totalTakes, remainingDays };
}

export interface MorningBriefPayload {
  dateLabel: string;
  topNow: Array<{ key: string; title: string; projectLabel: string }>;
  promises48h: Array<{ key: string; title: string; who: string; due: string }>;
  repliesOwed: Array<{ key: string; title: string; who: string; daysWaiting: number }>;
  waitingOnClients: Array<{ label: string; clientName: string; days: number }>;
  lateProjects: Array<{ label: string; forecastDate: string; deadlineDate?: string }>;
  briefText: string;
  wordCount: number;
}

function isProjectConfidential(project: StudioProject | undefined, client: StudioClient | undefined): boolean {
  return Boolean(project?.is_confidential || client?.is_confidential);
}

/**
 * Builds the calm <=200-word Morning Brief for Today banner + 07:30 IST Resend email.
 * Masks confidential projects as "Confidential project" and includes zero fee amounts.
 */
export function generateBriefSummary(params: {
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  clients: StudioClient[];
  settings: StudioSettings;
  holidays?: StudioHoliday[];
  today?: Date;
}): MorningBriefPayload {
  const { projects, gates, tasks, clients, settings, holidays = [], today = new Date() } = params;
  const dateLabel = format(today, "EEE, d MMM yyyy");

  const maskProj = (p?: StudioProject) => {
    if (!p) return "Studio";
    const cl = clients.find((c) => c.id === p.client_id);
    if (isProjectConfidential(p, cl)) return "Confidential project";
    return `${p.code} (${p.title})`;
  };

  const maskTaskTitle = (t: StudioTask, p?: StudioProject) => {
    const cl = clients.find((c) => c.id === p?.client_id);
    if (isProjectConfidential(p, cl)) return `${t.type === "reply_owed" ? "Reply due" : "Deliverable"} on Confidential project`;
    return t.title;
  };

  const topNow = tasks
    .filter((t) => t.is_in_now && t.status !== "done")
    .slice(0, settings.wip_limit || 3)
    .map((t) => {
      const p = projects.find((pr) => pr.id === t.project_id);
      return {
        key: isProjectConfidential(p, clients.find((c) => c.id === p?.client_id)) ? "CONF" : t.key,
        title: maskTaskTitle(t, p),
        projectLabel: maskProj(p),
      };
    });

  const promises48h = tasks
    .filter((t) => {
      if (t.type !== "promise" || t.status === "done") return false;
      if (!t.due_date) return true;
      return differenceInCalendarDays(parseISO(t.due_date), today) <= 2;
    })
    .slice(0, 4)
    .map((t) => {
      const p = projects.find((pr) => pr.id === t.project_id);
      const cl = clients.find((c) => c.id === p?.client_id);
      const conf = isProjectConfidential(p, cl);
      return {
        key: conf ? "CONF" : t.key,
        title: maskTaskTitle(t, p),
        who: conf ? "Confidential client" : t.promised_to_name || "Client",
        due: t.due_date ? format(parseISO(t.due_date), "d MMM") : "48h",
      };
    });

  const repliesOwed = tasks
    .filter((t) => t.type === "reply_owed" && t.status !== "done")
    .slice(0, 4)
    .map((t) => {
      const p = projects.find((pr) => pr.id === t.project_id);
      const cl = clients.find((c) => c.id === p?.client_id);
      const conf = isProjectConfidential(p, cl);
      return {
        key: conf ? "CONF" : t.key,
        title: maskTaskTitle(t, p),
        who: conf ? "Confidential client" : t.promised_to_name || "Client",
        daysWaiting: Math.max(1, differenceInCalendarDays(today, parseISO(t.created_at))),
      };
    });

  const waitingOnClients: MorningBriefPayload["waitingOnClients"] = [];
  for (const g of gates) {
    if (g.status !== "waiting_on_client") continue;
    const p = projects.find((pr) => pr.id === g.project_id);
    const cl = clients.find((c) => c.id === p?.client_id);
    const conf = isProjectConfidential(p, cl);
    const days = g.sent_for_approval_at
      ? Math.max(1, differenceInCalendarDays(today, parseISO(g.sent_for_approval_at)))
      : 1;
    waitingOnClients.push({
      label: conf ? `${g.code} (Confidential project)` : `${p?.code || ""} ${g.name}`.trim(),
      clientName: conf ? "Confidential client" : cl?.contacts?.[0]?.name || cl?.name || "Client",
      days,
    });
  }

  const lateProjects: MorningBriefPayload["lateProjects"] = [];
  for (const p of projects) {
    if (!["active", "on_hold"].includes(p.status)) continue;
    const cl = clients.find((c) => c.id === p.client_id);
    const f = computeProjectForecast(p, gates, cl, settings, holidays, today);
    if (f.health === "late") {
      lateProjects.push({
        label: maskProj(p),
        forecastDate: format(parseISO(f.forecast_date), "d MMM"),
        deadlineDate: p.hard_deadline ? format(parseISO(p.hard_deadline), "d MMM") : undefined,
      });
    }
  }

  const lines: string[] = [`Studio OS Morning Brief — ${dateLabel}`];
  lines.push(
    `Now (${topNow.length}): ${
      topNow.length ? topNow.map((x) => `${x.key} ${x.title}`).join("; ") : "Clear"
    }.`
  );
  if (promises48h.length) {
    lines.push(
      `Promises <=48h: ${promises48h.map((x) => `${x.key} to ${x.who} (${x.due})`).join("; ")}.`
    );
  }
  if (repliesOwed.length) {
    lines.push(
      `Replies owed: ${repliesOwed.map((x) => `${x.who} (${x.daysWaiting}d)`).join(", ")}.`
    );
  }
  if (waitingOnClients.length) {
    lines.push(
      `Waiting on clients: ${waitingOnClients.map((w) => `${w.label} · ${w.days}d`).join("; ")}.`
    );
  }
  if (lateProjects.length) {
    lines.push(
      `Late forecasts: ${lateProjects
        .map((l) => `${l.label} (est ${l.forecastDate}${l.deadlineDate ? ` vs ${l.deadlineDate}` : ""})`)
        .join("; ")}.`
    );
  } else {
    lines.push("Forecasts: No active late projects.");
  }

  // Enforce strict <=200 words cap
  const rawText = lines.join("\n");
  const words = rawText.trim().split(/\s+/);
  const briefText = words.length <= 200 ? rawText : `${words.slice(0, 198).join(" ")}…`;
  const wordCount = Math.min(200, words.length);

  return {
    dateLabel,
    topNow,
    promises48h,
    repliesOwed,
    waitingOnClients: waitingOnClients.slice(0, 6),
    lateProjects,
    briefText,
    wordCount,
  };
}
