# Rollback — back to the 28 Nov 2026 version

## Code (Studio OS + portal)
- Last version before the Production OS work: commit **`627a6c7`** on `main` (deployed and live on 28 Nov 2026).
- Fastest: Vercel → project → Deployments → the deployment for `627a6c7` → **⋯ → Promote to Production** (instant, no rebuild).
- Or in git: `git revert` the merge commit on `main`, or reset `main` to `627a6c7`.

## Database
- Before any change, every `studio_*` table (27 tables) was copied into the schema **`backup_20261128`** (not exposed to the API).
- Schema rollback script: `supabase/rollback/20261221_production_os_rollback.sql` restores the previous views, functions and policies.
- Restore a table's rows: `truncate public.<table>; insert into public.<table> select * from backup_20261128.<table>;` (do this only for tables that must go back; new columns are additive and harmless).
