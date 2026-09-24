import { afterEach, describe, expect, it, vi } from "vitest";
import { isStorageQuotaError, runStorageWriteSafely } from "./browserStorage";

describe("browserStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("recognizes the iOS quota error", () => {
    expect(isStorageQuotaError(new DOMException("The quota has been exceeded.", "QuotaExceededError"))).toBe(true);
  });

  it("evicts an expendable cache and retries the write", () => {
    window.localStorage.setItem("large-cache", "cached");
    let attempts = 0;
    const write = vi.fn(() => {
      attempts += 1;
      if (attempts === 1) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      window.localStorage.setItem("important-state", "saved");
    });

    expect(runStorageWriteSafely(write, { evictOnQuota: ["large-cache"] })).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("large-cache")).toBeNull();
    expect(window.localStorage.getItem("important-state")).toBe("saved");
  });

  it("swallows a failed browser cache write", () => {
    expect(runStorageWriteSafely(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    })).toBe(false);
  });
});
