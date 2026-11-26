import { createClient } from "@supabase/supabase-js";

/**
 * The portal's own Supabase client with a separate storage key, so a client
 * session never replaces the studio owner's Studio OS session in the same
 * browser (and vice versa). Deliberately does not import lib/supabase.
 */
const url = ((import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "") as string).trim().replace(/\/+$/, "");
const key = ((import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "") as string).trim();

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { storageKey: "tcs-client-portal-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
