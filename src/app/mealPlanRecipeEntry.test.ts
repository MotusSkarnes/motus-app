import { describe, expect, it } from "vitest";
import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { buildInspirationRecipeNutritionById, recipeToMealPlanEntry } from "./mealPlanRecipeEntry";
import { computeRecipeIngredients, computeRecipeMacros } from "./recipeMacros";

const EGG_RECIPE: InspirationRecipeItem = {
  id: "r-egg",
  title: "Eggerøre med grovbrød",
  description: "Frokost",
  body: "**Til 1 porsjon · ca. 10 min**\n\n**Ingredienser**\n- 3 egg\n- 1 ss smør\n- 1/2 avokado\n\n**Slik gjør du**\n1. Stek.",
  tag: "Frokost",
};

const MEAT_RECIPE: InspirationRecipeItem = {
  id: "r-meat",
  title: "Bolle med kjøttdeig",
  description: "Middag",
  tag: "Middag",
  servings: 1,
  body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig\n\n**Slik gjør du**\n1. Stek.",
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

  it("bruker manuelle matvarekoblinger når oppskrift legges i matplan", () => {
    const foods = buildDefaultFoodBankItems();
    const autoIngredient = computeRecipeIngredients(MEAT_RECIPE.body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(autoIngredient?.foodName).toBe("Karbonadedeig mager");
    expect(soyafarse).toBeTruthy();

    const ingredientFoodOverrides = { [autoIngredient!.key]: soyafarse!.id };
    const entry = recipeToMealPlanEntry({ ...MEAT_RECIPE, ingredientFoodOverrides }, foods);
    const overriddenMacros = computeRecipeMacros(MEAT_RECIPE.body, foods, { ingredientFoodOverrides });
    const autoMacros = computeRecipeMacros(MEAT_RECIPE.body, foods);

    expect(entry.nutritionPer100g.kcal).toBe(Math.round(overriddenMacros!.perServing.kcal));
    expect(entry.nutritionPer100g.kcal).not.toBe(Math.round(autoMacros!.perServing.kcal));
  });

  it("bruker manuelle matvarekoblinger i oppskriftsnutrisjonskartet", () => {
    const foods = buildDefaultFoodBankItems();
    const autoIngredient = computeRecipeIngredients(MEAT_RECIPE.body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(autoIngredient).toBeTruthy();
    expect(soyafarse).toBeTruthy();

    const ingredientFoodOverrides = { [autoIngredient!.key]: soyafarse!.id };
    const nutritionById = buildInspirationRecipeNutritionById(
      [{ ...MEAT_RECIPE, ingredientFoodOverrides }],
      foods,
    );
    const overriddenMacros = computeRecipeMacros(MEAT_RECIPE.body, foods, { ingredientFoodOverrides });
    const autoMacros = computeRecipeMacros(MEAT_RECIPE.body, foods);

    expect(nutritionById.get(MEAT_RECIPE.id)?.kcal).toBe(Math.round(overriddenMacros!.perServing.kcal));
    expect(nutritionById.get(MEAT_RECIPE.id)?.kcal).not.toBe(Math.round(autoMacros!.perServing.kcal));
  });
});
