import { describe, expect, it } from "vitest";
import { buildUnknownValuesPrintHtml } from "./nutritionReportUnknownValuesPrint";

describe("buildUnknownValuesPrintHtml", () => {
  it("prints missing foods grouped by nutrient", () => {
    const html = buildUnknownValuesPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "7 dager",
      rows: [
        {
          id: "vitaminD",
          label: "Vitamin D",
          known: 1,
          total: 3,
          percent: 33,
          missingNames: ["Brød", "Melk"],
        },
      ],
    });

    expect(html).toContain("Ukjente næringsverdier");
    expect(html).toContain("Ola Nordmann");
    expect(html).toContain("Vitamin D");
    expect(html).toContain("33%");
    expect(html).toContain("Brød, Melk");
  });
});
