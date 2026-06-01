import { parseInspirationRecipeFoodId } from "./mealPlanRecipeEntry";
import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import type { FoodItem } from "./foodBankTypes";
import { mealNameToSlotId, mealSlotLabelFromId } from "./mealPlanMealSlots";
import { computeMealMacros, type MacroTotals } from "./mealPlanMacros";
import { mealPlanDayHasFood } from "./mealPlanNutritionTotals";
import { sumDayMacros } from "./mealPlanTrainerMacros";
import type { MealPlan, MealPlanDay, MealPlanMeal } from "./mealPlanTypes";
import { uid } from "./storage";

/** @deprecated Bruk getPlannerMealSlotsForPlan(plan) — beholdt for eldre tester. */
export const PLANNER_MEAL_SLOTS = ["Frokost", "Lunsj", "Middag", "Mellommåltid"] as const;
const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"] as const;

export function normalizeMealSlotName(name: string): string {
  const slotId = mealNameToSlotId(name);
  if (slotId) return mealSlotLabelFromId(slotId);
  return name.trim();
}

export function findMealForSlot(day: MealPlanDay, slotLabel: string): MealPlanMeal | undefined {
  const target = slotLabel.trim().toLowerCase();
  return (
    day.meals.find((meal) => normalizeMealSlotName(meal.name).toLowerCase() === target) ??
    day.meals.find((meal) => meal.name.trim().toLowerCase().includes(target.slice(0, 4)))
  );
}

export function mealCellDisplayTitle(meal: MealPlanMeal): string {
  if (meal.items.length === 0) return "";
  if (meal.items.length === 1) return meal.items[0].foodName;
  return meal.items[0].foodName;
}

export function resolveMealCellImage(
  meal: MealPlanMeal,
  foodById: Map<string, FoodItem>,
  recipesById: Map<string, InspirationRecipeItem>,
): string | null {
  for (const item of meal.items) {
    if (item.imageUrl?.trim()) return item.imageUrl.trim();
    const recipeId = parseInspirationRecipeFoodId(item.foodId);
    if (recipeId) {
      const url = recipesById.get(recipeId)?.imageUrl?.trim();
      if (url) return url;
    }
    const foodUrl = foodById.get(item.foodId)?.imageUrl?.trim();
    if (foodUrl) return foodUrl;
  }
  return null;
}

export function averageWeekMacros(plan: MealPlan, foodById: Map<string, FoodItem>): MacroTotals {
  if (!plan.days.length) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }
  let daysWithFood = 0;
  const totals = plan.days.reduce(
    (acc, day) => {
      if (!mealPlanDayHasFood(day)) return acc;
      daysWithFood += 1;
      const dayTotals = sumDayMacros(day, foodById);
      return {
        kcal: acc.kcal + dayTotals.kcal,
        protein: acc.protein + dayTotals.protein,
        carbs: acc.carbs + dayTotals.carbs,
        fat: acc.fat + dayTotals.fat,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  if (daysWithFood === 0) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }
  return {
    kcal: totals.kcal / daysWithFood,
    protein: totals.protein / daysWithFood,
    carbs: totals.carbs / daysWithFood,
    fat: totals.fat / daysWithFood,
  };
}

export function autoFillWeekFromMonday(plan: MealPlan): MealPlan {
  if (!plan.days.length) return plan;
  return {
    ...plan,
    days: plan.days.map((day, dayIndex) => {
      if (dayIndex % 7 === 0) return day;
      const monday = plan.days[dayIndex - (dayIndex % 7)];
      if (!monday) return day;
      return {
        ...day,
        meals: day.meals.map((meal) => {
          const slot = normalizeMealSlotName(meal.name);
          const sourceMeal = findMealForSlot(monday, slot);
          if (!sourceMeal?.items.length) return meal;
          return {
            ...meal,
            items: sourceMeal.items.map((item) => ({
              ...item,
              id: uid("meal-food"),
            })),
          };
        }),
      };
    }),
  };
}

function dayLabelForIndex(dayIndex: number, totalWeeks: number): string {
  const weekday = WEEKDAY_LABELS[dayIndex % 7];
  if (totalWeeks <= 1) return weekday;
  return `${weekday} (uke ${Math.floor(dayIndex / 7) + 1})`;
}

function createEmptyMealsFromTemplate(templateDay?: MealPlanDay): MealPlanMeal[] {
  if (templateDay?.meals?.length) {
    return templateDay.meals.map((meal) => ({
      ...meal,
      id: uid("meal"),
      items: [],
    }));
  }
  return PLANNER_MEAL_SLOTS.map((slot) => ({
    id: uid("meal"),
    name: slot,
    items: [],
  }));
}

export { getPlannerMealSlotsForPlan } from "./mealPlanMealSlots";

export function resizeMealPlanWeeks(plan: MealPlan, requestedWeeks: number): MealPlan {
  const weeks = Math.max(1, Math.min(12, Math.round(requestedWeeks)));
  const dayCount = weeks * 7;
  const nextDays: MealPlanDay[] = [];
  for (let index = 0; index < dayCount; index += 1) {
    const existingDay = plan.days[index];
    if (existingDay) {
      nextDays.push({
        ...existingDay,
        label: dayLabelForIndex(index, weeks),
      });
      continue;
    }
    const templateDay = plan.days[index % 7];
    nextDays.push({
      id: uid("day"),
      label: dayLabelForIndex(index, weeks),
      meals: createEmptyMealsFromTemplate(templateDay),
    });
  }
  return {
    ...plan,
    days: nextDays,
  };
}

export function planMatchesTargets(used: MacroTotals, targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number }): boolean {
  if (!targets?.kcal) return false;
  const within = (value: number, target: number | undefined) =>
    !target || target <= 0 || Math.abs(value - target) / target <= 0.08;
  return (
    within(used.kcal, targets.kcal) &&
    within(used.protein, targets.protein) &&
    within(used.carbs, targets.carbs) &&
    within(used.fat, targets.fat)
  );
}
