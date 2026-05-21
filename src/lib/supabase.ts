import { createClient } from "@supabase/supabase-js";

// Check environment variables
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Standard helper to check configuration details
export function getSupabaseDetails() {
  return {
    isConfigured: isSupabaseConfigured,
    url: supabaseUrl || "Not Provided",
    keyPlaceholder: supabaseAnonKey ? "••••••••••••••••" : "Not Provided",
  };
}
