import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MealPlan } from "../../app/mealPlanTypes";
import { TrainerMealPlanWeekGrid } from "./TrainerMealPlanWeekGrid";

const plan: MealPlan = {
  id: "plan-1",
  memberId: "member-1",
  title: "Test",
  notes: "",
  createdAt: new Date().toISOString(),
  days: [
    {
      id: "day-mon",
      label: "Mandag",
      meals: [{ id: "meal-frokost", name: "Frokost", items: [] }],
    },
  ],
};

describe("TrainerMealPlanWeekGrid", () => {
  it("closes open menu on outside click", async () => {
    const user = userEvent.setup();
    const onCloseMenu = vi.fn();

    render(
      <TrainerMealPlanWeekGrid
        plan={plan}
        foodById={new Map()}
        recipesById={new Map()}
        selection={{ dayId: "day-mon", mealId: "meal-frokost" }}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onCloseMenu={onCloseMenu}
        onAddFood={vi.fn()}
        onAddRecipe={vi.fn()}
        onClearMeal={vi.fn()}
      />,
    );

    expect(screen.getByText("Matvare")).toBeInTheDocument();
    await user.click(document.body);
    expect(onCloseMenu).toHaveBeenCalled();
  });
});
