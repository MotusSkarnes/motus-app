import { describe, expect, it } from "vitest";
import { EMPTY_MEMBER_MEAL_PLAN_STATE, type MemberMealPlanState, type MemberQuickFoodLogEntry } from "./memberMealPlanState";
import { mergeMemberMealPlanStateList, shouldWriteMealPlanStateToCloud } from "./memberMealPlanStateCloud";

function state(partial: Partial<MemberMealPlanState>): MemberMealPlanState {
  return { ...EMPTY_MEMBER_MEAL_PLAN_STATE, ...partial };
}

function log(id: string, name: string): MemberQuickFoodLogEntry {
  return {
    id,
    name,
    grams: 100,
    source: "food",
    loggedAt: "2026-09-23T08:00:00.000Z",
    nutritionPer100g: {
      kcal: 100,
      protein: 5,
      carbs: 10,
      fat: 2,
      fiber: 1,
      sugar: 1,
      saturatedFat: 0,
      sodium: 0,
    },
  };
}

describe("mergeMemberMealPlanStateList", () => {
  it("beholder fullføringer fra alle kundeidentiteter selv om en nyere rad er tom", () => {
    const completed = state({
      loggedMeals: { "2026-09-22": ["breakfast"] },
      loggedFoodIds: { "2026-09-22": ["oats"] },
      updatedAt: "2026-09-22T08:00:00.000Z",
    });
    const newerEmptyAlias = state({ updatedAt: "2026-09-22T09:00:00.000Z" });

    const merged = mergeMemberMealPlanStateList([completed, newerEmptyAlias]);

    expect(merged?.loggedMeals["2026-09-22"]).toEqual(["breakfast"]);
    expect(merged?.loggedFoodIds["2026-09-22"]).toEqual(["oats"]);
    expect(merged?.updatedAt).toBe("2026-09-22T09:00:00.000Z");
  });

  it("beholder matlogger fra samme dag på begge kundeidentiteter", () => {
    const phone = state({
      loggedMeals: { "2026-09-23": ["frokost"] },
      quickFoodLogs: { "2026-09-23": [log("a", "Havregryn")] },
      updatedAt: "2026-09-23T08:00:00.000Z",
    });
    const tablet = state({
      loggedMeals: { "2026-09-23": ["lunsj"] },
      quickFoodLogs: { "2026-09-23": [log("b", "Yoghurt")] },
      updatedAt: "2026-09-23T12:00:00.000Z",
    });

    const merged = mergeMemberMealPlanStateList([tablet, phone]);

    expect(merged?.loggedMeals["2026-09-23"]?.slice().sort()).toEqual(["frokost", "lunsj"]);
    expect(merged?.quickFoodLogs["2026-09-23"]?.map((entry) => entry.id).sort()).toEqual(["a", "b"]);
    expect(merged?.updatedAt).toBe("2026-09-23T12:00:00.000Z");
  });
});

describe("shouldWriteMealPlanStateToCloud", () => {
  it("skriver ikke tilbake når henting feilet eller visningen er skrivebeskyttet", () => {
    const local = state({
      quickFoodLogs: { "2026-09-23": [log("a", "Havregryn")] },
      updatedAt: "2026-09-23T08:00:00.000Z",
    });

    expect(shouldWriteMealPlanStateToCloud({
      writeBack: true,
      fetchFailed: true,
      remote: null,
      merged: local,
    })).toBe(false);
    expect(shouldWriteMealPlanStateToCloud({
      writeBack: false,
      fetchFailed: false,
      remote: null,
      merged: local,
    })).toBe(false);
  });

  it("reparerer en manglende skyrad når den lokale loggen har aktivitet", () => {
    const local = state({
      loggedMeals: { "2026-09-23": ["frokost"] },
      updatedAt: "2026-09-23T08:00:00.000Z",
    });

    expect(shouldWriteMealPlanStateToCloud({
      writeBack: true,
      fetchFailed: false,
      remote: null,
      merged: local,
    })).toBe(true);
  });
});
