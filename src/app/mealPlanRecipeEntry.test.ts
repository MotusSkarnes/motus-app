import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import { buildInspirationRecipeNutritionById, recipeToMealPlanEntry } from "./mealPlanRecipeEntry";
import { computeRecipeIngredients, computeRecipeMacros } from "./recipeMacros";

const EGG_RECIPE: InspirationRecipeItem = {
  id: "r-egg",
  title: "Eggerøre med grovbrød",
  description: "Frokost",
  body: "**Til 1 porsjon · ca. 10 min**\n\n**Ingredienser**\n- 3 egg\n- 1 ss smør\n- 1/2 avokado\n\n**Slik gjør du**\n1. Stek.",
};

describe("recipeToMealPlanEntry", () => {
  it("legger alltid til oppskrift selv uten matvarebank", () => {
    const entry = recipeToMealPlanEntry(EGG_RECIPE, []);
    expect(entry.foodName).toBe("Eggerøre med grovbrød");
    expect(entry.foodId).toContain("inspo-recipe");
  });

  it("beregner makroer med standardbank", () => {
    const entry = recipeToMealPlanEntry(EGG_RECIPE, []);
    expect(entry.nutritionPer100g.kcal).toBeGreaterThan(0);
    expect(entry.note).toContain("Oppskrift");
  });

  it("legger til uten makro når ingrediensliste mangler", () => {
    const entry = recipeToMealPlanEntry(
      { ...EGG_RECIPE, body: "Kort beskrivelse uten ingredienser." },
      [],
    );
    expect(entry.nutritionPer100g.kcal).toBe(0);
    expect(entry.note).toContain("Ingredienser");
  });

  it("bruker manuelle ingrediensmatvarer i lagret oppskriftsnæring", () => {
    const foods = buildDefaultFoodBankItems();
    const body = "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig";
    const autoIngredient = computeRecipeIngredients(body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(autoIngredient?.foodName).toBe("Karbonadedeig mager");
    expect(soyafarse).toBeTruthy();

    const recipe: InspirationRecipeItem = {
      id: "r-soya",
      title: "Soya bolognese",
      description: "Middag",
      tag: "Middag",
      body,
      ingredientFoodOverrides: { [autoIngredient!.key]: soyafarse!.id },
    };
    const expected = computeRecipeMacros(body, foods, {
      ingredientFoodOverrides: recipe.ingredientFoodOverrides,
    });
    const withoutOverride = recipeToMealPlanEntry({ ...recipe, ingredientFoodOverrides: undefined }, foods);
    const entry = recipeToMealPlanEntry(recipe, foods);

    expect(entry.nutritionPer100g.protein).toBe(Math.round(expected!.perServing.protein * 10) / 10);
    expect(entry.nutritionPer100g.protein).not.toBe(withoutOverride.nutritionPer100g.protein);
  });

  it("bruker manuelle ingrediensmatvarer i oppskriftsnæring per id", () => {
    const foods = buildDefaultFoodBankItems();
    const body = "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig";
    const autoIngredient = computeRecipeIngredients(body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(soyafarse).toBeTruthy();

    const recipe: InspirationRecipeItem = {
      id: "r-soya",
      title: "Soya bolognese",
      description: "Middag",
      tag: "Middag",
      body,
      ingredientFoodOverrides: { [autoIngredient!.key]: soyafarse!.id },
    };
    const expected = computeRecipeMacros(body, foods, {
      ingredientFoodOverrides: recipe.ingredientFoodOverrides,
    });
    const byId = buildInspirationRecipeNutritionById([recipe], foods);

    expect(byId.get(recipe.id)?.kcal).toBe(Math.round(expected!.perServing.kcal));
  });
});
