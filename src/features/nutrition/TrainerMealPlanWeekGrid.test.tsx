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

  it("toggles all visible weekdays with one button", async () => {
    const user = userEvent.setup();
    const onToggleAllIncludedDays = vi.fn();
    const twoDayPlan: MealPlan = {
      ...plan,
      days: [
        plan.days[0],
        { id: "day-tue", label: "Tirsdag", meals: [{ id: "meal-tue", name: "Frokost", items: [] }] },
      ],
    };

    const { rerender } = render(
      <TrainerMealPlanWeekGrid
        plan={twoDayPlan}
        foodById={new Map()}
        recipesById={new Map()}
        selection={null}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onCloseMenu={vi.fn()}
        onAddFood={vi.fn()}
        onAddRecipe={vi.fn()}
        onClearMeal={vi.fn()}
        includedDayIds={["day-mon"]}
        onToggleIncludedDay={vi.fn()}
        onToggleAllIncludedDays={onToggleAllIncludedDays}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Merk alle" }));
    expect(onToggleAllIncludedDays).toHaveBeenCalledTimes(1);

    rerender(
      <TrainerMealPlanWeekGrid
        plan={twoDayPlan}
        foodById={new Map()}
        recipesById={new Map()}
        selection={null}
        onSelect={vi.fn()}
        onPreview={vi.fn()}
        onCloseMenu={vi.fn()}
        onAddFood={vi.fn()}
        onAddRecipe={vi.fn()}
        onClearMeal={vi.fn()}
        includedDayIds={["day-mon", "day-tue"]}
        onToggleIncludedDay={vi.fn()}
        onToggleAllIncludedDays={onToggleAllIncludedDays}
      />,
    );

    expect(screen.getByRole("button", { name: "Avmerk alle" })).toBeInTheDocument();
  });
});
