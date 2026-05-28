import { Check } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import type { MacroTotals } from "../../app/mealPlanMacros";
import { planMatchesTargets } from "../../app/mealPlanWeekPlanner";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { MacroProgressBar } from "./MacroProgressBar";
import { MacroProgressRing } from "./MacroProgressRing";

type TrainerMealPlanNutritionOverviewProps = {
  averageUsed: MacroTotals;
  targets?: MealPlanTargets;
};

export function TrainerMealPlanNutritionOverview({ averageUsed, targets }: TrainerMealPlanNutritionOverviewProps) {
  const targetKcal = targets?.kcal ?? 0;
  const targetProtein = targets?.protein ?? 0;
  const targetCarbs = targets?.carbs ?? 0;
  const targetFat = targets?.fat ?? 0;
  const onTrack = planMatchesTargets(averageUsed, targets);

  if (!targetKcal) {
    return (
      <p className="text-sm text-slate-600">
        Fyll inn daglige makromål i steg 1 for å se ernæringsoversikt og sammenligne med planen.
      </p>
    );
  }

  return (
    <div className="motus-pt-planner-nutrition">
      <div className="motus-pt-planner-nutrition__body">
        <MacroProgressRing
          label="Kalorier"
          current={averageUsed.kcal}
          target={targetKcal}
          unit="kcal"
          size="xl"
          hideLabel
        />
        <div className="motus-pt-planner-nutrition__bars">
          <MacroProgressBar label="Protein" current={averageUsed.protein} target={targetProtein} />
          <MacroProgressBar label="Karbohydrater" current={averageUsed.carbs} target={targetCarbs} />
          <MacroProgressBar label="Fett" current={averageUsed.fat} target={targetFat} />
        </div>
      </div>
      <p className={`motus-pt-planner-nutrition__status ${onTrack ? "is-ok" : ""}`}>
        {onTrack ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            Planen er i tråd med målene
          </>
        ) : (
          <>
            Gjennomsnitt: {formatMacro(averageUsed.kcal, 0)} kcal · mål {formatMacro(targetKcal, 0)} kcal
          </>
        )}
      </p>
    </div>
  );
}
