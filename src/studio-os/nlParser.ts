import * as chrono from "chrono-node";
import { format } from "date-fns";
import { StudioGate, StudioProject, TaskPriority, TaskStatus, TaskType } from "./types";

export interface ParsedQuickAdd {
  title: string;
  projectCode?: string;
  projectId?: string;
  gateHint?: string;
  gateId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueLabel?: string;
  estimateHours: number;
  priority: TaskPriority;
  type: TaskType;
  status: TaskStatus;
  promisedToClient: boolean;
  waitingOnClient: boolean;
}

/**
 * Natural-language one-line task parser.
 * Example:
 *   "Arculus USB version first draft Mon 30 Nov 4h #ARC !urgent @client"
 * Tokens:
 *   #CODE           -> project code
 *   !urgent|!high|!low -> priority
 *   @client         -> marks as promise to client
 *   ~3h or 4h or 1.5h -> estimate hours
 *   >waiting | >review | >progress | >backlog -> status
 *   g:storyboard    -> gate hint
 *   Natural dates   -> parsed via chrono-node
 */
export function parseQuickAdd(
  input: string,
  projects: StudioProject[],
  gates: StudioGate[],
  referenceDate: Date = new Date()
): ParsedQuickAdd {
  let working = input.trim();

  // 1. Project code (#ARC)
  let projectCode: string | undefined;
  let projectId: string | undefined;
  const projMatch = working.match(/#([A-Za-z0-9]{2,6})\b/);
  if (projMatch) {
    const code = projMatch[1].toUpperCase();
    const matched = projects.find((p) => p.code.toUpperCase() === code);
    projectCode = matched ? matched.code : code;
    projectId = matched?.id;
    working = working.replace(projMatch[0], " ");
  } else {
    // Soft match project title/code prefix if mentioned
    const lower = working.toLowerCase();
    const byName = projects.find(
      (p) =>
        p.code !== "INT" &&
        (lower.includes(p.title.toLowerCase().split(" ")[0]) || lower.includes(p.code.toLowerCase()))
    );
    if (byName && byName.title.split(" ")[0].length >= 4) {
      projectCode = byName.code;
      projectId = byName.id;
    }
  }

  // 2. Priority (!urgent | !high | !normal | !low)
  let priority: TaskPriority = "normal";
  const prioMatch = working.match(/!(urgent|high|normal|low)\b/i);
  if (prioMatch) {
    priority = prioMatch[1].toLowerCase() as TaskPriority;
    working = working.replace(prioMatch[0], " ");
  }

  // 3. Promise (@client)
  let promisedToClient = false;
  let type: TaskType = "task";
  if (/@client\b/i.test(working)) {
    promisedToClient = true;
    type = "promise";
    working = working.replace(/@client\b/i, " ");
  } else if (/\b(reply|respond)\b/i.test(working)) {
    type = "reply_owed";
  }

  // 4. Status (>waiting | >review | >progress | >backlog | >done)
  let status: TaskStatus = "todo";
  let waitingOnClient = false;
  const statusMatch = working.match(/>(waiting|review|progress|backlog|revising|done)\b/i);
  if (statusMatch) {
    const token = statusMatch[1].toLowerCase();
    if (token === "waiting") {
      status = "waiting_on_client";
      waitingOnClient = true;
    } else if (token === "review") status = "in_review";
    else if (token === "progress") status = "in_progress";
    else if (token === "backlog") status = "backlog";
    else if (token === "revising") status = "revising";
    else if (token === "done") status = "done";
    working = working.replace(statusMatch[0], " ");
  }

  // 5. Gate hint (g:storyboard)
  let gateHint: string | undefined;
  let gateId: string | undefined;
  const gateMatch = working.match(/\bg:([a-zA-Z0-9_-]+)/i);
  if (gateMatch) {
    gateHint = gateMatch[1].toLowerCase();
    working = working.replace(gateMatch[0], " ");
    const candidateGates = projectId ? gates.filter((g) => g.project_id === projectId) : gates;
    const foundGate = candidateGates.find(
      (g) =>
        g.name.toLowerCase().includes(gateHint!) || g.code.toLowerCase() === gateHint
    );
    if (foundGate) {
      gateId = foundGate.id;
      gateHint = `${foundGate.code} ${foundGate.name}`;
    }
  }

  // 6. Estimate hours (~3h, 4h, 1.5h, 30m)
  let estimateHours = 1;
  const hourMatch = working.match(/(?:^|\s)~?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours)\b/i);
  const minMatch = working.match(/(?:^|\s)~?(\d+)\s*(m|min|mins)\b/i);
  if (hourMatch) {
    estimateHours = Math.max(0.25, parseFloat(hourMatch[1]));
    working = working.replace(hourMatch[0], " ");
  } else if (minMatch) {
    estimateHours = Math.max(0.25, Math.round((parseInt(minMatch[1], 10) / 60) * 4) / 4);
    working = working.replace(minMatch[0], " ");
  }

  // 7. Natural-language date via chrono-node
  let dueDate: string | undefined;
  let dueLabel: string | undefined;
  const parsedDates = chrono.parse(working, referenceDate, { forwardDate: true });
  if (parsedDates.length > 0) {
    const best = parsedDates[0];
    const dt = best.start.date();
    dueDate = format(dt, "yyyy-MM-dd");
    dueLabel = format(dt, "EEE d MMM");
    working = working.replace(best.text, " ");
  }

  // Clean up remaining whitespace
  const title = working.replace(/\s+/g, " ").trim() || input.trim();

  return {
    title,
    projectCode,
    projectId,
    gateHint,
    gateId,
    dueDate,
    dueLabel,
    estimateHours,
    priority,
    type,
    status,
    promisedToClient,
    waitingOnClient,
  };
}
