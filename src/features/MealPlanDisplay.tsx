import { computeDayMacros, computeMealMacros, formatMacroTotals, formatTargetsSummary } from "../app/mealPlanMacros";
import type { MealPlan, MealPlanDay } from "../app/mealPlanTypes";
import { Card } from "../app/ui";
import "../foodbank.css";

type MealPlanDisplayProps = {
  plan: MealPlan;
  readOnly?: boolean;
  activeDayId?: string;
  onActiveDayIdChange?: (dayId: string) => void;
};

export function MealPlanDisplay({ plan, readOnly = true, activeDayId, onActiveDayIdChange }: MealPlanDisplayProps) {
  const selectedDay =
    plan.days.find((day) => day.id === activeDayId) ?? plan.days[0] ?? null;
  const targetsLabel = formatTargetsSummary(plan.targets);

  return (
    <div className="motus-mealplan space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{plan.title}</h2>
        {plan.notes.trim() ? <p className="mt-1 text-sm text-slate-600">{plan.notes}</p> : null}
        {targetsLabel ? (
          <p className="mt-2 text-xs font-medium text-teal-800">Daglig mål: {targetsLabel}</p>
        ) : null}
      </div>

      <div className="motus-mealplan-day-tabs scrollbar-none flex gap-2 overflow-x-auto pb-1" role="tablist">
        {plan.days.map((day) => {
          const active = selectedDay?.id === day.id;
          const dayMacros = formatMacroTotals(computeDayMacros(day));
          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={readOnly && !onActiveDayIdChange}
              onClick={() => onActiveDayIdChange?.(day.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition ${
                active
                  ? "border-teal-300 bg-teal-50 text-teal-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold">{day.label}</div>
              <div className="mt-0.5 text-[10px] opacity-80">{dayMacros}</div>
            </button>
          );
        })}
      </div>

      {selectedDay ? <MealPlanDayPanel day={selectedDay} /> : null}
    </div>
  );
}

function MealPlanDayPanel({ day }: { day: MealPlanDay }) {
  return (
    <div className="space-y-3">
      {day.meals.map((meal) => {
        const mealMacros = formatMacroTotals(computeMealMacros(meal));
        return (
          <Card key={meal.id} className="p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold text-slate-900">{meal.name}</div>
              <div className="text-[11px] font-medium text-slate-500">{mealMacros}</div>
            </div>
            {meal.items.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Ingen matvarer lagt til.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {meal.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{item.foodName}</div>
                      <div className="text-xs text-slate-500">{item.grams} g{item.note ? ` · ${item.note}` : ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
