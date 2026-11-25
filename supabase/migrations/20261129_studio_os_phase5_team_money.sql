-- ============================================================================
-- Studio OS — Phase 5: Team & Money
-- Scoped team access: non-owner members see only assigned projects, never
-- fees, payments, expenses or confidential projects (unless granted).
-- ============================================================================

-- 1. Columns ------------------------------------------------------------------
alter table public.studio_settings
  add column if not exists invoice_generator_url text not null default 'https://invoice-gen-blond.vercel.app/';
alter table public.studio_members
  add column if not exists color text,
  add column if not exists invited_at timestamptz;
alter table public.studio_payments
  add column if not exists received_amount numeric;
alter table public.studio_expenses
  add column if not exists notes text,
  add column if not exists receipt_path text;

-- 2. Project assignments --------------------------------------------------------
create table if not exists public.studio_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  member_id uuid not null references public.studio_members(id) on delete cascade,
  can_view_confidential boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (project_id, member_id)
);
alter table public.studio_project_members enable row level security;
drop policy if exists "owner_full_access" on public.studio_project_members;
create policy "owner_full_access" on public.studio_project_members
  for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());

-- 3. Identity helpers -------------------------------------------------------------
create or replace function public.studio_os_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select m.id from public.studio_members m
  where m.is_active and m.archived_at is null and auth.uid() is not null
    and (m.user_id = auth.uid()
         or (m.email is not null and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  order by (m.user_id = auth.uid()) desc nulls last
  limit 1;
$$;

create or replace function public.studio_os_can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.studio_os_is_owner() or exists (
    select 1
    from public.studio_projects p
    left join public.studio_clients c on c.id = p.client_id
    cross join lateral (select public.studio_os_member_id() as mid) me
    where p.id = p_project_id and me.mid is not null
      and (
        p.owner_member_id = me.mid
        or exists (select 1 from public.studio_project_members pm where pm.project_id = p.id and pm.member_id = me.mid)
        or exists (select 1 from public.studio_tasks t where t.project_id = p.id and t.assignee_member_id = me.mid and t.archived_at is null)
      )
      and (
        (not p.is_confidential and not coalesce(c.is_confidential, false))
        or exists (select 1 from public.studio_project_members pm
                   where pm.project_id = p.id and pm.member_id = me.mid and pm.can_view_confidential)
      )
  );
$$;

create or replace function public.studio_os_can_access_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.studio_os_is_owner() or exists (
    select 1 from public.studio_projects p
    where p.client_id = p_client_id and p.archived_at is null and public.studio_os_can_access_project(p.id)
  );
$$;

-- Who am I in Studio OS? Links auth user on first sign-in.
create or replace function public.studio_os_whoami()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_member public.studio_members%rowtype;
  v_owner boolean := public.studio_os_is_owner();
begin
  if auth.uid() is null then
    return json_build_object('ok', false);
  end if;
  select * into v_member from public.studio_members where id = public.studio_os_member_id();
  if found and v_member.user_id is null then
    update public.studio_members set user_id = auth.uid(), updated_at = now() where id = v_member.id;
  end if;
  if not found and not v_owner then
    return json_build_object('ok', false);
  end if;
  return json_build_object(
    'ok', true,
    'member_id', v_member.id,
    'name', coalesce(v_member.name, 'Owner'),
    'role', case when v_owner then 'owner' else v_member.role end,
    'is_owner', v_owner
  );
end;
$$;

-- Fees are readable ONLY through this owner-checked function.
create or replace function public.studio_project_fees()
returns table (project_id uuid, fee_amount numeric)
language sql stable security definer set search_path = public as $$
  select p.id, p.fee_amount from public.studio_projects p
  where public.studio_os_is_owner() and p.archived_at is null;
$$;

revoke all on function public.studio_os_member_id() from public, anon;
revoke all on function public.studio_os_can_access_project(uuid) from public, anon;
revoke all on function public.studio_os_can_access_client(uuid) from public, anon;
revoke all on function public.studio_os_whoami() from public, anon;
revoke all on function public.studio_project_fees() from public, anon;
grant execute on function public.studio_os_member_id() to authenticated;
grant execute on function public.studio_os_can_access_project(uuid) to authenticated;
grant execute on function public.studio_os_can_access_client(uuid) to authenticated;
grant execute on function public.studio_os_whoami() to authenticated;
grant execute on function public.studio_project_fees() to authenticated;

-- 4. Column-level privacy: no client role can SELECT fee_amount ---------------
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'studio_projects' and column_name <> 'fee_amount';
  execute 'revoke select on public.studio_projects from anon, authenticated';
  execute format('grant select (%s) on public.studio_projects to authenticated', cols);
end $$;

-- Members may not change money/confidentiality fields.
create or replace function public.studio_projects_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user = 'authenticated' and not public.studio_os_is_owner() then
    if tg_op = 'INSERT' then
      raise exception 'only the owner can create projects';
    end if;
    if new.fee_amount is distinct from old.fee_amount
       or new.is_confidential is distinct from old.is_confidential
       or new.client_id is distinct from old.client_id
       or new.portal_visible is distinct from old.portal_visible
       or new.is_public_showcase is distinct from old.is_public_showcase then
      raise exception 'not allowed to change this field';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_studio_projects_guard on public.studio_projects;
create trigger trg_studio_projects_guard before insert or update on public.studio_projects
  for each row execute function public.studio_projects_guard();

-- 5. Member policies (owner_full_access from Phase 1 remains) -----------------
do $$
declare t text;
begin
  -- project-scoped tables: full access to assigned projects
  foreach t in array array['studio_gates','studio_tasks','studio_generation_blocks','studio_deliverables'] loop
    execute format('drop policy if exists "member_project_access" on public.%I', t);
    execute format('create policy "member_project_access" on public.%I for all to authenticated
      using (public.studio_os_member_id() is not null and public.studio_os_can_access_project(project_id))
      with check (public.studio_os_member_id() is not null and public.studio_os_can_access_project(project_id))', t);
  end loop;

  -- shared reference data: read-only for any active member
  foreach t in array array['studio_members','studio_settings','studio_holidays'] loop
    execute format('drop policy if exists "member_read" on public.%I', t);
    execute format('create policy "member_read" on public.%I for select to authenticated
      using (public.studio_os_member_id() is not null)', t);
  end loop;
end $$;

drop policy if exists "member_select" on public.studio_projects;
create policy "member_select" on public.studio_projects for select to authenticated
  using (public.studio_os_member_id() is not null and public.studio_os_can_access_project(id));
drop policy if exists "member_update" on public.studio_projects;
create policy "member_update" on public.studio_projects for update to authenticated
  using (public.studio_os_member_id() is not null and public.studio_os_can_access_project(id))
  with check (public.studio_os_member_id() is not null and public.studio_os_can_access_project(id));

drop policy if exists "member_read" on public.studio_clients;
create policy "member_read" on public.studio_clients for select to authenticated
  using (public.studio_os_member_id() is not null and public.studio_os_can_access_client(id));
drop policy if exists "member_read" on public.studio_client_contacts;
create policy "member_read" on public.studio_client_contacts for select to authenticated
  using (public.studio_os_member_id() is not null and public.studio_os_can_access_client(client_id));

drop policy if exists "member_own" on public.studio_time_entries;
create policy "member_own" on public.studio_time_entries for all to authenticated
  using (member_id = public.studio_os_member_id()) with check (member_id = public.studio_os_member_id());

drop policy if exists "member_insert" on public.studio_activity_log;
create policy "member_insert" on public.studio_activity_log for insert to authenticated
  with check (public.studio_os_member_id() is not null);

drop policy if exists "member_own" on public.studio_project_members;
create policy "member_own" on public.studio_project_members for select to authenticated
  using (member_id = public.studio_os_member_id());

drop policy if exists "member_own" on public.studio_push_subscriptions;
create policy "member_own" on public.studio_push_subscriptions for all to authenticated
  using (member_id = public.studio_os_member_id()) with check (member_id = public.studio_os_member_id());

-- studio_payments, studio_expenses, studio_inbox_items, studio_email_threads,
-- studio_gmail_*, studio_ingest_tokens, studio_notifications: owner-only (unchanged).

-- 6. Receipts bucket (owner only) ------------------------------------------------
insert into storage.buckets (id, name, public) values ('studio-receipts', 'studio-receipts', false)
on conflict (id) do nothing;
drop policy if exists "studio_receipts_owner" on storage.objects;
create policy "studio_receipts_owner" on storage.objects for all to authenticated
  using (bucket_id = 'studio-receipts' and public.studio_os_is_owner())
  with check (bucket_id = 'studio-receipts' and public.studio_os_is_owner());

-- 7. Advisor hygiene ------------------------------------------------------------
alter function public.studio_os_set_updated_at() set search_path = public;
alter function public.studio_os_is_owner() set search_path = public;
