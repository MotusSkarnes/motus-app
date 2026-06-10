import { buildTrainingProgramDisplayKey } from "./programBlocks";
import type { TrainingProgram } from "./types";

const STORAGE_KEY = "motus.deletedProgramTombstones.v1";
const deletedProgramIds = new Set<string>();
const deletedProgramFingerprints = new Set<string>();
let storageHydrated = false;

function tombstoneScope(program: Pick<TrainingProgram, "memberId">): string {
  return program.memberId?.trim().toLowerCase() || "__unknown_member__";
}

function scopedValue(scope: string, value: string): string {
  return `${scope}::${value}`;
}

function readStoredTombstones(): { ids: string[]; fingerprints: string[] } {
  if (typeof window === "undefined") return { ids: [], fingerprints: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ids: [], fingerprints: [] };
    const parsed = JSON.parse(raw) as Partial<{ ids: unknown; fingerprints: unknown }>;
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((value): value is string => typeof value === "string") : [],
      fingerprints: Array.isArray(parsed.fingerprints)
        ? parsed.fingerprints.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return { ids: [], fingerprints: [] };
  }
}

function persistStoredTombstones(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ids: Array.from(deletedProgramIds),
        fingerprints: Array.from(deletedProgramFingerprints),
      }),
    );
  } catch {
    // Local persistence is best-effort; in-memory tombstones still protect the current session.
  }
}

function hydrateStoredTombstones(): void {
  if (storageHydrated) return;
  storageHydrated = true;
  const stored = readStoredTombstones();
  stored.ids.forEach((id) => deletedProgramIds.add(id));
  stored.fingerprints.forEach((fingerprint) => deletedProgramFingerprints.add(fingerprint));
}

export function registerDeletedProgram(
  program: Pick<TrainingProgram, "id" | "memberId" | "title" | "goal" | "notes" | "exercises">,
  options?: { relatedMemberIds?: string[] },
): void {
  hydrateStoredTombstones();
  const fingerprint = buildTrainingProgramDisplayKey(program);
  const id = program.id?.trim();
  const scopes = new Set<string>([tombstoneScope(program)]);
  for (const relatedId of options?.relatedMemberIds ?? []) {
    const trimmed = relatedId.trim().toLowerCase();
    if (trimmed) scopes.add(trimmed);
  }
  for (const scope of scopes) {
    if (id) deletedProgramIds.add(scopedValue(scope, id));
    deletedProgramFingerprints.add(scopedValue(scope, fingerprint));
  }
  persistStoredTombstones();
}

export function unregisterDeletedProgram(programId: string): void {
  hydrateStoredTombstones();
  const id = programId.trim();
  if (id) {
    Array.from(deletedProgramIds).forEach((value) => {
      if (value === id || value.endsWith(`::${id}`)) deletedProgramIds.delete(value);
    });
    persistStoredTombstones();
  }
}

export function isProgramDeleted(program: TrainingProgram): boolean {
  hydrateStoredTombstones();
  const scope = tombstoneScope(program);
  const id = program.id?.trim();
  if (id && (deletedProgramIds.has(scopedValue(scope, id)) || deletedProgramIds.has(id))) return true;
  const fingerprint = buildTrainingProgramDisplayKey(program);
  return deletedProgramFingerprints.has(scopedValue(scope, fingerprint)) || deletedProgramFingerprints.has(fingerprint);
}

export function filterDeletedPrograms(programs: TrainingProgram[]): TrainingProgram[] {
  return programs.filter((program) => !isProgramDeleted(program));
}

function parseScopedTombstoneValue(value: string): { scope: string; payload: string } | null {
  const idx = value.indexOf("::");
  if (idx < 0) return { scope: "__unknown_member__", payload: value.trim() };
  const scope = value.slice(0, idx).trim().toLowerCase();
  const payload = value.slice(idx + 2).trim();
  if (!payload) return null;
  return { scope, payload };
}

export function listStoredDeletedProgramTombstones(): {
  scopedIds: Array<{ scope: string; programId: string }>;
  scopedFingerprints: Array<{ scope: string; fingerprint: string }>;
} {
  hydrateStoredTombstones();
  const scopedIds: Array<{ scope: string; programId: string }> = [];
  const scopedFingerprints: Array<{ scope: string; fingerprint: string }> = [];
  for (const value of deletedProgramIds) {
    const parsed = parseScopedTombstoneValue(value);
    if (parsed) scopedIds.push({ scope: parsed.scope, programId: parsed.payload });
  }
  for (const value of deletedProgramFingerprints) {
    const parsed = parseScopedTombstoneValue(value);
    if (parsed) scopedFingerprints.push({ scope: parsed.scope, fingerprint: parsed.payload });
  }
  return { scopedIds, scopedFingerprints };
}
