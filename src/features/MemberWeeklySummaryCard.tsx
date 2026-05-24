import { Share2 } from "lucide-react";
import { PROGRESS_WEEKLY_SUMMARY_IMAGE } from "../app/progressImagery";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { GradientButton, StatusMessage } from "../app/ui";

type WeeklySummaryStats = {
  workouts: number;
  trainingDays: number;
  completedSets: number;
  volumeKg: number;
};

type MemberWeeklySummaryCardProps = {
  stats: WeeklySummaryStats;
  playfulLine: string;
  logoSrc: string;
  onShare: () => void;
  shareStatus: string | null;
};

export function MemberWeeklySummaryCard({ stats, onShare, shareStatus }: MemberWeeklySummaryCardProps) {
  return (
    <section className="motus-progress-weekly-summary">
      <div className="motus-progress-weekly-summary-body">
        <div className="motus-progress-weekly-summary-media motus-image-frame shrink-0">
          <img
            src={PROGRESS_WEEKLY_SUMMARY_IMAGE}
            alt=""
            className="motus-image-media"
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_WEEKLY_SUMMARY_IMAGE) }}
          />
        </div>

        <div className="motus-progress-weekly-summary-content">
          <h3 className="text-base font-bold tracking-tight text-slate-950">Ukesoppsummering</h3>
          <p className="mt-0.5 text-xs text-slate-500">Siste 7 dager</p>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              { k: "Økter", v: String(stats.workouts) },
              { k: "Treningsdager", v: String(stats.trainingDays) },
              { k: "Sett", v: String(stats.completedSets) },
              { k: "Totalt løftet", v: `${Math.round(stats.volumeKg).toLocaleString("nb-NO")} kg` },
            ].map((cell) => (
              <div key={cell.k} className="motus-progress-weekly-stat">
                <div className="motus-progress-weekly-stat-value">{cell.v}</div>
                <div className="motus-progress-weekly-stat-label">{cell.k}</div>
              </div>
            ))}
          </div>

          <GradientButton type="button" onClick={onShare} className="mt-3 w-full gap-2">
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            Last ned eller del bilde
          </GradientButton>
        </div>
      </div>

      {shareStatus ? (
        <StatusMessage
          message={shareStatus}
          tone={shareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
          className="mx-4 mb-4 !rounded-xl !px-3 !py-2 !text-xs sm:mx-5"
        />
      ) : null}
    </section>
  );
}
