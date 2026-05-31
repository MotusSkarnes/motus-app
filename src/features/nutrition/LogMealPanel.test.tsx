import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { LogMealPanel } from "./LogMealPanel";

const foodDrafts = vi.hoisted(() => [
  {
    grams: 100,
    food: {
      id: "food-egg",
      name: "Test Egg",
      portionLabel: "100 g",
      portionGrams: 100,
      category: "proteinkilder",
      origin: "Test",
      source: "egen",
      createdBy: "test",
      createdAt: "2026-05-31T00:00:00.000Z",
      nutritionPer100g: {
        kcal: 140,
        protein: 12,
        carbs: 1,
        fat: 10,
        fiber: 0,
        sugar: 0,
        saturatedFat: 3,
        sodium: 120,
      },
    },
  },
  {
    grams: 100,
    food: {
      id: "food-bread",
      name: "Test Bread",
      portionLabel: "100 g",
      portionGrams: 100,
      category: "karbohydrater",
      origin: "Test",
      source: "egen",
      createdBy: "test",
      createdAt: "2026-05-31T00:00:00.000Z",
      nutritionPer100g: {
        kcal: 250,
        protein: 8,
        carbs: 45,
        fat: 3,
        fiber: 6,
        sugar: 2,
        saturatedFat: 1,
        sodium: 400,
      },
    },
  },
]);

vi.mock("./FoodLogFormFields", () => ({
  FoodLogFormFields: ({ onSubmit }) => (
    <button
      type="button"
      onClick={() => {
        onSubmit(foodDrafts[0]);
        onSubmit(foodDrafts[1]);
      }}
    >
      Legg til to
    </button>
  ),
}));

vi.mock("../../app/memberMealPlanStateCloud", async () => {
  const state = await vi.importActual<typeof import("../../app/memberMealPlanState")>(
    "../../app/memberMealPlanState",
  );
  return {
    persistMemberMealPlanStateLocalAndScheduleCloud: vi.fn((memberId, nextState) => {
      state.saveMemberMealPlanState(memberId, nextState);
    }),
    syncMemberMealPlanState: vi.fn((memberId) => Promise.resolve(state.loadMemberMealPlanState(memberId))),
  };
});

describe("LogMealPanel", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("preserves rapid consecutive food log submissions", async () => {
    const memberId = "member-rapid-logs";
    render(<LogMealPanel memberId={memberId} />);

    fireEvent.click(screen.getByRole("button", { name: /Logg et måltid/i }));
    fireEvent.click(screen.getByRole("button", { name: "Legg til to" }));

    await waitFor(() => {
      const entries = Object.values(loadMemberMealPlanState(memberId).quickFoodLogs).flat();
      expect(entries).toHaveLength(2);
    });
  });
});
