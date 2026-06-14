import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTrainingProgramDisplayKey } from "../app/programBlocks";
import type { ProgramExercise } from "../app/types";
import { deleteProgramRemote, deleteProgramsByDisplayKeyRemote } from "./supabaseRepository";

const mockSupabase = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { column: string; value: unknown };
  type InFilter = { column: string; values: unknown[] };

  const state = {
    trainingRows: [] as Row[],
    deletedProgramIds: [] as string[],
    logDeletes: [] as Array<Record<string, unknown>>,
    invoke: vi.fn(),
  };

  function rowsMatching(rows: Row[], filters: Filter[], inFilters: InFilter[]): Row[] {
    return rows.filter((row) => {
      const eqMatch = filters.every((filter) => row[filter.column] === filter.value);
      const inMatch = inFilters.every((filter) => filter.values.includes(row[filter.column]));
      return eqMatch && inMatch;
    });
  }

  function createQuery(table: string) {
    let operation = "";
    const filters: Filter[] = [];
    const inFilters: InFilter[] = [];

    function execute() {
      if (table === "training_programs" && operation === "select") {
        return { data: rowsMatching(state.trainingRows, filters, inFilters), error: null };
      }
      if (table === "training_programs" && operation === "delete") {
        const idFilter = inFilters.find((filter) => filter.column === "id");
        state.deletedProgramIds = (idFilter?.values ?? []).map((value) => String(value));
        return { error: null };
      }
      if (table === "workout_logs" && operation === "delete") {
        state.logDeletes.push(Object.fromEntries(filters.map((filter) => [filter.column, filter.value])));
        return { error: null };
      }
      return { data: null, error: null };
    }

    const query = {
      select: vi.fn(() => {
        operation = "select";
        return query;
      }),
      delete: vi.fn(() => {
        operation = "delete";
        return query;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ column, value });
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        inFilters.push({ column, values });
        return query;
      }),
      maybeSingle: vi.fn(async () => {
        operation = "select";
        const [row = null] = rowsMatching(state.trainingRows, filters, inFilters);
        return { data: row, error: null };
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(execute()).then(resolve, reject),
    };

    return query;
  }

  return {
    ...state,
    from: vi.fn((table: string) => createQuery(table)),
  };
});

vi.mock("./supabaseClient", () => ({
  configuredSupabaseAnonKey: "anon",
  configuredSupabaseProjectRef: "project",
  configuredSupabaseUrl: "https://example.supabase.co",
  isSupabaseConfigured: true,
  supabaseClient: {
    from: mockSupabase.from,
    functions: {
      invoke: mockSupabase.invoke,
    },
  },
}));

const sharedExercise: ProgramExercise = {
  id: "line-1",
  exerciseId: "exercise-1",
  exerciseName: "Knebøy",
  sets: "3",
  reps: "8",
  weight: "40",
  restSeconds: "90",
  notes: "",
};

function sharedProgramRow(id: string, memberId: string) {
  return {
    id,
    member_id: memberId,
    owner_user_id: "trainer-1",
    program_created_by: "trainer",
    title: "Shared Strength",
    goal: "Build strength",
    notes: "",
    exercises: [sharedExercise],
    created_at: "2026-06-14T10:00:00.000Z",
  };
}

function sharedDisplayKey() {
  return buildTrainingProgramDisplayKey({
    title: "Shared Strength",
    goal: "Build strength",
    notes: "",
    exercises: [sharedExercise],
  });
}

describe("Supabase program delete scoping", () => {
  beforeEach(() => {
    mockSupabase.trainingRows = [sharedProgramRow("program-a", "member-a"), sharedProgramRow("program-b", "member-b")];
    mockSupabase.deletedProgramIds = [];
    mockSupabase.logDeletes = [];
    mockSupabase.from.mockClear();
    mockSupabase.invoke.mockReset();
    mockSupabase.invoke.mockResolvedValue({ data: null, error: { message: "force direct fallback" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("replays display-key tombstones only for the stored member scope", async () => {
    await deleteProgramsByDisplayKeyRemote(sharedDisplayKey(), {
      requestedBy: "trainer",
      memberScope: "member-a",
      memberIds: ["member-a", "member-b"],
    });

    expect(mockSupabase.deletedProgramIds).toEqual(["program-a"]);
    expect(mockSupabase.logDeletes).toEqual([{ member_id: "member-a", program_title: "Shared Strength" }]);
  });

  it("keeps owner-matched linked deletes inside the requested member ids", async () => {
    await deleteProgramRemote("program-a", {
      requestedBy: "trainer",
      memberIds: ["member-a"],
    });

    expect(mockSupabase.deletedProgramIds).toEqual(["program-a"]);
    expect(mockSupabase.logDeletes).toEqual([{ member_id: "member-a", program_title: "Shared Strength" }]);
  });
});
