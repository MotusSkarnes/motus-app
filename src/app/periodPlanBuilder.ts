import { listActivityTemplates, periodPlanEntryForActivityTemplate } from "./activityTemplate";
import { DEFAULT_MOTUS_GROUP_CLASS_NAMES } from "./motusGroupClassTemplates";
import type { TrainingProgram, WeekdayPlanKey } from "./types";

export { DEFAULT_MOTUS_GROUP_CLASS_NAMES };

export const WEEKDAY_PLAN_FIELDS: Array<{ key: WeekdayPlanKey; label: string }> = [
  { key: "monday", label: "Mandag" },
  { key: "tuesday", label: "Tirsdag" },
  { key: "wednesday", label: "Onsdag" },
  { key: "thursday", label: "Torsdag" },
  { key: "friday", label: "Fredag" },
  { key: "saturday", label: "Lørdag" },
  { key: "sunday", label: "Søndag" },
];

/** @deprecated Bruk DEFAULT_MOTUS_GROUP_CLASS_NAMES + maler i stedet for hardkodede dropdown-rader. */
export const GROUP_WORKOUT_PLAN_OPTIONS = [
  "Gruppetime",
  ...DEFAULT_MOTUS_GROUP_CLASS_NAMES.map((className) => `Gruppetime: ${className}`),
] as const;

const BASE_PERIOD_PLAN_DAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Ingen plan valgt" },
  { value: "Hvile / restitusjon", label: "Hvile / restitusjon" },
  { value: "Aktiv restitusjon", label: "Aktiv restitusjon" },
  { value: "Valgfri økt", label: "Valgfri økt" },
  ...GROUP_WORKOUT_PLAN_OPTIONS.map((value) => ({ value, label: value })),
];

export type PeriodPlanChangeCategoryId = "programs" | "group" | "other";

export type PeriodPlanChangeOption = {
  value: string;
  label: string;
  meta: string;
  category: PeriodPlanChangeCategoryId;
};

export const PERIOD_PLAN_CHANGE_CATEGORIES: Array<{
  id: PeriodPlanChangeCategoryId;
  label: string;
}> = [
  { id: "programs", label: "Egne programmer" },
  { id: "group", label: "Gruppetimer" },
  { id: "other", label: "Annet" },
];

const OTHER_PERIOD_PLAN_CHANGE_OPTIONS: PeriodPlanChangeOption[] = [
  { value: "Hvile / restitusjon", label: "Hvile / restitusjon", meta: "Hvile", category: "other" },
  { value: "Aktiv restitusjon", label: "Aktiv restitusjon", meta: "Hvile", category: "other" },
  { value: "Valgfri økt", label: "Valgfri økt", meta: "Annet", category: "other" },
];

function displayLabelForPrefixedEntry(value: string, prefix: string): string {
  const trimmed = value.trim();
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    return trimmed.slice(prefix.length).trim() || trimmed;
  }
  return trimmed;
}

function setChangeOption(options: Map<string, PeriodPlanChangeOption>, option: PeriodPlanChangeOption) {
  const value = option.value.trim();
  if (!value || options.has(value)) return;
  options.set(value, { ...option, value });
}

/** Alternativer for «Legg til økt» / «Bytt program», gruppert så gruppetimer ikke gjemmer hvile. */
export function buildPeriodPlanChangeOptions(input: {
  memberPrograms: TrainingProgram[];
  activityTemplates?: TrainingProgram[];
}): PeriodPlanChangeOption[] {
  const options = new Map<string, PeriodPlanChangeOption>();
  OTHER_PERIOD_PLAN_CHANGE_OPTIONS.forEach((option) => setChangeOption(options, option));

  input.memberPrograms
    .filter(
      (program) =>
        !program.ephemeral &&
        program.memberId !== "__template__" &&
        program.memberLibraryStatus !== "archived" &&
        program.memberLibraryStatus !== "hidden" &&
        program.exercises.length > 0,
    )
    .sort((a, b) => a.title.localeCompare(b.title, "nb"))
    .forEach((program) => {
      const value = program.title.trim();
      setChangeOption(options, { value, label: value, meta: "Program", category: "programs" });
    });

  const templates = input.activityTemplates ?? [];
  listActivityTemplates(templates, "group")
    .sort((a, b) => a.title.localeCompare(b.title, "nb"))
    .forEach((template) => {
      const value = periodPlanEntryForActivityTemplate(template);
      setChangeOption(options, {
        value,
        label: displayLabelForPrefixedEntry(value, "Gruppetime:"),
        meta: "Gruppetime",
        category: "group",
      });
    });
  DEFAULT_MOTUS_GROUP_CLASS_NAMES.forEach((className) => {
    setChangeOption(options, {
      value: `Gruppetime: ${className}`,
      label: className,
      meta: "Gruppetime",
      category: "group",
    });
  });
  setChangeOption(options, { value: "Gruppetime", label: "Gruppetime", meta: "Gruppetime", category: "group" });

  listActivityTemplates(templates, "activity")
    .sort((a, b) => a.title.localeCompare(b.title, "nb"))
    .forEach((template) => {
      const value = periodPlanEntryForActivityTemplate(template);
      setChangeOption(options, {
        value,
        label: displayLabelForPrefixedEntry(value, "Aktivitet:"),
        meta: "Aktivitet",
        category: "other",
      });
    });

  return Array.from(options.values());
}

export function inferPeriodPlanChangeCategory(
  entry: string,
  options: PeriodPlanChangeOption[],
): PeriodPlanChangeCategoryId | null {
  const normalized = entry.trim().toLowerCase();
  if (!normalized) return null;
  return options.find((option) => option.value.trim().toLowerCase() === normalized)?.category ?? null;
}

/** Dropdown-alternativer for dag i periodeplan (grunnvalg + programmaler). */
export function buildPeriodPlanProgramSelectOptions(
  programTitles: string[],
  activityTemplates: TrainingProgram[] = [],
): Array<{ value: string; label: string }> {
  const uniqueByValue = new Map<string, { value: string; label: string }>();
  BASE_PERIOD_PLAN_DAY_OPTIONS.forEach((option) => {
    if (!uniqueByValue.has(option.value)) uniqueByValue.set(option.value, option);
  });
  listActivityTemplates(activityTemplates).forEach((template) => {
    const value = periodPlanEntryForActivityTemplate(template);
    if (!value) return;
    if (!uniqueByValue.has(value)) uniqueByValue.set(value, { value, label: value });
  });
  programTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .forEach((title) => {
      if (!uniqueByValue.has(title)) uniqueByValue.set(title, { value: title, label: title });
    });
  return Array.from(uniqueByValue.values());
}
