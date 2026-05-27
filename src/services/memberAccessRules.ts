import type { Member } from "../app/types";

export const MEMBER_ARCHIVED_APP_MESSAGE =
  "Kundekontoen er arkivert. Kontakt din PT for å gjenåpne tilgang til appen.";

export function memberRecordIsActive(member: { isActive?: boolean | null }): boolean {
  return member.isActive !== false;
}

/** True when the email has roster row(s) and every matching row is archived/inactive. */
export function isMemberAppAccessBlocked(
  members: Array<{ email?: string | null; isActive?: boolean | null }>,
  email: string,
): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  const rows = members.filter((member) => member.email?.trim().toLowerCase() === normalized);
  if (!rows.length) return false;
  return !rows.some(memberRecordIsActive);
}

/** Shared roster row — visible to every PT in hydrate-trainer-data. */
export function isSharedMedlemCustomerType(customerType: string | undefined | null): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

export function isSharedMedlemRosterMember(member: {
  customerType?: string | null;
  membershipType?: string | null;
}): boolean {
  return (
    isSharedMedlemCustomerType(member.customerType) &&
    String(member.membershipType ?? "").trim().toLowerCase() !== "premium"
  );
}

/** PT-kunde / Premium / Oppfølging — only the owning PT sees the row in their client list. */
export function isPrivatePtRosterCustomerType(
  customerType: string | undefined | null,
  membershipType?: string | undefined | null,
): boolean {
  return !isSharedMedlemRosterMember({ customerType, membershipType });
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
/** Which duplicate row should supply profile fields on the kundekort (goal, phone, …). */
export function scoreMemberProfileSource(member: {
  customerType?: string | null;
  membershipType?: string | null;
  ownerUserId?: string | null;
  isActive?: boolean | null;
  invitedAt?: string | null;
}, currentTrainerOwnerUserId: string): number {
  const isOwned = String(member.ownerUserId ?? "").trim() === currentTrainerOwnerUserId.trim();
  const isShared = isSharedMedlemRosterMember(member);
  let score = 0;
  if (isOwned && !isShared) score += 5000;
  if (isOwned && String(member.membershipType ?? "").trim() === "Premium") score += 3000;
  if (isShared) score += 500;
  if (member.isActive !== false) score += 100;
  if (member.invitedAt) score += 10;
  if (member.customerType === "PT-kunde") score += 2500;
  if (member.membershipType === "Premium") score += 800;
  return score;
}

/** Slå sammen kundetype/medlemskap på tvers av duplikat-rader (samme e-post). */
export function mergeRosterFieldsFromMemberCandidates(
  candidates: Array<Pick<Member, "customerType" | "membershipType" | "ownerUserId" | "nutritionAccess">>,
  currentTrainerOwnerUserId = "",
): Pick<Member, "customerType" | "membershipType" | "ownerUserId" | "nutritionAccess"> {
  if (!candidates.length) {
    return { customerType: "Medlem", membershipType: "Standard", ownerUserId: undefined, nutritionAccess: false };
  }
  const trainerId = currentTrainerOwnerUserId.trim();
  const sorted = [...candidates].sort(
    (a, b) => scoreMemberProfileSource(b, trainerId) - scoreMemberProfileSource(a, trainerId),
  );
  const best = sorted[0]!;
  let customerType = best.customerType;
  if (candidates.some((row) => row.customerType === "PT-kunde")) customerType = "PT-kunde";
  else if (candidates.some((row) => row.customerType === "Oppfølging")) customerType = "Oppfølging";
  else if (candidates.some((row) => row.customerType === "Egentrening")) customerType = "Egentrening";

  const membershipType = candidates.some((row) => row.membershipType === "Premium") ? "Premium" : best.membershipType;
  const ownedPrivate = sorted.find(
    (row) =>
      isPrivatePtRosterCustomerType(row.customerType, row.membershipType) &&
      (!trainerId || String(row.ownerUserId ?? "").trim() === trainerId),
  );
  const ptOwnedByTrainer = candidates.find(
    (row) =>
      row.customerType === "PT-kunde" &&
      (!trainerId || String(row.ownerUserId ?? "").trim() === trainerId),
  );
  const ptAny = candidates.find((row) => row.customerType === "PT-kunde");
  let ownerUserId =
    ptOwnedByTrainer?.ownerUserId ??
    ownedPrivate?.ownerUserId ??
    ptAny?.ownerUserId ??
    best.ownerUserId;
  if (
    isPrivatePtRosterCustomerType(customerType, membershipType) &&
    trainerId &&
    !String(ownerUserId ?? "").trim()
  ) {
    ownerUserId = trainerId;
  }
  const nutritionAccess = candidates.some((row) => row.nutritionAccess === true);
  return { customerType, membershipType, ownerUserId, nutritionAccess };
}

export function isMemberIdentityVisibleToTrainer(
  member: Pick<Member, "id" | "email" | "customerType" | "membershipType" | "ownerUserId" | "isActive">,
  allMembers: Array<Pick<Member, "id" | "email" | "customerType" | "membershipType" | "ownerUserId" | "isActive">>,
  trainerId: string,
  options?: { includeInactive?: boolean; programMemberIds?: ReadonlySet<string> },
): boolean {
  const tid = trainerId.trim();
  const email = member.email.trim().toLowerCase();
  const group = email.includes("@")
    ? allMembers.filter((row) => row.email.trim().toLowerCase() === email)
    : allMembers.filter((row) => row.id === member.id);
  const rows = group.length ? group : [member];
  const activeRows = options?.includeInactive ? rows : rows.filter((row) => row.isActive !== false);
  if (!activeRows.length) return false;

  if (activeRows.some((row) => isSharedMedlemRosterMember(row))) return true;
  if (!tid) return true;

  const linkedIds = options?.programMemberIds;
  return activeRows.some((row) => {
    if (!options?.includeInactive && row.isActive === false) return false;
    if (isSharedMedlemRosterMember(row)) return true;
    if (!isPrivatePtRosterCustomerType(row.customerType, row.membershipType)) return false;
    const owner = String(row.ownerUserId ?? "").trim();
    if (owner === tid) return true;
    if (linkedIds?.has(row.id)) return true;
    return false;
  });
}

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
  const ids = new Set(owned.map((row) => String(row.id ?? "").trim()).filter(Boolean));
  const selectedId = options.selectedMemberId.trim();
  if (selectedId) ids.add(selectedId);
  if (isPrivatePtRosterCustomerType(options.nextCustomerType)) {
    byEmail.forEach((row) => {
      if (isSharedMedlemCustomerType(row.customerType)) {
        const id = String(row.id ?? "").trim();
        if (id) ids.add(id);
      }
    });
  }
  return Array.from(ids.size ? ids : [options.selectedMemberId]);
}
