import type { Level, Member } from "./types";

/** Stored inside members.personal_goals (MOTUS_PROFILE_V1 JSON). */
export const MEMBER_ONBOARDING_VERSION = 1;

export type MemberExperienceLevel = "Nybegynner" | "Litt erfaren" | "Erfaren";

export type MemberOnboardingAnswers = {
  version: typeof MEMBER_ONBOARDING_VERSION;
  /** Primary training goals (multi). */
  trainingGoals: string[];
  /** Free-text goals for next months. */
  goalsNotes: string;
  /** 1–10 importance slider. */
  importanceNow: number;
  experienceLevel: MemberExperienceLevel;
  /** Mapped to Member.level on save. */
  level: Level;
  currentWeeklySessions: string;
  sessionsPerWeekTarget: string;
  preferredSessionMinutes: string;
  trainingForms: string[];
  motivations: string[];
  energyInTraining: string;
  consistencyHelpers: string;
  injuries: string;
  dropoutReasons: string[];
  dropoutNotes: string;
  preferredTrainingTime: string;
  wantsTrainerStructure: string;
  coachNotesFromMember: string;
  completedAt: string;
  skipped?: boolean;
};

export const TRAINING_GOAL_OPTIONS = [
  "Bli sterkere",
  "Bygge muskler",
  "Gå ned i vekt",
  "Øke i vekt",
  "Bedre kondisjon",
  "Generelt bedre helse",
  "Mer energi i hverdagen",
  "Komme tilbake etter skade/pause",
] as const;

export const CURRENT_WEEKLY_SESSION_OPTIONS = [
  "Trener ikke fast nå",
  "1 gang i uken",
  "2 ganger i uken",
  "3 ganger i uken",
  "4–5 ganger i uken",
  "6+ ganger i uken",
] as const;

export const SESSIONS_PER_WEEK_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"] as const;

export const SESSION_LENGTH_OPTIONS = [
  "30 min eller mindre",
  "45 min",
  "60 min",
  "75 min",
  "90 min eller mer",
] as const;

export const TRAINING_FORM_OPTIONS = [
  "Styrke",
  "Kondisjon / intervaller",
  "Løping",
  "Sykkel",
  "Svømming",
  "Gruppetime",
  "Functional / cross",
  "Mobilitet / yoga",
  "Annet",
] as const;

export const MOTIVATION_OPTIONS = [
  "Resultater",
  "Rutiner",
  "Konkurranse",
  "Helse",
  "Mestring",
  "Overskudd",
] as const;

export const ENERGY_LEVEL_OPTIONS = [
  "Svært lavt",
  "Lavt",
  "Varierende",
  "Godt",
  "Svært godt",
] as const;

export const DROPOUT_REASON_OPTIONS = [
  "Mangler tid",
  "Mangler motivasjon",
  "Skader eller smerter",
  "Reise / jobb",
  "Stress i hverdagen",
  "Treningsprogram passer ikke",
  "Savner oppfølging",
  "Annet",
] as const;

export const PREFERRED_TIME_OPTIONS = [
  "Morgen",
  "Formiddag",
  "Ettermiddag",
  "Kveld",
  "Varierer",
] as const;

export const TRAINER_STRUCTURE_OPTIONS = [
  "Vil ha tydelig plan fra PT",
  "Noe struktur, men fleksibelt",
  "Trives best med mye frihet",
] as const;

export const ONBOARDING_PAGE_THEMES = [
  { title: "Målsetninger", subtitle: "Hva vil du oppnå med treningen?" },
  { title: "Treningsnivå", subtitle: "Hvor er du i dag?" },
  { title: "Treningsvaner", subtitle: "Hvor ofte og hvordan vil du trene?" },
  { title: "Motivasjon & energi", subtitle: "Hva driver deg — og hvordan føles kroppen?" },
  { title: "Skader & barrierer", subtitle: "Hensyn og det som gjør det vanskelig å holde ut." },
  { title: "Avslutning", subtitle: "Siste detaljer til treneren din." },
] as const;

export const ONBOARDING_PAGE_COUNT = ONBOARDING_PAGE_THEMES.length;

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export function experienceLevelToMemberLevel(level: MemberExperienceLevel): Level {
  if (level === "Litt erfaren") return "Litt øvet";
  if (level === "Erfaren") return "Øvet";
  return "Nybegynner";
}

export function memberLevelToExperienceLevel(level: Level | string | undefined): MemberExperienceLevel {
  if (level === "Litt øvet") return "Litt erfaren";
  if (level === "Øvet") return "Erfaren";
  return "Nybegynner";
}

export function createEmptyOnboardingDraft(): Omit<MemberOnboardingAnswers, "completedAt" | "version"> {
  return {
    trainingGoals: [],
    goalsNotes: "",
    importanceNow: 7,
    experienceLevel: "Nybegynner",
    level: "Nybegynner",
    currentWeeklySessions: "",
    sessionsPerWeekTarget: "3",
    preferredSessionMinutes: "60 min",
    trainingForms: [],
    motivations: [],
    energyInTraining: "",
    consistencyHelpers: "",
    injuries: "",
    dropoutReasons: [],
    dropoutNotes: "",
    preferredTrainingTime: "",
    wantsTrainerStructure: "",
    coachNotesFromMember: "",
  };
}

function parsePersonalGoalsJson(personalGoals: string | undefined): Record<string, unknown> | null {
  if (!personalGoals?.startsWith(PROFILE_METRICS_PREFIX)) return null;
  try {
    const parsed = JSON.parse(personalGoals.slice(PROFILE_METRICS_PREFIX.length)) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  );
}

function normalizeOnboardingRaw(raw: unknown): MemberOnboardingAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MemberOnboardingAnswers>;
  if (!data.completedAt) return null;
  const experienceLevel =
    data.experienceLevel === "Litt erfaren" || data.experienceLevel === "Erfaren"
      ? data.experienceLevel
      : "Nybegynner";
  return {
    version: MEMBER_ONBOARDING_VERSION,
    trainingGoals: normalizeStringArray(data.trainingGoals),
    goalsNotes: String(data.goalsNotes ?? "").trim(),
    importanceNow: clampImportance(data.importanceNow),
    experienceLevel,
    level: experienceLevelToMemberLevel(experienceLevel),
    currentWeeklySessions: String(data.currentWeeklySessions ?? "").trim(),
    sessionsPerWeekTarget: String(data.sessionsPerWeekTarget ?? "").trim() || "3",
    preferredSessionMinutes: String(data.preferredSessionMinutes ?? "").trim(),
    trainingForms: normalizeStringArray(data.trainingForms),
    motivations: normalizeStringArray(data.motivations),
    energyInTraining: String(data.energyInTraining ?? "").trim(),
    consistencyHelpers: String(data.consistencyHelpers ?? "").trim(),
    injuries: String(data.injuries ?? "").trim(),
    dropoutReasons: normalizeStringArray(data.dropoutReasons),
    dropoutNotes: String(data.dropoutNotes ?? "").trim(),
    preferredTrainingTime: String(data.preferredTrainingTime ?? "").trim(),
    wantsTrainerStructure: String(data.wantsTrainerStructure ?? "").trim(),
    coachNotesFromMember: String(data.coachNotesFromMember ?? "").trim(),
    completedAt: String(data.completedAt ?? "").trim(),
  };
}

function clampImportance(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 7;
  return Math.min(10, Math.max(1, Math.round(n)));
}

export function getOnboardingFromPersonalGoals(personalGoals: string | undefined): MemberOnboardingAnswers | null {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return null;
  return normalizeOnboardingRaw(payload.onboarding);
}

export function isOnboardingCompleted(personalGoals: string | undefined): boolean {
  return Boolean(getOnboardingFromPersonalGoals(personalGoals)?.completedAt);
}

export function mergeOnboardingIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  onboarding: MemberOnboardingAnswers,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const payload = {
    sessionsPerWeekTarget: String(existing.sessionsPerWeekTarget ?? onboarding.sessionsPerWeekTarget ?? ""),
    dailyStepsTarget: String(existing.dailyStepsTarget ?? ""),
    targetWeight: String(existing.targetWeight ?? ""),
    currentDailySteps: String(existing.currentDailySteps ?? ""),
    ...(existing.homeVisibility && typeof existing.homeVisibility === "object"
      ? { homeVisibility: existing.homeVisibility }
      : {}),
    ...(Array.isArray(existing.favoritePersonalRecords)
      ? { favoritePersonalRecords: existing.favoritePersonalRecords }
      : {}),
    onboarding,
    onboardingCompletedAt: onboarding.completedAt,
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function primaryGoalFromOnboarding(onboarding: MemberOnboardingAnswers): string {
  return onboarding.trainingGoals[0] ?? "Generelt bedre helse";
}

export function formatOnboardingSummaryLines(onboarding: MemberOnboardingAnswers): Array<{ label: string; value: string }> {
  if (onboarding.skipped) {
    return [{ label: "Status", value: "Hoppet over — kan fylles ut senere" }];
  }
  const lines: Array<{ label: string; value: string }> = [
    { label: "Treningsmål", value: onboarding.trainingGoals.join(", ") || "Ikke oppgitt" },
    { label: "Viktighet nå (1–10)", value: String(onboarding.importanceNow) },
    { label: "Nivå", value: onboarding.experienceLevel },
    { label: "Trener i dag", value: onboarding.currentWeeklySessions || "Ikke oppgitt" },
    { label: "Ønsket økter/uke", value: onboarding.sessionsPerWeekTarget || "Ikke oppgitt" },
    { label: "Øktlengde", value: onboarding.preferredSessionMinutes || "Ikke oppgitt" },
    { label: "Treningsformer", value: onboarding.trainingForms.join(", ") || "Ikke oppgitt" },
    { label: "Motivasjon", value: onboarding.motivations.join(", ") || "Ikke oppgitt" },
    { label: "Energi i trening", value: onboarding.energyInTraining || "Ikke oppgitt" },
    { label: "Skader/hensyn", value: onboarding.injuries || "Ingen registrert" },
    { label: "Faller ofte fra pga.", value: onboarding.dropoutReasons.join(", ") || "Ikke oppgitt" },
    { label: "Foretrukket tid", value: onboarding.preferredTrainingTime || "Ikke oppgitt" },
    { label: "Ønsket struktur", value: onboarding.wantsTrainerStructure || "Ikke oppgitt" },
  ];
  if (onboarding.goalsNotes.trim()) lines.push({ label: "Målnotat", value: onboarding.goalsNotes.trim() });
  if (onboarding.consistencyHelpers.trim()) lines.push({ label: "Hva hjelper", value: onboarding.consistencyHelpers.trim() });
  if (onboarding.dropoutNotes.trim()) lines.push({ label: "Barrierer (notat)", value: onboarding.dropoutNotes.trim() });
  if (onboarding.coachNotesFromMember.trim()) lines.push({ label: "Til trener", value: onboarding.coachNotesFromMember.trim() });
  return lines;
}

export function resolveMemberOnboarding(member: Member | null | undefined): MemberOnboardingAnswers | null {
  if (!member) return null;
  return getOnboardingFromPersonalGoals(member.personalGoals);
}

export function shouldShowMemberOnboarding(member: Member | null | undefined, role: string | undefined): boolean {
  if (!member || role !== "member") return false;
  return !isOnboardingCompleted(member.personalGoals);
}
