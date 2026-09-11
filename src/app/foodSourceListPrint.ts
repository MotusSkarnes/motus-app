import type { FoodBankNutrientSource } from "./nutritionReportFoodSources";
import { formatFoodSourceAmount } from "./nutritionReportFoodSources";
import type { NutrientContributionId } from "./nutritionReportContributors";
import { printHtmlDocument, type PrintHtmlResult } from "./printHtmlDocument";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildFoodSourceListPrintHtml(payload: {
  nutrientLabel: string;
  nutrientId: NutrientContributionId;
  sources: FoodBankNutrientSource[];
}): string {
  const count = payload.sources.length;
  const rows = payload.sources
    .map(
      (row, index) => `<tr>
        <td class="n">${index + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="amt">${escapeHtml(formatFoodSourceAmount(row.amountPer100g, payload.nutrientId))}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>Gode matkilder – ${escapeHtml(payload.nutrientLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.45;
    }
    h1 { margin: 0 0 4px; font-size: 20px; }
    .meta { color: #0f766e; margin: 0 0 16px; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #ccfbf1; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #0f766e; border-bottom: 2px solid #0d9488; }
    td.n { width: 2.2rem; color: #64748b; font-variant-numeric: tabular-nums; }
    td.amt { text-align: right; font-weight: 700; color: #0f766e; white-space: nowrap; font-variant-numeric: tabular-nums; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Gode matkilder – ${escapeHtml(payload.nutrientLabel)}</h1>
  <p class="meta">Topp ${count} i matbanken · mengde per 100 g</p>
  <table>
    <thead><tr><th>#</th><th>Matvare</th><th>Mengde</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

export function printFoodSourceList(payload: {
  nutrientLabel: string;
  nutrientId: NutrientContributionId;
  sources: FoodBankNutrientSource[];
}): PrintHtmlResult {
  return printHtmlDocument(buildFoodSourceListPrintHtml(payload));
}
