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

  it("beholder skrevne mengder selv når kunden har kalorimål", () => {
    const recipe = DEFAULT_INSPIRATION_RECIPES.find((row) => row.id === "default-recipe-13")!;
    const view = buildScaledRecipeView(recipe.body, foods, {
      scalingMode: "flexible",
      dailyTargets: { kcal: 2000 },
      mealSlot: "middag",
    });
    expect(view).not.toBeNull();
    expect(view!.adjusted).toBe(false);
    expect(view!.scaleFactor).toBe(1);
  });

  it("beholder 115 g cottage cheese selv mot et 500 kcal måltidsmål", () => {
    const body = `**Til 1 porsjon**

**Ingredienser**
- 115 g cottage cheese

**Slik gjør du**
1. Server.`;
    const view = buildScaledRecipeView(body, foods, {
      scalingMode: "flexible",
      dailyTargets: { kcal: 1667 },
      mealSlot: "lunsj",
    });
    expect(view?.targetMealKcal).toBe(500);
    expect(view?.ingredients[0]?.grams).toBe(115);
    expect(view?.adjusted).toBe(false);
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

  it("skalerer ikke mot kalorimål", () => {
    expect(computeIngredientScaleFactor(500, 700, "flexible")).toBe(1);
    expect(computeIngredientScaleFactor(900, 400, "flexible")).toBe(1);
    expect(computeIngredientScaleFactor(500, 700, "fixed")).toBe(1);
  });

  it("dobler ingrediensmengder når kunden lager til flere porsjoner", () => {
    const body = `**Til 2 porsjoner**

**Ingredienser**
- 200 g skyr naturell

**Slik gjør du**
1. Bland.`;
    const base = buildScaledRecipeView(body, foods, { scalingMode: "fixed", servings: 2 });
    const doubled = buildScaledRecipeView(body, foods, {
      scalingMode: "fixed",
      servings: 2,
      viewServings: 4,
    });
    expect(base?.ingredients[0]?.grams).toBeGreaterThan(0);
    expect(doubled?.viewServings).toBe(4);
    expect(doubled?.peopleScale).toBe(2);
    expect(doubled!.ingredients[0]!.grams).toBeCloseTo(base!.ingredients[0]!.grams * 2, 0);
    expect(doubled!.macros.perServing).toEqual(base!.macros.perServing);
    expect(doubled!.macros.servings).toBe(2);
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
