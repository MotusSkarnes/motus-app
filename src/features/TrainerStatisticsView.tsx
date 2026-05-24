import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarRange,
  ChevronRight,
  Flame,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import { MOTUS } from "../app/data";
import type {
  ActivityDayPoint,
  StatsBusinessKpi,
  StatsFollowUpClient,
  StatsKpi,
  StatsPeriodPreset,
  StatsProgramSlice,
  StatsProgressClient,
  StatsTopExercise,
  StatsTrend,
  TrainerStatisticsData,
} from "../app/buildTrainerStatisticsData";

type TrainerStatisticsViewProps = {
  data: TrainerStatisticsData;
  periodPreset: StatsPeriodPreset;
  onPeriodPresetChange: (preset: StatsPeriodPreset) => void;
  onOpenClient: (memberId: string) => void;
  onOpenCustomers: () => void;
  onOpenPrograms: () => void;
  onOpenExerciseBank: () => void;
};

const PERIOD_OPTIONS: Array<{ id: StatsPeriodPreset; label: string }> = [
  { id: "30d", label: "Siste 30 dager" },
  { id: "month", label: "Denne måneden" },
  { id: "7d", label: "Siste 7 dager" },
];

function toneColor(tone: StatsKpi["tone"]): string {
  if (tone === "emerald") return "#10B981";
  if (tone === "rose") return "#F43F5E";
  if (tone === "purple") return "#8B5CF6";
  return "#6366F1";
}

function TrendBadge({ trend }: { trend: StatsTrend }) {
  const Icon = trend.direction === "down" ? TrendingDown : TrendingUp;
  const className =
    trend.tone === "positive"
      ? "motus-trainer-stats-trend motus-trainer-stats-trend--positive"
      : trend.tone === "negative"
        ? "motus-trainer-stats-trend motus-trainer-stats-trend--negative"
        : "motus-trainer-stats-trend";
  return (
    <span className={className}>
      {trend.direction !== "neutral" ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {trend.deltaLabel}
    </span>
  );
}

function ClientAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div className="motus-trainer-stats-avatar" aria-hidden>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <UserRound className="h-4 w-4 text-slate-400" />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const max = Math.max(1, ...series);
  const width = 88;
  const height = 36;
  const padding = 4;
  const coords = series.map((value, index) => {
    const x = padding + (index / Math.max(1, series.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / max) * (height - padding * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-trainer-stats-sparkline" aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

function ProgressRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  return (
    <svg width={size} height={size} className="motus-trainer-stats-ring" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="4" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function KpiCard({ kpi }: { kpi: StatsKpi }) {
  const color = toneColor(kpi.tone);
  return (
    <article className="motus-trainer-stats-kpi-card">
      <div className="motus-trainer-stats-kpi-head">
        <span className="motus-trainer-stats-kpi-label">{kpi.label}</span>
        <TrendBadge trend={kpi.trend} />
      </div>
      <div className="motus-trainer-stats-kpi-value">{kpi.value}</div>
      <p className="motus-trainer-stats-kpi-sub">{kpi.sublabel}</p>
      <div className="motus-trainer-stats-kpi-visual">
        {kpi.chartKind === "sparkline" && kpi.chartSeries?.length ? (
          <Sparkline series={kpi.chartSeries} color={color} />
        ) : null}
        {kpi.chartKind === "ring" ? <ProgressRing pct={kpi.ringPct ?? 0} color={color} /> : null}
      </div>
    </article>
  );
}

function ActivityChart({ points }: { points: ActivityDayPoint[] }) {
  if (!points.length) return null;
  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 44, bottom: 28, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxSessions = Math.max(1, ...points.map((point) => point.sessions));
  const step = points.length > 1 ? chartW / (points.length - 1) : chartW;

  const sessionCoords = points.map((point, index) => {
    const x = padding.left + index * step;
    const y = padding.top + chartH - (point.sessions / maxSessions) * chartH;
    return { x, y };
  });
  const completionCoords = points.map((point, index) => {
    const x = padding.left + index * step;
    const y = padding.top + chartH - (point.completionPct / 100) * chartH;
    return { x, y };
  });
  const activeCoords = points.map((point, index) => {
    const x = padding.left + index * step;
    const maxClients = Math.max(1, ...points.map((row) => row.activeClients));
    const y = padding.top + chartH - (point.activeClients / maxClients) * chartH;
    return { x, y };
  });

  const toPath = (coords: Array<{ x: number; y: number }>) =>
    coords.length ? `M ${coords.map((point) => `${point.x},${point.y}`).join(" L ")}` : "";
  const toArea = (coords: Array<{ x: number; y: number }>) => {
    if (!coords.length) return "";
    const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
    const baseY = padding.top + chartH;
    return `${coords[0].x},${baseY} ${line} ${coords[coords.length - 1].x},${baseY}`;
  };

  const xLabels = [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="motus-trainer-stats-activity-chart" role="img" aria-label="Aktivitet siste 30 dager">
      <defs>
        <linearGradient id="motusStatsSessionsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MOTUS.turquoise} stopOpacity="0.28" />
          <stop offset="100%" stopColor={MOTUS.turquoise} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + chartH * ratio}
          y2={padding.top + chartH * ratio}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="1"
        />
      ))}
      <polygon points={toArea(sessionCoords)} fill="url(#motusStatsSessionsFill)" />
      <path d={toPath(sessionCoords)} fill="none" stroke={MOTUS.turquoise} strokeWidth="2.5" strokeLinecap="round" />
      <path d={toPath(completionCoords)} fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      <path d={toPath(activeCoords)} fill="none" stroke={MOTUS.pink} strokeWidth="2" strokeLinecap="round" />
      {xLabels.map((index) => (
        <text
          key={points[index].key}
          x={padding.left + index * step}
          y={height - 8}
          textAnchor="middle"
          className="motus-trainer-stats-chart-axis"
        >
          {points[index].label}
        </text>
      ))}
    </svg>
  );
}

function DonutChart({ slices }: { slices: StatsProgramSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) {
    return <div className="motus-trainer-stats-empty-chart">Ingen programdata ennå</div>;
  }
  const size = 140;
  const radius = 52;
  const stroke = 18;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="motus-trainer-stats-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <circle r={radius} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth={stroke} />
          {slices.map((slice) => {
            const pct = slice.value / total;
            const dash = pct * circumference;
            const circle = (
              <circle
                key={slice.id}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90)"
              />
            );
            offset += dash;
            return circle;
          })}
        </g>
      </svg>
      <ul className="motus-trainer-stats-donut-legend">
        {slices.map((slice) => (
          <li key={slice.id}>
            <span className="motus-trainer-stats-donut-dot" style={{ background: slice.color }} aria-hidden />
            <span>{slice.label}</span>
            <strong>{slice.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BusinessCard({ kpi }: { kpi: StatsBusinessKpi }) {
  const color = toneColor(kpi.tone);
  return (
    <article className="motus-trainer-stats-business-card">
      <span className="motus-trainer-stats-business-label">{kpi.label}</span>
      <span className="motus-trainer-stats-business-value">{kpi.value}</span>
      <span className="motus-trainer-stats-business-sub">{kpi.sublabel}</span>
      <TrendBadge trend={kpi.trend} />
      {kpi.ringPct !== undefined ? (
        <ProgressRing pct={kpi.ringPct} color={color} size={36} />
      ) : kpi.chartSeries?.length ? (
        <Sparkline series={kpi.chartSeries} color={color} />
      ) : null}
    </article>
  );
}

function riskClass(level: StatsFollowUpClient["riskLevel"]): string {
  if (level === "HØY") return "motus-trainer-stats-risk motus-trainer-stats-risk--high";
  if (level === "MEDIUM") return "motus-trainer-stats-risk motus-trainer-stats-risk--medium";
  return "motus-trainer-stats-risk motus-trainer-stats-risk--low";
}

export function TrainerStatisticsView({
  data,
  periodPreset,
  onPeriodPresetChange,
  onOpenClient,
  onOpenCustomers,
  onOpenPrograms,
  onOpenExerciseBank,
}: TrainerStatisticsViewProps) {
  const maxExerciseCount = Math.max(1, ...data.topExercises.map((row) => row.sessionCount));

  return (
    <div className="motus-trainer-stats space-y-6">
      <header className="motus-trainer-stats-header">
        <div>
          <h2 className="motus-trainer-stats-title">Statistikk</h2>
          <p className="motus-trainer-stats-subtitle">Oversikt over klienter, aktivitet og innhold.</p>
        </div>
        <div className="motus-trainer-stats-controls">
          <label className="motus-trainer-stats-control">
            <CalendarRange className="h-4 w-4 text-slate-500" aria-hidden />
            <select
              value={periodPreset}
              onChange={(event) => onPeriodPresetChange(event.target.value as StatsPeriodPreset)}
              aria-label="Velg periode"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.id === periodPreset ? data.periodLabel : option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="motus-trainer-stats-comparison">{data.comparisonLabel}</span>
        </div>
      </header>

      <section className="motus-trainer-stats-kpi-grid" aria-label="Nøkkeltall">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="motus-trainer-stats-panel lg:col-span-8">
          <div className="motus-trainer-stats-panel-head">
            <h3>Aktivitet siste 30 dager</h3>
            <div className="motus-trainer-stats-legend">
              <span><i style={{ background: MOTUS.turquoise }} />Økter</span>
              <span><i style={{ background: "#8B5CF6" }} />Fullføringsgrad %</span>
              <span><i style={{ background: MOTUS.pink }} />Klienter aktive</span>
            </div>
          </div>
          <ActivityChart points={data.activitySeries} />
        </article>

        <article className="motus-trainer-stats-panel lg:col-span-4">
          <div className="motus-trainer-stats-panel-head">
            <h3>Krever oppfølging</h3>
            <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden />
          </div>
          {data.followUpClients.length ? (
            <ul className="motus-trainer-stats-followup-list">
              {data.followUpClients.map((client) => (
                <li key={client.memberId}>
                  <button type="button" className="motus-trainer-stats-followup-row" onClick={() => onOpenClient(client.memberId)}>
                    <ClientAvatar name={client.name} avatarUrl={client.avatarUrl} />
                    <div className="min-w-0 flex-1 text-left">
                      <span className="motus-trainer-stats-followup-name">{client.name}</span>
                      <span className="motus-trainer-stats-followup-reason">{client.reason}</span>
                    </div>
                    <span className={riskClass(client.riskLevel)}>{client.riskLevel}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="motus-trainer-stats-empty">Ingen klienter trenger oppfølging akkurat nå.</p>
          )}
          <button type="button" className="motus-trainer-stats-link" onClick={onOpenCustomers}>
            Se alle klienter
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="motus-trainer-stats-panel lg:col-span-4">
          <h3>Mest fremgang denne måneden</h3>
          {data.progressClients.length ? (
            <ul className="motus-trainer-stats-progress-list">
              {data.progressClients.map((client) => (
                <li key={client.memberId}>
                  <button type="button" className="motus-trainer-stats-progress-row" onClick={() => onOpenClient(client.memberId)}>
                    <ClientAvatar name={client.name} avatarUrl={client.avatarUrl} />
                    <span className="motus-trainer-stats-progress-name">{client.name.split(" ")[0]}</span>
                    <span className="motus-trainer-stats-progress-bar-wrap">
                      <span
                        className={`motus-trainer-stats-progress-bar motus-trainer-stats-progress-bar--${client.tone}`}
                        style={{ width: `${client.progressPct}%` }}
                      />
                    </span>
                    <span className="motus-trainer-stats-progress-label">{client.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="motus-trainer-stats-empty">Ingen fremgangsdata ennå.</p>
          )}
        </article>

        <article className="motus-trainer-stats-panel lg:col-span-4">
          <h3>Mest brukte øvelser</h3>
          {data.topExercises.length ? (
            <ul className="motus-trainer-stats-exercise-list">
              {data.topExercises.map((exercise) => (
                <li key={exercise.id}>
                  <span className="motus-trainer-stats-exercise-name">{exercise.name}</span>
                  <span className="motus-trainer-stats-exercise-bar-wrap">
                    <span
                      className="motus-trainer-stats-exercise-bar"
                      style={{ width: `${Math.round((exercise.sessionCount / maxExerciseCount) * 100)}%` }}
                    />
                  </span>
                  <span className="motus-trainer-stats-exercise-count">{exercise.sessionCount} økter</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="motus-trainer-stats-empty">Ingen øvelsesdata ennå.</p>
          )}
          <button type="button" className="motus-trainer-stats-link" onClick={onOpenExerciseBank}>
            Åpne øvelsesbank
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </article>

        <article className="motus-trainer-stats-panel lg:col-span-4">
          <h3>Programanalyse</h3>
          <DonutChart slices={data.programSlices} />
          <button type="button" className="motus-trainer-stats-link" onClick={onOpenPrograms}>
            Se alle programmer
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <article className="motus-trainer-stats-panel lg:col-span-6">
          <h3>Gamification</h3>
          <div className="motus-trainer-stats-gamification-grid">
            <div className="motus-trainer-stats-gamification-card">
              <Award className="h-5 w-5 text-[#8B5CF6]" aria-hidden />
              <span className="motus-trainer-stats-gamification-value">{data.gamification.totalBadgesUnlocked}</span>
              <span className="motus-trainer-stats-gamification-label">Totalt badges låst opp</span>
            </div>
            <div className="motus-trainer-stats-gamification-card">
              <Flame className="h-5 w-5 text-[#F59E0B]" aria-hidden />
              <span className="motus-trainer-stats-gamification-value">{data.gamification.longestStreakDays} dager</span>
              <span className="motus-trainer-stats-gamification-label">
                Lengste streak · {data.gamification.longestStreakClientName}
              </span>
            </div>
            <div className="motus-trainer-stats-gamification-card">
              <Trophy className="h-5 w-5 text-[#10B981]" aria-hidden />
              <span className="motus-trainer-stats-gamification-value">{data.gamification.mostActiveSessionCount} økter</span>
              <span className="motus-trainer-stats-gamification-label">Mest aktive · {data.gamification.mostActiveClientName}</span>
            </div>
          </div>
        </article>

        <article className="motus-trainer-stats-panel lg:col-span-6">
          <div className="motus-trainer-stats-panel-head">
            <h3>Business innsikt</h3>
            <BarChart3 className="h-4 w-4 text-slate-500" aria-hidden />
          </div>
          <div className="motus-trainer-stats-business-grid">
            {data.businessKpis.map((kpi) => (
              <BusinessCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
          <p className="motus-trainer-stats-footnote">Omsetning er estimert basert på medlemstype og aktiv status.</p>
        </article>
      </section>
    </div>
  );
}
