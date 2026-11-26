-- 1) Client revision requests as live, client-visible items (title/status only).
-- 2) Client notification centre (bell + chime in the portal), fed by triggers.
-- 3) Major notifications are emailed by the server (email_status = 'pending').

create or replace view public.portal_revisions as
 SELECT t.id, t.project_id, t.gate_id,
    btrim(regexp_replace(t.title, '^.*? R\d+:\s*', '')) AS title,
    COALESCE(NULLIF(substring(t.source_ref from ':r(\d+)$'), '')::int, 1) AS round,
    t.status, t.completed_at, t.created_at, t.updated_at
   FROM studio_tasks t
   JOIN portal_projects p ON p.id = t.project_id
  WHERE t.source = 'portal' AND t.source_ref LIKE 'portal:gate:%' AND t.archived_at IS NULL;
revoke all on public.portal_revisions from public, anon;
grant select on public.portal_revisions to authenticated;

create table if not exists public.studio_portal_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  major boolean not null default false,
  email_status text not null default 'none' check (email_status in ('none','pending','sent','failed','skipped')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists studio_portal_notifications_client on public.studio_portal_notifications (client_id, created_at desc);
create index if not exists studio_portal_notifications_email on public.studio_portal_notifications (email_status) where email_status = 'pending';
alter table public.studio_portal_notifications enable row level security;
drop policy if exists owner_full_access on public.studio_portal_notifications;
create policy owner_full_access on public.studio_portal_notifications for all to authenticated
  using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists client_read_own on public.studio_portal_notifications;
create policy client_read_own on public.studio_portal_notifications for select to authenticated
  using (client_id in (select public.portal_client_ids()));

create or replace function public.portal_mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.studio_portal_notifications set read_at = now()
  where read_at is null and client_id in (select public.portal_client_ids());
$$;
revoke all on function public.portal_mark_notifications_read() from public, anon;
grant execute on function public.portal_mark_notifications_read() to authenticated;

-- Helper: notify a project's client (only for portal-visible projects).
create or replace function public.studio_notify_client(p_project uuid, p_kind text, p_title text, p_body text, p_major boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_visible boolean;
begin
  select client_id, portal_visible into v_client, v_visible from public.studio_projects where id = p_project and archived_at is null;
  if v_client is null or not coalesce(v_visible, false) then return; end if;
  if not exists (select 1 from public.studio_client_contacts where client_id = v_client and is_portal_user and archived_at is null) then return; end if;
  insert into public.studio_portal_notifications (client_id, project_id, kind, title, body, major, email_status)
  values (v_client, p_project, p_kind, left(p_title, 200), left(p_body, 600), p_major, case when p_major then 'pending' else 'none' end);
end $$;
revoke all on function public.studio_notify_client(uuid, text, text, text, boolean) from public, anon, authenticated;

-- Revision addressed / reopened.
create or replace function public.trg_notify_revision() returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text := btrim(regexp_replace(new.title, '^.*? R\d+:\s*', ''));
begin
  if new.source = 'portal' and new.source_ref like 'portal:gate:%' and new.status is distinct from old.status then
    if new.status = 'done' then
      perform public.studio_notify_client(new.project_id, 'revision_addressed', 'Your change was addressed', v_title, false);
    elsif new.status in ('in_progress','revising') and old.status in ('todo','backlog') then
      perform public.studio_notify_client(new.project_id, 'revision_started', 'Working on your change', v_title, false);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_revision on public.studio_tasks;
create trigger notify_revision after update of status on public.studio_tasks for each row execute function public.trg_notify_revision();

-- Stage status changes (ready for review = major → email).
create or replace function public.trg_notify_gate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.portal_visible then
    if new.status = 'waiting_on_client' then
      perform public.studio_notify_client(new.project_id, 'review_ready', new.name || ' is ready for your review', 'Open the project to approve or request changes.', true);
    elsif new.status = 'in_work' and old.status = 'not_started' then
      perform public.studio_notify_client(new.project_id, 'stage_started', new.name || ' has started', null, false);
    elsif new.status = 'approved' and old.status <> 'waiting_on_client' then
      perform public.studio_notify_client(new.project_id, 'stage_done', new.name || ' is complete', null, false);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_gate on public.studio_gates;
create trigger notify_gate after update of status on public.studio_gates for each row execute function public.trg_notify_gate();

-- New shared version / final delivery (major → email).
create or replace function public.trg_notify_deliverable() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared_with_client and new.archived_at is null and (tg_op = 'INSERT' or not coalesce(old.shared_with_client, false) or (new.is_final and not coalesce(old.is_final, false))) then
    perform public.studio_notify_client(new.project_id,
      case when new.is_final then 'final_delivery' else 'new_version' end,
      case when new.is_final then 'Final files are ready: ' || new.title else 'New version shared: ' || new.title || coalesce(' ' || new.version, '') end,
      'Open the project in your portal to view it.', true);
  end if;
  return new;
end $$;
drop trigger if exists notify_deliverable on public.studio_deliverables;
create trigger notify_deliverable after insert or update of shared_with_client, is_final on public.studio_deliverables for each row execute function public.trg_notify_deliverable();

-- Project status updates.
create or replace function public.trg_notify_project() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('active','on_hold','delivered') then
    perform public.studio_notify_client(new.id, 'project_status',
      case new.status when 'active' then new.title || ' is in production' when 'on_hold' then new.title || ' is paused' else new.title || ' has been delivered' end,
      null, new.status = 'delivered');
  elsif new.closed_at is not null and old.closed_at is null then
    perform public.studio_notify_client(new.id, 'project_closed', new.title || ' is complete', 'Thank you! Final files stay available in your portal.', true);
  end if;
  return new;
end $$;
drop trigger if exists notify_project on public.studio_projects;
create trigger notify_project after update of status, closed_at on public.studio_projects for each row execute function public.trg_notify_project();

-- Studio messages.
create or replace function public.trg_notify_message() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.from_studio then
    insert into public.studio_portal_notifications (client_id, project_id, kind, title, body)
    values (new.client_id, new.project_id, 'message', 'New message from the studio', left(new.body, 240));
  end if;
  return new;
end $$;
drop trigger if exists notify_message on public.studio_portal_messages;
create trigger notify_message after insert on public.studio_portal_messages for each row execute function public.trg_notify_message();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_portal_notifications') then
    alter publication supabase_realtime add table public.studio_portal_notifications;
  end if;
end $$;
