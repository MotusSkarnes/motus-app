import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  edgeInvoke: vi.fn(),
  from: vi.fn(),
  fromCalls: [] as string[],
  deletedProgramIds: [] as string[],
}));

vi.mock("./supabaseClient", () => ({
  supabaseClient: {
    functions: {
      invoke: mocks.edgeInvoke,
    },
    from: mocks.from,
  },
}));

import { deleteProgramRemote } from "./supabaseRepository";

describe("deleteProgramRemote", () => {
  beforeEach(() => {
    mocks.edgeInvoke.mockReset();
    mocks.from.mockReset();
    mocks.fromCalls.length = 0;
    mocks.deletedProgramIds.length = 0;
  });

  it("does not delete workout logs by title when deleting a program", async () => {
    const targetProgram = {
      id: "program-a",
      member_id: "member-1",
      title: "Styrke",
      goal: "A",
      notes: "",
      exercises: [],
      owner_user_id: "trainer-1",
      program_created_by: "trainer",
    };

    mocks.edgeInvoke.mockResolvedValue({ data: null, error: { message: "edge unavailable" } });
    mocks.from.mockImplementation((table: string) => {
      mocks.fromCalls.push(table);
      if (table === "workout_logs") {
        throw new Error("program deletion must not cascade workout_logs by program_title");
      }
      if (table === "members") {
        return {
          select: (columns: string) => ({
            eq: (column: string, value: string) => {
              if (columns !== "email" || column !== "id" || value !== "member-1") {
                throw new Error(`Unexpected member lookup ${columns} ${column}=${value}`);
              }
              return {
                maybeSingle: async () => ({ data: { email: "member@example.com" }, error: null }),
              };
            },
            ilike: async (column: string, value: string) => {
              if (columns !== "id" || column !== "email" || value !== "member@example.com") {
                throw new Error(`Unexpected member email lookup ${columns} ${column}=${value}`);
              }
              return { data: [{ id: "member-1" }], error: null };
            },
          }),
        };
      }
      if (table !== "training_programs") {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: (column: string, value: string) => {
            if (column !== "id" || value !== "program-a") {
              throw new Error(`Unexpected lookup ${column}=${value}`);
            }
            return {
              maybeSingle: async () => ({ data: targetProgram, error: null }),
            };
          },
          in: async (column: string) => {
            if (column !== "member_id") throw new Error(`Unexpected candidate column ${column}`);
            return { data: [targetProgram], error: null };
          },
        }),
        delete: () => ({
          in: async (column: string, ids: string[]) => {
            if (column !== "id") throw new Error(`Unexpected delete column ${column}`);
            mocks.deletedProgramIds.push(...ids);
            return { error: null };
          },
        }),
      };
    });

    await expect(deleteProgramRemote("program-a", { requestedBy: "trainer" })).resolves.toBe(true);

    expect(mocks.deletedProgramIds).toEqual(["program-a"]);
    expect(mocks.fromCalls).not.toContain("workout_logs");
  });
});
