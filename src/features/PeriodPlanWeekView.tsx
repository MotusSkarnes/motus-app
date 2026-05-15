import { useEffect, useState } from "react";
import { ArrowLeftRight, Play, Users } from "lucide-react";
import { resolvePeriodPlanEntryAction } from "../app/periodPlanEntryActions";
import {
  applyPeriodPlanSwaps,
  getSwapsForWeek,
  periodPlanSourceDay,
  WEEKDAY_PLAN_LABELS,
  WEEKDAY_PLAN_ORDER,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import { GradientButton, OutlineButton } from "../app/ui";
import type { PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WeeklySchedulePlan } from "../app/types";

type PeriodPlanWeekViewProps = {
  plan: PeriodSchedulePlan;
  week: WeeklySchedulePlan;
  swapsByPlan: PeriodPlanSwapsByPlan;
  memberPrograms: TrainingProgram[];
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
  onStartProgram: (programId: string) => void;
  onLogGroup: (input: {
    entry: string;
    plannedDate: string | null;
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
  }) => void;
  resolveEntryDate: (plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey) => string | null;
};

export function PeriodPlanWeekView({
  plan,
  week,
  swapsByPlan,
  memberPrograms,
  actionStatus,
  isEntryCompleted,
  onToggleCompleted,
  onSwapDays,
  onResetSwaps,
  onStartProgram,
  onLogGroup,
  resolveEntryDate,
}: PeriodPlanWeekViewProps) {
  const weekSwaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
  const effectiveDays = applyPeriodPlanSwaps(week.days, weekSwaps);
  const [swapFromDay, setSwapFromDay] = useState<WeekdayPlanKey | null>(null);

  useEffect(() => {
    setSwapFromDay(null);
  }, [plan.id, week.weekNumber]);

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
        Start program eller logg gruppetime direkte. Bytt dag om planen ikke passer — kalenderen oppdateres når du logger.
      </div>
      {actionStatus ? <div className="mt-2 text-xs text-emerald-700">{actionStatus}</div> : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {WEEKDAY_PLAN_ORDER.map((dayKey) => {
          const dayLabel = WEEKDAY_PLAN_LABELS[dayKey];
          const entry = effectiveDays[dayKey]?.trim() ?? "";
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);
          const plannedDate = resolveEntryDate(plan, week.weekNumber, dayKey);
          const entryAction = entry ? resolvePeriodPlanEntryAction(entry, memberPrograms) : { kind: "none" as const };
          const completed = isEntryCompleted(plan.id, week.weekNumber, dayKey);
          const isSwapSource = swapFromDay === dayKey;

          return (
            <div
              key={`${week.id}-${dayKey}`}
              className={`rounded-lg border px-2 py-1.5 text-xs ${
                isSwapSource ? "border-teal-300 bg-teal-50/80 ring-1 ring-teal-200" : "bg-slate-50"
              }`}
              style={{ borderColor: isSwapSource ? undefined : "rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-700">{dayLabel}:</span>{" "}
                  <span className={completed ? "text-slate-400 line-through" : "text-slate-600"}>{entry || "Ingen plan"}</span>
                  {sourceDay ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-teal-700">
                      Plan fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSwapFromDay((prev) => (prev === dayKey ? null : dayKey))}
                  className={`shrink-0 rounded-md border p-1.5 transition ${
                    isSwapSource
                      ? "border-teal-400 bg-teal-100 text-teal-800"
                      : "border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                  }`}
                  aria-label={isSwapSource ? `Avbryt bytte for ${dayLabel}` : `Bytt ${dayLabel} med annen dag`}
                  aria-expanded={isSwapSource}
                  title={isSwapSource ? "Avbryt" : "Bytt dag"}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {isSwapSource ? (
                <div className="mt-2 rounded-md border border-teal-200/80 bg-white p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bytt med</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onSwapDays(plan.id, week.weekNumber, dayKey, key);
                          setSwapFromDay(null);
                        }}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800"
                      >
                        {WEEKDAY_PLAN_LABELS[key]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSwapFromDay(null)}
                    className="mt-2 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                  >
                    Avbryt
                  </button>
                </div>
              ) : null}
              {entry ? (
                <div className="mt-2 flex flex-col gap-2">
                  {entryAction.kind === "start-program" ? (
                    <GradientButton
                      type="button"
                      onClick={() => onStartProgram(entryAction.program.id)}
                      className="!min-h-8 w-full !px-2 !py-1.5 !text-[11px]"
                    >
                      <Play className="mr-1 inline h-3 w-3" aria-hidden />
                      Start økt
                    </GradientButton>
                  ) : null}
                  {entryAction.kind === "log-group" ? (
                    <OutlineButton
                      type="button"
                      onClick={() =>
                        onLogGroup({
                          entry,
                          plannedDate,
                          planId: plan.id,
                          weekNumber: week.weekNumber,
                          day: dayKey,
                        })
                      }
                      className="!min-h-8 w-full !px-2 !py-1.5 !text-[11px]"
                    >
                      <Users className="mr-1 inline h-3 w-3" aria-hidden />
                      Logg gruppetime
                    </OutlineButton>
                  ) : null}
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={() =>
                        onToggleCompleted({
                          planId: plan.id,
                          weekNumber: week.weekNumber,
                          day: dayKey,
                          entry: effectiveDays[dayKey],
                          plannedDate,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-medium text-slate-600">Gjennomført</span>
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

