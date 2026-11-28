-- ROLLBACK for 20261221_production_os.sql — restores the 28 Nov 2026 behaviour.
-- New tables are left in place by default (they hold no old data); uncomment the DROP block to remove them.
-- Data copies of every studio_* table taken before the change: schema backup_20261128.

-- Restore previous views (same column order as before; extra columns removed).
drop view if exists public.portal_asset_versions, public.portal_assets, public.portal_shots;
drop view if exists public.portal_tasks;
create view public.portal_tasks as
  select t.id, t.project_id, t.title, t.status, t.due_date, t.completed_at, t.updated_at
  from public.studio_tasks t join public.portal_projects p on p.id = t.project_id
  where t.portal_visible = true and t.archived_at is null;
drop view if exists public.portal_messages;
create view public.portal_messages as
  select id, project_id, body, from_studio,
    case when from_studio then 'The Chanting Studio'::text else author_name end as author_name,
    created_at, read_by_client_at, read_by_studio_at, delivered_to_studio_at, delivered_to_client_at, gate_id
  from public.studio_portal_messages m
  where archived_at is null and client_id in (select public.portal_client_ids());
drop view if exists public.portal_deliverables cascade;
create view public.portal_deliverables as
  select d.id, d.project_id, d.gate_id, d.title, d.url, d.version, d.created_at, d.is_final, d.download_url, d.client_summary
  from public.studio_deliverables d join public.portal_projects p on p.id = d.project_id
  where d.shared_with_client = true and d.archived_at is null;
create or replace view public.portal_invoices as
  select i.id, i.project_id, i.invoice_no, i.amount, i.currency, i.tds_amount,
    case when i.status <> 'paid' and i.due_at is not null and i.due_at < current_date then 'overdue' else i.status end as status,
    i.sent_at, i.due_at, i.received_at, i.file_url
  from public.studio_payments i join public.portal_projects p on p.id = i.project_id
  where i.status <> 'draft' and i.archived_at is null;
grant select on public.portal_tasks, public.portal_messages, public.portal_deliverables, public.portal_invoices to authenticated;

-- Restore previous functions.
create or replace function public.portal_owned_gate(p_gate_id uuid)
returns studio_gates language plpgsql stable security definer set search_path = public as $$
declare v_gate public.studio_gates%rowtype;
begin
  select g.* into v_gate from public.studio_gates g join public.studio_projects p on p.id = g.project_id
  where g.id = p_gate_id and g.archived_at is null and g.portal_visible = true
    and p.archived_at is null and p.portal_visible = true and p.client_id in (select public.portal_client_ids());
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v_gate;
end $$;
drop function if exists public.portal_add_upload(uuid, text, text, bigint, text, text, text);
-- re-run the portal_add_upload block from supabase/migrations/20261220_client_uploads.sql

drop trigger if exists activity_to_approval on public.studio_activity_log;

-- Restore previous website storage policies.
drop policy if exists site_media_owner_write on storage.objects;
create policy "Admin can upload images" on storage.objects for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "Admin can update images" on storage.objects for update using (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "Admin can delete images" on storage.objects for delete using (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "Admin can upload videos" on storage.objects for insert with check (bucket_id = 'videos' and auth.role() = 'authenticated');
create policy "Admin can update videos" on storage.objects for update using (bucket_id = 'videos' and auth.role() = 'authenticated');
create policy "Admin can delete videos" on storage.objects for delete using (bucket_id = 'videos' and auth.role() = 'authenticated');

-- Optional: remove new tables entirely.
-- drop table if exists public.studio_shot_assets, public.studio_asset_versions, public.studio_assets, public.studio_shots,
--   public.studio_review_comments, public.studio_change_requests, public.studio_approvals cascade;

-- Restore a table's rows from the backup (example):
-- truncate public.studio_gates; insert into public.studio_gates select * from backup_20261128.studio_gates;
