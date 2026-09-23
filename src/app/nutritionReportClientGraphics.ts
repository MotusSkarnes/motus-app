import {
  buildMacroDisplayRows,
  classifyMacroDisplayStatus,
  type MacroDisplayRow,
  type NutritionReportStatusTone,
} from "./nutritionReportDisplay";
import type { MealPlanTargets } from "./mealPlanTypes";
import type { NutritionReferenceContext } from "./personalizedNutritionReferences";
import type { FoodLogNutritionTotals, MicronutrientDailyRow } from "./quickFoodLogNutrition";

const TONE_COLOR: Record<Exclude<NutritionReportStatusTone, "muted">, string> = {
  ok: "#059669",
  warn: "#d97706",
  danger: "#dc2626",
};

export type ClientStatusCounts = {
  ok: number;
  warn: number;
  danger: number;
};

export type EnergySplit = {
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  totalKcal: number;
};

export function countClientStatusTones(
  macroRows: MacroDisplayRow[],
  microRows: MicronutrientDailyRow[],
): ClientStatusCounts {
  const tones: NutritionReportStatusTone[] = [
    ...macroRows.map((row) => classifyMacroDisplayStatus(row).tone),
    ...microRows.map((row) => row.statusTone),
  ];
  return {
    ok: tones.filter((tone) => tone === "ok").length,
    warn: tones.filter((tone) => tone === "warn").length,
    danger: tones.filter((tone) => tone === "danger").length,
  };
}

export function energySplitFromTotals(totals: Pick<FoodLogNutritionTotals, "protein" | "carbs" | "fat">): EnergySplit {
  const proteinKcal = Math.max(0, totals.protein) * 4;
  const carbsKcal = Math.max(0, totals.carbs) * 4;
  const fatKcal = Math.max(0, totals.fat) * 9;
  return {
    proteinKcal,
    carbsKcal,
    fatKcal,
    totalKcal: proteinKcal + carbsKcal + fatKcal,
  };
}

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSegmentPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function donutSvg(
  segments: Array<{ value: number; color: string; label: string }>,
  centerLabel: string,
  centerSub: string,
): string {
  const total = segments.reduce((sum, row) => sum + row.value, 0);
  if (!(total > 0)) {
    return `<svg class="viz-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="38" fill="none" stroke="#e2e8f0" stroke-width="14" />
      <text x="60" y="58" text-anchor="middle" class="viz-center">${escapeXml(centerLabel)}</text>
      <text x="60" y="74" text-anchor="middle" class="viz-center-sub">${escapeXml(centerSub)}</text>
    </svg>`;
  }
  let angle = 0;
  const arcs = segments
    .filter((row) => row.value > 0)
    .map((row) => {
      const sweep = (row.value / total) * 360;
      const start = angle;
      const end = angle + Math.max(sweep, 0.8);
      angle += sweep;
      return `<path d="${donutSegmentPath(60, 60, 38, start, Math.min(end, 359.99))}" fill="none" stroke="${row.color}" stroke-width="14" stroke-linecap="butt" />`;
    })
    .join("");
  return `<svg class="viz-svg" viewBox="0 0 120 120" role="img" aria-label="${escapeXml(centerSub)}">
    <circle cx="60" cy="60" r="38" fill="none" stroke="#e2e8f0" stroke-width="14" />
    ${arcs}
    <text x="60" y="58" text-anchor="middle" class="viz-center">${escapeXml(centerLabel)}</text>
    <text x="60" y="74" text-anchor="middle" class="viz-center-sub">${escapeXml(centerSub)}</text>
  </svg>`;
}

function gaugeSvg(label: string, pct: number, tone: NutritionReportStatusTone, valueText: string): string {
  const color = tone === "muted" ? "#94a3b8" : TONE_COLOR[tone];
  const r = 28;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * c;
  return `<figure class="viz-gauge">
    <svg class="viz-svg" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="8" />
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 40 40)" />
      <text x="40" y="44" text-anchor="middle" class="viz-gauge-pct">${Math.round(pct)}%</text>
    </svg>
    <figcaption><strong>${escapeXml(label)}</strong><span>${escapeXml(valueText)}</span></figcaption>
  </figure>`;
}

function sparklineSvg(points: Array<{ label: string; kcal: number }>): string {
  if (points.length < 2) return "";
  const width = 520;
  const height = 96;
  const padLeft = 42;
  const padRight = 12;
  const padTop = 10;
  const padBottom = 22;
  const values = points.map((row) => row.kcal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const axisMin = Math.floor(min / 100) * 100;
  const roundedAxisMax = Math.ceil(max / 100) * 100;
  const axisMax = roundedAxisMax > axisMin ? roundedAxisMax : axisMin + 100;
  const span = axisMax - axisMin;
  const plotHeight = height - padTop - padBottom;
  const yForKcal = (kcal: number) => height - padBottom - ((kcal - axisMin) / span) * plotHeight;
  const coords = points.map((row, index) => {
    const x = padLeft + (index / (points.length - 1)) * (width - padLeft - padRight);
    const y = yForKcal(row.kcal);
    return { x, y, ...row };
  });
  const yTicks = Array.from({ length: Math.floor((axisMax - axisMin) / 100) + 1 }, (_, index) => axisMin + index * 100);
  const grid = yTicks
    .map((tick) => {
      const y = yForKcal(tick).toFixed(1);
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="#e2e8f0" stroke-width="0.8" />
      <text x="${padLeft - 5}" y="${y}" text-anchor="end" dominant-baseline="middle" class="viz-spark-label">${tick}</text>`;
    })
    .join("");
  const line = coords.map((row, index) => `${index === 0 ? "M" : "L"} ${row.x.toFixed(1)} ${row.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1]!.x.toFixed(1)} ${height - padBottom} L ${coords[0]!.x.toFixed(1)} ${height - padBottom} Z`;
  const dots = coords
    .map(
      (row) =>
        `<circle cx="${row.x.toFixed(1)}" cy="${row.y.toFixed(1)}" r="2.4" fill="#0d9488" />`,
    )
    .join("");
  const labelStep = points.length > 8 ? Math.ceil(points.length / 7) : 1;
  const labels = coords
    .map((row, index) => {
      if (index !== 0 && index !== coords.length - 1 && index % labelStep !== 0) return "";
      return `<text x="${row.x.toFixed(1)}" y="${height - 1}" text-anchor="middle" class="viz-spark-label">${escapeXml(row.label)}</text>`;
    })
    .join("");
  return `<svg class="viz-spark" viewBox="0 0 ${width} ${height}" role="img" aria-label="Energi gjennom perioden">
    <defs>
      <linearGradient id="kcalFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#30E3BE" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#30E3BE" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    ${grid}
    <text x="2" y="8" class="viz-spark-label">kcal</text>
    <path d="${area}" fill="url(#kcalFill)" />
    <path d="${line}" fill="none" stroke="#0d9488" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
    ${dots}
    ${labels}
  </svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildClientReportGraphicsHtml(input: {
  totals: FoodLogNutritionTotals;
  mealPlanTargets?: MealPlanTargets | null;
  microRows: MicronutrientDailyRow[];
  referenceContext?: NutritionReferenceContext;
  dailyKcal?: Array<{ dateLabel: string; kcal: number }>;
}): string {
  const macroRows = buildMacroDisplayRows(input.totals, input.mealPlanTargets, input.referenceContext);
  const status = countClientStatusTones(macroRows, input.microRows);
  const statusTotal = status.ok + status.warn + status.danger;
  const split = energySplitFromTotals(input.totals);
  const gaugeRows = macroRows.filter((row) => row.id === "kcal" || row.id === "protein" || row.id === "carbs" || row.id === "fat");
  const reportedKcal = macroRows.find((row) => row.id === "kcal")?.value ?? input.totals.kcal;
  const sparkPoints = (input.dailyKcal ?? [])
    .map((row) => ({
      label: row.dateLabel.replace(/^([a-zæøå]{3})\s+/i, "$1 ").slice(0, 10),
      kcal: row.kcal,
    }))
    .filter((row) => Number.isFinite(row.kcal));

  const statusLegend = [
    status.ok ? `<span><i class="swatch swatch--ok"></i> ${status.ok} innenfor</span>` : "",
    status.warn ? `<span><i class="swatch swatch--warn"></i> ${status.warn} litt utenfor</span>` : "",
    status.danger ? `<span><i class="swatch swatch--danger"></i> ${status.danger} utenfor</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const splitLegend = [
    `<span><i class="swatch" style="background:#0d9488"></i> Protein ${split.totalKcal ? Math.round((split.proteinKcal / split.totalKcal) * 100) : 0}%</span>`,
    `<span><i class="swatch" style="background:#38bdf8"></i> Karbo ${split.totalKcal ? Math.round((split.carbsKcal / split.totalKcal) * 100) : 0}%</span>`,
    `<span><i class="swatch" style="background:#D91278"></i> Fett ${split.totalKcal ? Math.round((split.fatKcal / split.totalKcal) * 100) : 0}%</span>`,
  ].join("");

  const spark = sparkPoints.length > 1 ? sparklineSvg(sparkPoints) : "";

  return `<section class="viz">
    <h2>Slik ligger kosten an</h2>
    <div class="viz-board">
      <article class="viz-card">
        <p class="viz-title">Status for næringsstoffer</p>
        ${donutSvg(
          [
            { value: status.ok, color: TONE_COLOR.ok, label: "Innenfor" },
            { value: status.warn, color: TONE_COLOR.warn, label: "Litt utenfor" },
            { value: status.danger, color: TONE_COLOR.danger, label: "Utenfor" },
          ],
          String(statusTotal),
          "vurdert",
        )}
        <p class="viz-legend">${statusLegend || "<span>Ingen referanser å sammenligne med ennå.</span>"}</p>
      </article>
      <article class="viz-card">
        <p class="viz-title">Energifordeling</p>
        ${donutSvg(
          [
            { value: split.proteinKcal, color: "#0d9488", label: "Protein" },
            { value: split.carbsKcal, color: "#38bdf8", label: "Karbo" },
            { value: split.fatKcal, color: "#D91278", label: "Fett" },
          ],
          String(Math.round(reportedKcal)),
          "kcal",
        )}
        <p class="viz-legend">${splitLegend}</p>
      </article>
      <article class="viz-card viz-card--gauges">
        <p class="viz-title">Mot anbefaling</p>
        <div class="viz-gauges">
          ${gaugeRows
            .map((row) => {
              const classified = classifyMacroDisplayStatus(row);
              return gaugeSvg(row.label, classified.coveragePct, classified.tone, `${Math.round(row.value)} ${row.unit}`);
            })
            .join("")}
        </div>
      </article>
    ${
      spark
        ? `<article class="viz-card viz-card--spark">
            <p class="viz-title">Energi gjennom perioden</p>
            ${spark}
          </article>`
        : ""
    }
    </div>
  </section>`;
}

export function buildClientReportCommentHtml(comment: string | undefined): string {
  const trimmed = comment?.trim() ?? "";
  if (!trimmed) {
    return `<section class="comment">
      <h2>Kommentar fra trener</h2>
      <div class="comment-lines" aria-hidden="true"></div>
    </section>`;
  }
  const body = escapeXml(trimmed).replace(/\r\n|\n|\r/g, "<br />");
  return `<section class="comment comment--filled">
    <h2>Kommentar fra trener</h2>
    <p>${body}</p>
  </section>`;
}
