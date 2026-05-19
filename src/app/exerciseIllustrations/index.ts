import type { Exercise } from "../types";
import { exerciseCategoryAccentColor } from "../exerciseCategories";
import { medicalSketchSvg, toSketchDataUri } from "./medicalSketchStyle";

/** Liten placeholder-skisse (96×96) når øvelsen ikke har eget bilde. */
export function getMedicalSketchFallbackDataUri(exercise: Pick<Exercise, "category" | "group" | "name">): string {
  const accent = exerciseCategoryAccentColor(exercise.category);
  const svg = medicalSketchSvg(`
    <circle cx="48" cy="20" r="8" fill="${accent}"/>
    <path d="M48 30 L48 50 M48 38 L30 45 M48 38 L66 45 M48 50 L35 72 M48 50 L61 72" stroke="#0f172a" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M12 84 H84" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
  `);
  return toSketchDataUri(svg);
}

/** Løser bilde-URL: egendefinert bilde, ellers liten placeholder-skisse. */
export function resolveExerciseImageSrc(exercise: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name">): string {
  const custom = exercise.imageUrl?.trim();
  if (custom) return custom;
  return getMedicalSketchFallbackDataUri(exercise);
}
