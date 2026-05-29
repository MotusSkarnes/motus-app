import { Droplets, Dumbbell, Flame, Wheat } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import type { MacroTotals } from "../../app/mealPlanMacros";

type DailyLoggedMacrosSummaryProps = {
  macros: MacroTotals;
  title?: string;
};

export function DailyLoggedMacrosSummary({ macros, title = "I dag totalt" }: DailyLoggedMacrosSummaryProps) {
  const kcal = Math.round(macros.kcal);
  const protein = Math.round(macros.protein);
  const carbs = Math.round(macros.carbs);
  const fat = Math.round(macros.fat);

  return (
    <section className="motus-log-meal-macros" aria-label={title}>
      <h3 className="motus-log-meal-macros__title">{title}</h3>
      <div className="motus-log-meal-macros__body">
        <div className="motus-log-meal-macros__kcal" aria-label={`${kcal} kalorier`}>
          <span className="motus-log-meal-macros__kcal-icon" aria-hidden>
            <Flame className="h-5 w-5" />
          </span>
          <div className="motus-log-meal-macros__kcal-text">
            <span className="motus-log-meal-macros__kcal-value">{formatMacro(kcal, 0)}</span>
            <span className="motus-log-meal-macros__kcal-unit">kcal</span>
          </div>
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
    </section>
  );
}
