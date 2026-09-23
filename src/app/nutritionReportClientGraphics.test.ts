import { describe, expect, it } from "vitest";
import {
  buildClientReportCommentHtml,
  buildClientReportGraphicsHtml,
  countClientStatusTones,
  energySplitFromTotals,
} from "./nutritionReportClientGraphics";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";
import { buildMacroDisplayRows } from "./nutritionReportDisplay";
import { micronutrientRowsForReport } from "./quickFoodLogNutrition";

describe("nutritionReportClientGraphics", () => {
  it("splits energy from protein, carbs and fat", () => {
    const split = energySplitFromTotals({ protein: 50, carbs: 100, fat: 20 });
    expect(split.proteinKcal).toBe(200);
    expect(split.carbsKcal).toBe(400);
    expect(split.fatKcal).toBe(180);
    expect(split.totalKcal).toBe(780);
  });

  it("counts status tones from macros and micros", () => {
    const totals = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 2000, protein: 120, carbs: 200, fat: 70 };
    const counts = countClientStatusTones(buildMacroDisplayRows(totals, { kcal: 2000, protein: 120, carbs: 200, fat: 70 }), []);
    expect(counts.ok + counts.warn + counts.danger).toBeGreaterThan(0);
  });

  it("renders donuts, gauges and a period sparkline", () => {
    const totals = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 90, carbs: 180, fat: 60 };
    const html = buildClientReportGraphicsHtml({
      totals,
      mealPlanTargets: { kcal: 2000, protein: 120, carbs: 200, fat: 70 },
      microRows: micronutrientRowsForReport(totals),
      dailyKcal: [
        { dateLabel: "man 01.09", kcal: 1600 },
        { dateLabel: "tir 02.09", kcal: 2100 },
        { dateLabel: "ons 03.09", kcal: 1800 },
      ],
    });
    expect(html).toContain("Slik ligger kosten an");
    expect(html).toContain("Status for næringsstoffer");
    expect(html).toContain(">vurdert</text>");
    expect(html).toContain("Energifordeling");
    expect(html).toContain("Mot anbefaling");
    expect(html).toContain("Energi gjennom perioden");
    expect(html).toContain(">1600</text>");
    expect(html).toContain(">1700</text>");
    expect(html).toContain(">1800</text>");
    expect(html).toContain(">1900</text>");
    expect(html).toContain(">2000</text>");
    expect(html).toContain(">2100</text>");
    expect(html).toContain(">kcal</text>");
    expect(html).toContain("<svg");
    expect(html).toContain("Kalorier");
  });

  it("shows the reported kcal total in both energy graphics when macro-derived energy differs", () => {
    const totals = { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 90, carbs: 180, fat: 60 };
    const html = buildClientReportGraphicsHtml({
      totals,
      mealPlanTargets: { kcal: 2000, protein: 120, carbs: 200, fat: 70 },
      microRows: [],
    });

    expect(energySplitFromTotals(totals).totalKcal).toBe(1620);
    expect(html).toContain(">1800</text>");
    expect(html).not.toContain(">1620</text>");
    expect(html).toContain("1800 kcal");
  });

  it("prints trainer comments and keeps an empty lined box when missing", () => {
    expect(buildClientReportCommentHtml("Hold igjen på kveldsmat.")).toContain("Hold igjen på kveldsmat.");
    expect(buildClientReportCommentHtml("")).toContain("comment-lines");
    expect(buildClientReportCommentHtml("Linje 1\nLinje 2")).toContain("<br />");
  });
});
