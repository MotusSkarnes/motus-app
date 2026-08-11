import { createDefaultMealPlan } from "./mealPlanDefaults";
import {
  clearMealPlanLocalForMemberIds,
  loadMealPlanForMember,
  notifyMealPlanChanged,
  persistMealPlan,
  readAllMealPlans,
} from "./mealPlanStorage";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "./mealPlanTypes";
import { memberIdsMatchingExactEmail } from "../services/memberEmailExactMatch";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

export function mealPlansEqual(a: MealPlan | null | undefined, b: MealPlan | null | undefined): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function isMealPlanTableMissing(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("member_meal_plans") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("pgrst204") || m.includes("could not find"))
  );
}

function parseTargets(value: unknown): MealPlanTargets | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const targets: MealPlanTargets = {};
  if (typeof row.kcal === "number") targets.kcal = row.kcal;
  if (typeof row.protein === "number") targets.protein = row.protein;
  if (typeof row.carbs === "number") targets.carbs = row.carbs;
  if (typeof row.fat === "number") targets.fat = row.fat;
  const split = row.macroSplitPct ?? row.macro_split_pct;
  if (split && typeof split === "object") {
    const s = split as Record<string, unknown>;
    const protein = Number(s.protein);
    const carbs = Number(s.carbs);
    const fat = Number(s.fat);
    if ([protein, carbs, fat].every((n) => Number.isFinite(n))) {
      targets.macroSplitPct = { protein, carbs, fat };
    }
  }
  const lockedRaw = row.macroSplitLocked ?? row.macro_split_locked;
  if (Array.isArray(lockedRaw)) {
    const allowed = new Set(["protein", "carbs", "fat"]);
    const locked = lockedRaw
      .map((v) => String(v))
      .filter((v): v is "protein" | "carbs" | "fat" => allowed.has(v));
    if (locked.length) targets.macroSplitLocked = locked.slice(0, 2);
  }
  return Object.keys(targets).length ? targets : undefined;
}

function parseFoodEntry(value: unknown): MealPlanFoodEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const foodName = String(row.foodName ?? row.food_name ?? "").trim();
  if (!foodName) return null;
  const nutrition = row.nutritionPer100g ?? row.nutrition_per_100g;
  const n =
    nutrition && typeof nutrition === "object" ? (nutrition as Record<string, unknown>) : ({} as Record<string, unknown>);
  return {
    id: String(row.id ?? `food-${Math.random().toString(36).slice(2, 9)}`),
    foodId: String(row.foodId ?? row.food_id ?? ""),
    foodName,
    grams: Number(row.grams) > 0 ? Number(row.grams) : 0,
    imageUrl: String(row.imageUrl ?? row.image_url ?? "").trim() || undefined,
    note: typeof row.note === "string" ? row.note : undefined,
    nutritionPer100g: {
      kcal: Number(n.kcal) || 0,
      protein: Number(n.protein) || 0,
      carbs: Number(n.carbs) || 0,
      fat: Number(n.fat) || 0,
      fiber: Number(n.fiber) || 0,
      sugar: Number(n.sugar) || 0,
      saturatedFat: Number(n.saturatedFat ?? n.saturated_fat) || 0,
      sodium: Number(n.sodium) || 0,
    },
  };
}

function parseMeal(value: unknown, dayIndex: number, mealIndex: number): MealPlanMeal | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  const items = itemsRaw.map(parseFoodEntry).filter((item): item is MealPlanFoodEntry => item !== null);
  return {
    id: String(row.id ?? `meal-${dayIndex}-${mealIndex}`),
    name: String(row.name ?? "Måltid"),
    time: typeof row.time === "string" ? row.time : undefined,
    items,
    targets: parseTargets(row.targets ?? row.macro_targets),
  };
}

function coerceJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") {
        const nested = (parsed as Record<string, unknown>).days;
        if (Array.isArray(nested)) return nested;
      }
    } catch {
      return [];
    }
  }
  if (value && typeof value === "object") {
    const nested = (value as Record<string, unknown>).days;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function parseDays(value: unknown): MealPlanDay[] {
  const source = coerceJsonArray(value);
  if (!source.length && value != null && value !== "" && !Array.isArray(value)) {
    return [];
  }
  return source
    .map((day, dayIndex) => {
      if (!day || typeof day !== "object") return null;
      const row = day as Record<string, unknown>;
      const mealsRaw = Array.isArray(row.meals) ? row.meals : [];
      const meals = mealsRaw
        .map((meal, mealIndex) => parseMeal(meal, dayIndex, mealIndex))
        .filter((meal): meal is MealPlanMeal => meal !== null);
      return {
        id: String(row.id ?? `day-${dayIndex}`),
        label: String(row.label ?? `Dag ${dayIndex + 1}`),
        meals,
      };
    })
    .filter((day): day is MealPlanDay => day !== null);
}

export function countMealPlanFoodItems(plan: MealPlan | null | undefined): number {
  if (!plan) return 0;
  return plan.days.reduce(
    (sum, day) => sum + day.meals.reduce((mealSum, meal) => mealSum + meal.items.length, 0),
    0,
  );
}

function planUpdatedAtMs(plan: MealPlan | null | undefined): number {
  const raw = plan?.updatedAt?.trim();
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/** Velg plan med flest matvarer; ved likt antall nyeste updated_at. */
export function pickPreferredMealPlan(candidates: MealPlan[]): MealPlan | null {
  if (!candidates.length) return null;
  return candidates.reduce((best, current) => {
    const bestFood = countMealPlanFoodItems(best);
    const currentFood = countMealPlanFoodItems(current);
    if (currentFood > bestFood) return current;
    if (currentFood < bestFood) return best;
    return planUpdatedAtMs(current) >= planUpdatedAtMs(best) ? current : best;
  });
}

export function mealPlanFromRow(memberId: string, row: Record<string, unknown>): MealPlan {
  return {
    id: String(row.id ?? `mealplan-${memberId}`),
    memberId,
    title: String(row.title ?? "Matplan").trim() || "Matplan",
    notes: String(row.notes ?? ""),
    days: parseDays(row.days),
    targets: parseTargets(row.targets),
    createdAt: String(row.created_at ?? "").trim() || new Date().toISOString().slice(0, 10),
    updatedAt: String(row.updated_at ?? "").trim() || undefined,
  };
}

type MealPlanRowFetch = { plan: MealPlan | null; failed: boolean };

async function fetchMealPlanRow(
  memberId: string,
  options?: { allowEmptyDays?: boolean },
): Promise<MealPlanRowFetch> {
  if (!supabaseClient || !memberId.trim()) return { plan: null, failed: false };
  try {
    const { data, error } = await withTimeout(
      supabaseClient
        .from("member_meal_plans")
        .select("member_id, title, notes, days, targets, updated_at")
        .eq("member_id", memberId.trim())
        .maybeSingle(),
      MEAL_PLAN_FETCH_TIMEOUT_MS,
      "member_meal_plans fetch",
    );
    if (error) {
      if (!isMealPlanTableMissing(error.message)) {
        console.warn("member_meal_plans fetch failed:", memberId, error.message);
      }
      return { plan: null, failed: true };
    }
    if (!data) return { plan: null, failed: false };
    const rowMemberId = String((data as { member_id?: string }).member_id ?? memberId).trim() || memberId;
    const plan = mealPlanFromRow(rowMemberId, data as Record<string, unknown>);
    if (!options?.allowEmptyDays && !plan.days.length) return { plan: null, failed: false };
    return { plan, failed: false };
  } catch (error) {
    console.warn("member_meal_plans fetch threw:", memberId, error);
    return { plan: null, failed: true };
  }
}

export type MealPlanSupabaseFetch = {
  plan: MealPlan | null;
  /** True når minst ett oppslag feilet (timeout/nettverk) — ikke det samme som «ingen rad». */
  hadFetchErrors: boolean;
};

/** PT: henter matplan via edge (service role) når direkte RLS-oppslag feiler eller gir tomme rader. */
export async function fetchMealPlanForTrainerViaEdge(
  memberId: string,
  memberEmail?: string,
): Promise<MealPlan | null> {
  if (!supabaseClient || !isSupabaseConfigured) return null;
  const trimmedMemberId = memberId.trim();
  const trimmedEmail = memberEmail?.trim() ?? "";
  if (!trimmedMemberId && !trimmedEmail.includes("@")) return null;
  try {
    const { data, error } = await supabaseClient.functions.invoke("fetch-trainer-member-meal-plan", {
      body: {
        memberId: trimmedMemberId || undefined,
        memberEmail: trimmedEmail || undefined,
      },
    });
    if (error) {
      console.warn("fetch-trainer-member-meal-plan invoke failed:", error.message);
      return null;
    }
    const planRow = (data as { plan?: Record<string, unknown> | null } | null)?.plan;
    if (!planRow || typeof planRow !== "object") return null;
    const rowMemberId = String(planRow.member_id ?? trimmedMemberId).trim() || trimmedMemberId;
    const plan = mealPlanFromRow(rowMemberId, planRow);
    return plan.days.length ? plan : null;
  } catch (invokeError) {
    console.warn("fetch-trainer-member-meal-plan threw:", invokeError);
    return null;
  }
}

export async function fetchMealPlanFromSupabase(
  memberIds: string | string[],
  options?: { allowEmptyDays?: boolean },
): Promise<MealPlanSupabaseFetch> {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { plan: null, hadFetchErrors: false };
  const results = await Promise.all(ids.map((id) => fetchMealPlanRow(id, options)));
  const hadFetchErrors = results.length > 0 && results.every((row) => row.failed);
  const plans = results.map((row) => row.plan).filter((plan): plan is MealPlan => Boolean(plan));
  return { plan: pickPreferredMealPlan(plans), hadFetchErrors };
}

export async function readLinkedMealPlanMemberIds(primaryMemberId: string): Promise<string[]> {
  const ids = new Set<string>();
  const primary = primaryMemberId.trim();
  if (primary) ids.add(primary);
  if (!supabaseClient) return [...ids];
  try {
    const { data } = await supabaseClient.auth.getUser();
    const user = data?.user;
    if (!user) return [...ids];
    const metaIds = [
      typeof user.app_metadata?.member_id === "string" ? user.app_metadata.member_id : "",
      typeof user.user_metadata?.member_id === "string" ? user.user_metadata.member_id : "",
    ];
    metaIds.forEach((id) => {
      const trimmed = id.trim();
      if (trimmed) ids.add(trimmed);
    });
    const email = String(user.email ?? "")
      .trim()
      .toLowerCase();
    if (email.includes("@")) {
      // ilike treats `_`/`%` as wildcards — keep only exact normalized emails.
      const { data: rows } = await supabaseClient.from("members").select("id, email").ilike("email", email);
      for (const id of memberIdsMatchingExactEmail(rows, email)) {
        ids.add(id);
      }
    }
  } catch {
    /* ignore */
  }
  return [...ids];
}

const MEAL_PLAN_FETCH_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function memberIdsForEmail(email: string): Promise<string[]> {
  if (!supabaseClient || !email.includes("@")) return [];
  try {
    // Select email too: raw ilike can match sibling clients (jane_doe → janexdoe).
    const { data: rows } = await withTimeout(
      supabaseClient.from("members").select("id, email").ilike("email", email),
      MEAL_PLAN_FETCH_TIMEOUT_MS,
      "members lookup",
    );
    return memberIdsMatchingExactEmail(rows, email);
  } catch (error) {
    console.warn("meal plan member email lookup failed:", error);
    return [];
  }
}

/** Alle mulige member_id-er for samme person (JWT, e-post, valgt medlem). */
export async function resolveMealPlanLookupIds(
  primaryMemberId: string,
  memberEmail?: string,
  options?: { forTrainerView?: boolean },
): Promise<string[]> {
  const ids = new Set<string>();
  const primary = primaryMemberId.trim();
  if (primary) ids.add(primary);

  let email = memberEmail?.trim().toLowerCase() ?? "";
  if (!email.includes("@") && primary && supabaseClient) {
    try {
      const { data: memberRow } = await supabaseClient
        .from("members")
        .select("email")
        .eq("id", primary)
        .maybeSingle();
      email = String((memberRow as { email?: string } | null)?.email ?? "")
        .trim()
        .toLowerCase();
    } catch {
      /* ignore */
    }
  }

  if (email.includes("@")) {
    for (const id of await memberIdsForEmail(email)) {
      ids.add(id);
    }
  }

  if (!options?.forTrainerView) {
    for (const id of await readLinkedMealPlanMemberIds(primaryMemberId)) {
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

function loadBestLocalMealPlan(lookupIds: string[]): MealPlan | null {
  const all = readAllMealPlans();
  const candidates: MealPlan[] = [];
  for (const id of lookupIds) {
    const fromKey = all[id];
    if (fromKey?.days?.length) candidates.push(fromKey);
    const loaded = loadMealPlanForMember(id);
    if (loaded) candidates.push(loaded);
  }
  return pickPreferredMealPlan(candidates);
}

export async function saveMealPlanToSupabase(
  ownerUserId: string,
  plan: MealPlan,
): Promise<boolean> {
  if (!supabaseClient || !ownerUserId.trim() || !plan.memberId.trim()) return false;
  const { error } = await supabaseClient.from("member_meal_plans").upsert(
    {
      member_id: plan.memberId.trim(),
      owner_user_id: ownerUserId.trim(),
      title: plan.title.trim() || "Matplan",
      notes: plan.notes,
      days: plan.days,
      targets: plan.targets ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
  if (error) {
    if (!isMealPlanTableMissing(error.message)) {
      console.warn("member_meal_plans save failed:", error.message);
    }
    return false;
  }
  return true;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { ownerUserId: string; plan: MealPlan } | null = null;

function runPendingMealPlanCloudSave(): void {
  const payload = pendingSave;
  pendingSave = null;
  saveTimer = null;
  if (!payload) return;
  void saveMealPlanToSupabase(payload.ownerUserId, payload.plan);
}

export function scheduleMealPlanCloudSave(ownerUserId: string, plan: MealPlan): void {
  if (!ownerUserId.trim() || !isSupabaseConfigured) return;
  pendingSave = { ownerUserId, plan };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(runPendingMealPlanCloudSave, 700);
}

/** Lagrer matplan til sky med en gang (f.eks. etter PT legger til oppskrift). */
export function flushMealPlanCloudSave(ownerUserId: string): void {
  if (!ownerUserId.trim() || !isSupabaseConfigured) return;
  if (saveTimer) clearTimeout(saveTimer);
  runPendingMealPlanCloudSave();
}

export function cancelScheduledMealPlanCloudSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  pendingSave = null;
}

export async function deleteMealPlanFromSupabase(memberIds: string[]): Promise<{ deleted: number; failed: number }> {
  if (!supabaseClient) return { deleted: 0, failed: memberIds.length };
  const ids = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))];
  let deleted = 0;
  let failed = 0;
  for (const memberId of ids) {
    try {
      const { error, count } = await supabaseClient
        .from("member_meal_plans")
        .delete({ count: "exact" })
        .eq("member_id", memberId);
      if (error) {
        if (!isMealPlanTableMissing(error.message)) {
          console.warn("member_meal_plans delete failed:", memberId, error.message);
        }
        failed += 1;
      } else if ((count ?? 0) > 0) {
        deleted += 1;
      }
    } catch (error) {
      console.warn("member_meal_plans delete threw:", memberId, error);
      failed += 1;
    }
  }
  return { deleted, failed };
}

export async function deleteMealPlanForLookupIds(
  memberId: string,
  memberEmail: string | undefined,
  ownerUserId: string | undefined,
): Promise<{ lookupIds: string[]; cloudDeleted: number; cloudFailed: number }> {
  cancelScheduledMealPlanCloudSave();
  const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, { forTrainerView: true });
  const ids = [...new Set([memberId.trim(), ...lookupIds].filter(Boolean))];
  clearMealPlanLocalForMemberIds(ids, { notify: false });

  let cloudDeleted = 0;
  let cloudFailed = 0;
  if (ownerUserId?.trim() && isSupabaseConfigured) {
    const result = await deleteMealPlanFromSupabase(ids);
    cloudDeleted = result.deleted;
    cloudFailed = result.failed;
  }

  notifyMealPlanChanged();
  return { lookupIds: ids, cloudDeleted, cloudFailed };
}

/** Sky er kilde når rad finnes; overskriver aldri PT-plan med tom standardplan. */
export type MealPlanMemberSyncResult = {
  plan: MealPlan | null;
  cloudSynced: boolean;
  /** Sky bekreftet at det ikke finnes matplan (slettet eller aldri lagret). */
  noMealPlanInCloud: boolean;
};

export async function syncMealPlanForMember(
  memberId: string,
  ownerUserId: string,
  memberEmail?: string,
): Promise<MealPlanMemberSyncResult> {
  const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, {
    forTrainerView: Boolean(ownerUserId.trim()),
  });
  const trimmedMemberId = memberId.trim() || lookupIds[0] || "";
  const clearIds = lookupIds.length ? lookupIds : [trimmedMemberId];
  const { plan: remote, hadFetchErrors } = await fetchMealPlanFromSupabase(lookupIds);
  const local = loadBestLocalMealPlan(lookupIds);
  const remoteHasFood = remote ? countMealPlanFoodItems(remote) > 0 : false;

  if (remoteHasFood) {
    const preferred = pickPreferredMealPlan([remote!, local].filter((row): row is MealPlan => Boolean(row))) ?? remote!;
    const normalized = { ...preferred, memberId: trimmedMemberId };
    if (!mealPlansEqual(loadMealPlanForMember(trimmedMemberId), normalized)) {
      persistMealPlan(normalized, { notify: false });
    }
    return { plan: normalized, cloudSynced: true, noMealPlanInCloud: false };
  }

  if (hadFetchErrors) {
    if (local && (countMealPlanFoodItems(local) > 0 || local.notes.trim())) {
      const normalized = { ...local, memberId: trimmedMemberId };
      persistMealPlan(normalized, { notify: false });
      return { plan: normalized, cloudSynced: false, noMealPlanInCloud: false };
    }
    return { plan: null, cloudSynced: false, noMealPlanInCloud: false };
  }

  clearMealPlanLocalForMemberIds(clearIds, { notify: false });
  return { plan: null, cloudSynced: true, noMealPlanInCloud: true };
}

export type TrainerMealPlanLoadResult =
  | { status: "cloud"; plan: MealPlan }
  | { status: "local"; plan: MealPlan }
  | { status: "none" }
  | { status: "uncertain" };

/** PT-redigering: ikke opprett tom standardplan automatisk — vis «Lag matplan» når status er none. */
export async function loadMealPlanForTrainerEditor(
  memberId: string,
  _ownerUserId: string,
  memberEmail?: string,
): Promise<TrainerMealPlanLoadResult> {
  try {
    const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, {
      forTrainerView: true,
    });
    const trimmedMemberId = memberId.trim() || lookupIds[0] || "";
    if (!trimmedMemberId) return { status: "none" };

    const { plan: remote, hadFetchErrors } = await fetchMealPlanFromSupabase(lookupIds, {
      allowEmptyDays: true,
    });
    let resolvedRemote = remote?.days?.length ? remote : null;
    if (!resolvedRemote) {
      const viaEdge = await fetchMealPlanForTrainerViaEdge(trimmedMemberId, memberEmail);
      if (viaEdge?.days?.length) resolvedRemote = viaEdge;
    }
    const local = loadBestLocalMealPlan(lookupIds);
    const preferred = pickPreferredMealPlan(
      [resolvedRemote, local].filter((candidate): candidate is MealPlan => Boolean(candidate?.days?.length)),
    );
    if (preferred) {
      const normalized = { ...preferred, memberId: trimmedMemberId };
      const fromLocal = local && mealPlansEqual(preferred, local);
      if (!mealPlansEqual(loadMealPlanForMember(trimmedMemberId), normalized)) {
        persistMealPlan(normalized, { notify: false });
      }
      return { status: fromLocal ? "local" : "cloud", plan: normalized };
    }

    if (hadFetchErrors) {
      return { status: "uncertain" };
    }

    return { status: "none" };
  } catch (error) {
    console.warn("loadMealPlanForTrainerEditor failed:", error);
    return { status: "uncertain" };
  }
}

/** Brukes etter hydrate-member-data — lagrer plan lokalt for medlem (alle koblede id-er). */
export function applyHydratedMealPlan(plan: MealPlan, aliasMemberIds: string[] = []): boolean {
  const memberId = plan.memberId.trim();
  if (!memberId || !plan.days.length) return false;
  const targetIds = [...new Set([memberId, ...aliasMemberIds.map((id) => id.trim()).filter(Boolean)])];
  let preferred = plan;
  for (const id of targetIds) {
    const existing = loadMealPlanForMember(id);
    if (existing) {
      preferred = pickPreferredMealPlan([preferred, existing]) ?? preferred;
    }
  }
  let changed = false;
  for (const id of targetIds) {
    const normalized = { ...preferred, memberId: id };
    if (!mealPlansEqual(loadMealPlanForMember(id), normalized)) {
      persistMealPlan(normalized, { notify: false });
      changed = true;
    }
  }
  return changed;
}

/** Lagrer samme plan under alle kjente member_id for personen (viktig ved duplikat-rader). */
export async function persistMealPlanForLookupIds(
  plan: MealPlan,
  memberId: string,
  memberEmail?: string,
  options?: { notify?: boolean },
): Promise<string[]> {
  const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, { forTrainerView: true });
  const ids = [...new Set([memberId.trim(), ...lookupIds].filter(Boolean))];
  if (!ids.length) return [];
  const canonicalMemberId = memberId.trim() || ids[0];
  const payload = { ...plan, memberId: canonicalMemberId };
  for (const id of ids) {
    persistMealPlan({ ...payload, memberId: id }, { notify: false });
  }
  if (options?.notify !== false) {
    notifyMealPlanChanged();
  }
  return ids;
}

export async function persistMealPlanBundle(
  ownerUserId: string | undefined,
  plan: MealPlan,
  options?: { notify?: boolean; memberEmail?: string },
): Promise<{ cloudSynced: boolean; warning?: string }> {
  await persistMealPlanForLookupIds(plan, plan.memberId, options?.memberEmail, { notify: options?.notify });
  if (!ownerUserId?.trim() || !isSupabaseConfigured) {
    return { cloudSynced: false };
  }
  const cloudSynced = await saveMealPlanToSupabase(ownerUserId, plan);
  if (!cloudSynced) {
    return {
      cloudSynced: false,
      warning: "Lagret lokalt. Kjør member_meal_plans_schema.sql i Supabase for sky-synk.",
    };
  }
  return { cloudSynced: true };
}

export function persistMealPlanLocalAndScheduleCloud(
  ownerUserId: string | undefined,
  plan: MealPlan,
  options?: { notify?: boolean },
): void {
  persistMealPlan(plan, options);
  if (ownerUserId?.trim()) scheduleMealPlanCloudSave(ownerUserId, plan);
}
