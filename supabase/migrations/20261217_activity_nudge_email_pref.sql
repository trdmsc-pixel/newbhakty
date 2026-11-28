-- Unread-note nudges + per-client email preference (instant / daily digest / portal only).
alter table public.studio_portal_messages add column if not exists nudged_at timestamptz;
alter table public.studio_clients add column if not exists email_pref text not null default 'instant' check (email_pref in ('instant','digest','portal'));
grant select (email_pref), update (email_pref) on public.studio_clients to authenticated;

create or replace function public.portal_get_email_pref()
returns text language sql stable security definer set search_path = public as $$
  select email_pref from public.studio_clients where id in (select public.portal_client_ids()) limit 1;
$$;
revoke all on function public.portal_get_email_pref() from public, anon;
grant execute on function public.portal_get_email_pref() to authenticated;

create or replace function public.portal_set_email_pref(p_pref text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_pref not in ('instant','digest','portal') then raise exception 'invalid_pref'; end if;
  update public.studio_clients set email_pref = p_pref, updated_at = now() where id in (select public.portal_client_ids());
  -- Portal-only: drop anything still queued.
  if p_pref = 'portal' then
    update public.studio_portal_notifications set email_status = 'skipped' where email_status = 'pending' and client_id in (select public.portal_client_ids());
  end if;
  return p_pref;
end $$;
revoke all on function public.portal_set_email_pref(text) from public, anon;
grant execute on function public.portal_set_email_pref(text) to authenticated;
