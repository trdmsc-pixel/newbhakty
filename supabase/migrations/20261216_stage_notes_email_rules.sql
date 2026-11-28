-- Stage notes + history, and stricter client-email rules.
alter table public.studio_portal_messages
  add column if not exists gate_id uuid references public.studio_gates(id) on delete set null,
  add column if not exists via text not null default 'studio' check (via in ('studio','claude','portal'));
create index if not exists studio_portal_messages_gate on public.studio_portal_messages (gate_id, created_at);

create or replace view public.portal_messages as
select m.id, m.project_id, m.body, m.from_studio,
       case when m.from_studio then 'The Chanting Studio' else m.author_name end as author_name,
       m.created_at, m.read_by_client_at, m.read_by_studio_at, m.delivered_to_studio_at, m.delivered_to_client_at, m.gate_id
from public.studio_portal_messages m
where m.archived_at is null
  and m.client_id in (select public.portal_client_ids());
revoke all on public.portal_messages from public, anon;
grant select on public.portal_messages to authenticated;

-- What a notification points at, so the mailer can re-check it before emailing.
alter table public.studio_portal_notifications
  add column if not exists gate_id uuid,
  add column if not exists ref_id uuid;

drop function if exists public.studio_notify_client(uuid, text, text, text, boolean);
create or replace function public.studio_notify_client(p_project uuid, p_kind text, p_title text, p_body text, p_major boolean, p_gate uuid default null, p_ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_visible boolean;
begin
  select client_id, portal_visible into v_client, v_visible from public.studio_projects where id = p_project and archived_at is null;
  if v_client is null or not coalesce(v_visible, false) then return; end if;
  if not exists (select 1 from public.studio_client_contacts where client_id = v_client and is_portal_user and archived_at is null) then return; end if;
  insert into public.studio_portal_notifications (client_id, project_id, kind, title, body, major, email_status, gate_id, ref_id)
  values (v_client, p_project, p_kind, left(p_title, 200), left(p_body, 600), p_major, case when p_major then 'pending' else 'none' end, p_gate, p_ref);
end $$;
revoke all on function public.studio_notify_client(uuid, text, text, text, boolean, uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_notify_revision() returns trigger language plpgsql security definer set search_path = public as $$
declare v_title text := btrim(regexp_replace(new.title, '^.*? R\d+:\s*', ''));
begin
  if new.source = 'portal' and new.source_ref like 'portal:gate:%' and new.status is distinct from old.status then
    if new.status = 'done' then
      perform public.studio_notify_client(new.project_id, 'revision_addressed', 'Your change was addressed', v_title, false, new.gate_id, new.id);
    elsif new.status in ('in_progress','revising') and old.status in ('todo','backlog') then
      perform public.studio_notify_client(new.project_id, 'revision_started', 'Working on your change', v_title, false, new.gate_id, new.id);
    end if;
  end if;
  return new;
end $$;

-- Stage changes: only "sent for review" is emailed; everything else is an in-portal ping only.
create or replace function public.trg_notify_gate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.portal_visible then
    if new.status = 'waiting_on_client' then
      perform public.studio_notify_client(new.project_id, 'review_ready', new.name || ' is ready for your review', 'Open the project to approve or request changes.', true, new.id, null);
    elsif new.status = 'in_work' and old.status = 'not_started' then
      perform public.studio_notify_client(new.project_id, 'stage_started', new.name || ' has started', null, false, new.id, null);
    elsif new.status = 'approved' and old.status <> 'waiting_on_client' then
      perform public.studio_notify_client(new.project_id, 'stage_done', new.name || ' is complete', null, false, new.id, null);
    end if;
  end if;
  return new;
end $$;

create or replace function public.trg_notify_deliverable() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.shared_with_client and new.archived_at is null and (tg_op = 'INSERT' or not coalesce(old.shared_with_client, false) or (new.is_final and not coalesce(old.is_final, false))) then
    perform public.studio_notify_client(new.project_id,
      case when new.is_final then 'final_delivery' else 'new_version' end,
      case when new.is_final then 'Final files are ready: ' || new.title else 'New version shared: ' || new.title || coalesce(' ' || new.version, '') end,
      'Open the project in your portal to view it.', true, new.gate_id, new.id);
  end if;
  return new;
end $$;

-- Project status / closing: portal ping only, never an email.
create or replace function public.trg_notify_project() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('active','on_hold','delivered') then
    perform public.studio_notify_client(new.id, 'project_status',
      case new.status when 'active' then new.title || ' is in production' when 'on_hold' then new.title || ' is paused' else new.title || ' has been delivered' end,
      null, false, null, null);
  elsif new.closed_at is not null and old.closed_at is null then
    perform public.studio_notify_client(new.id, 'project_closed', new.title || ' is complete', 'Thank you! Final files stay available in your portal.', false, null, null);
  end if;
  return new;
end $$;

-- Studio messages and stage notes: emailed (you are sending something).
create or replace function public.trg_notify_message() returns trigger language plpgsql security definer set search_path = public as $$
declare v_gate text;
begin
  if new.from_studio then
    select name into v_gate from public.studio_gates where id = new.gate_id;
    insert into public.studio_portal_notifications (client_id, project_id, kind, title, body, major, email_status, gate_id, ref_id)
    values (new.client_id, new.project_id, 'message',
            case when v_gate is not null then 'Note from the studio on ' || v_gate else 'New message from the studio' end,
            left(new.body, 400), true, 'pending', new.gate_id, new.id);
  end if;
  return new;
end $$;

update public.studio_portal_notifications set email_status = 'skipped' where email_status = 'pending' and kind in ('project_status','project_closed','stage_started','stage_done');
