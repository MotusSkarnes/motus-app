import { describe, expect, it } from "vitest";
import {
  clearDeletedProgramTombstone,
  clearDeletedProgramTombstoneForProgram,
  filterDeletedPrograms,
  registerDeletedProgram,
} from "./deletedProgramTombstones";
import { buildTrainingProgramDisplayKey } from "./programBlocks";
import type { TrainingProgram } from "./types";

function program(overrides: Partial<TrainingProgram> = {}): TrainingProgram {
  return {
    id: "program-a",
    memberId: "member-a",
    title: "Egen styrke",
    goal: "Bygge styrke",
    notes: "",
    createdAt: "24.05.2026",
    exercises: [
      {
        id: "line-1",
        exerciseId: "e1",
        exerciseName: "Knebøy",
        sets: 3,
        reps: "8",
        weight: "40",
        restSeconds: 90,
        notes: "",
      },
    ],
    programCreatedBy: "member",
    ...overrides,
  };
}

describe("deleted program tombstones", () => {
  it("keeps member-deleted programs hidden when remote data is hydrated again", () => {
    const deleted = program({ memberId: "member-deleted" });
    const otherMemberCopy = program({
      ...deleted,
      id: "other-member-copy",
      memberId: "member-other",
    });

    registerDeletedProgram(deleted);

    expect(filterDeletedPrograms([deleted, otherMemberCopy])).toEqual([otherMemberCopy]);

    clearDeletedProgramTombstoneForProgram(deleted);
  });

  it("clears a confirmed tombstone so a newly recreated matching program is not hidden", () => {
    const deleted = program({ id: "deleted-program", memberId: "member-recreate" });
    const recreated = program({
      ...deleted,
      id: "recreated-program",
      memberId: "member-recreate",
    });

    registerDeletedProgram(deleted);

    expect(filterDeletedPrograms([recreated])).toEqual([]);

    clearDeletedProgramTombstoneForProgram(deleted);

    expect(filterDeletedPrograms([recreated])).toEqual([recreated]);
  });

  it("clears fingerprint tombstones only for the confirmed member scope", () => {
    const memberA = program({ id: "deleted-a", memberId: "member-a" });
    const memberB = program({ ...memberA, id: "deleted-b", memberId: "member-b" });
    const memberARecreated = program({ ...memberA, id: "recreated-a" });
    const memberBRecreated = program({ ...memberB, id: "recreated-b" });

    registerDeletedProgram(memberA);
    registerDeletedProgram(memberB);
    clearDeletedProgramTombstone({
      scope: "member-a",
      fingerprint: buildTrainingProgramDisplayKey(memberA),
    });

    expect(filterDeletedPrograms([memberARecreated, memberBRecreated])).toEqual([memberARecreated]);

    clearDeletedProgramTombstoneForProgram(memberA);
    clearDeletedProgramTombstoneForProgram(memberB);
  });
});
