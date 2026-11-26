export type CurrencyCode = "INR" | "USD" | "EUR";

export type ProjectType =
  | "ad_film"
  | "explainer"
  | "music_video"
  | "series"
  | "trailer"
  | "reel"
  | "own_film"
  | "internal";

export type ProjectStatus =
  | "lead"
  | "quoted"
  | "active"
  | "on_hold"
  | "delivered"
  | "paid"
  | "lost"
  | "parked";

export type ProjectHealth = "on_track" | "tight" | "at_risk" | "late";

export type GateStatus =
  | "not_started"
  | "in_work"
  | "waiting_on_client"
  | "approved"
  | "revising"
  | "skipped";

export type TaskType = "task" | "promise" | "reply_owed" | "follow_up" | "admin";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "waiting_on_client"
  | "in_review"
  | "revising"
  | "done";

export type TaskPriority = "urgent" | "high" | "normal" | "low";

export type TaskSource = "manual" | "email" | "whatsapp" | "website" | "portal" | "ai";

export type GateTemplateKey = "film" | "music_video" | "series_episode" | "hybrid" | "internal";

export interface StudioSettings {
  id: string;
  overrun_factor: number;
  default_approval_latency_days: number;
  work_hours_per_day: number;
  studio_closes_at: string; // HH:mm
  wip_limit: number;
  takes_per_keeper: number;
  block_seconds: number;
  timezone: string;
  ai_provider: "gemini" | "claude";
  brief_time: string;
  usd_to_inr: number;
  eur_to_inr: number;
  expenses_enabled: boolean;
  invoice_generator_url?: string;
}

export interface StudioMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "producer" | "artist" | "editor" | "music";
  avatar_url?: string;
  initials: string;
  color: string;
  hourly_capacity: number;
  is_active: boolean;
  linked?: boolean;
  invited_at?: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  role?: string;
  is_portal_user: boolean;
  /** Client ID used as the portal username (server-managed). */
  portal_login_id?: string;
  must_set_password?: boolean;
  portal_last_login_at?: string;
  has_portal_login?: boolean;
}

export interface StudioClient {
  id: string;
  name: string;
  organisation: string;
  email_domains: string[];
  timezone: string;
  currency: CurrencyCode;
  avg_approval_latency_days: number;
  is_confidential: boolean;
  notes?: string;
  color: string;
  contacts: ClientContact[];
}

export interface StudioGate {
  id: string;
  project_id: string;
  order_index: number;
  code: string;
  name: string;
  needs_client_approval: boolean;
  estimate_days: number;
  actual_days?: number;
  started_at?: string;
  sent_for_approval_at?: string;
  approved_at?: string;
  status: GateStatus;
  revision_round: number;
  revisions_included: number;
  client_comment?: string;
  portal_visible: boolean;
}

export type HolidayRegion = "IN" | "US" | "AR" | "GLOBAL";

export interface StudioHoliday {
  id: string;
  holiday_date: string; // YYYY-MM-DD
  name: string;
  region: HolidayRegion;
  is_active: boolean;
}

export type GenerationBlockStatus = "planned" | "generating" | "keeper" | "rejected";

export interface StudioGenerationBlock {
  id: string;
  project_id: string;
  gate_id?: string;
  block_number: number;
  label?: string;
  prompt_ref?: string;
  takes: number;
  status: GenerationBlockStatus;
  seconds: number;
  updated_at?: string;
}

export interface StudioTimeEntry {
  id: string;
  task_id?: string;
  member_id?: string;
  started_at: string;
  ended_at?: string;
  kind: "active" | "pause";
  notes?: string;
}

export interface StudioPushSubscription {
  id: string;
  member_id?: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StudioProject {
  id: string;
  code: string;
  title: string;
  client_id: string;
  type: ProjectType;
  status: ProjectStatus;
  fee_amount?: number;
  currency: CurrencyCode;
  runtime_seconds?: number;
  versions: number;
  aspect_ratios: string[];
  hard_deadline?: string; // YYYY-MM-DD
  promised_date?: string; // YYYY-MM-DD
  forecast_date?: string; // computed YYYY-MM-DD
  health: ProjectHealth;
  current_gate_id?: string;
  cover_image_url?: string;
  emoji: string;
  drive_folder_url?: string;
  review_link_url?: string;
  is_confidential: boolean;
  portal_visible: boolean;
  priority: "p1" | "p2" | "p3";
  owner_member_id: string;
  pinned?: boolean;
  last_client_touch_at?: string;
  last_studio_touch_at?: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface StudioTask {
  id: string;
  key: string;
  project_id: string;
  gate_id?: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  do_date?: string; // YYYY-MM-DD
  due_date?: string; // ISO date or YYYY-MM-DD
  estimate_hours: number;
  actual_hours: number;
  assignee_member_id: string;
  checklist: TaskChecklistItem[];
  source: TaskSource;
  source_ref?: string;
  promised_to_name?: string;
  waiting_on_name?: string;
  channel?: "gmail" | "whatsapp" | "portal" | "internal";
  is_in_now: boolean;
  snoozed_until?: string;
  completed_at?: string;
  portal_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudioPayment {
  id: string;
  project_id: string;
  invoice_no: string;
  amount: number;
  currency: CurrencyCode;
  tds_amount: number;
  sent_at?: string;
  due_at?: string;
  received_at?: string;
  status: "draft" | "sent" | "partly_paid" | "paid" | "overdue";
  notes?: string;
  received_amount?: number;
  file_url?: string;
}

export interface ActivityLogItem {
  id: string;
  actor: "member" | "client" | "system" | "ai";
  actor_name: string;
  entity_type: "project" | "gate" | "task" | "payment" | "settings";
  entity_id: string;
  action: string;
  at: string;
}

export type StudioRoute =
  | "today"
  | "overview"
  | "inbox"
  | "mail"
  | "projects"
  | "pipeline"
  | "board"
  | "timeline"
  | "table"
  | "weekly_review"
  | "clients"
  | "money"
  | "settings"
  | "project_detail";
