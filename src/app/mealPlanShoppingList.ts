import type { FoodItem } from "./foodBankTypes";
import type { MealPlan } from "./mealPlanTypes";

export type ShoppingListGroup = {
  id: string;
  label: string;
  items: { key: string; name: string; grams: number }[];
};

const CATEGORY_LABELS: Record<string, string> = {
  proteinkilder: "Proteiner",
  karbohydrater: "Karbohydrater",
  fettkilder: "Fett",
  gronnsaker: "Grønnsaker",
  "frukt-baer": "Frukt & bær",
  meieriprodukter: "Meieri",
  annet: "Annet",
};

export function buildWeeklyShoppingList(plan: MealPlan, foodById: Map<string, FoodItem>): ShoppingListGroup[] {
  const totals = new Map<string, { name: string; grams: number; category: string }>();

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const food = foodById.get(item.foodId);
        const category = food?.category ?? "annet";
        const key = item.foodId || item.foodName;
        const existing = totals.get(key);
        if (existing) {
          existing.grams += item.grams;
        } else {
          totals.set(key, { name: item.foodName, grams: item.grams, category });
        }
      }
    }
  }

  const byCategory = new Map<string, { key: string; name: string; grams: number }[]>();
  for (const [key, row] of totals) {
    const list = byCategory.get(row.category) ?? [];
    list.push({ key, name: row.name, grams: Math.round(row.grams) });
    byCategory.set(row.category, list);
  }

  const order = ["proteinkilder", "karbohydrater", "meieriprodukter", "gronnsaker", "frukt-baer", "fettkilder", "annet"];
  const groups: ShoppingListGroup[] = [];

  for (const catId of order) {
    const items = byCategory.get(catId);
    if (!items?.length) continue;
    groups.push({
      id: catId,
      label: CATEGORY_LABELS[catId] ?? catId,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "nb")),
    });
    byCategory.delete(catId);
  }

  for (const [catId, items] of byCategory) {
    groups.push({
      id: catId,
      label: CATEGORY_LABELS[catId] ?? catId,
      items: items.sort((a, b) => a.name.localeCompare(b.name, "nb")),
    });
  }

  return groups;
}
