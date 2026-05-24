const STORAGE_KEY = "MOTUS_CHAT_REACTIONS_V1";

export const CHAT_REACTION_EMOJIS = ["❤️", "💪", "🔥", "👏", "✅", "👍"] as const;
export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number];
export type ChatReactionActor = "member" | "trainer";
export type ChatReactionState = Partial<Record<ChatReactionEmoji, ChatReactionActor[]>>;
export type ChatReactionMap = Record<string, ChatReactionState>;

export function normalizeMessageReactions(reactions: ChatReactionState | undefined): ChatReactionState {
  if (!reactions) return {};
  return CHAT_REACTION_EMOJIS.reduce<ChatReactionState>((next, emoji) => {
    const actors = Array.from(
      new Set((reactions[emoji] ?? []).filter((actor) => actor === "member" || actor === "trainer")),
    );
    if (actors.length > 0) next[emoji] = actors;
    return next;
  }, {});
}

export function messageReactionsHaveEntries(reactions: ChatReactionState | undefined): boolean {
  return CHAT_REACTION_EMOJIS.some((emoji) => (reactions?.[emoji]?.length ?? 0) > 0);
}

export function toggleReactionInState(
  reactions: ChatReactionState | undefined,
  emoji: ChatReactionEmoji,
  actor: ChatReactionActor,
): ChatReactionState | undefined {
  const next = normalizeMessageReactions(reactions);
  const actors = [...(next[emoji] ?? [])];
  const index = actors.indexOf(actor);
  if (index >= 0) {
    actors.splice(index, 1);
  } else {
    actors.push(actor);
  }
  if (actors.length === 0) {
    delete next[emoji];
  } else {
    next[emoji] = actors;
  }
  return messageReactionsHaveEntries(next) ? next : undefined;
}

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

export function readMessageReactions(messageId: string): Record<ChatReactionEmoji, ChatReactionActor[]> {
  const all = readAll();
  return normalizeMessageReactions(all[messageId]) as Record<ChatReactionEmoji, ChatReactionActor[]>;
}

export function toggleMessageReaction(
  messageId: string,
  emoji: ChatReactionEmoji,
  actor: ChatReactionActor,
): Record<ChatReactionEmoji, ChatReactionActor[]> {
  const all = readAll();
  const current = toggleReactionInState(all[messageId], emoji, actor);
  if (current) {
    all[messageId] = current;
  } else {
    delete all[messageId];
  }
  writeAll(all);
  return (current ?? {}) as Record<ChatReactionEmoji, ChatReactionActor[]>;
}

export function countReactions(
  reactions: ChatReactionState | undefined,
): Array<{ emoji: ChatReactionEmoji; count: number; own: boolean }> {
  if (!reactions) return [];
  return CHAT_REACTION_EMOJIS.flatMap((emoji) => {
    const actors = reactions[emoji] ?? [];
    if (actors.length === 0) return [];
    return [{ emoji, count: actors.length, own: false }];
  });
}
