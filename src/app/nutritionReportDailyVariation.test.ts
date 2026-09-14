import { describe, expect, it } from "vitest";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";
import {
  buildDailyVariationTable,
  classifyDailyVariation,
  formatVariationDayLabel,
} from "./nutritionReportDailyVariation";

describe("nutritionReportDailyVariation", () => {
  it("formats weekday without UTC shift", () => {
    expect(formatVariationDayLabel("2026-09-14")).toBe("man 14.09");
  });

  it("marks values well below or above the period average", () => {
    expect(classifyDailyVariation(50, 100)).toBe("low");
    expect(classifyDailyVariation(100, 100)).toBe("near");
    expect(classifyDailyVariation(140, 100)).toBe("high");
    expect(classifyDailyVariation(0, 0)).toBe("empty");
  });

  it("builds a day-by-day macro table against the average", () => {
    const table = buildDailyVariationTable(
      [
        {
          dateKey: "2026-09-13",
          totals: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1400, protein: 70, drinkWaterLiters: 1 },
        },
        {
          dateKey: "2026-09-14",
          totals: { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 2200, protein: 130, drinkWaterLiters: 2 },
        },
      ],
      { ...EMPTY_FOOD_LOG_NUTRITION, kcal: 1800, protein: 100, drinkWaterLiters: 1.5 },
      "macro",
    );
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.dayLabel).toBe("søn 13.09");
    const kcal = table.rows.map((row) => row.cells.find((cell) => cell.columnId === "kcal"));
    expect(kcal[0]?.tone).toBe("low");
    expect(kcal[1]?.tone).toBe("high");
    expect(kcal[0]?.display).toBe("1400");
    expect(table.averageCells.find((cell) => cell.columnId === "kcal")?.display).toBe("1800");
  });
});
