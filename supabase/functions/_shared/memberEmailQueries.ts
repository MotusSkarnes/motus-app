export function normalizeMemberEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** PostgREST `.or()` filter for case-insensitive e-posttreff uten full tabellskanning. */
export function buildMemberEmailIlikeOrFilter(emails: Iterable<string>): string | null {
  const unique = Array.from(
    new Set(
      [...emails]
        .map((value) => normalizeMemberEmail(value))
        .filter((value) => value && value.includes("@")),
    ),
  );
  if (!unique.length) return null;
  return unique.map((email) => `email.ilike.${email}`).join(",");
}
