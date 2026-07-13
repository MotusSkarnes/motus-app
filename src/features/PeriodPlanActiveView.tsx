import {
  buildPeriodPlanWeekNavItemsFromPlan,
  computePeriodPlanSessionProgress,
  resolvePeriodPlanWeek,
  type PeriodPlanWeekNavItem,
} from "../app/periodPlanMerge";
import type { PeriodPlanSwapsByPlan } from "../app/periodPlanSwaps";
import type { Exercise, PeriodSchedulePlan, TrainingProgram, WeekdayPlanKey } from "../app/types";
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
  onToggleCompleted,
  onSwapDays,
  onMoveDay,
  onChangeDayProgram,
  onResetSwaps,
  onStartProgram,
  onLogGroup,
  exerciseLibrary = [],
}: PeriodPlanActiveViewProps) {
  const weekNavItems: PeriodPlanWeekNavItem[] = buildPeriodPlanWeekNavItemsFromPlan(plan);
  const selectedWeek = resolvePeriodPlanWeek(plan, selectedWeekNumber);
  const sessionProgress = computePeriodPlanSessionProgress(plan, swapsByPlan, isEntryCompleted);

  return (
    <div className="motus-period-plan-active space-y-4">
      <div className="px-0.5">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">{plan.title}</h2>
        {plan.notes ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{plan.notes}</p> : null}
      </div>

      <PeriodPlanMetadataCards
        startDate={plan.startDate}
        weeks={plan.weeks}
        sourceLabel={isMemberOwned ? "Lagt til av deg" : "Fra trener"}
      />

      {weekNavItems.length > 0 ? (
        <PeriodPlanWeekNavigator
          variant="hero"
          weeks={weekNavItems}
          selectedWeekNumber={selectedWeekNumber}
          onWeekSelectByNumber={onWeekSelectByNumber}
          currentWeekNumber={currentWeekNumber}
          formatWeekRange={(weekNumber) => {
            const monday = resolveEntryDate(plan, weekNumber, "monday");
            const sunday = resolveEntryDate(plan, weekNumber, "sunday");
            if (!monday || !sunday) return null;
            return `${monday} – ${sunday}`;
          }}
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
          onToggleCompleted={onToggleCompleted}
          onSwapDays={onSwapDays}
          onMoveDay={onMoveDay}
          onChangeDayProgram={onChangeDayProgram}
          onResetSwaps={onResetSwaps}
          onStartProgram={onStartProgram}
          onLogGroup={onLogGroup}
          resolveEntryDate={resolveEntryDate}
          exerciseLibrary={exerciseLibrary}
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
