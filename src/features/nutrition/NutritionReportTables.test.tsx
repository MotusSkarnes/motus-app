import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import type { MicronutrientDailyRow, MicronutrientReportFilterMode } from "../../app/quickFoodLogNutrition";
import { filterMicronutrientReportRows } from "../../app/quickFoodLogNutrition";
import { NutritionReportStackedBody } from "./NutritionReportTables";

afterEach(() => {
  cleanup();
});

const microRow = (
  key: MicronutrientDailyRow["key"],
  tone: MicronutrientDailyRow["statusTone"],
  extra: Partial<MicronutrientDailyRow> = {},
): MicronutrientDailyRow => ({
  key,
  label: key === "vitaminA" ? "Vitamin A" : key === "iron" ? "Jern" : "Sink",
  unit: key === "vitaminA" ? "µg" : "mg",
  decimals: 0,
  value: 600,
  target: 700,
  coveragePct: 86,
  lower: 540,
  upper: 3000,
  status: "adequate",
  statusLabel: tone === "ok" ? "OK" : tone === "warn" ? "Under RI" : "Under AR",
  statusTone: tone,
  ...extra,
});

function ReportHarness({ rows }: { rows: MicronutrientDailyRow[] }) {
  const [filter, setFilter] = useState<MicronutrientReportFilterMode>("all");
  return (
    <NutritionReportStackedBody
      waterRows={[{ label: "Vann (totalt)", value: 2, unit: "L", target: 2.5, decimals: 1 }]}
      macroRows={[{ label: "Protein", value: 120, unit: "g", target: 130, decimals: 0 }]}
      macroFootnote="Makro-fotnote"
      microRows={rows}
      visibleMicroRows={filterMicronutrientReportRows(rows, filter)}
      microFilter={filter}
      onMicroFilterChange={setFilter}
      microNoDataMessage="Ingen mikronæringsdata"
      referenceFootnote="NNR-fotnote"
      omegaRows={[{ label: "Omega-3", value: 1.2, unit: "g", decimals: 1 }]}
      omegaFootnote="Omega-fotnote"
    />
  );
}

describe("NutritionReportStackedBody", () => {
  const rows = [
    microRow("vitaminA", "ok"),
    microRow("iron", "warn", { value: 8, target: 15, lower: 9, upper: 45 }),
    microRow("zinc", "danger", { value: 3, target: 9, lower: 6, upper: 25 }),
  ];

  it("shows macros, micros and omega on one scrollable page with units on AR/RI/UL", () => {
    render(<ReportHarness rows={rows} />);
    expect(screen.getByRole("heading", { name: "Makronæringsstoffer" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mikronæringsstoffer" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Omega-fettsyrer" })).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByText("AR 540 µg · RI 700 µg · UL 3000 µg")).toBeTruthy();
    expect(screen.getByText("AR 9 mg · RI 15 mg · UL 45 mg")).toBeTruthy();
  });

  it("can show only values within or outside AR/RI", async () => {
    const user = userEvent.setup();
    render(<ReportHarness rows={rows} />);

    await user.click(screen.getByRole("button", { name: "Innenfor AR/RI (1)" }));
    expect(screen.getByText("Vitamin A")).toBeTruthy();
    expect(screen.queryByText("Jern")).toBeNull();
    expect(screen.queryByText("Sink")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Utenfor AR/RI (2)" }));
    expect(screen.queryByText("Vitamin A")).toBeNull();
    expect(screen.getByText("Jern")).toBeTruthy();
    expect(screen.getByText("Sink")).toBeTruthy();
  });
});
