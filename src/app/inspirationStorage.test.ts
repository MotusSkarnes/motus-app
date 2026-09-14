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

  it("restores missing period plan weeks and bundled programs on stored stubs", () => {
    const stored = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      title: "SUB45 · 10 km på under 45 min",
      bundledProgramTemplates: [{ title: "SUB45 · Rolig løp sone 2" }],
    };
    const builtin = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      title: "SUB45 · 10 km på under 45 min",
      periodPlanTemplate: {
        id: "inspo-period-sub45-10k",
        weeklyPlans: Array.from({ length: 12 }, (_, index) => ({ weekNumber: index + 1 })),
      },
      bundledProgramTemplates: Array.from({ length: 7 }, (_, index) => ({ title: `Program ${index + 1}` })),
    };
    const merged = mergeDefaultInspirationItems([stored], [builtin]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.periodPlanTemplate?.weeklyPlans).toHaveLength(12);
    expect(merged[0]?.bundledProgramTemplates).toHaveLength(7);
  });

  it("replaces an empty 12-week stub with the filled built-in week plan", () => {
    const emptyDays = {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    };
    const stored = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      periodPlanTemplate: {
        weeklyPlans: Array.from({ length: 12 }, (_, index) => ({ weekNumber: index + 1, days: emptyDays })),
      },
      bundledProgramTemplates: Array.from({ length: 7 }, (_, index) => ({ title: `Program ${index + 1}` })),
    };
    const builtin = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      periodPlanTemplate: {
        weeklyPlans: [
          {
            weekNumber: 1,
            days: { ...emptyDays, monday: "SUB45 · Styrke løper", wednesday: "SUB45 · Intervall kort" },
          },
        ],
      },
      bundledProgramTemplates: stored.bundledProgramTemplates,
    };
    const merged = mergeDefaultInspirationItems([stored], [builtin]);
    expect(merged[0]?.periodPlanTemplate?.weeklyPlans?.[0]?.days?.monday).toBe("SUB45 · Styrke løper");
  });

  it("refreshes stored SUB45 body and bundled programs from the built-in copy", () => {
    const stored = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      body: "Gammel rotete tekst med min/km og piler → overalt.",
      bundledProgramTemplates: [{ title: "SUB45 · Rolig løp sone 2", notes: "Ca. 5:15 min/km", exercises: [{ exerciseName: "Nedjogg", notes: "Rolig løp" }] }],
    };
    const builtin = {
      id: "default-period-sub45-10k",
      kind: "periodPlan",
      body: "Kort og ryddig.",
      bundledProgramTemplates: [{ title: "SUB45 · Rolig løp sone 2", notes: "Lett nok til å snakke i setninger.", exercises: [{ exerciseName: "Rolig løp", notes: "" }] }],
    };
    const merged = mergeDefaultInspirationItems([stored], [builtin]);
    expect(merged[0]?.body).toBe("Kort og ryddig.");
    expect(merged[0]?.bundledProgramTemplates?.[0]?.exercises?.[0]?.exerciseName).toBe("Rolig løp");
  });
});
