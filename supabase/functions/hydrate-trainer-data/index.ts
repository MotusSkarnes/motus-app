import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HydratePayload = {
  ownerUserId?: string;
  includeDebug?: boolean;
};

type RowWithId = { id?: string };

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueById<T extends RowWithId>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  rows.forEach((row) => {
    const id = String(row.id ?? "").trim();
    if (!id) return;
    if (!byId.has(id)) {
      byId.set(id, row);
    }
  });
  return Array.from(byId.values());
}

function isSharedMember(row: Record<string, unknown>): boolean {
  return String(row.customer_type ?? "").trim().toLowerCase() === "medlem";
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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

  let payload: HydratePayload;
  try {
    payload = (await req.json()) as HydratePayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const ownerUserId = String(payload.ownerUserId ?? "").trim();
  const includeDebug = payload.includeDebug === true;
  if (!ownerUserId) {
    return jsonResponse(400, { error: "ownerUserId is required" });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Recovery: claim legacy rows with missing owner_user_id.
  await adminClient.from("members").update({ owner_user_id: ownerUserId }).is("owner_user_id", null);

  const { data: ownedMembers } = await adminClient.from("members").select("id").eq("owner_user_id", ownerUserId);
  const ownedMemberIds = (ownedMembers ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean);

  if (ownedMemberIds.length > 0) {
    await adminClient
      .from("training_programs")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
    await adminClient
      .from("workout_logs")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
    await adminClient
      .from("chat_messages")
      .update({ owner_user_id: ownerUserId })
      .is("owner_user_id", null)
      .in("member_id", ownedMemberIds);
  }

  const membersSelectWithAvatar =
    "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, avatar_url, created_at";
  const membersSelectWithoutAvatar =
    "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, created_at";
  let members: Array<Record<string, unknown>> | null = null;
  let membersError: { message: string } | null = null;
  const ownedMembersWithAvatar = await adminClient
    .from("members")
    .select(membersSelectWithAvatar)
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });
  const sharedMembersWithAvatar = await adminClient
    .from("members")
    .select(membersSelectWithAvatar)
    .ilike("customer_type", "%medlem%")
    .neq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });
  if (
    (ownedMembersWithAvatar.error && ownedMembersWithAvatar.error.message.includes("avatar_url")) ||
    (sharedMembersWithAvatar.error && sharedMembersWithAvatar.error.message.includes("avatar_url"))
  ) {
    const ownedMembersWithoutAvatar = await adminClient
      .from("members")
      .select(membersSelectWithoutAvatar)
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: true });
    const sharedMembersWithoutAvatar = await adminClient
      .from("members")
      .select(membersSelectWithoutAvatar)
      .ilike("customer_type", "%medlem%")
      .neq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: true });
    members = uniqueById([...(ownedMembersWithoutAvatar.data ?? []), ...(sharedMembersWithoutAvatar.data ?? [])]) as Array<
      Record<string, unknown>
    >;
    membersError = ownedMembersWithoutAvatar.error ?? sharedMembersWithoutAvatar.error;
  } else {
    members = uniqueById([...(ownedMembersWithAvatar.data ?? []), ...(sharedMembersWithAvatar.data ?? [])]) as Array<
      Record<string, unknown>
    >;
    membersError = ownedMembersWithAvatar.error ?? sharedMembersWithAvatar.error;
  }
  if (!membersError && (members ?? []).length > 0) {
    const relatedEmailSet = new Set(
      (members ?? [])
        .map((row) => normalizeEmail((row as { email?: string }).email))
        .filter((value) => value && value.includes("@")),
    );
    const relatedNameSet = new Set(
      (members ?? [])
        .map((row) => String((row as { name?: string }).name ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    const allMembersWithAvatar = await adminClient
      .from("members")
      .select(membersSelectWithAvatar)
      .order("created_at", { ascending: true });
    let allMembersRows: Array<Record<string, unknown>> = [];
    if (allMembersWithAvatar.error && allMembersWithAvatar.error.message.includes("avatar_url")) {
      const allMembersWithoutAvatar = await adminClient
        .from("members")
        .select(membersSelectWithoutAvatar)
        .order("created_at", { ascending: true });
      allMembersRows = (allMembersWithoutAvatar.data ?? []) as Array<Record<string, unknown>>;
    } else {
      allMembersRows = (allMembersWithAvatar.data ?? []) as Array<Record<string, unknown>>;
    }
    const widenedMembers = allMembersRows.filter((row) => {
      if (isSharedMember(row)) return true;
      const rowEmail = normalizeEmail((row as { email?: string }).email);
      const rowName = String((row as { name?: string }).name ?? "").trim().toLowerCase();
      if (rowEmail && relatedEmailSet.has(rowEmail)) return true;
      if (rowName && relatedNameSet.has(rowName)) return true;
      return false;
    });
    members = uniqueById([...(members ?? []), ...widenedMembers]) as Array<Record<string, unknown>>;
  }

  const visibleMemberIds = (members ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean);

  const { data: programsByOwner, error: programsByOwnerError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  const { data: logsByOwner, error: logsByOwnerError } = await adminClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  const { data: messagesByOwner, error: messagesByOwnerError } = await adminClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  let programsByMember: Array<Record<string, unknown>> = [];
  let logsByMember: Array<Record<string, unknown>> = [];
  let messagesByMember: Array<Record<string, unknown>> = [];
  let programsByMemberError: { message: string } | null = null;
  let logsByMemberError: { message: string } | null = null;
  let messagesByMemberError: { message: string } | null = null;

  if (visibleMemberIds.length > 0) {
    const { data, error } = await adminClient
      .from("training_programs")
      .select("id, member_id, title, goal, notes, exercises, created_at")
      .in("member_id", visibleMemberIds)
      .order("created_at", { ascending: false });
    programsByMember = (data ?? []) as Array<Record<string, unknown>>;
    programsByMemberError = error;
  }

  if (visibleMemberIds.length > 0) {
    const { data, error } = await adminClient
      .from("workout_logs")
      .select("id, member_id, program_title, date, status, note, results, created_at")
      .in("member_id", visibleMemberIds)
      .order("created_at", { ascending: false });
    logsByMember = (data ?? []) as Array<Record<string, unknown>>;
    logsByMemberError = error;
  }

  if (visibleMemberIds.length > 0) {
    const { data, error } = await adminClient
      .from("chat_messages")
      .select("id, member_id, sender, text, created_at")
      .in("member_id", visibleMemberIds)
      .order("created_at", { ascending: true });
    messagesByMember = (data ?? []) as Array<Record<string, unknown>>;
    messagesByMemberError = error;
  }

  const { data: exercises, error: exercisesError } = await adminClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url")
    .or("is_active.is.null,is_active.eq.true")
    .order("name", { ascending: true });

  let periodPlanRows: Array<{ member_id: string; plan: unknown }> = [];
  const { data: periodRows, error: periodPlansError } =
    visibleMemberIds.length > 0
      ? await adminClient.from("member_period_plans").select("member_id, plan").in("member_id", visibleMemberIds)
      : await adminClient.from("member_period_plans").select("member_id, plan").eq("owner_user_id", ownerUserId);
  if (periodPlansError) {
    console.warn("hydrate-trainer-data: member_period_plans query failed (table may be missing):", periodPlansError.message);
  } else {
    periodPlanRows = (periodRows ?? []).map((row) => ({
      member_id: String((row as { member_id?: string }).member_id ?? ""),
      plan: (row as { plan?: unknown }).plan,
    }));
  }

  const mergedPrograms = uniqueById([...(programsByOwner ?? []), ...programsByMember]);
  const mergedLogs = uniqueById([...(logsByOwner ?? []), ...logsByMember]);
  const mergedMessages = uniqueById([...(messagesByOwner ?? []), ...messagesByMember]);
  const queryErrors = {
    members: membersError?.message ?? null,
    programsByOwner: programsByOwnerError?.message ?? null,
    logsByOwner: logsByOwnerError?.message ?? null,
    messagesByOwner: messagesByOwnerError?.message ?? null,
    programsByMember: programsByMemberError?.message ?? null,
    logsByMember: logsByMemberError?.message ?? null,
    messagesByMember: messagesByMemberError?.message ?? null,
    exercises: exercisesError?.message ?? null,
  };
  const hasQueryErrors = Object.values(queryErrors).some((value) => Boolean(value));

  return jsonResponse(200, {
    members: members ?? [],
    programs: mergedPrograms,
    logs: mergedLogs,
    messages: mergedMessages,
    exercises: exercises ?? [],
    periodPlans: periodPlanRows,
    debug: includeDebug
      ? {
          status: hasQueryErrors ? "partial_error" : "ok",
          message: hasQueryErrors ? "One or more hydrate queries failed; see queryErrors." : null,
          ownerUserId,
          ownedMemberIds,
          memberIdsFromMembersQuery: (members ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean),
          logMemberIdsByOwnerQuery: (logsByOwner ?? [])
            .map((row) => String((row as { member_id?: string }).member_id ?? ""))
            .filter(Boolean),
          logMemberIdsByMemberQuery: logsByMember
            .map((row) => String((row as { member_id?: string }).member_id ?? ""))
            .filter(Boolean),
          logIdsByOwnerQuery: (logsByOwner ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean),
          logIdsByMemberQuery: logsByMember.map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean),
          mergedLogIds: mergedLogs.map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean),
          counts: {
            members: (members ?? []).length,
            programsByOwner: (programsByOwner ?? []).length,
            programsByMember: programsByMember.length,
            logsByOwner: (logsByOwner ?? []).length,
            logsByMember: logsByMember.length,
            mergedLogs: mergedLogs.length,
            messagesByOwner: (messagesByOwner ?? []).length,
            messagesByMember: messagesByMember.length,
            mergedMessages: mergedMessages.length,
          },
          queryErrors,
          generatedAt: new Date().toISOString(),
        }
      : null,
  });
});
