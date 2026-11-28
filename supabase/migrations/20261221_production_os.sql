-- Creative Production OS — additive extension of the Studio OS schema.
-- Studio OS stays the only writer of operational data; clients act only through
-- portal_* SECURITY DEFINER RPCs and read through owner-run, client-filtered views
-- (same pattern as the existing portal_* objects). Nothing is dropped or rewritten.

-- ─────────────────────────────────────────────────────────────── 0. security fix
-- Website media buckets allowed anyone (anon) to insert/update/delete. Site media now
-- lives on GitHub; keep public read, restrict writes to the studio owner.
drop policy if exists "Allow public insert into images" on storage.objects;
drop policy if exists "Allow public update into images" on storage.objects;
drop policy if exists "Allow public delete from images" on storage.objects;
drop policy if exists "Allow public insert into videos" on storage.objects;
drop policy if exists "Allow public update into videos" on storage.objects;
drop policy if exists "Allow public delete from videos" on storage.objects;
drop policy if exists "Admin can upload images" on storage.objects;
drop policy if exists "Admin can update images" on storage.objects;
drop policy if exists "Admin can delete images" on storage.objects;
drop policy if exists "Admin can upload videos" on storage.objects;
drop policy if exists "Admin can update videos" on storage.objects;
drop policy if exists "Admin can delete videos" on storage.objects;
create policy site_media_owner_write on storage.objects for all to authenticated
  using (bucket_id in ('images', 'videos') and public.studio_os_is_owner())
  with check (bucket_id in ('images', 'videos') and public.studio_os_is_owner());

-- ─────────────────────────────────────────────────────────────── 1. helpers
create or replace function public.portal_project_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.portal_projects
$$;
revoke all on function public.portal_project_ids() from public, anon;
grant execute on function public.portal_project_ids() to authenticated;

-- Contact roles: admin · approver · reviewer · finance · viewer (Studio OS sets them).
alter table public.studio_client_contacts add column if not exists portal_role text not null default 'admin';
do $$ begin
  alter table public.studio_client_contacts add constraint studio_client_contacts_portal_role_chk
    check (portal_role in ('admin', 'approver', 'reviewer', 'finance', 'viewer'));
exception when duplicate_object then null; end $$;

create or replace function public.portal_contact_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select portal_role from public.studio_client_contacts where id = public.portal_contact_id()), 'viewer')
$$;
revoke all on function public.portal_contact_role() from public, anon;
grant execute on function public.portal_contact_role() to authenticated;

create or replace function public.portal_require_role(p_roles text[])
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.portal_contact_role() = any (p_roles)) then raise exception 'not_permitted'; end if;
end $$;
revoke all on function public.portal_require_role(text[]) from public, anon, authenticated;

create or replace function public.studio_owner_member()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.studio_members where role = 'owner' and is_active and archived_at is null order by created_at limit 1
$$;
revoke all on function public.studio_owner_member() from public, anon, authenticated;

-- Approve / request changes on stages now need an approving role.
create or replace function public.portal_owned_gate(p_gate_id uuid)
returns studio_gates language plpgsql stable security definer set search_path = public as $$
declare v_gate public.studio_gates%rowtype;
begin
  select g.* into v_gate from public.studio_gates g join public.studio_projects p on p.id = g.project_id
  where g.id = p_gate_id and g.archived_at is null and g.portal_visible = true
    and p.archived_at is null and p.portal_visible = true and p.client_id in (select public.portal_client_ids());
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.portal_contact_role() not in ('admin', 'approver') then raise exception 'not_permitted'; end if;
  return v_gate;
end $$;

-- ─────────────────────────────────────────────────────────────── 2. approvals log
create table if not exists public.studio_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  client_id uuid references public.studio_clients(id) on delete cascade,
  entity_type text not null check (entity_type in ('gate', 'asset', 'deliverable', 'change_request')),
  entity_id uuid not null,
  entity_name text,
  version_id uuid,
  decision text not null check (decision in ('approved', 'changes_requested', 'accepted', 'rejected')),
  comment text,
  contact_id uuid references public.studio_client_contacts(id) on delete set null,
  contact_name text,
  created_at timestamptz not null default now()
);
create index if not exists studio_approvals_project on public.studio_approvals (project_id, created_at desc);
alter table public.studio_approvals enable row level security;
drop policy if exists owner_full_access on public.studio_approvals;
create policy owner_full_access on public.studio_approvals for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists client_read_own on public.studio_approvals;
create policy client_read_own on public.studio_approvals for select to authenticated using (project_id in (select public.portal_project_ids()));

-- Stage approvals / change requests already write studio_activity_log — mirror them into the log.
create or replace function public.trg_activity_to_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gate public.studio_gates%rowtype; v_client uuid;
begin
  if new.actor <> 'client' or new.entity_type <> 'gate' then return new; end if;
  if new.action not like 'approved %' and new.action not like 'requested changes %' then return new; end if;
  select * into v_gate from public.studio_gates where id = new.entity_id;
  if not found then return new; end if;
  select client_id into v_client from public.studio_projects where id = v_gate.project_id;
  insert into public.studio_approvals (project_id, client_id, entity_type, entity_id, entity_name, decision, comment, contact_id, contact_name)
  values (v_gate.project_id, v_client, 'gate', v_gate.id, v_gate.name,
    case when new.action like 'approved %' then 'approved' else 'changes_requested' end,
    new.diff ->> 'comment', public.portal_contact_id(), new.actor_name);
  return new;
end $$;
drop trigger if exists activity_to_approval on public.studio_activity_log;
create trigger activity_to_approval after insert on public.studio_activity_log for each row execute function public.trg_activity_to_approval();

-- ─────────────────────────────────────────────────────────────── 3. files: categories, tags
alter table public.studio_client_uploads add column if not exists category text;
alter table public.studio_client_uploads add column if not exists tags text[] not null default '{}';
alter table public.studio_deliverables add column if not exists category text;
alter table public.studio_deliverables add column if not exists downloadable boolean not null default true;

drop function if exists public.portal_add_upload(uuid, text, text, bigint, text, text);
create or replace function public.portal_add_upload(p_project uuid, p_name text, p_path text, p_size bigint, p_mime text, p_note text default null, p_category text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_id uuid; v_contact text; v_title text; v_code text;
begin
  select p.client_id, p.title, p.code into v_client, v_title, v_code from public.portal_projects p where p.id = p_project;
  if v_client is null then raise exception 'not_found'; end if;
  if split_part(p_path, '/', 1) <> v_client::text then raise exception 'bad_path'; end if;
  if public.portal_contact_role() = 'viewer' then raise exception 'not_permitted'; end if;
  select name into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  insert into public.studio_client_uploads (client_id, project_id, contact_name, name, path, size, mime, note, category)
  values (v_client, p_project, v_contact, left(p_name, 200), p_path, p_size, left(p_mime, 120), left(p_note, 1000), left(p_category, 40)) returning id into v_id;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_upload', coalesce(v_code || ' — ', '') || coalesce(v_contact, 'Client') || ' uploaded ' || left(p_name, 80),
    coalesce(v_title, '') || coalesce(' — ' || p_note, ''), '/studio-os?project=' || p_project || '&tab=files&focus=upload:' || v_id);
  insert into public.studio_activity_log (actor, actor_name, entity_type, entity_id, action, diff)
  values ('client', coalesce(v_contact, 'Client'), 'upload', v_id, 'uploaded ' || left(p_name, 80), json_build_object('project_id', p_project)::jsonb);
  return v_id;
end $$;
revoke all on function public.portal_add_upload(uuid, text, text, bigint, text, text, text) from public, anon;
grant execute on function public.portal_add_upload(uuid, text, text, bigint, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────── 4. tasks: responsibility, subtasks, deps
alter table public.studio_tasks add column if not exists responsibility text not null default 'studio';
alter table public.studio_tasks add column if not exists parent_task_id uuid references public.studio_tasks(id) on delete set null;
alter table public.studio_tasks add column if not exists depends_on uuid[] not null default '{}';
do $$ begin
  alter table public.studio_tasks add constraint studio_tasks_responsibility_chk check (responsibility in ('studio', 'client'));
exception when duplicate_object then null; end $$;

create or replace view public.portal_tasks as
  select t.id, t.project_id, t.title, t.status, t.due_date, t.completed_at, t.updated_at,
         t.responsibility, t.description, t.parent_task_id, t.priority
  from public.studio_tasks t join public.portal_projects p on p.id = t.project_id
  where t.portal_visible = true and t.archived_at is null;

create or replace function public.portal_complete_task(p_task uuid, p_done boolean default true, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_task public.studio_tasks%rowtype; v_contact text; v_code text;
begin
  select t.* into v_task from public.studio_tasks t
  where t.id = p_task and t.portal_visible and t.archived_at is null and t.responsibility = 'client'
    and t.project_id in (select public.portal_project_ids());
  if not found then raise exception 'not_found'; end if;
  if public.portal_contact_role() = 'viewer' then raise exception 'not_permitted'; end if;
  select name into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  select code into v_code from public.studio_projects where id = v_task.project_id;
  update public.studio_tasks set status = case when p_done then 'done' else 'todo' end,
    completed_at = case when p_done then now() else null end, updated_at = now() where id = p_task;
  insert into public.studio_activity_log (actor, actor_name, entity_type, entity_id, action, diff)
  values ('client', coalesce(v_contact, 'Client'), 'task', p_task, case when p_done then 'completed ' else 'reopened ' end || v_task.title,
    json_build_object('note', left(p_note, 500), 'project_id', v_task.project_id)::jsonb);
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_task', coalesce(v_code || ' — ', '') || coalesce(v_contact, 'Client') || case when p_done then ' completed: ' else ' reopened: ' end || left(v_task.title, 100),
    left(p_note, 240), '/studio-os?project=' || v_task.project_id || '&tab=tasks');
end $$;
revoke all on function public.portal_complete_task(uuid, boolean, text) from public, anon;
grant execute on function public.portal_complete_task(uuid, boolean, text) to authenticated;

-- ─────────────────────────────────────────────────────────────── 5. production tracker (shots)
create table if not exists public.studio_shots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  gate_id uuid references public.studio_gates(id) on delete set null,
  episode int,
  sequence text,
  scene text,
  shot_code text not null,
  title text,
  description text,
  camera_angle text,
  camera_move text,
  duration_s numeric,
  status text not null default 'not_started' check (status in ('not_started', 'in_development', 'in_production', 'generating', 'post_production', 'internal_review', 'client_review', 'revision_requested', 'approved', 'completed', 'blocked')),
  preview_deliverable_id uuid references public.studio_deliverables(id) on delete set null,
  final_deliverable_id uuid references public.studio_deliverables(id) on delete set null,
  preview_url text,
  assignee_member_id uuid references public.studio_members(id) on delete set null,
  internal_notes text,
  sort int not null default 0,
  portal_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_shots_project on public.studio_shots (project_id, episode, sequence, scene, sort);
alter table public.studio_shots enable row level security;
drop policy if exists owner_full_access on public.studio_shots;
create policy owner_full_access on public.studio_shots for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop trigger if exists studio_shots_updated on public.studio_shots;
create trigger studio_shots_updated before update on public.studio_shots for each row execute function public.studio_os_set_updated_at();

-- Clients see a simplified status and never internal notes or failed experiments.
create or replace view public.portal_shots as
  select s.id, s.project_id, s.episode, s.sequence, s.scene, s.shot_code, s.title, s.description,
         s.camera_angle, s.camera_move, s.duration_s, s.sort, s.updated_at,
         case
           when s.status in ('not_started') then 'not_started'
           when s.status in ('in_development', 'in_production', 'generating', 'post_production', 'internal_review', 'blocked') then 'in_production'
           when s.status = 'client_review' then 'in_review'
           when s.status = 'revision_requested' then 'revising'
           else 'approved'
         end as client_status,
         case when s.status in ('client_review', 'revision_requested', 'approved', 'completed') then coalesce(pd.url, s.preview_url) end as preview_url,
         case when s.status in ('approved', 'completed') then fd.url end as final_url
  from public.studio_shots s
  join public.portal_projects p on p.id = s.project_id
  left join public.studio_deliverables pd on pd.id = s.preview_deliverable_id and pd.shared_with_client
  left join public.studio_deliverables fd on fd.id = s.final_deliverable_id and fd.shared_with_client
  where s.portal_visible and s.archived_at is null;

create or replace function public.portal_review_shot(p_shot uuid, p_approve boolean, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_shot public.studio_shots%rowtype; v_contact text; v_code text; v_client uuid;
begin
  select s.* into v_shot from public.studio_shots s where s.id = p_shot and s.portal_visible and s.archived_at is null
    and s.project_id in (select public.portal_project_ids());
  if not found then raise exception 'not_found'; end if;
  if v_shot.status <> 'client_review' then raise exception 'not_awaiting_review'; end if;
  if public.portal_contact_role() not in ('admin', 'approver') then raise exception 'not_permitted'; end if;
  if not p_approve and length(btrim(coalesce(p_comment, ''))) < 2 then raise exception 'comment_required'; end if;
  select name into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  select code, client_id into v_code, v_client from public.studio_projects where id = v_shot.project_id;
  update public.studio_shots set status = case when p_approve then 'approved' else 'revision_requested' end where id = p_shot;
  insert into public.studio_approvals (project_id, client_id, entity_type, entity_id, entity_name, version_id, decision, comment, contact_id, contact_name)
  values (v_shot.project_id, v_client, 'deliverable', v_shot.id, 'Shot ' || v_shot.shot_code, v_shot.preview_deliverable_id,
    case when p_approve then 'approved' else 'changes_requested' end, left(p_comment, 2000), public.portal_contact_id(), v_contact);
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_approval', coalesce(v_code || ' — ', '') || 'Shot ' || v_shot.shot_code || case when p_approve then ' approved' else ' — changes requested' end,
    left(p_comment, 240), '/studio-os?project=' || v_shot.project_id || '&tab=production&focus=shot:' || p_shot);
end $$;
revoke all on function public.portal_review_shot(uuid, boolean, text) from public, anon;
grant execute on function public.portal_review_shot(uuid, boolean, text) to authenticated;

-- ─────────────────────────────────────────────────────────────── 6. creative hub + visual bible
create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  kind text not null check (kind in ('character', 'environment', 'costume', 'prop', 'vehicle', 'brand', 'background', 'palette', 'cinematography',
    'brief', 'concept', 'treatment', 'script', 'screenplay', 'storyboard', 'shot_list', 'moodboard', 'art_direction', 'vo_script', 'music_ref')),
  name text not null,
  description text,
  details jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'changes_requested', 'locked')),
  current_version_id uuid,
  approved_version_id uuid,
  downloadable boolean not null default false,
  portal_visible boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_assets_project on public.studio_assets (project_id, kind, sort);
create table if not exists public.studio_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.studio_assets(id) on delete cascade,
  version int not null default 1,
  label text,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_asset_versions_asset on public.studio_asset_versions (asset_id, version desc);
create table if not exists public.studio_shot_assets (
  shot_id uuid not null references public.studio_shots(id) on delete cascade,
  asset_id uuid not null references public.studio_assets(id) on delete cascade,
  primary key (shot_id, asset_id)
);
alter table public.studio_assets enable row level security;
alter table public.studio_asset_versions enable row level security;
alter table public.studio_shot_assets enable row level security;
drop policy if exists owner_full_access on public.studio_assets;
create policy owner_full_access on public.studio_assets for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists owner_full_access on public.studio_asset_versions;
create policy owner_full_access on public.studio_asset_versions for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists owner_full_access on public.studio_shot_assets;
create policy owner_full_access on public.studio_shot_assets for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop trigger if exists studio_assets_updated on public.studio_assets;
create trigger studio_assets_updated before update on public.studio_assets for each row execute function public.studio_os_set_updated_at();

create or replace view public.portal_assets as
  select a.id, a.project_id, a.kind, a.name, a.description, a.details, a.status, a.current_version_id, a.approved_version_id,
         a.downloadable, a.sort, a.updated_at,
         (select array_agg(sa.shot_id) from public.studio_shot_assets sa where sa.asset_id = a.id) as shot_ids
  from public.studio_assets a join public.portal_projects p on p.id = a.project_id
  where a.portal_visible and a.archived_at is null and a.status <> 'draft';
create or replace view public.portal_asset_versions as
  select v.id, v.asset_id, v.version, v.label, v.url, v.notes, v.created_at
  from public.studio_asset_versions v join public.portal_assets a on a.id = v.asset_id
  where v.archived_at is null;

create or replace function public.portal_review_asset(p_asset uuid, p_version uuid, p_approve boolean, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_asset public.studio_assets%rowtype; v_contact text; v_code text; v_client uuid;
begin
  select a.* into v_asset from public.studio_assets a where a.id = p_asset and a.portal_visible and a.archived_at is null
    and a.project_id in (select public.portal_project_ids());
  if not found then raise exception 'not_found'; end if;
  if v_asset.status <> 'in_review' then raise exception 'not_awaiting_review'; end if;
  if public.portal_contact_role() not in ('admin', 'approver') then raise exception 'not_permitted'; end if;
  if p_version is not null and not exists (select 1 from public.studio_asset_versions where id = p_version and asset_id = p_asset) then raise exception 'bad_version'; end if;
  if not p_approve and length(btrim(coalesce(p_comment, ''))) < 2 then raise exception 'comment_required'; end if;
  select name into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  select code, client_id into v_code, v_client from public.studio_projects where id = v_asset.project_id;
  update public.studio_assets set status = case when p_approve then 'approved' else 'changes_requested' end,
    approved_version_id = case when p_approve then coalesce(p_version, current_version_id) else approved_version_id end
  where id = p_asset;
  insert into public.studio_approvals (project_id, client_id, entity_type, entity_id, entity_name, version_id, decision, comment, contact_id, contact_name)
  values (v_asset.project_id, v_client, 'asset', p_asset, v_asset.name, coalesce(p_version, v_asset.current_version_id),
    case when p_approve then 'approved' else 'changes_requested' end, left(p_comment, 2000), public.portal_contact_id(), v_contact);
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_approval', coalesce(v_code || ' — ', '') || v_asset.name || case when p_approve then ' approved' else ' — changes requested' end,
    left(p_comment, 240), '/studio-os?project=' || v_asset.project_id || '&tab=assets&focus=asset:' || p_asset);
end $$;
revoke all on function public.portal_review_asset(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.portal_review_asset(uuid, uuid, boolean, text) to authenticated;

-- Studio sending an asset for review rings the client (same notification engine).
create or replace function public.trg_notify_asset()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.portal_visible and new.status = 'in_review' and (tg_op = 'INSERT' or old.status is distinct from 'in_review' or old.current_version_id is distinct from new.current_version_id) then
    perform public.studio_notify_client(new.project_id, 'review_ready', new.name || ' is ready for your review', coalesce(new.description, ''), true, null, null);
  end if;
  return new;
end $$;
drop trigger if exists notify_asset on public.studio_assets;
create trigger notify_asset after insert or update on public.studio_assets for each row execute function public.trg_notify_asset();

-- ─────────────────────────────────────────────────────────────── 7. timecoded review comments
create table if not exists public.studio_review_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  deliverable_id uuid not null references public.studio_deliverables(id) on delete cascade,
  parent_id uuid references public.studio_review_comments(id) on delete cascade,
  timecode numeric,
  frame_path text,
  body text not null,
  from_studio boolean not null default false,
  contact_id uuid references public.studio_client_contacts(id) on delete set null,
  author_name text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_review_comments_deliv on public.studio_review_comments (deliverable_id, timecode, created_at);
alter table public.studio_review_comments enable row level security;
drop policy if exists owner_full_access on public.studio_review_comments;
create policy owner_full_access on public.studio_review_comments for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists client_read_own on public.studio_review_comments;
create policy client_read_own on public.studio_review_comments for select to authenticated
  using (archived_at is null and deliverable_id in (select id from public.portal_deliverables));

create or replace function public.portal_add_review_comment(p_deliverable uuid, p_body text, p_timecode numeric default null, p_parent uuid default null, p_frame_path text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_d record; v_contact public.studio_client_contacts%rowtype; v_id uuid; v_code text; v_body text := left(btrim(coalesce(p_body, '')), 4000);
begin
  if length(v_body) < 1 then raise exception 'comment_required'; end if;
  select id, project_id, title, version into v_d from public.portal_deliverables where id = p_deliverable;
  if v_d.id is null then raise exception 'not_found'; end if;
  if public.portal_contact_role() in ('viewer', 'finance') then raise exception 'not_permitted'; end if;
  if p_parent is not null and not exists (select 1 from public.studio_review_comments where id = p_parent and deliverable_id = p_deliverable) then raise exception 'bad_parent'; end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  if p_frame_path is not null and split_part(p_frame_path, '/', 1) <> v_contact.client_id::text then raise exception 'bad_path'; end if;
  insert into public.studio_review_comments (project_id, deliverable_id, parent_id, timecode, frame_path, body, from_studio, contact_id, author_name)
  values (v_d.project_id, p_deliverable, p_parent, p_timecode, p_frame_path, v_body, false, v_contact.id, v_contact.name) returning id into v_id;
  select code into v_code from public.studio_projects where id = v_d.project_id;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_comment',
    coalesce(v_code || ' — ', '') || coalesce(v_contact.name, 'Client') || ' commented on ' || left(v_d.title, 60) ||
      coalesce(' at ' || to_char(make_interval(secs => p_timecode), 'MI:SS'), ''),
    left(v_body, 240), '/studio-os?project=' || v_d.project_id || '&tab=files&focus=deliverable:' || p_deliverable);
  return v_id;
end $$;
revoke all on function public.portal_add_review_comment(uuid, text, numeric, uuid, text) from public, anon;
grant execute on function public.portal_add_review_comment(uuid, text, numeric, uuid, text) to authenticated;

create or replace function public.portal_resolve_review_comment(p_comment uuid, p_resolved boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.portal_contact_role() in ('viewer', 'finance') then raise exception 'not_permitted'; end if;
  update public.studio_review_comments set resolved_at = case when p_resolved then now() else null end
  where id = p_comment and deliverable_id in (select id from public.portal_deliverables);
  if not found then raise exception 'not_found'; end if;
end $$;
revoke all on function public.portal_resolve_review_comment(uuid, boolean) from public, anon;
grant execute on function public.portal_resolve_review_comment(uuid, boolean) to authenticated;

create or replace function public.trg_notify_review_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if new.from_studio then
    select title into v_title from public.studio_deliverables where id = new.deliverable_id;
    perform public.studio_notify_client(new.project_id, 'comment_reply', 'The studio replied on ' || coalesce(v_title, 'your review'), left(new.body, 300), false, null, new.deliverable_id);
  end if;
  return new;
end $$;
drop trigger if exists notify_review_reply on public.studio_review_comments;
create trigger notify_review_reply after insert on public.studio_review_comments for each row execute function public.trg_notify_review_reply();

-- ─────────────────────────────────────────────────────────────── 8. messages: threads, kinds, attachments
alter table public.studio_portal_messages add column if not exists parent_id uuid references public.studio_portal_messages(id) on delete set null;
alter table public.studio_portal_messages add column if not exists kind text not null default 'message';
alter table public.studio_portal_messages add column if not exists subject text;
alter table public.studio_portal_messages add column if not exists attachments jsonb not null default '[]';
do $$ begin
  alter table public.studio_portal_messages add constraint studio_portal_messages_kind_chk check (kind in ('message', 'announcement', 'meeting_note'));
exception when duplicate_object then null; end $$;

create or replace view public.portal_messages as
  select id, project_id, body,
    from_studio,
    case when from_studio then 'The Chanting Studio'::text else author_name end as author_name,
    created_at, read_by_client_at, read_by_studio_at, delivered_to_studio_at, delivered_to_client_at, gate_id,
    parent_id, kind, subject, attachments
  from public.studio_portal_messages m
  where archived_at is null and client_id in (select public.portal_client_ids());

create or replace function public.portal_send_thread_message(p_body text, p_project_id uuid default null, p_subject text default null, p_parent uuid default null, p_attachments jsonb default '[]')
returns json language plpgsql security definer set search_path = public as $$
declare
  v_contact public.studio_client_contacts%rowtype;
  v_body text := left(btrim(coalesce(p_body, '')), 8000);
  v_code text; v_id uuid; v_att jsonb := coalesce(p_attachments, '[]'::jsonb); v_a jsonb;
begin
  if length(v_body) < 1 and jsonb_array_length(v_att) = 0 then raise exception 'message_required'; end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  if not found then raise exception 'not_a_portal_user'; end if;
  if p_project_id is not null then
    select code into v_code from public.portal_projects where id = p_project_id;
    if v_code is null then raise exception 'project_not_found'; end if;
  end if;
  if p_parent is not null and not exists (select 1 from public.studio_portal_messages where id = p_parent and client_id = v_contact.client_id) then raise exception 'bad_parent'; end if;
  if jsonb_typeof(v_att) <> 'array' or jsonb_array_length(v_att) > 10 then raise exception 'bad_attachments'; end if;
  for v_a in select * from jsonb_array_elements(v_att) loop
    if split_part(coalesce(v_a ->> 'path', ''), '/', 1) <> v_contact.client_id::text then raise exception 'bad_path'; end if;
  end loop;
  if (select count(*) from public.studio_portal_messages where contact_id = v_contact.id and created_at > now() - interval '1 hour') >= 20 then raise exception 'rate_limited'; end if;
  insert into public.studio_portal_messages (client_id, contact_id, project_id, body, from_studio, author_name, subject, parent_id, attachments)
  values (v_contact.client_id, v_contact.id, p_project_id, v_body, false, v_contact.name, left(p_subject, 200), p_parent, v_att)
  returning id into v_id;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_message',
    coalesce(v_code || ' — ', '') || coalesce(left(p_subject, 80), 'Message from ' || coalesce(v_contact.name, 'a client')),
    left(v_body, 240), case when p_project_id is not null then '/studio-os?project=' || p_project_id || '&tab=emails' else '/studio-os?client=' || v_contact.client_id end);
  return json_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.portal_send_thread_message(text, uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.portal_send_thread_message(text, uuid, text, uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────── 9. change requests
create table if not exists public.studio_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  client_id uuid not null references public.studio_clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'proposed', 'accepted', 'rejected', 'withdrawn', 'done')),
  proposed_amount numeric,
  currency text,
  proposed_days int,
  proposal_note text,
  contact_id uuid references public.studio_client_contacts(id) on delete set null,
  contact_name text,
  client_comment text,
  proposed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_change_requests_project on public.studio_change_requests (project_id, created_at desc);
alter table public.studio_change_requests enable row level security;
drop policy if exists owner_full_access on public.studio_change_requests;
create policy owner_full_access on public.studio_change_requests for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists client_read_own on public.studio_change_requests;
create policy client_read_own on public.studio_change_requests for select to authenticated
  using (archived_at is null and project_id in (select public.portal_project_ids()));
drop trigger if exists studio_change_requests_updated on public.studio_change_requests;
create trigger studio_change_requests_updated before update on public.studio_change_requests for each row execute function public.studio_os_set_updated_at();

create or replace function public.portal_submit_change_request(p_project uuid, p_title text, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_contact public.studio_client_contacts%rowtype; v_code text; v_id uuid;
begin
  if length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'title_required'; end if;
  select code into v_code from public.portal_projects where id = p_project;
  if v_code is null then raise exception 'not_found'; end if;
  if public.portal_contact_role() not in ('admin', 'approver') then raise exception 'not_permitted'; end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  insert into public.studio_change_requests (project_id, client_id, title, description, contact_id, contact_name)
  values (p_project, v_contact.client_id, left(btrim(p_title), 200), left(p_description, 4000), v_contact.id, v_contact.name) returning id into v_id;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_change_request', v_code || ' — change request: ' || left(p_title, 100),
    left(p_description, 240), '/studio-os?project=' || p_project || '&tab=changes&focus=cr:' || v_id);
  insert into public.studio_activity_log (actor, actor_name, entity_type, entity_id, action, diff)
  values ('client', coalesce(v_contact.name, 'Client'), 'change_request', v_id, 'submitted change request ' || left(p_title, 80), json_build_object('project_id', p_project)::jsonb);
  return v_id;
end $$;
revoke all on function public.portal_submit_change_request(uuid, text, text) from public, anon;
grant execute on function public.portal_submit_change_request(uuid, text, text) to authenticated;

create or replace function public.portal_decide_change_request(p_id uuid, p_accept boolean, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cr public.studio_change_requests%rowtype; v_contact public.studio_client_contacts%rowtype; v_code text;
begin
  select * into v_cr from public.studio_change_requests where id = p_id and archived_at is null and project_id in (select public.portal_project_ids());
  if not found then raise exception 'not_found'; end if;
  if v_cr.status <> 'proposed' then raise exception 'no_proposal'; end if;
  if public.portal_contact_role() not in ('admin', 'approver') then raise exception 'not_permitted'; end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  select code into v_code from public.studio_projects where id = v_cr.project_id;
  update public.studio_change_requests set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now(), client_comment = left(p_comment, 2000) where id = p_id;
  insert into public.studio_approvals (project_id, client_id, entity_type, entity_id, entity_name, decision, comment, contact_id, contact_name)
  values (v_cr.project_id, v_cr.client_id, 'change_request', p_id, v_cr.title, case when p_accept then 'accepted' else 'rejected' end, left(p_comment, 2000), v_contact.id, v_contact.name);
  -- Never touches invoices or dates: the studio gets a task to update scope/fees by hand.
  if p_accept then
    insert into public.studio_tasks (key, project_id, title, description, type, status, priority, assignee_member_id, source, source_ref, portal_visible)
    values (public.portal_next_task_key(v_cr.project_id), v_cr.project_id, left('Update scope & invoice: ' || v_cr.title, 160),
      'Client accepted change proposal' || coalesce(' — ' || v_cr.currency || ' ' || v_cr.proposed_amount, '') || coalesce(', +' || v_cr.proposed_days || ' days', '') || '. Update fees, invoice and dates manually.',
      'task', 'todo', 'high', public.studio_owner_member(), 'portal', 'portal:cr:' || p_id, false);
  end if;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (public.studio_owner_member(), 'portal_change_request', v_code || ' — change proposal ' || case when p_accept then 'accepted' else 'declined' end || ': ' || left(v_cr.title, 80),
    left(p_comment, 240), '/studio-os?project=' || v_cr.project_id || '&tab=changes&focus=cr:' || p_id);
end $$;
revoke all on function public.portal_decide_change_request(uuid, boolean, text) from public, anon;
grant execute on function public.portal_decide_change_request(uuid, boolean, text) to authenticated;

create or replace function public.trg_notify_change_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'proposed' and old.status is distinct from 'proposed' then
    perform public.studio_notify_client(new.project_id, 'message', 'Proposal ready: ' || new.title,
      coalesce(new.proposal_note, 'Please review the cost and timeline for your requested change.'), true, null, null);
  end if;
  return new;
end $$;
drop trigger if exists notify_change_proposal on public.studio_change_requests;
create trigger notify_change_proposal after update on public.studio_change_requests for each row execute function public.trg_notify_change_proposal();

-- ─────────────────────────────────────────────────────────────── 10. finance visibility by role
create or replace view public.portal_invoices as
  select i.id, i.project_id, i.invoice_no, i.amount, i.currency, i.tds_amount,
    case when i.status <> 'paid' and i.due_at is not null and i.due_at < current_date then 'overdue' else i.status end as status,
    i.sent_at, i.due_at, i.received_at, i.file_url
  from public.studio_payments i join public.portal_projects p on p.id = i.project_id
  where i.status <> 'draft' and i.archived_at is null and public.portal_contact_role() in ('admin', 'finance');

-- ─────────────────────────────────────────────────────────────── 11. notification kinds per client
alter table public.studio_clients add column if not exists email_kinds text[];
create or replace function public.portal_set_email_kinds(p_kinds text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.portal_contact_role() <> 'admin' then raise exception 'not_permitted'; end if;
  update public.studio_clients set email_kinds = (select array_agg(k) from unnest(p_kinds) k where k in ('review_ready', 'new_version', 'final_delivery', 'message'))
  where id in (select public.portal_client_ids());
end $$;
revoke all on function public.portal_set_email_kinds(text[]) from public, anon;
grant execute on function public.portal_set_email_kinds(text[]) to authenticated;
create or replace function public.portal_me()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('role', public.portal_contact_role(), 'email_kinds', (select email_kinds from public.studio_clients where id in (select public.portal_client_ids()) limit 1))
$$;
revoke all on function public.portal_me() from public, anon;
grant execute on function public.portal_me() to authenticated;

-- ─────────────────────────────────────────────────────────────── 12. deliverables view (category / download flag)
create or replace view public.portal_deliverables as
  select d.id, d.project_id, d.gate_id, d.title, d.url, d.version, d.created_at, d.is_final,
         case when d.downloadable then d.download_url end as download_url, d.client_summary, d.category, d.downloadable
  from public.studio_deliverables d join public.portal_projects p on p.id = d.project_id
  where d.shared_with_client = true and d.archived_at is null;

-- Views are read through the authenticated role only.
revoke all on public.portal_shots, public.portal_assets, public.portal_asset_versions from anon, public;
grant select on public.portal_shots, public.portal_assets, public.portal_asset_versions, public.portal_tasks, public.portal_messages, public.portal_invoices, public.portal_deliverables to authenticated;

-- Realtime for the new studio-side tables.
do $$ begin
  alter publication supabase_realtime add table public.studio_review_comments, public.studio_change_requests, public.studio_approvals, public.studio_shots, public.studio_assets;
exception when others then null; end $$;
