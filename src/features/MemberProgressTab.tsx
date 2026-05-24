import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { parseStoredLogDate } from "../app/dateFormat";
import { computeMemberProgressScores } from "../app/memberMomentumScores";
import { computeMemberProgressState } from "../app/memberProgressGamification";
import { collectClientRelatedMemberIds } from "../app/memberRelatedIds";
import { computeShareCardLast7DaysStats } from "../app/memberProgressShareStats";
import { shareMemberProgressWeeklySummary } from "../app/memberProgressWeeklyShareCard";
import { motusShareStatusMessage, sharePersonalRecordCard } from "../app/motusShareCard";
import type { Member, MemberTab, WorkoutLog } from "../app/types";
import type { Exercise } from "../app/types";
import type { ChatMessage, TrainingProgram } from "../app/types";
import type { UpdateMemberInput } from "../services/appRepository";
import motusSkrytekortLogo from "../assets/motus-skrytekort-logo.png";
import { PersonalRecordProgressModal } from "./PersonalRecordProgressModal";
import { buildExerciseGroupByName, computeMuscleGroupStats } from "./muscleSplitStats";
import type { MuscleSplitMetric, MuscleSplitPeriod } from "./muscleSplitStats";
import type { PersonalRecordEntry } from "./MemberPersonalRecordsSection";

const MemberProgressPageView = lazy(() =>
  import("./MemberProgressPageView").then((module) => ({ default: module.MemberProgressPageView })),
);

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function readSessionsPerWeekTarget(personalGoals: string | undefined): number {
  if (!personalGoals?.trim()) return 0;
  try {
    const parsed = JSON.parse(personalGoals) as { sessionsPerWeekTarget?: string | number };
    return Number(parsed.sessionsPerWeekTarget) || 0;
  } catch {
    return 0;
  }
}

function normalizeFavoritePersonalRecordNames(names?: string[]): string[] {
  if (!names?.length) return [];
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).slice(0, 3);
}

function getUiPreferencesStorageKey(memberId: string): string {
  return `motus.member.uiPrefs.${memberId}`;
}

type MemberProgressTabProps = {
  activeMember: Member;
  members: Member[];
  logs: WorkoutLog[];
  exercises: Exercise[];
  programs: TrainingProgram[];
  messages: ChatMessage[];
  memberViewId: string;
  currentUserEmail: string;
  currentUserMemberId?: string;
  currentUserSupabaseId?: string;
  setMemberTab: (tab: MemberTab) => void;
  updateMember: (input: UpdateMemberInput) => void;
};

export function MemberProgressTab({
  activeMember,
  members,
  logs,
  exercises,
  programs,
  messages,
  memberViewId,
  currentUserEmail,
  currentUserMemberId,
  currentUserSupabaseId,
  setMemberTab,
}: MemberProgressTabProps) {
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const motusShareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-02`;
  const nowTimestamp = useMemo(() => Date.now(), []);
  const nowDate = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);

  const relatedMemberIds = useMemo(
    () =>
      collectClientRelatedMemberIds({
        members,
        programs,
        logs,
        messages,
        normalizedCurrentUserEmail,
        currentUserMemberId,
        currentUserSupabaseId,
        editableMember: activeMember,
        memberViewId,
      }),
    [
      activeMember,
      currentUserMemberId,
      currentUserSupabaseId,
      logs,
      memberViewId,
      members,
      messages,
      normalizedCurrentUserEmail,
      programs,
    ],
  );
  const relatedMemberIdSet = useMemo(() => new Set(relatedMemberIds), [relatedMemberIds]);

  const completedLogs = useMemo(
    () => logs.filter((log) => relatedMemberIdSet.has(log.memberId) && log.status === "Fullført"),
    [logs, relatedMemberIdSet],
  );
  const completedLogDates = useMemo(
    () => completedLogs.map((log) => parseStoredLogDate(log.date)).filter((date): date is Date => Boolean(date)),
    [completedLogs],
  );
  const sessionsPerWeekTarget = useMemo(
    () => readSessionsPerWeekTarget(activeMember.personalGoals),
    [activeMember.personalGoals],
  );
  const memberProgress = useMemo(
    () =>
      computeMemberProgressState({
        completedLogDates,
        nowDate,
        sessionsPerWeekTarget,
      }),
    [completedLogDates, nowDate, sessionsPerWeekTarget],
  );
  const homeWeeklySummary = useMemo(() => {
    const today = getStartOfDay(new Date(nowTimestamp));
    const mondayOffset = (today.getDay() + 6) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    const completedThisWeek = completedLogDates.filter((date) => {
      const day = getStartOfDay(date);
      return day.getTime() >= weekStart.getTime() && day.getTime() < weekEnd.getTime();
    }).length;
    return { completedThisWeek, plannedThisWeek: 0, completionRate: 0 };
  }, [completedLogDates, nowTimestamp]);
  const recentWorkoutReflections = useMemo(
    () =>
      completedLogs
        .filter((log) => log.reflection)
        .slice(0, 8)
        .map((log) => log.reflection!),
    [completedLogs],
  );
  const memberProgressScores = useMemo(
    () =>
      computeMemberProgressScores({
        completedLogDates,
        completedSessions: completedLogs.length,
        nowDate,
        streakWeeks: memberProgress.streakWeeks,
        achievedLevel: memberProgress.achievedLevel,
        recentStreakWeeks: memberProgress.recentStreakWeeks,
        sessionsPerWeekTarget: sessionsPerWeekTarget || undefined,
        plannedThisWeek: homeWeeklySummary.plannedThisWeek,
        completedThisWeek: homeWeeklySummary.completedThisWeek,
        recentReflections: recentWorkoutReflections,
      }),
    [
      completedLogDates,
      completedLogs.length,
      homeWeeklySummary.completedThisWeek,
      homeWeeklySummary.plannedThisWeek,
      memberProgress.achievedLevel,
      memberProgress.recentStreakWeeks,
      memberProgress.streakWeeks,
      nowDate,
      recentWorkoutReflections,
      sessionsPerWeekTarget,
    ],
  );

  const personalRecords = useMemo(() => {
    const best = new Map<string, { weight: number; reps: number; score: number; achievedAt: Date | null }>();
    const sortedLogs = completedLogs
      .slice()
      .sort((a, b) => (parseStoredLogDate(a.date)?.getTime() ?? 0) - (parseStoredLogDate(b.date)?.getTime() ?? 0));

    sortedLogs.forEach((log) => {
      const achievedAt = parseStoredLogDate(log.date);
      (log.results ?? []).forEach((result) => {
        if (!result.completed) return;
        const weight = Number(result.performedWeight) || 0;
        const reps = Number(result.performedReps) || 0;
        const score = weight * Math.max(reps, 1);
        const current = best.get(result.exerciseName);
        if (!current || score > current.score) {
          best.set(result.exerciseName, { weight, reps, score, achievedAt: achievedAt ?? null });
        }
      });
    });

    const newRecordCutoffMs = nowTimestamp - 14 * 24 * 60 * 60 * 1000;
    return Array.from(best.entries())
      .map(([name, value]) => ({
        name,
        weight: value.weight,
        reps: value.reps,
        score: value.score,
        isNewRecord: value.achievedAt ? value.achievedAt.getTime() >= newRecordCutoffMs : false,
      }))
      .sort((a, b) => b.score - a.score);
  }, [completedLogs, nowTimestamp]);

  const [showAllPersonalRecords, setShowAllPersonalRecords] = useState(false);
  const [favoritePersonalRecordNames, setFavoritePersonalRecordNames] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(getUiPreferencesStorageKey(activeMember.id));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { favoritePersonalRecords?: string[] };
      return normalizeFavoritePersonalRecordNames(parsed.favoritePersonalRecords);
    } catch {
      return [];
    }
  });
  const [profileSaveInfo, setProfileSaveInfo] = useState<string | null>(null);
  const [progressShareStatus, setProgressShareStatus] = useState<string | null>(null);
  const [motusCardShareStatus, setMotusCardShareStatus] = useState<string | null>(null);
  const [prProgressExerciseName, setPrProgressExerciseName] = useState<string | null>(null);
  const [muscleSplitMetric, setMuscleSplitMetric] = useState<MuscleSplitMetric>("sets");
  const [muscleSplitPeriod, setMuscleSplitPeriod] = useState<MuscleSplitPeriod>(90);

  useEffect(() => {
    if (!profileSaveInfo) return;
    const id = window.setTimeout(() => setProfileSaveInfo(null), 4200);
    return () => window.clearTimeout(id);
  }, [profileSaveInfo]);

  const personalRecordExerciseNameSet = useMemo(
    () => new Set(personalRecords.map((record) => record.name)),
    [personalRecords],
  );
  const cleanedFavoritePersonalRecordNames = useMemo(
    () => favoritePersonalRecordNames.filter((name) => personalRecordExerciseNameSet.has(name)),
    [favoritePersonalRecordNames, personalRecordExerciseNameSet],
  );
  const personalRecordsPreview = useMemo(() => {
    if (showAllPersonalRecords) return personalRecords;
    const favorites = cleanedFavoritePersonalRecordNames
      .map((name) => personalRecords.find((record) => record.name === name) ?? null)
      .filter((record): record is PersonalRecordEntry => Boolean(record));
    const fallback = personalRecords.filter((record) => !cleanedFavoritePersonalRecordNames.includes(record.name));
    return [...favorites, ...fallback].slice(0, 3);
  }, [cleanedFavoritePersonalRecordNames, personalRecords, showAllPersonalRecords]);

  const exerciseGroupByName = useMemo(() => buildExerciseGroupByName(exercises), [exercises]);
  const muscleSplitStats = useMemo(
    () =>
      computeMuscleGroupStats(completedLogs, exerciseGroupByName, {
        periodDays: muscleSplitPeriod,
        nowTimestamp,
      }),
    [completedLogs, exerciseGroupByName, muscleSplitPeriod, nowTimestamp],
  );
  const progressShareLast7Days = useMemo(
    () => computeShareCardLast7DaysStats(completedLogs, nowTimestamp),
    [completedLogs, nowTimestamp],
  );

  const toggleFavoritePersonalRecord = useCallback(
    (recordName: string) => {
      const normalizedName = recordName.trim();
      if (!normalizedName) return;
      const pruned = cleanedFavoritePersonalRecordNames.filter((name) => personalRecordExerciseNameSet.has(name));
      let next: string[];
      let feedback: string;
      if (pruned.includes(normalizedName)) {
        next = pruned.filter((name) => name !== normalizedName);
        feedback = `Fjernet «${normalizedName}» fra fremhevede PR-er.`;
      } else if (pruned.length >= 3) {
        next = pruned;
        feedback = "Du kan ha maks tre fremhevede personlige rekorder.";
      } else {
        next = [...pruned, normalizedName];
        feedback = `La til «${normalizedName}» som fremhevet PR.`;
      }
      setFavoritePersonalRecordNames(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          getUiPreferencesStorageKey(activeMember.id),
          JSON.stringify({ favoritePersonalRecords: next }),
        );
      }
      setProfileSaveInfo(feedback);
    },
    [activeMember.id, cleanedFavoritePersonalRecordNames, personalRecordExerciseNameSet],
  );

  const sharePersonalRecordEntry = useCallback(
    async (record: { name: string; weight: number; reps: number }, previousEstimated1RmKg?: number) => {
      if (typeof window === "undefined") return;
      setMotusCardShareStatus(null);
      try {
        const outcome = await sharePersonalRecordCard({
          logoSrc: motusShareLogoSrc,
          memberDisplayName: activeMember.name,
          exerciseName: record.name,
          weightKg: record.weight,
          reps: record.reps,
          previousEstimated1RmKg,
        });
        setMotusCardShareStatus(motusShareStatusMessage(outcome));
      } catch {
        setMotusCardShareStatus("Kunne ikke dele akkurat nå.");
      }
    },
    [activeMember.name, motusShareLogoSrc],
  );

  const shareMonthlyProgressSummary = useCallback(async () => {
    const status = await shareMemberProgressWeeklySummary({
      completedLogs,
      nowTimestamp,
      memberDisplayName: activeMember.name,
    });
    setProgressShareStatus(status);
  }, [activeMember.name, completedLogs, nowTimestamp]);

  return (
    <>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
            Laster fremgang…
          </div>
        }
      >
        <MemberProgressPageView
          scores={memberProgressScores}
          memberProgress={memberProgress}
          streakWeeks={memberProgress.streakWeeks}
          completedLogDates={completedLogDates}
          completedLogs={completedLogs}
          nowTimestamp={nowTimestamp}
          personalRecords={personalRecords}
          personalRecordsPreview={personalRecordsPreview}
          showAllPersonalRecords={showAllPersonalRecords}
          onToggleShowAllPersonalRecords={() => setShowAllPersonalRecords((prev) => !prev)}
          favoritePersonalRecordNames={cleanedFavoritePersonalRecordNames}
          onToggleFavoritePersonalRecord={toggleFavoritePersonalRecord}
          onOpenProgressExercise={setPrProgressExerciseName}
          onSharePersonalRecord={(record) => void sharePersonalRecordEntry(record)}
          exercises={exercises}
          profileSaveInfo={profileSaveInfo}
          muscleSplitStats={muscleSplitStats}
          muscleSplitMetric={muscleSplitMetric}
          muscleSplitPeriod={muscleSplitPeriod}
          onMuscleSplitMetricChange={setMuscleSplitMetric}
          onMuscleSplitPeriodChange={setMuscleSplitPeriod}
          weeklySummaryStats={progressShareLast7Days}
          onShareWeeklySummary={() => void shareMonthlyProgressSummary()}
          weeklyShareStatus={progressShareStatus ?? motusCardShareStatus}
          onContinueTrainingFlow={() => setMemberTab("programs")}
        />
      </Suspense>

      {prProgressExerciseName ? (
        <PersonalRecordProgressModal
          exerciseName={prProgressExerciseName}
          logs={completedLogs}
          memberDisplayName={activeMember.name}
          shareLogoSrc={motusShareLogoSrc}
          onShareStatus={setMotusCardShareStatus}
          onClose={() => setPrProgressExerciseName(null)}
        />
      ) : null}
    </>
  );
}
