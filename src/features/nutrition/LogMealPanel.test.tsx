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
  it("shows water between the daily totals and logged meals", () => {
    const dateKey = toIsoDateKey(new Date());
    saveMemberMealPlanState(MEMBER_ID, {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: { [dateKey]: [{
        id: "water-order-food", name: "Egg", grams: 100, source: "food", mealId: "member-frokost",
        loggedAt: new Date().toISOString(), nutritionPer100g: {
          kcal: 140, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 0, saturatedFat: 3, sodium: 120,
        },
      }] },
    });
    render(<LogMealPanel memberId={MEMBER_ID} />);
    const totals = document.querySelector(".motus-log-meal-macros")!;
    const water = screen.getByRole("region", { name: "Vanninntak i dag" });
    const logged = document.querySelector(".motus-log-meal-panel__summary")!;
    expect(totals.compareDocumentPosition(water) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(water.compareDocumentPosition(logged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

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
      }, {
        id: "bread-original", name: "Brød", grams: 80, source: "food", mealId: "member-frokost",
        loggedAt: new Date().toISOString(), nutritionPer100g: {
          kcal: 250, protein: 8, carbs: 45, fat: 3, fiber: 6, sugar: 2, saturatedFat: 1, sodium: 400,
        },
      }] },
    });
    render(<LogMealPanel memberId={MEMBER_ID} showWaterSection={false} />);
    await user.click(screen.getByRole("button", { name: "Kopier hele dagen til en annen dag" }));
    const dialog = screen.getByRole("dialog", { name: "Kopier hele dagen til en annen dag" });
    await user.type(within(dialog).getByLabelText("Til dato"), targetKey);
    await user.click(within(dialog).getByRole("button", { name: "Velg matvarer" }));
    const review = screen.getByRole("dialog", { name: "Velg matvarer fra hele dagen" });
    await user.click(within(review).getByRole("checkbox", { name: "Ta med Brød" }));
    await user.selectOptions(within(review).getByLabelText("Legg alle til som"), "member-middag");
    await user.selectOptions(within(review).getByLabelText("Måltid for Egg"), "member-kvelds");
    await user.click(within(review).getByRole("button", { name: "Kopier valgte" }));
    const state = loadMemberMealPlanState(MEMBER_ID);
    expect(state.quickFoodLogs[targetKey]).toHaveLength(1);
    expect(state.quickFoodLogs[targetKey][0].name).toBe("Egg");
    expect(state.quickFoodLogs[targetKey][0].mealId).toBe("member-kvelds");
    expect(state.quickFoodLogs[targetKey][0].id).not.toBe("egg-original");
    expect(state.quickFoodLogs[dateKey][0].id).toBe("egg-original");
  });

  it("offers date copy and saved meal from one meal copy icon", async () => {
    const user = userEvent.setup();
    const dateKey = toIsoDateKey(new Date());
    saveMemberMealPlanState(MEMBER_ID, {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: { [dateKey]: [{
        id: "egg", name: "Egg", grams: 100, source: "food", mealId: "member-frokost",
        loggedAt: new Date().toISOString(), nutritionPer100g: {
          kcal: 140, protein: 13, carbs: 1, fat: 10, fiber: 0, sugar: 0, saturatedFat: 3, sodium: 120,
        },
      }] },
    });
    render(<LogMealPanel memberId={MEMBER_ID} showWaterSection={false} />);
    await user.click(screen.getByRole("button", { name: "Kopier Frokost" }));
    const dialog = screen.getByRole("dialog", { name: "Kopier Frokost" });
    expect(within(dialog).getByRole("button", { name: "Kopier til en annen dag" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Lagre i lagrede måltider" }));
    expect(screen.getByRole("dialog", { name: "Lagre som måltid" })).toBeInTheDocument();
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
