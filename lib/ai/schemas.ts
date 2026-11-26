import { z } from "zod";
import { wordLimit } from "./sanitize.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .catch(null);

const nullableText = z.string().trim().max(400).nullable().catch(null);

export const EXTRACT_CATEGORIES = [
  "client_request",
  "approval",
  "feedback",
  "payment",
  "scheduling",
  "new_lead",
  "internal",
  "fyi",
  "other",
] as const;

export const extractedTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  due_date: isoDate,
  type: z.enum(["task", "promise", "follow_up"]).catch("task"),
});

/** Strict extraction contract for a single message (email, WhatsApp, inquiry). */
export const extractionSchema = z.object({
  category: z.enum(EXTRACT_CATEGORIES).catch("other"),
  client_match: nullableText,
  project_match: nullableText,
  summary: z
    .string()
    .trim()
    .transform((s) => wordLimit(s, 20)),
  tasks: z.array(extractedTaskSchema).max(12).catch([]),
  approval: z
    .object({
      approved: z.boolean(),
      gate_hint: nullableText,
    })
    .nullable()
    .catch(null),
  payment: z
    .object({
      status: z.enum(["none", "mentioned", "promised", "sent", "received"]).catch("mentioned"),
      note: nullableText,
    })
    .nullable()
    .catch(null),
  deadline_change: z
    .object({
      new_date: isoDate,
      note: nullableText,
    })
    .nullable()
    .catch(null),
  needs_reply: z.boolean().catch(false),
  delivered: z.boolean().catch(false).default(false),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type Extraction = z.infer<typeof extractionSchema>;

/** Split free text (paste / voice / WhatsApp export) into reviewable items. */
export const splitItemSchema = z.object({
  kind: z.enum(["task", "promise", "deadline", "approval", "payment"]).catch("task"),
  title: z.string().trim().min(1).max(160),
  due_date: isoDate,
  project_match: nullableText,
  who: nullableText,
  confidence: z.number().min(0).max(1).catch(0.6),
});
export const splitSchema = z.object({
  items: z.array(splitItemSchema).max(60).catch([]),
});
export type SplitItem = z.infer<typeof splitItemSchema>;
export type SplitResult = z.infer<typeof splitSchema>;

// ---------------------------------------------------------------------------
// JSON Schemas sent to providers (hand-written: Zod transforms are not
// representable in JSON Schema). Every field required + nullable for strictness.
// ---------------------------------------------------------------------------
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const str = { type: "string" };
const date = { type: "string", description: "YYYY-MM-DD" };

export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "client_match",
    "project_match",
    "summary",
    "tasks",
    "approval",
    "payment",
    "deadline_change",
    "needs_reply",
    "delivered",
    "confidence",
  ],
  properties: {
    category: { type: "string", enum: [...EXTRACT_CATEGORIES] },
    client_match: nullable(str),
    project_match: nullable(str),
    summary: { type: "string", description: "At most 20 words." },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "due_date", "type"],
        properties: {
          title: str,
          due_date: nullable(date),
          type: { type: "string", enum: ["task", "promise", "follow_up"] },
        },
      },
    },
    approval: nullable({
      type: "object",
      additionalProperties: false,
      required: ["approved", "gate_hint"],
      properties: { approved: { type: "boolean" }, gate_hint: nullable(str) },
    }),
    payment: nullable({
      type: "object",
      additionalProperties: false,
      required: ["status", "note"],
      properties: {
        status: { type: "string", enum: ["none", "mentioned", "promised", "sent", "received"] },
        note: nullable(str),
      },
    }),
    deadline_change: nullable({
      type: "object",
      additionalProperties: false,
      required: ["new_date", "note"],
      properties: { new_date: nullable(date), note: nullable(str) },
    }),
    needs_reply: { type: "boolean" },
    delivered: { type: "boolean", description: "SENT BY the studio: true if this email delivers something (file, link, cut, quote, invoice)." },
    confidence: { type: "number" },
  },
} as const;

export const splitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "title", "due_date", "project_match", "who", "confidence"],
        properties: {
          kind: { type: "string", enum: ["task", "promise", "deadline", "approval", "payment"] },
          title: str,
          due_date: nullable(date),
          project_match: nullable(str),
          who: nullable(str),
          confidence: { type: "number" },
        },
      },
    },
  },
} as const;
