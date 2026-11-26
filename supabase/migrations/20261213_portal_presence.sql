-- Private Realtime presence: a client may only join its own presence:client:<id> topic; the studio owner can join all.
drop policy if exists portal_presence_read on realtime.messages;
create policy portal_presence_read on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'presence:client:%'
    and (public.studio_os_is_owner() or substring(realtime.topic() from 17) in (select public.portal_client_ids()::text))
  );
drop policy if exists portal_presence_write on realtime.messages;
create policy portal_presence_write on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'presence:client:%'
    and (public.studio_os_is_owner() or substring(realtime.topic() from 17) in (select public.portal_client_ids()::text))
  );
