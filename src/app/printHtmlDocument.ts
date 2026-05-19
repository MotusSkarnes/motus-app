export type PrintHtmlResult =
  | { ok: true; method: "iframe" | "popup" | "blob" }
  | { ok: false; reason: "popup_blocked" | "failed"; message: string };

/** Android/iOS-nettlesere lukker ofte PWA-fanen ved popup + print. */
export function shouldPreferInlineProgramPrint(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return false;
}

/** Fjern innebygd auto-print-script; utskrift trigges fra foreldrevinduet (mer pålitelig i iframe/PWA). */
export function stripProgramPrintScript(html: string): string {
  return html.replace(/<script>[\s\S]*?<\/script>\s*(?=<\/body>)/i, "");
}

function cleanupPrintFrame(iframe: HTMLIFrameElement, delayMs = 4000): void {
  window.setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  }, delayMs);
}

export function schedulePrintWhenReady(targetWindow: Window, onAfterPrint?: () => void): void {
  const runPrint = () => {
    if (onAfterPrint) {
      try {
        targetWindow.addEventListener("afterprint", onAfterPrint, { once: true });
      } catch {
        window.setTimeout(onAfterPrint, 4000);
      }
    }
    try {
      targetWindow.focus();
      targetWindow.print();
    } catch (error) {
      console.warn("schedulePrintWhenReady: print() failed.", error);
    }
  };

  const waitForImages = () => {
    let doc: Document | null = null;
    try {
      doc = targetWindow.document;
    } catch {
      window.setTimeout(runPrint, 150);
      return;
    }
    if (!doc) {
      window.setTimeout(runPrint, 150);
      return;
    }

    const images = Array.from(doc.images ?? []);
    if (images.length === 0) {
      window.setTimeout(runPrint, 150);
      return;
    }

    let loaded = 0;
    const maybePrint = () => {
      loaded += 1;
      if (loaded >= images.length) runPrint();
    };

    images.forEach((img) => {
      if (img.complete) {
        maybePrint();
        return;
      }
      img.addEventListener("load", maybePrint, { once: true });
      img.addEventListener("error", maybePrint, { once: true });
    });

    window.setTimeout(runPrint, 2500);
  };

  try {
    const readyState = targetWindow.document?.readyState;
    if (readyState === "complete" || readyState === "interactive") {
      waitForImages();
      return;
    }
  } catch {
    // cross-origin or not ready
  }

  targetWindow.addEventListener("load", waitForImages, { once: true });
  window.setTimeout(waitForImages, 400);
}

/** Skriver HTML i skjult iframe og starter utskrift fra foreldrevinduet. */
export function printHtmlViaHiddenFrame(html: string): boolean {
  if (typeof document === "undefined") return false;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Utskrift");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    return false;
  }

  const scheduleCleanup = () => cleanupPrintFrame(iframe);
  const preparedHtml = stripProgramPrintScript(html);

  try {
    frameDoc.open();
    frameDoc.write(preparedHtml);
    frameDoc.close();
    schedulePrintWhenReady(frameWindow, scheduleCleanup);
    return true;
  } catch (error) {
    console.warn("printHtmlViaHiddenFrame: write failed.", error);
    iframe.remove();
    return false;
  }
}

function printHtmlViaPopup(html: string): PrintHtmlResult {
  const printTab = window.open("about:blank", "_blank");
  if (!printTab) {
    return {
      ok: false,
      reason: "popup_blocked",
      message: "Nettleseren blokkerte vinduet for utskrift. Tillat popup for denne siden og prøv igjen.",
    };
  }

  const preparedHtml = stripProgramPrintScript(html);

  try {
    printTab.document.open();
    printTab.document.write(preparedHtml);
    printTab.document.close();
    schedulePrintWhenReady(printTab);
    return { ok: true, method: "popup" };
  } catch (writeError) {
    console.warn("printHtmlDocument: popup write failed, trying blob.", writeError);
  }

  try {
    const blob = new Blob([preparedHtml], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    printTab.location.href = blobUrl;
    printTab.addEventListener("load", () => schedulePrintWhenReady(printTab), { once: true });
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return { ok: true, method: "blob" };
  } catch (error) {
    console.warn("printHtmlDocument: blob print failed.", error);
    try {
      printTab.close();
    } catch {
      // ignore
    }
    return {
      ok: false,
      reason: "failed",
      message: "Kunne ikke åpne utskrift/PDF. Prøv igjen.",
    };
  }
}

/**
 * Åpner utskrift/PDF uten å navigere bort fra appen på mobil.
 * Prøver skjult iframe først (PWA/mobil), deretter popup på desktop.
 */
export function printHtmlDocument(html: string): PrintHtmlResult {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, reason: "failed", message: "Utskrift er ikke tilgjengelig her." };
  }

  if (printHtmlViaHiddenFrame(html)) {
    return { ok: true, method: "iframe" };
  }

  const popupResult = printHtmlViaPopup(html);
  if (popupResult.ok) return popupResult;

  return {
    ok: false,
    reason: popupResult.reason,
    message: popupResult.message,
  };
}
