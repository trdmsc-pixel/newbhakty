-- Studio hours: 10:30 am – 6:30 pm IST.
alter table public.studio_settings alter column studio_closes_at set default '18:30';
update public.studio_settings set studio_opens_at = '10:30', studio_closes_at = '18:30' where archived_at is null;
alter table public.studio_settings alter column work_days set default '{1,2,3,4,5}';
update public.studio_settings set work_days = '{1,2,3,4,5}' where archived_at is null;
