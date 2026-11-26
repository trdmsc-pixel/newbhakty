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

export async function flushPortalEmails(sb: SupabaseClient, baseUrl: string) {
  const { data: pending } = await sb
    .from("studio_portal_notifications")
    .select("id, client_id, project_id, kind, title, body")
    .eq("email_status", "pending")
    .order("created_at")
    .limit(20);
  if (!pending?.length) return { sent: 0, failed: 0, skipped: 0 };

  const senders = (await accounts(sb)).filter(canSend);
  const sender = senders.find((a) => /^studio@/i.test(a.email)) || senders[0];
  const resendKey = getEnv("RESEND_API_KEY");
  const resendFrom = getEnv("RESEND_FROM") || "The Chanting Studio <onboarding@resend.dev>";
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const n of pending) {
    const [{ data: contacts }, { data: project }] = await Promise.all([
      sb.from("studio_client_contacts").select("name, email").eq("client_id", n.client_id).eq("is_portal_user", true).is("archived_at", null),
      n.project_id ? sb.from("studio_projects").select("title, code").eq("id", n.project_id).maybeSingle() : Promise.resolve({ data: null } as any),
    ]);
    const to = (contacts || []).map((c: any) => String(c.email || "").trim()).filter((e: string) => /@/.test(e));
    if (!to.length || (!sender && !resendKey)) {
      await sb.from("studio_portal_notifications").update({ email_status: "skipped" }).eq("id", n.id);
      skipped++;
      continue;
    }
    const link = `${baseUrl}/portal${n.project_id ? `?project=${n.project_id}` : ""}`;
    const first = String((contacts || [])[0]?.name || "").split(" ")[0] || "there";
    const subject = `${n.title}${project?.title && !n.title.includes(project.title) ? ` — ${project.title}` : ""}`;
    const text = `Hi ${first},\n\n${n.title}${project?.title ? ` (${project.title})` : ""}.\n${n.body ? `${n.body}\n` : ""}\nOpen your portal: ${link}\n\n— The Chanting Studio`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#16181D;max-width:520px">
<p>Hi ${esc(first)},</p>
<p style="font-size:17px;font-weight:600;margin:16px 0 6px">${esc(n.title)}</p>
${project?.title ? `<p style="color:#5B5F6B;margin:0 0 10px">${esc(project.title)}</p>` : ""}
${n.body ? `<p>${esc(n.body)}</p>` : ""}
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
      await sb.from("studio_portal_notifications").update({ email_status: "sent" }).eq("id", n.id);
      sent++;
    } catch (err: any) {
      console.warn("[portal-notify] email failed:", err?.message);
      await sb.from("studio_portal_notifications").update({ email_status: "failed" }).eq("id", n.id);
      failed++;
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
