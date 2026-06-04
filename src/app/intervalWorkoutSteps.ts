import { isLegacyIntervalCooldownDrag, parseProgramSetCount } from "./programBlocks";
import {
  CARDIO_COOLDOWN_STEP_NAME,
  cardioIntervalMetricHints,
  cardioIntervalRestMetricHints,
  isCardioCooldownStepName,
  type CardioEquipmentId,
} from "./cardioEquipment";
import type { Exercise, TrainingProgram } from "./types";

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

/** Bygger nedtellingssteg for kondisjonsøkt (oppvarming → drag × N → nedtrapping). */
export function buildIntervalProgramSteps(program: TrainingProgram, exercises: Exercise[]): IntervalTimerStep[] {
  const programTitle = program.title;
  const steps: IntervalTimerStep[] = [];
  const exercisesById = new Map(exercises.map((item) => [item.id, item]));
  let workOrdinal = 0;
  let dragOrdinal = 0;
  let lastWorkHeadline = "";
  let sessionEquipment: CardioEquipmentId = "treadmill";

  for (let index = 0; index < program.exercises.length; index++) {
    const exercise = program.exercises[index];
    const bankExercise = exercisesById.get(exercise.exerciseId);
    const metrics = cardioIntervalMetricHints(exercise, bankExercise);
    if (index === 0) sessionEquipment = metrics.equipmentId;
    const minutesPart = (Number(exercise.durationMinutes) || 0) * 60;
    const secondsPart = Number(exercise.holdSeconds) || 0;
    const workDurationSeconds = Math.max(0, Math.round(minutesPart + secondsPart));
    const rawRestStr = String(exercise.restSeconds ?? "").trim();
    const rawRestParsed = rawRestStr === "" ? NaN : Number(rawRestStr);
    const rawRestValue = Number.isFinite(rawRestParsed) ? rawRestParsed : 0;
    const normalizedRestSeconds =
      rawRestValue > 0 && rawRestValue <= 15 ? Math.round(rawRestValue * 60) : Math.round(rawRestValue);

    const lowerName = exercise.exerciseName.toLowerCase();
    const setCount = parseProgramSetCount(exercise.sets);
    const isExplicitMultiRepDrag = setCount > 1 && /\bdrag\b/i.test(exercise.exerciseName);
    const isCooldown =
      !isExplicitMultiRepDrag &&
      (isCardioCooldownStepName(exercise.exerciseName) || isLegacyIntervalCooldownDrag(program.exercises, index));
    let tone: IntervalTimerStep["tone"] =
      lowerName.includes("oppvarm") ? "warmup" : isCooldown ? "cooldown" : "work";
    const nameImpliesExplicitWorkSegment =
      /\bdrag\b/i.test(exercise.exerciseName) || lowerName.includes("tempo") || lowerName.includes("tabata");
    if (index === 0 && tone === "work" && !nameImpliesExplicitWorkSegment) {
      tone = "warmup";
    }
    const isDragSlot =
      tone === "work" &&
      !lowerName.includes("tempo") &&
      !lowerName.includes("tabata") &&
      (/\bdrag\b/i.test(exercise.exerciseName) ||
        /\bintervall\b/i.test(exercise.exerciseName) ||
        /4x4/i.test(programTitle));
    const repeatCount = isDragSlot ? setCount : 1;

    if (workDurationSeconds > 0) {
      const isClassic4x4Drag = /4x4/i.test(programTitle) && /drag/i.test(exercise.exerciseName);
      const legacy4x4DragPauseSeconds = rawRestStr === "" && isClassic4x4Drag ? 180 : 0;
      const restDurationSeconds = normalizedRestSeconds > 0 ? normalizedRestSeconds : legacy4x4DragPauseSeconds;

      let headline: string;
      if (tone === "warmup") headline = "Oppvarming";
      else if (tone === "cooldown") headline = CARDIO_COOLDOWN_STEP_NAME;
      else if (tone === "work") {
        workOrdinal += 1;
        if (lowerName.includes("tabata")) headline = `Tabata ${workOrdinal}`;
        else if (lowerName.includes("tempo")) headline = `Tempo ${workOrdinal}`;
        else if (isDragSlot) headline = "Drag";
        else headline = `Intervall ${workOrdinal}`;
      } else headline = exercise.exerciseName.trim() || `Intervall ${index + 1}`;

      for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
        const repeatedHeadline =
          isDragSlot
            ? `Drag ${++dragOrdinal}`
            : repeatCount > 1 && tone === "work"
              ? `${headline} ${repeatIndex}`
              : headline;
        lastWorkHeadline = repeatedHeadline;
        steps.push({
          headline: repeatedHeadline,
          phaseBadge: computeIntervalPhaseBadge(tone, repeatedHeadline),
          durationSeconds: workDurationSeconds,
          speedHint: metrics.primaryHint,
          inclineHint: metrics.secondaryHint,
          hrHint: formatIntervalTimerHrHint(exercise.targetHrPercent),
          tone,
          sourceExerciseIndex: index,
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

    const hasNextStep = index < program.exercises.length - 1;
    const nextExerciseName = program.exercises[index + 1]?.exerciseName ?? "";
    const nextIsCooldown =
      isCardioCooldownStepName(nextExerciseName) ||
      (!/\bdrag\b/i.test(nextExerciseName) && isLegacyIntervalCooldownDrag(program.exercises, index + 1));
    const restAfterRow = normalizedRestSeconds > 0 && (!isDragSlot || repeatCount <= 1) && hasNextStep && !nextIsCooldown;
    if (restAfterRow) {
      const afterLabel = lastWorkHeadline || exercise.exerciseName.trim() || `Steg ${index + 1}`;
      const restHints = cardioIntervalRestMetricHints(sessionEquipment);
      steps.push({
        headline: "Pause",
        phaseBadge: "Pause",
        afterExerciseName: afterLabel,
        durationSeconds: normalizedRestSeconds,
        speedHint: restHints.primaryHint,
        inclineHint: restHints.secondaryHint,
        hrHint: "",
        tone: "rest",
      });
    }
  }

  return steps;
}

export function countIntervalWorkSteps(steps: IntervalTimerStep[]): number {
  return steps.filter((step) => step.tone === "work").length;
}
