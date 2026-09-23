import { watchPrintWindowSettled } from "./printHtmlDocument";
import type { UnknownNutrientRow } from "./nutritionReportUnknownValues";

export type UnknownValuesPrintPayload = {
  memberName: string;
  periodSummary: string;
  rows: UnknownNutrientRow[];
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildUnknownValuesPrintHtml(payload: UnknownValuesPrintPayload): string {
  const body = payload.rows.length
    ? payload.rows.map((row) => `<tr>
        <td><strong>${escapeHtml(row.label)}</strong></td>
        <td>${row.percent}% <span class="muted">(${row.known} av ${row.total})</span></td>
        <td>${row.missingNames.map((name) => escapeHtml(name)).join(", ")}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">Alle viste næringsstoffer har 100 % kjente verdier.</td></tr>`;
  return `<!DOCTYPE html>
<html lang="nb"><head><meta charset="utf-8" />
  <title>Ukjente næringsverdier – ${escapeHtml(payload.memberName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 13px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .meta { margin: 0 0 16px; color: #64748b; }
    .intro { padding: 10px 12px; border: 1px solid #99f6e4; border-radius: 8px; background: #f0fdfa; color: #115e59; }
    table { width: 100%; margin-top: 14px; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .muted { color: #64748b; }
    @media print { body { padding: 12px; } tr { break-inside: avoid; } }
  </style></head><body>
  <h1>Ukjente næringsverdier</h1>
  <p class="meta">${escapeHtml(payload.memberName)} · ${escapeHtml(payload.periodSummary)}</p>
  <p class="intro">Matvarene nedenfor mangler verdi for ett eller flere næringsstoffer. Søk dem opp i matvarebanken for å kontrollere eller komplettere næringsdataene. 0 regnes som en kjent verdi.</p>
  <table><thead><tr><th>Næringsstoff</th><th>Kjent</th><th>Matvarer med ukjent verdi</th></tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

export function openUnknownValuesPrintWindow(payload: UnknownValuesPrintPayload, onSettled?: () => void): boolean {
  const printTab = window.open("", "_blank");
  if (!printTab) return false;
  printTab.document.open();
  printTab.document.write(buildUnknownValuesPrintHtml(payload));
  printTab.document.close();
  watchPrintWindowSettled(printTab, onSettled);
  return true;
}
