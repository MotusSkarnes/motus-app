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
        return (
          <div key={row.key} className="motus-nutrition-report__micro-row">
            <div className="motus-nutrition-report__micro-row-head">
              <span className="motus-nutrition-report__micro-label">{row.label}</span>
              <span className="motus-nutrition-report__micro-values">
                {formatMicronutrientValue(row.value, row.decimals)} / {formatMicronutrientValue(row.target, row.decimals)}{" "}
                {row.unit}
              </span>
            </div>
            <div className="motus-nutrition-report__bar-track" aria-hidden>
              <div className="motus-nutrition-report__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="motus-nutrition-report__micro-pct">{pct}% av daglig referanse</span>
          </div>
        );
      })}
    </div>
  );
}
