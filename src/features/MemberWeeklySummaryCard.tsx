import { Share2, Sparkles } from "lucide-react";
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

export function MemberWeeklySummaryCard({ stats, playfulLine, logoSrc, onShare, shareStatus }: MemberWeeklySummaryCardProps) {
  return (
    <section className="motus-progress-weekly-summary">
      <div className="motus-progress-weekly-summary-media motus-image-frame">
        <img
          src={PROGRESS_WEEKLY_SUMMARY_IMAGE}
          alt=""
          className="motus-image-media"
          loading="lazy"
          style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_WEEKLY_SUMMARY_IMAGE) }}
        />
        <div className="motus-progress-weekly-summary-media-overlay" aria-hidden />
      </div>

      <div className="motus-progress-weekly-summary-content">
        <img src={logoSrc} alt="" className="motus-progress-weekly-summary-logo" aria-hidden />

        <span className="motus-section-label inline-flex items-center gap-1.5 text-[#0d9488]">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ukesoppsummering
        </span>

        <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Ukesoppsummering</h3>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">Siste 7 dager — delbart kort med tall og løftefakta.</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "Mine økter", v: String(stats.workouts) },
            { k: "Treningsdager", v: String(stats.trainingDays) },
            { k: "Mine sett", v: String(stats.completedSets) },
            { k: "Mitt volum", v: `${Math.round(stats.volumeKg).toLocaleString("nb-NO")} kg` },
          ].map((cell) => (
            <div key={cell.k} className="rounded-xl bg-slate-50 px-3 py-2.5 text-left">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{cell.k}</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">{cell.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-left">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Løftefakta</div>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-700">{playfulLine}</p>
        </div>

        <p className="mt-3 text-[13px] text-slate-500">
          Siste 7 dager: {stats.workouts} økter fordelt på {stats.trainingDays} treningsdager.
        </p>

        <GradientButton type="button" onClick={onShare} className="mt-4 w-full gap-2 sm:w-auto">
          <Share2 className="h-4 w-4 shrink-0" aria-hidden />
          Last ned eller del bilde
        </GradientButton>
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
