import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import motusLogo from "../../assets/motus-logo-transparent.svg";
import {
  openNutritionReportPrintWindow,
  type NutritionReportPrintAudience,
} from "../../app/memberFoodLogNutritionReportPrint";
import { buildDailyVariationTable, type DailyVariationGroupId } from "../../app/nutritionReportDailyVariation";
import {
  buildMemberFoodLogNutritionPeriodReport,
  dateKeysWithLogs,
  calendarDayKeysInRange,
  formatPeriodLabel,
  formatShortDateKey,
  lastNCalendarDayKeys,
} from "../../app/memberFoodLogNutritionReport";
import {
  buildNutrientContributionLookup,
  contributionSourcesFromFoodLogs,
  resolveFoodLogsNutrition,
} from "../../app/nutritionReportContributors";
import { buildNutrientCoverageLookup } from "../../app/nutritionReportCoverage";
import type { MemberQuickFoodLogEntry } from "../../app/memberMealPlanState";
import { useFoodBankItems } from "../../app/useFoodBankItems";
import {
  buildExtraFatDisplayRows,
  buildOmegaOverviewRows,
  nutritionOmegaReportFootnote,
} from "../../app/nutritionReportFattyAcids";
import { buildMacroDisplayRows, buildWaterReportRows, nutritionMacroReportFootnote, resolveReportKcalTarget } from "../../app/nutritionReportDisplay";
import {
  nutritionReferenceFootnote,
  nutritionReferenceWarningMessage,
  resolveNutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
import {
  filterMicronutrientReportRows,
  micronutrientRowsForReport,
  type MicronutrientReportFilterMode,
} from "../../app/quickFoodLogNutrition";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { GradientButton, OutlineButton } from "../../app/ui";
import { NutritionReportClientCommentField } from "./NutritionReportClientCommentField";
import { NutritionReportDailyVariation } from "./NutritionReportDailyVariation";
import { NutritionReportStackedBody } from "./NutritionReportTables";

type PeriodPreset = "selected" | "7" | "14" | "30" | "custom";
type ReportViewMode = "average" | "sum" | "variation";

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
  const foodItems = useFoodBankItems();
  const loggedDateKeys = useMemo(() => dateKeysWithLogs(quickFoodLogs), [quickFoodLogs]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("7");
  const [customFrom, setCustomFrom] = useState(selectedDateKey);
  const [customTo, setCustomTo] = useState(selectedDateKey);
  const [viewMode, setViewMode] = useState<ReportViewMode>("average");
  const [variationGroup, setVariationGroup] = useState<DailyVariationGroupId>("macro");
  const [microFilter, setMicroFilter] = useState<MicronutrientReportFilterMode>("all");
  const [printError, setPrintError] = useState<string | null>(null);
  const [clientComment, setClientComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setCustomFrom(selectedDateKey);
    setCustomTo(selectedDateKey);
    setPeriodPreset("7");
    setViewMode("average");
    setVariationGroup("macro");
    setMicroFilter("all");
    setPrintError(null);
    setClientComment("");
  }, [open, selectedDateKey]);

  const periodDateKeys = useMemo(() => {
    if (periodPreset === "selected") return [selectedDateKey];
    if (periodPreset === "7") return lastNCalendarDayKeys(selectedDateKey, 7);
    if (periodPreset === "14") return lastNCalendarDayKeys(selectedDateKey, 14);
    if (periodPreset === "30") return lastNCalendarDayKeys(selectedDateKey, 30);
    return calendarDayKeysInRange(customFrom, customTo);
  }, [customFrom, customTo, periodPreset, selectedDateKey]);

  const resolvedLogs = useMemo(
    () => resolveFoodLogsNutrition(quickFoodLogs, periodDateKeys, foodItems),
    [foodItems, periodDateKeys, quickFoodLogs],
  );

  const report = useMemo(
    () => buildMemberFoodLogNutritionPeriodReport(resolvedLogs, periodDateKeys, trackedWaterLiters),
    [periodDateKeys, resolvedLogs, trackedWaterLiters],
  );

  const displayTotals = useMemo(() => {
    if (report.daysWithLogs <= 1) return report.dailyTotals[0]?.totals ?? report.dailyAverage;
    return viewMode === "sum" ? report.periodSum : report.dailyAverage;
  }, [viewMode, report]);

  const referenceContext = useMemo(
    () => resolveNutritionReferenceContext(memberBirthDate, memberGender),
    [memberBirthDate, memberGender],
  );
  const variationTable = useMemo(
    () =>
      buildDailyVariationTable(report.dailyTotals, report.dailyAverage, variationGroup, {
        mealPlanTargets,
        referenceContext,
      }),
    [mealPlanTargets, referenceContext, report.dailyAverage, report.dailyTotals, variationGroup],
  );
  const referenceWarning = useMemo(
    () => nutritionReferenceWarningMessage(referenceContext.missingFields),
    [referenceContext.missingFields],
  );
  const referenceFootnote = useMemo(() => nutritionReferenceFootnote(referenceContext), [referenceContext]);

  const waterRows = useMemo(
    () => (displayTotals ? buildWaterReportRows(displayTotals, referenceContext) : []),
    [displayTotals, referenceContext],
  );

  const macroRows = useMemo(
    () => [
      ...buildMacroDisplayRows(displayTotals, mealPlanTargets, referenceContext),
      ...buildExtraFatDisplayRows(displayTotals, resolveReportKcalTarget(mealPlanTargets, referenceContext)),
    ],
    [displayTotals, mealPlanTargets, referenceContext],
  );
  const microRows = useMemo(
    () => micronutrientRowsForReport(displayTotals, referenceContext),
    [displayTotals, referenceContext],
  );
  const visibleMicroRows = useMemo(
    () => filterMicronutrientReportRows(microRows, microFilter),
    [microRows, microFilter],
  );
  const omegaRows = useMemo(
    () => buildOmegaOverviewRows(displayTotals.fattyAcids, resolveReportKcalTarget(mealPlanTargets, referenceContext)),
    [displayTotals.fattyAcids, mealPlanTargets, referenceContext],
  );
  const contributionSources = useMemo(
    () => contributionSourcesFromFoodLogs(resolvedLogs, report.dateKeys),
    [report.dateKeys, resolvedLogs],
  );
  const contributionLookup = useMemo(
    () =>
      buildNutrientContributionLookup(contributionSources, {
        drinkWaterLiters: report.periodSum.drinkWaterLiters,
        totals: report.periodSum,
      }),
    [contributionSources, report.periodSum],
  );
  const coverageLookup = useMemo(
    () => buildNutrientCoverageLookup(contributionSources),
    [contributionSources],
  );

  const aggregateSummary =
    report.daysWithLogs === 0
      ? "Ingen logger i valgt periode"
      : report.daysWithLogs === 1
        ? formatShortDateKey(report.dateKeys[0]!)
        : viewMode === "sum"
          ? `Sum for perioden · ${report.daysWithLogs} dager (${formatPeriodLabel(report.dateKeys)})`
          : `Snitt per dag · ${report.daysWithLogs} dager (${formatPeriodLabel(report.dateKeys)})`;
  const periodSummary =
    report.daysWithLogs > 1 && viewMode === "variation"
      ? `Dagsvariasjon · ${report.daysWithLogs} dager (${formatPeriodLabel(report.dateKeys)})`
      : aggregateSummary;

  const handlePrint = useCallback(
    (audience: NutritionReportPrintAudience) => {
      const ok = openNutritionReportPrintWindow({
        memberName: displayName,
        periodSummary: viewMode === "variation" ? aggregateSummary : periodSummary,
        totals: displayTotals,
        mealPlanTargets,
        microRows: audience === "client" ? microRows : visibleMicroRows,
        referenceContext,
        contributionLookup: audience === "trainer" ? contributionLookup : undefined,
        coverageLookup: audience === "trainer" ? coverageLookup : undefined,
        dailyTotals: report.daysWithLogs > 1 ? report.dailyTotals : undefined,
        dailyAverage: report.daysWithLogs > 1 ? report.dailyAverage : undefined,
        audience,
        logoUrl: motusLogo,
        clientComment: audience === "client" ? clientComment : undefined,
      });
      if (!ok) {
        setPrintError("Kunne ikke åpne utskrift. Tillat popup-vinduer for Motus i nettleseren.");
        return;
      }
      setPrintError(null);
    },
    [
      displayName,
      displayTotals,
      mealPlanTargets,
      microRows,
      visibleMicroRows,
      periodSummary,
      aggregateSummary,
      viewMode,
      referenceContext,
      report,
      contributionLookup,
      coverageLookup,
      clientComment,
    ],
  );

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
                  className={`motus-nutrition-report-modal__chip ${viewMode === "average" ? "is-active" : ""}`}
                  onClick={() => setViewMode("average")}
                >
                  Snitt per dag
                </button>
                <button
                  type="button"
                  className={`motus-nutrition-report-modal__chip ${viewMode === "sum" ? "is-active" : ""}`}
                  onClick={() => setViewMode("sum")}
                >
                  Sum totalt
                </button>
                <button
                  type="button"
                  className={`motus-nutrition-report-modal__chip ${viewMode === "variation" ? "is-active" : ""}`}
                  onClick={() => setViewMode("variation")}
                >
                  Dagsvariasjon
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="motus-nutrition-report-modal__summary">
          <p className="motus-nutrition-report-modal__summary-text">{periodSummary}</p>
        </div>

        <div className="motus-nutrition-report-modal__body">
          {report.daysWithLogs === 0 ? (
            <p className="text-sm text-slate-600">Ingen matlogg i valgt periode.</p>
          ) : viewMode === "variation" && report.daysWithLogs > 1 ? (
            <NutritionReportDailyVariation
              table={variationTable}
              group={variationGroup}
              onGroupChange={setVariationGroup}
            />
          ) : (
            <NutritionReportStackedBody
              waterRows={waterRows}
              macroRows={macroRows}
              macroFootnote={nutritionMacroReportFootnote(referenceContext)}
              microRows={microRows}
              visibleMicroRows={visibleMicroRows}
              microFilter={microFilter}
              onMicroFilterChange={setMicroFilter}
              microNoDataMessage="Ingen mikronæringsdata i valgt periode."
              referenceFootnote={referenceFootnote}
              omegaRows={omegaRows}
              omegaFootnote={nutritionOmegaReportFootnote()}
              contributionLookup={contributionLookup}
              coverageLookup={coverageLookup}
              referenceWarning={referenceWarning}
            />
          )}
        </div>

        <div
          className="motus-nutrition-report-modal__comment-wrap motus-nutrition-report-no-print"
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <NutritionReportClientCommentField value={clientComment} onChange={setClientComment} />
        </div>

        <footer className="motus-nutrition-report-modal__footer motus-nutrition-report-no-print">
          {printError ? <p className="w-full text-xs text-rose-700">{printError}</p> : null}
          <OutlineButton
            type="button"
            className="gap-1.5"
            onClick={() => handlePrint("trainer")}
            disabled={report.daysWithLogs === 0}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Utskrift til trener
          </OutlineButton>
          <OutlineButton
            type="button"
            className="gap-1.5"
            onClick={() => handlePrint("client")}
            disabled={report.daysWithLogs === 0}
          >
            <Printer className="h-4 w-4" aria-hidden />
            Utskrift til kunde
          </OutlineButton>
          <GradientButton type="button" onClick={onClose}>
            Lukk
          </GradientButton>
        </footer>
      </div>
    </div>
  );
}
