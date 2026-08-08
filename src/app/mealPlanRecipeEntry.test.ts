import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import type { InspirationRecipeItem } from "./inspirationRecipeItems";
import { recipeToMealPlanEntry } from "./mealPlanRecipeEntry";

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

  it("bruker manuelle ingrediensmatvarer i lagret makrosnapshot", () => {
    const foods = buildDefaultFoodBankItems();
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(soyafarse).toBeTruthy();
    const recipe: InspirationRecipeItem = {
      id: "r-override",
      title: "Manuell bolognese",
      description: "Middag",
      tag: "Middag",
      body: "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig",
      ingredientFoodOverrides: { "ing-kjottdeig": soyafarse!.id },
    };

    const autoEntry = recipeToMealPlanEntry({ ...recipe, ingredientFoodOverrides: undefined }, foods);
    const overrideEntry = recipeToMealPlanEntry(recipe, foods);

    expect(overrideEntry.nutritionPer100g.kcal).not.toBe(autoEntry.nutritionPer100g.kcal);
    expect(overrideEntry.nutritionPer100g.kcal).toBe(Math.round(soyafarse!.nutritionPer100g.kcal * 2));
  });
});
