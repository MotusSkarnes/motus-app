import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadMemberMealPlanState,
  type MemberMealPlanState,
  type MemberQuickFoodLogEntry,
} from "./memberMealPlanState";
import { updateMemberMealPlanStateLocalAndScheduleCloud } from "./memberMealPlanStateCloud";

vi.mock("../services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

function makeEntry(id: string): MemberQuickFoodLogEntry {
  return {
    id,
    name: id,
    grams: 100,
    source: "food",
    loggedAt: `2026-05-30T10:00:0${id === "first" ? "1" : "2"}.000Z`,
    nutritionPer100g: {
      kcal: 100,
      protein: 10,
      carbs: 12,
      fat: 3,
      fiber: 1,
      sugar: 2,
      saturatedFat: 1,
      sodium: 50,
    },
  };
}

function addQuickLog(memberId: string, dateKey: string, entry: MemberQuickFoodLogEntry): MemberMealPlanState {
  return updateMemberMealPlanStateLocalAndScheduleCloud(memberId, (current) => ({
    ...current,
    quickFoodLogs: {
      ...current.quickFoodLogs,
      [dateKey]: [entry, ...(current.quickFoodLogs[dateKey] ?? [])],
    },
    updatedAt: entry.loggedAt,
  }));
}

describe("member meal plan state cloud persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("applies consecutive quick-log updates to the latest local state", () => {
    const memberId = "member-quick-log";
    const dateKey = "2026-05-30";

    addQuickLog(memberId, dateKey, makeEntry("first"));
    const next = addQuickLog(memberId, dateKey, makeEntry("second"));

    expect(next.quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual(["second", "first"]);
    expect(loadMemberMealPlanState(memberId).quickFoodLogs[dateKey]?.map((entry) => entry.id)).toEqual([
      "second",
      "first",
    ]);
  });
});
