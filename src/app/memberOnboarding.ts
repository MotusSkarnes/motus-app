import { pickBestPersonalGoals } from "./memberProfileGoals";
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
  { title: "Målsetninger", subtitle: "PT bruker svarene dine til å lage et treningsprogram tilpasset deg." },
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

export function parsePersonalGoalsJson(personalGoals: string | undefined): Record<string, unknown> | null {
  const trimmed = String(personalGoals ?? "").trim();
  if (!trimmed) return null;

  let jsonPart = "";
  if (trimmed.startsWith(PROFILE_METRICS_PREFIX)) {
    jsonPart = trimmed.slice(PROFILE_METRICS_PREFIX.length);
  } else {
    const prefixIndex = trimmed.indexOf(PROFILE_METRICS_PREFIX);
    if (prefixIndex >= 0) {
      jsonPart = trimmed.slice(prefixIndex + PROFILE_METRICS_PREFIX.length);
    } else if (trimmed.startsWith("{")) {
      jsonPart = trimmed;
    } else {
      return null;
    }
  }

  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Bevar skjema-/sjekk-inn-data ved andre profil-lagringer. */
export function readProfileExtensions(personalGoals: string | undefined): Record<string, unknown> {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return {};
  const extensions: Record<string, unknown> = {};
  if (payload.onboarding && typeof payload.onboarding === "object") {
    extensions.onboarding = payload.onboarding;
  }
  const completedAt = String(payload.onboardingCompletedAt ?? "").trim();
  if (completedAt) extensions.onboardingCompletedAt = completedAt;
  if (Array.isArray(payload.monthlyCheckIns)) {
    extensions.monthlyCheckIns = payload.monthlyCheckIns;
  }
  if (payload.homeVisibility && typeof payload.homeVisibility === "object") {
    extensions.homeVisibility = payload.homeVisibility;
  }
  if (Array.isArray(payload.favoritePersonalRecords)) {
    extensions.favoritePersonalRecords = payload.favoritePersonalRecords;
  }
  return extensions;
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
    ...(data.skipped ? { skipped: true } : {}),
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
  const fromOnboarding = normalizeOnboardingRaw(payload.onboarding);
  if (fromOnboarding) return fromOnboarding;

  const completedAt = String(payload.onboardingCompletedAt ?? "").trim();
  if (!completedAt) return null;

  const skipped =
    payload.onboarding &&
    typeof payload.onboarding === "object" &&
    Boolean((payload.onboarding as { skipped?: boolean }).skipped);

  return {
    ...createEmptyOnboardingDraft(),
    version: MEMBER_ONBOARDING_VERSION,
    completedAt,
    ...(skipped ? { skipped: true } : {}),
  };
}

/** Fullført med reelle svar — ikke bare tom «completedAt»-markør i profilblob. */
export function hasSubstantiveOnboardingAnswers(personalGoals: string | undefined): boolean {
  const onboarding = getOnboardingFromPersonalGoals(personalGoals);
  if (!onboarding?.completedAt) return false;
  if (onboarding.skipped) return true;
  return (
    onboarding.trainingGoals.length > 0 ||
    onboarding.motivations.length > 0 ||
    onboarding.trainingForms.length > 0 ||
    Boolean(onboarding.currentWeeklySessions.trim()) ||
    Boolean(onboarding.energyInTraining.trim()) ||
    Boolean(onboarding.goalsNotes.trim())
  );
}

export function isOnboardingCompleted(personalGoals: string | undefined): boolean {
  return hasSubstantiveOnboardingAnswers(personalGoals);
}

export function onboardingDraftFromStored(personalGoals: string | undefined): Omit<MemberOnboardingAnswers, "completedAt" | "version"> {
  const stored = getOnboardingFromPersonalGoals(personalGoals);
  if (!stored || stored.skipped) return createEmptyOnboardingDraft();
  const { completedAt: _c, version: _v, skipped: _s, ...draft } = stored;
  return draft;
}

const ONBOARDING_GATE_SEEN_KEY_PREFIX = "motus.member.onboarding.gateSeen.v1:";

export function memberOnboardingIdentityKey(member: Member): string {
  return member.id.trim() || member.email.trim().toLowerCase();
}

export function hasSeenOnboardingGate(identityKey: string): boolean {
  if (typeof window === "undefined" || !identityKey) return false;
  return window.localStorage.getItem(`${ONBOARDING_GATE_SEEN_KEY_PREFIX}${identityKey}`) === "1";
}

export function markOnboardingGateSeen(identityKey: string): void {
  if (typeof window === "undefined" || !identityKey) return;
  window.localStorage.setItem(`${ONBOARDING_GATE_SEEN_KEY_PREFIX}${identityKey}`, "1");
}

/** Duplikat-rader med samme e-post (aldri koble på navn — ulike personer kan ha like navn). */
export function findMembersByEmail(member: Member, allMembers: Member[]): Member[] {
  const email = member.email.trim().toLowerCase();
  if (!email || !allMembers.length) return [member];
  return allMembers.filter((row) => row.email.trim().toLowerCase() === email);
}

/** Slå sammen profil fra duplikat-rader slik at lagret skjema ikke «forsvinner». */
export function enrichMemberWithBestProfile(member: Member, allMembers: Member[]): Member {
  const candidates = allMembers.length ? findMembersByEmail(member, allMembers) : [member];
  const personalGoals = pickBestPersonalGoals(candidates.map((row) => row.personalGoals));
  if (!personalGoals || personalGoals === member.personalGoals) return member;
  return { ...member, personalGoals };
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
    ...(Array.isArray(existing.monthlyCheckIns) ? { monthlyCheckIns: existing.monthlyCheckIns } : {}),
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

function scoreOnboardingRichness(onboarding: MemberOnboardingAnswers): number {
  if (onboarding.skipped) return 0;
  return (
    onboarding.trainingGoals.length * 10 +
    onboarding.motivations.length * 5 +
    onboarding.trainingForms.length * 3 +
    (onboarding.goalsNotes.trim() ? 4 : 0) +
    (onboarding.injuries.trim() ? 2 : 0)
  );
}

/** Finn rikeste oppstartsskjema på tvers av flere personal_goals-blobs. */
export function resolveOnboardingFromPersonalGoalCandidates(
  candidates: Array<string | undefined | null>,
): MemberOnboardingAnswers | null {
  let bestDetailed: MemberOnboardingAnswers | null = null;
  let bestDetailedScore = -1;
  let bestCompleted: MemberOnboardingAnswers | null = null;

  for (const raw of candidates) {
    const onboarding = getOnboardingFromPersonalGoals(raw);
    if (!onboarding?.completedAt) continue;
    if (!bestCompleted) bestCompleted = onboarding;
    if (onboarding.skipped) continue;
    const score = scoreOnboardingRichness(onboarding);
    if (score > bestDetailedScore) {
      bestDetailedScore = score;
      bestDetailed = onboarding;
    }
  }

  return bestDetailed ?? bestCompleted;
}

export function resolveMemberOnboarding(
  member: Member | null | undefined,
  allMembers?: Member[],
): MemberOnboardingAnswers | null {
  if (!member) return null;
  const related = allMembers?.length ? findMembersByEmail(member, allMembers) : [member];
  const fromRelated = resolveOnboardingFromPersonalGoalCandidates(related.map((row) => row.personalGoals));
  if (fromRelated) return fromRelated;

  const profile = allMembers?.length ? enrichMemberWithBestProfile(member, allMembers) : member;
  return getOnboardingFromPersonalGoals(profile.personalGoals);
}

export function shouldShowMemberOnboarding(
  member: Member | null | undefined,
  role: string | undefined,
  allMembers?: Member[],
): boolean {
  if (!member || role !== "member") return false;
  const profile = allMembers?.length ? enrichMemberWithBestProfile(member, allMembers) : member;
  return !isOnboardingCompleted(profile.personalGoals);
}
