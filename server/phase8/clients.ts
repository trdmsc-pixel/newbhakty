/**
 * Client management + portal accounts.
 * - Owner-only CRUD for clients and contacts (service role; RLS stays owner-only).
 * - Portal logins: each portal contact gets a random Client ID (username) and a
 *   Supabase auth user with app_metadata.role = "portal". Clients without an
 *   email get a non-deliverable placeholder auth email; they sign in with
 *   Client ID + password through /api/portal/login.
 * - Portal accounts can never be studio staff: owner/team emails are refused.
 */
import type { Express, Request, Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { z } from "zod";
import { extractBearerToken, getEnv, getServiceSupabase, verifyOwnerJwt } from "../studioOsRoutes.js";

const OWNER_EMAILS = new Set(["shyam@thechantingstudio.in", "studio@thechantingstudio.in", "accounts@thechantingstudio.in"]);
const PLACEHOLDER_DOMAIN = "clients.thechantingstudio.in";
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const COLORS = ["#5B3FE4", "#2563EB", "#1F7A52", "#B45309", "#BE185D", "#0E7490", "#7C3AED", "#9A3412"];

const pick = (n: number, alphabet = ID_ALPHABET) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
const newLoginId = () => `TCS-${pick(6)}`;
const newTempPassword = () => `${pick(4)}-${pick(4)}-${pick(4)}`;
const placeholderEmail = (loginId: string) => `${loginId.toLowerCase()}@${PLACEHOLDER_DOMAIN}`;
const isPlaceholder = (email?: string | null) => Boolean(email && email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`));

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

async function isStaffEmail(sb: SupabaseClient, email: string) {
  if (OWNER_EMAILS.has(email.toLowerCase())) return true;
  const { data } = await sb.from("studio_members").select("id").ilike("email", email).is("archived_at", null).limit(1);
  return Boolean(data?.length);
}

async function isStaffUser(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("studio_members").select("id").eq("user_id", userId).limit(1);
  return Boolean(data?.length);
}

async function uniqueLoginId(sb: SupabaseClient, wanted?: string): Promise<string> {
  if (wanted) {
    const id = wanted.trim().toUpperCase();
    const { data } = await sb.from("studio_client_contacts").select("id").ilike("portal_login_id", id).limit(1);
    if (data?.length) throw new Error(`Client ID ${id} is already taken.`);
    return id;
  }
  for (let i = 0; i < 8; i++) {
    const id = newLoginId();
    const { data } = await sb.from("studio_client_contacts").select("id").ilike("portal_login_id", id).limit(1);
    if (!data?.length) return id;
  }
  throw new Error("Could not generate a Client ID — try again.");
}

const PasswordInput = z.string().min(8, "Password must be at least 8 characters.").max(72);

/**
 * Create or reset the portal login for a contact. Returns the Client ID and,
 * when generated, the temporary password (shown to the owner once).
 */
async function provisionLogin(
  sb: SupabaseClient,
  contactId: string,
  opts: { loginId?: string; password?: string; requireChange?: boolean }
): Promise<{ login_id: string; password: string | null; email_login: string | null }> {
  const { data: contact } = await sb
    .from("studio_client_contacts")
    .select("id, client_id, name, email, auth_user_id, portal_login_id")
    .eq("id", contactId)
    .is("archived_at", null)
    .maybeSingle();
  if (!contact) throw new Error("Contact not found.");

  const realEmail = contact.email ? String(contact.email).trim().toLowerCase() : null;
  if (realEmail && (await isStaffEmail(sb, realEmail))) {
    throw new Error("That email belongs to the studio team — use a separate email for a client test account.");
  }

  const loginId =
    opts.loginId && opts.loginId.toUpperCase() !== contact.portal_login_id?.toUpperCase()
      ? await uniqueLoginId(sb, opts.loginId)
      : contact.portal_login_id || (await uniqueLoginId(sb));
  const generated = !opts.password;
  const password = opts.password || newTempPassword();
  const authEmail = realEmail || placeholderEmail(loginId);
  const meta = { app_metadata: { role: "portal", contact_id: contact.id, client_id: contact.client_id }, user_metadata: { name: contact.name, portal_login_id: loginId } };

  // Find the auth user: linked one, else an existing account with this email, else create.
  let userId: string | null = contact.auth_user_id || null;
  if (!userId) {
    const { data: existing } = await sb.rpc("studio_auth_user_id_by_email", { p_email: authEmail });
    userId = (existing as string | null) || null;
  }
  if (userId && (await isStaffUser(sb, userId))) {
    throw new Error("This login is linked to a studio team account — use a separate email for the client.");
  }

  if (userId) {
    const { data: current } = await sb.auth.admin.getUserById(userId);
    const curEmail = current?.user?.email?.toLowerCase();
    const patch: Record<string, any> = { password, email_confirm: true, ...meta };
    // Keep the auth email in step with the contact (placeholder → real email, or new Client ID).
    if (curEmail !== authEmail && (realEmail || isPlaceholder(curEmail))) patch.email = authEmail;
    const upd = await sb.auth.admin.updateUserById(userId, patch);
    if (upd.error) throw new Error(upd.error.message);
  } else {
    const created = await sb.auth.admin.createUser({ email: authEmail, password, email_confirm: true, ...meta });
    if (created.error || !created.data.user) throw new Error(created.error?.message || "Could not create the login.");
    userId = created.data.user.id;
  }

  const { error } = await sb
    .from("studio_client_contacts")
    .update({ auth_user_id: userId, portal_login_id: loginId, is_portal_user: true, must_set_password: opts.requireChange ?? generated, updated_at: new Date().toISOString() })
    .eq("id", contact.id);
  if (error) throw new Error(error.message);

  await sb.from("studio_activity_log").insert({
    actor: "member",
    actor_name: "Shyam",
    entity_type: "client",
    entity_id: contact.id,
    action: `set up portal login ${loginId} for ${contact.name}`,
  });
  return { login_id: loginId, password: generated ? password : null, email_login: realEmail };
}

const ClientFields = z.object({
  name: z.string().trim().min(1).max(160),
  organisation: z.string().trim().max(160).optional(),
  timezone: z.string().trim().max(60).optional(),
  currency: z.enum(["INR", "USD", "EUR"]).optional(),
  avg_approval_latency_days: z.number().min(0).max(60).optional(),
  is_confidential: z.boolean().optional(),
  notes: z.string().max(4000).optional(),
  email_domains: z.array(z.string().trim().toLowerCase().max(120)).max(10).optional(),
});
const ContactFields = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.union([z.string().trim().toLowerCase().email().max(200), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  role: z.string().trim().max(80).optional(),
});
const PortalFields = z.object({
  enabled: z.boolean(),
  login_id: z.string().trim().regex(/^[A-Za-z0-9-]{4,24}$/, "Client ID: 4–24 letters, digits or dashes.").optional(),
  password: PasswordInput.optional(),
  require_change: z.boolean().optional(),
});

const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === "" ? null : v]));
const domainOf = (email?: string | null) => {
  const d = email?.split("@")[1]?.toLowerCase();
  return d && !/^(gmail|yahoo|outlook|hotmail|icloud|proton|rediffmail|live)\./.test(d) ? d : null;
};

export function registerClientRoutes(app: Express) {
  // ---- Create client (+ primary contact + optional portal login) ----
  app.post("/api/studio-os/clients", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = z.object({ client: ClientFields, contact: ContactFields.optional(), portal: PortalFields.optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid client." });
    const { client, contact, portal } = parsed.data;
    if (portal?.enabled && !contact) return res.status(400).json({ error: "Add a contact person to create a portal login." });

    const { data: owners } = await sb.from("studio_members").select("user_id").eq("role", "owner").limit(1);
    const domains = client.email_domains?.length ? client.email_domains : [domainOf(contact?.email)].filter(Boolean);
    const { data: row, error } = await sb
      .from("studio_clients")
      .insert({
        name: client.name,
        organisation: client.organisation || client.name,
        timezone: client.timezone || "Asia/Kolkata",
        currency: client.currency || "INR",
        avg_approval_latency_days: client.avg_approval_latency_days ?? 2,
        is_confidential: client.is_confidential ?? false,
        notes: client.notes || null,
        email_domains: domains,
        color: COLORS[crypto.randomInt(COLORS.length)],
        created_by: owners?.[0]?.user_id || null,
      })
      .select("id")
      .single();
    if (error || !row) return res.status(500).json({ error: error?.message || "Could not create client." });

    let contactId: string | null = null;
    let login: Awaited<ReturnType<typeof provisionLogin>> | null = null;
    let warning: string | null = null;
    if (contact) {
      const { data: ct, error: cErr } = await sb.from("studio_client_contacts").insert({ client_id: row.id, ...clean(contact), is_portal_user: false }).select("id").single();
      if (cErr || !ct) return res.status(500).json({ error: cErr?.message || "Client saved, but the contact failed." , client_id: row.id });
      contactId = ct.id;
      if (portal?.enabled) {
        try {
          login = await provisionLogin(sb, ct.id, { loginId: portal.login_id, password: portal.password, requireChange: portal.require_change });
        } catch (err: any) {
          warning = `Client saved, but the portal login failed: ${err?.message}`;
        }
      }
    }
    await sb.from("studio_activity_log").insert({ actor: "member", actor_name: "Shyam", entity_type: "client", entity_id: row.id, action: `added client ${client.name}` });
    return res.json({ ok: true, client_id: row.id, contact_id: contactId, login, warning });
  });

  // ---- Update client ----
  app.patch("/api/studio-os/clients/:id", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = ClientFields.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid client." });
    const { error } = await sb.from("studio_clients").update({ ...clean(parsed.data), updated_at: new Date().toISOString() }).eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  });

  // ---- Archive client (also disables its portal logins) ----
  app.delete("/api/studio-os/clients/:id", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const { count } = await sb.from("studio_projects").select("id", { count: "exact", head: true }).eq("client_id", req.params.id).is("archived_at", null);
    if ((count || 0) > 0) return res.status(409).json({ error: "This client still has projects — move or archive them first." });
    const now = new Date().toISOString();
    await sb.from("studio_client_contacts").update({ is_portal_user: false, archived_at: now }).eq("client_id", req.params.id);
    await sb.from("studio_clients").update({ archived_at: now }).eq("id", req.params.id);
    return res.json({ ok: true });
  });

  // ---- Permanently delete a client and everything that belongs to them ----
  app.delete("/api/studio-os/clients/:id/purge", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const id = String(req.params.id);
    const { data: client } = await sb.from("studio_clients").select("id, name").eq("id", id).maybeSingle();
    if (!client) return res.status(404).json({ error: "Client not found." });
    if (/^internal/i.test(client.name)) return res.status(400).json({ error: "The Internal studio client can't be deleted." });
    const confirmName = String((req.body && (req.body as any).confirm_name) || "").trim().toLowerCase();
    if (confirmName !== client.name.trim().toLowerCase()) return res.status(400).json({ error: "Type the client's name exactly to confirm." });
    try {
      const { data: projects } = await sb.from("studio_projects").select("id").eq("client_id", id);
      const pids = (projects || []).map((p: any) => p.id);
      const { data: contacts } = await sb.from("studio_client_contacts").select("id, auth_user_id").eq("client_id", id);
      const step = async (q: PromiseLike<{ error: any }>) => {
        const { error } = await q;
        if (error) throw new Error(error.message);
      };
      if (pids.length) {
        await step(sb.from("studio_projects").update({ current_gate_id: null }).in("id", pids));
        // Time entries hang off tasks, not projects.
        const { data: tks } = await sb.from("studio_tasks").select("id").in("project_id", pids);
        const tids = (tks || []).map((t: any) => t.id);
        for (let i = 0; i < tids.length; i += 200) await step(sb.from("studio_time_entries").delete().in("task_id", tids.slice(i, i + 200)));
        for (const t of ["studio_generation_blocks", "studio_project_members", "studio_deliverables", "studio_payments", "studio_expenses", "studio_tasks"]) {
          await step(sb.from(t).delete().in("project_id", pids));
        }
        await step(sb.from("studio_email_threads").update({ project_id: null }).in("project_id", pids));
        await step(sb.from("studio_inbox_items").delete().in("matched_project_id", pids));
        await step(sb.from("studio_gates").delete().in("project_id", pids));
      }
      await step(sb.from("studio_portal_messages").delete().eq("client_id", id));
      await step(sb.from("studio_email_threads").update({ client_id: null }).eq("client_id", id));
      await step(sb.from("studio_inbox_items").delete().eq("matched_client_id", id));
      if (pids.length) await step(sb.from("studio_projects").delete().in("id", pids));
      await step(sb.from("studio_client_contacts").delete().eq("client_id", id));
      await step(sb.from("studio_clients").delete().eq("id", id));
      // Remove the client's portal logins (never a studio team account).
      for (const c of contacts || []) {
        if (c.auth_user_id && !(await isStaffUser(sb, c.auth_user_id))) await sb.auth.admin.deleteUser(c.auth_user_id).catch(() => null);
      }
      await sb.from("studio_activity_log").insert({ actor: "member", actor_name: "Shyam", entity_type: "client", entity_id: id, action: `deleted client ${client.name} (${pids.length} project${pids.length === 1 ? "" : "s"})` });
      return res.json({ ok: true, projects: pids.length, contacts: (contacts || []).length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Could not delete the client." });
    }
  });

  // ---- Contacts ----
  app.post("/api/studio-os/clients/:id/contacts", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = z.object({ contact: ContactFields, portal: PortalFields.optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid contact." });
    const { data: client } = await sb.from("studio_clients").select("id").eq("id", req.params.id).is("archived_at", null).maybeSingle();
    if (!client) return res.status(404).json({ error: "Client not found." });
    const { data: ct, error } = await sb.from("studio_client_contacts").insert({ client_id: client.id, ...clean(parsed.data.contact), is_portal_user: false }).select("id").single();
    if (error || !ct) return res.status(500).json({ error: error?.message || "Could not add contact." });
    let login = null;
    let warning: string | null = null;
    if (parsed.data.portal?.enabled) {
      try {
        login = await provisionLogin(sb, ct.id, { loginId: parsed.data.portal.login_id, password: parsed.data.portal.password, requireChange: parsed.data.portal.require_change });
      } catch (err: any) {
        warning = `Contact saved, but the portal login failed: ${err?.message}`;
      }
    }
    return res.json({ ok: true, contact_id: ct.id, login, warning });
  });

  app.patch("/api/studio-os/contacts/:id", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = ContactFields.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid contact." });
    const { data: before } = await sb.from("studio_client_contacts").select("id, email, auth_user_id, portal_login_id").eq("id", req.params.id).maybeSingle();
    if (!before) return res.status(404).json({ error: "Contact not found." });
    const newEmail = parsed.data.email === undefined ? undefined : parsed.data.email || null;
    if (newEmail && (await isStaffEmail(sb, newEmail)) && before.auth_user_id) {
      return res.status(400).json({ error: "That email belongs to the studio team — use a separate email for the client." });
    }
    const { error } = await sb.from("studio_client_contacts").update({ ...clean(parsed.data), updated_at: new Date().toISOString() }).eq("id", before.id);
    if (error) return res.status(500).json({ error: error.message });
    // Keep the login's email in step so the client can also use email sign-in.
    if (newEmail !== undefined && before.auth_user_id && newEmail !== before.email) {
      const target = newEmail || (before.portal_login_id ? placeholderEmail(before.portal_login_id) : null);
      if (target) {
        const upd = await sb.auth.admin.updateUserById(before.auth_user_id, { email: target, email_confirm: true });
        if (upd.error) return res.json({ ok: true, warning: `Saved, but the login email couldn't change: ${upd.error.message}` });
      }
    }
    return res.json({ ok: true });
  });

  app.delete("/api/studio-os/contacts/:id", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    await sb.from("studio_client_contacts").update({ is_portal_user: false, archived_at: new Date().toISOString() }).eq("id", req.params.id);
    return res.json({ ok: true });
  });

  // ---- Portal login: create / reset password / change Client ID ----
  app.post("/api/studio-os/portal/account", async (req, res) => {
    const sb = await owner(req, res);
    if (!sb) return;
    const parsed = z.object({ contact_id: z.string().uuid(), login_id: PortalFields.shape.login_id, password: PasswordInput.optional(), require_change: z.boolean().optional() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request." });
    try {
      const login = await provisionLogin(sb, parsed.data.contact_id, { loginId: parsed.data.login_id, password: parsed.data.password, requireChange: parsed.data.require_change });
      return res.json({ ok: true, login });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Could not set up the login." });
    }
  });

  // ---- Public: portal sign-in with Client ID (or email) + password ----
  app.post("/api/portal/login", async (req, res) => {
    const parsed = z.object({ login: z.string().trim().min(3).max(200), password: z.string().min(1).max(72) }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "Enter your Client ID and password." });
    const login = parsed.data.login;
    if (limited(`plogin-ip:${ipOf(req)}`, 20, 15 * 60_000) || limited(`plogin:${login.toLowerCase()}`, 8, 15 * 60_000)) {
      return res.status(429).json({ error: "Too many attempts — please wait 15 minutes." });
    }
    const sb = getServiceSupabase();
    const url = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
    const anon = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!sb || !url || !anon) return res.status(503).json({ error: "Portal is not configured yet." });
    const denied = () => res.status(401).json({ error: "That Client ID or password isn't right." });

    let q = sb.from("studio_client_contacts").select("id, auth_user_id").eq("is_portal_user", true).is("archived_at", null).limit(1);
    q = login.includes("@") ? q.ilike("email", login) : q.ilike("portal_login_id", login);
    const { data: rows } = await q;
    const contact = rows?.[0];
    if (!contact?.auth_user_id) return denied();
    const { data: user } = await sb.auth.admin.getUserById(contact.auth_user_id);
    const email = user?.user?.email;
    if (!email) return denied();

    // Fresh, stateless client so the session never leaks into shared server state.
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error || !data.session) return denied();
    return res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  });
}
