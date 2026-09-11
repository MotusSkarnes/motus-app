import { formatMicronutrientReferenceLine, formatMicronutrientWithUnit } from "./foodBankMicronutrients";
import { formatMacro } from "./foodBankTypes";
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
  type NutritionReportStatusTone,
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
import { schedulePrintWhenReady } from "./printHtmlDocument";

export type NutritionReportPrintAudience = "trainer" | "client";

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
  audience?: NutritionReportPrintAudience;
  logoUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveLogoUrl(logoUrl?: string): string {
  const trimmed = logoUrl?.trim() ?? "";
  if (!trimmed) return "";
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (typeof window === "undefined") return trimmed;
  try {
    return new URL(trimmed, window.location.href).href;
  } catch {
    return trimmed;
  }
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

function intakeHtml(value: string, tone: NutritionReportStatusTone): string {
  return `<span class="intake intake--${tone}">${escapeHtml(value)}</span>`;
}

function clientStatusLabel(tone: NutritionReportStatusTone): string {
  if (tone === "ok") return "Innenfor";
  if (tone === "warn") return "Litt utenfor";
  if (tone === "danger") return "Utenfor";
  return "Ingen referanse";
}

function barPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clientBarHtml(pct: number, tone: NutritionReportStatusTone): string {
  return `<div class="bar" aria-hidden="true"><i class="bar-fill--${tone}" style="width:${barPct(pct)}%"></i></div>`;
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
        <td class="intake-cell">${intakeHtml(formatMacroDisplayValue(row), status.tone)}</td>
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
        <td class="intake-cell">${intakeHtml(formatOmegaOverviewValue(row), "muted")}</td>
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
        <td class="intake-cell">${intakeHtml(formatMicronutrientWithUnit(row.value, row.decimals, row.unit), row.statusTone)}</td>
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

function sharedPrintCss(): string {
  return `
    * { box-sizing: border-box; }
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .intake {
      display: inline-block;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .intake--ok { color: #047857; background: #d1fae5; }
    .intake--warn { color: #a16207; background: #fef3c7; }
    .intake--danger { color: #b91c1c; background: #fee2e2; }
    .intake--muted { color: #475569; background: #f1f5f9; }
  `;
}

function buildTrainerPrintHtml(payload: NutritionReportPrintPayload): string {
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
  <title>Næringsrapport (trener) – ${escapeHtml(payload.memberName)}</title>
  <style>
    ${sharedPrintCss()}
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
    .intake-cell { white-space: nowrap; }
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
  <p class="meta">${escapeHtml(payload.memberName)} · Trenerutskrift · Generert ${escapeHtml(generated)}</p>
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

function clientMacroCardsHtml(rows: ReturnType<typeof buildMacroDisplayRows>): string {
  return `<div class="card-grid">${rows
    .map((row) => {
      const status = classifyMacroDisplayStatus(row);
      const target =
        row.target > 0 ? `Anbefalt ${formatMacro(row.target, row.decimals)} ${row.unit}` : "";
      return `<article class="card card--${status.tone}">
        <p class="card-label">${escapeHtml(row.label)}</p>
        <p class="card-value">${intakeHtml(formatMacroDisplayValue(row), status.tone)}</p>
        ${clientBarHtml(status.barPct, status.tone)}
        <p class="card-status card-status--${status.tone}">${escapeHtml(clientStatusLabel(status.tone))}</p>
        ${target ? `<p class="card-ref">${escapeHtml(target)}</p>` : ""}
      </article>`;
    })
    .join("")}</div>`;
}

function clientMicroCardsHtml(rows: MicronutrientDailyRow[]): string {
  if (!rows.length) {
    return `<p class="muted">Ingen mikronæringsdata i perioden.</p>`;
  }
  return `<div class="micro-list">${rows
    .map((row) => {
      const target =
        row.target > 0 ? `Anbefalt ${formatMicronutrientWithUnit(row.target, row.decimals, row.unit)}` : "";
      return `<article class="micro-row micro-row--${row.statusTone}">
        <div class="micro-main">
          <span class="micro-name">${escapeHtml(row.label)}</span>
          ${intakeHtml(formatMicronutrientWithUnit(row.value, row.decimals, row.unit), row.statusTone)}
        </div>
        ${clientBarHtml(row.coveragePct, row.statusTone)}
        <div class="micro-foot">
          <span class="card-status card-status--${row.statusTone}">${escapeHtml(clientStatusLabel(row.statusTone))}</span>
          ${target ? `<span class="card-ref">${escapeHtml(target)}</span>` : ""}
        </div>
      </article>`;
    })
    .join("")}</div>`;
}

function clientOmegaHtml(totals: FoodLogNutritionTotals): string {
  const rows = buildOmegaOverviewRows(totals.fattyAcids);
  return `<div class="micro-list">${rows
    .map((row) => {
      const hint = row.hint ? `<p class="card-ref">${escapeHtml(row.hint)}</p>` : "";
      return `<article class="micro-row">
        <div class="micro-main">
          <span class="micro-name">${escapeHtml(row.label)}</span>
          ${intakeHtml(formatOmegaOverviewValue(row), "muted")}
        </div>
        ${hint}
      </article>`;
    })
    .join("")}</div>`;
}

function buildClientPrintHtml(payload: NutritionReportPrintPayload): string {
  const kcalTarget = resolveReportKcalTarget(payload.mealPlanTargets, payload.referenceContext);
  const macroRows = [
    ...buildMacroDisplayRows(payload.totals, payload.mealPlanTargets, payload.referenceContext),
    ...buildExtraFatDisplayRows(payload.totals, kcalTarget),
  ];
  const waterRows = buildWaterReportRows(payload.totals, payload.referenceContext);
  const generated = payload.generatedAt ?? new Date().toLocaleString("nb-NO");
  const logoUrl = resolveLogoUrl(payload.logoUrl);
  const logoHtml = logoUrl
    ? `<div class="brand-logo-frame"><img src="${escapeHtml(logoUrl)}" alt="Motus" class="brand-logo" /></div>`
    : `<div class="brand-wordmark">Motus</div>`;

  return `<!DOCTYPE html>
<html lang="nb">
<head>
  <meta charset="utf-8" />
  <title>Næringsrapport – ${escapeHtml(payload.memberName)}</title>
  <style>
    ${sharedPrintCss()}
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 16px;
      background: #f8fafc;
      font-size: 13px;
      line-height: 1.4;
    }
    .page { max-width: 860px; margin: 0 auto; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      background: #30E3BE;
      color: #0f172a;
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 16px;
    }
    .header h1 { margin: 0 0 4px; font-size: 22px; line-height: 1.1; }
    .header .name { margin: 0; font-size: 18px; font-weight: 700; }
    .header .meta { margin: 4px 0 0; font-size: 12px; opacity: 0.85; }
    .brand-logo { height: 52px; width: auto; max-width: 180px; object-fit: contain; display: block; }
    .brand-wordmark { font-weight: 800; font-size: 20px; letter-spacing: 0.04em; }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 16px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .swatch { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
    .swatch--ok { background: #10b981; }
    .swatch--warn { background: #f59e0b; }
    .swatch--danger { background: #ef4444; }
    h2 {
      margin: 18px 0 10px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
    }
    .card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .card, .micro-row {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 12px;
      break-inside: avoid;
    }
    .card-label, .micro-name {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
    }
    .card-value { margin: 8px 0 10px; font-size: 20px; }
    .card-status {
      margin: 8px 0 0;
      font-size: 11px;
      font-weight: 700;
    }
    .card-status--ok { color: #047857; }
    .card-status--warn { color: #a16207; }
    .card-status--danger { color: #b91c1c; }
    .card-status--muted { color: #64748b; }
    .card-ref { margin: 2px 0 0; font-size: 11px; color: #94a3b8; }
    .bar {
      height: 7px;
      background: #e2e8f0;
      border-radius: 99px;
      overflow: hidden;
    }
    .bar i { display: block; height: 100%; border-radius: 99px; }
    .bar-fill--ok { background: #10b981; }
    .bar-fill--warn { background: #f59e0b; }
    .bar-fill--danger { background: #ef4444; }
    .bar-fill--muted { background: #cbd5e1; }
    .micro-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .micro-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .micro-foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-top: 6px;
    }
    .footer {
      margin-top: 22px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { background: #fff; padding: 8px; }
      .header, .card, .micro-row { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div>
        <h1>Næringsrapport</h1>
        <p class="name">${escapeHtml(payload.memberName)}</p>
        <p class="meta">${escapeHtml(payload.periodSummary)} · ${escapeHtml(generated)}</p>
      </div>
      ${logoHtml}
    </header>

    <p class="legend">
      <span><i class="swatch swatch--ok"></i> Innenfor anbefaling</span>
      <span><i class="swatch swatch--warn"></i> Litt utenfor</span>
      <span><i class="swatch swatch--danger"></i> Utenfor</span>
    </p>

    <h2>Energi og makro</h2>
    ${clientMacroCardsHtml(macroRows)}

    <h2>Vann</h2>
    ${clientMacroCardsHtml(waterRows)}

    <h2>Vitaminer og mineraler</h2>
    ${clientMicroCardsHtml(payload.microRows)}

    <h2>Omega-fettsyrer</h2>
    ${clientOmegaHtml(payload.totals)}

    <p class="footer">Motus · Personlig oversikt. Fargene viser om inntaket er innenfor anbefalingen.</p>
  </div>
</body>
</html>`;
}

export function buildNutritionReportPrintHtml(payload: NutritionReportPrintPayload): string {
  if (payload.audience === "client") return buildClientPrintHtml(payload);
  return buildTrainerPrintHtml(payload);
}

export function openNutritionReportPrintWindow(payload: NutritionReportPrintPayload): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const html = buildNutritionReportPrintHtml(payload);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  schedulePrintWhenReady(printWindow);
  return true;
}
