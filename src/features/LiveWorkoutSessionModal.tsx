import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Minus, Plus, Repeat2, SkipForward, TimerReset, Trash2, X } from "lucide-react";
import { motusHaptic } from "../app/haptics";
import { remainingSecondsUntilDeadline } from "../app/intervalTimerDeadline";
import { useScreenWakeLock } from "../app/useScreenWakeLock";
import { playWorkoutRestTone, primeWorkoutRestAudio } from "../app/workoutRestAudio";
import { WorkoutCompactSetTable } from "./LiveWorkoutCompactSets";
import { MOTUS } from "../app/data";
import { EXERCISE_IMAGE_INSET_CLASS, EXERCISE_IMAGE_SMALL_CLASS } from "../app/exerciseIllustrations/constants";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { buildWorkoutResultGroups, EXERCISE_BLOCK_LABELS } from "../app/programBlocks";
import {
  formatWorkoutGroupPlanLabel,
  formatWorkoutSegmentPlanLabel,
  resolveWorkoutGroupExerciseName,
  type WorkoutPlanLabelOptions,
} from "../app/programExercisePresentation";
import { GradientButton, OutlineButton, TextArea, TextInput } from "../app/ui";
import type { Exercise, TrainingProgram, WorkoutModeState, WorkoutReflection } from "../app/types";
import { resolveDetailLastSessionLabel } from "../app/lastSessionSetDisplay";
import { buildTrainingProgramFromWorkoutMode } from "../app/pausedWorkoutSession";
import {
  canRemoveLastExtraWorkoutSet,
  MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE,
  resolveWorkoutBaselineSetCount,
  type ReplaceWorkoutExerciseGroupInput,
} from "../services/appRepository";

const WORKOUT_PLAN_LABEL_OPTIONS: WorkoutPlanLabelOptions = { useLiveSetCount: false };

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
      | "performedLoadUnit"
      | "completed",
    value: string | boolean,
  ) => void;
  replaceWorkoutExerciseGroup: (input: ReplaceWorkoutExerciseGroupInput) => void;
  appendWorkoutSetForProgramExercise: (programExerciseId: string) => void;
  removeLastWorkoutSetForProgramExercise: (programExerciseId: string) => void;
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
  /** Beste score (vekt × max(reps, 1)) per øvelse fra tidligere logger. Brukes til inline PR-feiring per sett. */
  previousPersonalBests?: Map<string, number>;
  /** Kalles når et sett markeres som fullført og slår tidligere rekord. */
  onSetPersonalRecord?: (exerciseName: string) => void;
  /** Siste utførte sett per øvelse (lowercase navn) og settnummer. Vises i grått som placeholder/fallback i øktmodus. */
  lastSessionByExercise?: Map<
    string,
    Map<number, { weight?: string; reps?: string; durationMinutes?: string; speed?: string; incline?: string }>
  >;
};

type RestCountdownState = {
  groupId: string;
  endsAtMs: number;
  totalSeconds: number;
};

type FinishWorkoutAction = "trainer-save" | "member-reflection" | "member-save";

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
  removeLastWorkoutSetForProgramExercise,
  deferWorkoutExerciseGroup,
  updateWorkoutModeNote,
  updateWorkoutExerciseNote,
  finishWorkoutMode,
  cancelWorkoutMode,
  onDismissWorkout,
  trainerSubtitle,
  onWorkoutExerciseIndexChange,
  restCountdownEnabled = true,
  previousPersonalBests,
  onSetPersonalRecord,
  lastSessionByExercise,
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
  const [pendingIncompleteFinishAction, setPendingIncompleteFinishAction] = useState<FinishWorkoutAction | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [blockSwapOpenForProgramExerciseId, setBlockSwapOpenForProgramExerciseId] = useState<string | null>(null);
  const [blockDetailExercise, setBlockDetailExercise] = useState<Exercise | null>(null);
  const deferredJumpTargetGroupIdRef = useRef<string | null>(null);
  const incompleteWarningSeenRef = useRef(false);
  const completedCountByGroupRef = useRef<Record<string, number>>({});
  const lastRestBeepSecondRef = useRef<number | null>(null);

  useScreenWakeLock(Boolean(workoutMode));

  useEffect(() => {
    if (!workoutMode) return;
    motusHaptic("medium");
  }, [workoutMode?.programId]);

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
      setPendingIncompleteFinishAction(null);
      incompleteWarningSeenRef.current = false;
      return;
    }
    setWorkoutExerciseIndex(0);
    setShowWorkoutReflection(false);
    setIsSavingWorkout(false);
    setPendingIncompleteFinishAction(null);
    incompleteWarningSeenRef.current = false;
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
    setBlockDetailExercise(null);
    setBlockSwapOpenForProgramExerciseId(null);
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
      if (event.key === "Escape") closeExerciseDetail();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showExerciseDetail]);

  const exerciseByName = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise])),
    [exercises],
  );

  /** Velg «samme muskelgruppe + samme kategori» — fall tilbake til samme kategori om gruppen er tom. */
  function computeReplacementCandidatesForExercise(sourceExercise: Exercise | null): Exercise[] {
    if (!sourceExercise) return [];
    const sameGroup = exercises.filter(
      (exercise) =>
        exercise.id !== sourceExercise.id &&
        exercise.group.trim().toLowerCase() === sourceExercise.group.trim().toLowerCase() &&
        exercise.category === sourceExercise.category,
    );
    if (sameGroup.length > 0) return sameGroup;
    return exercises.filter(
      (exercise) => exercise.id !== sourceExercise.id && exercise.category === sourceExercise.category,
    );
  }

  function resolveExerciseForProgramExerciseId(programExerciseId: string, exerciseName: string): Exercise | null {
    const byName = exerciseByName.get(exerciseName.trim().toLowerCase());
    if (byName) return byName;
    if (!resolvedProgram) return null;
    const sourceProgramExercise = resolvedProgram.exercises.find((exercise) => exercise.id === programExerciseId);
    if (!sourceProgramExercise) return null;
    return exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
  }

  const replacementCandidates = useMemo(() => {
    if (!resolvedProgram || !currentWorkoutGroup || currentWorkoutGroup.blockType) return [] as Exercise[];
    const sourceExercise = resolveExerciseForProgramExerciseId(
      currentWorkoutGroup.groupId,
      currentWorkoutGroup.exerciseName,
    );
    return computeReplacementCandidatesForExercise(sourceExercise);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedProgram, currentWorkoutGroup, exerciseByName, exercises]);

  const blockExerciseInfos = useMemo(() => {
    if (!currentWorkoutGroup?.blockType) return [];
    return currentWorkoutGroup.segments.map((segment) => {
      const exercise = resolveExerciseForProgramExerciseId(segment.programExerciseId, segment.exerciseName);
      const candidates = computeReplacementCandidatesForExercise(exercise);
      const imageUrl = exercise ? resolveExerciseImageSrc(exercise) : "";
      return {
        programExerciseId: segment.programExerciseId,
        exerciseName: segment.exerciseName,
        planLabel: formatWorkoutSegmentPlanLabel(
          segment.programExerciseId,
          segment.rows,
          resolvedProgram,
          exercises,
          WORKOUT_PLAN_LABEL_OPTIONS,
        ),
        exercise,
        imageUrl,
        candidates,
        setCount: segment.rows.length,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkoutGroup, exerciseByName, exercises, resolvedProgram]);

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

  /** Foretrukket «detalj»-øvelse: et segment i blokk hvis valgt, ellers gjeldende øvelse. */
  const detailExercise = blockDetailExercise ?? currentWorkoutExercise;
  const detailExerciseImageUrl = detailExercise ? resolveExerciseImageSrc(detailExercise) : "";

  function closeExerciseDetail() {
    setShowExerciseDetail(false);
    setBlockDetailExercise(null);
  }

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
  const workoutProgressDegrees = Math.round((workoutProgressPct / 100) * 360);

  const completedSetsCount = workoutMode?.results.filter((r) => r.completed).length ?? 0;
  const totalSetsCount = workoutMode?.results.length ?? 0;
  const incompleteSetsCount = Math.max(0, totalSetsCount - completedSetsCount);
  const incompleteWorkoutGroups = useMemo(
    () => workoutResultGroups.filter((group) => group.rows.some((row) => !row.completed)),
    [workoutResultGroups],
  );
  const firstIncompleteWorkoutGroupIndex = workoutResultGroups.findIndex((group) =>
    group.rows.some((row) => !row.completed),
  );
  const incompleteExerciseNames = incompleteWorkoutGroups.map((group) => group.exerciseName).filter(Boolean);
  const incompleteExerciseCount = incompleteWorkoutGroups.length;

  const activeSetProgressLabel = useMemo(() => {
    if (!currentWorkoutGroup || currentWorkoutGroup.blockType) return "";
    const completed = currentWorkoutGroup.rows.filter((r) => r.completed).length;
    return `Sett ${Math.min(completed + 1, currentWorkoutGroup.rows.length)} av ${currentWorkoutGroup.rows.length}`;
  }, [currentWorkoutGroup]);

  const currentWorkoutDisplayName = useMemo(() => {
    if (!currentWorkoutGroup) return "";
    return resolveWorkoutGroupExerciseName(currentWorkoutGroup, resolvedProgram);
  }, [currentWorkoutGroup, resolvedProgram]);

  const currentWorkoutPlanLabel = useMemo(() => {
    if (!currentWorkoutGroup) return "";
    return formatWorkoutGroupPlanLabel(currentWorkoutGroup, resolvedProgram, exercises, WORKOUT_PLAN_LABEL_OPTIONS);
  }, [currentWorkoutGroup, resolvedProgram, exercises]);

  const nextWorkoutPlanLabel = useMemo(() => {
    if (!nextWorkoutGroup) return "";
    return formatWorkoutGroupPlanLabel(nextWorkoutGroup, resolvedProgram, exercises, WORKOUT_PLAN_LABEL_OPTIONS);
  }, [nextWorkoutGroup, resolvedProgram, exercises]);

  const currentProgramExerciseId = currentWorkoutGroup?.segments[0]?.programExerciseId ?? "";
  const canRemoveCurrentExtraSet =
    Boolean(currentWorkoutGroup && !currentWorkoutGroup.blockType && currentProgramExerciseId) &&
    canRemoveLastExtraWorkoutSet(currentWorkoutGroup!.rows, {
      baselineSetCount: resolveWorkoutBaselineSetCount(
        currentProgramExerciseId,
        currentWorkoutGroup!.rows,
        workoutMode,
        resolvedProgram,
      ),
    });

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

  function handleReplaceBlockSegmentExercise(programExerciseId: string, replacementExerciseId: string) {
    if (!programExerciseId || !replacementExerciseId) return;
    const replacementExercise = exercises.find((exercise) => exercise.id === replacementExerciseId);
    if (!replacementExercise) return;
    replaceWorkoutExerciseGroup({
      programExerciseId,
      nextExerciseName: replacementExercise.name,
    });
    setBlockSwapOpenForProgramExerciseId(null);
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
    motusHaptic("selection");
    setWorkoutExerciseIndex((prev) => prev + 1);
  }

  function handleDeferCurrentWorkoutExercise() {
    if (!currentWorkoutGroup || !nextWorkoutGroup) return;
    setRestCountdown(null);
    deferredJumpTargetGroupIdRef.current = nextWorkoutGroup.groupId;
    deferWorkoutExerciseGroup(currentWorkoutGroup.groupId);
  }

  function finishTrainerWorkout() {
    if (isSavingWorkout) return;
    setIsSavingWorkout(true);
    finishWorkoutMode({
      onPersisted: () => setIsSavingWorkout(false),
    });
  }

  function continueMemberFinishFlow() {
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

  function requestFinishWorkout(action: FinishWorkoutAction) {
    if (incompleteSetsCount > 0 && !incompleteWarningSeenRef.current) {
      setPendingIncompleteFinishAction(action);
      return;
    }
    if (action === "trainer-save") {
      finishTrainerWorkout();
      return;
    }
    continueMemberFinishFlow();
  }

  function confirmIncompleteFinish() {
    const action = pendingIncompleteFinishAction;
    setPendingIncompleteFinishAction(null);
    incompleteWarningSeenRef.current = true;
    if (action === "trainer-save") {
      finishTrainerWorkout();
      return;
    }
    if (action === "member-reflection" || action === "member-save") {
      continueMemberFinishFlow();
    }
  }

  function handleGoToFirstIncompleteExercise() {
    setPendingIncompleteFinishAction(null);
    setShowWorkoutReflection(false);
    setRestCountdown(null);
    if (firstIncompleteWorkoutGroupIndex >= 0) {
      setWorkoutExerciseIndex(firstIncompleteWorkoutGroupIndex);
    }
  }

  function handleSaveTrainerWorkout() {
    requestFinishWorkout("trainer-save");
  }

  function handleSaveMemberWorkout() {
    requestFinishWorkout(showWorkoutReflection ? "member-save" : "member-reflection");
  }

  if (!workoutMode || !resolvedProgram) return null;

  const detailLastSessionLabel = resolveDetailLastSessionLabel({
    lastSessionByExercise,
    detailExercise,
    blockDetailExercise,
    currentWorkoutExerciseName: currentWorkoutGroup?.exerciseName,
    currentWorkoutBlockType: currentWorkoutGroup?.blockType,
    blockExerciseInfos,
    exercises,
  });

  const headerTitle = variant === "trainer" ? "Live PT-økt" : "Øktmodus";

  return (
    <div className="motus-workout-focus fixed inset-0 z-[10010] overscroll-contain bg-black">
      <div className="motus-workout-focus-panel mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-slate-950 text-white shadow-2xl sm:rounded-3xl">
        <div className="relative overflow-hidden border-b border-white/10 bg-slate-900 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pb-4 sm:pt-5">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={leaveWorkout}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15 sm:h-10 sm:w-10"
              aria-label="Pause økt"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] motus-brand-on-dark sm:text-xs sm:tracking-[0.16em]">{headerTitle}</div>
              <div className="mt-0.5 truncate text-sm font-bold tracking-tight text-white sm:mt-1 sm:text-lg sm:font-black">{resolvedProgram.title}</div>
              {trainerSubtitle ? <div className="mt-0.5 truncate text-[10px] text-white/60 sm:text-xs">{trainerSubtitle}</div> : null}
            </div>
            <button
              type="button"
              onClick={leaveWorkout}
              className="shrink-0 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-white/15 sm:px-3 sm:py-2 sm:text-xs"
            >
              {onDismissWorkout ? "Pause" : "Avslutt"}
            </button>
          </div>
          <div className="mt-2 sm:hidden">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-white/65">
              <span className="tabular-nums">{workoutProgressPct}% fullført</span>
              <span className="tabular-nums">
                {workoutExerciseIndex + 1}/{workoutResultGroups.length} øvelser · {completedSetsCount}/{totalSetsCount} sett
              </span>
            </div>
            <div className="motus-progress-track mt-1.5 h-1 rounded-full">
              <div
                className="motus-progress-fill h-full rounded-full transition-all duration-300"
                style={{ width: `${workoutProgressPct}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
              />
            </div>
          </div>

          <div className="mt-5 hidden gap-4 sm:grid sm:grid-cols-[8.5rem_1fr] sm:items-center">
            <div
              className="mx-auto flex h-32 w-32 items-center justify-center rounded-full p-2 shadow-2xl shadow-teal-500/20"
              style={{
                background: `conic-gradient(${MOTUS.turquoise} 0deg, ${MOTUS.pink} ${workoutProgressDegrees}deg, rgba(255,255,255,0.14) ${workoutProgressDegrees}deg 360deg)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-slate-950 text-center ring-1 ring-white/10">
                <span className="text-3xl font-black tabular-nums text-white">{workoutProgressPct}%</span>
                <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">fullført</span>
              </div>
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <div className="text-xs font-black uppercase tracking-wide motus-brand-on-dark-muted">Nå</div>
              <div className="mt-1 truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                {currentWorkoutDisplayName || currentWorkoutGroup?.exerciseName || "Økt i gang"}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs font-semibold text-white/70 sm:justify-start">
                <span className="rounded-full bg-white/10 px-3 py-1">{workoutExerciseIndex + 1} av {workoutResultGroups.length} øvelser</span>
                <span className="rounded-full bg-white/10 px-3 py-1">{completedSetsCount}/{totalSetsCount} sett</span>
                {activeSetProgressLabel ? <span className="rounded-full bg-white/10 px-3 py-1">{activeSetProgressLabel}</span> : null}
              </div>
            </div>
          </div>
          <div className="motus-progress-track mt-3 hidden h-1 rounded-full sm:block">
            <div
              className="motus-progress-fill h-full rounded-full transition-all duration-300"
              style={{ width: `${workoutProgressPct}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise}, ${MOTUS.pink})` }}
            />
          </div>
          <div className="mt-2 hidden items-center justify-between gap-2 text-xs text-white/55 sm:flex">
            <span>
              {workoutExerciseIndex + 1} av {workoutResultGroups.length} øvelser
            </span>
            <span>
              {completedSetsCount}/{totalSetsCount} sett
            </span>
          </div>
        </div>

        <div className="motus-scroll-touch flex-1 space-y-2 overflow-auto bg-slate-950 p-2 sm:space-y-3 sm:p-4">
          {currentWorkoutGroup ? (
            <div
              key={currentWorkoutGroup.groupId}
              className="w-full rounded-xl border border-white/10 bg-white p-2.5 text-left text-slate-900 shadow-xl shadow-black/20 transition sm:rounded-2xl sm:p-4"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  {currentWorkoutGroup.blockType ? (
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
                      {EXERCISE_BLOCK_LABELS[currentWorkoutGroup.blockType]}
                      {currentWorkoutGroup.blockRounds ? ` · ${currentWorkoutGroup.blockRounds} runder` : ""}
                    </div>
                  ) : null}
                  <h2 className="mt-0.5 text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                    {currentWorkoutDisplayName || currentWorkoutGroup.exerciseName}
                  </h2>
                  {activeSetProgressLabel ? (
                    <div className="mt-0.5 text-xs font-medium text-slate-600 sm:mt-1 sm:text-sm">{activeSetProgressLabel}</div>
                  ) : null}
                  <div className="mt-0.5 text-[11px] text-slate-500 sm:mt-1 sm:text-xs">Plan: {currentWorkoutPlanLabel}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
                    {replacementCandidates.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowReplacementOptions((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                        style={{ background: `${MOTUS.gradient}` }}
                        aria-label="Bytt øvelse"
                        title="Bytt øvelse"
                      >
                        <Repeat2 className="h-3.5 w-3.5" />
                        Bytt
                      </button>
                    ) : null}
                  </div>
                </div>
                {currentWorkoutExercise && !currentWorkoutGroup.blockType ? (
                  <button
                    type="button"
                    onClick={() => setShowExerciseDetail(true)}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:ring-2 hover:ring-teal-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 sm:h-24 sm:w-24 sm:rounded-xl"
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
              {currentWorkoutGroup.blockType && blockExerciseInfos.length > 0 ? (
                <div className="mt-2 space-y-2 sm:mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
                    Øvelser i {EXERCISE_BLOCK_LABELS[currentWorkoutGroup.blockType].toLowerCase()}
                  </div>
                  <ul className="motus-block-exercise-list">
                    {blockExerciseInfos.map((info, index) => {
                      const isSwapOpen = blockSwapOpenForProgramExerciseId === info.programExerciseId;
                      return (
                        <li key={info.programExerciseId} className="motus-block-exercise-item">
                          <div className="motus-block-exercise-row">
                            <span className="motus-block-exercise-index" aria-hidden>
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (info.exercise) {
                                  setBlockDetailExercise(info.exercise);
                                  setShowExerciseDetail(true);
                                }
                              }}
                              className="motus-block-exercise-thumb"
                              aria-label={info.exercise ? `Vis info om ${info.exerciseName}` : info.exerciseName}
                              disabled={!info.exercise}
                            >
                              {info.imageUrl ? (
                                <img
                                  src={info.imageUrl}
                                  alt=""
                                  className={EXERCISE_IMAGE_INSET_CLASS}
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <span className="motus-block-exercise-thumb-fallback">Info</span>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="motus-block-exercise-name">{info.exerciseName}</p>
                              <p className="motus-block-exercise-meta">{info.planLabel || "—"}</p>
                            </div>
                            {info.candidates.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setBlockSwapOpenForProgramExerciseId((prev) =>
                                    prev === info.programExerciseId ? null : info.programExerciseId,
                                  )
                                }
                                className="motus-block-exercise-swap"
                                aria-expanded={isSwapOpen}
                                aria-label={`Bytt ${info.exerciseName}`}
                              >
                                <Repeat2 className="h-3.5 w-3.5" aria-hidden />
                                Bytt
                              </button>
                            ) : null}
                          </div>
                          {isSwapOpen ? (
                            <div className="motus-block-exercise-swap-panel">
                              <div className="motus-block-exercise-swap-title">
                                Velg ny øvelse (samme muskelgruppe)
                              </div>
                              <div className="motus-block-exercise-swap-options">
                                {info.candidates.map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    onClick={() => handleReplaceBlockSegmentExercise(info.programExerciseId, candidate.id)}
                                    className="motus-block-exercise-swap-option"
                                  >
                                    {candidate.name} · {candidate.group}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {replacementCandidates.length > 0 && showReplacementOptions ? (
                <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-medium text-slate-600">Velg ny øvelse (samme muskelgruppe)</div>
                  <div className="mt-2 grid gap-2">
                    {replacementCandidates.map((exercise) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => handleReplaceCurrentWorkoutExercise(exercise.id)}
                        className="w-full rounded-lg border motus-brand-surface px-3 py-2 text-left text-xs font-medium text-slate-800 transition hover:bg-teal-100"
                      >
                        {exercise.name} · {exercise.group}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {canDeferCurrentExercise ? (
                <div className="mt-2 rounded-lg border bg-white p-2 sm:mt-3 sm:rounded-xl sm:p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <button
                    type="button"
                    onClick={handleDeferCurrentWorkoutExercise}
                    className="inline-flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-800 transition hover:bg-slate-50 sm:px-3 sm:py-2.5 sm:text-xs"
                    style={{ borderColor: "rgba(148,163,184,0.45)" }}
                  >
                    <SkipForward className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" style={{ color: MOTUS.turquoise }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block">Ta neste øvelse først</span>
                      <span className="mt-0.5 hidden text-[10px] font-medium text-slate-500 sm:block">
                        «{currentWorkoutGroup.exerciseName}» blir neste øvelse etter «{nextWorkoutGroup?.exerciseName}»
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
              <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">
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
                                planHint={formatWorkoutSegmentPlanLabel(
                                  segment.programExerciseId,
                                  [segment.row],
                                  resolvedProgram,
                                  exercises,
                                  WORKOUT_PLAN_LABEL_OPTIONS,
                                )}
                                onUpdate={updateWorkoutExerciseResult}
                                previousPersonalBests={previousPersonalBests}
                                onSetPersonalRecord={onSetPersonalRecord}
                                lastSessionByExercise={lastSessionByExercise}
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
                      previousPersonalBests={previousPersonalBests}
                      onSetPersonalRecord={onSetPersonalRecord}
                      lastSessionByExercise={lastSessionByExercise}
                      showRemoveLastSet={canRemoveCurrentExtraSet}
                      onRemoveLastSet={
                        canRemoveCurrentExtraSet
                          ? () => removeLastWorkoutSetForProgramExercise(currentProgramExerciseId)
                          : undefined
                      }
                    />
                  )}
              </div>
              {!currentWorkoutGroup.blockType && currentWorkoutGroup.segments[0] ? (
                <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                  <div className="flex flex-wrap gap-2">
                    {canRemoveCurrentExtraSet ? (
                      <button
                        type="button"
                        onClick={() => removeLastWorkoutSetForProgramExercise(currentProgramExerciseId)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50/60 sm:flex-none"
                        style={{ borderColor: "rgba(148,163,184,0.55)" }}
                        aria-label="Fjern siste ekstra sett"
                      >
                        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Fjern siste sett
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => appendWorkoutSetForProgramExercise(currentWorkoutGroup.segments[0]!.programExerciseId)}
                      disabled={currentWorkoutGroup.rows.length >= MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-teal-400 hover:bg-teal-50/50 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none"
                      style={{ borderColor: "rgba(148,163,184,0.55)" }}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Legg til sett
                    </button>
                  </div>
                  {currentWorkoutGroup.rows.length >= MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE ? (
                    <p className="mt-1.5 text-[10px] text-slate-500">Maks {MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE} sett per øvelse.</p>
                  ) : canRemoveCurrentExtraSet ? (
                    <p className="mt-1.5 text-[10px] text-slate-500">
                      Du kan fjerne ekstra sett du har lagt til under økta. Planlagte sett fra programmet kan ikke slettes her.
                    </p>
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
                              active ? "border-teal-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
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

        <div className="sticky bottom-0 border-t border-white/10 bg-slate-950 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-slate-900 shadow-lg sm:p-4">
          {nextWorkoutGroup && !isLastWorkoutGroup && !showWorkoutReflection ? (
            <button
              type="button"
              onClick={handleGoToNextWorkoutExercise}
              className="mb-2 w-full rounded-lg border bg-slate-50 px-2.5 py-2 text-left transition hover:bg-slate-100 sm:mb-3 sm:rounded-xl sm:p-3"
              style={{ borderColor: "rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
                    Neste øvelse
                    <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                  </div>
                  <div className="truncate text-sm font-semibold text-slate-900 sm:mt-0.5">{nextWorkoutGroup.exerciseName}</div>
                  <div className="hidden truncate text-xs text-slate-500 sm:mt-0.5 sm:block">{nextWorkoutPlanLabel}</div>
                </div>
                {nextWorkoutExercise ? (
                  <img
                    key={nextWorkoutExercise.id}
                    src={resolveExerciseImageSrc(nextWorkoutExercise)}
                    alt=""
                    className={`${EXERCISE_IMAGE_SMALL_CLASS} hidden sm:block`}
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
            </button>
          ) : null}
          {restCountdown ? (
            <div className="mb-2 rounded-lg border bg-teal-50 px-2.5 py-2 sm:mb-3 sm:rounded-xl sm:p-3" style={{ borderColor: "rgba(48,227,190,0.25)" }}>
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm sm:h-10 sm:w-10">
                    <TimerReset className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-700 sm:text-xs">
                      Pause
                    </div>
                    <div className="text-xs font-semibold text-slate-900 sm:text-sm">
                      {restCountdownRemainingSeconds}s til {currentGroupIsComplete && nextWorkoutGroup ? "neste øvelse" : "neste sett"}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, (restCountdownRemainingSeconds / restCountdown.totalSeconds) * 100))}%`,
                          background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
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
                  className="shrink-0 rounded-lg border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-3 sm:py-2 sm:text-xs"
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
              className="mb-2 w-full !min-h-10 !py-2 !text-sm !font-bold shadow-md sm:mb-3 sm:!min-h-[3.25rem] sm:!py-3.5 sm:!text-base"
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
              className="mb-2 w-full !min-h-10 !py-2 !text-sm !font-bold shadow-md sm:mb-3 sm:!min-h-[3.25rem] sm:!py-3.5 sm:!text-base"
              disabled={isSavingWorkout}
              onClick={handleSaveMemberWorkout}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
                {showWorkoutReflection
                  ? isSavingWorkout
                    ? "Lagrer økt..."
                    : "Lagre økt"
                  : (
                    <>
                      <span className="sm:hidden">Lagre økt</span>
                      <span className="hidden sm:inline">Avslutt og lagre økt</span>
                    </>
                  )}
              </span>
            </GradientButton>
          )}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
            <OutlineButton type="button" className="w-full !min-h-9 !px-2 !py-1.5 !text-[11px] sm:!min-h-10 sm:!text-sm" onClick={() => setCancelConfirmOpen(true)}>
              Avbryt
            </OutlineButton>
            <OutlineButton
              type="button"
              className="w-full !min-h-9 !px-2 !py-1.5 !text-[11px] sm:!min-h-10 sm:!text-sm"
              onClick={() => setWorkoutExerciseIndex((prev) => Math.max(0, prev - 1))}
              disabled={workoutExerciseIndex === 0}
            >
              Forrige
            </OutlineButton>
            <GradientButton
              type="button"
              className="w-full !min-h-9 !px-2 !py-1.5 !text-[11px] sm:!min-h-10 sm:!text-sm"
              onClick={handleGoToNextWorkoutExercise}
              disabled={workoutExerciseIndex >= workoutResultGroups.length - 1}
            >
              Neste
            </GradientButton>
          </div>
        </div>
      </div>

      {showExerciseDetail && detailExercise && currentWorkoutGroup ? (
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
                onClick={closeExerciseDetail}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                aria-label="Tilbake til øktmodus"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Tilbake
              </button>
              <button
                type="button"
                onClick={closeExerciseDetail}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="motus-scroll-touch flex-1 overflow-auto p-4">
              {detailExerciseImageUrl ? (
                <div
                  className="overflow-hidden rounded-2xl border bg-slate-100"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <img
                    key={detailExercise.id}
                    src={detailExerciseImageUrl}
                    alt={`Illustrasjon av ${detailExercise.name}`}
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
                {detailExercise.name}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{detailExercise.category}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{detailExercise.group}</span>
                {detailExercise.equipment ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{detailExercise.equipment}</span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{detailExercise.level}</span>
              </div>

              {!blockDetailExercise ? (
                <div className="mt-4 rounded-xl border bg-slate-50 px-3 py-3 text-sm text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plan i dag</div>
                  <div className="mt-1 font-medium">{currentWorkoutPlanLabel}</div>
                </div>
              ) : null}

              {detailExercise.description?.trim() ? (
                <div className="mt-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Om øvelsen</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{detailExercise.description}</p>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              {detailLastSessionLabel ? (
                <div
                  className="mb-3 rounded-xl border bg-slate-50 px-3 py-3 text-sm text-slate-700"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sist sett</div>
                  <div className="mt-1 font-medium text-slate-900">{detailLastSessionLabel}</div>
                </div>
              ) : null}
              <GradientButton type="button" className="w-full" onClick={closeExerciseDetail}>
                Tilbake til øktmodus
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}

      {pendingIncompleteFinishAction ? (
        <div
          className="motus-modal-insets fixed inset-0 z-[10020] flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incomplete-workout-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="incomplete-workout-title" className="text-base font-bold text-slate-950">
                  Du har ikke fullført alt
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {incompleteSetsCount === 1
                    ? "1 sett står fortsatt uferdig."
                    : `${incompleteSetsCount} sett står fortsatt uferdige.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingIncompleteFinishAction(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {incompleteExerciseNames.length > 0 ? (
              <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="font-semibold text-slate-800">
                  {incompleteExerciseCount === 1 ? "Uferdig øvelse" : "Uferdige øvelser"}
                </div>
                <div className="mt-1">
                  {incompleteExerciseNames.slice(0, 3).join(", ")}
                  {incompleteExerciseNames.length > 3 ? ` + ${incompleteExerciseNames.length - 3} til` : ""}
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              <GradientButton type="button" className="w-full" onClick={handleGoToFirstIncompleteExercise}>
                Gå til øvelse
              </GradientButton>
              <OutlineButton type="button" className="w-full" onClick={() => setPendingIncompleteFinishAction(null)}>
                Gå tilbake
              </OutlineButton>
              <OutlineButton type="button" className="w-full" onClick={confirmIncompleteFinish}>
                Lagre likevel
              </OutlineButton>
            </div>
          </div>
        </div>
      ) : null}

      {cancelConfirmOpen ? (
        <div
          className="motus-modal-insets fixed inset-0 z-[10021] flex items-center justify-center bg-slate-900/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-workout-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 id="cancel-workout-title" className="text-base font-bold text-slate-950">
              Er du sikker på at du vil avbryte?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Dette sletter alt du har lagt inn i denne økten
              {completedSetsCount > 0
                ? ` (${completedSetsCount} ${completedSetsCount === 1 ? "registrert sett" : "registrerte sett"})`
                : ""}
              .
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <OutlineButton
                type="button"
                className="w-full"
                onClick={() => setCancelConfirmOpen(false)}
              >
                Nei
              </OutlineButton>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                onClick={() => {
                  setCancelConfirmOpen(false);
                  cancelWorkoutMode();
                }}
              >
                Ja, avbryt
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
