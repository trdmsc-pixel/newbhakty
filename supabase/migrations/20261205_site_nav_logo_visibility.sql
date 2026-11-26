-- Visibility + display controls for the website's navigation and brand marquee.
-- The admin had "Visible/Hidden" toggles but these columns never existed, so
-- everything showed as Hidden and toggles did nothing.
alter table public.brand_logos
  add column if not exists is_visible boolean not null default true,
  add column if not exists display_mode text not null default 'auto';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'brand_logos_display_mode_check') then
    alter table public.brand_logos add constraint brand_logos_display_mode_check check (display_mode in ('auto', 'original', 'light'));
  end if;
end $$;

alter table public.navigation_menu
  add column if not exists is_visible boolean not null default true;
