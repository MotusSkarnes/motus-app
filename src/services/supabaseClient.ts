import { captureAuthParamsBeforeSupabaseInit } from "../app/supabaseAuthBootstrap";
import { createClient } from "@supabase/supabase-js";

captureAuthParamsBeforeSupabaseInit();

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const configuredSupabaseUrl = supabaseUrl ?? "";
export const configuredSupabaseAnonKey = supabaseAnonKey ?? "";
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
        // URL-tokens håndteres manuelt (invite/aktiver) så bruker ikke hopper inn i app før passord er satt.
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
      },
    })
  : null;
