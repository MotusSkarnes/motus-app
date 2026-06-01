import { describe, expect, it } from "vitest";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  createSavedMealFromQuickLogs,
  parseMemberSavedMeals,
  quickLogEntriesFromSavedMeal,
  savedMealsForSlot,
} from "./memberSavedMeals";

const entry = (mealId: string): MemberQuickFoodLogEntry => ({
  id: "log-1",
  name: "Havregryn",
  grams: 80,
  source: "food",
  mealId,
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
});

describe("memberSavedMeals", () => {
  it("round-trips through parse", () => {
    const saved = createSavedMealFromQuickLogs([entry("member-frokost")], "Min frokost", "member-frokost");
    const parsed = parseMemberSavedMeals([saved]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Min frokost");
    expect(parsed[0]?.items).toHaveLength(1);
  });

  it("filters by slot including generic meals", () => {
    const generic = createSavedMealFromQuickLogs([entry("member-frokost")], "Snack", undefined);
    const frokost = createSavedMealFromQuickLogs([entry("member-frokost")], "Frokost", "member-frokost");
    const lunsj = createSavedMealFromQuickLogs([entry("member-lunsj")], "Lunsj", "member-lunsj");
    const forFrokost = savedMealsForSlot([generic, frokost, lunsj], "member-frokost");
    expect(forFrokost.map((m) => m.name).sort()).toEqual(["Frokost", "Snack"].sort());
  });

  it("creates quick log entries for apply", () => {
    const saved = createSavedMealFromQuickLogs([entry("member-frokost")], "Min frokost", "member-frokost");
    const logs = quickLogEntriesFromSavedMeal(saved, "member-frokost");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.name).toBe("Havregryn");
    expect(logs[0]?.mealId).toBe("member-frokost");
  });
});
