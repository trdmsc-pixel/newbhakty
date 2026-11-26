-- Project completion & final delivery.
-- closed_at: project is complete and closed (shown to the client in the portal).
-- is_final / download_url: deliverables marked as the final delivery, with an
-- optional direct download link (e.g. master file on Drive/Dropbox/WeTransfer).
alter table public.studio_projects add column if not exists closed_at timestamptz;
alter table public.studio_deliverables
  add column if not exists is_final boolean not null default false,
  add column if not exists download_url text;

-- Append-only column changes keep dependent portal views valid.
create or replace view public.portal_projects as
 SELECT id, code, title, client_id, type, status, hard_deadline, promised_date, forecast_date, health,
    cover_image_url, emoji, review_link_url, runtime_seconds, aspect_ratios,
    ( SELECT g.name FROM studio_gates g
       WHERE g.id = p.current_gate_id AND g.portal_visible = true AND g.archived_at IS NULL) AS current_stage,
    updated_at,
    closed_at
   FROM studio_projects p
  WHERE portal_visible = true AND archived_at IS NULL
    AND status = ANY (ARRAY['quoted','active','on_hold','delivered','paid'])
    AND client_id IN ( SELECT portal_client_ids() AS portal_client_ids);

create or replace view public.portal_deliverables as
 SELECT d.id, d.project_id, d.gate_id, d.title, d.url, d.version, d.created_at,
    d.is_final, d.download_url
   FROM studio_deliverables d
   JOIN portal_projects p ON p.id = d.project_id
  WHERE d.shared_with_client = true AND d.archived_at IS NULL;

-- Client portal may read final-delivery images in the private review bucket via download_url too.
drop policy if exists studio_review_portal_read on storage.objects;
create policy studio_review_portal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'studio-review'
    and exists (
      select 1 from public.portal_deliverables d
      where d.url = 'storage://studio-review/' || name or d.download_url = 'storage://studio-review/' || name
    )
  );
