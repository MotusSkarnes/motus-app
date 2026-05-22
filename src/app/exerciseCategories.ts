import type { Exercise, ProgramExercise } from "./types";

export type TrainingSubTab = "strength" | "conditioning" | "mobility" | "rehab";

export type ProgramsSubTab = TrainingSubTab;
export type ExerciseBankSubTab = TrainingSubTab | "all";

export const TRAINING_SUB_TAB_OPTIONS: Array<{ id: TrainingSubTab; programsLabel: string; exerciseBankLabel: string }> = [
  { id: "strength", programsLabel: "Styrkeøkter", exerciseBankLabel: "Styrkeøvelser" },
  { id: "conditioning", programsLabel: "Kondisjon", exerciseBankLabel: "Kondisjon" },
  { id: "mobility", programsLabel: "Mobilitet", exerciseBankLabel: "Mobilitet" },
  { id: "rehab", programsLabel: "Rehab", exerciseBankLabel: "Rehab" },
];

export const EXERCISE_BANK_TAB_OPTIONS: Array<{ id: ExerciseBankSubTab; label: string }> = [
  { id: "all", label: "Alle" },
  ...TRAINING_SUB_TAB_OPTIONS.map((tab) => ({ id: tab.id, label: tab.exerciseBankLabel })),
];

export const EXERCISE_CATEGORY_OPTIONS: Exercise["category"][] = [
  "Styrke",
  "Kondisjon",
  "Mobilitet",
  "Rehab",
  "Uttøyning",
];

export function normalizeStoredExerciseCategory(category: string): Exercise["category"] {
  if (
    category === "Kondisjon" ||
    category === "Mobilitet" ||
    category === "Rehab" ||
    category === "Uttøyning"
  ) {
    return category;
  }
  return "Styrke";
}

export function categoryForSubTab(subTab: TrainingSubTab): Exercise["category"] {
  switch (subTab) {
    case "conditioning":
      return "Kondisjon";
    case "mobility":
      return "Mobilitet";
    case "rehab":
      return "Rehab";
    default:
      return "Styrke";
  }
}

export function subTabForExerciseCategory(category: Exercise["category"]): TrainingSubTab {
  if (category === "Kondisjon") return "conditioning";
  if (category === "Mobilitet" || category === "Uttøyning") return "mobility";
  if (category === "Rehab") return "rehab";
  return "strength";
}

export function exerciseMatchesSubTab(category: Exercise["category"], subTab: TrainingSubTab): boolean {
  return subTabForExerciseCategory(category) === subTab;
}

export function exerciseMatchesExerciseBankTab(category: Exercise["category"], subTab: ExerciseBankSubTab): boolean {
  if (subTab === "all") return true;
  return exerciseMatchesSubTab(category, subTab);
}

export function defaultCategoryForExerciseBankTab(subTab: ExerciseBankSubTab): Exercise["category"] {
  if (subTab === "all") return "Styrke";
  return categoryForSubTab(subTab);
}

/** Hold/sek-felt i programbygger (uttøyning, mobilitet, rehab). */
export function isHoldBasedExerciseCategory(category: Exercise["category"]): boolean {
  return category === "Uttøyning" || category === "Mobilitet" || category === "Rehab";
}

export function isMobilityExerciseCategory(category: Exercise["category"]): boolean {
  return category === "Mobilitet";
}

/** Hold/sek for programrad — mobilitet bruker aldri vekt-felt som fallback. */
export function programExerciseHoldSeconds(
  exercise: Pick<ProgramExercise, "holdSeconds" | "weight">,
  category?: Exercise["category"],
): string {
  const hold = String(exercise.holdSeconds ?? "").trim();
  if (hold) return hold;
  if (category && isMobilityExerciseCategory(category)) return "";
  if (category && isHoldBasedExerciseCategory(category)) return String(exercise.weight ?? "").trim();
  return "";
}

/** Programbygger: hold/sek-felt når øvelsen er mobilitet/rehab/uttøyning eller mal under Mobilitet. */
export function programDraftUsesHoldFields(
  category: Exercise["category"] | undefined,
  builderSubTab?: TrainingSubTab,
): boolean {
  if (category && isHoldBasedExerciseCategory(category)) return true;
  return builderSubTab === "mobility";
}

export function normalizeProgramExerciseForCategory(
  exercise: ProgramExercise,
  category: Exercise["category"] | undefined,
): ProgramExercise {
  if (!category || !isHoldBasedExerciseCategory(category)) return exercise;
  const holdSeconds = programExerciseHoldSeconds(exercise, category) || "30";
  return {
    ...exercise,
    reps: exercise.reps.trim() || "1",
    holdSeconds,
    weight: isMobilityExerciseCategory(category) ? "" : exercise.weight,
  };
}

export function countsTowardStrengthVolume(category?: Exercise["category"]): boolean {
  return category === "Styrke";
}

export function exerciseCategoryAccentColor(category: Exercise["category"]): string {
  if (category === "Kondisjon") return "#f97316";
  if (category === "Rehab") return "#8b5cf6";
  if (isHoldBasedExerciseCategory(category)) return "#0ea5e9";
  return "#14b8a6";
}

export function programsBuilderTitle(subTab: TrainingSubTab): string {
  switch (subTab) {
    case "conditioning":
      return "Lag kondisjonsmal";
    case "mobility":
      return "Lag mobilitetsmal";
    case "rehab":
      return "Lag rehab-mal";
    default:
      return "Lag styrkemal";
  }
}

export function programsBuilderDescription(subTab: TrainingSubTab): string {
  switch (subTab) {
    case "conditioning":
      return "Bygg intervall- og kondisjonsøkter med oppvarming, drag og nedjogg.";
    case "mobility":
      return "Bygg mobilitets- og tøyningsøkter med hold/sek på hvert steg.";
    case "rehab":
      return "Bygg rehab-øvelser med kontrollert belastning og hold/sek.";
    default:
      return "Bygg styrkeprogram med sett, reps og vekt — drag-and-drop fra biblioteket.";
  }
}

export function savedTemplatesTitle(subTab: TrainingSubTab): string {
  switch (subTab) {
    case "conditioning":
      return "Lagrede kondisjonsmaler";
    case "mobility":
      return "Lagrede mobilitetsmaler";
    case "rehab":
      return "Lagrede rehab-maler";
    default:
      return "Lagrede styrkemaler";
  }
}

export function emptyTemplatesMessage(subTab: TrainingSubTab): string {
  switch (subTab) {
    case "conditioning":
      return "Ingen kondisjonsmaler lagret ennå.";
    case "mobility":
      return "Ingen mobilitetsmaler lagret ennå.";
    case "rehab":
      return "Ingen rehab-maler lagret ennå.";
    default:
      return "Ingen styrkemaler lagret ennå.";
  }
}

export function exerciseBankTitle(subTab: ExerciseBankSubTab): string {
  if (subTab === "all") return "Alle øvelser";
  switch (subTab) {
    case "conditioning":
      return "Kondisjonsøvelser";
    case "mobility":
      return "Mobilitetsøvelser";
    case "rehab":
      return "Rehab-øvelser";
    default:
      return "Styrkeøvelser";
  }
}

export function exerciseBankDescription(subTab: ExerciseBankSubTab): string {
  if (subTab === "all") return "Søk og rediger hele øvelsesbanken på tvers av styrke, kondisjon, mobilitet og rehab.";
  switch (subTab) {
    case "conditioning":
      return "Opprett og rediger kondisjonsøvelser til intervall og utholdenhet.";
    case "mobility":
      return "Opprett og rediger mobilitet og tøying (inkl. eldre «Uttøyning»-øvelser).";
    case "rehab":
      return "Opprett og rediger rehab-øvelser for skånsom progresjon.";
    default:
      return "Opprett og rediger styrkeøvelser. Navn og muskelgruppe må fylles ut.";
  }
}

export function emptyExerciseBankMessage(subTab: ExerciseBankSubTab): string {
  if (subTab === "all") return "Ingen øvelser i banken ennå";
  switch (subTab) {
    case "conditioning":
      return "Ingen kondisjonsøvelser ennå";
    case "mobility":
      return "Ingen mobilitetsøvelser ennå";
    case "rehab":
      return "Ingen rehab-øvelser ennå";
    default:
      return "Ingen styrkeøvelser ennå";
  }
}
