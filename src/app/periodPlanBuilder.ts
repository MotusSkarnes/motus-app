import type { WeekdayPlanKey } from "./types";

export const WEEKDAY_PLAN_FIELDS: Array<{ key: WeekdayPlanKey; label: string }> = [
  { key: "monday", label: "Mandag" },
  { key: "tuesday", label: "Tirsdag" },
  { key: "wednesday", label: "Onsdag" },
  { key: "thursday", label: "Torsdag" },
  { key: "friday", label: "Fredag" },
  { key: "saturday", label: "Lørdag" },
  { key: "sunday", label: "Søndag" },
];

export const GROUP_WORKOUT_PLAN_OPTIONS = [
  "Gruppetime",
  "Gruppetime: Smilepuls",
  "Gruppetime: Sykkel 45",
  "Gruppetime: Mølle 45",
  "Gruppetime: Sterk",
  "Gruppetime: Sirkeltrening",
  "Gruppetime: Stram opp",
  "Gruppetime: Dansemix",
  "Gruppetime: Yoga",
  "Gruppetime: Tabata",
  "Gruppetime: Godt voksen",
  "Gruppetime: Step styrke",
] as const;

const BASE_PERIOD_PLAN_DAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Ingen plan valgt" },
  { value: "Hvile / restitusjon", label: "Hvile / restitusjon" },
  { value: "Aktiv restitusjon", label: "Aktiv restitusjon" },
  { value: "Valgfri økt", label: "Valgfri økt" },
  ...GROUP_WORKOUT_PLAN_OPTIONS.map((label) => ({ value: label, label })),
];

/** Dropdown-alternativer for dag i periodeplan (grunnvalg + programmaler). */
export function buildPeriodPlanProgramSelectOptions(programTitles: string[]): Array<{ value: string; label: string }> {
  const uniqueByValue = new Map<string, { value: string; label: string }>();
  BASE_PERIOD_PLAN_DAY_OPTIONS.forEach((option) => {
    if (!uniqueByValue.has(option.value)) uniqueByValue.set(option.value, option);
  });
  programTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .forEach((title) => {
      if (!uniqueByValue.has(title)) uniqueByValue.set(title, { value: title, label: title });
    });
  return Array.from(uniqueByValue.values());
}
