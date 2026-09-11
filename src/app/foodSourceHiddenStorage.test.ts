import { afterEach, describe, expect, it } from "vitest";
import { normalizeFoodBankNameKey } from "./foodBankNameKey";
import {
  FOOD_SOURCE_HIDDEN_KEY,
  hideFoodSourceFromSuggestions,
  hiddenFoodSourceNameKeys,
  loadHiddenFoodSources,
  restoreHiddenFoodSource,
} from "./foodSourceHiddenStorage";

afterEach(() => {
  localStorage.removeItem(FOOD_SOURCE_HIDDEN_KEY);
});

describe("foodSourceHiddenStorage", () => {
  it("hides a food by name and can restore it", () => {
    hideFoodSourceFromSuggestions({ id: "yeast-1", name: "Gjær, tørr" });
    expect(loadHiddenFoodSources().map((row) => row.name)).toEqual(["Gjær, tørr"]);
    const nameKey = normalizeFoodBankNameKey("Gjær, tørr");
    expect(hiddenFoodSourceNameKeys().has(nameKey)).toBe(true);

    restoreHiddenFoodSource(nameKey);
    expect(loadHiddenFoodSources()).toEqual([]);
  });

  it("does not add the same name twice", () => {
    hideFoodSourceFromSuggestions({ id: "a", name: "Gjær, tørr" });
    hideFoodSourceFromSuggestions({ id: "b", name: "Gjær, tørr" });
    expect(loadHiddenFoodSources()).toHaveLength(1);
  });
});
