import type { SupabaseClient } from "@supabase/supabase-js";
import type { Extraction } from "../../lib/ai/index.js";
import { createTask, logActivity, todayInTz, type StudioCtx } from "./studioData.js";

export type InboxSource = "gmail" | "whatsapp" | "website" | "portal" | "manual" | "claude_task";
export type InboxAction =
  | "create_task"
  | "create_promise"
  | "approve_gate"
  | "update_payment"
  | "log_payment"
  | "new_lead"
  | "reply_owed"
  | "update_deadline"
  | "update_task_status";

export const AUTO_APPLY_THRESHOLD = 0.85;
// Status moves are reversible (Undo restores the previous status), so they can auto-apply.
const NON_DESTRUCTIVE: InboxAction[] = ["create_task", "create_promise", "reply_owed", "log_payment", "update_task_status"];

export interface Candidate {
  action: InboxAction;
  title: string;
  confidence: number;
  payload: Record<string, any>;
}

export interface PlanMeta {
  direction?: "received" | "sent";
  projectId?: string | null;
  clientId?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  lead?: { name: string; email?: string; organisation?: string; brief?: string } | null;
}

/** Turn an extraction into one candidate per concrete action. */
export function planActions(ex: Extraction, meta: PlanMeta): Candidate[] {
  const out: Candidate[] = [];
  const c = ex.confidence;
  const sent = meta.direction === "sent";

  for (const t of ex.tasks.slice(0, 5)) {
    const promise = sent || t.type === "promise";
    out.push({
      action: promise ? "create_promise" : "create_task",
      title: t.title,
      confidence: c,
      payload: {
        title: t.title,
        due_date: t.due_date,
        type: promise ? "promise" : t.type === "follow_up" ? "follow_up" : "task",
        project_id: meta.projectId || null,
        promised_to_contact_id: promise ? meta.contactId || null : null,
        promised_to_name: promise ? meta.contactName || null : null,
      },
    });
  }

  if (!sent && ex.payment && ex.payment.status !== "none") {
    if (ex.payment.status === "received") {
      out.push({
        action: "update_payment",
        title: "Mark invoice as paid",
        confidence: c,
        payload: { project_id: meta.projectId || null, note: ex.payment.note },
      });
    } else {
      out.push({
        action: "log_payment",
        title: `Payment ${ex.payment.status}${ex.payment.note ? ` — ${ex.payment.note}` : ""}`.slice(0, 140),
        confidence: c,
        payload: { project_id: meta.projectId || null, status: ex.payment.status, note: ex.payment.note },
      });
    }
  }

  if (!sent && ex.approval?.approved) {
    out.push({
      action: "approve_gate",
      title: `Approve ${ex.approval.gate_hint || "current stage"}`,
      confidence: c,
      payload: { project_id: meta.projectId || null, gate_hint: ex.approval.gate_hint },
    });
  }

  if (ex.deadline_change?.new_date) {
    out.push({
      action: "update_deadline",
      title: `Move deadline to ${ex.deadline_change.new_date}`,
      confidence: c,
      payload: { project_id: meta.projectId || null, new_date: ex.deadline_change.new_date, note: ex.deadline_change.note },
    });
  }

  if (ex.category === "new_lead" && !meta.clientId && meta.lead) {
    out.push({ action: "new_lead", title: `New lead: ${meta.lead.name}`, confidence: c, payload: { ...meta.lead } });
  }

  return out;
}

export function isAutoApplicable(cand: { action: InboxAction; confidence: number; payload?: any }): boolean {
  return cand.confidence >= AUTO_APPLY_THRESHOLD && NON_DESTRUCTIVE.includes(cand.action);
}

export interface PersistBase {
  source: InboxSource;
  sourceRefPrefix: string;
  rawText: string;
  summary: string;
  sender?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  gmailAccount?: string | null;
  threadId?: string | null;
  aiJson?: unknown;
  ingestTokenId?: string | null;
  receivedAt?: string;
  /** Force everything into review (e.g. user-initiated imports). */
  forceReview?: boolean;
}

export async function persistCandidates(
  sb: SupabaseClient,
  ctx: StudioCtx,
  candidates: Candidate[],
  base: PersistBase
): Promise<{ created: number; autoApplied: number; ids: string[] }> {
  let created = 0;
  let autoApplied = 0;
  const ids: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const { data: row, error } = await sb
      .from("studio_inbox_items")
      .insert({
        source: base.source,
        raw_text: base.rawText.slice(0, 2000),
        source_ref: `${base.sourceRefPrefix}#${i}`,
        received_at: base.receivedAt || new Date().toISOString(),
        ai_json: base.aiJson ?? null,
        suggested_action: cand.action,
        confidence: Math.round(cand.confidence * 100) / 100,
        matched_client_id: base.clientId || null,
        matched_project_id: cand.payload.project_id || base.projectId || null,
        status: "pending",
        title: cand.title.slice(0, 200),
        summary: base.summary.slice(0, 300),
        payload: cand.payload,
        gmail_account: base.gmailAccount || null,
        thread_id: base.threadId || null,
        ingest_token_id: base.ingestTokenId || null,
        sender: base.sender || null,
      })
      .select("*")
      .single();
    if (error) {
      if (/duplicate key/i.test(error.message)) continue;
      throw new Error(error.message);
    }
    created++;
    ids.push(row.id);

    if (!base.forceReview && isAutoApplicable(cand)) {
      try {
        const res = await applyItem(sb, ctx, row);
        await sb
          .from("studio_inbox_items")
          .update({ status: "auto_applied", applied_entity_ref: res.entityRef, undo_payload: res.undo, resolved_at: new Date().toISOString() })
          .eq("id", row.id);
        autoApplied++;
      } catch {
        // Leave as pending suggestion if auto-apply fails.
      }
    }
  }
  return { created, autoApplied, ids };
}

function taskSourceFor(source: InboxSource): "email" | "whatsapp" | "website" | "portal" | "ai" {
  if (source === "gmail") return "email";
  if (source === "whatsapp" || source === "website" || source === "portal") return source;
  return "ai";
}

function channelFor(source: InboxSource): "gmail" | "whatsapp" | "portal" | "internal" {
  if (source === "gmail") return "gmail";
  if (source === "whatsapp") return "whatsapp";
  if (source === "portal") return "portal";
  return "internal";
}

async function uniqueProjectCode(sb: SupabaseClient, seed: string): Promise<string> {
  const letters = seed.toUpperCase().replace(/[^A-Z]/g, "");
  const base = (letters.slice(0, 3) || "LEA").padEnd(3, "X");
  const { data } = await sb.from("studio_projects").select("code");
  const taken = new Set((data || []).map((r: any) => r.code));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const c = `${base.slice(0, 3)}${n}`.slice(0, 5);
    if (!taken.has(c)) return c;
  }
  return `L${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export interface LeadInput {
  name: string;
  email?: string;
  organisation?: string;
  brief?: string;
  phone?: string;
  budget?: string;
  source: InboxSource;
  sourceRef?: string;
}

/** Create Client (if new) + Lead project + "Reply to inquiry within 24h" task. */
export async function createLead(sb: SupabaseClient, ctx: StudioCtx, lead: LeadInput) {
  const email = (lead.email || "").toLowerCase().trim();
  const domain = email.split("@")[1] || "";
  let clientId: string | null = null;
  let createdClient = false;

  const byContact = ctx.clients.find((c) => c.contacts.some((ct) => (ct.email || "").toLowerCase() === email && email));
  if (byContact) clientId = byContact.id;

  if (!clientId) {
    const org = (lead.organisation || "").trim();
    const isGeneric = !domain || ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"].includes(domain);
    const { data: client, error } = await sb
      .from("studio_clients")
      .insert({
        name: org && org !== "Independent" ? org : lead.name,
        organisation: org || lead.name,
        email_domains: isGeneric ? [] : [domain],
        notes: `Created from ${lead.source} inquiry`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    clientId = client.id;
    createdClient = true;
    await sb.from("studio_client_contacts").insert({
      client_id: clientId,
      name: lead.name,
      email: email || null,
      phone: lead.phone || null,
    });
  }

  const code = await uniqueProjectCode(sb, lead.organisation && lead.organisation !== "Independent" ? lead.organisation : lead.name);
  const { data: project, error: pErr } = await sb
    .from("studio_projects")
    .insert({
      code,
      title: `${lead.organisation && lead.organisation !== "Independent" ? lead.organisation : lead.name} — inquiry`.slice(0, 120),
      client_id: clientId,
      type: "ad_film",
      status: "lead",
      priority: "p2",
      emoji: "✉️",
      owner_member_id: ctx.ownerMemberId,
      last_client_touch_at: new Date().toISOString(),
    })
    .select("id, code, title, client_id, status, is_confidential, fee_amount, current_gate_id, hard_deadline, promised_date, forecast_date")
    .single();
  if (pErr) throw new Error(pErr.message);
  ctx.projects.push(project as any);

  const tomorrow = todayInTz(ctx.timezone, new Date(Date.now() + 24 * 3600 * 1000));
  const task = await createTask(sb, ctx, {
    projectId: project.id,
    title: "Reply to inquiry within 24h",
    description: [lead.brief, lead.budget ? `Budget: ${lead.budget}` : "", email ? `Email: ${email}` : ""].filter(Boolean).join("\n\n"),
    type: "reply_owed",
    priority: "high",
    dueDate: tomorrow,
    source: taskSourceFor(lead.source),
    sourceRef: lead.sourceRef,
    promisedToName: lead.name,
    channel: lead.source === "gmail" ? "gmail" : "internal",
  });

  await logActivity(sb, {
    actor: "system",
    actorName: "Website inquiry",
    entityType: "project",
    entityId: project.id,
    action: `New lead ${code} from ${lead.name}`,
  });

  return { clientId, createdClient, projectId: project.id, projectCode: code, taskId: task.id };
}

export interface ApplyResult {
  entityRef: string;
  undo: Record<string, any>;
}

/** Apply an inbox item's action (optionally with user edits). */
export async function applyItem(sb: SupabaseClient, ctx: StudioCtx, item: any, edits: Record<string, any> = {}): Promise<ApplyResult> {
  const payload = { ...(item.payload || {}), ...edits };
  const action: InboxAction = edits.action || item.suggested_action;
  const projectId = payload.project_id || item.matched_project_id || null;
  const source = item.source as InboxSource;

  switch (action) {
    case "create_task":
    case "create_promise":
    case "reply_owed": {
      const task = await createTask(sb, ctx, {
        projectId,
        title: payload.title || item.title || "Follow up",
        description: item.summary || undefined,
        type: action === "create_promise" ? "promise" : action === "reply_owed" ? "reply_owed" : payload.type === "follow_up" ? "follow_up" : "task",
        priority: action === "reply_owed" ? "high" : "normal",
        dueDate: payload.due_date || null,
        source: taskSourceFor(source),
        sourceRef: item.thread_id ? `gmail:${item.gmail_account}:${item.thread_id}` : item.source_ref,
        promisedToContactId: payload.promised_to_contact_id || null,
        promisedToName: payload.promised_to_name || null,
        channel: channelFor(source),
      });
      await logActivity(sb, { entityType: "task", entityId: task.id, action: `added ${task.key} from ${source}: ${payload.title || item.title}` });
      return { entityRef: `task:${task.id}`, undo: { op: "archive_task", task_id: task.id } };
    }

    case "log_payment": {
      const { data } = await sb
        .from("studio_activity_log")
        .insert({
          actor: "ai",
          actor_name: "Studio OS AI",
          entity_type: "payment",
          entity_id: projectId,
          action: `Payment ${payload.status || "mentioned"}${payload.note ? `: ${String(payload.note).slice(0, 160)}` : ""}`,
        })
        .select("id")
        .single();
      return { entityRef: `activity:${data?.id}`, undo: { op: "delete_activity", activity_id: data?.id } };
    }

    case "update_payment": {
      if (!projectId) throw new Error("Pick a project first.");
      let q = sb.from("studio_payments").select("id, status, received_at").eq("project_id", projectId).is("archived_at", null);
      q = payload.payment_id ? q.eq("id", payload.payment_id) : q.in("status", ["sent", "overdue", "partly_paid"]);
      const { data: payments } = await q.order("sent_at", { ascending: false, nullsFirst: false }).limit(1);
      const pay = payments?.[0];
      if (!pay) throw new Error("No open invoice found for this project.");
      await sb.from("studio_payments").update({ status: "paid", received_at: new Date().toISOString() }).eq("id", pay.id);
      await logActivity(sb, { entityType: "payment", entityId: pay.id, action: "marked invoice paid from inbox" });
      return { entityRef: `payment:${pay.id}`, undo: { op: "restore_payment", payment_id: pay.id, prev: { status: pay.status, received_at: pay.received_at } } };
    }

    case "approve_gate": {
      if (!projectId) throw new Error("Pick a project first.");
      const { data: gates } = await sb
        .from("studio_gates")
        .select("id, code, name, status, order_index, started_at, approved_at, actual_days")
        .eq("project_id", projectId)
        .is("archived_at", null)
        .order("order_index");
      const list = gates || [];
      const hint = String(payload.gate_hint || "").toLowerCase();
      const project = ctx.projects.find((p) => p.id === projectId);
      const gate =
        (payload.gate_id && list.find((g: any) => g.id === payload.gate_id)) ||
        (hint && list.find((g: any) => g.name.toLowerCase().includes(hint) || hint.includes(g.name.toLowerCase()) || g.code.toLowerCase() === hint)) ||
        list.find((g: any) => g.status === "waiting_on_client") ||
        list.find((g: any) => g.id === project?.current_gate_id);
      if (!gate) throw new Error("Could not find the stage to approve.");
      const now = new Date();
      const actualDays = gate.started_at ? Math.max(0.5, Math.round(((now.getTime() - new Date(gate.started_at).getTime()) / 86400000) * 10) / 10) : gate.actual_days;
      await sb.from("studio_gates").update({ status: "approved", approved_at: now.toISOString(), actual_days: actualDays }).eq("id", gate.id);
      const next = list.find((g: any) => g.order_index > gate.order_index && g.status !== "approved" && g.status !== "skipped");
      const undo: Record<string, any> = {
        op: "restore_gate",
        gate_id: gate.id,
        prev: { status: gate.status, approved_at: gate.approved_at, actual_days: gate.actual_days },
        project_id: projectId,
        prev_current_gate_id: project?.current_gate_id || null,
      };
      if (next) {
        if (next.status === "not_started") {
          await sb.from("studio_gates").update({ status: "in_work", started_at: now.toISOString() }).eq("id", next.id);
          undo.next_gate = { id: next.id, prev: { status: next.status, started_at: next.started_at } };
        }
        await sb.from("studio_projects").update({ current_gate_id: next.id, last_client_touch_at: now.toISOString() }).eq("id", projectId);
      }
      await logActivity(sb, { actor: "client", actorName: "Client (via inbox)", entityType: "gate", entityId: gate.id, action: `approved ${gate.name}` });
      return { entityRef: `gate:${gate.id}`, undo };
    }

    case "update_deadline": {
      if (!projectId) throw new Error("Pick a project first.");
      if (!payload.new_date) throw new Error("No new date given.");
      const project = ctx.projects.find((p) => p.id === projectId);
      await sb.from("studio_projects").update({ hard_deadline: payload.new_date }).eq("id", projectId);
      await logActivity(sb, { entityType: "project", entityId: projectId, action: `deadline moved to ${payload.new_date} (from inbox)` });
      return { entityRef: `project:${projectId}`, undo: { op: "restore_deadline", project_id: projectId, prev: project?.hard_deadline || null } };
    }

    case "update_task_status": {
      const { data: task } = await sb.from("studio_tasks").select("id, key, title, status, completed_at, is_in_now").eq("id", payload.task_id).maybeSingle();
      if (!task) throw new Error("Task no longer exists.");
      const next = String(payload.status);
      await sb
        .from("studio_tasks")
        .update({
          status: next,
          completed_at: next === "done" ? new Date().toISOString() : null,
          ...(next === "done" ? { is_in_now: false } : {}),
          ...(next !== "waiting_on_client" ? { waiting_on_name: null } : {}),
        })
        .eq("id", task.id);
      await logActivity(sb, { entityType: "task", entityId: task.id, action: `${task.key} → ${next.replace(/_/g, " ")} (${payload.reason || "from email"})` });
      return { entityRef: `task:${task.id}`, undo: { op: "restore_task", task_id: task.id, prev: { status: task.status, completed_at: task.completed_at, is_in_now: task.is_in_now } } };
    }

    case "new_lead": {
      const res = await createLead(sb, ctx, {
        name: payload.name || item.sender || "New inquiry",
        email: payload.email,
        organisation: payload.organisation,
        brief: payload.brief || item.summary,
        source,
        sourceRef: item.source_ref,
      });
      return {
        entityRef: `project:${res.projectId}`,
        undo: { op: "archive_lead", project_id: res.projectId, task_id: res.taskId, client_id: res.createdClient ? res.clientId : null },
      };
    }
  }
  throw new Error(`Unsupported action: ${action}`);
}

export async function undoItem(sb: SupabaseClient, item: any): Promise<void> {
  const u = item.undo_payload || {};
  const now = new Date().toISOString();
  switch (u.op) {
    case "archive_task":
      await sb.from("studio_tasks").update({ archived_at: now }).eq("id", u.task_id);
      break;
    case "delete_activity":
      if (u.activity_id) await sb.from("studio_activity_log").delete().eq("id", u.activity_id);
      break;
    case "restore_payment":
      await sb.from("studio_payments").update(u.prev).eq("id", u.payment_id);
      break;
    case "restore_gate":
      await sb.from("studio_gates").update(u.prev).eq("id", u.gate_id);
      if (u.next_gate) await sb.from("studio_gates").update(u.next_gate.prev).eq("id", u.next_gate.id);
      if (u.project_id) await sb.from("studio_projects").update({ current_gate_id: u.prev_current_gate_id }).eq("id", u.project_id);
      break;
    case "restore_deadline":
      await sb.from("studio_projects").update({ hard_deadline: u.prev }).eq("id", u.project_id);
      break;
    case "restore_task":
      await sb.from("studio_tasks").update(u.prev).eq("id", u.task_id);
      break;
    case "archive_lead":
      if (u.task_id) await sb.from("studio_tasks").update({ archived_at: now }).eq("id", u.task_id);
      if (u.project_id) await sb.from("studio_projects").update({ archived_at: now }).eq("id", u.project_id);
      if (u.client_id) await sb.from("studio_clients").update({ archived_at: now }).eq("id", u.client_id);
      break;
    default:
      throw new Error("Nothing to undo for this item.");
  }
  await sb.from("studio_inbox_items").update({ status: "undone", resolved_at: now }).eq("id", item.id);
  await logActivity(sb, { actor: "member", actorName: "Shyam", entityType: "inbox", entityId: item.id, action: `undid: ${item.title || item.suggested_action}` });
}
