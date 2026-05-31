import { describe, expect, it } from "vitest";
import { findMaxPerformedLoadFromLastExerciseSession } from "./suggestedWorkoutWeight";
import type { WorkoutLog } from "./types";

function log(partial: Partial<WorkoutLog> & Pick<WorkoutLog, "id" | "date">): WorkoutLog {
  return {
    memberId: "m1",
    programTitle: "Program",
    status: "Fullført",
    note: "",
    ...partial,
  };
}

describe("findMaxPerformedLoadFromLastExerciseSession", () => {
  it("returns highest kg from the most recent session with the exercise", () => {
    const logs: WorkoutLog[] = [
      log({
        id: "recent",
        date: "20.05.2026",
        results: [
          { exerciseName: "Benkpress", completed: true, performedWeight: "60", performedReps: "10" },
          { exerciseName: "Benkpress", completed: true, performedWeight: "80", performedReps: "6" },
          { exerciseName: "Benkpress", completed: true, performedWeight: "70", performedReps: "8" },
        ],
      }),
      log({
        id: "older",
        date: "01.12.2025",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "100", performedReps: "3" }],
      }),
    ];

    expect(findMaxPerformedLoadFromLastExerciseSession(logs, "Benkpress")).toBe("80");
  });

  it("skips sessions without completed sets for the exercise", () => {
    const logs: WorkoutLog[] = [
      log({
        id: "no-bench",
        date: "21.05.2026",
        results: [{ exerciseName: "Squat", completed: true, performedWeight: "100", performedReps: "5" }],
      }),
      log({
        id: "with-bench",
        date: "20.05.2026",
        results: [
          { exerciseName: "Benkpress", completed: false, performedWeight: "90", performedReps: "5" },
          { exerciseName: "Benkpress", completed: true, performedWeight: "65", performedReps: "8" },
        ],
      }),
    ];

    expect(findMaxPerformedLoadFromLastExerciseSession(logs, "Benkpress")).toBe("65");
  });

  it("ignores incomplete logs", () => {
    const logs: WorkoutLog[] = [
      log({
        id: "planned",
        status: "Planlagt",
        date: "22.05.2026",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "120", performedReps: "1" }],
      }),
      log({
        id: "done",
        date: "20.05.2026",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "62.5", performedReps: "8" }],
      }),
    ];

    expect(findMaxPerformedLoadFromLastExerciseSession(logs, "Benkpress")).toBe("62.5");
  });
});
