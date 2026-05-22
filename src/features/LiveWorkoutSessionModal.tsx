import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Plus, Repeat2, SkipForward, TimerReset, X } from "lucide-react";
import { remainingSecondsUntilDeadline } from "../app/intervalTimerDeadline";
import { useScreenWakeLock } from "../app/useScreenWakeLock";
import { playWorkoutRestTone, primeWorkoutRestAudio } from "../app/workoutRestAudio";
import { WorkoutCompactSetTable } from "./LiveWorkoutCompactSets";
import { MOTUS } from "../app/data";
import { isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import { EXERCISE_IMAGE_INSET_CLASS, EXERCISE_IMAGE_SMALL_CLASS } from "../app/exerciseIllustrations/constants";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { buildWorkoutResultGroups, EXERCISE_BLOCK_LABELS } from "../app/programBlocks";
import { GradientButton, OutlineButton, TextArea, TextInput } from "../app/ui";
import type { Exercise, TrainingProgram, WorkoutModeState, WorkoutReflection } from "../app/types";
import type { ReplaceWorkoutExerciseGroupInput } from "../services/appRepository";
import { buildTrainingProgramFromWorkoutMode } from "../app/pausedWorkoutSession";
import { MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE } from "../services/appRepository";

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
  appendWorkoutSetForProgramExercise: (programExerciseId: string) => void;
  deferWorkoutExerciseGroup: (programExerciseId: string) => void;
  updateWorkoutModeNote: (note: string) => void;
  updateWorkoutExerciseNote: (programExerciseId: string, note: string) => void;
  finishWorkoutMode: (input?: {
    reflection?: WorkoutReflection;
    onPersisted?: (result: { ok: boolean; message?: string }) => void;
  }) => void;
  cancelWorkoutMode: () => void;
  /** Lagrer utkast og lukker økt (medlem). Fallback: cancelWorkoutMode. */
  onDismissWorkout?: () => void;
  /** Vises som undertittel ved variant trainer */
  trainerSubtitle?: string;
  restCountdownEnabled?: boolean;
};

type RestCountdownState = {
  groupId: string;
  endsAtMs: number;
  totalSeconds: number;
};

function parseRestSeconds(value: string | undefined): number {
  const parsed = Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.min(600, Math.round(parsed));
}

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
  appendWorkoutSetForProgramExercise,
  deferWorkoutExerciseGroup,
  updateWorkoutModeNote,
  updateWorkoutExerciseNote,
  finishWorkoutMode,
  cancelWorkoutMode,
  onDismissWorkout,
  trainerSubtitle,
  onWorkoutExerciseIndexChange,
  restCountdownEnabled = true,
}: LiveWorkoutSessionModalProps) {
  const leaveWorkout = onDismissWorkout ?? cancelWorkoutMode;
  const [showReplacementOptions, setShowReplacementOptions] = useState(false);
  const [showWorkoutReflection, setShowWorkoutReflection] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [workoutExerciseIndex, setWorkoutExerciseIndex] = useState(0);
  const [reflectionEnergyLevel, setReflectionEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionDifficultyLevel, setReflectionDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionMotivationLevel, setReflectionMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionNote, setReflectionNote] = useState("");
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [restCountdown, setRestCountdown] = useState<RestCountdownState | null>(null);
  const deferredJumpTargetGroupIdRef = useRef<string | null>(null);
  const completedCountByGroupRef = useRef<Record<string, number>>({});
  const lastRestBeepSecondRef = useRef<number | null>(null);

  useScreenWakeLock(Boolean(workoutMode));

  useEffect(() => {
    if (!workoutMode || !restCountdownEnabled) return;
    void primeWorkoutRestAudio();
  }, [workoutMode, restCountdownEnabled]);

  const resolvedProgram = useMemo(
    () => activeProgram ?? (workoutMode ? buildTrainingProgramFromWorkoutMode(workoutMode) : null),
    [activeProgram, workoutMode],
  );

  const workoutResultGroups = useMemo(
    () => (workoutMode ? buildWorkoutResultGroups(workoutMode.results, resolvedProgram) : []),
    [workoutMode, resolvedProgram],
  );

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
    const deferredJumpTargetGroupId = deferredJumpTargetGroupIdRef.current;
    if (deferredJumpTargetGroupId) {
      const nextIndex = workoutResultGroups.findIndex((group) => group.groupId === deferredJumpTargetGroupId);
      if (nextIndex >= 0) {
        deferredJumpTargetGroupIdRef.current = null;
        setWorkoutExerciseIndex(nextIndex);
        return;
      }
    }
    if (workoutExerciseIndex <= workoutResultGroups.length - 1) return;
    setWorkoutExerciseIndex(workoutResultGroups.length - 1);
  }, [workoutResultGroups, workoutExerciseIndex]);

  const currentWorkoutGroup = workoutResultGroups[workoutExerciseIndex] ?? null;
  const nextWorkoutGroup = workoutResultGroups[workoutExerciseIndex + 1] ?? null;
  const canDeferCurrentExercise = Boolean(currentWorkoutGroup && nextWorkoutGroup);
  const isLastWorkoutGroup = workoutExerciseIndex >= workoutResultGroups.length - 1;
  const currentWorkoutGroupId = currentWorkoutGroup?.groupId ?? "";
  const currentGroupCompletedSets = currentWorkoutGroup?.rows.filter((row) => row.completed).length ?? 0;
  const currentGroupTotalSets = currentWorkoutGroup?.rows.length ?? 0;
  const currentGroupIsComplete = currentGroupTotalSets > 0 && currentGroupCompletedSets >= currentGroupTotalSets;
  const activeRestSeconds = useMemo(() => {
    if (!currentWorkoutGroup || !resolvedProgram) return 60;
    const programExerciseIds = new Set(currentWorkoutGroup.segments.map((segment) => segment.programExerciseId));
    const matchingExercises = resolvedProgram.exercises.filter(
      (exercise) =>
        programExerciseIds.has(exercise.id) ||
        Boolean(currentWorkoutGroup.blockType && exercise.blockId?.trim() === currentWorkoutGroup.groupId),
    );
    const rawRest = matchingExercises.map((exercise) => exercise.restSeconds).find((value) => String(value ?? "").trim());
    return parseRestSeconds(rawRest);
  }, [currentWorkoutGroup, resolvedProgram]);

  function getExerciseNote(programExerciseId: string): string {
    if (!workoutMode) return "";
    const row = workoutMode.results.find((result) => result.programExerciseId === programExerciseId);
    return row?.exerciseNote ?? "";
  }

  function renderExerciseNoteFields() {
    if (!currentWorkoutGroup) return null;
    return (
      <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
        {currentWorkoutGroup.segments.map((segment) => (
          <label key={segment.programExerciseId} className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">
              {currentWorkoutGroup.segments.length > 1
                ? `Kommentar til ${segment.exerciseName} (valgfritt)`
                : "Kommentar til øvelsen (valgfritt)"}
            </span>
            <TextArea
              value={getExerciseNote(segment.programExerciseId)}
              onChange={(event) => updateWorkoutExerciseNote(segment.programExerciseId, event.target.value)}
              className="min-h-[72px] !text-sm"
              placeholder="Teknikk, følelse, justeringer…"
            />
          </label>
        ))}
      </div>
    );
  }

  useEffect(() => {
    setShowReplacementOptions(false);
    setShowExerciseDetail(false);
    setRestCountdown(null);
    lastRestBeepSecondRef.current = null;
    if (currentWorkoutGroupId) {
      completedCountByGroupRef.current[currentWorkoutGroupId] = currentGroupCompletedSets;
    }
    // Baseline skal bare nullstilles ved ny øvelse/blokk, ikke ved hvert sett som hukes av.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkoutGroupId]);

  useEffect(() => {
    if (!currentWorkoutGroup) return;
    const completed = currentWorkoutGroup.rows.filter((row) => row.completed).length;
    const previous = completedCountByGroupRef.current[currentWorkoutGroup.groupId] ?? completed;
    completedCountByGroupRef.current[currentWorkoutGroup.groupId] = completed;
    if (!restCountdownEnabled || showWorkoutReflection) return;
    if (completed <= previous) return;
    if (currentGroupIsComplete && isLastWorkoutGroup) return;
    lastRestBeepSecondRef.current = null;
    void primeWorkoutRestAudio();
    setRestCountdown({
      groupId: currentWorkoutGroup.groupId,
      endsAtMs: Date.now() + activeRestSeconds * 1000,
      totalSeconds: activeRestSeconds,
    });
  }, [
    activeRestSeconds,
    currentGroupIsComplete,
    currentWorkoutGroup,
    isLastWorkoutGroup,
    restCountdownEnabled,
    showWorkoutReflection,
  ]);

  const [restCountdownTick, setRestCountdownTick] = useState(0);
  const restCountdownRemainingSeconds = restCountdown
    ? remainingSecondsUntilDeadline(restCountdown.endsAtMs, Date.now())
    : 0;

  useEffect(() => {
    if (!restCountdown) return;
    const beepedSeconds = new Set<number>();
    const sync = () => {
      const remaining = remainingSecondsUntilDeadline(restCountdown.endsAtMs, Date.now());
      if (remaining <= 0) {
        setRestCountdown(null);
        void playWorkoutRestTone("start");
        return;
      }
      if (remaining >= 1 && remaining <= 3) {
        if (!beepedSeconds.has(remaining)) {
          beepedSeconds.add(remaining);
          lastRestBeepSecondRef.current = remaining;
          void playWorkoutRestTone("tick");
        }
      }
      setRestCountdownTick((tick) => tick + 1);
    };
    sync();
    const intervalId = window.setInterval(sync, 200);
    const onVisibilityOrFocus = () => {
      void primeWorkoutRestAudio().then(sync);
    };
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);
    window.addEventListener("pageshow", onVisibilityOrFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
      window.removeEventListener("pageshow", onVisibilityOrFocus);
    };
  }, [restCountdown]);

  useEffect(() => {
    if (!restCountdownEnabled) setRestCountdown(null);
  }, [restCountdownEnabled]);

  useEffect(() => {
    if (!showExerciseDetail) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowExerciseDetail(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showExerciseDetail]);

  const exerciseByName = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise])),
    [exercises],
  );

  const replacementCandidates = useMemo(() => {
    if (!resolvedProgram || !currentWorkoutGroup || currentWorkoutGroup.blockType) return [] as Exercise[];
    const sourceExercise =
      exerciseByName.get(currentWorkoutGroup.exerciseName.trim().toLowerCase()) ??
      (() => {
        const sourceProgramExercise = resolvedProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
        if (!sourceProgramExercise) return null;
        return exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
      })();
    if (!sourceExercise) return [];
    const sameGroup = exercises.filter(
      (exercise) =>
        exercise.id !== sourceExercise.id &&
        exercise.group.trim().toLowerCase() === sourceExercise.group.trim().toLowerCase() &&
        exercise.category === sourceExercise.category,
    );
    if (sameGroup.length > 0) return sameGroup;
    return exercises.filter((exercise) => exercise.id !== sourceExercise.id && exercise.category === sourceExercise.category);
  }, [resolvedProgram, currentWorkoutGroup, exerciseByName, exercises]);

  const currentWorkoutExercise = useMemo(() => {
    if (!currentWorkoutGroup) return null;
    const byName = exerciseByName.get(currentWorkoutGroup.exerciseName.trim().toLowerCase());
    if (byName) return byName;
    if (!resolvedProgram) return null;
    const sourceProgramExercise = resolvedProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
    if (!sourceProgramExercise) return null;
    return exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
  }, [activeProgram, currentWorkoutGroup, exerciseByName, exercises]);

  const currentWorkoutExerciseImageUrl = currentWorkoutExercise
    ? resolveExerciseImageSrc(currentWorkoutExercise)
    : "";

  const nextWorkoutExercise = useMemo(() => {
    if (!nextWorkoutGroup) return null;
    const byName = exerciseByName.get(nextWorkoutGroup.exerciseName.trim().toLowerCase());
    if (byName) return byName;
    if (!resolvedProgram) return null;
    const sourceProgramExercise = resolvedProgram.exercises.find((exercise) => exercise.id === nextWorkoutGroup.groupId);
    if (!sourceProgramExercise) return null;
    return exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
  }, [resolvedProgram, nextWorkoutGroup, exerciseByName, exercises]);

  const workoutProgressPct =
    workoutResultGroups.length > 0 ? Math.round(((workoutExerciseIndex + 1) / workoutResultGroups.length) * 100) : 0;

  const completedSetsCount = workoutMode?.results.filter((r) => r.completed).length ?? 0;
  const totalSetsCount = workoutMode?.results.length ?? 0;

  const activeSetProgressLabel = useMemo(() => {
    if (!currentWorkoutGroup || currentWorkoutGroup.blockType) return "";
    const completed = currentWorkoutGroup.rows.filter((r) => r.completed).length;
    return `Sett ${Math.min(completed + 1, currentWorkoutGroup.rows.length)} av ${currentWorkoutGroup.rows.length}`;
  }, [currentWorkoutGroup]);

  const currentWorkoutPlanLabel = useMemo(() => {
    if (!currentWorkoutGroup) return "";
    if (currentWorkoutGroup.blockType) {
      const label = EXERCISE_BLOCK_LABELS[currentWorkoutGroup.blockType];
      const rounds = currentWorkoutGroup.blockRounds ?? currentWorkoutGroup.rounds.length;
      return `${label} · ${rounds} runde${rounds === 1 ? "" : "r"} · ${currentWorkoutGroup.exerciseNames.join(" → ")}`;
    }
    const row = currentWorkoutGroup.rows[0];
    if (row?.exerciseCategory === "Kondisjon") {
      return `${currentWorkoutGroup.rows.length} runder × ${row.plannedDurationMinutes || "0"} min${
        row.plannedSpeed ? ` · ${row.plannedSpeed} km/t` : ""
      }${row.plannedIncline ? ` · ${row.plannedIncline}% incline` : ""}`;
    }
    if (row?.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) {
      return `${currentWorkoutGroup.rows.length} sett × ${currentWorkoutGroup.plannedWeight} sek`;
    }
    return `${currentWorkoutGroup.rows.length} sett × ${currentWorkoutGroup.plannedReps} reps · ${currentWorkoutGroup.plannedWeight} kg`;
  }, [currentWorkoutGroup]);

  const nextWorkoutPlanLabel = useMemo(() => {
    if (!nextWorkoutGroup) return "";
    if (nextWorkoutGroup.blockType) {
      const blockLabel = EXERCISE_BLOCK_LABELS[nextWorkoutGroup.blockType];
      const rounds = nextWorkoutGroup.blockRounds ?? nextWorkoutGroup.rounds.length;
      return `${blockLabel} · ${rounds} runde${rounds === 1 ? "" : "r"}`;
    }
    const row = nextWorkoutGroup.rows[0];
    if (row?.exerciseCategory === "Kondisjon") {
      return `${nextWorkoutGroup.rows.length} runder × ${row.plannedDurationMinutes || "0"} min`;
    }
    if (row?.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) {
      return `${nextWorkoutGroup.rows.length} sett × ${nextWorkoutGroup.plannedWeight} sek`;
    }
    return `${nextWorkoutGroup.rows.length} sett × ${nextWorkoutGroup.plannedReps} reps`;
  }, [nextWorkoutGroup]);

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
    setRestCountdown(null);
    onBeforeNextExercise?.();
    setWorkoutExerciseIndex((prev) => prev + 1);
  }

  function handleDeferCurrentWorkoutExercise() {
    if (!currentWorkoutGroup || !nextWorkoutGroup) return;
    setRestCountdown(null);
    deferredJumpTargetGroupIdRef.current = nextWorkoutGroup.groupId;
    deferWorkoutExerciseGroup(currentWorkoutGroup.groupId);
  }

  function handleSaveTrainerWorkout() {
    if (isSavingWorkout) return;
    setIsSavingWorkout(true);
    finishWorkoutMode({
      onPersisted: () => setIsSavingWorkout(false),
    });
  }

  function handleSaveMemberWorkout() {
    if (!showWorkoutReflection) {
      setShowWorkoutReflection(true);
      return;
    }
    if (isSavingWorkout) return;
    setIsSavingWorkout(true);
    finishWorkoutMode({
      reflection: buildWorkoutReflection(),
      onPersisted: () => setIsSavingWorkout(false),
    });
  }

  if (!workoutMode || !resolvedProgram) return null;

  const headerTitle = variant === "trainer" ? "Live PT-økt" : "Øktmodus";

  return (
    <div className="motus-modal-insets fixed inset-0 z-[10010] overscroll-contain bg-slate-900/40">
      <div className="mx-auto flex h-full max-w-xl flex-col rounded-2xl bg-white shadow-lg">
        <div className="border-b px-4 pb-3 pt-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={leaveWorkout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
              aria-label="Pause økt"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-base font-semibold text-slate-900">{headerTitle}</div>
              {trainerSubtitle ? <div className="mt-0.5 truncate text-xs text-slate-500">{trainerSubtitle}</div> : null}
            </div>
            <button
              type="button"
              onClick={leaveWorkout}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
              style={{ background: MOTUS.pink }}
            >
              {onDismissWorkout ? "Pause" : "Avslutt"}
            </button>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${workoutProgressPct}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {workoutExerciseIndex + 1} av {workoutResultGroups.length} øvelser
            </span>
            <span>
              {completedSetsCount}/{totalSetsCount} sett
            </span>
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
                  {currentWorkoutGroup.blockType ? (
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                      {EXERCISE_BLOCK_LABELS[currentWorkoutGroup.blockType]}
                      {currentWorkoutGroup.blockRounds ? ` · ${currentWorkoutGroup.blockRounds} runder` : ""}
                    </div>
                  ) : null}
                  <h2 className="mt-0.5 text-xl font-bold text-slate-900">{currentWorkoutGroup.exerciseName}</h2>
                  {activeSetProgressLabel ? (
                    <div className="mt-1 text-sm font-medium text-slate-600">{activeSetProgressLabel}</div>
                  ) : null}
                  <div className="mt-1 text-xs text-slate-500">Plan: {currentWorkoutPlanLabel}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
                </div>
                {currentWorkoutExercise ? (
                  <button
                    type="button"
                    onClick={() => setShowExerciseDetail(true)}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:ring-2 hover:ring-teal-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:h-24 sm:w-24"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    aria-label={`Vis informasjon om ${currentWorkoutGroup.exerciseName}`}
                  >
                    {currentWorkoutExerciseImageUrl ? (
                      <img
                        key={currentWorkoutExercise.id}
                        src={currentWorkoutExerciseImageUrl}
                        alt=""
                        className={EXERCISE_IMAGE_INSET_CLASS}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-100 px-1 text-center text-[10px] font-semibold text-slate-500">
                        Info
                      </span>
                    )}
                  </button>
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
              {canDeferCurrentExercise ? (
                <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <button
                    type="button"
                    onClick={handleDeferCurrentWorkoutExercise}
                    className="inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50"
                    style={{ borderColor: "rgba(148,163,184,0.45)" }}
                  >
                    <SkipForward className="h-4 w-4 shrink-0" style={{ color: MOTUS.turquoise }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block">Ta neste øvelse først</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                        «{currentWorkoutGroup.exerciseName}» blir neste øvelse etter «{nextWorkoutGroup?.exerciseName}»
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
              <div className="mt-3 space-y-3">
                {currentWorkoutGroup.blockType && currentWorkoutGroup.rounds.length > 0
                  ? currentWorkoutGroup.rounds.map((round) => (
                      <div key={`round-${round.round}`} className="space-y-2 rounded-xl border bg-white/80 p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                          Runde {round.round}
                          {currentWorkoutGroup.blockRounds ? ` av ${currentWorkoutGroup.blockRounds}` : ""}
                        </div>
                        <div className="space-y-2">
                          {round.segments.map((segment) =>
                            segment.row ? (
                              <WorkoutCompactSetTable
                                key={segment.row.exerciseId}
                                rows={[segment.row]}
                                exerciseByName={exerciseByName}
                                exerciseLabel={segment.exerciseName}
                                onUpdate={updateWorkoutExerciseResult}
                              />
                            ) : null,
                          )}
                        </div>
                      </div>
                    ))
                  : (
                    <WorkoutCompactSetTable
                      rows={currentWorkoutGroup.rows}
                      exerciseByName={exerciseByName}
                      onUpdate={updateWorkoutExerciseResult}
                    />
                  )}
              </div>
              {!currentWorkoutGroup.blockType && currentWorkoutGroup.segments[0] ? (
                <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                  <button
                    type="button"
                    onClick={() => appendWorkoutSetForProgramExercise(currentWorkoutGroup.segments[0]!.programExerciseId)}
                    disabled={currentWorkoutGroup.rows.length >= MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-400 hover:bg-teal-50/50 disabled:cursor-not-allowed disabled:opacity-45 sm:inline-flex sm:w-auto"
                    style={{ borderColor: "rgba(148,163,184,0.55)" }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Legg til sett
                  </button>
                  {currentWorkoutGroup.rows.length >= MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE ? (
                    <p className="mt-1.5 text-[10px] text-slate-500">Maks {MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE} sett per øvelse.</p>
                  ) : (
                    <p className="mt-1.5 text-[10px] text-slate-500">Legger til et ekstra sett under økta — også om du gjør flere enn planlagt.</p>
                  )}
                </div>
              ) : currentWorkoutGroup.blockType ? (
                <p className="mt-2 text-[10px] text-slate-500">
                  Kjør øvelsene i rekkefølge per runde{currentWorkoutGroup.blockType === "circuit" ? " — full sirkel før neste runde" : ""}.
                </p>
              ) : null}
              {renderExerciseNoteFields()}
            </div>
          ) : null}

          {variant === "member" && showWorkoutReflection ? (
              <div className="rounded-xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Etter økta</div>
                  <div className="text-xs text-slate-500">Svar med emoji før økta lagres.</div>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Kommentar til økten (valgfritt)</span>
                  <TextArea
                    value={workoutMode.note}
                    onChange={(e) => updateWorkoutModeNote(e.target.value)}
                    className="min-h-[90px]"
                    placeholder="Hvordan gikk økta som helhet?"
                  />
                </label>
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
          ) : null}

          {variant === "trainer" && isLastWorkoutGroup ? (
            <label className="block space-y-1 rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <span className="text-xs font-semibold text-slate-700">Kommentar til økten (valgfritt)</span>
              <TextArea
                value={workoutMode.note}
                onChange={(e) => updateWorkoutModeNote(e.target.value)}
                className="min-h-[90px]"
                placeholder="Oppsummering av PT-økten…"
              />
            </label>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t bg-white p-3 sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
          {nextWorkoutGroup && !isLastWorkoutGroup && !showWorkoutReflection ? (
            <button
              type="button"
              onClick={handleGoToNextWorkoutExercise}
              className="mb-3 w-full rounded-xl border bg-slate-50 p-3 text-left transition hover:bg-slate-100"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
                    Neste øvelse
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <div className="mt-0.5 font-semibold text-slate-900">{nextWorkoutGroup.exerciseName}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{nextWorkoutPlanLabel}</div>
                </div>
                {nextWorkoutExercise ? (
                  <img
                    key={nextWorkoutExercise.id}
                    src={resolveExerciseImageSrc(nextWorkoutExercise)}
                    alt=""
                    className={EXERCISE_IMAGE_SMALL_CLASS}
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
            </button>
          ) : null}
          {restCountdown ? (
            <div className="mb-3 rounded-xl border bg-teal-50 p-3" style={{ borderColor: "rgba(20,184,166,0.25)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                    <TimerReset className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                      Pause
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {restCountdownRemainingSeconds}s til {currentGroupIsComplete && nextWorkoutGroup ? "neste øvelse" : "neste sett"}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, (restCountdownRemainingSeconds / restCountdown.totalSeconds) * 100))}%`,
                          background: MOTUS.turquoise,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRestCountdown(null);
                    void primeWorkoutRestAudio().then(() => playWorkoutRestTone("start"));
                  }}
                  className="shrink-0 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                >
                  Hopp over
                </button>
              </div>
            </div>
          ) : null}
          {variant === "trainer" ? (
            <GradientButton
              type="button"
              className="mb-3 w-full !min-h-[3.25rem] !py-3.5 !text-base !font-bold shadow-md"
              disabled={isSavingWorkout}
              onClick={handleSaveTrainerWorkout}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                {isSavingWorkout ? "Lagrer økt på kunden..." : "Lagre økt på kunden"}
              </span>
            </GradientButton>
          ) : (
            <GradientButton
              type="button"
              className="mb-3 w-full !min-h-[3.25rem] !py-3.5 !text-base !font-bold shadow-md"
              disabled={isSavingWorkout}
              onClick={handleSaveMemberWorkout}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                {showWorkoutReflection
                  ? isSavingWorkout
                    ? "Lagrer økt..."
                    : "Lagre økt"
                  : "Avslutt og lagre økt"}
              </span>
            </GradientButton>
          )}
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            <OutlineButton type="button" className="w-full" onClick={cancelWorkoutMode}>
              Avbryt
            </OutlineButton>
            <OutlineButton
              type="button"
              className="w-full"
              onClick={() => setWorkoutExerciseIndex((prev) => Math.max(0, prev - 1))}
              disabled={workoutExerciseIndex === 0}
            >
              Forrige øvelse
            </OutlineButton>
            <GradientButton
              type="button"
              className="w-full"
              onClick={handleGoToNextWorkoutExercise}
              disabled={workoutExerciseIndex >= workoutResultGroups.length - 1}
            >
              Neste øvelse
            </GradientButton>
          </div>
        </div>
      </div>

      {showExerciseDetail && currentWorkoutExercise && currentWorkoutGroup ? (
        <div
          className="motus-modal-insets fixed inset-0 z-[10015] flex flex-col overscroll-contain bg-slate-900/55"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workout-exercise-detail-title"
        >
          <div className="mx-auto flex h-full w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
            <div
              className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <button
                type="button"
                onClick={() => setShowExerciseDetail(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                aria-label="Tilbake til øktmodus"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => setShowExerciseDetail(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="motus-scroll-touch flex-1 overflow-auto p-4">
              {currentWorkoutExerciseImageUrl ? (
                <div
                  className="overflow-hidden rounded-2xl border bg-slate-100"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <img
                    key={currentWorkoutExercise.id}
                    src={currentWorkoutExerciseImageUrl}
                    alt={`Illustrasjon av ${currentWorkoutGroup.exerciseName}`}
                    className="max-h-[min(52vh,420px)] w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border bg-slate-100 px-4 py-10 text-center text-sm text-slate-500" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  Ingen bilde tilgjengelig for denne øvelsen.
                </div>
              )}

              <h2 id="workout-exercise-detail-title" className="mt-4 text-xl font-bold text-slate-900">
                {currentWorkoutGroup.exerciseName}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{currentWorkoutExercise.category}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{currentWorkoutExercise.group}</span>
                {currentWorkoutExercise.equipment ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{currentWorkoutExercise.equipment}</span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{currentWorkoutExercise.level}</span>
              </div>

              <div className="mt-4 rounded-xl border bg-slate-50 px-3 py-3 text-sm text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan i dag</div>
                <div className="mt-1 font-medium">{currentWorkoutPlanLabel}</div>
              </div>

              {currentWorkoutExercise.description?.trim() ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Om øvelsen</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{currentWorkoutExercise.description}</p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <GradientButton type="button" className="w-full" onClick={() => setShowExerciseDetail(false)}>
                Tilbake til øktmodus
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
