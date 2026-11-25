-- ============================================================================
-- Studio OS — Phase 2 Migration (Holidays, Calibration Actual Days, Cron & Push)
-- ============================================================================

-- 1. studio_holidays (Indian + US + Argentina public holidays)
create table if not exists public.studio_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  region text not null check (region in ('IN', 'US', 'AR', 'GLOBAL')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  archived_at timestamptz,
  unique (holiday_date, region)
);

alter table public.studio_holidays enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'studio_holidays' and policyname = 'owner_full_access'
  ) then
    create policy "owner_full_access" on public.studio_holidays
      for all to authenticated
      using (public.studio_os_is_owner())
      with check (public.studio_os_is_owner());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_set_updated_at' and tgrelid = 'public.studio_holidays'::regclass
  ) then
    create trigger trg_set_updated_at
      before update on public.studio_holidays
      for each row execute function public.studio_os_set_updated_at();
  end if;
end $$;

-- 2. Gate calibration: actual_days recorded when gate is marked approved
alter table public.studio_gates
  add column if not exists actual_days numeric;

-- 3. Time entries optional note for pause/active focus logs
alter table public.studio_time_entries
  add column if not exists notes text;

-- 4. Push subscriptions updated_at for clean upsert
alter table public.studio_push_subscriptions
  add column if not exists updated_at timestamptz not null default now();
