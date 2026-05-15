import type { Member } from "../app/types";

/** Shared roster row — visible to every PT in hydrate-trainer-data. */
export function isSharedMedlemCustomerType(customerType: string | undefined | null): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

/** PT-kunde / Premium / Oppfølging — only the owning PT sees the row in their client list. */
export function isPrivatePtRosterCustomerType(customerType: string | undefined | null): boolean {
  return !isSharedMedlemCustomerType(customerType);
}

export function resolveOwnerUserIdForPersist(options: {
  customerType: Member["customerType"];
  sessionOwnerId: string;
  existingOwnerId?: string | null;
}): string {
  const sessionOwnerId = String(options.sessionOwnerId ?? "").trim();
  const existing = String(options.existingOwnerId ?? "").trim();
  if (!sessionOwnerId) return existing;
  if (isSharedMedlemCustomerType(options.customerType)) {
    return existing || sessionOwnerId;
  }
  return sessionOwnerId;
}

/** Which member row ids a trainer may include when saving roster/type changes. */
export function filterMemberIdsForRosterSave(options: {
  memberRows: Array<{ id: string; email?: string | null; ownerUserId?: string | null; customerType?: string | null }>;
  previousEmail: string;
  nextCustomerType: Member["customerType"];
  currentTrainerOwnerUserId: string;
  selectedMemberId: string;
  selectedOwnerUserId: string;
}): string[] {
  const previousEmail = options.previousEmail.trim().toLowerCase();
  const trainerId = options.currentTrainerOwnerUserId.trim();
  const selectedOwner = options.selectedOwnerUserId.trim();
  const byEmail = options.memberRows.filter((row) => {
    const email = String(row.email ?? "").trim().toLowerCase();
    return Boolean(previousEmail && email === previousEmail);
  });
  if (!byEmail.length) return [options.selectedMemberId];

  if (isSharedMedlemCustomerType(options.nextCustomerType)) {
    return Array.from(new Set(byEmail.map((row) => String(row.id ?? "").trim()).filter(Boolean)));
  }

  const owned = byEmail.filter((row) => {
    const owner = String(row.ownerUserId ?? "").trim();
    if (!owner && trainerId) return true;
    if (trainerId && owner === trainerId) return true;
    if (selectedOwner && owner === selectedOwner) return true;
    return false;
  });
  const ids = owned.map((row) => String(row.id ?? "").trim()).filter(Boolean);
  return Array.from(new Set(ids.length ? ids : [options.selectedMemberId]));
}
