import { supabase } from "../lib/supabase";

/** Fetch a Studio OS server route with the owner's Supabase session token. */
export async function studioApi<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
  const res = await fetch(path, {
    method: init.method || (init.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}
