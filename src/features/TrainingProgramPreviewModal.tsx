import { X } from "lucide-react";
import {
  formatActivityDurationLabel,
  formatReflectionLevelForDisplay,
  isActivityWorkoutLog,
} from "../app/activityWorkoutLog";
import { MOTUS } from "../app/data";
import { formatProgramExercisePrescription, resolveProgramExerciseName } from "../app/programExercisePresentation";
import { buildPeriodPlanSessionReview } from "../app/periodPlanSessionReview";
import { EmptyState, GradientButton, OutlineButton } from "../app/ui";
import type { Exercise, TrainingProgram, WorkoutLog } from "../app/types";

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

type TrainingProgramPreviewModalProps = {
  program: TrainingProgram | null;
  open: boolean;
  onClose: () => void;
  exerciseLibrary: Exercise[];
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Når satt vises kundens logging ved siden av planen (trenervisning). */
  performedLog?: WorkoutLog | null;
  showCustomerPerformance?: boolean;
};

function completionLabel(log: WorkoutLog | null | undefined): string {
  if (!log) return "Ikke logget ennå";
  const results = log.results ?? [];
  if (results.length === 0) return "Logget";
  if (results.every((result) => result.completed)) return "Fullført";
  if (results.some((result) => result.completed)) return "Delvis fullført";
  return "Logget";
}

export function TrainingProgramPreviewModal({
  program,
  open,
  onClose,
  exerciseLibrary,
  primaryAction,
  performedLog = null,
  showCustomerPerformance = false,
}: TrainingProgramPreviewModalProps) {
  if (!open || !program) return null;

  const safeExercises = Array.isArray(program.exercises) ? program.exercises : [];
  const review = showCustomerPerformance
    ? buildPeriodPlanSessionReview({ program, log: performedLog, exerciseLibrary })
    : [];

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-program-preview-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 shrink-0" style={{ background: MOTUS_GRADIENT }} aria-hidden />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="min-w-0">
            <h2 id="training-program-preview-title" className="text-lg font-bold text-slate-950">
              {program.title}
            </h2>
            {program.goal?.trim() ? <p className="mt-1 text-sm text-slate-600">{program.goal}</p> : null}
            {showCustomerPerformance ? (
              <p className="mt-1 text-xs text-slate-500">
                {performedLog?.date ? `${performedLog.date} · ` : ""}
                {completionLabel(performedLog)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                {safeExercises.length} øvelse{safeExercises.length === 1 ? "" : "r"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Lukk forhåndsvisning"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {program.notes?.trim() ? (
            <div className="mb-3 rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              {program.notes}
            </div>
          ) : null}

          {showCustomerPerformance && performedLog && (
            performedLog.reflection ||
            performedLog.note?.trim() ||
            performedLog.activityPhotoUrl ||
            (isActivityWorkoutLog(performedLog) && formatActivityDurationLabel(performedLog.activityDurationMinutes))
          ) ? (
            <div className="mb-3 rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hva kunden gjorde</div>
              {isActivityWorkoutLog(performedLog) && formatActivityDurationLabel(performedLog.activityDurationMinutes) ? (
                <div className="mt-1 text-xs text-slate-600">
                  Varighet: {formatActivityDurationLabel(performedLog.activityDurationMinutes)}
                </div>
              ) : null}
              {performedLog.reflection ? (
                <div className="mt-1 text-xs text-slate-600">
                  Følelse: {formatReflectionLevelForDisplay(performedLog.reflection.energyLevel)} · Belastning:{" "}
                  {formatReflectionLevelForDisplay(performedLog.reflection.difficultyLevel)} · Motivasjon:{" "}
                  {formatReflectionLevelForDisplay(performedLog.reflection.motivationLevel)}
                </div>
              ) : null}
              {performedLog.note?.trim() ? <div className="mt-1 text-xs text-slate-600">Øktnotat: {performedLog.note}</div> : null}
              {performedLog.reflection?.note?.trim() ? (
                <div className="mt-1 text-xs text-slate-600">Til PT: {performedLog.reflection.note}</div>
              ) : null}
              {performedLog.activityPhotoUrl ? (
                <img
                  src={performedLog.activityPhotoUrl}
                  alt="Aktivitet"
                  className="mt-2 max-h-40 w-full rounded-xl object-cover"
                />
              ) : null}
            </div>
          ) : null}

          {showCustomerPerformance && !performedLog ? (
            <div className="mb-3 rounded-xl border bg-amber-50 px-3 py-2.5 text-sm text-amber-900" style={{ borderColor: "rgba(180,83,9,0.18)" }}>
              Kunden har ikke logget denne økten ennå.
            </div>
          ) : null}

          {showCustomerPerformance ? (
            review.length === 0 ? (
              performedLog ? (
                <p className="text-sm text-slate-500">Ingen detaljerte sett registrert på denne økten.</p>
              ) : (
                <EmptyState icon="🏋️" title="Ingen øvelser" description="Økten har ingen øvelser å vise." className="bg-slate-50" />
              )
            ) : (
              <ol className="space-y-2">
                {review.map((exercise) => (
                  <li
                    key={exercise.id}
                    className="rounded-xl border bg-slate-50 px-3 py-2.5"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <div className="font-medium text-slate-900">{exercise.name}</div>
                    {exercise.addedDuringWorkout ? (
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lagt til i økten</div>
                    ) : null}
                    {exercise.plannedLabel ? (
                      <div className="mt-1 text-xs text-slate-600">Plan: {exercise.plannedLabel}</div>
                    ) : null}
                    {exercise.notes ? <div className="mt-1 text-xs text-slate-500">{exercise.notes}</div> : null}
                    {exercise.sets.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {exercise.sets.map((set) => (
                          <li key={`${exercise.id}-${set.setNumber}`} className="flex items-start justify-between gap-3 text-xs">
                            <span className="min-w-0 text-slate-700">
                              <span className="font-semibold text-slate-800">Sett {set.setNumber}:</span> {set.performedLabel}
                              {set.note ? <span className="mt-0.5 block text-slate-500">{set.note}</span> : null}
                            </span>
                            <span className={`shrink-0 font-semibold ${set.completed ? "text-emerald-600" : "text-slate-400"}`}>
                              {set.completed ? "Fullført" : "Ikke gjort"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : showCustomerPerformance ? (
                      <div className="mt-1 text-xs text-slate-500">Utført: ikke logget</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )
          ) : safeExercises.length === 0 ? (
            <EmptyState icon="🏋️" title="Ingen øvelser" description="Programmet har ingen øvelser ennå." className="bg-slate-50" />
          ) : (
            <ol className="space-y-2">
              {safeExercises.map((exercise, exerciseIndex) => {
                const exerciseName = resolveProgramExerciseName(safeExercises, exerciseIndex);
                return (
                  <li
                    key={exercise.id}
                    className="rounded-xl border bg-slate-50 px-3 py-2.5"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <div className="font-medium text-slate-900">{exerciseName}</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {formatProgramExercisePrescription(exercise, exerciseIndex, safeExercises, exerciseLibrary)}
                    </div>
                    {exercise.notes?.trim() ? <div className="mt-1 text-xs text-slate-500">{exercise.notes}</div> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div className="shrink-0 space-y-2 border-t px-4 py-3 sm:px-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {primaryAction ? (
            <GradientButton type="button" className="w-full" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </GradientButton>
          ) : null}
          <OutlineButton type="button" className="w-full" onClick={onClose}>
            Lukk
          </OutlineButton>
        </div>
      </div>
    </div>
  );
}
