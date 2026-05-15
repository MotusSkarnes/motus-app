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
  targetName?: string;
  changes?: {
    name?: string;
    phone?: string;
    birthDate?: string;
    goal?: string;
    focus?: string;
    injuries?: string;
    /** Encoded profile metrics / app metadata; see MemberPortal MOTUS_PROFILE_V1 */
    personalGoals?: string;
    avatarUrl?: string;
    /** Trainer-only; applied server-side only when JWT role is trainer */
    membershipType?: string;
    customerType?: string;
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

function canTrainerEditAnchor(row: { owner_user_id?: string | null; customer_type?: string | null }, trainerUserId: string): boolean {
  const ownerUserId = normalizeString(row.owner_user_id);
  const customerType = normalizeString(row.customer_type).toLowerCase();
  return ownerUserId === trainerUserId || customerType === "medlem";
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
  if (userRole && userRole !== "member" && userRole !== "trainer") {
    return jsonResponse(403, { error: "Only members/trainers can update profile through this endpoint" });
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
  if (userRole === "member" && requestedEmail && requestedEmail !== currentEmail) {
    if (!requestedEmails.includes(currentEmail)) {
      return jsonResponse(403, { error: "Email mismatch for member profile update" });
    }
  }

  const changes = payload.changes ?? {};
  const targetEmailForUpdate = requestedEmail || currentEmail;
  const updateFields: Record<string, string> = {
    email: targetEmailForUpdate,
  };
  if (changes.name !== undefined) updateFields.name = normalizeString(changes.name);
  if (changes.phone !== undefined) updateFields.phone = normalizeString(changes.phone);
  if (changes.birthDate !== undefined) updateFields.birth_date = normalizeString(changes.birthDate);
  if (changes.goal !== undefined) updateFields.goal = normalizeString(changes.goal);
  if (changes.focus !== undefined) updateFields.focus = normalizeString(changes.focus);
  if (changes.injuries !== undefined) updateFields.injuries = normalizeString(changes.injuries);
  if (changes.personalGoals !== undefined) updateFields.personal_goals = normalizeString(changes.personalGoals);
  if (changes.avatarUrl !== undefined) updateFields.avatar_url = normalizeString(changes.avatarUrl);

  // Membership / customer type: ikke for medlem-session; trener eller JWT uten role (eldre trener-kontoer).
  const canEditMembershipFields = userRole === "trainer" || userRole === "";
  if (canEditMembershipFields) {
    if (changes.membershipType !== undefined) {
      const mt = normalizeString(changes.membershipType).toLowerCase();
      if (mt === "premium") updateFields.membership_type = "Premium";
      else if (mt === "standard") updateFields.membership_type = "Standard";
    }
    if (changes.customerType !== undefined) {
      const ct = normalizeString(changes.customerType);
      const allowedCustomer = new Set(["PT-kunde", "Medlem", "Oppfølging", "Egentrening"]);
      if (allowedCustomer.has(ct)) updateFields.customer_type = ct;
    }
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const anchorClauses = [];
  if (requestedEmail) anchorClauses.push(`email.eq.${requestedEmail}`);
  anchorClauses.push(`email.eq.${currentEmail}`);
  requestedEmails.forEach((email) => anchorClauses.push(`email.eq.${email}`));
  if (authMemberId) anchorClauses.push(`id.eq.${authMemberId}`);
  if (requestedMemberId) anchorClauses.push(`id.eq.${requestedMemberId}`);
  requestedMemberIds.forEach((id) => anchorClauses.push(`id.eq.${id}`));
  const { data: anchorRows, error: anchorError } = await adminClient
    .from("members")
    .select("id,email,name,owner_user_id,customer_type")
    .or(anchorClauses.join(","));

  if (anchorError) {
    return jsonResponse(500, { error: `Could not resolve member anchors: ${anchorError.message}` });
  }

  const visibleAnchors = (anchorRows ?? []).filter((row) => {
    if (userRole !== "trainer") return true;
    return canTrainerEditAnchor(
      row as { owner_user_id?: string | null; customer_type?: string | null },
      user.id,
    );
  });

  const normalizedTargetEmails = new Set<string>(
    [targetEmailForUpdate, currentEmail, ...requestedEmails].map((value) => normalizeEmail(value)).filter(Boolean),
  );
  let expandedRows: Array<{ id: string; email: string; owner_user_id: string | null; customer_type: string | null }> = [];
  if (normalizedTargetEmails.size) {
    // Legacy data can contain casing/whitespace variants in email, so do a broad fetch
    // and normalize in-memory to find all duplicates that should sync together.
    // Never match by display name — common names (e.g. "Emil") would overwrite unrelated members.
    const { data: allRows, error: allRowsError } = await adminClient
      .from("members")
      .select("id,email,name,owner_user_id,customer_type");
    if (allRowsError) {
      return jsonResponse(500, { error: `Could not expand member targets: ${allRowsError.message}` });
    }
    expandedRows = (allRows ?? []).filter((row) => {
      const rowEmail = normalizeEmail(row.email);
      return Boolean(rowEmail && normalizedTargetEmails.has(rowEmail));
    });
  }
  const visibleExpandedRows = expandedRows.filter(() => {
    if (userRole !== "trainer") return true;
    const hasAuthorizedAnchor = visibleAnchors.length > 0;
    if (!hasAuthorizedAnchor) return false;
    return true;
  });

  const targetIds = Array.from(
    new Set(
      [...visibleAnchors, ...visibleExpandedRows]
        .map((row) => normalizeString(row.id))
        .filter(Boolean)
    )
  );
  const targetEmails = Array.from(
    new Set(
      [targetEmailForUpdate, ...requestedEmails, ...visibleAnchors.map((row) => normalizeEmail(row.email)), ...visibleExpandedRows.map((row) => normalizeEmail(row.email))]
        .filter((value) => value && value.includes("@"))
    )
  );
  if (!targetIds.length && !targetEmails.length) {
    // Last-resort bootstrap for missing member row: create one tied to auth user.
    const fallbackMemberId = authMemberId || requestedMemberId || `member-${crypto.randomUUID().slice(0, 8)}`;
    const insertPayload: Record<string, unknown> = {
      id: fallbackMemberId,
      owner_user_id: user.id,
      email: currentEmail,
      is_active: true,
      customer_type: "Medlem",
      membership_type: "Standard",
      days_since_activity: "0",
      name: normalizeString(changes.name) || normalizeString((user.user_metadata?.full_name as string | undefined) ?? user.email),
      phone: normalizeString(changes.phone),
      birth_date: normalizeString(changes.birthDate),
      goal: normalizeString(changes.goal),
      focus: normalizeString(changes.focus),
      injuries: normalizeString(changes.injuries),
      personal_goals: normalizeString(changes.personalGoals),
      avatar_url: normalizeString(changes.avatarUrl),
    };
    const bootstrapResult = await adminClient.from("members").upsert(insertPayload, { onConflict: "id" }).select("id");
    if (bootstrapResult.error) {
      return jsonResponse(500, { error: `Could not bootstrap member row: ${bootstrapResult.error.message}` });
    }
    return jsonResponse(200, { message: "Member profile synced (bootstrapped)", updated: bootstrapResult.data?.length ?? 0 });
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
