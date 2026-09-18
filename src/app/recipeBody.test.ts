import { describe, expect, it } from "vitest";
import {
  buildRecipeBody,
  extractRecipeMethodSteps,
  extractRecipeTipsSection,
  formatRecipeIngredientLine,
  parseRecipeIngredientDrafts,
  recipePeopleLabel,
  recipePortionsLabel,
  suggestRecipeDisplayName,
  resolvedRecipeIngredientName,
} from "./recipeBody";

const SAMPLE_BODY = `**Til 2 porsjoner**

**Ingredienser**
- 200 g skyr naturell
- 1 dl havregryn
- Salt og pepper

**Slik gjør du**
1. Bland i bolle.
2. Topp med bær.

**Tips:** Server kald.`;

describe("recipeBody", () => {
  it("bygger og leser ingredienser, fremgangsmåte og tips", () => {
    const body = buildRecipeBody({
      servings: 4,
      ingredients: [
        { id: "a", quantity: "400", unit: "g", name: "Kyllingbryst", foodId: "chicken" },
        { id: "b", quantity: "1", unit: "stk", name: "Løk" },
      ],
      method: "1. Stek kyllingen.\n2. Ha i løk.",
      tips: "Lag gjerne dobbel porsjon.",
    });

    expect(body).toContain("**Til 4 porsjoner**");
    expect(body).toContain("- 400 g Kyllingbryst");
    expect(body).toContain("- 1 stk Løk");
    expect(extractRecipeMethodSteps(body)).toEqual(["Stek kyllingen.", "Ha i løk."]);
    expect(extractRecipeTipsSection(body)).toContain("Lag gjerne dobbel porsjon.");

    const drafts = parseRecipeIngredientDrafts(body, { "ing-0": "chicken" });
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.name.toLowerCase()).toContain("kylling");
    expect(drafts[0]?.foodId).toBe("chicken");
    expect(drafts[1]?.unit).toBe("stk");
  });

  it("henter slike-gjør-du-steg og stopper før tips", () => {
    expect(extractRecipeMethodSteps(SAMPLE_BODY)).toEqual(["Bland i bolle.", "Topp med bær."]);
  });

  it("formaterer ingredienslinje pent", () => {
    expect(formatRecipeIngredientLine({ id: "1", quantity: "2", unit: "dl", name: "Lettmelk" })).toBe(
      "2 dl Lettmelk",
    );
    expect(formatRecipeIngredientLine({ id: "2", quantity: "", unit: "", name: "Salt og pepper" })).toBe(
      "Salt og pepper",
    );
  });

  it("beskriver antall porsjoner", () => {
    expect(recipePortionsLabel(1)).toBe("1 porsjon");
    expect(recipePortionsLabel(4)).toBe("4 porsjoner");
    expect(recipePeopleLabel(2)).toBe("2 porsjoner");
  });

  it("korter ned lange matvarenavn til visningsnavn", () => {
    expect(suggestRecipeDisplayName("Cottage cheese, 1,7% protein, naturell")).toBe("Cottage cheese");
    expect(suggestRecipeDisplayName("Kyllingbryst")).toBe("Kyllingbryst");
  });

  it("beholder matvarenavn fra banken når kundens navn er tomt", () => {
    expect(resolvedRecipeIngredientName({ id: "1", quantity: "1", unit: "stk", name: "", foodId: "avocado" }, "Avokado")).toBe(
      "Avokado",
    );
    expect(
      resolvedRecipeIngredientName(
        { id: "1", quantity: "1", unit: "stk", name: "Avokado moset", foodId: "avocado" },
        "Avokado",
      ),
    ).toBe("Avokado moset");
  });
});
