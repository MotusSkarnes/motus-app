import { useMemo, useState } from "react";
import { ArrowLeftRight, ListChecks, X } from "lucide-react";
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
  applyRecipeIngredientFoodOverrides,
  computeRecipeIngredients,
  isConfidentIngredientFoodMatch,
  parseRecipeServings,
  type RecipeIngredient,
  type RecipeIngredientFoodOverrides,
} from "../app/recipeMacros";
import {
  findRecipeIngredientSwapOptions,
  gramsForEquivalentMacros,
  roundRecipeGrams,
  type RecipeIngredientSwapOption,
} from "../app/recipeIngredientSwap";
import { computeMacrosForGrams } from "../app/mealPlanMacros";
import { RecipeFoodSelectModal } from "./RecipeFoodSelectModal";

type DisplayIngredient = RecipeIngredient & {
  swappedFrom?: string;
  autoMatchedName?: string;
  isManualOverride?: boolean;
  needsReview?: boolean;
};

type RecipeIngredientListProps = {
  body: string;
  foodItems: FoodItem[];
  dailyTargets?: MealPlanTargets;
  mealSlot?: RecipeMealSlot | null;
  scalingMode?: RecipeScalingMode;
  recipeId?: string;
  servings?: number;
  editable?: boolean;
  foodOverrides?: RecipeIngredientFoodOverrides;
  onFoodOverrideChange?: (ingredientKey: string, foodId: string | null) => void;
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
        { name: ingredient.foodName, origin: "", category: ingredient.category },
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
  servings: servingsProp,
  editable = false,
  foodOverrides,
  onFoodOverrideChange,
}: RecipeIngredientListProps) {
  const servings = useMemo(() => parseRecipeServings(body, servingsProp), [body, servingsProp]);
  const scalingMode = useMemo(
    () =>
      scalingModeProp ??
      resolveRecipeScalingMode({ id: recipeId, body, servings: servingsProp }),
    [scalingModeProp, recipeId, body, mealSlot, servingsProp],
  );
  const scaledView = useMemo(
    () =>
      buildScaledRecipeView(body, foodItems, {
        scalingMode,
        dailyTargets,
        mealSlot,
        servings: servingsProp,
        ingredientFoodOverrides: foodOverrides,
      }),
    [body, foodItems, scalingMode, dailyTargets, mealSlot, servingsProp, foodOverrides],
  );
  const baseIngredients = useMemo(
    () => computeRecipeIngredients(body, foodItems),
    [body, foodItems],
  );
  const ingredients = useMemo(
    () => scaledView?.ingredients ?? applyRecipeIngredientFoodOverrides(baseIngredients, foodOverrides, foodItems),
    [scaledView, baseIngredients, foodOverrides, foodItems],
  );
  const [previewSwaps, setPreviewSwaps] = useState<Record<string, string>>({});
  const [swapTarget, setSwapTarget] = useState<RecipeIngredient | null>(null);
  const [pickTarget, setPickTarget] = useState<RecipeIngredient | null>(null);

  const displayRows = useMemo((): DisplayIngredient[] => {
    return ingredients.map((ing) => {
      const auto = baseIngredients.find((row) => row.key === ing.key);
      const autoName = auto?.foodName ?? ing.foodName;
      const manualOverride = Boolean(foodOverrides?.[ing.key] ?? (ing.legacyKey ? foodOverrides?.[ing.legacyKey] : undefined));
      const previewSwapId = editable ? undefined : previewSwaps[ing.key];
      const effectiveId = previewSwapId ?? ing.foodId;
      let row: DisplayIngredient = {
        ...ing,
        autoMatchedName: autoName,
        isManualOverride: manualOverride,
        needsReview: editable && !manualOverride && !isConfidentIngredientFoodMatch(ing.searchText, ing.foodName),
      };
      if (!previewSwapId || editable) return row;
      const alt = foodItems.find((item) => item.id === previewSwapId);
      if (!alt) return row;
      const grams = roundRecipeGrams(gramsForEquivalentMacros(ing.macros, alt.nutritionPer100g));
      row = {
        ...row,
        foodId: alt.id,
        foodName: alt.name,
        category: alt.category,
        grams,
        macros: computeMacrosForGrams(alt.nutritionPer100g, grams),
        nutritionPer100g: alt.nutritionPer100g,
        displayAmount: `${grams} g ${alt.name}`,
        swappedFrom: ing.foodName,
      };
      return row;
    });
  }, [ingredients, baseIngredients, foodOverrides, foodItems, previewSwaps, editable]);

  if (!ingredients.length) return null;

  function applyFoodChoice(ingredientKey: string, foodId: string) {
    if (editable && onFoodOverrideChange) {
      onFoodOverrideChange(ingredientKey, foodId);
      return;
    }
    setPreviewSwaps((prev) => ({ ...prev, [ingredientKey]: foodId }));
  }

  return (
    <section className="motus-recipe-ingredients" aria-label="Ingredienser med mengder">
      <div className="motus-recipe-ingredients-head">
        <h3 className="text-sm font-semibold text-slate-900">
          {editable ? "Hurtiglesing av ingredienskobling" : "Ingredienser og mengder"}
        </h3>
        {servings > 1 ? (
          <span className="text-xs text-slate-500">
            Totalt for {servings} porsjoner · mengder i parentes per porsjon
          </span>
        ) : null}
      </div>
      {editable ? (
        <p className="mt-1 text-xs text-slate-600">
          Vi gjetter matvare fra teksten. Sjekk at koblingen stemmer — trykk <strong>Velg matvare</strong> for å rette.
        </p>
      ) : null}
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
          <li
            key={row.key}
            className={`motus-recipe-ingredient-row ${row.needsReview ? "motus-recipe-ingredient-row--review" : ""}`}
          >
            <div className="motus-recipe-ingredient-main">
              <span className="motus-recipe-ingredient-amount">{formatGramsLabel(row.grams, servings)}</span>
              <span className="motus-recipe-ingredient-name">{row.foodName}</span>
              {editable ? (
                <span className="motus-recipe-ingredient-source">
                  Fra tekst: «{row.sourceLine.replace(/^[-*•]\s*/, "")}»
                </span>
              ) : row.swappedFrom ? (
                <span className="motus-recipe-ingredient-swapped-note">Byttet fra {row.swappedFrom}</span>
              ) : (
                <span className="motus-recipe-ingredient-source">{row.sourceLine}</span>
              )}
              {editable ? (
                <span
                  className={`motus-recipe-ingredient-match-badge ${
                    row.isManualOverride
                      ? "is-manual"
                      : row.needsReview
                        ? "is-review"
                        : "is-ok"
                  }`}
                >
                  {row.isManualOverride ? (
                    <>
                      <ListChecks className="h-3 w-3" aria-hidden /> Valgt manuelt
                    </>
                  ) : row.needsReview ? (
                    "Sjekk kobling"
                  ) : (
                    "Kobling OK"
                  )}
                </span>
              ) : null}
            </div>
            <div className="motus-recipe-ingredient-side">
              <span className="motus-recipe-ingredient-macros">
                {Math.round(row.macros.kcal)} kcal · {formatMacro(row.macros.protein)} P
              </span>
              {editable && row.isManualOverride ? (
                <button
                  type="button"
                  className="motus-recipe-ingredient-swap-btn motus-recipe-ingredient-swap-btn--muted"
                  onClick={() => onFoodOverrideChange?.(row.key, null)}
                >
                  Tilbakestill
                </button>
              ) : null}
              {!editable && row.swappedFrom ? (
                <button
                  type="button"
                  className="motus-recipe-ingredient-swap-btn motus-recipe-ingredient-swap-btn--muted"
                  onClick={() =>
                    setPreviewSwaps((prev) => {
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
                onClick={() => setPickTarget(ingredients.find((item) => item.key === row.key) ?? row)}
              >
                <ListChecks className="h-3.5 w-3.5" aria-hidden />
                Velg matvare
              </button>
              {!editable ? (
                <button
                  type="button"
                  className="motus-recipe-ingredient-swap-btn"
                  onClick={() => setSwapTarget(ingredients.find((item) => item.key === row.key) ?? row)}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                  Bytt
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!editable ? (
        <p className="motus-recipe-ingredients-hint text-xs text-slate-500">
          Bytt en ingrediens for å se hvor mye av en lignende matvare som gir omtrent samme energi og makroer — f.eks. potet
          mot tørr ris.
        </p>
      ) : null}
      {swapTarget ? (
        <SwapModal
          ingredient={swapTarget}
          foodItems={foodItems}
          onClose={() => setSwapTarget(null)}
          onSelect={(foodId) => {
            applyFoodChoice(swapTarget.key, foodId);
            setSwapTarget(null);
          }}
        />
      ) : null}
      {pickTarget ? (
        <RecipeFoodSelectModal
          open
          ingredientLabel={pickTarget.searchText || pickTarget.sourceLine}
          foodItems={foodItems}
          selectedFoodId={foodOverrides?.[pickTarget.key] ?? pickTarget.foodId}
          onClose={() => setPickTarget(null)}
          onSelect={(foodId) => {
            applyFoodChoice(pickTarget.key, foodId);
            setPickTarget(null);
          }}
        />
      ) : null}
    </section>
  );
}
