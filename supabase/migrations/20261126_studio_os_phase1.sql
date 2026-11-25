-- ============================================================================
-- Studio OS — Phase 1 Complete Schema & Row Level Security
-- The Chanting Studio (Chaitravarna Ventures Pvt. Ltd.)
-- ============================================================================

create extension if not exists "pgcrypto";

-- Helper: auto-update updated_at
create or replace function public.studio_os_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. studio_settings (singleton)
create table if not exists public.studio_settings (
  id uuid primary key default gen_random_uuid(),
  overrun_factor numeric not null default 1.6,
  default_approval_latency_days int not null default 2,
  work_hours_per_day numeric not null default 7,
  studio_closes_at time not null default '21:30',
  wip_limit int not null default 3,
  takes_per_keeper numeric not null default 3,
  block_seconds int not null default 20,
  timezone text not null default 'Asia/Kolkata',
  ai_provider text default 'gemini',
  brief_time time not null default '07:30',
  usd_to_inr numeric not null default 84.5,
  eur_to_inr numeric not null default 91.0,
  expenses_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 2. studio_members (INTERNAL ONLY)
create table if not exists public.studio_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text,
  role text not null check (role in ('owner', 'producer', 'artist', 'editor', 'music')),
  avatar_url text,
  hourly_capacity numeric not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- Helper: check if current auth user is the Studio OS owner (defined after studio_members exists)
create or replace function public.studio_os_is_owner()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.studio_members
    where user_id = auth.uid()
      and role = 'owner'
      and is_active = true
      and archived_at is null
  )
  or (auth.jwt() ->> 'email') in (
    'shyam@thechantingstudio.in',
    'studio@thechantingstudio.in',
    'accounts@thechantingstudio.in'
  );
$$;

-- 3. studio_clients
create table if not exists public.studio_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation text not null,
  email_domains text[] not null default '{}',
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR' check (currency in ('INR', 'USD', 'EUR')),
  avg_approval_latency_days numeric not null default 2,
  is_confidential boolean not null default false,
  notes text,
  color text default '#5B3FE4',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 4. studio_client_contacts
create table if not exists public.studio_client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  whatsapp text,
  role text,
  is_portal_user boolean not null default false,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 5. studio_projects
create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  client_id uuid references public.studio_clients(id) on delete set null,
  type text not null default 'ad_film' check (type in ('ad_film','explainer','music_video','series','trailer','reel','own_film','internal')),
  status text not null default 'active' check (status in ('lead','quoted','active','on_hold','delivered','paid','lost','parked')),
  fee_amount numeric,
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  runtime_seconds int,
  versions int not null default 1,
  aspect_ratios text[] not null default '{"16:9"}',
  hard_deadline date,
  promised_date date,
  forecast_date date,
  health text not null default 'on_track' check (health in ('on_track','tight','at_risk','late')),
  current_gate_id uuid,
  cover_image_url text,
  emoji text default '🎬',
  drive_folder_url text,
  review_link_url text,
  is_confidential boolean not null default false,
  portal_visible boolean not null default true,
  is_public_showcase boolean not null default false,
  priority text not null default 'p2' check (priority in ('p1','p2','p3')),
  owner_member_id uuid references public.studio_members(id),
  last_client_touch_at timestamptz,
  last_studio_touch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 6. studio_gates
create table if not exists public.studio_gates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  order_index int not null,
  code text not null,
  name text not null,
  needs_client_approval boolean not null default false,
  estimate_days numeric not null default 1,
  started_at timestamptz,
  sent_for_approval_at timestamptz,
  approved_at timestamptz,
  status text not null default 'not_started' check (status in ('not_started','in_work','waiting_on_client','approved','revising','skipped')),
  revision_round int not null default 0,
  revisions_included int not null default 2,
  client_comment text,
  portal_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 7. studio_tasks
create table if not exists public.studio_tasks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  project_id uuid references public.studio_projects(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete set null,
  title text not null,
  description text,
  type text not null default 'task' check (type in ('task','promise','reply_owed','follow_up','admin')),
  status text not null default 'todo' check (status in ('backlog','todo','in_progress','waiting_on_client','in_review','revising','done')),
  priority text not null default 'normal' check (priority in ('urgent','high','normal','low')),
  do_date date,
  due_date timestamptz,
  estimate_hours numeric default 1,
  actual_hours numeric default 0,
  assignee_member_id uuid references public.studio_members(id),
  checklist jsonb not null default '[]'::jsonb,
  source text not null default 'manual' check (source in ('manual','email','whatsapp','website','portal','ai')),
  source_ref text,
  promised_to_contact_id uuid references public.studio_client_contacts(id),
  waiting_on_name text,
  is_in_now boolean not null default false,
  snoozed_until timestamptz,
  completed_at timestamptz,
  portal_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 8. studio_generation_blocks
create table if not exists public.studio_generation_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete set null,
  block_number int not null,
  label text,
  prompt_ref text,
  takes int not null default 0,
  status text not null default 'planned' check (status in ('planned','generating','keeper','rejected')),
  seconds int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 9. studio_time_entries
create table if not exists public.studio_time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.studio_tasks(id) on delete cascade,
  member_id uuid references public.studio_members(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  kind text not null default 'active' check (kind in ('active','pause')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 10. studio_payments
create table if not exists public.studio_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  invoice_no text,
  amount numeric not null default 0,
  currency text not null default 'INR' check (currency in ('INR','USD','EUR')),
  tds_amount numeric default 0,
  sent_at timestamptz,
  due_at date,
  received_at timestamptz,
  status text not null default 'draft' check (status in ('draft','sent','partly_paid','paid','overdue')),
  file_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 11. studio_expenses
create table if not exists public.studio_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.studio_projects(id) on delete set null,
  category text not null check (category in ('ai_subscription','software','freelancer','hardware','office','other')),
  vendor text not null,
  amount numeric not null,
  currency text not null default 'INR',
  paid_on date not null,
  is_company boolean not null default true,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 12. studio_deliverables
create table if not exists public.studio_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete set null,
  title text not null,
  url text not null,
  version text default 'v1',
  shared_with_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 13. studio_inbox_items
create table if not exists public.studio_inbox_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('gmail','whatsapp','website','portal','manual','claude_task')),
  raw_text text not null,
  source_ref text,
  received_at timestamptz not null default now(),
  ai_json jsonb,
  suggested_action text check (suggested_action in ('create_task','create_promise','approve_gate','update_payment','new_lead','reply_owed','update_deadline','ignore')),
  confidence numeric default 0,
  matched_client_id uuid references public.studio_clients(id),
  matched_project_id uuid references public.studio_projects(id),
  status text not null default 'pending' check (status in ('pending','auto_applied','accepted','dismissed')),
  applied_entity_ref text,
  undo_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 14. studio_email_threads & studio_gmail_accounts
create table if not exists public.studio_email_threads (
  id uuid primary key default gen_random_uuid(),
  gmail_account text not null,
  thread_id text not null,
  subject text,
  client_id uuid references public.studio_clients(id),
  project_id uuid references public.studio_projects(id),
  last_from text check (last_from in ('client','studio')),
  last_message_at timestamptz,
  needs_reply boolean not null default false,
  draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

create table if not exists public.studio_gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  refresh_token text,
  last_history_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz
);

-- 15. studio_activity_log, studio_notifications, studio_push_subscriptions
create table if not exists public.studio_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null check (actor in ('member','client','system','ai')),
  actor_name text,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  diff jsonb,
  at timestamptz not null default now()
);

create table if not exists public.studio_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.studio_members(id),
  kind text not null,
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  sent_push boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.studio_members(id),
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable RLS on every Studio OS table
do $$
declare
  t text;
begin
  foreach t in array array[
    'studio_settings','studio_members','studio_clients','studio_client_contacts',
    'studio_projects','studio_gates','studio_tasks','studio_generation_blocks',
    'studio_time_entries','studio_payments','studio_expenses','studio_deliverables',
    'studio_inbox_items','studio_email_threads','studio_gmail_accounts',
    'studio_activity_log','studio_notifications','studio_push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_full_access" on public.%I;', t);
    execute format('create policy "owner_full_access" on public.%I for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());', t);
  end loop;
end $$;

-- Client Portal Read-Only Views (filtered to client_id + portal_visible = true)
create or replace view public.portal_projects as
select
  p.id,
  p.code,
  p.title,
  p.client_id,
  p.type,
  p.status,
  p.hard_deadline,
  p.promised_date,
  p.health,
  p.cover_image_url,
  p.review_link_url,
  p.updated_at
from public.studio_projects p
where p.portal_visible = true
  and p.archived_at is null
  and p.client_id in (
    select c.client_id from public.studio_client_contacts c
    where c.auth_user_id = auth.uid() and c.is_portal_user = true and c.archived_at is null
  );

create or replace view public.portal_gates as
select
  g.id,
  g.project_id,
  g.order_index,
  g.code,
  g.name,
  g.needs_client_approval,
  g.sent_for_approval_at,
  g.approved_at,
  g.status,
  g.revision_round,
  g.revisions_included,
  g.client_comment
from public.studio_gates g
join public.portal_projects p on p.id = g.project_id
where g.portal_visible = true
  and g.archived_at is null;
