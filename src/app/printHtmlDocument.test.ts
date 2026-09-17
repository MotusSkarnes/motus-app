import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cyclePrintLockedControls,
  printHtmlDocument,
  printHtmlViaHiddenFrame,
  restoreAppInteractivityAfterPrint,
  schedulePrintWhenReady,
  shouldPreferInlineProgramPrint,
  stripProgramPrintScript,
  watchPrintWindowSettled,
} from "./printHtmlDocument";

const SAMPLE_HTML = `<!doctype html><html><body><p>Test</p><script>window.print()</script></body></html>`;

describe("printHtmlDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it("clears stuck pointer-events after print and re-enables text fields", () => {
    document.body.style.pointerEvents = "none";
    document.body.setAttribute("inert", "");
    const field = document.createElement("textarea");
    field.value = "kommentar";
    document.body.appendChild(field);
    restoreAppInteractivityAfterPrint();
    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.hasAttribute("inert")).toBe(false);
    expect(field.disabled).toBe(false);
    expect(field.readOnly).toBe(false);
    field.remove();
  });

  it("cycles locked controls without leaving them disabled", () => {
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    cyclePrintLockedControls();
    expect(field.disabled).toBe(false);
    expect(field.readOnly).toBe(false);
    field.remove();
  });

  it("prints only once when images load before the safety timeout", () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const printWindow = {
      document: {
        readyState: "complete",
        images: [{ complete: true, addEventListener: vi.fn() }],
      },
      addEventListener: vi.fn(),
      focus: vi.fn(),
      print,
    };
    schedulePrintWhenReady(printWindow as unknown as Window);
    vi.advanceTimersByTime(3000);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("settles when the print window is closed", () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    const printWindow = {
      closed: false,
      close: vi.fn(function (this: { closed: boolean }) {
        this.closed = true;
      }),
      document: { readyState: "complete", images: [] },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn(),
      print: vi.fn(),
    };
    watchPrintWindowSettled(printWindow as unknown as Window, onSettled);
    printWindow.closed = true;
    vi.advanceTimersByTime(300);
    expect(onSettled).toHaveBeenCalledTimes(1);
    window.requestAnimationFrame = raf;
    vi.useRealTimers();
  });
});
