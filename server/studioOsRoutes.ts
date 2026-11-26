import type { Express, Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as webpushNamespace from "web-push";
import { computeProjectForecast, generateBriefSummary } from "../src/studio-os/forecastEngine.js";
import type {
  ClientContact,
  StudioClient,
  StudioGate,
  StudioHoliday,
  StudioProject,
  StudioSettings,
  StudioTask,
} from "../src/studio-os/types.js";

const webpush = ((webpushNamespace as any).default || webpushNamespace) as typeof webpushNamespace;

const OWNER_EMAILS = new Set([
  "shyam@thechantingstudio.in",
  "studio@thechantingstudio.in",
  "accounts@thechantingstudio.in",
]);

export function getEnv(key: string): string {
  const val = process.env[key];
  return typeof val === "string" ? val.trim() : "";
}

function getSupabaseUrl(): string {
  const raw =
    getEnv("SUPABASE_URL") ||
    getEnv("VITE_SUPABASE_URL") ||
    getEnv("NEXT_PUBLIC_SUPABASE_URL");
  return raw.replace(/\/+$/, "");
}

export function getServiceSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAuthVerifySupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || req.headers.Authorization;
  if (typeof header !== "string") return "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function verifyOwnerJwt(token: string): Promise<{ ok: boolean; email?: string }> {
  if (!token) return { ok: false };
  const client = getAuthVerifySupabase();
  if (!client) return { ok: false };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { ok: false };
  const email = (data.user.email || "").toLowerCase();
  if (OWNER_EMAILS.has(email)) {
    return { ok: true, email };
  }

  const serviceSb = getServiceSupabase();
  if (serviceSb) {
    const { data: member } = await serviceSb
      .from("studio_members")
      .select("id")
      .eq("user_id", data.user.id)
      .eq("role", "owner")
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle();
    if (member) return { ok: true, email };
  }

  return { ok: false };
}

export async function verifyCronOrOwnerAuth(req: Request): Promise<boolean> {
  const cronSecret = getEnv("CRON_SECRET");
  const bearer = extractBearerToken(req);
  const querySecret = typeof req.query.secret === "string" ? req.query.secret.trim() : "";

  if (cronSecret && (bearer === cronSecret || querySecret === cronSecret)) {
    return true;
  }

  // pg_cron calls carry a secret generated inside Supabase Vault (never in env vars).
  if (bearer && bearer.length >= 32) {
    const sb = getServiceSupabase();
    if (sb) {
      const { data } = await sb.rpc("studio_os_cron_secret_matches", { p_token: bearer });
      if (data === true) return true;
    }
  }

  if (bearer && bearer !== cronSecret) {
    const ownerCheck = await verifyOwnerJwt(bearer);
    if (ownerCheck.ok) return true;
  }

  return false;
}

function getVapidConfig() {
  const publicKey = getEnv("VAPID_PUBLIC_KEY") || getEnv("VITE_VAPID_PUBLIC_KEY");
  const privateKey = getEnv("VAPID_PRIVATE_KEY");
  const subject = getEnv("VAPID_SUBJECT") || "mailto:studio@thechantingstudio.in";
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { configured: true as const, publicKey };
  }
  return { configured: false as const, publicKey };
}

interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendWebPushToAll(
  sb: SupabaseClient,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; skippedReason?: string }> {
  const vapid = getVapidConfig();
  if (!vapid.configured) {
    return { sent: 0, failed: 0, skippedReason: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not configured" };
  }

  const { data: subs, error } = await sb
    .from("studio_push_subscriptions")
    .select("id, endpoint, keys");

  if (error || !subs || subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (row: any) => {
      if (!row?.endpoint || !row?.keys?.p256dh || !row?.keys?.auth) return;
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.keys.p256dh,
              auth: row.keys.auth,
            },
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (err: any) {
        failed += 1;
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          expiredIds.push(row.id);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await sb.from("studio_push_subscriptions").delete().in("id", expiredIds);
  }

  return { sent, failed };
}

function mapSettings(row: any): StudioSettings {
  return {
    id: row?.id || "00000000-0000-4000-8000-000000000001",
    overrun_factor: Number(row?.overrun_factor ?? 1.6),
    default_approval_latency_days: Number(row?.default_approval_latency_days ?? 2),
    work_hours_per_day: Number(row?.work_hours_per_day ?? 7),
    studio_closes_at: String(row?.studio_closes_at || "21:30").slice(0, 5),
    wip_limit: Number(row?.wip_limit ?? 3),
    takes_per_keeper: Number(row?.takes_per_keeper ?? 3),
    block_seconds: Number(row?.block_seconds ?? 20),
    timezone: row?.timezone || "Asia/Kolkata",
    ai_provider: row?.ai_provider === "claude" ? "claude" : "gemini",
    brief_time: String(row?.brief_time || "07:30").slice(0, 5),
    usd_to_inr: Number(row?.usd_to_inr ?? 84.5),
    eur_to_inr: Number(row?.eur_to_inr ?? 91),
    expenses_enabled: Boolean(row?.expenses_enabled),
  };
}

function mapClients(clientRows: any[], contactRows: any[]): StudioClient[] {
  const byClient = new Map<string, ClientContact[]>();
  for (const r of contactRows || []) {
    const arr = byClient.get(r.client_id) || [];
    arr.push({
      id: r.id,
      client_id: r.client_id,
      name: r.name,
      email: r.email || undefined,
      phone: r.phone || undefined,
      whatsapp: r.whatsapp || undefined,
      role: r.role || undefined,
      is_portal_user: Boolean(r.is_portal_user),
    });
    byClient.set(r.client_id, arr);
  }

  return (clientRows || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    organisation: r.organisation,
    email_domains: Array.isArray(r.email_domains) ? r.email_domains : [],
    timezone: r.timezone || "Asia/Kolkata",
    currency: r.currency || "INR",
    avg_approval_latency_days: Number(r.avg_approval_latency_days ?? 2),
    is_confidential: Boolean(r.is_confidential),
    notes: r.notes || undefined,
    color: r.color || "#5B3FE4",
    contacts: byClient.get(r.id) || [],
  }));
}

function mapProjects(rows: any[]): StudioProject[] {
  return (rows || []).map((r: any) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    client_id: r.client_id || "",
    type: r.type || "ad_film",
    status: r.status || "active",
    fee_amount: r.fee_amount !== null && r.fee_amount !== undefined ? Number(r.fee_amount) : undefined,
    currency: r.currency || "INR",
    runtime_seconds:
      r.runtime_seconds !== null && r.runtime_seconds !== undefined
        ? Number(r.runtime_seconds)
        : undefined,
    versions: Number(r.versions ?? 1),
    aspect_ratios: Array.isArray(r.aspect_ratios) ? r.aspect_ratios : ["16:9"],
    hard_deadline: r.hard_deadline ? String(r.hard_deadline).slice(0, 10) : undefined,
    promised_date: r.promised_date ? String(r.promised_date).slice(0, 10) : undefined,
    forecast_date: r.forecast_date ? String(r.forecast_date).slice(0, 10) : undefined,
    health: r.health || "on_track",
    current_gate_id: r.current_gate_id || undefined,
    cover_image_url: r.cover_image_url || undefined,
    emoji: r.emoji || "🎬",
    drive_folder_url: r.drive_folder_url || undefined,
    review_link_url: r.review_link_url || undefined,
    is_confidential: Boolean(r.is_confidential),
    portal_visible: r.portal_visible !== false,
    priority: r.priority || "p2",
    owner_member_id: r.owner_member_id || "",
    pinned: Boolean(r.pinned),
    last_client_touch_at: r.last_client_touch_at || undefined,
    last_studio_touch_at: r.last_studio_touch_at || undefined,
    updated_at: r.updated_at || new Date().toISOString(),
  }));
}

function mapGates(rows: any[]): StudioGate[] {
  return (rows || []).map((r: any) => ({
    id: r.id,
    project_id: r.project_id,
    order_index: Number(r.order_index ?? 0),
    code: r.code,
    name: r.name,
    needs_client_approval: Boolean(r.needs_client_approval),
    estimate_days: Number(r.estimate_days ?? 1),
    actual_days:
      r.actual_days !== null && r.actual_days !== undefined ? Number(r.actual_days) : undefined,
    started_at: r.started_at || undefined,
    sent_for_approval_at: r.sent_for_approval_at || undefined,
    approved_at: r.approved_at || undefined,
    status: r.status || "not_started",
    revision_round: Number(r.revision_round ?? 0),
    revisions_included: Number(r.revisions_included ?? 2),
    client_comment: r.client_comment || undefined,
    portal_visible: r.portal_visible !== false,
    due_date: r.due_date ? String(r.due_date).slice(0, 10) : undefined,
  }));
}

function mapHolidays(rows: any[]): StudioHoliday[] {
  return (rows || []).map((r: any) => ({
    id: r.id,
    holiday_date: String(r.holiday_date || "").slice(0, 10),
    name: r.name,
    region: r.region || "IN",
    is_active: r.is_active !== false,
  }));
}

function mapTasks(rows: any[]): StudioTask[] {
  return (rows || []).map((r: any) => ({
    id: r.id,
    key: r.key,
    project_id: r.project_id || "",
    gate_id: r.gate_id || undefined,
    title: r.title,
    description: r.description || undefined,
    type: r.type || "task",
    status: r.status || "todo",
    priority: r.priority || "normal",
    do_date: r.do_date ? String(r.do_date).slice(0, 10) : undefined,
    due_date: r.due_date ? String(r.due_date) : undefined,
    estimate_hours: Number(r.estimate_hours ?? 1),
    actual_hours: Number(r.actual_hours ?? 0),
    assignee_member_id: r.assignee_member_id || "",
    checklist: Array.isArray(r.checklist) ? r.checklist : [],
    source: r.source || "manual",
    source_ref: r.source_ref || undefined,
    promised_to_name: r.promised_to_name || undefined,
    waiting_on_name: r.waiting_on_name || undefined,
    channel: r.channel || undefined,
    is_in_now: Boolean(r.is_in_now),
    snoozed_until: r.snoozed_until || undefined,
    completed_at: r.completed_at || undefined,
    portal_visible: Boolean(r.portal_visible),
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  }));
}

export async function loadStudioStateFromService(sb: SupabaseClient) {
  const [settingsRes, clientsRes, contactsRes, projectsRes, gatesRes, holidaysRes, tasksRes] =
    await Promise.all([
      sb.from("studio_settings").select("*").limit(1).maybeSingle(),
      sb.from("studio_clients").select("*").is("archived_at", null),
      sb.from("studio_client_contacts").select("*").is("archived_at", null),
      sb.from("studio_projects").select("*").is("archived_at", null),
      sb.from("studio_gates").select("*").is("archived_at", null).order("order_index", { ascending: true }),
      sb.from("studio_holidays").select("*").is("archived_at", null),
      sb.from("studio_tasks").select("*").is("archived_at", null),
    ]);

  const settings = mapSettings(settingsRes.data);
  const clients = mapClients(clientsRes.data || [], contactsRes.data || []);
  const projects = mapProjects(projectsRes.data || []);
  const gates = mapGates(gatesRes.data || []);
  const holidays = mapHolidays(holidaysRes.data || []);
  const tasks = mapTasks(tasksRes.data || []);

  return {
    settings,
    clients,
    projects,
    gates,
    holidays,
    tasks,
    rawGates: gatesRes.data || [],
  };
}

/**
 * Registers Phase 2 Studio OS server endpoints on Express:
 * - GET /api/studio-os/push-public-key
 * - POST /api/studio-os/test-push
 * - ALL /api/cron/forecast
 * - ALL /api/cron/brief
 */
export function registerStudioOSRoutes(app: Express) {
  app.get("/api/studio-os/push-public-key", (_req: Request, res: Response) => {
    const publicKey = getEnv("VAPID_PUBLIC_KEY") || getEnv("VITE_VAPID_PUBLIC_KEY");
    res.json({ publicKey });
  });

  app.post("/api/studio-os/test-push", async (req: Request, res: Response) => {
    try {
      const token = extractBearerToken(req);
      const ownerCheck = await verifyOwnerJwt(token);
      if (!ownerCheck.ok) {
        return res.status(401).json({ error: "Owner authentication required." });
      }

      const sb = getServiceSupabase();
      if (!sb) {
        return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL." });
      }

      const result = await sendWebPushToAll(sb, {
        title: "Studio OS — Quiet Alerts Ready",
        body: "Push alerts fire only for 3h promises, client approvals, and late forecasts.",
        url: "/studio-os?route=settings",
        tag: "studio-os-test",
      });

      if (result.skippedReason) {
        return res.status(400).json({ error: result.skippedReason, sent: 0 });
      }

      await sb.from("studio_notifications").insert({
        kind: "test_push",
        title: "Studio OS — Quiet Alerts Ready",
        body: "Test Web Push sent from Settings.",
        url: "/studio-os?route=settings",
        sent_push: result.sent > 0,
      });

      return res.json({ ok: true, sent: result.sent, failed: result.failed });
    } catch (err: any) {
      console.error("Test Push error:", err);
      return res.status(500).json({ error: err?.message || "Failed to send test push." });
    }
  });

  const handleForecastCron = async (req: Request, res: Response) => {
    try {
      const authorized = await verifyCronOrOwnerAuth(req);
      if (!authorized) {
        return res.status(401).json({ error: "Unauthorized cron invocation." });
      }

      const sb = getServiceSupabase();
      if (!sb) {
        return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL." });
      }

      const now = new Date();
      const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const since18h = new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString();

      const [state, recentNotifsRes, recentPortalInboxRes] = await Promise.all([
        loadStudioStateFromService(sb),
        sb.from("studio_notifications").select("kind, title, body, created_at").gte("created_at", since18h),
        sb
          .from("studio_inbox_items")
          .select("id, matched_project_id, raw_text, created_at")
          .eq("source", "portal")
          .gte("created_at", since24h),
      ]);

      const existingAlertKeys = new Set<string>(
        (recentNotifsRes.data || []).map((n: any) => `${n.kind}::${n.title}::${n.body || ""}`)
      );

      const clientById = new Map<string, StudioClient>(
        state.clients.map((c) => [c.id, c])
      );
      const projectById = new Map<string, StudioProject>(
        state.projects.map((p) => [p.id, p])
      );

      let updatedProjects = 0;
      const pendingAlerts: Array<{
        kind: string;
        title: string;
        body: string;
        url: string;
        tag: string;
      }> = [];

      const safeProjectLabel = (p?: StudioProject) => {
        if (!p) return "Project";
        const cl = clientById.get(p.client_id);
        if (p.is_confidential || cl?.is_confidential) return "Confidential project";
        return `${p.code} ${p.title}`;
      };

      // 1. Recompute forecasts & persist to studio_projects
      for (const p of state.projects) {
        if (!["active", "on_hold"].includes(p.status)) continue;
        const cl = clientById.get(p.client_id);
        const computed = computeProjectForecast(
          p,
          state.gates,
          cl,
          state.settings,
          state.holidays,
          now,
          state.projects
        );

        if (computed.forecast_date !== p.forecast_date || computed.health !== p.health) {
          const { error: upErr } = await sb
            .from("studio_projects")
            .update({
              forecast_date: computed.forecast_date,
              health: computed.health,
            })
            .eq("id", p.id);
          if (!upErr) updatedProjects += 1;
        }

        // Trigger A: project forecast newly turned late
        if (p.health !== "late" && computed.health === "late") {
          const label = safeProjectLabel(p);
          pendingAlerts.push({
            kind: "forecast_late",
            title: "Forecast turned late",
            body: `${label}: projected ${computed.forecast_date}${p.hard_deadline ? ` (deadline ${p.hard_deadline})` : ""}.`,
            url: "/studio-os?route=timeline",
            tag: `late-${p.id}`,
          });
        }
      }

      // Trigger B: promises due within 3 hours
      for (const t of state.tasks) {
        if (t.type !== "promise" || t.status === "done" || !t.due_date) continue;
        const rawDue = t.due_date;
        const dueMs = rawDue.includes("T")
          ? Date.parse(rawDue)
          : Date.parse(`${rawDue.slice(0, 10)}T21:30:00+05:30`);
        if (Number.isNaN(dueMs)) continue;
        const hoursLeft = (dueMs - now.getTime()) / (60 * 60 * 1000);
        if (hoursLeft >= -0.5 && hoursLeft <= 3) {
          const proj = projectById.get(t.project_id);
          const cl = proj ? clientById.get(proj.client_id) : undefined;
          const conf = Boolean(proj?.is_confidential || cl?.is_confidential);
          const bodyText = conf
            ? `Promise due soon on Confidential project`
            : `${t.key} (${t.promised_to_name || "Client"}): ${t.title}`;
          pendingAlerts.push({
            kind: "promise_due_3h",
            title: "Promise due in <= 3h",
            body: bodyText,
            url: "/studio-os?route=today",
            tag: `promise-${t.id}`,
          });
        }
      }

      // Trigger C: recent client portal gate approvals or change requests (revising)
      for (const gRow of state.rawGates) {
        if (!["approved", "revising"].includes(gRow.status)) continue;
        if (!gRow.needs_client_approval && gRow.status !== "revising") continue;
        const stamp = gRow.approved_at || gRow.updated_at;
        if (!stamp || stamp < since24h) continue;
        const proj = projectById.get(gRow.project_id);
        const label = safeProjectLabel(proj);
        const actionWord = gRow.status === "approved" ? "approved" : "requested changes on";
        pendingAlerts.push({
          kind: gRow.status === "approved" ? "portal_approval" : "portal_change_request",
          title:
            gRow.status === "approved"
              ? "Client approved gate"
              : "Client requested gate revisions",
          body: `${label}: ${gRow.code} ${gRow.name} (${actionWord}).`,
          url: "/studio-os?route=projects",
          tag: `gate-${gRow.id}-${gRow.status}`,
        });
      }

      for (const item of recentPortalInboxRes.data || []) {
        const proj = item.matched_project_id
          ? projectById.get(item.matched_project_id)
          : undefined;
        const label = safeProjectLabel(proj);
        pendingAlerts.push({
          kind: "portal_activity",
          title: "Client portal update",
          body: `${label}: new portal submission received.`,
          url: "/studio-os?route=inbox",
          tag: `portal-${item.id}`,
        });
      }

      let notificationsSent = 0;
      for (const alert of pendingAlerts) {
        const dedup = `${alert.kind}::${alert.title}::${alert.body}`;
        if (existingAlertKeys.has(dedup)) continue;
        existingAlertKeys.add(dedup);

        const pushRes = await sendWebPushToAll(sb, {
          title: alert.title,
          body: alert.body,
          url: alert.url,
          tag: alert.tag,
        });

        await sb.from("studio_notifications").insert({
          kind: alert.kind,
          title: alert.title,
          body: alert.body,
          url: alert.url,
          sent_push: pushRes.sent > 0,
        });
        notificationsSent += 1;
      }

      return res.json({
        ok: true,
        checkedProjects: state.projects.length,
        updatedProjects,
        notificationsSent,
        timestamp: now.toISOString(),
      });
    } catch (err: any) {
      console.error("Forecast Cron Error:", err);
      return res.status(500).json({ error: err?.message || "Forecast cron failed." });
    }
  };

  const handleBriefCron = async (req: Request, res: Response) => {
    try {
      const authorized = await verifyCronOrOwnerAuth(req);
      if (!authorized) {
        return res.status(401).json({ error: "Unauthorized cron invocation." });
      }

      const sb = getServiceSupabase();
      if (!sb) {
        return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL." });
      }

      const state = await loadStudioStateFromService(sb);
      const brief = generateBriefSummary({
        projects: state.projects,
        gates: state.gates,
        tasks: state.tasks,
        clients: state.clients,
        settings: state.settings,
        holidays: state.holidays,
        today: new Date(),
      });

      // Fallback: email any client notifications still waiting.
      try {
        const { flushPortalEmails } = await import("./phase9/portalNotify.js");
        await flushPortalEmails(sb, "https://www.thechantingstudio.in");
      } catch {
        /* best-effort */
      }

      // The one AI daily brief (cached in studio_ai_insights; shown on Today).
      let aiText = "";
      try {
        const { runDailyBrief, briefToText } = await import("./phase9/aiMedia.js");
        if (getEnv("GEMINI_API_KEY")) aiText = briefToText((await runDailyBrief(sb)).result);
      } catch (e: any) {
        console.warn("AI brief skipped:", e?.message);
      }

      const resendKey = getEnv("RESEND_API_KEY");
      const resendFrom =
        getEnv("RESEND_FROM") || "Studio OS <onboarding@resend.dev>";
      const briefTo = getEnv("STUDIO_BRIEF_TO") || "studio@thechantingstudio.in";

      let emailSent = false;
      let resendId: string | undefined;
      let emailWarning: string | undefined;

      if (resendKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [briefTo],
            subject: `Studio OS Morning Brief — ${brief.dateLabel}`,
            text: `${aiText ? `${aiText}\n\n———\n\n` : ""}${brief.briefText}\n\nOpen Today: https://www.thechantingstudio.in/studio-os`,
          }),
        });

        const emailData: any = await emailRes.json().catch(() => ({}));
        if (emailRes.ok) {
          emailSent = true;
          resendId = emailData?.id;
        } else {
          emailWarning = emailData?.message || `Resend HTTP ${emailRes.status}`;
        }
      } else {
        emailWarning = "RESEND_API_KEY not configured; returned preview only.";
      }

      return res.json({
        ok: true,
        dateLabel: brief.dateLabel,
        wordCount: brief.wordCount,
        emailSent,
        resendId,
        emailWarning,
        briefText: brief.briefText,
      });
    } catch (err: any) {
      console.error("Morning Brief Cron Error:", err);
      return res.status(500).json({ error: err?.message || "Morning brief cron failed." });
    }
  };

  app.all("/api/cron/forecast", handleForecastCron);
  app.all("/api/cron/brief", handleBriefCron);
}
