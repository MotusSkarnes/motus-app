import { describe, expect, it } from "vitest";
import {
  isProgramStubExercise,
  localExercisesMissingFromRemote,
  localExercisesSafeToInsertInRemoteBank,
  mergeExerciseBanks,
  shouldPushLocalExercisesToCloud,
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

  it("treats locally retained bank rows as missing when remote omitted them", () => {
    const remote = [ex({ id: "e1", name: "Knebøy" })];
    const local = [ex({ id: "e1", name: "Knebøy" }), ex({ id: "e-deleted", name: "Gammel øvelse" })];
    expect(localExercisesMissingFromRemote(local, remote).map((row) => row.id)).toEqual(["e-deleted"]);
  });

  it("does not treat the whole local catalog as insertable when remote is empty", () => {
    const local = [ex({ id: "e1", name: "Knebøy" }), ex({ id: "ex_local", name: "Ny lokal" })];
    expect(localExercisesSafeToInsertInRemoteBank(local, [])).toEqual([]);
    expect(localExercisesMissingFromRemote(local, []).map((row) => row.id).sort()).toEqual(["e1", "ex_local"]);
  });

  it("only lets trainers push against a non-empty remote bank", () => {
    const remote = [ex({ id: "e1", name: "Knebøy" })];
    expect(shouldPushLocalExercisesToCloud(remote, { isTrainerSession: true })).toBe(true);
    expect(shouldPushLocalExercisesToCloud(remote, { isTrainerSession: false })).toBe(false);
    expect(shouldPushLocalExercisesToCloud([], { isTrainerSession: true })).toBe(false);
    expect(shouldPushLocalExercisesToCloud(null, { isTrainerSession: true })).toBe(false);
  });
});
