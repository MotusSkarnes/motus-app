import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScreenWakeLock } from "./useScreenWakeLock";

describe("useScreenWakeLock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests and releases screen wake lock when active toggles", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release, addEventListener: vi.fn() });

    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });

    const { rerender, unmount } = renderHook(({ active }) => useScreenWakeLock(active), {
      initialProps: { active: true },
    });

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith("screen");
    });

    rerender({ active: false });
    unmount();

    await vi.waitFor(() => {
      expect(release).toHaveBeenCalled();
    });
  });

  it("does nothing when wake lock API is unavailable", () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: undefined,
    });

    expect(() => {
      const { unmount } = renderHook(() => useScreenWakeLock(true));
      unmount();
    }).not.toThrow();
  });
});
