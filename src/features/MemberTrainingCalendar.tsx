import type { ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { MOTUS } from "../app/data";
import {
  getIsoWeekLabel,
  getMondayStart,
  getWeekDates,
  getWeekdayShortLabel,
  toCalendarDateKey,
  type TrainingCalendarDayStatus,
} from "../app/memberTrainingCalendar";
import { OutlineButton } from "../app/ui";

export type TrainingCalendarDayModel = {
  dateKey: string;
  date: Date;
  status: TrainingCalendarDayStatus;
  workoutLabel: string;
  sessionCount: number;
  isToday: boolean;
};

type MemberTrainingCalendarProps = {
  viewMode: "week" | "month";
  onViewModeChange: (mode: "week" | "month") => void;
  weekStart: Date;
  onWeekStartChange: (weekStart: Date) => void;
  weekDays: TrainingCalendarDayModel[];
  weekCompletedCount: number;
  weekPlannedCount: number;
  streakWeeks: number;
  monthLabel: string;
  monthWeekdayHeaders: ReactNode;
  monthCells: ReactNode;
  monthLegend: ReactNode;
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string | null) => void;
  onGoToToday: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

function statusAccent(status: TrainingCalendarDayStatus, isToday: boolean): string {
  if (status === "completed") return MOTUS.turquoise;
  if (status === "missed") return "#f43f5e";
  if (isToday) return MOTUS.turquoise;
  return "#cbd5e1";
}

export function MemberTrainingCalendar({
  viewMode,
  onViewModeChange,
  weekStart,
  onWeekStartChange,
  weekDays,
  weekCompletedCount,
  weekPlannedCount,
  streakWeeks,
  monthLabel,
  monthWeekdayHeaders,
  monthCells,
  monthLegend,
  selectedDateKey,
  onSelectDateKey,
  onGoToToday,
  onPreviousMonth,
  onNextMonth,
}: MemberTrainingCalendarProps) {
  const weekLabel = getIsoWeekLabel(weekStart);
  const weekProgressPct =
    weekPlannedCount > 0 ? Math.min(100, Math.round((weekCompletedCount / weekPlannedCount) * 100)) : 0;

  return (
    <div className="motus-training-calendar min-w-0 w-full space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Plan og økter</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-800">
            {viewMode === "week" ? "Denne ukas økter" : "Treningskalender"}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onViewModeChange(viewMode === "week" ? "month" : "week")}
          className="motus-pressable inline-flex items-center gap-0.5 text-xs font-semibold text-teal-700 underline-offset-2 hover:underline"
        >
          {viewMode === "week" ? "Se kalender" : "Vis ukevis"}
          {viewMode === "week" ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
        </button>
      </div>

      {viewMode === "week" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <OutlineButton
                type="button"
                className="!min-h-8 !px-2.5 !py-1.5 !text-xs"
                onClick={() => {
                  const prev = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - 7);
                  onWeekStartChange(getMondayStart(prev));
                }}
                aria-label="Forrige uke"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </OutlineButton>
              <OutlineButton type="button" className="!min-h-8 !px-3 !py-1.5 !text-xs" onClick={onGoToToday}>
                I dag
              </OutlineButton>
              <OutlineButton
                type="button"
                className="!min-h-8 !px-2.5 !py-1.5 !text-xs"
                onClick={() => {
                  const next = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
                  onWeekStartChange(getMondayStart(next));
                }}
                aria-label="Neste uke"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </OutlineButton>
            </div>
            <p className="text-xs font-medium capitalize text-slate-500">{monthLabel}</p>
          </div>

          <p className="text-base font-bold tracking-tight text-slate-900">{weekLabel}</p>

          <div className="motus-training-week-row scrollbar-none">
            {weekDays.map((day) => {
              const selected = selectedDateKey === day.dateKey;
              const accent = statusAccent(day.status, day.isToday);
              return (
                <button
                  key={day.dateKey}
                  type="button"
                  onClick={() => onSelectDateKey(selected ? null : day.dateKey)}
                  className={`motus-training-week-day motus-pressable ${day.isToday ? "motus-training-week-day--today" : ""} ${selected ? "motus-training-week-day--selected" : ""}`}
                  aria-pressed={selected}
                >
                  <span className="motus-training-week-day-label">{getWeekdayShortLabel(day.date)}</span>
                  <span
                    className={`motus-training-week-day-marker ${day.status === "completed" ? "motus-training-week-day-marker--done" : ""}`}
                    style={
                      day.status === "completed"
                        ? { background: accent, borderColor: accent }
                        : day.isToday
                          ? { borderColor: accent, color: "var(--motus-brand-text-strong)" }
                          : undefined
                    }
                  >
                    {day.status === "completed" ? (
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />
                    ) : (
                      day.date.getDate()
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="motus-training-week-summary">
            <div className="min-w-0 flex-1">
              <div className="motus-progress-track h-1.5 rounded-full">
                <div
                  className="motus-progress-fill h-1.5 rounded-full"
                  style={{
                    width: `${weekProgressPct}%`,
                    background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {weekPlannedCount > 0
                  ? `${weekCompletedCount} av ${weekPlannedCount} økter fullført`
                  : `${weekCompletedCount} ${weekCompletedCount === 1 ? "økt" : "økter"} denne uka`}
              </p>
            </div>
            {streakWeeks > 0 ? (
              <div className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span className="motus-streak-inline-bubble" aria-hidden>
                  <Flame className="h-3 w-3" strokeWidth={2.25} />
                </span>
                {streakWeeks} {streakWeeks === 1 ? "uke" : "uker"} streak
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium capitalize text-slate-500">{monthLabel}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <OutlineButton type="button" className="!min-h-8 !px-3 !py-1.5 !text-xs" onClick={onPreviousMonth}>
                Forrige
              </OutlineButton>
              <OutlineButton type="button" className="!min-h-8 !px-3 !py-1.5 !text-xs" onClick={onGoToToday}>
                I dag
              </OutlineButton>
              <OutlineButton type="button" className="!min-h-8 !px-3 !py-1.5 !text-xs" onClick={onNextMonth}>
                Neste
              </OutlineButton>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">{monthWeekdayHeaders}</div>
          <div className="mt-2 grid grid-cols-7 gap-1">{monthCells}</div>
          <div className="mt-3">{monthLegend}</div>
        </>
      )}
    </div>
  );
}

export function buildWeekDayModels(input: {
  weekStart: Date;
  today: Date;
  statusByDateKey: Map<string, TrainingCalendarDayStatus>;
  workoutLabelByDateKey: Map<string, string>;
  sessionCountByDateKey: Map<string, number>;
}): TrainingCalendarDayModel[] {
  return getWeekDates(input.weekStart).map((date) => {
    const dateKey = toCalendarDateKey(date);
    return {
      dateKey,
      date,
      status: input.statusByDateKey.get(dateKey) ?? "none",
      workoutLabel: input.workoutLabelByDateKey.get(dateKey) ?? "—",
      sessionCount: input.sessionCountByDateKey.get(dateKey) ?? 0,
      isToday:
        date.getFullYear() === input.today.getFullYear() &&
        date.getMonth() === input.today.getMonth() &&
        date.getDate() === input.today.getDate(),
    };
  });
}
