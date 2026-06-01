import { EMPTY_FATTY_ACIDS, normalizeFattyAcids } from "./foodBankFattyAcids";
import { hasMicronutrientData, normalizeMicronutrients } from "./foodBankMicronutrients";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import { parseInspirationRecipeFoodId } from "./mealPlanRecipeEntry";
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

export type MealPlanNutritionContext = {
  foodById?: Map<string, FoodItem>;
  /** recipe.id → nutrition per 100 g (én porsjon), fra computeRecipeMacros */
  recipeNutritionById?: Map<string, FoodNutrition>;
};

function pickMicronutrients(...sources: Array<FoodNutrition | undefined>): FoodNutrition["micronutrients"] {
  for (const source of sources) {
    if (source && hasMicronutrientData(source.micronutrients)) {
      return normalizeMicronutrients(source.micronutrients);
    }
  }
  return normalizeMicronutrients(undefined);
}

/** Makro + mikro for rapporter: fyller inn fra oppskrift/matvarebank når snapshot mangler mikronæringsstoffer. */
export function resolveEntryNutritionForTotals(
  entry: Pick<MealPlanFoodEntry, "foodId" | "nutritionPer100g">,
  context?: MealPlanNutritionContext,
): FoodNutrition {
  const snapshot = entry.nutritionPer100g ?? EMPTY_NUTRITION;
  const foodById = context?.foodById;
  const fromBank = foodById?.get(entry.foodId)?.nutritionPer100g;
  const recipeId = parseInspirationRecipeFoodId(entry.foodId);
  const fromRecipe = recipeId ? context?.recipeNutritionById?.get(recipeId) : undefined;

  let base: FoodNutrition;
  if (nutritionHasValues(snapshot)) base = { ...snapshot };
  else if (nutritionHasValues(fromRecipe)) base = { ...fromRecipe! };
  else if (nutritionHasValues(fromBank)) base = { ...fromBank! };
  else base = { ...snapshot };

  const micronutrients = pickMicronutrients(base, fromRecipe, fromBank);
  const fattyAcids = normalizeFattyAcids(base.fattyAcids ?? fromRecipe?.fattyAcids ?? fromBank?.fattyAcids);

  return {
    ...base,
    fiber: base.fiber || fromRecipe?.fiber || fromBank?.fiber || 0,
    sugar: base.sugar || fromRecipe?.sugar || fromBank?.sugar || 0,
    saturatedFat: base.saturatedFat || fromRecipe?.saturatedFat || fromBank?.saturatedFat || 0,
    sodium: base.sodium || fromRecipe?.sodium || fromBank?.sodium || 0,
    micronutrients,
    fattyAcids,
  };
}

/** Bruk lagret snapshot, eller slå opp matvarebanken når snapshot mangler (f.eks. eldre sky-rader). */
export function resolveEntryNutrition(
  entry: Pick<MealPlanFoodEntry, "foodId" | "nutritionPer100g">,
  foodById?: Map<string, FoodItem>,
): FoodNutrition {
  return resolveEntryNutritionForTotals(entry, { foodById });
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
