-- Delivered / read receipts for portal messages (both directions).
alter table public.studio_portal_messages
  add column if not exists delivered_to_client_at timestamptz,
  add column if not exists delivered_to_studio_at timestamptz;

create or replace view public.portal_messages as
select m.id, m.project_id, m.body, m.from_studio,
       case when m.from_studio then 'The Chanting Studio' else m.author_name end as author_name,
       m.created_at, m.read_by_client_at, m.read_by_studio_at, m.delivered_to_studio_at, m.delivered_to_client_at
from public.studio_portal_messages m
where m.archived_at is null
  and m.client_id in (select public.portal_client_ids());
revoke all on public.portal_messages from public, anon;
grant select on public.portal_messages to authenticated;

create or replace function public.portal_mark_messages_delivered()
returns void
language sql security definer set search_path = public as $$
  update public.studio_portal_messages set delivered_to_client_at = now()
  where from_studio and delivered_to_client_at is null and archived_at is null
    and client_id in (select public.portal_client_ids());
$$;
revoke all on function public.portal_mark_messages_delivered() from public, anon;
grant execute on function public.portal_mark_messages_delivered() to authenticated;

create or replace function public.portal_mark_messages_read()
returns void
language sql security definer set search_path = public as $$
  update public.studio_portal_messages set read_by_client_at = now(), delivered_to_client_at = coalesce(delivered_to_client_at, now())
  where from_studio and read_by_client_at is null and archived_at is null
    and client_id in (select public.portal_client_ids());
$$;
