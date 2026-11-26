-- Studio hours: 10:30 am – 6:30 pm IST.
alter table public.studio_settings alter column studio_closes_at set default '18:30';
update public.studio_settings set studio_opens_at = '10:30', studio_closes_at = '18:30' where archived_at is null;
