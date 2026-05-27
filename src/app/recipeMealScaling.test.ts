import { describe, expect, it } from "vitest";
import { DEFAULT_INSPIRATION_RECIPES } from "./defaultInspirationRecipes";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  buildScaledRecipeView,
  computeIngredientScaleFactor,
  resolveRecipeScalingMode,
} from "./recipeMealScaling";

describe("recipeMealScaling", () => {
  const foods = buildDefaultFoodBankItems();

  it("skalerer fleksible middager mot måltids-kcal", () => {
    const recipe = DEFAULT_INSPIRATION_RECIPES.find((row) => row.id === "default-recipe-13")!;
    const view = buildScaledRecipeView(recipe.body, foods, {
      scalingMode: "flexible",
      dailyTargets: { kcal: 2000 },
      mealSlot: "middag",
    });
    expect(view).not.toBeNull();
    expect(view!.adjusted).toBe(true);
    expect(view!.macros.perServing.kcal).toBeGreaterThan(400);
    expect(view!.macros.perServing.kcal).toBeLessThan(900);
  });

  it("skalerer ikke faste oppskrifter", () => {
    const recipe = DEFAULT_INSPIRATION_RECIPES.find((row) => row.id === "default-recipe-8")!;
    const view = buildScaledRecipeView(recipe.body, foods, {
      scalingMode: "fixed",
      dailyTargets: { kcal: 2000 },
      mealSlot: "lunsj",
    });
    expect(view?.scaleFactor).toBe(1);
    expect(view?.adjusted).toBe(false);
  });

  it("begrenser skaleringsfaktor", () => {
    expect(computeIngredientScaleFactor(500, 700, "flexible")).toBeCloseTo(1.4, 1);
    expect(computeIngredientScaleFactor(900, 400, "flexible")).toBe(0.7);
    expect(computeIngredientScaleFactor(500, 700, "fixed")).toBe(1);
  });

  it("beregner makro for nye standardmiddager", () => {
    const dinnerIds = new Set([
      "default-recipe-13",
      "default-recipe-14",
      "default-recipe-15",
      "default-recipe-16",
      "default-recipe-17",
      "default-recipe-18",
      "default-recipe-19",
      "default-recipe-20",
    ]);
    for (const recipe of DEFAULT_INSPIRATION_RECIPES.filter((row) => dinnerIds.has(row.id))) {
      const view = buildScaledRecipeView(recipe.body, foods, {
        scalingMode: resolveRecipeScalingMode(recipe),
      });
      expect(view, recipe.title).not.toBeNull();
      expect(view!.macros.perServing.kcal, recipe.title).toBeGreaterThan(200);
    }
  });
});
