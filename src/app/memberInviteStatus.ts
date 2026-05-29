import { findMembersByEmail, getOnboardingFromPersonalGoals } from "./memberOnboarding";
import type { AppState } from "./types";
import type { ChatMessage, Member, WorkoutLog } from "./types";

export function memberIdentityKey(member: Member): string {
  const emailKey = member.email.trim().toLowerCase();
  return emailKey || `id:${member.id}`;
}

function memberRowShowsAppActivation(member: Member): boolean {
  if (memberHasFirstLoginStamp(member)) return true;
  if (member.id.trim().startsWith("auth-")) return true;
  const onboarding = getOnboardingFromPersonalGoals(member.personalGoals);
  if (onboarding?.completedAt?.trim() && !onboarding.skipped) return true;
  const days = Number(member.daysSinceActivity || "0");
  if (Number.isFinite(days) && days > 0 && days < 999_999) return true;
  return false;
}

export function memberHasInviteStamp(member: Member): boolean {
  return Boolean(member.invitedAt?.trim());
}

export function memberHasFirstLoginStamp(member: Member): boolean {
  return Boolean(member.firstLoginAt?.trim());
}

export function memberEffectivelyInvited(
  member: Member,
  allMembers: Member[],
  context?: { messages?: ChatMessage[]; logs?: WorkoutLog[] },
): boolean {
  if (memberHasInviteStamp(member)) return true;

  const related = allMembers.length ? findMembersByEmail(member, allMembers) : [member];
  if (related.some(memberHasInviteStamp)) return true;
  if (related.some(memberHasFirstLoginStamp)) return true;
  if (related.some(memberRowShowsAppActivation)) return true;

  const relatedIds = new Set(related.map((row) => row.id));
  if (context?.messages?.some((message) => message.sender === "member" && relatedIds.has(message.memberId))) {
    return true;
  }
  if (context?.logs?.some((log) => relatedIds.has(log.memberId))) {
    return true;
  }

  return memberRowShowsAppActivation(member);
}

/** Én rad per kunde (e-post) som fortsatt trenger invitasjon fra PT. */
export function rosterMembersMissingInvite(
  rosterMembers: Member[],
  allMembers: Member[],
  context?: { messages?: ChatMessage[]; logs?: WorkoutLog[] },
): Member[] {
  const seen = new Set<string>();
  const missing: Member[] = [];
  for (const member of rosterMembers) {
    const key = memberIdentityKey(member);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!memberEffectivelyInvited(member, allMembers, context)) {
      const related = findMembersByEmail(member, allMembers);
      const canonical =
        related.find((row) => !row.id.trim().startsWith("auth-") && row.isActive !== false) ??
        related.find((row) => !row.id.trim().startsWith("auth-")) ??
        member;
      missing.push(canonical);
    }
  }
  return missing;
}

/** Oppdater lokal state når first_login_at er stemplet ved første innlogging (alle rader med samme e-post). */
export function applyFirstLoginStampToMembersByEmail(
  state: AppState,
  email: string,
  firstLoginAtIso: string,
): AppState {
  const emailKey = email.trim().toLowerCase();
  const stamp = firstLoginAtIso.trim();
  if (!emailKey || !emailKey.includes("@") || !stamp) return state;
  return {
    ...state,
    members: state.members.map((member) => {
      if (member.email.trim().toLowerCase() !== emailKey) return member;
      if (member.firstLoginAt?.trim()) return member;
      return { ...member, firstLoginAt: stamp };
    }),
  };
}

/** @deprecated Bruk applyFirstLoginStampToMembersByEmail — beholdt for eldre kall. */
export function applyInviteStampToMembersByEmail(
  state: AppState,
  email: string,
  invitedAtIso: string,
): AppState {
  return applyFirstLoginStampToMembersByEmail(state, email, invitedAtIso);
}

export function memberIdsMissingInviteStamp(members: Member[], email: string): string[] {
  const emailKey = email.trim().toLowerCase();
  if (!emailKey) return [];
  return members
    .filter((member) => member.email.trim().toLowerCase() === emailKey && !member.invitedAt?.trim())
    .map((member) => member.id)
    .filter(Boolean);
}
