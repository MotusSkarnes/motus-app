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

function rowIsActive(row: Record<string, unknown>): boolean {
  return (row as { is_active?: boolean | null }).is_active !== false;
}

const MEMBER_ARCHIVED_MESSAGE =
  "Kundekontoen er arkivert. Kontakt din PT for å gjenåpne tilgang til appen.";

function memberArchivedResponse() {
  return jsonResponse(403, { error: "member_archived", message: MEMBER_ARCHIVED_MESSAGE });
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

function scorePersonalGoalsBlob(value: string): number {
  const raw = value.trim();
  if (!raw) return 0;
  let score = 0;
  if (raw.startsWith("MOTUS_PROFILE_V1:")) score += 100;
  if (raw.includes("onboardingCompletedAt")) score += 200;
  if (raw.includes('"onboarding"') && raw.includes("completedAt")) score += 160;
  else if (raw.includes('"onboarding"')) score += 80;
  if (raw.includes('"monthlyCheckIns"')) score += 50;
  score += Math.min(20, Math.floor(raw.length / 200));
  return score;
}

function pickBestPersonalGoalsFromRows(rows: Array<Record<string, unknown>>): string {
  let best = "";
  let bestScore = -1;
  for (const row of rows) {
    const value = String(row.personal_goals ?? "").trim();
    const score = scorePersonalGoalsBlob(value);
    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  }
  return best;
}

/** Synk duplikat-rader per e-post — behold rikest personal_goals (oppstartsskjema). */
function harmonizeMemberProfilesByEmail(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byEmail = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const emailKey = normalizeEmail(row.email);
    if (!emailKey) continue;
    const group = byEmail.get(emailKey) ?? [];
    group.push(row);
    byEmail.set(emailKey, group);
  }
  for (const [, group] of byEmail) {
    if (group.length <= 1) continue;
    const bestPersonalGoals = pickBestPersonalGoalsFromRows(group);
    if (bestPersonalGoals) {
      for (const row of group) {
        row.personal_goals = bestPersonalGoals;
      }
    }
    const anyNutritionAccess = group.some((row) => row.nutrition_access === true);
    if (anyNutritionAccess) {
      for (const row of group) {
        row.nutrition_access = true;
      }
    }
  }
  return rows;
}

function isMissingMembersColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  const col = column.toLowerCase();
  return (
    lower.includes(col) &&
    (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))
  );
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
  const requesterUserId = String(userData.user.id ?? "").trim();
  const authMemberId = String(
    (userData.user.app_metadata?.member_id as string | undefined) ??
      (userData.user.user_metadata?.member_id as string | undefined) ??
      ""
  ).trim();
  if (!requesterEmail || !requesterEmail.includes("@")) {
    return jsonResponse(400, { error: "Authenticated user email is missing" });
  }

  const { data: rosterRowsEarly, error: rosterEarlyError } = await adminClient
    .from("members")
    .select("id, email, is_active")
    .ilike("email", requesterEmail);
  if (rosterEarlyError) {
    return jsonResponse(500, { error: rosterEarlyError.message });
  }
  const emailRosterEarly = (rosterRowsEarly ?? []).filter(
    (row) => normalizeEmail((row as { email?: string }).email) === requesterEmail,
  );
  if (emailRosterEarly.length > 0 && !emailRosterEarly.some(rowIsActive)) {
    return memberArchivedResponse();
  }
  const hasEmailRoster = emailRosterEarly.length > 0;

  const membersSelectBase =
    "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, gender, weight, height, level, membership_type, customer_type, nutrition_access, days_since_activity, goal, focus, personal_goals, injuries, coach_notes";
  const membersSelectWithAvatar = `${membersSelectBase}, avatar_url, created_at`;
  const membersSelectWithoutAvatar = `${membersSelectBase}, created_at`;
  const membersSelectWithoutNutrition = membersSelectWithAvatar.replace(", nutrition_access", "");
  const membersSelectLegacy = membersSelectWithoutNutrition.replace(", avatar_url", "");

  async function fetchAllMembersRows(): Promise<{ rows: Array<Record<string, unknown>>; error: { message: string } | null }> {
    const attempt = await adminClient.from("members").select(membersSelectWithAvatar).order("created_at", { ascending: false });
    if (!attempt.error) {
      return { rows: (attempt.data ?? []) as Array<Record<string, unknown>>, error: null };
    }
    if (isMissingMembersColumnError(attempt.error.message, "nutrition_access")) {
      const withoutNutrition = await adminClient.from("members").select(membersSelectWithoutNutrition).order("created_at", { ascending: false });
      if (!withoutNutrition.error) {
        return { rows: (withoutNutrition.data ?? []) as Array<Record<string, unknown>>, error: null };
      }
      if (isMissingMembersColumnError(withoutNutrition.error.message, "avatar_url")) {
        const legacy = await adminClient.from("members").select(membersSelectLegacy).order("created_at", { ascending: false });
        return { rows: (legacy.data ?? []) as Array<Record<string, unknown>>, error: legacy.error };
      }
      return { rows: [], error: withoutNutrition.error };
    }
    if (isMissingMembersColumnError(attempt.error.message, "avatar_url")) {
      const withoutAvatar = await adminClient.from("members").select(membersSelectWithoutAvatar).order("created_at", { ascending: false });
      return { rows: (withoutAvatar.data ?? []) as Array<Record<string, unknown>>, error: withoutAvatar.error };
    }
    return { rows: [], error: attempt.error };
  }

  const { rows: allMembers, error: membersError } = await fetchAllMembersRows();
  if (membersError) return jsonResponse(500, { error: membersError.message });

  const members = (allMembers ?? []).filter((row) => {
    const rowEmail = normalizeEmail((row as { email?: string }).email);
    const rowId = String((row as { id?: string }).id ?? "").trim();
    if (rowEmail === requesterEmail) return true;
    if (authMemberId && rowId === authMemberId) return true;
    return false;
  });

  // Legacy-dupe support: widen member scope only to rows sharing the exact normalized email
  // with the initially matched member rows. Never match by display name; common names
  // like "Lene" can represent unrelated users across trainers.
  const relatedEmailSet = new Set(
    members
      .map((row) => normalizeEmail((row as { email?: string }).email))
      .filter((value) => value && value.includes("@")),
  );
  const widenedMembers = (allMembers ?? []).filter((row) => {
    const rowEmail = normalizeEmail((row as { email?: string }).email);
    if (rowEmail && relatedEmailSet.has(rowEmail)) return true;
    return false;
  });
  const dedupedMembersById = new Map<string, Record<string, unknown>>();
  [...members, ...widenedMembers].forEach((row) => {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id) return;
    if (!dedupedMembersById.has(id)) dedupedMembersById.set(id, row as Record<string, unknown>);
  });
  if (authMemberId && !dedupedMembersById.has(authMemberId)) {
    const { data: authMemberRow } = await adminClient
      .from("members")
      .select(membersSelectWithAvatar)
      .eq("id", authMemberId)
      .maybeSingle();
    if (authMemberRow) {
      dedupedMembersById.set(authMemberId, authMemberRow as Record<string, unknown>);
    }
  }
  // DB-side email match catches rows even if in-memory normalize/allMembers path missed them.
  let rowsByLoginEmail: Array<Record<string, unknown>> | null = null;
  const emailRowsAttempt = await adminClient.from("members").select(membersSelectWithAvatar).ilike("email", requesterEmail);
  if (!emailRowsAttempt.error) {
    rowsByLoginEmail = (emailRowsAttempt.data ?? []) as Array<Record<string, unknown>>;
  } else if (isMissingMembersColumnError(emailRowsAttempt.error.message, "nutrition_access")) {
    const emailFallback = await adminClient.from("members").select(membersSelectWithoutNutrition).ilike("email", requesterEmail);
    if (emailFallback.error) {
      console.warn("hydrate-member-data: members ilike email failed:", emailFallback.error.message);
    } else {
      rowsByLoginEmail = (emailFallback.data ?? []) as Array<Record<string, unknown>>;
    }
  } else if (isMissingMembersColumnError(emailRowsAttempt.error.message, "avatar_url")) {
    const emailRowsNoAvatar = await adminClient.from("members").select(membersSelectWithoutAvatar).ilike("email", requesterEmail);
    if (emailRowsNoAvatar.error) {
      console.warn("hydrate-member-data: members ilike email failed:", emailRowsNoAvatar.error.message);
    } else {
      rowsByLoginEmail = (emailRowsNoAvatar.data ?? []) as Array<Record<string, unknown>>;
    }
  } else {
    console.warn("hydrate-member-data: members ilike email failed:", emailRowsAttempt.error.message);
  }
  if (rowsByLoginEmail) {
    for (const row of rowsByLoginEmail) {
      const id = String((row as { id?: string }).id ?? "").trim();
      if (!id) continue;
      if (!dedupedMembersById.has(id)) dedupedMembersById.set(id, row);
    }
  }
  const emailRowsForAccess = rowsByLoginEmail ?? [];
  if (emailRowsForAccess.length > 0 && !emailRowsForAccess.some(rowIsActive)) {
    return memberArchivedResponse();
  }
  let scopedMembers = Array.from(dedupedMembersById.values()).filter(rowIsActive);

  let memberIds = (scopedMembers ?? [])
    .map((row) => String((row as { id?: string }).id ?? "").trim())
    .filter(Boolean);
  if (!memberIds.length && requesterUserId) {
    const { data: ownerScopedMembers } = await adminClient
      .from("members")
      .select(membersSelectWithAvatar)
      .eq("owner_user_id", requesterUserId)
      .order("created_at", { ascending: false });
    const fallbackMembers = ((ownerScopedMembers ?? []) as Array<Record<string, unknown>>).filter(rowIsActive);
    if (fallbackMembers.length > 0) {
      const fallbackById = new Map<string, Record<string, unknown>>();
      [...scopedMembers, ...fallbackMembers].forEach((row) => {
        const id = String((row as { id?: string }).id ?? "").trim();
        if (!id) return;
        if (!fallbackById.has(id)) fallbackById.set(id, row);
      });
      memberIds = Array.from(fallbackById.keys());
      scopedMembers = Array.from(fallbackById.values());
    }
  }
  if (emailRowsForAccess.length > 0 && !emailRowsForAccess.some(rowIsActive)) {
    return memberArchivedResponse();
  }
  if (!memberIds.length) {
    if (hasEmailRoster || emailRowsForAccess.length > 0) {
      return memberArchivedResponse();
    }
    const authFallbackIds = Array.from(
      new Set(
        [authMemberId, requesterUserId, requesterUserId ? `auth-${requesterUserId}` : ""]
          .map((value) => String(value ?? "").trim())
          .filter((value) => value && value !== "__template__"),
      ),
    );
    if (authFallbackIds.length > 0) {
      memberIds = authFallbackIds;
      const fallbackName =
        toFirstName(
          String(
            (userData.user.user_metadata?.full_name as string | undefined) ??
              (userData.user.user_metadata?.name as string | undefined) ??
              "",
          ),
        ) || nameFromEmail(requesterEmail) || "Medlem";
      scopedMembers = authFallbackIds.map((id) => ({
        id,
        owner_user_id: "",
        name: fallbackName,
        email: requesterEmail,
        is_active: true,
        invited_at: "",
        phone: "",
        birth_date: "",
        weight: "",
        height: "",
        level: "Nybegynner",
        membership_type: "Standard",
        customer_type: "Medlem",
        days_since_activity: "0",
        goal: "",
        focus: "",
        personal_goals: "",
        injuries: "",
        coach_notes: "",
        avatar_url: "",
        created_at: "",
      }));
    }
  }
  if (!memberIds.length) {
    return jsonResponse(200, {
      members: [],
      programs: [],
      logs: [],
      messages: [],
      periodPlans: [],
      mealPlans: [],
      mealPlanStates: [],
      exercises: [],
    });
  }

  // One lookup list for programs, logs, messages, period plans: include every scoped member id
  // (including synthetic `auth-*`) plus legacy keys (email string, JWT member_id, auth.uid).
  // Previously programs omitted `auth-*` ids from the `.in()` list while logs used raw `memberIds`,
  // so rows keyed only by synthetic ids could be missing from hydrate on some devices.
  const memberDataLookupIds = new Set<string>();
  for (const rawId of memberIds) {
    const id = String(rawId ?? "").trim();
    if (id && id !== "__template__") memberDataLookupIds.add(id);
  }
  if (requesterEmail) {
    memberDataLookupIds.add(requesterEmail);
  }
  for (const raw of [authMemberId, requesterUserId, requesterUserId ? `auth-${requesterUserId}` : ""]) {
    const id = String(raw ?? "").trim();
    if (id && id !== "__template__") memberDataLookupIds.add(id);
  }
  let memberDataLookupList = Array.from(memberDataLookupIds);
  if (!memberDataLookupList.length) {
    memberDataLookupList = memberIds
      .map((id) => String(id ?? "").trim())
      .filter((id) => id && id !== "__template__");
  }

  const { data: programsRaw, error: programsError } =
    memberDataLookupList.length > 0
      ? await adminClient
          .from("training_programs")
          .select("*")
          .in("member_id", memberDataLookupList)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  const { data: programsByRequesterOwner, error: programsByRequesterOwnerError } =
    requesterUserId
      ? await adminClient
          .from("training_programs")
          .select("*")
          .eq("owner_user_id", requesterUserId)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  const { data: logs, error: logsError } =
    memberDataLookupList.length > 0
      ? await adminClient
          .from("workout_logs")
          .select("id, member_id, program_title, date, status, note, results, created_at")
          .in("member_id", memberDataLookupList)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
  const { data: messagesByMember, error: messagesError } =
    memberDataLookupList.length > 0
      ? await adminClient
          .from("chat_messages")
          .select("id, member_id, owner_user_id, sender, text, created_at, read_by_member_at, read_by_trainer_at")
          .in("member_id", memberDataLookupList)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
  const { data: messagesByRequesterOwner, error: messagesByRequesterOwnerError } =
    requesterUserId
      ? await adminClient
          .from("chat_messages")
          .select("id, member_id, owner_user_id, sender, text, created_at, read_by_member_at, read_by_trainer_at")
          .eq("owner_user_id", requesterUserId)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  let periodPlans: Array<{ member_id: string; plan: unknown }> = [];
  if (memberDataLookupList.length > 0) {
    const { data: periodRows, error: periodPlansError } = await adminClient
      .from("member_period_plans")
      .select("member_id, plan")
      .in("member_id", memberDataLookupList);
    if (periodPlansError) {
      console.warn("hydrate-member-data: member_period_plans query failed (table may be missing):", periodPlansError.message);
    } else {
      periodPlans = (periodRows ?? []).map((row) => ({
        member_id: String((row as { member_id?: string }).member_id ?? ""),
        plan: (row as { plan?: unknown }).plan,
      }));
    }
  }

  let mealPlans: Array<Record<string, unknown>> = [];
  if (memberDataLookupList.length > 0) {
    const { data: mealPlanRows, error: mealPlansError } = await adminClient
      .from("member_meal_plans")
      .select("member_id, title, notes, days, targets, updated_at")
      .in("member_id", memberDataLookupList);
    if (mealPlansError) {
      console.warn("hydrate-member-data: member_meal_plans query failed (table may be missing):", mealPlansError.message);
    } else {
      mealPlans = (mealPlanRows ?? []) as Array<Record<string, unknown>>;
    }
  }

  let mealPlanStates: Array<Record<string, unknown>> = [];
  if (memberDataLookupList.length > 0) {
    const { data: stateRows, error: mealPlanStatesError } = await adminClient
      .from("member_meal_plan_state")
      .select("member_id, state, updated_at")
      .in("member_id", memberDataLookupList);
    if (mealPlanStatesError) {
      console.warn("hydrate-member-data: member_meal_plan_state query failed (table may be missing):", mealPlanStatesError.message);
    } else {
      mealPlanStates = (stateRows ?? []) as Array<Record<string, unknown>>;
    }
  }

  let exercises: Array<Record<string, unknown>> = [];
  const { data: exerciseRows, error: exercisesError } = await adminClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url, prescription_fields, custom_field_1_label, custom_field_2_label")
    .or("is_active.is.null,is_active.eq.true")
    .order("name", { ascending: true });
  if (exercisesError) {
    console.warn("hydrate-member-data: exercise_bank query failed:", exercisesError.message);
  } else {
    exercises = (exerciseRows ?? []) as Array<Record<string, unknown>>;
  }

  const firstError =
    programsError ?? programsByRequesterOwnerError ?? logsError ?? messagesError ?? messagesByRequesterOwnerError;
  if (firstError) {
    return jsonResponse(500, { error: firstError.message });
  }

  const messagesById = new Map<string, Record<string, unknown>>();
  [...(messagesByRequesterOwner ?? []), ...(messagesByMember ?? [])].forEach((row) => {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id) return;
    if (!messagesById.has(id)) {
      messagesById.set(id, row as Record<string, unknown>);
    }
  });
  const messages = Array.from(messagesById.values());
  const messageSignatures = new Set<string>();
  const dedupedMessages = messages.filter((row) => {
    const sender = String((row as { sender?: string }).sender ?? "");
    const memberId = String((row as { member_id?: string }).member_id ?? "");
    const text = String((row as { text?: string }).text ?? "").trim();
    const createdAt = String((row as { created_at?: string }).created_at ?? "");
    const signature = `${sender}|${memberId}|${text}|${createdAt}`;
    if (messageSignatures.has(signature)) return false;
    messageSignatures.add(signature);
    return true;
  });

  const ownerIdsFromAssignedPrograms = [
    ...(programsRaw ?? []),
    ...(programsByRequesterOwner ?? []),
  ]
    .map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim())
    .filter(Boolean);
  const ownerIdsFromMessages = [...(messagesByMember ?? []), ...(messagesByRequesterOwner ?? [])]
    .map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim())
    .filter(Boolean);
  const trainerOwnerIds = Array.from(
    new Set([
      ...(scopedMembers ?? [])
        .map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim())
        .filter(Boolean),
      ...ownerIdsFromAssignedPrograms,
      ...ownerIdsFromMessages,
    ]),
  );

  const NO_PLAN_DAY_TEMPLATE_TITLE = "Ingen plan i dag";
  function rowIsActivityTemplate(row: Record<string, unknown>): boolean {
    const notes = String(row.notes ?? "");
    if (notes.includes("__motusTemplateKind=")) return true;
    return (
      String(row.member_id ?? "").trim() === "__template__" &&
      String(row.title ?? "").trim() === NO_PLAN_DAY_TEMPLATE_TITLE
    );
  }
  function rowIsNoPlanCoverTemplate(row: Record<string, unknown>): boolean {
    const notes = String(row.notes ?? "");
    if (notes.includes("__motusTemplateKind=no-plan")) return true;
    return (
      String(row.member_id ?? "").trim() === "__template__" &&
      String(row.title ?? "").trim() === NO_PLAN_DAY_TEMPLATE_TITLE
    );
  }

  let activityTemplateRows: Array<Record<string, unknown>> = [];
  if (trainerOwnerIds.length > 0) {
    const [byNotesResult, byTitleResult] = await Promise.all([
      adminClient
        .from("training_programs")
        .select("*")
        .eq("member_id", "__template__")
        .like("notes", "__motusTemplateKind=%")
        .in("owner_user_id", trainerOwnerIds),
      adminClient
        .from("training_programs")
        .select("*")
        .eq("member_id", "__template__")
        .ilike("title", NO_PLAN_DAY_TEMPLATE_TITLE)
        .in("owner_user_id", trainerOwnerIds),
    ]);
    if (byNotesResult.error) {
      console.warn("hydrate-member-data: activity template query failed:", byNotesResult.error.message);
    }
    if (byTitleResult.error) {
      console.warn("hydrate-member-data: no-plan title template query failed:", byTitleResult.error.message);
    }
    const templateById = new Map<string, Record<string, unknown>>();
    [...(byNotesResult.data ?? []), ...(byTitleResult.data ?? [])].forEach((row) => {
      const id = String((row as { id?: string }).id ?? "").trim();
      if (!id) return;
      if (!templateById.has(id)) templateById.set(id, row as Record<string, unknown>);
    });
    activityTemplateRows = Array.from(templateById.values());
  }
  const trainerOwnerIdSet = new Set(trainerOwnerIds);

  const mergedProgramsById = new Map<string, Record<string, unknown>>();
  [...(programsByRequesterOwner ?? []), ...(programsRaw ?? []), ...activityTemplateRows].forEach((row) => {
    const id = String((row as { id?: string }).id ?? "").trim();
    if (!id) return;
    if (!mergedProgramsById.has(id)) {
      mergedProgramsById.set(id, row as Record<string, unknown>);
    }
  });
  const mergedPrograms = Array.from(mergedProgramsById.values());

  const trainerNameByOwnerId = new Map<string, string>();
  const ownerUserIds = Array.from(
    new Set(
      [
        ...mergedPrograms.map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim()),
        ...(scopedMembers ?? []).map((row) => String((row as { owner_user_id?: string }).owner_user_id ?? "").trim()),
      ].filter(Boolean),
    ),
  );
  for (const ownerUserId of ownerUserIds) {
    try {
      const { data: trainerData, error: trainerError } = await adminClient.auth.admin.getUserById(ownerUserId);
      if (trainerError || !trainerData?.user) continue;
      const metadata = (trainerData.user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = String(metadata.full_name ?? metadata.name ?? "").trim();
      const email = String(trainerData.user.email ?? "").trim();
      const trainerDisplayName =
        fullName && fullName !== "Bruker" && !fullName.includes("@")
          ? fullName
          : nameFromEmail(email) || toFirstName(fullName);
      trainerNameByOwnerId.set(ownerUserId, trainerDisplayName);
    } catch {
      // Ignore lookup failures; frontend will use fallback label.
    }
  }

  const memberDataLookupIdSet = new Set(memberDataLookupList);
  const programs = mergedPrograms
    .filter((row) => {
      const memberId = String((row as { member_id?: string }).member_id ?? "").trim();
      const ownerUserId = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
      if (memberId === "__template__" && trainerOwnerIdSet.has(ownerUserId) && rowIsActivityTemplate(row)) {
        return true;
      }
      return memberDataLookupIdSet.has(memberId) || (requesterUserId && ownerUserId === requesterUserId);
    })
    .map((row) => {
      const typedRow = row as Record<string, unknown>;
      const ownerUserId = String(typedRow.owner_user_id ?? "").trim();
      return {
        ...typedRow,
        assigned_trainer_name: trainerNameByOwnerId.get(ownerUserId) ?? "",
      };
    });

  let inspirationItems: unknown[] = [];
  const inspirationFeed = await adminClient.from("inspiration_feed").select("items").eq("id", "shared").maybeSingle();
  if (!inspirationFeed.error && Array.isArray(inspirationFeed.data?.items)) {
    inspirationItems = inspirationFeed.data.items;
  }

  const harmonizedMembers = harmonizeMemberProfilesByEmail([...(scopedMembers ?? [])]).map((row) => {
    const ownerUserId = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
    return {
      ...row,
      assigned_trainer_name: trainerNameByOwnerId.get(ownerUserId) ?? "",
    };
  });

  const noPlanDayCoverImageUrl = (() => {
    const ownerSet = new Set(trainerOwnerIds);
    const noPlanRows = activityTemplateRows.filter((row) => rowIsNoPlanCoverTemplate(row));
    const scoped = noPlanRows.filter((row) => ownerSet.has(String((row as { owner_user_id?: string }).owner_user_id ?? "").trim()));
    const pool = scoped.length ? scoped : noPlanRows;
    const withImage = pool.find((row) => String((row as { image_url?: string }).image_url ?? "").trim());
    return String((withImage ?? pool[0])?.image_url ?? "").trim() || null;
  })();

  return jsonResponse(200, {
    members: harmonizedMembers,
    programs,
    noPlanDayCoverImageUrl,
    logs: logs ?? [],
    messages: dedupedMessages ?? [],
    periodPlans,
    mealPlans,
    mealPlanStates,
    exercises,
    inspirationItems,
  });
});
