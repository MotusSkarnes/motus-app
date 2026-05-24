import { describe, expect, it } from "vitest";
import { filterFoodBankItems } from "./foodBankFilter";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { EMPTY_MACRO_FILTER } from "./foodBankTypes";

describe("foodBankFilter", () => {
  const items = buildDefaultFoodBankItems();

  it("returns seeded foods and filters by search", () => {
    expect(items.length).toBeGreaterThan(60);
    const filtered = filterFoodBankItems(items, {
      chip: "all",
      search: "kylling",
      favoriteIds: new Set(),
      recentIds: [],
      sources: [],
      favoritesOnly: false,
      mineOnly: false,
      macro: EMPTY_MACRO_FILTER,
      trainerName: "PT",
    });
    expect(filtered.some((item) => item.name.toLowerCase().includes("kylling"))).toBe(true);
  });

  it("filters by category chip", () => {
    const filtered = filterFoodBankItems(items, {
      chip: "gronnsaker",
      search: "",
      favoriteIds: new Set(),
      recentIds: [],
      sources: [],
      favoritesOnly: false,
      mineOnly: false,
      macro: EMPTY_MACRO_FILTER,
      trainerName: "PT",
    });
    expect(filtered.every((item) => item.category === "gronnsaker")).toBe(true);
  });
});
