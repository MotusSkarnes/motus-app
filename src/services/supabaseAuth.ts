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
  const role = parseRole(user.app_metadata?.role);
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

export async function signInWithSupabase(email: string, password: string): Promise<AuthUser | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return mapSupabaseUserToAuthUser(data.user);
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
