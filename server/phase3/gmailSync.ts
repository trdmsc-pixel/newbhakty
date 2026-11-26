import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanEmailBody, draft as aiDraft, extract as aiExtract } from "../../lib/ai/index.js";
import {
  GmailAuthError,
  GmailClient,
  SYNC_QUERY,
  googleConfigured,
  parseMessage,
  refreshAccessToken,
  shouldSkip,
  type ParsedMessage,
} from "./gmail.js";
import { persistCandidates, planActions } from "./inboxEngine.js";
import {
  businessHoursSince,
  ctxHints,
  feeNumbersFor,
  isConfidential,
  loadStudioCtx,
  matchClientByEmails,
  matchProject,
  type StudioCtx,
} from "./studioData.js";

const PROMISE_HINT =
  /\b(by|before|until)\s+(tomorrow|tonight|today|eod|end of (the )?(day|week)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|\d{1,2}(st|nd|rd|th)?)\b|\b(i'?ll|i will|we'?ll|we will|will)\s+(send|share|get back|deliver|update|revert|upload|have|circulate|finish)\b|\btomorrow\b|\b(monday|tuesday|wednesday|thursday|friday)\b/i;

// Sent mail that hands something over (file / link / cut / quote).
const DELIVERY_HINT =
  /\b(attached|attachment|please find|here (is|are)|here's|sharing|shared|link below|download|final (cut|file|version)|v\d+)\b|drive\.google|vimeo\.com|frame\.io|f\.io|wetransfer|dropbox/i;

const MAX_MESSAGES_PER_ACCOUNT = 25;
const MAX_REPLY_DRAFTS_PER_RUN = 5;
const TIME_BUDGET_MS = 50_000;

interface AccountRow {
  id: string;
  email: string;
  is_personal: boolean;
  last_history_id: string | null;
  messages_processed: number;
}

export interface SyncSummary {
  accounts: Array<{ email: string; fetched: number; processed: number; skipped: number; items: number; autoApplied: number; error?: string; needsReconnect?: boolean }>;
  replyOwedCreated: number;
  draftsCreated: number;
  skippedReason?: string;
}

export async function runGmailSync(sb: SupabaseClient): Promise<SyncSummary> {
  const summary: SyncSummary = { accounts: [], replyOwedCreated: 0, draftsCreated: 0 };
  if (!googleConfigured()) {
    summary.skippedReason = "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured";
    return summary;
  }
  const started = Date.now();
  const ctx = await loadStudioCtx(sb);
  const clients = new Map<string, { gmail: GmailClient; account: AccountRow }>();

  const { data: accounts } = await sb
    .from("studio_gmail_accounts")
    .select("id, email, is_personal, last_history_id, messages_processed")
    .eq("is_active", true)
    .is("archived_at", null)
    .not("refresh_token_secret_id", "is", null);

  for (const account of (accounts || []) as AccountRow[]) {
    const row = { email: account.email, fetched: 0, processed: 0, skipped: 0, items: 0, autoApplied: 0 } as SyncSummary["accounts"][number];
    summary.accounts.push(row);
    try {
      const { data: refresh } = await sb.rpc("studio_gmail_get_token", { p_account_id: account.id });
      if (!refresh) throw new GmailAuthError("No stored refresh token");
      const gmail = new GmailClient(await refreshAccessToken(String(refresh)));
      clients.set(account.email, { gmail, account });

      let ids: string[] = [];
      let newHistoryId = account.last_history_id;
      if (account.last_history_id) {
        try {
          const h = await gmail.historySince(account.last_history_id);
          ids = h.ids;
          newHistoryId = h.historyId;
        } catch (err: any) {
          if (err?.status !== 404) throw err;
          account.last_history_id = null; // history expired → fall back to a window scan
        }
      }
      if (!account.last_history_id) {
        const [list, profile] = await Promise.all([gmail.listMessageIds(SYNC_QUERY, 15), gmail.profile()]);
        ids = (list.messages || []).map((m) => m.id);
        newHistoryId = profile.historyId;
      }
      row.fetched = ids.length;

      // Dedupe against the processed ledger
      const { data: done } = ids.length
        ? await sb.from("studio_gmail_processed").select("message_id").eq("gmail_account", account.email).in("message_id", ids)
        : { data: [] as any[] };
      const doneSet = new Set((done || []).map((d: any) => d.message_id));
      const todo = ids.filter((id) => !doneSet.has(id));
      const batch = todo.slice(0, MAX_MESSAGES_PER_ACCOUNT);
      let truncated = todo.length > batch.length;

      for (const id of batch) {
        if (Date.now() - started > TIME_BUDGET_MS) {
          truncated = true;
          break;
        }
        const outcome = await processMessage(sb, ctx, gmail, account, id).catch((err) => {
          // Log only ids + error class, never message content.
          console.warn(`[gmail-sync] ${account.email} message ${id} failed: ${err?.name || "Error"}`);
          return { outcome: "error", items: 0, autoApplied: 0 };
        });
        if (outcome.outcome === "skipped") row.skipped++;
        else row.processed++;
        row.items += outcome.items;
        row.autoApplied += outcome.autoApplied;
        if (outcome.outcome !== "error") {
          await sb.from("studio_gmail_processed").upsert({ gmail_account: account.email, message_id: id, outcome: outcome.outcome });
        }
      }

      await sb
        .from("studio_gmail_accounts")
        .update({
          // Keep the old cursor if we could not finish; the ledger prevents double work.
          last_history_id: truncated ? account.last_history_id || newHistoryId : newHistoryId,
          last_sync_at: new Date().toISOString(),
          last_error: null,
          needs_reconnect: false,
          messages_processed: (account.messages_processed || 0) + row.processed,
        })
        .eq("id", account.id);
    } catch (err: any) {
      const reconnect = err instanceof GmailAuthError;
      row.error = reconnect ? "Reconnect needed" : String(err?.message || "Sync failed").slice(0, 200);
      row.needsReconnect = reconnect;
      await sb
        .from("studio_gmail_accounts")
        .update({ last_error: row.error, needs_reconnect: reconnect, last_sync_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  }

  if (Date.now() - started < TIME_BUDGET_MS) {
    const res = await replyOwedPass(sb, ctx, clients, started).catch((err) => {
      console.warn(`[gmail-sync] reply-owed pass failed: ${err?.message}`);
      return { created: 0, drafts: 0 };
    });
    summary.replyOwedCreated = res.created;
    summary.draftsCreated = res.drafts;
  }
  return summary;
}

async function processMessage(
  sb: SupabaseClient,
  ctx: StudioCtx,
  gmail: GmailClient,
  account: AccountRow,
  messageId: string
): Promise<{ outcome: string; items: number; autoApplied: number }> {
  const m: ParsedMessage = parseMessage(await gmail.getMessage(messageId));
  const skip = shouldSkip(m, account.email);
  if (skip) return { outcome: "skipped", items: 0, autoApplied: 0 };

  const sent = m.labelIds.includes("SENT") || m.from.email === account.email;
  const counterpart = sent ? [...m.to, ...m.cc] : [m.from.email];
  const match = matchClientByEmails(ctx, counterpart);
  const clientId = match?.client.id || null;
  const preProject = matchProject(ctx, `${m.subject}\n${m.body.slice(0, 2000)}`, { clientId });

  // Thread bookkeeping
  const { data: existing } = await sb
    .from("studio_email_threads")
    .select("id, project_id, client_id, message_count, reply_owed_task_id")
    .eq("gmail_account", account.email)
    .eq("thread_id", m.threadId)
    .maybeSingle();
  const threadPatch: Record<string, any> = {
    gmail_account: account.email,
    thread_id: m.threadId,
    subject: m.subject.slice(0, 300),
    client_id: existing?.client_id || clientId,
    project_id: existing?.project_id || preProject?.id || null,
    last_from: sent ? "studio" : clientId ? "client" : "client",
    last_message_at: m.internalDate,
    last_message_id: m.id,
    last_sender_email: m.from.email,
    last_sender_name: m.from.name || null,
    needs_reply: !sent && Boolean(existing?.client_id || clientId),
    message_count: (existing?.message_count || 0) + 1,
  };

  if (sent && existing?.reply_owed_task_id) {
    await sb.from("studio_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", existing.reply_owed_task_id).neq("status", "done");
    threadPatch.reply_owed_task_id = null;
    threadPatch.draft_id = null;
    threadPatch.draft_message_id = null;
  }

  // Only spend AI on mail that matters: known clients, or any inbound mail on studio accounts.
  const cleaned = cleanEmailBody(m.body);
  const worthAI = sent
    ? Boolean(clientId) && (PROMISE_HINT.test(cleaned) || DELIVERY_HINT.test(cleaned))
    : Boolean(clientId) || !account.is_personal;
  if (!worthAI || !cleaned) {
    await upsertThread(sb, existing?.id, threadPatch);
    return { outcome: "thread_only", items: 0, autoApplied: 0 };
  }

  const confidential = isConfidential(ctx, clientId, threadPatch.project_id);
  const ex = await aiExtract(
    {
      text: m.body,
      source: "gmail",
      direction: sent ? "sent" : "received",
      subject: m.subject,
      fromName: sent ? "Shyam (studio)" : m.from.name || m.from.email,
      confidential,
      feeNumbers: feeNumbersFor(ctx, clientId),
    },
    ctxHints(ctx),
    ctx.aiProvider
  );

  const project = threadPatch.project_id
    ? ctx.projects.find((p) => p.id === threadPatch.project_id) || null
    : matchProject(ctx, `${m.subject}\n${cleaned}`, { clientId, aiHint: ex.project_match });
  threadPatch.project_id = project?.id || null;
  threadPatch.summary = ex.summary;
  if (!sent) threadPatch.needs_reply = Boolean(clientId) && (ex.needs_reply || threadPatch.needs_reply);
  await upsertThread(sb, existing?.id, threadPatch);

  if (!sent && project) {
    await sb.from("studio_projects").update({ last_client_touch_at: m.internalDate }).eq("id", project.id);
  } else if (sent && project) {
    await sb.from("studio_projects").update({ last_studio_touch_at: m.internalDate }).eq("id", project.id);
  }

  const contactName = match?.contact?.name || (sent ? null : m.from.name) || match?.client.name || null;
  let candidates = planActions(ex, {
    direction: sent ? "sent" : "received",
    projectId: project?.id || null,
    clientId,
    contactId: match?.contact?.id || null,
    contactName: sent ? match?.contact?.name || match?.client.name || null : contactName,
    lead: !clientId && !sent ? { name: m.from.name || m.from.email, email: m.from.email, brief: ex.summary } : null,
  });
  if (sent) candidates = candidates.filter((c) => c.action === "create_promise");

  // Gmail → task status automation (each change is logged with Undo).
  if (project && clientId) {
    candidates.push(...(await statusCandidates(sb, { sent, projectId: project.id, account: account.email, threadId: m.threadId, contactName, clientName: match?.client.name || null, delivered: Boolean(ex.delivered), confidence: ex.confidence })));
  }
  if (!candidates.length) return { outcome: "no_action", items: 0, autoApplied: 0 };

  const res = await persistCandidates(sb, ctx, candidates, {
    source: "gmail",
    sourceRefPrefix: `gmail:${account.email}:${m.id}`,
    rawText: `${m.subject}\n\n${cleaned}`.slice(0, 2000),
    summary: ex.summary,
    sender: sent ? `To ${counterpart[0] || ""}` : m.from.name || m.from.email,
    clientId,
    projectId: project?.id || null,
    gmailAccount: account.email,
    threadId: m.threadId,
    aiJson: ex,
    receivedAt: m.internalDate,
  });
  return { outcome: "extracted", items: res.created, autoApplied: res.autoApplied };
}

async function upsertThread(sb: SupabaseClient, id: string | undefined, patch: Record<string, any>) {
  if (id) await sb.from("studio_email_threads").update(patch).eq("id", id);
  else await sb.from("studio_email_threads").upsert(patch, { onConflict: "gmail_account,thread_id" });
}

async function replyOwedPass(
  sb: SupabaseClient,
  ctx: StudioCtx,
  clients: Map<string, { gmail: GmailClient; account: AccountRow }>,
  started: number
): Promise<{ created: number; drafts: number }> {
  const { data: threads } = await sb
    .from("studio_email_threads")
    .select("id, gmail_account, thread_id, subject, client_id, project_id, last_message_at, last_message_id, last_sender_email, last_sender_name, reply_owed_task_id, draft_id")
    .eq("needs_reply", true)
    .eq("last_from", "client")
    .not("client_id", "is", null)
    .is("archived_at", null)
    .order("last_message_at", { ascending: true })
    .limit(40);

  let created = 0;
  let drafts = 0;
  for (const t of threads || []) {
    if (created >= MAX_REPLY_DRAFTS_PER_RUN || Date.now() - started > TIME_BUDGET_MS) break;
    const client = ctx.clients.find((c) => c.id === t.client_id);
    if (!client || !t.last_message_at) continue;
    if (businessHoursSince(t.last_message_at, client.timezone) < 24) continue;

    // Refresh an open reply_owed task instead of duplicating it.
    if (t.reply_owed_task_id) {
      const { data: task } = await sb.from("studio_tasks").select("id, status, archived_at").eq("id", t.reply_owed_task_id).maybeSingle();
      if (task && task.status !== "done" && !task.archived_at) {
        const today = new Date().toISOString().slice(0, 10);
        await sb.from("studio_tasks").update({ due_date: today, do_date: today }).eq("id", task.id);
        continue;
      }
    }

    const contact = client.contacts.find((c) => (c.email || "").toLowerCase() === (t.last_sender_email || "").toLowerCase());
    const who = contact?.name || t.last_sender_name || client.name;
    const res = await persistCandidates(
      sb,
      ctx,
      [
        {
          action: "reply_owed",
          title: `Reply to ${who}: ${t.subject || "email"}`.slice(0, 150),
          confidence: 0.95,
          payload: {
            title: `Reply to ${who} — ${t.subject || "email"}`.slice(0, 150),
            due_date: new Date().toISOString().slice(0, 10),
            project_id: t.project_id,
            promised_to_contact_id: contact?.id || null,
            promised_to_name: who,
          },
        },
      ],
      {
        source: "gmail",
        sourceRefPrefix: `gmail:${t.gmail_account}:${t.thread_id}:reply_owed:${t.last_message_id}`,
        rawText: t.subject || "",
        summary: `${who} has been waiting over 24 working hours for a reply.`,
        sender: who,
        clientId: client.id,
        projectId: t.project_id,
        gmailAccount: t.gmail_account,
        threadId: t.thread_id,
      }
    );
    if (!res.created) continue;
    created++;

    const { data: item } = await sb.from("studio_inbox_items").select("applied_entity_ref").eq("id", res.ids[0]).maybeSingle();
    const taskId = item?.applied_entity_ref?.startsWith("task:") ? item.applied_entity_ref.slice(5) : null;
    const threadPatch: Record<string, any> = { reply_owed_task_id: taskId };

    // Save a polite draft in Gmail Drafts — never sent.
    const acct = clients.get(t.gmail_account);
    if (acct && t.last_message_id && !t.draft_id) {
      try {
        const msg = parseMessage(await acct.gmail.getMessage(t.last_message_id));
        const project = ctx.projects.find((p) => p.id === t.project_id);
        const text = await aiDraft(
          {
            contactName: who,
            clientName: client.name,
            subject: msg.subject,
            lastMessage: msg.body,
            projectContext: project
              ? `${project.code} — ${project.title}; status ${project.status}${project.forecast_date ? `; forecast ${project.forecast_date}` : ""}`
              : undefined,
            confidential: isConfidential(ctx, client.id, t.project_id),
            feeNumbers: feeNumbersFor(ctx, client.id),
          },
          ctx.aiProvider
        );
        const d = await acct.gmail.createDraft({
          threadId: t.thread_id,
          from: acct.account.email,
          to: msg.from.email,
          subject: msg.subject,
          inReplyTo: msg.messageIdHeader,
          body: text,
        });
        threadPatch.draft_id = d.id;
        threadPatch.draft_message_id = d.messageId;
        drafts++;
      } catch (err: any) {
        console.warn(`[gmail-sync] draft failed for thread ${t.thread_id}: ${err?.name || "Error"}`);
      }
    }
    await sb.from("studio_email_threads").update(threadPatch).eq("id", t.id);
  }
  return { created, drafts };
}

/**
 * Rules for moving tasks automatically from email:
 *  - client replies on a project → tasks "waiting on client" for that client go back to To do
 *  - studio sends a delivery (AI: delivered=true) → the earliest open promise on that project is Done
 */
export async function statusCandidates(
  sb: SupabaseClient,
  o: { sent: boolean; projectId: string; account: string; threadId: string; contactName: string | null; clientName: string | null; delivered: boolean; confidence: number }
) {
  const out: Array<{ action: "update_task_status"; title: string; confidence: number; payload: Record<string, any> }> = [];
  if (!o.sent) {
    const { data: waiting } = await sb
      .from("studio_tasks")
      .select("id, key, title, waiting_on_name, source_ref")
      .eq("project_id", o.projectId)
      .eq("status", "waiting_on_client")
      .is("archived_at", null)
      .limit(20);
    const list = waiting || [];
    const names = [o.contactName, o.clientName].filter(Boolean).map((n) => String(n).toLowerCase());
    let picked = list.filter(
      (t: any) =>
        String(t.source_ref || "").startsWith(`gmail:${o.account}:${o.threadId}`) ||
        (t.waiting_on_name && names.some((n) => String(t.waiting_on_name).toLowerCase().includes(n.split(" ")[0])))
    );
    if (!picked.length && list.length === 1) picked = list;
    for (const t of picked.slice(0, 3)) {
      out.push({
        action: "update_task_status",
        title: `${t.key}: client replied → To do`,
        confidence: 0.95,
        payload: { task_id: t.id, status: "todo", reason: "client replied by email", project_id: o.projectId },
      });
    }
  } else if (o.delivered) {
    const { data: promises } = await sb
      .from("studio_tasks")
      .select("id, key, title, due_date")
      .eq("project_id", o.projectId)
      .eq("type", "promise")
      .neq("status", "done")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1);
    const t = promises?.[0];
    if (t) {
      out.push({
        action: "update_task_status",
        title: `${t.key}: delivered by email → Done`,
        confidence: o.confidence,
        payload: { task_id: t.id, status: "done", reason: "delivery email sent", project_id: o.projectId },
      });
    }
  }
  return out;
}
