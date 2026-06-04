import {
  isLegacyIntervalCooldownDrag,
  normalizeLegacyIntervalCooldownExerciseNames,
  parseProgramSetCount,
  resolveProgramSegmentRepeatCount,
  splitProgramExercisesIntoSegments,
} from "./programBlocks";
import {
  CARDIO_COOLDOWN_STEP_NAME,
  cardioIntervalMetricHints,
  cardioIntervalRestMetricHints,
  isCardioCooldownStepName,
  type CardioEquipmentId,
} from "./cardioEquipment";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

export type IntervalTimerStep = {
  headline: string;
  phaseBadge: string;
  afterExerciseName?: string;
  durationSeconds: number;
  speedHint: string;
  inclineHint: string;
  hrHint: string;
  tone: "warmup" | "work" | "rest" | "cooldown";
  sourceExerciseIndex?: number;
};

function formatIntervalTimerHrHint(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  if (/%|HF|hf|maks|makspuls|pul/i.test(raw)) return raw;
  return `${raw} % av makspuls`;
}

function computeIntervalPhaseBadge(tone: IntervalTimerStep["tone"], headlineForBadge: string): string {
  if (tone === "warmup") return "Oppvarming";
  if (tone === "cooldown") return CARDIO_COOLDOWN_STEP_NAME;
  if (tone === "rest") return "Pause";
  const lower = headlineForBadge.trim().toLowerCase();
  if (lower.startsWith("drag")) return "Drag";
  if (lower.includes("tempo")) return "Tempo";
  if (lower.includes("tabata")) return "Tabata";
  return "Intervall";
}

function workDurationSecondsForExercise(exercise: ProgramExercise): number {
  const minutesPart = (Number(exercise.durationMinutes) || 0) * 60;
  const secondsPart = Number(exercise.holdSeconds) || 0;
  return Math.max(0, Math.round(minutesPart + secondsPart));
}

function normalizeRestSeconds(rawRestStr: string): number {
  const rawRestParsed = rawRestStr === "" ? NaN : Number(rawRestStr);
  const rawRestValue = Number.isFinite(rawRestParsed) ? rawRestParsed : 0;
  return rawRestValue > 0 && rawRestValue <= 15 ? Math.round(rawRestValue * 60) : Math.round(rawRestValue);
}

function isTimedConditioningExercise(exercise: ProgramExercise, bankExercise: Exercise | undefined): boolean {
  if (workDurationSecondsForExercise(exercise) <= 0) return false;
  if (bankExercise?.category === "Kondisjon") return true;
  const name = exercise.exerciseName.trim().toLowerCase();
  return (
    /\bdrag\b/i.test(name) ||
    /\bintervall\b/i.test(name) ||
    /oppvarm|nedtrapp|nedjogg|tempo|tabata|roing|romaskin|mølle|moelle/i.test(name) ||
    Number(exercise.durationMinutes) > 0
  );
}

function resolveSegmentTone(
  exercise: ProgramExercise,
  segmentIndex: number,
  segmentCount: number,
  programExercises: ProgramExercise[],
  flatIndex: number,
): IntervalTimerStep["tone"] {
  const lowerName = exercise.exerciseName.toLowerCase();
  const setCount = parseProgramSetCount(exercise.sets);
  const durationMinutes = Number(exercise.durationMinutes) || 0;

  if (lowerName.includes("oppvarm")) return "warmup";
  if (
    isCardioCooldownStepName(exercise.exerciseName) ||
    (setCount <= 1 && isLegacyIntervalCooldownDrag(programExercises, flatIndex))
  ) {
    return "cooldown";
  }
  if (segmentIndex === 0 && !/\bdrag\b/i.test(exercise.exerciseName) && durationMinutes >= 3) {
    return "warmup";
  }
  if (
    segmentIndex === segmentCount - 1 &&
    segmentIndex > 0 &&
    durationMinutes >= 3 &&
    setCount <= 1 &&
    !/\bdrag\b/i.test(exercise.exerciseName)
  ) {
    return "cooldown";
  }
  return "work";
}

function isRepeatableWorkInterval(
  exercise: ProgramExercise,
  bankExercise: Exercise | undefined,
  tone: IntervalTimerStep["tone"],
  programTitle: string,
): boolean {
  if (tone !== "work") return false;
  if (!isTimedConditioningExercise(exercise, bankExercise)) return false;
  const lowerName = exercise.exerciseName.toLowerCase();
  if (lowerName.includes("tempo") || lowerName.includes("tabata")) return true;
  return (
    /\bdrag\b/i.test(exercise.exerciseName) ||
    /\bintervall\b/i.test(exercise.exerciseName) ||
    /4x4/i.test(programTitle) ||
    bankExercise?.category === "Kondisjon" ||
    Number(exercise.durationMinutes) > 0
  );
}

function pushWorkAndRestSteps(
  steps: IntervalTimerStep[],
  options: {
    exercise: ProgramExercise;
    flatIndex: number;
    tone: IntervalTimerStep["tone"];
    repeatCount: number;
    workDurationSeconds: number;
    restDurationSeconds: number;
    metrics: ReturnType<typeof cardioIntervalMetricHints>;
    programTitle: string;
    isRepeatableWork: boolean;
    dragOrdinalRef: { value: number };
    workOrdinalRef: { value: number };
    lastWorkHeadlineRef: { value: string };
  },
): void {
  const {
    exercise,
    flatIndex,
    tone,
    repeatCount,
    workDurationSeconds,
    restDurationSeconds,
    metrics,
    programTitle,
    isRepeatableWork,
    dragOrdinalRef,
    workOrdinalRef,
    lastWorkHeadlineRef,
  } = options;
  const lowerName = exercise.exerciseName.toLowerCase();

  let headline: string;
  if (tone === "warmup") headline = "Oppvarming";
  else if (tone === "cooldown") headline = CARDIO_COOLDOWN_STEP_NAME;
  else if (tone === "work") {
    workOrdinalRef.value += 1;
    if (lowerName.includes("tabata")) headline = `Tabata ${workOrdinalRef.value}`;
    else if (lowerName.includes("tempo")) headline = `Tempo ${workOrdinalRef.value}`;
    else if (isRepeatableWork) headline = "Drag";
    else headline = `Intervall ${workOrdinalRef.value}`;
  } else headline = exercise.exerciseName.trim() || `Intervall ${flatIndex + 1}`;

  for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
    const repeatedHeadline =
      isRepeatableWork
        ? `Drag ${++dragOrdinalRef.value}`
        : repeatCount > 1 && tone === "work"
          ? `${headline} ${repeatIndex}`
          : headline;
    lastWorkHeadlineRef.value = repeatedHeadline;
    steps.push({
      headline: repeatedHeadline,
      phaseBadge: computeIntervalPhaseBadge(tone, repeatedHeadline),
      durationSeconds: workDurationSeconds,
      speedHint: metrics.primaryHint,
      inclineHint: metrics.secondaryHint,
      hrHint: formatIntervalTimerHrHint(exercise.targetHrPercent),
      tone,
      sourceExerciseIndex: flatIndex,
    });

    if (restDurationSeconds > 0 && repeatIndex < repeatCount) {
      const restHints = cardioIntervalRestMetricHints(metrics.equipmentId);
      steps.push({
        headline: "Pause",
        phaseBadge: "Pause",
        afterExerciseName: repeatedHeadline,
        durationSeconds: restDurationSeconds,
        speedHint: restHints.primaryHint,
        inclineHint: restHints.secondaryHint,
        hrHint: "",
        tone: "rest",
      });
    }
  }
}

/** Bygger nedtellingssteg for kondisjonsøkt (oppvarming → drag × N → nedtrapping). */
export function buildIntervalProgramSteps(program: TrainingProgram, exercises: Exercise[]): IntervalTimerStep[] {
  const programTitle = program.title;
  const normalizedExercises = normalizeLegacyIntervalCooldownExerciseNames(program.exercises);
  const segments = splitProgramExercisesIntoSegments(normalizedExercises);
  const steps: IntervalTimerStep[] = [];
  const exercisesById = new Map(exercises.map((item) => [item.id, item]));
  const dragOrdinalRef = { value: 0 };
  const workOrdinalRef = { value: 0 };
  const lastWorkHeadlineRef = { value: "" };
  let sessionEquipment: CardioEquipmentId = "treadmill";

  segments.forEach((segment, segmentIndex) => {
    const blockType = segment[0]?.blockType;
    const isCircuitBlock = blockType === "circuit" && segment.length > 1;
    const blockRounds = isCircuitBlock ? resolveProgramSegmentRepeatCount(segment) : 1;

    const pushSegmentExercise = (exercise: ProgramExercise, round?: number) => {
      const flatIndex = normalizedExercises.findIndex((row) => row.id === exercise.id);
      const bankExercise = exercisesById.get(exercise.exerciseId);
      const metrics = cardioIntervalMetricHints(exercise, bankExercise);
      if (segmentIndex === 0 && steps.length === 0) sessionEquipment = metrics.equipmentId;

      const workDurationSeconds = workDurationSecondsForExercise(exercise);
      if (workDurationSeconds <= 0) return;

      const rawRestStr = String(exercise.restSeconds ?? "").trim();
      const normalizedRestSeconds = normalizeRestSeconds(rawRestStr);
      const isClassic4x4Drag = /4x4/i.test(programTitle) && /drag/i.test(exercise.exerciseName);
      const legacy4x4DragPauseSeconds = rawRestStr === "" && isClassic4x4Drag ? 180 : 0;
      const restDurationSeconds = normalizedRestSeconds > 0 ? normalizedRestSeconds : legacy4x4DragPauseSeconds;

      const tone = resolveSegmentTone(
        exercise,
        segmentIndex,
        segments.length,
        normalizedExercises,
        flatIndex >= 0 ? flatIndex : segmentIndex,
      );
      const isRepeatableWork = isRepeatableWorkInterval(exercise, bankExercise, tone, programTitle);
      const repeatCount = isRepeatableWork
        ? resolveProgramSegmentRepeatCount(isCircuitBlock ? [exercise] : segment)
        : 1;

      pushWorkAndRestSteps(steps, {
        exercise,
        flatIndex: flatIndex >= 0 ? flatIndex : segmentIndex,
        tone,
        repeatCount,
        workDurationSeconds,
        restDurationSeconds,
        metrics,
        programTitle,
        isRepeatableWork,
        dragOrdinalRef,
        workOrdinalRef,
        lastWorkHeadlineRef,
      });

      if (round !== undefined && round < blockRounds) {
        const restHints = cardioIntervalRestMetricHints(sessionEquipment);
        steps.push({
          headline: "Pause",
          phaseBadge: "Pause",
          afterExerciseName: lastWorkHeadlineRef.value || exercise.exerciseName.trim(),
          durationSeconds: restDurationSeconds,
          speedHint: restHints.primaryHint,
          inclineHint: restHints.secondaryHint,
          hrHint: "",
          tone: "rest",
        });
      }
    };

    if (isCircuitBlock) {
      for (let round = 1; round <= blockRounds; round += 1) {
        segment.forEach((exercise) => {
          if (round > parseProgramSetCount(exercise.sets)) return;
          pushSegmentExercise(exercise, round);
        });
      }
      return;
    }

    const leader = segment[0];
    if (!leader) return;
    pushSegmentExercise(leader);

    const leaderFlatIndex = normalizedExercises.findIndex((row) => row.id === leader.id);
    const hasNextSegment = segmentIndex < segments.length - 1;
    const nextSegment = segments[segmentIndex + 1];
    const nextLeader = nextSegment?.[0];
    const nextFlatIndex = nextLeader
      ? normalizedExercises.findIndex((row) => row.id === nextLeader.id)
      : -1;
    const nextIsCooldown =
      nextLeader &&
      (isCardioCooldownStepName(nextLeader.exerciseName) ||
        (nextFlatIndex >= 0 &&
          !/\bdrag\b/i.test(nextLeader.exerciseName) &&
          isLegacyIntervalCooldownDrag(normalizedExercises, nextFlatIndex)));

    const leaderRest = normalizeRestSeconds(String(leader.restSeconds ?? "").trim());
    const leaderRepeat = resolveProgramSegmentRepeatCount(segment);
    const leaderBank = exercisesById.get(leader.exerciseId);
    const leaderTone = resolveSegmentTone(
      leader,
      segmentIndex,
      segments.length,
      normalizedExercises,
      leaderFlatIndex >= 0 ? leaderFlatIndex : segmentIndex,
    );
    const leaderRepeatable = isRepeatableWorkInterval(leader, leaderBank, leaderTone, programTitle);

    const restAfterSegment =
      leaderRest > 0 &&
      hasNextSegment &&
      !nextIsCooldown &&
      (!leaderRepeatable || leaderRepeat <= 1);
    if (restAfterSegment) {
      const restHints = cardioIntervalRestMetricHints(sessionEquipment);
      steps.push({
        headline: "Pause",
        phaseBadge: "Pause",
        afterExerciseName: lastWorkHeadlineRef.value || leader.exerciseName.trim() || `Steg ${segmentIndex + 1}`,
        durationSeconds: leaderRest,
        speedHint: restHints.primaryHint,
        inclineHint: restHints.secondaryHint,
        hrHint: "",
        tone: "rest",
      });
    }
  });

  return steps;
}

export function countIntervalWorkSteps(steps: IntervalTimerStep[]): number {
  return steps.filter((step) => step.tone === "work").length;
}
