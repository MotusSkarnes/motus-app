import { describe, expect, it } from "vitest";
import {
  buildMemberFoodLogNutritionPeriodReport,
  filterDateKeysInRange,
  lastNDaysDateKeys,
} from "./memberFoodLogNutritionReport";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";

function log(kcal: number): MemberQuickFoodLogEntry {
  return {
    id: `l-${kcal}`,
    name: "Test",
    grams: 100,
    source: "food",
    loggedAt: new Date().toISOString(),
    nutritionPer100g: {
      kcal,
      protein: 10,
      carbs: 5,
      fat: 2,
      fiber: 1,
      sugar: 1,
      saturatedFat: 0.5,
      sodium: 50,
    },
  };
}

describe("memberFoodLogNutritionReport", () => {
  it("averages nutrition across days with logs", () => {
    const quickFoodLogs = {
      "2026-05-27": [log(200)],
      "2026-05-28": [log(400)],
    };
    const report = buildMemberFoodLogNutritionPeriodReport(quickFoodLogs, ["2026-05-27", "2026-05-28"]);
    expect(report.daysWithLogs).toBe(2);
    expect(Math.round(report.dailyAverage.kcal)).toBe(300);
    expect(Math.round(report.periodSum.kcal)).toBe(600);
  });

  it("includes drink water in period totals", () => {
    const quickFoodLogs = {
      "2026-05-27": [log(200)],
    };
    const report = buildMemberFoodLogNutritionPeriodReport(quickFoodLogs, ["2026-05-27"], {
      "2026-05-27": 1.2,
    });
    expect(report.periodSum.drinkWaterLiters).toBe(1.2);
  });

  it("includes days with only drink water", () => {
    const report = buildMemberFoodLogNutritionPeriodReport({}, ["2026-06-02"], { "2026-06-02": 0.8 });
    expect(report.daysWithLogs).toBe(1);
    expect(report.periodSum.drinkWaterLiters).toBe(0.8);
  });

  it("filters date keys in range", () => {
    const keys = ["2026-05-25", "2026-05-27", "2026-05-29"];
    expect(filterDateKeysInRange(keys, "2026-05-26", "2026-05-28")).toEqual(["2026-05-27"]);
  });

  it("selects last N days up to anchor", () => {
    const keys = ["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-29"];
    expect(lastNDaysDateKeys(keys, "2026-05-28", 2)).toEqual(["2026-05-26", "2026-05-27"]);
  });
});
