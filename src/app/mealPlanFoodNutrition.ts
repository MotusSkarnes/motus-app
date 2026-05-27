import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import type { MealPlan, MealPlanFoodEntry } from "./mealPlanTypes";

const EMPTY_NUTRITION: FoodNutrition = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
};

function nutritionHasValues(nutrition: FoodNutrition | undefined): boolean {
  if (!nutrition) return false;
  return nutrition.kcal > 0 || nutrition.protein > 0 || nutrition.carbs > 0 || nutrition.fat > 0;
}

/** Bruk lagret snapshot, eller slå opp matvarebanken når snapshot mangler (f.eks. eldre sky-rader). */
export function resolveEntryNutrition(
  entry: Pick<MealPlanFoodEntry, "foodId" | "nutritionPer100g">,
  foodById?: Map<string, FoodItem>,
): FoodNutrition {
  const snapshot = entry.nutritionPer100g;
  if (nutritionHasValues(snapshot)) return snapshot;
  const fromBank = foodById?.get(entry.foodId)?.nutritionPer100g;
  if (nutritionHasValues(fromBank)) return fromBank!;
  return snapshot ?? EMPTY_NUTRITION;
}

export function foodItemsToById(foodItems: FoodItem[]): Map<string, FoodItem> {
  return new Map(foodItems.map((food) => [food.id, food]));
}

/** Fyller inn manglende nutritionPer100g fra matvarebanken før makroberegning. */
export function hydrateMealPlanFoodNutrition(plan: MealPlan, foodItems: FoodItem[]): MealPlan {
  if (!foodItems.length) return plan;
  const foodById = foodItemsToById(foodItems);
  let changed = false;

  const days = plan.days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => ({
      ...meal,
      items: meal.items.map((item) => {
        const resolved = resolveEntryNutrition(item, foodById);
        if (!nutritionHasValues(item.nutritionPer100g) && nutritionHasValues(resolved)) {
          changed = true;
          return { ...item, nutritionPer100g: { ...resolved } };
        }
        return item;
      }),
    })),
  }));

  return changed ? { ...plan, days } : plan;
}
