import { describe, expect, it, vi, beforeEach } from "vitest";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, type MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { updateQuickFoodLog } from "./memberMealPlanTracking";

vi.mock("./memberMealPlanStateCloud", () => ({
  persistMemberMealPlanStateLocalAndScheduleCloud: vi.fn(),
}));

function entry(overrides: Partial<MemberQuickFoodLogEntry> = {}): MemberQuickFoodLogEntry {
  return {
    id: "log-1",
    name: "Havregrøt",
    grams: 200,
    source: "food",
    loggedAt: "2026-09-08T10:00:00.000Z",
    mealId: "member-frokost",
    nutritionPer100g: {
      kcal: 70,
      protein: 2,
      carbs: 12,
      fat: 1,
      fiber: 1,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
    ...overrides,
  };
}

describe("updateQuickFoodLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates grams and meal slot for an existing entry", () => {
    const state = {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: {
        "2026-09-08": [entry()],
      },
    };

    const next = updateQuickFoodLog("member-1", state, "2026-09-08", "log-1", {
      grams: 150,
      mealId: "member-lunsj",
    });

    expect(next.quickFoodLogs["2026-09-08"]).toEqual([
      expect.objectContaining({
        id: "log-1",
        grams: 150,
        mealId: "member-lunsj",
      }),
    ]);
  });

  it("ignores invalid grams and keeps current value", () => {
    const state = {
      ...EMPTY_MEMBER_MEAL_PLAN_STATE,
      quickFoodLogs: {
        "2026-09-08": [entry({ grams: 180 })],
      },
    };

    const next = updateQuickFoodLog("member-1", state, "2026-09-08", "log-1", {
      grams: 0,
      mealId: "member-middag",
    });

    expect(next.quickFoodLogs["2026-09-08"]?.[0]).toEqual(
      expect.objectContaining({
        grams: 180,
        mealId: "member-middag",
      }),
    );
  });
});
