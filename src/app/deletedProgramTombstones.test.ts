import { describe, expect, it } from "vitest";
import {
  filterDeletedPrograms,
  reconcileProgramTombstonesWithRemote,
  registerDeletedProgram,
} from "./deletedProgramTombstones";
import type { TrainingProgram } from "./types";

function program(overrides: Partial<TrainingProgram> = {}): TrainingProgram {
  return {
    id: `program-${Math.random().toString(36).slice(2)}`,
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
  });

  it("clears tombstones when deleted program still exists in remote hydrate", () => {
    const deleted = program({ id: "ghost-program", memberId: "member-a" });
    registerDeletedProgram(deleted, { relatedMemberIds: ["member-a"] });
    expect(filterDeletedPrograms([deleted])).toEqual([]);

    reconcileProgramTombstonesWithRemote([deleted]);

    expect(filterDeletedPrograms([deleted])).toEqual([deleted]);
  });

  it("does not clear a member-scoped fingerprint tombstone from another member copy", () => {
    const deleted = program({ id: "local-deleted-program", memberId: "member-deleted" });
    const otherMemberCopy = program({
      ...deleted,
      id: "other-member-copy",
      memberId: "member-other",
    });
    const rehydratedDeletedCopy = program({
      ...deleted,
      id: "remote-deleted-copy",
    });

    registerDeletedProgram(deleted);
    reconcileProgramTombstonesWithRemote([otherMemberCopy]);

    expect(filterDeletedPrograms([rehydratedDeletedCopy])).toEqual([]);
  });
});
