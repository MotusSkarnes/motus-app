import type { CreateMemberInput, CreateMemberResult } from "../services/appRepository";
import type { Member } from "./types";

const STORAGE_PREFIX = "motus.trainerRosterBackup.";
const MAX_BACKUP_MEMBERS = 400;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

type BackupEntry = {
  savedAt: number;
  members: Member[];
};

function storageKey(trainerId: string): string {
  return `${STORAGE_PREFIX}${trainerId.trim()}`;
}

export function saveTrainerRosterBackup(trainerId: string, members: Member[]): void {
  const tid = trainerId.trim();
  if (!tid || typeof window === "undefined") return;
  const relevant = members.filter((member) => {
    const owner = String(member.ownerUserId ?? "").trim();
    if (owner === tid) return true;
    if (member.customerType === "Medlem" && member.membershipType !== "Premium") return true;
    return false;
  });
  if (!relevant.length) return;
  const payload: BackupEntry = {
    savedAt: Date.now(),
    members: relevant.slice(0, MAX_BACKUP_MEMBERS),
  };
  try {
    window.localStorage.setItem(storageKey(tid), JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

/** Kunder i lokal backup som mangler i sky — opprettes på nytt (maks 10 per kjøring). */
export async function syncMissingRosterMembersToCloud(
  trainerId: string,
  remoteMembers: Array<Pick<Member, "id" | "email">>,
  createInCloud: (member: Member, input: CreateMemberInput) => Promise<CreateMemberResult>,
): Promise<number> {
  const tid = trainerId.trim();
  if (!tid) return 0;
  const backup = loadTrainerRosterBackup(tid);
  if (!backup.length) return 0;

  const remoteIds = new Set(remoteMembers.map((m) => m.id.trim()).filter(Boolean));
  const remoteEmails = new Set(
    remoteMembers.map((m) => m.email.trim().toLowerCase()).filter((email) => email.includes("@")),
  );

  let synced = 0;
  for (const member of backup) {
    if (synced >= 10) break;
    const owner = String(member.ownerUserId ?? "").trim();
    if (owner && owner !== tid) continue;
    const email = member.email.trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (remoteIds.has(member.id.trim()) || remoteEmails.has(email)) continue;

    const result = await createInCloud(member, {
      name: member.name,
      email: member.email,
      phone: member.phone ?? "",
      goal: member.goal ?? "",
      focus: member.focus ?? "",
      membershipType: member.membershipType ?? "Standard",
      customerType: member.customerType ?? "PT-kunde",
    });
    if (result.ok) {
      synced += 1;
      remoteEmails.add(email);
      remoteIds.add(result.member.id.trim());
    }
  }
  return synced;
}

export function loadTrainerRosterBackup(trainerId: string): Member[] {
  const tid = trainerId.trim();
  if (!tid || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(tid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackupEntry;
    if (!parsed?.savedAt || !Array.isArray(parsed.members)) return [];
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return [];
    return parsed.members.filter((member) => member?.id?.trim());
  } catch {
    return [];
  }
}
