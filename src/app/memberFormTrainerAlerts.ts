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

export function memberFormAlertKey(memberId: string, kind: MemberFormAlertKind, formKey?: string): string {
  const suffix = formKey?.trim() ? `-${formKey.trim()}` : "";
  if (kind === "check-in") return `trainer-member-form-check-in-${memberId}${suffix}`;
  return `trainer-member-form-onboarding-${memberId}${suffix}`;
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
        const formKey = String(onboarding.completedAt).trim().replace(/[:.]/g, "-").replace(/\s+/g, "");
        const id = memberFormAlertKey(member.id, "onboarding", formKey);
        if (!seenKeys.has(id)) {
          alerts.push({
            id,
            memberId: member.id,
            memberName,
            kind: "onboarding",
            title: "Nytt oppstartsskjema",
            text: `${memberName} har fylt ut oppstartsskjema`,
            detail: "Åpne kundekortet under Oversikt og logg for å lese svarene.",
            timestamp: parseTimestamp(onboarding.completedAt),
          });
        }
      }
    }

    for (const checkIn of getMonthlyCheckInsFromPersonalGoals(profile.personalGoals)) {
      const formKey = String(checkIn.monthKey).trim();
      const id = memberFormAlertKey(member.id, "check-in", formKey);
      if (seenKeys.has(id)) continue;
      alerts.push({
        id,
        memberId: member.id,
        memberName,
        kind: "check-in",
        title: "Ny månedlig sjekk-inn",
        text: `${memberName} har levert månedlig sjekk-inn`,
        detail: `Sjekk-inn for ${monthLabelFromKey(checkIn.monthKey)} — se svarene på kundekortet.`,
        timestamp: parseTimestamp(checkIn.completedAt) || Date.now(),
      });
    }
  }

  return alerts.sort((a, b) => b.timestamp - a.timestamp);
}

/** Marker alle skjema-varsler for medlem som sett (f.eks. når PT åpner kundekort). */
export function memberFormSeenKeysForMember(member: Member, allMembers?: Member[]): string[] {
  const profile = allMembers?.length ? enrichMemberWithBestProfile(member, allMembers) : member;
  const keys: string[] = [];
  const onboarding = getOnboardingFromPersonalGoals(profile.personalGoals);
  if (onboarding?.completedAt && !onboarding.skipped) {
    const formKey = String(onboarding.completedAt).trim().replace(/[:.]/g, "-").replace(/\s+/g, "");
    keys.push(memberFormAlertKey(member.id, "onboarding", formKey));
  }
  for (const checkIn of getMonthlyCheckInsFromPersonalGoals(profile.personalGoals)) {
    keys.push(memberFormAlertKey(member.id, "check-in", checkIn.monthKey));
  }
  return keys;
}
