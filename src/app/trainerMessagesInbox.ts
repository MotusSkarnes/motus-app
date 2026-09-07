import type { ChatMessage, Member } from "./types";
import { parseChatCreatedAtMs } from "./chatFormat";
import {
  buildUnreadMessagesByIdentityKey,
  chatMessageMemberIdMatchesRoster,
  memberIdentityKey,
  rosterMemberChatMemberIds,
  unreadCountForMember,
} from "./trainerUnreadMessages";

export function memberHasTrainerMessagingAccess(member: Member): boolean {
  return member.customerType === "PT-kunde" || member.membershipType === "Premium";
}

export function filterMessagesForRosterMember(
  messages: ChatMessage[],
  members: Member[],
  rosterMemberId: string,
): ChatMessage[] {
  const selected = members.find((member) => member.id === rosterMemberId) ?? null;
  if (!selected) return [];
  const relatedIds = rosterMemberChatMemberIds(members, rosterMemberId);
  const selectedEmail = selected.email.trim().toLowerCase();
  const isSharedMember = selected.customerType === "Medlem";
  const memberById = new Map(members.map((member) => [member.id, member]));

  const filtered = messages
    .filter((message) => {
      if (chatMessageMemberIdMatchesRoster(relatedIds, message.memberId)) return true;
      if (!isSharedMember) return false;
      const rawMessageMemberId = message.memberId.trim().toLowerCase();
      if (selectedEmail && rawMessageMemberId === selectedEmail) return true;
      const ownerMember = memberById.get(message.memberId);
      if (!ownerMember) return false;
      const ownerEmail = ownerMember.email.trim().toLowerCase();
      return Boolean(selectedEmail && ownerEmail && ownerEmail === selectedEmail);
    })
    .sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));

  const uniqueById = new Map<string, ChatMessage>();
  filtered.forEach((message) => {
    if (!uniqueById.has(message.id)) uniqueById.set(message.id, message);
  });

  const bySignature = new Map<string, ChatMessage>();
  Array.from(uniqueById.values()).forEach((message) => {
    const timestampMs = parseChatCreatedAtMs(message.createdAt);
    const normalizedText = message.text.trim().replace(/\s+/g, " ").toLowerCase();
    const minuteBucket = timestampMs > 0 ? Math.floor(timestampMs / 60000) : message.createdAt.trim().toLowerCase();
    const signature = `${message.sender}|${normalizedText}|${minuteBucket}`;
    const existing = bySignature.get(signature);
    if (!existing || timestampMs >= parseChatCreatedAtMs(existing.createdAt)) {
      bySignature.set(signature, message);
    }
  });

  return Array.from(bySignature.values()).sort(
    (a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt),
  );
}

export type TrainerMessageInboxRow = {
  member: Member;
  unreadCount: number;
  latestMessage: ChatMessage | null;
  latestAtMs: number;
  preview: string;
};

export function buildTrainerMessageInboxRows(
  members: Member[],
  messages: ChatMessage[],
  unreadByMemberId: Record<string, number>,
): TrainerMessageInboxRow[] {
  const unreadByIdentity = buildUnreadMessagesByIdentityKey(members, unreadByMemberId);
  const active = members.filter((member) => member.isActive !== false && member.id !== "__template__");

  const rows: TrainerMessageInboxRow[] = active.map((member) => {
    const thread = filterMessagesForRosterMember(messages, members, member.id);
    const latestMessage = thread.length ? thread[thread.length - 1]! : null;
    const latestAtMs = latestMessage ? parseChatCreatedAtMs(latestMessage.createdAt) : 0;
    const preview = latestMessage?.text.trim().replace(/\s+/g, " ") || "Ingen meldinger ennå";
    return {
      member,
      unreadCount: unreadCountForMember(member, unreadByIdentity),
      latestMessage,
      latestAtMs,
      preview: preview.length > 72 ? `${preview.slice(0, 71)}…` : preview,
    };
  });

  return rows.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    if (a.latestAtMs !== b.latestAtMs) return b.latestAtMs - a.latestAtMs;
    return a.member.name.localeCompare(b.member.name, "nb");
  });
}

export function formatInboxTimestamp(ms: number): string {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" });
}

export { memberIdentityKey };
