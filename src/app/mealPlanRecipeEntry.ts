import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { FoodItem } from "./foodBankTypes";
import type { MealPlanFoodEntry } from "./mealPlanTypes";
import { computeRecipeMacros, extractRecipeIngredientLines } from "./recipeMacros";
import { uid } from "./storage";

/** Én matplanrad = 1 porsjon oppskrift (100 g brukes som visningsenhet for makroene). */
const RECIPE_PORTION_GRAMS = 100;

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
): MealPlanFoodEntry {
  const bank = resolveFoodBank(foodItems);
  const body = recipe.body.trim() || recipe.description.trim();
  const result = body ? computeRecipeMacros(body, bank) : null;
  const ingredientLines = body ? extractRecipeIngredientLines(body) : [];

  if (result) {
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

  const note =
    ingredientLines.length === 0
      ? "Oppskrift · legg til **Ingredienser** med punktliste i Utforsk for makro"
      : "Oppskrift · makro ikke beregnet (sjekk ingrediensformat)";

  return {
    id: uid("meal-food"),
    foodId: `inspo-recipe-${recipe.id}`,
    foodName: recipe.title,
    grams: RECIPE_PORTION_GRAMS,
    note,
    nutritionPer100g: { ...EMPTY_NUTRITION },
  };
}
