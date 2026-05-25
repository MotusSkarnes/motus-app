import { Check, Sparkles } from "lucide-react";

type MemberProgressStatusBannerProps = {
  workoutsLast7Days: number;
  trainingDaysLast7Days: number;
  onSeeDetails?: () => void;
};

function buildBannerCopy(workouts: number, days: number): { headline: string; subline: string; positive: boolean } {
  if (workouts <= 0) {
    return {
      headline: "Klar for en ny uke",
      subline: "Logg første økt for å komme i gang.",
      positive: false,
    };
  }
  const sublineDays = days > 0 ? `${workouts} økter på ${days} dager siste uke` : `${workouts} økter siste 7 dager`;
  if (workouts >= 5) {
    return { headline: "Sterkeste uke på lenge!", subline: sublineDays, positive: true };
  }
  if (workouts >= 3) {
    return { headline: "Solid uke!", subline: sublineDays, positive: true };
  }
  return { headline: "Du er på vei", subline: sublineDays, positive: true };
}

export function MemberProgressStatusBanner({
  workoutsLast7Days,
  trainingDaysLast7Days,
  onSeeDetails,
}: MemberProgressStatusBannerProps) {
  const { headline, subline, positive } = buildBannerCopy(workoutsLast7Days, trainingDaysLast7Days);

  return (
    <section
      className={`motus-progress-status-banner ${positive ? "motus-progress-status-banner--positive" : "motus-progress-status-banner--neutral"}`}
    >
      <span className="motus-progress-status-banner-icon" aria-hidden>
        {positive ? <Check className="h-4 w-4" strokeWidth={3} /> : <Sparkles className="h-4 w-4" strokeWidth={2.25} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="motus-progress-status-banner-headline">{headline}</p>
        <p className="motus-progress-status-banner-subline">{subline}</p>
      </div>
      {onSeeDetails ? (
        <button type="button" className="motus-progress-status-banner-link" onClick={onSeeDetails}>
          Se detaljer
        </button>
      ) : null}
    </section>
  );
}

export type { MemberProgressStatusBannerProps };
