import { describe, expect, it } from "vitest";
import { pickBestPersonalGoals } from "./memberProfileGoals";
import { buildMemberFormTrainerAlerts, memberFormAlertKey } from "./memberFormTrainerAlerts";
import type { Member } from "./types";

function member(partial: Partial<Member> & Pick<Member, "id" | "personalGoals">): Member {
  return {
    id: partial.id,
    name: partial.name ?? "Kari",
    email: partial.email ?? "kari@test.no",
    isActive: partial.isActive ?? true,
    personalGoals: partial.personalGoals,
    goal: partial.goal ?? "",
    focus: partial.focus ?? "",
    injuries: partial.injuries ?? "",
    level: partial.level ?? "Middels",
    membershipType: partial.membershipType ?? "Premium",
    customerType: partial.customerType ?? "PT-kunde",
    daysSinceActivity: partial.daysSinceActivity ?? 0,
    phone: partial.phone ?? "",
    birthDate: partial.birthDate ?? "",
    coachNotes: partial.coachNotes ?? "",
    avatarUrl: partial.avatarUrl ?? "",
    invitedAt: partial.invitedAt ?? "",
  };
}

describe("pickBestPersonalGoals", () => {
  it("prefers MOTUS profile blob with form data", () => {
    const rich = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", skipped: false },
      monthlyCheckIns: [{ monthKey: "2026-05", completedAt: "2026-05-16T00:00:00.000Z" }],
    })}`;
    const picked = pickBestPersonalGoals(["", "Generelt mål", rich]);
    expect(picked).toBe(rich);
  });
});

describe("buildMemberFormTrainerAlerts", () => {
  it("creates alerts for onboarding and check-in", () => {
    const goals = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: {
        version: 1,
        completedAt: "2026-04-01T10:00:00.000Z",
        skipped: false,
        trainingGoals: ["Styrke"],
        goalsNotes: "",
        importanceNow: 7,
        experienceLevel: "Nybegynner",
        level: "Nybegynner",
        currentWeeklySessions: "2",
        sessionsPerWeekTarget: "3",
        preferredSessionMinutes: "60",
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
      },
      monthlyCheckIns: [
        {
          version: 1,
          monthKey: "2026-05",
          trainingGoing: 4,
          metExpectations: 3,
          trainingNeeds: ["Mer variasjon"],
          trainingNeedsNotes: "",
          challengingNotes: "",
          coachNotes: "",
          completedAt: "2026-05-16T12:00:00.000Z",
        },
      ],
    })}`;
    const alerts = buildMemberFormTrainerAlerts([member({ id: "m1", personalGoals: goals })], new Set());
    expect(alerts).toHaveLength(2);
    expect(alerts.some((a) => a.kind === "onboarding")).toBe(true);
    expect(alerts.some((a) => a.kind === "check-in")).toBe(true);
    const seen = new Set([memberFormAlertKey("m1", "onboarding")]);
    expect(buildMemberFormTrainerAlerts([member({ id: "m1", personalGoals: goals })], seen)).toHaveLength(1);
  });
});
