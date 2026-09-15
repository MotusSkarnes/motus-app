import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { SaveLoggedMealModal } from "./SaveLoggedMealModal";

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<MemberQuickFoodLogEntry> = {}): MemberQuickFoodLogEntry {
  return {
    id: "log-1",
    name: "Havregryn",
    grams: 80,
    source: "food",
    mealId: "member-frokost",
    loggedAt: "2026-05-29T08:00:00.000Z",
    nutritionPer100g: {
      kcal: 370,
      protein: 13,
      carbs: 60,
      fat: 7,
      fiber: 8,
      sugar: 1,
      saturatedFat: 1,
      sodium: 0,
    },
    ...overrides,
  };
}

describe("SaveLoggedMealModal", () => {
  it("starts with all ingredients included and saves edited meal", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SaveLoggedMealModal
        open
        mealLabel="Frokost"
        mealSlotId="member-frokost"
        entries={[
          entry(),
          entry({ id: "log-2", name: "Melk", grams: 200 }),
          entry({ id: "log-3", name: "Banan", grams: 120 }),
        ]}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Lagre som måltid" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ta med Havregryn")).toBeChecked();
    expect(screen.getByLabelText("Ta med Melk")).toBeChecked();
    expect(screen.getByLabelText("Ta med Banan")).toBeChecked();

    await user.click(screen.getByLabelText("Ta med Melk"));
    const grams = screen.getByLabelText("Mengde i gram for Havregryn");
    await user.clear(grams);
    await user.type(grams, "90");
    await user.click(screen.getByRole("button", { name: "Lagre måltid" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const meal = onSave.mock.calls[0]?.[0];
    expect(meal.name).toBe("Havregryn m.m.");
    expect(meal.items).toEqual([
      expect.objectContaining({ name: "Havregryn", grams: 90 }),
      expect.objectContaining({ name: "Banan", grams: 120 }),
    ]);
    expect(onClose).toHaveBeenCalled();
  });
});
