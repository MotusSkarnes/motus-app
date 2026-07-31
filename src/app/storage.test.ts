import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultState, STORAGE_KEY } from "./data";
import { saveState } from "./storage";
import { PAUSED_WORKOUTS_STORAGE_KEY, upsertPausedWorkout } from "./pausedWorkoutStorage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("quota-safe local storage", () => {
  it("does not crash state updates when the full app cache exceeds quota", () => {
    const originalSetItem = Storage.prototype.setItem;
    let attempts = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      attempts += 1;
      if (key === STORAGE_KEY && attempts === 1) {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });

    expect(() => saveState(getDefaultState())).not.toThrow();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it("does not crash workout pause handling when draft storage exceeds quota", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key) {
      if (key === PAUSED_WORKOUTS_STORAGE_KEY) {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      }
    });

    expect(() =>
      upsertPausedWorkout({
        memberId: "member-1",
        programId: "program-1",
        programTitle: "Program",
        workoutMode: {
          programId: "program-1",
          memberId: "member-1",
          programTitle: "Program",
          note: "",
          results: [],
        },
      }),
    ).not.toThrow();
  });
});
