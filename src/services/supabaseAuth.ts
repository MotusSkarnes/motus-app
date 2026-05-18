import type { AuthUser, Role } from "../app/types";
import { supabaseClient } from "./supabaseClient";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TRAINER_EMAIL_DOMAIN = "@motus-skarnes.no";

/**
 * Kanonisk app-origin for e-postlenker (invitasjon, OTP, passord).
 * Sett `VITE_SITE_URL` i prod (f.eks. https://motus-pt-app.vercel.app) så lenker ikke peker til feil host.
 */
function getCanonicalSiteOrigin(): string {
  const raw = String(import.meta.env.VITE_SITE_URL ?? "").trim();
  if (raw) {
    try {
      let href = raw;
      if (!/^https?:\/\//i.test(href)) {
        const hostPart = href.split("/")[0] ?? "";
        const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(hostPart);
        href = `${isLocal ? "http" : "https"}://${href}`;
      }
      return new URL(href).origin;
    } catch {
      // Fall back to current page origin.
    }
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function emailRedirectBase(): string | undefined {
  const origin = getCanonicalSiteOrigin();
  return origin ? `${origin}/` : undefined;
}

/** Redirect for medlemsinvitasjon — må matche parsing i useAppState (passordskjerm). */
function memberInviteRedirectTo(): string | undefined {
  const origin = getCanonicalSiteOrigin();
  return origin ? `${origin}/?type=invite&invite=1` : undefined;
}

function isTrainerStaffEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(TRAINER_EMAIL_DOMAIN);
}

function resolveAuthRole(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Role {
  const email = String(user.email ?? "").trim();
  if (isTrainerStaffEmail(email)) return "trainer";

  const appRole = user.app_metadata?.role;
  if (appRole === "trainer" || appRole === "member") return appRole;
  const userRole = user.user_metadata?.role;
  if (userRole === "trainer" || userRole === "member") return userRole;
  return "trainer";
}

function mapSupabaseUserToAuthUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): AuthUser {
  const role = resolveAuthRole(user);
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (user.email ?? "Bruker");
  const memberId =
    role === "member"
      ? typeof user.app_metadata?.member_id === "string"
        ? user.app_metadata.member_id
        : typeof user.user_metadata?.member_id === "string"
        ? user.user_metadata.member_id
        : undefined
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
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const detailedMessage = error?.message?.trim() || "Ukjent feil fra Supabase.";
    return { ok: false, message: detailedMessage };
  }
  return { ok: true, user: mapSupabaseUserToAuthUser(data.user) };
}

export async function requestEmailOtpSignIn(email: string): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Skriv inn en gyldig e-postadresse." };
  }
  const redirectTo = emailRedirectBase();
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) {
    if (isRateLimitMessage(error.message || "")) {
      return {
        ok: false,
        message: "For mange forespørsler akkurat nå. Vent litt og prøv igjen.",
      };
    }
    return { ok: false, message: `Kunne ikke sende engangskode: ${error.message || "Ukjent feil."}` };
  }
  return { ok: true, message: "Engangskode sendt. Sjekk e-posten din." };
}

export async function verifyEmailOtpSignIn(email: string, token: string): Promise<SupabaseSignInResult> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim().replace(/[\s-]+/g, "");
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Skriv inn en gyldig e-postadresse." };
  }
  if (!normalizedToken) {
    return { ok: false, message: "Skriv inn engangskoden fra e-posten." };
  }
  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email",
  });
  if (!error && data.user) {
    return { ok: true, user: mapSupabaseUserToAuthUser(data.user) };
  }
  if (error?.message && isInvalidOtpMessage(error.message)) {
    const { data: inviteData, error: inviteError } = await supabaseClient.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: "invite",
    });
    if (!inviteError && inviteData.user) {
      return { ok: true, user: mapSupabaseUserToAuthUser(inviteData.user) };
    }
  }
  if (error || !data.user) {
    return { ok: false, message: error?.message || "Ugyldig eller utløpt engangskode." };
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

export async function refreshSupabaseSessionUser(): Promise<AuthUser | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.refreshSession();
  if (error) return null;
  const user = data.user ?? data.session?.user ?? null;
  if (!user) return null;
  return mapSupabaseUserToAuthUser(user);
}

export async function signOutSupabase(): Promise<void> {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

async function persistSessionFromVerifyOtpResult(
  data: { session: { access_token: string; refresh_token: string } | null } | null,
  failureMessage: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  if (data?.session?.access_token && data.session.refresh_token) {
    const { error: setError } = await supabaseClient.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setError) return { ok: false, message: setError.message || failureMessage };
  }
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, message: failureMessage };
  }
  return { ok: true };
}

export async function verifyRecoveryToken(tokenHash: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const { data, error } = await supabaseClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (error) return { ok: false, message: error.message || "Kunne ikke verifisere recovery-lenke." };
  return persistSessionFromVerifyOtpResult(data, "Kunne ikke opprette recovery-session.");
}

export async function verifyInviteToken(tokenHash: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const { data, error } = await supabaseClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });
  if (error) return { ok: false, message: error.message || "Kunne ikke verifisere invitasjonslenke." };
  return persistSessionFromVerifyOtpResult(data, "Kunne ikke opprette innloggingssesjon fra invitasjon.");
}

export async function exchangeAuthCodeForSession(code: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedCode = code.trim();
  if (!normalizedCode) return { ok: false, message: "Mangler auth-kode i lenken." };
  const { data, error } = await supabaseClient.auth.exchangeCodeForSession(normalizedCode);
  if (error) return { ok: false, message: error.message || "Kunne ikke verifisere lenken." };
  return persistSessionFromVerifyOtpResult(data, "Kunne ikke opprette innloggingssesjon fra lenken.");
}

export type EnsureAuthSessionForPasswordInput = {
  recoveryInviteFlow: boolean;
  recoveryTokenHash: string | null;
  recoveryAccessToken: string | null;
  recoveryRefreshToken: string | null;
  recoveryAuthCode: string | null;
};

export async function ensureAuthSessionForPasswordUpdate(
  input: EnsureAuthSessionForPasswordInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };

  const {
    data: { session: existingSession },
  } = await supabaseClient.auth.getSession();
  if (existingSession?.access_token) return { ok: true };

  const accessToken = input.recoveryAccessToken?.trim() ?? "";
  const refreshToken = input.recoveryRefreshToken?.trim() ?? "";
  if (accessToken && refreshToken) {
    const fromTokens = await establishRecoverySessionFromTokens({ accessToken, refreshToken });
    if (fromTokens.ok) return fromTokens;
  }

  const authCode = input.recoveryAuthCode?.trim() ?? "";
  if (authCode) {
    const fromCode = await exchangeAuthCodeForSession(authCode);
    if (fromCode.ok) return fromCode;
  }

  const tokenHash = input.recoveryTokenHash?.trim() ?? "";
  if (tokenHash) {
    return input.recoveryInviteFlow ? verifyInviteToken(tokenHash) : verifyRecoveryToken(tokenHash);
  }

  return {
    ok: false,
    message:
      "Auth session missing! Åpne invitasjonslenken direkte fra e-posten på nytt (ikke bare adresselinjen).",
  };
}

export async function establishRecoverySessionFromTokens(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const { error } = await supabaseClient.auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });
  if (error) return { ok: false, message: error.message || "Kunne ikke opprette recovery-session." };
  return { ok: true };
}

export async function updateSupabasePassword(password: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message || "Kunne ikke oppdatere passord." };
  return { ok: true };
}

export async function requestPasswordRecovery(email: string): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Skriv inn en gyldig e-postadresse." };
  }

  const origin = getCanonicalSiteOrigin();
  const redirectTo = origin ? `${origin}/?type=recovery&recovery=1` : undefined;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });
  if (error) {
    const lowered = (error.message || "").toLowerCase();
    if (lowered.includes("rate limit")) {
      return {
        ok: false,
        message: "For mange forespørsler akkurat nå. Vent litt og prøv igjen.",
      };
    }
    return { ok: false, message: `Kunne ikke sende reset-epost: ${error.message || "Ukjent feil."}` };
  }

  return { ok: true, message: "Reset-lenke sendt. Sjekk e-posten din." };
}

export type InviteMemberResult = {
  ok: boolean;
  message: string;
  /** Fyllt når invite-member har stemplet invited_at (ISO 8601). */
  invitedAtIso?: string;
};

export type InviteTrainerResult = {
  ok: boolean;
  message: string;
};

function inviteMemberIsoTimestamp(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const raw = (data as { invitedAt?: unknown }).invitedAt;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim();
}

const MEMBER_INVITE_COOLDOWN_MS = 60_000;
const memberInviteInFlightByKey = new Map<string, Promise<InviteMemberResult>>();
const memberInviteLastSentAtByKey = new Map<string, number>();

function isTrainerEmail(email: string): boolean {
  return isTrainerStaffEmail(email);
}

async function syncMemberAuthLink(email: string, memberId?: string): Promise<void> {
  if (!supabaseClient) return;
  const payload = memberId ? { email, memberId } : { email };
  const { error } = await supabaseClient.functions.invoke("link-member-auth", {
    body: payload,
  });
  if (!error) return;
  console.warn("link-member-auth invoke failed during invite:", error.message);

  if (!supabaseUrl || !supabaseAnonKey) return;
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/link-member-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.warn("link-member-auth fetch fallback failed:", response.status, detail.slice(0, 400));
    }
  } catch (fetchError) {
    console.warn("link-member-auth fetch fallback threw:", fetchError);
  }
}

export async function ensureMemberAuthLink(email: string, memberId?: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMemberId = memberId?.trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return;
  if (isTrainerEmail(normalizedEmail)) {
    console.warn("Skipping member auth link for trainer-domain email:", normalizedEmail);
    return;
  }
  await syncMemberAuthLink(normalizedEmail, normalizedMemberId);
}

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

function isRateLimitMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("for mange forespørsler") ||
    normalized.includes("for mange foresporsler") ||
    normalized.includes("request rate limit reached")
  );
}

function isInvalidOtpMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("token has expired") ||
    normalized.includes("invalid") ||
    normalized.includes("expired") ||
    normalized.includes("utløpt") ||
    normalized.includes("ugyldig")
  );
}

async function sendMemberInviteByEmail(email: string, memberId: string): Promise<InviteMemberResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Ugyldig e-post." };
  }
  if (!memberId.trim()) {
    return { ok: false, message: "Mangler member_id for medlemmet." };
  }
  if (!memberInviteRedirectTo()) {
    return {
      ok: false,
      message: "Invitasjon feilet: mangler VITE_SITE_URL (app-URL for e-postlenker).",
    };
  }

  const {
    data: { session: initialSession },
  } = await supabaseClient.auth.getSession();
  let activeSession = initialSession;
  if (!activeSession?.access_token) {
    const { data: refreshedData } = await supabaseClient.auth.refreshSession();
    activeSession = refreshedData.session;
  }
  if (!activeSession?.access_token) {
    return { ok: false, message: "Invitasjon feilet: logg inn som trener og prøv igjen." };
  }

  const ownerUserId = activeSession.user?.id?.trim?.() ?? "";
  const { data, error } = await supabaseClient.functions.invoke("invite-member", {
    body: {
      email: normalizedEmail,
      memberId: memberId.trim(),
      accessToken: activeSession.access_token,
      ownerUserId,
      inviteRedirectOrigin: getCanonicalSiteOrigin(),
    },
  });

  if (!error) {
    const stamp = inviteMemberIsoTimestamp(data);
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      await syncMemberAuthLink(normalizedEmail, memberId.trim());
      return stamp ? { ok: true, message: data.message, invitedAtIso: stamp } : { ok: true, message: data.message };
    }
    await syncMemberAuthLink(normalizedEmail, memberId.trim());
    return { ok: true, message: `Invitasjon sendt til ${normalizedEmail}`, ...(stamp ? { invitedAtIso: stamp } : {}) };
  }

  const detailed = await extractFunctionErrorMessage(error);
  const message = detailed ?? "Ukjent feil fra invitasjonstjenesten.";
  if (isRateLimitMessage(message)) {
    await syncMemberAuthLink(normalizedEmail, memberId.trim());
    return {
      ok: true,
      message: "Invitasjon er nylig sendt. Vent litt for ny utsending.",
    };
  }
  return { ok: false, message: `Invitasjon feilet: ${message}` };
}

export async function inviteMemberByEmail(email: string, memberId: string): Promise<InviteMemberResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMemberId = memberId.trim();
  const inviteKey = `${normalizedEmail}|${normalizedMemberId}`;
  const now = Date.now();
  const lastSentAt = memberInviteLastSentAtByKey.get(inviteKey) ?? 0;
  if (lastSentAt && now - lastSentAt < MEMBER_INVITE_COOLDOWN_MS) {
    return { ok: true, message: "Invitasjon er nylig sendt. Vent litt for ny utsending." };
  }

  const inFlight = memberInviteInFlightByKey.get(inviteKey);
  if (inFlight) return inFlight;

  const request = sendMemberInviteByEmail(normalizedEmail, normalizedMemberId)
    .then((result) => {
      if (result.ok) memberInviteLastSentAtByKey.set(inviteKey, Date.now());
      return result;
    })
    .finally(() => {
      memberInviteInFlightByKey.delete(inviteKey);
    });
  memberInviteInFlightByKey.set(inviteKey, request);
  return request;
}

export async function inviteTrainerByEmail(email: string): Promise<InviteTrainerResult> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Ugyldig e-post." };
  }

  const redirectTo = emailRedirectBase();
  const { error } = await supabaseClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
      data: { role: "trainer" },
    },
  });

  if (!error) return { ok: true, message: `PT-invitasjon sendt til ${normalizedEmail}` };
  if (isRateLimitMessage(error.message || "")) {
    return { ok: true, message: "Invitasjon er nylig sendt. Vent litt for ny utsending." };
  }

  // Fallback: some projects reject custom metadata in OTP payload.
  const { error: fallbackError } = await supabaseClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (!fallbackError) return { ok: true, message: `PT-invitasjon sendt til ${normalizedEmail}` };
  if (isRateLimitMessage(fallbackError.message || "")) {
    return { ok: true, message: "Invitasjon er nylig sendt. Vent litt for ny utsending." };
  }
  return { ok: false, message: `Kunne ikke sende engangskode: ${fallbackError.message || error.message || "Ukjent feil."}` };
}
