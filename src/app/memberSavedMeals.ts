import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

export type MemberSavedMealItem = {
  name: string;
  grams: number;
  source: MemberQuickFoodLogEntry["source"];
  nutritionPer100g: MemberQuickFoodLogEntry["nutritionPer100g"];
};

export type MemberSavedMeal = {
  id: string;
  name: string;
  /** Måltidsplass (member-frokost eller matplan-måltid-id). */
  mealSlotId?: string;
  items: MemberSavedMealItem[];
  createdAt: string;
  updatedAt: string;
};

export function parseMemberSavedMeals(value: unknown): MemberSavedMeal[] {
  if (!Array.isArray(value)) return [];
  const meals: MemberSavedMeal[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    const name = String(r.name ?? "").trim();
    if (!id || !name) continue;
    const itemsRaw = r.items;
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) continue;
    const items: MemberSavedMealItem[] = [];
    for (const itemRow of itemsRaw) {
      if (!itemRow || typeof itemRow !== "object") continue;
      const item = itemRow as Record<string, unknown>;
      const itemName = String(item.name ?? "").trim();
      const grams = Number(item.grams);
      const nutrition = item.nutritionPer100g ?? item.nutrition_per_100g;
      if (!itemName || !Number.isFinite(grams) || grams <= 0 || !nutrition || typeof nutrition !== "object") continue;
      const n = nutrition as Record<string, unknown>;
      items.push({
        name: itemName,
        grams,
        source: item.source === "recipe" || item.source === "ai" ? item.source : "food",
        nutritionPer100g: {
          kcal: Number(n.kcal) || 0,
          protein: Number(n.protein) || 0,
          carbs: Number(n.carbs) || 0,
          fat: Number(n.fat) || 0,
          fiber: Number(n.fiber) || 0,
          sugar: Number(n.sugar) || 0,
          saturatedFat: Number(n.saturatedFat ?? n.saturated_fat) || 0,
          sodium: Number(n.sodium) || 0,
          water: Number(n.water) || 0,
        },
      });
    }
    if (!items.length) continue;
    const mealSlotId = String(r.mealSlotId ?? r.meal_slot_id ?? "").trim() || undefined;
    const createdAt = String(r.createdAt ?? r.created_at ?? "").trim() || new Date().toISOString();
    const updatedAt = String(r.updatedAt ?? r.updated_at ?? "").trim() || createdAt;
    meals.push({ id, name, mealSlotId, items, createdAt, updatedAt });
  }
  return meals.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function mergeMemberSavedMeals(a: MemberSavedMeal[], b: MemberSavedMeal[]): MemberSavedMeal[] {
  const byId = new Map<string, MemberSavedMeal>();
  for (const meal of [...a, ...b]) {
    const existing = byId.get(meal.id);
    if (!existing || Date.parse(meal.updatedAt) >= Date.parse(existing.updatedAt)) {
      byId.set(meal.id, meal);
    }
  }
  return [...byId.values()].sort((x, y) => Date.parse(y.updatedAt) - Date.parse(x.updatedAt));
}

export function savedMealsForSlot(savedMeals: MemberSavedMeal[], mealSlotId: string): MemberSavedMeal[] {
  const slot = mealSlotId.trim();
  return savedMeals.filter((meal) => !meal.mealSlotId || meal.mealSlotId === slot);
}

export function createSavedMealFromQuickLogs(
  entries: MemberQuickFoodLogEntry[],
  name: string,
  mealSlotId?: string,
): MemberSavedMeal {
  const now = new Date().toISOString();
  return {
    id: `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    mealSlotId: mealSlotId?.trim() || undefined,
    items: entries.map((entry) => ({
      name: entry.name,
      grams: entry.grams,
      source: entry.source,
      nutritionPer100g: { ...entry.nutritionPer100g },
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function quickLogEntriesFromSavedMeal(meal: MemberSavedMeal, targetMealId: string): MemberQuickFoodLogEntry[] {
  const mealId = targetMealId.trim();
  const base = Date.now();
  return meal.items.map((item, index) => ({
    id: `log-${base.toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: item.name,
    grams: item.grams,
    source: item.source,
    mealId,
    loggedAt: new Date().toISOString(),
    nutritionPer100g: { ...item.nutritionPer100g },
  }));
}

export function defaultSavedMealName(entries: MemberQuickFoodLogEntry[], slotLabel: string): string {
  if (!entries.length) return slotLabel;
  if (entries.length === 1) return entries[0]!.name;
  return `${entries[0]!.name} m.m.`;
}

export function addSavedMealToState(savedMeals: MemberSavedMeal[], meal: MemberSavedMeal): MemberSavedMeal[] {
  return [meal, ...savedMeals.filter((row) => row.id !== meal.id)];
}

export function removeSavedMealFromState(savedMeals: MemberSavedMeal[], mealId: string): MemberSavedMeal[] {
  return savedMeals.filter((meal) => meal.id !== mealId);
}
