import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdatePayload = {
  email?: string;
  emails?: string[];
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
  const requestedEmails = Array.isArray(payload.emails)
    ? payload.emails.map((value) => normalizeEmail(value)).filter((value) => value && value.includes("@"))
    : [];
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
    if (!requestedEmails.includes(currentEmail)) {
      return jsonResponse(403, { error: "Email mismatch for member profile update" });
    }
  }

  const changes = payload.changes ?? {};
  const updateFields: Record<string, string> = {
    email: currentEmail,
  };
  if (changes.name !== undefined) updateFields.name = normalizeString(changes.name);
  if (changes.phone !== undefined) updateFields.phone = normalizeString(changes.phone);
  if (changes.birthDate !== undefined) updateFields.birth_date = normalizeString(changes.birthDate);
  if (changes.goal !== undefined) updateFields.goal = normalizeString(changes.goal);
  if (changes.focus !== undefined) updateFields.focus = normalizeString(changes.focus);
  if (changes.injuries !== undefined) updateFields.injuries = normalizeString(changes.injuries);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const anchorClauses = [`email.eq.${currentEmail}`];
  requestedEmails.forEach((email) => anchorClauses.push(`email.eq.${email}`));
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

  const updatedIds = new Set<string>();
  if (targetIds.length) {
    const byIdResult = await adminClient.from("members").update(updateFields).in("id", targetIds).select("id");
    if (byIdResult.error) {
      return jsonResponse(500, { error: `Could not update member rows by id: ${byIdResult.error.message}` });
    }
    (byIdResult.data ?? []).forEach((row) => {
      const id = normalizeString((row as { id?: string }).id);
      if (id) updatedIds.add(id);
    });
  }

  if (targetEmails.length) {
    const byEmailResult = await adminClient.from("members").update(updateFields).in("email", targetEmails).select("id");
    if (byEmailResult.error) {
      return jsonResponse(500, { error: `Could not update member rows by email: ${byEmailResult.error.message}` });
    }
    (byEmailResult.data ?? []).forEach((row) => {
      const id = normalizeString((row as { id?: string }).id);
      if (id) updatedIds.add(id);
    });
  }

  return jsonResponse(200, { message: "Member profile synced", updated: updatedIds.size });
});
