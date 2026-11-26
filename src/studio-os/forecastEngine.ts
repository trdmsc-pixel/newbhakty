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

export interface StageTimeline {
  gate_id: string;
  code: string;
  name: string;
  status: string;
  needs_approval: boolean;
  /** Manual planned end date (set by the studio), or the plan derived from estimates. */
  planned_end: string | null;
  planned_is_manual: boolean;
  /** Where this stage will really end, given client approval behaviour so far. */
  projected_end: string;
  /** Days the client took (or has taken so far) on this stage's approval. */
  client_wait_days?: number;
  done: boolean;
}

export interface ClientPace {
  /** Average days this client takes to approve (from history across their projects). */
  avg_wait_days: number;
  /** What the plan allows for an approval. */
  allowance_days: number;
  /** Average revision rounds per approval stage. */
  avg_rounds: number;
  samples: number;
}

export interface ProjectForecastResult {
  /** Projected delivery date (manual plan shifted by real approval behaviour). */
  forecast_date: string;
  health: ProjectHealth;
  remaining_work_days: number;
  approval_wait_days: number;
  holiday_days: number;
  holiday_names: string[];
  explanation: string;
  /** The studio's manual delivery date (promised date, else last stage date, else deadline). */
  planned_date: string | null;
  /** projected − planned, in calendar days (negative = ahead). */
  shift_days: number;
  /** Delay already caused by slow approvals / extra revision rounds. */
  client_delay_days: number;
  /** Extra delay expected on remaining approvals, from this client's pace. */
  projected_client_delay_days: number;
  /** Delay on the studio's side (work running past planned stage dates). */
  studio_delay_days: number;
  pace: ClientPace;
  stages: StageTimeline[];
  reasons: string[];
}

export function getClientHolidayRegion(timezone?: string | null): HolidayRegion {
  if (!timezone) return "IN";
  const tz = timezone.toLowerCase();
  if (tz.includes("argentina") || tz.includes("buenos_aires")) return "AR";
  if (tz.includes("america/")) return "US";
  return "IN";
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const day = (s?: string | null) => (s ? parseISO(String(s).slice(0, 10)) : null);
const daysBetween = (a?: string | null, b?: string | null) => {
  const da = day(a);
  const db = day(b);
  return da && db ? Math.max(0, differenceInCalendarDays(db, da)) : 0;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Client approval pace from history (all of this client's projects), blended with the default when history is thin. */
export function computeClientPace(
  clientId: string | null | undefined,
  gates: StudioGate[],
  projects: StudioProject[] | undefined,
  client: StudioClient | undefined,
  settings: StudioSettings
): ClientPace {
  const allowance = Math.max(0.5, Number(settings.default_approval_latency_days) || 2);
  const projectIds = new Set((projects || []).filter((p) => clientId && p.client_id === clientId).map((p) => p.id));
  const history = gates.filter((g) => g.needs_client_approval && projectIds.has(g.project_id) && g.status === "approved" && g.sent_for_approval_at && g.approved_at);
  let reviewDays = 0;
  let reviews = 0;
  let rounds = 0;
  for (const g of history) {
    const r = Math.max(0, g.revision_round || 0);
    const rework = reworkDays(g);
    // Time between "sent" and "approved" minus the studio's rework on each revision round.
    reviewDays += Math.max(0, daysBetween(g.sent_for_approval_at, g.approved_at) - r * rework);
    reviews += r + 1;
    rounds += r;
  }
  const prior = client?.avg_approval_latency_days ?? allowance;
  // Blend with two "virtual" reviews at the prior, so one slow approval doesn't dominate.
  const avgWait = (reviewDays + prior * 2) / (reviews + 2);
  const avgRounds = (rounds + 1 * 2) / (history.length + 2);
  return { avg_wait_days: round1(avgWait), allowance_days: allowance, avg_rounds: round1(avgRounds), samples: history.length };
}

/** Studio rework time for one revision round of a stage. */
const reworkDays = (g: StudioGate) => Math.max(1, Math.round((Number(g.estimate_days) || 1) * 0.3));

/**
 * Delivery timeline (manual plan + real approval behaviour).
 *
 *  1. PLAN — the studio's manual dates: each stage's due date (or, if not set, its estimate
 *     chained from the previous stage) and the project's promised delivery date.
 *  2. REALITY — every client approval is measured: days from "sent" to "approved" beyond the
 *     plan's allowance, extra revision rounds beyond those included, and the days a stage
 *     has been waiting right now. These push every later date out.
 *  3. EXPECTATION — remaining approvals are projected with THIS client's own pace
 *     (average days to approve and average revision rounds, learned from history).
 *  The studio's own slippage (a stage in work past its planned date) is tracked separately.
 */
export function computeProjectForecast(
  project: StudioProject,
  gates: StudioGate[],
  client: StudioClient | undefined,
  settings: StudioSettings,
  holidaysOrToday?: StudioHoliday[] | Date,
  maybeToday: Date = new Date(),
  allProjects?: StudioProject[]
): ProjectForecastResult {
  const holidays = Array.isArray(holidaysOrToday) ? holidaysOrToday : [];
  const today = holidaysOrToday instanceof Date ? holidaysOrToday : maybeToday;
  const todayIso = iso(today);
  const pace = computeClientPace(project.client_id, gates, allProjects || [project], client, settings);

  const regions = new Set<HolidayRegion>(["IN", "GLOBAL", getClientHolidayRegion(client?.timezone)]);
  const holidayByDate = new Map<string, string>();
  for (const h of holidays) {
    if (!h.is_active || !regions.has(h.region)) continue;
    const k = h.holiday_date.slice(0, 10);
    if (!holidayByDate.has(k)) holidayByDate.set(k, `${h.name} (${h.region})`);
  }
  const workDays = new Set(settings.work_days && settings.work_days.length ? settings.work_days : [1, 2, 3, 4, 5]);
  const matchedHolidays = new Set<string>();
  /** Add working days (skips non-working weekdays and holidays). */
  const addWork = (from: Date, n: number) => {
    let cursor = from;
    let left = Math.max(0, Math.ceil(n));
    let safety = 0;
    while (left > 0 && safety < 400) {
      safety++;
      cursor = addDays(cursor, 1);
      const k = iso(cursor);
      const wd = ((cursor.getDay() + 6) % 7) + 1;
      if (holidayByDate.has(k)) {
        matchedHolidays.add(holidayByDate.get(k)!);
        continue;
      }
      if (!workDays.has(wd)) continue;
      left--;
    }
    return cursor;
  };
  const later = (a: Date, b: Date) => (a > b ? a : b);

  const ordered = gates
    .filter((g) => g.project_id === project.id && !["G9", "G10"].includes(g.code))
    .sort((a, b) => a.order_index - b.order_index);

  const done = project.status === "delivered" || project.status === "paid" || Boolean(project.closed_at);
  const reasons: string[] = [];
  let clientDelay = 0;
  let projectedClientDelay = 0;
  let studioDelay = 0;
  let remainingWork = 0;
  let approvalWait = 0;
  const extraWait = Math.max(0, pace.avg_wait_days - pace.allowance_days);
  // The plan is assumed to cover one revision round per approval stage.
  const extraRounds = Math.max(0, pace.avg_rounds - 1);

  // Plan cursor starts at the first stage start (or project creation / today).
  const firstStart = ordered.find((g) => g.started_at)?.started_at;
  let planCursor = day(firstStart) || day((project as any).created_at) || today;
  let projCursor = planCursor;
  const stages: StageTimeline[] = [];

  for (const g of ordered) {
    const est = Math.max(0.5, Number(g.estimate_days) || 1);
    const manual = g.due_date ? day(g.due_date)! : null;
    const derivedPlan = addWork(planCursor, est + (g.needs_client_approval ? pace.allowance_days : 0));
    const plannedEnd = manual || derivedPlan;
    let projectedEnd: Date;
    let clientWait: number | undefined;
    const isDone = g.status === "approved" || g.status === "skipped";

    if (isDone) {
      projectedEnd = day(g.approved_at) || later(projCursor, plannedEnd);
      const slip = Math.max(0, differenceInCalendarDays(projectedEnd, plannedEnd));
      if (g.needs_client_approval && g.sent_for_approval_at && g.approved_at) {
        const r = Math.max(0, g.revision_round || 0);
        const total = daysBetween(g.sent_for_approval_at, g.approved_at);
        const reviewTime = Math.max(0, total - r * reworkDays(g));
        clientWait = Math.round(reviewTime);
        const slowReviews = Math.max(0, reviewTime - pace.allowance_days * Math.min(r + 1, (g.revisions_included || 0) + 1));
        const overRounds = Math.max(0, r - (g.revisions_included || 0));
        // Only delay that actually moved this stage past its plan counts.
        const fromReviews = Math.min(slip, slowReviews);
        const fromRounds = Math.min(slip - fromReviews, overRounds * (reworkDays(g) + pace.allowance_days));
        const studioPart = Math.max(0, slip - fromReviews - fromRounds);
        if (fromReviews >= 1) {
          clientDelay += fromReviews;
          reasons.push(`${g.name}: client reviews took ${clientWait}d over ${r + 1} review${r ? "s" : ""} → +${Math.round(fromReviews)}d`);
        }
        if (fromRounds >= 1) {
          clientDelay += fromRounds;
          reasons.push(`${g.name}: ${overRounds} revision round${overRounds > 1 ? "s" : ""} beyond the ${g.revisions_included} included → +${Math.round(fromRounds)}d`);
        }
        if (studioPart >= 1) {
          studioDelay += studioPart;
          reasons.push(`${g.name}: finished ${slip}d after plan (${Math.round(studioPart)}d on the studio side)`);
        }
      } else if (slip >= 1 && g.due_date) {
        studioDelay += slip;
        reasons.push(`${g.name}: finished ${slip}d after its planned date`);
      }
    } else if (g.status === "waiting_on_client") {
      clientWait = daysBetween(g.sent_for_approval_at, todayIso);
      const over = Math.max(0, clientWait - pace.allowance_days);
      if (over >= 1) {
        clientDelay += over;
        reasons.push(`${g.name}: waiting on the client for ${clientWait}d (plan allows ${pace.allowance_days}d) → +${Math.round(over)}d so far`);
      }
      const stillExpected = Math.max(1, Math.ceil(pace.avg_wait_days - clientWait));
      approvalWait += stillExpected;
      projectedEnd = addWork(later(projCursor, today), stillExpected);
      // Revision rounds this client typically needs beyond the planned one.
      const roundsLeft = Math.max(0, pace.avg_rounds - Math.max(1, g.revision_round || 0));
      const cost = Math.round(roundsLeft * (reworkDays(g) + pace.avg_wait_days));
      if (cost >= 1) {
        projectedClientDelay += cost;
        projectedEnd = addWork(projectedEnd, cost);
      }
    } else {
      // not_started / in_work / revising — studio work, then (maybe) a client approval.
      let work = est;
      if (g.status === "revising") work = Math.max(1, Math.round(est * 0.3));
      if (g.status === "in_work" && g.started_at) {
        const elapsed = daysBetween(g.started_at, todayIso);
        work = Math.max(1, est - elapsed);
      }
      remainingWork += work;
      projectedEnd = addWork(later(projCursor, today), work);
      if (g.needs_client_approval) {
        approvalWait += pace.avg_wait_days;
        projectedEnd = addWork(projectedEnd, pace.avg_wait_days);
        const cost = extraWait + extraRounds * (reworkDays(g) + pace.avg_wait_days);
        if (cost >= 0.5) {
          projectedClientDelay += cost;
          // avg_wait_days (already added) includes the slow-approval part; add the extra rounds.
          projectedEnd = addWork(projectedEnd, cost - extraWait);
        }
      }
      // Studio-side lateness: stage in work past its manual date.
      if (manual && (g.status === "in_work" || g.status === "revising") && today > manual) {
        const late = differenceInCalendarDays(today, manual);
        studioDelay += late;
        reasons.push(`${g.name}: ${late}d past its planned date (studio side)`);
      }
    }
    // Never project earlier than the manual plan.
    if (!isDone) projectedEnd = later(projectedEnd, plannedEnd);
    stages.push({
      gate_id: g.id,
      code: g.code,
      name: g.name,
      status: g.status,
      needs_approval: g.needs_client_approval,
      planned_end: iso(plannedEnd),
      planned_is_manual: Boolean(manual),
      projected_end: iso(projectedEnd),
      client_wait_days: clientWait,
      done: isDone,
    });
    planCursor = plannedEnd;
    projCursor = projectedEnd;
  }

  if (projectedClientDelay >= 1) {
    reasons.push(
      `This client averages ${pace.avg_wait_days}d per approval and ${pace.avg_rounds} round${pace.avg_rounds === 1 ? "" : "s"} per stage${pace.samples ? ` (from ${pace.samples} past approvals)` : ""} → about +${Math.round(projectedClientDelay)}d expected on the remaining stages`
    );
  }

  const lastPlanned = stages.length ? stages[stages.length - 1].planned_end : null;
  const plannedDate = project.promised_date || lastPlanned || project.hard_deadline || null;
  let projected = stages.length ? day(stages[stages.length - 1].projected_end)! : today;

  if (done) {
    const d = project.closed_at?.slice(0, 10) || project.promised_date || project.hard_deadline || todayIso;
    return {
      forecast_date: d,
      health: "on_track",
      remaining_work_days: 0,
      approval_wait_days: 0,
      holiday_days: 0,
      holiday_names: [],
      explanation: "Delivered.",
      planned_date: plannedDate,
      shift_days: 0,
      client_delay_days: round1(clientDelay),
      projected_client_delay_days: 0,
      studio_delay_days: 0,
      pace,
      stages,
      reasons,
    };
  }

  // Manual promised date is the baseline: real delays push it out, the projection never pulls it in.
  if (project.promised_date) {
    const promised = day(project.promised_date)!;
    const lastPlannedDate = lastPlanned ? day(lastPlanned)! : promised;
    const chainSlip = Math.max(0, differenceInCalendarDays(projected, lastPlannedDate));
    projected = later(promised, addDays(promised, chainSlip));
  }
  const forecast = iso(projected);
  const shift = plannedDate ? differenceInCalendarDays(projected, day(plannedDate)!) : 0;

  const target = project.hard_deadline || project.promised_date;
  let health: ProjectHealth = "on_track";
  if (target) {
    const delta = differenceInCalendarDays(projected, day(target)!);
    if (delta <= -3) health = "on_track";
    else if (delta <= 0) health = "tight";
    else if (delta <= 3) health = "at_risk";
    else health = "late";
  } else if (shift > 3) health = "at_risk";
  else if (shift > 0) health = "tight";

  const parts: string[] = [];
  if (plannedDate) parts.push(`Planned ${format(day(plannedDate)!, "d MMM")}`);
  if (shift > 0) parts.push(`+${shift}d`);
  if (clientDelay >= 1) parts.push(`${Math.round(clientDelay)}d from client approvals so far`);
  if (projectedClientDelay >= 1) parts.push(`~${Math.round(projectedClientDelay)}d expected from this client's pace`);
  if (studioDelay >= 1) parts.push(`${studioDelay}d studio-side`);
  if (!parts.length || (shift <= 0 && clientDelay < 1)) parts.push("on plan");

  return {
    forecast_date: forecast,
    health,
    remaining_work_days: round1(remainingWork),
    approval_wait_days: round1(approvalWait),
    holiday_days: matchedHolidays.size,
    holiday_names: [...matchedHolidays],
    explanation: parts.join(" · "),
    planned_date: plannedDate,
    shift_days: shift,
    client_delay_days: round1(clientDelay),
    projected_client_delay_days: round1(projectedClientDelay),
    studio_delay_days: studioDelay,
    pace,
    stages,
    reasons,
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
    const f = computeProjectForecast(p, gates, cl, settings, holidays, today, projects);
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
