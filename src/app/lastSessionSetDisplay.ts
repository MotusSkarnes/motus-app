import { formatWorkoutResultPerformedLabel } from "./programExercisePresentation";
import type { Exercise, WorkoutExerciseResult } from "./types";

export type LastSessionSetEntry = {
  weight?: string;
  reps?: string;
  durationMinutes?: string;
  speed?: string;
  incline?: string;
};

export function pickLastSetFromLastSession(
  setMap: Map<number, LastSessionSetEntry>,
): { setNumber: number; entry: LastSessionSetEntry } | null {
  if (!setMap.size) return null;
  let maxSetNum = 0;
  let entry: LastSessionSetEntry | null = null;
  for (const [setNum, value] of setMap) {
    if (setNum >= maxSetNum) {
      maxSetNum = setNum;
      entry = value;
    }
  }
  return entry ? { setNumber: maxSetNum, entry } : null;
}

export type LastSessionByExerciseMap = Map<string, Map<number, LastSessionSetEntry>>;

export type DetailLastSessionBlockInfo = {
  exercise?: Exercise | null;
  exerciseName: string;
};

/** «Sist sett»-tekst i øvelsesdetalj under live økt. */
export function resolveDetailLastSessionLabel(input: {
  lastSessionByExercise?: LastSessionByExerciseMap;
  detailExercise: Exercise | null;
  blockDetailExercise: Exercise | null;
  currentWorkoutExerciseName?: string;
  currentWorkoutBlockType?: string;
  blockExerciseInfos: DetailLastSessionBlockInfo[];
  exercises: Exercise[];
}): string {
  const {
    lastSessionByExercise,
    detailExercise,
    blockDetailExercise,
    currentWorkoutExerciseName,
    currentWorkoutBlockType,
    blockExerciseInfos,
    exercises,
  } = input;
  if (!lastSessionByExercise) return "";
  let lookupName = detailExercise?.name ?? "";
  if (blockDetailExercise && currentWorkoutBlockType) {
    const match = blockExerciseInfos.find(
      (info) =>
        info.exercise?.id === blockDetailExercise.id ||
        info.exerciseName.trim().toLowerCase() === blockDetailExercise.name.trim().toLowerCase(),
    );
    if (match?.exerciseName.trim()) lookupName = match.exerciseName;
  } else if (currentWorkoutExerciseName?.trim()) {
    lookupName = currentWorkoutExerciseName;
  }
  if (!lookupName.trim()) return "";
  const setMap = lastSessionByExercise.get(lookupName.trim().toLowerCase());
  if (!setMap?.size) return "";
  const picked = pickLastSetFromLastSession(setMap);
  if (!picked) return "";
  return formatLastSessionSetLabel(lookupName, picked.entry, exercises, picked.setNumber);
}

export function formatLastSessionSetLabel(
  exerciseName: string,
  entry: LastSessionSetEntry,
  exerciseLibrary: Exercise[],
  setNumber?: number,
): string {
  const linked = exerciseLibrary.find(
    (item) => item.name.trim().toLowerCase() === exerciseName.trim().toLowerCase(),
  );
  const pseudo: WorkoutExerciseResult = {
    exerciseId: linked?.id ?? "",
    exerciseName,
    exerciseCategory: linked?.category,
    exerciseEquipment: linked?.equipment,
    setNumber: setNumber ?? 1,
    plannedSets: "",
    plannedReps: "",
    plannedWeight: "",
    performedWeight: entry.weight ?? "",
    performedReps: entry.reps ?? "",
    performedDurationMinutes: entry.durationMinutes ?? "",
    performedSpeed: entry.speed ?? "",
    performedIncline: entry.incline ?? "",
    completed: true,
  };
  const performed = formatWorkoutResultPerformedLabel(pseudo, exerciseLibrary);
  if (!performed || performed.includes("—")) return "";
  if (setNumber && setNumber > 0) return `Sett ${setNumber} · ${performed}`;
  return performed;
}
