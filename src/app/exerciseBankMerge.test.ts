import { describe, expect, it } from "vitest";
import {
  isProgramStubExercise,
  localExercisesMissingFromRemote,
  mergeExerciseBanks,
} from "./exerciseBankMerge";
import type { Exercise } from "./types";

function ex(partial: Partial<Exercise> & Pick<Exercise, "id" | "name">): Exercise {
  return {
    category: "Styrke",
    group: "Bein",
    equipment: "Stang",
    level: "Nybegynner",
    description: "",
    ...partial,
  };
}

describe("exerciseBankMerge", () => {
  it("keeps local-only customs when merging with remote", () => {
    const remote = [ex({ id: "e1", name: "Knebøy" })];
    const local = [ex({ id: "e1", name: "Knebøy (gammel)" }), ex({ id: "ex_local", name: "Ny lokal" })];
    const merged = mergeExerciseBanks(remote, local);
    expect(merged.map((row) => row.id).sort()).toEqual(["e1", "ex_local"]);
    expect(merged.find((row) => row.id === "e1")?.name).toBe("Knebøy");
  });

  it("drops program stubs that only exist locally", () => {
    const remote = [ex({ id: "e1", name: "Knebøy" })];
    const local = [ex({ id: "stub", name: "Fra program øvelse", group: "Fra program" })];
    expect(mergeExerciseBanks(remote, local)).toHaveLength(1);
    expect(isProgramStubExercise(local[0]!)).toBe(true);
  });

  it("lists local customs missing from remote for cloud push", () => {
    const remote = [ex({ id: "e1", name: "Knebøy" })];
    const local = [
      ex({ id: "e1", name: "Knebøy" }),
      ex({ id: "ex_a", name: "Custom A" }),
      ex({ id: "stub", name: "Stub", group: "Fra program" }),
    ];
    expect(localExercisesMissingFromRemote(local, remote).map((row) => row.id)).toEqual(["ex_a"]);
  });
});
