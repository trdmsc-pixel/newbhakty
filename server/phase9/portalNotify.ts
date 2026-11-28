/**
 * Emails "major" client notifications (ready for review, new version, final files,
 * delivered) created by DB triggers in studio_portal_notifications (email_status = 'pending').
 *
 *   POST /api/studio-os/portal-notify/flush   (owner or cron) — sends up to 20 pending emails
 *
 * Sends from the studio's connected Gmail (prefers studio@…), falling back to Resend
 * (RESEND_API_KEY) when no Gmail account can send. Each notification is emailed once.
 */
import type { Express, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv, getServiceSupabase, verifyCronOrOwnerAuth } from "../studioOsRoutes.js";
import { accounts, buildMime, canSend, gmailFor } from "../phase6/mail.js";
import { baseUrlFromRequest } from "../phase3/gmail.js";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Kinds that mean "the studio sent something" — the only ones ever emailed. */
const EMAIL_KINDS = new Set(["review_ready", "new_version", "final_delivery", "message"]);
/** Wait this long before emailing, so an accidental change that's undone never reaches the client. */
const GRACE_MS = 60_000;

/** Re-check that what we're about to email is still true (stage still awaiting review, file still shared, note not deleted). */
async function stillValid(sb: SupabaseClient, n: any): Promise<boolean> {
  if (!EMAIL_KINDS.has(n.kind)) return false;
  if (n.kind === "review_ready" && n.gate_id) {
    const { data } = await sb.from("studio_gates").select("status, portal_visible").eq("id", n.gate_id).maybeSingle();
    return Boolean(data && data.status === "waiting_on_client" && data.portal_visible);
  }
  if ((n.kind === "new_version" || n.kind === "final_delivery") && n.ref_id) {
    const { data } = await sb.from("studio_deliverables").select("shared_with_client, archived_at").eq("id", n.ref_id).maybeSingle();
    return Boolean(data && data.shared_with_client && !data.archived_at);
  }
  if (n.kind === "message" && n.ref_id) {
    const { data } = await sb.from("studio_portal_messages").select("archived_at").eq("id", n.ref_id).maybeSingle();
    return Boolean(data && !data.archived_at);
  }
  return true;
}

export async function flushPortalEmails(sb: SupabaseClient, baseUrl: string, opts: { digest?: boolean } = {}) {
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
  const { data: pending } = await sb
    .from("studio_portal_notifications")
    .select("id, client_id, project_id, kind, title, body, gate_id, ref_id, created_at")
    .eq("email_status", "pending")
    .lte("created_at", cutoff)
    .order("created_at")
    .limit(60);
  if (!pending?.length) return { sent: 0, failed: 0, skipped: 0 };

  const senders = (await accounts(sb)).filter(canSend);
  const sender = senders.find((a) => /^studio@/i.test(a.email)) || senders[0];
  const resendKey = getEnv("RESEND_API_KEY");
  const resendFrom = getEnv("RESEND_FROM") || "The Chanting Studio <onboarding@resend.dev>";
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const mark = (ids: string[], email_status: string) => sb.from("studio_portal_notifications").update({ email_status }).in("id", ids);

  // Each client's email preference: instant / daily digest (sent by the morning run) / portal only.
  const { data: prefs } = await sb.from("studio_clients").select("id, email_pref").in("id", [...new Set(pending.map((n) => n.client_id))]);
  const pref = new Map((prefs || []).map((c: any) => [c.id, c.email_pref || "instant"]));

  // One email per client, combining everything sent to them in this window.
  const byClient = new Map<string, any[]>();
  for (const n of pending) {
    const p = pref.get(n.client_id) || "instant";
    if (p === "portal") {
      await mark([n.id], "skipped");
      skipped++;
      continue;
    }
    if (p === "digest" && !opts.digest) continue; // stays pending until the daily digest run
    if (!(await stillValid(sb, n))) {
      await mark([n.id], "skipped");
      skipped++;
      continue;
    }
    (byClient.get(n.client_id) || byClient.set(n.client_id, []).get(n.client_id)!).push(n);
  }

  for (const [clientId, list] of byClient) {
    // Same stage: "ready for review" already covers its new version — keep one line per stage.
    const seenGate = new Set<string>();
    const items = list.filter((n) => {
      if (n.kind === "message" || !n.gate_id) return true;
      const k = `${n.gate_id}`;
      if (seenGate.has(k)) return false;
      seenGate.add(k);
      return true;
    });
    const ids = list.map((n) => n.id);
    const [{ data: contacts }, { data: projects }] = await Promise.all([
      sb.from("studio_client_contacts").select("name, email").eq("client_id", clientId).eq("is_portal_user", true).is("archived_at", null),
      sb.from("studio_projects").select("id, title").in("id", [...new Set(list.map((n) => n.project_id).filter(Boolean))]),
    ]);
    const to = (contacts || []).map((c: any) => String(c.email || "").trim()).filter((e: string) => /@/.test(e));
    if (!to.length || (!sender && !resendKey)) {
      await mark(ids, "skipped");
      skipped += ids.length;
      continue;
    }
    const titleOf = (pid: string | null) => (projects || []).find((p: any) => p.id === pid)?.title || "";
    const firstProject = list.find((n) => n.project_id)?.project_id || null;
    const link = `${baseUrl}/portal${firstProject && new Set(list.map((n) => n.project_id)).size === 1 ? `?project=${firstProject}` : ""}`;
    const first = String((contacts || [])[0]?.name || "").split(" ")[0] || "there";
    const subject = items.length === 1 ? `${items[0].title}${titleOf(items[0].project_id) && !items[0].title.includes(titleOf(items[0].project_id)) ? ` — ${titleOf(items[0].project_id)}` : ""}` : `${items.length} updates from The Chanting Studio`;
    const text = `Hi ${first},\n\n${items.map((n) => `• ${n.title}${titleOf(n.project_id) ? ` (${titleOf(n.project_id)})` : ""}${n.kind === "message" && n.body ? `\n  "${n.body}"` : ""}`).join("\n")}\n\nOpen your portal: ${link}\n\n— The Chanting Studio`;
    const rows = items
      .map(
        (n) => `<tr><td style="padding:10px 0;border-bottom:1px solid #EEF0F4">
<p style="margin:0;font-weight:600">${esc(n.title)}</p>
${titleOf(n.project_id) ? `<p style="margin:2px 0 0;color:#5B5F6B;font-size:13px">${esc(titleOf(n.project_id))}</p>` : ""}
${n.kind === "message" && n.body ? `<p style="margin:8px 0 0;padding:10px 12px;background:#F4F2FF;border-radius:12px">${esc(n.body)}</p>` : ""}
</td></tr>`
      )
      .join("");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16181D;max-width:540px">
<p>Hi ${esc(first)},</p>
<table style="width:100%;border-collapse:collapse">${rows}</table>
<p style="margin:22px 0"><a href="${esc(link)}" style="background:#5B3FE4;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Open in your portal</a></p>
<p style="color:#8A8F9C;font-size:12px">You're receiving this because you have access to The Chanting Studio client portal.</p>
</div>`;
    try {
      if (sender) {
        const gmail = await gmailFor(sb, sender);
        await gmail.sendRaw(buildMime({ from: `The Chanting Studio <${sender.email}>`, to, cc: [], subject, text, html }));
      } else {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: resendFrom, to, subject, text, html }),
        });
        if (!r.ok) throw new Error(`Resend HTTP ${r.status}`);
      }
      await mark(ids, "sent");
      sent += ids.length;
    } catch (err: any) {
      console.warn("[portal-notify] email failed:", err?.message);
      await mark(ids, "failed");
      failed += ids.length;
    }
  }
  return { sent, failed, skipped };
}

export function registerPortalNotifyRoutes(app: Express) {
  app.all("/api/studio-os/portal-notify/flush", async (req: Request, res: Response) => {
    if (!(await verifyCronOrOwnerAuth(req))) return res.status(401).json({ error: "Unauthorized." });
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "Not configured." });
    try {
      return res.json(await flushPortalEmails(sb, baseUrlFromRequest(req)));
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Flush failed." });
    }
  });
}
