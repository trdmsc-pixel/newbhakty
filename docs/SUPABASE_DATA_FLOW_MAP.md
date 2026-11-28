# Supabase Data Flow Map

```
            STUDIO OS (owner)                         CLIENT PORTAL (contact)
   StudioOSContext / supabaseSync                 PortalApp (tcs-client-portal-auth)
              │ write studio_* (RLS: owner)                   ▲ read portal_* views
              ▼                                               │ (filtered by portal_client_ids())
        ┌──────────────── Postgres (kiynfcgdtmfcfmkgsyxo) ────────────────┐
        │ studio_* base tables ──triggers──► studio_portal_notifications  │
        │        ▲                              │ email_status=pending     │
        │        │ SECURITY DEFINER portal_* RPCs│                         │
        └────────┼──────────────────────────────┼─────────────────────────┘
                 │                              ▼
   client actions (approve, changes,    server/phase9/portalNotify.ts
   message, upload, voice, sketch)      (60 s grace → re-check → 1 email/client,
                                         respects email_pref)
```

## Studio OS → Portal
| Studio action | Record | Portal sees via | Client notified |
|---|---|---|---|
| Create/edit project | `studio_projects` | `portal_projects` | no (status change: bell only) |
| Stage status / due date | `studio_gates` | `portal_gates` | bell; email only for `waiting_on_client` (review_ready) |
| Share version / final | `studio_deliverables.shared_with_client` | `portal_deliverables` | bell + email (new_version / final_delivery) |
| Send note | `studio_portal_messages` (`from_studio`) | `portal_messages` | bell + email (message) |
| Invoice | `studio_payments` | `portal_invoices` | none today |
| Revision status | `studio_tasks` (source portal) | `portal_revisions` | bell |

## Portal → Studio OS
| Client action | RPC / route | Lands in | Studio sees |
|---|---|---|---|
| Approve stage | `portal_approve_gate` | `studio_gates.status`, `studio_activity_log`, note → `studio_portal_messages` | realtime, Today feed, bell count |
| Request changes | `portal_request_changes` | `studio_tasks` (source=portal, round) | Client changes tab, Tasks |
| Message | `portal_send_message` | `studio_portal_messages` | Emails/notes, Today feed |
| Upload | Storage `client-uploads/<client_id>/…` + `portal_add_upload` | `studio_client_uploads` + notification | Files & versions → "From the client" |
| Voice note / sketch | `aiMedia.ts` routes | `studio_portal_messages` / `studio_review_sketches` | project notes / review |

## Realtime
Studio OS subscribes to `studio_*` changes; portal subscribes to its own notifications + private presence channel `presence:client:<id>` (RLS on `realtime.messages`). New features add tables to the same publication; the portal gets updates only through RLS-filtered tables or by refetching its views on a notification ping — never by widening RLS.

## Invariants
1. One source of truth: every portal row is a filtered projection of a `studio_*` row.
2. Clients never write `studio_*` directly — only through RPCs that validate ownership with `portal_client_ids()`.
3. Every client action writes `studio_activity_log` and raises a studio-side signal.
4. Dates: `promised_date` / `due_date` are owner-set; the portal never sees `forecast_date`.
