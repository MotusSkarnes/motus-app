import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { listActivityTemplates } from "../app/activityTemplate";
import { readPeriodPlanCompletionFromPersonalGoals } from "../app/periodPlanCompletionPrefs";
import {
  buildPeriodPlanEntryKey,
  derivePeriodPlanCompletedEntryKeysFromLogs,
  resolvePeriodPlanPlannedDate,
  resolvePeriodPlanWeek,
  resolvePeriodPlanWeekNumberForDate,
} from "../app/periodPlanMerge";
import { resolvePeriodPlanDayCompletion, type PeriodPlanDayCompletion } from "../app/periodPlanSessionCompletion";
import {
  applyPeriodPlanSwaps,
  buildPeriodPlanWeekOverride,
  getSwapsForWeek,
  mergePeriodPlanSwapsIntoPersonalGoals,
  movePeriodPlanDayEntries,
  parsePeriodPlanDayEntries,
  readPeriodPlanSwapsFromPersonalGoals,
  setSwapsForWeek,
  togglePeriodPlanMove,
  togglePeriodPlanSwap,
  WEEKDAY_PLAN_LABELS,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import type { Exercise, Member, PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WorkoutLog } from "../app/types";
import { PeriodPlanActiveView } from "./PeriodPlanActiveView";

type TrainerPeriodPlanAssignedViewProps = {
  plan: PeriodSchedulePlan;
  member: Member;
  relatedMemberIds: string[];
  programs: TrainingProgram[];
  activityTemplates?: TrainingProgram[];
  logs: WorkoutLog[];
  exerciseLibrary?: Exercise[];
  noPlanDayCoverSrc?: string | null;
  updateMember: (input: { memberId: string; changes: { personalGoals: string } }) => void;
};

export function TrainerPeriodPlanAssignedView({
  plan,
  member,
  relatedMemberIds,
  programs,
  activityTemplates = [],
  logs,
  exerciseLibrary = [],
  noPlanDayCoverSrc,
  updateMember,
}: TrainerPeriodPlanAssignedViewProps) {
  const currentWeekNumber = resolvePeriodPlanWeekNumberForDate(plan, new Date());
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(currentWeekNumber);
  const [swapsByPlan, setSwapsByPlan] = useState<PeriodPlanSwapsByPlan>({});
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const swapsDirtyRef = useRef(false);
  const swapsUpdatedAtRef = useRef(0);

  useEffect(() => {
    setSelectedWeekNumber(resolvePeriodPlanWeekNumberForDate(plan, new Date()));
  }, [plan.id]);

  useEffect(() => {
    if (swapsDirtyRef.current) return;
    const remote = readPeriodPlanSwapsFromPersonalGoals(member.personalGoals);
    swapsUpdatedAtRef.current = remote?.updatedAt ?? 0;
    setSwapsByPlan(remote?.swapsByPlan ?? {});
    setActionStatus(null);
  }, [plan.id, member.id, member.personalGoals]);

  useEffect(() => {
    if (!swapsDirtyRef.current) return;
    const timer = window.setTimeout(() => {
      const encoded = mergePeriodPlanSwapsIntoPersonalGoals(member.personalGoals, {
        version: 1,
        swapsByPlan,
        updatedAt: swapsUpdatedAtRef.current || Date.now(),
      });
      const targetIds = Array.from(new Set([member.id, ...relatedMemberIds].filter(Boolean)));
      targetIds.forEach((memberId) => {
        updateMember({ memberId, changes: { personalGoals: encoded } });
      });
      swapsDirtyRef.current = false;
    }, 350);
    return () => window.clearTimeout(timer);
  }, [member.id, member.personalGoals, relatedMemberIds, swapsByPlan, updateMember]);

  const completionPrefs = useMemo(
    () => readPeriodPlanCompletionFromPersonalGoals(member.personalGoals),
    [member.personalGoals],
  );
  const derivedCompletedKeys = useMemo(
    () =>
      derivePeriodPlanCompletedEntryKeysFromLogs({
        plans: [plan],
        swapsByPlan,
        programs,
        logs,
        memberId: member.id,
        member,
      }),
    [plan, swapsByPlan, programs, logs, member],
  );
  const completedKeys = useMemo(() => {
    const dismissed = new Set(completionPrefs?.dismissedEntryKeys ?? []);
    return Array.from(new Set([...(completionPrefs?.completedEntryKeys ?? []), ...derivedCompletedKeys])).filter(
      (key) => !dismissed.has(key),
    );
  }, [completionPrefs, derivedCompletedKeys]);

  const resolvedActivityTemplates = useMemo(
    () => (activityTemplates.length > 0 ? activityTemplates : listActivityTemplates(programs)),
    [activityTemplates, programs],
  );

  function resolveEntryDate(targetPlan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey): string | null {
    const plannedDate = resolvePeriodPlanPlannedDate(targetPlan, weekNumber, day);
    return plannedDate ? formatDateDdMmYyyy(plannedDate) : null;
  }

  function getDayCompletion(planId: string, weekNumber: number, day: WeekdayPlanKey): PeriodPlanDayCompletion {
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    if (!week || plan.id !== planId) return "none";
    const entry = applyPeriodPlanSwaps(week.days, getSwapsForWeek(swapsByPlan, planId, weekNumber))[day]?.trim() ?? "";
    return resolvePeriodPlanDayCompletion({
      entry,
      plannedDate: resolveEntryDate(plan, weekNumber, day),
      logs,
      programs,
      markedComplete: completedKeys.includes(buildPeriodPlanEntryKey(planId, weekNumber, day)),
    });
  }

  function isEntryCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey): boolean {
    return getDayCompletion(planId, weekNumber, day) !== "none";
  }

  function commitSwaps(
    planId: string,
    weekNumber: number,
    nextSwaps: ReturnType<typeof getSwapsForWeek>,
    message: string,
  ) {
    swapsDirtyRef.current = true;
    swapsUpdatedAtRef.current = Date.now();
    setActionStatus(message);
    setSwapsByPlan((prev) => setSwapsForWeek(prev, planId, weekNumber, nextSwaps));
  }

  function swapDays(planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    if (dayA === dayB) return;
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    const current = getSwapsForWeek(swapsByPlan, planId, weekNumber);
    const currentDays = week ? applyPeriodPlanSwaps(week.days, current) : null;
    const nextDays = currentDays ? { ...currentDays } : null;
    if (nextDays) {
      const valueA = nextDays[dayA];
      nextDays[dayA] = nextDays[dayB];
      nextDays[dayB] = valueA;
    }
    const nextSwaps =
      week && nextDays ? buildPeriodPlanWeekOverride(week.days, nextDays, dayA, dayB) : togglePeriodPlanSwap(current, dayA, dayB);
    commitSwaps(
      planId,
      weekNumber,
      nextSwaps,
      nextSwaps.length === 0
        ? `Bytte mellom ${WEEKDAY_PLAN_LABELS[dayA]} og ${WEEKDAY_PLAN_LABELS[dayB]} er angret.`
        : `Byttet plan for ${WEEKDAY_PLAN_LABELS[dayA]} og ${WEEKDAY_PLAN_LABELS[dayB]}.`,
    );
  }

  function moveDay(planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    if (dayA === dayB) return;
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    const current = getSwapsForWeek(swapsByPlan, planId, weekNumber);
    const currentDays = week ? applyPeriodPlanSwaps(week.days, current) : null;
    const nextDays = currentDays ? movePeriodPlanDayEntries(currentDays, dayA, dayB) : null;
    const nextSwaps =
      week && nextDays ? buildPeriodPlanWeekOverride(week.days, nextDays, dayA, dayB) : togglePeriodPlanMove(current, dayA, dayB);
    commitSwaps(
      planId,
      weekNumber,
      nextSwaps,
      nextSwaps.length === 0
        ? `Flytting fra ${WEEKDAY_PLAN_LABELS[dayA]} til ${WEEKDAY_PLAN_LABELS[dayB]} er angret.`
        : `Flyttet plan fra ${WEEKDAY_PLAN_LABELS[dayA]} til ${WEEKDAY_PLAN_LABELS[dayB]}. Begge øktene beholdes hvis dagen allerede var opptatt.`,
    );
  }

  function changeDayProgram(planId: string, weekNumber: number, day: WeekdayPlanKey, entry: string) {
    const nextEntry = entry.trim();
    if (!nextEntry) {
      setActionStatus("Fant ikke programmet eller gruppetimen du valgte.");
      return;
    }
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    if (!week) return;
    const current = getSwapsForWeek(swapsByPlan, planId, weekNumber);
    const currentDays = applyPeriodPlanSwaps(week.days, current);
    const nextDays = { ...currentDays, [day]: nextEntry };
    const nextSwaps = buildPeriodPlanWeekOverride(week.days, nextDays, day, day);
    const entryLabel = parsePeriodPlanDayEntries(nextEntry).join(" + ");
    commitSwaps(planId, weekNumber, nextSwaps, `Planen på ${WEEKDAY_PLAN_LABELS[day].toLowerCase()} er byttet til «${entryLabel}».`);
  }

  function resetSwaps(planId: string, weekNumber: number) {
    commitSwaps(planId, weekNumber, [], "Bytter for uken er tilbakestilt.");
  }

  return (
    <PeriodPlanActiveView
      plan={plan}
      isMemberOwned={false}
      swapsByPlan={swapsByPlan}
      selectedWeekNumber={selectedWeekNumber}
      onWeekSelectByNumber={setSelectedWeekNumber}
      currentWeekNumber={currentWeekNumber}
      resolveEntryDate={resolveEntryDate}
      memberPrograms={programs}
      activityTemplates={resolvedActivityTemplates}
      noPlanDayCoverSrc={noPlanDayCoverSrc}
      actionStatus={actionStatus}
      isEntryCompleted={isEntryCompleted}
      getDayCompletion={getDayCompletion}
      canLogWorkouts={false}
      onToggleCompleted={() => undefined}
      onSwapDays={swapDays}
      onMoveDay={moveDay}
      onChangeDayProgram={changeDayProgram}
      onResetSwaps={resetSwaps}
      onStartProgram={() => undefined}
      onLogGroup={() => undefined}
      exerciseLibrary={exerciseLibrary}
      logs={logs}
      showHeader={false}
    />
  );
}
