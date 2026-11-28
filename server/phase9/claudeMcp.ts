/**
 * Studio OS as a Claude connector (remote MCP server, Streamable HTTP, stateless JSON).
 *
 *   POST /api/mcp/<secret>      — add this URL in claude.ai → Settings → Connectors → Add custom connector
 *
 * The secret is a Studio OS token with scope "claude" (Settings → Automation → Connect Claude);
 * revoke it there to cut access instantly. Claude can then read clients/projects/tasks and
 * create or update them from what you discuss in chat (or what it remembers).
 * Nothing is ever deleted through this connector. Fees are never exposed.
 */
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getServiceSupabase } from "../studioOsRoutes.js";
import { createTask, loadStudioCtx, logActivity, type StudioCtx } from "../phase3/studioData.js";
import { recomputeProjectForecast } from "../phase4/routes.js";
import { STATUSES, TYPES, createClient, createProjectWithGates, findClient } from "./mailScan.js";

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isDate = (s: any) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const TASK_STATUSES = ["backlog", "todo", "in_progress", "waiting_on_client", "in_review", "revising", "done"];
const GATE_STATUSES = ["not_started", "in_work", "waiting_on_client", "approved", "revising", "skipped"];

const hits = new Map<string, number[]>();
function limited(key: string, max: number, ms: number) {
  const now = Date.now();
  const h = (hits.get(key) || []).filter((t) => now - t < ms);
  h.push(now);
  hits.set(key, h);
  return h.length > max;
}

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });
const TOOLS = [
  {
    name: "get_studio_overview",
    description:
      "Read everything currently in Studio OS (The Chanting Studio's production tracker): clients with contacts, projects with status, deadlines and stages, and open task counts. Call this FIRST before creating or updating anything, to avoid duplicates and to use the exact project codes.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "list_tasks",
    description: "List tasks, optionally for one project. Returns task keys (e.g. ABC-3) used by update_task.",
    inputSchema: { type: "object", properties: { project_code: str("Project code, e.g. ABC"), include_done: { type: "boolean", description: "Include completed tasks" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "upsert_client",
    description: "Create a client, or update an existing one (matched by name, contact email or company domain): appends notes and adds any new contacts.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: str("Client / company name"),
        organisation: str("Legal or full organisation name, if different"),
        email_domain: str("Company email domain, e.g. acme.com (leave empty for gmail.com etc.)"),
        notes: str("What matters about this client (relationship, preferences, history)"),
        contacts: {
          type: "array",
          items: { type: "object", properties: { name: str("Full name"), email: str("Email"), phone: str("Phone / WhatsApp"), role: str("Role, e.g. Marketing head") } },
        },
      },
    },
  },
  {
    name: "create_project",
    description: "Create a new production project (with the standard stages for its type). Creates the client too if it doesn't exist. Skips if a project with the same title already exists.",
    inputSchema: {
      type: "object",
      required: ["title", "client_name"],
      properties: {
        title: str("Project title"),
        client_name: str("Client name (existing or new)"),
        type: str("Project type", { enum: TYPES }),
        status: str("lead = enquiry, quoted = proposal sent, active = confirmed/in production, on_hold, delivered", { enum: STATUSES }),
        hard_deadline: str("Hard deadline YYYY-MM-DD"),
        promised_date: str("Date promised to the client YYYY-MM-DD"),
        priority: str("p1 (highest) / p2 / p3", { enum: ["p1", "p2", "p3"] }),
        summary: str("1–3 lines: brief, scope, where it stands (saved as the first task's notes)"),
      },
    },
  },
  {
    name: "update_project",
    description:
      "Update a project: title, status, dates, priority, and/or move a stage (e.g. stage_name 'Script', stage_status 'approved'). With complete_earlier_stages=true every stage before it is marked approved — use this to bring a project's progress up to date.",
    inputSchema: {
      type: "object",
      required: ["project_code"],
      properties: {
        project_code: str("Project code from get_studio_overview"),
        title: str("New title"),
        status: str("Project status", { enum: [...STATUSES, "paid", "lost", "parked"] }),
        hard_deadline: str("YYYY-MM-DD"),
        promised_date: str("YYYY-MM-DD"),
        priority: str("p1/p2/p3", { enum: ["p1", "p2", "p3"] }),
        stage_name: str("Stage name or code, e.g. 'Script', 'Storyboard', 'Final delivery'"),
        stage_status: str("New stage status", { enum: GATE_STATUSES }),
        complete_earlier_stages: { type: "boolean", description: "Mark all stages before stage_name as approved" },
        stage_due_date: str("Planned end date for stage_name, YYYY-MM-DD (shown to the client)"),
      },
    },
  },
  {
    name: "send_note_to_client",
    description:
      "Send a short note to the client in their portal (and by email after a minute), optionally about a specific stage. Use for review notes, updates or replies. It's logged in that stage's history as sent via Claude. Only call this when the user explicitly asks to send/tell the client something; show the user the exact text first.",
    inputSchema: {
      type: "object",
      required: ["project_code", "message"],
      properties: {
        project_code: str("Project code"),
        stage_name: str("Optional stage name, e.g. 'Storyboard'"),
        message: str("The note, written to the client (plain text, ≤ 2000 chars)"),
      },
    },
  },
  {
    name: "get_stage_history",
    description: "Read what was sent to and received from the client on a project (optionally one stage): notes, versions shared, review requests, change requests with status, approvals.",
    inputSchema: { type: "object", required: ["project_code"], properties: { project_code: str("Project code"), stage_name: str("Optional stage name") } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "add_task",
    description: "Add a task to a project (skips exact duplicates of open tasks).",
    inputSchema: {
      type: "object",
      required: ["project_code", "title"],
      properties: {
        project_code: str("Project code"),
        title: str("Imperative, specific task title (≤80 chars)"),
        description: str("Details / context"),
        type: str("Task type", { enum: ["task", "promise", "reply_owed", "follow_up", "admin"] }),
        priority: str("Priority", { enum: ["urgent", "high", "normal", "low"] }),
        due_date: str("YYYY-MM-DD"),
        promised_to: str("Person it was promised to"),
      },
    },
  },
  {
    name: "update_task",
    description: "Update a task by key (e.g. ABC-3): status, priority, due date or title. status 'done' completes it.",
    inputSchema: {
      type: "object",
      required: ["task_key"],
      properties: {
        task_key: str("Task key from list_tasks"),
        status: str("Task status", { enum: TASK_STATUSES }),
        priority: str("Priority", { enum: ["urgent", "high", "normal", "low"] }),
        due_date: str("YYYY-MM-DD"),
        title: str("New title"),
      },
    },
  },
];

async function overview(sb: SupabaseClient, ctx: StudioCtx) {
  const [{ data: projects }, { data: gates }, { data: tasks }, { data: clients }] = await Promise.all([
    sb.from("studio_projects").select("id, code, title, client_id, type, status, health, priority, hard_deadline, promised_date, forecast_date, closed_at").is("archived_at", null),
    sb.from("studio_gates").select("project_id, code, name, status, order_index, due_date").is("archived_at", null).order("order_index"),
    sb.from("studio_tasks").select("project_id, status").is("archived_at", null).neq("status", "done"),
    sb.from("studio_clients").select("id, notes").is("archived_at", null),
  ]);
  const notes = new Map((clients || []).map((c: any) => [c.id, c.notes]));
  return {
    today: new Date().toISOString().slice(0, 10),
    clients: ctx.clients.map((c) => ({ name: c.name, organisation: c.organisation, domains: c.email_domains, notes: notes.get(c.id) || "", contacts: c.contacts.map((x) => ({ name: x.name, email: x.email })) })),
    projects: (projects || []).map((p: any) => ({
      code: p.code,
      title: p.title,
      client: ctx.clients.find((c) => c.id === p.client_id)?.name || "",
      type: p.type,
      status: p.closed_at ? "closed" : p.status,
      health: p.health,
      priority: p.priority,
      hard_deadline: p.hard_deadline,
      promised_date: p.promised_date,
      forecast_date: p.forecast_date,
      stages: (gates || []).filter((g: any) => g.project_id === p.id).map((g: any) => `${g.name} [${g.status}]${g.due_date ? ` due ${g.due_date}` : ""}`),
      open_tasks: (tasks || []).filter((t: any) => t.project_id === p.id).length,
    })),
  };
}

async function callTool(sb: SupabaseClient, name: string, a: any): Promise<unknown> {
  const ctx = await loadStudioCtx(sb);
  const byCode = (code: string) => ctx.projects.find((p) => p.code.toUpperCase() === String(code || "").toUpperCase());
  const log = (entityType: string, entityId: string, action: string) => logActivity(sb, { actor: "ai", actorName: "Claude", entityType, entityId, action });

  switch (name) {
    case "get_studio_overview":
      return overview(sb, ctx);

    case "list_tasks": {
      let q = sb.from("studio_tasks").select("key, title, status, priority, type, due_date, project_id, promised_to_name, source").is("archived_at", null).order("created_at", { ascending: false }).limit(200);
      if (a.project_code) {
        const p = byCode(a.project_code);
        if (!p) throw new Error(`No project ${a.project_code}`);
        q = q.eq("project_id", p.id);
      }
      if (!a.include_done) q = q.neq("status", "done");
      const { data } = await q;
      return (data || []).map((t: any) => ({ key: t.key, project: ctx.projects.find((p) => p.id === t.project_id)?.code, title: t.title, status: t.status, priority: t.priority, type: t.type, due: t.due_date ? String(t.due_date).slice(0, 10) : null, promised_to: t.promised_to_name }));
    }

    case "upsert_client": {
      if (!a.name) throw new Error("name is required");
      const emails = (a.contacts || []).map((c: any) => String(c.email || "").toLowerCase()).filter(Boolean);
      const existing = findClient(ctx, a.name, emails);
      if (!existing) {
        const row = await createClient(sb, ctx, { name: a.name, organisation: a.organisation, email_domain: a.email_domain, notes: a.notes, contacts: a.contacts }, "Claude");
        return { created: true, client: row.name, contacts: row.contacts.map((c: any) => c.name) };
      }
      const added: string[] = [];
      for (const c of a.contacts || []) {
        const email = String(c.email || "").toLowerCase().trim();
        if (existing.contacts.some((x) => (email && (x.email || "").toLowerCase() === email) || (c.name && norm(x.name) === norm(c.name)))) continue;
        if (!c.name && !email) continue;
        const { data } = await sb.from("studio_client_contacts").insert({ client_id: existing.id, name: c.name || email.split("@")[0], email: email || null, phone: c.phone || null, role: c.role || null }).select("id, client_id, name, email").single();
        if (data) {
          existing.contacts.push(data as any);
          added.push(data.name);
        }
      }
      const patch: Record<string, any> = {};
      if (a.notes) {
        const { data: cur } = await sb.from("studio_clients").select("notes").eq("id", existing.id).maybeSingle();
        if (!String(cur?.notes || "").includes(a.notes)) patch.notes = [cur?.notes, `[${new Date().toISOString().slice(0, 10)} via Claude] ${a.notes}`].filter(Boolean).join("\n").slice(-4000);
      }
      if (a.email_domain && !existing.email_domains.includes(String(a.email_domain).toLowerCase())) patch.email_domains = [...existing.email_domains, String(a.email_domain).toLowerCase()];
      if (Object.keys(patch).length) await sb.from("studio_clients").update(patch).eq("id", existing.id);
      await log("client", existing.id, `Updated client ${existing.name}${added.length ? ` (+${added.join(", ")})` : ""}`);
      return { created: false, client: existing.name, contacts_added: added, notes_updated: Boolean(patch.notes) };
    }

    case "create_project": {
      if (!a.title || !a.client_name) throw new Error("title and client_name are required");
      const t = norm(a.title);
      const dup = ctx.projects.find((p) => norm(p.title) === t);
      if (dup) return { created: false, reason: "already exists", project_code: dup.code };
      let client = findClient(ctx, a.client_name);
      let clientCreated = false;
      if (!client) {
        client = await createClient(sb, ctx, { name: a.client_name }, "Claude");
        clientCreated = true;
      }
      const made = await createProjectWithGates(sb, ctx, { title: a.title, client, type: a.type, status: a.status, hard_deadline: a.hard_deadline, promised_date: a.promised_date, priority: a.priority });
      if (a.summary) {
        await createTask(sb, ctx, { projectId: made.id, title: made.status === "lead" ? "Reply to the enquiry" : "Review project details", description: `${a.summary}\n\nAdded by Claude.`, type: made.status === "lead" ? "reply_owed" : "task", priority: "normal", source: "ai" }).catch(() => null);
      }
      await log("project", made.id, `Created ${made.code} — ${a.title}`);
      return { created: true, project_code: made.code, client: client.name, client_created: clientCreated, stages: made.gates.map((g) => g.name) };
    }

    case "update_project": {
      const p = byCode(a.project_code);
      if (!p) throw new Error(`No project ${a.project_code} — call get_studio_overview for codes.`);
      const patch: Record<string, any> = {};
      if (a.title) patch.title = String(a.title).slice(0, 120);
      if (a.status && [...STATUSES, "paid", "lost", "parked"].includes(a.status)) patch.status = a.status;
      if (isDate(a.hard_deadline)) patch.hard_deadline = a.hard_deadline;
      if (isDate(a.promised_date)) patch.promised_date = a.promised_date;
      if (["p1", "p2", "p3"].includes(a.priority)) patch.priority = a.priority;
      const changes: string[] = Object.keys(patch);
      if (a.stage_name) {
        const { data: gates } = await sb.from("studio_gates").select("id, code, name, status, order_index, started_at, approved_at").eq("project_id", p.id).is("archived_at", null).order("order_index");
        const n = norm(a.stage_name);
        const gate = (gates || []).find((g: any) => norm(g.name) === n || norm(g.code) === n) || (gates || []).find((g: any) => norm(g.name).includes(n) || n.includes(norm(g.name)));
        if (!gate) throw new Error(`No stage “${a.stage_name}” in ${p.code}. Stages: ${(gates || []).map((g: any) => g.name).join(", ")}`);
        const now = new Date().toISOString();
        if (a.complete_earlier_stages) {
          for (const g of (gates || []).filter((x: any) => x.order_index < gate.order_index && !["approved", "skipped"].includes(x.status))) {
            await sb.from("studio_gates").update({ status: "approved", approved_at: g.approved_at || now, started_at: g.started_at || now }).eq("id", g.id);
          }
          changes.push("earlier stages approved");
        }
        if (isDate(a.stage_due_date)) {
          await sb.from("studio_gates").update({ due_date: a.stage_due_date }).eq("id", gate.id);
          changes.push(`${gate.name} due ${a.stage_due_date}`);
        }
        if (a.stage_status && GATE_STATUSES.includes(a.stage_status)) {
          const gp: Record<string, any> = { status: a.stage_status };
          if (a.stage_status !== "not_started" && !gate.started_at) gp.started_at = now;
          if (a.stage_status === "approved") gp.approved_at = now;
          if (a.stage_status === "waiting_on_client") gp.sent_for_approval_at = now;
          await sb.from("studio_gates").update(gp).eq("id", gate.id);
          changes.push(`${gate.name} → ${a.stage_status}`);
          // Current stage = first stage that isn't finished.
          const { data: after } = await sb.from("studio_gates").select("id, status").eq("project_id", p.id).is("archived_at", null).order("order_index");
          const current = (after || []).find((g: any) => !["approved", "skipped"].includes(g.status));
          patch.current_gate_id = current?.id || gate.id;
        }
      }
      if (Object.keys(patch).length) await sb.from("studio_projects").update(patch).eq("id", p.id);
      await recomputeProjectForecast(p.id).catch(() => null);
      await log("project", p.id, `Updated ${p.code}: ${changes.join(", ") || "no changes"}`);
      return { project_code: p.code, updated: changes };
    }

    case "send_note_to_client": {
      const p = byCode(a.project_code);
      if (!p) throw new Error(`No project ${a.project_code}`);
      if (!p.client_id) throw new Error(`${p.code} has no client.`);
      const text = String(a.message || "").trim().slice(0, 2000);
      if (!text) throw new Error("message is empty");
      let gateId: string | null = null;
      if (a.stage_name) {
        const { data: gates } = await sb.from("studio_gates").select("id, name, code").eq("project_id", p.id).is("archived_at", null);
        const n = norm(a.stage_name);
        gateId = (gates || []).find((g: any) => norm(g.name) === n || norm(g.code) === n || norm(g.name).includes(n))?.id || null;
      }
      const { error } = await sb.from("studio_portal_messages").insert({ client_id: p.client_id, project_id: p.id, gate_id: gateId, body: text, from_studio: true, author_name: "The Chanting Studio", via: "claude" });
      if (error) throw new Error(error.message);
      await log("project", p.id, `Sent a note to the client${a.stage_name ? ` on ${a.stage_name}` : ""}`);
      return { sent: true, project_code: p.code, stage: gateId ? a.stage_name : null, note: "Client sees it in the portal now; email follows in ~1 minute." };
    }

    case "get_stage_history": {
      const p = byCode(a.project_code);
      if (!p) throw new Error(`No project ${a.project_code}`);
      const { data: gates } = await sb.from("studio_gates").select("id, name, status, revision_round, revisions_included").eq("project_id", p.id).is("archived_at", null).order("order_index");
      const n = a.stage_name ? norm(a.stage_name) : "";
      const pick = (gates || []).filter((g: any) => !n || norm(g.name).includes(n));
      const ids = pick.map((g: any) => g.id);
      if (!ids.length) return { stages: [] };
      const [msgs, vers, tasks] = await Promise.all([
        sb.from("studio_portal_messages").select("gate_id, body, from_studio, via, created_at, read_by_client_at").in("gate_id", ids).is("archived_at", null).order("created_at"),
        sb.from("studio_deliverables").select("gate_id, title, version, shared_with_client, is_final, created_at").in("gate_id", ids).is("archived_at", null).order("created_at"),
        sb.from("studio_tasks").select("gate_id, title, status, source_ref").in("gate_id", ids).eq("source", "portal").is("archived_at", null),
      ]);
      return {
        project_code: p.code,
        stages: pick.map((g: any) => ({
          stage: g.name,
          status: g.status,
          revision: `${g.revision_round}/${g.revisions_included}`,
          notes: (msgs.data || []).filter((m: any) => m.gate_id === g.id).map((m: any) => ({ from: m.from_studio ? (m.via === "claude" ? "studio (via Claude)" : "studio") : "client", at: m.created_at, text: m.body, read: Boolean(m.read_by_client_at) })),
          versions: (vers.data || []).filter((d: any) => d.gate_id === g.id).map((d: any) => ({ title: d.title, version: d.version, shared: d.shared_with_client, final: d.is_final, at: d.created_at })),
          client_changes: (tasks.data || []).filter((t: any) => t.gate_id === g.id).map((t: any) => ({ round: Number(String(t.source_ref || "").match(/:r(\d+)$/)?.[1] || 1), change: String(t.title).replace(/^.*? R\d+:\s*/, ""), status: t.status === "done" ? "addressed" : t.status })),
        })),
      };
    }

    case "add_task": {
      const p = byCode(a.project_code);
      if (!p) throw new Error(`No project ${a.project_code}`);
      const { data: open } = await sb.from("studio_tasks").select("key, title").eq("project_id", p.id).is("archived_at", null).neq("status", "done");
      const dup = (open || []).find((t: any) => norm(t.title) === norm(a.title));
      if (dup) return { created: false, reason: "already exists", task_key: dup.key };
      const row = await createTask(sb, ctx, {
        projectId: p.id,
        title: String(a.title),
        description: a.description ? `${a.description}\n\nAdded by Claude.` : "Added by Claude.",
        type: ["task", "promise", "reply_owed", "follow_up", "admin"].includes(a.type) ? a.type : "task",
        priority: ["urgent", "high", "normal", "low"].includes(a.priority) ? a.priority : "normal",
        dueDate: isDate(a.due_date) ? a.due_date : null,
        source: "ai",
        promisedToName: a.promised_to || null,
      });
      await log("task", row.id, `Added ${row.key} ${a.title}`);
      return { created: true, task_key: row.key };
    }

    case "update_task": {
      const { data: t } = await sb.from("studio_tasks").select("id, key, status").eq("key", String(a.task_key || "").toUpperCase()).is("archived_at", null).maybeSingle();
      if (!t) throw new Error(`No task ${a.task_key}`);
      const patch: Record<string, any> = {};
      if (TASK_STATUSES.includes(a.status)) {
        patch.status = a.status;
        patch.completed_at = a.status === "done" ? new Date().toISOString() : null;
      }
      if (["urgent", "high", "normal", "low"].includes(a.priority)) patch.priority = a.priority;
      if (isDate(a.due_date)) {
        patch.due_date = a.due_date;
        patch.do_date = a.due_date;
      }
      if (a.title) patch.title = String(a.title).slice(0, 160);
      if (!Object.keys(patch).length) return { task_key: t.key, updated: [] };
      await sb.from("studio_tasks").update(patch).eq("id", t.id);
      await log("task", t.id, `Updated ${t.key}: ${Object.keys(patch).filter((k) => k !== "completed_at").join(", ")}`);
      return { task_key: t.key, updated: Object.keys(patch).filter((k) => k !== "completed_at") };
    }
  }
  throw new Error(`Unknown tool ${name}`);
}

const INSTRUCTIONS =
  "Studio OS is The Chanting Studio's production tracker (clients, projects with stages, tasks). Always call get_studio_overview first, reuse exact names and project codes, avoid duplicates, and tell the user what you changed. Never invent fees or dates you weren't told.";

export function registerClaudeMcpRoutes(app: Express) {
  app.get("/api/mcp/:token", (_req, res) => res.status(405).set("Allow", "POST").json({ error: "Use POST (MCP Streamable HTTP)." }));
  app.delete("/api/mcp/:token", (_req, res) => res.status(405).json({ error: "Stateless server." }));

  app.post("/api/mcp/:token", async (req: Request, res: Response) => {
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "Not configured." });
    const token = String(req.params.token || "");
    if (!token.startsWith("sos_")) return res.status(401).json({ error: "Invalid connector link." });
    const { data: tok } = await sb.from("studio_ingest_tokens").select("id, revoked_at, scope").eq("token_hash", hashToken(token)).maybeSingle();
    if (!tok || tok.revoked_at || tok.scope !== "claude") return res.status(401).json({ error: "This connector link was revoked or is not a Claude link." });
    if (limited(`mcp:${tok.id}`, 120, 60_000)) return res.status(429).json({ error: "Too many requests." });

    const handle = async (msg: any): Promise<any | null> => {
      const id = msg?.id;
      const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
      const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
      if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(-32600, "Invalid request");
      if (id === undefined || id === null) return null; // notification
      switch (msg.method) {
        case "initialize":
          return reply({
            protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "studio-os", title: "Studio OS — The Chanting Studio", version: "1.0.0" },
            instructions: INSTRUCTIONS,
          });
        case "ping":
          return reply({});
        case "tools/list":
          return reply({ tools: TOOLS });
        case "tools/call": {
          const name = String(msg.params?.name || "");
          if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool ${name}`);
          try {
            const out = await callTool(sb, name, msg.params?.arguments || {});
            return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 1) }] });
          } catch (err: any) {
            return reply({ content: [{ type: "text", text: `Error: ${err?.message || "failed"}` }], isError: true });
          }
        }
        case "resources/list":
          return reply({ resources: [] });
        case "prompts/list":
          return reply({ prompts: [] });
        default:
          return fail(-32601, `Method not found: ${msg.method}`);
      }
    };

    try {
      const body = req.body;
      if (Array.isArray(body)) {
        const out = (await Promise.all(body.map(handle))).filter(Boolean);
        if (!out.length) return res.status(202).end();
        return res.json(out);
      }
      const out = await handle(body);
      if (!out) return res.status(202).end();
      await sb.from("studio_ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);
      return res.json(out);
    } catch (err: any) {
      return res.status(500).json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: err?.message || "Internal error" } });
    }
  });
}
