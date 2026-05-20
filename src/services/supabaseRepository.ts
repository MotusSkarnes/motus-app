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
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy, normalizeStoredLogDate } from "../app/dateFormat";
import { normalizeStoredExerciseCategory } from "../app/exerciseCategories";
import {
  createMember,
  localAppRepository,
  type AppRepository,
  type CreateMemberInput,
  type CreateMemberResult,
  type FinishWorkoutInput,
  type LogGroupWorkoutInput,
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
import { isContaminatedDemoMemberProfile } from "../app/memberLocalCatalog";
import { detectNewMemberFormSubmissions } from "../app/memberFormNotifications";
import { ensureMemberAuthLink } from "./supabaseAuth";
import { supabaseClient } from "./supabaseClient";
import {
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
): Promise<string> {
  const trimmed = String(memberId ?? "").trim();
  if (!trimmed || !supabaseClient) return trimmed;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const authUserId = String(user?.id ?? "").trim();
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
    const seen = new Set<string>();
    out[memberId] = out[memberId].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }
  return out;
}

export async function upsertMemberPeriodPlansForTrainer(memberIds: string[], plan: PeriodSchedulePlan): Promise<void> {
  if (!supabaseClient) return;
  const ownerUserId = await getOwnerUserId();
  if (!ownerUserId) return;
  const trimmedIds = Array.from(new Set(memberIds.map((id) => id.trim()).filter(Boolean)));
  if (!trimmedIds.length) return;
  const rows = trimmedIds.map((memberId) => ({
    member_id: memberId,
    plan_id: plan.id,
    owner_user_id: ownerUserId,
    plan: plan as unknown as Record<string, unknown>,
  }));
  const { error } = await supabaseClient.from("member_period_plans").upsert(rows, { onConflict: "member_id,plan_id" });
  if (error) {
    console.warn("Supabase member_period_plans upsert failed:", error.message);
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

async function persistProgram(
  input: SaveProgramInput,
  hints?: {
    targetEmail?: string;
    targetName?: string;
    customerType?: string;
    membershipType?: string;
    fallbackOwnerUserId?: string;
  },
) : Promise<PersistResult> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";
  if (sessionEmail.includes("@")) {
    await ensureMemberAuthLink(sessionEmail, input.memberId);
  }
  const sessionUserId = await getOwnerUserId(hints?.fallbackOwnerUserId);
  const memberId = await resolveCanonicalMemberIdForPersistence(input.memberId.trim(), {
    targetEmail: hints?.targetEmail,
  });
  const normalizedProgramId = (() => {
    const raw = String(input.id ?? "").trim();
    if (!raw) return "";
    // Local optimistic IDs should not force "update-single-row" path in edge function.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
    return isUuid ? raw : "";
  })();
  const functionResult = await supabaseClient.functions.invoke("save-training-program", {
    body: {
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
    },
  });
  if (!functionResult.error) {
    const payload = functionResult.data as { ok?: boolean; ids?: unknown[] } | null;
    const ids = Array.isArray(payload?.ids)
      ? payload.ids.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];
    if (payload?.ok === true || ids.length > 0) {
      return { ok: true, ids };
    }
    console.warn("save-training-program returned without saving program:", functionResult.data);
  }
  if (functionResult.error) {
    console.warn("save-training-program invoke failed:", functionResult.error.message);
    const invokeDetails = await extractFunctionErrorDetails(functionResult.error);
    if (invokeDetails) {
      console.warn("save-training-program invoke details:", invokeDetails);
    }
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
    };
    let { error: primaryError } = await supabaseClient.from("training_programs").upsert(
      { ...rowBase, ...authorDb },
      { onConflict: "id" },
    );
    if (primaryError && isTrainingProgramAuthorColumnDbError(primaryError.message)) {
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
      .order("created_at", { ascending: false });
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
        ...authorDb,
      };
      let { error: updateError } = await supabaseClient.from("training_programs").update(updatePayload).eq("id", existingId);
      if (updateError && isTrainingProgramAuthorColumnDbError(updateError.message)) {
        ({ error: updateError } = await supabaseClient
          .from("training_programs")
          .update({
            goal: input.goal,
            notes: input.notes,
            exercises: input.exercises,
            created_at: timestamp,
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
    };
    let { error: insertError } = await supabaseClient.from("training_programs").insert({ ...insertBase, ...authorDb });
    if (insertError && isTrainingProgramAuthorColumnDbError(insertError.message)) {
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

  const memberIds = new Set<string>([canonicalMemberId, state.memberViewId.trim()].filter(Boolean));
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

  const localPrograms = state.programs.filter((program) => memberIds.has(program.memberId.trim()));
  for (const program of localPrograms) {
    const saveInput: SaveProgramInput = {
      id: program.id,
      title: program.title,
      goal: program.goal,
      notes: program.notes,
      memberId: canonicalMemberId,
      exercises: program.exercises,
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
  for (const log of localLogs) {
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

/** Lagre oppstartsskjema én gang med verifisert sky-skriving (unngår race ved flere updateMember-kall). */
export async function persistOnboardingToSupabase(
  member: Member,
  changes: Pick<Member, "goal" | "level" | "injuries" | "personalGoals" | "focus">,
  relatedMemberIds: string[],
): Promise<string> {
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
    throw new Error(
      lastError
        ? `Kunne ikke lagre oppstartsskjema: ${lastError}`
        : "Kunne ikke lagre oppstartsskjema i databasen. Sjekk at du er logget inn med riktig e-post og prøv igjen.",
    );
  }

  const resolvedId = persistId || dbMemberIds[0] || "";
  if (resolvedId && !resolvedId.startsWith("auth-")) {
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
    "onboarding",
    memberForSync.name.trim() || memberForSync.email.trim() || "Medlem",
  );

  return notifyMemberId;
}

function personalGoalsContainsProfileBlob(personalGoals: string | undefined): boolean {
  const value = String(personalGoals ?? "").trim();
  return (
    value.startsWith("MOTUS_PROFILE_V1:") ||
    value.includes("onboardingCompletedAt") ||
    value.includes('"onboarding"')
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
      let directUpdate = await supabaseClient
        .from("members")
        .update({
          name: memberForPersist.name,
          phone: memberForPersist.phone,
          birth_date: memberForPersist.birthDate,
          goal: memberForPersist.goal,
          focus: memberForPersist.focus,
          injuries: memberForPersist.injuries,
          personal_goals: memberForPersist.personalGoals,
          avatar_url: memberForPersist.avatarUrl ?? "",
        })
        .eq("id", memberForPersist.id.trim())
        .select("id");
      if ((directUpdate.data?.length ?? 0) === 0) {
        directUpdate = await supabaseClient
          .from("members")
          .update({
            name: memberForPersist.name,
            phone: memberForPersist.phone,
            birth_date: memberForPersist.birthDate,
            goal: memberForPersist.goal,
            focus: memberForPersist.focus,
            injuries: memberForPersist.injuries,
            personal_goals: memberForPersist.personalGoals,
            avatar_url: memberForPersist.avatarUrl ?? "",
          })
          .ilike("email", normalizedEmail)
          .select("id");
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
        "Kunne ikke lagre oppstartsskjema til skyen. Sjekk nettverk og at du er logget inn med riktig e-post, og prøv igjen.",
      );
    }
    return;
  }

  const sessionOwnerId = await getOwnerUserId();
  if (!sessionOwnerId) return;
  const ownerForUpsert = resolveOwnerUserIdForPersist({
    customerType: member.customerType,
    sessionOwnerId,
    existingOwnerId: member.ownerUserId,
  });

  const { error } = await supabaseClient.from("members").upsert(
    {
      id: member.id,
      owner_user_id: ownerForUpsert,
      name: member.name,
      email: normalizedEmail,
      is_active: member.isActive !== false,
      invited_at: member.invitedAt || null,
      phone: member.phone,
      birth_date: member.birthDate,
      weight: member.weight,
      height: member.height,
      level: member.level,
      membership_type: member.membershipType,
      customer_type: member.customerType,
      days_since_activity: member.daysSinceActivity,
      goal: member.goal,
      focus: member.focus,
      personal_goals: member.personalGoals,
      injuries: member.injuries,
      coach_notes: member.coachNotes,
      avatar_url: member.avatarUrl ?? "",
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

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
    .map((item) => `${item.exerciseName}|${item.sets}|${item.reps}|${item.weight}|${item.holdSeconds ?? ""}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.targetHrPercent ?? ""}|${item.notes}`)
    .join("||");
  return `${String(input.title ?? "").trim()}::${String(input.goal ?? "").trim()}::${String(input.notes ?? "").trim()}::${exerciseFingerprint}`;
}

async function deleteProgram(
  programId: string,
  context?: { memberIds?: string[]; targetEmail?: string; targetName?: string },
) {
  if (!supabaseClient) return;
  const { data: programRow, error: lookupError } = await supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id")
    .eq("id", programId)
    .maybeSingle();
  if (lookupError) {
    console.warn("Supabase program lookup before delete failed:", lookupError.message);
  }

  if (!programRow) {
  const { error } = await supabaseClient.from("training_programs").delete().eq("id", programId);
  if (error) {
    console.warn("Supabase program delete failed:", error.message);
    }
    return;
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
  if (!deletionKeys.length && !targetOwnerUserId) return;

  let candidateQuery = supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, owner_user_id")
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

  const { error } = await supabaseClient
    .from("training_programs")
    .delete()
    .in("id", programIdsToDelete);
  if (error) {
    console.warn("Supabase linked program delete failed:", error.message);
  }

  for (const relatedMemberId of deletionKeys) {
    await deleteLogsForProgram(relatedMemberId, title);
  }
}

async function persistMemberProgramLibraryStatus(programId: string, status: "hidden" | "archived" | null) {
  if (!supabaseClient) return;
  const id = programId.trim();
  if (!id) return;
  const { error } = await supabaseClient.from("training_programs").update({ member_library_status: status }).eq("id", id);
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

  const { error: messagesError } = await supabaseClient.from("chat_messages").delete().eq("member_id", memberId);
  if (messagesError) {
    console.warn("Supabase member message cleanup failed:", messagesError.message);
  }
  const { error: logsError } = await supabaseClient.from("workout_logs").delete().eq("member_id", memberId);
  if (logsError) {
    console.warn("Supabase member log cleanup failed:", logsError.message);
  }
  const { error: programsError } = await supabaseClient.from("training_programs").delete().eq("member_id", memberId);
  if (programsError) {
    console.warn("Supabase member program cleanup failed:", programsError.message);
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

function buildMemberPersistenceHints(state: AppState, memberId: string): { targetEmail?: string } {
  const member = state.members.find((item) => item.id === memberId);
  return { targetEmail: String(member?.email ?? "").trim().toLowerCase() };
}

async function persistWorkoutLog(log: WorkoutLog, hints?: { targetEmail?: string }): Promise<PersistResult> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };

  const sessionEmail = hints?.targetEmail?.trim().toLowerCase() ?? "";
  if (sessionEmail.includes("@")) {
    await ensureMemberAuthLink(sessionEmail, log.memberId);
  }

  const memberId = await resolveCanonicalMemberIdForPersistence(log.memberId, hints);
  const serializedNote = serializeWorkoutNote(log);
  const body = {
    id: log.id,
    memberId,
    programTitle: log.programTitle,
    date: log.date,
    status: log.status,
    note: serializedNote,
    results: log.results ?? [],
  };

  const invokeResult = await supabaseClient.functions.invoke("persist-workout-log", { body });
  if (!invokeResult.error) {
    const payload = invokeResult.data as { ok?: boolean; error?: string } | null;
    if (payload?.ok === true) return { ok: true };
    if (payload?.error) {
      console.warn("persist-workout-log:", payload.error);
    }
  } else {
    console.warn("persist-workout-log invoke failed:", invokeResult.error.message);
  }

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      const accessToken = session?.access_token ?? "";
      if (accessToken) {
        const response = await fetch(`${supabaseUrl}/functions/v1/persist-workout-log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });
        const raw = await response.text();
        if (response.ok) {
          const parsed = raw ? (JSON.parse(raw) as { ok?: boolean; error?: string }) : null;
          if (parsed?.ok === true) return { ok: true };
          return { ok: false, message: parsed?.error ?? "persist-workout-log returnerte ikke ok." };
        }
        return { ok: false, message: raw.slice(0, 220) || `HTTP ${response.status} fra persist-workout-log` };
      }
    } catch (fetchErr) {
      console.warn("persist-workout-log HTTP fallback failed:", fetchErr);
    }
  }

  const fallbackOwnerUserId = await getOwnerUserId();
  let ownerUserId = await resolveOwnerUserIdForMember(memberId, fallbackOwnerUserId);
  if (ownerUserId === fallbackOwnerUserId && sessionEmail.includes("@")) {
    ownerUserId = null;
  }
  if (!ownerUserId) {
    return { ok: false, message: "Kunne ikke finne PT-eier for økten. Kontakt treneren din." };
  }

  const { error } = await supabaseClient.from("workout_logs").upsert(
    {
      id: log.id,
      member_id: memberId,
      owner_user_id: ownerUserId,
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
    console.warn("Supabase log persist failed:", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
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
  log: Pick<WorkoutLog, "note" | "reflection" | "trainerComment" | "trainerCommentUpdatedAt" | "trainerCommentAuthorName">,
): string {
  const cleanNote = log.note.trim();
  const cleanTrainerComment = String(log.trainerComment ?? "").trim();
  if (!log.reflection && !cleanTrainerComment) return cleanNote;
  const payload = JSON.stringify({
    ...(log.reflection ? { reflection: log.reflection } : {}),
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

function parseWorkoutNote(
  rawNote: unknown,
): Pick<WorkoutLog, "note" | "reflection" | "trainerComment" | "trainerCommentUpdatedAt" | "trainerCommentAuthorName"> {
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
  const rawLibrary = String(program.member_library_status ?? "").trim().toLowerCase();
  const memberLibraryStatus: MemberProgramLibraryStatus | undefined =
    rawLibrary === "hidden" || rawLibrary === "archived" ? (rawLibrary as MemberProgramLibraryStatus) : undefined;
  return {
    id: String(program.id ?? ""),
    memberId: String(program.member_id ?? ""),
    title: String(program.title ?? ""),
    goal: String(program.goal ?? ""),
    notes: String(program.notes ?? ""),
    createdAt: mapIsoToProgramDate(String(program.created_at ?? "")),
    exercises: Array.isArray(program.exercises) ? (program.exercises as ProgramExercise[]) : [],
    assignedTrainerName: String(program.assigned_trainer_name ?? "").trim(),
    ...(programCreatedBy
      ? { programCreatedBy, programCreatedByName: programCreatedByName || undefined }
      : {}),
    ...(memberLibraryStatus ? { memberLibraryStatus } : {}),
  };
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

  return {
    members: membersRows.map((row) => {
      const member = row as Record<string, unknown>;
      return {
        id: String(member.id ?? ""),
        ownerUserId: String(member.owner_user_id ?? ""),
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        isActive: member.is_active !== false,
        invitedAt: String(member.invited_at ?? ""),
        phone: String(member.phone ?? ""),
        birthDate: String(member.birth_date ?? ""),
        weight: String(member.weight ?? ""),
        height: String(member.height ?? ""),
        level: member.level === "Litt øvet" || member.level === "Øvet" ? member.level : "Nybegynner",
        membershipType: mapMembershipType(member.membership_type),
        customerType: mapCustomerType(member.customer_type),
        daysSinceActivity: String(member.days_since_activity ?? "0"),
        goal: String(member.goal ?? ""),
        focus: String(member.focus ?? ""),
        personalGoals: String(member.personal_goals ?? ""),
        injuries: String(member.injuries ?? ""),
        coachNotes: String(member.coach_notes ?? ""),
        avatarUrl: String(member.avatar_url ?? ""),
      } as Member;
    }),
    messages: messagesRows.map((row) => {
      const message = row as Record<string, unknown>;
      return {
        id: String(message.id ?? ""),
        memberId: String(message.member_id ?? ""),
        sender: message.sender === "member" ? "member" : "trainer",
        text: String(message.text ?? ""),
        createdAt: mapIsoToCreatedAt(String(message.created_at ?? "")),
      } as ChatMessage;
    }),
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
        trainerComment: parsedNote.trainerComment,
        trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
        trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
        results: Array.isArray(log.results) ? (log.results as WorkoutExerciseResult[]) : undefined,
      } as WorkoutLog;
    }),
    periodPlanRows,
    inspirationItems: Array.isArray(payload.inspirationItems) ? payload.inspirationItems : [],
    exercises: exercisesRows.map((row) => {
      const exercise = row as Record<string, unknown>;
      return {
        id: String(exercise.id ?? ""),
        name: String(exercise.name ?? ""),
        category: normalizeStoredExerciseCategory(String(exercise.category ?? "")),
        group: String(exercise.muscle_group ?? ""),
        equipment: String(exercise.equipment ?? ""),
        level: exercise.level === "Litt øvet" || exercise.level === "Øvet" ? exercise.level : "Nybegynner",
        description: String(exercise.description ?? ""),
        imageUrl: String(exercise.image_url ?? ""),
      } as Exercise;
    }),
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
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        isActive: member.is_active !== false,
        invitedAt: String(member.invited_at ?? ""),
        phone: String(member.phone ?? ""),
        birthDate: String(member.birth_date ?? ""),
        weight: String(member.weight ?? ""),
        height: String(member.height ?? ""),
        level: member.level === "Litt øvet" || member.level === "Øvet" ? member.level : "Nybegynner",
        membershipType: mapMembershipType(member.membership_type),
        customerType: mapCustomerType(member.customer_type),
        daysSinceActivity: String(member.days_since_activity ?? "0"),
        goal: String(member.goal ?? ""),
        focus: String(member.focus ?? ""),
        personalGoals: String(member.personal_goals ?? ""),
        injuries: String(member.injuries ?? ""),
        coachNotes: String(member.coach_notes ?? ""),
        avatarUrl: String(member.avatar_url ?? ""),
      } as Member;
    }),
    messages: messagesRows.map((row) => {
      const message = row as Record<string, unknown>;
      return {
        id: String(message.id ?? ""),
        memberId: String(message.member_id ?? ""),
        sender: message.sender === "member" ? "member" : "trainer",
        text: String(message.text ?? ""),
        createdAt: mapIsoToCreatedAt(String(message.created_at ?? "")),
      } as ChatMessage;
    }),
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
        trainerComment: parsedNote.trainerComment,
        trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
        trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
        results: Array.isArray(log.results) ? (log.results as WorkoutExerciseResult[]) : undefined,
      } as WorkoutLog;
    }),
    exercises: exercisesRows.map((row) => {
      const exercise = row as Record<string, unknown>;
      return {
        id: String(exercise.id ?? ""),
        name: String(exercise.name ?? ""),
        category: normalizeStoredExerciseCategory(String(exercise.category ?? "")),
        group: String(exercise.muscle_group ?? ""),
        equipment: String(exercise.equipment ?? ""),
        level: exercise.level === "Litt øvet" || exercise.level === "Øvet" ? exercise.level : "Nybegynner",
        description: String(exercise.description ?? ""),
        imageUrl: String(exercise.image_url ?? ""),
      } as Exercise;
    }),
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

  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Supabase messages fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    memberId: String(row.member_id),
    sender: row.sender === "member" ? "member" : "trainer",
    text: String(row.text ?? ""),
    createdAt: mapIsoToCreatedAt(String(row.created_at ?? "")),
  }));
}

export async function fetchProgramsFromSupabase(): Promise<TrainingProgram[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at, member_library_status")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase programs fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => {
    const rawLibrary = String(row.member_library_status ?? "").trim().toLowerCase();
    const memberLibraryStatus: MemberProgramLibraryStatus | undefined =
      rawLibrary === "hidden" || rawLibrary === "archived" ? (rawLibrary as MemberProgramLibraryStatus) : undefined;
    return {
    id: String(row.id),
    memberId: String(row.member_id),
    title: String(row.title ?? ""),
    goal: String(row.goal ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: mapIsoToProgramDate(String(row.created_at ?? "")),
    exercises: Array.isArray(row.exercises) ? (row.exercises as ProgramExercise[]) : [],
      ...(memberLibraryStatus ? { memberLibraryStatus } : {}),
    };
  });
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
      trainerComment: parsedNote.trainerComment,
      trainerCommentUpdatedAt: parsedNote.trainerCommentUpdatedAt,
      trainerCommentAuthorName: parsedNote.trainerCommentAuthorName,
    results: Array.isArray(row.results) ? (row.results as WorkoutExerciseResult[]) : undefined,
    };
  });
}

export async function fetchMembersFromSupabase(): Promise<Member[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("members")
    .select(
      "id, owner_user_id, name, email, is_active, invited_at, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes, avatar_url"
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Supabase members fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    ownerUserId: String(row.owner_user_id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    isActive: row.is_active !== false,
    invitedAt: String(row.invited_at ?? ""),
    phone: String(row.phone ?? ""),
    birthDate: String(row.birth_date ?? ""),
    weight: String(row.weight ?? ""),
    height: String(row.height ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    membershipType: mapMembershipType(row.membership_type),
    customerType: mapCustomerType(row.customer_type),
    daysSinceActivity: String(row.days_since_activity ?? "0"),
    goal: String(row.goal ?? ""),
    focus: String(row.focus ?? ""),
    personalGoals: String(row.personal_goals ?? ""),
    injuries: String(row.injuries ?? ""),
    coachNotes: String(row.coach_notes ?? ""),
    avatarUrl: String(row.avatar_url ?? ""),
  }));
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

export async function fetchExercisesFromSupabase(): Promise<Exercise[] | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient
    .from("exercise_bank")
    .select("id, name, category, muscle_group, equipment, level, description, image_url")
    .or("is_active.is.null,is_active.eq.true")
    .order("name", { ascending: true });

  if (error) {
    console.warn("Supabase exercises fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    category: normalizeStoredExerciseCategory(String(row.category ?? "")),
    group: String(row.muscle_group ?? ""),
    equipment: String(row.equipment ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
  }));
}

function mapEdgeMemberPayload(value: unknown): Member | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = String(row.id ?? "").trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  const name = String(row.name ?? "").trim();
  if (!id || !email || !name) return null;
  return {
    id,
    ownerUserId: String(row.ownerUserId ?? "").trim(),
    name,
    email,
    isActive: row.isActive !== false,
    invitedAt: String(row.invitedAt ?? ""),
    phone: String(row.phone ?? ""),
    birthDate: String(row.birthDate ?? ""),
    weight: String(row.weight ?? ""),
    height: String(row.height ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    membershipType: mapMembershipType(row.membershipType),
    customerType: mapCustomerType(row.customerType),
    daysSinceActivity: String(row.daysSinceActivity ?? "0"),
    goal: String(row.goal ?? ""),
    focus: String(row.focus ?? ""),
    personalGoals: String(row.personalGoals ?? ""),
    injuries: String(row.injuries ?? ""),
    coachNotes: String(row.coachNotes ?? ""),
    avatarUrl: String(row.avatarUrl ?? ""),
  };
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
  if (!error && data && typeof data === "object") {
    return { ok: true, data: data as Record<string, unknown>, errorMessage: null };
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

  if (!invoke.ok || !invoke.data) {
    const message = invoke.errorMessage ?? "Kunne ikke opprette kunde.";
    if (message.includes("email_exists") || message.includes("E-post finnes")) {
      return { ok: false, message: "E-post finnes allerede som aktiv kunde." };
    }
    return { ok: false, message: `Opprettelse feilet: ${message}` };
  }

  const mapped = mapEdgeMemberPayload(invoke.data.member);
  if (!mapped) {
    return { ok: false, message: "Kunde ble opprettet, men svaret fra serveren var ugyldig." };
  }

  return { ok: true, member: mapped };
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
    const dbStatus = status === "hidden" || status === "archived" ? status : null;
    void persistMemberProgramLibraryStatus(programId, dbStatus);
    return nextState;
  },
  deleteProgram(
    state: AppState,
    programId: string,
    context?: { memberIds?: string[]; targetEmail?: string; targetName?: string },
  ): AppState {
    const nextState = localAppRepository.deleteProgram(state, programId);
    void deleteProgram(programId, context);
    return nextState;
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
  deferWorkoutExerciseGroup(state: AppState, programExerciseId: string): AppState {
    return localAppRepository.deferWorkoutExerciseGroup(state, programExerciseId);
  },
  removeWorkoutLogResult(state: AppState, input: RemoveWorkoutLogResultInput): AppState {
    const nextState = localAppRepository.removeWorkoutLogResult(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(updatedLog, buildMemberPersistenceHints(state, updatedLog.memberId));
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
      void persistWorkoutLog(updatedLog, buildMemberPersistenceHints(state, updatedLog.memberId));
    }
    return nextState;
  },
  updateWorkoutLogTrainerComment(state: AppState, input: UpdateWorkoutLogTrainerCommentInput): AppState {
    const nextState = localAppRepository.updateWorkoutLogTrainerComment(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void (async () => {
        await persistWorkoutLog(updatedLog, buildMemberPersistenceHints(state, updatedLog.memberId));
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
    const nextState = localAppRepository.finishWorkoutMode(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog && latestLog.id !== state.logs[0]?.id) {
      void persistWorkoutLog(latestLog, buildMemberPersistenceHints(state, latestLog.memberId)).then((result) => {
        input?.onPersisted?.(result);
      });
    }
    return nextState;
  },
  logGroupWorkout(state: AppState, input: LogGroupWorkoutInput): AppState {
    const nextState = localAppRepository.logGroupWorkout(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog, buildMemberPersistenceHints(state, latestLog.memberId));
    }
    return nextState;
  },
  logIntervalWorkout(state: AppState, input: LogIntervalWorkoutInput): AppState {
    const nextState = localAppRepository.logIntervalWorkout(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog, buildMemberPersistenceHints(state, latestLog.memberId));
    }
    return nextState;
  },
  logCompletedPlanEntry(state: AppState, input: LogCompletedPlanEntryInput): AppState {
    const nextState = localAppRepository.logCompletedPlanEntry(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog, buildMemberPersistenceHints(state, latestLog.memberId));
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
    const affectedProgramIds = new Set(
      state.programs
        .filter((program) => program.exercises.some((exercise) => exercise.exerciseId === normalizedExerciseId))
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
