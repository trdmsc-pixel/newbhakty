# Regression Checklist (run after every phase)

Automated: `npm run lint` (tsc) · `npm run build` · server load check (compile `api/index.ts`, import in node) · `npm run test:rls` against the dev DB · Supabase security advisors (no new warnings).

## Studio OS
- [ ] Login / logout, owner session separate from portal
- [ ] Clients: create, edit, contacts, portal invite, email preference
- [ ] Projects: create (normal + series with episodes), edit, status dropdown, bulk select, list/cards, filters, saved views, keyboard shortcuts
- [ ] Stages: status dropdown + confirms, due dates, stage notes & history, Send for approval
- [ ] Tasks: list/board, create, complete, portal-visible toggle
- [ ] Timeline + forecast (planned vs projected, client vs studio delay)
- [ ] Mail: cached load, 10-min refresh, links, attachments, Gmail scan buttons
- [ ] Money: invoices, payments, receipts
- [ ] Today: brief, sent/received feed, 48 h nudge
- [ ] Notifications: bell, client unread count, realtime
- [ ] Claude connector tools still respond

## Client portal
- [ ] Login, password set, logout
- [ ] Projects list/cards, filters (All / In progress / Delivered / Completed & closed), search, sort
- [ ] Project detail: expected delivery (planned only), stages stepper incl. episodes, requested changes, milestones, deliverables & versions, invoices
- [ ] Approve stage (with note), request changes (with timestamp snap), voice note, sketch
- [ ] Upload file → appears in Studio OS project
- [ ] Messages send/receive, read receipts
- [ ] Bell, chime, toast; email preference
- [ ] Timeline, Files, Invoices, Account tabs; mobile nav

## Sync (both directions)
- [ ] New project in SOS appears only in that client's portal
- [ ] Stage / project status change reflects in portal
- [ ] Shared deliverable appears; unshared disappears
- [ ] Invoice appears in portal
- [ ] Client approval / change request / message / upload appear in SOS with activity + notification
- [ ] No duplicate rows after each action; no lost updates
- [ ] Email: only sent items emailed, 60 s grace, one email per client

## Isolation
- [ ] Contact of client A cannot read client B rows through any `portal_*` view, RPC, storage path or realtime channel (RLS test suites + manual two-account check)
- [ ] `anon` cannot execute any `portal_*` RPC

## Visual
- [ ] Before/after screenshots at 390 px, 768 px, 1440 px, light + dark (needs a test client login — please create one; never paste a password in chat)
