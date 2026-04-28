import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, MessageSquare, Plus, Repeat2, Sparkles, Target, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import { isLikelyValidBirthDate, normalizeBirthDate, normalizePhone } from "../app/validators";
import { supabaseClient } from "../services/supabaseClient";
import { isWebPushConfigurable, registerWebPushWithSupabase } from "../services/webPush";
import { Card, GradientButton, OutlineButton, SelectBox, StatCard, StatusMessage, TextArea, TextInput } from "../app/ui";
import { uid } from "../app/storage";
import type { ReplaceWorkoutExerciseGroupInput, StartCustomWorkoutInput, StartWorkoutModeOptions, UpdateMemberInput } from "../services/appRepository";
import { mergedPeriodPlanListForMember } from "../app/periodPlanMerge";
import type {
  ChatMessage,
  Exercise,
  Member,
  MemberTab,
  PeriodSchedulePlan,
  ProgramExercise,
  TrainingProgram,
  WeekdayPlanKey,
  WorkoutCelebration,
  WorkoutLog,
  WorkoutModeState,
  WorkoutReflection,
} from "../app/types";

type MemberPortalProps = {
  members: Member[];
  currentUserRole: "trainer" | "member";
  currentUserEmail: string;
  currentUserMemberId?: string;
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  memberViewId: string;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  updateMember: (input: UpdateMemberInput) => void;
  memberAvatarUrl: string;
  setMemberAvatarUrl: (url: string) => void;
  exercises: Exercise[];
  sendMemberMessage: (memberId: string, text: string) => void;
  workoutMode: WorkoutModeState | null;
  startWorkoutMode: (programId: string, options?: StartWorkoutModeOptions) => void;
  startCustomWorkout: (input: StartCustomWorkoutInput, options?: StartWorkoutModeOptions) => void;
  updateWorkoutExerciseResult: (
    exerciseId: string,
    field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline" | "completed",
    value: string | boolean,
  ) => void;
  replaceWorkoutExerciseGroup: (input: ReplaceWorkoutExerciseGroupInput) => void;
  removeWorkoutLogResult: (input: { logId: string; exerciseId: string }) => void;
  setWorkoutLogResults: (input: { logId: string; results: WorkoutLog["results"] }) => void;
  updateWorkoutModeNote: (note: string) => void;
  finishWorkoutMode: (input?: { reflection?: WorkoutReflection }) => void;
  logGroupWorkout: (input: { memberId: string; className: string; note?: string; reflection: WorkoutReflection }) => void;
  cancelWorkoutMode: () => void;
  workoutCelebration: WorkoutCelebration | null;
  dismissWorkoutCelebration: () => void;
  /** Periodeplaner fra Supabase (hydrate-member-data). */
  remoteMemberPeriodPlanRows?: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
};

const MEMBER_AVATAR_BUCKET = "exercise-images";
const MEMBER_AVATAR_PREFIX = "member-avatars";
const PERIOD_PLANS_STORAGE_KEY = "motus.trainer.periodPlansByMemberId";
const EMPTY_REMOTE_PERIOD_PLAN_ROWS: Array<{ memberId: string; plan: PeriodSchedulePlan }> = [];

/** Stored in members.personal_goals so økt/skritt/mål synkes på tvers av enheter. */
const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

type ProfileMetricsDraft = {
  sessionsPerWeekTarget: string;
  dailyStepsTarget: string;
  targetWeight: string;
  currentDailySteps: string;
};

function encodeMemberProfileMetrics(metrics: ProfileMetricsDraft): string {
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(metrics)}`;
}

function decodeMemberProfileMetrics(personalGoals: string | undefined): ProfileMetricsDraft | null {
  if (!personalGoals?.startsWith(PROFILE_METRICS_PREFIX)) return null;
  try {
    const parsed = JSON.parse(personalGoals.slice(PROFILE_METRICS_PREFIX.length)) as Partial<ProfileMetricsDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      sessionsPerWeekTarget: String(parsed.sessionsPerWeekTarget ?? ""),
      dailyStepsTarget: String(parsed.dailyStepsTarget ?? ""),
      targetWeight: String(parsed.targetWeight ?? ""),
      currentDailySteps: String(parsed.currentDailySteps ?? ""),
    };
  } catch {
    return null;
  }
}

/** Same canonical choice as useAppState.resolveMemberViewIdForUser — avoids feil rad ved duplikat-e-post. */
function pickCanonicalMemberRow(
  emailNormalized: string,
  membersList: Member[],
  programsList: TrainingProgram[],
  preferredMemberId?: string,
): Member | null {
  const candidates = membersList.filter(
    (m) => m.email.trim().toLowerCase() === emailNormalized && m.isActive !== false,
  );
  if (!candidates.length) return null;
  const pref = preferredMemberId?.trim();
  if (pref) {
    const hit = candidates.find((m) => m.id === pref);
    if (hit) return hit;
  }
  const programCountByMemberId = new Map<string, number>();
  programsList.forEach((program) => {
    programCountByMemberId.set(program.memberId, (programCountByMemberId.get(program.memberId) ?? 0) + 1);
  });
  return [...candidates].sort((a, b) => {
    const aCount = programCountByMemberId.get(a.id) ?? 0;
    const bCount = programCountByMemberId.get(b.id) ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.id.localeCompare(b.id);
  })[0];
}

function encodeEmailForPath(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "";
  const base64 = btoa(unescape(encodeURIComponent(normalized)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeNameForPath(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return "";
  const base64 = btoa(unescape(encodeURIComponent(normalized)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/data:(.*?);base64/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  try {
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

type IntervalTimerStep = {
  label: string;
  durationSeconds: number;
  speedHint: string;
  inclineHint: string;
  tone: "warmup" | "work" | "rest" | "cooldown";
};

export function MemberPortal(props: MemberPortalProps) {
  const groupWorkoutClassOptions = [
    "Smilepuls",
    "Sykkel 45",
    "Mølle 45",
    "Sterk",
    "Sirkeltrening",
    "Stram opp",
    "Dansemix",
    "Yoga",
    "Tabata",
    "Godt voksen",
    "Step styrke",
  ];
  const {
    members,
    currentUserRole,
    currentUserEmail,
    currentUserMemberId,
    programs,
    logs,
    messages,
    memberViewId,
    memberTab,
    setMemberTab,
    updateMember,
    memberAvatarUrl,
    setMemberAvatarUrl,
    exercises,
    sendMemberMessage,
    workoutMode,
    startWorkoutMode,
    startCustomWorkout,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutModeNote,
    finishWorkoutMode,
    logGroupWorkout,
    cancelWorkoutMode,
    workoutCelebration,
    dismissWorkoutCelebration,
    remoteMemberPeriodPlanRows = EMPTY_REMOTE_PERIOD_PLAN_ROWS,
  } = props;
  const [messageText, setMessageText] = useState("");
  const [profileSessionsPerWeekTarget, setProfileSessionsPerWeekTarget] = useState("");
  const [profileDailyStepsTarget, setProfileDailyStepsTarget] = useState("");
  const [profileTargetWeight, setProfileTargetWeight] = useState("");
  const [profileCurrentDailySteps, setProfileCurrentDailySteps] = useState("");
  const [microCelebrationsEnabled, setMicroCelebrationsEnabled] = useState(true);
  const [celebrationSoundEnabled, setCelebrationSoundEnabled] = useState(false);
  const [pushRegisterBusy, setPushRegisterBusy] = useState(false);
  const [pushRegisterStatus, setPushRegisterStatus] = useState<string | null>(null);
  const [customWorkoutSearch, setCustomWorkoutSearch] = useState("");
  const [customWorkoutLines, setCustomWorkoutLines] = useState<Array<{ key: string; exerciseId: string; sets: string; reps: string; weight: string }>>([]);
  const [goalMetricDraft, setGoalMetricDraft] = useState<"sessionsPerWeek" | "dailySteps" | "targetWeight">("sessionsPerWeek");
  const [goalMetricValueDraft, setGoalMetricValueDraft] = useState("");
  const [profileSaveInfo, setProfileSaveInfo] = useState<string | null>(null);
  const [memberNameDraft, setMemberNameDraft] = useState("");
  const [memberEmailDraft, setMemberEmailDraft] = useState("");
  const [memberPhoneDraft, setMemberPhoneDraft] = useState("");
  const [memberBirthDateDraft, setMemberBirthDateDraft] = useState("");
  const [memberGoalDraft, setMemberGoalDraft] = useState("");
  const [memberFocusDraft, setMemberFocusDraft] = useState("");
  const [memberInjuriesDraft, setMemberInjuriesDraft] = useState("");
  const [showReplacementOptions, setShowReplacementOptions] = useState(false);
  const [groupWorkoutClassName, setGroupWorkoutClassName] = useState("Smilepuls");
  const [groupWorkoutEnergyLevel, setGroupWorkoutEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutDifficultyLevel, setGroupWorkoutDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutMotivationLevel, setGroupWorkoutMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutNote, setGroupWorkoutNote] = useState("");
  const [groupWorkoutStatus, setGroupWorkoutStatus] = useState<string | null>(null);
  const [showGroupWorkoutLogger, setShowGroupWorkoutLogger] = useState(false);
  const [showWorkoutReflection, setShowWorkoutReflection] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [lastDeletedLogResult, setLastDeletedLogResult] = useState<{ logId: string; results: WorkoutLog["results"] } | null>(null);
  const [editingLoggedExerciseKey, setEditingLoggedExerciseKey] = useState<string | null>(null);
  const [editingLoggedExerciseDraft, setEditingLoggedExerciseDraft] = useState<{
    performedWeight: string;
    performedReps: string;
    performedDurationMinutes: string;
    performedSpeed: string;
    performedIncline: string;
    completed: boolean;
  } | null>(null);
  const [reflectionEnergyLevel, setReflectionEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionDifficultyLevel, setReflectionDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionMotivationLevel, setReflectionMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [reflectionNote, setReflectionNote] = useState("");
  const [workoutExerciseIndex, setWorkoutExerciseIndex] = useState(0);
  const [expandedRecentLogId, setExpandedRecentLogId] = useState<string | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [selectedCalendarLogId, setSelectedCalendarLogId] = useState<string | null>(null);
  const [progressShareStatus, setProgressShareStatus] = useState<string | null>(null);
  const [achievementCelebration, setAchievementCelebration] = useState<{ id: string; label: string } | null>(null);
  const [liveWorkoutCelebration, setLiveWorkoutCelebration] = useState<WorkoutCelebration | null>(null);
  const [seenUnlockedAchievementIds, setSeenUnlockedAchievementIds] = useState<string[]>([]);
  const [periodPlans, setPeriodPlans] = useState<PeriodSchedulePlan[]>([]);
  const [showPeriodPlanPanel, setShowPeriodPlanPanel] = useState(true);
  const [selectedPeriodPlanWeekNumber, setSelectedPeriodPlanWeekNumber] = useState<number | null>(null);
  const [periodPlanActionStatus, setPeriodPlanActionStatus] = useState<string | null>(null);
  const [selectedIntervalProgramId, setSelectedIntervalProgramId] = useState("");
  const [suggestedWeightOverridesByProgramExerciseId, setSuggestedWeightOverridesByProgramExerciseId] = useState<Record<string, string>>({});
  const [showIntervalTimerModal, setShowIntervalTimerModal] = useState(false);
  const [isIntervalTimerRunning, setIsIntervalTimerRunning] = useState(false);
  const [isIntervalTimerPaused, setIsIntervalTimerPaused] = useState(false);
  const [intervalTimerStepIndex, setIntervalTimerStepIndex] = useState(0);
  const [intervalTimerRemainingSeconds, setIntervalTimerRemainingSeconds] = useState(0);
  const [intervalTimerStatus, setIntervalTimerStatus] = useState<string | null>(null);
  const hasInitializedAchievementTracking = useRef(false);
  const workoutWeightInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const memberMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const nowDate = new Date();
    return new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  });
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const currentMemberByEmail =
    currentUserRole === "member" && normalizedCurrentUserEmail
      ? pickCanonicalMemberRow(normalizedCurrentUserEmail, members, programs, currentUserMemberId)
      : null;
  const editableMember =
    currentUserRole === "member"
      ? currentMemberByEmail ?? viewedMember ?? null
      : viewedMember ?? members[0] ?? null;
  const activeMemberId = editableMember?.id ?? memberViewId;
  const relatedMemberIds = useMemo(() => {
    const collectedIds = new Set<string>();
    // Member view should follow the authenticated member email first, not only the current memberViewId.
    // This keeps assigned programs visible even when member_id links are being synchronized.
    const primaryEmail = currentUserRole === "member" ? normalizedCurrentUserEmail : editableMember?.email.trim().toLowerCase() ?? "";
    let scopedByPrimaryEmail = false;
    if (primaryEmail) {
      const matchedByPrimary = members.filter((member) => member.email.trim().toLowerCase() === primaryEmail);
      scopedByPrimaryEmail = matchedByPrimary.length > 0;
      matchedByPrimary.forEach((member) => {
        collectedIds.add(member.id);
      });
    }
    const fallbackEmail = editableMember?.email.trim().toLowerCase() ?? "";
    if (fallbackEmail) {
      members
        .filter((member) => member.email.trim().toLowerCase() === fallbackEmail)
        .forEach((member) => {
          collectedIds.add(member.id);
        });
    }
    if (currentUserRole === "member" && !scopedByPrimaryEmail) {
      // Under strict RLS, member users may not be able to read the full members table.
      // In that case, derive visible member IDs from data rows the member can read.
      // When we already resolved profiles by email, do not widen scope from unrelated program rows.
      [...programs.map((program) => program.memberId), ...logs.map((log) => log.memberId), ...messages.map((message) => message.memberId)]
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => {
          collectedIds.add(id);
        });
    }
    if (currentUserRole === "member" && currentUserMemberId?.trim()) {
      collectedIds.add(currentUserMemberId.trim());
    }
    if (activeMemberId.trim()) collectedIds.add(activeMemberId.trim());
    const merged = Array.from(collectedIds);
    return merged.length ? merged : [activeMemberId];
  }, [members, currentUserRole, normalizedCurrentUserEmail, editableMember, activeMemberId, programs, logs, messages, currentUserMemberId]);
  const relatedMemberIdSet = useMemo(() => new Set(relatedMemberIds), [relatedMemberIds]);
  const relatedMembersForProfile = useMemo(
    () => members.filter((member) => relatedMemberIdSet.has(member.id)),
    [members, relatedMemberIdSet],
  );
  const dbProfileMetrics = useMemo(() => {
    for (const member of relatedMembersForProfile) {
      const decoded = decodeMemberProfileMetrics(member.personalGoals);
      if (decoded) return decoded;
    }
    return null;
  }, [relatedMembersForProfile]);
  const memberPrograms = programs.filter((program) => relatedMemberIdSet.has(program.memberId));
  const memberAssignedPrograms = useMemo(() => memberPrograms.filter((program) => !program.ephemeral), [memberPrograms]);
  const memberLogs = logs.filter((log) => relatedMemberIdSet.has(log.memberId));
  const memberMessages = messages.filter((message) => relatedMemberIdSet.has(message.memberId));
  const activeWorkoutProgram = workoutMode ? memberPrograms.find((program) => program.id === workoutMode.programId) ?? null : null;
  const nextProgram = memberAssignedPrograms[0] ?? null;
  const workoutResultGroups = useMemo(() => {
    if (!workoutMode) return [];
    const grouped = new Map<string, { exerciseName: string; plannedReps: string; plannedWeight: string; rows: WorkoutModeState["results"] }>();
    workoutMode.results.forEach((result) => {
      const groupId = result.programExerciseId ?? result.exerciseId;
      const existing = grouped.get(groupId);
      if (!existing) {
        grouped.set(groupId, {
          exerciseName: result.exerciseName,
          plannedReps: result.plannedReps,
          plannedWeight: result.plannedWeight,
          rows: [result],
        });
        return;
      }
      existing.rows.push(result);
    });
    return Array.from(grouped.entries()).map(([groupId, value]) => ({
      groupId,
      exerciseName: value.exerciseName,
      plannedReps: value.plannedReps,
      plannedWeight: value.plannedWeight,
      rows: value.rows.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    }));
  }, [workoutMode]);
  const currentWorkoutGroup = workoutResultGroups[workoutExerciseIndex] ?? null;
  const exerciseByName = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise])),
    [exercises],
  );
  const replacementCandidates = useMemo(() => {
    if (!activeWorkoutProgram || !currentWorkoutGroup) return [] as Exercise[];
    const sourceProgramExercise = activeWorkoutProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
    if (!sourceProgramExercise) return [];
    const sourceExercise = exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
    if (!sourceExercise) return [];
    const sameGroup = exercises.filter(
      (exercise) =>
        exercise.id !== sourceExercise.id &&
        exercise.group.trim().toLowerCase() === sourceExercise.group.trim().toLowerCase() &&
        exercise.category === sourceExercise.category
    );
    if (sameGroup.length > 0) return sameGroup;
    return exercises.filter((exercise) => exercise.id !== sourceExercise.id && exercise.category === sourceExercise.category);
  }, [activeWorkoutProgram, currentWorkoutGroup, exercises]);
  const currentWorkoutExerciseImageUrl = useMemo(() => {
    if (!currentWorkoutGroup) return "";
    if (activeWorkoutProgram) {
      const sourceProgramExercise = activeWorkoutProgram.exercises.find((exercise) => exercise.id === currentWorkoutGroup.groupId);
      if (sourceProgramExercise) {
        const sourceExercise = exercises.find((exercise) => exercise.id === sourceProgramExercise.exerciseId) ?? null;
        if (sourceExercise?.imageUrl) return sourceExercise.imageUrl;
      }
    }
    const byName = exerciseByName.get(currentWorkoutGroup.exerciseName.trim().toLowerCase());
    return byName?.imageUrl ?? "";
  }, [activeWorkoutProgram, currentWorkoutGroup, exerciseByName, exercises]);
  const now = new Date();
  const exerciseCategoryById = useMemo(() => {
    const byId = new Map<string, Exercise["category"]>();
    exercises.forEach((exercise) => {
      byId.set(exercise.id, exercise.category);
    });
    return byId;
  }, [exercises]);
  const intervalPrograms = useMemo(
    () =>
      memberAssignedPrograms.filter((program) => {
        if (program.exercises.length === 0) return false;
        return program.exercises.every((exercise) => {
          const category = exerciseCategoryById.get(exercise.exerciseId);
          const hasTimedStep = Number(exercise.durationMinutes) > 0;
          return category === "Kondisjon" && hasTimedStep;
        });
      }),
    [memberAssignedPrograms, exerciseCategoryById],
  );
  const intervalProgramIdSet = useMemo(() => new Set(intervalPrograms.map((program) => program.id)), [intervalPrograms]);
  const activeIntervalProgram = useMemo(
    () => intervalPrograms.find((program) => program.id === selectedIntervalProgramId) ?? intervalPrograms[0] ?? null,
    [intervalPrograms, selectedIntervalProgramId],
  );
  const intervalProgramSteps = useMemo(() => {
    if (!activeIntervalProgram) return [] as IntervalTimerStep[];
    return activeIntervalProgram.exercises.flatMap((exercise, index) => {
      const workDurationSeconds = Math.max(0, Math.round((Number(exercise.durationMinutes) || 0) * 60));
      const rawRestValue = Number(exercise.restSeconds) || 0;
      const normalizedRestSeconds =
        rawRestValue > 0 && rawRestValue <= 15
          ? Math.round(rawRestValue * 60)
          : Math.round(rawRestValue);
      const steps: IntervalTimerStep[] = [];
      if (workDurationSeconds > 0) {
        const lowerName = exercise.exerciseName.toLowerCase();
        const tone: IntervalTimerStep["tone"] =
          lowerName.includes("oppvarm") ? "warmup" : lowerName.includes("nedjogg") ? "cooldown" : "work";
        steps.push({
          label: exercise.exerciseName || `Intervall ${index + 1}`,
          durationSeconds: workDurationSeconds,
          speedHint: exercise.speed ? `${exercise.speed} km/t` : "-",
          inclineHint: exercise.incline ? `${exercise.incline}%` : "-",
          tone,
        });
      }
      const isClassic4x4Drag = /4x4/i.test(activeIntervalProgram.title) && /drag/i.test(exercise.exerciseName);
      const restDurationSeconds = normalizedRestSeconds > 0 ? normalizedRestSeconds : isClassic4x4Drag ? 180 : 0;
      if (restDurationSeconds > 0 && index < activeIntervalProgram.exercises.length - 1) {
        steps.push({
          label: `Pause etter ${exercise.exerciseName || `intervall ${index + 1}`}`,
          durationSeconds: restDurationSeconds,
          speedHint: "Rolig",
          inclineHint: "0-1%",
          tone: "rest",
        });
      }
      return steps;
    });
  }, [activeIntervalProgram]);
  const currentIntervalProgramStep = intervalProgramSteps[intervalTimerStepIndex] ?? null;
  const intervalTimerTotalSeconds = useMemo(
    () => intervalProgramSteps.reduce((sum, step) => sum + step.durationSeconds, 0),
    [intervalProgramSteps],
  );
  const intervalTimerElapsedSeconds = useMemo(() => {
    const completed = intervalProgramSteps
      .slice(0, intervalTimerStepIndex)
      .reduce((sum, step) => sum + step.durationSeconds, 0);
    const currentStepDuration = currentIntervalProgramStep?.durationSeconds ?? 0;
    const currentProgress = Math.max(0, currentStepDuration - intervalTimerRemainingSeconds);
    return Math.min(intervalTimerTotalSeconds, completed + currentProgress);
  }, [intervalProgramSteps, intervalTimerStepIndex, currentIntervalProgramStep, intervalTimerRemainingSeconds, intervalTimerTotalSeconds]);
  const intervalTimerProgressPercent =
    intervalTimerTotalSeconds > 0 ? Math.min(100, Math.round((intervalTimerElapsedSeconds / intervalTimerTotalSeconds) * 100)) : 0;
  const currentWeekdayKey: WeekdayPlanKey = useMemo(() => {
    const day = now.getDay();
    if (day === 0) return "sunday";
    if (day === 1) return "monday";
    if (day === 2) return "tuesday";
    if (day === 3) return "wednesday";
    if (day === 4) return "thursday";
    if (day === 5) return "friday";
    return "saturday";
  }, [now]);
  const activePeriodPlan = periodPlans[0] ?? null;
  const activePeriodPlanStartDate = activePeriodPlan ? parseDateOnly(activePeriodPlan.startDate) : null;
  const activePeriodWeekIndex = useMemo(() => {
    if (!activePeriodPlan || !activePeriodPlanStartDate) return null;
    const daysSinceStart = Math.floor((getStartOfDay(now).getTime() - getStartOfDay(activePeriodPlanStartDate).getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceStart < 0) return 0;
    const weekIndex = Math.floor(daysSinceStart / 7);
    if (weekIndex >= activePeriodPlan.weeks) return null;
    return weekIndex;
  }, [activePeriodPlan, activePeriodPlanStartDate, now]);
  const activeWeeklyPlan = useMemo(() => {
    if (!activePeriodPlan || activePeriodWeekIndex === null) return null;
    return (
      activePeriodPlan.weeklyPlans.find((week) => week.weekNumber === activePeriodWeekIndex + 1) ??
      activePeriodPlan.weeklyPlans[activePeriodWeekIndex] ??
      null
    );
  }, [activePeriodPlan, activePeriodWeekIndex]);
  const displayedPeriodWeek = useMemo(() => {
    if (!activePeriodPlan) return null;
    const weeks = activePeriodPlan.weeklyPlans ?? [];
    if (!weeks.length) return null;
    const fallbackWeekNumber = activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1;
    const preferredWeekNumber = selectedPeriodPlanWeekNumber ?? fallbackWeekNumber;
    return (
      weeks.find((week) => week.weekNumber === preferredWeekNumber) ??
      weeks.find((week) => week.weekNumber === fallbackWeekNumber) ??
      weeks[0] ??
      null
    );
  }, [activePeriodPlan, activePeriodWeekIndex, selectedPeriodPlanWeekNumber]);
  const todayPlanEntry = activeWeeklyPlan?.days[currentWeekdayKey]?.trim() ?? "";
  const todayProgramMatch = todayPlanEntry
    ? memberAssignedPrograms.find((program) => program.title.trim().toLowerCase() === todayPlanEntry.toLowerCase()) ?? null
    : null;

  function resolveSuggestedWorkoutWeight(programExercise: TrainingProgram["exercises"][number]): string {
    const override = suggestedWeightOverridesByProgramExerciseId[programExercise.id];
    if (override !== undefined) return override;
    const fromHistory = suggestedWeightByExerciseName.get(programExercise.exerciseName.trim().toLowerCase());
    if (fromHistory !== undefined) return fromHistory;
    return programExercise.weight;
  }

  function buildStartWorkoutOptions(program: TrainingProgram): StartWorkoutModeOptions {
    const suggestedWeightByProgramExerciseId: Record<string, string> = {};
    program.exercises.forEach((exercise) => {
      if (Number(exercise.durationMinutes) > 0) return;
      const suggestedWeight = resolveSuggestedWorkoutWeight(exercise).trim();
      if (!suggestedWeight) return;
      suggestedWeightByProgramExerciseId[exercise.id] = suggestedWeight;
    });
    return { suggestedWeightByProgramExerciseId };
  }

  const customWorkoutExerciseOptions = useMemo(() => {
    const q = customWorkoutSearch.trim().toLowerCase();
    const list = q
      ? exercises.filter(
          (ex) =>
            ex.name.toLowerCase().includes(q) ||
            ex.group.toLowerCase().includes(q) ||
            ex.equipment.toLowerCase().includes(q),
        )
      : exercises;
    return list.slice(0, 28);
  }, [exercises, customWorkoutSearch]);

  function addCustomWorkoutLine(exerciseId: string) {
    if (!exerciseId.trim()) return;
    if (customWorkoutLines.some((line) => line.exerciseId === exerciseId)) return;
    setCustomWorkoutLines((prev) => [...prev, { key: uid("row"), exerciseId: exerciseId.trim(), sets: "3", reps: "10", weight: "" }]);
  }

  function removeCustomWorkoutLine(key: string) {
    setCustomWorkoutLines((prev) => prev.filter((line) => line.key !== key));
  }

  function updateCustomWorkoutLine(key: string, patch: Partial<{ exerciseId: string; sets: string; reps: string; weight: string }>) {
    setCustomWorkoutLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleStartCustomWorkout() {
    if (!activeMemberId.trim()) return;
    const built: ProgramExercise[] = [];
    for (const line of customWorkoutLines) {
      const ex = exercises.find((e) => e.id === line.exerciseId);
      if (!ex) continue;
      built.push({
        id: uid("prog-ex"),
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: line.sets.trim() || "3",
        reps: line.reps.trim() || "10",
        weight: line.weight.trim(),
        restSeconds: "60",
        notes: "",
      });
    }
    if (!built.length) return;
    const tempProgram: TrainingProgram = {
      id: "",
      memberId: activeMemberId,
      title: "Egen økt",
      goal: "",
      notes: "",
      createdAt: "",
      exercises: built,
    };
    startCustomWorkout({ memberId: activeMemberId, exercises: built }, buildStartWorkoutOptions(tempProgram));
    setCustomWorkoutLines([]);
    setCustomWorkoutSearch("");
  }

  function normalizeBirthDateToDdMmYyyy(value: string): string {
    return normalizeBirthDate(value);
  }

  async function extractFunctionErrorDetails(error: unknown): Promise<string> {
    if (!error || typeof error !== "object") return "";
    const candidate = error as { message?: unknown; context?: { json?: () => Promise<unknown> } };
    if (typeof candidate.context?.json === "function") {
      try {
        const payload = await candidate.context.json();
        if (payload && typeof payload === "object") {
          const withError = payload as { error?: unknown; message?: unknown };
          if (typeof withError.error === "string" && withError.error.trim()) return withError.error;
          if (typeof withError.message === "string" && withError.message.trim()) return withError.message;
        }
      } catch {
        // Fall through to message fallback.
      }
    }
    if (typeof candidate.message === "string" && candidate.message.trim()) return candidate.message;
    return "";
  }

  async function syncProfileToPtBackend(payload: {
    email: string;
    emails: string[];
    memberId: string;
    memberIds: string[];
    expectedMinUpdated: number;
    changes: {
      name: string;
      phone: string;
      birthDate: string;
      goal: string;
      focus: string;
      injuries: string;
      /** MOTUS_PROFILE_V1 + JSON; synker økter/skritt osv. */
      personalGoals: string;
    };
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!supabaseClient) return { ok: false, message: "Supabase er ikke konfigurert." };

    const invoked = await supabaseClient.functions.invoke("update-member-profile", { body: payload });
    if (!invoked.error) {
      const updated =
        invoked.data && typeof invoked.data === "object" && "updated" in invoked.data
          ? Number((invoked.data as { updated?: unknown }).updated ?? 0)
          : 0;
      if (updated >= payload.expectedMinUpdated) return { ok: true };
      return {
        ok: false,
        message: `Sync oppdaterte ${updated} av ${payload.expectedMinUpdated} forventede rader.`,
      };
    }

    const invokeDetails = await extractFunctionErrorDetails(invoked.error);
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token ?? "";
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
      return { ok: false, message: invokeDetails || invoked.error.message || "Kunne ikke nå sync-tjenesten." };
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/update-member-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as { error?: string; message?: string; updated?: number } | null;
      if (response.ok) {
        const updated = Number(body?.updated ?? 0);
        if (updated >= payload.expectedMinUpdated) return { ok: true };
        return {
          ok: false,
          message: `Sync oppdaterte ${updated} av ${payload.expectedMinUpdated} forventede rader.`,
        };
      }
      const fallbackError = body?.error || body?.message || `HTTP ${response.status}`;
      const directUpdate = await supabaseClient
        .from("members")
        .update({
          name: payload.changes.name.trim(),
          email: payload.email.trim().toLowerCase(),
          phone: payload.changes.phone.trim(),
          birth_date: payload.changes.birthDate.trim(),
          goal: payload.changes.goal.trim(),
          focus: payload.changes.focus.trim(),
          injuries: payload.changes.injuries.trim(),
          personal_goals: payload.changes.personalGoals.trim(),
        })
        .in("id", payload.memberIds)
        .select("id");
      const fallbackUpdated = directUpdate.data?.length ?? 0;
      if (!directUpdate.error && fallbackUpdated >= payload.expectedMinUpdated) return { ok: true };
      return {
        ok: false,
        message: `${fallbackError} | fallback oppdaterte ${fallbackUpdated} av ${payload.expectedMinUpdated}${
          directUpdate.error ? ` (${directUpdate.error.message})` : ""
        }`,
      };
    } catch {
      const directUpdate = await supabaseClient
        .from("members")
        .update({
          name: payload.changes.name.trim(),
          email: payload.email.trim().toLowerCase(),
          phone: payload.changes.phone.trim(),
          birth_date: payload.changes.birthDate.trim(),
          goal: payload.changes.goal.trim(),
          focus: payload.changes.focus.trim(),
          injuries: payload.changes.injuries.trim(),
          personal_goals: payload.changes.personalGoals.trim(),
        })
        .in("id", payload.memberIds)
        .select("id");
      const fallbackUpdated = directUpdate.data?.length ?? 0;
      if (!directUpdate.error && fallbackUpdated >= payload.expectedMinUpdated) return { ok: true };
      return {
        ok: false,
        message: `${invokeDetails || invoked.error.message || "Kunne ikke nå sync-tjenesten."} | fallback oppdaterte ${fallbackUpdated} av ${payload.expectedMinUpdated}${
          directUpdate.error ? ` (${directUpdate.error.message})` : ""
        }`,
      };
    }
  }

  function parseLogDate(value: string): Date | null {
    if (!value) return null;
    const isoCandidate = new Date(value);
    if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate;
    const parts = value.split(".");
    if (parts.length < 3) return null;
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);
    const parsed = new Date(year, month, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }
  function parseDateOnly(value: string): Date | null {
    if (!value) return null;
    const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) {
      const year = Number(isoLike[1]);
      const month = Number(isoLike[2]) - 1;
      const day = Number(isoLike[3]);
      const parsed = new Date(year, month, day);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    }
    return parseLogDate(value);
  }
  function getStartOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getWeekKey(date: Date): string {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    const firstDay = (firstThursday.getDay() + 6) % 7;
    firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
    const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${d.getFullYear()}-${String(week).padStart(2, "0")}`;
  }
  const completedLogs = memberLogs.filter((log) => log.status === "Fullført");
  const latestCompletedLog = completedLogs[0] ?? null;
  const suggestedWeightByExerciseName = useMemo(() => {
    const byExerciseName = new Map<string, string>();
    const sorted = [...completedLogs].sort((a, b) => {
      const aDate = parseLogDate(a.date)?.getTime() ?? 0;
      const bDate = parseLogDate(b.date)?.getTime() ?? 0;
      return bDate - aDate;
    });
    sorted.forEach((log) => {
      (log.results ?? []).forEach((result) => {
        if (!result.completed) return;
        const normalizedName = result.exerciseName.trim().toLowerCase();
        if (!normalizedName || byExerciseName.has(normalizedName)) return;
        const parsedWeight = Number(result.performedWeight);
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return;
        byExerciseName.set(normalizedName, String(parsedWeight));
      });
    });
    return byExerciseName;
  }, [completedLogs]);
  const completedLogDates = completedLogs.map((log) => parseLogDate(log.date)).filter((date): date is Date => Boolean(date));
  const uniqueTrainingDays = new Set(completedLogDates.map((date) => date.toDateString())).size;
  const estimatedSessionsThisMonth = completedLogDates.filter((date) => date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()).length;
  const trainingWeekKeys = Array.from(new Set(completedLogDates.map((date) => getWeekKey(date)))).sort().reverse();
  const streakWeeks = useMemo(() => {
    if (!trainingWeekKeys.length) return 0;
    let streak = 1;
    let current = trainingWeekKeys[0];
    for (let i = 1; i < trainingWeekKeys.length; i += 1) {
      const [year, week] = current.split("-").map(Number);
      const prevWeekDate = new Date(year, 0, 4 + (week - 2) * 7);
      const expectedPrev = getWeekKey(prevWeekDate);
      if (trainingWeekKeys[i] !== expectedPrev) break;
      streak += 1;
      current = trainingWeekKeys[i];
    }
    return streak;
  }, [trainingWeekKeys]);
  const achievementMaxLevel = 10;
  const achievedLevel = useMemo(() => {
    let highestUnlockedLevel = 0;
    for (let level = 1; level <= achievementMaxLevel; level += 1) {
      const sessionsTarget = 10 + (level - 1) * 5;
      const streakTarget = 3 + (level - 1);
      const trainingDaysTarget = 5 + (level - 1) * 2;
      const firstSessionTarget = level;
      const isLevelUnlocked =
        completedLogs.length >= sessionsTarget &&
        streakWeeks >= streakTarget &&
        uniqueTrainingDays >= trainingDaysTarget &&
        completedLogs.length >= firstSessionTarget;
      if (!isLevelUnlocked) break;
      highestUnlockedLevel = level;
    }
    return highestUnlockedLevel;
  }, [completedLogs.length, streakWeeks, uniqueTrainingDays]);
  const achievementLevel = achievedLevel >= achievementMaxLevel ? achievementMaxLevel : achievedLevel + 1;
  const hasCompletedAllAchievementLevels = achievedLevel >= achievementMaxLevel;
  const achievements = useMemo(() => {
    const firstSessionTarget = achievementLevel;
    const streakTarget = 3 + (achievementLevel - 1);
    const sessionsTarget = 10 + (achievementLevel - 1) * 5;
    const trainingDaysTarget = 5 + (achievementLevel - 1) * 2;
    const levelHint = `(Nivå ${achievementLevel})`;
    const items: Array<{ id: string; label: string; hint: string; unlocked: boolean; current: number; target: number; icon: string }> = [
      {
        id: `first-session-level-${achievementLevel}`,
        label: "Økter logget",
        hint: `${levelHint} Logg minst ${firstSessionTarget} fullførte økter`,
        unlocked: completedLogs.length >= firstSessionTarget,
        current: completedLogs.length,
        target: firstSessionTarget,
        icon: "🚀",
      },
      {
        id: `streak-level-${achievementLevel}`,
        label: "Streak",
        hint: `${levelHint} Hold flyt i ${streakTarget} uker`,
        unlocked: streakWeeks >= streakTarget,
        current: streakWeeks,
        target: streakTarget,
        icon: "🔥",
      },
      {
        id: `sessions-level-${achievementLevel}`,
        label: "Total økter",
        hint: `${levelHint} Fullfør totalt ${sessionsTarget} økter`,
        unlocked: completedLogs.length >= sessionsTarget,
        current: completedLogs.length,
        target: sessionsTarget,
        icon: "💪",
      },
      {
        id: `days-level-${achievementLevel}`,
        label: "Treningsdager",
        hint: `${levelHint} Tren på ${trainingDaysTarget} ulike dager`,
        unlocked: uniqueTrainingDays >= trainingDaysTarget,
        current: uniqueTrainingDays,
        target: trainingDaysTarget,
        icon: "📅",
      },
    ];
    return items;
  }, [achievementLevel, completedLogs.length, streakWeeks, uniqueTrainingDays]);

  const calendarDayLoad = useMemo(() => {
    const byDay = new Map<number, number>();
    completedLogDates.forEach((date) => {
      if (date.getMonth() !== calendarMonth.getMonth() || date.getFullYear() !== calendarMonth.getFullYear()) return;
      const day = date.getDate();
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    });
    return byDay;
  }, [completedLogDates, calendarMonth]);
  const calendarLogsByDay = useMemo(() => {
    const byDay = new Map<number, WorkoutLog[]>();
    completedLogs.forEach((log) => {
      const parsed = parseLogDate(log.date);
      if (!parsed) return;
      if (parsed.getMonth() !== calendarMonth.getMonth() || parsed.getFullYear() !== calendarMonth.getFullYear()) return;
      const day = parsed.getDate();
      const previous = byDay.get(day) ?? [];
      byDay.set(day, [...previous, log]);
    });
    return byDay;
  }, [completedLogs, calendarMonth]);
  const calendarPlannedEntriesByDay = useMemo(() => {
    const weekdayIndexByKey: Record<WeekdayPlanKey, number> = {
      monday: 0,
      tuesday: 1,
      wednesday: 2,
      thursday: 3,
      friday: 4,
      saturday: 5,
      sunday: 6,
    };
    const byDay = new Map<number, string[]>();
    periodPlans.forEach((plan) => {
      const startDate = parseDateOnly(plan.startDate);
      if (!startDate) return;
      (plan.weeklyPlans ?? []).forEach((week) => {
        const weekIndex = Math.max(0, (week.weekNumber || 1) - 1);
        (Object.keys(weekdayIndexByKey) as WeekdayPlanKey[]).forEach((weekdayKey) => {
          const plannedEntry = week.days[weekdayKey]?.trim() ?? "";
          if (!plannedEntry) return;
          const dayOffset = weekIndex * 7 + weekdayIndexByKey[weekdayKey];
          const plannedDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayOffset);
          if (plannedDate.getMonth() !== calendarMonth.getMonth() || plannedDate.getFullYear() !== calendarMonth.getFullYear()) return;
          const day = plannedDate.getDate();
          const previous = byDay.get(day) ?? [];
          byDay.set(day, [...previous, plannedEntry]);
        });
      });
    });
    return byDay;
  }, [periodPlans, calendarMonth]);
  const calendarDayStatusByDay = useMemo(() => {
    const statusByDay = new Map<number, "completed" | "planned" | "missed">();
    const todayStart = getStartOfDay(now);
    calendarPlannedEntriesByDay.forEach((_entries, day) => {
      const candidateDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const hasCompleted = calendarDayLoad.has(day);
      if (hasCompleted) {
        statusByDay.set(day, "completed");
        return;
      }
      if (candidateDate.getTime() < todayStart.getTime()) {
        statusByDay.set(day, "missed");
      } else {
        statusByDay.set(day, "planned");
      }
    });
    calendarDayLoad.forEach((_count, day) => {
      statusByDay.set(day, "completed");
    });
    return statusByDay;
  }, [calendarPlannedEntriesByDay, calendarDayLoad, calendarMonth, now]);
  const selectedCalendarLogs = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return calendarLogsByDay.get(selectedCalendarDay) ?? [];
  }, [calendarLogsByDay, selectedCalendarDay]);
  const selectedCalendarPlannedEntries = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return calendarPlannedEntriesByDay.get(selectedCalendarDay) ?? [];
  }, [calendarPlannedEntriesByDay, selectedCalendarDay]);
  const selectedCalendarLog = useMemo(() => {
    if (!selectedCalendarLogs.length) return null;
    if (!selectedCalendarLogId) return selectedCalendarLogs[0];
    return selectedCalendarLogs.find((log) => log.id === selectedCalendarLogId) ?? selectedCalendarLogs[0];
  }, [selectedCalendarLogs, selectedCalendarLogId]);
  const maxCalendarDayLoad = Math.max(0, ...Array.from(calendarDayLoad.values()));
  const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarMonthLabel = calendarMonth.toLocaleDateString("no-NO", {
    month: "long",
    year: "numeric",
  });
  const monthOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const calendarCells = Array.from({ length: monthOffset + daysInMonth }, (_, index) => {
    const day = index - monthOffset + 1;
    if (day <= 0) return null;
    return day;
  });

  const personalRecords = useMemo(() => {
    const best = new Map<string, { weight: number; reps: number; score: number }>();

    completedLogs.forEach((log) => {
      (log.results ?? []).forEach((r) => {
        if (!r.completed) return;
        const w = Number(r.performedWeight) || 0;
        const reps = Number(r.performedReps) || 0;
        const score = w * Math.max(reps, 1);
        const current = best.get(r.exerciseName);
        if (!current || score > current.score) {
          best.set(r.exerciseName, { weight: w, reps, score });
        }
      });
    });

    return Array.from(best.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [completedLogs]);
  const progressionSuggestions = useMemo(() => {
    if (!latestCompletedLog?.results?.length) return [] as Array<{ exerciseName: string; recommendation: string; reason: string }>;
    const previousLogs = completedLogs.filter((log) => log.id !== latestCompletedLog.id);
    function getBestSetFromResults(results: WorkoutLog["results"] | undefined, exerciseName: string): { weight: number; reps: number } | null {
      if (!results?.length) return null;
      let best: { weight: number; reps: number } | null = null;
      results.forEach((row) => {
        if (!row.completed || row.exerciseName !== exerciseName) return;
        if (row.exerciseCategory === "Kondisjon") return;
        const weight = Number(row.performedWeight) || 0;
        const reps = Number(row.performedReps) || 0;
        if (weight <= 0 || reps <= 0) return;
        if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) best = { weight, reps };
      });
      return best;
    }
    const exerciseNames = Array.from(
      new Set(
        latestCompletedLog.results
          .filter((row) => row.completed && row.exerciseCategory !== "Kondisjon")
          .map((row) => row.exerciseName),
      ),
    );
    return exerciseNames
      .map((exerciseName) => {
        const latestBest = getBestSetFromResults(latestCompletedLog.results, exerciseName);
        if (!latestBest) return null;
        let previousBest: { weight: number; reps: number } | null = null;
        previousLogs.forEach((log) => {
          const candidate = getBestSetFromResults(log.results, exerciseName);
          if (!candidate) return;
          if (!previousBest || candidate.weight > previousBest.weight || (candidate.weight === previousBest.weight && candidate.reps > previousBest.reps)) {
            previousBest = candidate;
          }
        });
        if (!previousBest) {
          return {
            exerciseName,
            recommendation: `Neste gang: prøv ${Number((latestBest.weight + 2.5).toFixed(1))} kg`,
            reason: "Første logg for denne øvelsen - fin base å bygge videre på.",
          };
        }
        if (latestBest.weight > previousBest.weight || (latestBest.weight === previousBest.weight && latestBest.reps >= 10)) {
          return {
            exerciseName,
            recommendation: `Neste gang: prøv ${Number((latestBest.weight + 2.5).toFixed(1))} kg`,
            reason: "Du løfter tyngre/sterkere enn før - klar for liten progresjon.",
          };
        }
        const targetReps = Math.max(10, previousBest.reps);
        return {
          exerciseName,
          recommendation: `Neste gang: hold ${latestBest.weight} kg og jobb mot ${targetReps} reps`,
          reason: "Bygg mer reps på samme vekt før neste hopp.",
        };
      })
      .filter((item): item is { exerciseName: string; recommendation: string; reason: string } => Boolean(item))
      .slice(0, 5);
  }, [completedLogs, latestCompletedLog]);
  const activeCelebration = liveWorkoutCelebration ?? workoutCelebration;
  const shouldShowCelebration = Boolean(
    microCelebrationsEnabled && activeCelebration && activeCelebration.memberId === activeMemberId
  );

  function getProfileStorageKey(memberId: string): string {
    return `motus.member.profile.${memberId}`;
  }
  function getUiPreferencesStorageKey(memberId: string): string {
    return `motus.member.uiPrefs.${memberId}`;
  }
  function playCelebrationSound() {
    if (typeof window === "undefined" || !celebrationSoundEnabled) return;
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const nowTime = context.currentTime;
    const tones = [523.25, 659.25, 783.99];
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, nowTime);
      gain.gain.setValueAtTime(0.0001, nowTime);
      const start = nowTime + index * 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    window.setTimeout(() => {
      void context.close();
    }, 400);
  }
  function formatSeconds(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const minutesPart = String(Math.floor(safe / 60)).padStart(2, "0");
    const secondsPart = String(safe % 60).padStart(2, "0");
    return `${minutesPart}:${secondsPart}`;
  }

  function getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = (start.getDay() + 6) % 7;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day);
    return start;
  }

  useEffect(() => {
    if (!editableMember) return;
    setProfileSaveInfo(null);
    const fallback: ProfileMetricsDraft = {
      sessionsPerWeekTarget: "",
      dailyStepsTarget: "",
      targetWeight: "",
      currentDailySteps: "",
    };

    const fromDb = dbProfileMetrics;

    function applyMemberCoreDrafts() {
      setMemberNameDraft(editableMember.name);
      setMemberEmailDraft(editableMember.email);
      setMemberPhoneDraft(editableMember.phone);
      setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
      setMemberGoalDraft(editableMember.goal);
      setMemberFocusDraft(editableMember.focus);
      setMemberInjuriesDraft(editableMember.injuries);
    }

    function applyMetricDrafts(metrics: ProfileMetricsDraft) {
      setProfileSessionsPerWeekTarget(metrics.sessionsPerWeekTarget);
      setProfileDailyStepsTarget(metrics.dailyStepsTarget);
      setProfileTargetWeight(metrics.targetWeight);
      setProfileCurrentDailySteps(metrics.currentDailySteps);
    }

    if (typeof window === "undefined") {
      applyMetricDrafts(fromDb ?? fallback);
      applyMemberCoreDrafts();
      return;
    }

    if (fromDb) {
      applyMetricDrafts(fromDb);
      applyMemberCoreDrafts();
      try {
        window.localStorage.setItem(getProfileStorageKey(editableMember.id), JSON.stringify(fromDb));
      } catch {
        /* ignore quota / private mode quirks */
      }
      return;
    }

    try {
      const raw = window.localStorage.getItem(getProfileStorageKey(editableMember.id));
      if (!raw) {
        applyMetricDrafts(fallback);
        applyMemberCoreDrafts();
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ProfileMetricsDraft>;
      applyMetricDrafts({
        sessionsPerWeekTarget: parsed.sessionsPerWeekTarget ?? "",
        dailyStepsTarget: parsed.dailyStepsTarget ?? "",
        targetWeight: parsed.targetWeight ?? "",
        currentDailySteps: parsed.currentDailySteps ?? "",
      });
      applyMemberCoreDrafts();
      const localHasAnyMetric =
        Boolean((parsed.sessionsPerWeekTarget ?? "").toString().trim()) ||
        Boolean((parsed.dailyStepsTarget ?? "").toString().trim()) ||
        Boolean((parsed.targetWeight ?? "").toString().trim()) ||
        Boolean((parsed.currentDailySteps ?? "").toString().trim());
      if (localHasAnyMetric) {
        const targetIds = Array.from(new Set([editableMember.id, ...relatedMemberIds].filter(Boolean)));
        // One-time heal path: migrate legacy local-only metrics into DB-backed personal_goals.
        const encoded = encodeMemberProfileMetrics({
          sessionsPerWeekTarget: String(parsed.sessionsPerWeekTarget ?? ""),
          dailyStepsTarget: String(parsed.dailyStepsTarget ?? ""),
          targetWeight: String(parsed.targetWeight ?? ""),
          currentDailySteps: String(parsed.currentDailySteps ?? ""),
        });
        targetIds.forEach((memberId) => {
          updateMember({
            memberId,
            changes: {
              personalGoals: encoded,
            },
          });
        });
      }
    } catch {
      applyMetricDrafts(fallback);
      applyMemberCoreDrafts();
    }
  }, [editableMember, dbProfileMetrics, relatedMemberIds, updateMember]);

  useEffect(() => {
    if (!activePeriodPlan) {
      setSelectedPeriodPlanWeekNumber(null);
      return;
    }
    const fallbackWeekNumber = activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1;
    setSelectedPeriodPlanWeekNumber(fallbackWeekNumber);
  }, [activePeriodPlan?.id, activePeriodWeekIndex]);

  useEffect(() => {
    if (!profileSaveInfo) return;
    if (profileSaveInfo.toLowerCase().includes("feilet")) return;
    const timer = window.setTimeout(() => {
      setProfileSaveInfo(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [profileSaveInfo]);
  useEffect(() => {
    if (!periodPlanActionStatus) return;
    const timer = window.setTimeout(() => {
      setPeriodPlanActionStatus(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [periodPlanActionStatus]);
  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getUiPreferencesStorageKey(editableMember.id));
      if (!raw) {
        setMicroCelebrationsEnabled(true);
        setCelebrationSoundEnabled(false);
        return;
      }
      const parsed = JSON.parse(raw) as {
        microCelebrationsEnabled?: boolean;
        celebrationSoundEnabled?: boolean;
      };
      setMicroCelebrationsEnabled(parsed.microCelebrationsEnabled !== false);
      setCelebrationSoundEnabled(parsed.celebrationSoundEnabled === true);
    } catch {
      setMicroCelebrationsEnabled(true);
      setCelebrationSoundEnabled(false);
    }
  }, [editableMember?.id]);
  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    const payload = JSON.stringify({
      microCelebrationsEnabled,
      celebrationSoundEnabled,
    });
    window.localStorage.setItem(getUiPreferencesStorageKey(editableMember.id), payload);
  }, [editableMember?.id, microCelebrationsEnabled, celebrationSoundEnabled]);
  useEffect(() => {
    if (!microCelebrationsEnabled) return;
    if (!shouldShowCelebration && !achievementCelebration) return;
    playCelebrationSound();
  }, [shouldShowCelebration, achievementCelebration?.id, microCelebrationsEnabled, celebrationSoundEnabled]);
  useEffect(() => {
    if (memberTab !== "messages") return;
    const container = memberMessagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [memberTab, memberMessages.length]);
  useEffect(() => {
    let localByMember: Record<string, PeriodSchedulePlan[]> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(PERIOD_PLANS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, PeriodSchedulePlan[]>;
          if (parsed && typeof parsed === "object") {
            localByMember = parsed;
          }
        }
      } catch {
        localByMember = {};
      }
    }
    const combined = mergedPeriodPlanListForMember(relatedMemberIds, localByMember, remoteMemberPeriodPlanRows);
    combined.sort((a, b) => (parseDateOnly(b.startDate)?.getTime() ?? 0) - (parseDateOnly(a.startDate)?.getTime() ?? 0));
    setPeriodPlans(combined);
  }, [relatedMemberIds, remoteMemberPeriodPlanRows]);
  useEffect(() => {
    if (!activeIntervalProgram || isIntervalTimerRunning) return;
    const firstStep = intervalProgramSteps[0] ?? null;
    setSelectedIntervalProgramId(activeIntervalProgram.id);
    setIntervalTimerStepIndex(0);
    setIntervalTimerRemainingSeconds(firstStep?.durationSeconds ?? 0);
  }, [activeIntervalProgram, intervalProgramSteps, isIntervalTimerRunning]);
  useEffect(() => {
    if (!isIntervalTimerRunning || isIntervalTimerPaused || !intervalProgramSteps.length) return;
    const timer = window.setInterval(() => {
      setIntervalTimerRemainingSeconds((previous) => {
        if (previous > 1) return previous - 1;
        const nextIndex = intervalTimerStepIndex + 1;
        const nextStep = intervalProgramSteps[nextIndex];
        if (!nextStep) {
          setIsIntervalTimerRunning(false);
          setIsIntervalTimerPaused(false);
          setIntervalTimerStatus("Intervalløkten er fullført. Sterkt jobba!");
          return 0;
        }
        setIntervalTimerStepIndex(nextIndex);
        return nextStep.durationSeconds;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isIntervalTimerRunning, isIntervalTimerPaused, intervalProgramSteps, intervalTimerStepIndex]);

  useEffect(() => {
    const unlockedIds = achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id);
    if (!hasInitializedAchievementTracking.current) {
      setSeenUnlockedAchievementIds(unlockedIds);
      hasInitializedAchievementTracking.current = true;
      return;
    }
    const newlyUnlocked = achievements.find(
      (achievement) => achievement.unlocked && !seenUnlockedAchievementIds.includes(achievement.id),
    );
    if (!newlyUnlocked) return;
    setAchievementCelebration({ id: newlyUnlocked.id, label: newlyUnlocked.label });
    setSeenUnlockedAchievementIds((prev) => [...prev, newlyUnlocked.id]);
  }, [achievements, seenUnlockedAchievementIds]);

  function applyMetricDraftToProfile() {
    const value = goalMetricValueDraft.trim();
    if (!value) return;
    if (goalMetricDraft === "sessionsPerWeek") setProfileSessionsPerWeekTarget(value);
    if (goalMetricDraft === "dailySteps") setProfileDailyStepsTarget(value);
    if (goalMetricDraft === "targetWeight") setProfileTargetWeight(value);
    setGoalMetricValueDraft("");
  }
  function handleStartIntervalProgramTimer() {
    if (!activeIntervalProgram || !intervalProgramSteps.length) return;
    const firstStep = intervalProgramSteps[0] ?? null;
    setIntervalTimerStatus(null);
    setIsIntervalTimerPaused(false);
    setIntervalTimerStepIndex(0);
    setIntervalTimerRemainingSeconds(firstStep?.durationSeconds ?? 0);
    setIsIntervalTimerRunning(true);
  }
  function openIntervalTimerModal(programId: string) {
    setSelectedIntervalProgramId(programId);
    setShowIntervalTimerModal(true);
    setIntervalTimerStatus(null);
    setIsIntervalTimerRunning(false);
    setIsIntervalTimerPaused(false);
    setIntervalTimerStepIndex(0);
  }
  function closeIntervalTimerModal() {
    setShowIntervalTimerModal(false);
    setIsIntervalTimerRunning(false);
    setIsIntervalTimerPaused(false);
    setIntervalTimerStepIndex(0);
    setIntervalTimerRemainingSeconds(intervalProgramSteps[0]?.durationSeconds ?? 0);
  }
  function handlePauseResumeIntervalProgramTimer() {
    if (!isIntervalTimerRunning) return;
    setIsIntervalTimerPaused((previous) => !previous);
  }
  function handleResetIntervalProgramTimer() {
    if (!intervalProgramSteps.length) return;
    setIsIntervalTimerRunning(false);
    setIsIntervalTimerPaused(false);
    setIntervalTimerStepIndex(0);
    setIntervalTimerRemainingSeconds(intervalProgramSteps[0]?.durationSeconds ?? 0);
    setIntervalTimerStatus("Intervalløkten er nullstilt.");
  }
  function handleSkipIntervalProgramStep() {
    if (!intervalProgramSteps.length) return;
    const nextIndex = intervalTimerStepIndex + 1;
    const nextStep = intervalProgramSteps[nextIndex];
    if (!nextStep) {
      setIsIntervalTimerRunning(false);
      setIsIntervalTimerPaused(false);
      setIntervalTimerRemainingSeconds(0);
      setIntervalTimerStatus("Siste fase hoppet over. Intervalløkten er fullført.");
      return;
    }
    setIntervalTimerStepIndex(nextIndex);
    setIntervalTimerRemainingSeconds(nextStep.durationSeconds);
    setIntervalTimerStatus(`Hoppet til: ${nextStep.label}`);
  }

  async function shareMonthlyProgressSummary() {
    if (typeof window === "undefined") return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d");
      if (!context) {
        setProgressShareStatus("Kunne ikke lage bilde akkurat nå.");
        return;
      }

      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, MOTUS.turquoise);
      gradient.addColorStop(1, MOTUS.pink);
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "rgba(255,255,255,0.95)";
      context.fillRect(60, 120, canvas.width - 120, canvas.height - 240);
      context.fillStyle = "#0f172a";
      context.font = "bold 56px Inter, sans-serif";
      context.fillText("Motus - Denne måneden", 110, 220);
      context.font = "32px Inter, sans-serif";
      context.fillStyle = "#475569";
      context.fillText(`${viewedMember?.name ?? "Medlem"} sin progresjon`, 110, 275);

      const lines = [
        `Økter logget: ${estimatedSessionsThisMonth}`,
        `Treningsdager: ${uniqueTrainingDays}`,
        `Streak: ${streakWeeks} uker`,
        `Konsistens: ${progressStory.consistency}%`,
      ];
      context.font = "bold 42px Inter, sans-serif";
      context.fillStyle = "#0f172a";
      lines.forEach((line, index) => {
        context.fillText(line, 120, 430 + index * 110);
      });
      context.font = "30px Inter, sans-serif";
      context.fillStyle = "#64748b";
      context.fillText(`Trend: ${progressStory.trendLabel}`, 120, 930);
      context.fillText(`Neste fokus: ${progressStory.nextFocus}`, 120, 995);

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        setProgressShareStatus("Kunne ikke lage bilde akkurat nå.");
        return;
      }

      const file = new File([blob], "motus-denne-maneden.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      const canShareFile = typeof nav.canShare === "function" ? nav.canShare({ files: [file] }) : false;
      if (typeof nav.share === "function" && canShareFile) {
        await nav.share({
          title: "Motus progresjon",
          text: "Min progresjon denne måneden",
          files: [file],
        });
        setProgressShareStatus("Progresjonskort delt.");
        return;
      }

      const imageUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "motus-denne-maneden.png";
      link.click();
      URL.revokeObjectURL(imageUrl);
      setProgressShareStatus("Bilde lastet ned. Del det fra galleriet.");
    } catch {
      setProgressShareStatus("Deling ble avbrutt.");
    }
  }

  async function saveProfile() {
    if (!editableMember || typeof window === "undefined") return;
    if (!isLikelyValidBirthDate(memberBirthDateDraft)) {
      setProfileSaveInfo("Fødselsdato må være på formatet dd.mm.yyyy.");
      return;
    }
    const normalizedDraftEmail = memberEmailDraft.trim().toLowerCase();
    const fallbackEmail = editableMember.email.trim().toLowerCase();
    const normalizedEmail =
      normalizedDraftEmail && normalizedDraftEmail.includes("@") ? normalizedDraftEmail : fallbackEmail;
    const next: ProfileMetricsDraft = {
      sessionsPerWeekTarget: profileSessionsPerWeekTarget.trim(),
      dailyStepsTarget: profileDailyStepsTarget.trim(),
      targetWeight: profileTargetWeight.trim(),
      currentDailySteps: profileCurrentDailySteps.trim(),
    };
    const metricsForSync = encodeMemberProfileMetrics(next);
    window.localStorage.setItem(getProfileStorageKey(editableMember.id), JSON.stringify(next));
    const targetMemberIds = Array.from(
      new Set(
        members
          .filter((member) => {
            const normalizedMemberEmail = member.email.trim().toLowerCase();
            if (member.id === editableMember.id) return true;
            if (relatedMemberIds.includes(member.id)) return true;
            if (normalizedMemberEmail && normalizedMemberEmail === fallbackEmail) return true;
            if (normalizedMemberEmail && normalizedMemberEmail === normalizedEmail) return true;
            return false;
          })
          .map((member) => member.id)
      )
    );
    const safeTargetIds = targetMemberIds.length ? targetMemberIds : [editableMember.id];
    safeTargetIds.forEach((memberId) => {
      updateMember({
        memberId,
        changes: {
          name: memberNameDraft,
          email: normalizedEmail,
          phone: normalizePhone(memberPhoneDraft),
          birthDate: normalizeBirthDateToDdMmYyyy(memberBirthDateDraft),
          goal: memberGoalDraft,
          focus: memberFocusDraft,
          injuries: memberInjuriesDraft,
          personalGoals: metricsForSync,
        },
      });
    });
    if (supabaseClient) {
      const syncResult = await syncProfileToPtBackend({
        email: normalizedCurrentUserEmail || normalizedEmail,
        emails: Array.from(
          new Set(
            [normalizedCurrentUserEmail, normalizedEmail, fallbackEmail]
              .map((value) => value.trim().toLowerCase())
              .filter((value) => value && value.includes("@"))
          )
        ),
        memberId: editableMember.id,
        memberIds: safeTargetIds,
        // Treat sync as healthy when at least one canonical row is updated.
        // Duplicate legacy rows may lag and be healed by subsequent sync paths.
        expectedMinUpdated: 1,
        changes: {
          name: memberNameDraft,
          phone: memberPhoneDraft,
          birthDate: normalizeBirthDateToDdMmYyyy(memberBirthDateDraft),
          goal: memberGoalDraft,
          focus: memberFocusDraft,
          injuries: memberInjuriesDraft,
          personalGoals: metricsForSync,
        },
      });
      if (!syncResult.ok) {
        setProfileSaveInfo("Profil lagret. Synk mot PT er midlertidig forsinket og forsøkes igjen automatisk.");
      } else if (normalizedDraftEmail && !normalizedDraftEmail.includes("@")) {
        setProfileSaveInfo("Profil lagret. E-post ble ikke endret fordi formatet var ugyldig.");
        return;
      } else {
        setProfileSaveInfo("Profil og mål lagret.");
      }
      return;
    }
    if (normalizedDraftEmail && !normalizedDraftEmail.includes("@")) {
      setProfileSaveInfo("Profil lagret. E-post ble ikke endret fordi formatet var ugyldig.");
      return;
    }
    setProfileSaveInfo("Profil og mål lagret.");
  }

  async function handleRegisterWebPush() {
    if (!supabaseClient) return;
    setPushRegisterBusy(true);
    setPushRegisterStatus(null);
    const result = await registerWebPushWithSupabase(supabaseClient);
    setPushRegisterBusy(false);
    setPushRegisterStatus(result.ok ? "Push-varsler er slått på for denne enheten." : result.message);
  }

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          reject(new Error("Kunne ikke lese bildefilen."));
          return;
        }
        resolve(dataUrl);
      };
      reader.onerror = () => reject(new Error("Kunne ikke lese bildefilen."));
      reader.readAsDataURL(file);
    });
  }

  async function compressImageDataUrl(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Kunne ikke behandle bildefilen."));
          return;
        }
        context.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressed || dataUrl);
      };
      img.onerror = () => reject(new Error("Kunne ikke behandle bildefilen."));
      img.src = dataUrl;
    });
  }

  async function handleAvatarFileSelected(file: File | null) {
    if (!file || !editableMember) return;
    if (!file.type.startsWith("image/")) {
      setProfileSaveInfo("Velg en bildefil.");
      return;
    }
    try {
      const originalDataUrl = await readFileAsDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(originalDataUrl);
      let syncedAvatarUrl = compressedDataUrl;
      const compressedBlob = dataUrlToBlob(compressedDataUrl);
      const uploadBody: Blob | File = compressedBlob ?? file;
      const avatarEmails = Array.from(
        new Set(
          [
            normalizedCurrentUserEmail,
            editableMember.email.trim().toLowerCase(),
            ...members
              .filter((member) => relatedMemberIds.includes(member.id))
              .map((member) => member.email.trim().toLowerCase()),
          ].filter((value) => value && value.includes("@"))
        )
      );
      const avatarNames = Array.from(
        new Set(
          [
            editableMember.name.trim().toLowerCase(),
            ...members
              .filter((member) => relatedMemberIds.includes(member.id))
              .map((member) => member.name.trim().toLowerCase()),
          ].filter(Boolean)
        )
      );
      if (supabaseClient && (avatarEmails.length || avatarNames.length)) {
        for (const email of avatarEmails) {
          const encodedEmail = encodeEmailForPath(email);
          if (!encodedEmail) continue;
          const avatarPath = `${MEMBER_AVATAR_PREFIX}/email-${encodedEmail}.jpg`;
          const { error: uploadError } = await supabaseClient.storage
            .from(MEMBER_AVATAR_BUCKET)
            .upload(avatarPath, uploadBody, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            });
          if (!uploadError && email === editableMember.email.trim().toLowerCase()) {
            const { data } = supabaseClient.storage.from(MEMBER_AVATAR_BUCKET).getPublicUrl(avatarPath);
            if (data.publicUrl) {
              syncedAvatarUrl = `${data.publicUrl}?v=${Date.now()}`;
            }
          }
        }
        for (const name of avatarNames) {
          const encodedName = encodeNameForPath(name);
          if (!encodedName) continue;
          const avatarPath = `${MEMBER_AVATAR_PREFIX}/name-${encodedName}.jpg`;
          await supabaseClient.storage
            .from(MEMBER_AVATAR_BUCKET)
            .upload(avatarPath, uploadBody, {
              cacheControl: "3600",
              upsert: true,
              contentType: "image/jpeg",
            });
        }
      }
      setMemberAvatarUrl(syncedAvatarUrl);
      const normalizedEditableEmail = editableMember.email.trim().toLowerCase();
      const avatarTargetIds = Array.from(
        new Set(
          members
            .filter((member) => {
              const normalizedMemberEmail = member.email.trim().toLowerCase();
              if (member.id === editableMember.id) return true;
              if (relatedMemberIds.includes(member.id)) return true;
              if (normalizedEditableEmail && normalizedMemberEmail === normalizedEditableEmail) return true;
              return false;
            })
            .map((member) => member.id)
        )
      );
      const safeAvatarTargetIds = avatarTargetIds.length ? avatarTargetIds : [editableMember.id];
      safeAvatarTargetIds.forEach((memberId) => {
        updateMember({
          memberId,
          changes: {
            avatarUrl: syncedAvatarUrl,
          },
        });
      });
      setProfileSaveInfo("Profilbilde lagret.");
    } catch {
      setProfileSaveInfo("Kunne ikke lagre profilbildet. Prøv et annet bilde.");
    }
  }

  const completedThisWeek = useMemo(() => {
    const start = getWeekStart(new Date());
    return completedLogDates.filter((date) => date >= start).length;
  }, [completedLogDates]);

  const sessionsTargetNumber = Number(profileSessionsPerWeekTarget) || 0;
  const dailyStepsTargetNumber = Number(profileDailyStepsTarget) || 0;
  const currentDailyStepsNumber = Number(profileCurrentDailySteps) || 0;
  const targetWeightNumber = Number(profileTargetWeight) || 0;
  const currentWeightNumber = Number(editableMember?.weight ?? "") || 0;
  const sessionsRemaining = Math.max(0, sessionsTargetNumber - completedThisWeek);
  const sessionsProgressPercent = sessionsTargetNumber > 0 ? Math.min(100, Math.round((completedThisWeek / sessionsTargetNumber) * 100)) : 0;
  const stepsProgressPercent = dailyStepsTargetNumber > 0 ? Math.min(100, Math.round((currentDailyStepsNumber / dailyStepsTargetNumber) * 100)) : 0;
  const weightDirectionDown = targetWeightNumber > 0 && currentWeightNumber > targetWeightNumber;
  const weightGap = targetWeightNumber > 0 && currentWeightNumber > 0 ? Math.abs(currentWeightNumber - targetWeightNumber) : 0;
  const progressStory = useMemo(() => {
    const nowMs = now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const recent14 = completedLogDates.filter((date) => nowMs - date.getTime() <= 14 * dayMs).length;
    const previous14 = completedLogDates.filter((date) => {
      const diff = nowMs - date.getTime();
      return diff > 14 * dayMs && diff <= 28 * dayMs;
    }).length;
    const delta = recent14 - previous14;
    const trendLabel = delta > 0 ? "opp fra forrige periode" : delta < 0 ? "ned fra forrige periode" : "stabil fra forrige periode";
    const trendToneClass = delta > 0 ? "text-emerald-100" : delta < 0 ? "text-amber-100" : "text-white/90";
    const weekKeysRecent4 = new Set(
      completedLogDates
        .filter((date) => nowMs - date.getTime() <= 28 * dayMs)
        .map((date) => getWeekKey(date)),
    );
    const consistency = Math.min(100, Math.round((weekKeysRecent4.size / 4) * 100));
    const nextFocus =
      sessionsRemaining > 0
        ? `Mangler ${sessionsRemaining} økt${sessionsRemaining === 1 ? "" : "er"} for ukemålet`
        : "Ukemålet er nådd - hold flyten videre";
    return { recent14, previous14, delta, trendLabel, trendToneClass, consistency, nextFocus };
  }, [completedLogDates, now, sessionsRemaining]);
  const nextBestAction = useMemo(() => {
    if (!memberAssignedPrograms.length) {
      return {
        title: "Be om første program",
        description: "Du har ingen program fra trener ennå. Du kan likevel trene: legg din egen økt sammen under Trening, eller send melding til trener.",
        cta: "Åpne Trening",
        action: "programs" as const,
      };
    }
    if (sessionsTargetNumber > 0 && sessionsRemaining > 0 && nextProgram) {
      return {
        title: `Du mangler ${sessionsRemaining} økt${sessionsRemaining === 1 ? "" : "er"} denne uken`,
        description: "Start neste program nå for å holde flyten og nå ukemålet.",
        cta: "Start neste økt",
        action: "start-workout" as const,
      };
    }
    return {
      title: "Ukemålet er nådd",
      description: "Sterkt! Ta en bonusøkt eller sjekk fremgangen din.",
      cta: "Se fremgang",
      action: "progress" as const,
    };
  }, [memberAssignedPrograms.length, sessionsTargetNumber, sessionsRemaining, nextProgram]);
  const customerStatusLabel = (() => {
    const isPtCustomer = viewedMember?.customerType === "PT-kunde";
    const isPremiumCustomer = viewedMember?.membershipType === "Premium";
    if (isPtCustomer && isPremiumCustomer) return "PT-kunde og Premium-kunde";
    if (isPtCustomer) return "PT-kunde";
    if (isPremiumCustomer) return "Premium-kunde";
    return viewedMember?.customerType || "Ikke satt";
  })();

  useEffect(() => {
    if (!workoutMode) {
      setWorkoutExerciseIndex(0);
      setLiveWorkoutCelebration(null);
      setShowWorkoutReflection(false);
      setIsSavingWorkout(false);
      return;
    }
    setWorkoutExerciseIndex(0);
    setShowWorkoutReflection(false);
    setIsSavingWorkout(false);
    setReflectionEnergyLevel(3);
    setReflectionDifficultyLevel(3);
    setReflectionMotivationLevel(3);
    setReflectionNote("");
  }, [workoutMode?.programId]);

  useEffect(() => {
    setSelectedCalendarLogId(null);
  }, [selectedCalendarDay, calendarMonth]);

  useEffect(() => {
    if (!workoutResultGroups.length) return;
    if (workoutExerciseIndex <= workoutResultGroups.length - 1) return;
    setWorkoutExerciseIndex(workoutResultGroups.length - 1);
  }, [workoutResultGroups, workoutExerciseIndex]);

  useEffect(() => {
    setShowReplacementOptions(false);
  }, [currentWorkoutGroup?.groupId]);

  function handleReplaceCurrentWorkoutExercise(replacementExerciseId: string) {
    if (!currentWorkoutGroup || !replacementExerciseId) return;
    const replacementExercise = exercises.find((exercise) => exercise.id === replacementExerciseId);
    if (!replacementExercise) return;
    replaceWorkoutExerciseGroup({
      programExerciseId: currentWorkoutGroup.groupId,
      nextExerciseName: replacementExercise.name,
    });
    setShowReplacementOptions(false);
  }

  function getReflectionEmoji(level: 1 | 2 | 3 | 4 | 5): string {
    if (level <= 1) return "🥳";
    if (level === 2) return "🙂";
    if (level === 3) return "😌";
    if (level === 4) return "😮‍💨";
    return "🥵";
  }

  function buildWorkoutReflection(): WorkoutReflection {
    return {
      energyLevel: reflectionEnergyLevel,
      difficultyLevel: reflectionDifficultyLevel,
      motivationLevel: reflectionMotivationLevel,
      note: reflectionNote.trim(),
    };
  }

  function buildGroupWorkoutReflection(): WorkoutReflection {
    return {
      energyLevel: groupWorkoutEnergyLevel,
      difficultyLevel: groupWorkoutDifficultyLevel,
      motivationLevel: groupWorkoutMotivationLevel,
      note: groupWorkoutNote.trim(),
    };
  }

  function handleLogGroupWorkout() {
    if (!activeMemberId || !groupWorkoutClassName.trim()) return;
    logGroupWorkout({
      memberId: activeMemberId,
      className: groupWorkoutClassName.trim(),
      note: groupWorkoutNote.trim(),
      reflection: buildGroupWorkoutReflection(),
    });
    setGroupWorkoutStatus("Gruppetime lagret. PT kan nå se denne økta.");
    setGroupWorkoutEnergyLevel(3);
    setGroupWorkoutDifficultyLevel(3);
    setGroupWorkoutMotivationLevel(3);
    setGroupWorkoutNote("");
  }

  function resolveProgramForPlannedEntry(entry: string): TrainingProgram | null {
    const normalized = entry.trim().toLowerCase();
    if (!normalized) return null;
    return memberAssignedPrograms.find((program) => program.title.trim().toLowerCase() === normalized) ?? null;
  }

  function handleQuickCompletePlannedEntry(entry: string) {
    if (!activeMemberId) return;
    const trimmed = entry.trim();
    if (!trimmed) return;
    logGroupWorkout({
      memberId: activeMemberId,
      className: trimmed,
      note: "Registrert som gjennomfort fra periodeplan.",
      reflection: {
        energyLevel: 3,
        difficultyLevel: 3,
        motivationLevel: 3,
        note: "Hurtiglogget fra periodeplan.",
      },
    });
    setPeriodPlanActionStatus(`Registrert "${trimmed}" som gjennomfort.`);
  }

  function estimate1RM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    return weight * (1 + reps / 30);
  }

  function getBestEstimated1RMForMember(exerciseName: string): number {
    let best = 0;
    memberLogs.forEach((log) => {
      (log.results ?? []).forEach((result) => {
        if (!result.completed || result.exerciseName !== exerciseName) return;
        const estimated = estimate1RM(Number(result.performedWeight) || 0, Number(result.performedReps) || 0);
        if (estimated > best) best = estimated;
      });
    });
    return best;
  }

  function maybeCelebrateCurrentWorkoutGroup() {
    if (!currentWorkoutGroup || !activeMemberId) return;
    let bestCandidate: WorkoutCelebration | null = null;
    currentWorkoutGroup.rows.forEach((row) => {
      const weight = Number(row.performedWeight) || 0;
      const reps = Number(row.performedReps) || 0;
      const currentEstimated = estimate1RM(weight, reps);
      if (currentEstimated <= 0) return;
      const previousEstimated = getBestEstimated1RMForMember(row.exerciseName);
      if (currentEstimated <= previousEstimated) return;
      if (!bestCandidate || currentEstimated - previousEstimated > bestCandidate.newEstimated1RM - bestCandidate.previousEstimated1RM) {
        bestCandidate = {
          memberId: activeMemberId,
          exerciseName: row.exerciseName,
          previousEstimated1RM: previousEstimated,
          newEstimated1RM: currentEstimated,
          reps,
          weight,
        };
      }
    });
    if (bestCandidate) setLiveWorkoutCelebration(bestCandidate);
  }

  function handleGoToNextWorkoutExercise() {
    maybeCelebrateCurrentWorkoutGroup();
    setWorkoutExerciseIndex((prev) => prev + 1);
  }

  function handleDeleteLoggedExercise(logId: string, exerciseId: string) {
    const shouldDelete = window.confirm("Slette denne øvelsen fra treningsloggen?");
    if (!shouldDelete) return;
    const log = completedLogs.find((item) => item.id === logId);
    if (log) {
      setLastDeletedLogResult({ logId, results: log.results ?? [] });
    }
    removeWorkoutLogResult({ logId, exerciseId });
  }

  function startEditLoggedExercise(logId: string, result: WorkoutLog["results"][number], index: number) {
    const editKey = `${logId}:${result.exerciseId}:${index}`;
    setEditingLoggedExerciseKey(editKey);
    setEditingLoggedExerciseDraft({
      performedWeight: result.performedWeight ?? "",
      performedReps: result.performedReps ?? "",
      performedDurationMinutes: result.performedDurationMinutes ?? "",
      performedSpeed: result.performedSpeed ?? "",
      performedIncline: result.performedIncline ?? "",
      completed: Boolean(result.completed),
    });
  }

  function cancelEditLoggedExercise() {
    setEditingLoggedExerciseKey(null);
    setEditingLoggedExerciseDraft(null);
  }

  function saveEditLoggedExercise(logId: string, resultIndex: number) {
    if (!editingLoggedExerciseDraft) return;
    const log = completedLogs.find((item) => item.id === logId);
    if (!log?.results?.length) return;
    const nextResults = log.results.map((item, index) => {
      if (index !== resultIndex) return item;
      return {
        ...item,
        performedWeight: editingLoggedExerciseDraft.performedWeight,
        performedReps: editingLoggedExerciseDraft.performedReps,
        performedDurationMinutes: editingLoggedExerciseDraft.performedDurationMinutes,
        performedSpeed: editingLoggedExerciseDraft.performedSpeed,
        performedIncline: editingLoggedExerciseDraft.performedIncline,
        completed: editingLoggedExerciseDraft.completed,
      };
    });
    setWorkoutLogResults({ logId, results: nextResults });
    cancelEditLoggedExercise();
  }

  function undoDeleteLoggedExercise() {
    if (!lastDeletedLogResult) return;
    setWorkoutLogResults(lastDeletedLogResult);
    setLastDeletedLogResult(null);
  }

  function handleWorkoutResultInputChange(
    row: WorkoutModeState["results"][number],
    field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline",
    value: string,
    rowIndex: number,
    rows: WorkoutModeState["results"],
  ) {
    updateWorkoutExerciseResult(row.exerciseId, field, value);
    const isCardio = row.exerciseCategory === "Kondisjon";
    const isTreadmill = (row.exerciseEquipment ?? "").toLowerCase().includes("tredem");
    const nextWeight = field === "performedWeight" ? value.trim() : row.performedWeight.trim();
    const nextReps = field === "performedReps" ? value.trim() : row.performedReps.trim();
    const nextDuration = field === "performedDurationMinutes" ? value.trim() : (row.performedDurationMinutes ?? "").trim();
    const nextSpeed = field === "performedSpeed" ? value.trim() : (row.performedSpeed ?? "").trim();
    const isCompleted = isCardio
      ? Number(nextDuration) > 0 && (!isTreadmill || Number(nextSpeed) > 0)
      : Number(nextWeight) > 0 && Number(nextReps) > 0;
    if (isCompleted && !row.completed) {
      updateWorkoutExerciseResult(row.exerciseId, "completed", true);
    }
    if (field === "performedReps" && isCompleted) {
      const nextRow = rows[rowIndex + 1];
      if (!nextRow) return;
      const nextInput = workoutWeightInputRefs.current[nextRow.exerciseId];
      if (nextInput) {
        window.requestAnimationFrame(() => nextInput.focus());
      }
    }
  }

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <Card className="hidden overflow-hidden lg:block">
        <div
          className="flex gap-2 overflow-auto px-3 py-3"
          style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
        >
          {[
            { id: "overview", label: "Oversikt" },
            { id: "programs", label: "Trening" },
            { id: "progress", label: "Fremgang" },
            { id: "messages", label: "Meldinger" },
            { id: "profile", label: "Profil" },
          ].map((tab) => {
            const isActive = memberTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMemberTab(tab.id as MemberTab)}
                className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  isActive ? "bg-white text-slate-900 shadow-sm" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="hidden p-4 h-fit xl:p-5 lg:block">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><UserCircle2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Min profil</h2>
              <p className="text-sm text-slate-500">Dine medlemsdata</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {viewedMember ? (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise }}>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border bg-white" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                    {memberAvatarUrl ? <img src={memberAvatarUrl} alt={viewedMember.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                  </div>
                  <div>
                    <div className="font-medium">{viewedMember.name}</div>
                    <div className="text-sm text-slate-500">{viewedMember.email}</div>
                  </div>
                </div>
                <div className="mt-2 text-sm"><span className="font-medium">Mål:</span> {viewedMember.goal}</div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="min-w-0 w-full space-y-4 sm:space-y-6">
          {memberTab === "overview" ? (
            <Card className="min-w-0 w-full p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="hidden w-full sm:block rounded-[22px] p-4 sm:p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white/80">Hei{viewedMember ? `, ${viewedMember.name}` : ""}</div>
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-white/40 bg-white/20">
                    {memberAvatarUrl ? <img src={memberAvatarUrl} alt="Profilbilde" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                  </div>
                </div>
                <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Klar for neste økt?</div>
                <div className="mt-2 text-sm text-white/90">Trykk pa neste steg under for a komme raskt i gang.</div>
              </div>
              <div className="hidden w-full sm:grid gap-3 sm:grid-cols-3">
                <StatCard label="Programmer" value={String(memberAssignedPrograms.length)} hint="Tildelt deg" />
                <StatCard label="Logger" value={String(memberLogs.length)} hint="Registrert" />
                <StatCard label="Meldinger" value={String(memberMessages.length)} hint="I chatten" />
              </div>
              <div className="min-w-0 w-full rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">🎯 Neste steg</div>
                <div className="mt-1 text-sm font-medium text-slate-800">{nextBestAction.title}</div>
                <div className="mt-1 text-sm text-slate-600">{nextBestAction.description}</div>
                {nextProgram ? (
                  <div className="mt-2 text-xs text-slate-500">Neste program: {nextProgram.title}</div>
                ) : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <GradientButton
                    onClick={() => {
                      if (nextBestAction.action === "messages") setMemberTab("messages");
                      if (nextBestAction.action === "progress") setMemberTab("progress");
                      if (nextBestAction.action === "programs") setMemberTab("programs");
                      if (nextBestAction.action === "start-workout" && nextProgram) {
                        setMemberTab("programs");
                        startWorkoutMode(nextProgram.id, buildStartWorkoutOptions(nextProgram));
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    {nextBestAction.cta}
                  </GradientButton>
                  <OutlineButton onClick={() => setMemberTab("programs")} className="w-full sm:w-auto">
                    Se alle programmer
                  </OutlineButton>
                </div>
              </div>
              <div className="min-w-0 w-full rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="rounded-xl p-2 text-white shrink-0" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">Lag økt selv</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Sett sammen øvelser fra øvelsesbanken og start vanlig økt-modus — uten program fra trener.
                    </div>
                    <OutlineButton onClick={() => setMemberTab("programs")} className="mt-3 w-full sm:w-auto">
                      Gå til egen økt
                    </OutlineButton>
                  </div>
                </div>
              </div>
              {todayPlanEntry ? (
                <div className="min-w-0 w-full rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-700">📅 Dagens økt (fra periodeplan)</div>
                  <div className="mt-1 text-sm text-slate-700">{todayPlanEntry}</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    {todayProgramMatch ? (
                      <GradientButton
                        onClick={() => {
                          setMemberTab("programs");
                          if (intervalProgramIdSet.has(todayProgramMatch.id)) {
                            openIntervalTimerModal(todayProgramMatch.id);
                            return;
                          }
                          startWorkoutMode(todayProgramMatch.id, buildStartWorkoutOptions(todayProgramMatch));
                        }}
                        className="w-full sm:w-auto"
                      >
                        Start dagens økt
                      </GradientButton>
                    ) : (
                      <OutlineButton onClick={() => setMemberTab("programs")} className="w-full sm:w-auto">
                        Se dagens plan
                      </OutlineButton>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="min-w-0 w-full rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-700">Målstatus</div>
                  <div className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-700" style={{ background: "rgba(15,23,42,0.08)" }}>
                    Denne uken
                  </div>
                </div>
                {sessionsTargetNumber > 0 ? (
                  <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium">🏋️ Treningsmål (uke)</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{completedThisWeek}/{sessionsTargetNumber}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full" style={{ width: `${sessionsProgressPercent}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-700">
                      {sessionsRemaining > 0 ? `${sessionsRemaining} trening${sessionsRemaining === 1 ? "" : "er"} igjen denne uken` : "Ukemålet er nådd!"}
                    </div>
                  </div>
                ) : null}
                {dailyStepsTargetNumber > 0 ? (
                  <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium">👟 Skrittmål (i dag)</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{currentDailyStepsNumber}/{dailyStepsTargetNumber}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full" style={{ width: `${stepsProgressPercent}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-700">
                      {currentDailyStepsNumber < dailyStepsTargetNumber ? `${dailyStepsTargetNumber - currentDailyStepsNumber} skritt igjen i dag` : "Skrittmålet er nådd!"}
                    </div>
                  </div>
                ) : null}
                {targetWeightNumber > 0 && currentWeightNumber > 0 ? (
                  <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-medium">⚖️ Vektmål</span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold">{currentWeightNumber} / {targetWeightNumber} kg</span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-700">
                      {weightGap === 0
                        ? "Du er på målet."
                        : weightDirectionDown
                        ? `${weightGap.toFixed(1)} kg igjen til mål`
                        : `${weightGap.toFixed(1)} kg over målet`}
                    </div>
                  </div>
                ) : null}
                {sessionsTargetNumber <= 0 && dailyStepsTargetNumber <= 0 && targetWeightNumber <= 0 ? (
                  <div className="text-sm text-slate-500">Sett mål under Min profil for å få status her.</div>
                ) : null}
              </div>
              <div
                className="rounded-2xl border p-4 text-white"
                style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`, borderColor: "rgba(255,255,255,0.3)" }}
              >
                <div className="text-xs uppercase tracking-wide text-white/85">Progress Story</div>
                <div className="mt-1 text-lg font-semibold">
                  {progressStory.recent14 > 0
                    ? `${progressStory.recent14} økter siste 14 dager`
                    : "Start neste kapittel med en ny økt"}
                </div>
                <div className={`mt-1 text-sm ${progressStory.trendToneClass}`}>
                  {progressStory.trendLabel}
                  {progressStory.delta !== 0 ? ` (${progressStory.delta > 0 ? "+" : ""}${progressStory.delta})` : ""}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/20 px-3 py-2 text-sm">
                    <div className="text-[11px] text-white/80">Konsistens (4 uker)</div>
                    <div className="font-semibold">{progressStory.consistency}%</div>
                  </div>
                  <div className="rounded-xl bg-white/20 px-3 py-2 text-sm">
                    <div className="text-[11px] text-white/80">Siste 14 dager</div>
                    <div className="font-semibold">{progressStory.recent14} økter</div>
                  </div>
                  <div className="rounded-xl bg-white/20 px-3 py-2 text-sm">
                    <div className="text-[11px] text-white/80">Neste fokus</div>
                    <div className="font-semibold">{progressStory.nextFocus}</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="min-w-0 w-full overflow-hidden rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-700">Treningskalender</div>
                  <div className="mt-1 text-base font-semibold text-slate-800 capitalize">{calendarMonthLabel}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OutlineButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    >
                      Forrige
                    </OutlineButton>
                    <OutlineButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))}
                    >
                      I dag
                    </OutlineButton>
                    <OutlineButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    >
                      Neste
                    </OutlineButton>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
                    <span>Ma</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lo</span><span>So</span>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {calendarCells.map((day, index) =>
                      day ? (
                        <button
                          type="button"
                          key={`${day}-${index}`}
                          onClick={() => setSelectedCalendarDay((prev) => (prev === day ? null : day))}
                          className={`rounded-lg px-1 py-2 text-center text-xs ${
                            calendarDayStatusByDay.get(day) === "completed" ? "text-white font-semibold" : "text-slate-700 bg-white"
                          }`}
                          style={(() => {
                            const status = calendarDayStatusByDay.get(day);
                            if (status === "completed") {
                              return {
                                background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                                boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(15,23,42,0.2) inset" : "none",
                              };
                            }
                            if (status === "missed") {
                              return {
                                border: "1px solid rgba(244,63,94,0.45)",
                                backgroundColor: "rgba(254,226,226,0.7)",
                                boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(244,63,94,0.25) inset" : "none",
                              };
                            }
                            if (status === "planned") {
                              return {
                                border: "1px dashed rgba(20,184,166,0.55)",
                                backgroundColor: "rgba(236,253,245,0.85)",
                                boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(20,184,166,0.2) inset" : "none",
                              };
                            }
                            return {
                              border: "1px solid rgba(15,23,42,0.06)",
                              boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(15,23,42,0.12) inset" : "none",
                            };
                          })()}
                          title={
                            calendarDayStatusByDay.get(day) === "completed"
                              ? `${calendarDayLoad.get(day)} økt${calendarDayLoad.get(day) === 1 ? "" : "er"} fullført`
                              : calendarDayStatusByDay.get(day) === "missed"
                                ? "Planlagt økt ble ikke fullført"
                                : calendarDayStatusByDay.get(day) === "planned"
                                  ? "Planlagt økt"
                                  : "Ingen økter logget"
                          }
                        >
                          {day}
                        </button>
                      ) : (
                        <div key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
                      <span>Fullført</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed" style={{ borderColor: "rgba(20,184,166,0.75)", backgroundColor: "rgba(236,253,245,0.9)" }} />
                      <span>Planlagt</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ borderColor: "rgba(244,63,94,0.55)", backgroundColor: "rgba(254,226,226,0.9)" }} />
                      <span>Misset</span>
                    </div>
                  </div>
                  {selectedCalendarDay ? (
                    <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Økter {String(selectedCalendarDay).padStart(2, "0")}.{String(calendarMonth.getMonth() + 1).padStart(2, "0")}.{calendarMonth.getFullYear()}
                      </div>
                      <div className="mt-2 space-y-2">
                        {selectedCalendarPlannedEntries.length > 0 ? (
                          <div className="rounded-lg border bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800" style={{ borderColor: "rgba(20,184,166,0.25)" }}>
                            <div className="font-semibold">Planlagt økt</div>
                            {selectedCalendarPlannedEntries.map((entry, entryIndex) => (
                              <div key={`${selectedCalendarDay}-planned-${entryIndex}`} className="mt-1">
                                {entry}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {selectedCalendarLogs.length === 0 ? (
                          <div className="text-sm text-slate-500">Ingen logg på valgt dag.</div>
                        ) : (
                          <>
                            <div className="space-y-2">
                              {selectedCalendarLogs.map((log) => (
                                <button
                                  key={log.id}
                                  type="button"
                                  onClick={() => setSelectedCalendarLogId(log.id)}
                                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                    selectedCalendarLog?.id === log.id ? "bg-slate-100" : "bg-slate-50 hover:bg-slate-100"
                                  }`}
                                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                >
                                  <div className="font-medium text-slate-800">{log.programTitle}</div>
                                  {log.note ? <div className="mt-1 text-xs text-slate-600">{log.note}</div> : null}
                                </button>
                              ))}
                            </div>
                            {selectedCalendarLog ? (
                              <div className="rounded-lg border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detaljer fra økta</div>
                                {selectedCalendarLog.results?.length ? (
                                  <div className="mt-2 space-y-2">
                                    {selectedCalendarLog.results.map((result, index) => (
                                      <div key={`${selectedCalendarLog.id}-${result.exerciseId}-${index}`} className="rounded-lg border bg-white p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                        <div className="text-sm font-medium text-slate-800">{result.exerciseName}</div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          {result.performedDurationMinutes
                                            ? `Utført: ${result.performedDurationMinutes || "-"} min${result.performedSpeed ? ` · ${result.performedSpeed} km/t` : ""}${result.performedIncline ? ` · ${result.performedIncline}% incline` : ""}`
                                            : `Utført: ${result.performedReps || "-"} reps @ ${result.performedWeight || "-"} kg`}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                          Plan: {result.plannedDurationMinutes
                                            ? `${result.plannedDurationMinutes} min${result.plannedSpeed ? ` · ${result.plannedSpeed} km/t` : ""}${result.plannedIncline ? ` · ${result.plannedIncline}% incline` : ""}`
                                            : `${result.plannedSets}x${result.plannedReps} @ ${result.plannedWeight || "0"} kg`}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-sm text-slate-500">Ingen detaljerte sett registrert på denne økten.</div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {shouldShowCelebration ? (
            <div className="motus-modal-insets fixed inset-0 z-[10020] overscroll-contain bg-slate-900/45">
              <div className="motus-pop-in mx-auto mt-16 max-w-sm rounded-3xl border bg-white p-5 shadow-2xl" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Ny PR!</div>
                <div className="mt-1 text-xl font-bold tracking-tight text-slate-900">Sterk økning i estimert 1RM</div>
                <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  {activeCelebration?.exerciseName}: {activeCelebration?.previousEstimated1RM.toFixed(1)} kg → {activeCelebration?.newEstimated1RM.toFixed(1)} kg
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Beregnet fra {activeCelebration?.weight} kg × {activeCelebration?.reps} reps (omregnet til 1RM).
                </div>
                <GradientButton
                  onClick={() => {
                    if (liveWorkoutCelebration) {
                      setLiveWorkoutCelebration(null);
                      return;
                    }
                    dismissWorkoutCelebration();
                  }}
                  className="mt-4 w-full"
                >
                  Rått! Fortsett
                </GradientButton>
              </div>
            </div>
          ) : null}
          {microCelebrationsEnabled && achievementCelebration ? (
            <div className="motus-modal-insets fixed inset-0 z-[10030] overscroll-contain bg-slate-900/35">
              <div className="motus-pop-in mx-auto mt-20 max-w-sm rounded-3xl border bg-white p-5 text-center shadow-2xl" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-3xl">🎉</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Achievement unlock</div>
                <div className="mt-1 text-xl font-bold tracking-tight text-slate-900">{achievementCelebration.label}</div>
                <div className="mt-2 text-sm text-slate-600">Låst opp! Fortsett den gode flyten.</div>
                <GradientButton onClick={() => setAchievementCelebration(null)} className="mt-4 w-full">
                  Rått!
                </GradientButton>
              </div>
            </div>
          ) : null}

          {memberTab === "programs" ? (
            <>
              <Card className="mb-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Egen økt</h2>
                    <p className="text-sm text-slate-500">Velg øvelser fra banken, sett serier og reps, og start økt-modus.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <TextInput value={customWorkoutSearch} onChange={(e) => setCustomWorkoutSearch(e.target.value)} placeholder="Søk i øvelsesbanken (navn, gruppe, utstyr)" />
                  {exercises.length === 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      Øvelsesbanken er tom akkurat nå. Oppdater siden om litt, eller ta kontakt med treneren din. Uten øvelser i banken kan du ikke legge til øvelser her.
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {customWorkoutExerciseOptions.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => addCustomWorkoutLine(ex.id)}
                        className="rounded-xl border bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50"
                        style={{ borderColor: "rgba(15,23,42,0.12)" }}
                      >
                        <Plus className="mb-0.5 inline h-3 w-3" /> {ex.name}
                      </button>
                    ))}
                  </div>
                  {customWorkoutLines.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-slate-50 px-3 py-4 text-center text-sm text-slate-500" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                      Trykk på øvelser over for å legge dem i økta di.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customWorkoutLines.map((line) => {
                        const ex = exercises.find((e) => e.id === line.exerciseId);
                        return (
                          <div key={line.key} className="rounded-xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 font-medium text-sm text-slate-800">{ex?.name ?? "Ukjent øvelse"}</div>
                              <OutlineButton type="button" onClick={() => removeCustomWorkoutLine(line.key)} className="shrink-0 px-2 py-1 text-xs text-rose-700">
                                Fjern
                              </OutlineButton>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-600">Sett</span>
                                <TextInput value={line.sets} onChange={(e) => updateCustomWorkoutLine(line.key, { sets: e.target.value })} placeholder="3" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-600">Reps</span>
                                <TextInput value={line.reps} onChange={(e) => updateCustomWorkoutLine(line.key, { reps: e.target.value })} placeholder="10" />
                              </label>
                              <label className="space-y-1">
                                <span className="text-[11px] font-semibold text-slate-600">Vekt (kg)</span>
                                <TextInput value={line.weight} onChange={(e) => updateCustomWorkoutLine(line.key, { weight: e.target.value })} placeholder="Valgfritt" />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <GradientButton onClick={handleStartCustomWorkout} disabled={!customWorkoutLines.length || !activeMemberId.trim()} className="w-full sm:w-auto">
                    Start egen økt
                  </GradientButton>
                </div>
              </Card>
              <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Mine programmer</h2>
                  <p className="text-sm text-slate-500">Enkel oversikt</p>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="font-semibold">📋 Mine treningsprogram</div>
                <div className="mt-4 space-y-3">
                  {memberAssignedPrograms.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
                      <div className="text-sm font-semibold text-slate-700">Ingen programmer fra trener ennå</div>
                      <div className="mt-1 text-sm text-slate-500">Be trener tildele et program, eller bruk «Egen økt» over.</div>
                      <GradientButton onClick={() => setMemberTab("messages")} className="mt-3 w-full sm:w-auto">
                        Send melding til trener
                      </GradientButton>
                    </div>
                  ) : null}
                  {memberAssignedPrograms.map((program) => {
                    const isExpanded = expandedProgramId === program.id;
                    return (
                      <div key={program.id} className="rounded-2xl border bg-white p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm">{program.title}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"}</div>
                            <div className="mt-1 text-[11px] text-slate-400">{program.createdAt}</div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <OutlineButton
                              className="px-3 py-2 text-xs"
                              onClick={() => setExpandedProgramId((prev) => (prev === program.id ? null : program.id))}
                            >
                              {isExpanded ? "Skjul økt" : "Se hele økt"}
                            </OutlineButton>
                            <GradientButton
                              className="px-3 py-2 text-xs"
                              onClick={() => {
                                if (intervalProgramIdSet.has(program.id)) {
                                  openIntervalTimerModal(program.id);
                                  return;
                                }
                                startWorkoutMode(program.id, buildStartWorkoutOptions(program));
                              }}
                            >
                              Start økt
                            </GradientButton>
                          </div>
                        </div>

                        {isExpanded ? (
                          <>
                            {program.notes ? <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">{program.notes}</div> : null}

                            <div className="space-y-2">
                              {program.exercises.length === 0 ? <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500 bg-slate-50">Ingen øvelser i programmet ennå.</div> : null}
                              {program.exercises.map((exercise) => (
                                <div key={exercise.id} className="rounded-xl border bg-slate-50 p-2.5">
                                  <div className="font-medium text-sm">{exercise.exerciseName}</div>
                                  <div className="mt-0.5 text-xs text-slate-500">
                                    {exercise.durationMinutes
                                      ? `${exercise.sets} runder × ${exercise.durationMinutes} min${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}% incline` : ""} · ${exercise.restSeconds}s`
                                      : `${exercise.sets}×${exercise.reps} · ${exercise.weight}kg · ${exercise.restSeconds}s`}
                                  </div>
                                  {!exercise.durationMinutes ? (
                                    <div className="mt-2 rounded-lg border bg-white px-2.5 py-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                      <div className="text-[11px] text-slate-500">Foreslått vekt fra forrige gang (kan endres)</div>
                                      <TextInput
                                        value={resolveSuggestedWorkoutWeight(exercise)}
                                        onChange={(event) =>
                                          setSuggestedWeightOverridesByProgramExerciseId((prev) => ({
                                            ...prev,
                                            [exercise.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="Kg"
                                        className="mt-1"
                                      />
                                    </div>
                                  ) : null}
                                  {exercise.notes ? <div className="mt-0.5 text-[11px] text-slate-500">{exercise.notes}</div> : null}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 rounded-3xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">🗓️ Periodeplan fra PT</div>
                    <div className="mt-1 text-xs text-slate-500">Viser hva som er planlagt dag for dag.</div>
                  </div>
                  <OutlineButton onClick={() => setShowPeriodPlanPanel((prev) => !prev)} className="w-full sm:w-auto">
                    {showPeriodPlanPanel ? "Skjul periodeplan" : "Vis periodeplan"}
                  </OutlineButton>
                </div>
                {showPeriodPlanPanel ? (
                  <div className="mt-4 space-y-3">
                    {periodPlans.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
                        Ingen periodeplan er tilgjengelig ennå.
                      </div>
                    ) : (
                      periodPlans.slice(0, 1).map((plan) => (
                        <div key={plan.id} className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                          <div className="font-medium text-slate-800">{plan.title}</div>
                          <div className="mt-1 text-xs text-slate-500">Start: {plan.startDate} · {plan.weeks} uker · Lagret {plan.createdAt}</div>
                          {plan.notes ? <div className="mt-2 text-sm text-slate-600">{plan.notes}</div> : null}
                          {(plan.weeklyPlans ?? []).length > 1 ? (
                            <div className="mt-3">
                              <SelectBox
                                value={String(displayedPeriodWeek?.weekNumber ?? 1)}
                                onChange={(value) => setSelectedPeriodPlanWeekNumber(Math.max(1, Number(value) || 1))}
                                options={(plan.weeklyPlans ?? []).map((week) => ({
                                  value: String(week.weekNumber),
                                  label:
                                    week.weekNumber === (activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : -1)
                                      ? `Uke ${week.weekNumber} (nå)`
                                      : `Uke ${week.weekNumber}`,
                                }))}
                              />
                            </div>
                          ) : null}
                          {displayedPeriodWeek ? (
                            <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uke {displayedPeriodWeek.weekNumber}</div>
                              {periodPlanActionStatus ? <div className="mt-2 text-xs text-emerald-700">{periodPlanActionStatus}</div> : null}
                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                {([
                                  { key: "monday", label: "Mandag" },
                                  { key: "tuesday", label: "Tirsdag" },
                                  { key: "wednesday", label: "Onsdag" },
                                  { key: "thursday", label: "Torsdag" },
                                  { key: "friday", label: "Fredag" },
                                  { key: "saturday", label: "Lørdag" },
                                  { key: "sunday", label: "Søndag" },
                                ] as Array<{ key: WeekdayPlanKey; label: string }>).map((day) => (
                                  <div key={`${displayedPeriodWeek.id}-${day.key}`} className="rounded-lg border bg-slate-50 px-2 py-1.5 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                    <div>
                                      <span className="font-semibold text-slate-700">{day.label}:</span>{" "}
                                      <span className="text-slate-600">{displayedPeriodWeek.days[day.key] || "Ingen plan"}</span>
                                    </div>
                                    {displayedPeriodWeek.days[day.key]?.trim() ? (
                                      <div className="mt-2">
                                        {resolveProgramForPlannedEntry(displayedPeriodWeek.days[day.key]) ? (
                                          <OutlineButton
                                            onClick={() => {
                                              const matchedProgram = resolveProgramForPlannedEntry(displayedPeriodWeek.days[day.key]);
                                              if (!matchedProgram) return;
                                              startWorkoutMode(matchedProgram.id, buildStartWorkoutOptions(matchedProgram));
                                            }}
                                            className="w-full"
                                          >
                                            Start økt
                                          </OutlineButton>
                                        ) : (
                                          <OutlineButton
                                            onClick={() => handleQuickCompletePlannedEntry(displayedPeriodWeek.days[day.key])}
                                            className="w-full"
                                          >
                                            Marker gjennomført
                                          </OutlineButton>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <div className="mt-6 rounded-3xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">👥 Logg gruppetrening</div>
                    <div className="mt-1 text-xs text-slate-500">Registrer gruppetimer slik at PT ser all aktivitet.</div>
                  </div>
                  <OutlineButton onClick={() => setShowGroupWorkoutLogger((prev) => !prev)} className="w-full sm:w-auto">
                    {showGroupWorkoutLogger ? "Skjul logging" : "Logg gruppetrening"}
                  </OutlineButton>
                </div>
                {showGroupWorkoutLogger ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Gruppetime</span>
                        <SelectBox
                          value={groupWorkoutClassName}
                          onChange={(value) => setGroupWorkoutClassName(value)}
                          options={groupWorkoutClassOptions.map((className) => ({ value: className, label: className }))}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Notat (valgfritt)</span>
                        <TextInput value={groupWorkoutNote} onChange={(event) => setGroupWorkoutNote(event.target.value)} placeholder="Hvordan gikk timen?" />
                      </label>
                    </div>
                    {[
                      {
                        key: "group-energy",
                        question: "Hvordan føles energinivået nå?",
                        value: groupWorkoutEnergyLevel,
                        setValue: setGroupWorkoutEnergyLevel,
                      },
                      {
                        key: "group-difficulty",
                        question: "Hvor tung opplevdes timen?",
                        value: groupWorkoutDifficultyLevel,
                        setValue: setGroupWorkoutDifficultyLevel,
                      },
                      {
                        key: "group-motivation",
                        question: "Hvordan er motivasjonen videre?",
                        value: groupWorkoutMotivationLevel,
                        setValue: setGroupWorkoutMotivationLevel,
                      },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="text-xs font-medium text-slate-700">{item.question}</div>
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((level) => {
                            const numericLevel = level as 1 | 2 | 3 | 4 | 5;
                            const active = item.value === numericLevel;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => item.setValue(numericLevel)}
                                className={`rounded-xl border px-2 py-2 text-lg transition ${
                                  active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                                aria-label={`Velg nivå ${level}`}
                              >
                                {getReflectionEmoji(numericLevel)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      <GradientButton onClick={handleLogGroupWorkout} className="w-full sm:w-auto">Lagre gruppetime</GradientButton>
                      {groupWorkoutStatus ? <div className="text-xs text-emerald-700">{groupWorkoutStatus}</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="mt-6 rounded-3xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="font-semibold">📝 Siste 3 økter</div>
                <div className="mt-4 space-y-3">
                  {lastDeletedLogResult ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Øvelse slettet fra loggen.
                      <button type="button" onClick={undoDeleteLoggedExercise} className="ml-2 font-semibold underline">
                        Angre
                      </button>
                    </div>
                  ) : null}
                  {completedLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen økter logget ennå.</div> : null}
                  {completedLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{log.programTitle}</div>
                          <div className="mt-1 text-sm text-slate-500">{log.date}</div>
                        </div>
                        <GradientButton
                          className="px-3 py-1.5 text-xs"
                          onClick={() => setExpandedRecentLogId((prev) => (prev === log.id ? null : log.id))}
                        >
                          {expandedRecentLogId === log.id ? "Skjul detaljer" : "Se detaljer"}
                        </GradientButton>
                      </div>
                      {log.note ? <div className="mt-2 text-sm text-slate-600">{log.note}</div> : null}
                      {expandedRecentLogId === log.id ? (
                        <div className="mt-3 rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utført i økta</div>
                          <div className="mt-2 space-y-2">
                            {(log.results ?? []).length === 0 ? (
                              <div className="text-sm text-slate-500">Ingen settdata registrert for denne økta.</div>
                            ) : (
                              (log.results ?? []).map((result, index) => (
                                <div key={`${result.exerciseId}-${result.setNumber ?? 0}-${index}`} className="rounded-lg border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                  {(() => {
                                    const editKey = `${log.id}:${result.exerciseId}:${index}`;
                                    const isEditing = editingLoggedExerciseKey === editKey && Boolean(editingLoggedExerciseDraft);
                                    return (
                                      <>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium text-slate-800">{result.exerciseName}</div>
                                    <div className="flex items-center gap-1.5">
                                      {isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => saveEditLoggedExercise(log.id, index)}
                                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                          >
                                            Lagre
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditLoggedExercise}
                                            className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200"
                                          >
                                            Avbryt
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEditLoggedExercise(log.id, result, index)}
                                          className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                                        >
                                          Rediger
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLoggedExercise(log.id, result.exerciseId)}
                                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                                      >
                                        Slett
                                      </button>
                                    </div>
                                  </div>
                                  {isEditing && editingLoggedExerciseDraft ? (
                                    <div className="mt-2 grid gap-2">
                                      {result.exerciseCategory === "Kondisjon" ? (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                          <TextInput
                                            value={editingLoggedExerciseDraft.performedDurationMinutes}
                                            onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedDurationMinutes: e.target.value } : prev)}
                                            placeholder="Minutter"
                                          />
                                          <TextInput
                                            value={editingLoggedExerciseDraft.performedSpeed}
                                            onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedSpeed: e.target.value } : prev)}
                                            placeholder="Km/t"
                                          />
                                          <TextInput
                                            value={editingLoggedExerciseDraft.performedIncline}
                                            onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedIncline: e.target.value } : prev)}
                                            placeholder="Incline %"
                                          />
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                          <TextInput
                                            value={editingLoggedExerciseDraft.performedWeight}
                                            onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedWeight: e.target.value } : prev)}
                                            placeholder="Kg"
                                          />
                                          <TextInput
                                            value={editingLoggedExerciseDraft.performedReps}
                                            onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedReps: e.target.value } : prev)}
                                            placeholder="Reps"
                                          />
                                        </div>
                                      )}
                                      <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={editingLoggedExerciseDraft.completed}
                                          onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, completed: e.target.checked } : prev)}
                                        />
                                        Markert som fullført
                                      </label>
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-xs text-slate-600">
                                      {result.exerciseCategory === "Kondisjon"
                                        ? `Utført: ${result.performedDurationMinutes || "0"} min${result.performedSpeed ? ` · ${result.performedSpeed} km/t` : ""}${result.performedIncline ? ` · ${result.performedIncline}% incline` : ""}`
                                        : `Utført: ${result.performedWeight || "0"} kg x ${result.performedReps || "0"} reps`}
                                      {result.completed ? " - Fullført" : " - Ikke markert fullført"}
                                    </div>
                                  )}
                                      </>
                                    );
                                  })()}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              {showIntervalTimerModal ? (
                <div className="motus-modal-insets fixed inset-0 z-[10012] overscroll-contain bg-slate-900/60">
                  <div className="mx-auto flex h-full w-full max-w-2xl flex-col rounded-[30px] bg-white shadow-2xl">
                    <div className="border-b p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Intervallvindu</div>
                          <div className="text-xl font-semibold text-slate-900">{activeIntervalProgram?.title || "Intervalløkt"}</div>
                          <div className="mt-1 text-xs text-slate-500">{activeIntervalProgram?.goal || "Nedtelling per intervallsteg"}</div>
                        </div>
                        <OutlineButton onClick={closeIntervalTimerModal}>Lukk</OutlineButton>
                      </div>
                    </div>
                    <div className="motus-scroll-touch flex-1 space-y-4 overflow-auto p-4 sm:p-6">
                      <div
                        className="rounded-3xl p-5 text-white"
                        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                      >
                        <div className="text-sm uppercase tracking-wide text-white/90">
                          {currentIntervalProgramStep?.label || "Klar"}
                        </div>
                        <div className="mt-2 text-7xl font-black tracking-tight sm:text-8xl">{formatSeconds(intervalTimerRemainingSeconds)}</div>
                        <div className="mt-2 text-sm text-white/90">
                          Fart: {currentIntervalProgramStep?.speedHint || "-"} · Incline: {currentIntervalProgramStep?.inclineHint || "-"}
                        </div>
                        <div className="mt-2 text-sm text-white/90">
                          Neste: {intervalProgramSteps[intervalTimerStepIndex + 1]?.label || "Siste steg"}
                        </div>
                      </div>
                      <div className="rounded-2xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                          <span>Del {Math.min(intervalTimerStepIndex + 1, intervalProgramSteps.length || 1)} / {intervalProgramSteps.length || 1}</span>
                          <span>{intervalTimerProgressPercent}%</span>
                        </div>
                        <div className="mt-2 h-3 rounded-full bg-slate-200">
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${intervalTimerProgressPercent}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          Total tid: {formatSeconds(intervalTimerElapsedSeconds)} / {formatSeconds(intervalTimerTotalSeconds)}
                        </div>
                      </div>
                      {intervalTimerStatus ? (
                        <StatusMessage
                          message={intervalTimerStatus}
                          tone={intervalTimerStatus.toLowerCase().includes("fullført") ? "success" : "info"}
                          className="!rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>
                    <div className="border-t p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <GradientButton onClick={handleStartIntervalProgramTimer} disabled={!intervalProgramSteps.length}>
                          Start økt
                        </GradientButton>
                        <OutlineButton onClick={handlePauseResumeIntervalProgramTimer} disabled={!isIntervalTimerRunning}>
                          {isIntervalTimerPaused ? "Fortsett" : "Pause"}
                        </OutlineButton>
                        <OutlineButton onClick={handleSkipIntervalProgramStep} disabled={!intervalProgramSteps.length}>
                          Hopp over
                        </OutlineButton>
                        <OutlineButton onClick={handleResetIntervalProgramTimer} disabled={!intervalProgramSteps.length}>
                          Nullstill
                        </OutlineButton>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {activeWorkoutProgram && workoutMode ? (
                <div className="motus-modal-insets fixed inset-0 z-[10010] overscroll-contain bg-slate-900/40">
                  <div className="mx-auto flex h-full max-w-xl flex-col rounded-[28px] bg-white shadow-2xl">
                    <div className="border-b p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Økt-modus</div>
                          <div className="text-lg font-semibold">{activeWorkoutProgram.title}</div>
                          <div className="mt-1 text-sm text-slate-500">{workoutMode.results.filter(r => r.completed).length}/{workoutMode.results.length} sett fullført</div>
                        </div>
                        <OutlineButton onClick={cancelWorkoutMode}>Lukk</OutlineButton>
                      </div>
                    </div>

                    <div className="motus-scroll-touch flex-1 space-y-2 overflow-auto p-3">
                      {currentWorkoutGroup ? (
                        <div
                          key={currentWorkoutGroup.groupId}
                          className="w-full rounded-2xl border p-3 text-left transition bg-slate-50"
                          style={{ borderColor: "rgba(15,23,42,0.08)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-slate-400">Øvelse {workoutExerciseIndex + 1} av {workoutResultGroups.length}</div>
                              <div className="flex items-center gap-2">
                                <div className="font-medium">{currentWorkoutGroup.exerciseName}</div>
                                {replacementCandidates.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setShowReplacementOptions((prev) => !prev)}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                                    aria-label="Bytt øvelse"
                                    title="Bytt øvelse"
                                  >
                                    <Repeat2 className="h-3.5 w-3.5" />
                                    Bytt
                                  </button>
                                ) : null}
                              </div>
                              <div className="mt-1 text-sm text-slate-500">
                                {currentWorkoutGroup.rows[0]?.exerciseCategory === "Kondisjon"
                                  ? `Plan: ${currentWorkoutGroup.rows.length} runder × ${currentWorkoutGroup.rows[0]?.plannedDurationMinutes || "0"} min${currentWorkoutGroup.rows[0]?.plannedSpeed ? ` · ${currentWorkoutGroup.rows[0]?.plannedSpeed} km/t` : ""}${currentWorkoutGroup.rows[0]?.plannedIncline ? ` · ${currentWorkoutGroup.rows[0]?.plannedIncline}% incline` : ""}`
                                  : `Plan: ${currentWorkoutGroup.rows.length} sett × ${currentWorkoutGroup.plannedReps} reps · ${currentWorkoutGroup.plannedWeight}kg`}
                              </div>
                            </div>
                            {currentWorkoutExerciseImageUrl ? (
                              <div
                                className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24"
                                style={{ borderColor: "rgba(15,23,42,0.08)" }}
                              >
                                <img
                                  src={currentWorkoutExerciseImageUrl}
                                  alt={`Illustrasjon av ${currentWorkoutGroup.exerciseName}`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            ) : null}
                          </div>
                          {replacementCandidates.length > 0 && showReplacementOptions ? (
                            <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="text-xs font-medium text-slate-600">Velg ny øvelse (samme muskelgruppe)</div>
                              <div className="mt-2 grid gap-2">
                                {replacementCandidates.map((exercise) => (
                                  <button
                                    key={exercise.id}
                                    type="button"
                                    onClick={() => handleReplaceCurrentWorkoutExercise(exercise.id)}
                                    className="w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition hover:opacity-90"
                                    style={{
                                      borderColor: "rgba(20,184,166,0.35)",
                                      color: MOTUS.ink,
                                      background: "linear-gradient(135deg, rgba(20,184,166,0.10) 0%, rgba(236,72,153,0.10) 100%)",
                                    }}
                                  >
                                    {exercise.name} · {exercise.group}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div className={`mt-3 ${currentWorkoutGroup.rows.length <= 3 ? "space-y-1.5" : "space-y-2"}`}>
                            {currentWorkoutGroup.rows.map((row, index) => {
                              const resolvedExercise = exerciseByName.get(row.exerciseName.trim().toLowerCase());
                              const isCardio = (row.exerciseCategory ?? resolvedExercise?.category) === "Kondisjon";
                              const isTreadmill = (row.exerciseEquipment ?? resolvedExercise?.equipment ?? "").toLowerCase().includes("tredem");
                              const isCompactSetView = currentWorkoutGroup.rows.length <= 3;
                              return (
                              <div key={row.exerciseId} className={`rounded-xl border bg-white ${isCompactSetView ? "p-2.5" : "p-3"} ${row.completed ? "border-emerald-300" : "border-slate-200"}`}>
                                <div className={`${isCompactSetView ? "mb-1.5" : "mb-2"} flex items-center justify-between gap-2`}>
                                  <div className="text-xs font-semibold text-slate-600">Sett {row.setNumber ?? 1}</div>
                                  <button
                                    type="button"
                                    onClick={() => updateWorkoutExerciseResult(row.exerciseId, "completed", !row.completed)}
                                    className={`rounded-full ${isCompactSetView ? "px-2.5 py-0.5" : "px-3 py-1"} text-xs font-semibold ${row.completed ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"}`}
                                  >
                                    {row.completed ? "Fullført" : "Marker"}
                                  </button>
                                </div>
                                {isCardio ? (
                                  <div className={`grid ${isCompactSetView ? "gap-2" : "gap-3"} ${isTreadmill ? "grid-cols-3" : "grid-cols-1"}`}>
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-medium text-slate-500">Tid utført (min)</div>
                                      <TextInput
                                        ref={(input) => {
                                          workoutWeightInputRefs.current[row.exerciseId] = input;
                                        }}
                                        value={row.performedDurationMinutes ?? ""}
                                        onChange={(e) => handleWorkoutResultInputChange(row, "performedDurationMinutes", e.target.value, index, currentWorkoutGroup.rows)}
                                        placeholder="0"
                                        className={isCompactSetView ? "h-9 text-xs" : ""}
                                      />
                                    </div>
                                    {isTreadmill ? (
                                      <>
                                        <div className="space-y-1">
                                          <div className="text-[11px] font-medium text-slate-500">Fart (km/t)</div>
                                          <TextInput
                                            value={row.performedSpeed ?? ""}
                                            onChange={(e) => handleWorkoutResultInputChange(row, "performedSpeed", e.target.value, index, currentWorkoutGroup.rows)}
                                            placeholder="0"
                                            className={isCompactSetView ? "h-9 text-xs" : ""}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <div className="text-[11px] font-medium text-slate-500">Incline (%)</div>
                                          <TextInput
                                            value={row.performedIncline ?? ""}
                                            onChange={(e) => handleWorkoutResultInputChange(row, "performedIncline", e.target.value, index, currentWorkoutGroup.rows)}
                                            placeholder="0"
                                            className={isCompactSetView ? "h-9 text-xs" : ""}
                                          />
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className={`grid grid-cols-2 ${isCompactSetView ? "gap-2" : "gap-3"}`}>
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-medium text-slate-500">Kg utført</div>
                                      <TextInput
                                        ref={(input) => {
                                          workoutWeightInputRefs.current[row.exerciseId] = input;
                                        }}
                                        value={row.performedWeight}
                                        onChange={(e) => handleWorkoutResultInputChange(row, "performedWeight", e.target.value, index, currentWorkoutGroup.rows)}
                                        onFocus={(event) => event.currentTarget.select()}
                                        placeholder="0"
                                        className={`${isCompactSetView ? "h-9 text-xs" : ""} ${row.performedWeight === row.plannedWeight ? "text-slate-400" : "text-slate-800"}`}
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-medium text-slate-500">Reps utført</div>
                                      <TextInput
                                        value={row.performedReps}
                                        onChange={(e) => handleWorkoutResultInputChange(row, "performedReps", e.target.value, index, currentWorkoutGroup.rows)}
                                        onFocus={(event) => event.currentTarget.select()}
                                        placeholder="0"
                                        className={`${isCompactSetView ? "h-9 text-xs" : ""} ${row.performedReps === row.plannedReps ? "text-slate-400" : "text-slate-800"}`}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )})}
                          </div>
                        </div>
                      ) : null}

                      {!showWorkoutReflection ? (
                        <TextArea value={workoutMode.note} onChange={(e) => updateWorkoutModeNote(e.target.value)} className="min-h-[110px]" placeholder="Hvordan gikk økta?" />
                      ) : (
                        <div className="rounded-2xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">Etter økta</div>
                            <div className="text-xs text-slate-500">Svar med emoji før økta lagres.</div>
                          </div>
                          {[
                            {
                              key: "energy",
                              question: "Hvordan føles energinivået nå?",
                              value: reflectionEnergyLevel,
                              setValue: setReflectionEnergyLevel,
                            },
                            {
                              key: "difficulty",
                              question: "Hvor tung opplevdes økta?",
                              value: reflectionDifficultyLevel,
                              setValue: setReflectionDifficultyLevel,
                            },
                            {
                              key: "motivation",
                              question: "Hvordan er motivasjonen videre?",
                              value: reflectionMotivationLevel,
                              setValue: setReflectionMotivationLevel,
                            },
                          ].map((item) => (
                            <div key={item.key} className="space-y-2">
                              <div className="text-xs font-medium text-slate-700">{item.question}</div>
                              <div className="grid grid-cols-5 gap-2">
                                {[1, 2, 3, 4, 5].map((level) => {
                                  const numericLevel = level as 1 | 2 | 3 | 4 | 5;
                                  const active = item.value === numericLevel;
                                  return (
                                    <button
                                      key={level}
                                      type="button"
                                      onClick={() => item.setValue(numericLevel)}
                                      className={`rounded-xl border px-2 py-2 text-lg transition ${
                                        active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
                                      }`}
                                      aria-label={`Velg nivå ${level}`}
                                    >
                                      {getReflectionEmoji(numericLevel)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          <TextArea
                            value={reflectionNote}
                            onChange={(e) => setReflectionNote(e.target.value)}
                            className="min-h-[90px]"
                            placeholder="Notat til PT (valgfritt)"
                          />
                        </div>
                      )}
                    </div>

                    <div className="sticky bottom-0 border-t bg-white p-3 sm:p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex gap-3">
                        <OutlineButton className="flex-1" onClick={cancelWorkoutMode}>Avbryt</OutlineButton>
                        <OutlineButton
                          className="flex-1"
                          onClick={() => setWorkoutExerciseIndex((prev) => Math.max(0, prev - 1))}
                          disabled={workoutExerciseIndex === 0}
                        >
                          Forrige øvelse
                        </OutlineButton>
                        {workoutExerciseIndex < workoutResultGroups.length - 1 ? (
                          <GradientButton className="flex-1" onClick={handleGoToNextWorkoutExercise}>
                            Neste øvelse
                          </GradientButton>
                        ) : (
                          <GradientButton
                            className="flex-1"
                            disabled={isSavingWorkout}
                            onClick={() => {
                              if (!showWorkoutReflection) {
                                setShowWorkoutReflection(true);
                                return;
                              }
                              if (isSavingWorkout) return;
                              setIsSavingWorkout(true);
                              finishWorkoutMode({ reflection: buildWorkoutReflection() });
                              window.setTimeout(() => setIsSavingWorkout(false), 600);
                            }}
                          >
                            {showWorkoutReflection ? (isSavingWorkout ? "Lagrer..." : "Lagre økt") : "Til oppsummering"}
                          </GradientButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
            </>
          ) : null}

          {memberTab === "progress" ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Fremgang</h2>
                  <p className="text-sm text-slate-500">Utvikling, PR-er og treningsflyt</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">📸 Delbar progresjonsoppsummering</div>
                    <div className="mt-1 text-xs text-slate-500">Story-format av “Denne måneden” for rask deling.</div>
                  </div>
                  <OutlineButton onClick={() => void shareMonthlyProgressSummary()} className="w-full sm:w-auto">
                    Del denne måneden
                  </OutlineButton>
                </div>
                {progressShareStatus ? (
                  <StatusMessage
                    message={progressShareStatus}
                    tone={progressShareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
                    className="mt-3 !rounded-xl !px-3 !py-2 !text-xs"
                  />
                ) : null}
              </div>
              <div className="mt-4 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">🏆 Streaks + achievements</div>
                <div className="mt-1 text-xs text-slate-500">
                  Små milepæler som holder motivasjonen oppe. Nivå {achievementLevel} av {achievementMaxLevel}
                  {hasCompletedAllAchievementLevels ? " · Maksnivå nådd ✨" : ""}
                </div>
                <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-700">Streak denne perioden: {streakWeeks} uker</div>
                  <div className="mt-2 text-xs text-slate-500">Streak teller sammenhengende treningsuker med fullførte økter.</div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {achievements.map((achievement) => (
                    <div key={achievement.id} className={`rounded-xl border px-3 py-2 text-sm ${achievement.unlocked ? "border-emerald-300 bg-emerald-50/80 text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{achievement.label}</div>
                        <div className="text-lg">{achievement.icon}</div>
                      </div>
                      <div className="mt-0.5 text-[11px]">{achievement.hint}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, Math.round((Math.min(achievement.current, achievement.target) / achievement.target) * 100))}%`,
                            background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] font-semibold">
                        <span>{Math.min(achievement.current, achievement.target)}/{achievement.target}</span>
                        <span>{achievement.unlocked ? "Låst opp ✨" : "På vei"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">🏋️ Personlige rekorder</div>
                <div className="mt-1 text-xs text-slate-500">Beste løft registrert per øvelse.</div>
                <div className="mt-4 space-y-3">
                  {personalRecords.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen PR-er registrert ennå.</div> : null}
                  {personalRecords.map((record) => (
                    <div key={record.name} className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="font-medium">{record.name}</div>
                      <div className="mt-1 text-sm text-slate-500">Beste registrerte: {record.weight} kg × {record.reps}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">🧠 Smart progresjonsforslag</div>
                <div className="mt-1 text-xs text-slate-500">Basert på siste økt: hva du bør gjøre neste gang per øvelse.</div>
                <div className="mt-4 space-y-3">
                  {progressionSuggestions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">
                      Logg en styrkeøkt med settdata for å få smarte forslag her.
                    </div>
                  ) : null}
                  {progressionSuggestions.map((suggestion) => (
                    <div key={suggestion.exerciseName} className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="font-medium text-slate-800">{suggestion.exerciseName}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700">{suggestion.recommendation}</div>
                      <div className="mt-1 text-xs text-slate-500">{suggestion.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {memberTab === "messages" ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><MessageSquare className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Meldinger</h2>
                  <p className="text-sm text-slate-500">Enkel chat</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div ref={memberMessagesContainerRef} className="max-h-64 space-y-3 overflow-auto rounded-2xl border bg-slate-50 p-4">
                  {memberMessages.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">
                      Ingen meldinger ennå. Skriv en kort status til trener, så holder dere kontakten.
                    </div>
                  ) : null}
                  {memberMessages.map((message) => (
                    <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.id === memberMessages[memberMessages.length - 1]?.id ? "motus-fade-in-up" : ""} ${message.sender === "member" ? "text-white ml-auto" : "bg-white border"}`} style={message.sender === "member" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                      <div>{message.text}</div>
                      <div className={`mt-1 text-[11px] ${message.sender === "member" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <TextInput value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Skriv melding til trener" />
                  <GradientButton onClick={() => {
                    if (!activeMemberId || !messageText.trim()) return;
                    sendMemberMessage(activeMemberId, messageText);
                    setMessageText("");
                  }}>Send</GradientButton>
                </div>
              </div>
            </Card>
          ) : null}

          {memberTab === "profile" ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Target className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Medlemsprofil</h2>
                  <p className="text-sm text-slate-500">Se og rediger kundeinformasjon</p>
                </div>
              </div>
              {editableMember ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Kundeinformasjon</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Navn</span>
                        <TextInput value={memberNameDraft} onChange={(e) => setMemberNameDraft(e.target.value)} placeholder="Navn" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">E-post</span>
                        <TextInput value={memberEmailDraft} onChange={(e) => setMemberEmailDraft(e.target.value)} placeholder="E-post" />
                      </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Telefon</span>
                        <TextInput value={memberPhoneDraft} onChange={(e) => setMemberPhoneDraft(e.target.value)} placeholder="Telefon" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Fødselsdato</span>
                        <TextInput value={memberBirthDateDraft} onChange={(e) => setMemberBirthDateDraft(e.target.value)} placeholder="Fødselsdato (dd.mm.yyyy)" />
                      </label>
                    </div>
                    <label className="space-y-1">
                      <span className="text-sm font-semibold text-slate-700">Mål</span>
                      <SelectBox
                        value={MEMBER_GOAL_OPTIONS.includes(memberGoalDraft as (typeof MEMBER_GOAL_OPTIONS)[number]) ? memberGoalDraft : ""}
                        onChange={(value) => setMemberGoalDraft(value)}
                        options={[
                          { value: "", label: "Velg mål" },
                          ...MEMBER_GOAL_OPTIONS.map((goal) => ({ value: goal, label: goal })),
                        ]}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm font-semibold text-slate-700">Skader / hensyn</span>
                      <TextArea value={memberInjuriesDraft} onChange={(e) => setMemberInjuriesDraft(e.target.value)} className="min-h-[90px]" placeholder="Skader / hensyn" />
                    </label>
                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                      <div><span className="font-medium text-slate-800">Status:</span> {customerStatusLabel}</div>
                      <div><span className="font-medium text-slate-800">Siste trening:</span> {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Profilbilde</div>
                    {memberAvatarUrl ? (
                      <img src={memberAvatarUrl} alt="Ditt profilbilde" className="h-24 w-24 rounded-full object-cover border" style={{ borderColor: "rgba(15,23,42,0.12)" }} loading="eager" decoding="async" />
                    ) : (
                      <div className="text-xs text-slate-500">Ingen bilde valgt ennå.</div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleAvatarFileSelected(event.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium"
                    />
                    {memberAvatarUrl ? (
                      <OutlineButton onClick={() => setMemberAvatarUrl("")} className="w-full md:w-auto">
                        Fjern profilbilde
                      </OutlineButton>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Unike mål</div>
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <SelectBox
                        value={goalMetricDraft}
                        onChange={(value) => setGoalMetricDraft(value as "sessionsPerWeek" | "dailySteps" | "targetWeight")}
                        options={[
                          { value: "sessionsPerWeek", label: "Antall treninger per uke" },
                          { value: "dailySteps", label: "Skritt per dag" },
                          { value: "targetWeight", label: "Målvekt (kg)" },
                        ]}
                      />
                      <TextInput value={goalMetricValueDraft} onChange={(e) => setGoalMetricValueDraft(e.target.value)} placeholder="Målverdi" />
                      <OutlineButton onClick={applyMetricDraftToProfile}>Sett mål</OutlineButton>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3 text-sm text-slate-600">
                      <div className="rounded-xl border bg-white p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>Økter/uke: {profileSessionsPerWeekTarget || "Ikke satt"}</div>
                      <div className="rounded-xl border bg-white p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>Skritt/dag: {profileDailyStepsTarget || "Ikke satt"}</div>
                      <div className="rounded-xl border bg-white p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>Målvekt: {profileTargetWeight ? `${profileTargetWeight} kg` : "Ikke satt"}</div>
                    </div>
                    <TextInput value={profileCurrentDailySteps} onChange={(e) => setProfileCurrentDailySteps(e.target.value)} placeholder="Dagens skritt (for målstatus)" />
                  </div>
                  <div className="rounded-2xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Mikro-feiringer</div>
                    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <span>Vis små feiringer for PR/streak</span>
                      <input
                        type="checkbox"
                        checked={microCelebrationsEnabled}
                        onChange={(e) => setMicroCelebrationsEnabled(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <span>Spill av feiringslyd</span>
                      <input
                        type="checkbox"
                        checked={celebrationSoundEnabled}
                        onChange={(e) => setCelebrationSoundEnabled(e.target.checked)}
                        disabled={!microCelebrationsEnabled}
                      />
                    </label>
                  </div>
                  {supabaseClient && isWebPushConfigurable() ? (
                    <div className="rounded-2xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-sm font-semibold text-slate-700">Varsler på denne enheten</div>
                      <p className="text-xs text-slate-600">
                        Godta varslinger her. Når VAPID og Edge Functions er satt opp i Supabase, får du push ved nye meldinger i chat (trener ↔ medlem).
                      </p>
                      <OutlineButton type="button" onClick={handleRegisterWebPush} disabled={pushRegisterBusy} className="w-full md:w-auto">
                        {pushRegisterBusy ? "Aktiverer…" : "Slå på push-varsler"}
                      </OutlineButton>
                      {pushRegisterStatus ? (
                        <StatusMessage
                          message={pushRegisterStatus}
                          tone={pushRegisterStatus.startsWith("Push-varsler er") ? "success" : "error"}
                          className="!rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <GradientButton onClick={saveProfile} className="w-full md:w-auto">Lagre min profil</GradientButton>
                  {profileSaveInfo ? (
                    <StatusMessage
                      message={profileSaveInfo}
                      tone={profileSaveInfo.toLowerCase().includes("feilet") ? "error" : "success"}
                      className="!rounded-xl !px-3 !py-2 !text-xs"
                    />
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed bg-slate-50 px-3 py-3 text-sm text-slate-500">
                  Fant ingen medlemsprofil akkurat nå. Prøv å logge ut og inn igjen.
                  <OutlineButton onClick={() => setMemberTab("overview")} className="mt-3 w-full sm:w-auto">
                    Gå til oversikt
                  </OutlineButton>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
}
