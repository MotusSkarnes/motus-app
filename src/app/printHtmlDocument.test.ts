import { afterEach, describe, expect, it, vi } from "vitest";
import { printHtmlDocument, printHtmlViaHiddenFrame, shouldPreferInlineProgramPrint } from "./printHtmlDocument";

describe("printHtmlDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelectorAll("iframe[title='Utskrift']").forEach((node) => node.remove());
  });

  it("prefers inline print on Android user agents", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile" });
    expect(shouldPreferInlineProgramPrint()).toBe(true);
  });

  it("does not prefer inline print on desktop Chrome", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    });
    expect(shouldPreferInlineProgramPrint()).toBe(false);
  });

  it("prints via hidden iframe without opening a new tab", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile" });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const result = printHtmlDocument("<!doctype html><html><body>Test</body></html>");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("iframe");
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector("iframe[title='Utskrift']")).not.toBeNull();
  });

  it("iframe write returns true when document is available", () => {
    const ok = printHtmlViaHiddenFrame("<!doctype html><html><body>Hei</body></html>");
    expect(ok).toBe(true);
  });
});
