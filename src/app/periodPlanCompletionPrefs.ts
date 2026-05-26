import { parsePersonalGoalsJson } from "./memberOnboarding";

const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

export const PERIOD_PLAN_COMPLETION_PREFS_VERSION = 1;

export type PeriodPlanCompletionPrefs = {
  version: typeof PERIOD_PLAN_COMPLETION_PREFS_VERSION;
  completedEntryKeys: string[];
  dismissedEntryKeys: string[];
  updatedAt: number;
};

export function emptyPeriodPlanCompletionPrefs(): PeriodPlanCompletionPrefs {
  return {
    version: PERIOD_PLAN_COMPLETION_PREFS_VERSION,
    completedEntryKeys: [],
    dismissedEntryKeys: [],
    updatedAt: 0,
  };
}

function uniqueKeys(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizePeriodPlanCompletionPrefs(raw: unknown): PeriodPlanCompletionPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (Number(record.version) !== PERIOD_PLAN_COMPLETION_PREFS_VERSION) return null;
  return {
    version: PERIOD_PLAN_COMPLETION_PREFS_VERSION,
    completedEntryKeys: uniqueKeys(
      Array.isArray(record.completedEntryKeys)
        ? record.completedEntryKeys.filter((item): item is string => typeof item === "string")
        : [],
    ),
    dismissedEntryKeys: uniqueKeys(
      Array.isArray(record.dismissedEntryKeys)
        ? record.dismissedEntryKeys.filter((item): item is string => typeof item === "string")
        : [],
    ),
    updatedAt: Number(record.updatedAt) || 0,
  };
}

export function readPeriodPlanCompletionFromPersonalGoals(
  personalGoals: string | undefined,
): PeriodPlanCompletionPrefs | null {
  const payload = parsePersonalGoalsJson(personalGoals);
  if (!payload) return null;
  return normalizePeriodPlanCompletionPrefs(payload.periodPlanCompletion);
}

export function mergePeriodPlanCompletionIntoPersonalGoals(
  existingPersonalGoals: string | undefined,
  prefs: PeriodPlanCompletionPrefs,
): string {
  const existing = parsePersonalGoalsJson(existingPersonalGoals) ?? {};
  const payload = {
    ...existing,
    periodPlanCompletion: {
      ...prefs,
      completedEntryKeys: uniqueKeys(prefs.completedEntryKeys),
      dismissedEntryKeys: uniqueKeys(prefs.dismissedEntryKeys),
      updatedAt: Date.now(),
    },
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

/**
 * Slå sammen lokale og sky-verdier.
 * - `completedEntryKeys` unioneres slik at fullføringer aldri går tapt på tvers av enheter.
 * - `dismissedEntryKeys` følger nyeste `updatedAt` slik at når brukeren fjerner en avhuking
 *   lokalt (f.eks. via «Logg dagens økt»), kommer ikke gamle avhukinger fra remote tilbake.
 */
export function mergePeriodPlanCompletionPrefs(
  local: PeriodPlanCompletionPrefs,
  remote: PeriodPlanCompletionPrefs | null | undefined,
): PeriodPlanCompletionPrefs {
  if (!remote) {
    return {
      ...local,
      completedEntryKeys: uniqueKeys(local.completedEntryKeys),
      dismissedEntryKeys: uniqueKeys(local.dismissedEntryKeys),
    };
  }

  const remoteIsNewer = remote.updatedAt > local.updatedAt;
  const newestDismissed = remoteIsNewer ? remote.dismissedEntryKeys : local.dismissedEntryKeys;

  return {
    version: PERIOD_PLAN_COMPLETION_PREFS_VERSION,
    completedEntryKeys: uniqueKeys([...local.completedEntryKeys, ...remote.completedEntryKeys]),
    dismissedEntryKeys: uniqueKeys(newestDismissed),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}

export function reconcilePeriodPlanCompletionKeys(input: {
  storedCompleted: string[];
  storedDismissed: string[];
  remotePrefs: PeriodPlanCompletionPrefs | null;
  derivedCompleted: string[];
  /**
   * Tidsstempel som indikerer hvor «friskt» lokal state er. Settes til `Date.now()` når
   * brukeren akkurat har gjort en lokal endring (markert/avmarkert/fjernet avhuking) slik
   * at lokal autoritet overgår eldre verdier i Supabase-cachen.
   */
  localUpdatedAt?: number;
}): { completedKeys: string[]; dismissedKeys: string[] } {
  const merged = mergePeriodPlanCompletionPrefs(
    {
      version: PERIOD_PLAN_COMPLETION_PREFS_VERSION,
      completedEntryKeys: input.storedCompleted,
      dismissedEntryKeys: input.storedDismissed,
      updatedAt: Math.max(0, Number(input.localUpdatedAt) || 0),
    },
    input.remotePrefs,
  );

  const completedKeys = uniqueKeys([...merged.completedEntryKeys, ...input.derivedCompleted]).filter(
    (key) => !merged.dismissedEntryKeys.includes(key),
  );

  return {
    completedKeys,
    dismissedKeys: merged.dismissedEntryKeys,
  };
}
