import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { buildMacroDisplayRows, buildWaterReportRows } from "../../app/nutritionReportDisplay";
import { EMPTY_FATTY_ACIDS } from "../../app/foodBankFattyAcids";
import { buildOmegaOverviewRows } from "../../app/nutritionReportFattyAcids";
import { EMPTY_FOOD_LOG_NUTRITION, filterMicronutrientReportRows } from "../../app/quickFoodLogNutrition";
import type { MicronutrientDailyRow, MicronutrientReportFilterMode } from "../../app/quickFoodLogNutrition";
import { buildNutrientContributionLookup } from "../../app/nutritionReportContributors";
import { buildNutrientCoverageLookup } from "../../app/nutritionReportCoverage";
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
  const sources = [
    {
      name: "Laks, oppdrett, rå",
      grams: 150,
      nutritionPer100g: {
        kcal: 200,
        protein: 20,
        carbs: 0,
        fat: 13,
        fiber: 0,
        sugar: 0,
        saturatedFat: 2,
        sodium: 50,
        micronutrients: { vitaminA: 80, iron: 0.8, zinc: 0.6 },
      },
    },
    {
      name: "Egg",
      grams: 100,
      nutritionPer100g: {
        kcal: 155,
        protein: 13,
        carbs: 1,
        fat: 11,
        fiber: 0,
        sugar: 0,
        saturatedFat: 3,
        sodium: 120,
        micronutrients: { vitaminA: 160, iron: 1.8, zinc: 1.1, copper: 0 },
      },
    },
  ];
  const contributionLookup = buildNutrientContributionLookup(sources);
  const coverageLookup = buildNutrientCoverageLookup(sources);
  return (
    <NutritionReportStackedBody
      waterRows={buildWaterReportRows(EMPTY_FOOD_LOG_NUTRITION)}
      macroRows={buildMacroDisplayRows(EMPTY_FOOD_LOG_NUTRITION, null)}
      macroFootnote="Makro-fotnote"
      microRows={rows}
      visibleMicroRows={filterMicronutrientReportRows(rows, filter)}
      microFilter={filter}
      onMicroFilterChange={setFilter}
      microNoDataMessage="Ingen mikronæringsdata"
      referenceFootnote="NNR-fotnote"
      omegaRows={buildOmegaOverviewRows({ ...EMPTY_FATTY_ACIDS, omega3: 3, ala: 1.2, epa: 0.2, dha: 0.15 }, 2000)}
      omegaFootnote="Omega-fotnote"
      contributionLookup={contributionLookup}
      coverageLookup={coverageLookup}
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
    expect(screen.getByText("EPA + DHA")).toBeTruthy();
    expect(screen.getByText("Ref. 0.25 g · EFSA")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Omega-fettsyrer" })).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByText("AR 540 µg · RI 700 µg · UL 3000 µg")).toBeTruthy();
    expect(screen.getByText("AR 9 mg · RI 15 mg · UL 45 mg")).toBeTruthy();
    expect(screen.getAllByText("Ingen referanse").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Min .+ g · Ref\. .+ g · Maks .+ g/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Maks 2300 mg/)).toBeTruthy();
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

  it("places contributions between the nutrient name and status", () => {
    render(<ReportHarness rows={rows} />);
    const name = screen.getByText("Vitamin A");
    const row = name.closest(".motus-nutrition-report__micro-row");
    expect(row).toBeTruthy();
    const preview = row!.querySelector(".motus-nutrition-report__contrib-preview");
    const status = row!.querySelector(".motus-nutrition-report__micro-status");
    expect(preview?.textContent).toMatch(/Egg \d+%/);
    expect(status?.textContent).toBe("OK");
    expect(name.compareDocumentPosition(preview!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(preview!.compareDocumentPosition(status!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows top food contributions and expands full names from Bidrag", async () => {
    const user = userEvent.setup();
    render(<ReportHarness rows={rows} />);
    expect(screen.getAllByText(/Laks \d+%/).length).toBeGreaterThan(0);
    const bidrag = screen.getAllByText("Bidrag")[0];
    expect(bidrag).toBeTruthy();
    await user.click(bidrag);
    expect(screen.getAllByText("Laks, oppdrett, rå").length).toBeGreaterThan(0);
  });

  it("shows known-value coverage at the bottom right of each nutrient", () => {
    render(<ReportHarness rows={rows} />);
    const vitaminA = screen.getByText("Vitamin A").closest(".motus-nutrition-report__micro-row");
    expect(vitaminA?.querySelector(".motus-nutrition-report__data-coverage")?.textContent).toBe("100%");
    expect(vitaminA?.querySelector(".motus-nutrition-report__data-coverage")?.getAttribute("title")).toMatch(
      /2 av 2 matvarer/,
    );
  });
});
