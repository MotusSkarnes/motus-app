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
