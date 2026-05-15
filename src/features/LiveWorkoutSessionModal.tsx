import { useEffect, useMemo, useRef, useState } from "react";
import { Repeat2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { GradientButton, OutlineButton, TextArea, TextInput } from "../app/ui";
import type { Exercise, TrainingProgram, WorkoutModeState, WorkoutReflection } from "../app/types";
import type { ReplaceWorkoutExerciseGroupInput } from "../services/appRepository";

export type LiveWorkoutSessionVariant = "member" | "trainer";

export type LiveWorkoutSessionModalProps = {
  variant: LiveWorkoutSessionVariant;
  workoutMode: WorkoutModeState | null;
  activeProgram: TrainingProgram | null;
  exercises: Exercise[];
  /** Kalles før «neste øvelse» (f.eks. PR-feiring for medlem) */
  onBeforeNextExercise?: () => void;
  /** Holder forelder synket på aktiv øvelse (PR-feiring bruker samme gruppering) */
  onWorkoutExerciseIndexChange?: (index: number) => void;
  updateWorkoutExerciseResult: (
    exerciseId: string,
    field:
      | "performedWeight"
      | "performedReps"
      | "performedDurationMinutes"
      | "performedSpeed"
      | "performedIncline"
      | "completed",
    value: string | boolean,
  ) => void;
  replaceWorkoutExerciseGroup: (input: ReplaceWorkoutExerciseGroupInput) => void;
  updateWorkoutModeNote: (note: string) => void;
  finishWorkoutMode: (input?: { reflection?: WorkoutReflection }) => void;
  cancelWorkoutMode: () => void;
  /** Vises som undertittel ved variant trainer */
  trainerSubtitle?: string;
};

function getReflectionEmoji(level: 1 | 2 | 3 | 4 | 5): string {
  if (level <= 1) return "🥳";
  if (level === 2) return "🙂";
  if (level === 3) return "😌";
  if (level === 4) return "😮‍💨";
  return "🥵";
}

export function LiveWorkoutSessionModal({
  variant,
  workoutMode,
  activeProgram,
  exercises,
  onBeforeNextExercise,
  updateWorkoutExerciseResult,
  replaceWorkoutExerciseGroup,
  updateWorkoutModeNote,
  finishWorkoutMode,
  cancelWorkoutMode,
  trainerSubtitle,
  onWorkoutExerciseIndexChange,
}: LiveWorkoutSessionModalProps) {
  const workoutWeightInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showReplacementOptions, setShowReplacementOptions] = useState(false);
  const [showWorkoutReflection, setShowWorkoutReflection] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [workoutExerciseIndex, setWorkoutExerciseIndex] = useState(0);
  const [reflectionEnergyLevel, setReflectionEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionDifficultyLevel, setReflectionDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionMotivationLevel, setReflectionMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionNote, setReflectionNote] = useState("");

  const workoutResultGroups = useMemo(() => {
    if (!workoutMode) return [];
    const grouped = new Map<string, { exerciseName: string; plannedReps: string; plannedWeight: string; rows: WorkoutModeState["results"] }>();
    workoutMode.results.forEach((result) => {
      const groupId = result.programExerciseId ?? result.exerciseId;
      const existing = grouped.get(groupId);
      if (!existing) {
        grouped.set(groupId, {
          exerciseName: result.exerciseName,
          plannedReps: result.plannedReps,
          plannedWeight: result.plannedWeight,
          rows: [result],
        });
        return;
      }
      existing.rows.push(result);
    });
    return Array.from(grouped.entries()).map(([groupId, value]) => ({
      groupId,
      exerciseName: value.exerciseName,
      plannedReps: value.plannedReps,
      plannedWeight: value.plannedWeight,
      rows: value.rows.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    }));
  }, [workoutMode]);

  const activeWorkoutModeProgramId = workoutMode?.programId ?? "";

  useEffect(() => {
    if (!activeWorkoutModeProgramId) {
      setWorkoutExerciseIndex(0);
      setShowWorkoutReflection(false);
      setIsSavingWorkout(false);
      return;
    }
    setWorkoutExerciseIndex(0);
    setShowWorkoutReflection(false);
    setIsSavingWorkout(false);
    setReflectionEnergyLevel(3);
    setReflectionDifficultyLevel(3);
    setReflectionMotivationLevel(3);
    setReflectionNote("");
  }, [activeWorkoutModeProgramId]);

  useEffect(() => {
    onWorkoutExerciseIndexChange?.(workoutExerciseIndex);
  }, [workoutExerciseIndex, onWorkoutExerciseIndexChange]);

  useEffect(() => {
    if (!workoutResultGroups.length) return;
    if (workoutExerciseIndex <= workoutResultGroups.length - 1) return;
    setWorkoutExerciseIndex(workoutResultGroups.length - 1);
  }, [workoutResultGroups, workoutExerciseIndex]);

  const currentWorkoutGroup = workoutResultGroups[workoutExerciseIndex] ?? null;

  useEffect(() => {
    setShowReplacementOptions(false);
  }, [currentWorkoutGroup?.groupId]);

  const exerciseByName = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise])),
    [exercises],
  );

  const replacementCandidates = useMemo(() => {
    if (!activeProgram || !currentWorkoutGroup) return [] as Exercise[];
    const sourceProgramExercise = activeProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
    if (!sourceProgramExercise) return [];
    const sourceExercise = exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
    if (!sourceExercise) return [];
    const sameGroup = exercises.filter(
      (exercise) =>
        exercise.id !== sourceExercise.id &&
        exercise.group.trim().toLowerCase() === sourceExercise.group.trim().toLowerCase() &&
        exercise.category === sourceExercise.category,
    );
    if (sameGroup.length > 0) return sameGroup;
    return exercises.filter((exercise) => exercise.id !== sourceExercise.id && exercise.category === sourceExercise.category);
  }, [activeProgram, currentWorkoutGroup, exercises]);

  const currentWorkoutExerciseImageUrl = useMemo(() => {
    if (!currentWorkoutGroup) return "";
    if (activeProgram) {
      const sourceProgramExercise = activeProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
      if (sourceProgramExercise) {
        const sourceExercise = exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
        if (sourceExercise?.imageUrl) return sourceExercise.imageUrl;
      }
    }
    const byName = exerciseByName.get(currentWorkoutGroup.exerciseName.trim().toLowerCase());
    return byName?.imageUrl ?? "";
  }, [activeProgram, currentWorkoutGroup, exerciseByName, exercises]);

  function handleReplaceCurrentWorkoutExercise(replacementExerciseId: string) {
    if (!currentWorkoutGroup || !replacementExerciseId) return;
    const replacementExercise = exercises.find((exercise) => exercise.id === replacementExerciseId);
    if (!replacementExercise) return;
    replaceWorkoutExerciseGroup({
      programExerciseId: currentWorkoutGroup.groupId,
      nextExerciseName: replacementExercise.name,
    });
    setShowReplacementOptions(false);
  }

  function buildWorkoutReflection(): WorkoutReflection {
    return {
      energyLevel: reflectionEnergyLevel,
      difficultyLevel: reflectionDifficultyLevel,
      motivationLevel: reflectionMotivationLevel,
      note: reflectionNote.trim(),
    };
  }

  function handleGoToNextWorkoutExercise() {
    onBeforeNextExercise?.();
    setWorkoutExerciseIndex((prev) => prev + 1);
  }

  function handleWorkoutResultInputChange(
    row: WorkoutModeState["results"][number],
    field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline",
    value: string,
    rowIndex: number,
    rows: WorkoutModeState["results"],
  ) {
    updateWorkoutExerciseResult(row.exerciseId, field, value);
    const isCardio = row.exerciseCategory === "Kondisjon";
    const isStretch = row.exerciseCategory === "Uttøyning";
    const isTreadmill = (row.exerciseEquipment ?? "").toLowerCase().includes("tredem");
    const nextWeight = field === "performedWeight" ? value.trim() : row.performedWeight.trim();
    const nextReps = field === "performedReps" ? value.trim() : row.performedReps.trim();
    const nextDuration = field === "performedDurationMinutes" ? value.trim() : (row.performedDurationMinutes ?? "").trim();
    const nextSpeed = field === "performedSpeed" ? value.trim() : (row.performedSpeed ?? "").trim();
    const isCompleted = isCardio
      ? Number(nextDuration) > 0 && (!isTreadmill || Number(nextSpeed) > 0)
      : isStretch
        ? Number(nextWeight) > 0
        : Number(nextWeight) > 0 && Number(nextReps) > 0;
    if (isCompleted && !row.completed) {
      updateWorkoutExerciseResult(row.exerciseId, "completed", true);
    }
    if (isCompleted && !row.completed && !isCardio && (field === "performedReps" || field === "performedWeight")) {
      const nextRow = rows[rowIndex + 1];
      if (!nextRow) return;
      const nextInput = workoutWeightInputRefs.current[nextRow.exerciseId];
      if (nextInput) {
        window.requestAnimationFrame(() => nextInput.focus());
      }
    }
  }

  if (!activeProgram || !workoutMode) return null;

  const badgeLabel =
    variant === "trainer" ? (
      <>
        <div className="text-xs uppercase tracking-wide text-slate-400">Live PT-økt</div>
        {trainerSubtitle ? <div className="mt-0.5 text-sm text-slate-500">{trainerSubtitle}</div> : null}
      </>
    ) : (
      <div className="text-xs uppercase tracking-wide text-slate-400">Økt-modus</div>
    );

  return (
    <div className="motus-modal-insets fixed inset-0 z-[10010] overscroll-contain bg-slate-900/40">
      <div className="mx-auto flex h-full max-w-xl flex-col rounded-2xl bg-white shadow-lg">
        <div className="border-b p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {badgeLabel}
              <div className="text-lg font-semibold">{activeProgram.title}</div>
              <div className="mt-1 text-sm text-slate-500">
                {workoutMode.results.filter((r) => r.completed).length}/{workoutMode.results.length} sett fullført
              </div>
            </div>
            <OutlineButton type="button" onClick={cancelWorkoutMode}>
              Lukk
            </OutlineButton>
          </div>
        </div>

        <div className="motus-scroll-touch flex-1 space-y-2 overflow-auto p-3">
          {currentWorkoutGroup ? (
            <div
              key={currentWorkoutGroup.groupId}
              className="w-full rounded-xl border p-3 text-left transition bg-slate-50"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400">
                    Øvelse {workoutExerciseIndex + 1} av {workoutResultGroups.length}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">{currentWorkoutGroup.exerciseName}</div>
                    {replacementCandidates.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowReplacementOptions((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                        aria-label="Bytt øvelse"
                        title="Bytt øvelse"
                      >
                        <Repeat2 className="h-3.5 w-3.5" />
                        Bytt
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {currentWorkoutGroup.rows[0]?.exerciseCategory === "Kondisjon"
                      ? `Plan: ${currentWorkoutGroup.rows.length} runder × ${currentWorkoutGroup.rows[0]?.plannedDurationMinutes || "0"} min${
                          currentWorkoutGroup.rows[0]?.plannedSpeed ? ` · ${currentWorkoutGroup.rows[0]?.plannedSpeed} km/t` : ""
                        }${currentWorkoutGroup.rows[0]?.plannedIncline ? ` · ${currentWorkoutGroup.rows[0]?.plannedIncline}% incline` : ""}`
                      : currentWorkoutGroup.rows[0]?.exerciseCategory === "Uttøyning"
                        ? `Plan: ${currentWorkoutGroup.rows.length} sett × ${currentWorkoutGroup.plannedWeight} sek`
                        : `Plan: ${currentWorkoutGroup.rows.length} sett × ${currentWorkoutGroup.plannedReps} reps · ${currentWorkoutGroup.plannedWeight}kg`}
                  </div>
                </div>
                {currentWorkoutExerciseImageUrl ? (
                  <div
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <img
                      src={currentWorkoutExerciseImageUrl}
                      alt={`Illustrasjon av ${currentWorkoutGroup.exerciseName}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
              </div>
              {replacementCandidates.length > 0 && showReplacementOptions ? (
                <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-medium text-slate-600">Velg ny øvelse (samme muskelgruppe)</div>
                  <div className="mt-2 grid gap-2">
                    {replacementCandidates.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => handleReplaceCurrentWorkoutExercise(exercise.id)}
                        className="w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition hover:opacity-90"
                        style={{
                          borderColor: "rgba(20,184,166,0.35)",
                          color: MOTUS.ink,
                          background: "linear-gradient(135deg, rgba(20,184,166,0.10) 0%, rgba(236,72,153,0.10) 100%)",
                        }}
                      >
                        {exercise.name} · {exercise.group}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={`mt-3 ${currentWorkoutGroup.rows.length <= 3 ? "space-y-1.5" : "space-y-2"}`}>
                {currentWorkoutGroup.rows.map((row, index) => {
                  const resolvedExercise = exerciseByName.get(row.exerciseName.trim().toLowerCase());
                  const isCardio = (row.exerciseCategory ?? resolvedExercise?.category) === "Kondisjon";
                  const isStretch = (row.exerciseCategory ?? resolvedExercise?.category) === "Uttøyning";
                  const isTreadmill = (row.exerciseEquipment ?? resolvedExercise?.equipment ?? "").toLowerCase().includes("tredem");
                  const isCompactSetView = currentWorkoutGroup.rows.length <= 3;
                  return (
                    <div
                      key={row.exerciseId}
                      className={`rounded-xl border bg-white ${isCompactSetView ? "p-2.5" : "p-3"} ${row.completed ? "border-emerald-300" : "border-slate-200"}`}
                    >
                      <div className={`${isCompactSetView ? "mb-1.5" : "mb-2"} flex items-center justify-between gap-2`}>
                        <div className="text-xs font-semibold text-slate-600">Sett {row.setNumber ?? 1}</div>
                        <button
                          type="button"
                          onClick={() => updateWorkoutExerciseResult(row.exerciseId, "completed", !row.completed)}
                          className={`rounded-full ${isCompactSetView ? "px-2.5 py-0.5" : "px-3 py-1"} text-xs font-semibold ${row.completed ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"}`}
                        >
                          {row.completed ? "Fullført" : "Marker"}
                        </button>
                      </div>
                      {isCardio ? (
                        <div className={`grid ${isCompactSetView ? "gap-2" : "gap-3"} ${isTreadmill ? "grid-cols-3" : "grid-cols-1"}`}>
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500">Tid utført (min)</div>
                            <TextInput
                              ref={(input) => {
                                workoutWeightInputRefs.current[row.exerciseId] = input;
                              }}
                              value={row.performedDurationMinutes ?? ""}
                              onChange={(e) =>
                                handleWorkoutResultInputChange(row, "performedDurationMinutes", e.target.value, index, currentWorkoutGroup.rows)
                              }
                              placeholder="0"
                              className={isCompactSetView ? "h-9 text-xs" : ""}
                            />
                          </div>
                          {isTreadmill ? (
                            <>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Fart (km/t)</div>
                                <TextInput
                                  value={row.performedSpeed ?? ""}
                                  onChange={(e) => handleWorkoutResultInputChange(row, "performedSpeed", e.target.value, index, currentWorkoutGroup.rows)}
                                  placeholder="0"
                                  className={isCompactSetView ? "h-9 text-xs" : ""}
                                />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Incline (%)</div>
                                <TextInput
                                  value={row.performedIncline ?? ""}
                                  onChange={(e) =>
                                    handleWorkoutResultInputChange(row, "performedIncline", e.target.value, index, currentWorkoutGroup.rows)
                                  }
                                  placeholder="0"
                                  className={isCompactSetView ? "h-9 text-xs" : ""}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : isStretch ? (
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Sekunder (hold)</div>
                          <TextInput
                            ref={(input) => {
                              workoutWeightInputRefs.current[row.exerciseId] = input;
                            }}
                            value={row.performedWeight}
                            onChange={(e) => handleWorkoutResultInputChange(row, "performedWeight", e.target.value, index, currentWorkoutGroup.rows)}
                            onFocus={(event) => event.currentTarget.select()}
                            placeholder="0"
                            className={`${isCompactSetView ? "h-9 text-xs" : ""} ${row.performedWeight === row.plannedWeight ? "text-slate-400" : "text-slate-800"}`}
                          />
                        </div>
                      ) : (
                        <div className={`grid grid-cols-2 ${isCompactSetView ? "gap-2" : "gap-3"}`}>
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500">Kg utført</div>
                            <TextInput
                              ref={(input) => {
                                workoutWeightInputRefs.current[row.exerciseId] = input;
                              }}
                              value={row.performedWeight}
                              onChange={(e) => handleWorkoutResultInputChange(row, "performedWeight", e.target.value, index, currentWorkoutGroup.rows)}
                              onFocus={(event) => event.currentTarget.select()}
                              placeholder="0"
                              className={`${isCompactSetView ? "h-9 text-xs" : ""} ${row.performedWeight === row.plannedWeight ? "text-slate-400" : "text-slate-800"}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500">Reps utført</div>
                            <TextInput
                              value={row.performedReps}
                              onChange={(e) => handleWorkoutResultInputChange(row, "performedReps", e.target.value, index, currentWorkoutGroup.rows)}
                              onFocus={(event) => event.currentTarget.select()}
                              placeholder="0"
                              className={`${isCompactSetView ? "h-9 text-xs" : ""} ${row.performedReps === row.plannedReps ? "text-slate-400" : "text-slate-800"}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {variant === "member" ? (
            !showWorkoutReflection ? (
              <TextArea value={workoutMode.note} onChange={(e) => updateWorkoutModeNote(e.target.value)} className="min-h-[110px]" placeholder="Hvordan gikk økta?" />
            ) : (
              <div className="rounded-xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Etter økta</div>
                  <div className="text-xs text-slate-500">Svar med emoji før økta lagres.</div>
                </div>
                {[
                  { key: "energy", question: "Hvordan føles energinivået nå?", value: reflectionEnergyLevel, setValue: setReflectionEnergyLevel },
                  { key: "difficulty", question: "Hvor tung opplevdes økta?", value: reflectionDifficultyLevel, setValue: setReflectionDifficultyLevel },
                  { key: "motivation", question: "Hvordan er motivasjonen videre?", value: reflectionMotivationLevel, setValue: setReflectionMotivationLevel },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">{item.question}</div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((level) => {
                        const numericLevel = level as 1 | 2 | 3 | 4 | 5;
                        const active = item.value === numericLevel;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => item.setValue(numericLevel)}
                            className={`rounded-xl border px-2 py-2 text-lg transition ${
                              active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                            aria-label={`Velg nivå ${level}`}
                          >
                            {getReflectionEmoji(numericLevel)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <TextArea
                  value={reflectionNote}
                  onChange={(e) => setReflectionNote(e.target.value)}
                  className="min-h-[90px]"
                  placeholder="Notat til PT (valgfritt)"
                />
              </div>
            )
          ) : (
            <TextArea value={workoutMode.note} onChange={(e) => updateWorkoutModeNote(e.target.value)} className="min-h-[110px]" placeholder="Notat fra PT-økta (valgfritt)" />
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-white p-3 sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="grid gap-2 sm:flex sm:gap-3">
            <OutlineButton type="button" className="w-full sm:flex-1" onClick={cancelWorkoutMode}>
              Avbryt
            </OutlineButton>
            <OutlineButton
              type="button"
              className="w-full sm:flex-1"
              onClick={() => setWorkoutExerciseIndex((prev) => Math.max(0, prev - 1))}
              disabled={workoutExerciseIndex === 0}
            >
              Forrige øvelse
            </OutlineButton>
            {variant === "trainer" ? (
              workoutExerciseIndex < workoutResultGroups.length - 1 ? (
                <GradientButton type="button" className="w-full sm:flex-1" onClick={handleGoToNextWorkoutExercise}>
                  Neste øvelse
                </GradientButton>
              ) : (
                <GradientButton
                  type="button"
                  className="w-full sm:flex-1"
                  disabled={isSavingWorkout}
                  onClick={() => {
                    if (isSavingWorkout) return;
                    setIsSavingWorkout(true);
                    finishWorkoutMode();
                    window.setTimeout(() => setIsSavingWorkout(false), 600);
                  }}
                >
                  {isSavingWorkout ? "Lagrer..." : "Lagre økt på kunden"}
                </GradientButton>
              )
            ) : workoutExerciseIndex < workoutResultGroups.length - 1 ? (
              <GradientButton type="button" className="w-full sm:flex-1" onClick={handleGoToNextWorkoutExercise}>
                Neste øvelse
              </GradientButton>
            ) : (
              <GradientButton
                type="button"
                className="w-full sm:flex-1"
                disabled={isSavingWorkout}
                onClick={() => {
                  if (!showWorkoutReflection) {
                    setShowWorkoutReflection(true);
                    return;
                  }
                  if (isSavingWorkout) return;
                  setIsSavingWorkout(true);
                  finishWorkoutMode({ reflection: buildWorkoutReflection() });
                  window.setTimeout(() => setIsSavingWorkout(false), 600);
                }}
              >
                {showWorkoutReflection ? (isSavingWorkout ? "Lagrer..." : "Lagre økt") : "Avslutt økt"}
              </GradientButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
