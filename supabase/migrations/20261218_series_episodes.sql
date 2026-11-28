-- Multi-episode series: each stage can belong to an episode; projects store episode_count.
alter table public.studio_gates add column if not exists episode int check (episode is null or episode between 1 and 500);
alter table public.studio_projects add column if not exists episode_count int check (episode_count is null or episode_count between 1 and 500);
grant select (episode), insert (episode), update (episode) on public.studio_gates to authenticated;
grant select (episode_count), insert (episode_count), update (episode_count) on public.studio_projects to authenticated;
create index if not exists studio_gates_project_episode on public.studio_gates (project_id, episode, order_index);

create or replace view public.portal_gates as
 SELECT g.id, g.project_id, g.order_index, g.name, g.needs_client_approval, g.status, g.started_at,
    g.sent_for_approval_at, g.approved_at, g.revision_round, g.revisions_included, g.client_comment, g.due_date, g.episode
   FROM studio_gates g
   JOIN portal_projects p ON p.id = g.project_id
  WHERE g.portal_visible = true AND g.archived_at IS NULL;

create or replace view public.portal_projects as
 SELECT id, code, title, client_id, type, status, hard_deadline, promised_date,
    promised_date AS forecast_date,
    health, cover_image_url, emoji, review_link_url, runtime_seconds, aspect_ratios,
    ( SELECT g.name FROM studio_gates g
       WHERE g.id = p.current_gate_id AND g.portal_visible = true AND g.archived_at IS NULL) AS current_stage,
    updated_at, closed_at, episode_count
   FROM studio_projects p
  WHERE portal_visible = true AND archived_at IS NULL
    AND status = ANY (ARRAY['lead','quoted','active','on_hold','parked','delivered','paid'])
    AND client_id IN ( SELECT portal_client_ids() AS portal_client_ids);
