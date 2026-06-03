import { describe, expect, it, vi } from "vitest";
import { resolveIntervalTimerFocusLayout } from "./useIntervalTimerFocusLayout";

describe("resolveIntervalTimerFocusLayout", () => {
  it("returns true for wide short viewports (phone landscape)", () => {
    vi.stubGlobal("window", {
      innerWidth: 844,
      innerHeight: 390,
    });
    expect(resolveIntervalTimerFocusLayout()).toBe(true);
  });

  it("returns false for tall portrait phone", () => {
    vi.stubGlobal("window", {
      innerWidth: 390,
      innerHeight: 844,
    });
    expect(resolveIntervalTimerFocusLayout()).toBe(false);
  });

  it("returns false for desktop landscape", () => {
    vi.stubGlobal("window", {
      innerWidth: 1440,
      innerHeight: 900,
    });
    expect(resolveIntervalTimerFocusLayout()).toBe(false);
  });
});
