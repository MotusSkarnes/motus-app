export function rowBelongsToOwner(row: Record<string, unknown>, ownerUserId: string): boolean {
  return String(row.owner_user_id ?? "").trim() === ownerUserId;
}

/** Cross-owner rows are only visible for shared Medlem customers; private PT-kunde programs stay owner-scoped. */
export function programRowVisibleToTrainer(
  row: Record<string, unknown>,
  ownerUserId: string,
  sharedMemberIds: Set<string>,
  ownedVisibleMemberIds: Set<string>,
): boolean {
  if (rowBelongsToOwner(row, ownerUserId)) return true;
  const memberId = String((row as { member_id?: string }).member_id ?? "").trim();
  if (!memberId || memberId === "__template__") return false;
  if (sharedMemberIds.has(memberId)) return true;
  const rowOwnerUserId = String(row.owner_user_id ?? "").trim();
  return !rowOwnerUserId && ownedVisibleMemberIds.has(memberId);
}
