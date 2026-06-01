import { formatMacro } from "../../app/foodBankTypes";
import { formatMicronutrientValue } from "../../app/foodBankMicronutrients";
import {
  formatOmegaOverviewValue,
  type OmegaOverviewRow,
} from "../../app/nutritionReportFattyAcids";
import { macroCoveragePct, type MacroDisplayRow } from "../../app/nutritionReportDisplay";
import type { MicronutrientDailyRow } from "../../app/quickFoodLogNutrition";

export function MacroReportTable({ rows }: { rows: MacroDisplayRow[] }) {
  return (
    <div className="motus-nutrition-report__macro-grid">
      {rows.map((row) => {
        const hasTarget = row.target > 0;
        const pct = hasTarget ? macroCoveragePct(row.value, row.target, row.lowerIsBetter) : 0;
        return (
          <div key={row.label} className="motus-nutrition-report__macro-card">
            <div className="motus-nutrition-report__macro-card-head">
              <span className="motus-nutrition-report__macro-label">{row.label}</span>
              <span className="motus-nutrition-report__macro-value">
                {formatMacro(row.value, row.decimals)} {row.unit}
              </span>
            </div>
            {hasTarget ? (
              <>
                <div className="motus-nutrition-report__bar-track" aria-hidden>
                  <div className="motus-nutrition-report__bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="motus-nutrition-report__macro-meta">
                  {row.lowerIsBetter ? "Maks " : "Ref. "}
                  {formatMacro(row.target, row.decimals)} {row.unit}
                  {hasTarget ? ` · ${pct}%` : ""}
                </p>
              </>
            ) : (
              <p className="motus-nutrition-report__macro-meta motus-nutrition-report__macro-meta--muted">Ingen referanse</p>
            )}
          </div>
        );
      })}
    </div>
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
    <div className="motus-nutrition-report__micro-list">
      {rows.map((row) => {
        const pct = Math.min(100, Math.round(row.coveragePct));
        const barPct =
          row.upper && row.upper > 0
            ? Math.min(100, Math.round((row.value / row.upper) * 100))
            : pct;
        return (
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
              {formatMicronutrientValue(row.value, row.decimals)} {row.unit}
              <span className="motus-nutrition-report__micro-ref">
                {" "}
                · AR {formatMicronutrientValue(row.lower, row.decimals)} · RI{" "}
                {formatMicronutrientValue(row.target, row.decimals)}
                {row.upper !== null
                  ? ` · UL ${formatMicronutrientValue(row.upper, row.decimals)}`
                  : ""}{" "}
                {row.unit}
              </span>
            </span>
            <div className="motus-nutrition-report__bar-track" aria-hidden>
              <div
                className={`motus-nutrition-report__bar-fill motus-nutrition-report__bar-fill--${row.statusTone}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <span className="motus-nutrition-report__micro-pct">
              {pct}% av anbefalt (RI)
              {row.upper !== null ? ` · ${Math.round((row.value / row.upper) * 100)}% av UL` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type MicroReportFilterProps = {
  issuesOnly: boolean;
  onIssuesOnlyChange: (value: boolean) => void;
  totalCount: number;
  hiddenOkCount: number;
};

export function MicroReportFilter({ issuesOnly, onIssuesOnlyChange, totalCount, hiddenOkCount }: MicroReportFilterProps) {
  return (
    <div className="motus-nutrition-report__micro-filter motus-nutrition-report-no-print">
      <div className="motus-nutrition-report-modal__chips">
        <button
          type="button"
          className={`motus-nutrition-report-modal__chip ${issuesOnly ? "is-active" : ""}`}
          onClick={() => onIssuesOnlyChange(!issuesOnly)}
          aria-pressed={issuesOnly}
        >
          Vis bare avvik
        </button>
        {issuesOnly ? (
          <button
            type="button"
            className="motus-nutrition-report-modal__chip"
            onClick={() => onIssuesOnlyChange(false)}
          >
            Vis alle ({totalCount})
          </button>
        ) : null}
      </div>
      {issuesOnly && hiddenOkCount > 0 ? (
        <p className="motus-nutrition-report__micro-filter-hint">
          Skjuler {hiddenOkCount} {hiddenOkCount === 1 ? "stoff" : "stoffer"} innenfor anbefalt område.
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
