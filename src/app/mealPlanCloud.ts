import { createDefaultMealPlan } from "./mealPlanDefaults";
import { loadMealPlanForMember, persistMealPlan } from "./mealPlanStorage";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "./mealPlanTypes";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

function mealPlansEqual(a: MealPlan | null | undefined, b: MealPlan | null | undefined): boolean {
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
  return Object.keys(targets).length ? targets : undefined;
}

function parseFoodEntry(value: unknown): MealPlanFoodEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const nutrition = row.nutritionPer100g ?? row.nutrition_per_100g;
  if (!nutrition || typeof nutrition !== "object") return null;
  const n = nutrition as Record<string, unknown>;
  return {
    id: String(row.id ?? `food-${Math.random().toString(36).slice(2, 9)}`),
    foodId: String(row.foodId ?? row.food_id ?? ""),
    foodName: String(row.foodName ?? row.food_name ?? "Matvare"),
    grams: Number(row.grams) > 0 ? Number(row.grams) : 0,
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

async function fetchMealPlanRow(memberId: string): Promise<MealPlan | null> {
  if (!supabaseClient || !memberId.trim()) return null;
  const { data, error } = await supabaseClient
    .from("member_meal_plans")
    .select("member_id, title, notes, days, targets, updated_at")
    .eq("member_id", memberId.trim())
    .maybeSingle();
  if (error) {
    if (!isMealPlanTableMissing(error.message)) {
      console.warn("member_meal_plans fetch failed:", memberId, error.message);
    }
    return null;
  }
  if (!data) return null;
  const rowMemberId = String((data as { member_id?: string }).member_id ?? memberId).trim() || memberId;
  const plan = mealPlanFromRow(rowMemberId, data as Record<string, unknown>);
  if (!plan.days.length) return null;
  return plan;
}

export async function fetchMealPlanFromSupabase(memberIds: string | string[]): Promise<MealPlan | null> {
  const ids = [...new Set((Array.isArray(memberIds) ? memberIds : [memberIds]).map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return null;
  const plans: MealPlan[] = [];
  for (const id of ids) {
    const plan = await fetchMealPlanRow(id);
    if (plan) plans.push(plan);
  }
  return pickPreferredMealPlan(plans);
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
  } catch {
    /* ignore */
  }
  return [...ids];
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

export function scheduleMealPlanCloudSave(ownerUserId: string, plan: MealPlan): void {
  if (!ownerUserId.trim() || !isSupabaseConfigured) return;
  pendingSave = { ownerUserId, plan };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = pendingSave;
    pendingSave = null;
    saveTimer = null;
    if (!payload) return;
    void saveMealPlanToSupabase(payload.ownerUserId, payload.plan);
  }, 700);
}

/** Sky er kilde når rad finnes; ellers push lokal plan én gang. */
export async function syncMealPlanForMember(
  memberId: string,
  ownerUserId: string,
): Promise<{ plan: MealPlan; cloudSynced: boolean }> {
  const lookupIds = await readLinkedMealPlanMemberIds(memberId);
  const trimmedMemberId = memberId.trim() || lookupIds[0] || "";
  const remote = await fetchMealPlanFromSupabase(lookupIds);
  const local = loadMealPlanForMember(trimmedMemberId);

  if (remote) {
    const preferred =
      local && countMealPlanFoodItems(local) > countMealPlanFoodItems(remote) && planUpdatedAtMs(local) > planUpdatedAtMs(remote)
        ? local
        : remote;
    if (!mealPlansEqual(loadMealPlanForMember(trimmedMemberId), preferred)) {
      persistMealPlan({ ...preferred, memberId: trimmedMemberId }, { notify: false });
    }
    return { plan: preferred, cloudSynced: true };
  }

  let fallback = local;
  if (!fallback) {
    fallback = createDefaultMealPlan(trimmedMemberId);
    persistMealPlan(fallback, { notify: false });
  }

  if (!ownerUserId.trim() || !isSupabaseConfigured) {
    return { plan: fallback, cloudSynced: false };
  }

  const uploaded = await saveMealPlanToSupabase(ownerUserId, fallback);
  return { plan: fallback, cloudSynced: uploaded };
}

/** Brukes etter hydrate-member-data — lagrer plan lokalt for medlem. */
export function applyHydratedMealPlan(plan: MealPlan): void {
  const memberId = plan.memberId.trim();
  if (!memberId || !plan.days.length) return;
  const existing = loadMealPlanForMember(memberId);
  const preferred = pickPreferredMealPlan(
    [existing, plan].filter((row): row is MealPlan => Boolean(row)),
  );
  if (!preferred || mealPlansEqual(existing, preferred)) return;
  persistMealPlan(preferred);
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

export function persistMealPlanLocalAndScheduleCloud(ownerUserId: string | undefined, plan: MealPlan): void {
  persistMealPlan(plan);
  if (ownerUserId?.trim()) scheduleMealPlanCloudSave(ownerUserId, plan);
}
