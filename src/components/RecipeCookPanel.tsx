import { useEffect, useMemo, useState } from "react";
import type { FoodItem } from "../app/foodBankTypes";
import type { InspirationRecipeItem } from "../app/inspirationRecipeItems";
import type { MealPlanTargets } from "../app/mealPlanTypes";
import { parseRecipeBaseServings } from "../app/recipeBody";
import { recipeMealSlotFor, type RecipeMealSlot } from "../app/recipeMealCategory";
import { buildScaledRecipeView, resolveRecipeScalingMode } from "../app/recipeMealScaling";
import { computeRecipeMacros, extractRecipeIngredientLines } from "../app/recipeMacros";
import { RecipeIngredientList } from "./RecipeIngredientList";
import { RecipeMacroBlocks } from "./RecipeMacroBlocks";
import { RecipeMethodSection } from "./RecipeMethodSection";
import { RecipeServingsStepper } from "./RecipeServingsStepper";

type RecipeCookPanelProps = {
  item: InspirationRecipeItem;
  foodItems: FoodItem[];
  dailyTargets?: MealPlanTargets;
  mealSlot?: RecipeMealSlot | null;
  viewServings?: number;
  onViewServingsChange?: (value: number) => void;
};

export function RecipeCookPanel({
  item,
  foodItems,
  dailyTargets,
  mealSlot: mealSlotProp,
  viewServings: viewServingsProp,
  onViewServingsChange,
}: RecipeCookPanelProps) {
  const mealSlot = mealSlotProp ?? recipeMealSlotFor(item);
  const baseServings = parseRecipeBaseServings(item.body, item.servings);
  const [internalServings, setInternalServings] = useState(baseServings);
  const viewServings = viewServingsProp ?? internalServings;

  useEffect(() => {
    if (viewServingsProp == null) setInternalServings(baseServings);
  }, [item.id, baseServings, viewServingsProp]);

  function setViewServings(next: number) {
    onViewServingsChange?.(next);
    if (viewServingsProp == null) setInternalServings(next);
  }

  const scalingMode = resolveRecipeScalingMode({
    id: item.id,
    scalingMode: item.scalingMode,
    body: item.body,
    title: item.title,
    tag: item.tag,
    servings: item.servings,
  });
  const scaledView = useMemo(
    () =>
      buildScaledRecipeView(item.body, foodItems, {
        scalingMode,
        dailyTargets,
        mealSlot,
        servings: item.servings,
        viewServings,
        ingredientFoodOverrides: item.ingredientFoodOverrides,
      }),
    [item.body, item.servings, item.ingredientFoodOverrides, foodItems, scalingMode, dailyTargets, mealSlot, viewServings],
  );
  const macros = useMemo(
    () =>
      computeRecipeMacros(item.body, foodItems, {
        servings: item.servings,
        ingredientFoodOverrides: item.ingredientFoodOverrides,
      }),
    [item.body, item.servings, item.ingredientFoodOverrides, foodItems],
  );
  const hasIngredientSection = extractRecipeIngredientLines(item.body, { forEditor: true }).length > 0;

  return (
    <div className="space-y-4">
      <RecipeServingsStepper baseServings={baseServings} value={viewServings} onChange={setViewServings} />
      <RecipeIngredientList
        body={item.body}
        foodItems={foodItems}
        dailyTargets={dailyTargets}
        mealSlot={mealSlot}
        scalingMode={scalingMode}
        recipeId={item.id}
        servings={item.servings}
        viewServings={viewServings}
        foodOverrides={item.ingredientFoodOverrides}
      />
      <RecipeMethodSection body={item.body} />
      {macros ? (
        <RecipeMacroBlocks result={macros} />
      ) : hasIngredientSection ? (
        <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Kunne ikke beregne makroer for alle ingredienser. Sjekk at oppskriften bruker mengder (f.eks. dl, g, ss) og at
          ingrediensene finnes i matvarebanken.
        </p>
      ) : null}
    </div>
  );
}
