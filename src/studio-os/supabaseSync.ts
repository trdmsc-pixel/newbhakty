import { supabase, isSupabaseConfigured } from "../lib/supabase";
import {
  INITIAL_ACTIVITY,
  INITIAL_CLIENTS,
  INITIAL_GATES,
  INITIAL_MEMBERS,
  INITIAL_PAYMENTS,
  INITIAL_PROJECTS,
  INITIAL_SETTINGS,
  INITIAL_TASKS,
} from "./seedData";
import {
  ActivityLogItem,
  ClientContact,
  StudioClient,
  StudioGate,
  StudioMember,
  StudioPayment,
  StudioProject,
  StudioSettings,
  StudioTask,
} from "./types";
import { isUuid, newUuid } from "./uuid";

export interface StudioOSCloudSnapshot {
  settings: StudioSettings;
  members: StudioMember[];
  clients: StudioClient[];
  projects: StudioProject[];
  gates: StudioGate[];
  tasks: StudioTask[];
  payments: StudioPayment[];
  activity: ActivityLogItem[];
}

const MEMBER_COLORS = ["#5B3FE4", "#2F6BFF", "#22875A", "#D97706", "#E5484D"];

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toHm(val: string | null | undefined, fallback: string): string {
  if (!val) return fallback;
  return val.slice(0, 5);
}

function toDateOnly(val: string | null | undefined): string | undefined {
  if (!val) return undefined;
  return val.slice(0, 10);
}

function toSettingsRow(s: StudioSettings) {
  return {
    id: s.id,
    overrun_factor: s.overrun_factor,
    default_approval_latency_days: s.default_approval_latency_days,
    work_hours_per_day: s.work_hours_per_day,
    studio_closes_at: s.studio_closes_at,
    wip_limit: s.wip_limit,
    takes_per_keeper: s.takes_per_keeper,
    block_seconds: s.block_seconds,
    timezone: s.timezone,
    ai_provider: s.ai_provider,
    brief_time: s.brief_time,
    usd_to_inr: s.usd_to_inr,
    eur_to_inr: s.eur_to_inr,
    expenses_enabled: s.expenses_enabled,
  };
}

function fromSettingsRow(row: any): StudioSettings {
  return {
    id: row.id,
    overrun_factor: Number(row.overrun_factor ?? INITIAL_SETTINGS.overrun_factor),
    default_approval_latency_days: Number(
      row.default_approval_latency_days ?? INITIAL_SETTINGS.default_approval_latency_days
    ),
    work_hours_per_day: Number(row.work_hours_per_day ?? INITIAL_SETTINGS.work_hours_per_day),
    studio_closes_at: toHm(row.studio_closes_at, INITIAL_SETTINGS.studio_closes_at),
    wip_limit: Number(row.wip_limit ?? INITIAL_SETTINGS.wip_limit),
    takes_per_keeper: Number(row.takes_per_keeper ?? INITIAL_SETTINGS.takes_per_keeper),
    block_seconds: Number(row.block_seconds ?? INITIAL_SETTINGS.block_seconds),
    timezone: row.timezone || INITIAL_SETTINGS.timezone,
    ai_provider: row.ai_provider === "claude" ? "claude" : "gemini",
    brief_time: toHm(row.brief_time, INITIAL_SETTINGS.brief_time),
    usd_to_inr: Number(row.usd_to_inr ?? INITIAL_SETTINGS.usd_to_inr),
    eur_to_inr: Number(row.eur_to_inr ?? INITIAL_SETTINGS.eur_to_inr),
    expenses_enabled: Boolean(row.expenses_enabled),
  };
}

function toMemberRow(m: StudioMember, authUserId?: string | null) {
  return {
    id: m.id,
    user_id: m.role === "owner" && authUserId ? authUserId : null,
    name: m.name,
    email: m.email || null,
    role: m.role,
    avatar_url: m.avatar_url || null,
    hourly_capacity: m.hourly_capacity,
    is_active: m.is_active,
  };
}

function fromMemberRow(row: any, idx: number): StudioMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    role: row.role || "owner",
    avatar_url: row.avatar_url || undefined,
    initials: deriveInitials(row.name || "SS"),
    color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
    hourly_capacity: Number(row.hourly_capacity ?? 7),
    is_active: row.is_active !== false,
  };
}

function toClientRow(c: StudioClient) {
  return {
    id: c.id,
    name: c.name,
    organisation: c.organisation,
    email_domains: c.email_domains || [],
    timezone: c.timezone || "Asia/Kolkata",
    currency: c.currency || "INR",
    avg_approval_latency_days: c.avg_approval_latency_days ?? 2,
    is_confidential: Boolean(c.is_confidential),
    notes: c.notes ?? null,
    color: c.color || "#5B3FE4",
  };
}

function toContactRow(ct: ClientContact) {
  return {
    id: ct.id,
    client_id: ct.client_id,
    name: ct.name,
    email: ct.email ?? null,
    phone: ct.phone ?? null,
    whatsapp: ct.whatsapp ?? null,
    role: ct.role ?? null,
    is_portal_user: Boolean(ct.is_portal_user),
  };
}

function fromContactRow(row: any): ClientContact {
  return {
    id: row.id,
    client_id: row.client_id,
    name: row.name,
    email: row.email || undefined,
    phone: row.phone || undefined,
    whatsapp: row.whatsapp || undefined,
    role: row.role || undefined,
    is_portal_user: Boolean(row.is_portal_user),
  };
}

function fromClientRow(row: any, contacts: ClientContact[]): StudioClient {
  return {
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    email_domains: Array.isArray(row.email_domains) ? row.email_domains : [],
    timezone: row.timezone || "Asia/Kolkata",
    currency: row.currency || "INR",
    avg_approval_latency_days: Number(row.avg_approval_latency_days ?? 2),
    is_confidential: Boolean(row.is_confidential),
    notes: row.notes || undefined,
    color: row.color || "#5B3FE4",
    contacts,
  };
}

function toProjectRow(p: StudioProject) {
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    client_id: isUuid(p.client_id) ? p.client_id : null,
    type: p.type,
    status: p.status,
    fee_amount: p.fee_amount ?? null,
    currency: p.currency,
    runtime_seconds: p.runtime_seconds ?? null,
    versions: p.versions ?? 1,
    aspect_ratios: p.aspect_ratios || ["16:9"],
    hard_deadline: p.hard_deadline ?? null,
    promised_date: p.promised_date ?? null,
    forecast_date: p.forecast_date ?? null,
    health: p.health || "on_track",
    current_gate_id: isUuid(p.current_gate_id) ? p.current_gate_id : null,
    cover_image_url: p.cover_image_url ?? null,
    emoji: p.emoji || "🎬",
    drive_folder_url: p.drive_folder_url ?? null,
    review_link_url: p.review_link_url ?? null,
    is_confidential: Boolean(p.is_confidential),
    portal_visible: Boolean(p.portal_visible),
    priority: p.priority || "p2",
    owner_member_id: isUuid(p.owner_member_id) ? p.owner_member_id : null,
    pinned: Boolean(p.pinned),
    last_client_touch_at: p.last_client_touch_at ?? null,
    last_studio_touch_at: p.last_studio_touch_at ?? null,
    updated_at: p.updated_at || new Date().toISOString(),
  };
}

function fromProjectRow(row: any): StudioProject {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    client_id: row.client_id || "",
    type: row.type,
    status: row.status,
    fee_amount: row.fee_amount !== null && row.fee_amount !== undefined ? Number(row.fee_amount) : undefined,
    currency: row.currency || "INR",
    runtime_seconds:
      row.runtime_seconds !== null && row.runtime_seconds !== undefined
        ? Number(row.runtime_seconds)
        : undefined,
    versions: Number(row.versions ?? 1),
    aspect_ratios: Array.isArray(row.aspect_ratios) ? row.aspect_ratios : ["16:9"],
    hard_deadline: row.hard_deadline || undefined,
    promised_date: row.promised_date || undefined,
    forecast_date: row.forecast_date || undefined,
    health: row.health || "on_track",
    current_gate_id: row.current_gate_id || undefined,
    cover_image_url: row.cover_image_url || undefined,
    emoji: row.emoji || "🎬",
    drive_folder_url: row.drive_folder_url || undefined,
    review_link_url: row.review_link_url || undefined,
    is_confidential: Boolean(row.is_confidential),
    portal_visible: row.portal_visible !== false,
    priority: row.priority || "p2",
    owner_member_id: row.owner_member_id || INITIAL_MEMBERS[0].id,
    pinned: Boolean(row.pinned),
    last_client_touch_at: row.last_client_touch_at || undefined,
    last_studio_touch_at: row.last_studio_touch_at || undefined,
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function toGateRow(g: StudioGate) {
  return {
    id: g.id,
    project_id: g.project_id,
    order_index: g.order_index,
    code: g.code,
    name: g.name,
    needs_client_approval: Boolean(g.needs_client_approval),
    estimate_days: g.estimate_days ?? 1,
    started_at: g.started_at ?? null,
    sent_for_approval_at: g.sent_for_approval_at ?? null,
    approved_at: g.approved_at ?? null,
    status: g.status,
    revision_round: g.revision_round ?? 0,
    revisions_included: g.revisions_included ?? 2,
    client_comment: g.client_comment ?? null,
    portal_visible: Boolean(g.portal_visible),
  };
}

function fromGateRow(row: any): StudioGate {
  return {
    id: row.id,
    project_id: row.project_id,
    order_index: Number(row.order_index ?? 0),
    code: row.code,
    name: row.name,
    needs_client_approval: Boolean(row.needs_client_approval),
    estimate_days: Number(row.estimate_days ?? 1),
    started_at: row.started_at || undefined,
    sent_for_approval_at: row.sent_for_approval_at || undefined,
    approved_at: row.approved_at || undefined,
    status: row.status,
    revision_round: Number(row.revision_round ?? 0),
    revisions_included: Number(row.revisions_included ?? 2),
    client_comment: row.client_comment || undefined,
    portal_visible: row.portal_visible !== false,
  };
}

function toTaskRow(t: StudioTask) {
  return {
    id: t.id,
    key: t.key,
    project_id: isUuid(t.project_id) ? t.project_id : null,
    gate_id: isUuid(t.gate_id) ? t.gate_id : null,
    title: t.title,
    description: t.description ?? null,
    type: t.type,
    status: t.status,
    priority: t.priority,
    do_date: t.do_date ?? null,
    due_date: t.due_date ?? null,
    estimate_hours: t.estimate_hours ?? 1,
    actual_hours: t.actual_hours ?? 0,
    assignee_member_id: isUuid(t.assignee_member_id) ? t.assignee_member_id : null,
    checklist: t.checklist || [],
    source: t.source || "manual",
    source_ref: t.source_ref ?? null,
    promised_to_name: t.promised_to_name ?? null,
    waiting_on_name: t.waiting_on_name ?? null,
    channel: t.channel ?? null,
    is_in_now: Boolean(t.is_in_now),
    snoozed_until: t.snoozed_until ?? null,
    completed_at: t.completed_at ?? null,
    portal_visible: Boolean(t.portal_visible),
    created_at: t.created_at || new Date().toISOString(),
    updated_at: t.updated_at || new Date().toISOString(),
  };
}

function fromTaskRow(row: any): StudioTask {
  return {
    id: row.id,
    key: row.key,
    project_id: row.project_id || "",
    gate_id: row.gate_id || undefined,
    title: row.title,
    description: row.description || undefined,
    type: row.type || "task",
    status: row.status || "todo",
    priority: row.priority || "normal",
    do_date: toDateOnly(row.do_date),
    due_date: toDateOnly(row.due_date),
    estimate_hours: Number(row.estimate_hours ?? 1),
    actual_hours: Number(row.actual_hours ?? 0),
    assignee_member_id: row.assignee_member_id || INITIAL_MEMBERS[0].id,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    source: row.source || "manual",
    source_ref: row.source_ref || undefined,
    promised_to_name: row.promised_to_name || undefined,
    waiting_on_name: row.waiting_on_name || undefined,
    channel: row.channel || undefined,
    is_in_now: Boolean(row.is_in_now),
    snoozed_until: row.snoozed_until || undefined,
    completed_at: row.completed_at || undefined,
    portal_visible: Boolean(row.portal_visible),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function toPaymentRow(p: StudioPayment) {
  return {
    id: p.id,
    project_id: p.project_id,
    invoice_no: p.invoice_no ?? null,
    amount: p.amount ?? 0,
    currency: p.currency || "INR",
    tds_amount: p.tds_amount ?? 0,
    sent_at: p.sent_at ?? null,
    due_at: p.due_at ?? null,
    received_at: p.received_at ?? null,
    status: p.status || "draft",
    notes: p.notes ?? null,
  };
}

function fromPaymentRow(row: any): StudioPayment {
  return {
    id: row.id,
    project_id: row.project_id,
    invoice_no: row.invoice_no || "",
    amount: Number(row.amount ?? 0),
    currency: row.currency || "INR",
    tds_amount: Number(row.tds_amount ?? 0),
    sent_at: toDateOnly(row.sent_at),
    due_at: toDateOnly(row.due_at),
    received_at: row.received_at || undefined,
    status: row.status || "draft",
    notes: row.notes || undefined,
  };
}

function toActivityRow(a: ActivityLogItem) {
  return {
    id: a.id,
    actor: a.actor,
    actor_name: a.actor_name,
    entity_type: a.entity_type,
    entity_id: isUuid(a.entity_id) ? a.entity_id : null,
    action: a.action,
    at: a.at || new Date().toISOString(),
  };
}

function fromActivityRow(row: any): ActivityLogItem {
  return {
    id: row.id,
    actor: row.actor,
    actor_name: row.actor_name || "Studio OS",
    entity_type: row.entity_type,
    entity_id: row.entity_id || "",
    action: row.action,
    at: row.at || new Date().toISOString(),
  };
}

async function seedAllTables(authUserId?: string | null): Promise<void> {
  if (!supabase) return;

  await supabase.from("studio_settings").upsert(toSettingsRow(INITIAL_SETTINGS), { onConflict: "id" });

  await supabase
    .from("studio_members")
    .upsert(INITIAL_MEMBERS.map((m) => toMemberRow(m, authUserId)), { onConflict: "id" });

  await supabase
    .from("studio_clients")
    .upsert(INITIAL_CLIENTS.map(toClientRow), { onConflict: "id" });

  const contacts = INITIAL_CLIENTS.flatMap((c) => c.contacts).map(toContactRow);
  if (contacts.length > 0) {
    await supabase.from("studio_client_contacts").upsert(contacts, { onConflict: "id" });
  }

  const { error: projErr } = await supabase
    .from("studio_projects")
    .upsert(INITIAL_PROJECTS.map(toProjectRow), { onConflict: "id" });
  if (projErr) throw projErr;

  const { error: gateErr } = await supabase
    .from("studio_gates")
    .upsert(INITIAL_GATES.map(toGateRow), { onConflict: "id" });
  if (gateErr) throw gateErr;

  const { error: taskErr } = await supabase
    .from("studio_tasks")
    .upsert(INITIAL_TASKS.map(toTaskRow), { onConflict: "id" });
  if (taskErr) throw taskErr;

  const { error: payErr } = await supabase
    .from("studio_payments")
    .upsert(INITIAL_PAYMENTS.map(toPaymentRow), { onConflict: "id" });
  if (payErr) throw payErr;

  const { error: actErr } = await supabase
    .from("studio_activity_log")
    .upsert(INITIAL_ACTIVITY.map(toActivityRow), { onConflict: "id" });
  if (actErr) throw actErr;
}

export async function loadOrSeedStudioOSFromSupabase(): Promise<
  | { status: "local" | "schema_pending" }
  | { status: "synced"; data: StudioOSCloudSnapshot }
> {
  if (!isSupabaseConfigured || !supabase) {
    return { status: "local" };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;
    if (!session?.user) {
      return { status: "local" };
    }

    const { data: projProbe, error: probeError } = await supabase
      .from("studio_projects")
      .select("id")
      .limit(1);

    if (probeError) {
      const msg = (probeError.message || "").toLowerCase();
      if (probeError.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache")) {
        return { status: "schema_pending" };
      }
      console.warn("Studio OS probe error:", probeError.message);
      return { status: "local" };
    }

    if (!projProbe || projProbe.length === 0) {
      await seedAllTables(session.user.id);
    }

    const [
      settingsRes,
      membersRes,
      clientsRes,
      contactsRes,
      projectsRes,
      gatesRes,
      tasksRes,
      paymentsRes,
      activityRes,
    ] = await Promise.all([
      supabase.from("studio_settings").select("*").is("archived_at", null).limit(1),
      supabase.from("studio_members").select("*").is("archived_at", null).order("created_at", { ascending: true }),
      supabase.from("studio_clients").select("*").is("archived_at", null).order("name", { ascending: true }),
      supabase.from("studio_client_contacts").select("*").is("archived_at", null),
      supabase.from("studio_projects").select("*").is("archived_at", null).order("updated_at", { ascending: false }),
      supabase.from("studio_gates").select("*").is("archived_at", null).order("order_index", { ascending: true }),
      supabase.from("studio_tasks").select("*").is("archived_at", null).order("created_at", { ascending: false }),
      supabase.from("studio_payments").select("*").is("archived_at", null).order("due_at", { ascending: true }),
      supabase.from("studio_activity_log").select("*").order("at", { ascending: false }).limit(80),
    ]);

    if (projectsRes.error || tasksRes.error || gatesRes.error) {
      console.warn("Studio OS fetch warning:", projectsRes.error || tasksRes.error || gatesRes.error);
      return { status: "local" };
    }

    const settingsRow = settingsRes.data?.[0];
    let settings: StudioSettings;
    if (settingsRow) {
      settings = fromSettingsRow(settingsRow);
    } else {
      settings = INITIAL_SETTINGS;
      await supabase.from("studio_settings").upsert(toSettingsRow(INITIAL_SETTINGS), { onConflict: "id" });
    }

    const members =
      membersRes.data && membersRes.data.length > 0
        ? membersRes.data.map((m, idx) => fromMemberRow(m, idx))
        : INITIAL_MEMBERS;

    const contacts = (contactsRes.data || []).map(fromContactRow);
    const clients = (clientsRes.data || []).map((row) =>
      fromClientRow(
        row,
        contacts.filter((ct) => ct.client_id === row.id)
      )
    );

    const projects = (projectsRes.data || []).map(fromProjectRow);
    const gates = (gatesRes.data || []).map(fromGateRow);
    const tasks = (tasksRes.data || []).map(fromTaskRow);
    const payments = (paymentsRes.data || []).map(fromPaymentRow);
    const activity = (activityRes.data || []).map(fromActivityRow);

    return {
      status: "synced",
      data: {
        settings,
        members,
        clients: clients.length > 0 ? clients : INITIAL_CLIENTS,
        projects,
        gates,
        tasks,
        payments,
        activity,
      },
    };
  } catch (err) {
    console.warn("Studio OS Supabase load failed, falling back to localStorage:", err);
    return { status: "local" };
  }
}

export async function syncInsertTask(task: StudioTask): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from("studio_tasks").insert(toTaskRow(task));
  return error ? error.message : null;
}

export async function syncUpdateTask(taskId: string, patch: Partial<StudioTask>): Promise<string | null> {
  if (!supabase) return null;
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if ("title" in patch) payload.title = patch.title;
  if ("description" in patch) payload.description = patch.description ?? null;
  if ("type" in patch) payload.type = patch.type;
  if ("status" in patch) payload.status = patch.status;
  if ("priority" in patch) payload.priority = patch.priority;
  if ("do_date" in patch) payload.do_date = patch.do_date ?? null;
  if ("due_date" in patch) payload.due_date = patch.due_date ?? null;
  if ("estimate_hours" in patch) payload.estimate_hours = patch.estimate_hours ?? 1;
  if ("actual_hours" in patch) payload.actual_hours = patch.actual_hours ?? 0;
  if ("gate_id" in patch) payload.gate_id = isUuid(patch.gate_id) ? patch.gate_id : null;
  if ("project_id" in patch) payload.project_id = isUuid(patch.project_id) ? patch.project_id : null;
  if ("assignee_member_id" in patch) {
    payload.assignee_member_id = isUuid(patch.assignee_member_id) ? patch.assignee_member_id : null;
  }
  if ("checklist" in patch) payload.checklist = patch.checklist || [];
  if ("promised_to_name" in patch) payload.promised_to_name = patch.promised_to_name ?? null;
  if ("waiting_on_name" in patch) payload.waiting_on_name = patch.waiting_on_name ?? null;
  if ("channel" in patch) payload.channel = patch.channel ?? null;
  if ("is_in_now" in patch) payload.is_in_now = Boolean(patch.is_in_now);
  if ("snoozed_until" in patch) payload.snoozed_until = patch.snoozed_until ?? null;
  if ("completed_at" in patch) payload.completed_at = patch.completed_at ?? null;
  if ("portal_visible" in patch) payload.portal_visible = Boolean(patch.portal_visible);

  const { error } = await supabase.from("studio_tasks").update(payload).eq("id", taskId);
  return error ? error.message : null;
}

export async function syncArchiveTasks(taskIds: string[]): Promise<string | null> {
  if (!supabase || taskIds.length === 0) return null;
  const { error } = await supabase
    .from("studio_tasks")
    .update({ archived_at: new Date().toISOString() })
    .in("id", taskIds);
  return error ? error.message : null;
}

export async function syncInsertProjectWithGates(
  project: StudioProject,
  gates: StudioGate[]
): Promise<string | null> {
  if (!supabase) return null;
  const { error: projErr } = await supabase.from("studio_projects").insert(toProjectRow(project));
  if (projErr) return projErr.message;
  if (gates.length > 0) {
    const { error: gateErr } = await supabase.from("studio_gates").insert(gates.map(toGateRow));
    if (gateErr) return gateErr.message;
  }
  return null;
}

export async function syncUpdateProject(projectId: string, patch: Partial<StudioProject>): Promise<string | null> {
  if (!supabase) return null;
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if ("title" in patch) payload.title = patch.title;
  if ("status" in patch) payload.status = patch.status;
  if ("fee_amount" in patch) payload.fee_amount = patch.fee_amount ?? null;
  if ("currency" in patch) payload.currency = patch.currency;
  if ("hard_deadline" in patch) payload.hard_deadline = patch.hard_deadline ?? null;
  if ("promised_date" in patch) payload.promised_date = patch.promised_date ?? null;
  if ("forecast_date" in patch) payload.forecast_date = patch.forecast_date ?? null;
  if ("health" in patch) payload.health = patch.health;
  if ("emoji" in patch) payload.emoji = patch.emoji;
  if ("drive_folder_url" in patch) payload.drive_folder_url = patch.drive_folder_url ?? null;
  if ("review_link_url" in patch) payload.review_link_url = patch.review_link_url ?? null;
  if ("is_confidential" in patch) payload.is_confidential = Boolean(patch.is_confidential);
  if ("portal_visible" in patch) payload.portal_visible = Boolean(patch.portal_visible);
  if ("priority" in patch) payload.priority = patch.priority;
  if ("pinned" in patch) payload.pinned = Boolean(patch.pinned);
  if ("last_client_touch_at" in patch) payload.last_client_touch_at = patch.last_client_touch_at ?? null;
  if ("last_studio_touch_at" in patch) payload.last_studio_touch_at = patch.last_studio_touch_at ?? null;

  const { error } = await supabase.from("studio_projects").update(payload).eq("id", projectId);
  return error ? error.message : null;
}

export async function syncUpdateGate(gate: StudioGate): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from("studio_gates").update(toGateRow(gate)).eq("id", gate.id);
  return error ? error.message : null;
}

export async function syncUpdateSettings(settings: StudioSettings): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase
    .from("studio_settings")
    .upsert(toSettingsRow(settings), { onConflict: "id" });
  return error ? error.message : null;
}

export async function syncInsertActivity(item: ActivityLogItem): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from("studio_activity_log").insert(toActivityRow(item));
  return error ? error.message : null;
}

export async function syncInsertTimeEntry(
  taskId: string,
  memberId: string | undefined,
  seconds: number
): Promise<string | null> {
  if (!supabase || seconds <= 0) return null;
  const ended = new Date();
  const started = new Date(ended.getTime() - seconds * 1000);
  const { error } = await supabase.from("studio_time_entries").insert({
    id: newUuid(),
    task_id: taskId,
    member_id: isUuid(memberId) ? memberId : null,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    kind: "active",
  });
  return error ? error.message : null;
}

export async function resetStudioOSInSupabase(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id ?? null;

    // Clear child tables in FK order before re-seeding
    await supabase.from("studio_time_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("studio_activity_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("studio_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("studio_tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("studio_gates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("studio_projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    await seedAllTables(uid);
    return null;
  } catch (err: any) {
    return err?.message || "Failed to reset Supabase seed data";
  }
}
