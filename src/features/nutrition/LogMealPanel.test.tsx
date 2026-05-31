import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMemberMealPlanState } from "../../app/memberMealPlanState";
import { LogMealPanel } from "./LogMealPanel";

const foodItems = vi.hoisted(() => [
  {
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
]);

vi.mock("../../app/useFoodBankItems", () => ({
  useFoodBankItems: () => foodItems,
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
    fireEvent.click(screen.getByRole("option", { name: /Test Egg/i }));

    const submit = screen.getByRole("button", { name: "Legg til" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      const entries = Object.values(loadMemberMealPlanState(memberId).quickFoodLogs).flat();
      expect(entries).toHaveLength(2);
    });
  });
});
