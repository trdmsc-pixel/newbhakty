import assert from "node:assert/strict";
import { cleanEmailBody, redactAmounts, wordLimit } from "../lib/ai/sanitize.js";
import { extractionSchema, splitSchema } from "../lib/ai/schemas.js";
import { planActions, isAutoApplicable } from "../server/phase3/inboxEngine.js";
import { matchClientByEmails, matchProject, businessHoursSince, type StudioCtx } from "../server/phase3/studioData.js";
import { parseMessage, shouldSkip, signState, verifyState } from "../server/phase3/gmail.js";
import { parseWhatsAppExport, waToPrompt } from "../src/studio-os/whatsappParser.js";

// sanitize
const email = `Hi Shyam,\n\nStoryboard looks great, approved! Please send the animatic by Monday.\n\nBest regards,\nJane\nCompoSecure\n\nOn Tue, 24 Nov 2026 at 10:00, Shyam <shyam@thechantingstudio.in> wrote:\n> Here is the storyboard\n> Fee is ₹4,50,000`;
const cleaned = cleanEmailBody(email);
assert.ok(cleaned.includes("approved"));
assert.ok(!cleaned.includes("Here is the storyboard"), "quoted history stripped");
assert.ok(!cleaned.includes("CompoSecure"), "signature stripped");
assert.equal(redactAmounts("Invoice of ₹4,50,000 and $12,000 or 3 lakh, fee 450000", [450000]).match(/\d{4,}/), null);
assert.equal(wordLimit("one two three four", 2), "one two");

// schema leniency
const ex = extractionSchema.parse({
  category: "approval", client_match: "CompoSecure / Arculus", project_match: "ARC",
  summary: "Client approved the storyboard and wants the animatic by Monday and also some more words here to exceed the twenty word limit ok",
  tasks: [{ title: "Send animatic", due_date: "2026-11-30", type: "task" }, { title: "Bad date", due_date: "Monday", type: "weird" }],
  approval: { approved: true, gate_hint: "storyboard" }, payment: null, deadline_change: null, needs_reply: true, confidence: 0.9,
});
assert.ok(ex.summary.split(" ").length <= 20);
assert.equal(ex.tasks[1].due_date, null);
assert.equal(ex.tasks[1].type, "task");
assert.equal(splitSchema.parse({ items: "nope" }).items.length, 0);

// matching
const ctx: StudioCtx = {
  timezone: "Asia/Kolkata", aiProvider: "gemini", ownerMemberId: "m1", fallbackProjectId: "pint",
  clients: [
    { id: "c1", name: "CompoSecure / Arculus", organisation: "CompoSecure", email_domains: ["arculus.co", "composecure.com"], timezone: "America/New_York", is_confidential: true, contacts: [{ id: "ct1", client_id: "c1", name: "Jane", email: "jane@gmail.com" }] },
    { id: "cint", name: "Internal", organisation: "TCS", email_domains: ["thechantingstudio.in"], timezone: "Asia/Kolkata", is_confidential: false, contacts: [] },
  ],
  projects: [
    { id: "p1", code: "ARC", title: "Arculus USB Launch Film", client_id: "c1", status: "active", is_confidential: true, fee_amount: 450000, current_gate_id: null, hard_deadline: null, promised_date: null, forecast_date: null },
    { id: "pint", code: "INT", title: "Internal ops", client_id: "cint", status: "active", is_confidential: false, fee_amount: null, current_gate_id: null, hard_deadline: null, promised_date: null, forecast_date: null },
  ],
};
assert.equal(matchClientByEmails(ctx, ["bob@sub.arculus.co"])?.client.id, "c1");
assert.equal(matchClientByEmails(ctx, ["jane@gmail.com"])?.contact?.id, "ct1");
assert.equal(matchClientByEmails(ctx, ["someone@gmail.com"]), null);
assert.equal(matchClientByEmails(ctx, ["shyam@thechantingstudio.in"]), null, "own domain ignored");
assert.equal(matchProject(ctx, "Re: ARC-12 animatic")?.id, "p1");
assert.equal(matchProject(ctx, "the arc of the story")?.id, undefined, "lowercase word not a code");
assert.equal(matchProject(ctx, "Feedback on the Arculus launch cut")?.id, "p1");
assert.equal(matchProject(ctx, "hello", { clientId: "c1" })?.id, "p1", "single open project for client");

// planning & auto-apply rules
const cands = planActions(ex, { direction: "received", projectId: "p1", clientId: "c1", contactName: "Jane" });
const actions = cands.map((c) => c.action).sort();
assert.deepEqual(actions, ["approve_gate", "create_task", "create_task"]);
assert.equal(isAutoApplicable(cands.find((c) => c.action === "create_task")!), true);
assert.equal(isAutoApplicable(cands.find((c) => c.action === "approve_gate")!), false, "gate approval never auto");
assert.equal(isAutoApplicable({ action: "create_task", confidence: 0.7 }), false);
const sentCands = planActions({ ...ex, approval: null }, { direction: "sent", projectId: "p1", contactName: "Jane" });
assert.ok(sentCands.every((c) => c.action === "create_promise"));
const paid = planActions({ ...ex, tasks: [], approval: null, payment: { status: "received", note: null } }, { projectId: "p1" });
assert.equal(paid[0].action, "update_payment");
assert.equal(isAutoApplicable(paid[0]), false, "payment received never auto");

// business hours: Fri 10:00 → Mon 10:00 NY is 24 weekday hours (not 72)
const fri = new Date("2026-11-27T15:00:00Z"); // Fri 10:00 NY
const mon = new Date("2026-11-30T15:00:00Z");
assert.equal(businessHoursSince(fri.toISOString(), "America/New_York", mon), 24);

// gmail parsing & skip rules
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const msg = parseMessage({ id: "m1", threadId: "t1", labelIds: ["INBOX", "CATEGORY_PERSONAL"], internalDate: String(Date.now()),
  payload: { mimeType: "multipart/alternative", headers: [{ name: "From", value: "Jane Doe <jane@arculus.co>" }, { name: "Subject", value: "Storyboard" }, { name: "To", value: "studio@thechantingstudio.in" }],
    parts: [{ mimeType: "text/plain", body: { data: b64("Approved!") } }] } });
assert.equal(msg.from.email, "jane@arculus.co");
assert.equal(msg.body, "Approved!");
assert.equal(shouldSkip(msg, "studio@thechantingstudio.in"), null);
assert.equal(shouldSkip({ ...msg, from: { name: "", email: "no-reply@x.com" } }, "studio@thechantingstudio.in"), "noreply");
assert.equal(shouldSkip({ ...msg, labelIds: ["CATEGORY_PROMOTIONS"] }, "studio@thechantingstudio.in"), "category");
assert.equal(shouldSkip({ ...msg, isNewsletter: true }, "studio@thechantingstudio.in"), "newsletter");

// OAuth state
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
const st = signState({ label: "x" });
assert.equal(verifyState(st)?.label, "x");
assert.equal(verifyState(st.replace(/.$/, (c) => (c === "A" ? "B" : "A"))), null);

// WhatsApp
const wa = parseWhatsAppExport(`12/11/2026, 10:32 - Jane: Can you send the cut by Friday?\n13/11/2026, 09:00 - Shyam: Sure, I'll share tomorrow\nsecond line\n[14/11/26, 9:15:02 AM] Jane: <Media omitted>`);
assert.equal(wa.length, 2);
assert.ok(wa[1].text.includes("second line"));
assert.ok(waToPrompt(wa).includes("Jane: Can you send"));

console.log("phase3 self-test: all assertions passed");
