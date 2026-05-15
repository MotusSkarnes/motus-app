import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const configuredSupabaseUrl = supabaseUrl ?? "";
export const configuredSupabaseProjectRef = (() => {
  if (!supabaseUrl) return "";
  try {
    const host = new URL(supabaseUrl).hostname;
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
})();

export const supabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Vi håndterer invite/recovery/magic-link selv i useAppState slik at brukeren først får passordskjerm (invite/recovery).
        detectSessionInUrl: false,
      },
    })
  : null;
