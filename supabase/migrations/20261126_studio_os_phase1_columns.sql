-- Additive UI sync columns used by Studio OS Phase 1 frontend
alter table public.studio_projects
  add column if not exists pinned boolean not null default false;

alter table public.studio_tasks
  add column if not exists promised_to_name text,
  add column if not exists channel text;
