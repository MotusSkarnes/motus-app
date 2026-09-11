import { describe, expect, it } from "vitest";
import { EMPTY_MICRONUTRIENTS } from "./foodBankMicronutrients";
import type { FoodItem, FoodNutrition } from "./foodBankTypes";
import { buildMemberFoodLogNutritionPeriodReport } from "./memberFoodLogNutritionReport";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  buildNutrientContributionLookup,
  contributionSourcesFromFoodLogs,
  formatContributionPreview,
  OTHER_CONTRIBUTOR_NAME,
  resolveFoodLogsNutrition,
  shortenFoodName,
} from "./nutritionReportContributors";
import { EMPTY_FOOD_LOG_NUTRITION } from "./quickFoodLogNutrition";

function nutrition(partial: Partial<FoodNutrition>): FoodNutrition {
  return {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    sodium: 0,
    ...partial,
  };
}

function foodItem(partial: Partial<FoodItem> & { name: string; nutritionPer100g: FoodNutrition }): FoodItem {
  return {
    id: partial.id ?? `food-test-${partial.name}`,
    portionLabel: "1 stk",
    portionGrams: 1,
    category: partial.category ?? "frukt-baer",
    origin: "Test",
    source: partial.source ?? "egen",
    createdBy: "test",
    createdAt: "2026-09-01T00:00:00.000Z",
    ...partial,
  };
}

function logEntry(
  name: string,
  grams: number,
  nutritionPer100g: FoodNutrition,
  extra: Partial<MemberQuickFoodLogEntry> = {},
): MemberQuickFoodLogEntry {
  return {
    id: extra.id ?? name,
    name,
    grams,
    source: "food",
    loggedAt: extra.loggedAt ?? "2026-09-10T08:00:00.000Z",
    nutritionPer100g,
    ...extra,
  };
}

describe("nutritionReportContributors", () => {
  it("ranks the top three foods by share of a nutrient", () => {
    const lookup = buildNutrientContributionLookup([
      { name: "Laks", grams: 150, nutritionPer100g: nutrition({ protein: 20, kcal: 200 }) },
      { name: "Egg", grams: 100, nutritionPer100g: nutrition({ protein: 13, kcal: 155 }) },
      { name: "Havregryn", grams: 40, nutritionPer100g: nutrition({ protein: 13, kcal: 379 }) },
      { name: "Agurk", grams: 200, nutritionPer100g: nutrition({ protein: 0.7, kcal: 15 }) },
    ]);

    expect(lookup.protein?.slice(0, 3).map((row) => row.name)).toEqual(["Laks", "Egg", "Havregryn"]);
    expect(lookup.protein?.[0]?.percent).toBe(60);
    expect(lookup.protein?.[1]?.percent).toBe(26);
    expect(lookup.protein?.[2]?.percent).toBe(10);
    expect(lookup.protein?.[3]).toMatchObject({ name: OTHER_CONTRIBUTOR_NAME, percent: 3 });
    expect(formatContributionPreview(lookup.protein ?? [])).toBe("Laks 60% · Egg 26% · Havregryn 10%");
  });

  it("merges the same food logged more than once", () => {
    const lookup = buildNutrientContributionLookup([
      { name: "Laks", grams: 100, nutritionPer100g: nutrition({ kcal: 200 }) },
      { name: "laks", grams: 50, nutritionPer100g: nutrition({ kcal: 200 }) },
    ]);

    expect(lookup.kcal).toEqual([{ name: "Laks", amount: 300, percent: 100 }]);
  });

  it("shows 100% when one food supplies all vitamin A", () => {
    const lookup = buildNutrientContributionLookup([
      {
        name: "Vitaminbamser",
        grams: 1,
        nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } }),
      },
      { name: "Agurk", grams: 200, nutritionPer100g: nutrition({ protein: 0.7 }) },
    ]);

    expect(lookup.vitaminA).toEqual([{ name: "Vitaminbamser", amount: 8, percent: 100 }]);
  });

  it("shows 50% when two foods split vitamin A equally", () => {
    const lookup = buildNutrientContributionLookup([
      {
        name: "Vitaminbamser",
        grams: 1,
        nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } }),
      },
      {
        name: "Egg",
        grams: 100,
        nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 8 } }),
      },
    ]);

    expect(lookup.vitaminA?.map((row) => ({ name: row.name, percent: row.percent }))).toEqual([
      { name: "Egg", percent: 50 },
      { name: "Vitaminbamser", percent: 50 },
    ]);
  });

  it("keeps 50/50 vitamin A across a multi-day period against the report total", () => {
    const logs: Record<string, MemberQuickFoodLogEntry[]> = {
      "2026-09-10": [
        logEntry("Vitaminbamser", 1, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } })),
      ],
      "2026-09-11": [
        logEntry("Egg", 100, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 8 } })),
      ],
    };
    const dateKeys = ["2026-09-10", "2026-09-11"];
    const report = buildMemberFoodLogNutritionPeriodReport(logs, dateKeys);
    const lookup = buildNutrientContributionLookup(contributionSourcesFromFoodLogs(logs, report.dateKeys), {
      totals: report.periodSum,
    });

    expect(report.periodSum.micronutrients.vitaminA).toBe(16);
    expect(lookup.vitaminA?.map((row) => ({ name: row.name, percent: row.percent }))).toEqual([
      { name: "Egg", percent: 50 },
      { name: "Vitaminbamser", percent: 50 },
    ]);
  });

  it("shows 100% vitamin A for a period when only vitaminbamser contribute", () => {
    const logs: Record<string, MemberQuickFoodLogEntry[]> = {
      "2026-09-10": [
        logEntry("Vitaminbamser", 1, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } })),
      ],
      "2026-09-11": [
        logEntry("Vitaminbamser", 1, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } })),
      ],
    };
    const report = buildMemberFoodLogNutritionPeriodReport(logs, ["2026-09-10", "2026-09-11"]);
    const lookup = buildNutrientContributionLookup(contributionSourcesFromFoodLogs(logs, report.dateKeys), {
      totals: report.periodSum,
    });

    expect(lookup.vitaminA).toEqual([{ name: "Vitaminbamser", amount: 16, percent: 100 }]);
  });

  it("does not inflate percent when period sources are paired with daily-average totals", () => {
    const logs: Record<string, MemberQuickFoodLogEntry[]> = {
      "2026-09-10": [
        logEntry("Vitaminbamser", 1, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } })),
      ],
      "2026-09-11": [
        logEntry("Egg", 100, nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 8 } })),
      ],
    };
    const report = buildMemberFoodLogNutritionPeriodReport(logs, ["2026-09-10", "2026-09-11"]);
    const sources = contributionSourcesFromFoodLogs(logs, report.dateKeys);
    const inflated = buildNutrientContributionLookup(sources, { totals: report.dailyAverage });
    const correct = buildNutrientContributionLookup(sources, { totals: report.periodSum });

    expect(inflated.vitaminA?.some((row) => row.percent >= 100)).toBe(true);
    expect(correct.vitaminA?.map((row) => row.percent)).toEqual([50, 50]);
  });

  it("uses food-bank micronutrients so logged vitaminbamser match the report total", () => {
    const logs: Record<string, MemberQuickFoodLogEntry[]> = {
      "2026-09-10": [logEntry("Vitaminbamser", 1, nutrition({ kcal: 4 }), { foodId: "vb1" })],
    };
    const items = [
      foodItem({
        id: "vb1",
        name: "Vitaminbamser",
        nutritionPer100g: nutrition({
          kcal: 4,
          micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 },
        }),
      }),
    ];
    const resolved = resolveFoodLogsNutrition(logs, ["2026-09-10"], items);
    const report = buildMemberFoodLogNutritionPeriodReport(resolved, ["2026-09-10"]);
    const lookup = buildNutrientContributionLookup(contributionSourcesFromFoodLogs(resolved, report.dateKeys), {
      totals: report.periodSum,
    });

    expect(report.periodSum.micronutrients.vitaminA).toBe(8);
    expect(lookup.vitaminA).toEqual([{ name: "Vitaminbamser", amount: 8, percent: 100 }]);
  });

  it("includes logged drinks in total water ranking", () => {
    const lookup = buildNutrientContributionLookup(
      [{ name: "Agurk", grams: 200, nutritionPer100g: nutrition({ water: 95 }) }],
      { drinkWaterLiters: 1.2 },
    );

    expect(lookup.waterFromFood?.[0]).toMatchObject({ name: "Agurk", percent: 100 });
    expect(lookup.drinkWater?.[0]).toMatchObject({ name: "Logget drikke", percent: 100 });
    expect(lookup.waterTotal?.map((row) => row.name)).toEqual(["Logget drikke", "Agurk"]);
    expect(lookup.waterTotal?.[0]?.percent).toBe(86);
    expect(lookup.waterTotal?.[1]?.percent).toBe(14);
  });

  it("collects food-log sources for the selected dates", () => {
    const logs: Record<string, MemberQuickFoodLogEntry[]> = {
      "2026-09-10": [logEntry("Laks", 150, nutrition({ protein: 20 }))],
      "2026-09-11": [logEntry("Egg", 100, nutrition({ protein: 13 }), { id: "b", loggedAt: "2026-09-11T08:00:00.000Z" })],
    };

    const sources = contributionSourcesFromFoodLogs(logs, ["2026-09-10"]);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.name).toBe("Laks");
  });

  it("shortens long Matvaretabellen names for the compact preview", () => {
    expect(shortenFoodName("Kylling, brystfilet, uten skinn, stekt")).toBe("Kylling");
    expect(shortenFoodName("Ekstraordinært lang matvare uten komma i navnet")).toBe("Ekstraordinært…");
    expect(formatContributionPreview([{ name: "Laks", amount: 30, percent: 42 }])).toBe("Laks 42%");
  });

  it("uses report totals as the percent denominator when provided", () => {
    const lookup = buildNutrientContributionLookup(
      [
        {
          name: "Vitaminbamser",
          grams: 1,
          nutritionPer100g: nutrition({ micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 800 } }),
        },
      ],
      {
        totals: {
          ...EMPTY_FOOD_LOG_NUTRITION,
          micronutrients: { ...EMPTY_MICRONUTRIENTS, vitaminA: 16 },
        },
      },
    );

    expect(lookup.vitaminA?.[0]).toMatchObject({ name: "Vitaminbamser", percent: 50 });
    expect(lookup.vitaminA?.[1]).toMatchObject({ name: OTHER_CONTRIBUTOR_NAME, percent: 50 });
  });
});
