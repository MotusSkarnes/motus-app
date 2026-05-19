import { afterEach, describe, expect, it, vi } from "vitest";
import {
  printHtmlDocument,
  printHtmlViaHiddenFrame,
  shouldPreferInlineProgramPrint,
  stripProgramPrintScript,
} from "./printHtmlDocument";

const SAMPLE_HTML = `<!doctype html><html><body><p>Test</p><script>window.print()</script></body></html>`;

describe("printHtmlDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("strips embedded print script before writing", () => {
    const stripped = stripProgramPrintScript(SAMPLE_HTML);
    expect(stripped).not.toContain("<script>");
    expect(stripped).toContain("<p>Test</p>");
  });

  it("uses iframe first on desktop when iframe write succeeds", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    });
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    const result = printHtmlDocument(SAMPLE_HTML);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.method).toBe("iframe");
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector("iframe[title='Utskrift']")).not.toBeNull();
  });

  it("iframe write returns true when document is available", () => {
    const ok = printHtmlViaHiddenFrame(SAMPLE_HTML);
    expect(ok).toBe(true);
  });
});
