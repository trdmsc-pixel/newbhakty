# Client Portal — Audit (Phase 0)

## Auth & session
- Separate Supabase client, storage key `tcs-client-portal-auth` (`src/portal/portalSupabase.ts`). Owner session in Studio OS is untouched. **Keep.**
- Contact linking via `portal_link_contact()`; identity via `portal_contact_id()` / `portal_client_ids()`.

## Reads (views, all owner-run and client-filtered)
| View | Used for |
|---|---|
| `portal_projects` | project list/detail; `forecast_date` masked to `promised_date`; `episode_count` |
| `portal_gates` | stages, `due_date`, `episode`, portal-visible only |
| `portal_tasks` | milestones & to-dos (`portal_visible` tasks) |
| `portal_revisions` | "Your requested changes" rounds + live status |
| `portal_deliverables` | versions, finals, `client_summary` |
| `portal_invoices` | invoices from `studio_payments` |
| `portal_messages` | notes both ways, receipts, `gate_id` |
| `studio_portal_notifications` (RLS) | bell + chime + toast |
| `studio_client_uploads` (RLS) | client's own uploads |

## Writes (RPCs, all SECURITY DEFINER, `authenticated` only, `anon` revoked)
`portal_approve_gate`, `portal_request_changes` (creates `studio_tasks` with `source='portal'`), `portal_send_message`, `portal_mark_messages_read/delivered`, `portal_mark_notifications_read`, `portal_add_upload` (checks folder = client id), `portal_set/get_email_pref`, plus voice note & sketch via server routes in `aiMedia.ts`.

## UI inventory (`PortalApp.tsx` 2,200 lines, `PortalExtras.tsx` 780)
- Shell: fixed `PortalSidebar` (lg+), mobile `PortalNav`, sticky top bar with bell, floating **Message us** button + slide-up panel, floating **Ask**.
- Projects: review queue (one-tap approve), list/cards, filters, search.
- Project detail: hero + expected delivery, requested-changes tracker, production stages stepper (episodes), deliverables & versions, milestones & to-dos, invoices, "Send files to the studio".
- Other tabs: Timeline (holidays + coming up), Files library, Invoices hub, Account (email preference).

## Issues seen in your screenshot / message
1. **Message us** floats and drifts; collides with the Ask button. → Move into the top bar next to the bell as a mail-style "Messages" popover/drawer (plan §I).
2. **Sidebar** looks plain compared with Studio OS (no brand block, no grouped sections, no active glow, weak footer). → Reuse Studio OS sidebar styling (plan §1a).
3. **Content is narrow** (max-width ~750 px centred) leaving large empty areas on desktop. → Use the full content width with a 2-column grid like Studio OS.
4. "That needs your address to be seen here" — I've read this as **"Your attention required"** (Module A). Please confirm.

## What must not change
Sidebar sections, projects dashboard filters/search/sort, list & card views, project detail card order, approvals, upload flow, invoices, account, logout, lavender background / white cards / purple accents.
