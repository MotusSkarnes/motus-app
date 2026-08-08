import { normalizeMemberEmail } from "./memberEmailQueries.ts";

/**
 * Keep only rows whose normalized email exactly equals `email`.
 * Callers that use `ilike` for case-insensitive lookup must post-filter,
 * because `_` and `%` are wildcards in SQL ILIKE and can match other members.
 */
export function filterRowsByExactEmail<T extends { email?: string | null }>(
  rows: T[] | null | undefined,
  email: string,
): T[] {
  const normalized = normalizeMemberEmail(email);
  if (!normalized || !normalized.includes("@")) return [];
  return (rows ?? []).filter((row) => normalizeMemberEmail(row.email) === normalized);
}
