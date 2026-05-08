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
  if (!email) return { ids: [memberId], email: "" };

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

  const memberId = String(payload.memberId ?? "").trim();
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

  if (!ownerUserId) return jsonResponse(401, { error: "Missing authenticated user id" });
  if (!memberId || memberId.startsWith("auth-")) return jsonResponse(400, { error: "Valid memberId is required" });
  if (!title) return jsonResponse(400, { error: "Title is required" });

  if (memberId === "__template__") {
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
  const writtenIds: string[] = [];

  if (programId) {
    const { error } = await adminClient.from("training_programs").upsert(
      {
        id: programId,
        member_id: memberId,
        owner_user_id: ownerUserId,
        title,
        goal,
        notes,
        exercises,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return jsonResponse(500, { error: error.message });
    writtenIds.push(programId);
  } else {
    for (const targetMemberId of targetMemberIds) {
      const id = crypto.randomUUID();
      const { error } = await adminClient.from("training_programs").insert({
        id,
        member_id: targetMemberId,
        owner_user_id: ownerUserId,
        title,
        goal,
        notes,
        exercises,
        created_at: new Date().toISOString(),
      });
      if (error) return jsonResponse(500, { error: error.message });
      writtenIds.push(id);
    }
  }

  await syncAuthMemberLink(adminClient, email, memberId);

  return jsonResponse(200, {
    ok: true,
    ids: writtenIds,
    targetMemberIds,
  });
});
