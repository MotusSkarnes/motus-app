import type { Member } from "./types";

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

export function emailHasArchiveTombstone(
  email: string | null | undefined,
  tombstones: ReadonlySet<string>,
): boolean {
  const normalized = normalizeEmail(email);
  return normalized.includes("@") && tombstones.has(normalized);
}

export function applyArchiveTombstonesToMembers(
  members: Member[],
  tombstones: ReadonlySet<string>,
): Member[] {
  return members.map((member) =>
    emailHasArchiveTombstone(member.email, tombstones) ? { ...member, isActive: false } : member,
  );
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
