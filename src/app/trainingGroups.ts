import type { PeriodSchedulePlan, ProgramExercise, TrainingProgram } from "./types";

export type TrainingGroupProgramSnapshot = {
  title: string;
  goal: string;
  notes: string;
  exercises: ProgramExercise[];
  imageUrl?: string;
  conditioningDeliveryMode?: TrainingProgram["conditioningDeliveryMode"];
  activityTemplateKind?: TrainingProgram["activityTemplateKind"];
  /** Stabil kilde-id når flere programmer synkes fra samme gruppe (ukeplan). */
  sourceProgramId?: string;
};

export const TRAINING_GROUP_LEVELS = [1, 2, 3] as const;
export type TrainingGroupLevel = (typeof TRAINING_GROUP_LEVELS)[number];
export type TrainingGroupLevelPreferences = Partial<Record<TrainingGroupLevel, string>>;

export type TrainingGroup = {
  id: string;
  ownerUserId: string;
  name: string;
  memberIds: string[];
  /** Nivå 1–3 per medlem i denne gruppen. Mangler verdi = nivå 1. */
  memberLevels?: Record<string, TrainingGroupLevel>;
  /** Fri tekst PT fyller ut per nivå når gruppen startes. */
  levelPreferences?: TrainingGroupLevelPreferences;
  sourceProgramId?: string;
  masterSnapshot?: TrainingGroupProgramSnapshot;
  sourcePeriodPlanId?: string;
  masterPeriodPlan?: PeriodSchedulePlan;
  masterPeriodPlanPrograms?: TrainingGroupProgramSnapshot[];
  createdAt: string;
  updatedAt: string;
};

export function parseTrainingGroupLevel(value: unknown): TrainingGroupLevel | undefined {
  const numeric = typeof value === "string" ? Number(value.trim()) : value;
  if (numeric === 1 || numeric === 2 || numeric === 3) return numeric;
  return undefined;
}

export function trainingGroupLevelLabel(level: TrainingGroupLevel): string {
  return `Nivå ${level}`;
}

export function normalizeTrainingGroupMemberLevels(
  memberIds: string[],
  raw: unknown,
): Record<string, TrainingGroupLevel> {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next: Record<string, TrainingGroupLevel> = {};
  for (const memberId of memberIds) {
    const id = memberId.trim();
    if (!id) continue;
    next[id] = parseTrainingGroupLevel(source[id]) ?? 1;
  }
  return next;
}

export function normalizeTrainingGroupLevelPreferences(raw: unknown): TrainingGroupLevelPreferences {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const next: TrainingGroupLevelPreferences = {};
  for (const level of TRAINING_GROUP_LEVELS) {
    const text = String(source[level] ?? source[String(level)] ?? "").trim();
    if (text) next[level] = text;
  }
  return next;
}

export function parseTrainingGroupLevelSetup(raw: unknown): {
  memberLevels: Record<string, TrainingGroupLevel>;
  levelPreferences: TrainingGroupLevelPreferences;
} {
  const row = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const memberLevelsRaw = row.memberLevels ?? row.member_levels;
  const memberIds =
    memberLevelsRaw && typeof memberLevelsRaw === "object" && !Array.isArray(memberLevelsRaw)
      ? Object.keys(memberLevelsRaw)
      : [];
  return {
    memberLevels: normalizeTrainingGroupMemberLevels(memberIds, memberLevelsRaw),
    levelPreferences: normalizeTrainingGroupLevelPreferences(row.preferences ?? row.levelPreferences),
  };
}

export function serializeTrainingGroupLevelSetup(
  group: Pick<TrainingGroup, "memberIds" | "memberLevels" | "levelPreferences">,
): { memberLevels: Record<string, TrainingGroupLevel>; preferences: TrainingGroupLevelPreferences } {
  return {
    memberLevels: normalizeTrainingGroupMemberLevels(group.memberIds, group.memberLevels),
    preferences: normalizeTrainingGroupLevelPreferences(group.levelPreferences),
  };
}

export function trainingGroupMemberLevel(
  group: Pick<TrainingGroup, "memberIds" | "memberLevels">,
  memberId: string,
): TrainingGroupLevel | undefined {
  const id = memberId.trim();
  if (!id || !group.memberIds.includes(id)) return undefined;
  return parseTrainingGroupLevel(group.memberLevels?.[id]) ?? 1;
}

export function trainingGroupLevelPreference(
  group: Pick<TrainingGroup, "levelPreferences">,
  level: TrainingGroupLevel,
): string {
  return String(group.levelPreferences?.[level] ?? "").trim();
}

export function countTrainingGroupMembersAtLevel(
  group: Pick<TrainingGroup, "memberIds" | "memberLevels">,
  level: TrainingGroupLevel,
): number {
  return group.memberIds.filter((memberId) => trainingGroupMemberLevel(group, memberId) === level).length;
}

export type GroupChatMessage = {
  id: string;
  groupId: string;
  senderRole: "trainer" | "member";
  senderMemberId?: string;
  senderName: string;
  text: string;
  createdAt: string;
  ownerUserId: string;
};

export type GroupChatParticipant = {
  role: "trainer" | "member";
  memberId?: string;
  name: string;
};

/** PT er alltid deltaker i gruppechatten, også uten medlemmer. */
export function groupChatParticipants(
  group: Pick<TrainingGroup, "memberIds">,
  members: Array<{ id: string; name: string }>,
  trainerName: string,
): GroupChatParticipant[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const trainer: GroupChatParticipant = {
    role: "trainer",
    name: trainerName.trim() || "PT",
  };
  const memberRows: GroupChatParticipant[] = group.memberIds
    .map((memberId) => {
      const member = memberById.get(memberId);
      if (!member) return null;
      return {
        role: "member" as const,
        memberId,
        name: member.name.trim() || "Medlem",
      };
    })
    .filter((row): row is GroupChatParticipant => row !== null);
  return [trainer, ...memberRows];
}

export function groupChatParticipantSummary(
  group: Pick<TrainingGroup, "memberIds">,
  members: Array<{ id: string; name: string }>,
  trainerName: string,
): string {
  const people = groupChatParticipants(group, members, trainerName);
  const trainer = people.find((row) => row.role === "trainer")?.name ?? "PT";
  const memberCount = people.filter((row) => row.role === "member").length;
  if (memberCount === 0) return `${trainer} (alltid med)`;
  if (memberCount === 1) return `${trainer} + 1 medlem`;
  return `${trainer} + ${memberCount} medlemmer`;
}
