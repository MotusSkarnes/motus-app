import { describe, expect, it } from "vitest";
import { buildFoodSourceListPrintHtml } from "./foodSourceListPrint";

describe("buildFoodSourceListPrintHtml", () => {
  it("prints a numbered top list for the nutrient", () => {
    const html = buildFoodSourceListPrintHtml({
      nutrientLabel: "Vitamin A",
      nutrientId: "vitaminA",
      sources: [
        { id: "a", name: "Lever, svin, rå", nameKey: "leversvinra", amountPer100g: 12000 },
        { id: "b", name: "Gulrot", nameKey: "gulrot", amountPer100g: 800 },
      ],
    });
    expect(html).toContain("Gode matkilder – Vitamin A");
    expect(html).toContain("Topp 2 i matbanken");
    expect(html).toContain("Lever, svin, rå");
    expect(html).toContain("Gulrot");
    expect(html).toContain("12000 µg / 100 g");
  });
});
