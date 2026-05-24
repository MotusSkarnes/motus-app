import type { Member, TrainingProgram, WorkoutLog } from "./types";
import { parseLogDateMs } from "./workoutLogDate";

export function computeRelatedMemberIdSet(member: Member, allMembers: Member[]): Set<string> {
  const normalizedEmail = member.email.trim().toLowerCase();
  const normalizedName = member.name.trim().toLowerCase();
  const byEmailIds = normalizedEmail ? allMembers.filter((m) => m.email.trim().toLowerCase() === normalizedEmail).map((m) => m.id) : [];
  const byNameIds = normalizedName ? allMembers.filter((m) => m.name.trim().toLowerCase() === normalizedName).map((m) => m.id) : [];
  return new Set([...byEmailIds, ...byNameIds, member.id]);
}

/** Relaterte ID-er + e-post/navn når program er lagret på en annen medlemsrad enn valgt kunde. */
export function programBelongsToMember(member: Member, allMembers: Member[], program: TrainingProgram): boolean {
  if (program.memberId === "__template__") return false;
  const relatedIdSet = computeRelatedMemberIdSet(member, allMembers);
  const selectedEmail = member.email.trim().toLowerCase();
  const selectedName = member.name.trim().toLowerCase();
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  if (relatedIdSet.has(program.memberId)) return true;
  const rawProgramMemberId = program.memberId.trim().toLowerCase();
  if (selectedEmail && rawProgramMemberId === selectedEmail) return true;
  const ownerMember = memberById.get(program.memberId);
  if (!ownerMember) return false;
  const ownerEmail = ownerMember.email.trim().toLowerCase();
  const ownerName = ownerMember.name.trim().toLowerCase();
  if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
  if (selectedName && ownerName && ownerName === selectedName) return true;
  return false;
}

export function programsAttributedToMember(
  member: Member,
  allMembers: Member[],
  programs: TrainingProgram[],
): TrainingProgram[] {
  return programs.filter((program) => programBelongsToMember(member, allMembers, program));
}

/** Samme attributtering som valgt kunde sin øktliste (relaterte ID-er + delt «Medlem» med e-post/navn-matching). */
export function logsAttributedToMember(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): WorkoutLog[] {
  const relatedIdSet = computeRelatedMemberIdSet(member, allMembers);
  const isSharedMember = member.customerType === "Medlem";
  const selectedEmail = member.email.trim().toLowerCase();
  const selectedName = member.name.trim().toLowerCase();
  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  return workoutLogs.filter((log) => {
    if (relatedIdSet.has(log.memberId)) return true;
    if (!isSharedMember) return false;
    const rawLogMemberId = log.memberId.trim().toLowerCase();
    if (selectedEmail && rawLogMemberId === selectedEmail) return true;
    const ownerMember = memberById.get(log.memberId);
    if (!ownerMember) return false;
    const ownerEmail = ownerMember.email.trim().toLowerCase();
    const ownerName = ownerMember.name.trim().toLowerCase();
    if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
    if (selectedName && ownerName && ownerName === selectedName) return true;
    return false;
  });
}

/** Kalenderdager siden siste fullførte økt; null hvis ingen fullførte logger for kunden. */
export function daysSinceLastCompletedWorkout(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): number | null {
  const attributed = logsAttributedToMember(member, allMembers, workoutLogs);
  const completed = attributed.filter((log) => log.status === "Fullført");
  if (!completed.length) return null;
  let maxMs = 0;
  for (const log of completed) {
    const ms = parseLogDateMs(log.date);
    if (ms > maxMs) maxMs = ms;
  }
  if (maxMs <= 0) return null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((todayStart - maxMs) / dayMs));
}

/** Lavere tall = nyligere aktivitet. Mangler logger og DB har «0» → havner bakerst ved sortering. */
export function trainerActivitySortKey(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): number {
  const fromLogs = daysSinceLastCompletedWorkout(member, allMembers, workoutLogs);
  if (fromLogs !== null) return fromLogs;
  const stored = Number(member.daysSinceActivity || "0");
  if (stored > 0) return stored;
  return 999999;
}

/** For «7+ dager inaktiv»: ikke bruk DB-default 0 når det ikke finnes fullførte økter. */
export function trainerInactiveDaysForFollowUp(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): number | null {
  const fromLogs = daysSinceLastCompletedWorkout(member, allMembers, workoutLogs);
  if (fromLogs !== null) return fromLogs;
  const stored = Number(member.daysSinceActivity || "0");
  return stored > 0 ? stored : null;
}

export function formatTrainerMemberActivitySubtitle(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): string {
  const d = daysSinceLastCompletedWorkout(member, allMembers, workoutLogs);
  if (d !== null) return `${d} dager siden siste økt`;
  return "Ingen registrerte økter";
}

export type MemberPriorityTone = "red" | "orange" | "green";

/** Rød ≥10 dager inaktiv, oransje ≥5, ellers grønn. */
export function memberPriorityTone(member: Member, allMembers: Member[], workoutLogs: WorkoutLog[]): MemberPriorityTone {
  const inactiveDays = trainerInactiveDaysForFollowUp(member, allMembers, workoutLogs);
  if (inactiveDays === null) return "green";
  if (inactiveDays >= 10) return "red";
  if (inactiveDays >= 5) return "orange";
  return "green";
}

export function memberPriorityScore(tone: MemberPriorityTone): number {
  if (tone === "red") return 3;
  if (tone === "orange") return 2;
  return 1;
}
