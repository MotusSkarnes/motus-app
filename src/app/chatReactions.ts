const STORAGE_KEY = "MOTUS_CHAT_REACTIONS_V1";

export const CHAT_REACTION_EMOJIS = ["❤️", "💪", "🔥", "👏", "✅", "👍"] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];

export type ChatReactionMap = Record<string, Record<ChatReactionEmoji, ("member" | "trainer")[]>>;

function readAll(): ChatReactionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ChatReactionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ChatReactionMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function readMessageReactions(messageId: string): Record<ChatReactionEmoji, ("member" | "trainer")[]> {
  const all = readAll();
  return (all[messageId] ?? {}) as Record<ChatReactionEmoji, ("member" | "trainer")[]>;
}

export function toggleMessageReaction(
  messageId: string,
  emoji: ChatReactionEmoji,
  actor: "member" | "trainer",
): Record<ChatReactionEmoji, ("member" | "trainer")[]> {
  const all = readAll();
  const current = { ...(all[messageId] ?? {}) } as Record<ChatReactionEmoji, ("member" | "trainer")[]>;
  const actors = [...(current[emoji] ?? [])];
  const index = actors.indexOf(actor);
  if (index >= 0) {
    actors.splice(index, 1);
  } else {
    actors.push(actor);
  }
  if (actors.length === 0) {
    delete current[emoji];
  } else {
    current[emoji] = actors;
  }
  const hasAny = Object.keys(current).length > 0;
  if (hasAny) {
    all[messageId] = current;
  } else {
    delete all[messageId];
  }
  writeAll(all);
  return current;
}

export function countReactions(reactions: Record<ChatReactionEmoji, ("member" | "trainer")[]> | undefined): Array<{ emoji: ChatReactionEmoji; count: number; own: boolean }> {
  if (!reactions) return [];
  return CHAT_REACTION_EMOJIS.flatMap((emoji) => {
    const actors = reactions[emoji] ?? [];
    if (actors.length === 0) return [];
    return [{ emoji, count: actors.length, own: false }];
  });
}
