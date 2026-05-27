import type { FoodItem } from "./foodBankTypes";
import { formatMacro } from "./foodBankTypes";
import {
  computeMacrosForGrams,
  computeMealMacros,
  type MacroTotals,
  sumMacroTotals,
} from "./mealPlanMacros";
import type { MealPlan, MealPlanDay, MealPlanFoodEntry, MealPlanMeal, MealPlanTargets } from "./mealPlanTypes";
import { uid } from "./storage";

export type MacroRemaining = MacroTotals & {
  hasTargets: boolean;
};

export function targetsToTotals(targets?: MealPlanTargets): MacroTotals | null {
  if (!targets) return null;
  const kcal = targets.kcal ?? 0;
  const protein = targets.protein ?? 0;
  const carbs = targets.carbs ?? 0;
  const fat = targets.fat ?? 0;
  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return null;
  return { kcal, protein, carbs, fat };
}

export function remainingMacros(targets: MealPlanTargets | undefined, used: MacroTotals): MacroRemaining {
  const goal = targetsToTotals(targets);
  if (!goal) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, hasTargets: false };
  }
  return {
    kcal: goal.kcal - used.kcal,
    protein: goal.protein - used.protein,
    carbs: goal.carbs - used.carbs,
    fat: goal.fat - used.fat,
    hasTargets: true,
  };
}

export function macroUsagePct(used: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / target) * 100)));
}

export function formatRemainingShort(remaining: MacroRemaining): string {
  if (!remaining.hasTargets) return "";
  const parts: string[] = [];
  if (remaining.kcal !== 0) parts.push(`${formatMacro(remaining.kcal, 0)} kcal`);
  if (remaining.protein !== 0) parts.push(`P ${formatMacro(remaining.protein, 0)}`);
  if (remaining.carbs !== 0) parts.push(`K ${formatMacro(remaining.carbs, 0)}`);
  if (remaining.fat !== 0) parts.push(`F ${formatMacro(remaining.fat, 0)}`);
  return parts.join(" · ");
}

function normalizeMealKey(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("frokost")) return "frokost";
  if (n.includes("lunsj")) return "lunsj";
  if (n.includes("middag")) return "middag";
  if (n.includes("snack") || n.includes("mellom")) return "snacks";
  return "other";
}

/** Standard andeler: frokost 25 %, lunsj 30 %, middag 35 %, snacks 10 %. */
const STANDARD_MEAL_SHARES: Record<string, number> = {
  frokost: 0.25,
  lunsj: 0.3,
  middag: 0.35,
  snacks: 0.1,
  other: 0,
};

export type DistributeMode = "equal" | "standard";

export function distributeDailyTargetsToMeals(
  day: MealPlanDay,
  dailyTargets: MealPlanTargets,
  mode: DistributeMode = "standard",
): MealPlanMeal[] {
  const meals = day.meals.length ? day.meals : [];
  if (!meals.length) return meals;

  const goal = targetsToTotals(dailyTargets);
  if (!goal) return meals;

  if (mode === "equal") {
    const share = 1 / meals.length;
    return meals.map((meal) => ({
      ...meal,
      targets: scaleTargets(dailyTargets, share),
    }));
  }

  const shares = meals.map((meal) => {
    const key = normalizeMealKey(meal.name);
    const share = STANDARD_MEAL_SHARES[key] ?? 0;
    return { meal, share };
  });
  let assigned = shares.reduce((sum, row) => sum + row.share, 0);
  if (assigned <= 0) {
    const share = 1 / meals.length;
    return meals.map((meal) => ({ ...meal, targets: scaleTargets(dailyTargets, share) }));
  }
  if (assigned < 0.99) {
    const otherMeals = shares.filter((row) => row.share === 0);
    const extra = (1 - assigned) / Math.max(1, otherMeals.length);
    for (const row of otherMeals) row.share = extra;
    assigned = 1;
  } else if (assigned > 1) {
    for (const row of shares) row.share /= assigned;
  }

  return shares.map(({ meal, share }) => ({
    ...meal,
    targets: scaleTargets(dailyTargets, share),
  }));
}

function scaleTargets(targets: MealPlanTargets, share: number): MealPlanTargets {
  const out: MealPlanTargets = {};
  if (targets.kcal) out.kcal = Math.round(targets.kcal * share);
  if (targets.protein) out.protein = Math.round(targets.protein * share * 10) / 10;
  if (targets.carbs) out.carbs = Math.round(targets.carbs * share * 10) / 10;
  if (targets.fat) out.fat = Math.round(targets.fat * share * 10) / 10;
  return out;
}

export type FoodSuggestion = {
  food: FoodItem;
  macros: MacroTotals;
  score: number;
  reason: string;
};

export function suggestFoodsForMacros(
  foods: FoodItem[],
  remaining: MacroRemaining,
  limit = 8,
): FoodSuggestion[] {
  if (!remaining.hasTargets) return [];

  const needProtein = remaining.protein > 8;
  const needKcal = remaining.kcal > 150;
  const needCarbs = remaining.carbs > 15;
  const needFat = remaining.fat > 5;

  const scored: FoodSuggestion[] = [];

  for (const food of foods) {
    const grams = food.portionGrams > 0 ? food.portionGrams : 100;
    const macros = computeMacrosForGrams(food.nutritionPer100g, grams);
    if (macros.kcal <= 0) continue;

    if (macros.kcal > remaining.kcal * 1.15 && remaining.kcal > 0) continue;
    if (macros.protein > remaining.protein * 1.2 && remaining.protein > 0) continue;

    let score = 0;
    const reasons: string[] = [];

    if (needProtein && macros.protein >= 8) {
      score += macros.protein * 2;
      reasons.push("protein");
    }
    if (needKcal && macros.kcal >= 80 && macros.kcal <= remaining.kcal) {
      score += macros.kcal * 0.05;
      reasons.push("energi");
    }
    if (needCarbs && macros.carbs >= 10) {
      score += macros.carbs * 0.5;
      reasons.push("karb");
    }
    if (needFat && macros.fat >= 3) {
      score += macros.fat * 0.8;
      reasons.push("fett");
    }
    if (food.category === "proteinkilder" && needProtein) score += 12;
    if (food.category === "gronnsaker" && remaining.kcal > 400) score += 4;

    if (score <= 0) continue;

    scored.push({
      food,
      macros,
      score,
      reason: reasons.slice(0, 2).join(" + ") || "passer budsjett",
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function cloneMealItems(items: MealPlanFoodEntry[]): MealPlanFoodEntry[] {
  return items.map((item) => ({
    ...item,
    id: uid("meal-food"),
    nutritionPer100g: { ...item.nutritionPer100g },
  }));
}

function findMealSlot(day: MealPlanDay, sourceMeal: MealPlanMeal): MealPlanMeal | undefined {
  const key = normalizeMealKey(sourceMeal.name);
  const byName = day.meals.find((m) => normalizeMealKey(m.name) === key);
  if (byName) return byName;
  const idx = day.meals.findIndex((m) => m.id === sourceMeal.id);
  if (idx >= 0) return day.meals[idx];
  return day.meals[0];
}

/** Kopierer måltidets matvarer til samme måltidsnavn på valgte dager. */
export function copyMealToDays(
  plan: MealPlan,
  sourceDayId: string,
  sourceMealId: string,
  targetDayIds: string[],
  mode: "replace" | "append" = "append",
): MealPlan {
  const sourceDay = plan.days.find((d) => d.id === sourceDayId);
  const sourceMeal = sourceDay?.meals.find((m) => m.id === sourceMealId);
  if (!sourceDay || !sourceMeal || sourceMeal.items.length === 0) return plan;

  const clones = cloneMealItems(sourceMeal.items);
  const targetSet = new Set(targetDayIds.filter((id) => id !== sourceDayId));

  return {
    ...plan,
    days: plan.days.map((day) => {
      if (!targetSet.has(day.id)) return day;
      const slot = findMealSlot(day, sourceMeal);
      if (!slot) return day;
      return {
        ...day,
        meals: day.meals.map((meal) => {
          if (meal.id !== slot.id) return meal;
          const items = mode === "replace" ? clones : [...meal.items, ...cloneMealItems(sourceMeal.items)];
          return { ...meal, items };
        }),
      };
    }),
  };
}

export function previewFoodAddition(
  food: FoodItem,
  grams: number,
  remaining: MacroRemaining,
): { macros: MacroTotals; after: MacroRemaining } {
  const macros = computeMacrosForGrams(food.nutritionPer100g, grams);
  const pseudoTargets: MealPlanTargets = {
    kcal: remaining.kcal + macros.kcal,
    protein: remaining.protein + macros.protein,
    carbs: remaining.carbs + macros.carbs,
    fat: remaining.fat + macros.fat,
  };
  return {
    macros,
    after: {
      kcal: remaining.kcal - macros.kcal,
      protein: remaining.protein - macros.protein,
      carbs: remaining.carbs - macros.carbs,
      fat: remaining.fat - macros.fat,
      hasTargets: remaining.hasTargets,
    },
  };
}

export function sumDayMacros(day: MealPlanDay, foodById?: Map<string, FoodItem>): MacroTotals {
  return sumMacroTotals(day.meals.map((meal) => computeMealMacros(meal, foodById)));
}

export function mealRemaining(meal: MealPlanMeal, foodById?: Map<string, FoodItem>): MacroRemaining {
  const used = computeMealMacros(meal, foodById);
  return remainingMacros(meal.targets, used);
}
