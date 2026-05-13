import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ProgramExercise = Record<string, unknown>;

type SaveProgramPayload = {
  id?: string;
  memberId?: string;
  title?: string;
  goal?: string;
  notes?: string;
  exercises?: ProgramExercise[];
  targetEmail?: string;
  targetName?: string;
  customerType?: string;
  membershipType?: string;
  /** Hint only; overskrives server-side ut fra JWT-rolle. */
  programCreatedBy?: string;
  programCreatedByName?: string;
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

function toFirstName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

function nameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  return toFirstName(normalized);
}

type JwtUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

function roleFromUser(user: JwtUser): "member" | "trainer" {
  const app = user.app_metadata?.role;
  if (app === "member" || app === "trainer") return app;
  const um = user.user_metadata?.role;
  if (um === "member" || um === "trainer") return um;
  return "trainer";
}

function trainerDisplayFirstName(user: JwtUser): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full = String(meta?.full_name ?? meta?.name ?? "").trim();
  if (full) return toFirstName(full);
  const em = String(user.email ?? "").trim();
  return nameFromEmail(em);
}

type ProgramAuthorColumns = {
  program_created_by: string;
  program_created_by_name: string;
};

function resolveProgramAuthorColumns(
  user: JwtUser,
  role: "member" | "trainer",
  payload: SaveProgramPayload,
  hintTargetName: string,
): ProgramAuthorColumns {
  const clamp = (s: string) => s.trim().slice(0, 160);
  if (role === "member") {
    const name =
      clamp(String(payload.programCreatedByName ?? "")) ||
      clamp(hintTargetName) ||
      nameFromEmail(String(user.email ?? ""));
    return { program_created_by: "member", program_created_by_name: name || "Medlem" };
  }
  const name =
    trainerDisplayFirstName(user) ||
    clamp(String(payload.programCreatedByName ?? "")) ||
    "Trener";
  return { program_created_by: "trainer", program_created_by_name: name };
}

async function resolveRelatedMemberIds(
  adminClient: ReturnType<typeof createClient>,
  memberId: string,
  hints?: {
    targetEmail?: string;
    targetName?: string;
    customerType?: string;
    membershipType?: string;
    ownerUserId?: string;
  },
): Promise<{ ids: string[]; email: string }> {
  const { data: memberRow, error: memberError } = await adminClient
    .from("members")
    .select("id, email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    throw new Error(`Could not resolve member: ${memberError.message}`);
  }

  const email = normalizeEmail((memberRow as { email?: string } | null)?.email) || normalizeEmail(hints?.targetEmail);
  if (!email) {
    throw new Error("Cannot save program without a member email. Save the member row before assigning a program.");
  }

  const { data: rows, error: rowsError } = await adminClient
    .from("members")
    .select("id")
    .ilike("email", email);

  if (rowsError) {
    throw new Error(`Could not resolve related members: ${rowsError.message}`);
  }

  const ids = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter((id) => id && id !== "__template__" && !id.startsWith("auth-")),
    ),
  );

  if (ids.length) return { ids, email };

  const targetName = String(hints?.targetName ?? "").trim() || email.split("@")[0] || "Medlem";
  const ownerUserId = String(hints?.ownerUserId ?? "").trim();
  const customerType = String(hints?.customerType ?? "").trim() || "Medlem";
  const membershipType = String(hints?.membershipType ?? "").trim() || "Standard";
  const id = memberId && memberId !== "__template__" && !memberId.startsWith("auth-") ? memberId : crypto.randomUUID();
  const { error: insertError } = await adminClient.from("members").upsert(
    {
      id,
      owner_user_id: ownerUserId || null,
      name: targetName,
      email,
      is_active: true,
      membership_type: membershipType,
      customer_type: customerType,
      days_since_activity: "0",
      goal: "",
      focus: "",
      injuries: "",
      coach_notes: "",
      personal_goals: "",
    },
    { onConflict: "id" },
  );
  if (insertError) {
    throw new Error(`Could not create missing member row: ${insertError.message}`);
  }

  return { ids: [id], email };
}

async function syncAuthMemberLink(
  adminClient: ReturnType<typeof createClient>,
  email: string,
  memberId: string,
) {
  if (!email || !email.includes("@") || !memberId) return;
  const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    console.warn("save-training-program: auth user lookup failed:", listError.message);
    return;
  }

  const users = listData?.users ?? [];
  const targetUsers = users.filter((user) => normalizeEmail(user.email) === email);
  for (const user of targetUsers) {
    const appMetadata =
      user.app_metadata && typeof user.app_metadata === "object"
        ? (user.app_metadata as Record<string, unknown>)
        : {};
    const userMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};
    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { ...appMetadata, role: "member", member_id: memberId },
      user_metadata: { ...userMetadata, role: "member", member_id: memberId },
    });
    if (error) {
      console.warn("save-training-program: auth member link update failed:", error.message);
    }
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
    return jsonResponse(500, { error: "Missing Supabase service role environment variables" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) {
    return jsonResponse(401, { error: "Missing bearer token" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: "Invalid session token" });
  }

  let payload: SaveProgramPayload;
  try {
    payload = (await req.json()) as SaveProgramPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  let memberId = String(payload.memberId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const goal = String(payload.goal ?? "").trim();
  const notes = String(payload.notes ?? "").trim();
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  const ownerUserId = String(userData.user.id ?? "").trim();
  const programId = String(payload.id ?? "").trim();
  const targetEmail = normalizeEmail(payload.targetEmail);
  const targetName = String(payload.targetName ?? "").trim();
  const customerType = String(payload.customerType ?? "").trim();
  const membershipType = String(payload.membershipType ?? "").trim();
  const role = roleFromUser(userData.user);

  if (!ownerUserId) return jsonResponse(401, { error: "Missing authenticated user id" });
  if (!title) return jsonResponse(400, { error: "Title is required" });

  // Clients sometimes keep a synthetic `auth-*` id; map to DB `members.id` so upsert and RLS stay consistent.
  if ((!memberId || memberId.startsWith("auth-")) && role === "member") {
    const email = normalizeEmail(userData.user.email);
    if (!email) return jsonResponse(400, { error: "Valid memberId is required" });
    const { data: row } = await adminClient
      .from("members")
      .select("id")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.id) return jsonResponse(400, { error: "Valid memberId is required" });
    memberId = String(row.id).trim();
  }
  if (!memberId || memberId.startsWith("auth-")) {
    return jsonResponse(400, { error: "Valid memberId is required" });
  }

  const authorColumns = resolveProgramAuthorColumns(userData.user as JwtUser, role, payload, targetName);

  if (memberId === "__template__") {
    if (role === "member") {
      return jsonResponse(403, { error: "Medlemmer kan ikke lagre treningsmaler." });
    }
    const id = programId || crypto.randomUUID();
    const { error } = await adminClient.from("training_programs").upsert(
      {
        id,
        member_id: memberId,
        owner_user_id: ownerUserId,
        title,
        goal,
        notes,
        exercises,
        created_at: new Date().toISOString(),
        program_created_by: "trainer",
        program_created_by_name: authorColumns.program_created_by_name,
      },
      { onConflict: "id" },
    );
    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true, ids: [id], targetMemberIds: [memberId] });
  }

  const { ids: targetMemberIds, email } = await resolveRelatedMemberIds(adminClient, memberId, {
    targetEmail,
    targetName,
    customerType,
    membershipType,
    ownerUserId,
  });

  if (role === "member") {
    const email = normalizeEmail(userData.user.email);
    if (!email) {
      return jsonResponse(403, { error: "Du kan bare lagre programmer på din egen profil." });
    }
    const { data: myMemberRows } = await adminClient.from("members").select("id").ilike("email", email);
    const myIds = new Set(
      (myMemberRows ?? [])
        .map((r) => String((r as { id?: string }).id ?? "").trim())
        .filter((id) => Boolean(id)),
    );
    const allowed = targetMemberIds.some((tid) => myIds.has(tid));
    if (!allowed) {
      return jsonResponse(403, { error: "Du kan bare lagre programmer på din egen profil." });
    }
  }

  const writtenIds: string[] = [];
  const canonicalTargetMemberId =
    targetMemberIds.find((targetMemberId) => targetMemberId === memberId) ?? targetMemberIds[0] ?? memberId;

  if (programId) {
    const timestamp = new Date().toISOString();

    const { error: primaryError } = await adminClient.from("training_programs").upsert(
      {
        id: programId,
        member_id: canonicalTargetMemberId,
        owner_user_id: ownerUserId,
        title,
        goal,
        notes,
        exercises,
        created_at: timestamp,
        program_created_by: authorColumns.program_created_by,
        program_created_by_name: authorColumns.program_created_by_name,
      },
      { onConflict: "id" },
    );
    if (primaryError) return jsonResponse(500, { error: primaryError.message });
    writtenIds.push(programId);
  } else {
    const id = crypto.randomUUID();
    const { error } = await adminClient.from("training_programs").insert({
      id,
      member_id: canonicalTargetMemberId,
      owner_user_id: ownerUserId,
      title,
      goal,
      notes,
      exercises,
      created_at: new Date().toISOString(),
      program_created_by: authorColumns.program_created_by,
      program_created_by_name: authorColumns.program_created_by_name,
    });
    if (error) return jsonResponse(500, { error: error.message });
    writtenIds.push(id);
  }

  await syncAuthMemberLink(adminClient, email, canonicalTargetMemberId);

  return jsonResponse(200, {
    ok: true,
    ids: writtenIds,
    targetMemberIds: [canonicalTargetMemberId],
  });
});
