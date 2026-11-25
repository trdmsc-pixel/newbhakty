import type { Express, Request, Response } from "express";
import { z } from "zod";
import { extractBearerToken, getServiceSupabase, verifyOwnerJwt } from "../studioOsRoutes.js";
import { baseUrlFromRequest } from "../phase3/gmail.js";

export function registerPhase5Routes(app: Express) {
  // Owner invites a team member to Studio OS (magic-link sign-in, no password needed).
  app.post("/api/studio-os/team/invite", async (req: Request, res: Response) => {
    const owner = await verifyOwnerJwt(extractBearerToken(req));
    if (!owner.ok) return res.status(401).json({ error: "Owner sign-in required." });
    const parsed = z.object({ member_id: z.string().uuid() }).safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: "member_id required" });
    const sb = getServiceSupabase();
    if (!sb) return res.status(503).json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured." });

    const { data: member } = await sb.from("studio_members").select("id, name, email, role, is_active").eq("id", parsed.data.member_id).maybeSingle();
    if (!member) return res.status(404).json({ error: "Member not found." });
    if (member.role === "owner") return res.status(400).json({ error: "The owner doesn't need an invite." });
    if (!member.is_active) return res.status(400).json({ error: "Activate this member first." });
    const email = String(member.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Add an email for this member first." });

    const redirectTo = `${baseUrlFromRequest(req)}/studio-os`;
    const invite = await sb.auth.admin.inviteUserByEmail(email, { redirectTo, data: { studio_role: member.role } });
    if (invite.error) {
      const otp = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
      if (otp.error) return res.status(500).json({ error: otp.error.message });
    }
    await sb
      .from("studio_members")
      .update({ invited_at: new Date().toISOString(), ...(invite.data?.user?.id ? { user_id: invite.data.user.id } : {}) })
      .eq("id", member.id);
    await sb.from("studio_activity_log").insert({
      actor: "member",
      actor_name: "Shyam",
      entity_type: "settings",
      entity_id: member.id,
      action: `invited ${member.name} (${member.role}) to Studio OS`,
    });
    return res.json({ ok: true, email });
  });
}
