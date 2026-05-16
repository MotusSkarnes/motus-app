import { useEffect, useState } from "react";
import { ArrowLeftRight, CalendarOff, Play, Users } from "lucide-react";
import { MOTUS } from "../app/data";
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

const MOTUS_GRADIENT = `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`;
const MOTUS_SOFT_BACKGROUND = `linear-gradient(160deg, ${MOTUS.paleMint} 0%, #ffffff 42%, rgba(217,18,120,0.045) 100%)`;

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
    <div
      className="mt-3 overflow-hidden rounded-xl border shadow-sm"
      style={{ borderColor: "rgba(48,227,190,0.20)", background: MOTUS_SOFT_BACKGROUND }}
    >
      <div className="h-1.5" style={{ background: MOTUS_GRADIENT }} aria-hidden />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white/75 px-3 py-3 backdrop-blur sm:px-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm" style={{ background: MOTUS_GRADIENT }}>
            {week.weekNumber}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-950">Uke {week.weekNumber}</div>
            <div className="mt-0.5 text-xs text-slate-500">Planlagte økter denne uken</div>
          </div>
        </div>
        {weekSwaps.length > 0 ? (
          <button
            type="button"
            onClick={() => onResetSwaps(plan.id, week.weekNumber)}
            className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-900 transition hover:bg-teal-50"
          >
            Tilbakestill bytter
          </button>
        ) : null}
      </div>

      {actionStatus ? (
        <div className="mx-3 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 sm:mx-4">{actionStatus}</div>
      ) : null}

      <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4">
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
              className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                isSwapSource ? "border-teal-400 ring-2 ring-teal-200" : "border-slate-200/90 hover:border-teal-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-900 ring-1 ring-teal-100">
                      {dayLabel}
                    </span>
                    {plannedDate ? <span className="text-xs text-slate-400">{plannedDate}</span> : null}
                  </div>
                  {entry ? (
                    <p className={`mt-2 text-sm leading-snug ${completed ? "text-slate-400 line-through decoration-slate-300" : "font-medium text-slate-900"}`}>
                      {entry}
                    </p>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <CalendarOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Ingen plan
                    </p>
                  )}
                  {sourceDay ? <div className="mt-1.5 text-[11px] font-medium text-slate-500">Flyttet fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSwapFromDay((prev) => (prev === dayKey ? null : dayKey))}
                  className={`shrink-0 rounded-lg border p-1.5 transition ${
                    isSwapSource
                      ? "border-transparent text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"
                  }`}
                  style={isSwapSource ? { background: MOTUS_GRADIENT } : undefined}
                  aria-label={isSwapSource ? `Avbryt bytte for ${dayLabel}` : `Bytt ${dayLabel} med annen dag`}
                  aria-expanded={isSwapSource}
                  title={isSwapSource ? "Avbryt" : "Bytt dag"}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              {isSwapSource ? (
                <div className="mx-3 mb-3 rounded-lg border border-teal-200 bg-teal-50/70 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-900">Bytt med</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onSwapDays(plan.id, week.weekNumber, dayKey, key);
                          setSwapFromDay(null);
                        }}
                        className="rounded-md border border-teal-100 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-950"
                      >
                        {WEEKDAY_PLAN_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {entry ? (
                <div className="flex flex-col gap-2 border-t border-slate-100 bg-white/70 px-3 py-2.5">
                  {entryAction.kind === "start-program" ? (
                    <GradientButton
                      type="button"
                      onClick={() => onStartProgram(entryAction.program.id)}
                      className="!min-h-9 w-full !px-3 !py-2 !text-xs shadow-sm"
                    >
                      <Play className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
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
                      className="!min-h-9 w-full !px-3 !py-2 !text-xs"
                    >
                      <Users className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
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
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">Gjennomført</span>
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
