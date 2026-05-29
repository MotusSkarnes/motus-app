import type { ChatMessage } from "./types";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

function mapIsoToCreatedAt(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return new Date().toISOString();
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return trimmed;
}

export function chatMessageFromRow(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id ?? ""),
    memberId: String(row.member_id ?? row.memberId ?? ""),
    sender: row.sender === "member" ? "member" : "trainer",
    text: String(row.text ?? ""),
    createdAt: mapIsoToCreatedAt(String(row.created_at ?? row.createdAt ?? "")),
    ...mapChatMessageReadFields(row),
  };
}

export function mapChatMessageReadFields(row: Record<string, unknown>): Pick<ChatMessage, "readByMemberAt" | "readByTrainerAt"> {
  const readByMemberAt = typeof row.read_by_member_at === "string" ? row.read_by_member_at : undefined;
  const readByTrainerAt = typeof row.read_by_trainer_at === "string" ? row.read_by_trainer_at : undefined;
  return { readByMemberAt, readByTrainerAt };
}

export function isChatMessageReadByRecipient(message: ChatMessage): boolean {
  if (message.sender === "trainer") {
    return Boolean(message.readByMemberAt?.trim());
  }
  return Boolean(message.readByTrainerAt?.trim());
}

export function applyChatReadReceiptsInState(
  messages: ChatMessage[],
  memberId: string,
  reader: "trainer" | "member",
  readAt: string,
): ChatMessage[] {
  const trimmedMemberId = memberId.trim();
  const senderToMark = reader === "trainer" ? "member" : "trainer";
  const field = reader === "trainer" ? "readByTrainerAt" : "readByMemberAt";
  return messages.map((message) => {
    if (message.memberId.trim() !== trimmedMemberId) return message;
    if (message.sender !== senderToMark) return message;
    if (message[field]?.trim()) return message;
    return { ...message, [field]: readAt };
  });
}

export async function markChatMessagesReadInCloud(
  memberId: string,
  reader: "trainer" | "member",
): Promise<{ ok: boolean; readAt?: string }> {
  if (!isSupabaseConfigured || !supabaseClient || !memberId.trim()) {
    return { ok: false };
  }
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session?.access_token) return { ok: false };

  const { data, error } = await supabaseClient.functions.invoke("mark-chat-messages-read", {
    body: { memberId: memberId.trim(), reader },
  });
  if (error) return { ok: false };
  const payload = data as { ok?: boolean; readAt?: string };
  if (!payload?.ok) return { ok: false };
  return { ok: true, readAt: payload.readAt ?? new Date().toISOString() };
}
