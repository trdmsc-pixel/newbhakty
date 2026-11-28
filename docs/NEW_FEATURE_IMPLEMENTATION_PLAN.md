# New Feature Implementation Plan

Governing rule: **every client-facing feature has a Studio OS screen that controls it.** Everything below extends existing `studio_*` tables or adds small owner-controlled tables beside them, exposed to clients only through `portal_*` views and `portal_*` RPCs (owner-run view + `portal_client_ids()` filter; SECURITY DEFINER RPCs with `anon` revoked, input validated, ownership checked).

Legend: **Ext** = extend existing · **New** = new table/view/RPC · **SOS** = Studio OS admin UI · **Portal** = client UI

---

## Phase 1a — Immediate fixes (from your message, small, no new modules)

| # | Fix | How | Touches |
|---|---|---|---|
| 1 | Today feed items open the exact place | Each feed item carries a target `{project, tab, gateId?, deliverableId?, uploadId?}`; `openProject(id, {tab, focus})` scrolls/highlights it | `TodayActivity.tsx`, `ProjectDetailScreen.tsx`, context `openProject` |
| 2 | Studio OS bell → popover like the portal's | Popover listing client events (approvals, change requests, messages, uploads) + `studio_notifications` rows; click = deep link (uses existing `url` column); "mark all read" | `StudioOSApp.tsx`, new `StudioBell.tsx` |
| 3 | Delete client uploads in Studio OS | Delete button on each "From the client" file (confirm, "download first?" hint) → server route removes the storage object **and** archives the row → space freed | `ProjectDeliverables.tsx`, new owner-only route |
| 4 | Message button | Remove the floating bubble. Put a **Messages** icon button in the portal top bar beside the bell, with unread count; opens a right-side drawer, mail-style (threads by project, subject line, compose with attachments). | `PortalApp.tsx` |
| 5 | Portal sidebar to match Studio OS | Same width/spacing/typography as Studio OS: brand block, grouped nav with active pill + glow, counts, collapse, studio clock & account at the bottom; content uses full width in a 2-column grid | `PortalApp.tsx`, `PortalExtras.tsx`, css |
| 6 | Security: public write on `images`/`videos` buckets | Replace "Allow public insert/update/delete" with owner-only policies (public read stays) | 1 migration |

### Client uploads storage — decision needed
You asked for GitHub storage. The repo is **public**, so files there are readable by anyone with the link, and deleting from git doesn't free space (history keeps it).

| Option | Privacy | Delete frees space | Effort |
|---|---|---|---|
| **A. Keep Supabase private bucket `client-uploads` (recommended)** | Private, signed links | Yes, immediately | Done — add delete only |
| B. New **private** GitHub repo just for client files, served through our server with a token | Private | No (history) unless we squash the branch periodically | Medium; 100 MB/file limit |
| C. Public `media` branch | **Public** | No | Not acceptable for client files |

## Phase 1 — Core portal enhancements
- **A. Your attention required** (Portal + SOS). `New view portal_attention` built only from existing records: gates `waiting_on_client`, client-responsibility tasks (see G), unread studio messages, pending change-request proposals (Phase 4). Studio OS decides what appears by setting gate status / task responsibility — no new task store. Dashboard additions: action badge, "new since last visit" (uses `studio_portal_notifications.read_at`), next milestone, latest update, unread messages.
- **Activity feed per project** (Portal). `New view portal_activity` over `studio_activity_log` + messages + deliverables, client-safe kinds only. SOS already logs.
- **Approval history.** `New table studio_approvals` (entity_type, entity_id, version_id, decision, comment, contact_id, created_at). `portal_approve_gate` / `portal_request_changes` also insert here (Ext). SOS: history list on each stage; Portal: "Approved by … on …".
- **Files.** Ext `studio_client_uploads` + `studio_deliverables` with `category` (brief, script, storyboard, character_ref, environment, brand, audio, music, raw_footage, review_video, final) and `tags text[]`. Portal Files: category filter, previews (image/video/audio/PDF), upload progress. SOS: same categories, delete, storage usage.
- **Deliverables & versions.** Group versions under one title; "compare with previous" link; download permission flag (Ext `studio_deliverables.downloadable`).

## Phase 2 — AI filmmaking structure
- **Production tracker** `New table studio_shots` (project_id, gate_id?, episode int?, sequence text, scene text, shot_code, title, description, camera_angle, camera_move, duration_s, status (internal), client_status (mapped), preview_deliverable_id, final_deliverable_id, assignee_member_id, sort, portal_visible). Sequence/scene stay as fields (no extra tables) until you need per-scene metadata. Internal statuses map to client labels (Generating/Internal review → "In production"; failed experiments never shown). SOS: Production tab on project (grid by episode → sequence → scene, bulk status, assign). Portal: read-only tree + shots in Client Review.
- **Character & Visual Bible + Creative Hub** `New tables studio_assets` (kind: character, environment, costume, prop, vehicle, brand, background, palette, cinematography, brief, treatment, script, storyboard, moodboard, vo_script, music_ref; name, description, fields jsonb, status, approved_version_id, portal_visible) and `studio_asset_versions` (file via existing `studio-review` bucket, notes). Links shots ↔ assets via `studio_shot_assets`. Clients approve/comment through `portal_review_asset(asset_id, version_id, decision, comment)` → `studio_approvals`; they never overwrite the reference. SOS: "Characters & Assets" and "Creative Hub" tabs.
- **Creative Decision Register** = view over `studio_assets` approval state + history (no separate table).

## Phase 3 — Reviews & collaboration
- `New table studio_review_comments` (deliverable_id, timecode, frame_path, parent_id, body, author side/contact/member, resolved_at). Existing `studio_review_sketches` and voice notes attach by `comment_id`. RPCs `portal_add_review_comment`, `portal_reply`, `portal_reopen`. SOS: comment list beside the player, reply, resolve; resolving a client comment can tick the linked revision task.
- Version compare (A/B, side-by-side or wipe) inside `ReviewMedia.tsx`.
- Messages threads: Ext `studio_portal_messages` with `parent_id`, `kind` (message, announcement, meeting_note), `attachments jsonb`. Internal notes stay in `studio_tasks`/owner tables — never in portal views.

## Phase 4 — Commercial
- **Change requests** `New table studio_change_requests` (project, contact, description, status submitted → under_review → proposed → accepted/rejected, proposed_amount, currency, proposed_days, decided_at, decided_by). Portal RPCs `portal_submit_change_request`, `portal_decide_change_request`. SOS: queue + "propose cost/time" form; accepting **never** auto-edits invoices or dates — it creates a task "Update scope/invoice" for you.
- **Permissions**: Ext `studio_client_contacts.portal_role` (admin, approver, reviewer, finance, viewer). Enforced inside each RPC and in `portal_invoices` (finance/admin only). SOS: role dropdown on the contact.
- **Notification preferences** per kind: Ext `email_pref` → jsonb map.
- **Reports**: printable project report page generated from views (progress, approvals, milestones, deliverables, revisions, episodes).
- **Timeline/tasks**: Ext `studio_tasks` with `responsibility` (client/studio), `parent_task_id`, `depends_on uuid[]`; Gantt view in SOS Timeline and a read-only one in the portal. Studio OS remains the only writer of dates; client delays keep feeding `client_delay_days` in `forecastEngine.ts`.

## Phase 5 — AI assistant
Portal "Ask" answers only from the client's own `portal_*` views (server builds context from RLS-filtered reads), cites records, says "I don't know" otherwise. Plus production summaries, reminders and bottleneck detection for Studio OS.

---

## Process decisions I need from you
1. **Deploy process.** Until now: push to `main` → Vercel production. Your master prompt says: feature branch + dev database, no direct production. Proposed: work on `claude/pensive-knuth-yp4nic`, you review the Vercel **preview** URL, then I merge to `main`. For the database, a **Supabase development branch** (billed per hour by Supabase) to test migrations first — approve the cost, or say "apply additive migrations directly after review".
2. **Client upload storage**: A, B or C above.
3. **Order**: Phase 1a fixes first (small, high value), then Phase 1. OK?
4. Confirm "That needs your address to be seen here" = "Your attention required".
