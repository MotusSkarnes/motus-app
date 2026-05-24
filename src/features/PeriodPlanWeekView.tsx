import { useEffect, useState } from "react";
import { ArrowLeftRight, CalendarOff, Check, ChevronRight, Users, X } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  findProgramForPeriodPlanEntry,
  getPeriodPlanDayListLabel,
  isPeriodPlanEntryDateInFuture,
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

const MOTUS_GRADIENT = `${MOTUS.gradient}`;
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
        <div className="mx-3 mt-3 rounded-lg border motus-brand-surface px-3 py-2 text-xs font-medium text-emerald-900 sm:mx-4">{actionStatus}</div>
      ) : null}

      <div className="grid gap-2 p-3 sm:p-4">
        {WEEKDAY_PLAN_ORDER.map((dayKey) => {
          const dayLabel = WEEKDAY_PLAN_LABELS[dayKey];
          const entry = effectiveDays[dayKey]?.trim() ?? "";
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);
          const plannedDate = resolveEntryDate(plan, week.weekNumber, dayKey);
          const entryAction = entry ? resolvePeriodPlanEntryAction(entry, memberPrograms) : { kind: "none" as const };
          const previewProgramForEntry = entry ? findProgramForPeriodPlanEntry(entry, memberPrograms) : null;
          const listLabel = getPeriodPlanDayListLabel(entry, entryAction);
          const completed = isEntryCompleted(plan.id, week.weekNumber, dayKey);
          const isFutureDate = isPeriodPlanEntryDateInFuture(plannedDate);
          const canMarkCompleted = completed || !isFutureDate;
          const isSwapSource = swapFromDay === dayKey;
          const canOpenPreview = Boolean(previewProgramForEntry);
          const canStartFromPreview =
            canOpenPreview && !completed && entryAction.kind === "start-program" && !isFutureDate;

          return (
            <div
              key={`${week.id}-${dayKey}`}
              className={`overflow-hidden rounded-xl border shadow-sm transition ${
                completed
                  ? "border-emerald-200/90 bg-emerald-50/40"
                  : isSwapSource
                    ? "border-teal-400 bg-white ring-2 ring-teal-200"
                    : "border-slate-200/90 bg-white hover:border-teal-200"
              }`}
            >
              <div className="flex items-stretch">
                <button
                  type="button"
                  disabled={!canOpenPreview}
                  onClick={() => {
                    if (previewProgramForEntry) {
                      openProgramPreview(previewProgramForEntry, canStartFromPreview);
                    }
                  }}
                  className={`min-w-0 flex-1 p-3 text-left transition ${
                    canOpenPreview ? "hover:bg-slate-50/80" : "cursor-default"
                  }`}
                  aria-label={canOpenPreview ? `Se økt for ${dayLabel}` : undefined}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${
                        completed
                          ? "bg-emerald-100 text-emerald-900 ring-teal-200/80"
                          : "bg-teal-50 text-teal-900 ring-teal-100"
                      }`}
                    >
                      {dayLabel}
                    </span>
                    {completed ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <Check className="h-3 w-3" aria-hidden />
                        Fullført
                      </span>
                    ) : null}
                    {plannedDate ? <span className="text-xs text-slate-400">{plannedDate}</span> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className={`text-sm ${completed ? "text-slate-600" : "font-medium text-slate-800"}`}>{listLabel}</p>
                    {canOpenPreview ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    ) : !entry ? (
                      <CalendarOff className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    ) : null}
                  </div>
                  {sourceDay ? (
                    <p className="mt-1.5 text-xs text-slate-500">Flyttet fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}</p>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-col justify-start gap-1 border-l border-slate-100/90 p-2">
                  {entry ? (
                    <button
                      type="button"
                      disabled={!canMarkCompleted}
                      onClick={() => {
                        if (!canMarkCompleted) return;
                        onToggleCompleted({
                          planId: plan.id,
                          weekNumber: week.weekNumber,
                          day: dayKey,
                          entry: effectiveDays[dayKey],
                          plannedDate,
                        });
                      }}
                      className={`rounded-lg border p-2 transition ${
                        completed
                          ? "border-transparent text-white shadow-sm"
                          : canMarkCompleted
                            ? "border-slate-200 bg-white text-slate-300 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600"
                            : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-200"
                      }`}
                      style={completed ? { background: MOTUS_GRADIENT } : undefined}
                      aria-label={
                        completed
                          ? `Angre fullført for ${dayLabel}`
                          : isFutureDate
                            ? `${dayLabel} kan markeres fra og med planlagt dato`
                            : `Marker ${dayLabel} som fullført`
                      }
                      title={
                        completed ? "Angre fullført" : isFutureDate ? "Kan ikke markeres før planlagt dato" : "Marker fullført"
                      }
                    >
                      <Check className="h-4 w-4" strokeWidth={completed ? 3 : 2.25} aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleSwapButtonClick(dayKey)}
                    className={`rounded-lg border p-2 transition ${
                      isSwapSource
                        ? "border-transparent text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900"
                    }`}
                    style={isSwapSource ? { background: MOTUS_GRADIENT } : undefined}
                    aria-label={
                      isSwapSource
                        ? `Avbryt bytte for ${dayLabel}`
                        : swapFromDay
                          ? `Bytt ${WEEKDAY_PLAN_LABELS[swapFromDay]} med ${dayLabel}`
                          : `Bytt ${dayLabel} med annen dag`
                    }
                    aria-expanded={isSwapSource}
                    title={isSwapSource ? "Avbryt" : swapFromDay ? "Fullfør bytte" : "Bytt dag"}
                  >
                    <ArrowLeftRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              {isSwapSource ? (
                <div className="mx-3 mb-3 rounded-lg border motus-brand-surface/70 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-900">Velg dag</div>
                  <div className="mt-1.5 grid gap-1.5">
                    {WEEKDAY_PLAN_ORDER.filter((key) => key !== dayKey).map((key) => (
                      <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-md bg-white px-2 py-1.5">
                        <span className="min-w-0 text-[11px] font-semibold text-slate-700">{WEEKDAY_PLAN_LABELS[key]}</span>
                        <button
                          type="button"
                          onClick={() => {
                            onSwapDays(plan.id, week.weekNumber, dayKey, key);
                            setSwapFromDay(null);
                          }}
                          className="rounded-md border border-teal-100 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-950"
                        >
                          Bytt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDayClick(dayKey, key)}
                          className="rounded-md border border-pink-100 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-pink-400 hover:text-pink-800"
                        >
                          Flytt hit
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {entry && !completed && entryAction.kind === "log-group" ? (
                <div className="border-t border-slate-100/80 px-3 pb-3 pt-2">
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
                    className="w-full !min-h-9 !text-xs"
                  >
                    <Users className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Logg gruppetime
                  </OutlineButton>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

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
            <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
    </div>
  );
}
