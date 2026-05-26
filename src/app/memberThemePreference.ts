import { parsePersonalGoalsJson } from "./memberOnboarding";

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";
const STORAGE_KEY = "motus.member.theme";

export type MemberTheme = "light" | "dark";

export const MEMBER_THEME_CHANGED_EVENT = "motus:member-theme-changed";

export function isMemberTheme(value: unknown): value is MemberTheme {
  return value === "light" || value === "dark";
}

/** Leser lokalt lagret valg. Faller tilbake til "light" hvis ingenting er lagret. */
export function readLocalMemberTheme(): MemberTheme {
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isMemberTheme(raw)) return raw;
  } catch {
    // ignore
  }
  return "light";
}

/** Lagrer lokalt og kringkaster endring til alle åpne komponenter. */
export function writeLocalMemberTheme(theme: MemberTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore quota issues
  }
  try {
    window.dispatchEvent(new CustomEvent<MemberTheme>(MEMBER_THEME_CHANGED_EVENT, { detail: theme }));
  } catch {
    // ignore
  }
}

/** Slår dark-klasse av/på på html og body. */
export function applyMemberThemeToDocument(theme: MemberTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (theme === "dark") {
    root.classList.add("motus-theme-dark");
    if (body) body.classList.add("motus-theme-dark");
    root.dataset.motusTheme = "dark";
  } else {
    root.classList.remove("motus-theme-dark");
    if (body) body.classList.remove("motus-theme-dark");
    root.dataset.motusTheme = "light";
  }
}

/** Leser tema-valg fra personal_goals JSON (Supabase-lagret). */
export function readMemberThemeFromPersonalGoals(personalGoals: string | undefined): MemberTheme | null {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return null;
  const raw = payload.themePreference;
  return isMemberTheme(raw) ? raw : null;
}

/** Skriver tema-valg inn i personal_goals JSON, beholder alle andre felt. */
export function mergeMemberThemeIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  theme: MemberTheme,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const payload = {
    ...existing,
    themePreference: theme,
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}
