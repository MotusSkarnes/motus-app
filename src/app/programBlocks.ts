import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "./exerciseCategories";
import { mergeProgramAuthorFields } from "./programAuthor";
import { mergeProgramImageUrl } from "./programImage";
import { CARDIO_COOLDOWN_STEP_NAME, isCardioCooldownStepName } from "./cardioEquipment";
import type {
  Exercise,
  MemberProgramLibraryStatus,
  ProgramExercise,
  TrainingProgram,
  WorkoutExerciseResult,
} from "./types";

export type ExerciseBlockType = "superset" | "triset" | "circuit";

export const EXERCISE_BLOCK_LABELS: Record<ExerciseBlockType, string> = {
  superset: "Supersett",
  triset: "Trisett",
  circuit: "Sirkel",
};

export type WorkoutResultGroup = {
  groupId: string;
  blockType?: ExerciseBlockType;
  blockRounds?: number;
  exerciseName: string;
  exerciseNames: string[];
  plannedReps: string;
  plannedWeight: string;
  rows: WorkoutExerciseResult[];
  /** Øvelser i blokken med egne sett-rader (sortert programrekkefølge). */
  segments: Array<{
    programExerciseId: string;
    exerciseName: string;
    rows: WorkoutExerciseResult[];
  }>;
  /** Runder for visning (superset/triset/sirkel). */
  rounds: Array<{
    round: number;
    segments: Array<{
      programExerciseId: string;
      exerciseName: string;
      row: WorkoutExerciseResult | null;
    }>;
  }>;
};

export function buildTrainingProgramDisplayKey(program: Pick<TrainingProgram, "title" | "goal" | "notes" | "exercises">): string {
  const exerciseFingerprint = program.exercises
    .map(
      (item) =>
        `${item.exerciseName}|${item.sets}|${item.reps}|${item.repsUnit ?? ""}|${item.weight}|${item.weightUnit ?? ""}|${item.holdSeconds ?? ""}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.targetHrPercent ?? ""}|${item.notes}`,
    )
    .join("||");
  return `${program.title.trim()}::${program.goal.trim()}::${program.notes.trim()}::${exerciseFingerprint}`;
}

/** Legacy «hidden» behandles som arkivert (skjul fra oversikt er fjernet i UI). */
export function normalizeMemberLibraryStatus(
  status: MemberProgramLibraryStatus | undefined,
): MemberProgramLibraryStatus | undefined {
  if (status === "hidden") return "archived";
  return status;
}

export function programIsInMemberArchive(status: MemberProgramLibraryStatus | undefined): boolean {
  return normalizeMemberLibraryStatus(status) === "archived";
}

/** Ved duplikat-rader / hydrering: behold arkiv hvis én kopi har det. */
export function pickRestrictiveMemberLibraryStatus(
  a: MemberProgramLibraryStatus | undefined,
  b: MemberProgramLibraryStatus | undefined,
): MemberProgramLibraryStatus | undefined {
  const left = normalizeMemberLibraryStatus(a);
  const right = normalizeMemberLibraryStatus(b);
  if (left === "archived" || right === "archived") return "archived";
  return undefined;
}

export function mergeTrainingProgramDuplicates(existing: TrainingProgram, incoming: TrainingProgram): TrainingProgram {
  const newer = existing.createdAt.localeCompare(incoming.createdAt) >= 0 ? existing : incoming;
  const older = newer === existing ? incoming : existing;
  return {
    ...newer,
    ...mergeProgramAuthorFields(newer, older),
    imageUrl: mergeProgramImageUrl(newer.imageUrl, older.imageUrl),
    memberLibraryStatus: pickRestrictiveMemberLibraryStatus(newer.memberLibraryStatus, older.memberLibraryStatus),
  };
}

/** Én rad per programinnhold (nyeste vinner) — brukes i medlems-UI og varsler. */
export function dedupeTrainingPrograms(programs: TrainingProgram[]): TrainingProgram[] {
  const ephemeralPrograms: TrainingProgram[] = [];
  const uniqueByFingerprint = new Map<string, TrainingProgram>();
  programs.forEach((program) => {
    if (program.ephemeral) {
      ephemeralPrograms.push(program);
      return;
    }
    const fingerprint = buildTrainingProgramDisplayKey(program);
    const existing = uniqueByFingerprint.get(fingerprint);
    if (!existing) {
      uniqueByFingerprint.set(fingerprint, program);
      return;
    }
    uniqueByFingerprint.set(fingerprint, mergeTrainingProgramDuplicates(existing, program));
  });
  return [...ephemeralPrograms, ...Array.from(uniqueByFingerprint.values())].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function parseProgramSetCount(value: string | undefined): number {
  const trimmed = String(value ?? "").trim();
  const leadingDigits = trimmed.match(/^(\d{1,2})/);
  if (leadingDigits) {
    const parsed = Number(leadingDigits[1]);
    if (Number.isFinite(parsed) && parsed >= 1) return Math.min(18, Math.round(parsed));
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(18, Math.round(parsed));
}

function isIntervalTimedProgram(exercises: ProgramExercise[]): boolean {
  if (exercises.length < 2) return false;
  return exercises.every((row) => {
    const name = row.exerciseName.trim().toLowerCase();
    return (
      Number(row.durationMinutes) > 0 ||
      /^oppvarming$/i.test(name) ||
      /^drag\b/i.test(name) ||
      isCardioCooldownStepName(name) ||
      /cooldown/i.test(name)
    );
  });
}

/** Siste rad i intervallprogram som fortsatt heter «Drag …» men er nedtrapping (eldre maler). */
export function isLegacyIntervalCooldownDrag(exercises: ProgramExercise[], index: number): boolean {
  const exercise = exercises[index];
  const previousExercise = exercises[index - 1];
  if (!exercise || index !== exercises.length - 1 || !isIntervalTimedProgram(exercises)) return false;

  const name = exercise.exerciseName.trim();
  if (isCardioCooldownStepName(name)) return false;
  if (!/^drag\b/i.test(name)) return false;

  const restSeconds = Number(String(exercise.restSeconds ?? "").trim() || "0");
  const hasNoRestAfter = !Number.isFinite(restSeconds) || restSeconds <= 0;
  if (!hasNoRestAfter) return false;

  const previousName = previousExercise?.exerciseName.trim() ?? "";
  const prevIsDrag = /^drag\b/i.test(previousName);
  const prevIsWarmup = /^oppvarming$/i.test(previousName);

  // Vanligste feil: siste rad «Drag 4/5» etter minst ett tidligere drag, uten hvile etterpå.
  if (prevIsDrag) return true;

  const speed = Number(String(exercise.speed ?? "").replace(",", "."));
  const previousSpeed = Number(String(previousExercise?.speed ?? "").replace(",", "."));
  const targetHr = String(exercise.targetHrPercent ?? "").trim();
  const looksLikeEasyCooldown =
    (Number.isFinite(speed) && Number.isFinite(previousSpeed) && speed < previousSpeed) ||
    (Number.isFinite(speed) && speed > 0 && speed <= 7.5) ||
    /55|60|65|rolig|lav/i.test(targetHr);

  return prevIsWarmup && looksLikeEasyCooldown;
}

export function normalizeProgramsLegacyCooldownNames(programs: TrainingProgram[]): TrainingProgram[] {
  let changed = false;
  const normalized = programs.map((program) => {
    const exercises = normalizeLegacyIntervalCooldownExerciseNames(program.exercises);
    if (exercises === program.exercises) return program;
    changed = true;
    return { ...program, exercises };
  });
  return changed ? normalized : programs;
}

export function normalizeLegacyIntervalCooldownExerciseNames(exercises: ProgramExercise[]): ProgramExercise[] {
  let changed = false;
  const normalized = exercises.map((exercise, index) => {
    if (!isLegacyIntervalCooldownDrag(exercises, index) || exercise.exerciseName.trim() === CARDIO_COOLDOWN_STEP_NAME)
      return exercise;
    changed = true;
    return { ...exercise, exerciseName: CARDIO_COOLDOWN_STEP_NAME };
  });
  return changed ? normalized : exercises;
}

export function workoutResultGroupId(result: WorkoutExerciseResult): string {
  if (result.blockId?.trim()) return result.blockId.trim();
  return result.programExerciseId ?? result.exerciseId;
}

export function isBlockExercise(exercise: ProgramExercise): boolean {
  return Boolean(exercise.blockId?.trim() && exercise.blockType);
}

export function blockLabel(blockType: ExerciseBlockType, exerciseCount: number): string {
  if (blockType === "circuit") return exerciseCount > 1 ? `Sirkel · ${exerciseCount} øvelser` : EXERCISE_BLOCK_LABELS.circuit;
  return EXERCISE_BLOCK_LABELS[blockType];
}

export function formatBlockExerciseTitle(blockType: ExerciseBlockType | undefined, names: string[]): string {
  if (!blockType || names.length === 0) return names[0] ?? "";
  return `${blockLabel(blockType, names.length)}: ${names.join(" · ")}`;
}

function resolveCircuitRounds(exercises: ProgramExercise[]): number {
  const explicitRaw = exercises.map((ex) => String(ex.blockRounds ?? "").trim()).find(Boolean);
  if (explicitRaw) {
    const parsed = parseProgramSetCount(explicitRaw);
    if (parsed > 0) return parsed;
  }
  return Math.max(1, ...exercises.map((ex) => parseProgramSetCount(ex.sets)));
}

function buildWorkoutRow(
  ex: ProgramExercise,
  meta: Exercise | undefined,
  setNumber: number,
  options: { suggestedWeightByProgramExerciseId?: Record<string, string> },
  blockMeta?: { blockId: string; blockType: ExerciseBlockType; blockRound: number },
): WorkoutExerciseResult {
  const isStretch = meta ? isHoldBasedExerciseCategory(meta.category) : false;
  const suggestedWeightRaw = options.suggestedWeightByProgramExerciseId?.[ex.id];
  const suggestedWeight = suggestedWeightRaw !== undefined ? suggestedWeightRaw.trim() : "";
  const holdPlan = programExerciseHoldSeconds(ex, meta?.category);
  const initialWeight = isStretch ? suggestedWeight || holdPlan || "30" : suggestedWeight || ex.weight;
  const plannedRepsForRow = isStretch ? (ex.reps.trim() || "1") : ex.reps;

  return {
    exerciseId: `${ex.id}-set-${setNumber}`,
    programExerciseId: ex.id,
    setNumber,
    exerciseName: ex.exerciseName,
    exerciseCategory: meta?.category,
    exerciseEquipment: meta?.equipment,
    plannedSets: ex.sets,
    plannedRepsUnit: ex.repsUnit ?? "reps",
    plannedReps: plannedRepsForRow,
    plannedWeightUnit: isStretch ? "seconds" : (ex.weightUnit ?? "kg"),
    plannedWeight: initialWeight,
    plannedDurationMinutes: ex.durationMinutes ?? "",
    plannedSpeed: ex.speed ?? "",
    plannedIncline: ex.incline ?? "",
    performedWeight: initialWeight,
    performedLoadUnit: isStretch ? "sec" : (ex.weightUnit === "seconds" ? "sec" : "kg"),
    performedReps: plannedRepsForRow,
    performedDurationMinutes: ex.durationMinutes ?? "",
    performedSpeed: ex.speed ?? "",
    performedIncline: ex.incline ?? "",
    completed: false,
    ...(blockMeta
      ? {
          blockId: blockMeta.blockId,
          blockType: blockMeta.blockType,
          blockRound: blockMeta.blockRound,
        }
      : {}),
  };
}

function expandSingleProgramExercise(
  ex: ProgramExercise,
  exerciseBank: Exercise[],
  options: { suggestedWeightByProgramExerciseId?: Record<string, string> },
): WorkoutExerciseResult[] {
  const meta = exerciseBank.find((item) => item.id === ex.exerciseId);
  const setCount = parseProgramSetCount(ex.sets);
  return Array.from({ length: setCount }, (_, index) =>
    buildWorkoutRow(ex, meta, index + 1, options),
  );
}

function expandBlockProgramExercises(
  blockExercises: ProgramExercise[],
  exerciseBank: Exercise[],
  options: { suggestedWeightByProgramExerciseId?: Record<string, string> },
): WorkoutExerciseResult[] {
  const blockId = blockExercises[0]?.blockId?.trim();
  const blockType = blockExercises[0]?.blockType;
  if (!blockId || !blockType) {
    return blockExercises.flatMap((ex) => expandSingleProgramExercise(ex, exerciseBank, options));
  }

  const rounds =
    blockType === "circuit"
      ? resolveCircuitRounds(blockExercises)
      : Math.max(1, ...blockExercises.map((ex) => parseProgramSetCount(ex.sets)));

  const results: WorkoutExerciseResult[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    blockExercises.forEach((ex) => {
      if (round > parseProgramSetCount(ex.sets)) return;
      const meta = exerciseBank.find((item) => item.id === ex.exerciseId);
      results.push(
        buildWorkoutRow(ex, meta, round, options, {
          blockId,
          blockType,
          blockRound: round,
        }),
      );
    });
  }
  return results;
}

/** Del programøvelser i sammenhengende blokker + enkeltøvelser. */
export function splitProgramExercisesIntoSegments(programExercises: ProgramExercise[]): ProgramExercise[][] {
  const segments: ProgramExercise[][] = [];
  let current: ProgramExercise[] = [];

  programExercises.forEach((exercise) => {
    const blockId = exercise.blockId?.trim();
    if (!blockId || !exercise.blockType) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      segments.push([exercise]);
      return;
    }

    const prev = current[0];
    if (current.length && prev?.blockId?.trim() === blockId) {
      current.push(exercise);
      return;
    }

    if (current.length) segments.push(current);
    current = [exercise];
  });

  if (current.length) segments.push(current);
  return segments;
}

export function expandProgramExercisesToWorkoutResults(
  programExercises: ProgramExercise[],
  exerciseBank: Exercise[],
  options?: { suggestedWeightByProgramExerciseId?: Record<string, string> },
): WorkoutExerciseResult[] {
  const opts = options ?? {};
  const normalizedProgramExercises = normalizeLegacyIntervalCooldownExerciseNames(programExercises);
  return splitProgramExercisesIntoSegments(normalizedProgramExercises).flatMap((segment) => {
    if (segment.length === 1 && !isBlockExercise(segment[0])) {
      return expandSingleProgramExercise(segment[0], exerciseBank, opts);
    }
    if (segment[0]?.blockId && segment[0]?.blockType) {
      return expandBlockProgramExercises(segment, exerciseBank, opts);
    }
    return segment.flatMap((ex) => expandSingleProgramExercise(ex, exerciseBank, opts));
  });
}

export function buildWorkoutResultGroups(
  results: WorkoutExerciseResult[],
  program?: TrainingProgram | null,
): WorkoutResultGroup[] {
  const programOrder = new Map<string, number>();
  program?.exercises.forEach((exercise, index) => {
    programOrder.set(exercise.id, index);
  });

  const grouped = new Map<string, WorkoutExerciseResult[]>();
  results.forEach((result) => {
    const groupId = workoutResultGroupId(result);
    const bucket = grouped.get(groupId);
    if (bucket) {
      bucket.push(result);
      return;
    }
    grouped.set(groupId, [result]);
  });

  const firstSeenOrder: string[] = [];
  const seen = new Set<string>();
  results.forEach((result) => {
    const groupId = workoutResultGroupId(result);
    if (seen.has(groupId)) return;
    seen.add(groupId);
    firstSeenOrder.push(groupId);
  });

  return firstSeenOrder.map((groupId) => {
    const rows = [...(grouped.get(groupId) ?? [])].sort((a, b) => {
      const roundDiff = (a.blockRound ?? a.setNumber ?? 0) - (b.blockRound ?? b.setNumber ?? 0);
      if (roundDiff !== 0) return roundDiff;
      const orderA = programOrder.get(a.programExerciseId ?? "") ?? 999;
      const orderB = programOrder.get(b.programExerciseId ?? "") ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.setNumber ?? 0) - (b.setNumber ?? 0);
    });

    const blockType = rows[0]?.blockType;
    const blockId = rows[0]?.blockId;
    const segmentMap = new Map<string, WorkoutExerciseResult[]>();
    rows.forEach((row) => {
      const pid = row.programExerciseId ?? row.exerciseId;
      const existing = segmentMap.get(pid);
      if (existing) {
        existing.push(row);
        return;
      }
      segmentMap.set(pid, [row]);
    });

    const segmentIds = [...segmentMap.keys()].sort((a, b) => (programOrder.get(a) ?? 999) - (programOrder.get(b) ?? 999));
    const segments = segmentIds.map((programExerciseId) => ({
      programExerciseId,
      exerciseName: segmentMap.get(programExerciseId)?.[0]?.exerciseName ?? "",
      rows: (segmentMap.get(programExerciseId) ?? []).sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    }));

    const exerciseNames = segments.map((segment) => segment.exerciseName).filter(Boolean);
    const maxRound = Math.max(0, ...rows.map((row) => row.blockRound ?? row.setNumber ?? 0));
    const rounds = Array.from({ length: maxRound || 0 }, (_, index) => {
      const round = index + 1;
      return {
        round,
        segments: segments.map((segment) => ({
          programExerciseId: segment.programExerciseId,
          exerciseName: segment.exerciseName,
          row: segment.rows.find((row) => (row.blockRound ?? row.setNumber) === round) ?? null,
        })),
      };
    });

    const blockRounds =
      blockType === "circuit" && blockId
        ? resolveCircuitRounds(
            program?.exercises.filter((exercise) => exercise.blockId?.trim() === blockId) ??
              segments.map((segment) => ({
                id: segment.programExerciseId,
                exerciseId: "",
                exerciseName: segment.exerciseName,
                sets: String(maxRound),
                reps: "",
                weight: "",
                restSeconds: "",
                notes: "",
                blockId,
                blockType,
              })),
          )
        : maxRound;

    return {
      groupId,
      blockType,
      blockRounds: blockType ? blockRounds : undefined,
      exerciseName: blockType ? formatBlockExerciseTitle(blockType, exerciseNames) : exerciseNames[0] ?? "",
      exerciseNames,
      plannedReps: rows[0]?.plannedReps ?? "",
      plannedWeight: rows[0]?.plannedWeight ?? "",
      rows,
      segments,
      rounds: blockType ? rounds : [],
    };
  });
}

export function linkProgramExercisesAsBlock(
  exercises: ProgramExercise[],
  startIndex: number,
  count: number,
  blockType: ExerciseBlockType,
  blockRounds?: string,
): ProgramExercise[] {
  if (startIndex < 0 || count < 2 || startIndex + count > exercises.length) return exercises;
  const blockId = `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return exercises.map((exercise, index) => {
    if (index < startIndex || index >= startIndex + count) return exercise;
    return {
      ...exercise,
      blockId,
      blockType,
      blockRounds: blockType === "circuit" ? blockRounds ?? exercise.blockRounds ?? exercise.sets : undefined,
    };
  });
}

export function unlinkProgramExerciseBlock(exercises: ProgramExercise[], blockId: string): ProgramExercise[] {
  const trimmed = blockId.trim();
  if (!trimmed) return exercises;
  return exercises.map((exercise) =>
    exercise.blockId?.trim() === trimmed
      ? { ...exercise, blockId: undefined, blockType: undefined, blockRounds: undefined }
      : exercise,
  );
}

export function isFirstExerciseInBlock(exercises: ProgramExercise[], index: number): boolean {
  const exercise = exercises[index];
  if (!exercise?.blockId || !exercise.blockType) return false;
  const prev = exercises[index - 1];
  return !prev || prev.blockId?.trim() !== exercise.blockId.trim();
}

export function countExercisesInBlock(exercises: ProgramExercise[], blockId: string): number {
  const trimmed = blockId.trim();
  return exercises.filter((exercise) => exercise.blockId?.trim() === trimmed).length;
}
