-- ============================================================================
-- Studio OS Phase 4 — Portal RLS isolation tests
-- Runs entirely inside one transaction and ROLLS BACK (no data is kept).
-- Simulates PostgREST: SET ROLE authenticated/anon + request.jwt.claims.
-- Any failed assertion raises 'FAIL: ...' and aborts the script.
-- Run: psql "$DATABASE_URL" -f supabase/tests/portal_rls_test.sql
-- ============================================================================
begin;

-- ---------- Seed two isolated clients (as postgres) ----------
insert into public.studio_clients (id, name, organisation, email_domains, is_confidential) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'RLS Test Client A', 'Client A Org', '{a.rls-test.invalid}', false),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'RLS Test Client B', 'Client B Org', '{b.rls-test.invalid}', true);

insert into public.studio_client_contacts (id, client_id, name, email, is_portal_user, auth_user_id) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000001', 'Alice A', 'alice@a.rls-test.invalid', true, null),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000001', 'Bob B', 'bob@b.rls-test.invalid', true, null),
  ('aaaaaaaa-0000-4000-8000-0000000000c2', 'aaaaaaaa-0000-4000-8000-000000000001', 'Not Portal', 'np@a.rls-test.invalid', false, null);

insert into public.studio_projects (id, code, title, client_id, status, portal_visible, fee_amount, is_confidential) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'ZRA', 'Client A Visible Film', 'aaaaaaaa-0000-4000-8000-000000000001', 'active', true, 500000, false),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'ZRH', 'Client A Hidden Film', 'aaaaaaaa-0000-4000-8000-000000000001', 'active', false, 100000, false),
  ('aaaaaaaa-0000-4000-8000-0000000000a3', 'ZRL', 'Client A Lost Lead', 'aaaaaaaa-0000-4000-8000-000000000001', 'lost', true, null, false),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'ZRB', 'Client B Secret Film', 'bbbbbbbb-0000-4000-8000-000000000001', 'active', true, 900000, true);

insert into public.studio_gates (id, project_id, order_index, code, name, needs_client_approval, status, estimate_days, portal_visible, revision_round, revisions_included, started_at) values
  ('aaaaaaaa-0000-4000-8000-00000000a0e1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 1, 'G1', 'Storyboard', true, 'waiting_on_client', 3, true, 0, 2, now() - interval '4 days'),
  ('aaaaaaaa-0000-4000-8000-00000000a0e2', 'aaaaaaaa-0000-4000-8000-0000000000a1', 2, 'G2', 'Animatic', false, 'not_started', 4, true, 0, 2, null),
  ('aaaaaaaa-0000-4000-8000-00000000a0e3', 'aaaaaaaa-0000-4000-8000-0000000000a1', 3, 'G3', 'Fine Cut', true, 'waiting_on_client', 5, true, 2, 2, now() - interval '2 days'),
  ('aaaaaaaa-0000-4000-8000-00000000a0e4', 'aaaaaaaa-0000-4000-8000-0000000000a1', 4, 'G4', 'Internal QC', false, 'not_started', 1, false, 0, 2, null),
  ('bbbbbbbb-0000-4000-8000-00000000b0e1', 'bbbbbbbb-0000-4000-8000-0000000000b1', 1, 'G1', 'Script', true, 'waiting_on_client', 2, true, 0, 2, now());

insert into public.studio_deliverables (project_id, gate_id, title, url, version, shared_with_client) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-00000000a0e1', 'A storyboard PDF', 'https://example.invalid/a1', 'v1', true),
  ('aaaaaaaa-0000-4000-8000-0000000000a1', null, 'A internal draft', 'https://example.invalid/a2', 'v0', false),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', null, 'B script', 'https://example.invalid/b1', 'v1', true);

insert into public.studio_payments (project_id, invoice_no, amount, currency, status) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'RLS-A-1', 250000, 'INR', 'sent'),
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'RLS-A-DRAFT', 250000, 'INR', 'draft'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'RLS-B-1', 450000, 'INR', 'sent');

insert into public.studio_tasks (key, project_id, title, type, status) values
  ('ZRA-1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'Internal task for A', 'task', 'todo'),
  ('ZRB-1', 'bbbbbbbb-0000-4000-8000-0000000000b1', 'Internal task for B', 'task', 'todo');

select set_config('rls_test.passed', '0', true);

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then
    raise exception 'FAIL: %', p_name;
  end if;
  perform set_config('rls_test.passed', (current_setting('rls_test.passed')::int + 1)::text, true);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated, anon;

-- ============================================================================
-- As CLIENT A (signed-in portal contact, never linked before → email match)
-- ============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa","email":"alice@a.rls-test.invalid","role":"authenticated"}', true);

do $$
declare
  t text;
  n int;
  r json;
begin
  -- Views: only Client A's portal-visible, non-lost project
  perform pg_temp.ok((select count(*) from public.portal_projects) = 1, 'A sees exactly 1 project');
  perform pg_temp.ok((select code from public.portal_projects) = 'ZRA', 'A sees ZRA');
  perform pg_temp.ok(not exists (select 1 from public.portal_projects where client_id <> 'aaaaaaaa-0000-4000-8000-000000000001'), 'A sees no other client projects');
  perform pg_temp.ok((select count(*) from public.portal_gates) = 3, 'A sees 3 portal-visible gates (internal gate hidden)');
  perform pg_temp.ok(not exists (select 1 from public.portal_gates where name = 'Internal QC'), 'internal gate hidden');
  perform pg_temp.ok(not exists (select 1 from public.portal_gates where project_id = 'bbbbbbbb-0000-4000-8000-0000000000b1'), 'A sees no B gates');
  perform pg_temp.ok((select count(*) from public.portal_deliverables) = 1, 'A sees only shared deliverable');
  perform pg_temp.ok((select count(*) from public.portal_invoices) = 1, 'A sees only non-draft own invoice');
  perform pg_temp.ok((select invoice_no from public.portal_invoices) = 'RLS-A-1', 'A invoice is RLS-A-1');

  -- Sensitive columns are not part of the views at all
  perform pg_temp.ok(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name in ('portal_projects','portal_gates','portal_deliverables','portal_invoices')
      and column_name in ('fee_amount','estimate_days','actual_days','owner_member_id','is_confidential','priority','notes','drive_folder_url','code_internal')
  ), 'views expose no internal columns');

  -- Every internal table returns zero rows to a client
  foreach t in array array['studio_projects','studio_gates','studio_tasks','studio_members','studio_clients','studio_client_contacts',
    'studio_payments','studio_deliverables','studio_settings','studio_activity_log','studio_notifications','studio_inbox_items',
    'studio_email_threads','studio_gmail_accounts','studio_ingest_tokens','studio_time_entries','studio_expenses',
    'studio_generation_blocks','studio_holidays','studio_push_subscriptions','studio_gmail_processed'] loop
    execute format('select count(*) from public.%I', t) into n;
    perform pg_temp.ok(n = 0, format('client reads 0 rows from %s', t));
  end loop;

  -- Clients cannot write internal tables
  begin
    insert into public.studio_tasks (key, project_id, title) values ('ZRA-99', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'hack');
    perform pg_temp.ok(false, 'client insert into studio_tasks must fail');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'client insert into studio_tasks denied'); end;
  update public.studio_gates set status = 'approved' where id = 'bbbbbbbb-0000-4000-8000-00000000b0e1';
  get diagnostics n = row_count;
  perform pg_temp.ok(n = 0, 'client direct update of gates affects 0 rows');

  -- Secrets & internal helpers are unreachable
  begin
    perform 1 from vault.decrypted_secrets limit 1;
    perform pg_temp.ok(false, 'vault must be unreadable');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'vault unreadable'); end;
  begin
    perform public.studio_gmail_get_token('aaaaaaaa-0000-4000-8000-0000000000a1');
    perform pg_temp.ok(false, 'gmail token rpc must be denied');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'gmail token rpc denied'); end;
  begin
    perform public.portal_owned_gate('aaaaaaaa-0000-4000-8000-00000000a0e1');
    perform pg_temp.ok(false, 'portal_owned_gate must be internal');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'portal_owned_gate internal'); end;

  -- RPC ownership: A cannot approve or request changes on B's gate
  begin
    perform public.portal_approve_gate('bbbbbbbb-0000-4000-8000-00000000b0e1', 'sneaky');
    perform pg_temp.ok(false, 'A approving B gate must fail');
  exception when no_data_found then perform pg_temp.ok(true, 'A cannot approve B gate'); end;
  begin
    perform public.portal_request_changes('bbbbbbbb-0000-4000-8000-00000000b0e1', 'sneaky');
    perform pg_temp.ok(false, 'A requesting changes on B gate must fail');
  exception when no_data_found then perform pg_temp.ok(true, 'A cannot request changes on B gate'); end;
  begin
    perform public.portal_approve_gate('aaaaaaaa-0000-4000-8000-00000000a0e4', null);
    perform pg_temp.ok(false, 'approving hidden internal gate must fail');
  exception when no_data_found then perform pg_temp.ok(true, 'hidden gate not approvable'); end;
  begin
    perform public.portal_approve_gate('aaaaaaaa-0000-4000-8000-00000000a0e2', null);
    perform pg_temp.ok(false, 'approving a gate not awaiting approval must fail');
  exception when raise_exception then perform pg_temp.ok(sqlerrm = 'not_awaiting_approval', 'only waiting gates are approvable'); end;

  -- Happy paths
  r := public.portal_approve_gate('aaaaaaaa-0000-4000-8000-00000000a0e1', 'Looks great');
  perform pg_temp.ok((r->>'ok')::boolean and r->>'next_stage' = 'Animatic', 'A approves own storyboard; next = Animatic');
  r := public.portal_request_changes('aaaaaaaa-0000-4000-8000-00000000a0e3', E'1. Logo bigger at 0:12\n2. Warmer grade\n- Shorter end card');
  perform pg_temp.ok((r->>'round')::int = 3 and (r->>'over_included')::boolean and (r->>'points')::int = 3, 'change request round 3 flagged over included with 3 points');

  -- Still no internal reads after acting
  perform pg_temp.ok((select count(*) from public.studio_tasks) = 0, 'client still cannot read the tasks it created');
end $$;

-- ============================================================================
-- As CLIENT B — sees only B, and not A's changes
-- ============================================================================
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb","email":"bob@b.rls-test.invalid","role":"authenticated"}', true);
do $$
begin
  perform pg_temp.ok((select count(*) from public.portal_projects) = 1 and (select code from public.portal_projects) = 'ZRB', 'B sees only ZRB');
  perform pg_temp.ok(not exists (select 1 from public.portal_gates where project_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'B sees no A gates');
  perform pg_temp.ok(not exists (select 1 from public.portal_deliverables where project_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'B sees no A deliverables');
  perform pg_temp.ok(not exists (select 1 from public.portal_invoices where invoice_no like 'RLS-A%'), 'B sees no A invoices');
end $$;

-- ============================================================================
-- Signed-in user who is NOT a portal contact (e.g. non-portal contact email)
-- ============================================================================
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-3333-4333-8333-cccccccccccc","email":"np@a.rls-test.invalid","role":"authenticated"}', true);
do $$
begin
  perform pg_temp.ok((select count(*) from public.portal_projects) = 0, 'non-portal contact sees nothing');
  begin
    perform public.portal_approve_gate('aaaaaaaa-0000-4000-8000-00000000a0e3', null);
    perform pg_temp.ok(false, 'non-portal contact cannot approve');
  exception when no_data_found then perform pg_temp.ok(true, 'non-portal contact cannot approve'); end;
end $$;

-- ============================================================================
-- Anonymous (no session)
-- ============================================================================
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.portal_projects;
    perform pg_temp.ok(false, 'anon must not read portal views');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anon denied portal_projects'); end;
  begin
    perform public.portal_approve_gate('aaaaaaaa-0000-4000-8000-00000000a0e3', null);
    perform pg_temp.ok(false, 'anon must not call approve rpc');
  exception when insufficient_privilege then perform pg_temp.ok(true, 'anon denied approve rpc'); end;
  perform pg_temp.ok((select count(*) from public.studio_projects) = 0, 'anon reads 0 studio_projects');
end $$;

-- ============================================================================
-- Side effects (as postgres)
-- ============================================================================
reset role;
do $$
begin
  perform pg_temp.ok((select status from public.studio_gates where id = 'aaaaaaaa-0000-4000-8000-00000000a0e1') = 'approved', 'storyboard approved in DB');
  perform pg_temp.ok((select status from public.studio_gates where id = 'aaaaaaaa-0000-4000-8000-00000000a0e2') = 'in_work', 'next gate advanced to in_work');
  perform pg_temp.ok((select current_gate_id from public.studio_projects where id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = 'aaaaaaaa-0000-4000-8000-00000000a0e2', 'project current gate moved');
  perform pg_temp.ok((select status from public.studio_gates where id = 'aaaaaaaa-0000-4000-8000-00000000a0e3') = 'revising', 'fine cut set to revising');
  perform pg_temp.ok((select count(*) from public.studio_tasks where source = 'portal' and project_id = 'aaaaaaaa-0000-4000-8000-0000000000a1') = 3, '3 tasks created from change request');
  perform pg_temp.ok((select count(*) from public.studio_notifications where kind in ('portal_approval','portal_changes_over') and created_at > now() - interval '1 minute' and title like 'ZRA%') = 2, 'owner notified twice');
  perform pg_temp.ok((select status from public.studio_gates where id = 'bbbbbbbb-0000-4000-8000-00000000b0e1') = 'waiting_on_client', 'B gate untouched');
  perform pg_temp.ok((select auth_user_id from public.studio_client_contacts where id = 'bbbbbbbb-0000-4000-8000-0000000000c1') is null, 'no contact linking side effects');
end $$;

select 'ALL PORTAL RLS TESTS PASSED' as result, current_setting('rls_test.passed')::int as assertions;

rollback;
