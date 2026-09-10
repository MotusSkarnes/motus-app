import { describe, expect, it } from "vitest";
import type { MicronutrientDailyRow } from "./quickFoodLogNutrition";
import {
  filterMicronutrientReportRows,
  micronutrientReportEmptyMessage,
  micronutrientReportFilterCounts,
} from "./quickFoodLogNutrition";

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
  const rows = [row("ok", "vitaminC"), row("warn", "iron"), row("danger", "zinc"), row("muted", "iodine")];

  it("returns all rows by default", () => {
    expect(filterMicronutrientReportRows(rows, "all")).toHaveLength(4);
  });

  it("keeps only values within AR/RI", () => {
    const filtered = filterMicronutrientReportRows(rows, "within");
    expect(filtered).toEqual([rows[0]]);
  });

  it("keeps only values outside AR/RI", () => {
    const filtered = filterMicronutrientReportRows(rows, "outside");
    expect(filtered.map((item) => item.key)).toEqual(["iron", "zinc"]);
  });

  it("counts within and outside separately", () => {
    expect(micronutrientReportFilterCounts(rows)).toEqual({ all: 4, within: 1, outside: 2 });
  });

  it("explains empty filter results", () => {
    expect(micronutrientReportEmptyMessage(rows, [], "within", "Ingen data")).toBe(
      "Ingen stoffer er innenfor AR og RI.",
    );
    expect(micronutrientReportEmptyMessage(rows, [], "outside", "Ingen data")).toBe(
      "Ingen avvik — alle stoffer er innenfor AR og RI.",
    );
  });
});
