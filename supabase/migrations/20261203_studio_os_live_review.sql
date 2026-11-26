-- ============================================================================
-- Studio OS — live sync + review media
-- 1. Realtime for tasks / inbox / mail threads / deliverables / projects so the
--    dashboard updates the moment a client acts (owner RLS still applies).
-- 2. Private "studio-review" bucket for images shared for approval. Deliverable
--    urls of the form storage://studio-review/<path> resolve to signed urls.
--    Owner: full access. Portal client: read only objects referenced by a
--    deliverable they can already see (portal_deliverables is client-filtered).
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['studio_tasks','studio_inbox_items','studio_email_threads','studio_deliverables','studio_projects'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-review', 'studio-review', false, 26214400, array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists studio_review_owner on storage.objects;
create policy studio_review_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'studio-review' and public.studio_os_is_owner())
  with check (bucket_id = 'studio-review' and public.studio_os_is_owner());

drop policy if exists studio_review_portal_read on storage.objects;
create policy studio_review_portal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'studio-review'
    and exists (select 1 from public.portal_deliverables d where d.url = 'storage://studio-review/' || name)
  );
