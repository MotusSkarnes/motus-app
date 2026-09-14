import { describe, expect, it } from "vitest";
import { enrichTrainingProgram } from "./programEnrichment";
import { filterMessagesForRosterMember } from "./trainerMessagesInbox";
import {
  buildGroupCopySaveNotes,
  cloneProgramExercisesForGroupCopy,
  findGroupProgramCopy,
  parseTrainingGroupTag,
  planGroupProgramSync,
  serializeTrainingGroupProgramNotes,
  snapshotTrainingProgram,
  stripTrainingGroupMarker,
} from "./trainingGroupProgram";
import { groupChatParticipants } from "./trainingGroups";
import type { ChatMessage, Member, ProgramExercise, TrainingProgram } from "./types";

function exercise(partial: Partial<ProgramExercise> & Pick<ProgramExercise, "id">): ProgramExercise {
  return {
    exerciseId: "ex-1",
    exerciseName: "Benk",
    sets: "3",
    reps: "8",
    weight: "40",
    restSeconds: "90",
    notes: "",
    ...partial,
  };
}

function program(partial: Partial<TrainingProgram> = {}): TrainingProgram {
  return {
    id: "p-master",
    memberId: "__template__",
    title: "Gruppe styrke",
    goal: "Styrke",
    notes: "Hold ryggen nøytral",
    createdAt: "01.09.2026",
    exercises: [exercise({ id: "pex-1" })],
    ...partial,
  };
}

function member(partial: Partial<Member> & Pick<Member, "id" | "name" | "email">): Member {
  return {
    isActive: true,
    invitedAt: "",
    firstLoginAt: "",
    phone: "",
    birthDate: "",
    gender: "female",
    weight: "",
    height: "",
    level: "Nybegynner",
    membershipType: "Premium",
    customerType: "PT-kunde",
    daysSinceActivity: "0",
    goal: "",
    focus: "",
    personalGoals: "",
    injuries: "",
    coachNotes: "",
    ...partial,
  };
}

describe("trainingGroupProgram", () => {
  it("parses and strips the group marker without dropping conditioning notes", () => {
    const notes = "__motusConditioningMode=logAfter\nLøpetur\n__motusTrainingGroup=g1:master-1";
    const enriched = enrichTrainingProgram(program({ notes }));
    expect(enriched.groupId).toBe("g1");
    expect(enriched.groupMasterProgramId).toBe("master-1");
    expect(enriched.conditioningDeliveryMode).toBe("logAfter");
    expect(enriched.notes).toBe("Løpetur");
    expect(serializeTrainingGroupProgramNotes(enriched)).toContain("__motusTrainingGroup=g1:master-1");
    expect(serializeTrainingGroupProgramNotes(enriched)).toContain("__motusConditioningMode=logAfter");
    expect(stripTrainingGroupMarker(notes)).toContain("Løpetur");
  });

  it("gives each member a separate program copy, not a shared row", () => {
    const master = program();
    const snapshot = snapshotTrainingProgram(master);
    const copyA = cloneProgramExercisesForGroupCopy(snapshot.exercises);
    const copyB = cloneProgramExercisesForGroupCopy(snapshot.exercises);
    expect(copyA[0]?.id).not.toBe(master.exercises[0]?.id);
    expect(copyB[0]?.id).not.toBe(copyA[0]?.id);
    const notes = buildGroupCopySaveNotes(snapshot, { groupId: "g1", masterProgramId: master.id });
    expect(parseTrainingGroupTag({ notes })).toEqual({ groupId: "g1", masterProgramId: "p-master" });
  });

  it("syncs copies only for members without an in-progress workout on that copy", () => {
    const copy = program({
      id: "copy-m1",
      memberId: "m1",
      notes: "__motusTrainingGroup=g1:p-master",
    });
    const plan = planGroupProgramSync({
      group: {
        id: "g1",
        memberIds: ["m1", "m2"],
        masterSnapshot: snapshotTrainingProgram(program()),
      },
      programs: [copy],
      inProgressProgramIds: ["copy-m1"],
    });
    expect(plan.toCreate).toEqual(["m2"]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.skippedInProgress.map((row) => row.id)).toEqual(["copy-m1"]);
    expect(findGroupProgramCopy([copy], "g1", "m1")?.id).toBe("copy-m1");
  });

  it("does not plan any copies until a master snapshot exists", () => {
    const plan = planGroupProgramSync({
      group: { id: "g1", memberIds: ["m1"], masterSnapshot: undefined },
      programs: [],
    });
    expect(plan.missingSnapshot).toBe(true);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });
});

describe("group chat isolation from 1:1 PT chat", () => {
  it("keeps trainer as a participant even with no members", () => {
    const people = groupChatParticipants({ memberIds: [] }, [], "Lene");
    expect(people).toEqual([{ role: "trainer", name: "Lene" }]);
  });

  it("does not mix group threads into 1:1 roster filtering", () => {
    const members = [member({ id: "m1", name: "Ada", email: "ada@example.com" })];
    const messages: ChatMessage[] = [
      { id: "1", memberId: "m1", sender: "trainer", text: "Hei Ada", createdAt: "2026-09-14T10:00:00.000Z" },
      { id: "2", memberId: "m2", sender: "member", text: "Skal ikke vises", createdAt: "2026-09-14T10:01:00.000Z" },
    ];
    expect(filterMessagesForRosterMember(messages, members, "m1").map((row) => row.id)).toEqual(["1"]);
  });
});
