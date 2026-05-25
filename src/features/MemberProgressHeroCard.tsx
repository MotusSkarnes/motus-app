import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Shield, Target } from "lucide-react";
import { MOTUS } from "../app/data";
import type { ScoreTrend } from "../app/memberMomentumScores";
import { PROGRESS_HERO_IMAGE } from "../app/progressImagery";
import type { MemberProgressScores } from "../app/memberMomentumScores";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";

type MemberProgressHeroCardProps = {
  scores: MemberProgressScores;
  memberFirstName: string;
  streakWeeks: number;
};

function streakChipLabel(streakWeeks: number): string | null {
  if (streakWeeks <= 0) return null;
  if (streakWeeks === 1) return "1 uke på rad";
  return `${streakWeeks} uker på rad`;
}

function momentumTrendLabel(trend: ScoreTrend): string {
  if (trend === "up") return "Opp fra forrige uke";
  if (trend === "down") return "Under forrige uke";
  return "Jevn uke";
}

function MomentumTrendIcon({ trend }: { trend: ScoreTrend }) {
  if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-white/90" aria-hidden />;
  if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-white/90" aria-hidden />;
  return <ArrowRight className="h-3.5 w-3.5 text-white/70" aria-hidden />;
}

function MomentumSparkline({ points, trend }: { points: number[]; trend: ScoreTrend }) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const width = 76;
  const height = 32;
  const polylinePoints = points
    .map((value, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 8) + 4;
      const y = height - 5 - (value / max) * (height - 10);
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = trend === "down" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.95)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-progress-momentum-spark" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
    </svg>
  );
}

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
      <div className="relative mx-auto motus-progress-status-ring">
        <svg viewBox="0 0 88 88" className="h-full w-full" aria-hidden>
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
        <div className="motus-progress-status-value absolute inset-0 flex items-center justify-center font-bold tabular-nums text-slate-900">{value}</div>
      </div>
      <p className="motus-progress-status-label mt-1 font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="motus-progress-status-subline mt-0.5 line-clamp-2 text-slate-600">{subline}</p>
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
      <p className="motus-progress-status-stat-value mt-1 font-black tabular-nums tracking-tight text-slate-950">{value}</p>
      <p className="motus-progress-status-label mt-0.5 font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="motus-progress-status-subline mt-0.5 line-clamp-2 text-slate-600">{subline}</p>
    </div>
  );
}

export function MemberProgressHeroCard({ scores, memberFirstName, streakWeeks }: MemberProgressHeroCardProps) {
  const { momentum, consistency, weekly, recovery, xp } = scores;
  const streakLabel = streakChipLabel(streakWeeks);

  return (
    <section className="motus-progress-hero motus-fade-in-up">
      <div className="px-3 pt-3 sm:px-4 sm:pt-3.5">
        <h2 className="text-base font-bold tracking-tight text-slate-950">Hei {memberFirstName}! 👋</h2>
        <p className="text-xs text-slate-600">Her er din fremgang så langt</p>
      </div>

      <div className="motus-progress-hero-gradient">
        <div className="motus-progress-hero-gradient-inner">
          <div className="motus-progress-level-badge">
            <Shield className="h-5 w-5 text-white/90" strokeWidth={2.25} aria-hidden />
            <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-white/85">Nivå {xp.level}</span>
            <span className="mt-0.5 block text-xs font-black uppercase text-white">{xp.levelLabel}</span>
            <span className="mt-1 block text-[10px] font-semibold tabular-nums text-white/90">{xp.totalXp.toLocaleString("nb-NO")} XP</span>
          </div>

          <div className="motus-progress-momentum-hero min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/75">Flyt</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-2xl font-black tabular-nums tracking-tight text-white sm:text-3xl">{momentum.pct}%</p>
              <MomentumTrendIcon trend={momentum.trend} />
              <MomentumSparkline points={momentum.sparkPoints} trend={momentum.trend} />
            </div>
            <p className="mt-1 text-xs font-medium text-white/85">{momentum.subline || momentumTrendLabel(momentum.trend)}</p>
            {streakLabel ? (
              <span className="motus-progress-streak-chip">
                <span className="motus-progress-streak-chip-icon" aria-hidden>🔥</span>
                <span>{streakLabel}</span>
              </span>
            ) : null}
          </div>

          <div className="motus-progress-hero-portrait motus-image-frame">
            <img
              src={PROGRESS_HERO_IMAGE}
              alt=""
              className="motus-image-media"
              loading="lazy"
              style={{ objectPosition: imageObjectPositionFromSrc(PROGRESS_HERO_IMAGE) }}
            />
          </div>
        </div>

        <div className="motus-progress-hero-xp">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/90">
            <span>XP til neste nivå</span>
            <span className="tabular-nums">
              {xp.xpInLevel}/{xp.xpForNextLevel}
            </span>
          </div>
          <div className="motus-progress-hero-xp-track">
            <div className="motus-progress-hero-xp-fill" style={{ width: `${xp.pctToNext}%` }} />
          </div>
        </div>
      </div>

      <div className="motus-progress-status-grid">
        <h3 className="col-span-full text-xs font-semibold text-slate-900">Din status</h3>
        <ScoreRing label="Kontinuitet" value={`${consistency.pct}%`} subline={consistency.subline} pct={consistency.pct} tone="mint" />
        <StatHighlight
          label="Uke-score"
          value={`${weekly.score}/${weekly.maxScore}`}
          subline={weekly.subline}
          icon={<Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />}
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
