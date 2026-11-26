-- Client-account (Client ID + password) isolation test. Runs in a transaction and rolls back.
begin;
do $$
declare v_client uuid; v json; n int;
begin
  select id into v_client from studio_clients where archived_at is null order by created_at limit 1;
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, created_at, updated_at)
  values ('11111111-2222-4333-8444-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tcs-test01@clients.thechantingstudio.in','{"role":"portal"}', now(), now());
  insert into studio_client_contacts (id, client_id, name, is_portal_user, auth_user_id, portal_login_id, must_set_password)
  values ('11111111-2222-4333-8444-666666666666', v_client, 'Test Client', true, '11111111-2222-4333-8444-555555555555', 'TCS-TEST01', true);

  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"11111111-2222-4333-8444-555555555555","email":"tcs-test01@clients.thechantingstudio.in","role":"authenticated"}', true);

  v := portal_link_contact();
  if (v->>'ok')::boolean is not true or v->>'login_id' <> 'TCS-TEST01' or (v->>'must_set_password')::boolean is not true then raise exception 'FAIL link: %', v; end if;
  select count(*) into n from studio_tasks;           if n <> 0 then raise exception 'FAIL: tasks visible'; end if;
  select count(*) into n from studio_projects;        if n <> 0 then raise exception 'FAIL: base projects visible'; end if;
  select count(*) into n from studio_client_contacts; if n <> 0 then raise exception 'FAIL: contacts visible'; end if;
  select count(*) into n from portal_projects p where p.client_id <> v_client; if n <> 0 then raise exception 'FAIL: other client projects'; end if;
  if studio_os_is_owner() then raise exception 'FAIL: owner'; end if;
  if (studio_os_whoami()->>'ok')::boolean then raise exception 'FAIL: studio access'; end if;
  perform portal_password_was_set();
  reset role;
  if (select must_set_password from studio_client_contacts where id = '11111111-2222-4333-8444-666666666666') then raise exception 'FAIL: flag not cleared'; end if;
  raise notice 'client_accounts_test: PASS';
end $$;
rollback;
