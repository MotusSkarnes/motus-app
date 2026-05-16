import { afterEach, describe, expect, it } from "vitest";
import { INSPIRATION_STORAGE_KEY, saveInspirationItemsToStorage } from "./inspirationStorage";

describe("saveInspirationItemsToStorage", () => {
  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_STORAGE_KEY);
  });

  it("persists items", () => {
    const result = saveInspirationItemsToStorage([{ id: "a", title: "Test" }]);
    expect(result.ok).toBe(true);
    expect(window.localStorage.getItem(INSPIRATION_STORAGE_KEY)).toContain('"Test"');
  });

  it("returns error when payload is too large", () => {
    const huge = "x".repeat(4_500_000);
    const result = saveInspirationItemsToStorage([{ id: "big", body: huge }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/for stort/i);
    }
  });
});
