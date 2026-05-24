import type { LucideIcon } from "lucide-react";
import { Activity, BarChart3, BicepsFlexed, ChevronRight, Dumbbell, Footprints, Heart, PersonStanding, Shield } from "lucide-react";
import { MOTUS } from "../app/data";
import { EmptyState } from "../app/ui";
import type { MuscleGroupStat, MuscleSplitMetric, MuscleSplitPeriod } from "./muscleSplitStats";
import { formatMuscleSplitMetricValue, muscleSplitMetricValue } from "./muscleSplitStats";

type MuscleSplitCardProps = {
  stats: MuscleGroupStat[];
  metric: MuscleSplitMetric;
  period: MuscleSplitPeriod;
  onMetricChange: (metric: MuscleSplitMetric) => void;
  onPeriodChange: (period: MuscleSplitPeriod) => void;
  variant?: "default" | "v2";
};

const PERIOD_OPTIONS: { value: MuscleSplitPeriod; label: string }[] = [
  { value: 28, label: "4 uker" },
  { value: 90, label: "3 mnd" },
  { value: "all", label: "Alt" },
];

const MUSCLE_GROUP_ICONS: Record<string, LucideIcon> = {
  Bein: Footprints,
  Rygg: Activity,
  Bryst: Heart,
  Skuldre: PersonStanding,
  Biceps: BicepsFlexed,
  Triceps: Dumbbell,
  Mage: Shield,
  Core: Shield,
};

function segmentButtonClass(active: boolean): string {
  return active ? "motus-muscle-split-segment-btn motus-muscle-split-segment-btn--active" : "motus-muscle-split-segment-btn";
}

function MuscleGroupIcon({ group }: { group: string }) {
  const Icon = MUSCLE_GROUP_ICONS[group] ?? Dumbbell;
  return (
    <span className="motus-muscle-split-icon" aria-hidden>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  );
}

function MuscleSplitDonut({ group, share }: { group: string; share: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = `${(share / 100) * circumference} ${circumference}`;

  return (
    <div className="motus-progress-v2-muscle-donut" aria-hidden>
      <svg viewBox="0 0 88 88" className="h-full w-full">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="url(#motus-muscle-donut-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={dash}
          transform="rotate(-90 44 44)"
        />
        <defs>
          <linearGradient id="motus-muscle-donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#30e3be" />
            <stop offset="100%" stopColor="#d91278" />
          </linearGradient>
        </defs>
      </svg>
      <div className="motus-progress-v2-muscle-donut-center">
        <span className="motus-progress-v2-muscle-donut-group">{group}</span>
        <span className="motus-progress-v2-muscle-donut-value">{share}%</span>
        <span className="motus-progress-v2-muscle-donut-caption">Denne ukas fokusmuskel</span>
      </div>
    </div>
  );
}

export function MuscleSplitCard({
  stats,
  metric,
  period,
  onMetricChange,
  onPeriodChange,
  variant = "default",
}: MuscleSplitCardProps) {
  const isV2 = variant === "v2";
  const total = stats.reduce((sum, row) => sum + muscleSplitMetricValue(row, metric), 0);
  const max = Math.max(...stats.map((row) => muscleSplitMetricValue(row, metric)), 1);
  const topGroups = stats.slice(0, isV2 ? 6 : 10);
  const topGroup = topGroups[0];
  const topShare = topGroup && total > 0 ? Math.round((muscleSplitMetricValue(topGroup, metric) / total) * 100) : 0;

  return (
    <section className={isV2 ? "motus-progress-v2-section" : "motus-progress-section-card"}>
      <div className={isV2 ? "motus-progress-v2-section-head" : "flex flex-wrap items-start justify-between gap-3"}>
        <div className="flex items-start gap-2">
          {!isV2 ? (
            <div className="motus-muscle-split-header-icon shrink-0" aria-hidden>
              <BarChart3 className="h-4 w-4" strokeWidth={2.25} />
            </div>
          ) : null}
          <div className="min-w-0">
            <h3 className={isV2 ? "motus-progress-v2-section-title" : "text-base font-bold tracking-tight text-slate-900"}>
              Muskelsplitt
            </h3>
            {!isV2 ? <p className="mt-0.5 text-xs text-slate-500">Fordeling per muskelgruppe</p> : null}
          </div>
        </div>

        {isV2 ? (
          <span className="motus-progress-v2-section-link">
            Siste 4 uker
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <div className="motus-muscle-split-segment" role="group" aria-label="Visning">
            <button type="button" onClick={() => onMetricChange("sets")} className={segmentButtonClass(metric === "sets")}>
              Sett
            </button>
            <button type="button" onClick={() => onMetricChange("volume")} className={segmentButtonClass(metric === "volume")}>
              Volum
            </button>
          </div>
        )}
      </div>

      {topGroups.length === 0 ? (
        <EmptyState
          icon="📊"
          title="Ingen splitt ennå"
          description="Fullfør styrke- eller kondisjonsøkter med logging — da vises fordelingen per muskelgruppe her."
          className="mt-4 bg-slate-50/80"
        />
      ) : (
        <div className={isV2 ? "motus-progress-v2-muscle-layout" : ""}>
          <ul className={`motus-muscle-split-grid ${isV2 ? "motus-muscle-split-grid--v2" : "mt-3"}`}>
            {topGroups.map((row, index) => {
              const value = muscleSplitMetricValue(row, metric);
              const share = total > 0 ? Math.round((value / total) * 100) : 0;
              const width = Math.max(6, Math.round((value / max) * 100));
              const isTop = index === 0 && value > 0;

              return (
                <li key={row.group} className={`motus-muscle-split-row ${isTop ? "motus-muscle-split-row--active" : ""}`}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                      {!isV2 ? <MuscleGroupIcon group={row.group} /> : null}
                      <span className="truncate">{row.group}</span>
                    </span>
                    {!isV2 ? (
                      <span className="shrink-0 tabular-nums text-xs text-slate-500">
                        {formatMuscleSplitMetricValue(value, metric)}
                        <span className="ml-1 text-slate-400">({share}%)</span>
                      </span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-xs font-semibold text-slate-500">{share}%</span>
                    )}
                  </div>
                  <div className="motus-muscle-split-track">
                    <div
                      className="motus-muscle-split-fill"
                      style={{
                        width: `${width}%`,
                        background: isTop
                          ? MOTUS.gradient
                          : index % 2 === 0
                            ? `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.turquoise}99 100%)`
                            : `linear-gradient(90deg, ${MOTUS.pink}99 0%, ${MOTUS.pink} 100%)`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {isV2 && topGroup ? <MuscleSplitDonut group={topGroup.group} share={topShare} /> : null}
        </div>
      )}

      {!isV2 ? (
        <>
          <div className="motus-muscle-split-period mt-4" role="group" aria-label="Tidsperiode">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => onPeriodChange(option.value)}
                className={segmentButtonClass(period === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {stats.length > 10 ? <p className="mt-3 text-xs text-slate-500">Viser topp 10 av {stats.length} muskelgrupper i perioden.</p> : null}
        </>
      ) : null}
    </section>
  );
}
