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

function resolveInviteRedirectTo(payload: InvitePayload): { redirectTo: string } | { error: string } {
  const secret = trimSlash(Deno.env.get("PUBLIC_APP_URL") ?? "");
  if (secret && /^https:\/\//i.test(secret)) {
    return { redirectTo: `${secret}/` };
  }
  const fromClient = trimSlash(String(payload.inviteRedirectOrigin ?? ""));
  if (!fromClient || !isSafeRedirectOrigin(fromClient)) {
    return {
      error:
        "Mangler gyldig PUBLIC_APP_URL på funksjonen, eller inviteRedirectOrigin fra appen. Sett Supabase secret PUBLIC_APP_URL=https://motus-pt-app.vercel.app (samme som VITE_SITE_URL / Site URL).",
    };
  }
  return { redirectTo: `${fromClient}/` };
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

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirect.redirectTo,
    data: {
      member_id: memberId,
      role: "member",
    },
  });

  if (inviteError) {
    return jsonResponse(500, {
      error: `inviteUserByEmail failed: ${inviteError.message}`,
      code: inviteError.name,
    });
  }

  const msg = inviteData?.user?.id
    ? `Invitasjon sendt til ${email}. Lenken peker til ${trimSlash(redirect.redirectTo)}/`
    : `Invitasjon prosessert for ${email}`;
  return jsonResponse(200, { message: msg, redirectTo: redirect.redirectTo });
});
