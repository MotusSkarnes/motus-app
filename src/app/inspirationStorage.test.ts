import { afterEach, describe, expect, it } from "vitest";
import {
  cacheInspirationFeedSnapshot,
  filterSuppressedInspirationItems,
  INSPIRATION_LOCAL_WRITE_AT_KEY,
  INSPIRATION_STORAGE_KEY,
  INSPIRATION_SUPPRESSED_IDS_KEY,
  loadSuppressedInspirationIds,
  mergeDefaultInspirationItems,
  saveInspirationItemsToStorage,
  suppressInspirationItemId,
} from "./inspirationStorage";

describe("saveInspirationItemsToStorage", () => {
  afterEach(() => {
    window.localStorage.removeItem(INSPIRATION_STORAGE_KEY);
    window.localStorage.removeItem(INSPIRATION_LOCAL_WRITE_AT_KEY);
    window.localStorage.removeItem(INSPIRATION_SUPPRESSED_IDS_KEY);
  });

  it("persists items", () => {
    const result = saveInspirationItemsToStorage([{ id: "a", title: "Test" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cloudSynced).toBe(false);
    expect(window.localStorage.getItem(INSPIRATION_STORAGE_KEY)).toContain('"Test"');
    expect(Number(window.localStorage.getItem(INSPIRATION_LOCAL_WRITE_AT_KEY) ?? 0)).toBeGreaterThan(0);
  });

  it("does not bump local write marker for remote cache writes", () => {
    window.localStorage.setItem(INSPIRATION_LOCAL_WRITE_AT_KEY, "123");
    cacheInspirationFeedSnapshot({
      items: [{ id: "remote-1", title: "Hei" }],
      suppressedItemIds: [],
      updatedAt: Date.now(),
    });
    expect(window.localStorage.getItem(INSPIRATION_LOCAL_WRITE_AT_KEY)).toBe("123");
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

  it("caches suppressed ids from database snapshot in localStorage", () => {
    cacheInspirationFeedSnapshot({
      items: [{ id: "custom-1", title: "Hei" }],
      suppressedItemIds: ["default-tip-2"],
      updatedAt: Date.now(),
    });
    expect(loadSuppressedInspirationIds().has("default-tip-2")).toBe(true);
    expect(filterSuppressedInspirationItems([{ id: "default-tip-2", title: "X" }])).toEqual([]);
  });

  it("keeps local suppressed ids when caching an older remote snapshot", () => {
    suppressInspirationItemId("custom-deleted");
    cacheInspirationFeedSnapshot({
      items: [{ id: "custom-deleted", title: "Stale" }, { id: "custom-2", title: "Ok" }],
      suppressedItemIds: [],
      updatedAt: Date.now(),
    });
    expect(loadSuppressedInspirationIds().has("custom-deleted")).toBe(true);
    expect(filterSuppressedInspirationItems([{ id: "custom-deleted", title: "Stale" }])).toEqual([]);
  });

  it("does not re-add suppressed default inspiration items", () => {
    suppressInspirationItemId("default-tip-1");
    const merged = mergeDefaultInspirationItems([], [{ id: "default-tip-1", title: "Tips" }, { id: "default-tip-2", title: "Tips 2" }]);
    expect(merged.map((item) => item.id)).toEqual(["default-tip-2"]);
  });
});
