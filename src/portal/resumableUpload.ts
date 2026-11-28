/**
 * Resumable uploads to Supabase Storage (TUS protocol): large files survive a dropped
 * connection and continue where they stopped; progress is reported as 0–1.
 * Uses the signed-in client's own session, so storage RLS still applies.
 */
import { Upload } from "tus-js-client";
import { portalSupabaseKey, portalSupabaseUrl, supabase } from "./portalSupabase";

export async function uploadResumable(bucket: string, path: string, file: File, onProgress?: (p: number) => void): Promise<void> {
  if (!supabase) throw new Error("Not connected");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  // Small files: one request is faster.
  if (file.size < 6 * 1024 * 1024) {
    onProgress?.(0.1);
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) throw new Error(error.message);
    onProgress?.(1);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${portalSupabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1500, 3000, 6000, 12000, 20000],
      headers: { authorization: `Bearer ${token}`, apikey: portalSupabaseKey, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
      onError: (err) => reject(new Error(/413|too large/i.test(String(err)) ? `${file.name} is too large.` : "Upload interrupted — please try again; it will resume.")),
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    });
    // Network drops inside this upload are retried and resumed from the last chunk.
    upload.start();
  });
}
