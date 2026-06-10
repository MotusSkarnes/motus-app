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

const NO_PLAN_DAY_TEMPLATE_TITLE = "Ingen plan i dag";
const TEMPLATE_KIND_PREFIX = /^__motusTemplateKind=(group|activity|no-plan)(?:\r?\n|$)/;

function rowHasTemplateExercises(row: Record<string, unknown>): boolean {
  const exercises = row.exercises;
  return Array.isArray(exercises) && exercises.length > 0;
}

function rowTemplateKind(row: Record<string, unknown>): string | null {
  const notes = String(row.notes ?? "");
  const match = notes.match(TEMPLATE_KIND_PREFIX);
  if (match) return match[1];
  const memberId = String(row.member_id ?? "").trim();
  const title = String(row.title ?? "").trim();
  if (memberId === "__template__" && title === NO_PLAN_DAY_TEMPLATE_TITLE) {
    return "no-plan";
  }
  if (memberId === "__template__" && !rowHasTemplateExercises(row) && title) {
    return "group";
  }
  return null;
}

function rowIsSharedOrgActivityTemplate(row: Record<string, unknown>): boolean {
  if (String(row.member_id ?? "").trim() !== "__template__") return false;
  const kind = rowTemplateKind(row);
  return kind === "group" || kind === "activity" || kind === "no-plan";
}

function rowCreatedAtMs(row: Record<string, unknown>): number {
  const raw = String(row.created_at ?? "").trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sharedOrgTemplateDedupeKey(row: Record<string, unknown>): string | null {
  if (!rowIsSharedOrgActivityTemplate(row)) return null;
  const kind = rowTemplateKind(row);
  if (kind === "no-plan") return `no-plan:${NO_PLAN_DAY_TEMPLATE_TITLE.toLowerCase()}`;
  const title = String(row.title ?? "").trim().toLowerCase();
  return kind && title ? `${kind}:${title}` : null;
}

function dedupeSharedOrgActivityTemplateRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = sharedOrgTemplateDedupeKey(row);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || rowCreatedAtMs(row) > rowCreatedAtMs(existing)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

function isSharedMember(row: Record<string, unknown>): boolean {
  return (
    String(row.customer_type ?? "").trim().toLowerCase() === "medlem" &&
    String(row.membership_type ?? "").trim().toLowerCase() !== "premium"
  );
}

function isPrivateRosterMember(row: Record<string, unknown>): boolean {
  return !isSharedMember(row);
}

function isVisibleToTrainer(row: Record<string, unknown>, ownerUserId: string): boolean {
  const rowOwnerUserId = String(row.owner_user_id ?? "").trim();
  if (rowOwnerUserId === ownerUserId) return true;
  return isSharedMember(row);
}

function canIncludeLinkedMemberRow(
  row: Record<string, unknown>,
  ownerUserId: string,
  linkedMemberIds: Set<string>,
): boolean {
  const id = String((row as { id?: string }).id ?? "").trim();
  if (id && linkedMemberIds.has(id)) return true;
  return isVisibleToTrainer(row, ownerUserId);
}

/** Medlem synlig i kundelisten: eier/delt roster, eller faktisk innhold hos denne PT-en. */
function isMemberRowVisibleInTrainerRoster(
  row: Record<string, unknown>,
  ownerUserId: string,
  linkedMemberIds: Set<string>,
): boolean {
  const id = String((row as { id?: string }).id ?? "").trim();
  if (id && linkedMemberIds.has(id)) return true;
  return isVisibleToTrainer(row, ownerUserId);
}

function rowBelongsToOwner(row: Record<string, unknown>, ownerUserId: string): boolean {
  return String(row.owner_user_id ?? "").trim() === ownerUserId;
}

/** Query is already limited to customer-related member_id values; include those rows regardless of owner_user_id. */
function programRowVisibleToTrainer(
  row: Record<string, unknown>,
  ownerUserId: string,
): boolean {
  if (rowBelongsToOwner(row, ownerUserId)) return true;
  const memberId = String((row as { member_id?: string }).member_id ?? "").trim();
  if (!memberId || memberId === "__template__") return false;
  return true;
}

function profileCanonicalScore(row: Record<string, unknown>): number {
  let score = 0;
  const customerType = String(row.customer_type ?? "").trim().toLowerCase();
  if (customerType === "pt-kunde") score += 1000;
  if (String(row.membership_type ?? "").trim().toLowerCase() === "premium") score += 100;
  if (row.is_active !== false) score += 10;
  const createdAt = new Date(String(row.created_at ?? "")).getTime() || 0;
  return score + createdAt / 1_000_000_000_000;
}

function pickMostRecentProfileRow(rows: Array<Record<string, unknown>>): Record<string, unknown> | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => profileCanonicalScore(b) - profileCanonicalScore(a));
  return sorted[0] ?? null;
}

function scorePersonalGoalsBlob(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return -1;
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

function pickFirstNonEmptyField(rows: Array<Record<string, unknown>>, field: string): unknown {
  for (const row of rows) {
    const value = String(row[field] ?? "").trim();
    if (value) return row[field];
  }
  return "";
}

/** Synk duplikat-rader per e-post — behold rikest personal_goals (oppstartsskjema), ikke nyeste tomme rad. */
function harmonizeMemberProfilesByEmail(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const PROFILE_FIELDS = [
    "name",
    "phone",
    "birth_date",
    "gender",
    "goal",
    "focus",
    "injuries",
    "personal_goals",
    "avatar_url",
  ] as const;
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
    const canonical = pickMostRecentProfileRow(group);
    if (!canonical) continue;
    for (const row of group) {
      for (const field of PROFILE_FIELDS) {
        if (field === "personal_goals") {
          if (bestPersonalGoals) row[field] = bestPersonalGoals;
          continue;
        }
        const preferred = pickFirstNonEmptyField(group, field);
        if (preferred) row[field] = preferred;
        else if (canonical[field]) row[field] = canonical[field];
      }
      const anyNutritionAccess = group.some((row) => row.nutrition_access === true);
      if (anyNutritionAccess) {
        for (const row of group) {
          row.nutrition_access = true;
        }
      }
    }
  }
  return rows;
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
    "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, gender, weight, height, level, membership_type, customer_type, nutrition_access, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, avatar_url, created_at";
  const membersSelectWithoutAvatar =
    "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, gender, weight, height, level, membership_type, customer_type, nutrition_access, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, created_at";
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
    .ilike("customer_type", "medlem")
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
      .ilike("customer_type", "medlem")
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
  members = (members ?? []).filter((row) => isVisibleToTrainer(row, ownerUserId));

  const linkedMemberIds = new Set<string>();
  const [{ data: programLinks }, { data: logLinks }, { data: messageLinks }] = await Promise.all([
    adminClient.from("training_programs").select("member_id").eq("owner_user_id", ownerUserId),
    adminClient.from("workout_logs").select("member_id").eq("owner_user_id", ownerUserId),
    adminClient.from("chat_messages").select("member_id").eq("owner_user_id", ownerUserId),
  ]);
  for (const row of [...(programLinks ?? []), ...(logLinks ?? []), ...(messageLinks ?? [])]) {
    const memberId = String((row as { member_id?: string }).member_id ?? "").trim();
    if (memberId && memberId !== "__template__" && !memberId.startsWith("auth-")) {
      linkedMemberIds.add(memberId);
    }
  }
  if (linkedMemberIds.size > 0) {
    const linkedMembersQuery = await adminClient
      .from("members")
      .select(membersSelectWithAvatar)
      .in("id", Array.from(linkedMemberIds));
    let linkedRows = (linkedMembersQuery.data ?? []) as Array<Record<string, unknown>>;
    if (linkedMembersQuery.error && linkedMembersQuery.error.message.includes("avatar_url")) {
      const linkedFallback = await adminClient
        .from("members")
        .select(membersSelectWithoutAvatar)
        .in("id", Array.from(linkedMemberIds));
      linkedRows = (linkedFallback.data ?? []) as Array<Record<string, unknown>>;
      membersError = membersError ?? linkedFallback.error;
    } else if (linkedMembersQuery.error) {
      membersError = membersError ?? linkedMembersQuery.error;
    }
    const safeLinkedRows = linkedRows.filter((row) => canIncludeLinkedMemberRow(row, ownerUserId, linkedMemberIds));
    members = uniqueById([...(members ?? []), ...safeLinkedRows]) as Array<Record<string, unknown>>;
  }

  if (!membersError && (members ?? []).length > 0) {
    const relatedEmailSet = new Set(
      (members ?? [])
        .map((row) => normalizeEmail((row as { email?: string }).email))
        .filter((value) => value && value.includes("@")),
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
      const rowEmail = normalizeEmail((row as { email?: string }).email);
      if (!rowEmail || !relatedEmailSet.has(rowEmail)) return false;
      return isMemberRowVisibleInTrainerRoster(row, ownerUserId, linkedMemberIds);
    });
    members = uniqueById([...(members ?? []), ...widenedMembers]) as Array<Record<string, unknown>>;
    members = harmonizeMemberProfilesByEmail(members);
  }
  members = (members ?? []).filter((row) => isMemberRowVisibleInTrainerRoster(row, ownerUserId, linkedMemberIds));

  const visibleMemberIds = (members ?? []).map((row) => String((row as { id?: string }).id ?? "")).filter(Boolean);
  const memberOwnerById = new Map<string, string>();
  for (const row of members ?? []) {
    const memberId = String((row as { id?: string }).id ?? "").trim();
    const ptOwner = String((row as { owner_user_id?: string }).owner_user_id ?? "").trim();
    if (memberId && ptOwner) memberOwnerById.set(memberId, ptOwner);
  }
  // Backfill only NULL owner_user_id — never reassign another PT's programs/logs to member.owner_user_id.
  if (visibleMemberIds.length > 0) {
    await adminClient
      .from("training_programs")
      .update({ owner_user_id: ownerUserId })
      .in("member_id", visibleMemberIds)
      .is("owner_user_id", null);
    await adminClient
      .from("workout_logs")
      .update({ owner_user_id: ownerUserId })
      .in("member_id", visibleMemberIds)
      .is("owner_user_id", null);
    await adminClient
      .from("chat_messages")
      .update({ owner_user_id: ownerUserId })
      .in("member_id", visibleMemberIds)
      .is("owner_user_id", null);
  }
  const visibleMemberEmails = Array.from(
    new Set(
      (members ?? [])
        .map((row) => normalizeEmail((row as { email?: string }).email))
        .filter((email) => email && email.includes("@")),
    ),
  );
  const programLookupMemberIds = new Set(visibleMemberIds);
  if (visibleMemberEmails.length > 0) {
    const { data: relatedEmailMembers, error: relatedEmailMembersError } = await adminClient
      .from("members")
      .select("id, email")
      .in("email", visibleMemberEmails);
    if (relatedEmailMembersError) {
      console.warn("hydrate-trainer-data: related email member lookup failed:", relatedEmailMembersError.message);
    } else {
      for (const row of relatedEmailMembers ?? []) {
        const rowEmail = normalizeEmail((row as { email?: string }).email);
        if (!rowEmail || !visibleMemberEmails.includes(rowEmail)) continue;
        const id = String((row as { id?: string }).id ?? "").trim();
        if (id && id !== "__template__") programLookupMemberIds.add(id);
      }
    }
    const { data: authUsersData, error: authUsersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authUsersError) {
      console.warn("hydrate-trainer-data: auth user lookup failed:", authUsersError.message);
    } else {
      const emailSet = new Set(visibleMemberEmails);
      for (const user of authUsersData?.users ?? []) {
        const userEmail = normalizeEmail(user.email);
        if (!userEmail || !emailSet.has(userEmail)) continue;
        const authUserId = String(user.id ?? "").trim();
        if (!authUserId) continue;
        programLookupMemberIds.add(authUserId);
        programLookupMemberIds.add(`auth-${authUserId}`);
        const appMemberId = String((user.app_metadata?.member_id as string | undefined) ?? "").trim();
        if (appMemberId) programLookupMemberIds.add(appMemberId);
        const userMemberId = String((user.user_metadata?.member_id as string | undefined) ?? "").trim();
        if (userMemberId) programLookupMemberIds.add(userMemberId);
      }
    }
  }

  const { data: programsByOwner, error: programsByOwnerError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by, program_created_by_name, image_url, member_library_status")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  let sharedOrgActivityTemplateRows: Array<Record<string, unknown>> = [];
  const { data: sharedTemplateRows, error: sharedTemplateRowsError } = await adminClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by, program_created_by_name, image_url, member_library_status")
    .eq("member_id", "__template__");
  if (sharedTemplateRowsError) {
    console.warn("hydrate-trainer-data: shared activity template query failed:", sharedTemplateRowsError.message);
  }
  const sharedTemplateById = new Map<string, Record<string, unknown>>();
  [...(sharedTemplateRows ?? [])].forEach((row) => {
    const typedRow = row as Record<string, unknown>;
    if (!rowIsSharedOrgActivityTemplate(typedRow)) return;
    const id = String(typedRow.id ?? "").trim();
    if (!id) return;
    if (!sharedTemplateById.has(id)) sharedTemplateById.set(id, typedRow);
  });
  sharedOrgActivityTemplateRows = dedupeSharedOrgActivityTemplateRows(Array.from(sharedTemplateById.values()));

  const programsByOwnerWithoutSharedTemplates = (programsByOwner ?? []).filter(
    (row) => !rowIsSharedOrgActivityTemplate(row as Record<string, unknown>),
  );

  const { data: logsByOwner, error: logsByOwnerError } = await adminClient
    .from("workout_logs")
    .select("id, member_id, owner_user_id, program_title, date, status, note, results, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  const { data: messagesByOwner, error: messagesByOwnerError } = await adminClient
    .from("chat_messages")
    .select("id, member_id, owner_user_id, sender, text, created_at, read_by_member_at, read_by_trainer_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  let programsByMember: Array<Record<string, unknown>> = [];
  let logsByMember: Array<Record<string, unknown>> = [];
  let messagesByMember: Array<Record<string, unknown>> = [];
  let programsByMemberError: { message: string } | null = null;
  let logsByMemberError: { message: string } | null = null;
  let messagesByMemberError: { message: string } | null = null;

  if (programLookupMemberIds.size > 0) {
    const { data, error } = await adminClient
      .from("training_programs")
      .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by, program_created_by_name, image_url, member_library_status")
      .in("member_id", Array.from(programLookupMemberIds))
      .order("created_at", { ascending: false });
    programsByMember = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
      programRowVisibleToTrainer(row, ownerUserId),
    );
    programsByMemberError = error;
  }

  if (visibleMemberIds.length > 0) {
    const { data, error } = await adminClient
      .from("workout_logs")
      .select("id, member_id, owner_user_id, program_title, date, status, note, results, created_at")
      .in("member_id", visibleMemberIds)
      .order("created_at", { ascending: false });
    logsByMember = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => rowBelongsToOwner(row, ownerUserId));
    logsByMemberError = error;
  }

  if (visibleMemberIds.length > 0) {
    const { data, error } = await adminClient
      .from("chat_messages")
      .select("id, member_id, owner_user_id, sender, text, created_at, read_by_member_at, read_by_trainer_at")
      .in("member_id", visibleMemberIds)
      .order("created_at", { ascending: true });
    messagesByMember = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => rowBelongsToOwner(row, ownerUserId));
    messagesByMemberError = error;
  }

  const { data: exercises, error: exercisesError } = await adminClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url, prescription_fields, custom_field_1_label, custom_field_2_label")
    .or("is_active.is.null,is_active.eq.true")
    .order("name", { ascending: true });

  let periodPlanRows: Array<{ member_id: string; plan: unknown }> = [];
  const { data: periodRows, error: periodPlansError } =
    visibleMemberIds.length > 0
      ? await adminClient.from("member_period_plans").select("member_id, owner_user_id, plan").in("member_id", visibleMemberIds)
      : await adminClient.from("member_period_plans").select("member_id, owner_user_id, plan").eq("owner_user_id", ownerUserId);
  if (periodPlansError) {
    console.warn("hydrate-trainer-data: member_period_plans query failed (table may be missing):", periodPlansError.message);
  } else {
    periodPlanRows = ((periodRows ?? []) as Array<Record<string, unknown>>)
      .filter((row) => rowBelongsToOwner(row, ownerUserId))
      .map((row) => ({
        member_id: String((row as { member_id?: string }).member_id ?? ""),
        plan: (row as { plan?: unknown }).plan,
      }));
  }

  const mergedPrograms = uniqueById([
    ...programsByOwnerWithoutSharedTemplates,
    ...programsByMember,
    ...sharedOrgActivityTemplateRows,
  ]);
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
