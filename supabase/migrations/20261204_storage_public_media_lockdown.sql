-- Lock down writes on the public website media buckets (images, videos, chat-media).
--
-- Before this migration:
--   * "Allow public insert/update/delete …" policies let the anon role (any visitor)
--     upload, overwrite and delete objects in `images` and `videos`, and upload to
--     `chat-media`.
--   * "Admin can upload/update/delete …" policies only checked
--     auth.role() = 'authenticated', which also matches portal client accounts
--     (Supabase auth users with app_metadata.role = 'portal'), not just the studio.
--
-- Nothing in the app writes to these buckets: the admin CMS uploads through
-- /api/media-upload (GitHub `media` branch + jsDelivr), and the website live chat
-- has no attachment upload. So reads stay public, and writes are limited to studio
-- owners via public.studio_os_is_owner(), the same check the Studio OS buckets use.
--
-- The private studio-review / studio-receipts / studio-os-backups buckets are not touched.

-- 1. Drop the anonymous write policies.
drop policy if exists "Allow public insert into images"     on storage.objects;
drop policy if exists "Allow public update into images"     on storage.objects;
drop policy if exists "Allow public delete from images"     on storage.objects;
drop policy if exists "Allow public insert into videos"     on storage.objects;
drop policy if exists "Allow public update into videos"     on storage.objects;
drop policy if exists "Allow public delete from videos"     on storage.objects;
drop policy if exists "Allow public insert into chat-media" on storage.objects;

-- 2. Replace the "any authenticated user" admin policies with owner-only ones.
drop policy if exists "Admin can upload images" on storage.objects;
drop policy if exists "Admin can update images" on storage.objects;
drop policy if exists "Admin can delete images" on storage.objects;
drop policy if exists "Admin can upload videos" on storage.objects;
drop policy if exists "Admin can update videos" on storage.objects;
drop policy if exists "Admin can delete videos" on storage.objects;

create policy "Admin can upload images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and public.studio_os_is_owner());
create policy "Admin can update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'images' and public.studio_os_is_owner())
  with check (bucket_id = 'images' and public.studio_os_is_owner());
create policy "Admin can delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and public.studio_os_is_owner());

create policy "Admin can upload videos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and public.studio_os_is_owner());
create policy "Admin can update videos" on storage.objects
  for update to authenticated
  using (bucket_id = 'videos' and public.studio_os_is_owner())
  with check (bucket_id = 'videos' and public.studio_os_is_owner());
create policy "Admin can delete videos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and public.studio_os_is_owner());

create policy "Admin can manage chat-media" on storage.objects
  for all to authenticated
  using (bucket_id = 'chat-media' and public.studio_os_is_owner())
  with check (bucket_id = 'chat-media' and public.studio_os_is_owner());

-- 3. Reads stay public; these policies are left as they are:
--    "Public can view images", "Public can view videos", "Allow public select from chat-media".
