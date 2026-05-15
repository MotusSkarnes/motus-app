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

const PLAN_WEEK_HEADER_GRADIENT = `linear-gradient(125deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 95%)`;

const WEEKDAY_VISUAL: Record<WeekdayPlanKey, { border: string; badge: string; softBg: string }> = {
  monday: {
    border: "border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-400/35",
    softBg: "from-emerald-50/70 to-white",
  },
  tuesday: {
    border: "border-l-sky-500",
    badge: "bg-sky-500/15 text-sky-950 ring-1 ring-sky-400/35",
    softBg: "from-sky-50/70 to-white",
  },
  wednesday: {
    border: "border-l-violet-500",
    badge: "bg-violet-500/15 text-violet-900 ring-1 ring-violet-400/35",
    softBg: "from-violet-50/70 to-white",
  },
  thursday: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/18 text-amber-950 ring-1 ring-amber-400/40",
    softBg: "from-amber-50/70 to-white",
  },
  friday: {
    border: "border-l-rose-500",
    badge: "bg-rose-500/15 text-rose-900 ring-1 ring-rose-400/35",
    softBg: "from-rose-50/70 to-white",
  },
  saturday: {
    border: "border-l-cyan-500",
    badge: "bg-cyan-500/15 text-cyan-950 ring-1 ring-cyan-400/35",
    softBg: "from-cyan-50/70 to-white",
  },
  sunday: {
    border: "border-l-indigo-500",
    badge: "bg-indigo-500/15 text-indigo-900 ring-1 ring-indigo-400/35",
    softBg: "from-indigo-50/70 to-white",
  },
};

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
      className="mt-3 overflow-hidden rounded-2xl border shadow-sm ring-1 ring-teal-900/5"
      style={{
        borderColor: "rgba(48,227,190,0.22)",
        background: `linear-gradient(165deg, ${MOTUS.paleMint} 0%, #ffffff 38%, #f8fafc 100%)`,
      }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4"
        style={{
          borderColor: "rgba(48,227,190,0.18)",
          background: `linear-gradient(90deg, rgba(48,227,190,0.12) 0%, rgba(217,18,120,0.06) 100%)`,
        }}
      >
        <div className="inline-flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black text-white shadow-sm"
            style={{ background: PLAN_WEEK_HEADER_GRADIENT }}
            aria-hidden
          >
            {week.weekNumber}
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-700">Uke {week.weekNumber}</div>
            <div className="text-[10px] font-medium text-slate-500">Din ukesplan · trykk pil for å bytte dag</div>
          </div>
        </div>
        {weekSwaps.length > 0 ? (
          <button
            type="button"
            onClick={() => onResetSwaps(plan.id, week.weekNumber)}
            className="text-[11px] font-semibold text-teal-800 underline-offset-2 hover:text-teal-950 hover:underline"
          >
            Tilbakestill bytter
          </button>
        ) : null}
      </div>
      <div className="px-3 py-2.5 sm:px-4">
        <p className="text-[11px] leading-snug text-slate-600">
          <span className="font-semibold text-teal-900/90">Tips:</span> Start program, logg gruppetime eller kryss av når du er ferdig. Kalenderen oppdateres når du logger økter.
        </p>
      </div>
      {actionStatus ? (
        <div className="mx-3 mb-2 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-900 sm:mx-4">{actionStatus}</div>
      ) : null}
      <div className="grid gap-2.5 px-3 pb-3 sm:grid-cols-2 sm:gap-3 sm:px-4 sm:pb-4">
        {WEEKDAY_PLAN_ORDER.map((dayKey) => {
          const dayLabel = WEEKDAY_PLAN_LABELS[dayKey];
          const vis = WEEKDAY_VISUAL[dayKey];
          const entry = effectiveDays[dayKey]?.trim() ?? "";
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);
          const plannedDate = resolveEntryDate(plan, week.weekNumber, dayKey);
          const entryAction = entry ? resolvePeriodPlanEntryAction(entry, memberPrograms) : { kind: "none" as const };
          const completed = isEntryCompleted(plan.id, week.weekNumber, dayKey);
          const isSwapSource = swapFromDay === dayKey;

          return (
            <div
              key={`${week.id}-${dayKey}`}
              className={`relative overflow-hidden rounded-xl border bg-gradient-to-br shadow-sm transition ${
                isSwapSource
                  ? "border-teal-400 bg-teal-50/90 ring-2 ring-teal-300/80"
                  : `border-slate-200/90 border-l-[5px] ${vis.border} ${vis.softBg}`
              }`}
            >
              <div className="flex items-start justify-between gap-2 p-2.5 sm:p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${vis.badge}`}>
                      {dayLabel}
                    </span>
                    {plannedDate ? (
                      <span className="text-[10px] font-medium text-slate-500">{plannedDate}</span>
                    ) : null}
                  </div>
                  {entry ? (
                    <p className={`mt-2 text-sm leading-snug ${completed ? "text-slate-400 line-through decoration-slate-300" : "font-medium text-slate-800"}`}>
                      {entry}
                    </p>
                  ) : (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                      <CalendarOff className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                      Ingen plan
                    </p>
                  )}
                  {sourceDay ? (
                    <span className="mt-1.5 inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200/60">
                      Plan fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSwapFromDay((prev) => (prev === dayKey ? null : dayKey))}
                  className={`shrink-0 rounded-lg border p-1.5 transition ${
                    isSwapSource
                      ? "border-teal-500 bg-teal-100 text-teal-900 shadow-sm"
                      : "border-slate-200/90 bg-white/90 text-slate-500 shadow-sm hover:border-teal-300 hover:bg-teal-50/80 hover:text-teal-800"
                  }`}
                  aria-label={isSwapSource ? `Avbryt bytte for ${dayLabel}` : `Bytt ${dayLabel} med annen dag`}
                  aria-expanded={isSwapSource}
                  title={isSwapSource ? "Avbryt" : "Bytt dag"}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {isSwapSource ? (
                <div className="mx-2 mb-2 rounded-lg border border-teal-200/90 bg-white/95 p-2 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-teal-800">Bytt med</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onSwapDays(plan.id, week.weekNumber, dayKey, key);
                          setSwapFromDay(null);
                        }}
                        className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900"
                      >
                        {WEEKDAY_PLAN_LABELS[key]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSwapFromDay(null)}
                    className="mt-2 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    Avbryt
                  </button>
                </div>
              ) : null}
              {entry ? (
                <div className="flex flex-col gap-2 border-t border-slate-200/60 bg-white/50 px-2.5 py-2.5 sm:px-3">
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
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/80 px-1 py-0.5">
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

