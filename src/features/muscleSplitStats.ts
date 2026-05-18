import type { Exercise, WorkoutLog } from "../app/types";

export type MuscleSplitPeriod = 28 | 90 | "all";
export type MuscleSplitMetric = "sets" | "volume";

export type MuscleGroupStat = {
  group: string;
  sets: number;
  volumeKg: number;
};

function parseLogDate(value: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const hours = Number(match[4] ?? "0");
    const minutes = Number(match[5] ?? "0");
    const parsed = new Date(year, month, day, hours, minutes);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseNum(raw: string | undefined): number {
  const n = Number(String(raw ?? "").replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Lår-detaljer vises som «Bein» i muskelsplitt (unngår Bein + forside + bakside samtidig). */
const LEG_SPLIT_SUBGROUPS = new Set(["forside lår", "bakside lår", "innside lår"]);

export function normalizeMuscleSplitGroup(group: string): string {
  const trimmed = group.trim();
  if (!trimmed) return "Ukjent";
  if (LEG_SPLIT_SUBGROUPS.has(trimmed.toLowerCase())) return "Bein";
  return trimmed;
}

/** Deler sammensatte muskelgrupper (f.eks. «Bryst/Triceps») for fordeling av sett og volum. */
export function splitMuscleGroupLabel(group: string): string[] {
  const trimmed = group.trim();
  if (!trimmed) return ["Ukjent"];
  const parts = trimmed
    .split(/\s*[/,]\s*|\s+og\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Ukjent"];
}

export function buildExerciseGroupByName(exercises: Exercise[]): Map<string, string> {
  return new Map(
    exercises.map((exercise) => [
      exercise.name.trim().toLowerCase(),
      exercise.group.trim() || "Ukjent",
    ]),
  );
}

export function computeMuscleGroupStats(
  completedLogs: WorkoutLog[],
  exerciseGroupByName: Map<string, string>,
  options: { periodDays: MuscleSplitPeriod; nowTimestamp: number },
): MuscleGroupStat[] {
  const agg = new Map<string, { sets: number; volumeKg: number }>();
  const cutoffMs =
    options.periodDays === "all"
      ? 0
      : options.nowTimestamp - options.periodDays * 24 * 60 * 60 * 1000;

  for (const log of completedLogs) {
    const loggedAt = parseLogDate(log.date);
    if (!loggedAt) continue;
    if (cutoffMs > 0 && loggedAt.getTime() < cutoffMs) continue;

    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      if (result.exerciseCategory === "Uttøyning") continue;

      const groupRaw = exerciseGroupByName.get(result.exerciseName.trim().toLowerCase()) ?? "Ukjent";
      const parts = splitMuscleGroupLabel(groupRaw);
      const share = 1 / parts.length;

      const durationMin = parseNum(result.performedDurationMinutes);
      const weight = parseNum(result.performedWeight);
      const reps = parseNum(result.performedReps);
      const volumeKg = weight > 0 && reps > 0 ? weight * reps : 0;

      if (volumeKg <= 0 && durationMin <= 0 && result.exerciseCategory !== "Kondisjon") {
        const hasStrengthPlan = parseNum(result.plannedReps) > 0 || parseNum(result.plannedWeight) > 0;
        if (!hasStrengthPlan) continue;
      }

      for (const part of parts) {
        const bucket = normalizeMuscleSplitGroup(part);
        const current = agg.get(bucket) ?? { sets: 0, volumeKg: 0 };
        current.sets += share;
        current.volumeKg += volumeKg * share;
        agg.set(bucket, current);
      }
    }
  }

  return Array.from(agg.entries())
    .map(([group, value]) => ({
      group,
      sets: Math.round(value.sets * 10) / 10,
      volumeKg: Math.round(value.volumeKg),
    }))
    .filter((row) => row.sets > 0 || row.volumeKg > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets);
}

export function muscleSplitMetricValue(stat: MuscleGroupStat, metric: MuscleSplitMetric): number {
  return metric === "sets" ? stat.sets : stat.volumeKg;
}

export function formatMuscleSplitMetricValue(value: number, metric: MuscleSplitMetric): string {
  if (metric === "sets") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString("nb-NO", { maximumFractionDigits: 1 });
  }
  return `${Math.round(value).toLocaleString("nb-NO")} kg`;
}
