export type HiddenBadgeCelebrationCandidate = {
  id: string;
  secret?: boolean;
  unlocked?: boolean;
};

export function buildSeenHiddenBadgeBaselineIds(
  unlockedSecretBadgeIds: string[],
  seenHiddenBadgeIds: ReadonlySet<string>,
): Set<string> {
  return new Set(unlockedSecretBadgeIds.filter((badgeId) => seenHiddenBadgeIds.has(badgeId)));
}

export function findNextHiddenBadgeCelebration<T extends HiddenBadgeCelebrationCandidate>(
  badges: readonly T[],
  seenHiddenBadgeIds: ReadonlySet<string>,
  baselineBadgeIds: ReadonlySet<string>,
): T | null {
  return (
    badges.find(
      (badge) =>
        badge.secret === true &&
        badge.unlocked === true &&
        !seenHiddenBadgeIds.has(badge.id) &&
        !baselineBadgeIds.has(badge.id),
    ) ?? null
  );
}
