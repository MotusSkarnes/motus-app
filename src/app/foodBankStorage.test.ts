import { beforeEach, describe, expect, it } from "vitest";
import {
  FOOD_BANK_FAVORITES_KEY,
  FOOD_BANK_RECENT_KEY,
  FOOD_BANK_STORAGE_KEY,
  dedupeFoodBankItems,
  loadFoodBankItems,
  persistFavoriteFoodIds,
  persistFoodBankItems,
  persistRecentFoodIds,
} from "./foodBankStorage";
import type { FoodItem } from "./foodBankTypes";

function makeItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: "food-1",
    name: "Kyllingfilet",
    portionLabel: "100 g",
    portionGrams: 100,
    category: "proteinkilder",
    origin: "Kjott",
    source: "matvaretabell",
    createdBy: "PT",
    createdAt: "2026-01-01T00:00:00.000Z",
    nutritionPer100g: {
      kcal: 120,
      protein: 24,
      carbs: 0,
      fat: 2,
      fiber: 0,
      sugar: 0,
      saturatedFat: 0,
      sodium: 0,
    },
    ...overrides,
  };
}

describe("foodBankStorage dedupe", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("dedupes same food name and keeps better quality variant", () => {
    const base = makeItem({ id: "a", name: "Havregryn", source: "matvaretabell" });
    const custom = makeItem({
      id: "b",
      name: " havregryn ",
      source: "egen",
      isCustom: true,
      createdAt: "2026-02-01T00:00:00.000Z",
    });
    const deduped = dedupeFoodBankItems([base, custom]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("b");
  });

  it("persists deduped storage and auto-cleans invalid favorite/recent ids", () => {
    const first = makeItem({ id: "f-1", name: "Banan" });
    const duplicate = makeItem({ id: "f-2", name: " banan " });
    persistFoodBankItems([first, duplicate]);
    const loaded = loadFoodBankItems();
    expect(loaded).toHaveLength(1);

    persistFavoriteFoodIds(["f-1", "f-2", "missing"]);
    persistRecentFoodIds(["f-1", "f-2", "missing"]);

    const favorites = JSON.parse(window.localStorage.getItem(FOOD_BANK_FAVORITES_KEY) ?? "[]") as string[];
    const recents = JSON.parse(window.localStorage.getItem(FOOD_BANK_RECENT_KEY) ?? "[]") as string[];
    const ids = new Set(loaded.map((item) => item.id));
    expect(favorites.every((id) => ids.has(id))).toBe(true);
    expect(recents.every((id) => ids.has(id))).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(FOOD_BANK_STORAGE_KEY) ?? "[]")).toHaveLength(1);
  });
});
