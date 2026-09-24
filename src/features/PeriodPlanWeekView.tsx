import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CircleDot, Coffee, Play, Plus, RotateCcw } from "lucide-react";
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
  parsePeriodPlanDayEntries,
  joinPeriodPlanDayEntries,
  WEEKDAY_PLAN_LABELS,
  WEEKDAY_PLAN_ORDER,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import {
  activityTemplateMatchesPeriodEntry,
  listActivityTemplates,
} from "../app/activityTemplate";
import {
  buildPeriodPlanChangeOptions,
  inferPeriodPlanChangeCategory,
  PERIOD_PLAN_CHANGE_CATEGORIES,
  type PeriodPlanChangeCategoryId,
} from "../app/periodPlanBuilder";
import { imageObjectPositionFromSrc, programCustomCoverImageStyle } from "../app/imageFocalPoint";
import {
  isUploadedProgramCoverSrc,
  programCoverUsesPhotoStyle,
  resolveNoPlanDayCoverImage,
  resolvePeriodPlanEntryCoverImage,
} from "../app/programImage";
import { buildExerciseCategoryById } from "../app/trainingProgramKind";
import type { Exercise, PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WeeklySchedulePlan, WorkoutLog } from "../app/types";
import { TrainingProgramPreviewModal } from "./TrainingProgramPreviewModal";
import { pickBestPeriodPlanDayLog, type PeriodPlanDayCompletion } from "../app/periodPlanSessionCompletion";

const WEEKDAY_SHORT: Record<WeekdayPlanKey, string> = {
  monday: "MAN",
  tuesday: "TIR",
  wednesday: "ONS",
  thursday: "TOR",
  friday: "FRE",
  saturday: "LØR",
  sunday: "SØN",
};

type DayStatus = "completed" | "partial" | "rest" | "planned" | "empty";

function resolveDayStatus(entry: string, completion: PeriodPlanDayCompletion): DayStatus {
  if (!entry.trim()) return "empty";
  if (isRestPeriodPlanEntry(entry)) return "rest";
  if (completion === "complete") return "completed";
  if (completion === "partial") return "partial";
  return "planned";
}

type PeriodPlanWeekViewProps = {
  plan: PeriodSchedulePlan;
  week: WeeklySchedulePlan;
  swapsByPlan: PeriodPlanSwapsByPlan;
  memberPrograms: TrainingProgram[];
  activityTemplates?: TrainingProgram[];
  noPlanDayCoverSrc?: string | null;
  actionStatus: string | null;
  isEntryCompleted: (planId: string, weekNumber: number, day: WeekdayPlanKey) => boolean;
  getDayCompletion?: (planId: string, weekNumber: number, day: WeekdayPlanKey) => PeriodPlanDayCompletion;
  /** Når false skjules start/fullfør — brukt i trenervisning. */
  canLogWorkouts?: boolean;
  onToggleCompleted: (input: {
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
    entry: string;
    plannedDate: string | null;
  }) => void;
  onSwapDays: (planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) => void;
  onMoveDay: (planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) => void;
  onChangeDayProgram: (planId: string, weekNumber: number, day: WeekdayPlanKey, entry: string) => void;
  onResetSwaps: (planId: string, weekNumber: number) => void;
  onStartProgram: (
    programId: string,
    context?: { planId: string; weekNumber: number; day: WeekdayPlanKey; entry: string },
  ) => void;
  onLogGroup: (input: {
    entry: string;
    plannedDate: string | null;
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
  }) => void;
  resolveEntryDate: (plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey) => string | null;
  exerciseLibrary?: Exercise[];
  /** Når satt kan trener åpne økta og se kundens logging. */
  logs?: WorkoutLog[];
};

export function PeriodPlanWeekView({
  plan,
  week,
  swapsByPlan,
  memberPrograms,
  activityTemplates = [],
  noPlanDayCoverSrc,
  actionStatus,
  isEntryCompleted,
  getDayCompletion,
  canLogWorkouts = true,
  onToggleCompleted,
  onSwapDays,
  onMoveDay,
  onChangeDayProgram,
  onResetSwaps,
  onStartProgram,
  onLogGroup,
  resolveEntryDate,
  exerciseLibrary = [],
  logs,
}: PeriodPlanWeekViewProps) {
  const exerciseCategoryById = useMemo(() => buildExerciseCategoryById(exerciseLibrary), [exerciseLibrary]);
  const resolvedActivityTemplates = useMemo(
    () => (activityTemplates.length > 0 ? activityTemplates : listActivityTemplates(memberPrograms)),
    [activityTemplates, memberPrograms],
  );
  const periodPlanChangeOptions = useMemo(
    () =>
      buildPeriodPlanChangeOptions({
        memberPrograms,
        activityTemplates: resolvedActivityTemplates,
      }),
    [memberPrograms, resolvedActivityTemplates],
  );
  const weekSwaps = getSwapsForWeek(swapsByPlan, plan.id, week.weekNumber);
  const effectiveDays = applyPeriodPlanSwaps(week.days, weekSwaps);
  const [swapFromDay, setSwapFromDay] = useState<WeekdayPlanKey | null>(null);
  const [programChangeDay, setProgramChangeDay] = useState<WeekdayPlanKey | null>(null);
  const [programChangeEntryIndex, setProgramChangeEntryIndex] = useState<number | null>(null);
  const [programChangeCategory, setProgramChangeCategory] = useState<PeriodPlanChangeCategoryId | null>(null);
  const [previewProgram, setPreviewProgram] = useState<TrainingProgram | null>(null);
  const [previewPerformedLog, setPreviewPerformedLog] = useState<WorkoutLog | null>(null);
  const [previewCanStart, setPreviewCanStart] = useState(false);
  const [previewStartContext, setPreviewStartContext] = useState<{
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
    entry: string;
  } | null>(null);

  useEffect(() => {
    setSwapFromDay(null);
    setProgramChangeDay(null);
    setProgramChangeEntryIndex(null);
    setProgramChangeCategory(null);
    setPreviewProgram(null);
    setPreviewPerformedLog(null);
    setPreviewCanStart(false);
    setPreviewStartContext(null);
  }, [plan.id, week.weekNumber]);

  function openProgramPreview(
    program: TrainingProgram,
    canStart: boolean,
    context: { planId: string; weekNumber: number; day: WeekdayPlanKey; entry: string },
    performedLog: WorkoutLog | null = null,
  ) {
    setPreviewProgram(program);
    setPreviewPerformedLog(performedLog);
    setPreviewCanStart(canStart);
    setPreviewStartContext(context);
  }

  function closeProgramPreview() {
    setPreviewProgram(null);
    setPreviewPerformedLog(null);
    setPreviewCanStart(false);
    setPreviewStartContext(null);
  }

  function handleSwapButtonClick(dayKey: WeekdayPlanKey) {
    setProgramChangeDay(null);
    setProgramChangeCategory(null);
    if (swapFromDay && swapFromDay !== dayKey) {
      onSwapDays(plan.id, week.weekNumber, swapFromDay, dayKey);
      setSwapFromDay(null);
      return;
    }
    setSwapFromDay((prev) => (prev === dayKey ? null : dayKey));
  }

  function handleProgramChangeButtonClick(dayKey: WeekdayPlanKey, entryIndex: number | null = null) {
    setSwapFromDay(null);
    setProgramChangeDay((prev) => {
      if (prev === dayKey && programChangeEntryIndex === entryIndex) {
        setProgramChangeCategory(null);
        setProgramChangeEntryIndex(null);
        return null;
      }
      const entries = parsePeriodPlanDayEntries(effectiveDays[dayKey]);
      const selectedEntry = entryIndex === null ? entries[0] ?? "" : entries[entryIndex] ?? "";
      setProgramChangeEntryIndex(entryIndex);
      setProgramChangeCategory(inferPeriodPlanChangeCategory(selectedEntry, periodPlanChangeOptions));
      return dayKey;
    });
  }

  function handleMoveDayClick(dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    onMoveDay(plan.id, week.weekNumber, dayA, dayB);
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
          const dayEntries = parsePeriodPlanDayEntries(entry);
          const sourceDay = periodPlanSourceDay(dayKey, week.days, effectiveDays);
          const plannedDate = resolveEntryDate(plan, week.weekNumber, dayKey);
          const visibleEntries = plannedDate ? dayEntries : [];
          const visibleEntry = visibleEntries[0] ?? "";
          const entryAction = visibleEntry ? resolvePeriodPlanEntryAction(visibleEntry, memberPrograms) : { kind: "none" as const };
          const previewProgramForEntry = visibleEntry ? findProgramForPeriodPlanEntry(visibleEntry, memberPrograms) : null;
          const activityTemplateForEntry = visibleEntry
            ? resolvedActivityTemplates.find((template) => activityTemplateMatchesPeriodEntry(template, visibleEntry)) ?? null
            : null;
          const listLabel = visibleEntries.length > 1
            ? visibleEntries
                .map((item) => getPeriodPlanDayListLabel(item, resolvePeriodPlanEntryAction(item, memberPrograms)))
                .join(" + ")
            : getPeriodPlanDayListLabel(visibleEntry, entryAction);
          const coverImageSrc = visibleEntry.trim()
            ? resolvePeriodPlanEntryCoverImage(visibleEntry, {
                activityTemplates: resolvedActivityTemplates,
                memberPrograms,
                exercises: exerciseLibrary,
                exerciseCategoryById,
              })
            : noPlanDayCoverSrc || resolveNoPlanDayCoverImage();
          const coverProgramForPresentation = previewProgramForEntry ?? activityTemplateForEntry;
          const coverStyleSrc =
            coverProgramForPresentation?.imageUrl?.trim() || coverImageSrc;
          const coverUsesPhotoStyle =
            isUploadedProgramCoverSrc(coverImageSrc) ||
            isUploadedProgramCoverSrc(coverStyleSrc) ||
            (coverProgramForPresentation
              ? programCoverUsesPhotoStyle(coverProgramForPresentation, coverImageSrc)
              : false);
          const coverImageStyle = coverUsesPhotoStyle
            ? programCustomCoverImageStyle(coverStyleSrc)
            : { objectPosition: imageObjectPositionFromSrc(coverImageSrc) };
          const completion =
            getDayCompletion?.(plan.id, week.weekNumber, dayKey) ??
            (isEntryCompleted(plan.id, week.weekNumber, dayKey) ? "complete" : "none");
          const completed = completion === "complete";
          const status = resolveDayStatus(visibleEntry, completion);
          const isFutureDate = isPeriodPlanEntryDateInFuture(plannedDate);
          const canMarkCompleted = completed || !isFutureDate;
          const isSwapSource = swapFromDay === dayKey;
          const canOpenPreview = Boolean(previewProgramForEntry);
          const isProgramChangeOpen = programChangeDay === dayKey;
          const canStartFromPreview =
            canLogWorkouts && canOpenPreview && !completed && entryAction.kind === "start-program" && !isFutureDate;
          const inspectProgram = previewProgramForEntry ?? activityTemplateForEntry;
          const canInspectSession =
            Boolean(visibleEntry) && status !== "rest" && (Boolean(inspectProgram) || logs !== undefined);
          const canAddSession =
            Boolean(plannedDate) &&
            periodPlanChangeOptions.length > 0 &&
            !visibleEntry &&
            status !== "rest";
          const showDayActions = (Boolean(visibleEntry) && status !== "rest") || canAddSession || (Boolean(plannedDate) && !visibleEntry && status !== "rest");
          const isLast = index === WEEKDAY_PLAN_ORDER.length - 1;

          return (
            <li
              key={`${week.id}-${dayKey}`}
              className={`motus-period-plan-day motus-period-plan-day--${status}${isSwapSource ? " motus-period-plan-day--swap-source" : ""}`}
            >
              <div className="motus-period-plan-day-rail" aria-hidden>
                <span className={`motus-period-plan-day-node motus-period-plan-day-node--${status}`}>
                  {status === "completed" ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : status === "partial" ? (
                    <CircleDot className="h-3 w-3" strokeWidth={2.5} />
                  ) : status === "rest" ? (
                    <Coffee className="h-3 w-3" strokeWidth={2.25} />
                  ) : null}
                </span>
                {!isLast ? <span className="motus-period-plan-day-line" /> : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h4 className="text-sm font-bold text-slate-900">{dayLabel}</h4>
                  <span className="text-xs font-semibold text-slate-500">
                    {plannedDate ? `${WEEKDAY_SHORT[dayKey]} ${plannedDate}` : WEEKDAY_SHORT[dayKey]}
                  </span>
                </div>
                <div
                  className={`motus-period-plan-day-card motus-period-plan-day-card--${status}${isSwapSource ? " motus-period-plan-day-card--swap-source" : ""}`}
                >
                  <button
                    type="button"
                    disabled={!canInspectSession}
                    onClick={() => {
                      if (!canInspectSession) return;
                      const performedLog = logs
                        ? pickBestPeriodPlanDayLog({
                            entry: visibleEntry,
                            plannedDate,
                            logs,
                            programs: memberPrograms,
                          })
                        : null;
                      const program =
                        inspectProgram ??
                        ({
                          id: `period-entry-${dayKey}`,
                          memberId: "",
                          title: visibleEntry,
                          goal: "",
                          notes: "",
                          createdAt: "",
                          exercises: [],
                        } satisfies TrainingProgram);
                      openProgramPreview(
                        program,
                        canStartFromPreview,
                        {
                          planId: plan.id,
                          weekNumber: week.weekNumber,
                          day: dayKey,
                          entry: visibleEntry,
                        },
                        performedLog,
                      );
                    }}
                    className={`motus-period-plan-day-main ${canInspectSession ? "motus-period-plan-day-main--clickable" : ""}`}
                    aria-label={canInspectSession ? `Se økt for ${dayLabel}` : undefined}
                  >
                    {coverImageSrc && visibleEntries.length <= 1 ? (
                      <div className="motus-period-plan-day-cover motus-member-program-thumb motus-image-frame motus-image-frame--program-cover" aria-hidden>
                        <img
                          src={coverImageSrc}
                          alt=""
                          className={`motus-member-program-cover motus-image-media${
                            coverUsesPhotoStyle
                              ? " motus-member-program-cover--custom"
                              : " motus-member-program-cover--exercise"
                          }`}
                          style={coverImageStyle}
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <div className="motus-period-plan-day-body">
                    {visibleEntries.length <= 1 ? <p className="motus-period-plan-day-title">{listLabel}</p> : null}
                    {visibleEntries.length > 1 ? (
                      <div className="grid w-full gap-2" aria-label={`${visibleEntries.length} planlagte økter`}>
                        {visibleEntries.map((sessionEntry, sessionIndex) => {
                          const sessionAction = resolvePeriodPlanEntryAction(sessionEntry, memberPrograms);
                          const sessionProgram = findProgramForPeriodPlanEntry(sessionEntry, memberPrograms);
                          const sessionActivity = resolvedActivityTemplates.find((template) =>
                            activityTemplateMatchesPeriodEntry(template, sessionEntry),
                          ) ?? null;
                          const sessionCover = resolvePeriodPlanEntryCoverImage(sessionEntry, {
                            activityTemplates: resolvedActivityTemplates,
                            memberPrograms,
                            exercises: exerciseLibrary,
                            exerciseCategoryById,
                          });
                          return (
                            <span
                              key={`${sessionEntry}-summary-${sessionIndex}`}
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.stopPropagation();
                                const selectedProgram = sessionProgram ?? sessionActivity;
                                if (!selectedProgram) return;
                                const performedLog = logs
                                  ? pickBestPeriodPlanDayLog({
                                      entry: sessionEntry,
                                      plannedDate,
                                      logs,
                                      programs: memberPrograms,
                                    })
                                  : null;
                                openProgramPreview(
                                  selectedProgram,
                                  canLogWorkouts && sessionAction.kind === "start-program" && !isFutureDate,
                                  {
                                    planId: plan.id,
                                    weekNumber: week.weekNumber,
                                    day: dayKey,
                                    entry: sessionEntry,
                                  },
                                  performedLog,
                                );
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") event.currentTarget.click();
                              }}
                              className="flex h-24 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border bg-white p-2.5 text-left shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40 hover:shadow"
                            >
                              {sessionCover ? (
                                <span className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100" aria-hidden>
                                  <img
                                    src={sessionCover}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </span>
                              ) : null}
                              <span className="min-w-0 flex-1">
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-teal-700">
                                  Økt {sessionIndex + 1}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-sm font-bold leading-snug text-slate-900">
                                  {getPeriodPlanDayListLabel(sessionEntry, sessionAction)}
                                </span>
                                <span className="mt-1 block text-xs font-medium text-slate-500">Trykk for å se økten</span>
                              </span>
                              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="motus-period-plan-day-meta">
                      {completed ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--completed">Fullført</span>
                      ) : status === "partial" ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--partial">Delvis fullført</span>
                      ) : status === "rest" ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--rest">Restitusjon</span>
                      ) : visibleEntry ? (
                        <span className="motus-period-plan-day-status motus-period-plan-day-status--planned">Planlagt</span>
                      ) : null}
                    </div>
                    {status === "rest" ? (
                      <p className="motus-period-plan-day-sub">Restitusjon er også trening</p>
                    ) : sourceDay ? (
                      <p className="motus-period-plan-day-sub">Flyttet fra {WEEKDAY_PLAN_LABELS[sourceDay].toLowerCase()}</p>
                    ) : canAddSession ? (
                      <p className="motus-period-plan-day-sub">Legg til en økt denne dagen</p>
                    ) : null}
                    {canInspectSession ? <ChevronRight className="motus-period-plan-day-chevron" aria-hidden /> : null}
                    </div>
                  </button>

                  {showDayActions ? (
                    <div className="motus-period-plan-day-footer">
                      {visibleEntries.length > 1 && canLogWorkouts ? (
                        <div className="grid flex-1 gap-1.5">
                          {visibleEntries.map((sessionEntry, sessionIndex) => {
                            const sessionAction = resolvePeriodPlanEntryAction(sessionEntry, memberPrograms);
                            if (sessionAction.kind !== "start-program" || isFutureDate) return null;
                            return (
                              <button
                                key={`${sessionEntry}-${sessionIndex}`}
                                type="button"
                                onClick={() =>
                                  onStartProgram(sessionAction.program.id, {
                                    planId: plan.id,
                                    weekNumber: week.weekNumber,
                                    day: dayKey,
                                    entry: sessionEntry,
                                  })
                                }
                                className="motus-period-plan-day-primary motus-period-plan-day-primary--start"
                              >
                                <Play className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                                Start {getPeriodPlanDayListLabel(sessionEntry, sessionAction)}
                              </button>
                            );
                          })}
                        </div>
                      ) : visibleEntry && canLogWorkouts ? (
                        entryAction.kind === "start-program" && !completed && status !== "partial" && !isFutureDate ? (
                          <button
                            type="button"
                            onClick={() =>
                              onStartProgram(entryAction.program.id, {
                                planId: plan.id,
                                weekNumber: week.weekNumber,
                                day: dayKey,
                                entry: visibleEntry,
                              })
                            }
                            className="motus-period-plan-day-primary motus-period-plan-day-primary--start"
                            aria-label={`Start økt for ${dayLabel}`}
                          >
                            <Play className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                            Start økt
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canMarkCompleted}
                            onClick={() => {
                              if (!canMarkCompleted) return;
                              onToggleCompleted({
                                planId: plan.id,
                                weekNumber: week.weekNumber,
                                day: dayKey,
                                entry: visibleEntry,
                                plannedDate,
                              });
                            }}
                            className={`motus-period-plan-day-primary ${completed ? "motus-period-plan-day-primary--done" : ""}`}
                            aria-label={
                              completed
                                ? `Angre fullført for ${dayLabel}`
                                : isFutureDate
                                  ? `${dayLabel} kan markeres fra og med planlagt dato`
                                  : `Marker ${dayLabel} som fullført`
                            }
                          >
                            <Check className="h-4 w-4 shrink-0" strokeWidth={completed ? 3 : 2.25} aria-hidden />
                            {completed ? "Angre fullført" : "Marker fullført"}
                          </button>
                        )
                      ) : canAddSession ? (
                        <button
                          type="button"
                          onClick={() => handleProgramChangeButtonClick(dayKey)}
                          className="motus-period-plan-day-primary motus-period-plan-day-primary--start"
                          aria-expanded={isProgramChangeOpen}
                          aria-label={
                            isProgramChangeOpen
                              ? `Avbryt å legge til økt på ${dayLabel}`
                              : `Legg til økt på ${dayLabel}`
                          }
                        >
                          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                          {isProgramChangeOpen ? "Avbryt" : "Legg til økt"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleSwapButtonClick(dayKey)}
                        className={`motus-period-plan-day-swap-link ${isSwapSource ? "motus-period-plan-day-swap-link--active" : ""}`}
                        aria-expanded={isSwapSource}
                      >
                        {isSwapSource ? "Avbryt bytte" : "Bytt dag"}
                      </button>
                      {visibleEntries.length > 1 && periodPlanChangeOptions.length > 0 ? (
                        <div className="grid gap-1">
                          {visibleEntries.map((sessionEntry, sessionIndex) => (
                            <button
                              key={`${sessionEntry}-edit-${sessionIndex}`}
                              type="button"
                              onClick={() => handleProgramChangeButtonClick(dayKey, sessionIndex)}
                              className={`motus-period-plan-day-swap-link ${
                                isProgramChangeOpen && programChangeEntryIndex === sessionIndex
                                  ? "motus-period-plan-day-swap-link--active"
                                  : ""
                              }`}
                            >
                              Bytt {getPeriodPlanDayListLabel(
                                sessionEntry,
                                resolvePeriodPlanEntryAction(sessionEntry, memberPrograms),
                              )}
                            </button>
                          ))}
                        </div>
                      ) : visibleEntry && periodPlanChangeOptions.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleProgramChangeButtonClick(dayKey)}
                          className={`motus-period-plan-day-swap-link ${
                            isProgramChangeOpen ? "motus-period-plan-day-swap-link--active" : ""
                          }`}
                          aria-expanded={isProgramChangeOpen}
                        >
                          {isProgramChangeOpen ? "Avbryt program" : "Bytt program"}
                        </button>
                      ) : null}
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

                {isProgramChangeOpen ? (
                  <div className="motus-period-plan-swap-panel">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {visibleEntry
                        ? `Velg ny økt for ${
                            programChangeEntryIndex === null
                              ? dayLabel.toLowerCase()
                              : getPeriodPlanDayListLabel(
                                  visibleEntries[programChangeEntryIndex] ?? "",
                                  resolvePeriodPlanEntryAction(visibleEntries[programChangeEntryIndex] ?? "", memberPrograms),
                                )
                          }`
                        : `Legg til økt på ${dayLabel.toLowerCase()}`}
                    </div>
                    <div className="motus-period-plan-category-row" role="tablist" aria-label="Kategori">
                      {PERIOD_PLAN_CHANGE_CATEGORIES.filter((category) =>
                        periodPlanChangeOptions.some((option) => option.category === category.id),
                      ).map((category) => {
                        const isActive = programChangeCategory === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() =>
                              setProgramChangeCategory((prev) => (prev === category.id ? null : category.id))
                            }
                            className={`motus-period-plan-category-chip${
                              isActive ? " motus-period-plan-category-chip--active" : ""
                            }`}
                          >
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                    {programChangeCategory ? (
                      <div className="motus-period-plan-change-list">
                        {periodPlanChangeOptions
                          .filter((option) => option.category === programChangeCategory)
                          .map((option) => {
                            const editedEntry =
                              programChangeEntryIndex === null
                                ? visibleEntry
                                : visibleEntries[programChangeEntryIndex] ?? "";
                            const isCurrentProgram = editedEntry.trim().toLowerCase() === option.value.trim().toLowerCase();
                            return (
                              <button
                                key={option.value}
                                type="button"
                                disabled={isCurrentProgram}
                                onClick={() => {
                                  const nextEntries = [...visibleEntries];
                                  if (programChangeEntryIndex === null || nextEntries.length === 0) {
                                    onChangeDayProgram(plan.id, week.weekNumber, dayKey, option.value);
                                  } else {
                                    nextEntries[programChangeEntryIndex] = option.value;
                                    onChangeDayProgram(
                                      plan.id,
                                      week.weekNumber,
                                      dayKey,
                                      joinPeriodPlanDayEntries(nextEntries),
                                    );
                                  }
                                  setProgramChangeDay(null);
                                  setProgramChangeEntryIndex(null);
                                  setProgramChangeCategory(null);
                                }}
                                className={`motus-period-plan-swap-row text-left transition ${
                                  isCurrentProgram ? "cursor-default opacity-60" : "hover:border-slate-300 hover:bg-white"
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-semibold text-slate-800">{option.label}</span>
                                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">{option.meta}</span>
                                </span>
                                <span className="shrink-0 text-[10px] font-semibold text-slate-500">
                                  {isCurrentProgram ? "Valgt" : "Velg"}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">Velg en kategori for å se øktene.</p>
                    )}
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
        performedLog={previewPerformedLog}
        showCustomerPerformance={logs !== undefined}
        primaryAction={
          canLogWorkouts && previewCanStart && previewProgram
            ? {
                label: "Start økt",
                onClick: () => {
                  onStartProgram(previewProgram.id, previewStartContext ?? undefined);
                  closeProgramPreview();
                },
              }
            : undefined
        }
      />

    </section>
  );
}
