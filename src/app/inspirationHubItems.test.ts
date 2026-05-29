import { describe, expect, it } from "vitest";
import {
  filterRecipesFromInspirationHub,
  isInspirationRecipeItem,
  mergeHubItemsPreservingRecipes,
  partitionInspirationFeedItems,
} from "./inspirationHubItems";

describe("inspirationHubItems", () => {
  it("detects recipe categories", () => {
    expect(isInspirationRecipeItem({ category: "recipes" })).toBe(true);
    expect(isInspirationRecipeItem({ category: "oppskrift" })).toBe(true);
    expect(isInspirationRecipeItem({ category: "tips" })).toBe(false);
    expect(isInspirationRecipeItem({ category: "nutrition" })).toBe(false);
  });

  it("filters recipes from hub display list", () => {
    const items = [
      { id: "a", category: "tips" },
      { id: "b", category: "recipes" },
    ];
    expect(filterRecipesFromInspirationHub(items)).toEqual([{ id: "a", category: "tips" }]);
  });

  it("partitions feed into hub and recipes", () => {
    const items = [
      { id: "1", category: "news" },
      { id: "2", category: "recipes" },
      { id: "3", category: "programs" },
    ];
    expect(partitionInspirationFeedItems(items)).toEqual({
      hub: [
        { id: "1", category: "news" },
        { id: "3", category: "programs" },
      ],
      recipes: [{ id: "2", category: "recipes" }],
    });
  });

  it("merges hub edits without dropping stored recipes", () => {
    const hub = [{ id: "tips-1", category: "tips", title: "Updated" }];
    const existing = [
      { id: "tips-1", category: "tips", title: "Old" },
      { id: "recipe-1", category: "recipes", title: "Salat" },
    ];
    expect(mergeHubItemsPreservingRecipes(hub, existing)).toEqual([
      { id: "tips-1", category: "tips", title: "Updated" },
      { id: "recipe-1", category: "recipes", title: "Salat" },
    ]);
  });
});
