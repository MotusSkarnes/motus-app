import type { FoodItem } from "./foodBankTypes";
import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import type { MealDraftItem } from "./mealDraft";
import { canonicalMemberMealSlotId, MEMBER_MEAL_SLOTS } from "./memberMealSlots";
import { recipeMealSlotFor, type RecipeMealSlot } from "./recipeMealCategory";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "./recipeMealScaling";
import type { RecipeIngredient } from "./recipeMacros";

export function memberMealSlotIdFromRecipeSlot(slot: RecipeMealSlot | null | undefined): string {
  if (!slot) return MEMBER_MEAL_SLOTS[0]!.id;
  const hint = slot === "snack" ? "mellommaltid" : slot;
  return canonicalMemberMealSlotId(hint) ?? MEMBER_MEAL_SLOTS[0]!.id;
}

export function memberMealSlotIdFromRecipe(
  item: Parameters<typeof recipeMealSlotFor>[0],
  preferred?: RecipeMealSlot | null,
): string {
  return memberMealSlotIdFromRecipeSlot(recipeMealSlotFor(item, preferred));
}

export function mealDraftItemsFromRecipeIngredients(ingredients: RecipeIngredient[]): MealDraftItem[] {
  return ingredients
    .filter((row) => row.grams > 0 && row.foodName.trim())
    .map((row) => ({
      id: `draft-recipe-${row.key}`,
      name: row.foodName.trim(),
      grams: row.grams,
      source: "food",
      foodId: row.foodId,
      nutritionPer100g: { ...row.nutritionPer100g },
    }));
}

export function buildRecipeMealDraftItems(
  item: Pick<InspirationRecipeItem, "id" | "title" | "tag" | "body" | "servings" | "scalingMode" | "ingredientFoodOverrides">,
  foodItems: FoodItem[],
  options?: { viewServings?: number; mealSlot?: RecipeMealSlot | null },
): MealDraftItem[] {
  const view = buildScaledRecipeView(item.body, foodItems, {
    scalingMode: resolveRecipeScalingMode({
      id: item.id,
      scalingMode: item.scalingMode,
      body: item.body,
      title: item.title,
      tag: item.tag,
      servings: item.servings,
    }),
    servings: item.servings,
    viewServings: options?.viewServings,
    ingredientFoodOverrides: item.ingredientFoodOverrides,
    mealSlot: options?.mealSlot,
  });
  if (!view) return [];
  return mealDraftItemsFromRecipeIngredients(view.ingredients);
}
