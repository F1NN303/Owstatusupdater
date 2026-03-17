import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null | undefined;

// Browser-facing Supabase config is intentionally public. Service-role keys remain server-only.
const DEFAULT_SUPABASE_URL = "https://adijigutpkibobwczbic.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_GzehFO0uWtjYMHotTPZi-g_HzDSMwMZ";

const ENV_VALUES = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
} as const;

function readEnv(name: keyof typeof ENV_VALUES) {
  return String(ENV_VALUES[name] || "").trim();
}

export const supabaseUrl = readEnv("VITE_SUPABASE_URL");
export const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  if (!isSupabaseConfigured) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
  return supabaseClient;
}
