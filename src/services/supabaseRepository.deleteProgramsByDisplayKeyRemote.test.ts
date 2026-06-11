import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTrainingProgramDisplayKey } from "../app/programBlocks";
import type { ProgramExercise } from "../app/types";
import { deleteProgramsByDisplayKeyRemote } from "./supabaseRepository";

type ProgramRow = {
  id: string;
  member_id: string;
  title: string;
  goal: string;
  notes: string;
  exercises: ProgramExercise[];
  created_at: string;
  owner_user_id: string;
  program_created_by: string;
};

const mockSupabase = vi.hoisted(() => ({
  programRows: [] as ProgramRow[],
  scopedLookupValues: [] as string[][],
  deletedProgramIds: [] as string[],
  deletedLogFilters: [] as Array<Record<string, string>>,
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  configuredSupabaseUrl: "",
  configuredSupabaseAnonKey: "",
  configuredSupabaseProjectRef: "",
  supabaseClient: {
    from(table: string) {
      if (table === "training_programs") {
        return {
          select() {
            return {
              in(column: string, values: string[]) {
                if (column === "member_id") {
                  mockSupabase.scopedLookupValues.push([...values]);
                  return Promise.resolve({
                    data: mockSupabase.programRows.filter((row) => values.includes(row.member_id)),
                    error: null,
                  });
                }
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
          delete() {
            return {
              in(_column: string, values: string[]) {
                mockSupabase.deletedProgramIds.push(...values);
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }
      if (table === "workout_logs") {
        return {
          delete() {
            const filters: Record<string, string> = {};
            return {
              eq(column: string, value: string) {
                filters[column] = value;
                return {
                  eq(nextColumn: string, nextValue: string) {
                    filters[nextColumn] = nextValue;
                    mockSupabase.deletedLogFilters.push({ ...filters });
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  },
}));

function exercise(): ProgramExercise {
  return {
    id: "line-1",
    exerciseId: "exercise-1",
    exerciseName: "Knebøy",
    sets: "3",
    reps: "8",
    weight: "60",
    restSeconds: "90",
    notes: "",
  };
}

function programRow(memberId: string): ProgramRow {
  return {
    id: `program-${memberId}`,
    member_id: memberId,
    title: "Styrke",
    goal: "Bygge styrke",
    notes: "",
    exercises: [exercise()],
    created_at: "2026-06-11T00:00:00.000Z",
    owner_user_id: "trainer-1",
    program_created_by: "trainer",
  };
}

describe("deleteProgramsByDisplayKeyRemote", () => {
  beforeEach(() => {
    mockSupabase.programRows = ["member-a", "member-b", "member-c"].map(programRow);
    mockSupabase.scopedLookupValues = [];
    mockSupabase.deletedProgramIds = [];
    mockSupabase.deletedLogFilters = [];
  });

  it("limits scoped tombstone cleanup to the tombstone member", async () => {
    const targetKey = buildTrainingProgramDisplayKey({
      title: "Styrke",
      goal: "Bygge styrke",
      notes: "",
      exercises: [exercise()],
    });

    await expect(
      deleteProgramsByDisplayKeyRemote(targetKey, {
        requestedBy: "trainer",
        memberScope: "member-a",
        memberIds: ["member-a", "member-b", "member-c"],
      }),
    ).resolves.toBe(true);

    expect(mockSupabase.scopedLookupValues).toEqual([["member-a"]]);
    expect(mockSupabase.deletedProgramIds).toEqual(["program-member-a"]);
    expect(mockSupabase.deletedLogFilters).toEqual([{ member_id: "member-a", program_title: "Styrke" }]);
  });
});
