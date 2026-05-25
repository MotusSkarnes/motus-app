import { ChevronRight, Sparkles, Trophy } from "lucide-react";

type MemberProgressStatusBannerProps = {
  workoutsLast7Days: number;
  trainingDaysLast7Days: number;
  onSeeDetails?: () => void;
};

function buildBannerCopy(workouts: number, days: number): {
  headline: string;
  subline: string;
  positive: boolean;
  hot: boolean;
} {
  if (workouts <= 0) {
    return {
      headline: "Klar for en ny uke",
      subline: "Logg første økt for å komme i gang.",
      positive: false,
      hot: false,
    };
  }
  const sublineDays = days > 0 ? `${workouts} økter på ${days} dager siste uke` : `${workouts} økter siste 7 dager`;
  if (workouts >= 5) {
    return { headline: "Sterkeste uke på lenge!", subline: sublineDays, positive: true, hot: true };
  }
  if (workouts >= 3) {
    return { headline: "Solid uke!", subline: sublineDays, positive: true, hot: false };
  }
  return { headline: "Du er på vei", subline: sublineDays, positive: true, hot: false };
}

export function MemberProgressStatusBanner({
  workoutsLast7Days,
  trainingDaysLast7Days,
  onSeeDetails,
}: MemberProgressStatusBannerProps) {
  const { headline, subline, positive, hot } = buildBannerCopy(workoutsLast7Days, trainingDaysLast7Days);

  const inner = (
    <>
      <span className="motus-progress-status-banner-icon" aria-hidden>
        {positive ? (
          <Trophy className="h-4 w-4" strokeWidth={2.5} />
        ) : (
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        )}
      </span>
      <div className="motus-progress-status-banner-body">
        <p className="motus-progress-status-banner-headline">
          {headline}
          {hot ? (
            <span className="motus-progress-status-banner-headline-emoji" aria-hidden>
              {" "}🔥
            </span>
          ) : null}
        </p>
        <p className="motus-progress-status-banner-subline">{subline}</p>
      </div>
      {onSeeDetails ? <ChevronRight className="motus-progress-status-banner-chevron h-4 w-4" aria-hidden /> : null}
    </>
  );

  const className = `motus-progress-status-banner ${
    positive
      ? hot
        ? "motus-progress-status-banner--hot"
        : "motus-progress-status-banner--positive"
      : "motus-progress-status-banner--neutral"
  }`;

  if (onSeeDetails) {
    return (
      <button type="button" className={`${className} motus-pressable`} onClick={onSeeDetails}>
        {inner}
      </button>
    );
  }

  return <section className={className}>{inner}</section>;
}

export type { MemberProgressStatusBannerProps };
