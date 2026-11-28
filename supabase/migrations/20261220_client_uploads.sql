-- Client uploads (briefs, references, logos, scripts, VO) into a private bucket, per client.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-uploads', 'client-uploads', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists client_uploads_insert on storage.objects;
create policy client_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-uploads' and ((storage.foldername(name))[1] in (select public.portal_client_ids()::text) or public.studio_os_is_owner()));
drop policy if exists client_uploads_select on storage.objects;
create policy client_uploads_select on storage.objects for select to authenticated
  using (bucket_id = 'client-uploads' and ((storage.foldername(name))[1] in (select public.portal_client_ids()::text) or public.studio_os_is_owner()));
drop policy if exists client_uploads_delete on storage.objects;
create policy client_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-uploads' and public.studio_os_is_owner());

create table if not exists public.studio_client_uploads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.studio_clients(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete cascade,
  contact_name text, name text not null, path text not null, size bigint, mime text, note text,
  created_at timestamptz not null default now(), archived_at timestamptz
);
create index if not exists studio_client_uploads_project on public.studio_client_uploads (project_id, created_at desc);
alter table public.studio_client_uploads enable row level security;
drop policy if exists owner_full_access on public.studio_client_uploads;
create policy owner_full_access on public.studio_client_uploads for all to authenticated using (public.studio_os_is_owner()) with check (public.studio_os_is_owner());
drop policy if exists client_read_own on public.studio_client_uploads;
create policy client_read_own on public.studio_client_uploads for select to authenticated using (client_id in (select public.portal_client_ids()) and archived_at is null);

create or replace function public.portal_add_upload(p_project uuid, p_name text, p_path text, p_size bigint, p_mime text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_client uuid; v_id uuid; v_contact text; v_owner uuid; v_title text;
begin
  select p.client_id, p.title into v_client, v_title from public.portal_projects p where p.id = p_project;
  if v_client is null then raise exception 'not_found'; end if;
  if split_part(p_path, '/', 1) <> v_client::text then raise exception 'bad_path'; end if;
  select name into v_contact from public.studio_client_contacts where id = public.portal_contact_id();
  insert into public.studio_client_uploads (client_id, project_id, contact_name, name, path, size, mime, note)
  values (v_client, p_project, v_contact, left(p_name, 200), p_path, p_size, left(p_mime, 120), left(p_note, 1000)) returning id into v_id;
  select id into v_owner from public.studio_members where role = 'owner' and is_active and archived_at is null order by created_at limit 1;
  insert into public.studio_notifications (member_id, kind, title, body, url)
  values (v_owner, 'portal_upload', coalesce(v_contact, 'Client') || ' uploaded ' || left(p_name, 80), coalesce(v_title, '') || coalesce(' — ' || p_note, ''), '/studio-os');
  return v_id;
end $$;
revoke all on function public.portal_add_upload(uuid, text, text, bigint, text, text) from public, anon;
grant execute on function public.portal_add_upload(uuid, text, text, bigint, text, text) to authenticated;
