import { describe, expect, it } from "vitest";
import type { MemberQuickFoodLogEntry } from "./memberMealPlanState";
import {
  createSavedMealFromQuickLogs,
  createSavedMealFromSaveRows,
  loggedMealSaveRowsFromEntries,
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

  it("returns all saved meals regardless of active slot", () => {
    const frokost = createSavedMealFromQuickLogs([entry("member-frokost")], "Frokost", "member-frokost");
    const lunsj = createSavedMealFromQuickLogs([entry("member-lunsj")], "Lunsj", "member-lunsj");
    const forLunsj = savedMealsForSlot([frokost, lunsj], "member-lunsj");
    const forFrokost = savedMealsForSlot([frokost, lunsj], "member-frokost");
    expect(forLunsj.map((m) => m.name).sort()).toEqual(["Frokost", "Lunsj"].sort());
    expect(forFrokost.map((m) => m.name).sort()).toEqual(forLunsj.map((m) => m.name).sort());
  });

  it("builds save rows with all ingredients included", () => {
    const rows = loggedMealSaveRowsFromEntries([
      entry("member-frokost"),
      { ...entry("member-frokost"), id: "log-2", name: "Melk", grams: 200 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.included)).toBe(true);
  });

  it("saves only included ingredients with edited grams", () => {
    const rows = loggedMealSaveRowsFromEntries([
      entry("member-frokost"),
      { ...entry("member-frokost"), id: "log-2", name: "Melk", grams: 200 },
      { ...entry("member-frokost"), id: "log-3", name: "Banan", grams: 120 },
    ]);
    rows[1]!.included = false;
    rows[0]!.grams = 90;
    const saved = createSavedMealFromSaveRows(rows, "Min frokost", "member-frokost");
    expect(saved?.items).toEqual([
      expect.objectContaining({ name: "Havregryn", grams: 90 }),
      expect.objectContaining({ name: "Banan", grams: 120 }),
    ]);
  });

  it("returns null when every ingredient is excluded", () => {
    const rows = loggedMealSaveRowsFromEntries([entry("member-frokost")]);
    rows[0]!.included = false;
    expect(createSavedMealFromSaveRows(rows, "Min frokost", "member-frokost")).toBeNull();
  });

  it("creates quick log entries for apply", () => {
    const saved = createSavedMealFromQuickLogs([entry("member-frokost")], "Min frokost", "member-frokost");
    const logs = quickLogEntriesFromSavedMeal(saved, "member-frokost");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.name).toBe("Havregryn");
    expect(logs[0]?.mealId).toBe("member-frokost");
  });
});
