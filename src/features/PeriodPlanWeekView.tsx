import {
  applyPeriodPlanSwaps,
  getSwapsForWeek,
  periodPlanSourceDay,
  WEEKDAY_PLAN_LABELS,
  WEEKDAY_PLAN_ORDER,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import type { PeriodSchedulePlan, WeekdayPlanKey, WeeklySchedulePlan } from "../app/types";

type PeriodPlanWeekViewProps = {
  plan: PeriodSchedulePlan;
  week: WeeklySchedulePlan;
  swapsByPlan: PeriodPlanSwapsByPlan;
  actionStatus: string | null;
  isEntryCompleted: (planId: string, weekNumber: number, day: WeekdayPlanKey) => boolean;
  onToggleCompleted: (input: {
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
    entry: string;
    plannedDate: string | null;
  }) => void;
  onSwapDays: (planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) => void;
  onResetSwaps: (planId: string, weekNumber: number) => void;
  resolveEntryDate: (plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey) => string | null;
};

export function PeriodPlanWeekView({
  plan,
  week,
  swapsByPlan,
  actionStatus,
  isEntryCompleted,
  onToggleCompleted,
  onSwapDays,
  onResetSwaps,
  resolveEntryDate,
}: PeriodPlanWeekViewProps) {
  const weekSwaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
  const effectiveDays = applyPeriodPlanSwaps(week.days, weekSwaps);

  return (
    <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uke {week.weekNumber}</div>
        {weekSwaps.length > 0 ? (
          <button
            type="button"
            onClick={() => onResetSwaps(plan.id, week.weekNumber)}
            className="text-[11px] font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Tilbakestill bytter
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        Merk av økter som fullført. Kan ikke trene på planlagt dag? Bytt med en annen dag i uken.
      </div>
      {actionStatus ? <div className="mt-2 text-xs text-emerald-700">{actionStatus}</div> : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {WEEKDAY_PLAN_ORDER.map((dayKey) => {
          const dayLabel = WEEKDAY_PLAN_LABELS[dayKey];
          const entry = effectiveDays[dayKey]?.trim() ?? "";
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);

          return (
            <div
              key={`${week.id}-${dayKey}`}
              className="rounded-lg border bg-slate-50 px-2 py-1.5 text-xs"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <div>
                <span className="font-semibold text-slate-700">{dayLabel}:</span>{" "}
                <span
                  className={
                    isEntryCompleted(plan.id, week.weekNumber, dayKey) ? "text-slate-400 line-through" : "text-slate-600"
                  }
                >
                  {entry || "Ingen plan"}
                </span>
                {sourceDay ? (
                  <span className="mt-0.5 block text-[10px] font-medium text-teal-700">
                    Plan fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}
                  </span>
                ) : null}
              </div>
              <div className="mt-2">
                <select
                  defaultValue=""
                  onChange={(event) => {
                    const otherDay = event.target.value as WeekdayPlanKey;
                    event.target.value = "";
                    if (!otherDay || otherDay === dayKey) return;
                    onSwapDays(plan.id, week.weekNumber, dayKey, otherDay);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                  aria-label={`Bytt ${dayLabel} med annen dag`}
                >
                  <option value="">Bytt med …</option>
                  {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                    <option key={key} value={key}>
                      {WEEKDAY_PLAN_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              {entry ? (
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isEntryCompleted(plan.id, week.weekNumber, dayKey)}
                    onChange={() =>
                      onToggleCompleted({
                        planId: plan.id,
                        weekNumber: week.weekNumber,
                        day: dayKey,
                        entry: effectiveDays[dayKey],
                        plannedDate: resolveEntryDate(plan, week.weekNumber, dayKey),
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-medium text-slate-600">Gjennomført</span>
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
