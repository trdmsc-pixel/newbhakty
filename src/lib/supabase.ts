import { createClient } from "@supabase/supabase-js";

// Helper to safely read environment variables with error catching
const getEnvVariable = (key: string): string => {
  try {
    if (typeof import.meta === "undefined" || !import.meta.env) {
      console.warn(`import.meta.env is undefined. Cannot read key: ${key}`);
      return "";
    }
    const val = import.meta.env[key];
    if (val === undefined || val === null) {
      return "";
    }
    if (typeof val !== "string") {
      console.warn(`Environment variable ${key} is malformed: expected string, got ${typeof val}`);
      return "";
    }
    return val.trim();
  } catch (err) {
    console.error(`Unhandled error while accessing environment variable ${key}:`, err);
    return "";
  }
};

let rawSupabaseUrl = "";
let rawSupabaseAnonKey = "";

try {
  rawSupabaseUrl = getEnvVariable("VITE_SUPABASE_URL") || getEnvVariable("NEXT_PUBLIC_SUPABASE_URL");
  if (!rawSupabaseUrl) {
    console.error("Missing environment variable: VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  rawSupabaseAnonKey = getEnvVariable("VITE_SUPABASE_ANON_KEY") || getEnvVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!rawSupabaseAnonKey) {
    console.error("Missing environment variable: VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");
  }
} catch (e) {
  console.error("Error occurred while verifying environment variables:", e);
}

// Strip out any trailing slashes from the URL
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

