import { createDefaultMealPlan } from "./mealPlanDefaults";
import { loadMealPlanForMember, persistMealPlan } from "./mealPlanStorage";
import type { MealPlan, MealPlanDay, MealPlanTargets } from "./mealPlanTypes";

function mealPlansEqual(a: MealPlan | null | undefined, b: MealPlan | null | undefined): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

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

function parseDays(value: unknown): MealPlanDay[] {
  if (!Array.isArray(value)) return [];
  return value.filter((day): day is MealPlanDay => Boolean(day && typeof day === "object" && typeof (day as MealPlanDay).label === "string"));
}

function mealPlanFromRow(memberId: string, row: Record<string, unknown>): MealPlan {
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

export async function fetchMealPlanFromSupabase(memberId: string): Promise<MealPlan | null> {
  if (!supabaseClient || !memberId.trim()) return null;
  const { data, error } = await supabaseClient
    .from("member_meal_plans")
    .select("member_id, title, notes, days, targets, updated_at")
    .eq("member_id", memberId.trim())
    .maybeSingle();
  if (error) {
    if (!isMealPlanTableMissing(error.message)) {
      console.warn("member_meal_plans fetch failed:", error.message);
    }
    return null;
  }
  if (!data) return null;
  const plan = mealPlanFromRow(memberId, data as Record<string, unknown>);
  if (!plan.days.length) return null;
  return plan;
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
  const trimmedMemberId = memberId.trim();
  const remote = await fetchMealPlanFromSupabase(trimmedMemberId);
  if (remote) {
    const cached = loadMealPlanForMember(trimmedMemberId);
    if (!mealPlansEqual(cached, remote)) {
      persistMealPlan(remote, { notify: false });
    }
    return { plan: remote, cloudSynced: true };
  }

  let local = loadMealPlanForMember(trimmedMemberId);
  if (!local) {
    local = createDefaultMealPlan(trimmedMemberId);
    persistMealPlan(local, { notify: false });
  }

  if (!ownerUserId.trim() || !isSupabaseConfigured) {
    return { plan: local, cloudSynced: false };
  }

  const uploaded = await saveMealPlanToSupabase(ownerUserId, local);
  return { plan: local, cloudSynced: uploaded };
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
