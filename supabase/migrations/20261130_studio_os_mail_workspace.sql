-- ============================================================================
-- Studio OS — Mail workspace: signatures + granted scopes
-- ============================================================================
alter table public.studio_gmail_accounts
  add column if not exists granted_scopes text,
  add column if not exists signature_text text,
  add column if not exists signature_html text,
  add column if not exists signature_enabled boolean not null default true;

alter table public.studio_settings
  add column if not exists default_signature_text text not null default E'Shyam Sharma\nThe Chanting Studio\nthechantingstudio.in',
  add column if not exists default_signature_html text;

-- Sensible starting signatures (domain spelled thechantingstudio.in).
update public.studio_gmail_accounts set signature_text = E'Shyam Sharma\nFounder, The Chanting Studio\nthechantingstudio.in'
  where email = 'shyam@thechantingstudio.in' and signature_text is null;
update public.studio_gmail_accounts set signature_text = E'The Chanting Studio\nstudio@thechantingstudio.in · thechantingstudio.in'
  where email = 'studio@thechantingstudio.in' and signature_text is null;
update public.studio_gmail_accounts set signature_text = E'Accounts · The Chanting Studio\naccounts@thechantingstudio.in · thechantingstudio.in'
  where email = 'accounts@thechantingstudio.in' and signature_text is null;
