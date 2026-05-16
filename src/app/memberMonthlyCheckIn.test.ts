import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_IN_COMPLETION_DAYS,
  getMonthKey,
  hasCompletedCheckInForMonth,
  mergeCheckInIntoPersonalGoals,
  resolveCheckInWindow,
  shouldPromptMonthlyCheckIn,
} from "./memberMonthlyCheckIn";
import type { Member } from "./types";

function memberWithGoals(personalGoals: string): Member {
  return {
    id: "m1",
    name: "Test",
    email: "t@test.no",
    isActive: true,
    personalGoals,
    goal: "",
    focus: "",
    injuries: "",
    level: "Middels",
    membershipType: "Premium",
    customerType: "PT-kunde",
    daysSinceActivity: 0,
    phone: "",
    birthDate: "",
    weight: "",
    height: "",
    coachNotes: "",
    avatarUrl: "",
    invitedAt: "",
  };
}

const onboardingDone = `MOTUS_PROFILE_V1:${JSON.stringify({
  onboarding: { version: 1, completedAt: "2026-01-01T00:00:00.000Z", skipped: false },
})}`;

describe("resolveCheckInWindow", () => {
  it("opens on last day of month with 14-day deadline", () => {
    const window = resolveCheckInWindow(new Date(2026, 4, 31));
    expect(window).not.toBeNull();
    expect(window?.monthKey).toBe(getMonthKey(new Date(2026, 4, 31)));
    expect(window?.opensAt.getDate()).toBe(31);
    expect(window?.daysRemaining).toBeLessThanOrEqual(CHECK_IN_COMPLETION_DAYS);
  });

  it("allows completion into next month within grace period", () => {
    const window = resolveCheckInWindow(new Date(2026, 5, 5));
    expect(window?.monthKey).toBe("2026-05");
    expect(window?.daysRemaining).toBeGreaterThan(0);
  });

  it("returns null outside the window", () => {
    expect(resolveCheckInWindow(new Date(2026, 5, 20))).toBeNull();
  });
});

describe("shouldPromptMonthlyCheckIn", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires onboarding and open window", () => {
    const may31 = new Date(2026, 4, 31);
    vi.setSystemTime(may31);
    const window = resolveCheckInWindow();
    expect(window).not.toBeNull();
    const member = memberWithGoals(onboardingDone);
    expect(shouldPromptMonthlyCheckIn(member, "member")).toBe(true);
    expect(shouldPromptMonthlyCheckIn(member, "trainer")).toBe(false);
  });

  it("stops prompting after submission for the month", () => {
    const may31 = new Date(2026, 4, 31);
    vi.setSystemTime(may31);
    const window = resolveCheckInWindow(may31)!;
    const checkIn = {
      version: 1 as const,
      monthKey: window.monthKey,
      trainingGoing: 4,
      metExpectations: 3,
      trainingNeeds: ["Mer variasjon"],
      trainingNeedsNotes: "",
      challengingNotes: "Reise",
      coachNotes: "",
      completedAt: may31.toISOString(),
    };
    const goals = mergeCheckInIntoPersonalGoals(onboardingDone, checkIn);
    expect(hasCompletedCheckInForMonth(goals, window.monthKey)).toBe(true);
    expect(shouldPromptMonthlyCheckIn(memberWithGoals(goals), "member")).toBe(false);
  });
});

describe("mergeCheckInIntoPersonalGoals", () => {
  it("roundtrips check-ins in personal_goals", () => {
    const merged = mergeCheckInIntoPersonalGoals(onboardingDone, {
      version: 1,
      monthKey: "2026-05",
      trainingGoing: 5,
      metExpectations: 4,
      trainingNeeds: ["Tøffere økter"],
      trainingNeedsNotes: "Gjerne mer pull",
      challengingNotes: "Lite tid",
      coachNotes: "Takk for oppfølging",
      completedAt: "2026-05-31T12:00:00.000Z",
    });
    expect(merged.startsWith("MOTUS_PROFILE_V1:")).toBe(true);
    expect(hasCompletedCheckInForMonth(merged, "2026-05")).toBe(true);
  });
});
