import { createDefaultMealPlan } from "./mealPlanDefaults";
import { loadMealPlanForMember, persistMealPlan, readAllMealPlans } from "./mealPlanStorage";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "./mealPlanTypes";
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

function parseDays(value: unknown): MealPlanDay[] {
  if (!Array.isArray(value)) return [];
  return value
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

async function fetchMealPlanRow(memberId: string): Promise<MealPlanRowFetch> {
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
    if (!plan.days.length) return { plan: null, failed: false };
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

export async function fetchMealPlanFromSupabase(memberIds: string | string[]): Promise<MealPlanSupabaseFetch> {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { plan: null, hadFetchErrors: false };
  const results = await Promise.all(ids.map((id) => fetchMealPlanRow(id)));
  const hadFetchErrors = results.some((row) => row.failed);
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
      const { data: rows } = await supabaseClient.from("members").select("id").ilike("email", email);
      for (const row of rows ?? []) {
        const id = String((row as { id?: string }).id ?? "").trim();
        if (id) ids.add(id);
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
    const { data: rows } = await withTimeout(
      supabaseClient.from("members").select("id").ilike("email", email),
      MEAL_PLAN_FETCH_TIMEOUT_MS,
      "members lookup",
    );
    return (rows ?? [])
      .map((row) => String((row as { id?: string }).id ?? "").trim())
      .filter(Boolean);
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

  const email = memberEmail?.trim().toLowerCase();
  if (options?.forTrainerView) {
    if (email?.includes("@")) {
      for (const id of await memberIdsForEmail(email)) {
        ids.add(id);
      }
    }
    return [...ids];
  }

  for (const id of await readLinkedMealPlanMemberIds(primaryMemberId)) {
    if (id) ids.add(id);
  }
  if (email?.includes("@")) {
    for (const id of await memberIdsForEmail(email)) {
      ids.add(id);
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

/** Sky er kilde når rad finnes; overskriver aldri PT-plan med tom standardplan. */
export async function syncMealPlanForMember(
  memberId: string,
  ownerUserId: string,
  memberEmail?: string,
): Promise<{ plan: MealPlan; cloudSynced: boolean }> {
  const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, {
    forTrainerView: Boolean(ownerUserId.trim()),
  });
  const trimmedMemberId = memberId.trim() || lookupIds[0] || "";
  const { plan: remote } = await fetchMealPlanFromSupabase(lookupIds);
  const local = loadBestLocalMealPlan(lookupIds);

  if (remote) {
    const preferred = pickPreferredMealPlan([remote, local].filter((row): row is MealPlan => Boolean(row))) ?? remote;
    const normalized = { ...preferred, memberId: trimmedMemberId };
    if (!mealPlansEqual(loadMealPlanForMember(trimmedMemberId), normalized)) {
      persistMealPlan(normalized, { notify: false });
    }
    return { plan: normalized, cloudSynced: true };
  }

  if (local && (countMealPlanFoodItems(local) > 0 || local.notes.trim())) {
    const normalized = { ...local, memberId: trimmedMemberId };
    persistMealPlan(normalized, { notify: false });
    return { plan: normalized, cloudSynced: false };
  }

  const fallback = local ?? createDefaultMealPlan(trimmedMemberId);
  const normalized = { ...fallback, memberId: trimmedMemberId };
  persistMealPlan(normalized, { notify: false });

  // Medlem skal aldri overskrive PT sin plan i sky med tom standardplan.
  if (ownerUserId.trim() && isSupabaseConfigured && countMealPlanFoodItems(normalized) > 0) {
    const uploaded = await saveMealPlanToSupabase(ownerUserId, normalized);
    return { plan: normalized, cloudSynced: uploaded };
  }

  return { plan: normalized, cloudSynced: false };
}

export type TrainerMealPlanLoadResult =
  | { status: "cloud"; plan: MealPlan }
  | { status: "local"; plan: MealPlan }
  | { status: "none" }
  | { status: "uncertain" };

/** PT-redigering: ikke opprett tom standardplan automatisk — vis «Lag matplan» når status er none. */
export async function loadMealPlanForTrainerEditor(
  memberId: string,
  ownerUserId: string,
  memberEmail?: string,
): Promise<TrainerMealPlanLoadResult> {
  const lookupIds = await resolveMealPlanLookupIds(memberId, memberEmail, {
    forTrainerView: Boolean(ownerUserId.trim()),
  });
  const trimmedMemberId = memberId.trim() || lookupIds[0] || "";
  if (!trimmedMemberId) return { status: "none" };

  const { plan: remote, hadFetchErrors } = await fetchMealPlanFromSupabase(lookupIds);
  if (remote) {
    const normalized = { ...remote, memberId: trimmedMemberId };
    if (!mealPlansEqual(loadMealPlanForMember(trimmedMemberId), normalized)) {
      persistMealPlan(normalized, { notify: false });
    }
    return { status: "cloud", plan: normalized };
  }

  const local = loadBestLocalMealPlan(lookupIds);
  if (local && (countMealPlanFoodItems(local) > 0 || local.notes.trim())) {
    const normalized = { ...local, memberId: trimmedMemberId };
    persistMealPlan(normalized, { notify: false });
    return { status: "local", plan: normalized };
  }

  if (hadFetchErrors) {
    return { status: "uncertain" };
  }

  return { status: "none" };
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

export async function persistMealPlanBundle(
  ownerUserId: string | undefined,
  plan: MealPlan,
): Promise<{ cloudSynced: boolean; warning?: string }> {
  persistMealPlan(plan);
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
