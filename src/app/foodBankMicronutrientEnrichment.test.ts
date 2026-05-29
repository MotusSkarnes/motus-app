import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { hasMicronutrientData } from "./foodBankMicronutrients";
import { enrichFoodItem, lookupMicronutrientsForFoodName } from "./foodBankMicronutrientEnrichment";

describe("foodBankMicronutrientEnrichment", () => {
  it("finds micronutrients for seed food names", () => {
    const micros = lookupMicronutrientsForFoodName("Laks");
    expect(micros).not.toBeNull();
    expect(hasMicronutrientData(micros ?? undefined)).toBe(true);
    expect((micros?.vitaminD ?? 0) > 0 || (micros?.vitaminB12 ?? 0) > 0).toBe(true);
  });

  it("enriches default seed items", () => {
    const items = buildDefaultFoodBankItems();
    const withMicro = items.filter((item) => hasMicronutrientData(item.nutritionPer100g.micronutrients));
    expect(withMicro.length).toBeGreaterThan(items.length * 0.9);
  });

  it("does not overwrite existing micronutrient data", () => {
    const base = buildDefaultFoodBankItems()[0]!;
    const enriched = enrichFoodItem({
      ...base,
      nutritionPer100g: {
        ...base.nutritionPer100g,
        micronutrients: { ...base.nutritionPer100g.micronutrients!, vitaminC: 999 },
      },
    });
    expect(enriched.nutritionPer100g.micronutrients?.vitaminC).toBe(999);
  });
});
