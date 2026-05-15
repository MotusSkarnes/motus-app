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
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy } from "../app/dateFormat";
import {
  localAppRepository,
  type AppRepository,
  type CreateMemberInput,
  type FinishWorkoutInput,
  type LogGroupWorkoutInput,
  type LogCompletedPlanEntryInput,
  type RemoveCompletedPlanEntryLogInput,
  type RemoveGroupWorkoutLogInput,
  type RemoveWorkoutLogResultInput,
  type SetWorkoutLogResultsInput,
  type SaveProgramInput,
  type SaveExerciseInput,
  type ReplaceWorkoutExerciseGroupInput,
  type StartCustomWorkoutInput,
  type StartWorkoutModeOptions,
  type UpdateMemberInput,
  type UpdateWorkoutLogTrainerCommentInput,
  type UpdateWorkoutResultInput,
} from "./appRepository";
import { supabaseClient } from "./supabaseClient";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
  if (!trimmed.startsWith("auth-")) return trimmed;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
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
  return {
    id,
    title: String(o.title ?? "").trim() || "Periodeplan",
    notes: String(o.notes ?? "").trim(),
    startDate: String(o.startDate ?? "").trim(),
    weeks: Number.isFinite(weeks) ? weeks : weeklyPlans.length || 1,
    createdAt: String(o.createdAt ?? "").trim(),
    weeklyPlans,
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
  const hintedName = String(hints?.targetName ?? "").trim().toLowerCase();
  if (!trimmedMemberId && !hintedEmail && !hintedName) return [];
  if ((trimmedMemberId === "__template__" || trimmedMemberId.startsWith("auth-")) && !hintedEmail && !hintedName) {
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
  const rowsByName =
    hintedName
      ? await supabaseClient.from("members").select("id").ilike("name", hintedName)
      : { data: [], error: null as { message: string } | null };
  if (rowsByName.error) {
    console.warn("Supabase related member lookup by name failed:", rowsByName.error.message);
  }
  const ids = Array.from(
    new Set(
      [...(rowsByEmail.data ?? []), ...(rowsByName.data ?? [])]
        .map((row) => String((row as { id?: string }).id ?? "").trim())
        .filter((id) => Boolean(id) && id !== "__template__" && !id.startsWith("auth-"))
    )
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
) {
  if (!supabaseClient) return;
  const trimmedMemberId = memberId.trim();
  const trimmedText = text.trim();
  if (!trimmedMemberId || !trimmedText) return;
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
    return;
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
    return;
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
      return;
    }
    const chosenOwnerUserId = memberOwnerUserId || senderOwnerUserId;
    if (!chosenOwnerUserId) return;
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
) : Promise<{ ok: boolean; message?: string }> {
  if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };
  const ownerUserId = await getOwnerUserId(hints?.fallbackOwnerUserId);
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
    if (payload?.ok === true || (Array.isArray(payload?.ids) && payload.ids.length > 0)) {
      return { ok: true };
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
          if (parsed?.ok === true || (Array.isArray(parsed?.ids) && parsed.ids.length > 0)) {
            return { ok: true };
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

  return { ok: true };
}

async function persistMember(member: Member) {
  if (!supabaseClient) return;
  const normalizedEmail = member.email.trim().toLowerCase();
  const relatedMemberIds = await resolveRelatedMemberIds(member.id, {
    targetEmail: normalizedEmail,
    targetName: member.name,
  });
  const syncPayload = {
    email: normalizedEmail,
    emails: [normalizedEmail],
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
      avatarUrl: member.avatarUrl ?? "",
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

  const shouldUseMemberProfileSync =
    roleClaim === "member" || (authenticatedEmail && authenticatedEmail === normalizedEmail);

  if (shouldUseMemberProfileSync) {
    const syncEmails = Array.from(
      new Set(
        [normalizedEmail, authenticatedEmail]
          .map((value) => String(value ?? "").trim().toLowerCase())
          .filter((value) => value && value.includes("@"))
      )
    );
    const syncPayload = {
      email: authenticatedEmail || normalizedEmail,
      emails: syncEmails,
      memberId: member.id,
      memberIds: relatedMemberIds,
      targetName: member.name,
      changes: {
        name: member.name,
        phone: member.phone,
        birthDate: member.birthDate,
        goal: member.goal,
        focus: member.focus,
        injuries: member.injuries,
        personalGoals: member.personalGoals,
        avatarUrl: member.avatarUrl ?? "",
      },
    };

    let synced = false;
    const invokeResult = await supabaseClient.functions.invoke("update-member-profile", { body: syncPayload });
    if (!invokeResult.error) {
      const updated =
        invokeResult.data && typeof invokeResult.data === "object" && "updated" in invokeResult.data
          ? Number((invokeResult.data as { updated?: unknown }).updated ?? 0)
          : 0;
      synced = updated > 0;
    } else {
      console.warn("update-member-profile invoke failed:", invokeResult.error.message);
    }

    if (!synced && supabaseUrl && supabaseAnonKey) {
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
          if (response.ok && Number(body?.updated ?? 0) > 0) {
            synced = true;
          } else if (!response.ok) {
            console.warn("update-member-profile direct fetch failed:", body?.error || body?.message || `HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn("update-member-profile direct fetch threw:", error);
        }
      }
    }

    if (!synced) {
      const directClauses = [
        `id.eq.${member.id.trim()}`,
        ...syncEmails.map((email) => `email.eq.${email}`),
      ];
      const directUpdate = await supabaseClient
        .from("members")
        .update({
          name: member.name,
          email: normalizedEmail,
          phone: member.phone,
          birth_date: member.birthDate,
          goal: member.goal,
          focus: member.focus,
          injuries: member.injuries,
          personal_goals: member.personalGoals,
          avatar_url: member.avatarUrl ?? "",
        })
        .or(directClauses.join(","))
        .select("id");
      if (directUpdate.error || (directUpdate.data?.length ?? 0) === 0) {
        console.warn(
          "Supabase member fallback update failed:",
          directUpdate.error?.message || "No rows updated via fallback path"
        );
      }
    }
    return;
  }

  const ownerUserId = await getOwnerUserId();
  if (!ownerUserId) return;

  // Guard against accidental reactivation from stale clients:
  // if this member (or same email) was previously deactivated, keep it inactive.
  let shouldStayInactive = !member.isActive;
  if (!shouldStayInactive) {
    const { data: existingById } = await supabaseClient
      .from("members")
      .select("is_active")
      .eq("id", member.id)
      .maybeSingle();
    if (existingById?.is_active === false) {
      shouldStayInactive = true;
    }
  }
  // Keep explicit inactive status for the same row, but do not
  // deactivate a different active member row just because an older
  // row with the same email was previously deactivated.

  const { error } = await supabaseClient.from("members").upsert(
    {
      id: member.id,
      owner_user_id: ownerUserId,
      name: member.name,
      email: normalizedEmail,
      is_active: shouldStayInactive ? false : member.isActive,
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
    .map((item) => `${item.exerciseName}|${item.sets}|${item.reps}|${item.weight}|${item.holdSeconds ?? ""}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.notes}`)
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
    console.warn("Supabase member_library_status update failed:", error.message);
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

async function persistWorkoutLog(log: WorkoutLog) {
  if (!supabaseClient) return;
  const memberId = await resolveCanonicalMemberIdForPersistence(log.memberId, {});
  const serializedNote = serializeWorkoutNote(log);
  const invokeResult = await supabaseClient.functions.invoke("persist-workout-log", {
    body: {
      id: log.id,
      memberId,
      programTitle: log.programTitle,
      date: log.date,
      status: log.status,
      note: serializedNote,
      results: log.results ?? [],
    },
  });
  if (!invokeResult.error) {
    return;
  }
  console.warn("persist-workout-log invoke failed, falling back to client upsert:", invokeResult.error.message);

  const fallbackOwnerUserId = await getOwnerUserId();
  const ownerUserId = await resolveOwnerUserIdForMember(memberId, fallbackOwnerUserId);
  if (!ownerUserId) return;

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
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Supabase log persist failed:", error.message);
  }
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
  const date = input.date?.trim() ?? "";
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
  const date = input.date?.trim() ?? "";
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

export type HydratedMemberData = {
  members: Member[];
  messages: ChatMessage[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  periodPlanRows: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  exercises: Exercise[];
};

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
    exercises: exercisesRows.map((row) => {
      const exercise = row as Record<string, unknown>;
      return {
        id: String(exercise.id ?? ""),
        name: String(exercise.name ?? ""),
        category: exercise.category === "Kondisjon" || exercise.category === "Uttøyning" ? exercise.category : "Styrke",
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
        category: exercise.category === "Kondisjon" || exercise.category === "Uttøyning" ? exercise.category : "Styrke",
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
    return mapHydrateMemberPayload(data as Record<string, unknown>);
  }

  if (error) {
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

export async function restoreMemberByEmailFromSupabase(email: string): Promise<{ ok: boolean; message: string }> {
  if (!supabaseClient) {
    return { ok: false, message: "Tjenesten er ikke tilgjengelig akkurat nå." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Skriv inn en gyldig e-post." };
  }

  try {
    const { error } = await supabaseClient.functions.invoke("restore-member", {
      body: { email: normalizedEmail },
    });
    if (!error) {
      return { ok: true, message: "Klient gjenopprettet. Oppdaterer liste..." };
    }
    console.warn("restore-member invoke failed, trying direct update:", error.message);
  } catch (error) {
    console.warn("restore-member invoke threw, trying direct update:", error);
  }

  const { error } = await supabaseClient.from("members").update({ is_active: true }).eq("email", normalizedEmail).eq("is_active", false);

  if (error) {
    return { ok: false, message: `Gjenoppretting feilet: ${error.message}` };
  }

  return { ok: true, message: "Klient gjenopprettet. Oppdaterer liste..." };
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
    category: row.category === "Kondisjon" || row.category === "Uttøyning" ? row.category : "Styrke",
    group: String(row.muscle_group ?? ""),
    equipment: String(row.equipment ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    description: String(row.description ?? ""),
    imageUrl: String(row.image_url ?? ""),
  }));
}

export const supabaseAppRepository: AppRepository = {
  addMember(state: AppState, input: CreateMemberInput): AppState {
    const nextState = localAppRepository.addMember(state, input);
    const latestMember = nextState.members[nextState.members.length - 1];
    if (latestMember) {
      void persistMember(latestMember);
    }
    return nextState;
  },
  deactivateMember(state: AppState, memberId: string): AppState {
    const targetMember = state.members.find((member) => member.id === memberId);
    const nextState = localAppRepository.deactivateMember(state, memberId);
    if (targetMember) {
      void persistMember({ ...targetMember, isActive: false });
    }
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
        if (anchorMember) {
          await persistMember(anchorMember);
        }
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
    void persistMessage(memberId, "trainer", text.trim(), hints);
    // Avoid optimistic local row on Supabase mode; hydrate returns canonical member_id row.
    return state;
  },
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
    const anchorMember = state.members.find((member) => member.id === memberId);
    const hints = {
      targetEmail: String(anchorMember?.email ?? state.currentUser.email ?? "").trim().toLowerCase(),
      targetName: String(anchorMember?.name ?? "").trim(),
    };
    void persistMessage(memberId, "member", text.trim(), hints);
    // Avoid optimistic local row on Supabase mode; hydrate returns canonical member_id row.
    return state;
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
  removeWorkoutLogResult(state: AppState, input: RemoveWorkoutLogResultInput): AppState {
    const nextState = localAppRepository.removeWorkoutLogResult(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void persistWorkoutLog(updatedLog);
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
      void persistWorkoutLog(updatedLog);
    }
    return nextState;
  },
  updateWorkoutLogTrainerComment(state: AppState, input: UpdateWorkoutLogTrainerCommentInput): AppState {
    const nextState = localAppRepository.updateWorkoutLogTrainerComment(state, input);
    const updatedLog = nextState.logs.find((log) => log.id === input.logId);
    if (updatedLog) {
      void (async () => {
        await persistWorkoutLog(updatedLog);
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
  cancelWorkoutMode(state: AppState): AppState {
    return localAppRepository.cancelWorkoutMode(state);
  },
  finishWorkoutMode(state: AppState, input?: FinishWorkoutInput): AppState {
    const nextState = localAppRepository.finishWorkoutMode(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog);
    }
    return nextState;
  },
  logGroupWorkout(state: AppState, input: LogGroupWorkoutInput): AppState {
    const nextState = localAppRepository.logGroupWorkout(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog);
    }
    return nextState;
  },
  logCompletedPlanEntry(state: AppState, input: LogCompletedPlanEntryInput): AppState {
    const nextState = localAppRepository.logCompletedPlanEntry(state, input);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog);
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
    const nextState = localAppRepository.updateMember(state, input);
    const updatedMember = nextState.members.find((member) => member.id === input.memberId);
    if (updatedMember) {
      void persistMember(updatedMember);
    }
    return nextState;
  },
};
