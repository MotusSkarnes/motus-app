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

export type TrainingGroup = {
  id: string;
  ownerUserId: string;
  name: string;
  memberIds: string[];
  sourceProgramId?: string;
  masterSnapshot?: TrainingGroupProgramSnapshot;
  sourcePeriodPlanId?: string;
  masterPeriodPlan?: PeriodSchedulePlan;
  masterPeriodPlanPrograms?: TrainingGroupProgramSnapshot[];
  createdAt: string;
  updatedAt: string;
};

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
