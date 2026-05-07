import type { ChatMessage, Member } from "./types";

/** Parses createdAt from ISO or Norwegian dd.mm.yyyy format used locally. */
export function parseChatMessageCreatedAtMs(value: string): number {
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.getTime();
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+kl\s+(\d{2}):(\d{2}))?$/i);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  const parsed = new Date(year, month, day, hours, minutes);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function isLocalOptimisticMessageId(id: string): boolean {
  return id.startsWith("local-") || id.startsWith("msg");
}

/**
 * Remote-first merge for Supabase hydration: keep server rows and only retain very recent
 * optimistic locals that do not yet have a matching remote twin (same logical message).
 */
export function mergeRemoteMessagesWithLocalOptimistic(
  remoteMessages: ChatMessage[],
  prevMessages: ChatMessage[],
  membersForLookup: Member[],
  nowMs: number,
): ChatMessage[] {
  const parseCreatedAtMs = parseChatMessageCreatedAtMs;
  const memberEmailById = new Map<string, string>();
  membersForLookup.forEach((member) => {
    if (!member.id) return;
    memberEmailById.set(member.id, member.email.trim().toLowerCase());
  });
  const canonicalMemberKey = (memberId: string): string => memberEmailById.get(memberId) || memberId;
  const messageMergeKey = (message: ChatMessage): string =>
    `${message.sender}|${message.text.trim().replace(/\s+/g, " ").toLowerCase()}|${canonicalMemberKey(message.memberId)}`;

  const dedupedRemoteById = new Map<string, ChatMessage>();
  remoteMessages.forEach((message) => {
    if (!dedupedRemoteById.has(message.id)) dedupedRemoteById.set(message.id, message);
  });
  const dedupedRemote = Array.from(dedupedRemoteById.values()).sort(
    (a, b) => parseCreatedAtMs(a.createdAt) - parseCreatedAtMs(b.createdAt),
  );

  const remoteByMergeKey = new Map<string, ChatMessage[]>();
  dedupedRemote.forEach((message) => {
    const key = messageMergeKey(message);
    const list = remoteByMergeKey.get(key) ?? [];
    list.push(message);
    remoteByMergeKey.set(key, list);
  });

  const unsyncedLocalMessages = prevMessages.filter((message) => {
    if (!isLocalOptimisticMessageId(message.id)) return false;
    const createdAtMs = parseCreatedAtMs(message.createdAt);
    if (!createdAtMs || nowMs - createdAtMs > 30000) return false;
    const key = messageMergeKey(message);
    const remoteCandidates = remoteByMergeKey.get(key) ?? [];
    const hasSyncedTwin = remoteCandidates.some((remoteMessage) => {
      const remoteCreatedAtMs = parseCreatedAtMs(remoteMessage.createdAt);
      if (!remoteCreatedAtMs) return false;
      return Math.abs(remoteCreatedAtMs - createdAtMs) <= 120000;
    });
    return !hasSyncedTwin;
  });

  return [...dedupedRemote, ...unsyncedLocalMessages].sort(
    (a, b) => parseCreatedAtMs(a.createdAt) - parseCreatedAtMs(b.createdAt),
  );
}
