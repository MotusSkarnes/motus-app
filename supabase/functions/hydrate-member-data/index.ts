import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  const requesterEmail = normalizeEmail(userData.user.email);
  const authMemberId = String(
    (userData.user.app_metadata?.member_id as string | undefined) ??
      (userData.user.user_metadata?.member_id as string | undefined) ??
      ""
  ).trim();
  if (!requesterEmail || !requesterEmail.includes("@")) {
    return jsonResponse(400, { error: "Authenticated user email is missing" });
  }

  const membersSelectWithAvatar =
    "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, avatar_url, created_at";
  const membersSelectWithoutAvatar =
    "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, created_at";

  let allMembers: Array<Record<string, unknown>> | null = null;
  let membersError: { message: string } | null = null;
  const membersWithAvatar = await adminClient.from("members").select(membersSelectWithAvatar).order("created_at", { ascending: false });
  if (membersWithAvatar.error && membersWithAvatar.error.message.includes("avatar_url")) {
    const membersWithoutAvatar = await adminClient
      .from("members")
      .select(membersSelectWithoutAvatar)
      .order("created_at", { ascending: false });
    allMembers = (membersWithoutAvatar.data ?? []) as Array<Record<string, unknown>>;
    membersError = membersWithoutAvatar.error;
  } else {
    allMembers = (membersWithAvatar.data ?? []) as Array<Record<string, unknown>>;
    membersError = membersWithAvatar.error;
  }
  if (membersError) return jsonResponse(500, { error: membersError.message });

  const members = (allMembers ?? []).filter((row) => {
    const rowEmail = normalizeEmail((row as { email?: string }).email);
    const rowId = String((row as { id?: string }).id ?? "").trim();
    if (rowEmail === requesterEmail) return true;
    if (authMemberId && rowId === authMemberId) return true;
    return false;
  });

  // Legacy-dupe support: widen member scope to rows sharing email or name
  // with the initially matched member rows, so messages/programs survive refresh.
  const relatedEmailSet = new Set(
    members
      .map((row) => normalizeEmail((row as { email?: string }).email))
      .filter((value) => value && value.includes("@")),
  );
  const relatedNameSet = new Set(
    members
      .map((row) => String((row as { name?: string }).name ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const widenedMembers = (allMembers ?? []).filter((row) => {
    const rowEmail = normalizeEmail((row as { email?: string }).email);
    const rowName = String((row as { name?: string }).name ?? "").trim().toLowerCase();
    if (rowEmail && relatedEmailSet.has(rowEmail)) return true;
    if (rowName && relatedNameSet.has(rowName)) return true;
    return false;
  });
  const dedupedMembersById = new Map<string, Record<string, unknown>>();
  [...members, ...widenedMembers].forEach((row) => {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id) return;
    if (!dedupedMembersById.has(id)) dedupedMembersById.set(id, row as Record<string, unknown>);
  });
  const scopedMembers = Array.from(dedupedMembersById.values());

  const memberIds = (scopedMembers ?? [])
    .map((row) => String((row as { id?: string }).id ?? "").trim())
    .filter(Boolean);
  const ownerUserIds = Array.from(
    new Set(
      (scopedMembers ?? [])
        .map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (!memberIds.length) {
    return jsonResponse(200, {
      members: [],
      programs: [],
      logs: [],
      messages: [],
      periodPlans: [],
      exercises: [],
    });
  }

  const { data: programsRaw, error: programsError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id")
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });
  const { data: logs, error: logsError } = await adminClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results, created_at")
    .in("member_id", memberIds)
    .order("created_at", { ascending: false });
  const { data: messagesByMember, error: messagesError } = await adminClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .in("member_id", memberIds)
    .order("created_at", { ascending: true });
  const { data: messagesByOwner, error: messagesByOwnerError } =
    ownerUserIds.length > 0
      ? await adminClient
          .from("chat_messages")
          .select("id, member_id, sender, text, created_at")
          .in("owner_user_id", ownerUserIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  let periodPlans: Array<{ member_id: string; plan: unknown }> = [];
  const { data: periodRows, error: periodPlansError } = await adminClient
    .from("member_period_plans")
    .select("member_id, plan")
    .in("member_id", memberIds);
  if (periodPlansError) {
    console.warn("hydrate-member-data: member_period_plans query failed (table may be missing):", periodPlansError.message);
  } else {
    periodPlans = (periodRows ?? []).map((row) => ({
      member_id: String((row as { member_id?: string }).member_id ?? ""),
      plan: (row as { plan?: unknown }).plan,
    }));
  }

  let exercises: Array<Record<string, unknown>> = [];
  const { data: exerciseRows, error: exercisesError } = await adminClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url")
    .order("name", { ascending: true });
  if (exercisesError) {
    console.warn("hydrate-member-data: exercise_bank query failed:", exercisesError.message);
  } else {
    exercises = (exerciseRows ?? []) as Array<Record<string, unknown>>;
  }

  const firstError = programsError ?? logsError ?? messagesError ?? messagesByOwnerError;
  if (firstError) {
    return jsonResponse(500, { error: firstError.message });
  }

  const messagesById = new Map<string, Record<string, unknown>>();
  [...(messagesByOwner ?? []), ...(messagesByMember ?? [])].forEach((row) => {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id) return;
    if (!messagesById.has(id)) {
      messagesById.set(id, row as Record<string, unknown>);
    }
  });
  const messages = Array.from(messagesById.values());

  const trainerNameByOwnerId = new Map<string, string>();
  const programOwnerUserIds = Array.from(
    new Set(
      (programsRaw ?? [])
        .map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim())
        .filter(Boolean),
    ),
  );
  for (const ownerUserId of programOwnerUserIds) {
    try {
      const { data: trainerData, error: trainerError } = await adminClient.auth.admin.getUserById(ownerUserId);
      if (trainerError || !trainerData?.user) continue;
      const fullName = String(
        (trainerData.user.user_metadata?.full_name as string | undefined) ??
          (trainerData.user.user_metadata?.name as string | undefined) ??
          ""
      ).trim();
      const email = String(trainerData.user.email ?? "").trim();
      const trainerFirstName = toFirstName(fullName) || nameFromEmail(email) || "";
      trainerNameByOwnerId.set(ownerUserId, trainerFirstName);
    } catch {
      // Ignore lookup failures; frontend will use fallback label.
    }
  }

  const programs = (programsRaw ?? []).map((row) => {
    const typedRow = row as Record<string, unknown>;
    const ownerUserId = String(typedRow.owner_user_id ?? "").trim();
    return {
      ...typedRow,
      assigned_trainer_name: trainerNameByOwnerId.get(ownerUserId) ?? "",
    };
  });

  return jsonResponse(200, {
    members: scopedMembers ?? [],
    programs,
    logs: logs ?? [],
    messages: messages ?? [],
    periodPlans,
    exercises,
  });
});
