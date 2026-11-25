import { z } from "zod";

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Task title is required").max(160),
  description: z.string().max(1000).optional(),
  project_id: z.string().min(1),
  gate_id: z.string().optional(),
  type: z.enum(["task", "promise", "reply_owed", "follow_up", "admin"]).default("task"),
  status: z
    .enum(["backlog", "todo", "in_progress", "waiting_on_client", "in_review", "revising", "done"])
    .default("todo"),
  priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
  do_date: z.string().optional(),
  due_date: z.string().optional(),
  estimate_hours: z.number().min(0.25).max(200).default(1),
  promised_to_name: z.string().optional(),
  waiting_on_name: z.string().optional(),
  channel: z.enum(["gmail", "whatsapp", "portal", "internal"]).optional(),
  is_in_now: z.boolean().default(false),
});

export const projectCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(5)
    .transform((v) => v.toUpperCase()),
  title: z.string().trim().min(2).max(120),
  client_id: z.string().min(1),
  type: z.enum([
    "ad_film",
    "explainer",
    "music_video",
    "series",
    "trailer",
    "reel",
    "own_film",
    "internal",
  ]),
  status: z.enum(["lead", "quoted", "active", "on_hold", "delivered", "paid", "lost", "parked"]).default("active"),
  fee_amount: z.number().nonnegative().optional(),
  currency: z.enum(["INR", "USD", "EUR"]).default("INR"),
  runtime_seconds: z.number().int().positive().optional(),
  versions: z.number().int().min(1).default(1),
  hard_deadline: z.string().optional(),
  emoji: z.string().default("🎬"),
  is_confidential: z.boolean().default(false),
  priority: z.enum(["p1", "p2", "p3"]).default("p2"),
  template: z.enum(["film", "music_video", "series_episode", "hybrid", "internal"]).default("film"),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
