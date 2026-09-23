import { describe, expect, it } from "vitest";
import {
  canTrainerDeleteProgram,
  isAuthorizedMemberProgramTarget,
  resolveAuthorizedDeletionMemberIds,
  resolveDeleteTrainingProgramRole,
  readTrustedAuthMemberId,
} from "./deleteTrainingProgramSecurity";

describe("deleteTrainingProgramSecurity", () => {
  it("ignores mutable user_metadata.member_id when reading trusted auth member id", () => {
    expect(
      readTrustedAuthMemberId({
        app_metadata: {},
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("");
    expect(
      readTrustedAuthMemberId({
        app_metadata: { member_id: "real-member" },
        user_metadata: { member_id: "forged-member" },
      }),
    ).toBe("real-member");
  });

  it("does not trust client requestedBy and does not default missing roles to trainer", () => {
    expect(resolveDeleteTrainingProgramRole({ app_metadata: {}, user_metadata: { role: "trainer" } })).toBe(
      "member",
    );
    expect(
      resolveDeleteTrainingProgramRole({
        email: "pt@motus-skarnes.no",
        app_metadata: {},
      }),
    ).toBe("trainer");
    expect(
      resolveDeleteTrainingProgramRole({
        email: "pt@motus-skarnes.no",
        app_metadata: { member_id: "pt-as-client" },
      }),
    ).toBe("member");
    expect(
      resolveDeleteTrainingProgramRole({
        app_metadata: { role: "trainer" },
      }),
    ).toBe("trainer");
  });

  it("rejects member deletes when only client-supplied member ids would authorize the target", () => {
    const attackerAuthorized = ["attacker-member"];
    expect(
      isAuthorizedMemberProgramTarget({
        programMemberId: "victim-member",
        authorizedMemberIds: attackerAuthorized,
      }),
    ).toBe(false);

    // Client payload pollution must not be treated as authorized scope.
    const polluted = resolveAuthorizedDeletionMemberIds({
      programMemberId: "attacker-member",
      authorizedMemberIds: attackerAuthorized,
      clientMemberIds: ["victim-member", "attacker-member"],
    });
    expect(polluted).toEqual(["attacker-member"]);
    expect(polluted).not.toContain("victim-member");
  });

  it("allows member deletes only for server-authorized same-account member ids", () => {
    expect(
      isAuthorizedMemberProgramTarget({
        programMemberId: "member-b",
        authorizedMemberIds: ["member-a", "member-b"],
      }),
    ).toBe(true);
  });

  it("requires trainer ownership or shared medlem scope", () => {
    expect(
      canTrainerDeleteProgram({
        requesterUserId: "trainer-1",
        programOwnerUserId: "",
        memberRow: { owner_user_id: "trainer-2", customer_type: "PT-kunde" },
      }),
    ).toBe(false);
    expect(
      canTrainerDeleteProgram({
        requesterUserId: "trainer-1",
        programOwnerUserId: "",
        memberRow: { owner_user_id: "trainer-1", customer_type: "PT-kunde" },
      }),
    ).toBe(true);
    expect(
      canTrainerDeleteProgram({
        requesterUserId: "trainer-1",
        programOwnerUserId: "",
        memberRow: { owner_user_id: "trainer-2", customer_type: "Medlem" },
      }),
    ).toBe(true);
  });

  it("keeps fingerprint fanout inside the authorized member scope", () => {
    expect(
      resolveAuthorizedDeletionMemberIds({
        programMemberId: "member-a",
        authorizedMemberIds: ["member-a", "member-a-dup"],
        clientMemberIds: ["member-a-dup", "unrelated"],
      }),
    ).toEqual(["member-a-dup"]);
  });
});
