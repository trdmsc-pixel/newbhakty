-- ============================================================================
-- Studio OS — Phase 4: Client Access Portal
-- Client-only read views + approval RPCs. Base studio_* tables stay owner-only
-- (RLS from Phase 1). Clients reach data ONLY through these views/functions,
-- which expose a fixed safe column list filtered to the caller's client_id.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Who is the caller? (client ids for the signed-in portal contact)
-- ---------------------------------------------------------------------------
create or replace function public.portal_client_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct c.client_id
  from public.studio_client_contacts c
  join public.studio_clients cl on cl.id = c.client_id and cl.archived_at is null
  where c.is_portal_user = true
    and c.archived_at is null
    and auth.uid() is not null
    and (
      c.auth_user_id = auth.uid()
      or (c.email is not null and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;

create or replace function public.portal_contact_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select c.id
  from public.studio_client_contacts c
  where c.is_portal_user = true
    and c.archived_at is null
    and auth.uid() is not null
    and (
      c.auth_user_id = auth.uid()
      or (c.email is not null and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  order by (c.auth_user_id = auth.uid()) desc nulls last
  limit 1;
$$;

revoke all on function public.portal_client_ids() from public, anon;
revoke all on function public.portal_contact_id() from public, anon;
grant execute on function public.portal_client_ids() to authenticated;
grant execute on function public.portal_contact_id() to authenticated;

-- Link the auth user to the contact row on first sign-in (idempotent).
create or replace function public.portal_link_contact()
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_contact public.studio_client_contacts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  if not found then
    return json_build_object('ok', false);
  end if;
  if v_contact.auth_user_id is null then
    update public.studio_client_contacts set auth_user_id = auth.uid(), updated_at = now() where id = v_contact.id;
  end if;
  return json_build_object(
    'ok', true,
    'name', v_contact.name,
    'organisation', (select organisation from public.studio_clients where id = v_contact.client_id)
  );
end;
$$;
revoke all on function public.portal_link_contact() from public, anon;
grant execute on function public.portal_link_contact() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Read-only views (safe columns only). Owned by postgres, so they read the
--    owner-only base tables, but every row is filtered by portal_client_ids().
-- ---------------------------------------------------------------------------
drop view if exists public.portal_gates;
drop view if exists public.portal_deliverables;
drop view if exists public.portal_invoices;
drop view if exists public.portal_projects;

create view public.portal_projects as
select
  p.id,
  p.code,
  p.title,
  p.client_id,
  p.type,
  p.status,
  p.hard_deadline,
  p.promised_date,
  p.forecast_date,
  p.health,
  p.cover_image_url,
  p.emoji,
  p.review_link_url,
  p.runtime_seconds,
  p.aspect_ratios,
  (select g.name from public.studio_gates g
     where g.id = p.current_gate_id and g.portal_visible = true and g.archived_at is null) as current_stage,
  p.updated_at
from public.studio_projects p
where p.portal_visible = true
  and p.archived_at is null
  and p.status in ('quoted', 'active', 'on_hold', 'delivered', 'paid')
  and p.client_id in (select public.portal_client_ids());

create view public.portal_gates as
select
  g.id,
  g.project_id,
  g.order_index,
  g.name,
  g.needs_client_approval,
  g.status,
  g.started_at,
  g.sent_for_approval_at,
  g.approved_at,
  g.revision_round,
  g.revisions_included,
  g.client_comment
from public.studio_gates g
join public.portal_projects p on p.id = g.project_id
where g.portal_visible = true
  and g.archived_at is null;

create view public.portal_deliverables as
select
  d.id,
  d.project_id,
  d.gate_id,
  d.title,
  d.url,
  d.version,
  d.created_at
from public.studio_deliverables d
join public.portal_projects p on p.id = d.project_id
where d.shared_with_client = true
  and d.archived_at is null;

create view public.portal_invoices as
select
  i.id,
  i.project_id,
  i.invoice_no,
  i.amount,
  i.currency,
  i.tds_amount,
  case when i.status <> 'paid' and i.due_at is not null and i.due_at < current_date then 'overdue' else i.status end as status,
  i.sent_at,
  i.due_at,
  i.received_at,
  i.file_url
from public.studio_payments i
join public.portal_projects p on p.id = i.project_id
where i.status <> 'draft'
  and i.archived_at is null;

revoke all on public.portal_projects, public.portal_gates, public.portal_deliverables, public.portal_invoices from public, anon;
grant select on public.portal_projects, public.portal_gates, public.portal_deliverables, public.portal_invoices to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Shared helpers for the approval RPCs
-- ---------------------------------------------------------------------------
create or replace function public.portal_owned_gate(p_gate_id uuid)
returns public.studio_gates
language plpgsql stable security definer set search_path = public as $$
declare
  v_gate public.studio_gates%rowtype;
begin
  select g.* into v_gate
  from public.studio_gates g
  join public.studio_projects p on p.id = g.project_id
  where g.id = p_gate_id
    and g.archived_at is null
    and g.portal_visible = true
    and p.archived_at is null
    and p.portal_visible = true
    and p.client_id in (select public.portal_client_ids());
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_gate;
end;
$$;
revoke all on function public.portal_owned_gate(uuid) from public, anon, authenticated;

create or replace function public.portal_next_task_key(p_project_id uuid)
returns text
language sql volatile security definer set search_path = public as $$
  select p.code || '-' || (coalesce(max(nullif(regexp_replace(t.key, '^.*-', ''), '')::int), 0) + 1)
  from public.studio_projects p
  left join public.studio_tasks t on t.project_id = p.id and t.key ~ ('^' || p.code || '-[0-9]+$')
  where p.id = p_project_id
  group by p.code;
$$;
revoke all on function public.portal_next_task_key(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. portal_approve_gate
-- ---------------------------------------------------------------------------
create or replace function public.portal_approve_gate(p_gate_id uuid, p_comment text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_gate public.studio_gates%rowtype;
  v_project public.studio_projects%rowtype;
  v_next public.studio_gates%rowtype;
  v_contact_name text;
  v_owner uuid;
  v_actual numeric;
  v_comment text := nullif(left(btrim(coalesce(p_comment, '')), 4000), '');
begin
  v_gate := public.portal_owned_gate(p_gate_id);
  if v_gate.status <> 'waiting_on_client' then
    raise exception 'not_awaiting_approval';
  end if;
  select * into v_project from public.studio_projects where id = v_gate.project_id;
  select name into v_contact_name from public.studio_client_contacts where id = public.portal_contact_id();
  select id into v_owner from public.studio_members where role = 'owner' and is_active and archived_at is null order by created_at limit 1;

  v_actual := case when v_gate.started_at is not null
    then greatest(0.5, round(extract(epoch from (now() - v_gate.started_at)) / 86400.0 * 2) / 2)
    else coalesce(v_gate.actual_days, v_gate.estimate_days) end;

  update public.studio_gates
    set status = 'approved', approved_at = now(), actual_days = v_actual,
        client_comment = coalesce(v_comment, client_comment), updated_at = now()
    where id = v_gate.id;

  select * into v_next from public.studio_gates
    where project_id = v_gate.project_id and archived_at is null
      and order_index > v_gate.order_index and status not in ('approved', 'skipped')
    order by order_index limit 1;

  if found then
    if v_next.status = 'not_started' then
      update public.studio_gates set status = 'in_work', started_at = coalesce(started_at, now()), updated_at = now() where id = v_next.id;
    end if;
    update public.studio_projects set current_gate_id = v_next.id, last_client_touch_at = now(), updated_at = now() where id = v_project.id;
  else
    update public.studio_projects set last_client_touch_at = now(), updated_at = now() where id = v_project.id;
  end if;

  insert into public.studio_activity_log (actor, actor_name, entity_type, entity_id, action, diff)
  values ('client', coalesce(v_contact_name, 'Client'), 'gate', v_gate.id,
          'approved ' || v_gate.name || ' via portal',
          json_build_object('comment', v_comment, 'next_gate', v_next.name)::jsonb);

  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (v_owner, 'portal_approval',
          v_project.code || ' — ' || v_gate.name || ' approved',
          coalesce(v_contact_name, 'Client') || ' approved ' || v_gate.name || coalesce(': "' || left(v_comment, 200) || '"', '.'),
          '/studio-os');

  return json_build_object('ok', true, 'project_id', v_project.id, 'next_stage', v_next.name);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. portal_request_changes
-- ---------------------------------------------------------------------------
create or replace function public.portal_request_changes(p_gate_id uuid, p_comment text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_gate public.studio_gates%rowtype;
  v_project public.studio_projects%rowtype;
  v_contact_name text;
  v_contact_id uuid;
  v_owner uuid;
  v_round int;
  v_over boolean;
  v_comment text := left(btrim(coalesce(p_comment, '')), 4000);
  v_point text;
  v_points text[];
  v_task_ids uuid[] := '{}';
  v_task_id uuid;
begin
  if length(v_comment) < 2 then
    raise exception 'comment_required';
  end if;
  v_gate := public.portal_owned_gate(p_gate_id);
  if v_gate.status <> 'waiting_on_client' then
    raise exception 'not_awaiting_approval';
  end if;
  select * into v_project from public.studio_projects where id = v_gate.project_id;
  v_contact_id := public.portal_contact_id();
  select name into v_contact_name from public.studio_client_contacts where id = v_contact_id;
  select id into v_owner from public.studio_members where role = 'owner' and is_active and archived_at is null order by created_at limit 1;

  v_round := v_gate.revision_round + 1;
  v_over := v_round > v_gate.revisions_included;

  update public.studio_gates
    set status = 'revising', revision_round = v_round, client_comment = v_comment, updated_at = now()
    where id = v_gate.id;
  update public.studio_projects set last_client_touch_at = now(), updated_at = now() where id = v_project.id;

  -- One task per point (lines / bullets / numbered items). The server may
  -- refine a single multi-sentence paragraph with AI afterwards.
  select coalesce(array_agg(pt), '{}') into v_points from (
    select btrim(regexp_replace(line, '^\s*([-*•–]|\d+[.)])\s*', '')) as pt
    from regexp_split_to_table(v_comment, E'\\n+') as line
  ) s where length(pt) > 1;
  if array_length(v_points, 1) is null then
    v_points := array[v_comment];
  end if;

  foreach v_point in array v_points[1:15] loop
    insert into public.studio_tasks (key, project_id, gate_id, title, description, type, status, priority,
      estimate_hours, assignee_member_id, source, source_ref, promised_to_contact_id, promised_to_name, channel, portal_visible)
    values (public.portal_next_task_key(v_project.id), v_project.id, v_gate.id,
      left(v_gate.name || ' R' || v_round || ': ' || v_point, 160),
      'Client change request (round ' || v_round || ' of ' || v_gate.revisions_included || ' included)' || E'\n\n' || v_comment,
      'task', 'todo', 'high', 1, v_owner, 'portal', 'portal:gate:' || v_gate.id || ':r' || v_round,
      v_contact_id, v_contact_name, 'portal', false)
    returning id into v_task_id;
    v_task_ids := v_task_ids || v_task_id;
  end loop;

  insert into public.studio_activity_log (actor, actor_name, entity_type, entity_id, action, diff)
  values ('client', coalesce(v_contact_name, 'Client'), 'gate', v_gate.id,
          'requested changes on ' || v_gate.name || ' (round ' || v_round || ')',
          json_build_object('comment', v_comment, 'over_included', v_over, 'tasks', v_task_ids)::jsonb);

  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (v_owner, case when v_over then 'portal_changes_over' else 'portal_changes' end,
          v_project.code || ' — changes on ' || v_gate.name ||
            case when v_over then ' (round ' || v_round || ', beyond ' || v_gate.revisions_included || ' included)' else ' (round ' || v_round || ')' end,
          coalesce(v_contact_name, 'Client') || ': "' || left(v_comment, 240) || '"',
          '/studio-os');

  return json_build_object('ok', true, 'project_id', v_project.id, 'round', v_round,
    'over_included', v_over, 'task_ids', to_json(v_task_ids), 'points', coalesce(array_length(v_points, 1), 1));
end;
$$;

revoke all on function public.portal_approve_gate(uuid, text) from public, anon;
revoke all on function public.portal_request_changes(uuid, text) from public, anon;
grant execute on function public.portal_approve_gate(uuid, text) to authenticated;
grant execute on function public.portal_request_changes(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Realtime for Studio OS (RLS still applies: owner-only rows)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'studio_gates') then
    alter publication supabase_realtime add table public.studio_gates;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'studio_notifications') then
    alter publication supabase_realtime add table public.studio_notifications;
  end if;
end $$;

-- Lock down Phase 1 helper flagged by the advisor
revoke execute on function public.studio_os_is_owner() from public, anon;
grant execute on function public.studio_os_is_owner() to authenticated, service_role;
