import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_FOOD_LOG_NUTRITION } from "../../app/quickFoodLogNutrition";
import { buildDailyVariationTable } from "../../app/nutritionReportDailyVariation";
import { NutritionReportDailyVariation } from "./NutritionReportDailyVariation";
import { useState } from "react";

afterEach(() => {
  cleanup();
});

function Harness() {
  const [group, setGroup] = useState<"macro" | "micro">("macro");
  const table = buildDailyVariationTable(
    [
      {
        dateKey: "2026-09-13",
        totals: {
          ...EMPTY_FOOD_LOG_NUTRITION,
          kcal: 1400,
          protein: 70,
          micronutrients: { ...EMPTY_FOOD_LOG_NUTRITION.micronutrients, vitaminD: 2 },
        },
      },
      {
        dateKey: "2026-09-14",
        totals: {
          ...EMPTY_FOOD_LOG_NUTRITION,
          kcal: 2200,
          protein: 130,
          micronutrients: { ...EMPTY_FOOD_LOG_NUTRITION.micronutrients, vitaminD: 12 },
        },
      },
    ],
    {
      ...EMPTY_FOOD_LOG_NUTRITION,
      kcal: 1800,
      protein: 100,
      micronutrients: { ...EMPTY_FOOD_LOG_NUTRITION.micronutrients, vitaminD: 7 },
    },
    group,
  );
  return <NutritionReportDailyVariation table={table} group={group} onGroupChange={setGroup} />;
}

describe("NutritionReportDailyVariation", () => {
  it("shows weekday rows and switches to micronutrients", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("columnheader", { name: "kcal" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "søn 13.09" })).toBeTruthy();
    expect(screen.getByText("1400")).toBeTruthy();
    expect(screen.getByText("2200")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Vitaminer og mineraler" }));
    expect(screen.getByRole("columnheader", { name: "D" })).toBeTruthy();
    expect(screen.getByText("2,0")).toBeTruthy();
    expect(screen.getByText("12,0")).toBeTruthy();
  });
});
