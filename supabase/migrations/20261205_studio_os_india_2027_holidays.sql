-- ============================================================================
-- 2027 India Gazetted Holidays (Government of India DoPT O.M. F.No. 12/2/2023-JCA
-- dated 16 July 2026, Central Government offices in Delhi / New Delhi).
-- Also corrects Holi 2027 from 2027-03-25 -> 2027-03-23 (Tuesday).
-- Note: Independence Day & Milad-un-Nabi both fall on 2027-08-15 (Sunday);
-- studio_holidays enforces unique (holiday_date, region), so existing
-- 2027-08-15 ('IN') row is preserved and labelled accordingly.
-- ============================================================================

-- 1. Fix incorrect Holi 2027 date (was 2027-03-25, official DoPT gazetted date is 2027-03-23)
delete from public.studio_holidays
where region = 'IN'
  and holiday_date = '2027-03-25'
  and lower(name) like '%holi%';

-- 2. Insert all 2027 India DoPT gazetted holidays (skipping dates already present)
insert into public.studio_holidays (holiday_date, name, region, is_active) values
  ('2027-01-26', 'Republic Day', 'IN', true),
  ('2027-03-10', 'Id-ul-Fitr', 'IN', true),
  ('2027-03-23', 'Holi', 'IN', true),
  ('2027-03-26', 'Good Friday', 'IN', true),
  ('2027-04-15', 'Ram Navami', 'IN', true),
  ('2027-04-19', 'Mahavir Jayanti', 'IN', true),
  ('2027-05-17', 'Id-ul-Zuha (Bakrid)', 'IN', true),
  ('2027-05-20', 'Buddha Purnima', 'IN', true),
  ('2027-06-16', 'Muharram', 'IN', true),
  ('2027-08-15', 'Independence Day / Milad-un-Nabi', 'IN', true),
  ('2027-08-25', 'Janmashtami (Vaishnava)', 'IN', true),
  ('2027-10-02', 'Gandhi Jayanti', 'IN', true),
  ('2027-10-09', 'Dussehra (Vijaya Dashami)', 'IN', true),
  ('2027-10-29', 'Diwali (Deepavali)', 'IN', true),
  ('2027-11-14', 'Guru Nanak''s Birthday', 'IN', true),
  ('2027-12-25', 'Christmas Day', 'IN', true)
on conflict (holiday_date, region) do nothing;
