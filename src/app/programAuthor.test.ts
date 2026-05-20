import { describe, expect, it } from "vitest";
import {
  memberMayDeleteProgram,
  mergeProgramAuthorFields,
  programAuthorCreditForMember,
  resolveProgramAuthorKind,
} from "./programAuthor";
import type { TrainingProgram } from "./types";

const base: Omit<TrainingProgram, "id" | "memberId" | "createdAt"> = {
  title: "Test",
  goal: "",
  notes: "",
  exercises: [],
};

describe("programAuthor", () => {
  it("trusts program_created_by member even when owner_user_id is PT", () => {
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "member",
      programCreatedByName: "Kari",
      ownerUserId: "pt-auth-uuid",
      ...base,
    };
    expect(resolveProgramAuthorKind(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("member");
    expect(programAuthorCreditForMember(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("Lagret av deg");
    expect(memberMayDeleteProgram(program, { viewerAuthUserId: "member-auth-uuid" })).toBe(true);
  });

  it("shows Fra trener when program_created_by is trainer", () => {
    const program: TrainingProgram = {
      id: "p2",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "trainer",
      programCreatedByName: "Lene",
      ownerUserId: "pt-auth-uuid",
      ...base,
    };
    expect(programAuthorCreditForMember(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("Fra trener Lene");
    expect(memberMayDeleteProgram(program)).toBe(false);
  });

  it("merge keeps member author on newer row", () => {
    const member: TrainingProgram = {
      id: "new",
      memberId: "m1",
      createdAt: "02.01.2026",
      programCreatedBy: "member",
      programCreatedByName: "Kari",
      ownerUserId: "pt-id",
      ...base,
    };
    const trainer: TrainingProgram = {
      id: "old",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "trainer",
      programCreatedByName: "Lene",
      ownerUserId: "pt-id",
      ...base,
    };
    expect(mergeProgramAuthorFields(member, trainer).programCreatedBy).toBe("member");
  });
});
