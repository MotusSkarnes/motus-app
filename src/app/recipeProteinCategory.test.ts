import { describe, expect, it } from "vitest";
import { resolveRecipeProteinCategory } from "./recipeProteinCategory";

describe("resolveRecipeProteinCategory", () => {
  it("respects explicit recipe protein category", () => {
    expect(
      resolveRecipeProteinCategory({
        proteinCategory: "vegetarian",
        title: "Kyllingwrap med hummus",
      }),
    ).toBe("vegetarian");
  });

  it("sorts lunch and dinner recipes by primary ingredient", () => {
    expect(resolveRecipeProteinCategory({ title: "Kyllingwrap med hummus og grønnsaker" })).toBe("chicken");
    expect(resolveRecipeProteinCategory({ title: "Tunfisk- og bønnesalat" })).toBe("seafood");
    expect(resolveRecipeProteinCategory({ title: "Bolognese med kjøttdeig og fullkornspasta" })).toBe("meat");
    expect(resolveRecipeProteinCategory({ title: "Linsegryte med grønnsaker" })).toBe("vegetarian");
  });

  it("uses recipe body when title is neutral", () => {
    expect(
      resolveRecipeProteinCategory({
        title: "Rask hverdagsgryte",
        body: "**Ingredienser**\n- 150 g torsk\n- 200 g potet",
      }),
    ).toBe("seafood");
  });
});
