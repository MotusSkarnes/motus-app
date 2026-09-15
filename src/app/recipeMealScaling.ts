import type { FoodItem } from "./foodBankTypes";
import { computeMacrosForGrams, type MacroTotals } from "./mealPlanMacros";
import type { MealPlanTargets } from "./mealPlanTypes";
import { DEFAULT_RECIPE_SCALING_BY_ID } from "./defaultInspirationRecipes";
import type { RecipeMealSlot } from "./recipeMealCategory";
import { roundRecipeGrams } from "./recipeIngredientSwap";
import {
  computeRecipeIngredients,
  computeRecipeMacros,
  formatIngredientDisplay,
  parseRecipeServings,
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

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.55;

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

export function computeIngredientScaleFactor(
  basePerServingKcal: number,
  targetMealKcal: number | null,
  mode: RecipeScalingMode,
): number {
  if (mode === "fixed" || !targetMealKcal || basePerServingKcal <= 0) return 1;
  const raw = targetMealKcal / basePerServingKcal;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

export function resolveRecipeScalingMode(input: {
  id?: string;
  scalingMode?: RecipeScalingMode;
  body: string;
  title?: string;
  tag?: string;
  servings?: number;
}): RecipeScalingMode {
  if (input.scalingMode === "flexible" || input.scalingMode === "fixed") return input.scalingMode;
  const fromDefault = input.id ? DEFAULT_RECIPE_SCALING_BY_ID.get(input.id) : undefined;
  if (fromDefault) return fromDefault;

  const servings = parseRecipeServings(input.body, input.servings);
  const hay = `${input.tag ?? ""} ${input.title ?? ""}`.toLowerCase();

  if (servings > 1) return "fixed";
  if (/brødskive|rugbrød|riskaker|bolo|bolognese|4 porsjon|omelett|vafler|kake|brownies/.test(hay)) {
    return "fixed";
  }
  return "flexible";
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
