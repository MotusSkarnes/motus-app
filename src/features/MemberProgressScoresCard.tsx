import { MOTUS } from "../app/data";
import type { MemberProgressScores } from "../app/memberMomentumScores";

type MemberProgressScoresCardProps = {
  scores: MemberProgressScores;
};

function ScoreTile({ label, value, subline }: { label: string; value: string; subline: string }) {
  return (
    <div className="rounded-xl border bg-white p-3 sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums tracking-tight text-slate-950 sm:text-3xl">{value}</div>
      <p className="mt-1 text-xs leading-snug text-slate-600">{subline}</p>
    </div>
  );
}

export function MemberProgressScoresCard({ scores }: MemberProgressScoresCardProps) {
  const { momentum, consistency, weekly, recovery, xp } = scores;

  return (
    <section className="space-y-3">
      <div
        className="relative overflow-hidden rounded-2xl border p-4 sm:p-5"
        style={{
          borderColor: "rgba(48,227,190,0.22)",
          background:
            "linear-gradient(135deg, rgba(48,227,190,0.12) 0%, rgba(255,255,255,0.98) 48%, rgba(217,18,120,0.08) 100%)",
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800">Momentum</p>
            <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-slate-950 sm:text-5xl">{momentum.pct}%</p>
            <p className="mt-1 max-w-md text-sm font-medium text-slate-700">{momentum.subline}</p>
          </div>
          <div className="min-w-[8rem] rounded-xl bg-white/80 px-3 py-2 text-right shadow-sm ring-1 ring-white/90">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nivå {xp.level}</p>
            <p className="text-sm font-bold text-slate-900">{xp.levelLabel}</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{xp.totalXp.toLocaleString("nb-NO")} XP</p>
          </div>
        </div>
        <div className="motus-progress-track mt-4 h-2 rounded-full">
          <div
            className="motus-progress-fill h-2 rounded-full"
            style={{
              width: `${momentum.pct}%`,
              background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
            }}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>XP til neste nivå</span>
            <span className="tabular-nums">
              {xp.xpInLevel}/{xp.xpForNextLevel}
            </span>
          </div>
          <div className="motus-progress-track mt-1.5 h-1.5 rounded-full">
            <div
              className="motus-progress-fill h-1.5 rounded-full"
              style={{
                width: `${xp.pctToNext}%`,
                background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        <ScoreTile label="Consistency" value={`${consistency.pct}%`} subline={consistency.subline} />
        <ScoreTile label="Uke-score" value={`${weekly.score}/${weekly.maxScore}`} subline={weekly.subline} />
        <ScoreTile
          label="Recovery"
          value={recovery.pct === null ? "—" : `${recovery.pct}%`}
          subline={recovery.subline}
        />
      </div>
    </section>
  );
}
