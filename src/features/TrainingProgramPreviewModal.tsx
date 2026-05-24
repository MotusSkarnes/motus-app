import { X } from "lucide-react";
import { MOTUS } from "../app/data";
import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "../app/exerciseCategories";
import { isLegacyIntervalCooldownDrag } from "../app/programBlocks";
import { GradientButton, OutlineButton } from "../app/ui";
import type { Exercise, ProgramExercise, TrainingProgram } from "../app/types";

const MOTUS_GRADIENT = `${MOTUS.gradient}`;

function cardioProgramExerciseName(rows: ProgramExercise[], index: number): string {
  return isLegacyIntervalCooldownDrag(rows, index) ? "Nedjogg" : rows[index]?.exerciseName ?? "";
}

function cardioTargetHrPrescriptionSuffix(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  return ` · målpuls ca. ${raw}% av makspuls`;
}

function formatExercisePrescription(
  exercise: ProgramExercise,
  exerciseIndex: number,
  exercises: ProgramExercise[],
  exerciseLibrary: Exercise[],
): string {
  const exerciseName = cardioProgramExerciseName(exercises, exerciseIndex);
  if (exercise.durationMinutes) {
    const dragLabel = /^drag\b/i.test(exerciseName.trim()) ? "drag" : "runder";
    return `${exercise.sets || "-"} ${dragLabel} × ${exercise.durationMinutes || "-"} min${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}%` : ""} · ${exercise.restSeconds || "0"}s${cardioTargetHrPrescriptionSuffix(exercise.targetHrPercent)}`;
  }
  const category = exerciseLibrary.find((item) => item.id === exercise.exerciseId)?.category;
  if (category && isHoldBasedExerciseCategory(category)) {
    return `${exercise.sets || "-"} sett × ${programExerciseHoldSeconds(exercise, category) || "-"} sek · ${exercise.restSeconds || "0"}s`;
  }
  return `${exercise.sets || "-"}×${exercise.reps || "-"} · ${exercise.weight || "0"}kg · ${exercise.restSeconds || "0"}s`;
}

type TrainingProgramPreviewModalProps = {
  program: TrainingProgram | null;
  open: boolean;
  onClose: () => void;
  exerciseLibrary: Exercise[];
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
};

export function TrainingProgramPreviewModal({
  program,
  open,
  onClose,
  exerciseLibrary,
  primaryAction,
}: TrainingProgramPreviewModalProps) {
  if (!open || !program) return null;

  const safeExercises = Array.isArray(program.exercises) ? program.exercises : [];

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
            <p className="mt-1 text-xs text-slate-500">
              {safeExercises.length} øvelse{safeExercises.length === 1 ? "" : "r"}
            </p>
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
          {safeExercises.length === 0 ? (
            <EmptyState icon="🏋️" title="Ingen øvelser" description="Programmet har ingen øvelser ennå." className="bg-slate-50" />
          ) : (
            <ol className="space-y-2">
              {safeExercises.map((exercise, exerciseIndex) => {
                const exerciseName = cardioProgramExerciseName(safeExercises, exerciseIndex);
                return (
                  <li
                    key={exercise.id}
                    className="rounded-xl border bg-slate-50 px-3 py-2.5"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <div className="font-medium text-slate-900">{exerciseName}</div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {formatExercisePrescription(exercise, exerciseIndex, safeExercises, exerciseLibrary)}
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
