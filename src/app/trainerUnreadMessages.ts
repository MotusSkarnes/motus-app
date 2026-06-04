import type { Member } from "./types";

export function memberIdentityKey(member: Pick<Member, "id" | "email">): string {
  const emailKey = member.email.trim().toLowerCase();
  return emailKey || `id:${member.id}`;
}

/** Map alert memberId (kan avvike fra roster-id) til e-post/id-nøkkel for visning på kundekort. */
export function buildUnreadMessagesByIdentityKey(
  members: Member[],
  unreadByMemberId: Record<string, number>,
): Map<string, number> {
  const counts = new Map<string, number>();
  Object.entries(unreadByMemberId).forEach(([rawMemberId, rawCount]) => {
    const count = Math.max(0, Number(rawCount) || 0);
    if (!count) return;
    const normalizedRaw = rawMemberId.trim();
    const relatedMembers = members.filter(
      (member) =>
        member.id === normalizedRaw ||
        member.email.trim().toLowerCase() === normalizedRaw.toLowerCase(),
    );
    const anchor = relatedMembers[0];
    const key = anchor
      ? memberIdentityKey(anchor)
      : normalizedRaw.includes("@")
        ? normalizedRaw.toLowerCase()
        : `id:${normalizedRaw}`;
    counts.set(key, (counts.get(key) ?? 0) + count);
  });
  return counts;
}

export function unreadCountForMember(
  member: Member,
  unreadByIdentityKey: Map<string, number>,
): number {
  return unreadByIdentityKey.get(memberIdentityKey(member)) ?? 0;
}
