import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "./data";
import { loadState } from "./storage";

describe("loadState program exercise normalization", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("normalizes sparse localStorage program exercises so trim-heavy open paths stay safe", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        programs: [
          {
            id: "helkropp",
            memberId: "m1",
            title: "Helkropp",
            goal: "",
            notes: "",
            createdAt: "2026-05-21",
            exercises: [
              {
                id: "prog-ex-diag",
                exerciseId: "ex-oat0pr0",
                exerciseName: "Diagonal hev",
                sets: "3",
                reps: "10",
                // weight/rest/notes intentionally omitted (legacy corrupt cache)
              },
            ],
          },
        ],
        members: [],
        exercises: [],
        logs: [],
        messages: [],
        role: "member",
      }),
    );

    const state = loadState();
    const exercise = state.programs[0]?.exercises[0];
    expect(exercise).toBeTruthy();
    expect(exercise?.weight).toBe("");
    expect(exercise?.restSeconds).toBe("");
    expect(exercise?.notes).toBe("");
    expect(exercise?.weight.trim()).toBe("");
    expect(exercise?.notes.trim()).toBe("");
  });
});
