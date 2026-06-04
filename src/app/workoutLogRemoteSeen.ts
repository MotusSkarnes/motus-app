const STORAGE_KEY = "motus.remoteSeenWorkoutLogIds.v1";
const seenInRemoteById = new Set<string>();
let storageHydrated = false;

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<{ ids: unknown }>;
    return Array.isArray(parsed.ids) ? parsed.ids.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function persistStoredIds(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: Array.from(seenInRemoteById) }));
  } catch {
    // Best-effort; in-memory set still protects the current session.
  }
}

function hydrateStoredIds(): void {
  if (storageHydrated) return;
  storageHydrated = true;
  readStoredIds().forEach((id) => seenInRemoteById.add(id));
}

export function markWorkoutLogsSeenInRemote(logIds: Iterable<string>): void {
  hydrateStoredIds();
  let changed = false;
  for (const rawId of logIds) {
    const id = String(rawId ?? "").trim();
    if (!id || seenInRemoteById.has(id)) continue;
    seenInRemoteById.add(id);
    changed = true;
  }
  if (changed) persistStoredIds();
}

export function markWorkoutLogSeenInRemote(logId: string): void {
  markWorkoutLogsSeenInRemote([logId]);
}

/** Log was previously fetched from sky — do not re-insert from local cache after PT/medlem slettet. */
export function wasWorkoutLogSeenInRemote(logId: string): boolean {
  hydrateStoredIds();
  const id = logId.trim();
  return id.length > 0 && seenInRemoteById.has(id);
}

/** After explicit delete in app — prevents optimistic merge from resurrecting on same device. */
export function markWorkoutLogDeletedLocally(logId: string): void {
  markWorkoutLogSeenInRemote(logId);
}
