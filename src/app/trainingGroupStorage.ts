import type { GroupChatMessage, TrainingGroup, TrainingGroupProgramSnapshot } from "./trainingGroups";

const GROUPS_KEY = "motus.trainingGroups.v1";
const CHAT_KEY = "motus.groupChat.v1";

type StoredBundle = {
  groups: TrainingGroup[];
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function loadLocalTrainingGroups(ownerUserId: string): TrainingGroup[] {
  const owner = ownerUserId.trim();
  if (!owner) return [];
  const bundle = readJson<StoredBundle>(GROUPS_KEY, { groups: [] });
  return bundle.groups.filter((group) => group.ownerUserId === owner);
}

export function saveLocalTrainingGroups(ownerUserId: string, groups: TrainingGroup[]) {
  const owner = ownerUserId.trim();
  if (!owner) return;
  const bundle = readJson<StoredBundle>(GROUPS_KEY, { groups: [] });
  const others = bundle.groups.filter((group) => group.ownerUserId !== owner);
  writeJson(GROUPS_KEY, { groups: [...others, ...groups] });
}

export function loadLocalGroupChatMessages(ownerUserId: string): GroupChatMessage[] {
  const owner = ownerUserId.trim();
  if (!owner) return [];
  const messages = readJson<GroupChatMessage[]>(CHAT_KEY, []);
  return messages.filter((message) => message.ownerUserId === owner);
}

export function saveLocalGroupChatMessages(ownerUserId: string, messages: GroupChatMessage[]) {
  const owner = ownerUserId.trim();
  if (!owner) return;
  const existing = readJson<GroupChatMessage[]>(CHAT_KEY, []);
  const others = existing.filter((message) => message.ownerUserId !== owner);
  writeJson(CHAT_KEY, [...others, ...messages]);
}

export function upsertLocalTrainingGroup(ownerUserId: string, group: TrainingGroup) {
  const groups = loadLocalTrainingGroups(ownerUserId);
  const next = [group, ...groups.filter((row) => row.id !== group.id)];
  saveLocalTrainingGroups(ownerUserId, next);
}

export function removeLocalTrainingGroup(ownerUserId: string, groupId: string) {
  const groups = loadLocalTrainingGroups(ownerUserId).filter((group) => group.id !== groupId);
  saveLocalTrainingGroups(ownerUserId, groups);
  const chat = loadLocalGroupChatMessages(ownerUserId).filter((message) => message.groupId !== groupId);
  saveLocalGroupChatMessages(ownerUserId, chat);
}

export function appendLocalGroupChatMessage(message: GroupChatMessage) {
  const messages = loadLocalGroupChatMessages(message.ownerUserId);
  if (messages.some((row) => row.id === message.id)) return;
  saveLocalGroupChatMessages(message.ownerUserId, [...messages, message]);
}

export function snapshotFromUnknown(raw: unknown): TrainingGroupProgramSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const title = String(row.title ?? "").trim();
  if (!title) return undefined;
  return {
    title,
    goal: String(row.goal ?? ""),
    notes: String(row.notes ?? ""),
    exercises: Array.isArray(row.exercises) ? (row.exercises as TrainingGroupProgramSnapshot["exercises"]) : [],
    imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined,
    conditioningDeliveryMode:
      row.conditioningDeliveryMode === "interval" || row.conditioningDeliveryMode === "logAfter"
        ? row.conditioningDeliveryMode
        : undefined,
    activityTemplateKind:
      row.activityTemplateKind === "group" ||
      row.activityTemplateKind === "activity" ||
      row.activityTemplateKind === "no-plan"
        ? row.activityTemplateKind
        : undefined,
  };
}
