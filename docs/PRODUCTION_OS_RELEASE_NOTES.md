# Creative Production OS — Release notes (28 Nov 2026)

Branch: `claude/pensive-knuth-yp4nic` → review on the Vercel preview → merge to `main`.
Rollback: see `docs/ROLLBACK.md` (code commit `627a6c7`, DB copy in schema `backup_20261128`).

## Phase 1a — immediate fixes
| Fix | Where |
|---|---|
| Today feed + Today client-update cards open the exact tab and item (stage, file, upload, comment, change request) with a highlight | `TodayActivity.tsx`, `TodayScreen.tsx`, `ClientPulse.tsx` (`useOpenUpdate`), `StudioOSContext.tsx` (`openProject(id, {tab, focus})`, `?project=&tab=&focus=` links) |
| Studio OS bell is a pop-out list like the portal's; every item is clickable | `components/StudioBell.tsx` |
| Client uploads: Download, Delete (removes the file from private storage — frees space), category | `ProjectDeliverables.tsx` `ClientUploadsPanel` |
| Portal: floating "Message us" bubble removed → **Messages** button in the top bar next to the bell (and in the sidebar), opening a mail-style drawer | `PortalProduction.tsx` `MessagesButton`, `MailInbox` |
| Portal sidebar restyled to match Studio OS (grouped nav, pill, badges, profile + sign-out); content uses the full width | `PortalApp.tsx` `PortalSidebar` |
| Security: anyone could upload/overwrite/delete website images & videos → owner-only writes | migration `20261221` |

## Phase 1 — core portal
- **Your attention required** on the dashboard: stage reviews (one-tap approve), references/documents to approve, shots to review, change proposals, the client's to-dos (tick off), unread messages. Everything comes from Studio OS records.
- **Client to-dos**: in Studio OS Tasks, the 👤 toggle makes a task the client's; it shows in the portal and the client can tick it off (`portal_complete_task`).
- **Approval history** (`studio_approvals`): every stage approval/change request is logged automatically, plus assets, shots and change proposals. Studio OS: Overview tab + per asset. Portal: Reviews & Approvals.
- **Files**: categories on studio deliverables and client uploads; portal Files has category filters, search, "Sent by your team" with storage used.
- **Project activity feed** + **printable project report (PDF)** in the portal's Activity section.

## Phase 2 — AI filmmaking structure
- **Production tracker** (`studio_shots`): episode → sequence → scene → shot; angle, move, duration, assignee, preview/final version, internal notes (never shown), bulk status, paste a shot list. Studio OS: **Production** tab. Portal: **Production** section with simplified statuses; shots in "Client review" can be approved or sent back.
- **Creative Hub + Character & Visual Bible** (`studio_assets`, `studio_asset_versions`, `studio_shot_assets`): characters, environments, costumes, props, vehicles, brand, backgrounds, palettes, cinematography; briefs, concepts, treatments, scripts, screenplays, storyboards, shot lists, moodboards, art direction, VO scripts, music refs. Versions (image upload or link), "Send for client review", lock approved references, download permission, link characters to shots. Studio OS: **Creative & Bible** tab. Portal: **Creative Hub** and **Characters & Assets** sections.
- **Creative decision register** in both apps.

## Phase 3 — reviews & collaboration
- **Video review studio** (portal → Reviews & Approvals): pin the current moment, comment, attach a screenshot, threaded replies, resolve/reopen, **compare two versions side by side** with time sync. Stored in `studio_review_comments`.
- Studio OS → Files & versions: **Review comments** panel (reply, resolve, jump to time, see screenshots). Studio replies ring the client.
- **Messages** are now mail-style threads with subjects, attachments (private storage) and project tags. Studio OS → Emails tab: **Messages & notes** composer for messages, **announcements** and **meeting notes** (summary / decisions / next steps).

## Phase 4 — commercial
- **Change requests** (`studio_change_requests`): client submits → Studio OS reviews → proposes cost/days → client accepts/declines. Accepting **never** edits invoices or dates; it creates a high-priority task "Update scope & invoice". Studio OS: Client changes tab. Portal: Reviews & Approvals.
- **Client roles** (`studio_client_contacts.portal_role`): Admin · Approver · Reviewer · Finance · Viewer — set in Studio OS → Clients (dropdown on each portal contact). Enforced in the database (approvals need Admin/Approver, comments need non-Viewer/Finance, invoices visible only to Admin/Finance). Existing contacts default to Admin, so nothing changes until you set a role.
- **Notification preferences**: clients choose which email types they get (Account); the mailer honours it.
- **Gantt timeline** in the portal's Timeline page (studio-set dates only).

## Phase 5 — AI
- Portal **Ask** assistant now also knows shots, approved references, decisions, change requests, client to-dos and meeting notes — read through the client's own permission-checked views, so it can't see other clients or internal notes.

## Database (applied live, additive only)
`20261221_production_os.sql`, `20261222_revoke_trigger_fn_execute.sql`.
New tables: studio_approvals, studio_shots, studio_assets, studio_asset_versions, studio_shot_assets, studio_review_comments, studio_change_requests.
New views: portal_shots, portal_assets, portal_asset_versions. Extended views: portal_tasks, portal_messages, portal_deliverables, portal_invoices.
New RPCs: portal_project_ids, portal_contact_role, portal_me, portal_complete_task, portal_review_shot, portal_review_asset, portal_add_review_comment, portal_resolve_review_comment, portal_send_thread_message, portal_submit_change_request, portal_decide_change_request, portal_set_email_kinds; portal_add_upload gained `p_category`.

## Tests run
- `tsc --noEmit` clean; `npm run build` (Vite + server bundle) OK.
- Live DB, rolled-back transactions impersonating a real client (CompoSecure):
  - own asset/shot/change request/comment → OK; another client's → `not_found` (all four);
  - submitting a change request on another client's project → `not_found`;
  - raw `studio_shots` / `studio_assets` invisible to clients (0 rows); `internal_notes` never exposed;
  - Reviewer: approve → `not_permitted`, comment → OK, invoices → 0; Viewer: comment → `not_permitted`;
  - anon: RPC → permission denied, view → permission denied;
  - existing `portal_approve_gate` still works and is logged in approval history.
- Supabase security advisors: no new issues (view warnings are the existing portal pattern).

## Follow-up (same day)
- **Timestamp button** in the review studio: pause → "Add timestamp" reads the exact playhead time and writes "At 01:24 — " into the comment; timestamps in comments are clickable and jump the player.
- **Resumable uploads** (TUS, 6 MB chunks) with a progress bar for client uploads and message attachments; dropped connections resume.
- **Download all (.zip)** for client uploads in Studio OS and in the portal's Files.
- **Subtasks & dependencies**: click a task title in Tasks → panel with description, subtasks (progress), "Depends on" with blocked status; list shows "n/m subtasks" and "blocked by" chips.

## Known limitations
- Not clicked through on a phone (both apps need a login).
- 50 MB per file stays (Supabase plan limit).
