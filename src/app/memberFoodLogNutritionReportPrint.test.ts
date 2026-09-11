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
    expect(html).toContain("Vanninntak");
    expect(html).toContain("Vann (drikke)");
    expect(html).toContain("Kjent");
    expect(html).toContain("andel matvarer med kjent verdi");
  });

  it("puts unit after each AR, RI and UL value", () => {
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Valgt dag",
      totals: EMPTY_FOOD_LOG_NUTRITION,
      microRows: [
        {
          key: "vitaminA",
          label: "Vitamin A",
          unit: "µg",
          decimals: 0,
          value: 600,
          target: 700,
          coveragePct: 86,
          lower: 540,
          upper: 3000,
          status: "adequate",
          statusLabel: "OK",
          statusTone: "ok",
        },
      ],
    });
    expect(html).toContain("AR 540 µg");
    expect(html).toContain("RI 700 µg");
    expect(html).toContain("UL 3000 µg");
  });

  it("prints top food contributions under the nutrient name", () => {
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Valgt dag",
      totals: { ...EMPTY_FOOD_LOG_NUTRITION, protein: 30 },
      microRows: [],
      contributionLookup: {
        protein: [{ name: "Laks, oppdrett, rå", amount: 30, percent: 100 }],
      },
    });
    expect(html).toContain("Laks, oppdrett, rå 100%");
  });
});
