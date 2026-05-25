import { useMemo } from "react";
import { Check } from "lucide-react";
import type { WorkoutLog } from "../app/types";

type MemberConsistencyWeekCardProps = {
  completedLogs: WorkoutLog[];
  nowTimestamp: number;
  onSeeHistory?: () => void;
};

const DAY_LABELS_SHORT: ReadonlyArray<string> = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Returns local midnight of the Monday that starts the current week (week starts Monday). */
function startOfIsoWeek(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseLogDate(raw: string): Date | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function MemberConsistencyWeekCard({ completedLogs, nowTimestamp, onSeeHistory }: MemberConsistencyWeekCardProps) {
  const weekDays = useMemo(() => {
    const monday = startOfIsoWeek(nowTimestamp);
    const trainedLogDates = completedLogs
      .filter((log) => log.status === "Fullført")
      .map((log) => parseLogDate(log.date))
      .filter((date): date is Date => date !== null);

    return Array.from({ length: 7 }, (_, index) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + index);
      const trained = trainedLogDates.some((logDate) => isSameLocalDay(logDate, dayDate));
      const isFuture = dayDate.getTime() > nowTimestamp;
      const isToday = isSameLocalDay(dayDate, new Date(nowTimestamp));
      return {
        label: DAY_LABELS_SHORT[index],
        trained,
        isFuture,
        isToday,
      };
    });
  }, [completedLogs, nowTimestamp]);

  return (
    <section className="motus-progress-consistency-card">
      <div className="motus-progress-consistency-card-header">
        <h3 className="motus-progress-consistency-card-title">Kontinuitet</h3>
        {onSeeHistory ? (
          <button type="button" className="motus-progress-consistency-card-link" onClick={onSeeHistory}>
            Siste 8 uker
          </button>
        ) : (
          <span className="motus-progress-consistency-card-link motus-progress-consistency-card-link--static">Siste 8 uker</span>
        )}
      </div>
      <ul className="motus-progress-consistency-week" role="list">
        {weekDays.map((day, index) => {
          const stateClass = day.trained
            ? "motus-progress-consistency-dot--trained"
            : day.isFuture
              ? "motus-progress-consistency-dot--future"
              : "motus-progress-consistency-dot--missed";
          return (
            <li key={index} className="motus-progress-consistency-day">
              <span className={`motus-progress-consistency-label ${day.isToday ? "motus-progress-consistency-label--today" : ""}`}>
                {day.label}
              </span>
              <span className={`motus-progress-consistency-dot ${stateClass}`} aria-label={day.trained ? `${day.label}: trent` : `${day.label}: ikke trent`}>
                {day.trained ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type { MemberConsistencyWeekCardProps };
