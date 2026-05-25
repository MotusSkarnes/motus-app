import { Flame } from "lucide-react";
import type { RecentStreakWeek } from "../app/memberProgressGamification";

type MemberProgressHighlightRowProps = {
  streakWeeks: number;
  recentStreakWeeks: RecentStreakWeek[];
  personalRecordsCount: number;
};

function computeBestStreakWeeks(weeks: RecentStreakWeek[]): number {
  let best = 0;
  let current = 0;
  for (const week of weeks) {
    if (week.trained) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

function streakUnitLabel(streakWeeks: number): string {
  return streakWeeks === 1 ? "ukers streak" : "ukers streak";
}

function bestStreakSubline(streakWeeks: number, bestStreakWeeks: number): string {
  if (bestStreakWeeks <= 0) return "Din første streak er i gang!";
  if (streakWeeks >= bestStreakWeeks) return "Ny personlig rekord!";
  return `Din beste: ${bestStreakWeeks} uker`;
}

function buildPersonalRecordMessage(personalRecordsCount: number): { headline: string; emoji: string } {
  if (personalRecordsCount <= 0) {
    return { headline: "Klar for første personlige rekord!", emoji: "🎯" };
  }
  if (personalRecordsCount === 1) {
    return { headline: "Du har satt din første personlige rekord!", emoji: "🎉" };
  }
  return { headline: `Du har ${personalRecordsCount} personlige rekorder!`, emoji: "🎉" };
}

export function MemberProgressHighlightRow({
  streakWeeks,
  recentStreakWeeks,
  personalRecordsCount,
}: MemberProgressHighlightRowProps) {
  const bestStreakWeeks = computeBestStreakWeeks(recentStreakWeeks);
  const effectiveBest = Math.max(bestStreakWeeks, streakWeeks);
  const prMessage = buildPersonalRecordMessage(personalRecordsCount);

  return (
    <div className="motus-progress-highlight-row">
      <div className="motus-progress-highlight-card motus-progress-highlight-card--streak">
        <span className="motus-progress-highlight-card-icon">
          <Flame className="h-5 w-5" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="motus-progress-highlight-card-value">
            {streakWeeks}
            <span className="motus-progress-highlight-card-unit">{streakUnitLabel(streakWeeks)}</span>
          </p>
          <p className="motus-progress-highlight-card-subline">{bestStreakSubline(streakWeeks, effectiveBest)}</p>
        </div>
      </div>

      <div className="motus-progress-highlight-card motus-progress-highlight-card--pr">
        <div className="min-w-0 flex-1">
          <p className="motus-progress-highlight-card-headline">{prMessage.headline}</p>
        </div>
        <span className="motus-progress-highlight-card-emoji" aria-hidden>{prMessage.emoji}</span>
      </div>
    </div>
  );
}

export type { MemberProgressHighlightRowProps };
