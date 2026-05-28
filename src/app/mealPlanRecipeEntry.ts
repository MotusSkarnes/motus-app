import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { FoodItem } from "./foodBankTypes";
import type { MealPlanFoodEntry, MealPlanTargets } from "./mealPlanTypes";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "./recipeMealScaling";
import type { RecipeMealSlot } from "./recipeMealCategory";
import { extractRecipeIngredientLines } from "./recipeMacros";
import { uid } from "./storage";

/** Én matplanrad = 1 porsjon oppskrift (100 g brukes som visningsenhet for makroene). */
const RECIPE_PORTION_GRAMS = 100;

export const INSPIRATION_RECIPE_FOOD_PREFIX = "inspo-recipe-";

export function parseInspirationRecipeFoodId(foodId: string): string | null {
  if (!foodId.startsWith(INSPIRATION_RECIPE_FOOD_PREFIX)) return null;
  const id = foodId.slice(INSPIRATION_RECIPE_FOOD_PREFIX.length).trim();
  return id || null;
}

export function isInspirationRecipeFoodEntry(foodId: string): boolean {
  return Boolean(parseInspirationRecipeFoodId(foodId));
}

const EMPTY_NUTRITION = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  saturatedFat: 0,
  sodium: 0,
};

function resolveFoodBank(foodItems: FoodItem[]): FoodItem[] {
  return foodItems.length > 0 ? foodItems : buildDefaultFoodBankItems();
}

/** Legger alltid til oppskrift i matplanen; makroer beregnes når ingredienslisten kan parses. */
export function recipeToMealPlanEntry(
  recipe: InspirationRecipeItem,
  foodItems: FoodItem[],
  options?: {
    dailyTargets?: MealPlanTargets;
    mealSlot?: RecipeMealSlot | null;
  },
): MealPlanFoodEntry {
  const bank = resolveFoodBank(foodItems);
  const body = recipe.body.trim() || recipe.description.trim();
  const scalingMode = resolveRecipeScalingMode({
    id: recipe.id,
    scalingMode: recipe.scalingMode,
    body,
    title: recipe.title,
    tag: recipe.tag,
  });
  const scaled = body
    ? buildScaledRecipeView(body, bank, {
        scalingMode,
        dailyTargets: options?.dailyTargets,
        mealSlot: options?.mealSlot ?? null,
      })
    : null;
  const ingredientLines = body ? extractRecipeIngredientLines(body) : [];

  if (scaled) {
    const per = scaled.macros.perServing;
    const adjustedNote =
      scaled.adjusted && scaled.targetMealKcal
        ? ` · tilpasset ca. ${scaled.targetMealKcal} kcal`
        : "";
    const partial =
      scaled.macros.matchedCount < scaled.macros.ingredientCount
        ? `${scaled.macros.matchedCount}/${scaled.macros.ingredientCount} ingredienser`
        : undefined;
    return {
      id: uid("meal-food"),
      foodId: `inspo-recipe-${recipe.id}`,
      foodName: recipe.title,
      grams: RECIPE_PORTION_GRAMS,
      imageUrl: recipe.imageUrl?.trim() || undefined,
      note: partial
        ? `Oppskrift · ${partial}${adjustedNote}`
        : `Oppskrift · 1 porsjon${adjustedNote}`,
      nutritionPer100g: {
        kcal: Math.round(per.kcal),
        protein: Math.round(per.protein * 10) / 10,
        carbs: Math.round(per.carbs * 10) / 10,
        fat: Math.round(per.fat * 10) / 10,
        fiber: 0,
        sugar: 0,
        saturatedFat: 0,
        sodium: 0,
        micronutrients: { ...scaled.macros.perServingMicronutrients },
      },
    };
  }

  const note =
    ingredientLines.length === 0
      ? "Oppskrift · legg til **Ingredienser** med punktliste under Ernæring for makro"
      : "Oppskrift · makro ikke beregnet (sjekk ingrediensformat)";

  return {
    id: uid("meal-food"),
    foodId: `inspo-recipe-${recipe.id}`,
    foodName: recipe.title,
    grams: RECIPE_PORTION_GRAMS,
    imageUrl: recipe.imageUrl?.trim() || undefined,
    note,
    nutritionPer100g: { ...EMPTY_NUTRITION },
  };
}
