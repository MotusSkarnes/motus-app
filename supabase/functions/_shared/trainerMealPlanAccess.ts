/** Member-owned tables whose owner_user_id must follow PT reassignment. */
export const REASSIGN_MEMBER_OWNER_TABLES = [
  "training_programs",
  "workout_logs",
  "chat_messages",
  "member_period_plans",
  "member_meal_plans",
] as const;

export type ReassignMemberOwnerTable = (typeof REASSIGN_MEMBER_OWNER_TABLES)[number];

/**
 * After email/id expansion, only keep member rows the caller can actually access.
 * Authorizing on "any one of these IDs" and then reading meal plans for the full
 * expanded set leaks other trainers' plans for duplicate-email customers.
 */
export function filterTrainerAccessibleMemberIds(
  candidateMemberIds: Iterable<string>,
  accessibleMemberIds: Iterable<string>,
): string[] {
  const accessible = new Set(
    [...accessibleMemberIds].map((id) => String(id ?? "").trim()).filter(Boolean),
  );
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidateMemberIds) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id) || !accessible.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}
