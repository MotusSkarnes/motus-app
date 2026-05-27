/**
 * Lokal "tombstone" for arkiverte medlemmer. Trener-arkivering oppdaterer lokal state
 * umiddelbart, men hvis Edge Function `archive-member` ikke kjorer eller hydration
 * skjer rett etterpa, har vi sett at mergeTwoMemberSnapshots tilbakestiller arkivet
 * (siden den foretrekker isActive=true ved konflikt). Tombstone-listen er en lokal
 * sikkerhetslinje som tvinger isActive=false for arkiverte e-poster, til arkivet
 * eksplisitt blir reversert via Aktiver-igjen.
 */

const STORAGE_KEY = "motus.archivedMemberEmails";
export const MEMBER_ARCHIVE_TOMBSTONE_EVENT = "motus:archive-tombstone-changed";

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((entry) => normalizeEmail(typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.includes("@")),
    );
  } catch {
    return new Set();
  }
}

function writeSet(values: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(values)));
  } catch {
    // ignore quota issues
  }
  try {
    window.dispatchEvent(new CustomEvent(MEMBER_ARCHIVE_TOMBSTONE_EVENT));
  } catch {
    // ignore
  }
}

export function getArchiveTombstones(): Set<string> {
  return readSet();
}

export function hasArchiveTombstone(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return false;
  return readSet().has(normalized);
}

export function addArchiveTombstone(email: string | null | undefined): void {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return;
  const set = readSet();
  if (set.has(normalized)) return;
  set.add(normalized);
  writeSet(set);
}

export function removeArchiveTombstone(email: string | null | undefined): void {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return;
  const set = readSet();
  if (!set.delete(normalized)) return;
  writeSet(set);
}

export function clearArchiveTombstones(): void {
  writeSet(new Set());
}

/** Fjern tombstone når sky sier at kunden er aktiv igjen (unngår «forsvunnet i listen» etter SQL/gjenoppretting). */
export function reconcileArchiveTombstonesWithRemoteMembers(
  members: Array<{ email?: string | null; isActive?: boolean | null }>,
): void {
  const activeEmails = new Set<string>();
  for (const member of members) {
    if (member.isActive === false) continue;
    const email = normalizeEmail(member.email);
    if (email.includes("@")) activeEmails.add(email);
  }
  if (!activeEmails.size) return;
  const tombstones = readSet();
  let changed = false;
  for (const email of activeEmails) {
    if (tombstones.delete(email)) changed = true;
  }
  if (changed) writeSet(tombstones);
}
