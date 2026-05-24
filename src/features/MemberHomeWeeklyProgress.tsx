import { Check, ChevronRight, Flame } from "lucide-react";
import { MOTUS } from "../app/data";
import { getIsoWeekLabel, getWeekdayShortLabel } from "../app/memberTrainingCalendar";
import type { TrainingCalendarDayModel } from "./MemberTrainingCalendar";

type MemberHomeWeeklyProgressProps = {
  weekStart: Date;
  weekDays: TrainingCalendarDayModel[];
  weekCompletedCount: number;
  weekPlannedCount: number;
  streakWeeks: number;
  onOpenCalendar: () => void;
  selectedDateKey: string | null;
  onSelectDateKey: (dateKey: string | null) => void;
};

function statusAccent(status: TrainingCalendarDayModel["status"], isToday: boolean): string {
  if (status === "completed") return MOTUS.turquoise;
  if (status === "missed") return MOTUS.pink;
  if (isToday) return MOTUS.turquoise;
  return "#cbd5e1";
}

export function MemberHomeWeeklyProgress({
  weekStart,
  weekDays,
  weekCompletedCount,
  weekPlannedCount,
  streakWeeks,
  onOpenCalendar,
  selectedDateKey,
  onSelectDateKey,
}: MemberHomeWeeklyProgressProps) {
  const weekLabel = getIsoWeekLabel(weekStart);
  const weekProgressPct =
    weekPlannedCount > 0 ? Math.min(100, Math.round((weekCompletedCount / weekPlannedCount) * 100)) : weekCompletedCount > 0 ? 100 : 0;

  return (
    <section className="motus-home-section-card motus-home-weekly-progress" aria-label="Ukens fremgang">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Ukens fremgang</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{weekLabel}</p>
        </div>
        <button
          type="button"
          onClick={onOpenCalendar}
          className="motus-pressable inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[#0d9488] hover:text-teal-800"
        >
          Se kalender
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <div className="motus-home-weekly-days scrollbar-none mt-4">
        {weekDays.map((day) => {
          const selected = selectedDateKey === day.dateKey;
          const accent = statusAccent(day.status, day.isToday);
          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => onSelectDateKey(selected ? null : day.dateKey)}
              className={`motus-home-weekly-day motus-pressable ${day.isToday ? "motus-home-weekly-day--today" : ""} ${selected ? "motus-home-weekly-day--selected" : ""}`}
              aria-pressed={selected}
            >
              <span className="motus-home-weekly-day-label">{getWeekdayShortLabel(day.date)}</span>
              <span
                className={`motus-home-weekly-day-marker ${day.status === "completed" ? "motus-home-weekly-day-marker--done" : ""}`}
                style={
                  day.status === "completed"
                    ? { background: accent, borderColor: accent }
                    : day.isToday
                      ? { borderColor: accent, background: "rgba(48,227,190,0.14)", color: "#0f766e" }
                      : undefined
                }
              >
                {day.status === "completed" ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
                ) : (
                  day.date.getDate()
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="motus-progress-track motus-home-weekly-progress-bar mt-4 h-2 rounded-full">
        <div
          className="motus-progress-fill h-2 rounded-full"
          style={{
            width: `${weekProgressPct}%`,
            background: MOTUS.gradient,
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          {weekPlannedCount > 0
            ? `${weekCompletedCount} av ${weekPlannedCount} økter fullført`
            : `${weekCompletedCount} ${weekCompletedCount === 1 ? "økt" : "økter"} denne uka`}
        </p>
        {streakWeeks > 0 ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#D91278]">
            <Flame className="h-4 w-4" aria-hidden />
            {streakWeeks} {streakWeeks === 1 ? "uke" : "uker"} streak
          </p>
        ) : null}
      </div>
    </section>
  );
}
