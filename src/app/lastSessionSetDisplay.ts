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

export function formatLatestLastSessionSetLabel(
  exerciseName: string,
  setMap: Map<number, LastSessionSetEntry> | null | undefined,
  exerciseLibrary: Exercise[],
): string {
  if (!setMap) return "";
  const picked = pickLastSetFromLastSession(setMap);
  if (!picked) return "";
  return formatLastSessionSetLabel(exerciseName, picked.entry, exerciseLibrary, picked.setNumber);
}
