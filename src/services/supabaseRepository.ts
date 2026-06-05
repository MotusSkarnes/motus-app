import type {
  AppState,
  ChatMessage,
  Exercise,
  Member,
  MemberProgramLibraryStatus,
  PeriodSchedulePlan,
  ProgramExercise,
  TrainingProgram,
  WeekdayPlanKey,
  WeeklyDayPlan,
  WeeklySchedulePlan,
  WorkoutExerciseResult,
  WorkoutLog,
} from "../app/types";
import { enrichProgramWithActivityTemplateKind } from "../app/activityTemplate";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy, normalizeStoredLogDate } from "../app/dateFormat";
import { normalizeMemberGender } from "../app/memberGender";
import { dedupePeriodPlansById } from "../app/periodPlanMerge";
import { programExerciseUsesBankExercise } from "../app/exerciseBankUsage";
import { normalizeStoredExerciseCategory } from "../app/exerciseCategories";
import { parsePrescriptionFieldsFromDb, prescriptionFieldsForExerciseSave } from "../app/exercisePrescriptionFields";
import {
  createMember,
  localAppRepository,
  type AppRepository,
  type CreateMemberInput,
  type CreateMemberResult,
  type DeleteProgramContext,
  type FinishWorkoutInput,
  type DeleteWorkoutLogInput,
  type LogActivityWorkoutInput,
  type LogGroupWorkoutInput,
  type UpdateActivityWorkoutInput,
  type UpdateGroupWorkoutLogInput,
  type LogIntervalWorkoutInput,
  type LogCompletedPlanEntryInput,
  type RemoveCompletedPlanEntryLogInput,
  type RemoveGroupWorkoutLogInput,
  type RemoveWorkoutLogResultInput,
  type SetWorkoutLogResultsInput,
  type PersistResult,
  type SaveProgramInput,
  type SaveExerciseInput,
  type ReplaceWorkoutExerciseGroupInput,
  type StartCustomWorkoutInput,
  type StartWorkoutModeOptions,
  type UpdateMemberInput,
  type UpdateWorkoutLogTrainerCommentInput,
  type UpdateWorkoutResultInput,
} from "./appRepository";
import {
  buildTrainingProgramDisplayKey,
  normalizeLegacyIntervalCooldownExerciseNames,
  programIsInMemberArchive,
} from "../app/programBlocks";
import { isContaminatedDemoMemberProfile } from "../app/memberLocalCatalog";
import {
  markWorkoutLogSeenInRemote,
  markWorkoutLogsSeenInRemote,
  wasWorkoutLogSeenInRemote,
} from "../app/workoutLogRemoteSeen";
import { mealPlanFromRow } from "../app/mealPlanCloud";
import { parseMemberMealPlanState, type MemberMealPlanState } from "../app/memberMealPlanState";
import type { MealPlan } from "../app/mealPlanTypes";
import { chatMessageFromRow } from "../app/chatReadReceipts";
import { detectNewMemberFormSubmissions } from "../app/memberFormNotifications";
import { ensureMemberAuthLink, resolveSessionAuthRole } from "./supabaseAuth";
import { supabaseClient } from "./supabaseClient";
import {
  isPrivatePtRosterCustomerType,
  isSharedMedlemCustomerType,
  MEMBER_ARCHIVED_APP_MESSAGE,
  resolveOwnerUserIdForPersist,
} from "./memberAccessRules";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let messagesPersistedListener: (() => void | Promise<void>) | null = null;

/** Called after a chat message is persisted so UI can refresh without full page reload. */
export function registerMessagesPersistedListener(listener: (() => void | Promise<void>) | null): void {
  messagesPersistedListener = listener;
}

async function notifyMessagesPersisted(): Promise<void> {
  try {
    await messagesPersistedListener?.();
  } catch (error) {
    console.warn("messagesPersistedListener failed:", error);
  }
}

function mapMembershipType(value: unknown): Member["membershipType"] {
  return String(value ?? "").trim().toLowerCase() === "premium" ? "Premium" : "Standard";
}

function mapCustomerType(value: unknown): Member["customerType"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "pt-kunde") return "PT-kunde";
  if (normalized === "egentrening") return "Egentrening";
  if (normalized === "medlem") return "Medlem";
  return "Oppfølging";
}

const MEMBERS_SELECT_BASE =
  "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, gender, weight, height, level, membership_type, customer_type, nutrition_access, days_since_activity, goal, focus, personal_goals, injuries, coach_notes";
const MEMBERS_SELECT_WITH_AVATAR = `${MEMBERS_SELECT_BASE}, avatar_url`;
const MEMBERS_SELECT_WITHOUT_NUTRITION =
  "id, owner_user_id, name, email, is_active, invited_at, first_login_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes";
const MEMBERS_SELECT_WITH_AVATAR_WITHOUT_NUTRITION = `${MEMBERS_SELECT_WITHOUT_NUTRITION}, avatar_url`;

function isMissingDbColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  const col = column.toLowerCase();
  return (
    lower.includes(col) &&
    (lower.includes("does not exist") || lower.includes("schema cache") || lower.includes("could not find"))
  );
}

function mapMemberRowFromSupabase(row: Record<string, unknown>): Member {
  return {
    id: String(row.id ?? ""),
    ownerUserId: String(row.owner_user_id ?? ""),
    assignedTrainerName: String(row.assigned_trainer_name ?? "").trim(),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    isActive: row.is_active !== false,
    invitedAt: String(row.invited_at ?? ""),
    firstLoginAt: String(row.first_login_at ?? ""),
    phone: String(row.phone ?? ""),
    birthDate: String(row.birth_date ?? ""),
    gender: normalizeMemberGender(row.gender),
    weight: String(row.weight ?? ""),
    height: String(row.height ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    membershipType: mapMembershipType(row.membership_type),
    customerType: mapCustomerType(row.customer_type),
    nutritionAccess: row.nutrition_access === true,
    daysSinceActivity: String(row.days_since_activity ?? "0"),
    goal: String(row.goal ?? ""),
    focus: String(row.focus ?? ""),
    personalGoals: String(row.personal_goals ?? ""),
    injuries: String(row.injuries ?? ""),
    coachNotes: String(row.coach_notes ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
  };
}

function stripAvatarUrlField<T extends Record<string, unknown>>(fields: T): Omit<T, "avatar_url"> {
  const { avatar_url: _removed, ...rest } = fields;
  return rest;
}

function stripNutritionAccessField<T extends Record<string, unknown>>(fields: T): Omit<T, "nutrition_access"> {
  const { nutrition_access: _removed, ...rest } = fields;
  return rest;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const TRAINER_PROGRAM_SAVE_TIMEOUT_MS = 22_000;
const PROGRAM_EDGE_INVOKE_TIMEOUT_MS = 24_000;
const WORKOUT_LOG_EDGE_TIMEOUT_MS = 12_000;
const WORKOUT_LOG_DIRECT_TIMEOUT_MS = 8_000;
const WORKOUT_LOG_RPC_TIMEOUT_MS = 8_000;
const WORKOUT_LOG_MEMBER_RACE_TIMEOUT_MS = 12_000;
const WORKOUT_LOG_AUTH_TIMEOUT_MS = 4_000;
const WORKOUT_LOG_TOTAL_TIMEOUT_MS = 22_000;

async function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(timeoutValue), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function extractFunctionErrorDetails(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") return "";
  const candidate = error as { message?: unknown; context?: { json?: () => Promise<unknown> } };
  if (typeof candidate.context?.json === "function") {
    try {
      const payload = await candidate.context.json();
      if (payload && typeof payload === "object") {
        const withError = payload as { error?: unknown; message?: unknown };
        if (typeof withError.error === "string" && withError.error.trim()) return withError.error;
        if (typeof withError.message === "string" && withError.message.trim()) return withError.message;
      }
    } catch {
      // Fall through to message fallback.
    }
  }
  if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
  return "";
}

async function getOwnerUserId(fallbackOwnerUserId?: string | null): Promise<string | null> {
  if (!supabaseClient) return null;
  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();
  if (!error && session?.user?.id) {
    const fromSessionUser = String(session.user.id).trim();
    if (fromSessionUser) return fromSessionUser;
  }
  if (!error && session?.access_token) {
    const claims = decodeJwtPayload(session.access_token);
    if (claims && typeof claims.sub === "string" && claims.sub.trim()) {
      return claims.sub.trim();
    }
  }
  const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
  if (!refreshError) {
    const refreshedUserId = String(refreshData.user?.id ?? refreshData.session?.user?.id ?? "").trim();
    if (refreshedUserId) return refreshedUserId;
    const refreshedToken = String(refreshData.session?.access_token ?? "").trim();
    if (refreshedToken) {
      const claims = decodeJwtPayload(refreshedToken);
      if (claims && typeof claims.sub === "string" && claims.sub.trim()) {
        return claims.sub.trim();
      }
    }
  }
  const { data: userResult, error: userError } = await supabaseClient.auth.getUser();
  if (!userError && userResult?.user?.id) {
    const fromGetUser = String(userResult.user.id).trim();
    if (fromGetUser) return fromGetUser;
  }
  const fallback = String(fallbackOwnerUserId ?? "").trim();
  return fallback || null;
}

async function resolveOwnerUserIdForMember(memberId: string, fallbackOwnerUserId: string | null): Promise<string | null> {
  if (!supabaseClient) return fallbackOwnerUserId;
  const trimmedMemberId = memberId.trim();
  if (!trimmedMemberId) return fallbackOwnerUserId;
  const { data, error } = await supabaseClient
    .from("members")
    .select("owner_user_id")
    .eq("id", trimmedMemberId)
    .maybeSingle();
  if (error) {
    console.warn("Supabase owner lookup for member failed:", error.message);
    return fallbackOwnerUserId;
  }
  const ownerUserId = String((data as { owner_user_id?: string } | null)?.owner_user_id ?? "").trim();
  return ownerUserId || fallbackOwnerUserId;
}

/** Map synthetic `auth-*` client ids to `members.id` so edge functions and RLS see the same row. */
async function resolveCanonicalMemberIdForPersistence(
  memberId: string,
  hints?: { targetEmail?: string },
  sessionUser?: { id?: string; email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null,
): Promise<string> {
  const trimmed = String(memberId ?? "").trim();
  if (!trimmed || !supabaseClient) return trimmed;

  let user = sessionUser ?? null;
  if (!user) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    user = session?.user ?? null;
  }
  const authUserId = String(user?.id ?? "").trim();
  if (
    !trimmed.startsWith("auth-") &&
    (!authUserId || (trimmed !== authUserId && trimmed !== `auth-${authUserId}`))
  ) {
    return trimmed;
  }
  const jwtMemberId = String(user?.app_metadata?.member_id ?? user?.user_metadata?.member_id ?? "").trim();
  const isSyntheticId =
    trimmed.startsWith("auth-") || (authUserId && (trimmed === authUserId || trimmed === `auth-${authUserId}`));

  if (!isSyntheticId) return trimmed;

  const directIds = Array.from(
    new Set([jwtMemberId, authUserId, trimmed.replace(/^auth-/, "")].map((id) => id.trim()).filter(Boolean)),
  );
  for (const candidateId of directIds) {
    const { data: byId } = await supabaseClient.from("members").select("id").eq("id", candidateId).maybeSingle();
    const resolved = String(byId?.id ?? "").trim();
    if (resolved && !resolved.startsWith("auth-")) return resolved;
  }

  const role = String(user?.app_metadata?.role ?? user?.user_metadata?.role ?? "").trim();
  const fromHint = String(hints?.targetEmail ?? "").trim().toLowerCase();
  const authEmail = String(user?.email ?? "").trim().toLowerCase();

  let email = "";
  if (role === "trainer") {
    if (!fromHint.includes("@")) return trimmed;
    email = fromHint;
  } else {
    email = (fromHint.includes("@") ? fromHint : "") || (authEmail.includes("@") ? authEmail : "");
  }
  if (!email) return trimmed;
  const { data, error } = await supabaseClient
    .from("members")
    .select("id")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) return trimmed;
  const id = String(data.id).trim();
  return id && !id.startsWith("auth-") ? id : trimmed;
}

function isTrainingProgramAuthorColumnDbError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("program_created_by") || m.includes("program_created_by_name")) &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

function isTrainingProgramImageColumnDbError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("image_url") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

function isTrainingProgramOptionalColumnDbError(message: string): boolean {
  return isTrainingProgramAuthorColumnDbError(message) || isTrainingProgramImageColumnDbError(message);
}

function programImageDbField(imageUrl?: string): { image_url: string | null } | Record<string, never> {
  if (imageUrl === undefined) return {};
  const trimmed = imageUrl.trim();
  return { image_url: trimmed || null };
}

function omitTrainingProgramOptionalDbFields<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const {
    program_created_by: _programCreatedBy,
    program_created_by_name: _programCreatedByName,
    image_url: _imageUrl,
    ...rest
  } = row;
  return rest;
}

function isMemberLibraryStatusColumnDbError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("member_library_status") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

const WEEKDAY_KEYS: WeekdayPlanKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function parseWeeklyDayPlan(raw: unknown): WeeklyDayPlan {
  const empty: WeeklyDayPlan = {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const out = { ...empty };
  for (const key of WEEKDAY_KEYS) {
    out[key] = String(o[key] ?? "").trim();
  }
  return out;
}

function parseWeeklySchedulePlan(value: unknown): WeeklySchedulePlan | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) return null;
  const weekNumber = Number(o.weekNumber);
  return {
    id,
    weekNumber: Number.isFinite(weekNumber) ? weekNumber : 0,
    days: parseWeeklyDayPlan(o.days),
  };
}

export function parsePeriodSchedulePlan(value: unknown): PeriodSchedulePlan | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) return null;
  const weeklyRaw = o.weeklyPlans;
  const weeklyPlans: WeeklySchedulePlan[] = Array.isArray(weeklyRaw)
    ? (weeklyRaw.map(parseWeeklySchedulePlan).filter(Boolean) as WeeklySchedulePlan[])
    : [];
  const weeks = Number(o.weeks);
  const addedByRaw = String(o.periodPlanAddedBy ?? "").trim();
  const periodPlanAddedBy = addedByRaw === "member" || addedByRaw === "trainer" ? addedByRaw : "trainer";
  const statusRaw = String(o.memberPeriodPlanStatus ?? "").trim();
  const memberPeriodPlanStatus = statusRaw === "hidden" ? ("hidden" as const) : undefined;
  return {
    id,
    title: String(o.title ?? "").trim() || "Periodeplan",
    notes: String(o.notes ?? "").trim(),
    startDate: String(o.startDate ?? "").trim(),
    weeks: Number.isFinite(weeks) ? weeks : weeklyPlans.length || 1,
    createdAt: String(o.createdAt ?? "").trim(),
    weeklyPlans,
    periodPlanAddedBy,
    memberPeriodPlanStatus,
    trainerSavedAtIso: String(o.trainerSavedAtIso ?? "").trim() || undefined,
  };
}

function periodPlanRowsToByMemberId(rows: Array<{ member_id: string; plan: unknown }>): Record<string, PeriodSchedulePlan[]> {
  const out: Record<string, PeriodSchedulePlan[]> = {};
  for (const row of rows) {
    const memberId = String(row.member_id ?? "").trim();
    if (!memberId) continue;
    const plan = parsePeriodSchedulePlan(row.plan);
    if (!plan) continue;
    const list = out[memberId] ?? [];
    list.push(plan);
    out[memberId] = list;
  }
  for (const memberId of Object.keys(out)) {
    out[memberId] = dedupePeriodPlansById(out[memberId] ?? []);
  }
  return out;
}

export type UpsertMemberPeriodPlanResult = { ok: boolean; message: string };

function scoreMemberRowForPeriodPlanCanonical(row: {
  id: string;
  customer_type?: string | null;
  membership_type?: string | null;
  nutrition_access?: boolean | null;
  personal_goals?: string | null;
  is_active?: boolean | null;
}): number {
  let score = 0;
  const id = String(row.id ?? "").trim();
  if (id.startsWith("member-")) score += 20_000;
  else if (!/^m\d+$/i.test(id)) score += 10_000;
  if (row.is_active !== false) score += 5_000;
  if (row.nutrition_access === true) score += 2_000;
  if (String(row.customer_type ?? "").trim() === "PT-kunde") score += 1_000;
  if (String(row.membership_type ?? "").trim() === "Premium") score += 500;
  const goals = String(row.personal_goals ?? "");
  if (goals.includes("onboardingCompletedAt")) score += 80;
  return score;
}

/** Én kanonisk members.id for lagring — unngår duplikat-rader (m1 + member-nmn08uu) med ulikt innhold. */
async function resolveCanonicalMemberIdForPeriodPlanStorage(
  memberIds: string[],
  hints?: { targetEmail?: string },
): Promise<string> {
  const expanded = new Set<string>();
  for (const rawId of memberIds) {
    const trimmed = rawId.trim();
    if (!trimmed) continue;
    expanded.add(trimmed);
    const related = await resolveRelatedMemberIds(trimmed, hints);
    related.forEach((id) => expanded.add(id));
  }
  const ids = Array.from(expanded).filter((id) => id && id !== "__template__" && !id.startsWith("auth-"));
  if (!ids.length) return memberIds.map((id) => id.trim()).find(Boolean) ?? "";
  if (ids.length === 1) return ids[0];
  if (!supabaseClient) return ids[0];
  const { data: rows, error } = await supabaseClient
    .from("members")
    .select("id, customer_type, membership_type, nutrition_access, personal_goals, is_active, created_at")
    .in("id", ids);
  if (error || !rows?.length) return ids[0];
  const sorted = [...rows].sort(
    (a, b) => scoreMemberRowForPeriodPlanCanonical(b as { id: string }) - scoreMemberRowForPeriodPlanCanonical(a as { id: string }),
  );
  return String((sorted[0] as { id?: string }).id ?? "").trim() || ids[0];
}

export async function upsertMemberPeriodPlansForTrainer(
  memberIds: string[],
  plan: PeriodSchedulePlan,
  hints?: { targetEmail?: string },
): Promise<UpsertMemberPeriodPlanResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }
  const sessionOwnerUserId = await getOwnerUserId();
  if (!sessionOwnerUserId) {
    return { ok: false, message: "Kunne ikke lagre periodeplan: logg inn på nytt som trener." };
  }
  const trimmedIds = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  if (!trimmedIds.length) {
    return { ok: false, message: "Mangler kunde-ID for periodeplan." };
  }

  const canonicalMemberId = await resolveCanonicalMemberIdForPeriodPlanStorage(trimmedIds, hints);
  if (!canonicalMemberId) {
    return { ok: false, message: "Mangler kunde-ID for periodeplan." };
  }
  const ownerUserId =
    (await resolveOwnerUserIdForMember(canonicalMemberId, sessionOwnerUserId)) ?? sessionOwnerUserId;
  const planPayload = {
    ...plan,
    trainerSavedAtIso: plan.trainerSavedAtIso?.trim() || new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("member_period_plans").upsert(
    [
      {
        member_id: canonicalMemberId,
        plan_id: plan.id,
        owner_user_id: ownerUserId,
        plan: planPayload as unknown as Record<string, unknown>,
      },
    ],
    { onConflict: "member_id,plan_id" },
  );
  if (error) {
    console.warn("Supabase member_period_plans upsert failed:", error.message);
    const detail = error.message.trim();
    if (/row-level security|policy/i.test(detail)) {
      return {
        ok: false,
        message:
          "Kunne ikke lagre periodeplan (tilgang). Kjør member_period_plans_schema.sql i Supabase, eller sjekk at kunden tilhører deg som trener.",
      };
    }
    if (/does not exist|relation/i.test(detail)) {
      return {
        ok: false,
        message: "Kunne ikke lagre periodeplan: tabellen member_period_plans mangler i Supabase. Kjør src/supabase/member_period_plans_schema.sql.",
      };
    }
    return { ok: false, message: `Kunne ikke lagre periodeplan: ${detail || "Ukjent feil."}` };
  }

  const relatedIds = await resolveRelatedMemberIds(canonicalMemberId, hints);
  const duplicateMemberIds = relatedIds.filter((id) => id !== canonicalMemberId);
  if (duplicateMemberIds.length > 0) {
    const { error: cleanupError } = await supabaseClient
      .from("member_period_plans")
      .delete()
      .eq("plan_id", plan.id)
      .in("member_id", duplicateMemberIds);
    if (cleanupError) {
      console.warn("Supabase member_period_plans duplicate cleanup failed:", cleanupError.message);
    }
  }

  void notifyMemberPeriodPlanPush([canonicalMemberId], planPayload);
  return { ok: true, message: "Periodeplan lagret." };
}

async function notifyMemberPeriodPlanPush(memberIds: string[], plan: PeriodSchedulePlan): Promise<void> {
  if (!supabaseClient) return;
  const title = plan.title.trim() || "Periodeplan";
  for (const memberId of memberIds) {
    void supabaseClient.functions.invoke("send-period-plan-push", {
      body: { memberId, planTitle: title },
    });
  }
}

export async function deleteMemberPeriodPlanByPlanId(planId: string): Promise<void> {
  if (!supabaseClient) return;
  const trimmed = planId.trim();
  if (!trimmed) return;
  const { error } = await supabaseClient.from("member_period_plans").delete().eq("plan_id", trimmed);
  if (error) {
    console.warn("Supabase member_period_plans delete failed:", error.message);
  }
}

async function resolveRelatedMemberIds(
  memberId: string,
  hints?: { targetEmail?: string; targetName?: string },
): Promise<string[]> {
  if (!supabaseClient) return memberId ? [memberId] : [];
  const trimmedMemberId = memberId.trim();
  const hintedEmail = String(hints?.targetEmail ?? "").trim().toLowerCase();
  if (!trimmedMemberId && !hintedEmail) return [];
  if ((trimmedMemberId === "__template__" || trimmedMemberId.startsWith("auth-")) && !hintedEmail) {
    return [];
  }
  const { data: memberRow, error: memberLookupError } = await supabaseClient
    .from("members")
    .select("email")
    .eq("id", trimmedMemberId)
    .maybeSingle();
  if (memberLookupError) {
    console.warn("Supabase member lookup failed:", memberLookupError.message);
  }
  const normalizedEmail = String(memberRow?.email ?? "").trim().toLowerCase() || hintedEmail;
  const rowsByEmail =
    normalizedEmail
      ? await supabaseClient.from("members").select("id").ilike("email", normalizedEmail)
      : { data: [], error: null as { message: string } | null };
  if (rowsByEmail.error) {
    console.warn("Supabase related member lookup by email failed:", rowsByEmail.error.message);
  }
  const ids = Array.from(
    new Set(
      (rowsByEmail.data ?? [])
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter((id) => Boolean(id) && id !== "__template__" && !id.startsWith("auth-")),
    ),
  );
  if (ids.length) return ids;
  if (trimmedMemberId && trimmedMemberId !== "__template__" && !trimmedMemberId.startsWith("auth-")) return [trimmedMemberId];
  return [];
}

async function persistMessage(
  memberId: string,
  sender: "trainer" | "member",
  text: string,
  hints?: { targetEmail?: string; targetName?: string },
): Promise<boolean> {
  if (!supabaseClient) return false;
  const trimmedMemberId = memberId.trim();
  const trimmedText = text.trim();
  if (!trimmedMemberId || !trimmedText) return false;
  let targetMemberIds = await resolveRelatedMemberIds(trimmedMemberId, hints);
  if (!targetMemberIds.length) {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const authEmail = String(user?.email ?? "").trim().toLowerCase();
    if (authEmail && authEmail.includes("@")) {
      const { data: rows, error } = await supabaseClient
        .from("members")
        .select("id")
        .ilike("email", authEmail);
      if (!error) {
        targetMemberIds = Array.from(
          new Set(
            (rows ?? [])
              .map((row) => String((row as { id?: string }).id ?? "").trim())
              .filter((id) => id && !id.startsWith("auth-") && id !== "__template__")
          )
        );
      }
    }
  }
  if (!targetMemberIds.length) {
    console.warn("persistMessage: no valid target member ids resolved");
    return false;
  }
  const canonicalTargetMemberId = await (async () => {
    const requestedId = trimmedMemberId;
    const requestedEmail = String(hints?.targetEmail ?? "").trim().toLowerCase();
    const uniqueIds = Array.from(new Set(targetMemberIds));
    if (uniqueIds.includes(requestedId)) return requestedId;
    if (!supabaseClient) return uniqueIds[0] ?? requestedId;
    const { data: memberRows, error: memberRowsError } = await supabaseClient
      .from("members")
      .select("id, email, is_active, created_at")
      .in("id", uniqueIds);
    if (memberRowsError || !memberRows?.length) return uniqueIds[0] ?? requestedId;
    const byId = new Map(
      (memberRows ?? []).map((row) => [
        String((row as { id?: string }).id ?? "").trim(),
        {
          email: String((row as { email?: string }).email ?? "").trim().toLowerCase(),
          isActive: (row as { is_active?: boolean | null }).is_active !== false,
          createdAt: String((row as { created_at?: string | null }).created_at ?? ""),
        },
      ]),
    );
    const emailMatchedId = requestedEmail
      ? uniqueIds.find((id) => byId.get(id)?.email === requestedEmail)
      : "";
    if (emailMatchedId) return emailMatchedId;
    const { data: programRows } = await supabaseClient
      .from("training_programs")
      .select("member_id")
      .in("member_id", uniqueIds);
    const programCountByMemberId = new Map<string, number>();
    (programRows ?? []).forEach((row) => {
      const resolvedMemberId = String((row as { member_id?: string }).member_id ?? "").trim();
      if (!resolvedMemberId) return;
      programCountByMemberId.set(resolvedMemberId, (programCountByMemberId.get(resolvedMemberId) ?? 0) + 1);
    });
    const sorted = [...uniqueIds].sort((a, b) => {
      const aPrograms = programCountByMemberId.get(a) ?? 0;
      const bPrograms = programCountByMemberId.get(b) ?? 0;
      if (bPrograms !== aPrograms) return bPrograms - aPrograms;
      const aActive = byId.get(a)?.isActive ? 1 : 0;
      const bActive = byId.get(b)?.isActive ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      const aCreated = new Date(byId.get(a)?.createdAt ?? 0).getTime() || 0;
      const bCreated = new Date(byId.get(b)?.createdAt ?? 0).getTime() || 0;
      if (bCreated !== aCreated) return bCreated - aCreated;
      return a.localeCompare(b);
    });
    return sorted[0] ?? requestedId;
  })();
  if (!canonicalTargetMemberId) {
    console.warn("persistMessage: canonical target member id unresolved");
    return false;
  }
  const clientMessageId = crypto.randomUUID();
  const persistedMessageIds: string[] = [];

  // Primary path: persist exactly one canonical chat row.
  const invokeResult = await supabaseClient.functions.invoke("send-chat-message", {
    body: {
      memberId: canonicalTargetMemberId,
      sender,
      text: trimmedText,
      targetEmail: hints?.targetEmail ?? "",
      targetName: hints?.targetName ?? "",
      clientMessageId,
    },
  });
  if (!invokeResult.error && invokeResult.data && typeof invokeResult.data === "object") {
    const payload = invokeResult.data as { ok?: boolean; inserted?: number; messageId?: string; message?: string };
    const inserted = Number(payload.inserted ?? 0);
    const messageId = String(payload.messageId ?? "").trim();
    const isSuccess = payload.ok === true || inserted > 0 || Boolean(messageId);
    if (isSuccess) {
      if (messageId) persistedMessageIds.push(messageId);
    } else {
      console.warn("send-chat-message returned non-success payload:", payload.message ?? "ok=false");
    }
  }
  if (invokeResult.error) {
    console.warn("send-chat-message invoke failed, trying direct function fetch fallback:", invokeResult.error.message);
  }

  if (persistedMessageIds.length === 0 && supabaseUrl && supabaseAnonKey) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token ?? "";
    if (accessToken) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-chat-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            memberId: canonicalTargetMemberId,
            sender,
            text: trimmedText,
            targetEmail: hints?.targetEmail ?? "",
            targetName: hints?.targetName ?? "",
            clientMessageId,
          }),
        });
        const body = (await response.json().catch(() => null)) as { messageId?: string; error?: string; message?: string } | null;
        const bodyOk =
          Boolean((body as { ok?: boolean } | null)?.ok) ||
          Number((body as { inserted?: number } | null)?.inserted ?? 0) > 0 ||
          Boolean(String((body as { messageId?: string } | null)?.messageId ?? "").trim());
        if (response.ok && bodyOk) {
          const messageId = String(body?.messageId ?? "").trim();
          if (messageId) persistedMessageIds.push(messageId);
        } else {
          console.warn("send-chat-message direct fetch failed:", body?.error || body?.message || `HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn("send-chat-message direct fetch threw:", error);
      }
    }
  }

  if (persistedMessageIds.length === 0) {
    // Fallback path: direct insert for exactly one owner to avoid duplicate rows.
    const senderOwnerUserId = await getOwnerUserId();
    const memberOwnerUserId = await resolveOwnerUserIdForMember(canonicalTargetMemberId, senderOwnerUserId);
    if (sender === "member" && (!memberOwnerUserId || memberOwnerUserId === senderOwnerUserId)) {
      console.warn("Supabase message direct insert fallback skipped: trainer owner was not resolved for member sender.");
      return false;
    }
    const chosenOwnerUserId = memberOwnerUserId || senderOwnerUserId;
    if (!chosenOwnerUserId) return false;
    const directInsert = await supabaseClient
      .from("chat_messages")
      .insert({
        id: clientMessageId,
        member_id: canonicalTargetMemberId,
        owner_user_id: chosenOwnerUserId,
        sender,
        text: trimmedText,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (!directInsert.error) {
      const messageId = typeof directInsert.data?.id === "string" ? directInsert.data.id : null;
      if (messageId) persistedMessageIds.push(messageId);
    } else {
      console.warn("Supabase message direct insert fallback failed:", directInsert.error.message);
    }
  }

  persistedMessageIds.forEach((id) => {
    void supabaseClient.functions.invoke("send-message-push", { body: { messageId: id } });
  });

  const persisted = persistedMessageIds.length > 0;
  if (persisted) {
    void notifyMessagesPersisted();
  }
  return persisted;
}

async function persistProgramDirectTrainer(
  input: SaveProgramInput,
  memberId: string,
  ownerUserId: string,
  normalizedProgramId: string,
): Promise<PersistResult> {
  if (!supabaseClient || !ownerUserId) {
    return { ok: false, message: "Kunne ikke bekrefte innlogget trener." };
  }
  const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const programId = isUuid(normalizedProgramId) ? normalizedProgramId : crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const authorDb =
    input.programCreatedBy === "member" || input.programCreatedBy === "trainer"
      ? {
          program_created_by: input.programCreatedBy,
          program_created_by_name: String(input.programCreatedByName ?? "").trim(),
        }
      : {
          program_created_by: "trainer" as const,
          program_created_by_name: String(input.programCreatedByName ?? "").trim() || "Trener",
        };
  const rowBase = {
    id: programId,
    member_id: memberId,
    owner_user_id: ownerUserId,
    title: input.title,
    goal: input.goal,
    notes: input.notes,
    exercises: input.exercises,
    created_at: timestamp,
    ...programImageDbField(input.imageUrl),
  };
  const rowWithAuthor = { ...rowBase, ...authorDb };
  let { error } = await supabaseClient.from("training_programs").upsert(rowWithAuthor, { onConflict: "id" });
  if (error && isTrainingProgramOptionalColumnDbError(error.message)) {
    ({ error } = await supabaseClient.from("training_programs").upsert(omitTrainingProgramOptionalDbFields(rowWithAuthor), {
      onConflict: "id",
    }));
  }
  if (error) {
    console.warn("trainer direct program upsert failed:", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true, ids: [programId] };
}

function parsePersistedProgramInvokePayload(
  payload: { ok?: boolean; ids?: unknown[] } | null,
): PersistResult {
  const ids = Array.isArray(payload?.ids)
    ? payload.ids.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  if (payload?.ok === true || ids.length > 0) {
    return { ok: true, ids };
  }
  return {
    ok: false,
    message: "Server svarte uten lagret program. Prøv igjen.",
  };
}

async function invokeSaveTrainingProgram(
  body: Record<string, unknown>,
): Promise<{ functionResult: { data: unknown; error: unknown | null }; timedOut: boolean }> {
  if (!supabaseClient) {
    return { functionResult: { data: null, error: { message: "Supabase er ikke konfigurert." } }, timedOut: false };
  }
  let timedOut = false;
  const functionResult = await promiseWithTimeout(
    supabaseClient.functions.invoke("save-training-program", { body }),
    PROGRAM_EDGE_INVOKE_TIMEOUT_MS,
    { data: null, error: { message: "save-training-program timeout" } },
  );
  if (functionResult.error && String((functionResult.error as { message?: string }).message ?? "").includes("timeout")) {
    timedOut = true;
  }
  return { functionResult, timedOut };
}

/** PT-lagring: én rad, tidsbegrenset — unngår trege søsken-synk og hengende «Lagrer …». */
async function persistProgramTrainer(
  input: SaveProgramInput,
  memberId: string,
  sessionUserId: string,
  normalizedProgramId: string,
  hints?: {
    targetEmail?: string;
    targetName?: string;
    customerType?: string;
    membershipType?: string;
    fallbackOwnerUserId?: string;
  },
): Promise<PersistResult> {
  const ownerUserId =
    sessionUserId ||
    String(hints?.fallbackOwnerUserId ?? "").trim() ||
    (await promiseWithTimeout(getOwnerUserId(hints?.fallbackOwnerUserId), 8_000, null)) ||
    "";
  if (!ownerUserId) {
    return { ok: false, message: "Kunne ikke bekrefte innlogget trener." };
  }

  const direct = await promiseWithTimeout(
    persistProgramDirectTrainer(input, memberId, ownerUserId, normalizedProgramId),
    TRAINER_PROGRAM_SAVE_TIMEOUT_MS,
    { ok: false, message: "Lagring tok for lang tid. Prøv igjen." } satisfies PersistResult,
  );
  if (direct.ok) return direct;
  if (direct.message && !direct.message.includes("tok for lang tid")) {
    console.warn("trainer direct program save failed, trying edge:", direct.message);
  }

  const { functionResult, timedOut } = await invokeSaveTrainingProgram({
    id: normalizedProgramId,
    memberId,
    title: input.title,
    goal: input.goal,
    notes: input.notes,
    exercises: input.exercises,
    targetEmail: hints?.targetEmail ?? "",
    targetName: hints?.targetName ?? "",
    customerType: hints?.customerType ?? "",
    membershipType: hints?.membershipType ?? "",
    programCreatedBy: input.programCreatedBy,
    programCreatedByName: input.programCreatedByName,
    imageUrl: input.imageUrl,
  });

  if (timedOut) {
    return { ok: false, message: "Lagring tok for lang tid. Sjekk nettverk og prøv igjen." };
  }

  if (!functionResult.error) {
    return parsePersistedProgramInvokePayload(functionResult.data as { ok?: boolean; ids?: unknown[] } | null);
  }

  const invokeDetails = await extractFunctionErrorDetails(functionResult.error);
  return {
    ok: false,
    message: invokeDetails || "Kunne ikke lagre program til sky. Prøv igjen.",
  };
}

async function persistProgram(
  rawInput: SaveProgramInput,
  hints?: {
    targetEmail?: string;
    targetName?: string;
    customerType?: string;
    membershipType?: string;
    fallbackOwnerUserId?: string;
    /** PT-lagring: én rad direkte i Postgres (raskere enn edge function + søsken-synk). */
    trainerSave?: boolean;
  },
) : Promise<PersistResult> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const input: SaveProgramInput = {
    ...rawInput,
    exercises: normalizeLegacyIntervalCooldownExerciseNames(rawInput.exercises),
  };
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const sessionUserId =
    String(session?.user?.id ?? "").trim() ||
    String(hints?.fallbackOwnerUserId ?? "").trim() ||
    (await promiseWithTimeout(getOwnerUserId(hints?.fallbackOwnerUserId), 8_000, null)) ||
    "";
  const memberId = await promiseWithTimeout(
    resolveCanonicalMemberIdForPersistence(input.memberId.trim(), {
      targetEmail: hints?.targetEmail,
    }),
    8_000,
    input.memberId.trim(),
  );
  const normalizedProgramId = (() => {
    const raw = String(input.id ?? "").trim();
    if (!raw) return "";
    // Local optimistic IDs should not force "update-single-row" path in edge function.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
    return isUuid ? raw : "";
  })();

  if ((hints?.trainerSave || input.programCreatedBy === "trainer") && memberId) {
    return persistProgramTrainer(input, memberId, sessionUserId, normalizedProgramId, hints);
  }

  const { functionResult, timedOut } = await invokeSaveTrainingProgram({
    id: normalizedProgramId,
    memberId,
    title: input.title,
    goal: input.goal,
    notes: input.notes,
    exercises: input.exercises,
    targetEmail: hints?.targetEmail ?? "",
    targetName: hints?.targetName ?? "",
    customerType: hints?.customerType ?? "",
    membershipType: hints?.membershipType ?? "",
    programCreatedBy: input.programCreatedBy,
    programCreatedByName: input.programCreatedByName,
    imageUrl: input.imageUrl,
  });
  if (timedOut) {
    return { ok: false, message: "Lagring tok for lang tid. Sjekk nettverk og prøv igjen." };
  }
  if (!functionResult.error) {
    const parsed = parsePersistedProgramInvokePayload(functionResult.data as { ok?: boolean; ids?: unknown[] } | null);
    if (parsed.ok) return parsed;
    console.warn("save-training-program returned without saving program:", functionResult.data);
    return parsed;
  }
  console.warn("save-training-program invoke failed:", (functionResult.error as { message?: string }).message);
  const invokeDetails = await extractFunctionErrorDetails(functionResult.error);
  if (invokeDetails) {
    console.warn("save-training-program invoke details:", invokeDetails);
  }

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token ?? "";
      if (accessToken) {
        const response = await fetch(`${supabaseUrl}/functions/v1/save-training-program`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            id: normalizedProgramId,
            memberId,
            title: input.title,
            goal: input.goal,
            notes: input.notes,
            exercises: input.exercises,
            targetEmail: hints?.targetEmail ?? "",
            targetName: hints?.targetName ?? "",
            customerType: hints?.customerType ?? "",
            membershipType: hints?.membershipType ?? "",
            programCreatedBy: input.programCreatedBy,
            programCreatedByName: input.programCreatedByName,
          }),
        });
        const raw = await response.text();
        if (response.ok) {
          const parsed = raw ? (JSON.parse(raw) as { ok?: boolean; ids?: unknown[] }) : null;
          const ids = Array.isArray(parsed?.ids)
            ? parsed.ids.map((id) => String(id ?? "").trim()).filter(Boolean)
            : [];
          if (parsed?.ok === true || ids.length > 0) {
            return { ok: true, ids };
          }
          console.warn("save-training-program HTTP fallback returned without saving program:", parsed);
        } else {
          console.warn("save-training-program HTTP fallback failed:", response.status, raw.slice(0, 400));
          return {
            ok: false,
            message: raw.slice(0, 220) || `HTTP ${response.status} fra save-training-program`,
          };
        }
      }
    } catch (fetchErr) {
      console.warn("save-training-program HTTP fallback fetch failed:", fetchErr);
    }
  }

  // Fallback: persist directly via table writes when edge function path fails or returns no ids.
  const relatedMemberIds = await resolveRelatedMemberIds(memberId, {
    targetEmail: hints?.targetEmail,
    targetName: hints?.targetName,
  });
  const targetMemberIds = Array.from(new Set((relatedMemberIds.length ? relatedMemberIds : [memberId]).filter(Boolean)));
  if (!targetMemberIds.length) return { ok: false, message: "Fant ingen medlemsprofiler å lagre programmet på." };
  const ownerUserId = (await resolveOwnerUserIdForMember(memberId, sessionUserId)) ?? sessionUserId;
  if (!ownerUserId) {
    console.warn("save-training-program fallback skipped because owner_user_id could not be resolved client-side");
    return { ok: false, message: "Kunne ikke bekrefte innlogget bruker under lagring." };
  }
  const timestamp = new Date().toISOString();
  const inputFingerprint = buildTrainingProgramPersistenceFingerprint({
    title: input.title,
    goal: input.goal,
    notes: input.notes,
    exercises: input.exercises,
  });
  const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const fallbackProgramId = isUuid(normalizedProgramId) ? normalizedProgramId : "";
  const authorDb =
    input.programCreatedBy && (input.programCreatedBy === "member" || input.programCreatedBy === "trainer")
      ? {
          program_created_by: input.programCreatedBy,
          program_created_by_name: String(input.programCreatedByName ?? "").trim(),
        }
      : {};

  if (fallbackProgramId) {
    const rowBase = {
      id: fallbackProgramId,
      member_id: memberId,
      owner_user_id: ownerUserId,
      title: input.title,
      goal: input.goal,
      notes: input.notes,
      exercises: input.exercises,
      created_at: timestamp,
      ...programImageDbField(input.imageUrl),
    };
    let { error: primaryError } = await supabaseClient.from("training_programs").upsert(
      { ...rowBase, ...authorDb },
      { onConflict: "id" },
    );
    if (primaryError && isTrainingProgramOptionalColumnDbError(primaryError.message)) {
      ({ error: primaryError } = await supabaseClient.from("training_programs").upsert(rowBase, { onConflict: "id" }));
    }
    if (primaryError) {
      console.warn("save-training-program fallback upsert failed:", primaryError.message);
      return { ok: false, message: primaryError.message };
    }
  }

  for (const targetMemberId of targetMemberIds) {
    if (!targetMemberId) continue;
    if (fallbackProgramId && targetMemberId === memberId) continue;
    const { data: existingRows, error: lookupError } = await supabaseClient
      .from("training_programs")
      .select("id, title, goal, notes, exercises")
      .eq("owner_user_id", ownerUserId)
      .eq("member_id", targetMemberId)
      .eq("title", input.title)
      .order("created_at", { ascending: false })
      .limit(8);
    if (lookupError) {
      console.warn("save-training-program fallback lookup failed:", lookupError.message);
      return { ok: false, message: lookupError.message };
    }
    const matchingExisting = (existingRows ?? []).find((row) => buildTrainingProgramPersistenceFingerprint(row as Record<string, unknown>) === inputFingerprint);
    const existingId = String((matchingExisting as { id?: string } | undefined)?.id ?? "").trim();
    if (existingId) {
      const updatePayload = {
        goal: input.goal,
        notes: input.notes,
        exercises: input.exercises,
        created_at: timestamp,
        ...programImageDbField(input.imageUrl),
        ...authorDb,
      };
      let { error: updateError } = await supabaseClient.from("training_programs").update(updatePayload).eq("id", existingId);
      if (updateError && isTrainingProgramOptionalColumnDbError(updateError.message)) {
        ({ error: updateError } = await supabaseClient
          .from("training_programs")
          .update({
            goal: input.goal,
            notes: input.notes,
            exercises: input.exercises,
            created_at: timestamp,
            ...programImageDbField(input.imageUrl),
          })
          .eq("id", existingId));
      }
      if (updateError) {
        console.warn("save-training-program fallback update failed:", updateError.message);
        return { ok: false, message: updateError.message };
      }
      continue;
    }
    const insertBase = {
      id: crypto.randomUUID(),
      member_id: targetMemberId,
      owner_user_id: ownerUserId,
      title: input.title,
      goal: input.goal,
      notes: input.notes,
      exercises: input.exercises,
      created_at: timestamp,
      ...programImageDbField(input.imageUrl),
    };
    let { error: insertError } = await supabaseClient.from("training_programs").insert({ ...insertBase, ...authorDb });
    if (insertError && isTrainingProgramOptionalColumnDbError(insertError.message)) {
      ({ error: insertError } = await supabaseClient.from("training_programs").insert(insertBase));
    }
    if (insertError) {
      console.warn("save-training-program fallback insert failed:", insertError.message);
      return { ok: false, message: insertError.message };
    }
  }

  return { ok: true, ids: fallbackProgramId ? [fallbackProgramId] : [] };
}

const pendingMemberPersists = new Map<string, Promise<void>>();

export type MemberCatalogSyncResult = {
  programsPushed: number;
  logsPushed: number;
  failures: string[];
};

/** Push locally cached member programs/logs to Supabase (e.g. after failed mobile saves). */
export async function syncMemberLocalCatalogToSupabase(state: AppState): Promise<MemberCatalogSyncResult> {
  const result: MemberCatalogSyncResult = { programsPushed: 0, logsPushed: 0, failures: [] };
  if (!supabaseClient || state.currentUser?.role !== "member") return result;

  const sessionEmail = state.currentUser.email.trim().toLowerCase();
  if (!sessionEmail.includes("@")) return result;

  const canonicalMemberId = await resolveCanonicalMemberIdForPersistence(state.memberViewId, {
    targetEmail: sessionEmail,
  });
  if (!canonicalMemberId) {
    result.failures.push("Fant ikke medlems-id for sky-synk.");
    return result;
  }

  await ensureMemberAuthLink(sessionEmail, canonicalMemberId);

  const authUserId = String(state.currentUser.id ?? "").trim();
  const memberIds = new Set<string>(
    [canonicalMemberId, state.memberViewId.trim(), state.currentUser.memberId?.trim() ?? "", authUserId, authUserId ? `auth-${authUserId}` : "", sessionEmail].filter(Boolean),
  );
  const emailMembers = state.members.filter((member) => member.email.trim().toLowerCase() === sessionEmail);
  emailMembers.forEach((member) => memberIds.add(member.id.trim()));

  const anchorMember =
    emailMembers.find((member) => member.id === canonicalMemberId && !isContaminatedDemoMemberProfile(member)) ??
    emailMembers.find((member) => !isContaminatedDemoMemberProfile(member)) ??
    null;

  const hints = {
    targetEmail: sessionEmail,
    targetName: String(anchorMember?.name ?? state.currentUser.name ?? "").trim(),
    customerType: String(anchorMember?.customerType ?? "PT-kunde").trim(),
    membershipType: String(anchorMember?.membershipType ?? "Premium").trim(),
    fallbackOwnerUserId: String(state.currentUser.id ?? "").trim(),
  };

  const localPrograms = state.programs.filter(
    (program) =>
      memberIds.has(program.memberId.trim()) &&
      !program.ephemeral &&
      !programIsInMemberArchive(program.memberLibraryStatus),
  );
  for (const program of localPrograms) {
    const saveInput: SaveProgramInput = {
      id: program.id,
      title: program.title,
      goal: program.goal,
      notes: program.notes,
      memberId: canonicalMemberId,
      exercises: program.exercises,
      imageUrl: program.imageUrl,
      programCreatedBy: program.programCreatedBy,
      programCreatedByName: program.programCreatedByName,
    };
    const persisted = await persistProgram(saveInput, hints);
    if (persisted.ok) {
      result.programsPushed += 1;
    } else {
      result.failures.push(`Program «${program.title}»: ${persisted.message ?? "ukjent feil"}`);
    }
  }

  const localLogs = state.logs.filter((log) => memberIds.has(log.memberId.trim()));
  const remoteLogIds = new Set<string>();
  if (supabaseClient && memberIds.size > 0) {
    const { data: remoteRows } = await supabaseClient
      .from("workout_logs")
      .select("id")
      .in("member_id", Array.from(memberIds));
    for (const row of remoteRows ?? []) {
      const id = String((row as { id?: string }).id ?? "").trim();
      if (id) remoteLogIds.add(id);
    }
    markWorkoutLogsSeenInRemote(remoteLogIds);
  }

  for (const log of localLogs) {
    const logId = log.id.trim();
    if (wasWorkoutLogSeenInRemote(logId) && !remoteLogIds.has(logId)) {
      continue;
    }
    const persisted = await persistWorkoutLog(
      { ...log, memberId: canonicalMemberId },
      { targetEmail: sessionEmail },
    );
    if (persisted.ok) {
      result.logsPushed += 1;
    } else {
      result.failures.push(`Økt «${log.programTitle}»: ${persisted.message ?? "ukjent feil"}`);
    }
  }

  return result;
}

export function waitForMemberPersist(memberId: string): Promise<void> {
  return pendingMemberPersists.get(memberId.trim()) ?? Promise.resolve();
}

export type PersistMemberProfileFormKind = "onboarding" | "check-in";

/** Lagre profilblob (oppstart / månedlig sjekk-inn) med verifisert sky-skriving. */
export async function persistOnboardingToSupabase(
  member: Member,
  changes: Pick<Member, "goal" | "level" | "injuries" | "personalGoals" | "focus">,
  relatedMemberIds: string[],
  options?: { formKind?: PersistMemberProfileFormKind },
): Promise<string> {
  const formKind = options?.formKind ?? "onboarding";
  if (!supabaseClient) {
    throw new Error("Supabase er ikke konfigurert — svarene kan ikke lagres i skyen.");
  }

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const authEmail = String(user?.email ?? "").trim().toLowerCase();
  const memberEmail = member.email.trim().toLowerCase();
  const syncEmail = authEmail && authEmail.includes("@") ? authEmail : memberEmail;
  if (!syncEmail.includes("@")) {
    throw new Error("Mangler gyldig innloggings-e-post for å lagre oppstartsskjema.");
  }

  const canonicalId = await resolveCanonicalMemberIdForPersistence(member.id, {
    targetEmail: syncEmail,
  });
  const persistId =
    canonicalId && !canonicalId.startsWith("auth-") ? canonicalId : member.id.startsWith("auth-") ? "" : member.id;

  const memberForSync: Member = {
    ...member,
    ...(persistId ? { id: persistId } : {}),
    email: syncEmail,
    goal: changes.goal,
    level: changes.level,
    injuries: changes.injuries,
    personalGoals: changes.personalGoals,
    focus: changes.focus,
  };

  const authMemberIdFromJwt = String(
    user?.app_metadata?.member_id ?? user?.user_metadata?.member_id ?? "",
  ).trim();
  const authUserId = String(user?.id ?? "").trim();
  const dbMemberIds = Array.from(
    new Set(
      [...relatedMemberIds, persistId, member.id, authMemberIdFromJwt, authUserId]
        .map((id) => String(id ?? "").trim())
        .filter((id) => id && !id.startsWith("auth-") && id !== "__template__"),
    ),
  );

  const syncResult = await syncMemberProfileViaEdgeFunction(memberForSync, authEmail, dbMemberIds);
  let updated = syncResult.updated;
  let lastError = syncResult.errorMessage;

  if (updated === 0) {
    const idClauses = [
      ...(persistId ? [`id.eq.${persistId}`] : []),
      ...dbMemberIds.map((id) => `id.eq.${id}`),
    ];
    let directUpdate = idClauses.length
      ? await supabaseClient
      .from("members")
          .update({
            goal: changes.goal,
            focus: changes.focus,
            injuries: changes.injuries,
            personal_goals: changes.personalGoals,
            level: changes.level,
          })
          .or(idClauses.join(","))
          .select("id")
      : { data: [] as Array<{ id: string }>, error: null as { message: string } | null };

    if ((directUpdate.data?.length ?? 0) === 0) {
      directUpdate = await supabaseClient
        .from("members")
        .update({
          goal: changes.goal,
          focus: changes.focus,
          injuries: changes.injuries,
          personal_goals: changes.personalGoals,
          level: changes.level,
        })
        .ilike("email", syncEmail)
        .select("id");
    }

    if (!directUpdate.error && (directUpdate.data?.length ?? 0) > 0) {
      updated = directUpdate.data?.length ?? 0;
    } else {
      lastError = directUpdate.error?.message || lastError || "Ingen medlemsrader ble oppdatert";
      console.warn("Onboarding direct update failed:", lastError);
    }
  }

  if (updated === 0) {
    const label = formKind === "check-in" ? "månedlig sjekk-inn" : "oppstartsskjema";
    throw new Error(
      lastError
        ? `Kunne ikke lagre ${label}: ${lastError}`
        : `Kunne ikke lagre ${label} i databasen. Sjekk at du er logget inn med riktig e-post og prøv igjen.`,
    );
  }

  const resolvedId = persistId || dbMemberIds[0] || "";
  if (resolvedId && !resolvedId.startsWith("auth-") && formKind === "onboarding") {
    const { data: verifyRow, error: verifyError } = await supabaseClient
      .from("members")
      .select("personal_goals")
      .eq("id", resolvedId)
      .maybeSingle();
    if (!verifyError) {
      const stored = String(verifyRow?.personal_goals ?? "");
      if (
        stored &&
        !stored.includes('"onboarding"') &&
        !stored.includes("onboardingCompletedAt")
      ) {
        console.warn("Onboarding verify: row updated but personal_goals missing onboarding blob");
      }
    }
  }

  const notifyMemberId = resolvedId || persistId || member.id;
  void notifyTrainerMemberFormPush(
    notifyMemberId,
    formKind,
    memberForSync.name.trim() || memberForSync.email.trim() || "Medlem",
  );

  return notifyMemberId;
}

function personalGoalsContainsProfileBlob(personalGoals: string | undefined): boolean {
  const value = String(personalGoals ?? "").trim();
  return (
    value.startsWith("MOTUS_PROFILE_V1:") ||
    value.includes("onboardingCompletedAt") ||
    value.includes('"onboarding"') ||
    value.includes('"monthlyCheckIns"')
  );
}

type ProfileSyncResult = { updated: number; errorMessage: string | null };

async function syncMemberProfileViaEdgeFunction(
  member: Member,
  authenticatedEmail: string,
  relatedMemberIds: string[],
): Promise<ProfileSyncResult> {
  if (!supabaseClient) return { updated: 0, errorMessage: "Supabase-klient mangler" };
  const normalizedEmail = member.email.trim().toLowerCase();
  const syncEmails = Array.from(
    new Set(
      [normalizedEmail, authenticatedEmail]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value) => value && value.includes("@")),
    ),
  );
  const syncPayload = {
    email: authenticatedEmail || normalizedEmail,
    emails: syncEmails,
    memberId: member.id,
    memberIds: relatedMemberIds.length ? relatedMemberIds : [member.id],
    targetName: member.name,
    changes: {
      name: member.name,
      phone: member.phone,
      birthDate: member.birthDate,
      goal: member.goal,
      focus: member.focus,
      injuries: member.injuries,
      personalGoals: member.personalGoals,
      ...(member.avatarUrl?.trim() ? { avatarUrl: member.avatarUrl.trim() } : {}),
    },
  };

  let updated = 0;
  let errorMessage: string | null = null;
  const invokeResult = await supabaseClient.functions.invoke("update-member-profile", { body: syncPayload });
  if (!invokeResult.error) {
    const data = invokeResult.data;
    if (data && typeof data === "object") {
      if ("error" in data && typeof (data as { error?: unknown }).error === "string") {
        errorMessage = String((data as { error: string }).error);
      }
      if ("updated" in data) {
        updated = Number((data as { updated?: unknown }).updated ?? 0);
      }
    }
  } else {
    errorMessage = invokeResult.error.message;
    console.warn("update-member-profile invoke failed:", invokeResult.error.message);
  }

  if (updated === 0 && supabaseUrl && supabaseAnonKey) {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token ?? "";
    if (accessToken) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/update-member-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(syncPayload),
        });
        const body = (await response.json().catch(() => null)) as { updated?: number; error?: string; message?: string } | null;
        if (response.ok) {
          updated = Number(body?.updated ?? 0);
          if (updated === 0 && body?.error) errorMessage = String(body.error);
        } else {
          errorMessage = body?.error || body?.message || `HTTP ${response.status}`;
          console.warn("update-member-profile direct fetch failed:", errorMessage);
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Nettverksfeil mot update-member-profile";
        console.warn("update-member-profile direct fetch threw:", error);
      }
    }
  }

  return { updated, errorMessage };
}

async function notifyTrainerMemberFormPush(
  memberId: string,
  kind: "onboarding" | "check-in",
  memberName: string,
): Promise<void> {
  if (!supabaseClient) return;
  const trimmedMemberId = memberId.trim();
  if (!trimmedMemberId) return;
  void supabaseClient.functions.invoke("send-member-form-push", {
    body: {
      memberId: trimmedMemberId,
      kind,
      memberName: memberName.trim() || "Medlem",
    },
  });
}

async function notifyTrainerForMemberFormChanges(member: Member, previousPersonalGoals?: string): Promise<void> {
  const notices = detectNewMemberFormSubmissions(previousPersonalGoals, member.personalGoals);
  const displayName = member.name.trim() || member.email.trim() || "Medlem";
  const memberId = member.id.trim();
  if (!memberId || !notices.length) return;
  for (const notice of notices) {
    void notifyTrainerMemberFormPush(memberId, notice.kind, displayName);
  }
}

async function persistMember(member: Member, previousPersonalGoals?: string) {
  if (!supabaseClient) return;
  if (isContaminatedDemoMemberProfile(member)) {
    console.warn("persistMember skipped contaminated demo profile:", member.id, member.email, member.name);
    return;
  }
  const normalizedEmail = member.email.trim().toLowerCase();
  const canonicalMemberId = await resolveCanonicalMemberIdForPersistence(member.id, {
    targetEmail: normalizedEmail,
  });
  const memberForPersist =
    canonicalMemberId && canonicalMemberId !== member.id ? { ...member, id: canonicalMemberId } : member;
  const relatedMemberIds = await resolveRelatedMemberIds(memberForPersist.id, {
    targetEmail: normalizedEmail,
    targetName: memberForPersist.name,
  });
  const memberIdsForSync = relatedMemberIds.length > 0 ? relatedMemberIds : [memberForPersist.id];
  const syncPayload = {
    email: normalizedEmail,
    emails: [normalizedEmail],
    memberId: memberForPersist.id,
    memberIds: memberIdsForSync,
    targetName: memberForPersist.name,
    changes: {
      name: memberForPersist.name,
      phone: memberForPersist.phone,
      birthDate: memberForPersist.birthDate,
      goal: memberForPersist.goal,
      focus: memberForPersist.focus,
      injuries: memberForPersist.injuries,
      personalGoals: memberForPersist.personalGoals,
      avatarUrl: memberForPersist.avatarUrl ?? "",
      membershipType: memberForPersist.membershipType,
      customerType: memberForPersist.customerType,
      nutritionAccess: memberForPersist.nutritionAccess === true,
      ...(memberForPersist.invitedAt?.trim() ? { invitedAt: memberForPersist.invitedAt.trim() } : {}),
    },
  };
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const authenticatedEmail = String(user?.email ?? "").trim().toLowerCase();
  const roleClaim = (() => {
    const appRole = user?.app_metadata?.role;
    if (appRole === "member" || appRole === "trainer") return appRole;
    const userRole = user?.user_metadata?.role;
    if (userRole === "member" || userRole === "trainer") return userRole;
    return "";
  })();

  const isProfileBlobSave = personalGoalsContainsProfileBlob(memberForPersist.personalGoals);
  const shouldUseMemberProfileSync =
    roleClaim === "member" ||
    (authenticatedEmail && authenticatedEmail === normalizedEmail) ||
    (Boolean(authenticatedEmail) && isProfileBlobSave);

  if (shouldUseMemberProfileSync) {
    const syncEmails = Array.from(
      new Set(
        [normalizedEmail, authenticatedEmail]
          .map((value) => String(value ?? "").trim().toLowerCase())
          .filter((value) => value && value.includes("@")),
      ),
    );
    const syncResult = await syncMemberProfileViaEdgeFunction(memberForPersist, authenticatedEmail, relatedMemberIds);
    let updated = syncResult.updated;

    if (updated === 0) {
      const profileUpdateFields = {
        name: memberForPersist.name,
        phone: memberForPersist.phone,
        birth_date: memberForPersist.birthDate,
        gender: memberForPersist.gender,
        goal: memberForPersist.goal,
        focus: memberForPersist.focus,
        injuries: memberForPersist.injuries,
        personal_goals: memberForPersist.personalGoals,
        avatar_url: memberForPersist.avatarUrl ?? "",
      };
      let directUpdate = await supabaseClient
        .from("members")
        .update(profileUpdateFields)
        .eq("id", memberForPersist.id.trim())
        .select("id");
      if (
        directUpdate.error &&
        isMissingDbColumnError(directUpdate.error.message, "avatar_url")
      ) {
        directUpdate = await supabaseClient
          .from("members")
          .update(stripAvatarUrlField(profileUpdateFields))
          .eq("id", memberForPersist.id.trim())
          .select("id");
      }
      if ((directUpdate.data?.length ?? 0) === 0) {
        directUpdate = await supabaseClient
          .from("members")
          .update(profileUpdateFields)
          .ilike("email", normalizedEmail)
          .select("id");
        if (
          directUpdate.error &&
          isMissingDbColumnError(directUpdate.error.message, "avatar_url")
        ) {
          directUpdate = await supabaseClient
            .from("members")
            .update(stripAvatarUrlField(profileUpdateFields))
            .ilike("email", normalizedEmail)
            .select("id");
        }
      }
      if (!directUpdate.error && (directUpdate.data?.length ?? 0) > 0) {
        updated = directUpdate.data?.length ?? 0;
      } else {
        console.warn(
          "Supabase member fallback update failed:",
          directUpdate.error?.message || syncResult.errorMessage || "No rows updated via fallback path",
        );
      }
    }

    if (updated === 0 && isProfileBlobSave) {
      throw new Error(
        "Kunne ikke lagre profilen til skyen. Sjekk nettverk og at du er logget inn med riktig e-post, og prøv igjen.",
      );
    }
    return;
  }

  const sessionOwnerId = await getOwnerUserId();
  if (!sessionOwnerId) return;
  let ownerForUpsert = resolveOwnerUserIdForPersist({
    customerType: member.customerType,
    sessionOwnerId,
    existingOwnerId: member.ownerUserId,
  });
  if (isPrivatePtRosterCustomerType(member.customerType, member.membershipType)) {
    ownerForUpsert = sessionOwnerId;
  } else if (ownerForUpsert !== sessionOwnerId) {
    const { count } = await supabaseClient
      .from("training_programs")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberForPersist.id.trim())
      .eq("owner_user_id", sessionOwnerId);
    if ((count ?? 0) > 0) {
      ownerForUpsert = sessionOwnerId;
    }
  }

  const memberUpsertPayload = {
    id: member.id,
    owner_user_id: ownerForUpsert,
    name: member.name,
    email: normalizedEmail,
    is_active: member.isActive !== false,
    invited_at: member.invitedAt || null,
    first_login_at: member.firstLoginAt || null,
    phone: member.phone,
    birth_date: member.birthDate,
    gender: member.gender,
    weight: member.weight,
    height: member.height,
    level: member.level,
    membership_type: member.membershipType,
    customer_type: member.customerType,
    nutrition_access: member.nutritionAccess === true,
    days_since_activity: member.daysSinceActivity,
    goal: member.goal,
    focus: member.focus,
    personal_goals: member.personalGoals,
    injuries: member.injuries,
    coach_notes: member.coachNotes,
    avatar_url: member.avatarUrl ?? "",
    created_at: new Date().toISOString(),
  };
  let { error } = await supabaseClient.from("members").upsert(memberUpsertPayload, { onConflict: "id" });
  if (error && isMissingDbColumnError(error.message, "avatar_url")) {
    ({ error } = await supabaseClient
      .from("members")
      .upsert(stripAvatarUrlField(memberUpsertPayload), { onConflict: "id" }));
  }
  if (error && isMissingDbColumnError(error.message, "nutrition_access")) {
    ({ error } = await supabaseClient
      .from("members")
      .upsert(stripNutritionAccessField(memberUpsertPayload), { onConflict: "id" }));
  }
  if (error && isMissingDbColumnError(error.message, "first_login_at")) {
    const withoutFirstLogin = { ...memberUpsertPayload };
    delete (withoutFirstLogin as { first_login_at?: string | null }).first_login_at;
    ({ error } = await supabaseClient.from("members").upsert(withoutFirstLogin, { onConflict: "id" }));
  }

  if (error) {
    console.warn("Supabase member persist failed:", error.message);
  }
  // Always sync profile changes through service-role endpoint so updates propagate
  // across duplicate/shared member rows (not only when this single-row upsert fails).
  const propagate = await supabaseClient.functions.invoke("update-member-profile", { body: syncPayload });
  if (propagate.error) {
    console.warn("Supabase member persist edge propagation failed:", propagate.error.message);
  }
}

async function persistExercise(exercise: Exercise) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("exercise_bank").upsert(
    {
      id: exercise.id,
      name: exercise.name,
      category: exercise.category,
      muscle_group: exercise.group,
      equipment: exercise.equipment,
      level: exercise.level,
      description: exercise.description,
      image_url: exercise.imageUrl ?? null,
      prescription_fields: prescriptionFieldsForExerciseSave(exercise.prescriptionFields, exercise.category),
      custom_field_1_label: exercise.customField1Label?.trim() ?? "",
      custom_field_2_label: exercise.customField2Label?.trim() ?? "",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    console.warn("Supabase exercise persist failed:", error.message);
  }
}

async function deactivateExerciseInSupabase(exerciseId: string, updatedPrograms: TrainingProgram[]) {
  if (!supabaseClient) return;
  const normalizedExerciseId = exerciseId.trim();
  if (!normalizedExerciseId) return;

  const { error: exerciseUpdateError } = await supabaseClient
    .from("exercise_bank")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", normalizedExerciseId);
  if (exerciseUpdateError) {
    console.warn("Supabase exercise deactivate failed:", exerciseUpdateError.message);
  }

  for (const program of updatedPrograms) {
    const { error } = await supabaseClient
      .from("training_programs")
      .update({ exercises: program.exercises })
      .eq("id", program.id);
    if (error) {
      console.warn("Supabase program exercise cleanup failed:", error.message);
    }
  }
}

function buildTrainingProgramPersistenceFingerprint(input: {
  title?: unknown;
  goal?: unknown;
  notes?: unknown;
  exercises?: unknown;
}): string {
  const exercises = Array.isArray(input.exercises) ? (input.exercises as ProgramExercise[]) : [];
  const exerciseFingerprint = exercises
    .map(
      (item) =>
        `${item.exerciseName}|${item.sets}|${item.reps}|${item.repsUnit ?? ""}|${item.weight}|${item.weightUnit ?? ""}|${item.holdSeconds ?? ""}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.targetHrPercent ?? ""}|${item.notes}`,
    )
    .join("||");
  return `${String(input.title ?? "").trim()}::${String(input.goal ?? "").trim()}::${String(input.notes ?? "").trim()}::${exerciseFingerprint}`;
}

export async function deleteProgramRemote(
  programId: string,
  context?: DeleteProgramContext,
): Promise<boolean> {
  if (!supabaseClient) return false;
  const memberInitiated = context?.requestedBy === "member";

  try {
    const edgeResult = await promiseWithTimeout(
      supabaseClient.functions.invoke("delete-training-program", {
        body: {
          programId,
          memberIds: context?.memberIds,
          targetEmail: context?.targetEmail,
          targetName: context?.targetName,
          requestedBy: context?.requestedBy,
        },
      }),
      PROGRAM_EDGE_INVOKE_TIMEOUT_MS,
      { data: null, error: { message: "delete-training-program timeout" } },
    );
    if (!edgeResult.error && (edgeResult.data as { ok?: boolean } | null)?.ok === true) {
      return true;
    }
    if (edgeResult.error) {
      const details = await extractFunctionErrorDetails(edgeResult.error);
      console.warn(
        "delete-training-program invoke failed; falling back to direct delete:",
        String((edgeResult.error as { message?: string }).message ?? "Unknown error"),
        details,
      );
    }
  } catch (error) {
    console.warn("delete-training-program invoke threw; falling back to direct delete:", error);
  }

  const { data: programRow, error: lookupError } = await supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by")
    .eq("id", programId)
    .maybeSingle();
  if (lookupError) {
    console.warn("Supabase program lookup before delete failed:", lookupError.message);
  }

  if (!programRow) {
    if (memberInitiated) {
      await persistMemberProgramLibraryStatus([programId], "archived");
      return true;
    }
    const { error } = await supabaseClient.from("training_programs").delete().eq("id", programId);
    if (error) {
      console.warn("Supabase program delete failed:", error.message);
      return false;
    }
    return true;
  }
  if (memberInitiated && String(programRow.program_created_by ?? "").trim() !== "member") {
    return false;
  }

  const memberId = String(programRow.member_id ?? "").trim();
  const targetEmail = String(context?.targetEmail ?? "").trim().toLowerCase() || (memberId.includes("@") ? memberId.toLowerCase() : "");
  const targetName = String(context?.targetName ?? "").trim();
  const title = String(programRow.title ?? "");
  const targetFingerprint = buildTrainingProgramPersistenceFingerprint(programRow as Record<string, unknown>);
  const targetOwnerUserId = String(programRow.owner_user_id ?? "").trim();
  const contextMemberIds = Array.isArray(context?.memberIds) ? context?.memberIds ?? [] : [];
  const relatedMemberIds =
    contextMemberIds.length > 0
      ? contextMemberIds
      : memberId && memberId !== "__template__"
        ? await resolveRelatedMemberIds(memberId, targetEmail || targetName ? { targetEmail, targetName } : undefined)
        : [memberId];
  const deletionKeys = Array.from(
    new Set([memberId, targetEmail, ...relatedMemberIds].map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
  if (!deletionKeys.length && !targetOwnerUserId) return false;

  let candidateQuery = supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id, program_created_by")
    .eq("title", title);
  if (targetOwnerUserId) {
    candidateQuery = candidateQuery.eq("owner_user_id", targetOwnerUserId);
  } else {
    candidateQuery = candidateQuery.in("member_id", deletionKeys);
  }
  const { data: candidateRows, error: candidateError } = await candidateQuery;
  if (candidateError) {
    console.warn("Supabase linked program candidate lookup failed:", candidateError.message);
  }

  const programIdsToDelete = Array.from(
    new Set(
      (candidateRows ?? [])
        .filter((row) => {
          if (memberInitiated && String((row as { program_created_by?: string }).program_created_by ?? "").trim() !== "member") {
            return false;
          }
          const fingerprintMatches = buildTrainingProgramPersistenceFingerprint(row as Record<string, unknown>) === targetFingerprint;
          if (!fingerprintMatches) return false;
          if (targetOwnerUserId) return String((row as { owner_user_id?: string }).owner_user_id ?? "").trim() === targetOwnerUserId;
          const candidateMemberId = String((row as { member_id?: string }).member_id ?? "").trim();
          return !deletionKeys.length || deletionKeys.includes(candidateMemberId);
        })
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (!programIdsToDelete.length) {
    programIdsToDelete.push(programId);
  }

  if (memberInitiated) {
    await persistMemberProgramLibraryStatus(programIdsToDelete, "archived");
  }

  const { error } = await supabaseClient
    .from("training_programs")
    .delete()
    .in("id", programIdsToDelete);
  if (error) {
    console.warn("Supabase linked program delete failed:", error.message);
    if (memberInitiated) {
      return false;
    }
    return false;
  }

  for (const relatedMemberId of deletionKeys) {
    await deleteLogsForProgram(relatedMemberId, title);
  }
  return true;
}

async function persistMemberProgramLibraryStatus(programIds: string[], status: "hidden" | "archived" | null) {
  if (!supabaseClient) return;
  const ids = Array.from(new Set(programIds.map((id) => id.trim()).filter(Boolean)));
  if (!ids.length) return;
  const { error } = await supabaseClient.from("training_programs").update({ member_library_status: status }).in("id", ids);
  if (error && isMemberLibraryStatusColumnDbError(error.message)) {
    console.warn("member_library_status column missing; run training_programs_member_library_status.sql:", error.message);
    return;
  }
  if (error) {
    const hint =
      /permission denied|row-level security|policy/i.test(error.message)
        ? " Kjør training_programs_member_library_rls.sql i Supabase."
        : "";
    console.warn("Supabase member_library_status update failed:", error.message + hint);
  }
}

async function deleteMemberFromSupabase(member: { id: string; email?: string }) {
  if (!supabaseClient) return;
  const memberId = member.id;

  try {
    const { error } = await supabaseClient.functions.invoke("delete-member", {
      body: {
        memberId,
      },
    });
    if (!error) return;
    console.warn("delete-member invoke failed, trying fetch fallback:", error.message);
  } catch (error) {
    console.warn("delete-member invoke threw, trying fetch fallback:", error);
  }

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          memberId,
        }),
      });
      if (response.ok) return;
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      console.warn("delete-member function failed, falling back to direct delete:", payload?.error ?? response.status);
    } catch (error) {
      console.warn("delete-member function call failed, falling back to direct delete:", error);
    }
  }

  const { error: softDeleteError } = await supabaseClient
    .from("members")
    .update({ is_active: false })
    .eq("id", memberId);
  if (softDeleteError) {
    console.warn("Supabase member soft delete failed:", softDeleteError.message);
  }

  // Keep same-email duplicates permanently inactive too.
  if (normalizedEmail) {
    const { error: duplicateSoftDeleteError } = await supabaseClient
      .from("members")
      .update({ is_active: false })
      .eq("email", normalizedEmail);
    if (duplicateSoftDeleteError) {
      console.warn("Supabase duplicate member cleanup failed:", duplicateSoftDeleteError.message);
    }
  }
}

async function notifyWorkoutCommentPush(logId: string) {
  if (!supabaseClient) return;
  const trimmedLogId = logId.trim();
  if (!trimmedLogId) return;
  void supabaseClient.functions.invoke("send-workout-comment-push", { body: { logId: trimmedLogId } });
}

type PersistWorkoutLogHints = {
  targetEmail?: string;
  ownerUserId?: string;
  programTitle?: string;
  /** Unngår ekstra getSession() under intervallagring (kan henge i nettleseren). */
  accessToken?: string;
};

const WORKOUT_LOG_INTERVAL_RPC_TIMEOUT_MS = 7_000;
const WORKOUT_LOG_INTERVAL_EDGE_TIMEOUT_MS = 12_000;
const WORKOUT_LOG_INTERVAL_DIRECT_TIMEOUT_MS = 7_000;

function decodeAccessTokenClaims(accessToken: string): { sub: string; email: string } {
  try {
    const payload = JSON.parse(
      atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    ) as { sub?: string; email?: string };
    return {
      sub: String(payload.sub ?? "").trim(),
      email: String(payload.email ?? "").trim().toLowerCase(),
    };
  } catch {
    return { sub: "", email: "" };
  }
}

function buildMemberPersistenceHints(
  state: AppState,
  memberId: string,
  extras?: Pick<PersistWorkoutLogHints, "ownerUserId" | "programTitle">,
): PersistWorkoutLogHints {
  const member = state.members.find((item) => item.id === memberId);
  const sessionEmail = state.currentUser?.role === "member" ? state.currentUser.email.trim().toLowerCase() : "";
  const ownerFromMember = String(member?.ownerUserId ?? extras?.ownerUserId ?? "").trim();
  const programTitle = String(extras?.programTitle ?? "").trim();
  return {
    targetEmail: String(member?.email ?? sessionEmail).trim().toLowerCase() || undefined,
    ...(ownerFromMember ? { ownerUserId: ownerFromMember } : {}),
    ...(programTitle ? { programTitle } : {}),
  };
}

function pickWorkoutLogOwnerCandidate(candidate: string, requesterUserId: string): string | null {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === requesterUserId) return null;
  return trimmed;
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

async function resolveWorkoutLogOwnerUserId(
  memberId: string,
  hints: PersistWorkoutLogHints,
  requesterUserId: string,
): Promise<string | null> {
  if (!supabaseClient) return null;
  const hint = String(hints.ownerUserId ?? "").trim();
  const fromHint = pickWorkoutLogOwnerCandidate(hint, requesterUserId);
  if (fromHint) return fromHint;

  const title = String(hints.programTitle ?? "").trim();
  const [memberResult, programResult, anyProgramResult] = await Promise.all([
    supabaseClient.from("members").select("owner_user_id").eq("id", memberId).maybeSingle(),
    title
      ? supabaseClient
          .from("training_programs")
          .select("owner_user_id")
          .eq("member_id", memberId)
          .eq("title", title)
          .not("owner_user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseClient
      .from("training_programs")
      .select("owner_user_id")
      .eq("member_id", memberId)
      .not("owner_user_id", "is", null)
      .neq("owner_user_id", requesterUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const fromMember = pickWorkoutLogOwnerCandidate(
    String((memberResult.data as { owner_user_id?: string } | null)?.owner_user_id ?? ""),
    requesterUserId,
  );
  if (fromMember) return fromMember;

  const fromProgram = pickWorkoutLogOwnerCandidate(
    String((programResult.data as { owner_user_id?: string } | null)?.owner_user_id ?? ""),
    requesterUserId,
  );
  if (fromProgram) return fromProgram;

  return pickWorkoutLogOwnerCandidate(
    String((anyProgramResult.data as { owner_user_id?: string } | null)?.owner_user_id ?? ""),
    requesterUserId,
  );
}

function isMissingMemberWorkoutRpcError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("upsert_member_workout_log") ||
    normalized.includes("member_can_write_workout_log") ||
    normalized.includes("could not find the function") ||
    normalized.includes("schema cache")
  );
}

async function persistWorkoutLogViaMemberRpcInner(
  log: WorkoutLog,
  memberId: string,
  ownerUserId: string,
): Promise<PersistResult | null> {
  if (!supabaseClient || !isUuidString(ownerUserId)) return null;
  const serializedNote = serializeWorkoutNote(log);
  const controller = new AbortController();
  const abortId = window.setTimeout(() => controller.abort(), WORKOUT_LOG_INTERVAL_RPC_TIMEOUT_MS);
  try {
    const { data, error } = await supabaseClient.rpc(
      "upsert_member_workout_log",
      {
        p_id: log.id,
        p_member_id: memberId,
        p_owner_user_id: ownerUserId.trim(),
        p_program_title: log.programTitle,
        p_date: log.date,
        p_status: log.status,
        p_note: serializedNote,
        p_results: log.results ?? [],
      },
      { signal: controller.signal },
    );
    if (error) {
      if (isMissingMemberWorkoutRpcError(error.message)) return null;
      const aborted = error.message?.toLowerCase().includes("abort");
      if (aborted) return { ok: false, message: "RPC svarte ikke i tide." };
      return { ok: false, message: error.message };
    }
    const payload = (data ?? null) as { ok?: boolean; error?: string } | null;
    if (payload?.ok === true) return { ok: true };
    if (payload?.error) return { ok: false, message: payload.error };
    return { ok: false, message: "Kunne ikke lagre økten via RPC." };
  } catch (fetchErr) {
    const aborted = fetchErr instanceof Error && fetchErr.name === "AbortError";
    if (aborted) return { ok: false, message: "RPC svarte ikke i tide." };
    return { ok: false, message: fetchErr instanceof Error ? fetchErr.message : "RPC feilet." };
  } finally {
    window.clearTimeout(abortId);
  }
}

async function persistWorkoutLogViaMemberRpc(
  log: WorkoutLog,
  memberId: string,
  ownerUserId: string,
): Promise<PersistResult | null> {
  return persistWorkoutLogViaMemberRpcInner(log, memberId, ownerUserId);
}

function pickMemberWorkoutPersistFailureMessage(results: PersistResult[]): string {
  const sqlHint = " Kjør member_workout_log_save_setup.sql i Supabase SQL Editor.";
  const rls = results.find((item) => /policy|permission|row-level security/i.test(item.message ?? ""));
  if (rls?.message) return rls.message + sqlHint;

  const access = results.find((item) => /ikke tilgang|not authorized|403|404|fant ikke medlem/i.test(item.message ?? ""));
  if (access?.message) return access.message + sqlHint;

  const parts = results
    .map((item) => item.message?.trim())
    .filter(
      (message) =>
        message &&
        !/^(__direct_timeout__|rpc ikke tilgjengelig)$/i.test(message) &&
        !/lagring tok for lang tid/i.test(message),
    );
  if (parts.length) return parts.join(" · ");

  const timedOut = results.some((item) =>
    /lagring tok for lang tid|__direct_timeout__|__edge_fetch_timeout__|svarte ikke i tide/i.test(item.message ?? ""),
  );
  if (timedOut) {
    const detail = results
      .map((item) => item.message?.trim())
      .filter((message) => message && !/^(__direct_timeout__|__edge_fetch_timeout__)$/i.test(message))
      .join(" · ");
    return `Skyen svarer ikke i tide. Sjekk nettverk og prøv igjen.${detail ? ` (${detail})` : ""}`;
  }

  return `Lagring feilet.${parts.length ? ` ${parts.join(" · ")}` : ""} Logg ut og inn igjen, eller kontakt PT.`;
}

type WorkoutLogAuthContext = {
  sessionUser: {
    id?: string;
    email?: string | null;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  } | null;
  accessToken: string;
  requesterUserId: string;
  sessionEmail: string;
  sessionRole: ReturnType<typeof resolveSessionAuthRole> | null;
};

async function getWorkoutLogAuthContext(hints?: PersistWorkoutLogHints): Promise<WorkoutLogAuthContext> {
  const empty: WorkoutLogAuthContext = {
    sessionUser: null,
    accessToken: "",
    requesterUserId: "",
    sessionEmail: "",
    sessionRole: null,
  };
  if (!supabaseClient) return empty;

  const prefetched = String(hints?.accessToken ?? "").trim();
  if (prefetched) {
    const claims = decodeAccessTokenClaims(prefetched);
    return {
      sessionUser: claims.sub ? { id: claims.sub, email: claims.email || hints?.targetEmail } : null,
      accessToken: prefetched,
      requesterUserId: claims.sub,
      sessionEmail: claims.email || String(hints?.targetEmail ?? "").trim().toLowerCase(),
      sessionRole: null,
    };
  }

  const { data } = await promiseWithTimeout(
    supabaseClient.auth.getSession(),
    WORKOUT_LOG_AUTH_TIMEOUT_MS,
    { data: { session: null } },
  );
  const session = data.session;
  const sessionUser = session?.user ?? null;
  const accessToken = session?.access_token ?? "";
  const requesterUserId = String(sessionUser?.id ?? "").trim();
  const sessionEmail = String(sessionUser?.email ?? "").trim().toLowerCase();
  const sessionRole = sessionUser
    ? resolveSessionAuthRole({
        email: sessionUser.email,
        app_metadata: sessionUser.app_metadata as Record<string, unknown> | undefined,
        user_metadata: sessionUser.user_metadata as Record<string, unknown> | undefined,
      })
    : null;

  return { sessionUser, accessToken, requesterUserId, sessionEmail, sessionRole };
}

async function persistIntervalWorkoutLog(log: WorkoutLog, hints: PersistWorkoutLogHints): Promise<PersistResult> {
  return persistIntervalWorkoutLogInner(log, hints);
}

function pickWorkoutLogOwnerFromHints(
  hints: PersistWorkoutLogHints,
  requesterUserId: string,
): string | null {
  return pickWorkoutLogOwnerCandidate(String(hints.ownerUserId ?? ""), requesterUserId);
}

async function persistIntervalWorkoutLogInner(log: WorkoutLog, hints: PersistWorkoutLogHints): Promise<PersistResult> {
  const ctx = await getWorkoutLogAuthContext(hints);
  if (!ctx.accessToken) {
    return { ok: false, message: "Sesjonen utløp. Logg ut og inn igjen, og prøv å lagre på nytt." };
  }

  const memberId = log.memberId.trim();
  if (!memberId) {
    return { ok: false, message: "Mangler medlems-ID for økten." };
  }

  const persistenceHints: PersistWorkoutLogHints = {
    ...hints,
    programTitle: hints.programTitle ?? log.programTitle,
  };
  let ownerUserId = pickWorkoutLogOwnerFromHints(persistenceHints, ctx.requesterUserId);
  if (!ownerUserId) {
    ownerUserId = await promiseWithTimeout(
      resolveWorkoutLogOwnerUserId(memberId, persistenceHints, ctx.requesterUserId),
      3_000,
      null,
    );
  }
  if (ownerUserId === ctx.requesterUserId) {
    ownerUserId = null;
  }

  return persistIntervalWorkoutLogFast(
    { ...log, memberId },
    memberId,
    ownerUserId ?? "",
    ctx.accessToken,
    persistenceHints,
    ctx.sessionUser,
  );
}

/** Intervalløkt: én edge-kall først (tjenesterolle), deretter RPC — unngår hengende parallelle kall. */
async function persistIntervalWorkoutLogFast(
  log: WorkoutLog,
  memberId: string,
  ownerUserId: string,
  accessToken: string,
  hints: PersistWorkoutLogHints,
  sessionUser: WorkoutLogAuthContext["sessionUser"],
): Promise<PersistResult> {
  const serializedNote = serializeWorkoutNote(log);
  const edgeBody: Record<string, unknown> = {
    id: log.id,
    memberId,
    programTitle: log.programTitle,
    date: log.date,
    status: log.status,
    note: serializedNote,
    results: log.results ?? [],
  };
  if (ownerUserId && isUuidString(ownerUserId)) {
    edgeBody.ownerUserId = ownerUserId;
  }
  const failures: PersistResult[] = [];

  let rpcMemberId = memberId;
  if (memberId.startsWith("auth-")) {
    rpcMemberId = await promiseWithTimeout(
      resolveCanonicalMemberIdForPersistence(memberId, hints, sessionUser),
      3_000,
      memberId,
    );
  }
  const rpcOwner =
    ownerUserId && isUuidString(ownerUserId)
      ? ownerUserId
      : await promiseWithTimeout(
          resolveWorkoutLogOwnerUserId(rpcMemberId, { programTitle: log.programTitle, ownerUserId }, ""),
          3_000,
          null,
        );

  if (rpcMemberId && !rpcMemberId.startsWith("auth-") && rpcOwner && isUuidString(rpcOwner)) {
    const rpc = await persistWorkoutLogViaMemberRpc(log, rpcMemberId, rpcOwner);
    if (rpc?.ok) return rpc;
    if (rpc) failures.push(rpc);

    const direct = await promiseWithTimeout(
      persistWorkoutLogDirectForMember(log, rpcMemberId, rpcOwner),
      WORKOUT_LOG_INTERVAL_DIRECT_TIMEOUT_MS,
      { ok: false, message: "__direct_timeout__" },
    );
    if (direct.ok) return direct;
    if (direct.message && !direct.message.includes("__direct_timeout__")) {
      failures.push(direct);
    }
  }

  if (supabaseUrl && supabaseAnonKey) {
    const edge = await promiseWithTimeout(
      invokePersistWorkoutLogEdgeFetch(edgeBody, accessToken),
      WORKOUT_LOG_INTERVAL_EDGE_TIMEOUT_MS,
      { ok: false, message: "__edge_fetch_timeout__" },
    );
    if (edge.ok) return edge;
    if (edge.message && !edge.message.includes("__edge_fetch_timeout__")) {
      console.warn("persist-interval edge failed:", edge.message);
    }
    failures.push(edge);
  }

  if (!failures.length) {
    failures.push({
      ok: false,
      message: rpcMemberId.startsWith("auth-")
        ? "Fant ikke medlemsprofil i skyen. Logg ut og inn igjen."
        : "Fant ikke PT-eier for programmet. Oppdater siden og prøv igjen.",
    });
  }

  const message = pickMemberWorkoutPersistFailureMessage(failures);
  console.warn("persist-interval all paths failed:", message, { memberId, ownerUserId, failures });
  return { ok: false, message };
}

async function raceMemberWorkoutLogPersist(
  log: WorkoutLog,
  memberId: string,
  ownerUserId: string,
  accessToken: string,
): Promise<PersistResult> {
  const serializedNote = serializeWorkoutNote(log);
  const edgeBody = {
    id: log.id,
    memberId,
    programTitle: log.programTitle,
    date: log.date,
    status: log.status,
    note: serializedNote,
    results: log.results ?? [],
    ownerUserId,
  };

  return new Promise((resolve) => {
    const failures: PersistResult[] = [];
    let pending = 3;
    let settled = false;

    const finishFailure = () => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, message: pickMemberWorkoutPersistFailureMessage(failures) });
    };

    const overallTimer = window.setTimeout(finishFailure, WORKOUT_LOG_MEMBER_RACE_TIMEOUT_MS);

    const onSuccess = (result: PersistResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(overallTimer);
      resolve(result);
    };

    const onFailure = (result: PersistResult) => {
      failures.push(result);
      pending -= 1;
      if (pending <= 0) finishFailure();
    };

    void invokePersistWorkoutLogEdge(edgeBody, accessToken)
      .then((result) => (result.ok ? onSuccess(result) : onFailure(result)))
      .catch((error) =>
        onFailure({
          ok: false,
          message: error instanceof Error ? error.message : "Edge-lagring feilet.",
        }),
      );

    void promiseWithTimeout(
      persistWorkoutLogDirectForMember(log, memberId, ownerUserId),
      WORKOUT_LOG_DIRECT_TIMEOUT_MS,
      { ok: false, message: "__direct_timeout__" },
    )
      .then((result) => (result.ok ? onSuccess(result) : onFailure(result)))
      .catch((error) =>
        onFailure({
          ok: false,
          message: error instanceof Error ? error.message : "Direkte lagring feilet.",
        }),
      );

    void promiseWithTimeout(persistWorkoutLogViaMemberRpc(log, memberId, ownerUserId), WORKOUT_LOG_RPC_TIMEOUT_MS, null)
      .then((result) => {
        if (result?.ok) {
          onSuccess(result);
          return;
        }
        onFailure(result ?? { ok: false, message: "RPC ikke tilgjengelig." });
      })
      .catch((error) =>
        onFailure({
          ok: false,
          message: error instanceof Error ? error.message : "RPC-lagring feilet.",
        }),
      );
  });
}

async function persistWorkoutLogDirectForMember(
  log: WorkoutLog,
  memberId: string,
  ownerUserId: string,
): Promise<PersistResult> {
  if (!supabaseClient || !ownerUserId.trim() || !memberId.trim()) {
    return { ok: false, message: "Mangler data for direkte lagring." };
  }
  const serializedNote = serializeWorkoutNote(log);
  const { error } = await supabaseClient.from("workout_logs").upsert(
    {
      id: log.id,
      member_id: memberId,
      owner_user_id: ownerUserId.trim(),
      program_title: log.programTitle,
      date: log.date,
      status: log.status,
      note: serializedNote,
      results: log.results ?? [],
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    const hint = /policy|permission|row-level security/i.test(error.message)
      ? " Kjør workout_logs_member_insert_rls.sql og upsert_member_workout_log_rpc.sql i Supabase."
      : "";
    return { ok: false, message: error.message + hint };
  }
  return { ok: true };
}

function parsePersistWorkoutLogEdgePayload(payload: unknown): PersistResult {
  const parsed = (payload ?? null) as { ok?: boolean; error?: string } | null;
  if (parsed?.ok === true) return { ok: true };
  const message = String(parsed?.error ?? "").trim();
  if (message) return { ok: false, message };
  return { ok: false, message: "persist-workout-log returnerte ikke ok." };
}

async function invokePersistWorkoutLogEdge(
  body: Record<string, unknown>,
  accessToken: string,
): Promise<PersistResult> {
  if (!accessToken) {
    return { ok: false, message: "Sesjonen utløp. Logg ut og inn igjen." };
  }

  if (supabaseUrl && supabaseAnonKey) {
    const fetched = await promiseWithTimeout(
      invokePersistWorkoutLogEdgeFetch(body, accessToken),
      WORKOUT_LOG_EDGE_TIMEOUT_MS,
      { ok: false, message: "__edge_fetch_timeout__" },
    );
    if (fetched.ok) return fetched;
    if (fetched.message && !fetched.message.includes("__edge_fetch_timeout__")) {
      return fetched;
    }
  }

  if (supabaseClient) {
    const invoked = await promiseWithTimeout(
      supabaseClient.functions.invoke("persist-workout-log", { body }),
      WORKOUT_LOG_EDGE_TIMEOUT_MS,
      { data: null, error: { message: "__edge_invoke_timeout__" } },
    );
    if (!invoked.error && invoked.data != null) {
      return parsePersistWorkoutLogEdgePayload(invoked.data);
    }
    const invokeMessage = String((invoked.error as { message?: string } | null)?.message ?? "").trim();
    if (invokeMessage && !invokeMessage.includes("__edge_invoke_timeout__")) {
      return { ok: false, message: invokeMessage };
    }
  }

  return { ok: false, message: "Kunne ikke lagre økten i skyen (mangler nettverk eller tilgang)." };
}

async function invokePersistWorkoutLogEdgeFetch(
  body: Record<string, unknown>,
  accessToken: string,
): Promise<PersistResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), WORKOUT_LOG_EDGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/persist-workout-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey!,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (response.ok) {
      const parsed = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : null;
      if (parsed?.ok === true) return { ok: true };
      return { ok: false, message: parsed?.error ?? "persist-workout-log returnerte ikke ok." };
    }
    return { ok: false, message: raw.slice(0, 220) || `HTTP ${response.status} fra persist-workout-log` };
  } catch (fetchErr) {
    const aborted = fetchErr instanceof Error && fetchErr.name === "AbortError";
    if (aborted) {
      return { ok: false, message: "Lagring tok for lang tid. Sjekk nettverk og prøv igjen." };
    }
    console.warn("persist-workout-log HTTP failed:", fetchErr);
    return { ok: false, message: "Kunne ikke nå lagringstjenesten. Sjekk nettverk og prøv igjen." };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function persistWorkoutLogInner(log: WorkoutLog, hints?: PersistWorkoutLogHints): Promise<PersistResult> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };

  const ctx = await getWorkoutLogAuthContext();
  const sessionUser = ctx.sessionUser;
  const sessionRole = ctx.sessionRole;
  const requesterUserId = ctx.requesterUserId;
  const accessToken = ctx.accessToken;
  const sessionEmail = hints?.targetEmail?.trim().toLowerCase() || ctx.sessionEmail;

  const memberId = await resolveCanonicalMemberIdForPersistence(log.memberId, hints, sessionUser);
  if (memberId.startsWith("auth-") && sessionEmail.includes("@")) {
    await promiseWithTimeout(
      ensureMemberAuthLink(sessionEmail, memberId || log.memberId),
      5_000,
      undefined,
    );
  }

  const persistenceHints: PersistWorkoutLogHints = {
    ...hints,
    programTitle: hints?.programTitle ?? log.programTitle,
  };

  if (sessionRole === "member") {
    const ownerUserId = await resolveWorkoutLogOwnerUserId(memberId, persistenceHints, requesterUserId);
    if (!ownerUserId) {
      return { ok: false, message: "Kunne ikke finne trener for økten. Oppdater siden og prøv igjen." };
    }
    return raceMemberWorkoutLogPersist(log, memberId, ownerUserId, accessToken);
  }

  const ownerUserId =
    (await resolveWorkoutLogOwnerUserId(memberId, persistenceHints, requesterUserId)) ??
    (await resolveOwnerUserIdForMember(memberId, requesterUserId || (await getOwnerUserId())));
  if (!ownerUserId) {
    return { ok: false, message: "Kunne ikke finne PT-eier for økten. Kontakt treneren din." };
  }

  const serializedNote = serializeWorkoutNote(log);
  const direct = await persistWorkoutLogDirectForMember(log, memberId, ownerUserId);
  if (direct.ok) return direct;

  const edgeResult = await invokePersistWorkoutLogEdge(
    {
      id: log.id,
      memberId,
      programTitle: log.programTitle,
      date: log.date,
      status: log.status,
      note: serializedNote,
      results: log.results ?? [],
      ownerUserId,
    },
    accessToken,
  );
  if (edgeResult.ok) return edgeResult;
  return direct;
}

async function persistWorkoutLog(log: WorkoutLog, hints?: PersistWorkoutLogHints): Promise<PersistResult> {
  const result = await promiseWithTimeout(
    persistWorkoutLogInner(log, hints),
    WORKOUT_LOG_TOTAL_TIMEOUT_MS,
    { ok: false, message: "Lagring tok for lang tid. Trekk ned for å oppdatere appen og prøv igjen." },
  );
  if (result.ok) markWorkoutLogSeenInRemote(log.id);
  return result;
}

async function deleteLogsForProgram(memberId: string, programTitle: string) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from("workout_logs")
    .delete()
    .eq("member_id", memberId)
    .eq("program_title", programTitle);
  if (error) {
    console.warn("Supabase log cleanup failed:", error.message);
  }
}

async function deleteGroupWorkoutLogs(input: RemoveGroupWorkoutLogInput) {
  if (!supabaseClient) return;
  const memberId = input.memberId.trim();
  const className = input.className.trim();
  const date = input.date?.trim() ? normalizeStoredLogDate(input.date) : "";
  if (!memberId || !className) return;
  let query = supabaseClient
    .from("workout_logs")
    .delete()
    .eq("member_id", memberId)
    .eq("program_title", `Gruppetime: ${className}`);
  if (date) {
    query = query.eq("date", date);
  }
  const { error } = await query;
  if (error) {
    console.warn("Supabase group workout log delete failed:", error.message);
  }
}

async function deleteCompletedPlanEntryLogs(input: RemoveCompletedPlanEntryLogInput) {
  if (!supabaseClient) return;
  const memberId = input.memberId.trim();
  const programTitle = input.programTitle.trim();
  const date = input.date?.trim() ? normalizeStoredLogDate(input.date) : "";
  if (!memberId || !programTitle) return;
  let query = supabaseClient.from("workout_logs").delete().eq("member_id", memberId).eq("program_title", programTitle);
  if (date) {
    query = query.eq("date", date);
  }
  const { error } = await query;
  if (error) {
    console.warn("Supabase plan entry log delete failed:", error.message);
  }
}

async function deleteWorkoutLogById(logId: string) {
  if (!supabaseClient) return;
  const trimmed = logId.trim();
  if (!trimmed) return;
  const { error } = await supabaseClient.from("workout_logs").delete().eq("id", trimmed);
  if (error) {
    console.warn("Supabase workout log delete failed:", error.message);
  }
}

function mapIsoToCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatDateTimeDdMmYyyy(new Date());
  return formatDateTimeDdMmYyyy(date);
}

function mapIsoToProgramDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return formatDateDdMmYyyy(new Date());
  }
  return formatDateDdMmYyyy(date);
}

const WORKOUT_REFLECTION_PREFIX = "__MOTUS_REFLECTION__";

function serializeWorkoutNote(
  log: Pick<
    WorkoutLog,
    | "note"
    | "reflection"
    | "trainerComment"
    | "trainerCommentUpdatedAt"
    | "trainerCommentAuthorName"
    | "activityDurationMinutes"
    | "activityPhotoUrl"
  >,
): string {
  const cleanNote = log.note.trim();
  const cleanTrainerComment = String(log.trainerComment ?? "").trim();
  const activityDuration = String(log.activityDurationMinutes ?? "").trim();
  const activityPhoto = String(log.activityPhotoUrl ?? "").trim();
  if (!log.reflection && !cleanTrainerComment && !activityDuration && !activityPhoto) return cleanNote;
  const payload = JSON.stringify({
    ...(log.reflection ? { reflection: log.reflection } : {}),
    ...(activityDuration || activityPhoto
      ? {
          activityMeta: {
            ...(activityDuration ? { durationMinutes: activityDuration } : {}),
            ...(activityPhoto ? { photoUrl: activityPhoto } : {}),
          },
        }
      : {}),
    ...(cleanTrainerComment
      ? {
          trainerComment: cleanTrainerComment,
          trainerCommentUpdatedAt: String(log.trainerCommentUpdatedAt ?? "").trim() || new Date().toISOString(),
          trainerCommentAuthorName: String(log.trainerCommentAuthorName ?? "").trim(),
        }
      : {}),
  });
  return `${WORKOUT_REFLECTION_PREFIX}${payload}\n${cleanNote}`;
}

function isWorkoutReflectionPayload(value: unknown): value is NonNullable<WorkoutLog["reflection"]> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.energyLevel === "number" &&
    typeof candidate.difficultyLevel === "number" &&
    typeof candidate.motivationLevel === "number"
  );
}

function parseActivityMetaFromEnvelope(
  envelope: Record<string, unknown>,
): Pick<WorkoutLog, "activityDurationMinutes" | "activityPhotoUrl"> {
  const raw = envelope.activityMeta;
  if (!raw || typeof raw !== "object") return {};
  const meta = raw as Record<string, unknown>;
  const durationMinutes = String(meta.durationMinutes ?? "").trim();
  const photoUrl = String(meta.photoUrl ?? "").trim();
  return {
    ...(durationMinutes ? { activityDurationMinutes: durationMinutes } : {}),
    ...(photoUrl ? { activityPhotoUrl: photoUrl } : {}),
  };
}

function parseWorkoutNote(
  rawNote: unknown,
): Pick<
  WorkoutLog,
  | "note"
  | "reflection"
  | "trainerComment"
  | "trainerCommentUpdatedAt"
  | "trainerCommentAuthorName"
  | "activityDurationMinutes"
  | "activityPhotoUrl"
> {
  const note = String(rawNote ?? "");
  if (!note.startsWith(WORKOUT_REFLECTION_PREFIX)) return { note };
  const newlineIndex = note.indexOf("\n");
  const payload = newlineIndex >= 0 ? note.slice(WORKOUT_REFLECTION_PREFIX.length, newlineIndex) : note.slice(WORKOUT_REFLECTION_PREFIX.length);
  const plainNote = newlineIndex >= 0 ? note.slice(newlineIndex + 1) : "";
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (isWorkoutReflectionPayload(parsed)) {
      return { note: plainNote, reflection: parsed };
    }
    if (!parsed || typeof parsed !== "object") return { note: plainNote };
    const envelope = parsed as Record<string, unknown>;
    const reflection = isWorkoutReflectionPayload(envelope.reflection) ? envelope.reflection : undefined;
    const trainerComment = String(envelope.trainerComment ?? "").trim();
    const trainerCommentUpdatedAt = String(envelope.trainerCommentUpdatedAt ?? "").trim();
    const trainerCommentAuthorName = String(envelope.trainerCommentAuthorName ?? "").trim();
    return {
      note: plainNote,
      reflection,
      ...parseActivityMetaFromEnvelope(envelope),
      trainerComment: trainerComment || undefined,
      trainerCommentUpdatedAt: trainerCommentUpdatedAt || undefined,
      trainerCommentAuthorName: trainerCommentAuthorName || undefined,
    };
  } catch {
    return { note: plainNote };
  }
}

export type HydratedTrainerData = {
  members: Member[];
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  exercises: Exercise[];
  /** Synket periodeplan per medlem (Supabase). */
  periodPlansByMemberId: Record<string, PeriodSchedulePlan[]>;
  debug: HydratedTrainerDebug | null;
};

export type HydratedTrainerDebug = {
  status?: "ok" | "invoke_error" | "invalid_payload";
  message?: string;
  ownerUserId: string;
  ownedMemberIds: string[];
  memberIdsFromMembersQuery: string[];
  logMemberIdsByOwnerQuery: string[];
  logMemberIdsByMemberQuery: string[];
  logIdsByOwnerQuery: string[];
  logIdsByMemberQuery: string[];
  mergedLogIds: string[];
  counts: {
    members: number;
    programsByOwner: number;
    programsByMember: number;
    logsByOwner: number;
    logsByMember: number;
    mergedLogs: number;
    messagesByOwner: number;
    messagesByMember: number;
    mergedMessages: number;
  };
  generatedAt: string;
};

export type MemberAccessDenied = {
  code: "member_archived";
  message: string;
};

export type HydratedMemberData = {
  members: Member[];
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  periodPlanRows: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  mealPlans: MealPlan[];
  mealPlanStates: Array<{ memberId: string; state: MemberMealPlanState }>;
  exercises: Exercise[];
  inspirationItems: unknown[];
  accessDenied?: MemberAccessDenied;
};

const EMPTY_HYDRATED_MEMBER_DATA: HydratedMemberData = {
  members: [],
  messages: [],
  programs: [],
  logs: [],
  periodPlanRows: [],
  mealPlans: [],
  mealPlanStates: [],
  exercises: [],
  inspirationItems: [],
};

function memberArchivedHydratePayload(message: string): HydratedMemberData {
  return {
    ...EMPTY_HYDRATED_MEMBER_DATA,
    accessDenied: { code: "member_archived", message },
  };
}

function parseMemberArchivedHydrateBody(body: Record<string, unknown>): HydratedMemberData | null {
  if (body.error !== "member_archived") return null;
  const message = String(body.message ?? "").trim();
  return memberArchivedHydratePayload(message || MEMBER_ARCHIVED_APP_MESSAGE);
}

function trainingProgramFromHydrateRow(program: Record<string, unknown>): TrainingProgram {
  const rawBy = String(program.program_created_by ?? "").trim();
  const programCreatedBy = rawBy === "member" || rawBy === "trainer" ? (rawBy as "member" | "trainer") : undefined;
  const programCreatedByName = String(program.program_created_by_name ?? "").trim();
  const ownerUserId = String(program.owner_user_id ?? "").trim();
  const rawLibrary = String(program.member_library_status ?? "").trim().toLowerCase();
  const memberLibraryStatus: MemberProgramLibraryStatus | undefined =
    rawLibrary === "hidden" || rawLibrary === "archived" ? "archived" : undefined;
  const imageUrl = String(program.image_url ?? "").trim();
  return enrichProgramWithActivityTemplateKind({
    id: String(program.id ?? ""),
    memberId: String(program.member_id ?? ""),
    title: String(program.title ?? ""),
    goal: String(program.goal ?? ""),
    notes: String(program.notes ?? ""),
    createdAt: mapIsoToProgramDate(String(program.created_at ?? "")),
    exercises: Array.isArray(program.exercises) ? (program.exercises as ProgramExercise[]) : [],
    assignedTrainerName: String(program.assigned_trainer_name ?? "").trim(),
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(programCreatedBy
      ? { programCreatedBy, programCreatedByName: programCreatedByName || undefined }
      : {}),
    ...(memberLibraryStatus ? { memberLibraryStatus } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  });
}

function mapHydrateMemberPayload(payload: Record<string, unknown>): HydratedMemberData {
  const archived = parseMemberArchivedHydrateBody(payload);
  if (archived) return archived;

  const membersRows = Array.isArray(payload.members) ? payload.members : [];
  const messagesRows = Array.isArray(payload.messages) ? payload.messages : [];
  const programsRows = Array.isArray(payload.programs) ? payload.programs : [];
  const logsRows = Array.isArray(payload.logs) ? payload.logs : [];
  const exercisesRows = Array.isArray(payload.exercises) ? payload.exercises : [];
  const periodPlansRaw = Array.isArray(payload.periodPlans) ? payload.periodPlans : [];
  const periodPlanRows: Array<{ memberId: string; plan: PeriodSchedulePlan }> = [];
  for (const row of periodPlansRaw) {
    const r = row as Record<string, unknown>;
    const memberId = String(r.member_id ?? "").trim();
    const plan = parsePeriodSchedulePlan(r.plan);
    if (memberId && plan) {
      periodPlanRows.push({ memberId, plan });
    }
  }

  const mealPlansRaw = Array.isArray(payload.mealPlans) ? payload.mealPlans : [];
  const mealPlans: MealPlan[] = [];
  for (const row of mealPlansRaw) {
    const r = row as Record<string, unknown>;
    const memberId = String(r.member_id ?? "").trim();
    if (!memberId) continue;
    const plan = mealPlanFromRow(memberId, r);
    if (plan.days.length) mealPlans.push(plan);
  }

  const mealPlanStatesRaw = Array.isArray(payload.mealPlanStates) ? payload.mealPlanStates : [];
  const mealPlanStates: Array<{ memberId: string; state: MemberMealPlanState }> = [];
  for (const row of mealPlanStatesRaw) {
    const r = row as Record<string, unknown>;
    const memberId = String(r.member_id ?? "").trim();
    if (!memberId) continue;
    const parsed = parseMemberMealPlanState(r.state);
    if (typeof r.updated_at === "string") parsed.updatedAt = r.updated_at;
    mealPlanStates.push({ memberId, state: parsed });
  }

  return {
    members: membersRows.map((row) => {
      const member = row as Record<string, unknown>;
      return {
        id: String(member.id ?? ""),
        ownerUserId: String(member.owner_user_id ?? ""),
        assignedTrainerName: String(member.assigned_trainer_name ?? "").trim(),
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        isActive: member.is_active !== false,
        invitedAt: String(member.invited_at ?? ""),
        firstLoginAt: String(member.first_login_at ?? ""),
        phone: String(member.phone ?? ""),
        birthDate: String(member.birth_date ?? ""),
        gender: normalizeMemberGender(member.gender),
        weight: String(member.weight ?? ""),
        height: String(member.height ?? ""),
        level: member.level === "Litt øvet" || member.level === "Øvet" ? member.level : "Nybegynner",
        membershipType: mapMembershipType(member.membership_type),
        customerType: mapCustomerType(member.customer_type),
        nutritionAccess: member.nutrition_access === true,
        daysSinceActivity: String(member.days_since_activity ?? "0"),
        goal: String(member.goal ?? ""),
        focus: String(member.focus ?? ""),
        personalGoals: String(member.personal_goals ?? ""),
        injuries: String(member.injuries ?? ""),
        coachNotes: String(member.coach_notes ?? ""),
        avatarUrl: String(member.avatar_url ?? ""),
      } as Member;
    }),
    messages: messagesRows.map((row) => chatMessageFromRow(row as Record<string, unknown>)),
    programs: programsRows.map((row) => trainingProgramFromHydrateRow(row as Record<string, unknown>)),
    logs: logsRows.map((row) => {
      const log = row as Record<string, unknown>;
      const parsedNote = parseWorkoutNote(log.note);
      return {
        id: String(log.id ?? ""),
        memberId: String(log.member_id ?? ""),
        programTitle: String(log.program_title ?? ""),
        date: String(log.date ?? ""),
        status: log.status === "Planlagt" ? "Planlagt" : "Fullført",
        note: parsedNote.note,
        reflection: parsedNote.reflection,
        activityDurationMinutes: parsedNote.activityDurationMinutes,
        activityPhotoUrl: parsedNote.activityPhotoUrl,
        trainerComment: parsedNote.trainerComment,
        trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
        trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
        results: Array.isArray(log.results) ? (log.results as WorkoutExerciseResult[]) : undefined,
      } as WorkoutLog;
    }),
    periodPlanRows,
    mealPlans,
    mealPlanStates,
    inspirationItems: Array.isArray(payload.inspirationItems) ? payload.inspirationItems : [],
    exercises: exercisesRows.map((row) => mapExerciseBankRow(row as Record<string, unknown>)),
  };
}

export async function fetchHydratedTrainerData(ownerUserId: string): Promise<HydratedTrainerData | null> {
  if (!supabaseClient) return null;
  if (!ownerUserId) return null;

  const { data, error } = await supabaseClient.functions.invoke("hydrate-trainer-data", {
    body: { ownerUserId, includeDebug: true },
  });
    if (error) {
      console.warn("hydrate-trainer-data invoke failed:", error.message);
    let fallbackMessage = error.message;
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const {
          data: { session },
        } = await supabaseClient.auth.getSession();
        const response = await fetch(`${supabaseUrl}/functions/v1/hydrate-trainer-data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ ownerUserId, includeDebug: true }),
        });
        const raw = await response.text();
        let parsed: { error?: string; message?: string } | null = null;
        try {
          parsed = raw ? (JSON.parse(raw) as { error?: string; message?: string }) : null;
        } catch {
          parsed = null;
        }
        const detail = parsed?.error || parsed?.message || raw || "No body";
        fallbackMessage = `HTTP ${response.status}: ${detail}`;
      } catch (fetchError) {
        fallbackMessage = `${error.message} (fallback fetch feilet: ${String(fetchError)})`;
      }
    }
    return {
      members: [],
      messages: [],
      programs: [],
      logs: [],
      exercises: [],
      periodPlansByMemberId: {},
      debug: {
        status: "invoke_error",
        message: fallbackMessage,
        ownerUserId,
        ownedMemberIds: [],
        memberIdsFromMembersQuery: [],
        logMemberIdsByOwnerQuery: [],
        logMemberIdsByMemberQuery: [],
        logIdsByOwnerQuery: [],
        logIdsByMemberQuery: [],
        mergedLogIds: [],
        counts: {
          members: 0,
          programsByOwner: 0,
          programsByMember: 0,
          logsByOwner: 0,
          logsByMember: 0,
          mergedLogs: 0,
          messagesByOwner: 0,
          messagesByMember: 0,
          mergedMessages: 0,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }
  if (!data || typeof data !== "object") {
    console.warn("hydrate-trainer-data returned invalid payload");
    return {
      members: [],
      messages: [],
      programs: [],
      logs: [],
      exercises: [],
      periodPlansByMemberId: {},
      debug: {
        status: "invalid_payload",
        message: "Function returned empty or non-object payload.",
        ownerUserId,
        ownedMemberIds: [],
        memberIdsFromMembersQuery: [],
        logMemberIdsByOwnerQuery: [],
        logMemberIdsByMemberQuery: [],
        logIdsByOwnerQuery: [],
        logIdsByMemberQuery: [],
        mergedLogIds: [],
        counts: {
          members: 0,
          programsByOwner: 0,
          programsByMember: 0,
          logsByOwner: 0,
          logsByMember: 0,
          mergedLogs: 0,
          messagesByOwner: 0,
          messagesByMember: 0,
          mergedMessages: 0,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }
  const payload = data as Record<string, unknown>;
  const membersRows = Array.isArray(payload.members) ? payload.members : [];
  const messagesRows = Array.isArray(payload.messages) ? payload.messages : [];
  const programsRows = Array.isArray(payload.programs) ? payload.programs : [];
  const logsRows = Array.isArray(payload.logs) ? payload.logs : [];
  const exercisesRows = Array.isArray(payload.exercises) ? payload.exercises : [];
  const periodPlanRowsRaw = Array.isArray(payload.periodPlans) ? payload.periodPlans : [];
  const periodPlansByMemberId = periodPlanRowsToByMemberId(
    periodPlanRowsRaw.map((row) => {
      const r = row as Record<string, unknown>;
      return { member_id: String(r.member_id ?? ""), plan: r.plan };
    }),
  );
  for (const memberRow of membersRows) {
    const memberId = String((memberRow as { id?: unknown }).id ?? "").trim();
    if (!memberId) continue;
    if (periodPlansByMemberId[memberId] === undefined) {
      periodPlansByMemberId[memberId] = [];
    }
  }
  const debugBase = payload.debug && typeof payload.debug === "object" ? (payload.debug as HydratedTrainerDebug) : null;
  const debug = debugBase
    ? {
        ...debugBase,
        status: debugBase.status ?? "ok",
      }
    : null;

  return {
    members: membersRows.map((row) => {
      const member = row as Record<string, unknown>;
      return {
        id: String(member.id ?? ""),
        ownerUserId: String(member.owner_user_id ?? ""),
        assignedTrainerName: String(member.assigned_trainer_name ?? "").trim(),
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        isActive: member.is_active !== false,
        invitedAt: String(member.invited_at ?? ""),
        firstLoginAt: String(member.first_login_at ?? ""),
        phone: String(member.phone ?? ""),
        birthDate: String(member.birth_date ?? ""),
        gender: normalizeMemberGender(member.gender),
        weight: String(member.weight ?? ""),
        height: String(member.height ?? ""),
        level: member.level === "Litt øvet" || member.level === "Øvet" ? member.level : "Nybegynner",
        membershipType: mapMembershipType(member.membership_type),
        customerType: mapCustomerType(member.customer_type),
        nutritionAccess: member.nutrition_access === true,
        daysSinceActivity: String(member.days_since_activity ?? "0"),
        goal: String(member.goal ?? ""),
        focus: String(member.focus ?? ""),
        personalGoals: String(member.personal_goals ?? ""),
        injuries: String(member.injuries ?? ""),
        coachNotes: String(member.coach_notes ?? ""),
        avatarUrl: String(member.avatar_url ?? ""),
      } as Member;
    }),
    messages: messagesRows.map((row) => chatMessageFromRow(row as Record<string, unknown>)),
    programs: programsRows.map((row) => trainingProgramFromHydrateRow(row as Record<string, unknown>)),
    logs: logsRows.map((row) => {
      const log = row as Record<string, unknown>;
      const parsedNote = parseWorkoutNote(log.note);
      return {
        id: String(log.id ?? ""),
        memberId: String(log.member_id ?? ""),
        programTitle: String(log.program_title ?? ""),
        date: String(log.date ?? ""),
        status: log.status === "Planlagt" ? "Planlagt" : "Fullført",
        note: parsedNote.note,
        reflection: parsedNote.reflection,
        activityDurationMinutes: parsedNote.activityDurationMinutes,
        activityPhotoUrl: parsedNote.activityPhotoUrl,
        trainerComment: parsedNote.trainerComment,
        trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
        trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
        results: Array.isArray(log.results) ? (log.results as WorkoutExerciseResult[]) : undefined,
      } as WorkoutLog;
    }),
    exercises: exercisesRows.map((row) => mapExerciseBankRow(row as Record<string, unknown>)),
    periodPlansByMemberId,
    debug,
  };
}

export async function fetchHydratedMemberData(): Promise<HydratedMemberData | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient.functions.invoke("hydrate-member-data");
  if (!error && data && typeof data === "object") {
    const mapped = mapHydrateMemberPayload(data as Record<string, unknown>);
    if (mapped.accessDenied) return mapped;
    return mapped;
  }

  if (error) {
    const errorContext = (error as { context?: Response }).context;
    if (errorContext) {
      try {
        const archivedBody = (await errorContext.clone().json()) as Record<string, unknown>;
        const archived = parseMemberArchivedHydrateBody(archivedBody);
        if (archived) return archived;
      } catch {
        // fall through to fetch fallback
      }
    }
    console.warn("hydrate-member-data invoke failed:", error.message);
  }

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/hydrate-member-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: "{}",
      });
      const raw = await response.text();
      if (!response.ok) {
        if (response.status === 403) {
          try {
            const archivedBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            const archived = parseMemberArchivedHydrateBody(archivedBody);
            if (archived) return archived;
          } catch {
            // fall through
          }
        }
        console.warn("hydrate-member-data fallback HTTP", response.status, raw.slice(0, 400));
        return null;
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        console.warn("hydrate-member-data fallback: invalid JSON");
        return null;
      }
      const archived = parseMemberArchivedHydrateBody(parsed);
      if (archived) return archived;
      if (typeof parsed.error === "string" && parsed.error && !Array.isArray(parsed.members)) {
        console.warn("hydrate-member-data fallback:", parsed.error);
        return null;
      }
      return mapHydrateMemberPayload(parsed);
    } catch (fetchErr) {
      console.warn("hydrate-member-data fallback fetch failed:", fetchErr);
    }
  }

  return null;
}

export async function fetchMessagesFromSupabase(): Promise<ChatMessage[] | null> {
  if (!supabaseClient) return null;

  const selectWithRead =
    "id, member_id, sender, text, created_at, read_by_member_at, read_by_trainer_at";
  const selectBase = "id, member_id, sender, text, created_at";

  let result = await supabaseClient.from("chat_messages").select(selectWithRead).order("created_at", { ascending: true });
  if (result.error?.message?.includes("read_by_")) {
    result = await supabaseClient.from("chat_messages").select(selectBase).order("created_at", { ascending: true });
  }

  if (result.error) {
    console.warn("Supabase messages fetch failed:", result.error.message);
    return null;
  }

  return (result.data ?? []).map((row) => chatMessageFromRow(row as Record<string, unknown>));
}

export async function fetchProgramsFromSupabase(): Promise<TrainingProgram[] | null> {
  if (!supabaseClient) return null;

  const selectWithImage =
    "id, member_id, title, goal, notes, exercises, created_at, member_library_status, owner_user_id, program_created_by, program_created_by_name, image_url";
  const selectWithoutImage =
    "id, member_id, title, goal, notes, exercises, created_at, member_library_status, owner_user_id, program_created_by, program_created_by_name";

  let result = await supabaseClient.from("training_programs").select(selectWithImage).order("created_at", { ascending: false });

  if (result.error && isTrainingProgramImageColumnDbError(result.error.message)) {
    result = await supabaseClient.from("training_programs").select(selectWithoutImage).order("created_at", { ascending: false });
  }

  if (result.error) {
    console.warn("Supabase programs fetch failed:", result.error.message);
    return null;
  }

  return (result.data ?? []).map((row) => trainingProgramFromHydrateRow(row as Record<string, unknown>));
}

export async function fetchLogsFromSupabase(): Promise<WorkoutLog[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase logs fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => {
    const parsedNote = parseWorkoutNote(row.note);
    return {
    id: String(row.id),
    memberId: String(row.member_id),
    programTitle: String(row.program_title ?? ""),
    date: String(row.date ?? ""),
    status: row.status === "Planlagt" ? "Planlagt" : "Fullført",
      note: parsedNote.note,
      reflection: parsedNote.reflection,
      activityDurationMinutes: parsedNote.activityDurationMinutes,
      activityPhotoUrl: parsedNote.activityPhotoUrl,
      trainerComment: parsedNote.trainerComment,
      trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
      trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
      results: Array.isArray(row.results) ? (row.results as WorkoutExerciseResult[]) : undefined,
    };
  });
}

type MembersQueryFilter =
  | { kind: "all" }
  | { kind: "id"; memberId: string }
  | { kind: "email"; email: string };

async function queryMemberRowsWithColumnFallback(
  filter: MembersQueryFilter,
): Promise<Record<string, unknown>[] | null> {
  if (!supabaseClient) return null;

  const runQuery = async (selectFields: string, orderByCreatedAt: boolean) => {
    let query = supabaseClient.from("members").select(selectFields);
    if (filter.kind === "id") {
      query = query.eq("id", filter.memberId.trim());
    } else if (filter.kind === "email") {
      query = query.ilike("email", filter.email.trim().toLowerCase());
    }
    if (orderByCreatedAt && filter.kind === "all") {
      query = query.order("created_at", { ascending: true });
    }
    return filter.kind === "id" ? query.maybeSingle() : query;
  };

  let selectFields = MEMBERS_SELECT_WITH_AVATAR;
  let orderByCreatedAt = filter.kind === "all";
  let result = await runQuery(selectFields, orderByCreatedAt);
  if (result.error && isMissingDbColumnError(result.error.message, "avatar_url")) {
    selectFields = MEMBERS_SELECT_WITH_AVATAR_WITHOUT_NUTRITION;
    result = await runQuery(selectFields, orderByCreatedAt);
  }
  if (result.error && isMissingDbColumnError(result.error.message, "nutrition_access")) {
    selectFields = selectFields.includes("avatar_url") ? MEMBERS_SELECT_WITH_AVATAR_WITHOUT_NUTRITION : MEMBERS_SELECT_WITHOUT_NUTRITION;
    result = await runQuery(selectFields, orderByCreatedAt);
  }
  if (result.error && isMissingDbColumnError(result.error.message, "first_login_at")) {
    selectFields = selectFields.replace(", first_login_at", "");
    result = await runQuery(selectFields, orderByCreatedAt);
  }
  if (result.error && isMissingDbColumnError(result.error.message, "gender")) {
    selectFields = selectFields.replace(", gender", "");
    result = await runQuery(selectFields, orderByCreatedAt);
  }
  if (result.error && isMissingDbColumnError(result.error.message, "avatar_url")) {
    selectFields = MEMBERS_SELECT_WITHOUT_NUTRITION;
    result = await runQuery(selectFields, orderByCreatedAt);
  }
  if (result.error && isMissingDbColumnError(result.error.message, "created_at")) {
    orderByCreatedAt = false;
    result = await runQuery(selectFields, orderByCreatedAt);
  }

  if (result.error) {
    console.warn("Supabase members fetch failed:", result.error.message);
    return null;
  }

  if (filter.kind === "id") {
    const row = result.data as Record<string, unknown> | null;
    return row ? [row] : [];
  }
  return (result.data ?? []) as Record<string, unknown>[];
}

export async function fetchMembersFromSupabase(): Promise<Member[] | null> {
  const rows = await queryMemberRowsWithColumnFallback({ kind: "all" });
  if (!rows) return null;
  return rows.map((row) => mapMemberRowFromSupabase(row));
}

export async function checkMemberAccessBlocked(email: string): Promise<boolean> {
  if (!supabaseClient) return false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return false;

  const parseArchived = (body: Record<string, unknown>) =>
    body.error === "member_archived" || body.status === "archived";

  try {
    const { data, error } = await supabaseClient.functions.invoke("check-member-access", {
      body: { email: normalizedEmail },
    });
    if (!error && data && typeof data === "object" && parseArchived(data as Record<string, unknown>)) {
      return true;
    }
    if (error) {
      const errorContext = (error as { context?: Response }).context;
      if (errorContext) {
        try {
          const body = (await errorContext.clone().json()) as Record<string, unknown>;
          if (parseArchived(body)) return true;
        } catch {
          // fall through
        }
      }
    }
  } catch {
    // fall through to fetch
  }

  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/check-member-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    if (response.status === 403) {
      try {
        const body = (await response.json()) as Record<string, unknown>;
        if (parseArchived(body)) return true;
      } catch {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

export async function archiveMemberByEmailFromSupabase(
  email: string,
  memberId?: string,
): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedMemberId = String(memberId ?? "").trim();
  if (!trimmedMemberId && (!normalizedEmail || !normalizedEmail.includes("@"))) {
    return { ok: false, message: "Mangler gyldig e-post for arkivering." };
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke("archive-member", {
      body: { email: normalizedEmail || undefined, memberId: trimmedMemberId || undefined },
    });
    if (!error) {
      const archivedCount = Number((data as { archivedCount?: number } | null)?.archivedCount ?? 0);
      if (archivedCount <= 0) {
        return { ok: false, message: "Fant ingen klient å arkivere i databasen." };
    }
      return { ok: true, message: "Klient arkivert i databasen." };
    }
    console.warn("archive-member invoke failed:", error.message);
  } catch (error) {
    console.warn("archive-member invoke threw:", error);
  }

  return { ok: false, message: "Kunne ikke arkivere i databasen. Deploy archive-member og prøv igjen." };
}

export type TrainerMemberLookupRow = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  ownerUserId: string;
  customerType: string;
  loginEmail?: string;
  emailMismatch?: boolean;
  linkedMemberEmail?: string;
};

async function invokeRestoreMemberFunction(body: Record<string, unknown>): Promise<{
  ok: boolean;
  data: Record<string, unknown> | null;
  errorMessage: string | null;
}> {
  if (!supabaseClient) {
    return { ok: false, data: null, errorMessage: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const { data, error } = await supabaseClient.functions.invoke("restore-member", { body });
  if (!error && data && typeof data === "object") {
    return { ok: true, data: data as Record<string, unknown>, errorMessage: null };
  }

  let errorMessage = error?.message ?? "restore-member feilet";
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/restore-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        parsed = null;
      }
      if (response.ok && parsed) {
        return { ok: true, data: parsed, errorMessage: null };
      }
      const detail = String(parsed?.error ?? parsed?.message ?? raw ?? response.status);
      errorMessage = `HTTP ${response.status}: ${detail}`;
    } catch (fetchError) {
      errorMessage = `${errorMessage} (${String(fetchError)})`;
    }
  }

  return { ok: false, data: null, errorMessage };
}

export async function lookupMembersByEmailForTrainer(
  email: string,
  ownerUserId?: string | null,
): Promise<{ ok: boolean; members: TrainerMemberLookupRow[]; message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    return { ok: false, members: [], message: "Ugyldig e-post." };
  }

  const trainerOwnerId = String(ownerUserId ?? (await getOwnerUserId()) ?? "").trim();
  const invoke = await invokeRestoreMemberFunction({
    email: normalizedEmail,
    ownerUserId: trainerOwnerId,
    lookupOnly: true,
  });
  if (!invoke.ok || !invoke.data) {
    return { ok: false, members: [], message: invoke.errorMessage ?? "Kunne ikke slå opp e-post i databasen." };
  }

  const members = Array.isArray(invoke.data.members)
    ? (invoke.data.members as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ""),
        email: String(row.email ?? normalizedEmail).trim().toLowerCase(),
        name: String(row.name ?? "").trim(),
        isActive: row.isActive !== false,
        ownerUserId: String(row.ownerUserId ?? "").trim(),
        customerType: String(row.customerType ?? "").trim(),
        loginEmail: String(row.loginEmail ?? normalizedEmail).trim().toLowerCase(),
        emailMismatch: row.emailMismatch === true,
        linkedMemberEmail: String(row.linkedMemberEmail ?? row.email ?? "").trim().toLowerCase(),
      }))
    : [];

  const responseMessage = typeof invoke.data.message === "string" ? invoke.data.message.trim() : "";

  return {
    ok: true,
    members,
    message: responseMessage
      ? responseMessage
      : members.length
        ? `Fant ${members.length} rad${members.length === 1 ? "" : "er"} i databasen.`
        : "Ingen rader i databasen for denne e-posten.",
  };
}

export type RestoreMemberOptions = {
  ownerUserId?: string | null;
  /** Overfør PT-kunde til innlogget trener (programmer, logger, chat). */
  claimForTrainer?: boolean;
};

export type TrainerRosterOption = {
  id: string;
  email: string;
  name: string;
};

export async function listTrainersForReassignFromSupabase(): Promise<{
  ok: boolean;
  trainers: TrainerRosterOption[];
  message: string;
}> {
  if (!supabaseClient) {
    return { ok: false, trainers: [], message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const accessToken = session?.access_token ?? "";
  if (!accessToken) {
    return { ok: false, trainers: [], message: "Du må være innlogget som trener." };
  }
  const { data, error } = await supabaseClient.functions.invoke("reassign-member-owner", {
    body: { listTrainersOnly: true, accessToken },
  });
  if (error) {
    return { ok: false, trainers: [], message: error.message || "Kunne ikke hente PT-liste." };
  }
  const trainers = Array.isArray((data as { trainers?: unknown })?.trainers)
    ? ((data as { trainers: TrainerRosterOption[] }).trainers ?? [])
    : [];
  return { ok: true, trainers, message: "" };
}

export async function reassignMemberOwnerFromSupabase(input: {
  memberId: string;
  targetOwnerUserId: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }
  const memberId = input.memberId.trim();
  const targetOwnerUserId = input.targetOwnerUserId.trim();
  if (!memberId || !targetOwnerUserId) {
    return { ok: false, message: "Velg kunde og mottaker-PT." };
  }
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const accessToken = session?.access_token ?? "";
  if (!accessToken) {
    return { ok: false, message: "Du må være innlogget som trener." };
  }
  const { data, error } = await supabaseClient.functions.invoke("reassign-member-owner", {
    body: { memberId, targetOwnerUserId, accessToken },
  });
  if (error) {
    return { ok: false, message: error.message || "Overføring feilet." };
  }
  const message = String((data as { message?: string })?.message ?? "").trim();
  if (!message) {
    return { ok: false, message: "Overføring feilet uten detaljer." };
  }
  return { ok: true, message };
}

export async function restoreMemberByEmailFromSupabase(
  email: string,
  options?: RestoreMemberOptions,
): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Skriv inn en gyldig e-post." };
  }

  const claimForTrainer = options?.claimForTrainer === true;
  const ownerUserId = String(options?.ownerUserId ?? (await getOwnerUserId()) ?? "").trim();
  if (claimForTrainer && !ownerUserId) {
    return { ok: false, message: "Kunne ikke identifisere PT-bruker. Logg ut og inn igjen." };
  }

  const invoke = await invokeRestoreMemberFunction({
    email: normalizedEmail,
    ownerUserId,
    claimForTrainer,
  });
  if (invoke.ok && invoke.data) {
    const restoredCount = Number(invoke.data.restoredCount ?? 0);
    const relinked = invoke.data.relinked === true;
    if (restoredCount <= 0 && !relinked) {
      return { ok: false, message: "Fant ingen klient med denne e-posten i databasen." };
    }
    const recreated = invoke.data.recreated === true;
    const claimed = invoke.data.claimedForTrainer === true;
    return {
      ok: true,
      message: relinked
        ? claimed
          ? "Klienten er koblet på nytt og knyttet til deg. Oppdaterer liste..."
          : "Klienten er koblet på nytt med riktig e-post. Oppdaterer liste..."
        : recreated
          ? "Klientrad opprettet på nytt og aktivert. Oppdaterer liste..."
          : claimed
            ? "Klienten er knyttet til deg. Oppdaterer liste..."
            : "Klient gjenopprettet. Oppdaterer liste...",
    };
  }

  console.warn("restore-member failed:", invoke.errorMessage);
  return {
    ok: false,
    message:
      invoke.errorMessage?.includes("404") || invoke.errorMessage?.toLowerCase().includes("ingen klient")
        ? "Fant ingen klient med denne e-posten i databasen. Sjekk staving, eller at kunden har logget inn minst én gang."
        : `Gjenoppretting feilet: ${invoke.errorMessage ?? "Ukjent feil"}. Deploy restore-member i Supabase og prøv igjen.`,
  };
}

function mapExerciseBankRow(row: Record<string, unknown>): Exercise {
  const category = normalizeStoredExerciseCategory(String(row.category ?? ""));
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    category,
    group: String(row.muscle_group ?? ""),
    equipment: String(row.equipment ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
    prescriptionFields:
      parsePrescriptionFieldsFromDb(row.prescription_fields) ?? prescriptionFieldsForExerciseSave(undefined, category),
    customField1Label: String(row.custom_field_1_label ?? ""),
    customField2Label: String(row.custom_field_2_label ?? ""),
  };
}

export async function fetchExercisesFromSupabase(): Promise<Exercise[] | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url, prescription_fields, custom_field_1_label, custom_field_2_label")
    .or("is_active.is.null,is_active.eq.true")
    .order("name", { ascending: true });

  if (error) {
    console.warn("Supabase exercises fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => mapExerciseBankRow(row));
}

function mapEdgeMemberPayload(value: unknown): Member | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  const name = String(row.name ?? "").trim();
  if (!id || !email || !name) return null;
  if ("owner_user_id" in row || "membership_type" in row || "customer_type" in row) {
    return mapMemberRowFromSupabase(row);
  }
  return {
    id,
    ownerUserId: String(row.ownerUserId ?? row.owner_user_id ?? "").trim(),
    assignedTrainerName: String(row.assignedTrainerName ?? row.assigned_trainer_name ?? "").trim(),
    name,
    email,
    isActive: (row.isActive ?? row.is_active) !== false,
    invitedAt: String(row.invitedAt ?? row.invited_at ?? ""),
    firstLoginAt: String(row.firstLoginAt ?? row.first_login_at ?? ""),
    phone: String(row.phone ?? ""),
    birthDate: String(row.birthDate ?? row.birth_date ?? ""),
    gender: normalizeMemberGender(row.gender),
    weight: String(row.weight ?? ""),
    height: String(row.height ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    membershipType: mapMembershipType(row.membershipType ?? row.membership_type),
    customerType: mapCustomerType(row.customerType ?? row.customer_type),
    daysSinceActivity: String(row.daysSinceActivity ?? row.days_since_activity ?? "0"),
    goal: String(row.goal ?? ""),
    focus: String(row.focus ?? ""),
    personalGoals: String(row.personalGoals ?? row.personal_goals ?? ""),
    injuries: String(row.injuries ?? ""),
    coachNotes: String(row.coachNotes ?? row.coach_notes ?? ""),
    avatarUrl: String(row.avatarUrl ?? row.avatar_url ?? ""),
  };
}

function normalizeInvokeJsonPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

function parseCreateTrainerMemberInvokePayload(raw: unknown): Record<string, unknown> | null {
  const record = normalizeInvokeJsonPayload(raw);
  if (!record) return null;
  if (record.ok === true && record.member) return record;
  if (record.member && typeof record.member === "object") {
    return { ok: true, member: record.member };
  }
  const id = String(record.id ?? "").trim();
  const email = String(record.email ?? "").trim();
  const name = String(record.name ?? "").trim();
  if (id && email && name) {
    return { ok: true, member: record };
  }
  return null;
}

async function fetchCreatedTrainerMemberWithRetry(memberId: string, email: string): Promise<Member | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const delaysMs = [0, 250, 750, 1500, 3000];
  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const byId = await fetchMemberByIdFromSupabase(memberId);
    if (byId) return byId;
    if (normalizedEmail.includes("@")) {
      const byEmail = await fetchActiveMemberByEmailFromSupabase(normalizedEmail);
      if (byEmail) return byEmail;
    }
  }
  return null;
}

async function fetchMemberByIdFromSupabase(memberId: string): Promise<Member | null> {
  const trimmedId = memberId.trim();
  if (!trimmedId) return null;
  const rows = await queryMemberRowsWithColumnFallback({ kind: "id", memberId: trimmedId });
  if (!rows?.length) return null;
  return mapMemberRowFromSupabase(rows[0]);
}

async function fetchActiveMemberByEmailFromSupabase(email: string): Promise<Member | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) return null;
  const rows = await queryMemberRowsWithColumnFallback({ kind: "email", email: normalizedEmail });
  if (!rows?.length) return null;
  const activeMatches = rows
    .map((row) => mapMemberRowFromSupabase(row))
    .filter((member) => member.email.trim().toLowerCase() === normalizedEmail && member.isActive !== false);
  return activeMatches[0] ?? null;
}

async function parseCreateTrainerMemberSuccessFromInvoke(
  data: unknown,
  error: unknown,
): Promise<Record<string, unknown> | null> {
  const fromData = parseCreateTrainerMemberInvokePayload(data);
  if (fromData) return fromData;

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const response = typeof context.clone === "function" ? context.clone() : context;
        const body = await response.json();
        const fromBody = parseCreateTrainerMemberInvokePayload(body);
        if (fromBody) return fromBody;
      } catch {
        // Fall through to string parsing below.
      }
    }
  }

  if (!error) return null;
  const details = await extractFunctionErrorDetails(error);
  const trimmedDetails = details.trim();
  if (!trimmedDetails.startsWith("{") || !trimmedDetails.endsWith("}")) {
    return null;
  }
  try {
    return parseCreateTrainerMemberInvokePayload(JSON.parse(trimmedDetails) as unknown);
  } catch {
    return null;
  }
}

async function invokeCreateTrainerMemberFunction(body: Record<string, unknown>): Promise<{
  ok: boolean;
  data: Record<string, unknown> | null;
  errorMessage: string | null;
}> {
  if (!supabaseClient) {
    return { ok: false, data: null, errorMessage: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const { data, error } = await supabaseClient.functions.invoke("create-trainer-member", { body });
  const successFromInvoke = await parseCreateTrainerMemberSuccessFromInvoke(data, error);
  if (successFromInvoke) {
    return { ok: true, data: successFromInvoke, errorMessage: null };
  }

  let errorMessage = (await extractFunctionErrorDetails(error)) || error?.message || "create-trainer-member feilet";
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/create-trainer-member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      } catch {
        parsed = null;
      }
      const successFromFetch = parseCreateTrainerMemberInvokePayload(parsed);
      if (response.ok && successFromFetch) {
        return { ok: true, data: successFromFetch, errorMessage: null };
      }
      if (response.status === 409) {
        const email = String(body.email ?? "").trim().toLowerCase();
        const recovered = email ? await fetchActiveMemberByEmailFromSupabase(email) : null;
        if (recovered) {
          return { ok: true, data: { ok: true, member: recovered }, errorMessage: null };
        }
      }
      const detail = String(parsed?.error ?? parsed?.message ?? raw ?? response.status);
      errorMessage = `HTTP ${response.status}: ${detail}`;
      if (!response.ok) {
        const memberId = String(body.memberId ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const recovered =
          (memberId ? await fetchMemberByIdFromSupabase(memberId) : null) ??
          (email.includes("@") ? await fetchActiveMemberByEmailFromSupabase(email) : null);
        if (recovered) {
          return { ok: true, data: { ok: true, member: recovered }, errorMessage: null };
        }
      }
    } catch (fetchError) {
      errorMessage = `${errorMessage} (${String(fetchError)})`;
    }
  }

  const memberId = String(body.memberId ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const recoveredAfterFailure =
    (memberId ? await fetchMemberByIdFromSupabase(memberId) : null) ??
    (email.includes("@") ? await fetchActiveMemberByEmailFromSupabase(email) : null);
  if (recoveredAfterFailure) {
    return { ok: true, data: { ok: true, member: recoveredAfterFailure }, errorMessage: null };
  }

  return { ok: false, data: null, errorMessage };
}

export type { CreateMemberResult };

export async function createTrainerMemberViaEdgeFunction(
  member: Member,
  input: CreateMemberInput,
): Promise<CreateMemberResult> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const {
    data: { session: initialSession },
  } = await supabaseClient.auth.getSession();
  let activeSession = initialSession;
  if (!activeSession?.access_token) {
    const { data: refreshedData } = await supabaseClient.auth.refreshSession();
    activeSession = refreshedData.session;
  }
  if (!activeSession?.access_token) {
    return { ok: false, message: "Logg inn som trener og prøv igjen." };
  }

  const ownerUserId = String((await getOwnerUserId()) ?? activeSession.user?.id ?? "").trim();
  const invoke = await invokeCreateTrainerMemberFunction({
    accessToken: activeSession.access_token,
    memberId: member.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || member.phone,
    goal: input.goal?.trim() || member.goal,
    focus: input.focus?.trim() || member.focus,
    membershipType: input.membershipType ?? member.membershipType,
    customerType: input.customerType ?? member.customerType,
    ownerUserId,
  });

  const normalizedEmail = input.email.trim().toLowerCase();
  let mapped = invoke.ok && invoke.data ? mapEdgeMemberPayload(invoke.data.member) : null;
  if (!mapped) {
    mapped = await fetchCreatedTrainerMemberWithRetry(member.id, normalizedEmail);
  }

  if (mapped) {
    return { ok: true, member: mapped };
  }

  const message = invoke.errorMessage ?? "Kunne ikke opprette kunde.";
  if (message.includes("email_exists") || message.includes("E-post finnes")) {
    const existing = await fetchCreatedTrainerMemberWithRetry(member.id, normalizedEmail);
    if (existing) {
      return { ok: true, member: existing };
    }
    return { ok: false, message: "E-post finnes allerede som aktiv kunde." };
  }

  const recoveredDespiteError = await fetchCreatedTrainerMemberWithRetry(member.id, normalizedEmail);
  if (recoveredDespiteError) {
    return { ok: true, member: recoveredDespiteError };
  }

  return { ok: false, message: `Opprettelse feilet: ${message}` };
}

export type IntervalWorkoutPersistJob = {
  log: WorkoutLog;
  hints: PersistWorkoutLogHints;
};

export function prepareIntervalWorkoutLogState(
  state: AppState,
  input: LogIntervalWorkoutInput,
): { nextState: AppState; job: IntervalWorkoutPersistJob | null; errorMessage?: string } {
  const programId = input.programId.trim();
  const programTitleHint = String(input.programTitle ?? "").trim();
  const program =
    state.programs.find((item) => item.id === programId) ??
    (programTitleHint
      ? state.programs.find((item) => item.title.trim() === programTitleHint)
      : undefined);
  if (!input.memberId.trim() || !program) {
    return {
      nextState: state,
      job: null,
      errorMessage: "Fant ikke programmet. Oppdater siden og prøv igjen.",
    };
  }

  const memberOwnerUserId = state.members.find((item) => item.id === input.memberId.trim())?.ownerUserId;
  const persistHints: PersistWorkoutLogHints = {
    ...buildMemberPersistenceHints(state, input.memberId, {
      ownerUserId: String(input.ownerUserId ?? program.ownerUserId ?? memberOwnerUserId ?? "").trim() || undefined,
      programTitle: program.title,
    }),
    ...(input.targetEmail?.trim() ? { targetEmail: input.targetEmail.trim().toLowerCase() } : {}),
  };

  const nextState = localAppRepository.logIntervalWorkout(state, {
    ...input,
    programId: program.id,
    programTitle: program.title,
  });
  const latestLog = nextState.logs[0];
  const createdNewLog = Boolean(latestLog && latestLog.id !== state.logs[0]?.id);
  if (!createdNewLog || !latestLog) {
    return {
      nextState,
      job: null,
      errorMessage: "Kunne ikke opprette øktloggen lokalt.",
    };
  }

  return { nextState, job: { log: latestLog, hints: persistHints } };
}

export async function persistIntervalWorkoutLogToCloud(
  log: WorkoutLog,
  hints: PersistWorkoutLogHints,
): Promise<PersistResult> {
  return promiseWithTimeout(
    persistIntervalWorkoutLog(log, hints),
    WORKOUT_LOG_TOTAL_TIMEOUT_MS,
    {
      ok: false,
      message:
        "Skyen svarer ikke i tide. Økten ligger under Fremgang lokalt — prøv lagre igjen om litt.",
    },
  );
}

export const supabaseAppRepository: AppRepository = {
  addMember(state: AppState, input: CreateMemberInput): AppState {
    return localAppRepository.addMember(state, input);
  },
  deactivateMember(state: AppState, memberId: string): AppState {
    const targetMember = state.members.find((member) => member.id === memberId);
    const emailKey = targetMember?.email.trim().toLowerCase() ?? "";
    const nextState = localAppRepository.deactivateMember(state, memberId);
    void archiveMemberByEmailFromSupabase(emailKey, memberId).then((result) => {
      if (!result.ok) {
        console.warn("archive-member:", result.message);
      }
    });
    return nextState;
  },
  deleteMember(state: AppState, memberId: string): AppState {
    const targetMember = state.members.find((member) => member.id === memberId);
    const nextState = localAppRepository.deleteMember(state, memberId);
    void deleteMemberFromSupabase({
      id: memberId,
      email: targetMember?.email,
    });
    return nextState;
  },
  markMemberInvited(state: AppState, memberId: string, invitedAtIso?: string): AppState {
    const targetMember = state.members.find((member) => member.id === memberId);
    const nextState = localAppRepository.markMemberInvited(state, memberId, invitedAtIso);
    const updatedMember = nextState.members.find((member) => member.id === memberId);
    if (targetMember && updatedMember) {
      void persistMember(updatedMember);
    }
    return nextState;
  },
  markMembersInvitedByEmail(state: AppState, email: string, invitedAtIso?: string): AppState {
    const emailKey = email.trim().toLowerCase();
    const stamp = (invitedAtIso ?? new Date().toISOString()).trim();
    const beforeById = new Map(state.members.map((member) => [member.id, member]));
    const nextState = localAppRepository.markMembersInvitedByEmail(state, email, stamp);
    if (!emailKey.includes("@")) return nextState;
    nextState.members.forEach((member) => {
      if (member.email.trim().toLowerCase() !== emailKey) return;
      const before = beforeById.get(member.id);
      if (before?.invitedAt?.trim()) return;
      if (!member.invitedAt?.trim()) return;
      void persistMember(member);
    });
    return nextState;
  },
  markMembersFirstLoginByEmail(state: AppState, email: string, firstLoginAtIso?: string): AppState {
    const emailKey = email.trim().toLowerCase();
    const stamp = (firstLoginAtIso ?? new Date().toISOString()).trim();
    const beforeById = new Map(state.members.map((member) => [member.id, member]));
    const nextState = localAppRepository.markMembersFirstLoginByEmail(state, email, stamp);
    if (!emailKey.includes("@")) return nextState;
    nextState.members.forEach((member) => {
      if (member.email.trim().toLowerCase() !== emailKey) return;
      const before = beforeById.get(member.id);
      if (before?.firstLoginAt?.trim()) return;
      if (!member.firstLoginAt?.trim()) return;
      void persistMember(member);
    });
    return nextState;
  },
  saveProgram(state: AppState, input: SaveProgramInput): AppState {
    const normalizedUserEmail = state.currentUser?.email?.trim().toLowerCase() ?? "";
    const anchorMember =
      state.members.find((member) => member.id === input.memberId) ??
      (normalizedUserEmail
        ? state.members.find((member) => member.email.trim().toLowerCase() === normalizedUserEmail)
        : undefined);
    const hints = {
      targetEmail: String(anchorMember?.email ?? "").trim().toLowerCase(),
      targetName: String(anchorMember?.name ?? "").trim(),
      customerType: String(anchorMember?.customerType ?? "").trim(),
      membershipType: String(anchorMember?.membershipType ?? "").trim(),
      fallbackOwnerUserId: String(state.currentUser?.id ?? "").trim(),
      trainerSave: state.currentUser?.role === "trainer" || input.programCreatedBy === "trainer",
    };
    const nextState = localAppRepository.saveProgram(state, input);
    void (async () => {
      try {
        const result = await persistProgram(input, hints);
        input.onPersisted?.(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ukjent feil under programlagring.";
        console.warn("saveProgram async persistence failed:", message);
        input.onPersisted?.({ ok: false, message });
      }
    })();
    return nextState;
  },
  updateProgramMemberLibraryStatus(state: AppState, programId: string, status: MemberProgramLibraryStatus | undefined): AppState {
    const nextState = localAppRepository.updateProgramMemberLibraryStatus(state, programId, status);
    const dbStatus = status === "hidden" || status === "archived" ? "archived" : null;
    const anchor = state.programs.find((program) => program.id === programId);
    const matchKey = anchor ? buildTrainingProgramDisplayKey(anchor) : null;
    const idsToPersist = matchKey
      ? nextState.programs
          .filter((program) => buildTrainingProgramDisplayKey(program) === matchKey)
          .map((program) => program.id)
      : [programId];
    void persistMemberProgramLibraryStatus(idsToPersist, dbStatus);
    return nextState;
  },
  deleteProgram(
    state: AppState,
    programId: string,
    _context?: DeleteProgramContext,
  ): AppState {
    return localAppRepository.deleteProgram(state, programId);
  },
  appendTrainerMessage(state: AppState, memberId: string, text: string): AppState {
    const anchorMember = state.members.find((member) => member.id === memberId);
    const hints = {
      targetEmail: String(anchorMember?.email ?? "").trim().toLowerCase(),
      targetName: String(anchorMember?.name ?? "").trim(),
    };
    const nextState = localAppRepository.appendTrainerMessage(state, memberId, text);
    void persistMessage(memberId, "trainer", text.trim(), hints);
    return nextState;
  },
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
    const anchorMember = state.members.find((member) => member.id === memberId);
    const hints = {
      targetEmail: String(anchorMember?.email ?? state.currentUser.email ?? "").trim().toLowerCase(),
      targetName: String(anchorMember?.name ?? "").trim(),
    };
    const nextState = localAppRepository.appendMemberMessage(state, memberId, text);
    void persistMessage(memberId, "member", text.trim(), hints);
    return nextState;
  },
  toggleChatMessageReaction(state: AppState, messageId, emoji, actor): AppState {
    return localAppRepository.toggleChatMessageReaction(state, messageId, emoji, actor);
  },
  startWorkoutMode(state: AppState, programId: string, options?: StartWorkoutModeOptions): AppState {
    return localAppRepository.startWorkoutMode(state, programId, options);
  },
  startCustomWorkout(state: AppState, input: StartCustomWorkoutInput, options?: StartWorkoutModeOptions): AppState {
    return localAppRepository.startCustomWorkout(state, input, options);
  },
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState {
    return localAppRepository.updateWorkoutResult(state, input);
  },
  replaceWorkoutExerciseGroup(state: AppState, input: ReplaceWorkoutExerciseGroupInput): AppState {
    return localAppRepository.replaceWorkoutExerciseGroup(state, input);
  },
  appendWorkoutSetForProgramExercise(state: AppState, programExerciseId: string): AppState {
    return localAppRepository.appendWorkoutSetForProgramExercise(state, programExerciseId);
  },
  removeLastWorkoutSetForProgramExercise(state: AppState, programExerciseId: string): AppState {
    return localAppRepository.removeLastWorkoutSetForProgramExercise(state, programExerciseId);
  },
  deferWorkoutExerciseGroup(state: AppState, programExerciseId: string): AppState {
    return localAppRepository.deferWorkoutExerciseGroup(state, programExerciseId);
  },
  removeWorkoutLogResult(state: AppState, input: RemoveWorkoutLogResultInput): AppState {
    const nextState = localAppRepository.removeWorkoutLogResult(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(
        updatedLog,
        buildMemberPersistenceHints(state, updatedLog.memberId, { programTitle: updatedLog.programTitle }),
      );
    }
    return nextState;
  },
  removeGroupWorkoutLog(state: AppState, input: RemoveGroupWorkoutLogInput): AppState {
    const nextState = localAppRepository.removeGroupWorkoutLog(state, input);
    void deleteGroupWorkoutLogs(input);
    return nextState;
  },
  setWorkoutLogResults(state: AppState, input: SetWorkoutLogResultsInput): AppState {
    const nextState = localAppRepository.setWorkoutLogResults(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(
        updatedLog,
        buildMemberPersistenceHints(state, updatedLog.memberId, { programTitle: updatedLog.programTitle }),
      );
    }
    return nextState;
  },
  updateWorkoutLogTrainerComment(state: AppState, input: UpdateWorkoutLogTrainerCommentInput): AppState {
    const nextState = localAppRepository.updateWorkoutLogTrainerComment(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void (async () => {
        await persistWorkoutLog(
          updatedLog,
          buildMemberPersistenceHints(state, updatedLog.memberId, { programTitle: updatedLog.programTitle }),
        );
        if (input.trainerComment.trim()) {
          await notifyWorkoutCommentPush(updatedLog.id);
        }
      })();
    }
    return nextState;
  },
  updateWorkoutNote(state: AppState, note: string): AppState {
    return localAppRepository.updateWorkoutNote(state, note);
  },
  updateWorkoutExerciseNote(state: AppState, programExerciseId: string, note: string): AppState {
    return localAppRepository.updateWorkoutExerciseNote(state, programExerciseId, note);
  },
  cancelWorkoutMode(state: AppState): AppState {
    return localAppRepository.cancelWorkoutMode(state);
  },
  finishWorkoutMode(state: AppState, input?: FinishWorkoutInput): AppState {
    const hadWorkout = Boolean(state.workoutMode);
    const priorLogIds = new Set(state.logs.map((log) => log.id));
    const nextState = localAppRepository.finishWorkoutMode(state, input);
    const finishedLog = hadWorkout
      ? nextState.logs.find((log) => !priorLogIds.has(log.id)) ?? null
      : null;
    if (finishedLog?.memberId?.trim()) {
      void persistWorkoutLog(
        finishedLog,
        buildMemberPersistenceHints(state, finishedLog.memberId, { programTitle: finishedLog.programTitle }),
      ).then((result) => {
        input?.onPersisted?.(result);
      });
    } else if (hadWorkout) {
      input?.onPersisted?.({
        ok: false,
        message: finishedLog
          ? "Mangler kunde for økten. Velg kunden på nytt og prøv igjen."
          : "Kunne ikke opprette øktloggen. Velg kunden på nytt og prøv igjen.",
      });
    }
    return nextState;
  },
  logGroupWorkout(state: AppState, input: LogGroupWorkoutInput): AppState {
    const nextState = localAppRepository.logGroupWorkout(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(
        latestLog,
        buildMemberPersistenceHints(state, latestLog.memberId, { programTitle: latestLog.programTitle }),
      );
    }
    return nextState;
  },
  logActivityWorkout(state: AppState, input: LogActivityWorkoutInput): AppState {
    const nextState = localAppRepository.logActivityWorkout(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(
        latestLog,
        buildMemberPersistenceHints(state, latestLog.memberId, { programTitle: latestLog.programTitle }),
      );
    }
    return nextState;
  },
  updateActivityWorkout(state: AppState, input: UpdateActivityWorkoutInput): AppState {
    const nextState = localAppRepository.updateActivityWorkout(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(
        updatedLog,
        buildMemberPersistenceHints(state, updatedLog.memberId, { programTitle: updatedLog.programTitle }),
      );
    }
    return nextState;
  },
  updateGroupWorkoutLog(state: AppState, input: UpdateGroupWorkoutLogInput): AppState {
    const nextState = localAppRepository.updateGroupWorkoutLog(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(
        updatedLog,
        buildMemberPersistenceHints(state, updatedLog.memberId, { programTitle: updatedLog.programTitle }),
      );
    }
    return nextState;
  },
  deleteWorkoutLog(state: AppState, input: DeleteWorkoutLogInput): AppState {
    const nextState = localAppRepository.deleteWorkoutLog(state, input);
    void deleteWorkoutLogById(input.logId);
    return nextState;
  },
  logIntervalWorkout(state: AppState, input: LogIntervalWorkoutInput): AppState {
    return prepareIntervalWorkoutLogState(state, input).nextState;
  },
  logCompletedPlanEntry(state: AppState, input: LogCompletedPlanEntryInput): AppState {
    const nextState = localAppRepository.logCompletedPlanEntry(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(
        latestLog,
        buildMemberPersistenceHints(state, latestLog.memberId, { programTitle: latestLog.programTitle }),
      );
    }
    return nextState;
  },
  removeCompletedPlanEntryLog(state: AppState, input: RemoveCompletedPlanEntryLogInput): AppState {
    const nextState = localAppRepository.removeCompletedPlanEntryLog(state, input);
    void deleteCompletedPlanEntryLogs(input);
    return nextState;
  },
  saveExercise(state: AppState, input: SaveExerciseInput): AppState {
    if (!input.name.trim() || !input.group.trim()) return state;
    const nextState = localAppRepository.saveExercise(state, input);
    const exercise = nextState.exercises.find((item) => item.id === input.id) ?? nextState.exercises[0];
    if (exercise) {
      void persistExercise(exercise);
    }
    return nextState;
  },
  deleteExercise(state: AppState, exerciseId: string): AppState {
    const normalizedExerciseId = exerciseId.trim();
    if (!normalizedExerciseId) return state;
    const deletedExercise = state.exercises.find((exercise) => exercise.id === normalizedExerciseId);
    const affectedProgramIds = new Set(
      state.programs
        .filter((program) =>
          deletedExercise
            ? program.exercises.some((item) => programExerciseUsesBankExercise(item, deletedExercise))
            : program.exercises.some((exercise) => exercise.exerciseId === normalizedExerciseId),
        )
        .map((program) => program.id),
    );
    const nextState = localAppRepository.deleteExercise(state, normalizedExerciseId);
    const updatedPrograms = nextState.programs.filter((program) => affectedProgramIds.has(program.id));
    void deactivateExerciseInSupabase(normalizedExerciseId, updatedPrograms);
    return nextState;
  },
  updateMember(state: AppState, input: UpdateMemberInput): AppState {
    const previousMember = state.members.find((member) => member.id === input.memberId);
    const nextState = localAppRepository.updateMember(state, input);
    const updatedMember = nextState.members.find((member) => member.id === input.memberId);
    if (updatedMember) {
      const memberId = updatedMember.id.trim();
      const previousPersonalGoals = previousMember?.personalGoals;
      const persistPromise = persistMember(updatedMember, previousPersonalGoals)
        .then(() => notifyTrainerForMemberFormChanges(updatedMember, previousPersonalGoals))
        .finally(() => {
          pendingMemberPersists.delete(memberId);
        });
      pendingMemberPersists.set(memberId, persistPromise);
    }
    return nextState;
  },
};
