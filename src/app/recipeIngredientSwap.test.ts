import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { computeMacrosForGrams } from "./mealPlanMacros";
import { computeRecipeIngredients } from "./recipeMacros";
import { findRecipeIngredientSwapOptions, gramsForEquivalentMacros, roundRecipeGrams } from "./recipeIngredientSwap";

describe("recipeIngredientSwap", () => {
  const foods = buildDefaultFoodBankItems();

  it("beregner tilsvarende gram tørr ris for kokt potet", () => {
    const potet = foods.find((f) => f.name === "Potet kokt");
    const risTorr = foods.find((f) => f.name === "Basmatiris tørr");
    expect(potet).toBeDefined();
    expect(risTorr).toBeDefined();

    const sourceGrams = 200;
    const sourceMacros = computeMacrosForGrams(potet!.nutritionPer100g, sourceGrams);
    const risGrams = roundRecipeGrams(gramsForEquivalentMacros(sourceMacros, risTorr!.nutritionPer100g));

    expect(risGrams).toBeGreaterThan(40);
    expect(risGrams).toBeLessThan(90);

    const risMacros = computeMacrosForGrams(risTorr!.nutritionPer100g, risGrams);
    expect(Math.abs(risMacros.kcal - sourceMacros.kcal)).toBeLessThan(sourceMacros.kcal * 0.08);
  });

  it("finner byttealternativer i samme kategori", () => {
    const body = `**Til 1 porsjon**

**Ingredienser**
- 200 g potet`;

    const [ingredient] = computeRecipeIngredients(body, foods);
    expect(ingredient).toBeDefined();

    const options = findRecipeIngredientSwapOptions(
      ingredient.macros,
      ingredient.nutritionPer100g,
      ingredient.category,
      ingredient.foodId,
      foods,
      20,
    );

    expect(options.length).toBeGreaterThan(0);
    expect(options.some((row) => /ris/i.test(row.food.name))).toBe(true);
  });
});
