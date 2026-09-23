export function normalizeMemberEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function uniqueNormalizedEmails(emails: Iterable<string>): string[] {
  return Array.from(
    new Set(
      [...emails]
        .map((value) => normalizeMemberEmail(value))
        .filter((value) => value && value.includes("@")),
    ),
  );
}

/** PostgREST `.or()` filter for case-insensitive e-posttreff uten full tabellskanning. */
export function buildMemberEmailIlikeOrFilter(emails: Iterable<string>): string | null {
  const unique = uniqueNormalizedEmails(emails);
  if (!unique.length) return null;
  return unique.map((email) => `email.ilike.${email}`).join(",");
}

/**
 * `.ilike("email", value)` treats `_` and `%` as SQL wildcards, so
 * `kari_svendsen@x.com` also matches `kari.svendsen@x.com`. Always keep only
 * rows whose stored email equals one of the requested addresses.
 */
export function filterMemberRowsByExactEmails<T extends { email?: unknown }>(
  rows: T[] | null | undefined,
  emails: Iterable<string>,
): T[] {
  const allowed = new Set(uniqueNormalizedEmails(emails));
  if (!allowed.size) return [];
  return (rows ?? []).filter((row) => allowed.has(normalizeMemberEmail(row.email)));
}
