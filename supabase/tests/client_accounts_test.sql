-- Client-account (Client ID + password) & portal extras isolation test.
-- Runs in a transaction and rolls back cleanly.
begin;
do $$
declare
  v_client uuid;
  v_other_client uuid;
  v json;
  v_info json;
  v_send json;
  v_studio_msg_id uuid;
  n int;
begin
  select id into v_client from studio_clients where archived_at is null order by created_at limit 1;
  select id into v_other_client from studio_clients where archived_at is null and id <> v_client order by created_at limit 1;

  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, created_at, updated_at)
  values ('11111111-2222-4333-8444-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tcs-test01@clients.thechantingstudio.in','{"role":"portal"}', now(), now());
  insert into studio_client_contacts (id, client_id, name, is_portal_user, auth_user_id, portal_login_id, must_set_password)
  values ('11111111-2222-4333-8444-666666666666', v_client, 'Test Client', true, '11111111-2222-4333-8444-555555555555', 'TCS-TEST01', true);

  -- Seed a studio reply for v_client and a message for another client (if one exists)
  insert into studio_portal_messages (client_id, body, from_studio, author_name)
  values (v_client, 'Studio reply for test client', true, 'The Chanting Studio')
  returning id into v_studio_msg_id;

  if v_other_client is not null then
    insert into studio_portal_messages (client_id, body, from_studio, author_name)
    values (v_other_client, 'Secret message for another client', true, 'The Chanting Studio');
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims','{"sub":"11111111-2222-4333-8444-555555555555","email":"tcs-test01@clients.thechantingstudio.in","role":"authenticated"}', true);

  -- Existing client-account checks
  v := portal_link_contact();
  if (v->>'ok')::boolean is not true or v->>'login_id' <> 'TCS-TEST01' or (v->>'must_set_password')::boolean is not true then raise exception 'FAIL link: %', v; end if;
  select count(*) into n from studio_tasks;           if n <> 0 then raise exception 'FAIL: tasks visible'; end if;
  select count(*) into n from studio_projects;        if n <> 0 then raise exception 'FAIL: base projects visible'; end if;
  select count(*) into n from studio_client_contacts; if n <> 0 then raise exception 'FAIL: contacts visible'; end if;
  select count(*) into n from portal_projects p where p.client_id <> v_client; if n <> 0 then raise exception 'FAIL: other client projects'; end if;
  if studio_os_is_owner() then raise exception 'FAIL: owner'; end if;
  if (studio_os_whoami()->>'ok')::boolean then raise exception 'FAIL: studio access'; end if;
  perform portal_password_was_set();

  -- 1. studio_portal_messages must return 0 rows directly
  select count(*) into n from studio_portal_messages;
  if n <> 0 then raise exception 'FAIL: studio_portal_messages visible directly (% rows)', n; end if;

  -- 2. portal_messages shows only this client's messages
  select count(*) into n from portal_messages where body = 'Secret message for another client';
  if n <> 0 then raise exception 'FAIL: other client messages visible in portal_messages'; end if;
  select count(*) into n from portal_messages where id = v_studio_msg_id;
  if n <> 1 then raise exception 'FAIL: own studio reply missing from portal_messages'; end if;

  -- 3. portal_send_message creates a studio_notifications row of kind 'portal_message' with url '/studio-os?client=<id>'
  v_send := portal_send_message('Hello from portal QA test', null);
  if (v_send->>'ok')::boolean is not true then raise exception 'FAIL: portal_send_message returned %', v_send; end if;

  -- 4. portal_mark_messages_read marks studio replies as read
  perform portal_mark_messages_read();

  -- 5. portal_studio_info returns hours and holidays
  v_info := portal_studio_info();
  if v_info is null
     or coalesce(v_info->>'opens_at', '') = ''
     or coalesce(v_info->>'closes_at', '') = ''
     or json_typeof(v_info->'work_days') <> 'array'
     or json_typeof(v_info->'holidays') <> 'array' then
    raise exception 'FAIL: portal_studio_info invalid: %', v_info;
  end if;

  reset role;

  -- Verify server-side effects after resetting role
  if (select must_set_password from studio_client_contacts where id = '11111111-2222-4333-8444-666666666666') then
    raise exception 'FAIL: flag not cleared';
  end if;

  select count(*) into n
  from studio_notifications
  where kind = 'portal_message'
    and url = '/studio-os?client=' || v_client
    and body like 'Hello from portal QA test%';
  if n < 1 then raise exception 'FAIL: portal_send_message did not create expected studio_notifications row'; end if;

  if (select read_by_client_at from studio_portal_messages where id = v_studio_msg_id) is null then
    raise exception 'FAIL: portal_mark_messages_read did not mark studio reply as read';
  end if;

  raise notice 'client_accounts_test: PASS';
end $$;
rollback;
