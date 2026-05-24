import type { ChatMessage, Member, TrainingProgram, WorkoutLog } from "./types";

/** Klient-side relaterte medlems-id-er (logger, program, meldinger) for innlogget medlem. */
export function collectClientRelatedMemberIds(input: {
  members: Member[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  normalizedCurrentUserEmail: string;
  currentUserMemberId?: string;
  currentUserSupabaseId?: string;
  editableMember: Member | null;
  memberViewId: string;
}): string[] {
  const collectedIds = new Set<string>();
  const {
    members,
    programs,
    logs,
    messages,
    normalizedCurrentUserEmail,
    currentUserMemberId,
    currentUserSupabaseId,
    editableMember,
    memberViewId,
  } = input;

  if (normalizedCurrentUserEmail) {
    members
      .filter((member) => member.email.trim().toLowerCase() === normalizedCurrentUserEmail)
      .forEach((member) => collectedIds.add(member.id));
  }

  const fallbackEmail = editableMember?.email.trim().toLowerCase() ?? "";
  if (fallbackEmail) {
    members
      .filter((member) => member.email.trim().toLowerCase() === fallbackEmail)
      .forEach((member) => collectedIds.add(member.id));
  }

  const memberRowById = new Map(members.map((member) => [member.id, member]));
  const candidateIds = [
    ...programs.map((program) => program.memberId),
    ...logs.map((log) => log.memberId),
    ...messages.map((message) => message.memberId),
  ];
  for (const rawId of candidateIds) {
    const id = rawId.trim();
    if (!id) continue;
    const row = memberRowById.get(id);
    if (row && normalizedCurrentUserEmail && row.email.trim().toLowerCase() === normalizedCurrentUserEmail) {
      collectedIds.add(id);
    }
  }

  if (normalizedCurrentUserEmail) collectedIds.add(normalizedCurrentUserEmail);
  if (currentUserMemberId?.trim()) collectedIds.add(currentUserMemberId.trim());
  if (currentUserSupabaseId?.trim()) {
    const sid = currentUserSupabaseId.trim();
    collectedIds.add(sid);
    collectedIds.add(`auth-${sid}`);
  }

  const activeMemberId = editableMember?.id ?? memberViewId;
  if (activeMemberId.trim()) collectedIds.add(activeMemberId.trim());
  if (memberViewId.trim()) collectedIds.add(memberViewId.trim());

  const merged = Array.from(collectedIds).filter(Boolean);
  return merged.length ? merged : activeMemberId ? [activeMemberId] : [];
}
