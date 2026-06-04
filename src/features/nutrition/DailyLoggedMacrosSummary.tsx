import { Droplets, Dumbbell, Wheat } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import type { MacroTotals } from "../../app/mealPlanMacros";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { DEFAULT_DAILY_KCAL_TARGET } from "../../app/nutritionReportDisplay";
import { MacroProgressRing } from "./MacroProgressRing";
import { WaterTotalSummary } from "./WaterTotalSummary";

export { DEFAULT_DAILY_KCAL_TARGET } from "../../app/nutritionReportDisplay";

type DailyLoggedMacrosSummaryProps = {
  macros: MacroTotals;
  targets?: MealPlanTargets | null;
  title?: string;
  totalWaterLiters?: number | null;
  waterTargetLiters?: number;
};

export function DailyLoggedMacrosSummary({
  macros,
  targets,
  title = "I dag totalt",
  totalWaterLiters = null,
  waterTargetLiters,
}: DailyLoggedMacrosSummaryProps) {
  const kcal = Math.round(macros.kcal);
  const protein = Math.round(macros.protein);
  const carbs = Math.round(macros.carbs);
  const fat = Math.round(macros.fat);
  const targetKcal = targets?.kcal && targets.kcal > 0 ? targets.kcal : DEFAULT_DAILY_KCAL_TARGET;
  const kcalRemaining = Math.max(0, Math.round(targetKcal - kcal));
  const kcalOver = Math.max(0, Math.round(kcal - targetKcal));
  const kcalSublabel =
    kcalOver > 0 ? `${formatMacro(kcalOver, 0)} over mål` : kcalRemaining > 0 ? `${formatMacro(kcalRemaining, 0)} igjen` : "Mål nådd";

  return (
    <section className="motus-log-meal-macros" aria-label={title}>
      <h3 className="motus-log-meal-macros__title">{title}</h3>
      <div className="motus-log-meal-macros__body">
        <div className="motus-log-meal-macros__ring" aria-label={`${kcal} av ${targetKcal} kalorier, ${kcalSublabel}`}>
          <MacroProgressRing
            label="Kalorier"
            current={kcal}
            target={targetKcal}
            unit="kcal"
            size="lg"
            hideLabel
            sublabel={kcalSublabel}
          />
        </div>
        <ul className="motus-log-meal-macros__grid">
          <li className="motus-log-meal-macros__stat">
            <Wheat className="motus-log-meal-macros__stat-icon" aria-hidden />
            <span className="motus-log-meal-macros__stat-label">Karbo</span>
            <span className="motus-log-meal-macros__stat-value">{formatMacro(carbs, 0)} g</span>
          </li>
          <li className="motus-log-meal-macros__stat">
            <Droplets className="motus-log-meal-macros__stat-icon" aria-hidden />
            <span className="motus-log-meal-macros__stat-label">Fett</span>
            <span className="motus-log-meal-macros__stat-value">{formatMacro(fat, 0)} g</span>
          </li>
          <li className="motus-log-meal-macros__stat">
            <Dumbbell className="motus-log-meal-macros__stat-icon" aria-hidden />
            <span className="motus-log-meal-macros__stat-label">Protein</span>
            <span className="motus-log-meal-macros__stat-value">{formatMacro(protein, 0)} g</span>
          </li>
        </ul>
      </div>
      {totalWaterLiters != null ? (
        <WaterTotalSummary totalLiters={totalWaterLiters} targetLiters={waterTargetLiters} />
      ) : null}
    </section>
  );
}
