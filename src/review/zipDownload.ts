/**
 * Bulk download: fetch files (signed URLs) and save them as one .zip, built in the browser.
 * Duplicate names get " (2)" etc. Progress is reported as 0–1.
 */
import { zip } from "fflate";

export async function downloadZip(files: Array<{ name: string; url: string }>, zipName: string, onProgress?: (p: number) => void): Promise<void> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Map<string, number>();
  let i = 0;
  for (const f of files) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`Couldn't fetch ${f.name}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const n = used.get(f.name) || 0;
    used.set(f.name, n + 1);
    const name = n ? f.name.replace(/(\.[^.]*)?$/, ` (${n + 1})$1`) : f.name;
    entries[name] = buf;
    onProgress?.(++i / (files.length + 1));
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => zip(entries, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out))));
  const blob = new Blob([data], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  onProgress?.(1);
}
