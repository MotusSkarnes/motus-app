import { describe, expect, it } from "vitest";
import { buildNutritionReportPrintHtml } from "./memberFoodLogNutritionReportPrint";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";
import { micronutrientRowsForReport } from "./quickFoodLogNutrition";

describe("buildNutritionReportPrintHtml", () => {
  it("includes macro and micro sections in printable html", () => {
    const totals = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 2000, protein: 120 };
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Snitt per dag · 3 dager",
      totals,
      microRows: micronutrientRowsForReport(totals),
    });
    expect(html).toContain("Næringsrapport");
    expect(html).toContain("Ola Nordmann");
    expect(html).toContain("Makronæringsstoffer");
    expect(html).toContain("Mikronæringsstoffer");
    expect(html).toContain("Omega-fettsyrer");
    expect(html).toContain("Vitamin D");
    expect(html).toContain("2000");
  });
});
