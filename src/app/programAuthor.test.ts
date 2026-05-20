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
  it("treats PT-owned row as trainer even when program_created_by is member", () => {
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "member",
      programCreatedByName: "Kari",
      ownerUserId: "pt-auth-uuid",
      ...base,
    };
    expect(resolveProgramAuthorKind(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("trainer");
    expect(programAuthorCreditForMember(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("Fra trener Kari");
    expect(memberMayDeleteProgram(program, { viewerAuthUserId: "member-auth-uuid" })).toBe(false);
  });

  it("shows Lagret av deg for member-owned programs", () => {
    const program: TrainingProgram = {
      id: "p2",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "member",
      ownerUserId: "member-auth-uuid",
      ...base,
    };
    expect(programAuthorCreditForMember(program, { viewerAuthUserId: "member-auth-uuid" })).toBe("Lagret av deg");
    expect(memberMayDeleteProgram(program, { viewerAuthUserId: "member-auth-uuid" })).toBe(true);
  });

  it("prefers trainer author when merging duplicates", () => {
    const trainer: TrainingProgram = {
      id: "new",
      memberId: "m1",
      createdAt: "02.01.2026",
      programCreatedBy: "trainer",
      programCreatedByName: "Lene",
      ownerUserId: "pt-id",
      ...base,
    };
    const member: TrainingProgram = {
      id: "old",
      memberId: "m1",
      createdAt: "01.01.2026",
      programCreatedBy: "member",
      ownerUserId: "pt-id",
      ...base,
    };
    expect(mergeProgramAuthorFields(trainer, member).programCreatedBy).toBe("trainer");
  });
});
