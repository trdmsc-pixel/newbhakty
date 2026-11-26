import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { aiStatus, extract as aiExtract, split as aiSplit, AIUnavailableError, type AIImageInput } from "../../lib/ai/index.js";
import { extractBearerToken, getEnv, getServiceSupabase, verifyCronOrOwnerAuth, verifyOwnerJwt } from "../studioOsRoutes.js";
import { buildAuthUrl, exchangeCode, GMAIL_SCOPES, GmailClient, googleConfigured, redirectUri, signState, verifyState } from "./gmail.js";
import { runGmailSync } from "./gmailSync.js";
import { applyItem, createLead, persistCandidates, planActions, undoItem, AUTO_APPLY_THRESHOLD, type Candidate, type InboxSource } from "./inboxEngine.js";
import { ctxHints, loadStudioCtx, matchClientByName, matchProject, type StudioCtx } from "./studioData.js";
import { runBackup } from "./backup.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function requireOwner(req: Request, res: Response): Promise<boolean> {
  const check = await verifyOwnerJwt(extractBearerToken(req));
  if (!check.ok) {
    res.status(401).json({ error: "Owner sign-in required." });
    return false;
  }
  return true;
}

function serviceOr500(res: Response) {
  const sb = getServiceSupabase();
  if (!sb) res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." });
  return sb;
}

function errorMessage(err: any): string {
  if (err instanceof z.ZodError) return "Invalid request body.";
  return String(err?.message || "Request failed").slice(0, 300);
}

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

const memoryBuckets = new Map<string, number[]>();
function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (memoryBuckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  memoryBuckets.set(key, hits);
  if (memoryBuckets.size > 5000) memoryBuckets.clear();
  return hits.length > max;
}

function clientIp(req: Request): string {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function imagesFrom(body: { image_base64?: string; image_mime?: string }): AIImageInput[] | undefined {
  if (!body.image_base64) return undefined;
  const data = body.image_base64.includes(",") ? body.image_base64.split(",").pop()! : body.image_base64;
  return [{ mimeType: body.image_mime || "image/jpeg", base64: data }];
}

function confidentialFees(ctx: StudioCtx): number[] {
  return ctx.projects.filter((p) => p.is_confidential && p.fee_amount).map((p) => Number(p.fee_amount));
}

/** Shared ingest pipeline for /api/ingest and in-app quick capture. */
async function ingestText(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  input: { text: string; source: InboxSource; images?: AIImageInput[]; tokenId?: string | null; review?: boolean; sender?: string | null }
) {
  const ctx = await loadStudioCtx(sb);
  const ex = await aiExtract(
    { text: input.text, source: input.source, images: input.images, isEmail: false, confidential: true, feeNumbers: confidentialFees(ctx) },
    ctxHints(ctx),
    ctx.aiProvider
  );
  const client = matchClientByName(ctx, ex.client_match);
  const project = matchProject(ctx, input.text, { clientId: client?.id, aiHint: ex.project_match });
  let candidates: Candidate[] = planActions(ex, {
    direction: "received",
    projectId: project?.id || null,
    clientId: client?.id || null,
    contactName: client?.contacts[0]?.name || client?.name || null,
  });
  if (!candidates.length) {
    candidates = [{ action: "create_task", title: ex.summary || input.text.slice(0, 80), confidence: Math.min(ex.confidence, 0.7), payload: { title: ex.summary || input.text.slice(0, 80), project_id: project?.id || null, due_date: null, type: "task" } }];
  }
  const res = await persistCandidates(sb, ctx, candidates, {
    source: input.source,
    sourceRefPrefix: `${input.source}:${crypto.randomUUID()}`,
    rawText: input.text || "(image)",
    summary: ex.summary,
    sender: input.sender || client?.name || null,
    clientId: client?.id || null,
    projectId: project?.id || null,
    aiJson: ex,
    ingestTokenId: input.tokenId || null,
    forceReview: input.review,
  });
  return { summary: ex.summary, confidence: ex.confidence, project: project?.code || null, ...res };
}

// ---------------------------------------------------------------------------
// Website inquiry (HMAC)
// ---------------------------------------------------------------------------
const websiteLeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  company: z.string().trim().max(160).optional().default(""),
  brief: z.string().trim().max(5000).optional().default(""),
  budget: z.string().trim().max(80).optional().default(""),
  selected_tier: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  timeline: z.string().trim().max(80).optional().default(""),
});

export function signWebsitePayload(payload: string, timestamp: string): string {
  return crypto.createHmac("sha256", getEnv("INGEST_HMAC_SECRET")).update(`${timestamp}.${payload}`).digest("hex");
}

function verifyWebsiteSignature(payload: string, timestamp: string, signature: string): boolean {
  if (!getEnv("INGEST_HMAC_SECRET") || !payload || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) return false;
  const expected = signWebsitePayload(payload, timestamp);
  const given = signature.replace(/^sha256=/, "");
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handleWebsiteLead(payloadStr: string, timestamp: string, signature: string) {
  if (!verifyWebsiteSignature(payloadStr, timestamp, signature)) {
    const err: any = new Error("Invalid signature.");
    err.status = 401;
    throw err;
  }
  const lead = websiteLeadSchema.parse(JSON.parse(payloadStr));
  const sb = getServiceSupabase();
  if (!sb) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured.");

  const sourceRef = `website:${hashToken(`${lead.email}|${lead.brief}`).slice(0, 24)}`;
  const { data: dupe } = await sb.from("studio_inbox_items").select("id").like("source_ref", `${sourceRef}%`).limit(1);
  if (dupe && dupe.length) return { ok: true, duplicate: true };

  const ctx = await loadStudioCtx(sb);
  const brief = [
    lead.brief,
    lead.selected_tier ? `Making: ${lead.selected_tier}` : "",
    lead.timeline ? `Timeline: ${lead.timeline}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const res = await createLead(sb, ctx, {
    name: lead.name,
    email: lead.email,
    organisation: lead.company,
    brief,
    phone: lead.phone,
    budget: lead.budget,
    source: "website",
    sourceRef,
  });
  await sb.from("studio_inbox_items").insert({
    source: "website",
    raw_text: brief.slice(0, 2000) || "(no brief)",
    source_ref: `${sourceRef}#0`,
    suggested_action: "new_lead",
    confidence: 1,
    matched_client_id: res.clientId,
    matched_project_id: res.projectId,
    status: "auto_applied",
    title: `New inquiry: ${lead.name}${lead.company ? ` (${lead.company})` : ""}`,
    summary: (lead.brief || lead.selected_tier || "Website inquiry").split(/\s+/).slice(0, 20).join(" "),
    sender: lead.name,
    payload: { name: lead.name, email: lead.email, organisation: lead.company, budget: lead.budget },
    applied_entity_ref: `project:${res.projectId}`,
    undo_payload: { op: "archive_lead", project_id: res.projectId, task_id: res.taskId, client_id: res.createdClient ? res.clientId : null },
    resolved_at: new Date().toISOString(),
  });
  return { ok: true, project: res.projectCode };
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------
export function registerPhase3Routes(app: Express) {
  // ---- AI status / provider info ----
  app.get("/api/studio-os/ai/status", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    res.json({ ...aiStatus(), google: googleConfigured(), hmac: Boolean(getEnv("INGEST_HMAC_SECRET")) });
  });

  // ---- Gmail OAuth ----
  app.get("/api/studio-os/gmail/auth-url", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    if (!googleConfigured()) return res.status(400).json({ error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel first." });
    const hint = typeof req.query.hint === "string" ? req.query.hint.slice(0, 200) : undefined;
    const label = typeof req.query.label === "string" ? req.query.label.slice(0, 60) : undefined;
    res.json({ url: buildAuthUrl(req, signState({ label }), hint) });
  });

  app.get("/api/studio-os/gmail/callback", async (req, res) => {
    // Redirect back with a status and a short, non-secret reason so the UI can say what went wrong.
    const back = (status: string, detail?: string) =>
      res.redirect(
        302,
        `/studio-os?gmail=${encodeURIComponent(status)}${detail ? `&detail=${encodeURIComponent(detail.replace(/[^\w .:/@-]/g, "").slice(0, 160))}` : ""}`
      );
    if (req.query.error) return back("denied", String(req.query.error));
    const state = verifyState(String(req.query.state || ""));
    if (!state) return back("expired");

    let tokens: Awaited<ReturnType<typeof exchangeCode>>;
    try {
      tokens = await exchangeCode(req, String(req.query.code || ""));
    } catch (err: any) {
      console.warn(`[gmail-oauth] token exchange failed: ${err?.message}`);
      return back("token_exchange", err?.message || "token exchange failed");
    }
    if (!tokens.refresh_token) return back("no_refresh_token");

    let profile: { emailAddress: string; historyId: string };
    try {
      profile = await new GmailClient(tokens.access_token).profile();
    } catch (err: any) {
      console.warn(`[gmail-oauth] gmail profile failed: ${err?.message}`);
      return back("gmail_api", err?.message || "Gmail API call failed");
    }

    const email = profile.emailAddress.toLowerCase();
    const sb = getServiceSupabase();
    if (!sb) return back("server_config", "SUPABASE_SERVICE_ROLE_KEY missing");
    const { data: accountId, error } = await sb.rpc("studio_gmail_save_token", {
      p_email: email,
      p_token: tokens.refresh_token,
      p_label: state.label || null,
      p_is_personal: /@(gmail|googlemail)\.com$/.test(email),
    });
    if (error) {
      console.warn(`[gmail-oauth] save failed: ${error.message}`);
      return back("save_failed", error.message);
    }
    // Start incremental sync from "now" (no backfill of old history).
    await sb
      .from("studio_gmail_accounts")
      .update({ last_history_id: profile.historyId, granted_scopes: String(tokens.scope || "") })
      .eq("id", accountId);
    const defaults: Record<string, string> = {
      "shyam@thechantingstudio.in": "Shyam Sharma\nFounder, The Chanting Studio\nthechantingstudio.in",
      "studio@thechantingstudio.in": "The Chanting Studio\nstudio@thechantingstudio.in · thechantingstudio.in",
      "accounts@thechantingstudio.in": "Accounts · The Chanting Studio\naccounts@thechantingstudio.in · thechantingstudio.in",
    };
    await sb
      .from("studio_gmail_accounts")
      .update({ signature_text: defaults[email] || "Shyam Sharma\nThe Chanting Studio\nthechantingstudio.in" })
      .eq("id", accountId)
      .is("signature_text", null);
    return back("connected", email);
  });

  // Owner-only self-check of the Google OAuth setup (no account is connected).
  app.get("/api/studio-os/gmail/diagnose", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const redirect = redirectUri(req);
    const checks: Array<{ check: string; ok: boolean; detail: string }> = [];
    const id = getEnv("GOOGLE_CLIENT_ID");
    const secret = getEnv("GOOGLE_CLIENT_SECRET");
    checks.push({ check: "GOOGLE_CLIENT_ID set", ok: Boolean(id), detail: id ? `${id.slice(0, 12)}…${id.slice(-28)}` : "missing" });
    checks.push({ check: "GOOGLE_CLIENT_SECRET set", ok: Boolean(secret), detail: secret ? `${secret.length} characters, starts ${secret.slice(0, 7)}` : "missing" });
    checks.push({ check: "Redirect URI used", ok: true, detail: redirect });
    if (id && secret) {
      // Exchanging a fake code tells us whether Google accepts the client + redirect URI.
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: "diagnostic-invalid-code", client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
      });
      const j: any = await r.json().catch(() => ({}));
      const err = String(j?.error || "");
      const ok = err === "invalid_grant";
      checks.push({
        check: "Google accepts Client ID + secret + redirect URI",
        ok,
        detail: ok
          ? "Yes (credentials valid)"
          : err === "invalid_client"
          ? "invalid_client — the client secret (or ID) is wrong. Create a new secret in Google Cloud → Clients and paste it into Vercel."
          : err === "redirect_uri_mismatch"
          ? `redirect_uri_mismatch — add ${redirect} to Authorised redirect URIs.`
          : `${err} ${j?.error_description || ""}`.trim(),
      });
    }
    checks.push({ check: "Requested scopes", ok: true, detail: GMAIL_SCOPES.map((s) => s.split("/").pop()).join(", ") });
    res.json({ ok: checks.every((c) => c.ok), checks });
  });

  app.post("/api/studio-os/gmail/disconnect", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    const id = z.object({ account_id: z.string().uuid() }).safeParse(req.body);
    if (!id.success) return res.status(400).json({ error: "account_id required" });
    const { error } = await sb.rpc("studio_gmail_forget_token", { p_account_id: id.data.account_id });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  app.post("/api/studio-os/gmail/sync-now", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      res.json({ ok: true, ...(await runGmailSync(sb)) });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  // ---- Inbox actions ----
  const loadItem = async (sb: any, id: string) => {
    const { data } = await sb.from("studio_inbox_items").select("*").eq("id", id).maybeSingle();
    return data;
  };

  app.post("/api/studio-os/inbox/:id/accept", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      const item = await loadItem(sb, req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      if (item.status !== "pending") return res.status(409).json({ error: "Already handled." });
      const edits = z.record(z.string(), z.any()).optional().parse(req.body?.edits) || {};
      const ctx = await loadStudioCtx(sb);
      const result = await applyItem(sb, ctx, item, edits);
      await sb
        .from("studio_inbox_items")
        .update({
          status: "accepted",
          applied_entity_ref: result.entityRef,
          undo_payload: result.undo,
          payload: { ...(item.payload || {}), ...edits },
          resolved_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      res.json({ ok: true, entity: result.entityRef });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.post("/api/studio-os/inbox/:id/dismiss", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    await sb.from("studio_inbox_items").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", req.params.id).eq("status", "pending");
    res.json({ ok: true });
  });

  app.post("/api/studio-os/inbox/:id/undo", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      const item = await loadItem(sb, req.params.id);
      if (!item) return res.status(404).json({ error: "Not found" });
      if (!["auto_applied", "accepted"].includes(item.status)) return res.status(409).json({ error: "Nothing to undo." });
      await undoItem(sb, item);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  app.post("/api/studio-os/inbox/accept-all-high", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    const { data: items } = await sb
      .from("studio_inbox_items")
      .select("*")
      .eq("status", "pending")
      .gte("confidence", AUTO_APPLY_THRESHOLD)
      .is("archived_at", null)
      .limit(50);
    const ctx = await loadStudioCtx(sb);
    let accepted = 0;
    const failed: string[] = [];
    for (const item of items || []) {
      try {
        const r = await applyItem(sb, ctx, item);
        await sb
          .from("studio_inbox_items")
          .update({ status: "accepted", applied_entity_ref: r.entityRef, undo_payload: r.undo, resolved_at: new Date().toISOString() })
          .eq("id", item.id);
        accepted++;
      } catch (err) {
        failed.push(`${item.title || item.suggested_action}: ${errorMessage(err)}`);
      }
    }
    res.json({ ok: true, accepted, failed });
  });

  // ---- AI parse (Quick Add paste / voice / share target) ----
  app.post("/api/studio-os/ai/parse", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      const body = z
        .object({ text: z.string().max(60000).default(""), image_base64: z.string().max(7_000_000).optional(), image_mime: z.string().max(40).optional() })
        .parse(req.body || {});
      if (!body.text.trim() && !body.image_base64) return res.status(400).json({ error: "Nothing to parse." });
      const ctx = await loadStudioCtx(sb);
      const result = await aiSplit(body.text, ctxHints(ctx), { preferred: ctx.aiProvider, confidentialFees: confidentialFees(ctx), images: imagesFrom(body) });
      const items = result.items.map((it) => {
        const project = matchProject(ctx, `${it.title} ${it.project_match || ""}`, { aiHint: it.project_match });
        return { ...it, project_id: project?.id || null, project_code: project?.code || null };
      });
      res.json({ items });
    } catch (err) {
      res.status(err instanceof AIUnavailableError ? 503 : 400).json({ error: errorMessage(err) });
    }
  });

  // ---- Import reviewed items (WhatsApp export / paste) ----
  const importSchema = z.object({
    source: z.enum(["whatsapp", "manual"]).default("whatsapp"),
    items: z
      .array(
        z.object({
          kind: z.enum(["task", "promise", "deadline", "approval", "payment"]),
          title: z.string().trim().min(1).max(160),
          due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
          project_id: z.string().uuid().nullable().optional(),
          who: z.string().max(120).nullable().optional(),
          confidence: z.number().min(0).max(1).optional(),
        })
      )
      .max(80),
  });

  app.post("/api/studio-os/inbox/import", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      const body = importSchema.parse(req.body || {});
      const ctx = await loadStudioCtx(sb);
      const batchId = crypto.randomUUID();
      // Tasks & promises are confirmed by the checkbox review → create directly.
      // Approvals, deadline moves and payments stay as suggestions (destructive).
      const candidates: Candidate[] = body.items.map((it) => {
        const confidence = it.confidence ?? 0.8;
        const base = { project_id: it.project_id || null, due_date: it.due_date || null };
        switch (it.kind) {
          case "promise":
            return { action: "create_promise", title: it.title, confidence, payload: { ...base, title: it.title, type: "promise", promised_to_name: it.who || null } };
          case "approval":
            return { action: "approve_gate", title: it.title, confidence, payload: { ...base, gate_hint: it.title } };
          case "deadline":
            return { action: "update_deadline", title: it.title, confidence, payload: { ...base, new_date: it.due_date || null, note: it.title } };
          case "payment":
            return { action: "log_payment", title: it.title, confidence, payload: { ...base, status: "mentioned", note: it.title } };
          default:
            return { action: "create_task", title: it.title, confidence, payload: { ...base, title: it.title, type: "task" } };
        }
      });
      const direct = candidates.filter((c) => c.action === "create_task" || c.action === "create_promise");
      const review = candidates.filter((c) => !direct.includes(c));
      let tasksCreated = 0;
      for (const c of direct) {
        await applyItem(sb, ctx, { suggested_action: c.action, payload: c.payload, source: body.source, title: c.title, source_ref: `${body.source}:import:${batchId}` });
        tasksCreated++;
      }
      const r = review.length
        ? await persistCandidates(sb, ctx, review, {
            source: body.source,
            sourceRefPrefix: `${body.source}:import:${batchId}`,
            rawText: review.map((c) => c.title).join("\n"),
            summary: `Imported from ${body.source === "whatsapp" ? "WhatsApp chat" : "paste"}`,
            forceReview: true,
          })
        : { created: 0 };
      res.json({ ok: true, tasksCreated, suggestions: r.created });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err) });
    }
  });

  // ---- Per-member ingest tokens ----
  app.post("/api/studio-os/ingest-tokens", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    const label = typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim().slice(0, 60) : "iPhone Shortcut";
    const token = `sos_${crypto.randomBytes(24).toString("base64url")}`;
    const { data: member } = await sb.from("studio_members").select("id").eq("role", "owner").eq("is_active", true).limit(1).maybeSingle();
    const { data, error } = await sb
      .from("studio_ingest_tokens")
      .insert({ label, token_hash: hashToken(token), token_hint: `…${token.slice(-4)}`, member_id: member?.id || null })
      .select("id, label, token_hint, created_at")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ...data, token }); // plaintext shown once
  });

  app.delete("/api/studio-os/ingest-tokens/:id", async (req, res) => {
    if (!(await requireOwner(req, res))) return;
    const sb = serviceOr500(res);
    if (!sb) return;
    await sb.from("studio_ingest_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", req.params.id);
    res.json({ ok: true });
  });

  // ---- External ingest (Apple Shortcut, scheduled tasks, scripts) ----
  const ingestSchema = z.object({
    text: z.string().max(20000).optional().default(""),
    url: z.string().url().max(2000).optional(),
    image_base64: z.string().max(7_000_000).optional(),
    image_mime: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]).optional(),
    source: z.enum(["whatsapp", "manual", "claude_task", "portal"]).optional().default("manual"),
    sender: z.string().max(120).optional(),
    review: z.boolean().optional().default(false),
  });

  app.post("/api/ingest", async (req, res) => {
    const sb = serviceOr500(res);
    if (!sb) return;
    const token = extractBearerToken(req);
    if (!token.startsWith("sos_")) return res.status(401).json({ error: "Bearer ingest token required." });
    const { data: tok } = await sb.from("studio_ingest_tokens").select("id, revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
    if (!tok || tok.revoked_at) return res.status(401).json({ error: "Invalid or revoked token." });

    if (rateLimited(`ingest:${tok.id}`, 20, 60_000)) return res.status(429).json({ error: "Slow down — max 20 per minute." });
    const { count } = await sb
      .from("studio_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("ingest_token_id", tok.id)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count || 0) > 300) return res.status(429).json({ error: "Hourly limit reached." });

    try {
      const body = ingestSchema.parse(req.body || {});
      const text = [body.text, body.url].filter(Boolean).join("\n").trim();
      if (!text && !body.image_base64) return res.status(400).json({ error: "Send text, url, or image_base64." });
      await sb.from("studio_ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);
      const result = await ingestText(sb, {
        text,
        source: body.source,
        images: imagesFrom(body),
        tokenId: tok.id,
        review: body.review,
        sender: body.sender || null,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err instanceof AIUnavailableError ? 503 : 400).json({ error: errorMessage(err) });
    }
  });

  // HMAC-signed website inquiry. Body: { payload: "<json string>" }.
  // Headers: X-Studio-Timestamp (ms), X-Studio-Signature: sha256=<hex of HMAC(ts + "." + payload)>
  app.post("/api/ingest/website", async (req, res) => {
    try {
      const payload = typeof req.body?.payload === "string" ? req.body.payload : "";
      const result = await handleWebsiteLead(payload, String(req.headers["x-studio-timestamp"] || ""), String(req.headers["x-studio-signature"] || ""));
      res.json(result);
    } catch (err: any) {
      res.status(err?.status || 400).json({ error: errorMessage(err) });
    }
  });

  // Public relay for the website BookingForm: the browser never holds the HMAC secret,
  // so the server signs the payload and hands it to the same verified handler.
  app.post("/api/inquiry", async (req, res) => {
    if (rateLimited(`inquiry:${clientIp(req)}`, 5, 10 * 60_000)) return res.status(429).json({ error: "Too many inquiries — please try again later." });
    if (typeof req.body?.website === "string" && req.body.website.trim()) return res.json({ ok: true }); // honeypot
    if (!getEnv("INGEST_HMAC_SECRET")) return res.status(503).json({ error: "Inquiry relay not configured." });
    try {
      const lead = websiteLeadSchema.parse(req.body || {});
      const payload = JSON.stringify(lead);
      const ts = String(Date.now());
      const result = await handleWebsiteLead(payload, ts, `sha256=${signWebsitePayload(payload, ts)}`);
      res.json(result);
    } catch (err: any) {
      res.status(err?.status || 400).json({ error: errorMessage(err) });
    }
  });

  // ---- Crons ----
  app.all("/api/cron/gmail-sync", async (req, res) => {
    if (!(await verifyCronOrOwnerAuth(req))) return res.status(401).json({ error: "Unauthorized" });
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      res.json({ ok: true, ...(await runGmailSync(sb)) });
    } catch (err) {
      console.error(`[gmail-sync] failed: ${errorMessage(err)}`);
      res.status(500).json({ error: errorMessage(err) });
    }
  });

  app.all("/api/cron/backup", async (req, res) => {
    if (!(await verifyCronOrOwnerAuth(req))) return res.status(401).json({ error: "Unauthorized" });
    const sb = serviceOr500(res);
    if (!sb) return;
    try {
      res.json({ ok: true, ...(await runBackup(sb)) });
    } catch (err) {
      res.status(500).json({ error: errorMessage(err) });
    }
  });
}

