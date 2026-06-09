import type { CSSProperties } from "react";
import { CalendarCheck, Check, ChevronRight, Dumbbell, Flame, Play, Target } from "lucide-react";
import { MOTUS } from "../app/data";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { STRENGTH_TRAINING_COVER_IMAGE } from "../app/programImage";
import { resolveProgressExerciseDisplayName, resolveProgressPersonalRecordImage } from "../app/progressImagery";
import type { Exercise } from "../app/types";
import { TrainingStartButton } from "../app/ui";
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
  coverImageStyle?: CSSProperties;
  coverUsesPhotoStyle?: boolean;
  metaLabel: string;
  completedCount: number;
  onOpen: () => void;
};

function completedTimesLabel(count: number): string {
  if (count <= 0) return "Ikke fullført ennå";
  if (count === 1) return "1 gang fullført";
  return `${count} ganger fullført`;
}

type MemberTrainingOverviewProps = {
  title: string;
  imageSrc: string | null;
  coverImageStyle?: CSSProperties;
  coverUsesPhotoStyle?: boolean;
  durationLabel: string | null;
  zoneLabel: string | null;
  exerciseCountLabel: string | null;
  primaryAction?: TrainingHeroAction;
  completedHint?: string | null;
  completedSessions: number;
  streakWeeks: number;
  pausedWorkouts: TrainingPausedCard[];
  weeklyCompletedSessions: number;
  weeklyPlannedSessions: number;
  weeklyTarget?: number;
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

function sessionWord(count: number): string {
  return count === 1 ? "økt" : "økter";
}

function WeeklyPlanStatusCard({
  completed,
  planned,
  weeklyTarget,
}: {
  completed: number;
  planned: number;
  weeklyTarget?: number;
}) {
  const target = planned > 0 ? planned : weeklyTarget ?? 0;
  const remaining = Math.max(0, target - completed);
  const hasPtPlan = planned > 0;
  const hasTarget = target > 0;
  const Icon = hasPtPlan ? CalendarCheck : Target;

  let title = "Sett et ukemål";
  let statValue = "Mål";
  let statLabel = "ikke satt";
  let subline = "Ingen PT-plan er satt for uken. Sett et eget ukemål for å få en tydelig ukeoversikt.";
  let note = "Når PT legger inn en plan, bruker vi den automatisk som ukemål.";

  if (hasTarget) {
    statValue = `${completed}/${target}`;
    statLabel = "økter fullført";
    if (remaining === 0) {
      title = hasPtPlan ? "Du har fulgt PT-planen denne uken" : "Ukemålet er nådd";
      subline = hasPtPlan ? "Alle planlagte økter er fullført." : "Alle øktene i ukemålet er fullført.";
      note = "Fortsett sånn, og bruk neste økt til å holde rytmen videre.";
    } else if (completed === 0) {
      title = hasPtPlan ? "PT-planen er klar for uken" : "Ukemålet er klart";
      subline = `${remaining} ${sessionWord(remaining)} igjen ${hasPtPlan ? "i PT-planen" : "i ukemålet"} denne uken.`;
      note = "Start med neste planlagte økt når det passer.";
    } else {
      title = hasPtPlan ? "Du er i gang med PT-planen" : "Du er i gang med ukemålet";
      subline = `${remaining} ${sessionWord(remaining)} igjen ${hasPtPlan ? "i PT-planen" : "i ukemålet"} denne uken.`;
      note = "Fortsett med neste økt i planen.";
    }
  }

  return (
    <div className="motus-training-week-status">
      <div className="motus-training-week-status-main">
        <span className="motus-training-week-status-icon" aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="motus-training-week-status-title">{title}</div>
          <div className="motus-training-week-status-copy">{subline}</div>
        </div>
      </div>
      <div className="motus-training-week-status-stat" aria-label={`${statValue} ${statLabel}`}>
        <span className="motus-training-week-status-value">{statValue}</span>
        <span className="motus-training-week-status-label">{statLabel}</span>
      </div>
      <div className="motus-training-week-status-note">{note}</div>
    </div>
  );
}

export function MemberTrainingOverview({
  title,
  imageSrc,
  coverImageStyle,
  coverUsesPhotoStyle = false,
  durationLabel,
  zoneLabel,
  exerciseCountLabel,
  primaryAction,
  completedHint,
  completedSessions,
  streakWeeks,
  pausedWorkouts,
  weeklyCompletedSessions,
  weeklyPlannedSessions,
  weeklyTarget,
  programs,
  onViewAllPrograms,
  records,
  exercises,
  onViewAllRecords,
  onOpenRecord,
}: MemberTrainingOverviewProps) {
  const heroMeta = [durationLabel, exerciseCountLabel, zoneLabel].filter(Boolean);
  const weeklyStatTarget = weeklyPlannedSessions > 0 ? weeklyPlannedSessions : weeklyTarget ?? 0;
  const weeklyStatValue = weeklyStatTarget > 0 ? `${weeklyCompletedSessions}/${weeklyStatTarget}` : "Sett";
  const weeklyStatLabel = weeklyPlannedSessions > 0 ? "Plan" : "Ukemål";

  return (
    <div className="motus-training-overview motus-fade-in-up">
      <article className="motus-training-hero motus-training-hero--stacked">
        <div className="motus-member-program-thumb motus-image-frame">
          {imageSrc ? (
            <img
              className={`motus-member-program-cover motus-image-media${
                coverUsesPhotoStyle
                  ? " motus-member-program-cover--custom"
                  : " motus-member-program-cover--exercise"
              }`}
              src={imageSrc}
              alt=""
              loading="lazy"
              style={
                coverImageStyle ?? { objectPosition: imageObjectPositionFromSrc(imageSrc) }
              }
            />
          ) : (
            <div className="motus-member-program-thumb-fallback" aria-hidden>
              <Dumbbell className="h-10 w-10 text-slate-400" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="motus-training-hero-body">
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
          <span className="motus-training-stat-icon motus-training-stat-icon--pink">
            <Flame className="h-4 w-4" aria-hidden />
          </span>
          <span className="motus-training-stat-value">{completedSessions}</span>
          <span className="motus-training-stat-label">Økter</span>
        </div>
        <div className="motus-training-stat-card">
          <span className="motus-training-stat-icon motus-training-stat-icon--teal">
            <CalendarCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="motus-training-stat-value">{weeklyStatValue}</span>
          <span className="motus-training-stat-label">{weeklyStatLabel}</span>
        </div>
        <div className="motus-training-stat-card">
          <span className="motus-training-stat-icon motus-training-stat-icon--pink">
            <Flame className="h-4 w-4" strokeWidth={2.25} aria-hidden />
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

      {programs.length > 0 ? (
        <section className="motus-training-section">
          <div className="motus-training-section-head">
            <h3 className="motus-training-section-title">Dine programmer</h3>
            <button type="button" onClick={onViewAllPrograms} className="motus-training-section-link">
              Se alle
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div className="motus-training-scroll-row motus-training-scroll-row--program-previews scrollbar-none">
            {programs.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={program.onOpen}
                className="motus-training-program-card motus-training-program-card--stacked motus-pressable"
              >
                <div className="motus-member-program-thumb motus-image-frame">
                  {program.imageSrc ? (
                    <img
                      src={program.imageSrc}
                      alt=""
                      className={`motus-member-program-cover motus-image-media${
                        program.coverUsesPhotoStyle
                          ? " motus-member-program-cover--custom"
                          : " motus-member-program-cover--exercise"
                      }`}
                      loading="lazy"
                      style={
                        program.coverImageStyle ?? { objectPosition: imageObjectPositionFromSrc(program.imageSrc) }
                      }
                    />
                  ) : (
                    <div className="motus-member-program-thumb-fallback" aria-hidden />
                  )}
                </div>
                <div className="motus-training-program-body">
                  <div className="motus-training-program-title">{program.title}</div>
                  <div className="motus-training-program-meta">{program.metaLabel}</div>
                  <div className="motus-training-program-meta">{completedTimesLabel(program.completedCount)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="motus-training-section">
        <div className="motus-training-section-head">
          <h3 className="motus-training-section-title">Denne uken</h3>
        </div>
        <div className="motus-training-week-panel">
          <WeeklyPlanStatusCard
            completed={weeklyCompletedSessions}
            planned={weeklyPlannedSessions}
            weeklyTarget={weeklyTarget}
          />
        </div>
      </section>

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
            {records.map((record) => {
              const imageSrc = resolveRecordImage(record.name, exercises);
              const displayName = resolveProgressExerciseDisplayName(record.name);
              return (
                <button
                  key={record.name}
                  type="button"
                  onClick={() => onOpenRecord(record.name)}
                  className="motus-training-pr-card motus-pressable"
                >
                  <div className="motus-training-pr-image motus-image-frame">
                    <img
                      src={imageSrc}
                      alt=""
                      className="motus-image-media"
                      loading="lazy"
                      style={{ objectPosition: imageObjectPositionFromSrc(imageSrc) }}
                    />
                  </div>
                  <div className="motus-training-pr-name">{displayName}</div>
                  <div className="motus-training-pr-weight">{record.weight} kg</div>
                  {record.isNewRecord ? <div className="motus-training-pr-badge">Ny rekord!</div> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
