import { enrichMemberWithBestProfile, getOnboardingFromPersonalGoals, isOnboardingCompleted } from "./memberOnboarding";
import { getMonthlyCheckInsFromPersonalGoals } from "./memberMonthlyCheckIn";
import type { Member } from "./types";

export type MemberFormAlertKind = "onboarding" | "check-in";

export type MemberFormTrainerAlertSource = {
  id: string;
  memberId: string;
  memberName: string;
  kind: MemberFormAlertKind;
  title: string;
  text: string;
  detail: string;
  timestamp: number;
};

function monthLabelFromKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
}

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function memberFormAlertKey(memberId: string, kind: MemberFormAlertKind, monthKey?: string): string {
  if (kind === "check-in" && monthKey) return `trainer-member-form-check-in-${memberId}-${monthKey}`;
  return `trainer-member-form-onboarding-${memberId}`;
}

export function buildMemberFormTrainerAlerts(
  members: Member[],
  seenKeys: ReadonlySet<string>,
): MemberFormTrainerAlertSource[] {
  const alerts: MemberFormTrainerAlertSource[] = [];

  for (const member of members) {
    if (member.isActive === false) continue;
    const profile = enrichMemberWithBestProfile(member, members);
    const memberName = profile.name.trim() || profile.email.trim() || "Medlem";

    if (isOnboardingCompleted(profile.personalGoals)) {
      const onboarding = getOnboardingFromPersonalGoals(profile.personalGoals);
      if (onboarding?.completedAt && !onboarding.skipped) {
        const id = memberFormAlertKey(member.id, "onboarding");
        if (!seenKeys.has(id)) {
          alerts.push({
            id,
            memberId: member.id,
            memberName,
            kind: "onboarding",
            title: "Nytt oppstartsskjema",
            text: memberName,
            detail: "Medlem har fylt ut kundeskjema — se svarene på kundekortet.",
            timestamp: parseTimestamp(onboarding.completedAt),
          });
        }
      }
    }

    for (const checkIn of getMonthlyCheckInsFromPersonalGoals(profile.personalGoals)) {
      const id = memberFormAlertKey(member.id, "check-in", checkIn.monthKey);
      if (seenKeys.has(id)) continue;
      alerts.push({
        id,
        memberId: member.id,
        memberName,
        kind: "check-in",
        title: "Ny månedlig sjekk-inn",
        text: memberName,
        detail: `Sjekk-inn for ${monthLabelFromKey(checkIn.monthKey)} er levert.`,
        timestamp: parseTimestamp(checkIn.completedAt) || Date.now(),
      });
    }
  }

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

/** Marker alle skjema-varsler for medlem som sett (f.eks. når PT åpner kundekort). */
export function memberFormSeenKeysForMember(member: Member, allMembers?: Member[]): string[] {
  const profile = allMembers?.length ? enrichMemberWithBestProfile(member, allMembers) : member;
  const keys = [memberFormAlertKey(member.id, "onboarding")];
  for (const checkIn of getMonthlyCheckInsFromPersonalGoals(profile.personalGoals)) {
    keys.push(memberFormAlertKey(member.id, "check-in", checkIn.monthKey));
  }
  return keys;
}
