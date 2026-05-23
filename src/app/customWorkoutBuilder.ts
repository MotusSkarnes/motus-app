import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import { buildExerciseGroupByName, computeMuscleGroupStats, splitMuscleGroupLabel } from "../features/muscleSplitStats";
import type { Exercise, ProgramExercise, WorkoutLog } from "./types";

export type CustomWorkoutLine = {
  key: string;
  exerciseId: string;
  sets: string;
  reps: string;
  weight: string;
  holdSeconds?: string;
};

export type CustomWorkoutInsight = {
  id: string;
  message: string;
  tone: "info" | "suggest";
  /** Foreslått muskelgruppe å fylle på med */
  targetMuscleGroup?: string;
};

export type CustomWorkoutPreview = {
  exerciseCount: number;
  totalSets: number;
  muscleGroups: string[];
};

const PULL_HINTS = ["rygg", "biceps", "trekk", "lat", "roing", "ro"];
const PUSH_HINTS = ["bryst", "triceps", "skulder", "press", "støt", "skrå"];
const LEG_HINTS = ["bein", "lår", "hofte", "leg", "squat", "calf", "legg"];

export const MUSCLE_GROUP_CHIP_CLASS: Record<string, string> = {
  Bryst: "border-rose-200 bg-rose-50 text-rose-900",
  Rygg: "border-sky-200 bg-sky-50 text-sky-900",
  Skuldre: "border-indigo-200 bg-indigo-50 text-indigo-900",
  Bein: "border-emerald-200 bg-emerald-50 text-emerald-900",
  Armer: "border-violet-200 bg-violet-50 text-violet-900",
  Kjerne: "border-amber-200 bg-amber-50 text-amber-900",
  Kondisjon: "border-orange-200 bg-orange-50 text-orange-900",
};

export function muscleGroupChipClass(group: string): string {
  return MUSCLE_GROUP_CHIP_CLASS[group] ?? "border-slate-200 bg-slate-50 text-slate-800";
}

function groupText(exercise: Exercise): string {
  return exercise.group.trim().toLowerCase();
}

export function isPullExercise(exercise: Exercise): boolean {
  const text = groupText(exercise);
  return PULL_HINTS.some((hint) => text.includes(hint));
}

export function isPushExercise(exercise: Exercise): boolean {
  const text = groupText(exercise);
  return PUSH_HINTS.some((hint) => text.includes(hint));
}

export function isLegExercise(exercise: Exercise): boolean {
  const text = groupText(exercise);
  return LEG_HINTS.some((hint) => text.includes(hint));
}

export function collectDraftMuscleGroups(draftExercises: Exercise[]): string[] {
  const groups = new Set<string>();
  for (const exercise of draftExercises) {
    for (const part of splitMuscleGroupLabel(exercise.group)) {
      groups.add(part);
    }
  }
  return Array.from(groups).sort((a, b) => a.localeCompare(b, "nb"));
}

export function buildCustomWorkoutPreview(lines: CustomWorkoutLine[], exercises: Exercise[]): CustomWorkoutPreview {
  const draftExercises = lines
    .map((line) => exercises.find((exercise) => exercise.id === line.exerciseId))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const totalSets = lines.reduce((sum, line) => {
    const parsed = Number(line.sets.replace(",", "."));
    return sum + (Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
  }, 0);
  return {
    exerciseCount: draftExercises.length,
    totalSets,
    muscleGroups: collectDraftMuscleGroups(draftExercises),
  };
}

function countExerciseUsageInLogs(logs: WorkoutLog[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      const key = result.exerciseName.trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildCustomWorkoutInsights(input: {
  draftExercises: Exercise[];
  completedLogs: WorkoutLog[];
  allExercises: Exercise[];
  nowDate: Date;
}): CustomWorkoutInsight[] {
  const insights: CustomWorkoutInsight[] = [];
  const { draftExercises, completedLogs, allExercises, nowDate } = input;

  if (draftExercises.length > 0) {
    if (!draftExercises.some(isPullExercise)) {
      insights.push({
        id: "missing-pull",
        message: "Du mangler en trekkøvelse",
        tone: "suggest",
        targetMuscleGroup: "Rygg",
      });
    }
    if (!draftExercises.some(isPushExercise)) {
      insights.push({
        id: "missing-push",
        message: "Du mangler en støt-/pressøvelse",
        tone: "suggest",
        targetMuscleGroup: "Bryst",
      });
    }
    if (!draftExercises.some(isLegExercise)) {
      insights.push({
        id: "missing-legs",
        message: "Legg gjerne til en beinøvelse",
        tone: "suggest",
        targetMuscleGroup: "Bein",
      });
    }
  }

  const exerciseGroupByName = buildExerciseGroupByName(allExercises);
  const weekStats = computeMuscleGroupStats(completedLogs, exerciseGroupByName, {
    periodDays: 28,
    nowTimestamp: nowDate.getTime(),
  }).filter((row) => row.sets > 0);

  const legSets = weekStats.find((row) => row.group === "Bein")?.sets ?? 0;
  const totalSets = weekStats.reduce((sum, row) => sum + row.sets, 0);
  if (totalSets >= 6 && legSets / totalSets < 0.18) {
    insights.push({
      id: "low-leg-volume",
      message: "Lite beinvolum denne uka",
      tone: "info",
      targetMuscleGroup: "Bein",
    });
  }

  const backSets = weekStats.find((row) => row.group === "Rygg")?.sets ?? 0;
  if (totalSets >= 6 && backSets / totalSets < 0.12) {
    insights.push({
      id: "low-back-volume",
      message: "Lite ryggvolum den siste tiden",
      tone: "info",
      targetMuscleGroup: "Rygg",
    });
  }

  return insights;
}

export function recommendExercisesForCustomWorkout(input: {
  allExercises: Exercise[];
  draftExerciseIds: Set<string>;
  completedLogs: WorkoutLog[];
  insights: CustomWorkoutInsight[];
  limit?: number;
}): Exercise[] {
  const { allExercises, draftExerciseIds, completedLogs, insights, limit = 6 } = input;
  const usage = countExerciseUsageInLogs(completedLogs);
  const draftIds = draftExerciseIds;

  const scoreExercise = (exercise: Exercise): number => {
    if (draftIds.has(exercise.id)) return -1;
    let score = usage.get(exercise.name.trim().toLowerCase()) ?? 0;
    const targetGroup = insights.find((insight) => insight.targetMuscleGroup)?.targetMuscleGroup;
    if (targetGroup && splitMuscleGroupLabel(exercise.group).some((part) => part === targetGroup)) {
      score += 12;
    }
    if (insights.some((insight) => insight.id === "missing-pull") && isPullExercise(exercise)) score += 8;
    if (insights.some((insight) => insight.id === "missing-push") && isPushExercise(exercise)) score += 8;
    if (insights.some((insight) => insight.id === "missing-legs") && isLegExercise(exercise)) score += 8;
    if (insights.some((insight) => insight.id === "low-leg-volume") && isLegExercise(exercise)) score += 6;
    if (insights.some((insight) => insight.id === "low-back-volume") && isPullExercise(exercise)) score += 6;
    return score;
  };

  return [...allExercises]
    .filter((exercise) => !draftIds.has(exercise.id))
    .sort((a, b) => scoreExercise(b) - scoreExercise(a) || a.name.localeCompare(b.name, "nb"))
    .slice(0, limit);
}

export function buildProgramExercisesFromCustomLines(lines: CustomWorkoutLine[], exercises: Exercise[], uid: (prefix: string) => string): ProgramExercise[] {
  const built: ProgramExercise[] = [];
  for (const line of lines) {
    const exercise = exercises.find((item) => item.id === line.exerciseId);
    if (!exercise) continue;
    const isStretch = isHoldBasedExerciseCategory(exercise.category);
    built.push({
      id: uid("prog-ex"),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: line.sets.trim() || (isStretch ? "2" : "3"),
      reps: line.reps.trim() || (isStretch ? "1" : "10"),
      weight: isStretch ? "" : line.weight.trim(),
      holdSeconds: isStretch ? (line.holdSeconds ?? "").trim() || "30" : "",
      restSeconds: "60",
      notes: "",
    });
  }
  return built;
}

export function reorderCustomWorkoutLines(lines: CustomWorkoutLine[], fromKey: string, toKey: string): CustomWorkoutLine[] {
  if (fromKey === toKey) return lines;
  const fromIndex = lines.findIndex((line) => line.key === fromKey);
  const toIndex = lines.findIndex((line) => line.key === toKey);
  if (fromIndex < 0 || toIndex < 0) return lines;
  const next = [...lines];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export const MEMBER_FAVORITE_EXERCISE_IDS_KEY = "motus.member.favoriteExerciseIds";

export function readMemberFavoriteExerciseIds(memberId: string): string[] {
  if (typeof window === "undefined" || !memberId.trim()) return [];
  try {
    const raw = window.localStorage.getItem(`${MEMBER_FAVORITE_EXERCISE_IDS_KEY}:${memberId.trim()}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeMemberFavoriteExerciseIds(memberId: string, ids: string[]): void {
  if (typeof window === "undefined" || !memberId.trim()) return;
  window.localStorage.setItem(`${MEMBER_FAVORITE_EXERCISE_IDS_KEY}:${memberId.trim()}`, JSON.stringify(ids));
}
