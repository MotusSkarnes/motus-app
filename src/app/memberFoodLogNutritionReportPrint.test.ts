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
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("intake intake--");
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

  it("builds a simpler client print with logo and name, without trainer extras", () => {
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Snitt per dag · 7 dager",
      totals: { ...EMPTY_FOOD_LOG_NUTRITION, protein: 30, kcal: 1800 },
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
          status: "below_recommended",
          statusLabel: "Under anbefalt (RI)",
          statusTone: "warn",
        },
      ],
      contributionLookup: {
        protein: [{ name: "Laks, oppdrett, rå", amount: 30, percent: 100 }],
      },
      coverageLookup: {
        protein: { known: 1, total: 2, percent: 50, missingNames: ["Vitaminbamser"] },
      },
      audience: "client",
      logoUrl: "https://motus.example/logo.svg",
    });
    expect(html).toContain("Ola Nordmann");
    expect(html).toContain("https://motus.example/logo.svg");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain("grid-template-columns: 1fr 1fr 1fr");
    expect(html).toContain("Energi, makro og vann");
    expect(html).toContain('class="kicker">Motus');
    expect(html).toContain("linear-gradient(90deg, #30E3BE 0%, #D91278 100%)");
    expect(html).toContain("card--warn");
    expect(html).toContain("Innenfor");
    expect(html).toContain("Litt utenfor");
    expect(html).toContain("intake intake--warn");
    expect(html).not.toContain("Kjent");
    expect(html).not.toContain("Laks, oppdrett, rå 100%");
    expect(html).not.toContain("AR 540");
    expect(html).not.toContain("andel matvarer med kjent verdi");
  });
});
