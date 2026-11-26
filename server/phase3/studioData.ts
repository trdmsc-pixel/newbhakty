import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextHints } from "../../lib/ai/index.js";

export const OWN_DOMAINS = new Set(["thechantingstudio.in"]);
export const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "aol.com",
]);

export interface CtxContact {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
}
export interface CtxClient {
  id: string;
  name: string;
  organisation: string;
  email_domains: string[];
  timezone: string;
  is_confidential: boolean;
  contacts: CtxContact[];
}
export interface CtxProject {
  id: string;
  code: string;
  title: string;
  client_id: string | null;
  status: string;
  is_confidential: boolean;
  fee_amount: number | null;
  current_gate_id: string | null;
  hard_deadline: string | null;
  promised_date: string | null;
  forecast_date: string | null;
}
export interface StudioCtx {
  timezone: string;
  aiProvider: "claude" | "gemini";
  clients: CtxClient[];
  projects: CtxProject[];
  ownerMemberId: string | null;
  fallbackProjectId: string | null;
}

export async function loadStudioCtx(sb: SupabaseClient): Promise<StudioCtx> {
  const [settingsRes, clientsRes, contactsRes, projectsRes, membersRes] = await Promise.all([
    sb.from("studio_settings").select("timezone, ai_provider").is("archived_at", null).limit(1).maybeSingle(),
    sb.from("studio_clients").select("id, name, organisation, email_domains, timezone, is_confidential").is("archived_at", null),
    sb.from("studio_client_contacts").select("id, client_id, name, email").is("archived_at", null),
    sb
      .from("studio_projects")
      .select("id, code, title, client_id, status, is_confidential, fee_amount, current_gate_id, hard_deadline, promised_date, forecast_date")
      .is("archived_at", null),
    sb.from("studio_members").select("id, role").eq("is_active", true).is("archived_at", null),
  ]);

  const contacts = (contactsRes.data || []) as CtxContact[];
  const clients: CtxClient[] = (clientsRes.data || []).map((c: any) => ({
    ...c,
    email_domains: (c.email_domains || []).map((d: string) => d.toLowerCase().trim()),
    contacts: contacts.filter((ct) => ct.client_id === c.id),
  }));
  const projects = (projectsRes.data || []) as CtxProject[];
  const members = membersRes.data || [];
  const owner = members.find((m: any) => m.role === "owner") || members[0];
  const internal = projects.find((p) => p.code === "INT");
  const firstActive = projects.find((p) => p.status === "active");

  return {
    timezone: settingsRes.data?.timezone || "Asia/Kolkata",
    aiProvider: settingsRes.data?.ai_provider === "claude" ? "claude" : "gemini",
    clients,
    projects,
    ownerMemberId: owner?.id || null,
    fallbackProjectId: internal?.id || firstActive?.id || projects[0]?.id || null,
  };
}

export function todayInTz(tz: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts; // en-CA gives YYYY-MM-DD
}

export function ctxHints(ctx: StudioCtx): ContextHints {
  const clientName = (id: string | null) => ctx.clients.find((c) => c.id === id)?.name;
  return {
    clients: ctx.clients.map((c) => ({ name: c.name, organisation: c.organisation })),
    projects: ctx.projects
      .filter((p) => !["lost", "paid"].includes(p.status))
      .map((p) => ({ code: p.code, title: p.title, client: clientName(p.client_id) })),
    today: todayInTz(ctx.timezone),
    timezone: ctx.timezone,
  };
}

export function emailDomain(email: string): string {
  return (email.split("@")[1] || "").toLowerCase().trim();
}

/** Match a client by exact contact email first, then by sender domain (ignores own + generic domains). */
export function matchClientByEmails(ctx: StudioCtx, emails: string[]): { client: CtxClient; contact?: CtxContact } | null {
  const normalized = emails.map((e) => e.toLowerCase().trim()).filter(Boolean);
  for (const e of normalized) {
    for (const c of ctx.clients) {
      const contact = c.contacts.find((ct) => (ct.email || "").toLowerCase() === e);
      if (contact) return { client: c, contact };
    }
  }
  for (const e of normalized) {
    const d = emailDomain(e);
    if (!d || OWN_DOMAINS.has(d) || GENERIC_DOMAINS.has(d)) continue;
    const client = ctx.clients.find((c) => c.email_domains.some((cd) => d === cd || d.endsWith(`.${cd}`)));
    if (client) return { client };
  }
  return null;
}

export function matchClientByName(ctx: StudioCtx, hint: string | null | undefined): CtxClient | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  return (
    ctx.clients.find((c) => c.name.toLowerCase() === h || c.organisation.toLowerCase() === h) ||
    ctx.clients.find((c) => h.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(h)) ||
    null
  );
}

const STOP = new Set(["the", "and", "for", "with", "film", "video", "project", "from", "this", "that", "your", "series", "episode", "version"]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));

/** AI hint → code in text → fuzzy title match → client's only open project. */
export function matchProject(
  ctx: StudioCtx,
  text: string,
  opts: { clientId?: string | null; aiHint?: string | null } = {}
): CtxProject | null {
  const open = ctx.projects.filter((p) => !["lost", "paid"].includes(p.status));
  const scoped = opts.clientId ? open.filter((p) => p.client_id === opts.clientId) : open;

  if (opts.aiHint) {
    const hint = opts.aiHint.trim().toUpperCase();
    const byCode = open.find((p) => p.code.toUpperCase() === hint || hint.startsWith(`${p.code.toUpperCase()}:`));
    if (byCode) return byCode;
    const byTitle = open.find((p) => p.title.toLowerCase() === opts.aiHint!.trim().toLowerCase());
    if (byTitle) return byTitle;
  }

  for (const p of open) {
    if (p.code.length >= 3 && new RegExp(`(^|[^A-Za-z])${p.code}(-\\d+)?([^A-Za-z]|$)`).test(text)) return p;
  }

  const textTokens = new Set(tokens(text));
  let best: { p: CtxProject; score: number } | null = null;
  for (const p of scoped.length ? scoped : open) {
    const tt = tokens(p.title);
    if (!tt.length) continue;
    const hits = tt.filter((t) => textTokens.has(t)).length;
    const score = hits / tt.length + (opts.clientId && p.client_id === opts.clientId ? 0.25 : 0);
    if (hits >= 1 && score >= 0.5 && (!best || score > best.score)) best = { p, score };
  }
  if (best) return best.p;

  if (opts.clientId) {
    const active = scoped.filter((p) => ["active", "quoted", "lead", "on_hold"].includes(p.status));
    if (active.length === 1) return active[0];
  }
  return null;
}

export function isConfidential(ctx: StudioCtx, clientId?: string | null, projectId?: string | null): boolean {
  const c = ctx.clients.find((x) => x.id === clientId);
  const p = ctx.projects.find((x) => x.id === projectId);
  return Boolean(c?.is_confidential || p?.is_confidential);
}

export function feeNumbersFor(ctx: StudioCtx, clientId?: string | null): number[] {
  return ctx.projects.filter((p) => p.client_id === clientId && p.fee_amount).map((p) => Number(p.fee_amount));
}

export interface NewTaskInput {
  projectId?: string | null;
  gateId?: string | null;
  title: string;
  description?: string;
  type?: "task" | "promise" | "reply_owed" | "follow_up" | "admin";
  priority?: "urgent" | "high" | "normal" | "low";
  dueDate?: string | null;
  estimateHours?: number | null;
  source: "manual" | "email" | "whatsapp" | "website" | "portal" | "ai";
  sourceRef?: string | null;
  promisedToContactId?: string | null;
  promisedToName?: string | null;
  channel?: "gmail" | "whatsapp" | "portal" | "internal";
}

export async function createTask(sb: SupabaseClient, ctx: StudioCtx, input: NewTaskInput): Promise<{ id: string; key: string; project_id: string }> {
  const projectId = input.projectId || ctx.fallbackProjectId;
  const project = ctx.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("No project available to attach the task to.");

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: keys } = await sb.from("studio_tasks").select("key").like("key", `${project.code}-%`);
    const max = (keys || []).reduce((m: number, r: any) => {
      const n = parseInt(String(r.key).slice(project.code.length + 1), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const key = `${project.code}-${max + 1 + attempt}`;
    const due = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
    const { data, error } = await sb
      .from("studio_tasks")
      .insert({
        key,
        project_id: project.id,
        gate_id: input.gateId || null,
        title: input.title.slice(0, 160),
        description: input.description?.slice(0, 1000) || null,
        type: input.type || "task",
        status: "todo",
        priority: input.priority || "normal",
        do_date: due,
        due_date: due,
        estimate_hours: input.estimateHours && input.estimateHours > 0 ? Math.min(200, input.estimateHours) : 1,
        assignee_member_id: ctx.ownerMemberId,
        source: input.source,
        source_ref: input.sourceRef || null,
        promised_to_contact_id: input.promisedToContactId || null,
        promised_to_name: input.promisedToName || null,
        channel: input.channel || "internal",
        portal_visible: false,
      })
      .select("id, key, project_id")
      .single();
    if (!error && data) return data as any;
    if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
  }
  throw new Error("Could not allocate a task key.");
}

export async function logActivity(
  sb: SupabaseClient,
  entry: { actor?: "member" | "client" | "system" | "ai"; actorName?: string; entityType: string; entityId?: string | null; action: string; diff?: unknown }
) {
  await sb.from("studio_activity_log").insert({
    actor: entry.actor || "ai",
    actor_name: entry.actorName || "Studio OS AI",
    entity_type: entry.entityType,
    entity_id: entry.entityId || null,
    action: entry.action.slice(0, 300),
    diff: entry.diff ?? null,
  });
}

/** Hours elapsed since `fromIso`, counting only weekday hours in the given timezone. */
export function businessHoursSince(fromIso: string, tz: string, now = new Date()): number {
  const start = new Date(fromIso).getTime();
  if (!Number.isFinite(start)) return 0;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz || "Asia/Kolkata", weekday: "short" });
  let hours = 0;
  const cap = Math.min(now.getTime(), start + 21 * 24 * 3600 * 1000);
  for (let t = start; t + 3600 * 1000 <= cap; t += 3600 * 1000) {
    const wd = fmt.format(new Date(t));
    if (wd !== "Sat" && wd !== "Sun") hours++;
  }
  return hours;
}
