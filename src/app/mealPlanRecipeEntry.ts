import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import type { FoodItem } from "./foodBankTypes";
import type { MealPlanFoodEntry } from "./mealPlanTypes";
import { computeRecipeMacros } from "./recipeMacros";
import { uid } from "./storage";

/** Én matplanrad = 1 porsjon oppskrift (100 g brukes som visningsenhet for makroene). */
const RECIPE_PORTION_GRAMS = 100;

export function recipeToMealPlanEntry(
  recipe: InspirationRecipeItem,
  foodItems: FoodItem[],
): MealPlanFoodEntry | null {
  const result = computeRecipeMacros(recipe.body, foodItems);
  if (!result) return null;
  const per = result.perServing;
  const partial =
    result.matchedCount < result.ingredientCount
      ? `${result.matchedCount}/${result.ingredientCount} ingredienser`
      : undefined;
  return {
    id: uid("meal-food"),
    foodId: `inspo-recipe-${recipe.id}`,
    foodName: recipe.title,
    grams: RECIPE_PORTION_GRAMS,
    note: partial ? `Oppskrift · ${partial}` : "Oppskrift · 1 porsjon",
    nutritionPer100g: {
      kcal: Math.round(per.kcal),
      protein: Math.round(per.protein * 10) / 10,
      carbs: Math.round(per.carbs * 10) / 10,
      fat: Math.round(per.fat * 10) / 10,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
  };
}
