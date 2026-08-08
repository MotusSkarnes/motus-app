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

  it("bruker lagrede manuelle matvarekoblinger i matplanens makrosnapshot", () => {
    const foods = buildDefaultFoodBankItems();
    const body = "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig";
    const auto = computeRecipeIngredients(body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(auto?.foodName).toBe("Karbonadedeig mager");
    expect(soyafarse).toBeTruthy();

    const ingredientFoodOverrides = { [auto!.key]: soyafarse!.id };
    const recipe: InspirationRecipeItem = {
      id: "r-soy",
      title: "Bolo med soyafarse",
      description: "Middag",
      body,
      tag: "Middag",
      servings: 1,
      ingredientFoodOverrides,
    };
    const expected = computeRecipeMacros(body, foods, {
      servings: recipe.servings,
      ingredientFoodOverrides,
    });
    expect(expected).toBeTruthy();

    const entry = recipeToMealPlanEntry(recipe, foods);
    const nutritionById = buildInspirationRecipeNutritionById([recipe], foods);

    const expectedProtein = Math.round(expected!.perServing.protein * 10) / 10;
    expect(entry.nutritionPer100g.protein).toBe(expectedProtein);
    expect(nutritionById.get(recipe.id)?.protein).toBe(expectedProtein);
  });
});
