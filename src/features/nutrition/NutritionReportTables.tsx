import type { ReactNode } from "react";
import { formatMicronutrientReferenceLine, formatMicronutrientWithUnit } from "../../app/foodBankMicronutrients";
import {
  formatOmegaOverviewValue,
  type OmegaOverviewRow,
} from "../../app/nutritionReportFattyAcids";
import {
  classifyMacroDisplayStatus,
  formatMacroDisplayValue,
  formatMacroReferenceLine,
  type MacroDisplayRow,
  type NutritionReportStatusTone,
} from "../../app/nutritionReportDisplay";
import type { MicronutrientDailyRow, MicronutrientReportFilterMode } from "../../app/quickFoodLogNutrition";
import { micronutrientReportEmptyMessage, micronutrientReportFilterCounts } from "../../app/quickFoodLogNutrition";

type NutrientStatusRowView = {
  key: string;
  label: string;
  statusTone: NutritionReportStatusTone;
  statusLabel: string;
  valueText: string;
  refText: string;
  barPct: number;
  percentText?: string;
};

function NutrientStatusList({ rows }: { rows: NutrientStatusRowView[] }) {
  return (
    <div className="motus-nutrition-report__micro-list">
      {rows.map((row) => (
        <div
          key={row.key}
          className={`motus-nutrition-report__micro-row motus-nutrition-report__micro-row--${row.statusTone}`}
        >
          <div className="motus-nutrition-report__micro-row-head">
            <span className="motus-nutrition-report__micro-label">{row.label}</span>
            <span
              className={`motus-nutrition-report__micro-status motus-nutrition-report__micro-status--${row.statusTone}`}
              title={row.statusLabel}
            >
              {row.statusLabel}
            </span>
          </div>
          <span className="motus-nutrition-report__micro-values">
            {row.valueText}
            <span className="motus-nutrition-report__micro-ref">{row.refText}</span>
          </span>
          {row.barPct > 0 || row.statusTone !== "muted" ? (
            <div className="motus-nutrition-report__bar-track" aria-hidden>
              <div
                className={`motus-nutrition-report__bar-fill motus-nutrition-report__bar-fill--${row.statusTone}`}
                style={{ width: `${row.barPct}%` }}
              />
            </div>
          ) : null}
          {row.percentText ? <span className="motus-nutrition-report__micro-pct">{row.percentText}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function MacroReportTable({ rows }: { rows: MacroDisplayRow[] }) {
  return (
    <NutrientStatusList
      rows={rows.map((row) => {
        const status = classifyMacroDisplayStatus(row);
        return {
          key: row.label,
          label: row.label,
          statusTone: status.tone,
          statusLabel: status.label,
          valueText: formatMacroDisplayValue(row),
          refText: status.referenceLine || formatMacroReferenceLine(row),
          barPct: status.barPct,
          percentText: status.percentLine,
        };
      })}
    />
  );
}

export function WaterReportSection({ rows }: { rows: MacroDisplayRow[] }) {
  const totalRow = rows.find((row) => row.target > 0);
  const waterRef = totalRow ? formatMacroReferenceLine(totalRow) : "Helsedirektoratet / NNR 2023";
  return (
    <section className="motus-nutrition-report-section" aria-label="Vanninntak">
      <h3 className="motus-nutrition-report-modal__subheading">Vanninntak</h3>
      <MacroReportTable rows={rows} />
      <p className="motus-nutrition-report-modal__footnote">
        Drikke = manuelt logget vann. Fra mat = vanninnhold i matvarer. Totalt: {waterRef} (Helsedirektoratet / NNR
        2023).
      </p>
    </section>
  );
}

export function OmegaOverviewTable({ rows }: { rows: OmegaOverviewRow[] }) {
  return (
    <div className="motus-nutrition-report__omega-grid">
      {rows.map((row) => (
        <div key={row.label} className="motus-nutrition-report__omega-card">
          <div className="motus-nutrition-report__omega-label">{row.label}</div>
          <div className="motus-nutrition-report__omega-value">{formatOmegaOverviewValue(row)}</div>
          {row.hint ? <p className="motus-nutrition-report__omega-hint">{row.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function MicroReportTable({ rows }: { rows: MicronutrientDailyRow[] }) {
  return (
    <NutrientStatusList
      rows={rows.map((row) => {
        const pct = Math.min(100, Math.round(row.coveragePct));
        const barPct =
          row.upper && row.upper > 0 ? Math.min(100, Math.round((row.value / row.upper) * 100)) : pct;
        return {
          key: row.key,
          label: row.label,
          statusTone: row.statusTone,
          statusLabel: row.statusLabel,
          valueText: formatMicronutrientWithUnit(row.value, row.decimals, row.unit),
          refText: formatMicronutrientReferenceLine(row),
          barPct,
          percentText: `${pct}% av anbefalt (RI)${
            row.upper !== null ? ` · ${Math.round((row.value / row.upper) * 100)}% av UL` : ""
          }`,
        };
      })}
    />
  );
}

type MicroReportFilterProps = {
  filter: MicronutrientReportFilterMode;
  onFilterChange: (value: MicronutrientReportFilterMode) => void;
  rows: MicronutrientDailyRow[];
};

export function MicroReportFilter({ filter, onFilterChange, rows }: MicroReportFilterProps) {
  const counts = micronutrientReportFilterCounts(rows);
  const options: { id: MicronutrientReportFilterMode; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: counts.all },
    { id: "within", label: "Innenfor AR/RI", count: counts.within },
    { id: "outside", label: "Utenfor AR/RI", count: counts.outside },
  ];

  return (
    <div className="motus-nutrition-report__micro-filter motus-nutrition-report-no-print">
      <div className="motus-nutrition-report-modal__chips" role="group" aria-label="Filtrer mikronæringsstoffer">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`motus-nutrition-report-modal__chip ${filter === option.id ? "is-active" : ""}`}
            onClick={() => onFilterChange(option.id)}
            aria-pressed={filter === option.id}
          >
            {option.label} ({option.count})
          </button>
        ))}
      </div>
      {filter !== "all" ? (
        <p className="motus-nutrition-report__micro-filter-hint">
          {filter === "within"
            ? "Viser stoffer mellom RI og UL."
            : "Viser stoffer under AR/RI eller nær/over UL."}
        </p>
      ) : null}
    </div>
  );
}

export function MicroReportLegend() {
  return (
    <div className="motus-nutrition-report__micro-legend" role="note">
      <span className="motus-nutrition-report__micro-legend-item motus-nutrition-report__micro-status--danger">
        Under AR / over UL
      </span>
      <span className="motus-nutrition-report__micro-legend-item motus-nutrition-report__micro-status--warn">
        Under RI (over AR) · nær UL
      </span>
      <span className="motus-nutrition-report__micro-legend-item motus-nutrition-report__micro-status--ok">
        Mellom RI og UL
      </span>
      <p className="motus-nutrition-report__micro-legend-note">
        AR = gjennomsnittsbehov, RI = anbefalt inntak, UL = øvre toleransegrense (NNR 2023).
      </p>
    </div>
  );
}

type NutritionReportStackedBodyProps = {
  waterRows: MacroDisplayRow[];
  macroRows: MacroDisplayRow[];
  macroFootnote: string;
  microRows: MicronutrientDailyRow[];
  visibleMicroRows: MicronutrientDailyRow[];
  microFilter: MicronutrientReportFilterMode;
  onMicroFilterChange: (value: MicronutrientReportFilterMode) => void;
  microNoDataMessage: string;
  referenceFootnote: string;
  omegaRows: OmegaOverviewRow[];
  omegaFootnote: string;
  referenceWarning?: string | null;
  dailyBreakdown?: ReactNode;
};

export function NutritionReportStackedBody({
  waterRows,
  macroRows,
  macroFootnote,
  microRows,
  visibleMicroRows,
  microFilter,
  onMicroFilterChange,
  microNoDataMessage,
  referenceFootnote,
  omegaRows,
  omegaFootnote,
  referenceWarning,
  dailyBreakdown,
}: NutritionReportStackedBodyProps) {
  const microEmptyMessage = micronutrientReportEmptyMessage(
    microRows,
    visibleMicroRows,
    microFilter,
    microNoDataMessage,
  );

  return (
    <>
      <WaterReportSection rows={waterRows} />

      <section className="motus-nutrition-report-section" aria-label="Makronæringsstoffer">
        <h3 className="motus-nutrition-report-modal__subheading">Makronæringsstoffer</h3>
        <MacroReportTable rows={macroRows} />
        <p className="motus-nutrition-report-modal__footnote">{macroFootnote}</p>
      </section>

      <section className="motus-nutrition-report-section" aria-label="Mikronæringsstoffer">
        <h3 className="motus-nutrition-report-modal__subheading">Mikronæringsstoffer</h3>
        <MicroReportLegend />
        <MicroReportFilter filter={microFilter} onFilterChange={onMicroFilterChange} rows={microRows} />
        {microEmptyMessage ? (
          <p className="text-sm text-slate-600">{microEmptyMessage}</p>
        ) : (
          <MicroReportTable rows={visibleMicroRows} />
        )}
        <p className="motus-nutrition-report-modal__footnote">{referenceFootnote}</p>
      </section>

      <section className="motus-nutrition-report-section" aria-label="Omega-fettsyrer">
        <h3 className="motus-nutrition-report-modal__subheading">Omega-fettsyrer</h3>
        <OmegaOverviewTable rows={omegaRows} />
        <p className="motus-nutrition-report-modal__footnote">{omegaFootnote}</p>
      </section>

      {referenceWarning ? (
        <p className="motus-nutrition-report-modal__profile-warning" role="status">
          {referenceWarning}
        </p>
      ) : null}

      {dailyBreakdown}
    </>
  );
}
