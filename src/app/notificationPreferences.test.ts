import { describe, expect, it } from "vitest";
import {
  mergeMemberNotificationPreferences,
  mergeMemberNotificationPreferencesIntoPersonalGoals,
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
      dismissedMemberCheckInMonths: ["2026-05"],
      memberInspirationBaselineAt: 50,
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
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        updatedAt: 100,
      },
      {
        version: 1,
        memberAlertsSeenAt: 20,
        seenMemberProgramIds: ["p2"],
        seenMemberWorkoutCommentKeys: [],
        openedMemberAlertIds: ["member-program-p2"],
        seenMemberInspirationIds: [],
        dismissedMemberCheckInMonths: [],
        memberInspirationBaselineAt: 0,
        updatedAt: 300,
      },
    );
    expect(merged.openedMemberAlertIds).toEqual(expect.arrayContaining(["member-msg-1", "member-program-p2"]));
    expect(merged.seenMemberProgramIds).toEqual(["p2"]);
    expect(merged.memberAlertsSeenAt).toBe(20);
  });
});
