import type { FoodItem } from "./foodBankTypes";
import { computeMacrosForGrams, type MacroTotals } from "./mealPlanMacros";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { RecipeMealSlot } from "./recipeMealCategory";
import { roundRecipeGrams } from "./recipeIngredientSwap";
import {
  computeRecipeIngredients,
  computeRecipeMacros,
  formatIngredientDisplay,
  type RecipeIngredient,
  type RecipeIngredientFoodOverrides,
  type RecipeMacroResult,
} from "./recipeMacros";
import { EMPTY_MICRONUTRIENTS } from "./foodBankMicronutrients";

export type RecipeScalingMode = "flexible" | "fixed";

const MEAL_KCAL_SHARE: Record<RecipeMealSlot, number> = {
  frokost: 0.25,
  lunsj: 0.3,
  middag: 0.35,
  snack: 0.1,
};

export type ScaledRecipeView = {
  ingredients: RecipeIngredient[];
  macros: RecipeMacroResult;
  scaleFactor: number;
  scalingMode: RecipeScalingMode;
  targetMealKcal: number | null;
  basePerServingKcal: number;
  adjusted: boolean;
  viewServings: number;
  peopleScale: number;
};

export function targetKcalForRecipeMeal(
  dailyTargets: MealPlanTargets | undefined,
  mealSlot: RecipeMealSlot | null,
): number | null {
  const daily = dailyTargets?.kcal;
  if (!daily || daily <= 0) return null;
  const share = mealSlot ? MEAL_KCAL_SHARE[mealSlot] : 0.3;
  return Math.round(daily * share);
}

/** Kaloriskalering er av: mengdene følger oppskriften. Flere personer styres av peopleScale. */
export function computeIngredientScaleFactor(
  _basePerServingKcal?: number,
  _targetMealKcal?: number | null,
  _mode?: RecipeScalingMode,
): number {
  return 1;
}

export function resolveRecipeScalingMode(_input?: {
  id?: string;
  scalingMode?: RecipeScalingMode;
  body?: string;
  title?: string;
  tag?: string;
  servings?: number;
}): RecipeScalingMode {
  return "fixed";
}

function scaleIngredientRows(ingredients: RecipeIngredient[], factor: number): RecipeIngredient[] {
  if (Math.abs(factor - 1) < 0.03) return ingredients;
  return ingredients.map((row) => {
    const grams = roundRecipeGrams(row.grams * factor);
    const quantity = row.quantity != null ? row.quantity * factor : undefined;
    return {
      ...row,
      grams,
      quantity,
      macros: computeMacrosForGrams(row.nutritionPer100g, grams),
      displayAmount: formatIngredientDisplay(
        {
          searchText: row.searchText,
          quantity,
          unit: row.unit,
          grams: quantity == null ? grams : undefined,
        },
        grams,
        row.foodName,
      ),
    };
  });
}

function macrosFromIngredients(ingredients: RecipeIngredient[], servings: number): RecipeMacroResult {
  const totals = ingredients.reduce(
    (acc, row) => ({
      kcal: acc.kcal + row.macros.kcal,
      protein: acc.protein + row.macros.protein,
      carbs: acc.carbs + row.macros.carbs,
      fat: acc.fat + row.macros.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const safeServings = servings > 0 ? servings : 1;
  return {
    perServing: {
      kcal: totals.kcal / safeServings,
      protein: totals.protein / safeServings,
      carbs: totals.carbs / safeServings,
      fat: totals.fat / safeServings,
    },
    servings: safeServings,
    matchedCount: ingredients.length,
    ingredientCount: ingredients.length,
    perServingMicronutrients: { ...EMPTY_MICRONUTRIENTS },
  };
}

export function buildScaledRecipeView(
  body: string,
  foodItems: FoodItem[],
  options: {
    scalingMode: RecipeScalingMode;
    dailyTargets?: MealPlanTargets;
    mealSlot?: RecipeMealSlot | null;
    ingredientFoodOverrides?: RecipeIngredientFoodOverrides;
    servings?: number;
    viewServings?: number;
  },
): ScaledRecipeView | null {
  const baseMacros = computeRecipeMacros(body, foodItems, {
    servings: options.servings,
    ingredientFoodOverrides: options.ingredientFoodOverrides,
  });
  if (!baseMacros) return null;

  const baseIngredients = computeRecipeIngredients(body, foodItems, options.ingredientFoodOverrides);
  if (!baseIngredients.length) return null;

  const targetMealKcal = targetKcalForRecipeMeal(options.dailyTargets, options.mealSlot ?? null);
  const basePerServingKcal = baseMacros.perServing.kcal;
  const kcalScale = computeIngredientScaleFactor(basePerServingKcal, targetMealKcal, options.scalingMode);
  const baseServings = baseMacros.servings;
  const viewServings =
    typeof options.viewServings === "number" && Number.isFinite(options.viewServings) && options.viewServings > 0
      ? Math.max(1, Math.round(options.viewServings))
      : baseServings;
  const peopleScale = viewServings / baseServings;
  const scaleFactor = kcalScale * peopleScale;
  const ingredients = scaleIngredientRows(baseIngredients, scaleFactor);
  const macros = macrosFromIngredients(ingredients, viewServings);

  return {
    ingredients,
    macros,
    scaleFactor,
    scalingMode: options.scalingMode,
    targetMealKcal,
    basePerServingKcal,
    adjusted: options.scalingMode === "flexible" && Math.abs(kcalScale - 1) >= 0.03,
    viewServings,
    peopleScale,
  };
}

export function scaledPerServingTotals(view: ScaledRecipeView): MacroTotals {
  return { ...view.macros.perServing };
}
