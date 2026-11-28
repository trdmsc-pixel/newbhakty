# Studio OS — Integration Audit (Phase 0)

Audit date: 28 Nov 2026 · Read-only · No code, schema or data was changed.

## 1. Environment verification

| Check | Result |
|---|---|
| Supabase project | `portfolio`, ref `kiynfcgdtmfcfmkgsyxo` |
| How the app finds it | Frontend reads `VITE_SUPABASE_URL` (`src/lib/supabase.ts`, `src/portal/portalSupabase.ts`); server reads `SUPABASE_URL` → `VITE_SUPABASE_URL` (`server/studioOsRoutes.ts:30`). Values live only in Vercel env — not in the repo. |
| Proof the live app uses this project | The deployed Studio OS server (Claude connector `get_studio_overview`) returned **26 projects / 9 clients**; the same counts come back from `kiynfcgdtmfcfmkgsyxo` directly (26 projects, 392 gates, 11 deliverables, 9 clients, 1 client upload). The client upload in your screenshot (`Raw_anamorphic_cinema_frame…jpeg`) is the 1 row in `studio_client_uploads`. |
| Could not verify | The production JS bundle itself (the domain is blocked from this sandbox). Recommend one manual check: Vercel → Settings → Environment Variables → `VITE_SUPABASE_URL` contains `kiynfcgdtmfcfmkgsyxo`. |
| Secrets | None printed or copied. Service-role key is server-only (`getServiceSupabase()`). |

## 2. What Studio OS is today

**Frontend** `src/studio-os/`
- `StudioOSApp.tsx` — shell (fixed sidebar, top bar, bell, routes), realtime notify-flush timer, update banner.
- `StudioOSContext.tsx` + `supabaseSync.ts` — single in-memory store hydrated from `studio_*` tables, realtime subscriptions, optimistic writes. **This is the one write path for owner data.**
- Screens: Today, Projects, ProjectDetail (tabs: Milestones, Client changes, Overview, Tasks, Board, Files & versions, Emails, Money), Tasks, Board, Timeline, Clients, Mail, Secondary (team/settings).
- Engines: `forecastEngine.ts` (planned vs projected dates, client vs studio delay), `schemas.ts` (zod), `api.ts` (server calls).

**Server** `server/`
- `studioOsRoutes.ts` — auth helpers (`verifyCronOrOwnerAuth`), cron, digest, notifications insert.
- `phase3/*` Gmail sync + inbox engine · `phase6/mail.ts` mail workspace · `phase8/clients.ts` client accounts/portal invites.
- `phase9/aiMedia.ts` AI (brief, shot-log, note-check, scope alert, poster pick) · `mailScan.ts` Gmail → client/project · `claudeMcp.ts` Claude connector · `portalNotify.ts` client emails (60 s grace, grouped, `email_pref`).
- `media.ts` — **site media on the public GitHub `media` branch** (see §5).

## 3. Database (deployed, verified)

**Tables (all RLS on):** studio_clients, studio_client_contacts, studio_projects, studio_gates, studio_tasks, studio_generation_blocks, studio_time_entries, studio_payments, studio_expenses, studio_deliverables, studio_activity_log, studio_notifications, studio_email_threads, studio_inbox_items, studio_project_members, studio_members, studio_portal_messages, studio_portal_notifications, studio_client_uploads, studio_review_sketches, studio_ai_insights, studio_settings, studio_holidays, studio_gmail_accounts, studio_gmail_processed, studio_ingest_tokens, studio_push_subscriptions.

**Owner-side helpers:** `studio_os_is_owner()`, `studio_os_member_id()`, `studio_os_can_access_project/client()`, `studio_projects_guard` trigger, `studio_notify_client()` (+ triggers `trg_notify_gate/deliverable/project/revision/message`, `trg_approval_note_message`).

**Storage buckets:** `studio-review` (private, owner ALL + portal read), `client-uploads` (private, per-client folder policies), `studio-receipts` (private), `studio-os-backups` (private), `site-media` (private), `images`/`videos`/`chat-media` (**public**).

## 4. Migration drift (repo vs deployed)

Deployed history has 33 entries; repo has 29 files. Names line up except:

| Repo file | In deployed history? | Effect present in DB? |
|---|---|---|
| `20261120_rls_hardening.sql` (website tables) | No | Not verified — website tables, outside Studio OS. Check before any site work. |
| `20261205_studio_os_india_2027_holidays.sql` | No | **Yes** — 19 holidays dated 2027 exist (applied via SQL). |
| `20261215_studio_hours.sql` | No | **Yes** — 10:30–18:30, Mon–Fri. |

Deployed-only entries (no matching file): `studio_os_phase1_triggers`, `studio_os_phase3_processed`, `studio_projects_grant_closed_at`, `portal_hide_projected_date_v2`, `portal_projects_episode_count`, plus two pre-Studio-OS website migrations. Their SQL is folded into neighbouring repo files.

**Rule going forward:** every schema change ships as a repo file *and* through `apply_migration` with the same name, so history and repo match 1:1. Never re-run old files.

## 5. Findings that affect the plan

1. **GitHub repo is public.** `raw.githubusercontent.com/trdmsc-pixel/newbhakty/main/package.json` returns 200 without a token, so everything on the `media` branch is world-readable. Client uploads must **not** go there as-is (see plan §H options).
2. **Deleting from GitHub does not free space.** A file removed in a new commit stays in git history; reclaiming space needs a history rewrite of the `media` branch. Supabase Storage `remove()` frees space immediately.
3. **Public write on `images` / `videos` buckets** (policies "Allow public insert/update/delete"). Pre-existing, website-side, high risk: anyone with the anon key can overwrite or delete site media. Recommend fixing in Phase 1 (owner-only writes).
4. **`portal_*` views run as owner** (no `security_invoker`) and filter by `portal_client_ids()` in their WHERE clause; SELECT is granted only to `authenticated`. This is the deliberate pattern and works — new views must copy it exactly (and column-level grants for new base columns).
5. **Studio OS bell** (`StudioOSApp.tsx:540`) only routes to Today; `studio_notifications.url` exists but is unused by the UI → easy deep-links.
6. **Today feed** (`components/TodayActivity.tsx`) only opens the project, not the exact tab/stage/file.
7. **No automated UI tests.** Only `npm run lint` (tsc) and `npm run test:rls` (3 SQL suites). Regression for each phase = tsc + build + RLS suites + the manual checklist doc.
8. **Data oddity:** INT4 Gopashtami Reel has stage 4 `in_work` while stages 5–11 are `approved` (shows "10/11, 91%"). Not a bug in code; a data fix if you want.
