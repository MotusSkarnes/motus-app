import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { formatMicronutrientValue } from "../../app/foodBankMicronutrients";
import { openNutritionReportPrintWindow } from "../../app/memberFoodLogNutritionReportPrint";
import {
  buildMemberFoodLogNutritionPeriodReport,
  dateKeysWithLogs,
  filterDateKeysInRange,
  formatPeriodLabel,
  formatShortDateKey,
  lastNDaysDateKeys,
} from "../../app/memberFoodLogNutritionReport";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import {
  buildMacroDisplayRows,
  DEFAULT_DAILY_KCAL_TARGET,
  macroCoveragePct,
  type MacroDisplayRow,
} from "../../app/nutritionReportDisplay";
import {
  nutritionReferenceFootnote,
  nutritionReferenceWarningMessage,
  resolveNutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
import {
  micronutrientRowsFromLogTotals,
  type MicronutrientDailyRow,
} from "../../app/quickFoodLogNutrition";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { GradientButton, OutlineButton } from "../../app/ui";

type PeriodPreset = "selected" | "7" | "14" | "30" | "custom";
type ReportTab = "macro" | "micro";
type AggregateMode = "average" | "sum";

type MemberFoodLogNutritionReportModalProps = {
  open: boolean;
  onClose: () => void;
  memberName: string;
  memberBirthDate?: string;
  memberGender?: string;
  selectedDateKey: string;
  quickFoodLogs: Record<string, MemberQuickFoodLogEntry[] | undefined>;
  mealPlanTargets?: MealPlanTargets | null;
};

function MacroReportTable({ rows }: { rows: MacroDisplayRow[] }) {
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

function MicroReportTable({ rows }: { rows: MicronutrientDailyRow[] }) {
  const visible = rows.filter((row) => row.value > 0);
  if (!visible.length) {
    return (
      <p className="text-sm text-slate-600">
        Ingen mikronæringsdata i perioden. Sjekk at matvarene i loggen har vitaminer og mineraler i matbanken.
      </p>
    );
  }
  return (
    <div className="motus-nutrition-report__micro-list">
      {visible.map((row) => {
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

export function MemberFoodLogNutritionReportModal({
  open,
  onClose,
  memberName,
  memberBirthDate = "",
  memberGender = "",
  selectedDateKey,
  quickFoodLogs,
  mealPlanTargets,
}: MemberFoodLogNutritionReportModalProps) {
  const displayName = memberName.trim() || "Kunden";
  const loggedDateKeys = useMemo(() => dateKeysWithLogs(quickFoodLogs), [quickFoodLogs]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7");
  const [customFrom, setCustomFrom] = useState(selectedDateKey);
  const [customTo, setCustomTo] = useState(selectedDateKey);
  const [aggregateMode, setAggregateMode] = useState<AggregateMode>("average");
  const [tab, setTab] = useState<ReportTab>("macro");
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomFrom(selectedDateKey);
    setCustomTo(selectedDateKey);
    setPeriodPreset("7");
    setAggregateMode("average");
    setTab("macro");
    setPrintError(null);
  }, [open, selectedDateKey]);

  const periodDateKeys = useMemo(() => {
    if (periodPreset === "selected") return filterDateKeysInRange(loggedDateKeys, selectedDateKey, selectedDateKey);
    if (periodPreset === "7") return lastNDaysDateKeys(loggedDateKeys, selectedDateKey, 7);
    if (periodPreset === "14") return lastNDaysDateKeys(loggedDateKeys, selectedDateKey, 14);
    if (periodPreset === "30") return lastNDaysDateKeys(loggedDateKeys, selectedDateKey, 30);
    return filterDateKeysInRange(loggedDateKeys, customFrom, customTo);
  }, [customFrom, customTo, loggedDateKeys, periodPreset, selectedDateKey]);

  const report = useMemo(
    () => buildMemberFoodLogNutritionPeriodReport(quickFoodLogs, periodDateKeys),
    [periodDateKeys, quickFoodLogs],
  );

  const displayTotals = useMemo(() => {
    if (report.daysWithLogs <= 1) return report.dailyTotals[0]?.totals ?? report.dailyAverage;
    return aggregateMode === "average" ? report.dailyAverage : report.periodSum;
  }, [aggregateMode, report]);

  const referenceContext = useMemo(
    () => resolveNutritionReferenceContext(memberBirthDate, memberGender),
    [memberBirthDate, memberGender],
  );
  const referenceWarning = useMemo(
    () => nutritionReferenceWarningMessage(referenceContext.missingFields),
    [referenceContext.missingFields],
  );
  const referenceFootnote = useMemo(() => nutritionReferenceFootnote(referenceContext), [referenceContext]);

  const macroRows = useMemo(
    () => buildMacroDisplayRows(displayTotals, mealPlanTargets, referenceContext),
    [displayTotals, mealPlanTargets, referenceContext],
  );
  const microRows = useMemo(
    () => micronutrientRowsFromLogTotals(displayTotals, referenceContext),
    [displayTotals, referenceContext],
  );

  const periodSummary =
    report.daysWithLogs === 0
      ? "Ingen logger i valgt periode"
      : report.daysWithLogs === 1
        ? formatShortDateKey(report.dateKeys[0]!)
        : aggregateMode === "average"
          ? `Snitt per dag · ${report.daysWithLogs} dager (${formatPeriodLabel(report.dateKeys)})`
          : `Sum for perioden · ${report.daysWithLogs} dager (${formatPeriodLabel(report.dateKeys)})`;

  const handlePrint = useCallback(() => {
    const ok = openNutritionReportPrintWindow({
      memberName: displayName,
      periodSummary,
      totals: displayTotals,
      mealPlanTargets,
      microRows,
      referenceContext,
      dailyKcal:
        report.daysWithLogs > 1
          ? report.dailyTotals.map(({ dateKey, totals: dayTotals }) => ({
              dateLabel: formatShortDateKey(dateKey),
              kcal: dayTotals.kcal,
            }))
          : undefined,
    });
    if (!ok) {
      setPrintError("Kunne ikke åpne utskrift. Tillat popup-vinduer for Motus i nettleseren.");
      return;
    }
    setPrintError(null);
  }, [displayName, displayTotals, mealPlanTargets, microRows, periodSummary, referenceContext, report]);

  if (!open) return null;

  return (
    <div className="motus-nutrition-report-backdrop" role="presentation" onClick={onClose}>
      <div
        className="motus-nutrition-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="motus-nutrition-report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="motus-nutrition-report-modal__head motus-nutrition-report-no-print">
          <div className="min-w-0">
            <h2 id="motus-nutrition-report-title" className="motus-nutrition-report-modal__title">
              Næringsrapport
            </h2>
            <p className="motus-nutrition-report-modal__subtitle">{displayName}</p>
          </div>
          <button type="button" className="motus-nutrition-report-modal__close motus-pressable" onClick={onClose} aria-label="Lukk">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="motus-nutrition-report-modal__controls motus-nutrition-report-no-print">
          <p className="motus-nutrition-report-modal__control-label">Periode</p>
          <div className="motus-nutrition-report-modal__chips">
            {(
              [
                ["selected", "Valgt dag"],
                ["7", "7 dager"],
                ["14", "14 dager"],
                ["30", "30 dager"],
                ["custom", "Egendefinert"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`motus-nutrition-report-modal__chip ${periodPreset === id ? "is-active" : ""}`}
                onClick={() => setPeriodPreset(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {periodPreset === "custom" ? (
            <div className="motus-nutrition-report-modal__custom-range">
              <label className="motus-nutrition-report-modal__date-field">
                <span>Fra</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="motus-nutrition-report-modal__date-field">
                <span>Til</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </div>
          ) : null}
          {report.daysWithLogs > 1 ? (
            <>
              <p className="motus-nutrition-report-modal__control-label">Visning</p>
              <div className="motus-nutrition-report-modal__chips">
                <button
                  type="button"
                  className={`motus-nutrition-report-modal__chip ${aggregateMode === "average" ? "is-active" : ""}`}
                  onClick={() => setAggregateMode("average")}
                >
                  Snitt per dag
                </button>
                <button
                  type="button"
                  className={`motus-nutrition-report-modal__chip ${aggregateMode === "sum" ? "is-active" : ""}`}
                  onClick={() => setAggregateMode("sum")}
                >
                  Sum totalt
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="motus-nutrition-report-modal__summary">
          <p className="motus-nutrition-report-modal__summary-text">{periodSummary}</p>
        </div>

        <div className="motus-nutrition-report-modal__tabs motus-nutrition-report-no-print" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "macro"}
            className={`motus-nutrition-report-modal__tab ${tab === "macro" ? "is-active" : ""}`}
            onClick={() => setTab("macro")}
          >
            Makronæringsstoffer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "micro"}
            className={`motus-nutrition-report-modal__tab ${tab === "micro" ? "is-active" : ""}`}
            onClick={() => setTab("micro")}
          >
            Mikronæringsstoffer
          </button>
        </div>

        <div className="motus-nutrition-report-modal__body">
          {report.daysWithLogs === 0 ? (
            <p className="text-sm text-slate-600">Ingen matlogg i valgt periode.</p>
          ) : tab === "macro" ? (
            <section aria-label="Makronæringsstoffer">
              <MacroReportTable rows={macroRows} />
              <p className="motus-nutrition-report-modal__footnote">
                Kalorier og makro: daglige mål fra matplan der satt, ellers {DEFAULT_DAILY_KCAL_TARGET} kcal. Fiber, mettet fett
                og natrium: {referenceFootnote}
              </p>
            </section>
          ) : (
            <section aria-label="Mikronæringsstoffer">
              <MicroReportTable rows={microRows} />
              <p className="motus-nutrition-report-modal__footnote">{referenceFootnote}</p>
            </section>
          )}

          {referenceWarning ? (
            <p className="motus-nutrition-report-modal__profile-warning" role="status">
              {referenceWarning}
            </p>
          ) : null}

          {report.daysWithLogs > 1 && tab === "macro" ? (
            <details className="motus-nutrition-report-modal__daily-breakdown motus-nutrition-report-no-print">
              <summary>Dag-for-dag (kcal)</summary>
              <ul className="motus-nutrition-report-modal__daily-list">
                {report.dailyTotals.map(({ dateKey, totals }) => (
                  <li key={dateKey}>
                    <span>{formatShortDateKey(dateKey)}</span>
                    <strong>{formatMacro(totals.kcal, 0)} kcal</strong>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <footer className="motus-nutrition-report-modal__footer motus-nutrition-report-no-print">
          {printError ? <p className="w-full text-xs text-rose-700">{printError}</p> : null}
          <OutlineButton type="button" className="gap-1.5" onClick={handlePrint} disabled={report.daysWithLogs === 0}>
            <Printer className="h-4 w-4" aria-hidden />
            Skriv ut / PDF
          </OutlineButton>
          <GradientButton type="button" onClick={onClose}>
            Lukk
          </GradientButton>
        </footer>
      </div>
    </div>
  );
}
