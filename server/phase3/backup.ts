import type { SupabaseClient } from "@supabase/supabase-js";

const TABLES = [
  "studio_settings",
  "studio_members",
  "studio_clients",
  "studio_client_contacts",
  "studio_projects",
  "studio_gates",
  "studio_tasks",
  "studio_generation_blocks",
  "studio_time_entries",
  "studio_payments",
  "studio_expenses",
  "studio_deliverables",
  "studio_inbox_items",
  "studio_email_threads",
  "studio_holidays",
  "studio_activity_log",
  "studio_notifications",
];
const BUCKET = "studio-os-backups";
const KEEP_DAYS = 30;

export async function runBackup(sb: SupabaseClient) {
  const snapshot: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const { data, error } = await sb.from(table).select("*").range(from, from + 999);
      if (error) break;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    snapshot[table] = rows;
    counts[table] = rows.length;
  }

  const day = new Date().toISOString().slice(0, 10);
  const path = `studio-os-${day}.json`;
  const body = JSON.stringify({ version: 1, created_at: new Date().toISOString(), counts, tables: snapshot });
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, Buffer.from(body, "utf8"), {
    contentType: "application/json",
    upsert: true,
  });
  if (upErr) throw new Error(`Backup upload failed: ${upErr.message}`);

  // Retention
  const { data: files } = await sb.storage.from(BUCKET).list("", { limit: 200 });
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  const stale = (files || [])
    .filter((f) => /^studio-os-\d{4}-\d{2}-\d{2}\.json$/.test(f.name))
    .filter((f) => new Date(f.name.slice(10, 20)).getTime() < cutoff)
    .map((f) => f.name);
  if (stale.length) await sb.storage.from(BUCKET).remove(stale);

  await sb.from("studio_gmail_processed").delete().lt("processed_at", new Date(Date.now() - 45 * 86400000).toISOString());

  return { path, bytes: body.length, counts, pruned: stale.length };
}
