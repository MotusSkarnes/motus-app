import { describe, expect, it } from "vitest";
import { mergeMemberMealPlanStates, type MemberMealPlanState } from "./memberMealPlanState";

function makeState(partial?: Partial<MemberMealPlanState>): MemberMealPlanState {
  return {
    loggedMeals: {},
    loggedFoodIds: {},
    waterLiters: {},
    checkedShopping: [],
    recipePortions: {},
    mealSwaps: {},
    quickFoodLogs: {},
    skippedFoodIds: {},
    ...partial,
  };
}

function foodLog(
  id: string,
  name: string,
  loggedAt: string,
): MemberMealPlanState["quickFoodLogs"][string][number] {
  return {
    id,
    name,
    grams: 100,
    source: "food",
    loggedAt,
    nutritionPer100g: {
      kcal: 100,
      protein: 1,
      carbs: 10,
      fat: 1,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
  };
}

describe("mergeMemberMealPlanStates", () => {
  it("beholder recipePortions når tidsstempel er likt", () => {
    const updatedAt = "2026-05-28T10:00:00.000Z";
    const local = makeState({
      updatedAt,
      recipePortions: { "entry-a": 2 },
    });
    const remote = makeState({
      updatedAt,
      recipePortions: { "entry-b": 1.5 },
    });

    const merged = mergeMemberMealPlanStates(local, remote);
    expect(merged.recipePortions).toEqual({
      "entry-b": 1.5,
      "entry-a": 2,
    });
  });

  it("beholder lokale matlogger når sky har nyere tidsstempel", () => {
    const local = makeState({
      updatedAt: "2026-06-02T08:00:00.000Z",
      quickFoodLogs: {
        "2026-06-02": [
          {
            id: "log-1",
            name: "Olden",
            grams: 600,
            source: "food",
            loggedAt: "2026-06-02T09:00:00.000Z",
            nutritionPer100g: {
              kcal: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              sugar: 0,
              saturatedFat: 0,
              sodium: 0,
              water: 0,
            },
          },
        ],
      },
    });
    const remote = makeState({
      updatedAt: "2026-06-02T10:00:00.000Z",
      quickFoodLogs: {},
    });
    const merged = mergeMemberMealPlanStates(local, remote);
    expect(merged.quickFoodLogs["2026-06-02"]).toHaveLength(1);
  });

  it("keeps a local delete when local state is newer than sky", () => {
    const log = {
      id: "log-1",
      name: "Vitaminbamser",
      grams: 100,
      source: "food" as const,
      loggedAt: "2026-06-02T09:00:00.000Z",
      nutritionPer100g: {
        kcal: 350,
        protein: 5,
        carbs: 80,
        fat: 1,
        fiber: 0,
        sugar: 70,
        saturatedFat: 0,
        sodium: 0,
      },
    };
    const local = makeState({
      updatedAt: "2026-06-02T10:05:00.000Z",
      quickFoodLogs: { "2026-06-02": [] },
    });
    const remote = makeState({
      updatedAt: "2026-06-02T10:00:00.000Z",
      quickFoodLogs: { "2026-06-02": [log] },
    });

    const merged = mergeMemberMealPlanStates(local, remote);
    expect(merged.quickFoodLogs["2026-06-02"]).toBeUndefined();
  });

  it("keeps meals logged on both devices instead of dropping the older day's entries", () => {
    const breakfast = foodLog("log-breakfast", "Havregrøt", "2026-06-02T08:00:00.000Z");
    const lunch = foodLog("log-lunch", "Kylling", "2026-06-02T12:00:00.000Z");
    const local = makeState({
      updatedAt: "2026-06-02T12:05:00.000Z",
      quickFoodLogs: { "2026-06-02": [lunch] },
    });
    const remote = makeState({
      updatedAt: "2026-06-02T08:05:00.000Z",
      quickFoodLogs: { "2026-06-02": [breakfast] },
    });

    const merged = mergeMemberMealPlanStates(local, remote);
    const ids = (merged.quickFoodLogs["2026-06-02"] ?? []).map((entry) => entry.id).sort();
    expect(ids).toEqual(["log-breakfast", "log-lunch"]);
  });

  it("does not let a newer stale snapshot wipe meals that only exist in the older cloud copy", () => {
    const breakfast = foodLog("log-breakfast", "Havregrøt", "2026-06-02T08:00:00.000Z");
    const lunch = foodLog("log-lunch", "Kylling", "2026-06-02T12:00:00.000Z");
    const staleLocal = makeState({
      updatedAt: "2026-06-02T13:00:00.000Z",
      quickFoodLogs: { "2026-06-02": [breakfast] },
    });
    const cloud = makeState({
      updatedAt: "2026-06-02T12:05:00.000Z",
      quickFoodLogs: { "2026-06-02": [breakfast, lunch] },
    });

    const merged = mergeMemberMealPlanStates(staleLocal, cloud);
    const ids = (merged.quickFoodLogs["2026-06-02"] ?? []).map((entry) => entry.id).sort();
    expect(ids).toEqual(["log-breakfast", "log-lunch"]);
  });
});
