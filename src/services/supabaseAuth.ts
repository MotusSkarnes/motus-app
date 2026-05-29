import type { AuthBootstrapParams } from "../app/supabaseAuthBootstrap";
import { buildMemberInviteRedirectUrl, readPersistedAuthBootstrapParams } from "../app/supabaseAuthBootstrap";
import { configuredSupabaseAnonKey, configuredSupabaseUrl } from "./supabaseClient";
import {
  emptyTrainerProfile,
  serializeTrainerProfile,
  trainerProfileFromUserMetadata,
  TRAINER_PROFILE_METADATA_KEY,
  type TrainerProfile,
} from "../app/trainerProfile";
import type { AuthUser, Role } from "../app/types";
import { supabaseClient } from "./supabaseClient";

const DEMO_TRAINER_PROFILE_STORAGE_KEY = "motus.demo.trainerProfile.v1";

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

/** Redirect for medlemsinvitasjon — query-flagg appen leser ved innlogging (støtter også /aktiver). */
function memberInviteRedirectTo(): string | undefined {
  const origin = getCanonicalSiteOrigin();
  return origin ? buildMemberInviteRedirectUrl(origin) : undefined;
}

function isTrainerStaffEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(TRAINER_EMAIL_DOMAIN);
}

function readLinkedMemberId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string {
  const raw =
    (typeof user.app_metadata?.member_id === "string" && user.app_metadata.member_id) ||
    (typeof user.user_metadata?.member_id === "string" && user.user_metadata.member_id) ||
    "";
  return raw.trim();
}

function hasLinkedCustomerMemberId(memberId: string): boolean {
  if (!memberId || memberId === "__template__") return false;
  return true;
}

/**
 * Eksplisitt metadata (f.eks. resepsjon@ som PT-kunde) vinner over @motus-skarnes.no standard.
 * Staff med koblet member_id behandles som medlem selv om JWT fortsatt sier role=trainer.
 */
export function resolveSessionAuthRole(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Role {
  const email = String(user.email ?? "").trim();
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  const memberId = readLinkedMemberId(user);

  if (appRole === "member" || userRole === "member") return "member";

  if (hasLinkedCustomerMemberId(memberId)) {
    return "member";
  }

  if (appRole === "trainer" || userRole === "trainer") return "trainer";
  if (isTrainerStaffEmail(email)) return "trainer";
  // Inviterte kunder har ofte tom metadata — de skal inn som medlem, ikke PT-visning.
  return "member";
}

function resolveAuthRole(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Role {
  return resolveSessionAuthRole(user);
}

export function mapSupabaseUserToAuthUser(user: {
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
  const linkedMemberId = readLinkedMemberId(user);
  const memberId =
    role === "member"
      ? linkedMemberId || undefined
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
  const otpTypes: Array<"invite" | "signup"> = ["invite", "signup"];
  let lastMessage = "Kunne ikke verifisere invitasjonslenke.";
  for (const otpType of otpTypes) {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      return persistSessionFromVerifyOtpResult(data, "Kunne ikke opprette innloggingssesjon fra invitasjon.");
    }
    lastMessage = error.message || lastMessage;
  }
  return { ok: false, message: lastMessage };
}

export async function exchangeAuthCodeForSession(code: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  const normalizedCode = code.trim();
  if (!normalizedCode) return { ok: false, message: "Mangler auth-kode i lenken." };
  const { data, error } = await supabaseClient.auth.exchangeCodeForSession(normalizedCode);
  if (error) return { ok: false, message: error.message || "Kunne ikke verifisere lenken." };
  return persistSessionFromVerifyOtpResult(data, "Kunne ikke opprette innloggingssesjon fra lenken.");
}

export type EnsureAuthSessionForPasswordInput = AuthBootstrapParams;

function mergeAuthBootstrapParams(
  input: EnsureAuthSessionForPasswordInput,
  persisted: AuthBootstrapParams | null,
): AuthBootstrapParams {
  if (!persisted) return input;
  return {
    recoveryInviteFlow: input.recoveryInviteFlow || persisted.recoveryInviteFlow,
    tokenHash: input.tokenHash?.trim() ? input.tokenHash : persisted.tokenHash,
    accessToken: input.accessToken?.trim() ? input.accessToken : persisted.accessToken,
    refreshToken: input.refreshToken?.trim() ? input.refreshToken : persisted.refreshToken,
    authCode: input.authCode?.trim() ? input.authCode : persisted.authCode,
  };
}

export async function establishSessionFromAuthBootstrap(
  input: EnsureAuthSessionForPasswordInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };

  const params = mergeAuthBootstrapParams(input, readPersistedAuthBootstrapParams());

  const {
    data: { session: existingSession },
  } = await supabaseClient.auth.getSession();
  if (existingSession?.access_token) return { ok: true };

  const accessToken = params.accessToken?.trim() ?? "";
  const refreshToken = params.refreshToken?.trim() ?? "";
  if (accessToken && refreshToken) {
    const fromTokens = await establishRecoverySessionFromTokens({ accessToken, refreshToken });
    if (fromTokens.ok) return fromTokens;
  }

  const authCode = params.authCode?.trim() ?? "";
  if (authCode) {
    const fromCode = await exchangeAuthCodeForSession(authCode);
    if (fromCode.ok) return fromCode;
  }

  const tokenHash = params.tokenHash?.trim() ?? "";
  if (tokenHash) {
    const fromHash = params.recoveryInviteFlow ? await verifyInviteToken(tokenHash) : await verifyRecoveryToken(tokenHash);
    if (fromHash.ok) return fromHash;
  }

  // detectSessionInUrl kan fullføre asynkront etter første forsøk
  if (typeof window !== "undefined") {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  const {
    data: { session: delayedSession },
  } = await supabaseClient.auth.getSession();
  if (delayedSession?.access_token) return { ok: true };

  return {
    ok: false,
    message:
      "Kunne ikke koble til invitasjonen. Åpne lenken direkte fra e-posten på nytt (ikke kopiert adresse uten #...-delen).",
  };
}

export async function ensureAuthSessionForPasswordUpdate(
  input: EnsureAuthSessionForPasswordInput,
): Promise<{ ok: boolean; message?: string }> {
  return establishSessionFromAuthBootstrap(input);
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

export type SaveTrainerProfileInput = {
  name: string;
  profile: TrainerProfile;
};

export type SaveTrainerProfileResult =
  | { ok: true; user: AuthUser; message: string }
  | { ok: false; message: string };

export async function saveTrainerProfile(input: SaveTrainerProfileInput): Promise<SaveTrainerProfileResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, message: "Navn må fylles ut." };
  }
  const profile = serializeTrainerProfile(input.profile);

  if (!supabaseClient) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_TRAINER_PROFILE_STORAGE_KEY, JSON.stringify({ name, profile }));
    }
    return {
      ok: true,
      user: {
        id: "demo-trainer",
        role: "trainer",
        name,
        email: "trainer@motus.no",
      },
      message: "PT-kort lagret lokalt (demo).",
    };
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    data: {
      full_name: name,
      name,
      [TRAINER_PROFILE_METADATA_KEY]: profile,
    },
  });
  if (error || !data.user) {
    return { ok: false, message: error?.message?.trim() || "Kunne ikke lagre PT-kortet." };
  }
  return {
    ok: true,
    user: mapSupabaseUserToAuthUser(data.user),
    message: "PT-kort lagret.",
  };
}

export async function loadTrainerProfileForCurrentSession(): Promise<{
  name: string;
  email: string;
  profile: TrainerProfile;
}> {
  if (!supabaseClient) {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(DEMO_TRAINER_PROFILE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { name?: string; profile?: TrainerProfile };
          return {
            name: String(parsed.name ?? "Motus PT").trim(),
            email: "trainer@motus.no",
            profile: parsed.profile ? serializeTrainerProfile(parsed.profile) : emptyTrainerProfile(),
          };
        }
      } catch {
        // ignore
      }
    }
    return { name: "Motus PT", email: "trainer@motus.no", profile: emptyTrainerProfile() };
  }

  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) {
    return { name: "", email: "", profile: emptyTrainerProfile() };
  }
  const metadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const mapped = mapSupabaseUserToAuthUser(data.user);
  return {
    name: mapped.name.trim(),
    email: mapped.email.trim(),
    profile: trainerProfileFromUserMetadata(metadata),
  };
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

function parseInviteMemberInvokePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.error) return null;
  if (typeof record.message === "string" && record.message.trim()) return record;
  return null;
}

async function parseInviteMemberSuccessFromInvoke(
  data: unknown,
  error: unknown,
): Promise<Record<string, unknown> | null> {
  const fromData = parseInviteMemberInvokePayload(data);
  if (fromData) return fromData;

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const response = typeof context.clone === "function" ? context.clone() : context;
        const body = await response.json();
        const fromBody = parseInviteMemberInvokePayload(body);
        if (fromBody) return fromBody;
      } catch {
        // Fall through.
      }
    }
  }
  return null;
}

async function invokeInviteMemberFunction(body: Record<string, unknown>): Promise<{
  ok: boolean;
  data: Record<string, unknown> | null;
  errorMessage: string | null;
}> {
  if (!supabaseClient) {
    return { ok: false, data: null, errorMessage: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const { data, error } = await supabaseClient.functions.invoke("invite-member", { body });
  const successPayload = await parseInviteMemberSuccessFromInvoke(data, error);
  if (successPayload) {
    return { ok: true, data: successPayload, errorMessage: null };
  }

  let errorMessage =
    (await extractFunctionErrorMessage(error)) || error?.message || "invite-member feilet";

  if (configuredSupabaseUrl && configuredSupabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const response = await fetch(`${configuredSupabaseUrl}/functions/v1/invite-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: configuredSupabaseAnonKey,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        parsed = null;
      }
      const successFromFetch = parseInviteMemberInvokePayload(parsed);
      if (response.ok && successFromFetch) {
        return { ok: true, data: successFromFetch, errorMessage: null };
      }
      const detail = String(parsed?.error ?? parsed?.message ?? raw ?? response.status);
      errorMessage = `HTTP ${response.status}: ${detail}`;
    } catch (fetchError) {
      errorMessage = `${errorMessage} (${String(fetchError)})`;
    }
  }

  return { ok: false, data: null, errorMessage };
}

const MEMBER_INVITE_COOLDOWN_MS = 60_000;
const memberInviteInFlightByKey = new Map<string, Promise<InviteMemberResult>>();
const memberInviteLastSentAtByKey = new Map<string, number>();

function isTrainerEmail(email: string): boolean {
  return isTrainerStaffEmail(email);
}

export type MemberAuthLinkResult = {
  firstLoginAt?: string;
  firstLoginRowsStamped?: number;
};

function parseLinkMemberAuthResponse(data: unknown): MemberAuthLinkResult {
  if (!data || typeof data !== "object") return {};
  const record = data as Record<string, unknown>;
  const firstLoginAt =
    typeof record.firstLoginAt === "string"
      ? record.firstLoginAt.trim()
      : typeof record.invitedAt === "string"
        ? record.invitedAt.trim()
        : "";
  const stamped = Number(record.firstLoginRowsStamped ?? record.invitedRowsStamped);
  return {
    ...(firstLoginAt ? { firstLoginAt } : {}),
    ...(Number.isFinite(stamped) && stamped > 0 ? { firstLoginRowsStamped: stamped } : {}),
  };
}

async function syncMemberAuthLink(
  email: string,
  memberId?: string,
  trainerOwnerUserId?: string,
): Promise<MemberAuthLinkResult> {
  if (!supabaseClient) return {};
  const trainerId = String(trainerOwnerUserId ?? "").trim();
  const payload = {
    email,
    ...(memberId ? { memberId } : {}),
    ...(trainerId ? { trainerOwnerUserId: trainerId, sourceOwnerUserId: trainerId } : {}),
  };
  const { data, error } = await supabaseClient.functions.invoke("link-member-auth", {
    body: payload,
  });
  if (!error) {
    return parseLinkMemberAuthResponse(data);
  }
  console.warn("link-member-auth invoke failed during invite:", error.message);

  if (!supabaseUrl || !supabaseAnonKey) return {};
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
      return {};
    }
    const json = (await response.json()) as unknown;
    return parseLinkMemberAuthResponse(json);
  } catch (fetchError) {
    console.warn("link-member-auth fetch fallback threw:", fetchError);
    return {};
  }
}

export async function ensureMemberAuthLink(email: string, memberId?: string): Promise<MemberAuthLinkResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMemberId = memberId?.trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return {};
  if (isTrainerEmail(normalizedEmail) && !normalizedMemberId) {
    console.warn("Skipping member auth link for trainer-domain email without memberId:", normalizedEmail);
    return {};
  }
  return syncMemberAuthLink(normalizedEmail, normalizedMemberId);
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

function isExistingUserInviteError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("email address has already")
  );
}

function buildRecoveryRedirectForReinvite(): string | undefined {
  const inviteRedirect = memberInviteRedirectTo();
  if (!inviteRedirect) return undefined;
  try {
    const url = new URL(inviteRedirect);
    url.searchParams.set("type", "recovery");
    url.searchParams.set("recovery", "1");
    url.searchParams.delete("invite");
    return url.toString();
  } catch {
    const base = inviteRedirect.split("?")[0]?.replace(/\/+$/, "") || inviteRedirect;
    return `${base}/?type=recovery&recovery=1`;
  }
}

async function resendMemberInviteOtp(email: string, memberId: string): Promise<InviteMemberResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }
  const inviteRedirect = memberInviteRedirectTo();
  const recoveryRedirect = buildRecoveryRedirectForReinvite();
  if (!inviteRedirect || !recoveryRedirect) {
    return {
      ok: false,
      message: "Invitasjon feilet: mangler VITE_SITE_URL (app-URL for e-postlenker).",
    };
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const trainerId = String(session?.user?.id ?? "").trim();

  const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: recoveryRedirect,
  });
  if (!resetError) {
    await syncMemberAuthLink(email, memberId, trainerId);
    return {
      ok: true,
      message: `E-post med lenke for å sette passord er sendt til ${email}. Sjekk innboks og søppelpost.`,
      invitedAtIso: new Date().toISOString(),
    };
  }

  const { error: otpError } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: inviteRedirect,
      data: { member_id: memberId, role: "member" },
    },
  });
  if (!otpError) {
    await syncMemberAuthLink(email, memberId, trainerId);
    return {
      ok: true,
      message: `Innloggingslenke sendt på nytt til ${email}. Sjekk innboks og søppelpost.`,
      invitedAtIso: new Date().toISOString(),
    };
  }
  if (isRateLimitMessage(otpError.message || resetError.message || "")) {
    return {
      ok: false,
      message: "For mange e-poster akkurat nå. Vent 1–2 minutter og prøv igjen.",
    };
  }
  return {
    ok: false,
    message: `Kunne ikke sende invitasjon: ${resetError.message || otpError.message || "Ukjent feil."}`,
  };
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

async function sendMemberInviteByEmail(
  email: string,
  memberId: string,
  options?: InviteMemberOptions,
): Promise<InviteMemberResult> {
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
  const invoke = await invokeInviteMemberFunction({
    email: normalizedEmail,
    memberId: memberId.trim(),
    accessToken: activeSession.access_token,
    ownerUserId,
    inviteRedirectOrigin: getCanonicalSiteOrigin(),
    forceResend: Boolean(options?.forceResend),
  });

  if (invoke.ok && invoke.data) {
    const stamp = inviteMemberIsoTimestamp(invoke.data);
    const message = String(invoke.data.message ?? `Invitasjon sendt til ${normalizedEmail}`).trim();
    await syncMemberAuthLink(normalizedEmail, memberId.trim(), ownerUserId);
    return stamp ? { ok: true, message, invitedAtIso: stamp } : { ok: true, message };
  }

  const message = invoke.errorMessage ?? "Ukjent feil fra invitasjonstjenesten.";
  if (isRateLimitMessage(message)) {
    return {
      ok: false,
      message: "For mange e-poster akkurat nå. Vent 1–2 minutter og prøv «Inviter på nytt» igjen.",
    };
  }
  if (options?.forceResend || isExistingUserInviteError(message)) {
    const resent = await resendMemberInviteOtp(normalizedEmail, memberId.trim());
    if (resent.ok) return resent;
    if (options?.forceResend) {
      return {
        ok: false,
        message: `${resent.message} (Edge: ${message})`,
      };
    }
    return resent;
  }
  return { ok: false, message: `Invitasjon feilet: ${message}` };
}

export type InviteMemberOptions = {
  /** Hopp over 1-min lokalt cooldown (f.eks. «Inviter på nytt»). */
  forceResend?: boolean;
};

export async function inviteMemberByEmail(
  email: string,
  memberId: string,
  options?: InviteMemberOptions,
): Promise<InviteMemberResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedMemberId = memberId.trim();
  const inviteKey = `${normalizedEmail}|${normalizedMemberId}`;
  const now = Date.now();
  const lastSentAt = memberInviteLastSentAtByKey.get(inviteKey) ?? 0;
  if (
    !options?.forceResend &&
    lastSentAt &&
    now - lastSentAt < MEMBER_INVITE_COOLDOWN_MS
  ) {
    return {
      ok: false,
      message: "Invitasjon er nylig sendt fra denne enheten. Vent ca. 1 minutt, eller bruk «Inviter på nytt».",
    };
  }

  const inFlight = memberInviteInFlightByKey.get(inviteKey);
  if (inFlight) return inFlight;

  const request = sendMemberInviteByEmail(normalizedEmail, normalizedMemberId, options)
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
