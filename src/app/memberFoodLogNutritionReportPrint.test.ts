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
    expect(html).toContain("EPA + DHA");
    expect(html).toContain("Ref. 0.25 g · EFSA");
    expect(html).toContain("ALA (alfa-linolensyre)");
    expect(html).toContain("Vitamin D");
    expect(html).toContain("2000");
    expect(html).toContain("Vanninntak");
    expect(html).toContain("Vann (drikke)");
    expect(html).toContain("Kjent");
    expect(html).toContain("andel matvarer med kjent verdi");
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("intake intake--");
    expect(html).toContain("Trenerutskrift");
    expect(html).not.toContain("Generert");
    expect(html).toMatch(/<h2>Mikronæringsstoffer<\/h2>\s*<table/);
    expect(html).toMatch(/<h2>Omega-fettsyrer<\/h2>\s*<table/);
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
    expect(html).toContain("Kostholdsanalyse");
    expect(html).not.toContain("Næringsrapport");
    expect(html).toContain("Ola Nordmann");
    expect(html).toContain("Snitt per dag · 7 dager");
    expect(html).not.toContain("Generert");
    expect(html).toContain("https://motus.example/logo.svg");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain("grid-template-columns: 1fr 1fr 1fr");
    expect(html).toContain("height: 277mm");
    expect(html).toContain("flex:");
    expect(html).toContain("page-break-before: always");
    expect(html).toContain('class="sheet-cards"');
    expect(html).toContain('class="sheet-viz"');
    expect(html).toContain("Energi, makro og vann");
    expect(html).toContain('class="kicker">Motus');
    expect(html).toContain("linear-gradient(90deg, #30E3BE 0%, #D91278 100%)");
    expect(html).toContain("card--warn");
    expect(html).toContain("Innenfor");
    expect(html).toContain("EPA + DHA");
    expect(html).toContain("Anbefalt 0.25 g · EFSA");
    expect(html).toContain("intake intake--warn");
    expect(html).not.toContain("Kjent");
    expect(html).not.toContain("Laks, oppdrett, rå 100%");
    expect(html).not.toContain("AR 540");
    expect(html).not.toContain("andel matvarer med kjent verdi");
    expect(html).not.toContain("Dagsvariasjon");
    expect(html).toContain("Slik ligger kosten an");
    expect(html).toContain("<svg");
    expect(html).toContain("Kommentar fra trener");
    expect(html).toContain("comment-lines");
  });

  it("prints day-by-day nutrient variation for a multi-day period", () => {
    const low = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1400, protein: 70 };
    const high = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 2200, protein: 130 };
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Snitt per dag · 2 dager",
      totals: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 100 },
      microRows: [],
      dailyTotals: [
        { dateKey: "2026-09-13", totals: low },
        { dateKey: "2026-09-14", totals: high },
      ],
      dailyAverage: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 100 },
    });
    expect(html).toContain("Dagsvariasjon");
    expect(html).toContain("søn 13.09");
    expect(html).toContain("man 14.09");
    expect(html).toContain("var--low");
    expect(html).toContain("var--high");
    expect(html).toContain("Dagsvariasjon – vitaminer");
    expect(html).toContain("Dagsvariasjon – mineraler");
    expect(html).toContain("Vitamin D");
    expect(html).toContain("Vitamin A");
    expect(html).toContain("Jod");
    expect(html).toContain("Sukker");
    expect(html).toContain("10 µg");
  });

  it("replaces daily variation with graphics and a trainer comment on the client print", () => {
    const low = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1400, protein: 70 };
    const high = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 2200, protein: 130 };
    const html = buildNutritionReportPrintHtml({
      memberName: "Ola Nordmann",
      periodSummary: "Snitt per dag · 2 dager",
      totals: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 100, carbs: 180, fat: 60 },
      microRows: [],
      dailyTotals: [
        { dateKey: "2026-09-13", totals: low },
        { dateKey: "2026-09-14", totals: high },
      ],
      dailyAverage: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 100 },
      audience: "client",
      clientComment: "Fint proteininntak – hold igjen litt på kveldsmaten.",
    });
    expect(html).not.toContain("Dagsvariasjon");
    expect(html).toContain("Slik ligger kosten an");
    expect(html).toContain("Energi gjennom perioden");
    expect(html).toContain("<svg");
    expect(html).toContain("Kommentar fra trener");
    expect(html).toContain("Fint proteininntak – hold igjen litt på kveldsmaten.");
    expect(html.indexOf("Kommentar fra trener")).toBeGreaterThan(html.indexOf("Slik ligger kosten an"));
  });
});
