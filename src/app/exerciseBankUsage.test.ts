import { describe, expect, it } from "vitest";
import {
  buildDeleteExerciseFromBankDialogCopy,
  findProgramsUsingBankExercise,
  programExerciseUsesBankExercise,
} from "./exerciseBankUsage";
import type { Exercise, Member, TrainingProgram } from "./types";

const exercise: Exercise = {
  id: "e-bench",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

describe("programExerciseUsesBankExercise", () => {
  it("matches by exercise id", () => {
    expect(
      programExerciseUsesBankExercise(
        { id: "p1", exerciseId: "e-bench", exerciseName: "Benk", sets: "3", reps: "5", weight: "60", restSeconds: "90", notes: "" },
        exercise,
      ),
    ).toBe(true);
  });

  it("matches by exercise name when id differs", () => {
    expect(
      programExerciseUsesBankExercise(
        { id: "p2", exerciseId: "legacy-id", exerciseName: "Benkpress", sets: "3", reps: "5", weight: "60", restSeconds: "90", notes: "" },
        exercise,
      ),
    ).toBe(true);
  });
});

describe("findProgramsUsingBankExercise", () => {
  const members: Member[] = [
    {
      id: "m1",
      name: "Emma",
      email: "emma@test.no",
      isActive: true,
      invitedAt: "",
      phone: "",
      birthDate: "",
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
    },
  ];

  const programs: TrainingProgram[] = [
    {
      id: "prog-1",
      memberId: "m1",
      title: "Styrke A",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "x1",
          exerciseId: "legacy-id",
          exerciseName: "Benkpress",
          sets: "3",
          reps: "8",
          weight: "50",
          restSeconds: "90",
          notes: "",
        },
      ],
    },
  ];

  it("finds programs by name match", () => {
    expect(findProgramsUsingBankExercise(programs, members, exercise)).toEqual([
      {
        programId: "prog-1",
        programTitle: "Styrke A",
        memberId: "m1",
        memberName: "Emma",
      },
    ]);
  });

  it("builds warning copy listing programs", () => {
    const usages = findProgramsUsingBankExercise(programs, members, exercise);
    const copy = buildDeleteExerciseFromBankDialogCopy("Benkpress", usages);
    expect(copy.title).toContain("treningsprogram");
    expect(copy.message).toContain("Styrke A");
    expect(copy.message).toContain("Emma");
    expect(copy.confirmLabel).toBe("Fjern likevel");
  });
});
