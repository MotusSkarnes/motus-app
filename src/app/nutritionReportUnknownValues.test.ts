import { describe, expect, it } from "vitest";
import { buildUnknownNutrientRows, filterUnknownNutrientRows } from "./nutritionReportUnknownValues";

describe("nutritionReportUnknownValues", () => {
  const rows = buildUnknownNutrientRows(
    {
      vitaminD: { known: 1, total: 3, percent: 33, missingNames: ["Brød", "Melk"] },
      vitaminA: { known: 3, total: 3, percent: 100, missingNames: [] },
      iron: { known: 2, total: 3, percent: 67, missingNames: ["Melk"] },
    },
    [
      { id: "vitaminA", label: "Vitamin A" },
      { id: "vitaminD", label: "Vitamin D" },
      { id: "iron", label: "Jern" },
    ],
  );

  it("lists only nutrients below full data coverage", () => {
    expect(rows.map((row) => row.label)).toEqual(["Vitamin D", "Jern"]);
    expect(rows[0]?.missingNames).toEqual(["Brød", "Melk"]);
  });

  it("searches by both nutrient and missing food name", () => {
    expect(filterUnknownNutrientRows(rows, "jern")).toHaveLength(1);
    expect(filterUnknownNutrientRows(rows, "melk")).toHaveLength(2);
    expect(filterUnknownNutrientRows(rows, "brød").map((row) => row.label)).toEqual(["Vitamin D"]);
  });
});
