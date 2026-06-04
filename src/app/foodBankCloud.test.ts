import { describe, expect, it } from "vitest";
import { foodBankShouldUploadLocal, mergeTrainerFoodBankSnapshotFromRemote, parseFoodItems } from "./foodBankCloud";
import type { FoodItem } from "./foodBankTypes";

function nutrition(kcal: number) {
  return {
    kcal,
    protein: 10,
    carbs: 5,
    fat: 2,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    sodium: 0,
  };
}

function item(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "food-1",
    name: "Test",
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Test",
    source: "egen",
    createdBy: "PT",
    createdAt: "2026-01-01T00:00:00.000Z",
    nutritionPer100g: nutrition(100),
    ...overrides,
  };
}

describe("foodBankCloud", () => {
  it("parses valid food items from json", () => {
    const parsed = parseFoodItems([item(), { name: "broken" }]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Test");
  });

  it("detects when local bank should upload to cloud", () => {
    expect(foodBankShouldUploadLocal([item()], [], [])).toBe(false);
    expect(foodBankShouldUploadLocal([item({ isCustom: true })], [], [])).toBe(true);
    expect(foodBankShouldUploadLocal([item()], ["food-1"], [])).toBe(true);
    expect(foodBankShouldUploadLocal([item({ source: "matvaretabell" })], [], [])).toBe(true);
  });

  it("merges remote food bank without dropping unsynced local trainer foods", () => {
    const remote = {
      items: [item({ id: "food-remote", name: "Remote", source: "matvaretabell", nutritionPer100g: nutrition(120) })],
      favoriteIds: ["food-remote"],
      recentIds: [],
      updatedAt: 10,
    };
    const shared = [item({ id: "food-shared", name: "Shared", source: "matvaretabell", nutritionPer100g: nutrition(130) })];
    const local = [
      item({ id: "food-custom", name: "Local custom", source: "egen", isCustom: true, nutritionPer100g: nutrition(400) }),
      item({ id: "food-seed-1", name: "Local seed", source: "matvaretabell", nutritionPer100g: nutrition(90) }),
      item({ id: "food-remote", name: "Stale remote", source: "matvaretabell", nutritionPer100g: nutrition(110) }),
    ];

    const merged = mergeTrainerFoodBankSnapshotFromRemote(remote, shared, local, ["food-custom", "food-seed-1"], [
      "food-custom",
    ]);

    expect(merged.items.map((food) => food.id).sort()).toEqual(["food-custom", "food-remote", "food-shared"]);
    expect(merged.items.find((food) => food.id === "food-remote")?.name).toBe("Remote");
    expect(merged.favoriteIds).toEqual(["food-remote", "food-custom"]);
    expect(merged.recentIds).toEqual(["food-custom"]);
  });
});
