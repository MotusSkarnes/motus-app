import type { Exercise } from "./types";

/** Program-auto stubs should not be treated as trainer bank entries. */
export function isProgramStubExercise(exercise: Exercise): boolean {
  return exercise.group.trim().toLowerCase() === "fra program";
}

/**
 * Merge remote exercise bank with local. Remote wins on id collision.
 * Local-only custom exercises (not program stubs) are kept so a failed
 * cloud write on another device doesn't permanently drop them from this PC,
 * and so they can be pushed up on the next sync.
 */
export function mergeExerciseBanks(remote: Exercise[], local: Exercise[]): Exercise[] {
  const byId = new Map<string, Exercise>();

  for (const exercise of remote) {
    const id = exercise.id.trim();
    if (!id) continue;
    byId.set(id, exercise);
  }

  for (const exercise of local) {
    const id = exercise.id.trim();
    if (!id) continue;
    if (byId.has(id)) continue;
    if (isProgramStubExercise(exercise)) continue;
    if (!exercise.name.trim()) continue;
    byId.set(id, exercise);
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), "nb", { sensitivity: "base" }),
  );
}

/** Local customs missing from remote — candidates to upsert to exercise_bank. */
export function localExercisesMissingFromRemote(local: Exercise[], remote: Exercise[]): Exercise[] {
  const remoteIds = new Set(remote.map((exercise) => exercise.id.trim()).filter(Boolean));
  return local.filter((exercise) => {
    const id = exercise.id.trim();
    if (!id || remoteIds.has(id)) return false;
    if (isProgramStubExercise(exercise)) return false;
    if (!exercise.name.trim()) return false;
    return true;
  });
}
