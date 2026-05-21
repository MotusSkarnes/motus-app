import { describe, expect, it } from "vitest";
import {
  mergeMemberNotificationPreferences,
  mergeMemberNotificationPreferencesIntoPersonalGoals,
  patchMemberNotificationPreferencesInPersonalGoals,
  readMemberNotificationPreferencesFromPersonalGoals,
} from "./notificationPreferences";

describe("notificationPreferences", () => {
  it("round-trips member notification preferences in personal_goals", () => {
    const encoded = mergeMemberNotificationPreferencesIntoPersonalGoals("", {
      version: 1,
      memberAlertsSeenAt: 100,
      seenMemberProgramIds: ["p1"],
      seenMemberWorkoutCommentKeys: ["log:comment"],
      openedMemberAlertIds: ["member-msg-1"],
      seenMemberInspirationIds: ["inspiration-1"],
      seenMemberPeriodPlanKeys: [],
      dismissedMemberCheckInMonths: ["2026-05"],
      memberInspirationBaselineAt: 50,
      seenHiddenBadgeIds: ["may-17-workout"],
      lastCelebratedAchievedLevel: 3,
      updatedAt: 200,
    });
    const parsed = readMemberNotificationPreferencesFromPersonalGoals(encoded);
    expect(parsed?.openedMemberAlertIds).toEqual(["member-msg-1"]);
    expect(parsed?.seenMemberProgramIds).toEqual(["p1"]);
  });

  it("merges opened alerts from both devices", () => {
    const merged = mergeMemberNotificationPreferences(
      {
        version: 1,
        memberAlertsSeenAt: 10,
        seenMemberProgramIds: [],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: ["member-msg-1"],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: [],
        lastCelebratedAchievedLevel: 2,
        updatedAt: 100,
      },
      {
        version: 1,
        memberAlertsSeenAt: 20,
        seenMemberProgramIds: ["p2"],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: ["member-program-p2"],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: [],
        lastCelebratedAchievedLevel: 4,
        updatedAt: 300,
      },
    );
    expect(merged.openedMemberAlertIds).toEqual(expect.arrayContaining(["member-msg-1", "member-program-p2"]));
    expect(merged.seenMemberProgramIds).toEqual(["p2"]);
    expect(merged.memberAlertsSeenAt).toBe(20);
  });

  it("merges when remote snapshot lacks seenMemberPeriodPlanKeys", () => {
    const merged = mergeMemberNotificationPreferences(
      {
        version: 1,
        memberAlertsSeenAt: 0,
        seenMemberProgramIds: [],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: [],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: ["plan-a"],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: [],
        lastCelebratedAchievedLevel: 0,
        updatedAt: 100,
      },
      {
        version: 1,
        memberAlertsSeenAt: 0,
        seenMemberProgramIds: [],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: [],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: [],
        lastCelebratedAchievedLevel: 0,
        updatedAt: 200,
      } as Parameters<typeof mergeMemberNotificationPreferences>[1],
    );
    expect(merged.seenMemberPeriodPlanKeys).toEqual(["plan-a"]);
  });

  it("merges badge and celebration state across devices", () => {
    const merged = mergeMemberNotificationPreferences(
      {
        version: 1,
        memberAlertsSeenAt: 0,
        seenMemberProgramIds: [],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: [],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: ["secret-a"],
        lastCelebratedAchievedLevel: 2,
        updatedAt: 100,
      },
      {
        version: 1,
        memberAlertsSeenAt: 0,
        seenMemberProgramIds: [],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: ["member-msg-1"],
        seenMemberInspirationIds: [],
        seenMemberPeriodPlanKeys: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        seenHiddenBadgeIds: ["secret-b"],
        lastCelebratedAchievedLevel: 5,
        updatedAt: 300,
      },
    );
    expect(merged.openedMemberAlertIds).toEqual(["member-msg-1"]);
    expect(merged.seenHiddenBadgeIds).toEqual(expect.arrayContaining(["secret-a", "secret-b"]));
    expect(merged.lastCelebratedAchievedLevel).toBe(5);
  });

  it("preserves badge and celebration state when patching member notification preferences", () => {
    const existing = mergeMemberNotificationPreferencesIntoPersonalGoals("", {
      version: 1,
      memberAlertsSeenAt: 100,
      seenMemberProgramIds: [],
      seenMemberWorkoutCommentKeys: [],
      openedMemberAlertIds: [],
      seenMemberInspirationIds: [],
      seenMemberPeriodPlanKeys: [],
      dismissedMemberCheckInMonths: [],
      memberInspirationBaselineAt: 0,
      seenHiddenBadgeIds: ["secret-a"],
      lastCelebratedAchievedLevel: 4,
      updatedAt: 200,
    });

    const patched = patchMemberNotificationPreferencesInPersonalGoals(existing, {
      openedMemberAlertIds: ["member-msg-1"],
    });
    const parsed = readMemberNotificationPreferencesFromPersonalGoals(patched);

    expect(parsed?.openedMemberAlertIds).toEqual(["member-msg-1"]);
    expect(parsed?.seenHiddenBadgeIds).toEqual(["secret-a"]);
    expect(parsed?.lastCelebratedAchievedLevel).toBe(4);
  });
});
