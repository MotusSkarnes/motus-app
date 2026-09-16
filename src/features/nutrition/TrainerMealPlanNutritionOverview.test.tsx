import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrainerMealPlanNutritionOverview } from "./TrainerMealPlanNutritionOverview";
import { highestNutritionReferenceContext } from "../../app/personalizedNutritionReferences";

afterEach(() => {
  cleanup();
});

describe("TrainerMealPlanNutritionOverview", () => {
  it("viser mikronæringsstoffer mot anbefaling og lar treneren velge høyeste anbefaling", async () => {
    const user = userEvent.setup();
    const onReferenceChange = vi.fn();
    render(
      <TrainerMealPlanNutritionOverview
        averageUsed={{ kcal: 1800, protein: 90, carbs: 180, fat: 60 }}
        targets={{ kcal: 2000, protein: 120, carbs: 200, fat: 70 }}
        micronutrients={[
          {
            key: "iron",
            label: "Jern",
            unit: "mg",
            value: 12,
            target: 15,
            coveragePct: 80,
            statusTone: "warn",
            statusLabel: "Under RI",
            decimals: 1,
          },
        ]}
        referenceContext={highestNutritionReferenceContext()}
        reference={{ mode: "highest" }}
        onReferenceChange={onReferenceChange}
      />,
    );

    const ironRow = screen.getByRole("row", { name: /Jern/ });
    expect(ironRow.className).toMatch(/is-warn/);
    expect(ironRow.textContent).toMatch(/12/);
    expect(ironRow.textContent).toMatch(/15/);
    await user.click(screen.getByRole("button", { name: "Alder og kjønn" }));
    expect(onReferenceChange).toHaveBeenCalledWith({ mode: "custom", ageYears: 30, gender: "female" });
    expect(screen.queryByRole("button", { name: "Merket dag" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Snitt av valgte" })).toBeNull();
  });
});
