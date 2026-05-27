import type { FoodCategoryId, FoodItem, FoodNutrition } from "./foodBankTypes";
import { computeMacrosForGrams, type MacroTotals } from "./mealPlanMacros";

const MACRO_WEIGHTS: Record<keyof MacroTotals, number> = {
  kcal: 2,
  protein: 1,
  carbs: 1.5,
  fat: 1,
};

/** Gram target-food som gir tilnærmet samme energi og makroer som `sourceMacros`. */
export function gramsForEquivalentMacros(sourceMacros: MacroTotals, targetPer100g: FoodNutrition): number {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const key of Object.keys(MACRO_WEIGHTS) as (keyof MacroTotals)[]) {
    const w = MACRO_WEIGHTS[key];
    const per100 = targetPer100g[key];
    const sourceVal = sourceMacros[key];
    if (per100 > 0.05 && sourceVal > 0.05) {
      weightedSum += (sourceVal / per100) * 100 * w;
      weightTotal += w;
    }
  }

  if (weightTotal > 0) return weightedSum / weightTotal;

  if (targetPer100g.kcal > 0 && sourceMacros.kcal > 0) {
    return (sourceMacros.kcal / targetPer100g.kcal) * 100;
  }

  return 0;
}

function macroProfileDistance(a: FoodNutrition, b: FoodNutrition): number {
  const scale = Math.max(a.kcal, b.kcal, 80);
  const nk = (a.kcal - b.kcal) / scale;
  const np = (a.protein - b.protein) / 40;
  const nc = (a.carbs - b.carbs) / 50;
  const nf = (a.fat - b.fat) / 30;
  return nk * nk + np * np + nc * nc + nf * nf;
}

export type RecipeIngredientSwapOption = {
  food: FoodItem;
  equivalentGrams: number;
  equivalentMacros: MacroTotals;
  distance: number;
};

export function findRecipeIngredientSwapOptions(
  sourceMacros: MacroTotals,
  sourcePer100g: FoodNutrition,
  sourceCategory: FoodCategoryId,
  sourceFoodId: string,
  foodItems: FoodItem[],
  limit = 10,
): RecipeIngredientSwapOption[] {
  const options: RecipeIngredientSwapOption[] = [];

  for (const food of foodItems) {
    if (food.id === sourceFoodId) continue;
    if (food.category !== sourceCategory) continue;
    const equivalentGrams = gramsForEquivalentMacros(sourceMacros, food.nutritionPer100g);
    if (equivalentGrams <= 0) continue;
    options.push({
      food,
      equivalentGrams,
      equivalentMacros: computeMacrosForGrams(food.nutritionPer100g, equivalentGrams),
      distance: macroProfileDistance(sourcePer100g, food.nutritionPer100g),
    });
  }

  options.sort((a, b) => a.distance - b.distance);
  return options.slice(0, limit);
}

export function roundRecipeGrams(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  if (grams < 15) return Math.round(grams);
  if (grams < 100) return Math.round(grams / 5) * 5;
  return Math.round(grams / 10) * 10;
}
