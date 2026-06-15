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

  it("bytter belgfrukter bare mot tilsvarende belgfrukter", () => {
    const body = `**Til 1 porsjon**

**Ingredienser**
- 200 g linser`;

    const [ingredient] = computeRecipeIngredients(body, foods);
    expect(ingredient?.foodName.toLowerCase()).toContain("linser");

    const options = findRecipeIngredientSwapOptions(
      ingredient.macros,
      ingredient.nutritionPer100g,
      ingredient.category,
      ingredient.foodId,
      [
        ...foods,
        {
          id: "test-tomatsuppe",
          name: "Tomatsuppepulver",
          category: "karbohydrater",
          origin: "Pulver",
          portionLabel: "100 g",
          portionGrams: 100,
          source: "egen",
          createdBy: "test",
          createdAt: "2026-01-01",
          nutritionPer100g: { kcal: 120, protein: 4, carbs: 20, fat: 2, fiber: 1, sugar: 5, saturatedFat: 0.5, sodium: 800 },
        },
      ],
      20,
      { name: ingredient.foodName, origin: "", category: ingredient.category },
    );

    expect(options.some((row) => /bønner|bonner|kikerter/i.test(row.food.name))).toBe(true);
    expect(options.some((row) => /tomat|suppe|pulver/i.test(row.food.name))).toBe(false);
  });

  it("bytter stivelse mot ris potet pasta eller lignende", () => {
    const pasta = foods.find((food) => /pasta/i.test(food.name));
    expect(pasta).toBeDefined();
    const sourceMacros = computeMacrosForGrams(pasta!.nutritionPer100g, 80);

    const options = findRecipeIngredientSwapOptions(
      sourceMacros,
      pasta!.nutritionPer100g,
      pasta!.category,
      pasta!.id,
      foods,
      20,
    );

    expect(options.some((row) => /ris|potet/i.test(row.food.name))).toBe(true);
    expect(options.every((row) => !/tomat|suppe|pulver/i.test(row.food.name))).toBe(true);
  });
});
