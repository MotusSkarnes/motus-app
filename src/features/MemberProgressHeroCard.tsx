import type { ReactNode } from "react";
import { Target } from "lucide-react";
import { MOTUS } from "../app/data";
import { PROGRESS_HERO_IMAGE } from "../app/progressImagery";
import type { MemberProgressScores } from "../app/memberMomentumScores";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { MotusFlameIcon } from "./MotusFlameIcon";

type MemberProgressHeroCardProps = {
  scores: MemberProgressScores;
  memberFirstName: string;
  streakWeeks: number;
};

function ScoreRing({
  label,
  value,
  subline,
  pct,
  tone = "mint",
}: {
  label: string;
  value: string;
  subline: string;
  pct: number | null;
  tone?: "mint" | "pink";
}) {
  const ringPct = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  const stroke = tone === "pink" ? MOTUS.pink : MOTUS.turquoise;
  const dash = `${Math.max(8, (ringPct / 100) * 226)} 226`;

  return (
    <div className="motus-progress-status-card">
      <div className="relative mx-auto h-16 w-16">
        <svg viewBox="0 0 88 88" className="h-16 w-16" aria-hidden>
          <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(15,23,42,0.08)" strokeWidth="6" />
          {pct !== null ? (
            <circle
              cx="44"
              cy="44"
              r="36"
              fill="none"
              stroke={stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={dash}
              transform="rotate(-90 44 44)"
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-slate-900">{value}</div>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{subline}</p>
    </div>
  );
}

function StatHighlight({
  label,
  value,
  subline,
  icon,
  tone = "pink",
}: {
  label: string;
  value: string;
  subline: string;
  icon: ReactNode;
  tone?: "mint" | "pink";
}) {
  return (
    <div className="motus-progress-status-card">
      <span className={`motus-progress-status-icon motus-progress-status-icon--${tone}`}>{icon}</span>
      <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{subline}</p>
    </div>
  );
}

export function MemberProgressHeroCard({ scores, memberFirstName, streakWeeks }: MemberProgressHeroCardProps) {
  const { momentum, consistency, weekly, recovery, xp } = scores;

  return (
    <section className="motus-progress-hero motus-fade-in-up">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">Hei {memberFirstName}! 👋</h2>
        <p className="mt-0.5 text-sm text-slate-600">Her er din fremgang så langt</p>
      </div>

      <div className="motus-progress-hero-main">
        <div className="motus-progress-hero-content">
          <div className="flex flex-wrap items-start gap-3">
            <span className="motus-progress-level-badge" aria-hidden>
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/85">Nivå {xp.level}</span>
              <span className="mt-0.5 block text-xs font-black uppercase text-white">{xp.levelLabel}</span>
              <span className="mt-1 block text-[10px] font-semibold tabular-nums text-white/90">{xp.totalXp.toLocaleString("nb-NO")} XP</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Momentum</p>
              <p className="mt-0.5 text-3xl font-black tabular-nums tracking-tight text-slate-950">{momentum.pct}%</p>
              <p className="mt-1 text-xs leading-snug text-slate-600">{momentum.subline}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span>XP til neste nivå</span>
              <span className="tabular-nums">
                {xp.xpInLevel}/{xp.xpForNextLevel}
              </span>
            </div>
            <div className="motus-progress-track h-2.5 rounded-full">
              <div
                className="motus-progress-fill h-2.5 rounded-full"
                style={{ width: `${xp.pctToNext}%`, background: MOTUS.gradient }}
              />
            </div>
          </div>
        </div>

        <div className="motus-progress-hero-media motus-image-frame motus-image-frame--portrait">
          <img
            src={PROGRESS_HERO_IMAGE}
            alt=""
            className="motus-image-media"
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_HERO_IMAGE) }}
          />
          <div className="motus-progress-hero-media-fade" aria-hidden />
        </div>
      </div>

      <div className="motus-progress-status-grid px-4 pb-4 sm:px-5 sm:pb-5">
        <h3 className="col-span-full text-sm font-semibold text-slate-900">Din status</h3>
        <ScoreRing label="Consistency" value={`${consistency.pct}%`} subline={consistency.subline} pct={consistency.pct} tone="mint" />
        <StatHighlight
          label="Streak"
          value={String(streakWeeks)}
          subline={streakWeeks === 1 ? "1 uke på rad" : `${streakWeeks} uker på rad`}
          icon={<MotusFlameIcon className="h-5 w-5" title="" />}
          tone="pink"
        />
        <StatHighlight
          label="Uke-score"
          value={`${weekly.score}/${weekly.maxScore}`}
          subline={weekly.subline}
          icon={<Target className="h-5 w-5" strokeWidth={2} />}
          tone="pink"
        />
        <ScoreRing
          label="Recovery"
          value={recovery.pct === null ? "—" : `${recovery.pct}%`}
          subline={recovery.subline}
          pct={recovery.pct}
          tone="pink"
        />
      </div>
    </section>
  );
}

export type { MemberProgressHeroCardProps };
