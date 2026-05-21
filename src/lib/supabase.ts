import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------
// IMPORTANT: Vite statically replaces import.meta.env.VITE_* ONLY
// when accessed via direct dot-notation (e.g. import.meta.env.VITE_SUPABASE_URL).
// Dynamic bracket notation like import.meta.env[key] does NOT get replaced
// at build time and will be undefined in production builds.
// ---------------------------------------------------------------

// Safely read each env var with direct dot-notation access for Vite static replacement
let rawSupabaseUrl = "";
let rawSupabaseAnonKey = "";

try {
  // Direct property access — Vite will statically inline these at build time
  rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  if (!rawSupabaseUrl) {
    rawSupabaseUrl = (import.meta.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  }
  if (!rawSupabaseUrl) {
    console.error("Missing environment variable: VITE_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is not configured.");
  }

  rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!rawSupabaseAnonKey) {
    rawSupabaseAnonKey = (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  }
  if (!rawSupabaseAnonKey) {
    console.error("Missing environment variable: VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is not configured.");
  }
} catch (e) {
  console.error("Error occurred while reading Supabase environment variables:", e);
}

// Strip trailing slashes from the URL to prevent double-slash path construction
export const supabaseUrl = rawSupabaseUrl ? rawSupabaseUrl.replace(/\/+$/, "") : "";
export const supabaseAnonKey = rawSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = (() => {
  if (!isSupabaseConfigured) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Failed to initialize Supabase client with URL:", supabaseUrl, err);
    return null;
  }
})();

// Standard helper to check configuration details
export function getSupabaseDetails() {
  return {
    isConfigured: isSupabaseConfigured,
    url: supabaseUrl || "Not Provided",
    keyPlaceholder: supabaseAnonKey ? "••••••••••••••••" : "Not Provided",
  };
}
