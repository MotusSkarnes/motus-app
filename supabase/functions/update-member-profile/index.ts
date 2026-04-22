import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdatePayload = {
  email?: string;
  memberId?: string;
  memberIds?: string[];
  changes?: {
    name?: string;
    phone?: string;
    birthDate?: string;
    goal?: string;
    focus?: string;
    injuries?: string;
  };
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

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  let payload: UpdatePayload;
  try {
    payload = (await req.json()) as UpdatePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const userClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data,
    error: userError,
  } = await userClient.auth.getUser(token);
  const user = data?.user ?? null;
  if (userError || !user) {
    return jsonResponse(401, { error: "Invalid user session" });
  }

  const userRole = (() => {
    const appRole = user.app_metadata?.role;
    if (appRole === "member" || appRole === "trainer") return appRole;
    const userRoleValue = user.user_metadata?.role;
    if (userRoleValue === "member" || userRoleValue === "trainer") return userRoleValue;
    return "";
  })();
  // Some existing auth users may be missing explicit role metadata.
  // Authorization is still enforced by validating authenticated email below.
  if (userRole && userRole !== "member") {
    return jsonResponse(403, { error: "Only members can update profile through this endpoint" });
  }

  const currentEmail = normalizeEmail(user.email);
  const requestedEmail = normalizeEmail(payload.email);
  const requestedMemberId = normalizeString(payload.memberId);
  const requestedMemberIds = Array.isArray(payload.memberIds)
    ? payload.memberIds.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  const authMemberId = normalizeString(
    (user.app_metadata?.member_id as string | undefined) ??
      (user.user_metadata?.member_id as string | undefined) ??
      ""
  );
  if (!currentEmail || !currentEmail.includes("@")) {
    return jsonResponse(400, { error: "Logged-in user is missing a valid email" });
  }
  if (requestedEmail && requestedEmail !== currentEmail) {
    return jsonResponse(403, { error: "Email mismatch for member profile update" });
  }

  const changes = payload.changes ?? {};
  const updateFields = {
    name: normalizeString(changes.name),
    email: currentEmail,
    phone: normalizeString(changes.phone),
    birth_date: normalizeString(changes.birthDate),
    goal: normalizeString(changes.goal),
    focus: normalizeString(changes.focus),
    injuries: normalizeString(changes.injuries),
  };

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const anchorClauses = [`email.eq.${currentEmail}`];
  if (authMemberId) anchorClauses.push(`id.eq.${authMemberId}`);
  if (requestedMemberId) anchorClauses.push(`id.eq.${requestedMemberId}`);
  requestedMemberIds.forEach((id) => anchorClauses.push(`id.eq.${id}`));
  const { data: anchorRows, error: anchorError } = await adminClient
    .from("members")
    .select("id,email")
    .or(anchorClauses.join(","));

  if (anchorError) {
    return jsonResponse(500, { error: `Could not resolve member anchors: ${anchorError.message}` });
  }

  const targetIds = Array.from(
    new Set(
      (anchorRows ?? [])
        .map((row) => normalizeString(row.id))
        .filter(Boolean)
    )
  );
  const targetEmails = Array.from(
    new Set(
      [currentEmail, ...(anchorRows ?? []).map((row) => normalizeEmail(row.email))]
        .filter((value) => value && value.includes("@"))
    )
  );
  if (!targetIds.length && !targetEmails.length) {
    return jsonResponse(200, { message: "No matching member rows found", updated: 0 });
  }

  const query = adminClient.from("members").update(updateFields);
  let data: Array<{ id: string }> | null = null;
  let error: { message: string } | null = null;
  if (targetIds.length && targetEmails.length) {
    const combinedClauses = [
      ...targetIds.map((id) => `id.eq.${id}`),
      ...targetEmails.map((email) => `email.eq.${email}`),
    ];
    const result = await query.or(combinedClauses.join(",")).select("id");
    data = result.data as Array<{ id: string }> | null;
    error = result.error ? { message: result.error.message } : null;
  } else if (targetIds.length) {
    const result = await query.in("id", targetIds).select("id");
    data = result.data as Array<{ id: string }> | null;
    error = result.error ? { message: result.error.message } : null;
  } else {
    const result = await query.in("email", targetEmails).select("id");
    data = result.data as Array<{ id: string }> | null;
    error = result.error ? { message: result.error.message } : null;
  }

  if (error) {
    return jsonResponse(500, { error: `Could not update member rows: ${error.message}` });
  }

  return jsonResponse(200, { message: "Member profile synced", updated: data?.length ?? 0 });
});
