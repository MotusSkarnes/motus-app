import { isHoldBasedExerciseCategory } from "./exerciseCategories";
import type { WorkoutLog } from "./types";
import { parseLogDateMs } from "./workoutLogDate";

export type StrengthHistoryPoint = {
  dateMs: number;
  dateLabel: string;
  estimated1RmKg: number;
  bestSetLabel: string;
};

export function estimate1RmKg(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function formatDateLabel(dateMs: number): string {
  return new Date(dateMs).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "2-digit" });
}

export function buildExerciseStrengthHistory(logs: WorkoutLog[], exerciseName: string): StrengthHistoryPoint[] {
  const normalizedName = exerciseName.trim().toLowerCase();
  if (!normalizedName) return [];

  const bestByDay = new Map<number, { estimated1RmKg: number; bestSetLabel: string }>();

  logs.forEach((log) => {
    if (log.status !== "Fullført") return;
    const dateMs = parseLogDateMs(log.date);
    if (!dateMs) return;

    (log.results ?? []).forEach((result) => {
      if (!result.completed) return;
      if (result.exerciseName.trim().toLowerCase() !== normalizedName) return;
      if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) return;

      const weight = Number(result.performedWeight) || 0;
      const reps = Number(result.performedReps) || 0;
      const estimated1RmKg = estimate1RmKg(weight, reps);
      if (estimated1RmKg <= 0) return;

      const bestSetLabel = `${weight} kg × ${reps}`;
      const existing = bestByDay.get(dateMs);
      if (!existing || estimated1RmKg > existing.estimated1RmKg) {
        bestByDay.set(dateMs, { estimated1RmKg, bestSetLabel });
      }
    });
  });

  return Array.from(bestByDay.entries())
    .map(([dateMs, value]) => ({
      dateMs,
      dateLabel: formatDateLabel(dateMs),
      estimated1RmKg: value.estimated1RmKg,
      bestSetLabel: value.bestSetLabel,
    }))
    .sort((a, b) => a.dateMs - b.dateMs);
}

export type StrengthChartGeometry = {
  linePath: string;
  areaPath: string;
  dots: Array<{ x: number; y: number; point: StrengthHistoryPoint }>;
  yTicks: Array<{ y: number; label: string }>;
  xLabels: Array<{ x: number; label: string }>;
};

export function buildStrengthChartGeometry(
  points: StrengthHistoryPoint[],
  width: number,
  height: number,
): StrengthChartGeometry | null {
  if (points.length === 0) return null;

  const padLeft = 40;
  const padRight = 12;
  const padTop = 14;
  const padBottom = 28;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);

  const yValues = points.map((p) => p.estimated1RmKg);
  let yMin = Math.min(...yValues);
  let yMax = Math.max(...yValues);
  if (yMin === yMax) {
    yMin = Math.max(0, yMin - 5);
    yMax = yMax + 5;
  } else {
    const padding = (yMax - yMin) * 0.12;
    yMin = Math.max(0, yMin - padding);
    yMax = yMax + padding;
  }

  const xMin = points[0].dateMs;
  const xMax = points[points.length - 1].dateMs || xMin + 1;
  const xSpan = Math.max(1, xMax - xMin);

  const toX = (dateMs: number) => padLeft + ((dateMs - xMin) / xSpan) * innerW;
  const toY = (value: number) => padTop + innerH - ((value - yMin) / (yMax - yMin)) * innerH;

  const dots = points.map((point) => ({
    x: toX(point.dateMs),
    y: toY(point.estimated1RmKg),
    point,
  }));

  const linePath = dots.map((dot, index) => `${index === 0 ? "M" : "L"} ${dot.x.toFixed(1)} ${dot.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${dots[dots.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${dots[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((value) => ({
    y: toY(value),
    label: `${Math.round(value)} kg`,
  }));

  const labelIndexes =
    points.length <= 3
      ? points.map((_, index) => index)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const xLabels = Array.from(new Set(labelIndexes)).map((index) => ({
    x: toX(points[index].dateMs),
    label: points[index].dateLabel,
  }));

  return { linePath, areaPath, dots, yTicks, xLabels };
}
