import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_MEMBER_MEAL_PLAN_STATE,
  saveMemberMealPlanState,
  toIsoDateKey,
} from "../../app/memberMealPlanState";
import { LogMealPanel } from "./LogMealPanel";

vi.mock("../../app/useFoodBankItems", () => ({
  useFoodBankItems: () => [],
}));

vi.mock("../../app/memberMealPlanStateCloud", async () => {
  const state = await vi.importActual<typeof import("../../app/memberMealPlanState")>(
    "../../app/memberMealPlanState",
  );
  return {
    persistMemberMealPlanStateLocalAndScheduleCloud: (memberId: string, next: unknown) => {
      state.saveMemberMealPlanState(memberId, next as never);
    },
    syncMemberMealPlanState: async (memberId: string) => state.loadMemberMealPlanState(memberId),
  };
});

const MEMBER_ID = "member-log-meal-panel-test";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("LogMealPanel", () => {
  it("opens the log form above already-logged meals", async () => {
    const user = userEvent.setup();
    const dateKey = toIsoDateKey(new Date());
    saveMemberMealPlanState(MEMBER_ID, {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: {
        [dateKey]: [
          {
            id: "log-egg",
            name: "Egg",
            grams: 100,
            source: "food",
            loggedAt: new Date().toISOString(),
            mealId: "member-frokost",
            nutritionPer100g: {
              kcal: 140,
              protein: 13,
              carbs: 1,
              fat: 10,
              fiber: 0,
              sugar: 0,
              saturatedFat: 3,
              sodium: 120,
            },
          },
        ],
      },
    });

    render(<LogMealPanel memberId={MEMBER_ID} showWaterSection={false} />);

    await user.click(screen.getByRole("button", { name: "Logg et måltid" }));

    const form = document.querySelector(".motus-log-meal-panel__form-wrap");
    const summary = document.querySelector(".motus-log-meal-panel__summary");
    expect(form).toBeTruthy();
    expect(summary).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Logg et måltid" })).toBeInTheDocument();
    expect(form!.compareDocumentPosition(summary!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
