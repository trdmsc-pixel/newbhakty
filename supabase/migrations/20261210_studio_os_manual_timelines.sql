-- Manual delivery timelines: a planned end date per stage, client-visible stage dates
-- and client-visible tasks (title / status / due date only).
alter table public.studio_gates add column if not exists due_date date;
grant select (due_date), insert (due_date), update (due_date) on public.studio_gates to authenticated;

alter table public.studio_ai_insights drop constraint if exists studio_ai_insights_kind_check;
alter table public.studio_ai_insights add constraint studio_ai_insights_kind_check check (kind in ('shot_log','note_check','change_summary','scope_check','daily_brief','media_meta','timeline'));

create or replace view public.portal_gates as
 SELECT g.id, g.project_id, g.order_index, g.name, g.needs_client_approval, g.status, g.started_at,
    g.sent_for_approval_at, g.approved_at, g.revision_round, g.revisions_included, g.client_comment, g.due_date
   FROM studio_gates g
   JOIN portal_projects p ON p.id = g.project_id
  WHERE g.portal_visible = true AND g.archived_at IS NULL;

create or replace view public.portal_tasks as
 SELECT t.id, t.project_id, t.title, t.status, t.due_date, t.completed_at, t.updated_at
   FROM studio_tasks t
   JOIN portal_projects p ON p.id = t.project_id
  WHERE t.portal_visible = true AND t.archived_at IS NULL;
revoke all on public.portal_tasks from anon;
revoke insert, update, delete, truncate, references, trigger on public.portal_tasks from authenticated;
grant select on public.portal_tasks to authenticated;
