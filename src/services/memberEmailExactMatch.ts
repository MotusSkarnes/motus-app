/**
 * Keep only rows whose normalized email exactly equals `email`.
 * Callers that use `ilike` for case-insensitive lookup must post-filter,
 * because `_` and `%` are wildcards in SQL ILIKE and can match other members.
 */
export function normalizeMemberEmail(email: string | null | undefined): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

export function filterRowsByExactEmail<T extends { email?: string | null }>(
  rows: T[] | null | undefined,
  email: string,
): T[] {
  const normalized = normalizeMemberEmail(email);
  if (!normalized || !normalized.includes("@")) return [];
  return (rows ?? []).filter((row) => normalizeMemberEmail(row.email) === normalized);
}

/** Member ids from an `ilike("email")` result that exactly match `email`. */
export function memberIdsMatchingExactEmail(
  rows: Array<{ id?: string | null; email?: string | null }> | null | undefined,
  email: string,
): string[] {
  return filterRowsByExactEmail(rows, email)
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);
}
