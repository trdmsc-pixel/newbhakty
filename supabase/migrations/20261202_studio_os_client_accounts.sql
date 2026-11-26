-- ============================================================================
-- Studio OS — Client accounts: Client ID + password logins for the portal.
-- Each portal contact gets a random Client ID (username). Accounts are plain
-- Supabase auth users with app_metadata.role = 'portal'; they reach data only
-- through the portal_* views/RPCs (Phase 4), never the studio_* tables.
-- ============================================================================

alter table public.studio_client_contacts
  add column if not exists portal_login_id text,
  add column if not exists must_set_password boolean not null default false,
  add column if not exists portal_last_login_at timestamptz;

create unique index if not exists studio_client_contacts_portal_login_id_key
  on public.studio_client_contacts (upper(portal_login_id))
  where portal_login_id is not null;

-- Service-only: find an existing auth user id by email (used when creating logins).
create or replace function public.studio_auth_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.studio_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.studio_auth_user_id_by_email(text) to service_role;

-- Portal sign-in context now also reports whether a password must be set.
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
  update public.studio_client_contacts
     set auth_user_id = coalesce(auth_user_id, auth.uid()),
         portal_last_login_at = now(),
         updated_at = now()
   where id = v_contact.id;
  return json_build_object(
    'ok', true,
    'name', v_contact.name,
    'organisation', (select organisation from public.studio_clients where id = v_contact.client_id),
    'login_id', v_contact.portal_login_id,
    'must_set_password', v_contact.must_set_password
  );
end;
$$;
revoke all on function public.portal_link_contact() from public, anon;
grant execute on function public.portal_link_contact() to authenticated;

-- Called by the portal right after the client sets their own password.
create or replace function public.portal_password_was_set()
returns void
language sql security definer set search_path = public as $$
  update public.studio_client_contacts
     set must_set_password = false, updated_at = now()
   where id = public.portal_contact_id();
$$;
revoke all on function public.portal_password_was_set() from public, anon;
grant execute on function public.portal_password_was_set() to authenticated;
