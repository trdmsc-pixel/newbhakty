-- ============================================================================
-- Studio OS — Phase 3 Migration (Automatic Inputs)
-- Gmail multi-account (Vault-encrypted refresh tokens), inbox extensions,
-- per-member ingest tokens, backups bucket, pg_cron 15-min Gmail sync.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Gmail accounts: refresh tokens live ONLY in Supabase Vault (encrypted)
-- ---------------------------------------------------------------------------
alter table public.studio_gmail_accounts drop column if exists refresh_token;
alter table public.studio_gmail_accounts
  add column if not exists refresh_token_secret_id uuid,
  add column if not exists label text,
  add column if not exists is_personal boolean not null default false,
  add column if not exists connected_at timestamptz,
  add column if not exists needs_reconnect boolean not null default false,
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_error text,
  add column if not exists messages_processed int not null default 0;

-- Save / rotate a refresh token. Service role only.
create or replace function public.studio_gmail_save_token(
  p_email text, p_token text, p_label text default null, p_is_personal boolean default false
) returns uuid
language plpgsql security definer set search_path = public, vault as $$
declare
  v_account public.studio_gmail_accounts%rowtype;
  v_secret uuid;
begin
  select * into v_account from public.studio_gmail_accounts where email = lower(p_email);
  if found and v_account.refresh_token_secret_id is not null then
    perform vault.update_secret(v_account.refresh_token_secret_id, p_token);
    v_secret := v_account.refresh_token_secret_id;
  else
    v_secret := vault.create_secret(p_token, 'studio_gmail_' || lower(p_email) || '_' || substr(md5(random()::text), 1, 6),
      'Studio OS Gmail refresh token');
  end if;

  insert into public.studio_gmail_accounts (email, refresh_token_secret_id, label, is_personal, connected_at, needs_reconnect, last_error, is_active, archived_at)
  values (lower(p_email), v_secret, p_label, p_is_personal, now(), false, null, true, null)
  on conflict (email) do update set
    refresh_token_secret_id = excluded.refresh_token_secret_id,
    label = coalesce(excluded.label, public.studio_gmail_accounts.label),
    is_personal = excluded.is_personal,
    connected_at = now(),
    needs_reconnect = false,
    last_error = null,
    is_active = true,
    archived_at = null,
    updated_at = now()
  returning id into v_account.id;

  return v_account.id;
end;
$$;

create or replace function public.studio_gmail_get_token(p_account_id uuid)
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret
  from public.studio_gmail_accounts a
  join vault.decrypted_secrets ds on ds.id = a.refresh_token_secret_id
  where a.id = p_account_id;
$$;

create or replace function public.studio_gmail_forget_token(p_account_id uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  select refresh_token_secret_id into v_secret from public.studio_gmail_accounts where id = p_account_id;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  update public.studio_gmail_accounts
    set refresh_token_secret_id = null, is_active = false, archived_at = now(), updated_at = now()
    where id = p_account_id;
end;
$$;

-- Cron secret: generated inside the DB, used by pg_cron, verified by the API.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'studio_os_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'studio_os_cron_secret', 'Bearer used by pg_cron to call Studio OS cron routes');
  end if;
  if not exists (select 1 from vault.secrets where name = 'studio_os_app_url') then
    perform vault.create_secret('https://www.thechantingstudio.in', 'studio_os_app_url', 'Public base URL for Studio OS cron calls');
  end if;
end $$;

create or replace function public.studio_os_cron_secret_matches(p_token text)
returns boolean language sql security definer set search_path = public, vault as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'studio_os_cron_secret' and decrypted_secret = p_token and length(p_token) >= 32
  );
$$;

revoke all on function public.studio_gmail_save_token(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.studio_gmail_get_token(uuid) from public, anon, authenticated;
revoke all on function public.studio_gmail_forget_token(uuid) from public, anon, authenticated;
revoke all on function public.studio_os_cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.studio_gmail_save_token(text, text, text, boolean) to service_role;
grant execute on function public.studio_gmail_get_token(uuid) to service_role;
grant execute on function public.studio_gmail_forget_token(uuid) to service_role;
grant execute on function public.studio_os_cron_secret_matches(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Email threads
-- ---------------------------------------------------------------------------
alter table public.studio_email_threads
  add column if not exists last_message_id text,
  add column if not exists last_sender_email text,
  add column if not exists last_sender_name text,
  add column if not exists draft_message_id text,
  add column if not exists summary text,
  add column if not exists reply_owed_task_id uuid references public.studio_tasks(id) on delete set null,
  add column if not exists message_count int not null default 0;

create unique index if not exists studio_email_threads_account_thread_uidx
  on public.studio_email_threads (gmail_account, thread_id);
create index if not exists studio_email_threads_project_idx on public.studio_email_threads (project_id);

-- ---------------------------------------------------------------------------
-- 3. Inbox items
-- ---------------------------------------------------------------------------
alter table public.studio_inbox_items
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists payload jsonb,
  add column if not exists gmail_account text,
  add column if not exists thread_id text,
  add column if not exists ingest_token_id uuid,
  add column if not exists sender text,
  add column if not exists resolved_at timestamptz;

alter table public.studio_inbox_items drop constraint if exists studio_inbox_items_suggested_action_check;
alter table public.studio_inbox_items add constraint studio_inbox_items_suggested_action_check
  check (suggested_action in ('create_task','create_promise','approve_gate','update_payment','log_payment','new_lead','reply_owed','update_deadline','ignore'));

alter table public.studio_inbox_items drop constraint if exists studio_inbox_items_status_check;
alter table public.studio_inbox_items add constraint studio_inbox_items_status_check
  check (status in ('pending','auto_applied','accepted','dismissed','undone'));

create unique index if not exists studio_inbox_items_source_ref_uidx
  on public.studio_inbox_items (source_ref) where source_ref is not null;
create index if not exists studio_inbox_items_status_idx on public.studio_inbox_items (status, received_at desc);

-- ---------------------------------------------------------------------------
-- 4. Per-member ingest tokens (only a SHA-256 hash is stored)
-- ---------------------------------------------------------------------------
create table if not exists public.studio_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.studio_members(id),
  label text not null default 'Personal token',
  token_hash text not null unique,
  token_hint text,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.studio_ingest_tokens enable row level security;
drop policy if exists "owner_full_access" on public.studio_ingest_tokens;
create policy "owner_full_access" on public.studio_ingest_tokens
  for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());

-- ---------------------------------------------------------------------------
-- 5. Private backups bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('studio-os-backups', 'studio-os-backups', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. pg_cron: Gmail sync every 15 minutes (Vercel Hobby crons are daily-only)
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.studio_os_call_cron(p_path text)
returns bigint language plpgsql security definer set search_path = public, vault, net as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'studio_os_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'studio_os_cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke all on function public.studio_os_call_cron(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'studio-os-gmail-sync') then
    perform cron.unschedule('studio-os-gmail-sync');
  end if;
  perform cron.schedule('studio-os-gmail-sync', '*/15 * * * *', $cron$select public.studio_os_call_cron('/api/cron/gmail-sync');$cron$);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Processed-message ledger (dedupe so AI never runs twice on one message)
-- ---------------------------------------------------------------------------
create table if not exists public.studio_gmail_processed (
  gmail_account text not null,
  message_id text not null,
  outcome text,
  processed_at timestamptz not null default now(),
  primary key (gmail_account, message_id)
);
alter table public.studio_gmail_processed enable row level security;
drop policy if exists "owner_full_access" on public.studio_gmail_processed;
create policy "owner_full_access" on public.studio_gmail_processed
  for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
