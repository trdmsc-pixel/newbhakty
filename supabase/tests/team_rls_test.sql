-- ============================================================================
-- Studio OS Phase 5 — Team member RLS isolation tests (rolled back)
-- Run: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/team_rls_test.sql
-- ============================================================================
begin;

-- Auth users for the simulated sign-ins (rolled back with everything else)
insert into auth.users (id, instance_id, aud, role, email) values
  ('e1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'asha@team-rls.invalid'),
  ('e2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ian@team-rls.invalid');

insert into public.studio_clients (id, name, organisation, is_confidential) values
  ('c1000000-0000-4000-8000-000000000001', 'TeamTest Normal Client', 'Normal Org', false),
  ('c2000000-0000-4000-8000-000000000002', 'TeamTest Secret Client', 'Secret Org', true);

insert into public.studio_members (id, name, email, role, is_active) values
  ('e1000000-0000-4000-8000-000000000001', 'Asha Artist', 'asha@team-rls.invalid', 'artist', true),
  ('e2000000-0000-4000-8000-000000000002', 'Ian Inactive', 'ian@team-rls.invalid', 'editor', false);

insert into public.studio_projects (id, code, title, client_id, status, fee_amount, is_confidential) values
  ('f1000000-0000-4000-8000-000000000001', 'ZT1', 'Assigned normal', 'c1000000-0000-4000-8000-000000000001', 'active', 111111, false),
  ('f2000000-0000-4000-8000-000000000002', 'ZT2', 'Not assigned', 'c1000000-0000-4000-8000-000000000001', 'active', 222222, false),
  ('f3000000-0000-4000-8000-000000000003', 'ZT3', 'Confidential no grant', 'c1000000-0000-4000-8000-000000000001', 'active', 333333, true),
  ('f4000000-0000-4000-8000-000000000004', 'ZT4', 'Confidential granted', 'c1000000-0000-4000-8000-000000000001', 'active', 444444, true),
  ('f5000000-0000-4000-8000-000000000005', 'ZT5', 'Secret client via task', 'c2000000-0000-4000-8000-000000000002', 'active', 555555, false);

insert into public.studio_project_members (project_id, member_id, can_view_confidential) values
  ('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', false),
  ('f3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000001', false),
  ('f4000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000001', true),
  ('f2000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002', false);

insert into public.studio_tasks (key, project_id, title, assignee_member_id) values
  ('ZT1-1', 'f1000000-0000-4000-8000-000000000001', 'T1', null),
  ('ZT2-1', 'f2000000-0000-4000-8000-000000000002', 'T2', null),
  ('ZT5-1', 'f5000000-0000-4000-8000-000000000005', 'T5 assigned to Asha', 'e1000000-0000-4000-8000-000000000001');
insert into public.studio_gates (project_id, order_index, code, name) values
  ('f1000000-0000-4000-8000-000000000001', 1, 'G1', 'G1 of ZT1'),
  ('f2000000-0000-4000-8000-000000000002', 1, 'G1', 'G1 of ZT2');
insert into public.studio_payments (project_id, invoice_no, amount, status) values
  ('f1000000-0000-4000-8000-000000000001', 'ZT-INV-1', 50000, 'sent');
insert into public.studio_expenses (category, vendor, amount, paid_on) values ('software', 'TeamTest Vendor', 999, current_date);

-- Production column lock (re-applied here so the test covers it)
do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns where table_schema = 'public' and table_name = 'studio_projects' and column_name <> 'fee_amount';
  execute 'revoke select on public.studio_projects from anon, authenticated';
  execute format('grant select (%s) on public.studio_projects to authenticated', cols);
end $$;

select set_config('team_test.passed', '0', true);
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL: %', p_name; end if;
  perform set_config('team_test.passed', (current_setting('team_test.passed')::int + 1)::text, true);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;

-- ---------------- Active artist Asha ----------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-4111-8111-111111111111","email":"asha@team-rls.invalid","role":"authenticated"}', true);
do $$
declare n int; who json;
begin
  who := public.studio_os_whoami();
  perform pg_temp.ok((who->>'ok')::boolean and who->>'role' = 'artist' and not (who->>'is_owner')::boolean, 'whoami: artist, not owner');

  perform pg_temp.ok((select count(*) from public.studio_projects where code like 'ZT%') = 2, 'member sees exactly 2 test projects');
  perform pg_temp.ok(exists (select 1 from public.studio_projects where code = 'ZT1'), 'sees assigned normal project');
  perform pg_temp.ok(exists (select 1 from public.studio_projects where code = 'ZT4'), 'sees confidential project with explicit grant');
  perform pg_temp.ok(not exists (select 1 from public.studio_projects where code in ('ZT2','ZT3','ZT5')), 'hidden: unassigned, confidential w/o grant, confidential client');
  perform pg_temp.ok(not exists (select 1 from public.studio_projects where code not like 'ZT%'), 'sees no real studio projects');

  begin
    perform fee_amount from public.studio_projects limit 1;
    perform pg_temp.ok(false, 'fee_amount must be unreadable');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'fee_amount column denied'); end;
  begin
    perform * from public.studio_projects limit 1;
    perform pg_temp.ok(false, 'select * must fail because it includes fee_amount');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'select * denied (fee hidden)'); end;
  perform pg_temp.ok((select count(*) from public.studio_project_fees()) = 0, 'fees rpc returns nothing to members');

  perform pg_temp.ok((select count(*) from public.studio_payments) = 0, 'no payments');
  perform pg_temp.ok((select count(*) from public.studio_expenses) = 0, 'no expenses');
  perform pg_temp.ok((select count(*) from public.studio_inbox_items) = 0, 'no inbox');
  perform pg_temp.ok((select count(*) from public.studio_gmail_accounts) = 0, 'no gmail accounts');
  perform pg_temp.ok((select count(*) from public.studio_notifications) = 0, 'no owner notifications');
  perform pg_temp.ok((select count(*) from public.studio_ingest_tokens) = 0, 'no ingest tokens');

  perform pg_temp.ok((select count(*) from public.studio_tasks where key like 'ZT%') = 1 and exists (select 1 from public.studio_tasks where key = 'ZT1-1'), 'tasks only from accessible projects');
  perform pg_temp.ok(not exists (select 1 from public.studio_gates where name = 'G1 of ZT2'), 'no gates from unassigned project');
  perform pg_temp.ok(not exists (select 1 from public.studio_clients where name = 'TeamTest Secret Client'), 'confidential client hidden');
  perform pg_temp.ok(exists (select 1 from public.studio_clients where name = 'TeamTest Normal Client'), 'own project client visible');
  perform pg_temp.ok(exists (select 1 from public.studio_members where name = 'Asha Artist'), 'team list readable');

  update public.studio_projects set title = 'Assigned normal (edited)' where code = 'ZT1';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 1, 'member can edit assigned project details');
  update public.studio_projects set title = 'hack' where code = 'ZT2';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'member cannot edit unassigned project');
  begin
    update public.studio_projects set fee_amount = 1 where code = 'ZT1';
    perform pg_temp.ok(false, 'member must not change fee');
  exception when raise_exception then perform pg_temp.ok(sqlerrm like 'not allowed%', 'fee change blocked by guard'); end;
  begin
    update public.studio_projects set is_confidential = false where code = 'ZT4';
    perform pg_temp.ok(false, 'member must not change confidentiality');
  exception when raise_exception then perform pg_temp.ok(sqlerrm like 'not allowed%', 'confidentiality change blocked by guard'); end;
  begin
    insert into public.studio_projects (code, title) values ('ZTX', 'new');
    perform pg_temp.ok(false, 'member must not create projects');
  exception when insufficient_privilege or raise_exception then perform pg_temp.ok(sqlerrm not like 'FAIL%', 'project creation blocked'); end;
  begin
    insert into public.studio_tasks (key, project_id, title) values ('ZT2-9', 'f2000000-0000-4000-8000-000000000002', 'x');
    perform pg_temp.ok(false, 'member must not add tasks to unassigned project');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'task in unassigned project blocked'); end;
  insert into public.studio_tasks (key, project_id, title, assignee_member_id) values ('ZT1-9', 'f1000000-0000-4000-8000-000000000001', 'ok', 'e1000000-0000-4000-8000-000000000001');
  perform pg_temp.ok(true, 'member can add task to assigned project');
  begin
    insert into public.studio_project_members (project_id, member_id) values ('f2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001');
    perform pg_temp.ok(false, 'member must not self-assign');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'self-assignment blocked'); end;
  begin
    update public.studio_settings set usd_to_inr = 1;
    get diagnostics n = row_count;
    perform pg_temp.ok(n = 0, 'member cannot change settings');
  end;
end $$;

-- ---------------- Inactive member ----------------
select set_config('request.jwt.claims', '{"sub":"e2222222-2222-4222-8222-222222222222","email":"ian@team-rls.invalid","role":"authenticated"}', true);
do $$
begin
  perform pg_temp.ok(not (public.studio_os_whoami()->>'ok')::boolean, 'inactive member rejected');
  perform pg_temp.ok((select count(*) from public.studio_projects where code like 'ZT%') = 0, 'inactive member sees no projects');
end $$;

-- ---------------- Owner ----------------
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-0000000000aa","email":"shyam@thechantingstudio.in","role":"authenticated"}', true);
do $$
begin
  perform pg_temp.ok((public.studio_os_whoami()->>'is_owner')::boolean, 'owner recognised');
  perform pg_temp.ok((select count(*) from public.studio_projects where code like 'ZT%') = 5, 'owner sees all test projects');
  perform pg_temp.ok((select fee_amount from public.studio_project_fees() where project_id = 'f3000000-0000-4000-8000-000000000003') = 333333, 'owner reads fees via rpc');
  perform pg_temp.ok((select count(*) from public.studio_payments where invoice_no = 'ZT-INV-1') = 1, 'owner reads payments');
  perform pg_temp.ok((select count(*) from public.studio_expenses where vendor = 'TeamTest Vendor') = 1, 'owner reads expenses');
end $$;

reset role;
select 'ALL TEAM RLS TESTS PASSED' as result, current_setting('team_test.passed')::int as assertions;
rollback;
