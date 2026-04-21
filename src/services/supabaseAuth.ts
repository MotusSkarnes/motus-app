import type { AuthUser, Role } from "../app/types";
import { supabaseClient } from "./supabaseClient";

function parseRole(value: unknown): Role {
  return value === "member" ? "member" : "trainer";
}

function mapSupabaseUserToAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): AuthUser {
  const role =
    parseRole(user.app_metadata?.role) === "member"
      ? "member"
      : parseRole(user.user_metadata?.role);
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (user.email ?? "Bruker");
  const memberId =
    typeof user.app_metadata?.member_id === "string"
      ? user.app_metadata.member_id
      : typeof user.user_metadata?.member_id === "string"
      ? user.user_metadata.member_id
      : undefined;

  return {
    id: user.id,
    role,
    name,
    email: user.email ?? "",
    memberId,
  };
}

export type SupabaseSignInResult =
  | { ok: true; user: AuthUser }
  | { ok: false; message: string };

export async function signInWithSupabase(email: string, password: string): Promise<SupabaseSignInResult> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const detailedMessage = error?.message?.trim() || "Ukjent feil fra Supabase.";
    return { ok: false, message: detailedMessage };
  }
  return { ok: true, user: mapSupabaseUserToAuthUser(data.user) };
}

export async function getSupabaseSessionUser(): Promise<AuthUser | null> {
  if (!supabaseClient) return null;
  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();
  if (error || !session?.user) return null;
  return mapSupabaseUserToAuthUser(session.user);
}

export async function signOutSupabase(): Promise<void> {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

export async function verifyRecoveryToken(tokenHash: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const { error } = await supabaseClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) return { ok: false, message: error.message || "Kunne ikke verifisere recovery-lenke." };
  return { ok: true };
}

export async function establishRecoverySessionFromTokens(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const { error } = await supabaseClient.auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });
  if (error) return { ok: false, message: error.message || "Kunne ikke opprette recovery-session." };
  return { ok: true };
}

export async function updateSupabasePassword(password: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message || "Kunne ikke oppdatere passord." };
  return { ok: true };
}

export type InviteMemberResult = {
  ok: boolean;
  message: string;
};

async function extractFunctionErrorMessage(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { message?: unknown; context?: { json?: () => Promise<unknown> } };

  if (typeof candidate.context?.json === "function") {
    try {
      const payload = await candidate.context.json();
      if (payload && typeof payload === "object" && "error" in payload) {
        const value = (payload as { error?: unknown }).error;
        if (typeof value === "string" && value.trim()) return value;
      }
      if (payload && typeof payload === "object" && "message" in payload) {
        const value = (payload as { message?: unknown }).message;
        if (typeof value === "string" && value.trim()) return value;
      }
    } catch {
      // Ignore parse errors and fall back to generic message.
    }
  }

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }
  return null;
}

export async function inviteMemberByEmail(email: string, memberId: string): Promise<InviteMemberResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Supabase er ikke konfigurert." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Ugyldig e-post." };
  }
  if (!memberId.trim()) {
    return { ok: false, message: "Mangler member_id for medlemmet." };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabaseClient.auth.getSession();
  if (sessionError || !session?.access_token) {
    return { ok: false, message: "Ingen gyldig innlogging funnet. Logg ut og inn igjen." };
  }

  const { data, error } = await supabaseClient.functions.invoke("invite-member", {
    body: {
      email: normalizedEmail,
      memberId: memberId.trim(),
      accessToken: session.access_token,
    },
  });

  if (error) {
    const detailed = await extractFunctionErrorMessage(error);
    return { ok: false, message: `Invitasjon feilet: ${detailed ?? "Ukjent feil fra funksjonen."}` };
  }

  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return { ok: true, message: data.message };
  }

  return { ok: true, message: "Invitasjon sendt." };
}
