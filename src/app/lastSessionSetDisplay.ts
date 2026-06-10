import { parseStoredLogDate } from "./dateFormat";
import { formatWorkoutResultPerformedLabel } from "./programExercisePresentation";
import type { Exercise, WorkoutExerciseResult, WorkoutLog } from "./types";

export type LastSessionSetEntry = {
  weight?: string;
  reps?: string;
  durationMinutes?: string;
  speed?: string;
  incline?: string;
};

export function normalizeExerciseNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function workoutResultToLastSessionEntry(
  row: Pick<
    WorkoutExerciseResult,
    "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline"
  >,
): LastSessionSetEntry {
  return {
    weight: row.performedWeight,
    reps: row.performedReps,
    durationMinutes: row.performedDurationMinutes,
    speed: row.performedSpeed,
    incline: row.performedIncline,
  };
}

/** Best historical sett strictly før `beforeSetNumber`, ellers eksakt sett, ellers høyeste sett. */
export function pickPreviousSetEntry(
  setMap: Map<number, LastSessionSetEntry>,
  beforeSetNumber: number,
): LastSessionSetEntry | null {
  let best: { setNumber: number; entry: LastSessionSetEntry } | null = null;
  for (const [setNumber, entry] of setMap) {
    if (setNumber < beforeSetNumber && (!best || setNumber > best.setNumber)) {
      best = { setNumber, entry };
    }
  }
  if (best) return best.entry;
  const exact = setMap.get(beforeSetNumber);
  if (exact) return exact;
  return pickLastSetFromLastSession(setMap)?.entry ?? null;
}

type LastSessionLookupRow = Pick<
  WorkoutExerciseResult,
  | "exerciseName"
  | "setNumber"
  | "blockRound"
  | "completed"
  | "performedWeight"
  | "performedReps"
  | "performedDurationMinutes"
  | "performedSpeed"
  | "performedIncline"
>;

/** Siste relevante verdier for et sett: først fullførte sett i pågående økt, deretter forrige logger. */
export function resolveLastSessionEntryForRow(
  row: LastSessionLookupRow,
  sessionRows: LastSessionLookupRow[],
  lastSessionByExercise?: LastSessionByExerciseMap,
): LastSessionSetEntry | null {
  const key = normalizeExerciseNameKey(row.exerciseName);
  const setNumber = row.setNumber ?? row.blockRound ?? 1;

  let fromSessionSetNumber = 0;
  let fromSession: LastSessionSetEntry | null = null;
  for (const sessionRow of sessionRows) {
    if (!sessionRow.completed) continue;
    if (normalizeExerciseNameKey(sessionRow.exerciseName) !== key) continue;
    const sessionSetNumber = sessionRow.setNumber ?? sessionRow.blockRound ?? 1;
    if (sessionSetNumber >= setNumber) continue;
    if (sessionSetNumber > fromSessionSetNumber) {
      fromSessionSetNumber = sessionSetNumber;
      fromSession = workoutResultToLastSessionEntry(sessionRow);
    }
  }
  if (fromSession) return fromSession;

  const setMap = lastSessionByExercise?.get(key);
  if (!setMap?.size) return null;
  return pickPreviousSetEntry(setMap, setNumber);
}

export function buildLastSessionByExerciseFromLogs(logs: WorkoutLog[]): LastSessionByExerciseMap {
  const result: LastSessionByExerciseMap = new Map();
  const capturedFromExercises = new Set<string>();
  const sortedLogs = logs
    .filter((log) => log.status === "Fullført")
    .slice()
    .sort((a, b) => {
      const aTime = parseStoredLogDate(a.date)?.getTime() ?? 0;
      const bTime = parseStoredLogDate(b.date)?.getTime() ?? 0;
      return bTime - aTime;
    });

  sortedLogs.forEach((log) => {
    const exercisesInThisLog = new Set<string>();
    (log.results ?? []).forEach((row) => {
      if (!row.completed) return;
      const key = normalizeExerciseNameKey(row.exerciseName);
      if (capturedFromExercises.has(key)) return;
      exercisesInThisLog.add(key);
      const setMap = result.get(key) ?? new Map<number, LastSessionSetEntry>();
      const setNum = row.setNumber ?? row.blockRound ?? 1;
      setMap.set(setNum, workoutResultToLastSessionEntry(row));
      result.set(key, setMap);
    });
    exercisesInThisLog.forEach((key) => capturedFromExercises.add(key));
  });

  return result;
}

export function mergeWorkoutResultsIntoLastSession(
  base: LastSessionByExerciseMap | undefined,
  results: WorkoutExerciseResult[],
): LastSessionByExerciseMap {
  const merged: LastSessionByExerciseMap = new Map(
    base ? [...base.entries()].map(([key, setMap]) => [key, new Map(setMap)]) : [],
  );

  results.forEach((row) => {
    if (!row.completed) return;
    const key = normalizeExerciseNameKey(row.exerciseName);
    const setMap = merged.get(key) ?? new Map<number, LastSessionSetEntry>();
    const setNum = row.setNumber ?? row.blockRound ?? 1;
    setMap.set(setNum, workoutResultToLastSessionEntry(row));
    merged.set(key, setMap);
  });

  return merged;
}

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
