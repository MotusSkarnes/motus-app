import { formatMicronutrientReferenceLine, formatMicronutrientWithUnit } from "./foodBankMicronutrients";
import {
  buildExtraFatDisplayRows,
  buildOmegaOverviewRows,
  formatOmegaOverviewValue,
} from "./nutritionReportFattyAcids";
import {
  buildMacroDisplayRows,
  buildWaterReportRows,
  classifyMacroDisplayStatus,
  formatMacroDisplayValue,
  resolveReportKcalTarget,
} from "./nutritionReportDisplay";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import { nutritionReferenceFootnote, nutritionReferenceWarningMessage } from "./personalizedNutritionReferences";
import type { MicronutrientDailyRow } from "./quickFoodLogNutrition";
import type { FoodLogNutritionTotals } from "./quickFoodLogNutrition";
import {
  contributorsFor,
  formatContributionPrintLine,
  type NutrientContributionId,
  type NutrientContributionLookup,
} from "./nutritionReportContributors";
import {
  coverageFor,
  formatCoveragePercent,
  NUTRIENT_COVERAGE_FOOTNOTE,
  type NutrientCoverageLookup,
} from "./nutritionReportCoverage";

export type NutritionReportPrintPayload = {
  memberName: string;
  periodSummary: string;
  generatedAt?: string;
  totals: FoodLogNutritionTotals;
  mealPlanTargets?: MealPlanTargets | null;
  microRows: MicronutrientDailyRow[];
  referenceContext?: NutritionReferenceContext;
  dailyKcal?: Array<{ dateLabel: string; kcal: number }>;
  contributionLookup?: NutrientContributionLookup;
  coverageLookup?: NutrientCoverageLookup;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coverageCell(id: NutrientContributionId | undefined, lookup: NutrientCoverageLookup | undefined): string {
  const text = formatCoveragePercent(coverageFor(lookup, id));
  return text ? escapeHtml(text) : "–";
}

function contributionHtml(
  label: string,
  id: NutrientContributionId | undefined,
  lookup: NutrientContributionLookup | undefined,
): string {
  const rows = contributorsFor(lookup, id);
  const extra = rows.length ? `<div class="contrib">${escapeHtml(formatContributionPrintLine(rows))}</div>` : "";
  return `${escapeHtml(label)}${extra}`;
}

function macroTableHtml(
  rows: ReturnType<typeof buildMacroDisplayRows>,
  lookup?: NutrientContributionLookup,
  coverageLookup?: NutrientCoverageLookup,
): string {
  const body = rows
    .map((row) => {
      const status = classifyMacroDisplayStatus(row);
      return `<tr class="micro-status-${status.tone}">
        <td>${contributionHtml(row.label, row.id, lookup)}</td>
        <td><strong>${escapeHtml(formatMacroDisplayValue(row))}</strong></td>
        <td>${escapeHtml(status.referenceLine)}</td>
        <td>${escapeHtml(status.label)}</td>
        <td>${coverageCell(row.id, coverageLookup)}</td>
      </tr>`;
    })
    .join("");
  return `<table class="report-table">
    <thead><tr><th>Næringsstoff</th><th>Inntatt</th><th>Referanse</th><th>Status</th><th>Kjent</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function omegaTableHtml(
  totals: FoodLogNutritionTotals,
  lookup?: NutrientContributionLookup,
  coverageLookup?: NutrientCoverageLookup,
): string {
  const rows = buildOmegaOverviewRows(totals.fattyAcids);
  const body = rows
    .map(
      (row) => `<tr>
        <td>${contributionHtml(row.label, row.id, lookup)}</td>
        <td><strong>${escapeHtml(formatOmegaOverviewValue(row))}</strong></td>
        <td>${escapeHtml(row.hint ?? "")}</td>
        <td>${coverageCell(row.id, coverageLookup)}</td>
      </tr>`,
    )
    .join("");
  return `<table class="report-table">
    <thead><tr><th>Omega / fettsyre</th><th>Inntatt</th><th>Merknad</th><th>Kjent</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function microTableHtml(
  rows: MicronutrientDailyRow[],
  lookup?: NutrientContributionLookup,
  coverageLookup?: NutrientCoverageLookup,
): string {
  if (!rows.length) {
    return "<p class=\"muted\">Ingen mikronæringsdata i perioden.</p>";
  }
  const body = rows
    .map(
      (row) => `<tr class="micro-status-${row.statusTone}">
        <td>${contributionHtml(row.label, row.key, lookup)}</td>
        <td>${escapeHtml(formatMicronutrientWithUnit(row.value, row.decimals, row.unit))}</td>
        <td>${escapeHtml(formatMicronutrientReferenceLine(row))}</td>
        <td>${escapeHtml(row.statusLabel)}</td>
        <td>${coverageCell(row.key, coverageLookup)}</td>
      </tr>`,
    )
    .join("");
  return `<table class="report-table">
    <thead><tr><th>Stoff</th><th>Inntatt</th><th>AR / RI / UL</th><th>Status</th><th>Kjent</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function dailyKcalHtml(daily: NutritionReportPrintPayload["dailyKcal"]): string {
  if (!daily?.length) return "";
  const rows = daily
    .map((row) => `<tr><td>${escapeHtml(row.dateLabel)}</td><td><strong>${Math.round(row.kcal)} kcal</strong></td></tr>`)
    .join("");
  return `<h2>Kcal per dag</h2>
    <table class="report-table report-table--compact">
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildNutritionReportPrintHtml(payload: NutritionReportPrintPayload): string {
  const kcalTarget = resolveReportKcalTarget(payload.mealPlanTargets, payload.referenceContext);
  const macroRows = [
    ...buildMacroDisplayRows(payload.totals, payload.mealPlanTargets, payload.referenceContext),
    ...buildExtraFatDisplayRows(payload.totals, kcalTarget),
  ];
  const waterRows = buildWaterReportRows(payload.totals, payload.referenceContext);
  const generated = payload.generatedAt ?? new Date().toLocaleString("nb-NO");
  const referenceNote = payload.referenceContext
    ? nutritionReferenceFootnote(payload.referenceContext)
    : "Referanser er generelle daglige voksenverdier.";
  const profileWarning = payload.referenceContext
    ? nutritionReferenceWarningMessage(payload.referenceContext.missingFields)
    : null;

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>Næringsrapport – ${escapeHtml(payload.memberName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.45;
    }
    h1 { margin: 0 0 4px; font-size: 22px; }
    h2 { margin: 24px 0 10px; font-size: 15px; border-bottom: 2px solid #0d9488; padding-bottom: 4px; }
    .meta { color: #64748b; margin: 0 0 16px; font-size: 12px; }
    .summary {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 8px;
      font-weight: 600;
      color: #0f766e;
    }
    .report-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .report-table th, .report-table td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    .report-table th { background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .report-table--compact td { padding: 6px 10px; }
    .muted { color: #64748b; font-size: 12px; }
    .footnote { margin-top: 20px; font-size: 11px; color: #94a3b8; }
    .warning {
      margin-top: 16px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      color: #92400e;
      font-size: 12px;
    }
    .micro-status-danger td { background: #fef2f2; }
    .micro-status-warn td { background: #fffbeb; }
    .micro-status-ok td { background: #f0fdf4; }
    .micro-status-muted td { background: #f8fafc; color: #64748b; }
    .contrib { margin-top: 3px; font-size: 11px; color: #0f766e; font-weight: 600; }
    @media print {
      body { padding: 12px; }
      h2 { page-break-after: avoid; }
      .report-table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Næringsrapport</h1>
  <p class="meta">${escapeHtml(payload.memberName)} · Generert ${escapeHtml(generated)}</p>
  <p class="summary">${escapeHtml(payload.periodSummary)}</p>

  <h2>Makronæringsstoffer</h2>
  ${macroTableHtml(macroRows, payload.contributionLookup, payload.coverageLookup)}

  <h2>Vanninntak</h2>
  <p class="muted">Drikke = manuelt logget. Fra mat = vanninnhold i matvarer. Totalt: Helsedirektoratet / NNR 2023 (2,0 L kvinner / 2,5 L menn).</p>
  ${macroTableHtml(waterRows, payload.contributionLookup, payload.coverageLookup)}

  <h2>Mikronæringsstoffer</h2>
  <p class="muted">${escapeHtml(referenceNote)}</p>
  ${microTableHtml(payload.microRows, payload.contributionLookup, payload.coverageLookup)}

  <h2>Omega-fettsyrer</h2>
  ${omegaTableHtml(payload.totals, payload.contributionLookup, payload.coverageLookup)}

  ${dailyKcalHtml(payload.dailyKcal)}

  ${profileWarning ? `<p class="warning">${escapeHtml(profileWarning)}</p>` : ""}

  <p class="footnote">Motus · ${escapeHtml(NUTRIENT_COVERAGE_FOOTNOTE)}</p>
</body>
</html>`;
}

export function openNutritionReportPrintWindow(payload: NutritionReportPrintPayload): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const html = buildNutritionReportPrintHtml(payload);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
  };

  if (printWindow.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 250);
  } else {
    printWindow.addEventListener("load", () => window.setTimeout(triggerPrint, 250));
  }

  return true;
}
