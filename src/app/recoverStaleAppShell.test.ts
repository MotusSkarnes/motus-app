import { beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleAppShellError, recoverStaleAppShellOnce } from "./recoverStaleAppShell";

describe("recoverStaleAppShell", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("detects common Vite/chunk load failure messages", () => {
    expect(isStaleAppShellError(new Error("Loading chunk 12 failed."))).toBe(true);
    expect(isStaleAppShellError(new Error("Failed to fetch dynamically imported module: /assets/x.js"))).toBe(true);
    expect(isStaleAppShellError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
    expect(isStaleAppShellError(new Error("Network offline"))).toBe(false);
  });

  it("reloads at most once and never clears localStorage", async () => {
    localStorage.setItem("motus_pt_app_v2", JSON.stringify({ keep: true }));
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });

    const first = await recoverStaleAppShellOnce(new Error("Loading chunk 3 failed."));
    expect(first).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("motus_pt_app_v2")).toBe(JSON.stringify({ keep: true }));

    const second = await recoverStaleAppShellOnce(new Error("Loading chunk 3 failed."));
    expect(second).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
