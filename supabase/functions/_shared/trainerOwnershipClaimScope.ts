/**
 * Scope helpers for service-role ownership claims.
 *
 * Shared Medlem roster rows are visible to every trainer. Mutating
 * `owner_user_id` on their child rows (programs/logs/chat) during hydrate or
 * restore would permanently steal another PT's data.
 */

export type MemberOwnershipRow = {
  id?: string | null;
  owner_user_id?: string | null;
  customer_type?: string | null;
};

export function isSharedMedlemCustomerType(customerType: string | null | undefined): boolean {
  return String(customerType ?? "").trim().toLowerCase() === "medlem";
}

/**
 * Null-owner backfill during trainer hydrate may only touch members owned by
 * the hydrating trainer — never shared Medlem / other-PT roster rows.
 */
export function memberIdsEligibleForNullOwnerBackfill(
  members: Array<Pick<MemberOwnershipRow, "id" | "owner_user_id">> | null | undefined,
  hydratingTrainerId: string,
): string[] {
  const trainerId = String(hydratingTrainerId ?? "").trim();
  if (!trainerId) return [];
  const seen = new Set<string>();
  for (const row of members ?? []) {
    const id = String(row.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    if (String(row.owner_user_id ?? "").trim() !== trainerId) continue;
    seen.add(id);
  }
  return Array.from(seen);
}

/**
 * "Gjenopprett og knytt til meg" may migrate child-row ownership only for
 * non-Medlem rows that the restore path actually claims. Shared Medlem rows
 * stay shared on the member table and must not have their programs/logs/chat
 * reassigned to the restoring trainer.
 */
export function memberIdsEligibleForRestoreClaimMigration(
  rows: Array<Pick<MemberOwnershipRow, "id" | "customer_type">> | null | undefined,
  options: { claimForTrainer: boolean; ownerUserId: string },
): string[] {
  if (!options.claimForTrainer) return [];
  const ownerUserId = String(options.ownerUserId ?? "").trim();
  if (!ownerUserId) return [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const id = String(row.id ?? "").trim();
    if (!id || seen.has(id)) continue;
    if (isSharedMedlemCustomerType(row.customer_type)) continue;
    seen.add(id);
  }
  return Array.from(seen);
}
