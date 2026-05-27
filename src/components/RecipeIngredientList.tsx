import { useMemo, useState } from "react";
import { ArrowLeftRight, X } from "lucide-react";
import type { FoodItem } from "../app/foodBankTypes";
import { formatMacro } from "../app/foodBankTypes";
import type { MealPlanTargets } from "../app/mealPlanTypes";
import {
  buildScaledRecipeView,
  resolveRecipeScalingMode,
  type RecipeScalingMode,
} from "../app/recipeMealScaling";
import type { RecipeMealSlot } from "../app/recipeMealCategory";
import {
  computeRecipeIngredients,
  parseRecipeServings,
  type RecipeIngredient,
} from "../app/recipeMacros";
import {
  findRecipeIngredientSwapOptions,
  gramsForEquivalentMacros,
  roundRecipeGrams,
  type RecipeIngredientSwapOption,
} from "../app/recipeIngredientSwap";
import { computeMacrosForGrams } from "../app/mealPlanMacros";

type DisplayIngredient = RecipeIngredient & {
  swappedFrom?: string;
};

type RecipeIngredientListProps = {
  body: string;
  foodItems: FoodItem[];
  dailyTargets?: MealPlanTargets;
  mealSlot?: RecipeMealSlot | null;
  scalingMode?: RecipeScalingMode;
  recipeId?: string;
};

function formatGramsLabel(grams: number, servings: number): string {
  const rounded = roundRecipeGrams(grams);
  if (servings <= 1) return `${rounded} g`;
  const per = roundRecipeGrams(grams / servings);
  return `${rounded} g (${per} g/porsjon)`;
}

function SwapModal({
  ingredient,
  foodItems,
  onClose,
  onSelect,
}: {
  ingredient: RecipeIngredient;
  foodItems: FoodItem[];
  onClose: () => void;
  onSelect: (foodId: string) => void;
}) {
  const options = useMemo(
    () =>
      findRecipeIngredientSwapOptions(
        ingredient.macros,
        ingredient.nutritionPer100g,
        ingredient.category,
        ingredient.foodId,
        foodItems,
        12,
      ),
    [ingredient, foodItems],
  );

  return (
    <div className="motus-foodbank-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="motus-foodbank-modal motus-recipe-ingredient-swap-modal"
        role="dialog"
        aria-labelledby="recipe-ingredient-swap-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="motus-foodbank-modal-head">
          <h2 id="recipe-ingredient-swap-title" className="text-base font-bold text-slate-900">
            Bytt ingrediens
          </h2>
          <button type="button" className="motus-foodbank-icon-btn" onClick={onClose} aria-label="Lukk">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="motus-foodbank-modal-body space-y-3">
          <p className="text-sm text-slate-600">
            Bytt <strong>{ingredient.foodName}</strong> ({formatGramsLabel(ingredient.grams, 1)}) mot lignende matvare
            med tilsvarende energi og makroer.
          </p>
          {options.length > 0 ? (
            <ul className="motus-recipe-ingredient-swap-list">
              {options.map((option) => (
                <SwapOptionRow key={option.food.id} option={option} onSelect={() => onSelect(option.food.id)} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              Ingen lignende alternativer i matvarebanken akkurat nå. Utvid banken med flere varer i samme kategori.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SwapOptionRow({
  option,
  onSelect,
}: {
  option: RecipeIngredientSwapOption;
  onSelect: () => void;
}) {
  const grams = roundRecipeGrams(option.equivalentGrams);
  const m = option.equivalentMacros;
  return (
    <li>
      <button type="button" className="motus-recipe-ingredient-swap-item motus-pressable" onClick={onSelect}>
        <span className="motus-recipe-ingredient-swap-emoji" aria-hidden>
          {option.food.imageEmoji ?? "🍽️"}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-slate-900">{option.food.name}</span>
          <span className="block text-xs text-teal-800">
            <strong>{grams} g</strong> gir ca. {Math.round(m.kcal)} kcal · {formatMacro(m.protein)} g P ·{" "}
            {formatMacro(m.carbs)} g K · {formatMacro(m.fat)} g F
          </span>
        </span>
        <span className="motus-matplan-swap-add" aria-hidden>
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </span>
      </button>
    </li>
  );
}

export function RecipeIngredientList({
  body,
  foodItems,
  dailyTargets,
  mealSlot = null,
  scalingMode: scalingModeProp,
  recipeId,
}: RecipeIngredientListProps) {
  const servings = useMemo(() => parseRecipeServings(body), [body]);
  const scalingMode = useMemo(
    () =>
      scalingModeProp ??
      resolveRecipeScalingMode({ id: recipeId, body }),
    [scalingModeProp, recipeId, body, mealSlot],
  );
  const scaledView = useMemo(
    () =>
      buildScaledRecipeView(body, foodItems, {
        scalingMode,
        dailyTargets,
        mealSlot,
      }),
    [body, foodItems, scalingMode, dailyTargets, mealSlot],
  );
  const ingredients = useMemo(
    () => scaledView?.ingredients ?? computeRecipeIngredients(body, foodItems),
    [scaledView, body, foodItems],
  );
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [swapTarget, setSwapTarget] = useState<RecipeIngredient | null>(null);

  const displayRows = useMemo((): DisplayIngredient[] => {
    return ingredients.map((ing) => {
      const swapFoodId = swaps[ing.key];
      if (!swapFoodId) return ing;
      const alt = foodItems.find((row) => row.id === swapFoodId);
      if (!alt) return ing;
      const grams = roundRecipeGrams(gramsForEquivalentMacros(ing.macros, alt.nutritionPer100g));
      return {
        ...ing,
        foodId: alt.id,
        foodName: alt.name,
        category: alt.category,
        grams,
        macros: computeMacrosForGrams(alt.nutritionPer100g, grams),
        nutritionPer100g: alt.nutritionPer100g,
        displayAmount: `${grams} g ${alt.name}`,
        swappedFrom: ing.foodName,
      };
    });
  }, [ingredients, swaps, foodItems]);

  if (!ingredients.length) return null;

  return (
    <section className="motus-recipe-ingredients" aria-label="Ingredienser med mengder">
      <div className="motus-recipe-ingredients-head">
        <h3 className="text-sm font-semibold text-slate-900">Ingredienser og mengder</h3>
        {servings > 1 ? (
          <span className="text-xs text-slate-500">
            Totalt for {servings} porsjoner · mengder i parentes per porsjon
          </span>
        ) : null}
      </div>
      {scaledView?.adjusted && scaledView.targetMealKcal ? (
        <p className="mt-2 rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2 text-xs text-teal-900">
          Mengdene er tilpasset ca. <strong>{scaledView.targetMealKcal} kcal</strong> for dette måltidet
          {dailyTargets?.kcal ? ` (matplan: ${Math.round(dailyTargets.kcal)} kcal/dag)` : ""}. Du kan fortsatt bytte
          ingredienser.
        </p>
      ) : scalingMode === "fixed" && dailyTargets?.kcal ? (
        <p className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Denne oppskriften har <strong>faste mengder</strong> for best resultat og skaleres ikke automatisk.
        </p>
      ) : null}
      <ul className="motus-recipe-ingredient-list">
        {displayRows.map((row) => (
          <li key={row.key} className="motus-recipe-ingredient-row">
            <div className="motus-recipe-ingredient-main">
              <span className="motus-recipe-ingredient-amount">{formatGramsLabel(row.grams, servings)}</span>
              <span className="motus-recipe-ingredient-name">{row.foodName}</span>
              {row.swappedFrom ? (
                <span className="motus-recipe-ingredient-swapped-note">Byttet fra {row.swappedFrom}</span>
              ) : (
                <span className="motus-recipe-ingredient-source">{row.sourceLine}</span>
              )}
            </div>
            <div className="motus-recipe-ingredient-side">
              <span className="motus-recipe-ingredient-macros">
                {Math.round(row.macros.kcal)} kcal · {formatMacro(row.macros.protein)} P
              </span>
              {row.swappedFrom ? (
                <button
                  type="button"
                  className="motus-recipe-ingredient-swap-btn motus-recipe-ingredient-swap-btn--muted"
                  onClick={() =>
                    setSwaps((prev) => {
                      const next = { ...prev };
                      delete next[row.key];
                      return next;
                    })
                  }
                >
                  Angre
                </button>
              ) : null}
              <button
                type="button"
                className="motus-recipe-ingredient-swap-btn"
                onClick={() => setSwapTarget(ingredients.find((i) => i.key === row.key) ?? row)}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                Bytt
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="motus-recipe-ingredients-hint text-xs text-slate-500">
        Bytt en ingrediens for å se hvor mye av en lignende matvare som gir omtrent samme energi og makroer — f.eks. potet
        mot tørr ris.
      </p>
      {swapTarget ? (
        <SwapModal
          ingredient={swapTarget}
          foodItems={foodItems}
          onClose={() => setSwapTarget(null)}
          onSelect={(foodId) => {
            setSwaps((prev) => ({ ...prev, [swapTarget.key]: foodId }));
            setSwapTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}
