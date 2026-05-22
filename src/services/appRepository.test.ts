import { describe, expect, it, vi } from "vitest";
import type { AppState } from "../app/types";
import {
  appendWorkoutSetForProgramExerciseInState,
  deferWorkoutExerciseGroupInState,
  deleteProgramInState,
  finishWorkoutModeInState,
  logCompletedPlanEntryInState,
  removeCompletedPlanEntryLogInState,
  removeWorkoutLogResultInState,
  setWorkoutLogResultsInState,
  startCustomWorkoutInState,
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
  it("keeps historical workout logs when deleting a program", () => {
    const state = createBaseState();
    state.logs = [
      {
        id: "log-1",
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "24.04.2026",
        status: "Fullført",
        note: "",
        results: [],
      },
    ];

    const next = deleteProgramInState(state, "program-1");

    expect(next.programs).toHaveLength(0);
    expect(next.logs).toEqual(state.logs);
  });

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

  it("stores completed plan entry dates with the current clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 14, 35, 0));
    const state = createBaseState();
    try {
      const next = logCompletedPlanEntryInState(state, {
        memberId: "member-1",
        programTitle: "Styrke A",
        date: "2026-05-10",
        note: "Test",
      });
      expect(next.logs[0]?.date).toBe("10.05.2026 kl 14:35");
    } finally {
      vi.useRealTimers();
    }
  });
});
