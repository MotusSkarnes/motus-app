/** Scope linked fingerprint deletes so one client's assigned copy cannot wipe others. */

export function normalizeProgramMemberId(value: unknown): string {
  return String(value ?? "").trim();
}

export function isLinkedFingerprintDeleteCandidate(input: {
  role: "member" | "trainer";
  programMemberId: string;
  candidateMemberId: string;
  candidateCreatedBy?: string;
  relatedMemberIds: Iterable<string>;
}): boolean {
  const programMemberId = normalizeProgramMemberId(input.programMemberId);
  const candidateMemberId = normalizeProgramMemberId(input.candidateMemberId);
  const relatedMemberIds = new Set(
    [...input.relatedMemberIds].map((id) => normalizeProgramMemberId(id)).filter(Boolean),
  );

  if (input.role === "member") {
    return (
      String(input.candidateCreatedBy ?? "").trim() === "member" &&
      relatedMemberIds.has(candidateMemberId)
    );
  }

  // Templates share title/exercises with every assigned copy. Never fan out onto members.
  if (programMemberId === "__template__") {
    return candidateMemberId === "__template__";
  }

  if (candidateMemberId && candidateMemberId === programMemberId) return true;
  return Boolean(candidateMemberId && relatedMemberIds.has(candidateMemberId));
}

export function memberIdsMatchingExactEmail(
  rows: Array<{ id?: unknown; email?: unknown }>,
  email: string,
): string[] {
  const expected = String(email ?? "").trim().toLowerCase();
  if (!expected || !expected.includes("@")) return [];
  const ids: string[] = [];
  for (const row of rows) {
    if (String(row.email ?? "").trim().toLowerCase() !== expected) continue;
    const id = normalizeProgramMemberId(row.id);
    if (id && id !== "__template__") ids.push(id);
  }
  return ids;
}
