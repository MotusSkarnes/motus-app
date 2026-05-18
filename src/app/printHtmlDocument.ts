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

function cleanupPrintFrame(iframe: HTMLIFrameElement, delayMs = 4000): void {
  window.setTimeout(() => {
    try {
      iframe.remove();
    } catch {
      // ignore
    }
  }, delayMs);
}

/** Skriver HTML i skjult iframe; innbygd print-script i dokumentet kjører utskrift. */
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
  try {
    frameWindow.addEventListener("afterprint", scheduleCleanup, { once: true });
  } catch {
    scheduleCleanup();
  }

  try {
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    return true;
  } catch {
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

  try {
    printTab.document.open();
    printTab.document.write(html);
    printTab.document.close();
    return { ok: true, method: "popup" };
  } catch (writeError) {
    console.warn("printHtmlDocument: popup write failed, trying blob.", writeError);
  }

  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    printTab.location.href = blobUrl;
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
 * På desktop: ny fane med popup, deretter iframe-reserve.
 */
export function printHtmlDocument(html: string): PrintHtmlResult {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, reason: "failed", message: "Utskrift er ikke tilgjengelig her." };
  }

  if (shouldPreferInlineProgramPrint()) {
    if (printHtmlViaHiddenFrame(html)) {
      return { ok: true, method: "iframe" };
    }
    return {
      ok: false,
      reason: "failed",
      message: "Kunne ikke starte utskrift. Prøv igjen, eller bruk del-menyen i nettleseren.",
    };
  }

  const popupResult = printHtmlViaPopup(html);
  if (popupResult.ok) return popupResult;

  if (printHtmlViaHiddenFrame(html)) {
    return { ok: true, method: "iframe" };
  }

  return popupResult;
}
