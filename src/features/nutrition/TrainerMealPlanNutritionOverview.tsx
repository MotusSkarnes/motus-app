import { Check } from "lucide-react";
import { formatMacro } from "../../app/foodBankTypes";
import type { MacroTotals } from "../../app/mealPlanMacros";
import { planMatchesTargets } from "../../app/mealPlanWeekPlanner";
import type { MealPlanTargets } from "../../app/mealPlanTypes";
import { MacroProgressBar } from "./MacroProgressBar";
import { MacroProgressRing } from "./MacroProgressRing";
import { formatMicronutrientValue, FOOD_MICRONUTRIENT_FIELDS } from "../../app/foodBankMicronutrients";
import type { FoodMicronutrientKey } from "../../app/foodBankMicronutrients";
export { MICRONUTRIENT_DAILY_TARGETS } from "../../app/healthDirectorateNutritionReferences";

export type MicronutrientOverviewRow = {
  key: FoodMicronutrientKey;
  label: string;
  unit: string;
  value: number;
  target: number;
  coveragePct: number;
};

type TrainerMealPlanNutritionOverviewProps = {
  averageUsed: MacroTotals;
  targets?: MealPlanTargets;
  micronutrients?: MicronutrientOverviewRow[];
};

export function TrainerMealPlanNutritionOverview({ averageUsed, targets, micronutrients = [] }: TrainerMealPlanNutritionOverviewProps) {
  const targetKcal = targets?.kcal ?? 0;
  const targetProtein = targets?.protein ?? 0;
  const targetCarbs = targets?.carbs ?? 0;
  const targetFat = targets?.fat ?? 0;
  const onTrack = planMatchesTargets(averageUsed, targets);
  const hasMicronutrients = micronutrients.some((row) => row.value > 0);

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
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Mikronæringsstoffer (snitt per dag)</p>
        {!hasMicronutrients ? (
          <p className="mt-2 text-xs text-slate-500">Ingen mikronæringsdata funnet i planens matvarer ennå.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {micronutrients.map((row) => (
              <div key={row.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
                <span className="text-slate-700">{row.label}</span>
                <span className="text-slate-900">
                  {formatMicronutrientValue(row.value, FOOD_MICRONUTRIENT_FIELDS.find((f) => f.key === row.key)?.decimals ?? 1)} {row.unit}
                </span>
                <span className="text-slate-500">
                  av {formatMicronutrientValue(row.target, FOOD_MICRONUTRIENT_FIELDS.find((f) => f.key === row.key)?.decimals ?? 1)} {row.unit} (
                  {formatMacro(row.coveragePct, 0)}%)
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Anbefalte dagsmengder er generelle voksenreferanser.</p>
      </div>
    </div>
  );
}
