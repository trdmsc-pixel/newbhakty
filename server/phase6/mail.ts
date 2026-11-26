import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { cleanEmailBody, draft as aiDraft } from "../../lib/ai/index.js";
import { extractBearerToken, getServiceSupabase, verifyOwnerJwt } from "../studioOsRoutes.js";
import { GmailAuthError, GmailClient, parseAddress, refreshAccessToken } from "../phase3/gmail.js";
import { feeNumbersFor, isConfidential, loadStudioCtx } from "../phase3/studioData.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function owner(req: Request, res: Response): Promise<SupabaseClient | null> {
  const check = await verifyOwnerJwt(extractBearerToken(req));
  if (!check.ok) {
    res.status(401).json({ error: "Owner sign-in required." });
    return null;
  }
  const sb = getServiceSupabase();
  if (!sb) {
    res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." });
    return null;
  }
  return sb;
}

interface Account {
  id: string;
  email: string;
  signature_text: string | null;
  signature_html: string | null;
  signature_enabled: boolean;
  granted_scopes: string | null;
}

async function accounts(sb: SupabaseClient): Promise<Account[]> {
  const { data } = await sb
    .from("studio_gmail_accounts")
    .select("id, email, signature_text, signature_html, signature_enabled, granted_scopes")
    .eq("is_active", true)
    .is("archived_at", null)
    .not("refresh_token_secret_id", "is", null)
    .order("email");
  return (data || []) as Account[];
}

const clientCache = new Map<string, { gmail: GmailClient; exp: number }>();
async function gmailFor(sb: SupabaseClient, acct: Account): Promise<GmailClient> {
  const hit = clientCache.get(acct.id);
  if (hit && hit.exp > Date.now()) return hit.gmail;
  const { data: token } = await sb.rpc("studio_gmail_get_token", { p_account_id: acct.id });
  if (!token) throw new GmailAuthError("No stored token — reconnect this account.");
  try {
    const gmail = new GmailClient(await refreshAccessToken(String(token)));
    clientCache.set(acct.id, { gmail, exp: Date.now() + 40 * 60 * 1000 });
    return gmail;
  } catch (err) {
    if (err instanceof GmailAuthError) {
      await sb.from("studio_gmail_accounts").update({ needs_reconnect: true, last_error: "Reconnect needed" }).eq("id", acct.id);
    }
    throw err;
  }
}

const canModify = (a: Account) => !a.granted_scopes || /gmail\.modify|mail\.google\.com/.test(a.granted_scopes);
const canSend = (a: Account) => !a.granted_scopes || /gmail\.send|mail\.google\.com/.test(a.granted_scopes);

function header(msg: any, name: string): string {
  return (msg?.payload?.headers || []).find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value || "";
}

function decode(data?: string): string {
  return data ? Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => (text.replace(/<[^>]+>/g, "").trim() === href ? href : `${text} (${href})`))
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function walk(part: any, acc: { plain: string; html: string; attachments: any[] }) {
  if (!part) return;
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({ filename: part.filename, mimeType: part.mimeType, size: part.body.size || 0 });
  } else if (part.mimeType === "text/plain" && part.body?.data && !acc.plain) acc.plain = decode(part.body.data);
  else if (part.mimeType === "text/html" && part.body?.data && !acc.html) acc.html = decode(part.body.data);
  (part.parts || []).forEach((p: any) => walk(p, acc));
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textToHtml = (s: string) =>
  escapeHtml(s)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");

const encodeHeader = (s: string) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);
const cleanAddr = (s: string) => s.replace(/[\r\n]/g, "").trim();

function buildMime(opts: {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const boundary = `sos_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${cleanAddr(opts.from)}`,
    `To: ${opts.to.map(cleanAddr).join(", ")}`,
    ...(opts.cc.length ? [`Cc: ${opts.cc.map(cleanAddr).join(", ")}`] : []),
    `Subject: ${encodeHeader(opts.subject.replace(/[\r\n]/g, " "))}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${cleanAddr(opts.inReplyTo)}`] : []),
    ...(opts.references || opts.inReplyTo ? [`References: ${cleanAddr(opts.references || opts.inReplyTo || "")}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text, "utf8").toString("base64"),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${opts.html}</div>`, "utf8").toString("base64"),
    `--${boundary}--`,
  ];
  return Buffer.from([...headers, "", ...body].join("\r\n"), "utf8").toString("base64url");
}

/** Resolve the signature to append: an account's signature, the studio default, or none. */
async function signatureFor(sb: SupabaseClient, all: Account[], choice: string, fromAcct: Account): Promise<{ text: string; html: string } | null> {
  if (choice === "none") return null;
  if (choice === "default") {
    const { data } = await sb.from("studio_settings").select("default_signature_text, default_signature_html").limit(1).maybeSingle();
    const text = data?.default_signature_text || "";
    return text ? { text, html: data?.default_signature_html || textToHtml(text) } : null;
  }
  const acct = choice === "account" ? fromAcct : all.find((a) => a.email === choice) || fromAcct;
  if (!acct.signature_enabled || !acct.signature_text) return null;
  return { text: acct.signature_text, html: acct.signature_html || textToHtml(acct.signature_text) };
}

const FILTER_QUERY: Record<string, string> = {
  important: "in:inbox is:important",
  unread: "in:inbox is:unread",
  all: "in:inbox",
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
export function registerMailRoutes(app: Express) {
  app.get("/api/studio-os/mail/accounts", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const list = await accounts(sb);
    const { data: settings } = await sb.from("studio_settings").select("default_signature_text").limit(1).maybeSingle();
    res.json({
      accounts: list.map((a) => ({ id: a.id, email: a.email, can_send: canSend(a), can_modify: canModify(a), has_signature: Boolean(a.signature_enabled && a.signature_text) })),
      default_signature: Boolean(settings?.default_signature_text),
    });
  });

  app.get("/api/studio-os/mail/counts", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    let unreadImportant = 0;
    await Promise.all(
      (await accounts(sb)).map(async (a) => {
        try {
          const r = await (await gmailFor(sb, a)).listThreads("in:inbox is:unread is:important", 50);
          unreadImportant += r.threads?.length || 0;
        } catch {
          /* account needs reconnect — ignore in the count */
        }
      })
    );
    res.json({ unread_important: unreadImportant });
  });

  app.get("/api/studio-os/mail/threads", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const filter = String(req.query.filter || "important");
    const account = typeof req.query.account === "string" ? req.query.account : "";
    const search = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
    const all = await accounts(sb);
    const targets = account ? all.filter((a) => a.email === account) : all;

    // Studio OS enrichment: project/client matches, reply-owed and linked tasks.
    const { data: known } = await sb
      .from("studio_email_threads")
      .select("gmail_account, thread_id, client_id, project_id, needs_reply, last_from, reply_owed_task_id, summary")
      .in("gmail_account", targets.map((t) => t.email).length ? targets.map((t) => t.email) : ["-"]);
    const knownMap = new Map((known || []).map((k: any) => [`${k.gmail_account}:${k.thread_id}`, k]));
    const { data: openTasks } = await sb
      .from("studio_tasks")
      .select("id, key, title, source_ref, status")
      .like("source_ref", "gmail:%")
      .neq("status", "done")
      .is("archived_at", null)
      .limit(500);
    const taskFor = (acct: string, threadId: string) =>
      (openTasks || []).filter((t: any) => String(t.source_ref).startsWith(`gmail:${acct}:${threadId}`)).map((t: any) => ({ id: t.id, key: t.key, title: t.title }));
    const { data: projects } = await sb.from("studio_projects").select("id, code, emoji, title");
    const projectById = new Map((projects || []).map((p: any) => [p.id, p]));

    const out: any[] = [];
    const errors: string[] = [];
    await Promise.all(
      targets.map(async (a) => {
        try {
          const gmail = await gmailFor(sb, a);
          let ids: string[] = [];
          if (filter === "needs_reply" || filter === "has_task") {
            ids = (known || [])
              .filter((k: any) => k.gmail_account === a.email)
              .filter((k: any) => (filter === "needs_reply" ? k.needs_reply && k.last_from === "client" : taskFor(a.email, k.thread_id).length > 0 || k.reply_owed_task_id))
              .map((k: any) => k.thread_id)
              .slice(0, 30);
          } else {
            const q = [FILTER_QUERY[filter] || FILTER_QUERY.all, search].filter(Boolean).join(" ");
            ids = ((await gmail.listThreads(q, 25)).threads || []).map((t) => t.id);
          }
          const metas = await Promise.all(ids.map((id) => gmail.getThreadSummary(id).catch(() => null)));
          for (const t of metas) {
            if (!t) continue;
            const msgs = t.messages || [];
            const last = msgs[msgs.length - 1];
            const first = msgs[0];
            const labels = new Set<string>(msgs.flatMap((m: any) => m.labelIds || []));
            const k: any = knownMap.get(`${a.email}:${t.id}`);
            const project = k?.project_id ? projectById.get(k.project_id) : null;
            const from = parseAddress(header(last, "From"));
            out.push({
              account: a.email,
              thread_id: t.id,
              subject: header(first, "Subject") || "(no subject)",
              from_name: from.name || from.email,
              from_email: from.email,
              snippet: (last?.snippet || "").slice(0, 200),
              date: last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : null,
              unread: labels.has("UNREAD"),
              important: labels.has("IMPORTANT"),
              message_count: msgs.length,
              needs_reply: Boolean(k?.needs_reply && k?.last_from === "client"),
              project: project ? { id: project.id, code: project.code, emoji: project.emoji } : null,
              tasks: taskFor(a.email, t.id),
            });
          }
        } catch (err: any) {
          errors.push(`${a.email}: ${err instanceof GmailAuthError ? "reconnect needed" : err?.message || "failed"}`);
        }
      })
    );
    out.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
    res.json({ threads: out, errors });
  });

  app.get("/api/studio-os/mail/thread/:threadId", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const acct = (await accounts(sb)).find((a) => a.email === req.query.account);
    if (!acct) return res.status(404).json({ error: "Account not connected." });
    try {
      const t = await (await gmailFor(sb, acct)).getThread(req.params.threadId);
      const messages = (t.messages || []).map((m: any) => {
        const acc = { plain: "", html: "", attachments: [] as any[] };
        walk(m.payload, acc);
        const text = acc.plain || htmlToText(acc.html);
        return {
          id: m.id,
          message_id_header: header(m, "Message-ID"),
          references: header(m, "References"),
          from: parseAddress(header(m, "From")),
          to: header(m, "To"),
          cc: header(m, "Cc"),
          date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
          subject: header(m, "Subject"),
          // Plain text only — never raw HTML — so nothing from an email can run in Studio OS.
          text: text.slice(0, 50_000),
          attachments: acc.attachments,
          unread: (m.labelIds || []).includes("UNREAD"),
          sent: (m.labelIds || []).includes("SENT"),
        };
      });
      const labels = new Set<string>((t.messages || []).flatMap((m: any) => m.labelIds || []));
      res.json({ thread_id: t.id, account: acct.email, important: labels.has("IMPORTANT"), unread: labels.has("UNREAD"), messages });
    } catch (err: any) {
      res.status(err?.status === 404 ? 404 : 502).json({ error: err?.message || "Could not load thread." });
    }
  });

  const modifySchema = z.object({
    account: z.string().email(),
    thread_id: z.string().min(1).max(64),
    action: z.enum(["read", "unread", "important", "unimportant", "archive"]),
  });
  app.post("/api/studio-os/mail/modify", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const body = modifySchema.safeParse(req.body || {});
    if (!body.success) return res.status(400).json({ error: "Invalid request." });
    const acct = (await accounts(sb)).find((a) => a.email === body.data.account);
    if (!acct) return res.status(404).json({ error: "Account not connected." });
    if (!canModify(acct)) return res.status(403).json({ error: "Reconnect this account to allow read/archive changes (new Gmail permission)." });
    const map: Record<string, [string[], string[]]> = {
      read: [[], ["UNREAD"]],
      unread: [["UNREAD"], []],
      important: [["IMPORTANT"], []],
      unimportant: [[], ["IMPORTANT"]],
      archive: [[], ["INBOX"]],
    };
    try {
      const [add, remove] = map[body.data.action];
      await (await gmailFor(sb, acct)).modifyThread(body.data.thread_id, add, remove);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Gmail update failed." });
    }
  });

  const sendSchema = z.object({
    account: z.string().email(),
    to: z.array(z.string().trim().email()).min(1).max(20),
    cc: z.array(z.string().trim().email()).max(20).default([]),
    subject: z.string().trim().max(300).default(""),
    body: z.string().max(50_000),
    thread_id: z.string().max(64).optional(),
    in_reply_to: z.string().max(500).optional(),
    references: z.string().max(4000).optional(),
    signature: z.string().max(200).default("account"), // "account" | "default" | "none" | <account email>
    mode: z.enum(["send", "draft"]).default("send"),
    project_id: z.string().uuid().optional(),
  });
  app.post("/api/studio-os/mail/send", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = sendSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Check the recipients and message." });
    const b = parsed.data;
    const all = await accounts(sb);
    const acct = all.find((a) => a.email === b.account);
    if (!acct) return res.status(404).json({ error: "Account not connected." });
    if (b.mode === "send" && !canSend(acct)) return res.status(403).json({ error: "Reconnect this account to allow sending (new Gmail permission)." });

    const sig = await signatureFor(sb, all, b.signature, acct);
    const text = sig ? `${b.body.trimEnd()}\n\n--\n${sig.text}` : b.body;
    const html = sig ? `${textToHtml(b.body.trimEnd())}<br><br><div style="color:#5F6672">--<br>${sig.html}</div>` : textToHtml(b.body);
    const subject = b.thread_id && b.subject && !/^re:/i.test(b.subject) ? `Re: ${b.subject}` : b.subject;
    const raw = buildMime({ from: acct.email, to: b.to, cc: b.cc, subject, text, html, inReplyTo: b.in_reply_to, references: b.references });

    try {
      const gmail = await gmailFor(sb, acct);
      const result = b.mode === "draft" ? await gmail.draftRaw(raw, b.thread_id) : await gmail.sendRaw(raw, b.thread_id);
      if (b.mode === "send") {
        const threadId = b.thread_id || result?.threadId;
        // Studio-side bookkeeping: reply sent → no longer owed.
        if (threadId) {
          const { data: th } = await sb
            .from("studio_email_threads")
            .select("id, reply_owed_task_id")
            .eq("gmail_account", acct.email)
            .eq("thread_id", threadId)
            .maybeSingle();
          if (th) {
            await sb.from("studio_email_threads").update({ needs_reply: false, last_from: "studio", last_message_at: new Date().toISOString(), draft_id: null, draft_message_id: null }).eq("id", th.id);
            if (th.reply_owed_task_id) await sb.from("studio_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", th.reply_owed_task_id);
          } else if (b.project_id) {
            await sb.from("studio_email_threads").upsert(
              { gmail_account: acct.email, thread_id: threadId, subject: subject.slice(0, 300), project_id: b.project_id, last_from: "studio", last_message_at: new Date().toISOString(), needs_reply: false },
              { onConflict: "gmail_account,thread_id" }
            );
          }
        }
        await sb.from("studio_activity_log").insert({
          actor: "member",
          actor_name: "Shyam",
          entity_type: "email",
          entity_id: b.project_id || null,
          action: `sent email from ${acct.email}: ${subject.slice(0, 120)}`,
        });
      }
      res.json({ ok: true, mode: b.mode, thread_id: result?.threadId || result?.message?.threadId || b.thread_id || null });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "Gmail send failed." });
    }
  });

  // AI draft for Quick Reply — returns text only; never sends or saves.
  app.post("/api/studio-os/mail/ai-draft", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const body = z.object({ account: z.string().email(), thread_id: z.string().max(64) }).safeParse(req.body || {});
    if (!body.success) return res.status(400).json({ error: "Invalid request." });
    const acct = (await accounts(sb)).find((a) => a.email === body.data.account);
    if (!acct) return res.status(404).json({ error: "Account not connected." });
    try {
      const t = await (await gmailFor(sb, acct)).getThread(body.data.thread_id);
      const inbound = [...(t.messages || [])].reverse().find((m: any) => !(m.labelIds || []).includes("SENT")) || t.messages?.[t.messages.length - 1];
      const acc = { plain: "", html: "", attachments: [] as any[] };
      walk(inbound?.payload, acc);
      const ctx = await loadStudioCtx(sb);
      const { data: k } = await sb.from("studio_email_threads").select("client_id, project_id").eq("gmail_account", acct.email).eq("thread_id", body.data.thread_id).maybeSingle();
      const project = ctx.projects.find((p) => p.id === k?.project_id);
      const from = parseAddress(header(inbound, "From"));
      const text = await aiDraft(
        {
          contactName: from.name || from.email,
          clientName: ctx.clients.find((c) => c.id === k?.client_id)?.name,
          subject: header(inbound, "Subject"),
          lastMessage: cleanEmailBody(acc.plain || htmlToText(acc.html)),
          projectContext: project ? `${project.code} — ${project.title}; status ${project.status}${project.forecast_date ? `; forecast ${project.forecast_date}` : ""}` : undefined,
          confidential: isConfidential(ctx, k?.client_id, k?.project_id),
          feeNumbers: feeNumbersFor(ctx, k?.client_id),
        },
        ctx.aiProvider
      );
      // Signature is appended at send time — strip any sign-off line the model adds after "Shyam".
      res.json({ text: text.replace(/\n+Shyam\s*$/i, "").trim() });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || "AI draft failed." });
    }
  });
}
