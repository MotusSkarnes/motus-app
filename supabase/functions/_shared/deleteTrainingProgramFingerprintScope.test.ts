import { describe, expect, it } from "vitest";
import {
  isLinkedFingerprintDeleteCandidate,
  memberIdsMatchingExactEmail,
} from "./deleteTrainingProgramFingerprintScope";

describe("isLinkedFingerprintDeleteCandidate", () => {
  it("does not delete another client's assigned copy of the same trainer template", () => {
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "trainer",
        programMemberId: "kari",
        candidateMemberId: "ola",
        relatedMemberIds: ["kari", "kari-alias"],
      }),
    ).toBe(false);
  });

  it("still deletes the selected member and same-email alias copies", () => {
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "trainer",
        programMemberId: "kari",
        candidateMemberId: "kari",
        relatedMemberIds: ["kari", "kari-alias"],
      }),
    ).toBe(true);
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "trainer",
        programMemberId: "kari",
        candidateMemberId: "kari-alias",
        relatedMemberIds: ["kari", "kari-alias"],
      }),
    ).toBe(true);
  });

  it("does not delete assigned member programs when the trainer deletes the template", () => {
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "trainer",
        programMemberId: "__template__",
        candidateMemberId: "kari",
        relatedMemberIds: ["trainer-auth-id"],
      }),
    ).toBe(false);
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "trainer",
        programMemberId: "__template__",
        candidateMemberId: "__template__",
        relatedMemberIds: ["trainer-auth-id"],
      }),
    ).toBe(true);
  });

  it("keeps member deletes on member-created programs in the authorized set", () => {
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "member",
        programMemberId: "member-a",
        candidateMemberId: "member-a",
        candidateCreatedBy: "member",
        relatedMemberIds: ["member-a"],
      }),
    ).toBe(true);
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "member",
        programMemberId: "member-a",
        candidateMemberId: "member-b",
        candidateCreatedBy: "member",
        relatedMemberIds: ["member-a"],
      }),
    ).toBe(false);
    expect(
      isLinkedFingerprintDeleteCandidate({
        role: "member",
        programMemberId: "member-a",
        candidateMemberId: "member-a",
        candidateCreatedBy: "trainer",
        relatedMemberIds: ["member-a"],
      }),
    ).toBe(false);
  });
});

describe("memberIdsMatchingExactEmail", () => {
  it("does not treat SQL LIKE wildcards in emails as matches", () => {
    expect(
      memberIdsMatchingExactEmail(
        [
          { id: "kari-underscore", email: "kari_svendsen@x.com" },
          { id: "kari-dot", email: "kari.svendsen@x.com" },
        ],
        "kari_svendsen@x.com",
      ),
    ).toEqual(["kari-underscore"]);
  });
});
