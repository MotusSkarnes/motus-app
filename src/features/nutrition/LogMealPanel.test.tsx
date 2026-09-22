import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_MEMBER_MEAL_PLAN_STATE,
  loadMemberMealPlanState,
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
  it("copies a logged day directly to another date", async () => {
    const user = userEvent.setup();
    const dateKey = toIsoDateKey(new Date());
    const target = new Date();
    target.setDate(target.getDate() - 1);
    const targetKey = toIsoDateKey(target);
    saveMemberMealPlanState(MEMBER_ID, {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: { [dateKey]: [{
        id: "egg-original", name: "Egg", grams: 100, source: "food", mealId: "member-frokost",
        loggedAt: new Date().toISOString(), nutritionPer100g: {
          kcal: 140, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 0, saturatedFat: 3, sodium: 120,
        },
      }] },
    });
    render(<LogMealPanel memberId={MEMBER_ID} showWaterSection={false} />);
    await user.click(screen.getByRole("button", { name: "Kopier hele dagen til en annen dag" }));
    const dialog = screen.getByRole("dialog", { name: "Kopier hele dagen til en annen dag" });
    await user.type(within(dialog).getByLabelText("Til dato"), targetKey);
    await user.click(within(dialog).getByRole("button", { name: "Kopier" }));
    const state = loadMemberMealPlanState(MEMBER_ID);
    expect(state.quickFoodLogs[targetKey]).toHaveLength(1);
    expect(state.quickFoodLogs[targetKey][0].id).not.toBe("egg-original");
    expect(state.quickFoodLogs[dateKey][0].id).toBe("egg-original");
  });

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
