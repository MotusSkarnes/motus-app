import { isOnboardingCompleted } from "./memberOnboarding";
import type { Member } from "./types";

export const MEMBER_MONTHLY_CHECK_IN_VERSION = 1;
export const CHECK_IN_COMPLETION_DAYS = 14;

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export type MemberMonthlyCheckInAnswers = {
  version: typeof MEMBER_MONTHLY_CHECK_IN_VERSION;
  /** Month being reviewed, e.g. "2026-05". */
  monthKey: string;
  /** 1–5: Hvordan går treningen? */
  trainingGoing: number;
  /** 1–5: Har treningen gått som forventet? */
  metExpectations: number;
  trainingNeeds: string[];
  trainingNeedsNotes: string;
  challengingNotes: string;
  coachNotes: string;
  completedAt: string;
};

export const TRAINING_GOING_LABELS = ["Svært dårlig", "Dårlig", "OK", "Bra", "Svært bra"] as const;
export const MET_EXPECTATIONS_LABELS = ["Langt under", "Under", "Som forventet", "Over", "Over forventning"] as const;

export const TRAINING_NEED_OPTIONS = [
  "Mer struktur / plan",
  "Tøffere økter",
  "Mer variasjon",
  "Bedre oppfølging fra PT",
  "Lettere økter / mer restitusjon",
  "Fokus på teknikk",
  "Annet",
] as const;

export const CHECK_IN_PAGE_THEMES = [
  { title: "Treningsmåneden", subtitle: "Hvordan har det gått?" },
  { title: "Det du trenger", subtitle: "Hva kan vi justere fremover?" },
  { title: "Avslutning", subtitle: "Kort notat til treneren (valgfritt)." },
] as const;

export const CHECK_IN_PAGE_COUNT = CHECK_IN_PAGE_THEMES.length;

export type CheckInWindow = {
  monthKey: string;
  monthLabel: string;
  opensAt: Date;
  deadlineAt: Date;
  daysRemaining: number;
  isOpeningDay: boolean;
};

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}

function clampScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function normalizeCheckInEntry(raw: unknown): MemberMonthlyCheckInAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MemberMonthlyCheckInAnswers>;
  if (!data.completedAt || !data.monthKey) return null;
  return {
    version: MEMBER_MONTHLY_CHECK_IN_VERSION,
    monthKey: String(data.monthKey),
    trainingGoing: clampScale(data.trainingGoing),
    metExpectations: clampScale(data.metExpectations),
    trainingNeeds: normalizeStringArray(data.trainingNeeds),
    trainingNeedsNotes: String(data.trainingNeedsNotes ?? "").trim(),
    challengingNotes: String(data.challengingNotes ?? "").trim(),
    coachNotes: String(data.coachNotes ?? "").trim(),
    completedAt: String(data.completedAt),
  };
}

export function getMonthlyCheckInsFromPersonalGoals(personalGoals: string | undefined): MemberMonthlyCheckInAnswers[] {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload || !Array.isArray(payload.monthlyCheckIns)) return [];
  return payload.monthlyCheckIns
    .map((entry) => normalizeCheckInEntry(entry))
    .filter((entry): entry is MemberMonthlyCheckInAnswers => Boolean(entry));
}

export function hasCompletedCheckInForMonth(personalGoals: string | undefined, monthKey: string): boolean {
  return getMonthlyCheckInsFromPersonalGoals(personalGoals).some((entry) => entry.monthKey === monthKey);
}

/** Opens on last calendar day of month; 14 days to complete (into next month). */
export function resolveCheckInWindow(now = new Date()): CheckInWindow | null {
  const today = startOfDay(now);

  for (let monthOffset = 0; monthOffset <= 1; monthOffset += 1) {
    const anchor = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
    const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const opensAt = startOfDay(lastDay);
    const deadlineAt = startOfDay(new Date(opensAt.getFullYear(), opensAt.getMonth(), opensAt.getDate() + CHECK_IN_COMPLETION_DAYS));
    const monthKey = getMonthKey(lastDay);

    if (today.getTime() >= opensAt.getTime() && today.getTime() <= deadlineAt.getTime()) {
      const msLeft = deadlineAt.getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      return {
        monthKey,
        monthLabel: monthLabelFromKey(monthKey),
        opensAt,
        deadlineAt,
        daysRemaining,
        isOpeningDay: today.getTime() === opensAt.getTime(),
      };
    }
  }

  return null;
}

export function shouldPromptMonthlyCheckIn(member: Member | null | undefined, role: string | undefined): boolean {
  if (!member || role !== "member") return false;
  if (!isOnboardingCompleted(member.personalGoals)) return false;
  const window = resolveCheckInWindow();
  if (!window) return false;
  return !hasCompletedCheckInForMonth(member.personalGoals, window.monthKey);
}

export function createEmptyCheckInDraft(monthKey: string): Omit<MemberMonthlyCheckInAnswers, "completedAt" | "version"> {
  return {
    monthKey,
    trainingGoing: 3,
    metExpectations: 3,
    trainingNeeds: [],
    trainingNeedsNotes: "",
    challengingNotes: "",
    coachNotes: "",
  };
}

export function mergeCheckInIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  checkIn: MemberMonthlyCheckInAnswers,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const previous = Array.isArray(existing.monthlyCheckIns)
    ? existing.monthlyCheckIns
        .map((entry) => normalizeCheckInEntry(entry))
        .filter((entry): entry is MemberMonthlyCheckInAnswers => Boolean(entry))
    : [];
  const withoutMonth = previous.filter((entry) => entry.monthKey !== checkIn.monthKey);
  const payload = {
    ...existing,
    monthlyCheckIns: [checkIn, ...withoutMonth].slice(0, 24),
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

export function buildCheckInNotificationCopy(window: CheckInWindow): { title: string; text: string; detail: string } {
  const month = window.monthLabel;
  if (window.daysRemaining <= 1) {
    return {
      title: "Månedlig sjekk-inn — siste dag",
      text: `Sjekk-inn for ${month}`,
      detail: "Fyll ut i dag — ellers må du vente til neste måned.",
    };
  }
  if (window.daysRemaining <= 3) {
    return {
      title: "Månedlig sjekk-inn — snart frist",
      text: `Sjekk-inn for ${month}`,
      detail: `${window.daysRemaining} dager igjen å fullføre (ca. 2 min).`,
    };
  }
  if (window.isOpeningDay) {
    return {
      title: "Ny månedlig sjekk-inn",
      text: `Hvordan gikk ${month}?`,
      detail: `Du har ${CHECK_IN_COMPLETION_DAYS} dager på å svare.`,
    };
  }
  return {
    title: "Påminnelse: månedlig sjekk-inn",
    text: `Sjekk-inn for ${month}`,
    detail: `${window.daysRemaining} dager igjen — tar ca. 2 minutter.`,
  };
}

export function formatCheckInSummaryLines(checkIn: MemberMonthlyCheckInAnswers): Array<{ label: string; value: string }> {
  return [
    { label: "Periode", value: monthLabelFromKey(checkIn.monthKey) },
    {
      label: "Hvordan går treningen",
      value: `${checkIn.trainingGoing}/5 — ${TRAINING_GOING_LABELS[checkIn.trainingGoing - 1] ?? ""}`,
    },
    {
      label: "Som forventet",
      value: `${checkIn.metExpectations}/5 — ${MET_EXPECTATIONS_LABELS[checkIn.metExpectations - 1] ?? ""}`,
    },
    { label: "Trenger av trening", value: checkIn.trainingNeeds.join(", ") || "Ikke oppgitt" },
    { label: "Utfordrende", value: checkIn.challengingNotes || "Ikke oppgitt" },
    ...(checkIn.trainingNeedsNotes.trim() ? [{ label: "Behov (notat)", value: checkIn.trainingNeedsNotes.trim() }] : []),
    ...(checkIn.coachNotes.trim() ? [{ label: "Til trener", value: checkIn.coachNotes.trim() }] : []),
  ];
}

export function resolveLatestMonthlyCheckIn(personalGoals: string | undefined): MemberMonthlyCheckInAnswers | null {
  const entries = getMonthlyCheckInsFromPersonalGoals(personalGoals);
  if (!entries.length) return null;
  return [...entries].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0] ?? null;
}
