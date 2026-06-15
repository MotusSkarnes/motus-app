import { describe, expect, it } from "vitest";
import type { AppState } from "../app/types";
import {
  addWorkoutExerciseToWorkoutInState,
  appendWorkoutSetForProgramExerciseInState,
  canRemoveLastExtraWorkoutSet,
  countExtraWorkoutSets,
  removeLastWorkoutSetForProgramExerciseInState,
  resolveWorkoutBaselineSetCount,
  deferWorkoutExerciseGroupInState,
  finishWorkoutModeInState,
  logCompletedPlanEntryInState,
  removeCompletedPlanEntryLogInState,
  deleteWorkoutLogInState,
  removeWorkoutLogResultInState,
  replaceWorkoutExerciseGroupInState,
  setWorkoutLogResultsInState,
  updateActivityWorkoutInState,
  updateWorkoutLogDateInState,
  startCustomWorkoutInState,
  ensureWorkoutModeSessionMetadata,
  startWorkoutModeInState,
} from "./appRepository";

function createBaseState(): AppState {
  return {
    workoutMode: null,
    workoutCelebration: null,
    members: [],
    exercises: [],
    programs: [
      {
        id: "program-1",
        memberId: "member-1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "24.04.2026",
        exercises: [],
      },
    ],
    logs: [],
    messages: [],
    currentUser: null,
    role: "trainer",
    selectedMemberId: "member-1",
    memberViewId: "member-1",
  };
}

describe("appRepository workout log guards", () => {
  it("appends an extra set with incremented setNumber for a program exercise", () => {
    const state = createBaseState();
    state.programs = [
      {
        id: "program-1",
        memberId: "member-1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "24.04.2026",
        exercises: [{ id: "pex-1", exerciseId: "ex-1", exerciseName: "Benk", sets: "2", reps: "8", weight: "50", restSeconds: "90", notes: "" }],
      },
    ];
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-1-set-1",
          programExerciseId: "pex-1",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "8",
          completed: false,
        },
        {
          exerciseId: "pex-1-set-2",
          programExerciseId: "pex-1",
          setNumber: 2,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "52",
          performedReps: "8",
          completed: true,
        },
      ],
    };
    const next = appendWorkoutSetForProgramExerciseInState(state, "pex-1");
    expect(next.workoutMode?.results).toHaveLength(3);
    const appended = next.workoutMode?.results[2];
    expect(appended?.setNumber).toBe(3);
    expect(appended?.exerciseId).toBe("pex-1-set-3");
    expect(appended?.completed).toBe(false);
    expect(appended?.addedDuringWorkout).toBe(true);
  });

  it("reconcile session metadata replaces stale frozen plan from program", () => {
    const state = createBaseState();
    state.programs = [
      {
        id: "program-1",
        memberId: "member-1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "24.04.2026",
        exercises: [
          { id: "pex-1", exerciseId: "ex-1", exerciseName: "Benk", sets: "3", reps: "10", weight: "5", restSeconds: "90", notes: "" },
        ],
      },
    ];
    state.workoutMode = {
      programId: "program-1",
      note: "",
      baselineSetCountByProgramExerciseId: { "pex-1": 4 },
      frozenPlanLabelByProgramExerciseId: { "pex-1": "4×10 reps · 5 kg · 90s" },
      results: [
        {
          exerciseId: "pex-1-set-1",
          programExerciseId: "pex-1",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "3",
          plannedReps: "10",
          plannedWeight: "5",
          performedWeight: "5",
          performedReps: "10",
          completed: false,
        },
        {
          exerciseId: "pex-1-set-2",
          programExerciseId: "pex-1",
          setNumber: 2,
          exerciseName: "Benk",
          plannedSets: "3",
          plannedReps: "10",
          plannedWeight: "5",
          performedWeight: "5",
          performedReps: "10",
          completed: false,
        },
        {
          exerciseId: "pex-1-set-3",
          programExerciseId: "pex-1",
          setNumber: 3,
          exerciseName: "Benk",
          plannedSets: "3",
          plannedReps: "10",
          plannedWeight: "5",
          performedWeight: "5",
          performedReps: "10",
          completed: false,
        },
        {
          exerciseId: "pex-1-set-4",
          programExerciseId: "pex-1",
          setNumber: 4,
          exerciseName: "Benk",
          plannedSets: "3",
          plannedReps: "10",
          plannedWeight: "5",
          addedDuringWorkout: true,
          performedWeight: "5",
          performedReps: "10",
          completed: false,
        },
      ],
    };
    const next = ensureWorkoutModeSessionMetadata(state.workoutMode!, state.programs[0]!, []);
    expect(next.baselineSetCountByProgramExerciseId?.["pex-1"]).toBe(3);
    expect(next.frozenPlanLabelByProgramExerciseId?.["pex-1"]).toContain("3×10");
    expect(countExtraWorkoutSets("pex-1", next.results, next, state.programs[0])).toBe(1);
  });

  it("freezes plan label at start and keeps set count after append", () => {
    const state = createBaseState();
    state.programs = [
      {
        id: "program-1",
        memberId: "member-1",
        title: "Styrke A",
        goal: "",
        notes: "",
        createdAt: "24.04.2026",
        exercises: [
          { id: "pex-1", exerciseId: "ex-1", exerciseName: "Benk", sets: "3", reps: "10", weight: "5", restSeconds: "90", notes: "" },
        ],
      },
    ];
    const started = startWorkoutModeInState(state, "program-1");
    expect(started.workoutMode?.results).toHaveLength(3);
    const frozen = started.workoutMode?.frozenPlanLabelByProgramExerciseId?.["pex-1"] ?? "";
    expect(frozen).toContain("3×10");
    const appended = appendWorkoutSetForProgramExerciseInState(started, "pex-1");
    expect(appended.workoutMode?.results).toHaveLength(4);
    expect(appended.workoutMode?.planDisplayByGroupId?.["pex-1"]).toContain("3×10");
    expect(appended.workoutMode?.planDisplayByGroupId?.["pex-1"]).toBe(
      started.workoutMode?.planDisplayByGroupId?.["pex-1"],
    );
    expect(countExtraWorkoutSets("pex-1", appended.workoutMode!.results, appended.workoutMode, state.programs[0])).toBe(1);
  });

  it("adds an exercise to the active workout session only", () => {
    const state = createBaseState();
    state.exercises = [
      { id: "ex-row", name: "Sittende roing", category: "Styrke", group: "Rygg", equipment: "Kabel", level: "Nybegynner", description: "" },
    ];
    const started = startWorkoutModeInState(state, "program-1");

    const next = addWorkoutExerciseToWorkoutInState(started, { exerciseId: "ex-row", scope: "session" });

    expect(next.workoutMode?.results.some((row) => row.exerciseName === "Sittende roing")).toBe(true);
    expect(next.programs[0]?.exercises.some((exercise) => exercise.exerciseName === "Sittende roing")).toBe(false);
  });

  it("adds an exercise to the active workout and program permanently", () => {
    const state = createBaseState();
    state.exercises = [
      { id: "ex-row", name: "Sittende roing", category: "Styrke", group: "Rygg", equipment: "Kabel", level: "Nybegynner", description: "" },
    ];
    const started = startWorkoutModeInState(state, "program-1");

    const next = addWorkoutExerciseToWorkoutInState(started, { exerciseId: "ex-row", scope: "program" });

    expect(next.workoutMode?.results.some((row) => row.exerciseName === "Sittende roing")).toBe(true);
    expect(next.programs[0]?.exercises.some((exercise) => exercise.exerciseName === "Sittende roing")).toBe(true);
  });

  it("removes last extra set beyond program plan", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "",
      baselineSetCountByProgramExerciseId: { "pex-1": 2 },
      results: [
        {
          exerciseId: "pex-1-set-1",
          programExerciseId: "pex-1",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "8",
          completed: true,
        },
        {
          exerciseId: "pex-1-set-2",
          programExerciseId: "pex-1",
          setNumber: 2,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "52",
          performedReps: "8",
          completed: true,
        },
        {
          exerciseId: "pex-1-set-3",
          programExerciseId: "pex-1",
          setNumber: 3,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          addedDuringWorkout: true,
          performedWeight: "",
          performedReps: "",
          completed: false,
        },
      ],
    };
    expect(canRemoveLastExtraWorkoutSet(state.workoutMode!.results, { baselineSetCount: 2 })).toBe(true);
    const next = removeLastWorkoutSetForProgramExerciseInState(state, "pex-1");
    expect(next.workoutMode?.results).toHaveLength(2);
    expect(next.workoutMode?.results.every((r) => r.programExerciseId === "pex-1")).toBe(true);
  });

  it("does not remove set when count matches program plan", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-1-set-1",
          programExerciseId: "pex-1",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "8",
          completed: false,
        },
        {
          exerciseId: "pex-1-set-2",
          programExerciseId: "pex-1",
          setNumber: 2,
          exerciseName: "Benk",
          plannedSets: "2",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "52",
          performedReps: "8",
          completed: false,
        },
      ],
    };
    expect(canRemoveLastExtraWorkoutSet(state.workoutMode!.results, { baselineSetCount: 2 })).toBe(false);
    const next = removeLastWorkoutSetForProgramExerciseInState(state, "pex-1");
    expect(next.workoutMode?.results).toHaveLength(2);
  });

  it("resolveWorkoutBaselineSetCount prefers program sets over row plannedSets", () => {
    const rows = [
      {
        exerciseId: "pex-1-set-1",
        programExerciseId: "pex-1",
        setNumber: 1,
        exerciseName: "Benk",
        plannedSets: "4",
        plannedReps: "10",
        plannedWeight: "5",
        performedWeight: "5",
        performedReps: "10",
        completed: false,
      },
      {
        exerciseId: "pex-1-set-2",
        programExerciseId: "pex-1",
        setNumber: 2,
        exerciseName: "Benk",
        plannedSets: "4",
        plannedReps: "10",
        plannedWeight: "5",
        addedDuringWorkout: true,
        performedWeight: "",
        performedReps: "",
        completed: false,
      },
    ];
    const program = {
      id: "p1",
      memberId: "m1",
      title: "T",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "pex-1",
          exerciseId: "ex-1",
          exerciseName: "Benk",
          sets: "3",
          reps: "10",
          weight: "5",
          restSeconds: "90",
          notes: "",
        },
      ],
    };
    expect(resolveWorkoutBaselineSetCount("pex-1", rows, null, program)).toBe(3);
    expect(canRemoveLastExtraWorkoutSet(rows, { baselineSetCount: 3 })).toBe(true);
  });

  it("resolveWorkoutBaselineSetCount uses minimum of stored, program, and row plannedSets", () => {
    const rows = [
      {
        exerciseId: "pex-1-set-1",
        programExerciseId: "pex-1",
        setNumber: 1,
        exerciseName: "Benk",
        plannedSets: "4",
        plannedReps: "10",
        plannedWeight: "5",
        performedWeight: "5",
        performedReps: "10",
        completed: false,
      },
      {
        exerciseId: "pex-1-set-2",
        programExerciseId: "pex-1",
        setNumber: 2,
        exerciseName: "Benk",
        plannedSets: "4",
        plannedReps: "10",
        plannedWeight: "5",
        addedDuringWorkout: true,
        performedWeight: "",
        performedReps: "",
        completed: false,
      },
    ];
    const program = {
      id: "p1",
      memberId: "m1",
      title: "T",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: [
        {
          id: "pex-1",
          exerciseId: "ex-1",
          exerciseName: "Benk",
          sets: "3",
          reps: "10",
          weight: "5",
          restSeconds: "90",
          notes: "",
        },
      ],
    };
    const workoutMode = {
      programId: "p1",
      note: "",
      baselineSetCountByProgramExerciseId: { "pex-1": 4 },
      results: rows,
    };
    expect(resolveWorkoutBaselineSetCount("pex-1", rows, workoutMode, program)).toBe(3);
  });

  it("allows remove when last row is marked addedDuringWorkout even if plannedSets matches row count", () => {
    const rows = [
      {
        exerciseId: "pex-1-set-1",
        programExerciseId: "pex-1",
        setNumber: 1,
        exerciseName: "Benk",
        plannedSets: "2",
        plannedReps: "8",
        plannedWeight: "50",
        performedWeight: "50",
        performedReps: "8",
        completed: false,
      },
      {
        exerciseId: "pex-1-set-2",
        programExerciseId: "pex-1",
        setNumber: 2,
        exerciseName: "Benk",
        plannedSets: "2",
        plannedReps: "8",
        plannedWeight: "50",
        addedDuringWorkout: true,
        performedWeight: "",
        performedReps: "",
        completed: false,
      },
    ];
    expect(canRemoveLastExtraWorkoutSet(rows, { baselineSetCount: 2 })).toBe(true);
  });

  it("defers current exercise to come right after the next one", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-a-set-1",
          programExerciseId: "pex-a",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "1",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "8",
          completed: false,
        },
        {
          exerciseId: "pex-b-set-1",
          programExerciseId: "pex-b",
          setNumber: 1,
          exerciseName: "Roing",
          plannedSets: "1",
          plannedReps: "10",
          plannedWeight: "0",
          performedWeight: "0",
          performedReps: "10",
          completed: false,
        },
        {
          exerciseId: "pex-c-set-1",
          programExerciseId: "pex-c",
          setNumber: 1,
          exerciseName: "Squat",
          plannedSets: "1",
          plannedReps: "6",
          plannedWeight: "80",
          performedWeight: "80",
          performedReps: "6",
          completed: false,
        },
      ],
    };

    const next = deferWorkoutExerciseGroupInState(state, "pex-a");
    const groupOrder: string[] = [];
    const seen = new Set<string>();
    (next.workoutMode?.results ?? []).forEach((row) => {
      const id = row.programExerciseId ?? row.exerciseId;
      if (seen.has(id)) return;
      seen.add(id);
      groupOrder.push(id);
    });
    expect(groupOrder).toEqual(["pex-b", "pex-a", "pex-c"]);
  });

  it("resets swapped strength exercise weight to 0 when member has no history for the replacement", () => {
    const state = createBaseState();
    state.exercises = [
      { id: "ex-bench", name: "Benkpress", category: "Styrke", group: "Bryst", level: "Nybegynner", description: "", imageUrl: "" },
      { id: "ex-row", name: "Sittende roing", category: "Styrke", group: "Rygg", level: "Nybegynner", description: "", imageUrl: "" },
    ];
    state.logs = [
      {
        id: "other-member-log",
        memberId: "member-2",
        programTitle: "Styrke A",
        date: "02.06.2026",
        status: "Fullført",
        note: "",
        results: [{ exerciseName: "Sittende roing", completed: true, performedWeight: "90", performedReps: "5" }],
      },
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "01.06.2026",
        status: "Fullført",
        note: "",
        results: [{ exerciseName: "Benkpress", completed: true, performedWeight: "60", performedReps: "8" }],
      },
    ];
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-a-set-1",
          programExerciseId: "pex-a",
          setNumber: 1,
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: false,
        },
      ],
    };

    const next = replaceWorkoutExerciseGroupInState(state, {
      programExerciseId: "pex-a",
      nextExerciseName: "Sittende roing",
    });

    expect(next.workoutMode?.results[0]?.exerciseName).toBe("Sittende roing");
    expect(next.workoutMode?.results[0]?.plannedWeight).toBe("0");
    expect(next.workoutMode?.results[0]?.performedWeight).toBe("0");
  });

  it("uses replacement exercise history when swapping to a strength exercise member has done before", () => {
    const state = createBaseState();
    state.exercises = [
      { id: "ex-bench", name: "Benkpress", category: "Styrke", group: "Bryst", level: "Nybegynner", description: "", imageUrl: "" },
      { id: "ex-row", name: "Sittende roing", category: "Styrke", group: "Rygg", level: "Nybegynner", description: "", imageUrl: "" },
    ];
    state.logs = [
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "01.06.2026",
        status: "Fullført",
        note: "",
        results: [
          { exerciseName: "Sittende roing", completed: true, performedWeight: "37.5", performedReps: "10" },
          { exerciseName: "Sittende roing", completed: true, performedWeight: "40", performedReps: "8" },
        ],
      },
    ];
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-a-set-1",
          programExerciseId: "pex-a",
          setNumber: 1,
          exerciseName: "Benkpress",
          plannedSets: "1",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: false,
        },
      ],
    };

    const next = replaceWorkoutExerciseGroupInState(state, {
      programExerciseId: "pex-a",
      nextExerciseName: "Sittende roing",
    });

    expect(next.workoutMode?.results[0]?.plannedWeight).toBe("40");
    expect(next.workoutMode?.results[0]?.performedWeight).toBe("40");
  });

  it("keeps an already-deferred exercise as next when deferring another exercise", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "",
      results: [
        {
          exerciseId: "pex-a-set-1",
          programExerciseId: "pex-a",
          setNumber: 1,
          exerciseName: "Benk",
          plannedSets: "1",
          plannedReps: "8",
          plannedWeight: "50",
          performedWeight: "50",
          performedReps: "8",
          completed: false,
        },
        {
          exerciseId: "pex-b-set-1",
          programExerciseId: "pex-b",
          setNumber: 1,
          exerciseName: "Roing",
          plannedSets: "1",
          plannedReps: "10",
          plannedWeight: "0",
          performedWeight: "0",
          performedReps: "10",
          completed: false,
        },
        {
          exerciseId: "pex-c-set-1",
          programExerciseId: "pex-c",
          setNumber: 1,
          exerciseName: "Squat",
          plannedSets: "1",
          plannedReps: "6",
          plannedWeight: "80",
          performedWeight: "80",
          performedReps: "6",
          completed: false,
        },
      ],
    };

    const afterDeferA = deferWorkoutExerciseGroupInState(state, "pex-a");
    const afterDeferB = deferWorkoutExerciseGroupInState(afterDeferA, "pex-b");

    const groupOrder: string[] = [];
    const seen = new Set<string>();
    (afterDeferB.workoutMode?.results ?? []).forEach((row) => {
      const id = row.programExerciseId ?? row.exerciseId;
      if (seen.has(id)) return;
      seen.add(id);
      groupOrder.push(id);
    });
    expect(groupOrder).toEqual(["pex-a", "pex-b", "pex-c"]);
  });

  it("deduplicates duplicate set rows when finishing workout", () => {
    const state = createBaseState();
    state.workoutMode = {
      programId: "program-1",
      note: "Bra økt",
      results: [
        {
          exerciseId: "prog-ex-1-set-1",
          programExerciseId: "prog-ex-1",
          setNumber: 1,
          exerciseName: "Knebøy",
          plannedSets: "3",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: true,
        },
        {
          exerciseId: "prog-ex-1-set-1-duplicate",
          programExerciseId: "prog-ex-1",
          setNumber: 1,
          exerciseName: "Knebøy",
          plannedSets: "3",
          plannedReps: "8",
          plannedWeight: "60",
          performedWeight: "60",
          performedReps: "8",
          completed: true,
        },
      ],
    };

    const next = finishWorkoutModeInState(state);
    expect(next.logs).toHaveLength(1);
    expect(next.logs[0].results).toHaveLength(1);
  });

  it("uses memberId override when PT starts live workout for selected customer", () => {
    const state = createBaseState();
    const started = startWorkoutModeInState(state, "program-1", { memberId: "member-canonical" });
    expect(started.workoutMode?.memberId).toBe("member-canonical");
  });

  it("saves finished live workout on selected customer, not program template memberId", () => {
    const state = createBaseState();
    state.programs[0] = {
      ...state.programs[0],
      memberId: "member-program-owner",
      exercises: [{ id: "pex-1", exerciseId: "ex-1", exerciseName: "Benk", sets: "1", reps: "8", weight: "50", restSeconds: "90", notes: "" }],
    };
    const started = startWorkoutModeInState(state, "program-1", { memberId: "member-canonical" });
    const withResult = {
      ...started,
      workoutMode: {
        ...started.workoutMode!,
        results: [
          {
            exerciseId: "pex-1-set-1",
            programExerciseId: "pex-1",
            setNumber: 1,
            exerciseName: "Benk",
            plannedSets: "1",
            plannedReps: "8",
            plannedWeight: "50",
            performedWeight: "50",
            performedReps: "8",
            completed: true,
          },
        ],
      },
    };
    const next = finishWorkoutModeInState(withResult);
    expect(next.logs[0]?.memberId).toBe("member-canonical");
  });

  it("logs a custom workout even if its temporary program is gone before finish", () => {
    const state = createBaseState();
    const started = startCustomWorkoutInState(state, {
      memberId: "member-1",
      exercises: [
        {
          id: "custom-ex-1",
          exerciseId: "ex-1",
          exerciseName: "Knebøy",
          sets: "2",
          reps: "8",
          weight: "60",
          restSeconds: "60",
          notes: "",
        },
      ],
    });
    expect(started.workoutMode?.memberId).toBe("member-1");
    expect(started.workoutMode?.programTitle).toBe("Egen økt");

    const hydratedWithoutEphemeral = {
      ...started,
      programs: started.programs.filter((program) => !program.ephemeral),
    };
    const next = finishWorkoutModeInState(hydratedWithoutEphemeral);

    expect(next.workoutMode).toBeNull();
    expect(next.logs[0]).toMatchObject({
      memberId: "member-1",
      programTitle: "Egen økt",
      status: "Fullført",
    });
    expect(next.logs[0].results).toHaveLength(2);
  });

  it("removes a single logged exercise from an existing log", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "24.04.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "set-1",
            programExerciseId: "prog-ex-1",
            setNumber: 1,
            exerciseName: "Knebøy",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "8",
            completed: true,
          },
          {
            exerciseId: "set-2",
            programExerciseId: "prog-ex-1",
            setNumber: 2,
            exerciseName: "Knebøy",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "60",
            performedWeight: "62.5",
            performedReps: "6",
            completed: true,
          },
        ],
      },
    ];

    const next = removeWorkoutLogResultInState(state, { logId: "log-1", exerciseId: "set-2" });
    expect(next.logs[0].results).toHaveLength(1);
    expect(next.logs[0].results?.[0].exerciseId).toBe("set-1");
  });

  it("updates logged exercise values in an existing log", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "24.04.2026",
        status: "Fullført",
        note: "",
        results: [
          {
            exerciseId: "set-1",
            programExerciseId: "prog-ex-1",
            setNumber: 1,
            exerciseName: "Knebøy",
            plannedSets: "3",
            plannedReps: "8",
            plannedWeight: "60",
            performedWeight: "60",
            performedReps: "8",
            completed: true,
          },
        ],
      },
    ];

    const next = setWorkoutLogResultsInState(state, {
      logId: "log-1",
      results: [
        {
          ...state.logs[0].results![0],
          performedWeight: "65",
          performedReps: "6",
        },
      ],
    });
    expect(next.logs[0].results?.[0].performedWeight).toBe("65");
    expect(next.logs[0].results?.[0].performedReps).toBe("6");
  });

  it("updates workout log date by id while keeping the original time", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-date",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "24.04.2026 kl 18:35",
        status: "FullfÃ¸rt",
        note: "",
        results: [],
      },
    ];

    const next = updateWorkoutLogDateInState(state, { logId: "log-date", date: "2026-05-02" });
    expect(next.logs[0]?.date).toBe("02.05.2026 kl 18:35");
  });

  it("removes completed plan logs when stored date format differs from input", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-plan",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "2026-05-10",
        status: "Fullført",
        note: "Registrert som gjennomført fra periodeplan.",
        results: [],
      },
    ];
    const next = removeCompletedPlanEntryLogInState(state, {
      memberId: "member-1",
      programTitle: "Styrke A",
      date: "10.05.2026",
    });
    expect(next.logs).toHaveLength(0);
  });

  it("stores completed plan entry dates in dd.mm.yyyy", () => {
    const state = createBaseState();
    const next = logCompletedPlanEntryInState(state, {
      memberId: "member-1",
      programTitle: "Styrke A",
      date: "2026-05-10",
      note: "Test",
    });
    expect(next.logs[0]?.date).toBe("10.05.2026");
  });

  it("updates activity workout logs by id", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-activity",
        memberId: "member-1",
        programTitle: "Aktivitet: Turgåing",
        date: "02.06.2026",
        status: "Fullført",
        note: "Fin tur",
        activityDurationMinutes: "30",
        reflection: { energyLevel: 3, difficultyLevel: 2, motivationLevel: 4, note: "Fin tur" },
        results: [],
      },
    ];
    const next = updateActivityWorkoutInState(state, {
      logId: "log-activity",
      activityName: "Sykling",
      durationMinutes: "55",
      note: "Lang tur",
      reflection: { energyLevel: 2, difficultyLevel: 3, motivationLevel: 3, note: "Lang tur" },
    });
    expect(next.logs[0]?.programTitle).toBe("Aktivitet: Sykling");
    expect(next.logs[0]?.activityDurationMinutes).toBe("55");
    expect(next.logs[0]?.note).toBe("Lang tur");
  });

  it("deletes workout log by id", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-delete",
        memberId: "member-1",
        programTitle: "Aktivitet: Test",
        date: "02.06.2026",
        status: "Fullført",
        results: [],
      },
    ];
    const next = deleteWorkoutLogInState(state, { logId: "log-delete" });
    expect(next.logs).toHaveLength(0);
  });
});
