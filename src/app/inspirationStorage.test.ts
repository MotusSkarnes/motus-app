import { afterEach, describe, expect, it } from "vitest";
import {
  filterSuppressedInspirationItems,
  INSPIRATION_STORAGE_KEY,
  INSPIRATION_SUPPRESSED_IDS_KEY,
  saveInspirationItemsToStorage,
  suppressInspirationItemId,
} from "./inspirationStorage";

describe("saveInspirationItemsToStorage", () => {
  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_STORAGE_KEY);
    window.localStorage.removeItem(INSPIRATION_SUPPRESSED_IDS_KEY);
  });

  it("persists items", () => {
    const result = saveInspirationItemsToStorage([{ id: "a", title: "Test" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cloudSynced).toBe(false);
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

describe("suppressed inspiration items", () => {
  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_SUPPRESSED_IDS_KEY);
  });

  it("filters suppressed ids from lists", () => {
    suppressInspirationItemId("default-tip-1");
    const filtered = filterSuppressedInspirationItems([
      { id: "default-tip-1", title: "A" },
      { id: "custom-1", title: "B" },
    ]);
    expect(filtered.map((item) => item.id)).toEqual(["custom-1"]);
  });
});
