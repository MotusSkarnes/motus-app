import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type InvitePayload = {
  email?: string;
  memberId?: string;
  accessToken?: string;
  ownerUserId?: string;
  /** HTTPS (or localhost) origin uten trailing slash — brukes når PUBLIC_APP_URL ikke er satt */
  inviteRedirectOrigin?: string;
  /** «Inviter på nytt» — hopp over inviteUserByEmail og send recovery/OTP til eksisterende konto */
  forceResend?: boolean;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "").trim();
}

function isSafeRedirectOrigin(origin: string): boolean {
  const o = trimSlash(origin);
  if (!o) return false;
  if (/^https:\/\//i.test(o)) return true;
  return /^http:\/\/localhost(?::\d+)?$/i.test(o) || /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(o);
}

/** Må matche Supabase Redirect URLs (ofte Site URL + query). Appen støtter også /aktiver. */
const MEMBER_INVITE_AUTH_QUERY = "/aktiver?type=invite&invite=1";

function buildInviteRedirectUrl(origin: string): string {
  return `${trimSlash(origin)}${MEMBER_INVITE_AUTH_QUERY}`;
}

function resolveInviteRedirectTo(payload: InvitePayload): { redirectTo: string } | { error: string } {
  const secret = trimSlash(Deno.env.get("PUBLIC_APP_URL") ?? "");
  if (secret && /^https:\/\//i.test(secret)) {
    return { redirectTo: buildInviteRedirectUrl(secret) };
  }
  const fromClient = trimSlash(String(payload.inviteRedirectOrigin ?? ""));
  if (!fromClient || !isSafeRedirectOrigin(fromClient)) {
    return {
      error:
        "Mangler gyldig PUBLIC_APP_URL på funksjonen, eller inviteRedirectOrigin fra appen. Sett Supabase secret PUBLIC_APP_URL=https://motus-pt-app.vercel.app (samme som VITE_SITE_URL / Site URL).",
    };
  }
  return { redirectTo: buildInviteRedirectUrl(fromClient) };
}

function isTrainerUser(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): boolean {
  const appRole = String(user.app_metadata?.role ?? "").trim().toLowerCase();
  if (appRole === "trainer") return true;
  const metaRole = String(user.user_metadata?.role ?? "").trim().toLowerCase();
  return metaRole === "trainer";
}

/** Eldre trenerkontoer kan mangle role-metadata — tillat hvis JWT-bruker-id matcher ownerUserId fra klient. */
function canInviteAsTrainer(
  user: {
    id: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
  ownerUserId: string,
): boolean {
  if (isTrainerUser(user)) return true;
  return Boolean(ownerUserId && user.id === ownerUserId.trim());
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

type AdminAuthApi = {
  getUserByEmail?: (email: string) => Promise<{
    data: { user: { id: string; user_metadata?: Record<string, unknown> } | null };
    error: { message?: string } | null;
  }>;
  listUsers: (params: { page?: number; perPage?: number }) => Promise<{
    data: { users: Array<{ id: string; email?: string; user_metadata?: Record<string, unknown> }> } | null;
    error: { message?: string } | null;
  }>;
  updateUserById: (
    id: string,
    attrs: { user_metadata?: Record<string, unknown> },
  ) => Promise<{ error: { message?: string } | null }>;
};

async function findAuthUserIdByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  const admin = adminClient.auth.admin as unknown as AdminAuthApi;
  if (typeof admin.getUserByEmail === "function") {
    const { data, error } = await admin.getUserByEmail(email);
    if (!error && data?.user?.id) return data.user.id;
  }
  let page = 1;
  for (;;) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === email);
    if (match?.id) return match.id;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function syncAuthUserMemberMetadata(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  memberId: string,
): Promise<void> {
  const userId = await findAuthUserIdByEmail(adminClient, email);
  if (!userId) return;
  const admin = adminClient.auth.admin as unknown as AdminAuthApi;
  const { data } = typeof admin.getUserByEmail === "function"
    ? await admin.getUserByEmail(email)
    : { data: null };
  const existingMeta = data?.user?.user_metadata ?? {};
  const { error } = await admin.updateUserById(userId, {
    user_metadata: {
      ...existingMeta,
      member_id: memberId,
      role: "member",
    },
  });
  if (error) {
    console.warn("invite-member: kunne ikke oppdatere auth metadata:", error.message);
  }
}

function buildRecoveryRedirectFromInviteRedirect(inviteRedirect: string): string {
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

/** auth.resend() fungerer ikke med service role — bruk reset/OTP som faktisk sender e-post via Supabase SMTP. */
async function resendInviteToExistingUser(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  redirectTo: string,
): Promise<{ ok: true; channel: string } | { ok: false; message: string }> {
  const recoveryRedirect = buildRecoveryRedirectFromInviteRedirect(redirectTo);

  const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
    redirectTo: recoveryRedirect,
  });
  if (!resetError) return { ok: true, channel: "recovery" };

  const { error: otpError } = await adminClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (!otpError) return { ok: true, channel: "magiclink" };

  const message =
    [resetError?.message, otpError?.message].filter(Boolean).join(" / ") ||
    "Kunne ikke sende innloggingslenke.";
  return { ok: false, message };
}

function isRedirectConfigError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("redirect") ||
    normalized.includes("redirect_to") ||
    normalized.includes("not allowed") ||
    normalized.includes("invalid url")
  );
}

async function repairMemberOwnerAfterInvite(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
  email: string,
  trainerUserId: string,
): Promise<void> {
  const { data: memberRow, error } = await adminClient
    .from("members")
    .select("owner_user_id, customer_type")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !memberRow) return;

  const trainerId = trainerUserId.trim();
  if (!trainerId) return;

  const currentOwner = String((memberRow as { owner_user_id?: string | null }).owner_user_id ?? "").trim();
  const customerType = String((memberRow as { customer_type?: string | null }).customer_type ?? "").trim().toLowerCase();
  const memberAuthUserId = await findAuthUserIdByEmail(adminClient, email);
  const ownerLooksLikeMemberAuth = Boolean(memberAuthUserId && currentOwner === memberAuthUserId);
  const ownerMissing = !currentOwner;

  if (!ownerLooksLikeMemberAuth && !ownerMissing) return;
  if (customerType === "medlem" && !ownerLooksLikeMemberAuth && !ownerMissing) return;

  const { error: updateError } = await adminClient
    .from("members")
    .update({ owner_user_id: trainerId })
    .eq("id", memberId);
  if (updateError) {
    console.warn("invite-member: kunne ikke rette owner_user_id:", updateError.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing Supabase environment variables" });
  }

  let payload: InvitePayload;
  try {
    payload = (await req.json()) as InvitePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const email = normalizeEmail(payload.email);
  const memberId = String(payload.memberId ?? "").trim();
  const accessToken = String(payload.accessToken ?? "").trim();
  const ownerUserId = String(payload.ownerUserId ?? "").trim();

  if (!email || !email.includes("@")) {
    return jsonResponse(400, { error: "Valid email is required" });
  }
  if (!memberId) {
    return jsonResponse(400, { error: "memberId is required" });
  }
  if (!accessToken) {
    return jsonResponse(401, { error: "accessToken is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await adminClient.auth.getUser(accessToken);
  if (userErr || !user?.id) {
    return jsonResponse(401, { error: "Invalid trainer session" });
  }
  if (!canInviteAsTrainer(user, ownerUserId)) {
    return jsonResponse(403, { error: "Only trainers can invite members" });
  }
  if (ownerUserId && user.id !== ownerUserId) {
    return jsonResponse(403, { error: "Session does not match ownerUserId" });
  }

  const redirect = resolveInviteRedirectTo(payload);
  if ("error" in redirect) {
    return jsonResponse(400, { error: redirect.error });
  }

  const forceResend = Boolean(payload.forceResend);
  if (forceResend) {
    const existingUserId = await findAuthUserIdByEmail(adminClient, email);
    if (existingUserId) {
      await syncAuthUserMemberMetadata(adminClient, email, memberId);
      const resend = await resendInviteToExistingUser(adminClient, email, redirect.redirectTo);
      if (!resend.ok) {
        return jsonResponse(500, {
          error: `Kunne ikke sende ny lenke: ${resend.message}`,
          redirectTo: redirect.redirectTo,
        });
      }
      const invitedAtIso = new Date().toISOString();
      await repairMemberOwnerAfterInvite(adminClient, memberId, email, user.id);
      const { error: stampErr } = await adminClient
        .from("members")
        .update({ invited_at: invitedAtIso })
        .eq("id", memberId);
      if (stampErr) {
        console.warn("invite-member: kunne ikke sette invited_at på members-rad:", stampErr.message);
      }
      const msg =
        resend.channel === "recovery"
          ? `E-post med lenke for å sette passord er sendt til ${email}. Sjekk innboks og søppelpost.`
          : `Innloggingslenke sendt på nytt til ${email}. Sjekk innboks og søppelpost.`;
      return jsonResponse(200, {
        message: msg,
        redirectTo: redirect.redirectTo,
        invitedAt: invitedAtIso,
        resentExistingUser: true,
        resendChannel: resend.channel,
      });
    }
  }

  let inviteData: { user?: { id?: string } } | null = null;
  let inviteError: { message?: string; name?: string } | null = null;
  let redirectToUsed = redirect.redirectTo;

  const inviteAttempt = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectToUsed,
    data: {
      member_id: memberId,
      role: "member",
    },
  });
  inviteData = inviteAttempt.data;
  inviteError = inviteAttempt.error;

  if (inviteError && isRedirectConfigError(inviteError.message ?? "")) {
    const siteOnlyRedirect = redirectToUsed.split("?")[0] || redirectToUsed;
    const retry = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteOnlyRedirect,
      data: { member_id: memberId, role: "member" },
    });
    if (!retry.error) {
      inviteData = retry.data;
      inviteError = null;
      redirectToUsed = siteOnlyRedirect;
    }
  }

  let resentExistingUser = false;
  let resendChannel = "";

  if (inviteError) {
    if (!isExistingUserInviteError(inviteError.message ?? "")) {
      return jsonResponse(500, {
        error: `inviteUserByEmail failed: ${inviteError.message}`,
        code: inviteError.name,
        redirectTo: redirectToUsed,
      });
    }

    await syncAuthUserMemberMetadata(adminClient, email, memberId);
    const resend = await resendInviteToExistingUser(adminClient, email, redirectToUsed);
    if (!resend.ok) {
      return jsonResponse(500, {
        error: `Konto finnes allerede, men ny lenke feilet: ${resend.message}`,
        code: inviteError.name,
        redirectTo: redirectToUsed,
      });
    }
    resentExistingUser = true;
    resendChannel = resend.channel;
  }

  const msg = resentExistingUser
    ? resendChannel === "recovery"
      ? `E-post med lenke for å sette passord er sendt til ${email}. (Eksisterende konto — sjekk innboks og søppelpost.)`
      : `Innloggingslenke sendt på nytt til ${email}. Kunden har allerede konto — sjekk innboks og søppelpost.`
    : inviteData?.user?.id
      ? `Invitasjon sendt til ${email}. Mottakeren setter passord ved første innlogging.`
      : `Invitasjon prosessert for ${email}`;

  const invitedAtIso = new Date().toISOString();
  await repairMemberOwnerAfterInvite(adminClient, memberId, email, user.id);
  const { error: stampErr } = await adminClient.from("members").update({ invited_at: invitedAtIso }).eq("id", memberId);
  if (stampErr) {
    console.warn("invite-member: kunne ikke sette invited_at på members-rad:", stampErr.message);
  }

  return jsonResponse(200, {
    message: msg,
    redirectTo: redirectToUsed,
    invitedAt: invitedAtIso,
    resentExistingUser,
    resendChannel: resendChannel || (resentExistingUser ? "invite" : "invite_new"),
  });
});
