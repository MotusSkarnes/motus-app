import {
  buildPeriodPlanWeekNavItemsFromPlan,
  computePeriodPlanSessionProgress,
  formatPeriodPlanWeekDateRange,
  resolvePeriodPlanWeek,
  type PeriodPlanWeekNavItem,
} from "../app/periodPlanMerge";
import type { PeriodPlanSwapsByPlan } from "../app/periodPlanSwaps";
import type { Exercise, PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey, WorkoutLog } from "../app/types";
import type { PeriodPlanDayCompletion } from "../app/periodPlanSessionCompletion";
import { PeriodPlanMetadataCards } from "./PeriodPlanMetadataCards";
import { PeriodPlanPeriodProgressCard } from "./PeriodPlanPeriodProgressCard";
import { PeriodPlanWeekNavigator } from "./PeriodPlanWeekNavigator";
import { PeriodPlanWeekView } from "./PeriodPlanWeekView";

type PeriodPlanActiveViewProps = {
  plan: PeriodSchedulePlan;
  isMemberOwned: boolean;
  swapsByPlan: PeriodPlanSwapsByPlan;
  selectedWeekNumber: number;
  onWeekSelectByNumber: (weekNumber: number) => void;
  currentWeekNumber: number | null;
  resolveEntryDate: (plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey) => string | null;
  memberPrograms: TrainingProgram[];
  activityTemplates?: TrainingProgram[];
  noPlanDayCoverSrc?: string | null;
  actionStatus: string | null;
  isEntryCompleted: (planId: string, weekNumber: number, day: WeekdayPlanKey) => boolean;
  getDayCompletion?: (planId: string, weekNumber: number, day: WeekdayPlanKey) => PeriodPlanDayCompletion;
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
  onStartProgram: (programId: string) => void;
  onLogGroup: (input: {
    entry: string;
    plannedDate: string | null;
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
  }) => void;
  exerciseLibrary?: Exercise[];
  logs?: WorkoutLog[];
  showHeader?: boolean;
};

export function PeriodPlanActiveView({
  plan,
  isMemberOwned,
  swapsByPlan,
  selectedWeekNumber,
  onWeekSelectByNumber,
  currentWeekNumber,
  resolveEntryDate,
  memberPrograms,
  activityTemplates,
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
  exerciseLibrary = [],
  logs,
  showHeader = true,
}: PeriodPlanActiveViewProps) {
  const weekNavItems: PeriodPlanWeekNavItem[] = buildPeriodPlanWeekNavItemsFromPlan(plan);
  const selectedWeek = resolvePeriodPlanWeek(plan, selectedWeekNumber);
  const sessionProgress = computePeriodPlanSessionProgress(plan, swapsByPlan, isEntryCompleted);

  return (
    <div className="motus-period-plan-active space-y-4">
      {showHeader ? (
        <div className="px-0.5">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">{plan.title}</h2>
          {plan.notes ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{plan.notes}</p> : null}
        </div>
      ) : null}

      <PeriodPlanMetadataCards
        startDate={plan.startDate}
        weeks={plan.weeks}
        sourceLabel={isMemberOwned ? "Lagt til av deg" : showHeader ? "Fra trener" : "Kundens ukeplan"}
      />

      {weekNavItems.length > 0 ? (
        <PeriodPlanWeekNavigator
          variant="hero"
          weeks={weekNavItems}
          selectedWeekNumber={selectedWeekNumber}
          onWeekSelectByNumber={onWeekSelectByNumber}
          currentWeekNumber={currentWeekNumber}
          formatWeekRange={(weekNumber) => formatPeriodPlanWeekDateRange(plan, weekNumber)}
        />
      ) : null}

      {selectedWeek ? (
        <PeriodPlanWeekView
          key={`${plan.id}-${selectedWeekNumber}`}
          plan={plan}
          week={selectedWeek}
          swapsByPlan={swapsByPlan}
          memberPrograms={memberPrograms}
          activityTemplates={activityTemplates}
          noPlanDayCoverSrc={noPlanDayCoverSrc}
          actionStatus={actionStatus}
          isEntryCompleted={isEntryCompleted}
          getDayCompletion={getDayCompletion}
          canLogWorkouts={canLogWorkouts}
          onToggleCompleted={onToggleCompleted}
          onSwapDays={onSwapDays}
          onMoveDay={onMoveDay}
          onChangeDayProgram={onChangeDayProgram}
          onResetSwaps={onResetSwaps}
          onStartProgram={onStartProgram}
          onLogGroup={onLogGroup}
          resolveEntryDate={resolveEntryDate}
          exerciseLibrary={exerciseLibrary}
          logs={logs}
        />
      ) : null}

      {sessionProgress.total > 0 ? (
        <PeriodPlanPeriodProgressCard
          completed={sessionProgress.completed}
          total={sessionProgress.total}
          pct={sessionProgress.pct}
        />
      ) : null}
    </div>
  );
}
