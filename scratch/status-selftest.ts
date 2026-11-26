import assert from "node:assert/strict";
import { statusCandidates } from "../server/phase3/gmailSync.js";
import { isAutoApplicable } from "../server/phase3/inboxEngine.js";

// Minimal chainable Supabase stub: returns `rows` for any query.
const stub = (rows: any[]) => {
  const q: any = { select: () => q, eq: () => q, neq: () => q, is: () => q, order: () => q, limit: () => Promise.resolve({ data: rows }) };
  return { from: () => q } as any;
};

(async () => {
  // Client reply moves the matching waiting task back to To do
  let c = await statusCandidates(stub([{ id: "t1", key: "ARC-4", waiting_on_name: "Damodar Mahajan", source_ref: null }, { id: "t2", key: "ARC-5", waiting_on_name: "Someone Else", source_ref: null }]),
    { sent: false, projectId: "p", account: "studio@x", threadId: "th", contactName: "Damodar Mahajan", clientName: "Arculus", delivered: false, confidence: 0.9 });
  assert.equal(c.length, 1); assert.equal(c[0].payload.task_id, "t1"); assert.equal(c[0].payload.status, "todo");
  assert.ok(isAutoApplicable(c[0] as any), "client-reply move auto-applies (undoable)");

  // Single waiting task on the project is picked even without a name match
  c = await statusCandidates(stub([{ id: "t9", key: "ARC-9", waiting_on_name: null, source_ref: null }]),
    { sent: false, projectId: "p", account: "a", threadId: "th", contactName: "X", clientName: null, delivered: false, confidence: 0.9 });
  assert.equal(c.length, 1);

  // Delivery email closes the earliest open promise; low confidence stays a suggestion
  c = await statusCandidates(stub([{ id: "pr1", key: "ARC-7", due_date: "2026-11-27" }]),
    { sent: true, projectId: "p", account: "a", threadId: "th", contactName: null, clientName: null, delivered: true, confidence: 0.6 });
  assert.equal(c[0].payload.status, "done");
  assert.equal(isAutoApplicable(c[0] as any), false, "uncertain delivery → suggestion, not auto");

  // Sent mail that isn't a delivery changes nothing
  c = await statusCandidates(stub([{ id: "pr1", key: "ARC-7" }]),
    { sent: true, projectId: "p", account: "a", threadId: "th", contactName: null, clientName: null, delivered: false, confidence: 0.9 });
  assert.equal(c.length, 0);
  console.log("status rules self-test: all assertions passed");
})();
