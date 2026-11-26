alter table public.studio_ingest_tokens add column if not exists scope text not null default 'ingest' check (scope in ('ingest','claude'));
