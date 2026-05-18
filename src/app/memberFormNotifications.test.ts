import { describe, expect, it } from "vitest";
import { detectNewMemberFormSubmissions } from "./memberFormNotifications";

const onboardingBlob = (completedAt: string) =>
  `MOTUS_PROFILE_V1:${JSON.stringify({
    onboarding: {
      version: 1,
      completedAt,
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
  })}`;

describe("detectNewMemberFormSubmissions", () => {
  it("detects first onboarding submission", () => {
    const notices = detectNewMemberFormSubmissions("", onboardingBlob("2026-05-16T12:00:00.000Z"));
    expect(notices).toEqual([{ kind: "onboarding", formKey: "2026-05-16T12-00-00-000Z" }]);
  });

  it("ignores unchanged onboarding", () => {
    const blob = onboardingBlob("2026-05-16T12:00:00.000Z");
    expect(detectNewMemberFormSubmissions(blob, blob)).toEqual([]);
  });
});
