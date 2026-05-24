import { Check, ChevronRight, Dumbbell, Flame, Play, Trophy, Zap } from "lucide-react";
import { MOTUS } from "../app/data";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import type { DailyWeekProgressPoint } from "../app/memberTrainingWeekChart";
import { STRENGTH_TRAINING_COVER_IMAGE } from "../app/programImage";
import { resolveProgressPersonalRecordImage } from "../app/progressImagery";
import type { Exercise } from "../app/types";
import { TrainingStartButton } from "../app/ui";
import { MotusFlameIcon } from "./MotusFlameIcon";
import type { PersonalRecordEntry } from "./MemberPersonalRecordsSection";

export type TrainingHeroAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  completed?: boolean;
};

export type TrainingPausedCard = {
  id: string;
  title: string;
  imageSrc: string | null;
  durationLabel: string;
  exerciseCountLabel: string;
  progressPct: number;
  onResume: () => void;
};

export type TrainingProgramPreview = {
  id: string;
  title: string;
  imageSrc: string | null;
  metaLabel: string;
  progressPct: number;
  onOpen: () => void;
};

type MemberTrainingOverviewProps = {
  title: string;
  imageSrc: string | null;
  durationLabel: string | null;
  zoneLabel: string | null;
  exerciseCountLabel: string | null;
  primaryAction?: TrainingHeroAction;
  completedHint?: string | null;
  completedSessions: number;
  momentumPct: number;
  streakWeeks: number;
  pausedWorkouts: TrainingPausedCard[];
  weeklyPoints: DailyWeekProgressPoint[];
  weeklyProgressPct: number;
  weeklyDeltaLabel: string | null;
  programs: TrainingProgramPreview[];
  onViewAllPrograms: () => void;
  records: PersonalRecordEntry[];
  exercises: Exercise[];
  onViewAllRecords: () => void;
  onOpenRecord: (name: string) => void;
};

function streakLabel(weeks: number): string {
  if (weeks <= 0) return "0 uker";
  if (weeks === 1) return "1 uke";
  return `${weeks} uker`;
}

function resolveRecordImage(name: string, exercises: Exercise[]): string {
  const progressPhoto = resolveProgressPersonalRecordImage(name);
  if (progressPhoto) return progressPhoto;
  const normalized = name.trim().toLowerCase();
  const match = exercises.find((exercise) => exercise.name.trim().toLowerCase() === normalized);
  if (match) return resolveExerciseImageSrc(match);
  return STRENGTH_TRAINING_COVER_IMAGE;
}

function WeeklyProgressChart({ points, currentPct }: { points: DailyWeekProgressPoint[]; currentPct: number }) {
  if (points.length === 0) return null;
  const width = 280;
  const height = 88;
  const paddingX = 8;
  const paddingY = 10;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const step = points.length > 1 ? chartWidth / (points.length - 1) : chartWidth;

  const coordinates = points.map((point, index) => {
    const x = paddingX + index * step;
    const y = paddingY + chartHeight - (point.pct / 100) * chartHeight;
    return { x, y, label: point.label };
  });
  const linePoints = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${paddingX},${paddingY + chartHeight} ${linePoints} ${paddingX + chartWidth},${paddingY + chartHeight}`;

  return (
    <div className="motus-training-week-chart">
      <div className="motus-training-week-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="motus-training-week-chart-svg" aria-hidden>
          <defs>
            <linearGradient id="motusTrainingWeekFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MOTUS.turquoise} stopOpacity="0.35" />
              <stop offset="100%" stopColor={MOTUS.turquoise} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((ratio) => (
            <line
              key={ratio}
              x1={paddingX}
              x2={width - paddingX}
              y1={paddingY + chartHeight * ratio}
              y2={paddingY + chartHeight * ratio}
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="1"
            />
          ))}
          <polygon points={areaPoints} fill="url(#motusTrainingWeekFill)" />
          <polyline
            fill="none"
            stroke={MOTUS.turquoise}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePoints}
          />
          {coordinates.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke={MOTUS.turquoise} strokeWidth="2" />
          ))}
        </svg>
        <div className="motus-training-week-chart-labels">
          {points.map((point) => (
            <span key={point.label}>{point.label}</span>
          ))}
        </div>
      </div>
      <div className="motus-training-week-chart-side">
        <span className="motus-training-week-chart-badge">{currentPct}%</span>
      </div>
    </div>
  );
}

export function MemberTrainingOverview({
  title,
  imageSrc,
  durationLabel,
  zoneLabel,
  exerciseCountLabel,
  primaryAction,
  completedHint,
  completedSessions,
  momentumPct,
  streakWeeks,
  pausedWorkouts,
  weeklyPoints,
  weeklyProgressPct,
  weeklyDeltaLabel,
  programs,
  onViewAllPrograms,
  records,
  exercises,
  onViewAllRecords,
  onOpenRecord,
}: MemberTrainingOverviewProps) {
  const heroMeta = [durationLabel, exerciseCountLabel, zoneLabel].filter(Boolean);

  return (
    <div className="motus-training-overview motus-fade-in-up">
      <article className="motus-training-hero motus-image-frame motus-image-frame--training-hero">
        {imageSrc ? (
          <img
            className="motus-training-hero-cover motus-image-media"
            src={imageSrc}
            alt=""
            loading="lazy"
            style={{ objectPosition: imageObjectPositionFromSrc(imageSrc) }}
          />
        ) : (
          <div className="motus-training-hero-cover motus-training-hero-cover--fallback" aria-hidden>
            <Dumbbell className="h-10 w-10 text-white/60" strokeWidth={1.5} />
          </div>
        )}
        <div className="motus-training-hero-overlay" aria-hidden />
        <div className="motus-training-hero-content">
          <p className="motus-training-hero-label">Dagens økt</p>
          <h2 className="motus-training-hero-title">{title}</h2>
          {heroMeta.length > 0 ? (
            <p className="motus-training-hero-meta">{heroMeta.join(" • ")}</p>
          ) : null}
          {primaryAction ? (
            <div className="motus-training-hero-cta">
              <TrainingStartButton
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className={`w-full sm:w-auto ${primaryAction.completed ? "motus-training-hero-cta--done" : ""}`}
              >
                {primaryAction.completed ? (
                  <Check className="h-4 w-4 text-white" aria-hidden />
                ) : (
                  <Play className="h-4 w-4 fill-white text-white" aria-hidden />
                )}
                {primaryAction.label}
              </TrainingStartButton>
              {primaryAction.completed && completedHint ? (
                <p className="motus-training-hero-next">{completedHint}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>

      <section className="motus-training-stat-grid" aria-label="Ukeoversikt">
        <div className="motus-training-stat-card">
          <span className="motus-training-stat-icon motus-training-stat-icon--teal">
            <Flame className="h-4 w-4" aria-hidden />
          </span>
          <span className="motus-training-stat-value">{completedSessions}</span>
          <span className="motus-training-stat-label">Økter</span>
        </div>
        <div className="motus-training-stat-card">
          <span className="motus-training-stat-icon motus-training-stat-icon--pink">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <span className="motus-training-stat-value">{momentumPct}%</span>
          <span className="motus-training-stat-label">Flyt</span>
        </div>
        <div className="motus-training-stat-card">
          <span className="motus-training-stat-icon motus-training-stat-icon--violet">
            <MotusFlameIcon className="h-4 w-4" title="" />
          </span>
          <span className="motus-training-stat-value">{streakLabel(streakWeeks)}</span>
          <span className="motus-training-stat-label">Streak</span>
        </div>
      </section>

      {pausedWorkouts.length > 0 ? (
        <section className="motus-training-section">
          <div className="motus-training-section-head">
            <h3 className="motus-training-section-title">Fortsett der du slapp</h3>
          </div>
          <div className="motus-training-scroll-row scrollbar-none">
            {pausedWorkouts.map((draft) => (
              <button key={draft.id} type="button" onClick={draft.onResume} className="motus-training-resume-card motus-pressable">
                <div className="motus-training-resume-media">
                  {draft.imageSrc ? (
                    <img src={draft.imageSrc} alt="" className="motus-image-media" loading="lazy" />
                  ) : (
                    <div className="motus-training-resume-fallback" aria-hidden />
                  )}
                  <span className="motus-training-resume-badge">{draft.durationLabel}</span>
                </div>
                <div className="motus-training-resume-body">
                  <div className="motus-training-resume-title">{draft.title}</div>
                  <div className="motus-training-resume-meta">{draft.exerciseCountLabel}</div>
                  <div className="motus-progress-track motus-training-resume-progress">
                    <div
                      className="motus-progress-fill"
                      style={{ width: `${draft.progressPct}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="motus-training-section">
        <div className="motus-training-section-head">
          <h3 className="motus-training-section-title">Ukens progresjon</h3>
        </div>
        <div className="motus-training-week-panel">
          <WeeklyProgressChart points={weeklyPoints} currentPct={weeklyProgressPct} />
          {weeklyDeltaLabel ? (
            <div className="motus-training-week-insight">
              <span className="motus-training-week-insight-icon" aria-hidden>
                <Trophy className="h-4 w-4" />
              </span>
              <div>
                <div className="motus-training-week-insight-title">Kjør på!</div>
                <div className="motus-training-week-insight-copy">{weeklyDeltaLabel}</div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {programs.length > 0 ? (
        <section className="motus-training-section">
          <div className="motus-training-section-head">
            <h3 className="motus-training-section-title">Dine programmer</h3>
            <button type="button" onClick={onViewAllPrograms} className="motus-training-section-link">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-training-scroll-row scrollbar-none">
            {programs.map((program) => (
              <button key={program.id} type="button" onClick={program.onOpen} className="motus-training-program-card motus-pressable">
                {program.imageSrc ? (
                  <img src={program.imageSrc} alt="" className="motus-training-program-cover motus-image-media" loading="lazy" />
                ) : (
                  <div className="motus-training-program-cover motus-training-program-cover--fallback" aria-hidden />
                )}
                <div className="motus-training-program-overlay" aria-hidden />
                <div className="motus-training-program-content">
                  <div className="motus-training-program-title">{program.title}</div>
                  <div className="motus-training-program-meta">{program.metaLabel}</div>
                  <div className="motus-progress-track motus-training-program-progress">
                    <div
                      className="motus-progress-fill"
                      style={{ width: `${program.progressPct}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {records.length > 0 ? (
        <section className="motus-training-section">
          <div className="motus-training-section-head">
            <h3 className="motus-training-section-title">Personlige rekorder</h3>
            <button type="button" onClick={onViewAllRecords} className="motus-training-section-link">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-training-scroll-row scrollbar-none">
            {records.map((record) => (
              <button
                key={record.name}
                type="button"
                onClick={() => onOpenRecord(record.name)}
                className="motus-training-pr-card motus-pressable"
              >
                <div className="motus-training-pr-image motus-image-frame">
                  <img
                    src={resolveRecordImage(record.name, exercises)}
                    alt=""
                    className="motus-image-media"
                    loading="lazy"
                    style={{ objectPosition: imageObjectPositionFromSrc(resolveRecordImage(record.name, exercises)) }}
                  />
                </div>
                <div className="motus-training-pr-name">{record.name}</div>
                <div className="motus-training-pr-weight">{record.weight} kg</div>
                {record.isNewRecord ? <div className="motus-training-pr-badge">Ny rekord!</div> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
