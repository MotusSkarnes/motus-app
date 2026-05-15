/** Profile sync must only group rows that share the same email — never by display name. */
export function normalizeMemberEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function memberIdsSharingEmail(
  rows: Array<{ id: string; email?: string | null }>,
  targetEmail: string,
  options?: { includeId?: string },
): string[] {
  const normalizedEmail = normalizeMemberEmail(targetEmail);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    const fallback = options?.includeId?.trim();
    return fallback ? [fallback] : [];
  }
  const ids = rows
    .filter((row) => normalizeMemberEmail(row.email) === normalizedEmail)
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);
  const includeId = options?.includeId?.trim();
  if (includeId && !ids.includes(includeId)) ids.push(includeId);
  return Array.from(new Set(ids));
}
