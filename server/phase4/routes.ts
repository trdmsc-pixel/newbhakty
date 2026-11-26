import type { Express, Request, Response } from "express";
import { runScopeCheck } from "../phase9/aiMedia.js";
import { z } from "zod";
import { computeProjectForecast } from "../../src/studio-os/forecastEngine.js";
import { split as aiSplit } from "../../lib/ai/index.js";
import {
  extractBearerToken,
  getServiceSupabase,
  loadStudioStateFromService,
  sendWebPushToAll,
  verifyOwnerJwt,
} from "../studioOsRoutes.js";
import { baseUrlFromRequest } from "../phase3/gmail.js";
import { createTask, ctxHints, loadStudioCtx } from "../phase3/studioData.js";

const buckets = new Map<string, number[]>();
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return hits.length > max;
}
const ipOf = (req: Request) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

/** Recompute and persist one project's forecast after a client action. */
export async function recomputeProjectForecast(projectId: string) {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const state = await loadStudioStateFromService(sb);
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return null;
  const cl = state.clients.find((c) => c.id === p.client_id);
  const computed = computeProjectForecast(p, state.gates, cl, state.settings, state.holidays, new Date(), state.projects);
  if (computed.forecast_date !== p.forecast_date || computed.health !== p.health) {
    await sb.from("studio_projects").update({ forecast_date: computed.forecast_date, health: computed.health }).eq("id", p.id);
  }
  return computed;
}

/** Resolve the signed-in portal contact from a client JWT (never trusts the body). */
async function portalContactFromJwt(token: string) {
  const sb = getServiceSupabase();
  if (!sb || !token) return null;
  const { data } = await sb.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;
  const email = (user.email || "").toLowerCase();
  const { data: contacts } = await sb
    .from("studio_client_contacts")
    .select("id, client_id, name, email, auth_user_id")
    .eq("is_portal_user", true)
    .is("archived_at", null);
  const contact =
    (contacts || []).find((c: any) => c.auth_user_id === user.id) ||
    (contacts || []).find((c: any) => email && (c.email || "").toLowerCase() === email);
  return contact ? { ...contact, userId: user.id } : null;
}

export function registerPhase4Routes(app: Express) {
  // ---- Magic link (only for portal contacts; response never reveals membership) ----
  app.post("/api/portal/request-link", async (req: Request, res: Response) => {
    const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Please enter a valid email." });
    const email = parsed.data.email;
    if (limited(`portal-ip:${ipOf(req)}`, 8, 15 * 60_000) || limited(`portal-email:${email}`, 3, 15 * 60_000)) {
      return res.status(429).json({ error: "Too many requests — please wait a few minutes." });
    }
    const generic = { ok: true, message: "If this email has portal access, a sign-in link is on its way." };
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "Portal is not configured yet." });
    try {
      const { data: contact } = await sb
        .from("studio_client_contacts")
        .select("id")
        .eq("is_portal_user", true)
        .is("archived_at", null)
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (contact) {
        await sb.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${baseUrlFromRequest(req)}/portal`, shouldCreateUser: true },
        });
      }
    } catch (err: any) {
      console.warn(`[portal] magic link failed: ${err?.message}`);
    }
    return res.json(generic);
  });

  // ---- Post-action hook from the portal (forecast recompute, AI split, push) ----
  app.post("/api/portal/after-action", async (req: Request, res: Response) => {
    const contact = await portalContactFromJwt(extractBearerToken(req));
    if (!contact) return res.status(401).json({ error: "Sign in required." });
    const body = z
      .object({
        project_id: z.string().uuid(),
        gate_id: z.string().uuid(),
        action: z.enum(["approved", "changes"]),
        task_ids: z.array(z.string().uuid()).max(20).optional(),
      })
      .safeParse(req.body || {});
    if (!body.success) return res.status(400).json({ error: "Invalid request." });
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "Not configured." });

    // Ownership check against the DB, not the request.
    const { data: project } = await sb
      .from("studio_projects")
      .select("id, code, title, client_id, is_confidential")
      .eq("id", body.data.project_id)
      .maybeSingle();
    const { data: gate } = await sb
      .from("studio_gates")
      .select("id, name, project_id, client_comment, revision_round")
      .eq("id", body.data.gate_id)
      .maybeSingle();
    if (!project || !gate || project.client_id !== contact.client_id || gate.project_id !== project.id) {
      return res.status(404).json({ error: "Not found." });
    }

    let forecast: string | null = null;
    try {
      const computed = await recomputeProjectForecast(project.id);
      forecast = computed?.forecast_date || null;
    } catch {
      /* forecast is best-effort */
    }

    // AI-split a single multi-sentence change request into separate tasks.
    let aiTasks = 0;
    const comment = String(gate.client_comment || "");
    const ids = body.data.task_ids || [];
    if (body.data.action === "changes" && ids.length === 1 && comment.split(/[.!?;](\s|$)/).filter((s) => s.trim().length > 6).length >= 2) {
      try {
        const ctx = await loadStudioCtx(sb);
        const result = await aiSplit(comment, ctxHints(ctx), { preferred: ctx.aiProvider });
        const points = result.items.filter((i) => i.kind === "task" || i.kind === "promise").slice(0, 10);
        if (points.length >= 2) {
          for (const pt of points) {
            await createTask(sb, ctx, {
              projectId: project.id,
              gateId: gate.id,
              title: `${gate.name} R${gate.revision_round}: ${pt.title}`,
              description: `Client change request (AI-split)\n\n${comment}`,
              priority: "high",
              source: "portal",
              sourceRef: `portal:gate:${gate.id}:r${gate.revision_round}`,
              promisedToContactId: contact.id,
              promisedToName: contact.name,
              channel: "portal",
            });
            aiTasks++;
          }
          await sb.from("studio_tasks").update({ archived_at: new Date().toISOString() }).eq("id", ids[0]).eq("project_id", project.id);
        }
      } catch {
        /* keep the single deterministic task */
      }
    }

    // Scope-creep check on change requests (AI, fast tier) — notifies the owner if it looks like extra work.
    let scope: any = null;
    if (body.data.action === "changes") {
      scope = await runScopeCheck(sb, project.id, gate.id).catch(() => null);
    }

    // Quiet push to the studio (Phase 2 trigger: client approvals / changes).
    const label = project.is_confidential ? "Confidential project" : `${project.code} ${project.title}`;
    await sendWebPushToAll(sb, {
      title: body.data.action === "approved" ? `Approved: ${gate.name}` : `${scope && (scope.verdict !== "in_scope" || scope.over_rounds) ? "⚠️ Scope? " : ""}Changes requested: ${gate.name}`,
      body: `${label} — via client portal`,
      url: "/studio-os",
      tag: `portal-${gate.id}`,
    }).catch(() => null);

    return res.json({ ok: true, forecast_date: forecast, ai_tasks: aiTasks });
  });

  // ---- Studio OS: invite a contact to the portal ----
  app.post("/api/studio-os/portal/invite", async (req: Request, res: Response) => {
    const owner = await verifyOwnerJwt(extractBearerToken(req));
    if (!owner.ok) return res.status(401).json({ error: "Owner sign-in required." });
    const parsed = z.object({ contact_id: z.string().uuid(), email: z.string().email().optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "contact_id required" });
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." });

    const { data: contact } = await sb.from("studio_client_contacts").select("id, email, name").eq("id", parsed.data.contact_id).maybeSingle();
    if (!contact) return res.status(404).json({ error: "Contact not found." });
    const email = (parsed.data.email || contact.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Add an email for this contact first." });

    await sb.from("studio_client_contacts").update({ is_portal_user: true, email }).eq("id", contact.id);
    const redirectTo = `${baseUrlFromRequest(req)}/portal`;
    const invite = await sb.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invite.error) {
      // Existing auth user → send a normal magic link instead.
      const otp = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
      if (otp.error) return res.status(500).json({ error: otp.error.message });
    } else if (invite.data?.user?.id) {
      await sb.from("studio_client_contacts").update({ auth_user_id: invite.data.user.id }).eq("id", contact.id);
    }
    await sb.from("studio_activity_log").insert({
      actor: "member",
      actor_name: "Shyam",
      entity_type: "client",
      entity_id: contact.id,
      action: `invited ${contact.name} to the client portal`,
    });
    return res.json({ ok: true, email });
  });

  app.post("/api/studio-os/portal/revoke", async (req: Request, res: Response) => {
    const owner = await verifyOwnerJwt(extractBearerToken(req));
    if (!owner.ok) return res.status(401).json({ error: "Owner sign-in required." });
    const parsed = z.object({ contact_id: z.string().uuid() }).safeParse(req.body || {});
    const sb = getServiceSupabase();
    if (!parsed.success || !sb) return res.status(400).json({ error: "contact_id required" });
    await sb.from("studio_client_contacts").update({ is_portal_user: false }).eq("id", parsed.data.contact_id);
    return res.json({ ok: true });
  });

  // ---- Public showcase (zero private client data) ----
  app.get("/api/public/works", async (_req: Request, res: Response) => {
    const sb = getServiceSupabase();
    if (!sb) return res.json({ works: [] });
    const { data, error } = await sb
      .from("studio_projects")
      .select("id, title, type, runtime_seconds, aspect_ratios, cover_image_url, emoji, updated_at")
      .eq("is_public_showcase", true)
      .eq("is_confidential", false)
      .in("status", ["delivered", "paid"])
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) return res.status(500).json({ error: "Unavailable" });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res.json({
      works: (data || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        type: w.type,
        runtime_seconds: w.runtime_seconds,
        aspect_ratios: w.aspect_ratios,
        cover_image_url: w.cover_image_url,
        emoji: w.emoji,
        year: w.updated_at ? new Date(w.updated_at).getFullYear() : null,
      })),
    });
  });
}
