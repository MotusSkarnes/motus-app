import { useEffect, useState } from "react";
import { Check, ChevronRight, Coffee, Play, RotateCcw, X } from "lucide-react";
import {
  findProgramForPeriodPlanEntry,
  getPeriodPlanDayListLabel,
  isPeriodPlanEntryDateInFuture,
  isRestPeriodPlanEntry,
  resolvePeriodPlanEntryAction,
} from "../app/periodPlanEntryActions";
import {
  applyPeriodPlanSwaps,
  getSwapsForWeek,
  periodPlanSourceDay,
  WEEKDAY_PLAN_LABELS,
  WEEKDAY_PLAN_ORDER,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import { GradientButton, OutlineButton } from "../app/ui";
import type { Exercise, PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WeeklySchedulePlan } from "../app/types";
import { TrainingProgramPreviewModal } from "./TrainingProgramPreviewModal";

const WEEKDAY_SHORT: Record<WeekdayPlanKey, string> = {
  monday: "MAN",
  tuesday: "TIR",
  wednesday: "ONS",
  thursday: "TOR",
  friday: "FRE",
  saturday: "LØR",
  sunday: "SØN",
};

type DayStatus = "completed" | "rest" | "planned" | "empty";

function resolveDayStatus(entry: string, completed: boolean): DayStatus {
  if (!entry.trim()) return "empty";
  if (isRestPeriodPlanEntry(entry)) return "rest";
  if (completed) return "completed";
  return "planned";
}

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
  onMoveDay: (planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) => void;
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
  exerciseLibrary?: Exercise[];
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
  onMoveDay,
  onResetSwaps,
  onStartProgram,
  onLogGroup,
  resolveEntryDate,
  exerciseLibrary = [],
}: PeriodPlanWeekViewProps) {
  const weekSwaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
  const effectiveDays = applyPeriodPlanSwaps(week.days, weekSwaps);
  const [swapFromDay, setSwapFromDay] = useState<WeekdayPlanKey | null>(null);
  const [previewProgram, setPreviewProgram] = useState<TrainingProgram | null>(null);
  const [previewCanStart, setPreviewCanStart] = useState(false);
  const [pendingOverwriteMove, setPendingOverwriteMove] = useState<{
    dayA: WeekdayPlanKey;
    dayB: WeekdayPlanKey;
    targetEntry: string;
  } | null>(null);

  useEffect(() => {
    setSwapFromDay(null);
    setPendingOverwriteMove(null);
    setPreviewProgram(null);
    setPreviewCanStart(false);
  }, [plan.id, week.weekNumber]);

  function openProgramPreview(program: TrainingProgram, canStart: boolean) {
    setPreviewProgram(program);
    setPreviewCanStart(canStart);
  }

  function closeProgramPreview() {
    setPreviewProgram(null);
    setPreviewCanStart(false);
  }

  function handleSwapButtonClick(dayKey: WeekdayPlanKey) {
    if (swapFromDay && swapFromDay !== dayKey) {
      onSwapDays(plan.id, week.weekNumber, swapFromDay, dayKey);
      setSwapFromDay(null);
      return;
    }
    setSwapFromDay((prev) => (prev === dayKey ? null : dayKey));
  }

  function handleMoveDayClick(dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    const targetEntry = effectiveDays[dayB]?.trim() ?? "";
    if (targetEntry) {
      setPendingOverwriteMove({ dayA, dayB, targetEntry });
      return;
    }
    onMoveDay(plan.id, week.weekNumber, dayA, dayB);
    setSwapFromDay(null);
  }

  function confirmOverwriteMove() {
    if (!pendingOverwriteMove) return;
    onMoveDay(plan.id, week.weekNumber, pendingOverwriteMove.dayA, pendingOverwriteMove.dayB);
    setPendingOverwriteMove(null);
    setSwapFromDay(null);
  }

  return (
    <section className="motus-period-plan-week" aria-labelledby="period-plan-week-heading">
      <div className="motus-period-plan-week-header">
        <div className="flex min-w-0 items-start gap-3">
          <span className="motus-period-plan-week-badge" aria-hidden>
            {week.weekNumber}
          </span>
          <div className="min-w-0">
            <h3 id="period-plan-week-heading" className="text-base font-bold tracking-tight text-slate-950">
              Uke {week.weekNumber}
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">Planlagte økter denne uken</p>
          </div>
        </div>
        {weekSwaps.length > 0 ? (
          <button type="button" onClick={() => onResetSwaps(plan.id, week.weekNumber)} className="motus-period-plan-reset-swaps">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Tilbakestill bytter
          </button>
        ) : null}
      </div>

      {actionStatus ? (
        <div className="motus-period-plan-action-status mx-4 mt-3 sm:mx-5">{actionStatus}</div>
      ) : null}

      <ol className="motus-period-plan-timeline">
        {WEEKDAY_PLAN_ORDER.map((dayKey, index) => {
          const dayLabel = WEEKDAY_PLAN_LABELS[dayKey];
          const entry = effectiveDays[dayKey]?.trim() ?? "";
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);
          const plannedDate = resolveEntryDate(plan, week.weekNumber, dayKey);
          const entryAction = entry ? resolvePeriodPlanEntryAction(entry, memberPrograms) : { kind: "none" as const };
          const previewProgramForEntry = entry ? findProgramForPeriodPlanEntry(entry, memberPrograms) : null;
          const listLabel = getPeriodPlanDayListLabel(entry, entryAction);
          const completed = isEntryCompleted(plan.id, week.weekNumber, dayKey);
          const status = resolveDayStatus(entry, completed);
          const isFutureDate = isPeriodPlanEntryDateInFuture(plannedDate);
          const canStartProgram =
            !completed && entryAction.kind === "start-program" && !isFutureDate;
          const canLogGroup = !completed && entryAction.kind === "log-group" && !isFutureDate;
          const canMarkCompletedManually =
            !completed && entryAction.kind !== "start-program" && entryAction.kind !== "log-group";
          const isSwapSource = swapFromDay === dayKey;
          const canOpenPreview = Boolean(previewProgramForEntry);
          const canStartFromPreview =
            canOpenPreview && !completed && entryAction.kind === "start-program" && !isFutureDate;
          const isLast = index === WEEKDAY_PLAN_ORDER.length - 1;
          const dateShort = plannedDate?.split(".")?.slice(0, 2).join(".") ?? null;

          return (
            <li
              key={`${week.id}-${dayKey}`}
              className={`motus-period-plan-day motus-period-plan-day--${status}${isSwapSource ? " motus-period-plan-day--swap-source" : ""}`}
            >
              <div className="motus-period-plan-day-rail" aria-hidden>
                <span className={`motus-period-plan-day-node motus-period-plan-day-node--${status}`}>
                  {status === "completed" ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : status === "rest" ? (
                    <Coffee className="h-3 w-3" strokeWidth={2.25} />
                  ) : null}
                </span>
                {!isLast ? <span className="motus-period-plan-day-line" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={`motus-period-plan-day-card motus-period-plan-day-card--${status}${isSwapSource ? " motus-period-plan-day-card--swap-source" : ""}`}
                >
                  <button
                    type="button"
                    disabled={!canOpenPreview}
                    onClick={() => {
                      if (previewProgramForEntry) {
                        openProgramPreview(previewProgramForEntry, canStartFromPreview);
                      }
                    }}
                    className={`motus-period-plan-day-main ${canOpenPreview ? "motus-period-plan-day-main--clickable" : ""}`}
                    aria-label={canOpenPreview ? `Se økt for ${dayLabel}` : undefined}
                  >
                    <p className="motus-period-plan-day-title">{listLabel}</p>
                    <div className="motus-period-plan-day-meta">
                      <span className="motus-period-plan-day-date">
                        {WEEKDAY_SHORT[dayKey]}
                        {dateShort ? ` ${dateShort}` : ""}
                      </span>
                      {completed ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--completed">Fullført</span>
                      ) : status === "rest" ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--rest">Hviledag</span>
                      ) : entry ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--planned">Planlagt</span>
                      ) : null}
                    </div>
                    {status === "rest" ? (
                      <p className="motus-period-plan-day-sub">Restitusjon er også trening</p>
                    ) : sourceDay ? (
                      <p className="motus-period-plan-day-sub">Flyttet fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}</p>
                    ) : null}
                    {canOpenPreview ? <ChevronRight className="motus-period-plan-day-chevron" aria-hidden /> : null}
                  </button>

                  {entry && status !== "rest" ? (
                    <div className="motus-period-plan-day-footer">
                      {completed ? (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCompleted({
                              planId: plan.id,
                              weekNumber: week.weekNumber,
                              day: dayKey,
                              entry: effectiveDays[dayKey],
                              plannedDate,
                            })
                          }
                          className="motus-period-plan-day-primary motus-period-plan-day-primary--done"
                          aria-label={`Angre fullført for ${dayLabel}`}
                        >
                          <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />
                          Angre fullført
                        </button>
                      ) : canStartProgram ? (
                        <button
                          type="button"
                          onClick={() => onStartProgram(entryAction.program.id)}
                          className="motus-period-plan-day-primary"
                          aria-label={`Start økt for ${dayLabel}`}
                        >
                          <Play className="h-4 w-4 shrink-0" aria-hidden />
                          Start økt
                        </button>
                      ) : canLogGroup ? (
                        <button
                          type="button"
                          onClick={() =>
                            onLogGroup({
                              entry: effectiveDays[dayKey],
                              plannedDate,
                              planId: plan.id,
                              weekNumber: week.weekNumber,
                              day: dayKey,
                            })
                          }
                          className="motus-period-plan-day-primary"
                          aria-label={`Logg gruppetime for ${dayLabel}`}
                        >
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                          Logg gruppetime
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canMarkCompletedManually || isFutureDate}
                          onClick={() => {
                            if (!canMarkCompletedManually || isFutureDate) return;
                            onToggleCompleted({
                              planId: plan.id,
                              weekNumber: week.weekNumber,
                              day: dayKey,
                              entry: effectiveDays[dayKey],
                              plannedDate,
                            });
                          }}
                          className="motus-period-plan-day-primary"
                          aria-label={
                            isFutureDate
                              ? `${dayLabel} kan markeres fra og med planlagt dato`
                              : `Marker ${dayLabel} som fullført`
                          }
                        >
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                          Marker fullført
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSwapButtonClick(dayKey)}
                        className={`motus-period-plan-day-swap-link ${isSwapSource ? "motus-period-plan-day-swap-link--active" : ""}`}
                        aria-expanded={isSwapSource}
                      >
                        {isSwapSource ? "Avbryt bytte" : "Bytt dag"}
                      </button>
                    </div>
                  ) : null}
                </div>

                {isSwapSource ? (
                  <div className="motus-period-plan-swap-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Velg dag</div>
                    <div className="mt-2 grid gap-1.5">
                      {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                        <div key={key} className="motus-period-plan-swap-row">
                          <span className="min-w-0 text-[11px] font-semibold text-slate-700">{WEEKDAY_PLAN_LABELS[key]}</span>
                          <button
                            type="button"
                            onClick={() => {
                              onSwapDays(plan.id, week.weekNumber, dayKey, key);
                              setSwapFromDay(null);
                            }}
                            className="motus-period-plan-swap-btn"
                          >
                            Bytt
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDayClick(dayKey, key)}
                            className="motus-period-plan-swap-btn motus-period-plan-swap-btn--move"
                          >
                            Flytt hit
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

              </div>
            </li>
          );
        })}
      </ol>

      <TrainingProgramPreviewModal
        program={previewProgram}
        open={previewProgram !== null}
        onClose={closeProgramPreview}
        exerciseLibrary={exerciseLibrary}
        primaryAction={
          previewCanStart && previewProgram
            ? {
                label: "Start økt",
                onClick: () => {
                  onStartProgram(previewProgram.id);
                  closeProgramPreview();
                },
              }
            : undefined
        }
      />

      {pendingOverwriteMove ? (
        <div
          className="fixed inset-0 z-[10050] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="period-plan-overwrite-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="period-plan-overwrite-title" className="text-base font-bold text-slate-950">
                  Denne dagen har allerede en time
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Hvis du flytter hit, blir timen som ligger på {WEEKDAY_PLAN_LABELS[pendingOverwriteMove.dayB].toLowerCase()} slettet.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingOverwriteMove(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">Time som blir slettet</div>
              <div className="mt-1">{pendingOverwriteMove.targetEntry}</div>
            </div>
            <div className="mt-4 grid gap-2">
              <GradientButton type="button" className="w-full" onClick={confirmOverwriteMove}>
                Flytt likevel
              </GradientButton>
              <OutlineButton type="button" className="w-full" onClick={() => setPendingOverwriteMove(null)}>
                Gå tilbake
              </OutlineButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
