import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { FoodItem, FoodNutrition } from "../../app/foodBankTypes";
import { buildMacroDisplayRows, buildWaterReportRows } from "../../app/nutritionReportDisplay";
import { EMPTY_FATTY_ACIDS } from "../../app/foodBankFattyAcids";
import { buildOmegaOverviewRows } from "../../app/nutritionReportFattyAcids";
import { EMPTY_FOOD_LOG_NUTRITION, filterMicronutrientReportRows } from "../../app/quickFoodLogNutrition";
import type { MicronutrientDailyRow, MicronutrientReportFilterMode } from "../../app/quickFoodLogNutrition";
import { buildNutrientContributionLookup } from "../../app/nutritionReportContributors";
import { buildNutrientCoverageLookup } from "../../app/nutritionReportCoverage";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import { FOOD_SOURCE_HIDDEN_KEY } from "../../app/foodSourceHiddenStorage";
import { NutritionReportStackedBody } from "./NutritionReportTables";

vi.mock("../../app/useFoodBankItems", () => ({
  useFoodBankItems: vi.fn(() => []),
}));

afterEach(() => {
  cleanup();
  vi.mocked(useFoodBankItems).mockReturnValue([]);
  localStorage.removeItem(FOOD_SOURCE_HIDDEN_KEY);
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

  it("lists top food-bank sources for a nutrient from the current bank", async () => {
    const nutrition = (vitaminA: number): FoodNutrition => ({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: { vitaminA },
    });
    const item = (name: string, vitaminA: number): FoodItem => ({
      id: name,
      name,
      portionLabel: "100 g",
      portionGrams: 100,
      category: "proteinkilder",
      origin: "Test",
      source: "egen",
      createdBy: "test",
      createdAt: "2026-09-01T00:00:00.000Z",
      nutritionPer100g: nutrition(vitaminA),
    });
    vi.mocked(useFoodBankItems).mockReturnValue([item("Svin", 10), item("Lever", 8000)]);
    const user = userEvent.setup();
    render(<ReportHarness rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Vis gode matkilder til Vitamin A" }));
    expect(screen.getByText("Topp 10 i matbanken · mengde per 100 g. Fjern varer som ikke er praktiske kilder.")).toBeTruthy();
    expect(screen.getByText("Lever")).toBeTruthy();
    expect(screen.getByText("8000 µg / 100 g")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vis gode matkilder til Vitamin A" }));
    vi.mocked(useFoodBankItems).mockReturnValue([
      item("Svin", 10),
      item("Lever", 8000),
      item("Fiskeolje", 9000),
    ]);
    await user.click(screen.getByRole("button", { name: "Vis gode matkilder til Vitamin A" }));
    expect(screen.getByText("Fiskeolje")).toBeTruthy();
    expect(screen.getByText("9000 µg / 100 g")).toBeTruthy();
  });

  it("asks before removing a food from the good-sources list", async () => {
    const nutrition = (vitaminA: number): FoodNutrition => ({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: { vitaminA },
    });
    const item = (name: string, vitaminA: number): FoodItem => ({
      id: name,
      name,
      portionLabel: "100 g",
      portionGrams: 100,
      category: "proteinkilder",
      origin: "Test",
      source: "egen",
      createdBy: "test",
      createdAt: "2026-09-01T00:00:00.000Z",
      nutritionPer100g: nutrition(vitaminA),
    });
    vi.mocked(useFoodBankItems).mockReturnValue([item("Svin", 10), item("Lever", 8000)]);
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ReportHarness rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Vis gode matkilder til Vitamin A" }));
    await user.click(screen.getByRole("button", { name: "Fjern Lever fra listen" }));
    expect(confirmSpy).toHaveBeenCalledWith("Vil du fjerne «Lever» fra listen over gode matkilder?");
    expect(screen.getByText("Lever")).toBeTruthy();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Fjern Lever fra listen" }));
    expect(screen.queryByText("Lever")).toBeNull();
    expect(screen.getByText("Svin")).toBeTruthy();
    confirmSpy.mockRestore();
  });

  it("can expand the good-sources list from top 10 to top 50", async () => {
    const nutrition = (vitaminA: number): FoodNutrition => ({
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
      micronutrients: { vitaminA },
    });
    const item = (name: string, vitaminA: number): FoodItem => ({
      id: name,
      name,
      portionLabel: "100 g",
      portionGrams: 100,
      category: "proteinkilder",
      origin: "Test",
      source: "egen",
      createdBy: "test",
      createdAt: "2026-09-01T00:00:00.000Z",
      nutritionPer100g: nutrition(vitaminA),
    });
    vi.mocked(useFoodBankItems).mockReturnValue(
      Array.from({ length: 12 }, (_, index) => item(`Kilde ${index + 1}`, index + 1)),
    );
    const user = userEvent.setup();
    render(<ReportHarness rows={rows} />);
    await user.click(screen.getByRole("button", { name: "Vis gode matkilder til Vitamin A" }));
    expect(screen.getByText("Kilde 12")).toBeTruthy();
    expect(screen.queryByText("Kilde 2")).toBeNull();
    expect(screen.queryByRole("button", { name: "Vis topp 50" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vis topp 50" }));
    expect(screen.getByText("Topp 50 i matbanken · mengde per 100 g. Fjern varer som ikke er praktiske kilder.")).toBeTruthy();
    expect(screen.getByText("Kilde 2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Vis topp 10" }));
    expect(screen.queryByText("Kilde 2")).toBeNull();
  });
});
