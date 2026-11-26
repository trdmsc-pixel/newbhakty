-- ============================================================================
-- Client portal extras: studio hours & holiday calendar, client <-> studio
-- messages. Clients still reach nothing but portal_* views and RPCs.
-- ============================================================================

-- 1. Studio hours (IST). work_days uses ISO weekday numbers: 1 = Mon … 7 = Sun.
alter table public.studio_settings
  add column if not exists studio_opens_at time not null default '10:00',
  add column if not exists work_days smallint[] not null default '{1,2,3,4,5,6}';

create or replace function public.portal_studio_info()
returns json
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from public.portal_client_ids()) and not public.studio_os_is_owner() then null
    else (
      select json_build_object(
        'timezone', coalesce(s.timezone, 'Asia/Kolkata'),
        'opens_at', to_char(s.studio_opens_at, 'HH24:MI'),
        'closes_at', to_char(s.studio_closes_at, 'HH24:MI'),
        'work_days', s.work_days,
        'holidays', coalesce((
          select json_agg(json_build_object('date', h.holiday_date, 'name', h.name) order by h.holiday_date)
          from public.studio_holidays h
          where h.is_active and h.archived_at is null and h.region in ('IN', 'GLOBAL')
            and h.holiday_date between current_date - 62 and current_date + 400
        ), '[]'::json)
      )
      from public.studio_settings s
      where s.archived_at is null
      order by s.created_at
      limit 1
    )
  end;
$$;
revoke all on function public.portal_studio_info() from public, anon;
grant execute on function public.portal_studio_info() to authenticated;

-- 2. Messages between a client and the studio.
create table if not exists public.studio_portal_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id),
  contact_id uuid references public.studio_client_contacts(id),
  project_id uuid references public.studio_projects(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  from_studio boolean not null default false,
  author_name text,
  read_by_studio_at timestamptz,
  read_by_client_at timestamptz,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists studio_portal_messages_client_idx on public.studio_portal_messages (client_id, created_at desc);
alter table public.studio_portal_messages enable row level security;
drop policy if exists owner_full_access on public.studio_portal_messages;
create policy owner_full_access on public.studio_portal_messages
  for all to authenticated
  using (public.studio_os_is_owner())
  with check (public.studio_os_is_owner());

drop view if exists public.portal_messages;
create view public.portal_messages as
select m.id, m.project_id, m.body, m.from_studio,
       case when m.from_studio then 'The Chanting Studio' else m.author_name end as author_name,
       m.created_at, m.read_by_client_at
from public.studio_portal_messages m
where m.archived_at is null
  and m.client_id in (select public.portal_client_ids());
revoke all on public.portal_messages from public, anon;
grant select on public.portal_messages to authenticated;

create or replace function public.portal_send_message(p_body text, p_project_id uuid default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_contact public.studio_client_contacts%rowtype;
  v_owner uuid;
  v_body text := left(btrim(coalesce(p_body, '')), 4000);
  v_code text;
  v_id uuid;
begin
  if length(v_body) < 1 then raise exception 'message_required'; end if;
  select * into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  if not found then raise exception 'not_a_portal_user'; end if;
  if p_project_id is not null then
    select code into v_code from public.portal_projects where id = p_project_id;
    if v_code is null then raise exception 'project_not_found'; end if;
  end if;
  -- Light flood guard: max 20 messages per contact per hour.
  if (select count(*) from public.studio_portal_messages where contact_id = v_contact.id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;
  insert into public.studio_portal_messages (client_id, contact_id, project_id, body, from_studio, author_name)
  values (v_contact.client_id, v_contact.id, p_project_id, v_body, false, v_contact.name)
  returning id into v_id;
  select id into v_owner from public.studio_members where role = 'owner' and is_active and archived_at is null order by created_at limit 1;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (v_owner, 'portal_message',
          coalesce(v_code || ' — ', '') || 'Message from ' || coalesce(v_contact.name, 'a client'),
          left(v_body, 240), '/studio-os?client=' || v_contact.client_id);
  return json_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.portal_send_message(text, uuid) from public, anon;
grant execute on function public.portal_send_message(text, uuid) to authenticated;

create or replace function public.portal_mark_messages_read()
returns void
language sql security definer set search_path = public as $$
  update public.studio_portal_messages set read_by_client_at = now()
  where from_studio and read_by_client_at is null and archived_at is null
    and client_id in (select public.portal_client_ids());
$$;
revoke all on function public.portal_mark_messages_read() from public, anon;
grant execute on function public.portal_mark_messages_read() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'studio_portal_messages') then
    alter publication supabase_realtime add table public.studio_portal_messages;
  end if;
end $$;
