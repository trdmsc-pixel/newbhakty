-- AI insights (cached so nothing is generated twice), client sketches on frames,
-- client-visible "what changed" summaries, and SEO metadata for site media.

create table if not exists public.studio_ai_insights (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('shot_log','note_check','change_summary','scope_check','daily_brief','media_meta')),
  project_id uuid references public.studio_projects(id) on delete cascade,
  deliverable_id uuid references public.studio_deliverables(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete cascade,
  day date,
  result jsonb not null,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists studio_ai_insights_lookup on public.studio_ai_insights (kind, deliverable_id, created_at desc);
create index if not exists studio_ai_insights_day on public.studio_ai_insights (kind, day desc);
alter table public.studio_ai_insights enable row level security;
drop policy if exists owner_full_access on public.studio_ai_insights;
create policy owner_full_access on public.studio_ai_insights for all to authenticated
  using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());

-- Client sketches drawn on a paused frame in the portal.
create table if not exists public.studio_review_sketches (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid references public.studio_deliverables(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete cascade,
  client_id uuid references public.studio_clients(id) on delete cascade,
  contact_id uuid references public.studio_client_contacts(id) on delete set null,
  timecode numeric,
  image_data text not null check (length(image_data) < 600000),
  comment text,
  ai_note text,
  created_at timestamptz not null default now()
);
create index if not exists studio_review_sketches_gate on public.studio_review_sketches (gate_id, created_at);
alter table public.studio_review_sketches enable row level security;
drop policy if exists owner_full_access on public.studio_review_sketches;
create policy owner_full_access on public.studio_review_sketches for all to authenticated
  using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());

-- Client-facing "what changed in this version" text.
alter table public.studio_deliverables add column if not exists client_summary text;

create or replace view public.portal_deliverables as
 SELECT d.id, d.project_id, d.gate_id, d.title, d.url, d.version, d.created_at,
    d.is_final, d.download_url, d.client_summary
   FROM studio_deliverables d
   JOIN portal_projects p ON p.id = d.project_id
  WHERE d.shared_with_client = true AND d.archived_at IS NULL;

-- SEO metadata for uploaded site media (admin).
alter table public.media_assets
  add column if not exists alt_text text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists tags text[];
grant select (client_summary) on public.studio_deliverables to authenticated;
