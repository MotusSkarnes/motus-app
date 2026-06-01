import { describe, expect, it } from "vitest";
import type { MicronutrientDailyRow } from "./quickFoodLogNutrition";
import { filterMicronutrientReportRows } from "./quickFoodLogNutrition";

const row = (tone: MicronutrientDailyRow["statusTone"], key: string): MicronutrientDailyRow => ({
  key: key as MicronutrientDailyRow["key"],
  label: key,
  unit: "mg",
  decimals: 1,
  value: 1,
  target: 10,
  coveragePct: 10,
  lower: 5,
  upper: 20,
  status: "adequate",
  statusLabel: "OK",
  statusTone: tone,
});

describe("filterMicronutrientReportRows", () => {
  it("hides ok rows when issuesOnly is true", () => {
    const rows = [row("ok", "vitaminC"), row("warn", "iron"), row("danger", "zinc")];
    const filtered = filterMicronutrientReportRows(rows, true);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.statusTone !== "ok")).toBe(true);
  });
});
