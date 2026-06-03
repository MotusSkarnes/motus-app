import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import { openNutritionReportPrintWindow } from "../../app/memberFoodLogNutritionReportPrint";
import {
  buildMemberFoodLogNutritionPeriodReport,
  dateKeysWithLogs,
  calendarDayKeysInRange,
  filterDateKeysInRange,
  formatPeriodLabel,
  formatShortDateKey,
  lastNCalendarDayKeys,
  lastNDaysDateKeys,
} from "../../app/memberFoodLogNutritionReport";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import {
  buildExtraFatDisplayRows,
  buildOmegaOverviewRows,
  EPA_DHA_DAILY_TARGET_G,
  OMEGA3_DAILY_TARGET_G,
} from "../../app/nutritionReportFattyAcids";
import { buildMacroDisplayRows, buildWaterReportRows, DEFAULT_DAILY_KCAL_TARGET } from "../../app/nutritionReportDisplay";
import {
  nutritionReferenceFootnote,
  nutritionReferenceWarningMessage,
  resolveNutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
import { filterMicronutrientReportRows, micronutrientRowsForReport } from "../../app/quickFoodLogNutrition";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { GradientButton, OutlineButton } from "../../app/ui";
import { MacroReportTable, MicroReportFilter, MicroReportLegend, MicroReportTable, OmegaOverviewTable, WaterReportSection } from "./NutritionReportTables";

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
  trackedWaterLiters?: Record<string, number>;
  mealPlanTargets?: MealPlanTargets | null;
};

export function MemberFoodLogNutritionReportModal({
  open,
  onClose,
  memberName,
  memberBirthDate = "",
  memberGender = "",
  selectedDateKey,
  quickFoodLogs,
  trackedWaterLiters = {},
  mealPlanTargets,
}: MemberFoodLogNutritionReportModalProps) {
  const displayName = memberName.trim() || "Kunden";
  const loggedDateKeys = useMemo(() => dateKeysWithLogs(quickFoodLogs), [quickFoodLogs]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7");
  const [customFrom, setCustomFrom] = useState(selectedDateKey);
  const [customTo, setCustomTo] = useState(selectedDateKey);
  const [aggregateMode, setAggregateMode] = useState<AggregateMode>("average");
  const [tab, setTab] = useState<ReportTab>("macro");
  const [microIssuesOnly, setMicroIssuesOnly] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomFrom(selectedDateKey);
    setCustomTo(selectedDateKey);
    setPeriodPreset("7");
    setAggregateMode("average");
    setTab("macro");
    setMicroIssuesOnly(false);
    setPrintError(null);
  }, [open, selectedDateKey]);

  const periodDateKeys = useMemo(() => {
    if (periodPreset === "selected") return [selectedDateKey];
    if (periodPreset === "7") return lastNCalendarDayKeys(selectedDateKey, 7);
    if (periodPreset === "14") return lastNCalendarDayKeys(selectedDateKey, 14);
    if (periodPreset === "30") return lastNCalendarDayKeys(selectedDateKey, 30);
    return calendarDayKeysInRange(customFrom, customTo);
  }, [customFrom, customTo, periodPreset, selectedDateKey]);

  const report = useMemo(
    () => buildMemberFoodLogNutritionPeriodReport(quickFoodLogs, periodDateKeys, trackedWaterLiters),
    [periodDateKeys, quickFoodLogs, trackedWaterLiters],
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

  const waterRows = useMemo(
    () => (displayTotals ? buildWaterReportRows(displayTotals) : []),
    [displayTotals],
  );

  const macroRows = useMemo(
    () => [
      ...buildMacroDisplayRows(displayTotals, mealPlanTargets, referenceContext),
      ...buildExtraFatDisplayRows(displayTotals),
    ],
    [displayTotals, mealPlanTargets, referenceContext],
  );
  const microRows = useMemo(
    () => micronutrientRowsForReport(displayTotals, referenceContext),
    [displayTotals, referenceContext],
  );
  const microOkCount = useMemo(() => microRows.filter((row) => row.statusTone === "ok").length, [microRows]);
  const visibleMicroRows = useMemo(
    () => filterMicronutrientReportRows(microRows, microIssuesOnly),
    [microRows, microIssuesOnly],
  );
  const omegaRows = useMemo(() => buildOmegaOverviewRows(displayTotals.fattyAcids), [displayTotals.fattyAcids]);

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
      microRows: visibleMicroRows,
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
  }, [displayName, displayTotals, mealPlanTargets, visibleMicroRows, periodSummary, referenceContext, report]);

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
              <WaterReportSection rows={waterRows} />
              <MacroReportTable rows={macroRows} />
              <p className="motus-nutrition-report-modal__footnote">
                Kalorier og makro: daglige mål fra matplan der satt, ellers {DEFAULT_DAILY_KCAL_TARGET} kcal. Fiber, mettet fett
                og natrium: {referenceFootnote}
              </p>
            </section>
          ) : (
            <section aria-label="Mikronæringsstoffer">
              <MicroReportLegend />
              <MicroReportFilter
                issuesOnly={microIssuesOnly}
                onIssuesOnlyChange={setMicroIssuesOnly}
                totalCount={microRows.length}
                hiddenOkCount={microOkCount}
              />
              {visibleMicroRows.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {microIssuesOnly
                    ? "Ingen avvik funnet — alle stoffer er innenfor anbefalt område."
                    : "Ingen mikronæringsdata i valgt periode."}
                </p>
              ) : (
                <MicroReportTable rows={visibleMicroRows} />
              )}
              <p className="motus-nutrition-report-modal__footnote">{referenceFootnote}</p>

              <h3 className="motus-nutrition-report-modal__subheading">Omega-fettsyrer</h3>
              <OmegaOverviewTable rows={omegaRows} />
              <p className="motus-nutrition-report-modal__footnote">
                Veiledende daglige referanser: omega-3 ca. {OMEGA3_DAILY_TARGET_G} g, EPA+DHA ca.{" "}
                {EPA_DHA_DAILY_TARGET_G} g. Forhold omega-6:omega-3 under 5:1 regnes ofte gunstig.
              </p>
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
