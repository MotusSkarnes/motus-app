import { describe, expect, it } from "vitest";
import { isImpracticalHundredGramFoodSource } from "./foodSourcePracticality";

describe("isImpracticalHundredGramFoodSource", () => {
  it("drops spices, salt, yeast and baking agents you would not eat 100 g of", () => {
    expect(isImpracticalHundredGramFoodSource("Paprikapulver")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Paprikakrydder")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Kanel, malt")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Oregano, tørket")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Pepper, sort")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Havsalt")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Salt, bordsalt")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Gjær, tørrgjær")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Natron")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Bakepulver")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Buljongpulver")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Tacokrydder, kjøpt")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Næringsgjær")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Kakaopulver")).toBe(true);
    expect(isImpracticalHundredGramFoodSource("Ingefær, malt")).toBe(true);
  });

  it("keeps foods that are realistic to eat around 100 g", () => {
    expect(isImpracticalHundredGramFoodSource("Paprika, rød, rå")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Paprika")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Chili, rød, rå")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Basilikum, rå")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Hvitløk")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Ingefær, rå")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Olivenolje")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Mandler")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Proteinpulver whey")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Kanelbolle, skillingsbolle, hjemmebakt")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Pepperoni")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Pepperkaker")).toBe(false);
    expect(isImpracticalHundredGramFoodSource("Kjøttbuljong, tilberedt")).toBe(false);
  });
});
