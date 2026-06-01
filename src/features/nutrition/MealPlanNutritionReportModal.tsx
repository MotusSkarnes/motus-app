import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, X } from "lucide-react";
import { openNutritionReportPrintWindow } from "../../app/memberFoodLogNutritionReportPrint";
import type { MealPlanNutritionContext } from "../../app/mealPlanFoodNutrition";
import { buildMealPlanNutritionReport } from "../../app/mealPlanNutritionTotals";
import type { MealPlan } from "../../app/mealPlanTypes";
import {
  buildExtraFatDisplayRows,
  buildOmegaOverviewRows,
  EPA_DHA_DAILY_TARGET_G,
  OMEGA3_DAILY_TARGET_G,
} from "../../app/nutritionReportFattyAcids";
import {
  buildMacroDisplayRows,
  DEFAULT_DAILY_KCAL_TARGET,
} from "../../app/nutritionReportDisplay";
import {
  nutritionReferenceFootnote,
  nutritionReferenceWarningMessage,
  resolveNutritionReferenceContext,
} from "../../app/personalizedNutritionReferences";
import { micronutrientRowsForReport } from "../../app/quickFoodLogNutrition";
import { GradientButton, OutlineButton } from "../../app/ui";
import { MacroReportTable, MicroReportTable, OmegaOverviewTable } from "./NutritionReportTables";

type ViewMode = "activeDay" | "average";

type MealPlanNutritionReportModalProps = {
  open: boolean;
  onClose: () => void;
  memberName: string;
  memberBirthDate?: string;
  memberGender?: string;
  plan: MealPlan;
  activeDayId: string;
  nutritionContext: MealPlanNutritionContext;
};

export function MealPlanNutritionReportModal({
  open,
  onClose,
  memberName,
  memberBirthDate = "",
  memberGender = "",
  plan,
  activeDayId,
  nutritionContext,
}: MealPlanNutritionReportModalProps) {
  const displayName = memberName.trim() || "Kunden";
  const report = useMemo(() => buildMealPlanNutritionReport(plan, nutritionContext), [plan, nutritionContext]);
  const reportLayoutKey = useMemo(
    () => `${report.daysWithFood}:${report.dayTotals.map((row) => row.dayId).join(",")}`,
    [report.daysWithFood, report.dayTotals],
  );

  const [viewMode, setViewMode] = useState<ViewMode>("activeDay");
  const [selectedDayId, setSelectedDayId] = useState(activeDayId);
  const [tab, setTab] = useState<"macro" | "micro">("macro");
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab("macro");
    setPrintError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const activeHasFood = report.dayTotals.some((row) => row.dayId === activeDayId);
    if (activeHasFood) {
      setViewMode("activeDay");
      setSelectedDayId(activeDayId);
      return;
    }
    if (report.daysWithFood === 1) {
      setViewMode("activeDay");
      setSelectedDayId(report.dayTotals[0]!.dayId);
      return;
    }
    if (report.daysWithFood > 1) {
      setViewMode("average");
      setSelectedDayId(activeDayId);
      return;
    }
    setViewMode("activeDay");
    setSelectedDayId(activeDayId);
  }, [open, activeDayId, report.daysWithFood, reportLayoutKey]);

  const displayTotals = useMemo(() => {
    if (report.daysWithFood === 0) return null;
    if (viewMode === "average") return report.dailyAverage;
    const dayRow = report.dayTotals.find((row) => row.dayId === selectedDayId);
    return dayRow?.totals ?? report.dayTotals[0]?.totals ?? report.dailyAverage;
  }, [report, selectedDayId, viewMode]);

  const referenceContext = useMemo(
    () => resolveNutritionReferenceContext(memberBirthDate, memberGender),
    [memberBirthDate, memberGender],
  );
  const referenceWarning = useMemo(
    () => nutritionReferenceWarningMessage(referenceContext.missingFields),
    [referenceContext.missingFields],
  );
  const referenceFootnote = useMemo(() => nutritionReferenceFootnote(referenceContext), [referenceContext]);

  const macroRows = useMemo(() => {
    if (!displayTotals) return [];
    return [...buildMacroDisplayRows(displayTotals, plan.targets, referenceContext), ...buildExtraFatDisplayRows(displayTotals)];
  }, [displayTotals, plan.targets, referenceContext]);

  const microRows = useMemo(() => {
    if (!displayTotals) return [];
    return micronutrientRowsForReport(displayTotals, referenceContext);
  }, [displayTotals, referenceContext]);

  const omegaRows = useMemo(() => {
    if (!displayTotals) return [];
    return buildOmegaOverviewRows(displayTotals.fattyAcids);
  }, [displayTotals]);

  const periodSummary = useMemo(() => {
    if (report.daysWithFood === 0) return "Ingen matvarer i matplanen ennå";
    if (viewMode === "average") {
      return `Snitt per dag · ${report.daysWithFood} dager med matvarer`;
    }
    const label = report.dayTotals.find((row) => row.dayId === selectedDayId)?.label ?? "Valgt dag";
    return `Planlagt inntak · ${label}`;
  }, [report, selectedDayId, viewMode]);

  const handlePrint = useCallback(() => {
    if (!displayTotals) return;
    const ok = openNutritionReportPrintWindow({
      memberName: displayName,
      periodSummary: `Matplan · ${periodSummary}`,
      totals: displayTotals,
      mealPlanTargets: plan.targets,
      microRows,
      referenceContext,
      dailyKcal:
        report.daysWithFood > 1
          ? report.dayTotals.map(({ label, totals }) => ({
              dateLabel: label,
              kcal: totals.kcal,
            }))
          : undefined,
    });
    if (!ok) {
      setPrintError("Kunne ikke åpne utskrift. Tillat popup-vinduer for Motus i nettleseren.");
      return;
    }
    setPrintError(null);
  }, [displayName, displayTotals, microRows, periodSummary, plan.targets, referenceContext, report.dayTotals]);

  if (!open) return null;

  return (
    <div className="motus-nutrition-report-backdrop" role="presentation" onClick={onClose}>
      <div
        className="motus-nutrition-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="motus-meal-plan-nutrition-report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="motus-nutrition-report-modal__head motus-nutrition-report-no-print">
          <div className="min-w-0">
            <h2 id="motus-meal-plan-nutrition-report-title" className="motus-nutrition-report-modal__title">
              Næringsoversikt
            </h2>
            <p className="motus-nutrition-report-modal__subtitle">{displayName} · matplan</p>
          </div>
          <button type="button" className="motus-nutrition-report-modal__close motus-pressable" onClick={onClose} aria-label="Lukk">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="motus-nutrition-report-modal__controls motus-nutrition-report-no-print">
          <p className="motus-nutrition-report-modal__control-label">Visning</p>
          <div className="motus-nutrition-report-modal__chips">
            {report.dayTotals.map((row) => (
              <button
                key={row.dayId}
                type="button"
                className={`motus-nutrition-report-modal__chip ${viewMode === "activeDay" && selectedDayId === row.dayId ? "is-active" : ""}`}
                onClick={() => {
                  setViewMode("activeDay");
                  setSelectedDayId(row.dayId);
                }}
              >
                {row.label}
              </button>
            ))}
            {report.daysWithFood > 1 ? (
              <button
                type="button"
                className={`motus-nutrition-report-modal__chip ${viewMode === "average" ? "is-active" : ""}`}
                onClick={() => setViewMode("average")}
              >
                Snitt per dag
              </button>
            ) : null}
          </div>
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
          {report.daysWithFood === 0 || !displayTotals ? (
            <p className="text-sm text-slate-600">Legg til matvarer i ukeplanen for å se næringsinnhold.</p>
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

              <h3 className="motus-nutrition-report-modal__subheading">Omega-fettsyrer</h3>
              <OmegaOverviewTable rows={omegaRows} />
              <p className="motus-nutrition-report-modal__footnote">
                Veiledende daglige referanser: omega-3 ca. {OMEGA3_DAILY_TARGET_G} g, EPA+DHA ca. {EPA_DHA_DAILY_TARGET_G} g.
                Forhold omega-6:omega-3 under 5:1 regnes ofte gunstig.
              </p>
            </section>
          )}

          {referenceWarning ? (
            <p className="motus-nutrition-report-modal__profile-warning" role="status">
              {referenceWarning}
            </p>
          ) : null}

          {report.daysWithFood > 1 && tab === "macro" ? (
            <details className="motus-nutrition-report-modal__daily-breakdown motus-nutrition-report-no-print">
              <summary>Dag-for-dag (kcal)</summary>
              <ul className="motus-nutrition-report-modal__daily-list">
                {report.dayTotals.map(({ dayId, label, totals }) => (
                  <li key={dayId}>
                    <span>{label}</span>
                    <strong>{Math.round(totals.kcal)} kcal</strong>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <footer className="motus-nutrition-report-modal__footer motus-nutrition-report-no-print">
          {printError ? <p className="w-full text-xs text-rose-700">{printError}</p> : null}
          <OutlineButton type="button" className="gap-1.5" onClick={handlePrint} disabled={report.daysWithFood === 0}>
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
