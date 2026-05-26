import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  ClipboardPenLine,
  Clock3,
  Dumbbell,
  Eye,
  EyeOff,
  Layers,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Play,
  Printer,
  Search,
  Share2,
  Signal,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserCircle2,
  Users,
} from "lucide-react";
import { MOTUS } from "../app/data";
import motusLogo from "../assets/motus-logo-transparent.svg";
// Bruker den originale Motus-merke-PNG-en (samme som banneret) på skrytekortet,
// slik at logoen vises i merkevarens farger og ikke som en flat hvit silhuett.
import motusSkrytekortLogo from "../assets/motus-logo-transparent.png";
import { formatDateDdMmYyyy, parseStoredLogDate, resolveWorkoutLogDateTime, storedLogDatesMatch } from "../app/dateFormat";
import { memberBadgeImageSrc } from "../app/badgeAssets";
import { resolveExerciseImageSrc } from "../app/exerciseIllustrations";
import { imageObjectPositionFromSrc } from "../app/imageFocalPoint";
import { programCoverUsesPhotoStyle, resolveGroupWorkoutCoverImage, resolveProgramImageSrc, resolveRestDayCoverImage } from "../app/programImage";
import {
  memberLocalDateKey,
  readMemberHomeWorkoutSnapshot,
  writeMemberHomeWorkoutSnapshot,
} from "../app/memberSessionCache";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "../app/exerciseCategories";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import {
  enrichMemberWithBestProfile,
  hasSubstantiveOnboardingAnswers,
  isMemberOnboardingSubmitted,
  parsePersonalGoalsJson,
  pickCanonicalMemberRowForProfile,
  readProfileExtensions,
  mergePersonalGoalsFromCandidates,
  resolveMemberPersonalGoals,
} from "../app/memberOnboarding";
import { pickBestPersonalGoals } from "../app/memberProfileGoals";
import {
  patchMemberNotificationPreferencesInPersonalGoals,
  readMemberNotificationPreferencesFromPersonalGoals,
} from "../app/notificationPreferences";
import { motusShareStatusMessage, sharePersonalRecordCard } from "../app/motusShareCard";
import { buildTrainingProgramFromWorkoutMode } from "../app/pausedWorkoutSession";
import {
  formatPausedWorkoutExpiry,
  getPausedWorkoutByProgramId,
  listPausedWorkouts,
  pausedWorkoutProgress,
  purgeExpiredPausedWorkouts,
} from "../app/pausedWorkoutStorage";
import { printHtmlDocument } from "../app/printHtmlDocument";
import {
  buildTrainingProgramDisplayKey,
  buildWorkoutResultGroups,
  dedupeTrainingPrograms,
  isLegacyIntervalCooldownDrag,
  programIsInMemberArchive,
} from "../app/programBlocks";
import { memberMayDeleteProgram, memberMayEditProgram } from "../app/programAuthor";
import {
  buildCheckInNotificationCopy,
  resolveCheckInWindow,
  shouldPromptMonthlyCheckIn,
} from "../app/memberMonthlyCheckIn";
import { isLikelyValidBirthDate, normalizeBirthDate, normalizePhone } from "../app/validators";
import { supabaseClient } from "../services/supabaseClient";
import { isWebPushConfigurable, registerWebPushWithSupabase } from "../services/webPush";
import { Card, ConfirmDialog, DangerButton, EmptyState, GradientButton, MemberTabHero, MotusSectionIcon, OutlineButton, SelectBox, StatusMessage, TextArea, TextInput, TrainingStartButton } from "../app/ui";
import { useToastStatus } from "../app/toast";
import { uid } from "../app/storage";
import type {
  LogCompletedPlanEntryInput,
  LogGroupWorkoutInput,
  LogIntervalWorkoutInput,
  ReplaceWorkoutExerciseGroupInput,
  SaveProgramInput,
  StartCustomWorkoutInput,
  StartWorkoutModeOptions,
  DeleteProgramContext,
  UpdateMemberInput,
} from "../services/appRepository";
import {
  buildPeriodPlanLinkedProgramIdSet,
  findPeriodPlanForProgram,
  findProgramForPeriodPlanEntry,
  groupWorkoutLogTitle,
  isGroupPeriodPlanEntry,
  isPassivePeriodPlanEntry,
  isPeriodPlanEntryDateInFuture,
  resolveGroupClassNameFromPeriodEntry,
  resolvePeriodPlanEntryAction,
} from "../app/periodPlanEntryActions";
import {
  buildTrainerPeriodPlanIdSet,
  isMemberOwnedPeriodPlan,
  mergedPeriodPlanListForMember,
  periodPlanSelectableWeekCount,
  readHiddenPeriodPlanIdsForMembers,
  readPeriodPlansByMemberId,
  removeMemberOwnedPeriodPlanFromStorage,
  findPeriodPlanAutoCompleteTargets,
  buildPeriodPlanEntryKey,
  isPeriodPlanDayComplete,
  periodPlanEntryMatchesCompletedProgram,
  derivePeriodPlanCompletedEntryKeysFromLogs,
  findPeriodPlanEntryForCalendarDate,
  readActivePeriodPlanIdForMembers,
  resolvePeriodPlanWeekNumberForDate,
  writeActivePeriodPlanIdForMembers,
  buildPeriodPlanPlannedEntriesByMonth,
  parsePeriodPlanStartDate,
  resolvePeriodPlanPlannedDate,
  resolvePeriodPlanWeek,
  resolveTodayPeriodPlanEntryForHome,
  writeHiddenPeriodPlanIdsForMembers,
} from "../app/periodPlanMerge";
import {
  mergePeriodPlanCompletionIntoPersonalGoals,
  readPeriodPlanCompletionFromPersonalGoals,
  reconcilePeriodPlanCompletionKeys,
} from "../app/periodPlanCompletionPrefs";
import {
  applyPeriodPlanSwaps,
  buildPeriodPlanWeekOverride,
  getPeriodPlanSwapsStorageKey,
  getSwapsForWeek,
  parsePeriodPlanSwapsState,
  setSwapsForWeek,
  togglePeriodPlanMove,
  togglePeriodPlanSwap,
  WEEKDAY_PLAN_LABELS,
  WEEKDAY_PLAN_ORDER,
  type PeriodPlanSwapsByPlan,
} from "../app/periodPlanSwaps";
import {
  computeActiveCardioMinutesFromLogs,
  computeMaxLiftKgFromLogs,
  computeMemberBadges,
  computeMonthUniqueDays,
  computeMonthWeeksWithSession,
  formatBadgeMetricValue,
  getBadgeNextLevel,
  type MemberBadge,
} from "../app/memberBadges";
import {
  ACHIEVEMENT_MAX_LEVEL,
  buildCelebrationCopy,
  computeMemberProgressState,
} from "../app/memberProgressGamification";
import { computeMemberProgressScores } from "../app/memberMomentumScores";
import { getTrainingProgramSubTab, trainingProgramCategoryLabel, isConditioningTrainingProgram } from "../app/trainingProgramKind";
import { programsAttributedToMember } from "../app/memberActivity";
import { BadgeImage } from "./BadgeImage";
import { MemberBadgesCarousel } from "./MemberBadgesCarousel";
import { MemberProfileDashboard } from "./MemberProfileDashboard";
import { CustomWorkoutBuilder } from "./CustomWorkoutBuilder";
import {
  MemberHomeCompactPrompt,
  MemberHomeOverview,
  MemberHomeSecondaryLink,
  MemberHomeStartWorkoutButton,
} from "./MemberHomeOverview";
import { MemberHomeBelowWorkout } from "./MemberHomeBelowWorkout";
import { MemberHomeWeeklyProgress } from "./MemberHomeWeeklyProgress";
import { MemberHomeNextPlanCard, MemberHomeStatusGradientCard } from "./MemberHomeNextPlanCard";
import { MemberProgressScoresCard } from "./MemberProgressScoresCard";
import { buildShareProgramChatMessage } from "../app/chatFormat";
import { computeWeekProgressPct } from "../app/memberHomeWeekInsights";
import type { ChatReactionActor, ChatReactionEmoji } from "../app/chatReactions";
import { MotusChat, type MotusChatQuickAction } from "./MotusChat";
import { resolveMemberTrainerDisplayName } from "../app/trainerProfile";
import { MemberPersonalRecordsSection } from "./MemberPersonalRecordsSection";
import { WorkoutCelebrationModal } from "./WorkoutCelebrationModal";
import { computeWorkoutCelebrationStats } from "../app/workoutCelebrationStats";
import { MemberWeeklySummaryCard } from "./MemberWeeklySummaryCard";
import { MemberProgressStatusBanner } from "./MemberProgressStatusBanner";
import { MemberConsistencyWeekCard } from "./MemberConsistencyWeekCard";
import { MemberProgressHighlightRow } from "./MemberProgressHighlightRow";
import { MemberNextWorkoutCard } from "./MemberNextWorkoutCard";
import {
  computeDailyWeekProgress,
  computeWeeklyProgressDelta,
  computeWeeklyProgressPct,
} from "../app/memberTrainingWeekChart";
import { MemberTrainingHistoryView } from "./MemberTrainingHistoryView";
import { MemberTrainingOverview } from "./MemberTrainingOverview";
import { MemberTrainingQuickActions } from "./MemberTrainingQuickActions";
import { MemberTrainingFlowCard } from "./MemberTrainingFlowCard";
import { extractZoneFromPlanEntry, formatWeekMinutesLabel, formatWeekSessionsLabel } from "./MemberTrainingTodayCard";
import { buildWeekDayModels, MemberTrainingCalendar } from "./MemberTrainingCalendar";
import { getMondayStart, toCalendarDateKey, type TrainingCalendarDayStatus } from "../app/memberTrainingCalendar";
import { MuscleSplitCard } from "./MuscleSplitCard";
import { IntervalWorkoutSessionModal } from "./IntervalWorkoutSessionModal";
import { LiveWorkoutSessionModal } from "./LiveWorkoutSessionModal";
import { PersonalRecordProgressModal } from "./PersonalRecordProgressModal";
import { PeriodPlanActiveView } from "./PeriodPlanActiveView";
import {
  buildExerciseGroupByName,
  computeMuscleGroupStats,
  type MuscleSplitMetric,
  type MuscleSplitPeriod,
} from "./muscleSplitStats";
import { getStatusClearDelayMs, useAutoClearStatus } from "../app/statusAutoClear";
import type {
  ChatMessage,
  Exercise,
  Member,
  MemberProgramLibraryStatus,
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

function ClientAvatarFallback({ className = "", iconClassName = "h-6 w-6" }: { className?: string; iconClassName?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${className}`} aria-hidden="true">
      <UserCircle2 className={iconClassName} strokeWidth={1.7} />
    </div>
  );
}

function inferStatusTone(message: string): "success" | "error" | "info" {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return "info";
  if (
    normalized.includes("feilet") ||
    normalized.includes("kunne ikke") ||
    normalized.includes("ugyldig") ||
    normalized.includes("mangler") ||
    normalized.includes("ingen ")
  ) {
    return "error";
  }
  if (
    normalized.includes("lagret") ||
    normalized.includes("sendt") ||
    normalized.includes("oppdatert") ||
    normalized.includes("slettet") ||
    normalized.includes("aktivert") ||
    normalized.includes("slått på")
  ) {
    return "success";
  }
  return "info";
}

type MemberPortalProps = {
  members: Member[];
  currentUserRole: "trainer" | "member";
  currentUserEmail: string;
  /** Supabase auth user id — programs/logs sometimes use this as member_id instead of members.id */
  currentUserSupabaseId?: string;
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
  toggleChatMessageReaction: (messageId: string, emoji: ChatReactionEmoji, actor: ChatReactionActor) => void;
  workoutMode: WorkoutModeState | null;
  startWorkoutMode: (programId: string, options?: StartWorkoutModeOptions) => void;
  startCustomWorkout: (input: StartCustomWorkoutInput, options?: StartWorkoutModeOptions) => void;
  saveProgramForMember: (input: SaveProgramInput) => void;
  deleteProgramById: (programId: string, context?: DeleteProgramContext) => void;
  updateProgramMemberLibraryStatus: (programId: string, status: MemberProgramLibraryStatus | undefined) => void;
  updateWorkoutExerciseResult: (
    exerciseId: string,
    field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline" | "completed",
    value: string | boolean,
  ) => void;
  replaceWorkoutExerciseGroup: (input: ReplaceWorkoutExerciseGroupInput) => void;
  appendWorkoutSetForProgramExercise: (programExerciseId: string) => void;
  deferWorkoutExerciseGroup: (programExerciseId: string) => void;
  removeWorkoutLogResult: (input: { logId: string; exerciseId: string }) => void;
  setWorkoutLogResults: (input: { logId: string; results: WorkoutLog["results"] }) => void;
  updateWorkoutModeNote: (note: string) => void;
  updateWorkoutExerciseNote: (programExerciseId: string, note: string) => void;
  finishWorkoutMode: (input?: { reflection?: WorkoutReflection }) => void;
  logGroupWorkout: (input: LogGroupWorkoutInput) => void;
  logIntervalWorkout: (input: LogIntervalWorkoutInput) => void;
  logCompletedPlanEntry: (input: LogCompletedPlanEntryInput) => void;
  removeGroupWorkoutLog: (input: { memberId: string; className: string; date?: string }) => void;
  removeCompletedPlanEntryLog: (input: { memberId: string; programTitle: string; date?: string }) => void;
  cancelWorkoutMode: () => void;
  dismissWorkoutMode: () => void;
  resumePausedWorkout: (draftId: string, memberIdHint?: string) => void;
  discardPausedWorkoutDraft: (memberId: string, draftId: string) => void;
  workoutCelebration: WorkoutCelebration | null;
  dismissWorkoutCelebration: () => void;
  recentlyFinishedLogId: string | null;
  dismissRecentlyFinishedLog: () => void;
  memberFocusWorkoutLogId?: string | null;
  clearMemberFocusWorkoutLogId?: () => void;
  memberFocusProgramId?: string | null;
  clearMemberFocusProgramId?: () => void;
  /** Periodeplaner fra Supabase (hydrate-member-data). */
  remoteMemberPeriodPlanRows?: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  /** Første sky-hydrate for medlem er ferdig — unngår feil «Dagens økt» under lasting. */
  memberRemoteHydrated?: boolean;
  isLocalDemoSession?: boolean;
  /** Etter lagring: kjør hydrate fra Supabase (persist er asynk) */
  refreshRemoteHydration?: () => void | Promise<void>;
  onOpenMonthlyCheckIn?: () => void;
  onOpenOnboarding?: () => void;
  onDismissOnboardingHomePrompt?: () => void;
  showOnboardingHomePrompt?: boolean;
  /** Når false: vis knapp for å fylle ut / sende skjema på nytt (f.eks. etter mislykket sky-lagring). */
  onboardingSubstantivelyComplete?: boolean;
  homeOverviewHeaderActions?: ReactNode;
  homeOverviewNotificationsPanel?: ReactNode;
};

const MEMBER_AVATAR_BUCKET = "exercise-images";
const MEMBER_AVATAR_PREFIX = "member-avatars";
const EMPTY_REMOTE_PERIOD_PLAN_ROWS: Array<{ memberId: string; plan: PeriodSchedulePlan }> = [];
const PERIOD_PLAN_COMPLETED_STORAGE_PREFIX = "MOTUS_PERIOD_PLAN_COMPLETED_V1:";
const PERIOD_PLAN_DISMISSED_STORAGE_PREFIX = "MOTUS_PERIOD_PLAN_DISMISSED_V1:";
const HIDDEN_BADGE_SEEN_STORAGE_PREFIX = "MOTUS_HIDDEN_BADGE_SEEN_V1:";
const HIDDEN_BADGE_POPUP_COPY: Record<string, string> = {
  "may-17-workout": "Du registrerte en økt på 17. mai. Sterk nasjonaldagsinnsats.",
  "never-two-weeks-without": "Du har holdt treningen i gang i 6 måneder uten pause over 14 dager.",
  "back-again": "Du kom tilbake etter en lang pause. Det teller.",
  "habit-sticks": "Det har gått 100 dager siden første økt. Vanen sitter.",
  "before-sunrise": "Du registrerte trening mellom kl. 05:00 og 08:00. Morgenfugl!",
  "evening-trainer": "Du registrerte trening mellom kl. 20:00 og 23:00. Kveldstrener!",
  "summer-loyal": "Du trente i juli. Sommerformen holdes i gang.",
  "new-start": "Du registrerte årets første økt. Nytt år, ny start.",
  "easter-pump": "Du trente i påsken. Påskeegget fikk litt pump.",
  "pinse-trener": "Du trente pinseaften eller på pinse. Pinsetrener!",
  "football-jersey-friday": "Du trente på fotballtrøyefredag.",
  "christmas-pump": "Du trente i jula. Sterk innsats mellom ribbe og ro.",
};
const DEFAULT_HOME_VISIBILITY = {
  weeklyStats: true,
  streakChallenges: true,
  nextStep: true,
  nextOnPlan: true,
  calendar: true,
} as const;
type HomeSectionKey = keyof typeof DEFAULT_HOME_VISIBILITY;

type PeriodPlanWorkoutStartContext = {
  planId: string;
  weekNumber: number;
  day: WeekdayPlanKey;
  entry: string;
};

/** Stored in members.personal_goals so økt/skritt/mål synkes på tvers av enheter. */
const PROFILE_METRICS_PREFIX = "MOTUS_PROFILE_V1:";

type ProfileMetricsDraft = {
  sessionsPerWeekTarget: string;
  dailyStepsTarget: string;
  targetWeight: string;
  currentDailySteps: string;
};

type SyncedHomePreferences = {
  homeVisibility?: Partial<Record<HomeSectionKey, boolean>>;
  favoritePersonalRecords?: string[];
};

type ProfileMetricsPayload = SyncedHomePreferences &
  ProfileMetricsDraft & {
    onboarding?: import("../app/memberOnboarding").MemberOnboardingAnswers;
    onboardingCompletedAt?: string;
    monthlyCheckIns?: unknown[];
  };

function normalizeFavoritePersonalRecordNames(names?: string[]): string[] | undefined {
  if (!Array.isArray(names)) return undefined;
  const normalized = Array.from(
    new Set(
      names
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, 3);
  return normalized.length ? normalized : undefined;
}

function normalizeHomeVisibilityForStorage(
  homeVisibility?: Partial<Record<HomeSectionKey, boolean>>,
): Partial<Record<HomeSectionKey, boolean>> | undefined {
  if (!homeVisibility) return undefined;
  const normalized: Partial<Record<HomeSectionKey, boolean>> = {};
  (Object.keys(DEFAULT_HOME_VISIBILITY) as HomeSectionKey[]).forEach((key) => {
    const value = homeVisibility[key];
    if (typeof value === "boolean") normalized[key] = value;
  });
  return Object.keys(normalized).length ? normalized : undefined;
}

function encodeMemberProfileMetrics(
  metrics: ProfileMetricsDraft,
  preferences?: SyncedHomePreferences,
  existingPersonalGoals?: string,
): string {
  const existing = decodeMemberProfilePayload(existingPersonalGoals);
  const normalizedHomeVisibility = normalizeHomeVisibilityForStorage(
    preferences?.homeVisibility ?? existing?.homeVisibility,
  );
  const normalizedFavoritePersonalRecords = normalizeFavoritePersonalRecordNames(
    preferences?.favoritePersonalRecords ?? existing?.favoritePersonalRecords,
  );
  const profileExtensions = readProfileExtensions(existingPersonalGoals);
  const payload: ProfileMetricsPayload = {
    ...metrics,
    ...(normalizedHomeVisibility ? { homeVisibility: normalizedHomeVisibility } : {}),
    ...(normalizedFavoritePersonalRecords ? { favoritePersonalRecords: normalizedFavoritePersonalRecords } : {}),
    ...(profileExtensions.onboarding
      ? {
          onboarding: profileExtensions.onboarding as ProfileMetricsPayload["onboarding"],
          onboardingCompletedAt: String(profileExtensions.onboardingCompletedAt ?? ""),
        }
      : profileExtensions.onboardingCompletedAt
        ? { onboardingCompletedAt: String(profileExtensions.onboardingCompletedAt) }
        : {}),
    ...(Array.isArray(profileExtensions.monthlyCheckIns)
      ? { monthlyCheckIns: profileExtensions.monthlyCheckIns }
      : {}),
    ...(profileExtensions.notificationPreferences && typeof profileExtensions.notificationPreferences === "object"
      ? { notificationPreferences: profileExtensions.notificationPreferences }
      : {}),
  };
  return `${PROFILE_METRICS_PREFIX}${JSON.stringify(payload)}`;
}

function decodeMemberProfilePayload(personalGoals: string | undefined): ProfileMetricsPayload | null {
  const parsed = parsePersonalGoalsJson(personalGoals);
  if (!parsed) return null;
  const onboardingRaw = parsed.onboarding;
  return {
    sessionsPerWeekTarget: String(parsed.sessionsPerWeekTarget ?? ""),
    dailyStepsTarget: String(parsed.dailyStepsTarget ?? ""),
    targetWeight: String(parsed.targetWeight ?? ""),
    currentDailySteps: String(parsed.currentDailySteps ?? ""),
    homeVisibility: normalizeHomeVisibilityForStorage(
      parsed.homeVisibility as Partial<Record<HomeSectionKey, boolean>> | undefined,
    ),
    favoritePersonalRecords: normalizeFavoritePersonalRecordNames(
      parsed.favoritePersonalRecords as string[] | undefined,
    ),
    ...(onboardingRaw && typeof onboardingRaw === "object"
      ? {
          onboarding: onboardingRaw as ProfileMetricsPayload["onboarding"],
          onboardingCompletedAt: String(parsed.onboardingCompletedAt ?? ""),
        }
      : String(parsed.onboardingCompletedAt ?? "").trim()
        ? { onboardingCompletedAt: String(parsed.onboardingCompletedAt) }
        : {}),
    ...(Array.isArray(parsed.monthlyCheckIns) ? { monthlyCheckIns: parsed.monthlyCheckIns } : {}),
  };
}

function decodeMemberProfileMetrics(personalGoals: string | undefined): ProfileMetricsDraft | null {
  const payload = decodeMemberProfilePayload(personalGoals);
  if (!payload) return null;
  return {
    sessionsPerWeekTarget: payload.sessionsPerWeekTarget,
    dailyStepsTarget: payload.dailyStepsTarget,
    targetWeight: payload.targetWeight,
    currentDailySteps: payload.currentDailySteps,
  };
}

function resolveBestPersonalGoalsForRelatedMembers(
  anchor: Member,
  membersList: Member[],
  relatedIds: Set<string>,
): string {
  const normalizedEmail = anchor.email.trim().toLowerCase();
  const candidates = membersList.filter((member) => {
    if (member.id === anchor.id) return true;
    if (relatedIds.has(member.id)) return true;
    return Boolean(normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail);
  });
  return mergePersonalGoalsFromCandidates(candidates.map((member) => member.personalGoals)) || anchor.personalGoals || "";
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

function pickFirstName(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

function printField(value: unknown): string {
  return String(value ?? "").trim();
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

function parseLogDate(value: string): Date | null {
  return parseStoredLogDate(value);
}

function parseChatCreatedAtMs(value: string): number {
  if (!value) return 0;
  const isoCandidate = new Date(value);
  if (!Number.isNaN(isoCandidate.getTime())) return isoCandidate.getTime();
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+kl\s+(\d{2}):(\d{2}))?$/i);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const hours = Number(match[4] ?? "0");
  const minutes = Number(match[5] ?? "0");
  const parsed = new Date(year, month, day, hours, minutes);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatLoggedResultTitle(result: NonNullable<WorkoutLog["results"]>[number]): string {
  const baseName = result.exerciseName.trim() || "Øvelse";
  if (result.setNumber && result.setNumber > 0) {
    return `${baseName} - sett ${result.setNumber}`;
  }
  return baseName;
}

function groupLoggedResultsForDisplay(results: NonNullable<WorkoutLog["results"]>): Array<{
  key: string;
  exerciseName: string;
  exerciseNote: string;
  rows: Array<{ result: NonNullable<WorkoutLog["results"]>[number]; originalIndex: number }>;
}> {
  const groups = new Map<
    string,
    {
      key: string;
      exerciseName: string;
      rows: Array<{ result: NonNullable<WorkoutLog["results"]>[number]; originalIndex: number }>;
    }
  >();
  results.forEach((result, originalIndex) => {
    const key = `${result.programExerciseId || result.exerciseId || result.exerciseName.trim().toLowerCase()}::${result.exerciseName.trim().toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push({ result, originalIndex });
      if (!existing.exerciseNote && result.exerciseNote?.trim()) {
        existing.exerciseNote = result.exerciseNote.trim();
      }
      return;
    }
    groups.set(key, {
      key,
      exerciseName: result.exerciseName.trim() || "Øvelse",
      exerciseNote: result.exerciseNote?.trim() ?? "",
      rows: [{ result, originalIndex }],
    });
  });
  return Array.from(groups.values());
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

function toIsoDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Kumulativt styrkevolum (kg × reps) per uke og måned — samme logikk som skrytefakta. */
function computeLiftVolumeKgWeekAndMonth(
  completedLogs: WorkoutLog[],
  nowDate: Date,
  nowTimestamp: number,
): { weekKg: number; monthKg: number } {
  const today = getStartOfDay(new Date(nowTimestamp));
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);

  const parseNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? "").replace(",", ".").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const volumeFromResults = (results: WorkoutLog["results"]): number => {
    let sum = 0;
    for (const r of results ?? []) {
      if (!r.completed) continue;
      if (r.exerciseCategory && isHoldBasedExerciseCategory(r.exerciseCategory)) continue;
      const dur = parseNum(r.performedDurationMinutes);
      const w = parseNum(r.performedWeight);
      const reps = parseNum(r.performedReps);
      if (dur > 0 && w <= 0) continue;
      if (w > 0 && reps > 0) sum += w * reps;
    }
    return sum;
  };

  let weekKg = 0;
  let monthKg = 0;
  for (const log of completedLogs) {
    const d = parseLogDate(log.date);
    if (!d) continue;
    const day = getStartOfDay(d);
    const vol = volumeFromResults(log.results);
    if (vol <= 0) continue;
    if (day.getTime() >= weekStart.getTime() && day.getTime() < weekEnd.getTime()) weekKg += vol;
    if (day.getMonth() === nowDate.getMonth() && day.getFullYear() === nowDate.getFullYear()) monthKg += vol;
  }
  return { weekKg, monthKg };
}

type WeeklyShareStats = {
  workouts: number;
  strengthWorkouts: number;
  groupClasses: number;
  trainingDays: number;
  volumeKg: number;
  completedSets: number;
  /** Estimert kcal forbrukt i uka basert på antall styrkeøkter og gruppetimer. */
  kcal: number;
  /** Estimert total aktivitetstid (minutter) i uka. */
  activityMinutes: number;
};

function computeShareCardLast7DaysStats(
  completedLogs: WorkoutLog[],
  nowTimestamp: number,
): WeeklyShareStats {
  const today = getStartOfDay(new Date(nowTimestamp));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

  const parseNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? "").replace(",", ".").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  let workouts = 0;
  let groupClasses = 0;
  let volumeKg = 0;
  let completedSets = 0;
  const dayKeys = new Set<string>();

  for (const log of completedLogs) {
    const d = parseLogDate(log.date);
    if (!d) continue;
    const day = getStartOfDay(d);
    if (day.getTime() < start.getTime() || day.getTime() > today.getTime()) continue;
    workouts += 1;
    dayKeys.add(day.toDateString());
    const titleNorm = String(log.programTitle ?? "").trim().toLowerCase();
    if (titleNorm.startsWith("gruppetime")) groupClasses += 1;
    for (const result of log.results ?? []) {
      if (!result.completed) continue;
      completedSets += 1;
      if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) continue;
      const durationMinutes = parseNum(result.performedDurationMinutes);
      const weight = parseNum(result.performedWeight);
      const reps = parseNum(result.performedReps);
      if (durationMinutes > 0 && weight <= 0) continue;
      if (weight > 0 && reps > 0) volumeKg += weight * reps;
    }
  }

  const strengthWorkouts = Math.max(0, workouts - groupClasses);
  // Forsiktige estimater: 350 kcal / 45 min for styrkeøkt, 450 kcal / 60 min for gruppetime.
  const kcal = Math.round(strengthWorkouts * 350 + groupClasses * 450);
  const activityMinutes = strengthWorkouts * 45 + groupClasses * 60;

  return {
    workouts,
    strengthWorkouts,
    groupClasses,
    trainingDays: dayKeys.size,
    volumeKg,
    completedSets,
    kcal,
    activityMinutes,
  };
}

/** ISO ukenummer (mandag som første dag). */
function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/** Bygg en "Uke 20 • 13.–19. mai"-etikett for delingskortet. */
function buildWeeklyShareLabel(nowTimestamp: number): string {
  const today = getStartOfDay(new Date(nowTimestamp));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const week = isoWeekNumber(today);
  const dayFmt = new Intl.DateTimeFormat("nb-NO", { day: "numeric" });
  const monthFmt = new Intl.DateTimeFormat("nb-NO", { month: "short" });
  const startDay = dayFmt.format(start);
  const endDay = dayFmt.format(today);
  const sameMonth = start.getMonth() === today.getMonth();
  const startMonth = monthFmt.format(start).replace(".", "");
  const endMonth = monthFmt.format(today).replace(".", "");
  const range = sameMonth ? `${startDay}.–${endDay}. ${endMonth}` : `${startDay}. ${startMonth} – ${endDay}. ${endMonth}`;
  return `Uke ${week} • ${range}`;
}

/** Velger en kort, motiverende tittel basert på ukens aktivitet. */
function pickWeeklyShareTitle(stats: WeeklyShareStats): string {
  if (stats.workouts >= 5) return "Sterk uke!";
  if (stats.workouts >= 3) return "Bra jobba!";
  if (stats.workouts >= 1) return "Jeg er i gang!";
  return "Ny uke, nye sjanser!";
}

/** Velger en "ukens seier"-quote i førsteperson basert på aktivitet. */
function pickWeeklyShareSeier(stats: WeeklyShareStats): string {
  if (stats.groupClasses >= 2) return "Jeg viser opp og bygger fellesskap – det gir energi tilbake!";
  if (stats.trainingDays >= 5) return "Jeg prioriterer meg selv – og det gjør en forskjell!";
  if (stats.volumeKg >= 3000) return "Jeg løfter mer i dag enn forrige uke – litt etter litt!";
  if (stats.workouts >= 3) return "Jeg holder vanen levende – sterke vaner gir sterke uker!";
  if (stats.workouts >= 1) return "Jeg tok det første steget – nå bygger jeg videre!";
  return "Ny uke, ny start – jeg har dette!";
}

/** Formaterer aktivitetstid (min) til "Xt Ym" eller "Y min". */
function formatActivityTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

/** Artig «løftevolum»-tekst for skrytekort basert på siste 7 dager. */
function buildProgressLiftPlayfulLine(stats: {
  workouts: number;
  trainingDays: number;
  volumeKg: number;
  completedSets: number;
}): string {
  const { workouts, trainingDays, volumeKg, completedSets } = stats;
  const fmt = (n: number) => Math.round(n).toLocaleString("nb-NO");

  const lineFor = (kg: number): string | null => {
    if (!Number.isFinite(kg) || kg < 1) return null;
    if (kg >= 5500) {
      return `Siste 7 dager har jeg løftet ca. ${fmt(kg)} kg totalt - omtrent som en flodhest`;
    }
    if (kg >= 3200) {
      return `Siste 7 dager har jeg flyttet ca. ${fmt(kg)} kg - omtrent som en liten bil`;
    }
    if (kg >= 1600) {
      return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg - omtrent som flere flygel`;
    }
    if (kg >= 700) {
      return `Siste 7 dager har jeg løftet ca. ${fmt(kg)} kg - omtrent som flere voksne til sammen`;
    }
    if (kg >= 250) {
      const people = Math.max(2, Math.round(kg / 72));
      return `Siste 7 dager har jeg samlet ca. ${fmt(kg)} kg - omtrent som ${people} voksne til sammen`;
    }
    if (kg >= 60) {
      const melons = Math.max(6, Math.round(kg / 8));
      return `Siste 7 dager ble det ca. ${fmt(kg)} kg for meg - omtrent som ${melons} store vannmeloner`;
    }
    if (kg >= 15) {
      return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg i vekt x reps - litt etter litt bygger det seg opp`;
    }
    return `Siste 7 dager har jeg logget ca. ${fmt(kg)} kg i vekt x reps`;
  };

  const weekLine = lineFor(volumeKg);
  if (weekLine) return weekLine;

  if (completedSets >= 24) {
    return `Siste 7 dager fullførte jeg ${completedSets} sett fordelt på ${workouts} økter`;
  }
  if (workouts >= 4 && trainingDays >= 4) {
    return `Siste 7 dager trente jeg ${workouts} økter fordelt på ${trainingDays} treningsdager`;
  }
  if (workouts >= 3) {
    return `Siste 7 dager holdt jeg flyten med ${workouts} økter og ${completedSets} fullførte sett`;
  }
  if (trainingDays >= 2) {
    return `Siste 7 dager fikk jeg inn ${trainingDays} treningsdager - nå bygger jeg videre`;
  }
  if (workouts >= 1) {
    return `Siste 7 dager fikk jeg inn ${workouts} økt og ${completedSets} sett på veien`;
  }
  return "Siste 7 dager har jeg startet uka mi i riktig retning";
}

function getProfileStorageKey(memberId: string): string {
  return `motus.member.profile.${memberId}`;
}

function getUiPreferencesStorageKey(memberId: string): string {
  return `motus.member.uiPrefs.${memberId}`;
}

function getPeriodPlanCompletedStorageKey(memberId: string): string {
  return `${PERIOD_PLAN_COMPLETED_STORAGE_PREFIX}${memberId}`;
}

function getPeriodPlanDismissedStorageKey(memberId: string): string {
  return `${PERIOD_PLAN_DISMISSED_STORAGE_PREFIX}${memberId}`;
}

function weekdayKeyForDate(date: Date): WeekdayPlanKey {
  const day = date.getDay();
  if (day === 0) return "sunday";
  if (day === 1) return "monday";
  if (day === 2) return "tuesday";
  if (day === 3) return "wednesday";
  if (day === 4) return "thursday";
  if (day === 5) return "friday";
  return "saturday";
}

function isPeriodPlanWorkoutLog(log: WorkoutLog): boolean {
  const note = log.note?.trim().toLowerCase() ?? "";
  return note.includes("periodeplan");
}

function cardioHrPrescriptionSuffixForMember(programExercise: ProgramExercise): string {
  const raw = String(programExercise.targetHrPercent ?? "").trim();
  if (!raw) return "";
  return ` · målpuls ca. ${raw}% av makspuls`;
}

function formatIntervalTimerHrHint(targetHrPercent: string | undefined): string {
  const raw = String(targetHrPercent ?? "").trim();
  if (!raw) return "";
  if (/%|HF|hf|maks|makspuls|pul/i.test(raw)) return raw;
  return `${raw} % av makspuls`;
}

function isMemberIntervalCooldownName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return lower.includes("nedjogg") || lower.includes("nedtrapp") || lower.includes("cooldown");
}

function memberProgramExerciseName(program: TrainingProgram, index: number): string {
  return isLegacyIntervalCooldownDrag(program.exercises, index) ? "Nedjogg" : program.exercises[index]?.exerciseName ?? "";
}

function firstNameFromDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "der";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function estimateProgramMinutes(program: TrainingProgram): number {
  if (!program.exercises.length) return 0;
  return program.exercises.reduce((total, exercise) => {
    const rounds = Math.max(1, Number(exercise.sets) || 1);
    const workMinutes = Number(exercise.durationMinutes) || 0;
    const workSeconds = Number(exercise.holdSeconds) || 0;
    const workMinutesTotal = workMinutes + workSeconds / 60;
    const restMinutes = Math.max(0, Number(exercise.restSeconds) || 0) / 60;
    if (workMinutesTotal > 0) return total + rounds * workMinutesTotal + Math.max(0, rounds - 1) * restMinutes;
    return total + rounds * 2.5 + Math.max(0, rounds - 1) * restMinutes;
  }, 6);
}

type IntervalTimerStep = {
  headline: string;
  phaseBadge: string;
  afterExerciseName?: string;
  label: string;
  durationSeconds: number;
  speedHint: string;
  inclineHint: string;
  hrHint: string;
  tone: "warmup" | "work" | "rest" | "cooldown";
};

function computeIntervalPhaseBadge(tone: IntervalTimerStep["tone"], headlineForBadge: string): string {
  if (tone === "warmup") return "Oppvarming";
  if (tone === "cooldown") return "Nedjogg";
  if (tone === "rest") return "Pause";
  const lower = headlineForBadge.trim().toLowerCase();
  if (lower.startsWith("drag")) return "Drag";
  if (lower.includes("tempo")) return "Tempo";
  if (lower.includes("tabata")) return "Tabata";
  return "Intervall";
}

function intervalTimerBadgeToneClass(tone: IntervalTimerStep["tone"]): string {
  switch (tone) {
    case "warmup":
      return "bg-teal-500/35 text-teal-50 ring-1 ring-teal-300/50";
    case "cooldown":
      return "bg-sky-500/35 text-sky-50 ring-1 ring-sky-300/45";
    case "rest":
      return "bg-amber-500/40 text-amber-950 ring-1 ring-amber-200/50";
    default:
      return "bg-white/20 text-white ring-1 ring-white/35";
  }
}

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
    "HIIT",
    "Tabata",
    "Godt voksen",
    "Step styrke",
  ];
  const {
    members,
    currentUserRole,
    currentUserEmail,
    currentUserSupabaseId,
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
    toggleChatMessageReaction,
    workoutMode,
    startWorkoutMode,
    startCustomWorkout,
    saveProgramForMember,
    deleteProgramById,
    updateProgramMemberLibraryStatus,
    updateWorkoutExerciseResult,
    replaceWorkoutExerciseGroup,
    appendWorkoutSetForProgramExercise,
    deferWorkoutExerciseGroup,
    removeWorkoutLogResult,
    setWorkoutLogResults,
    updateWorkoutModeNote,
    updateWorkoutExerciseNote,
    finishWorkoutMode,
    logGroupWorkout,
    logIntervalWorkout,
    logCompletedPlanEntry,
    removeGroupWorkoutLog,
    removeCompletedPlanEntryLog,
    cancelWorkoutMode,
    dismissWorkoutMode,
    resumePausedWorkout,
    discardPausedWorkoutDraft,
    workoutCelebration,
    dismissWorkoutCelebration,
    recentlyFinishedLogId,
    dismissRecentlyFinishedLog,
    memberFocusWorkoutLogId = null,
    clearMemberFocusWorkoutLogId,
    memberFocusProgramId = null,
    clearMemberFocusProgramId,
    remoteMemberPeriodPlanRows = EMPTY_REMOTE_PERIOD_PLAN_ROWS,
    memberRemoteHydrated = true,
    isLocalDemoSession = false,
    refreshRemoteHydration,
    onOpenMonthlyCheckIn,
    onOpenOnboarding,
    onDismissOnboardingHomePrompt,
    showOnboardingHomePrompt = false,
    onboardingSubstantivelyComplete = false,
    homeOverviewHeaderActions,
    homeOverviewNotificationsPanel,
  } = props;
  const [messageText, setMessageText] = useState("");
  const [memberChatSendStatus, setMemberChatSendStatus] = useState<string | null>(null);
  const isSendingMemberMessageRef = useRef(false);
  const [isSendingMemberMessage, setIsSendingMemberMessage] = useState(false);
  const [trainingSection, setTrainingSection] = useState<"today" | "programs" | "custom" | "period" | "history">("today");
  const previousMemberTabRef = useRef(memberTab);
  useEffect(() => {
    const previous = previousMemberTabRef.current;
    if (memberTab === "programs" && previous !== "programs") {
      setTrainingSection("today");
    }
    previousMemberTabRef.current = memberTab;
  }, [memberTab]);
  const [ptChangeReason, setPtChangeReason] = useState("");
  const [ptChangeRequestStatus, setPtChangeRequestStatus] = useState<string | null>(null);
  const lastMemberSendKeyRef = useRef("");
  const lastMemberSendAtRef = useRef(0);
  useEffect(() => {
    if (!memberChatSendStatus?.startsWith("Melding sendt")) return;
    const timer = window.setTimeout(() => setMemberChatSendStatus(null), 2500);
    return () => window.clearTimeout(timer);
  }, [memberChatSendStatus]);
  const [profileSessionsPerWeekTarget, setProfileSessionsPerWeekTarget] = useState("");
  const [profileDailyStepsTarget, setProfileDailyStepsTarget] = useState("");
  const [profileTargetWeight, setProfileTargetWeight] = useState("");
  const [profileCurrentDailySteps, setProfileCurrentDailySteps] = useState("");
  const [microCelebrationsEnabled, setMicroCelebrationsEnabled] = useState(true);
  const [celebrationSoundEnabled, setCelebrationSoundEnabled] = useState(false);
  const [restCountdownEnabled, setRestCountdownEnabled] = useState(true);
  const [homeVisibility, setHomeVisibility] = useState<Record<HomeSectionKey, boolean>>({ ...DEFAULT_HOME_VISIBILITY });
  const [homeCalendarViewMode, setHomeCalendarViewMode] = useState<"week" | "month">("week");
  const [pushRegisterBusy, setPushRegisterBusy] = useState(false);
  const [pushRegisterStatus, setPushRegisterStatus] = useState<string | null>(null);
  const [showAllPersonalRecords, setShowAllPersonalRecords] = useState(false);
  const [prProgressExerciseName, setPrProgressExerciseName] = useState<string | null>(null);
  const [muscleSplitPeriod, setMuscleSplitPeriod] = useState<MuscleSplitPeriod>(28);
  const [muscleSplitMetric, setMuscleSplitMetric] = useState<MuscleSplitMetric>("sets");
  const [favoritePersonalRecordNames, setFavoritePersonalRecordNames] = useState<string[]>([]);
  const [favoritePersonalRecordPreferencesHydrated, setFavoritePersonalRecordPreferencesHydrated] = useState(false);
  const [profileMetricsHydrated, setProfileMetricsHydrated] = useState(false);
  const [pausedWorkoutsTick, setPausedWorkoutsTick] = useState(0);
  const [profileSaveInfo, setProfileSaveInfo] = useState<string | null>(null);
  const [memberNameDraft, setMemberNameDraft] = useState("");
  const [memberEmailDraft, setMemberEmailDraft] = useState("");
  const [memberPhoneDraft, setMemberPhoneDraft] = useState("");
  const [memberBirthDateDraft, setMemberBirthDateDraft] = useState("");
  const [memberGoalDraft, setMemberGoalDraft] = useState("");
  const [memberFocusDraft, setMemberFocusDraft] = useState("");
  const [memberInjuriesDraft, setMemberInjuriesDraft] = useState("");
  const [groupWorkoutClassName, setGroupWorkoutClassName] = useState("Smilepuls");
  const [groupWorkoutDateIso, setGroupWorkoutDateIso] = useState(() => toIsoDateInputValue(new Date()));
  const [groupWorkoutEnergyLevel, setGroupWorkoutEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutDifficultyLevel, setGroupWorkoutDifficultyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutMotivationLevel, setGroupWorkoutMotivationLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [groupWorkoutNote, setGroupWorkoutNote] = useState("");
  const [groupWorkoutStatus, setGroupWorkoutStatus] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: "danger" | "default";
    onConfirm: () => void;
  } | null>(null);
  const [showGroupWorkoutLogger, setShowGroupWorkoutLogger] = useState(false);
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
  const [syncedWorkoutExerciseIndex, setSyncedWorkoutExerciseIndex] = useState(0);
  const [expandedRecentLogId, setExpandedRecentLogId] = useState<string | null>(null);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState<string | null>(null);
  const [selectedCalendarLogId, setSelectedCalendarLogId] = useState<string | null>(null);
  const [progressShareStatus, setProgressShareStatus] = useState<string | null>(null);
  const [motusCardShareStatus, setMotusCardShareStatus] = useState<string | null>(null);
  const [isSharingCelebrationPr, setIsSharingCelebrationPr] = useState(false);
  const [achievementCelebration, setAchievementCelebration] = useState<{ achievedLevel: number } | null>(null);
  const [hiddenBadgeCelebration, setHiddenBadgeCelebration] = useState<MemberBadge | null>(null);
  const [locallySeenHiddenBadgeIds, setLocallySeenHiddenBadgeIds] = useState<string[]>([]);
  const [liveWorkoutCelebration, setLiveWorkoutCelebration] = useState<WorkoutCelebration | null>(null);
  /** Unngår popup ved første lasting; feirer kun når `achievedLevel` faktisk øker. */
  const achievementCelebrationBaselineRef = useRef<number | null>(null);
  const hiddenBadgeUnlockedBaselineRef = useRef<{ memberId: string; badgeIds: Set<string> } | null>(null);
  const hiddenBadgeMigrationDoneRef = useRef(false);
  const [showPeriodPlanPanel, setShowPeriodPlanPanel] = useState(true);
  const [activeMemberPeriodPlanId, setActiveMemberPeriodPlanId] = useState<string | null>(null);
  const [selectedPeriodPlanWeekNumber, setSelectedPeriodPlanWeekNumber] = useState<number | null>(null);
  const [periodPlanActionStatus, setPeriodPlanActionStatus] = useState<string | null>(null);
  const [showPeriodPlanHiddenSection, setShowPeriodPlanHiddenSection] = useState(false);
  const [showPeriodPlanManageSection, setShowPeriodPlanManageSection] = useState(false);
  const [periodPlanStorageRevision, setPeriodPlanStorageRevision] = useState(0);
  const [completedPeriodPlanEntryKeys, setCompletedPeriodPlanEntryKeys] = useState<string[]>([]);
  const [dismissedPeriodPlanEntryKeys, setDismissedPeriodPlanEntryKeys] = useState<string[]>([]);
  const [periodPlanSwapsByPlan, setPeriodPlanSwapsByPlan] = useState<PeriodPlanSwapsByPlan>({});
  const [periodPlanSwapsOwnerId, setPeriodPlanSwapsOwnerId] = useState<string | null>(null);
  const [selectedIntervalProgramId, setSelectedIntervalProgramId] = useState("");
  const [suggestedWeightOverridesByProgramExerciseId, setSuggestedWeightOverridesByProgramExerciseId] = useState<Record<string, string>>({});
  const [showIntervalTimerModal, setShowIntervalTimerModal] = useState(false);
  const [isIntervalTimerRunning, setIsIntervalTimerRunning] = useState(false);
  const [isIntervalTimerPaused, setIsIntervalTimerPaused] = useState(false);
  const [intervalTimerStepIndex, setIntervalTimerStepIndex] = useState(0);
  const [intervalTimerRemainingSeconds, setIntervalTimerRemainingSeconds] = useState(0);
  const [intervalTimerStatus, setIntervalTimerStatus] = useState<string | null>(null);
  const memberMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const profileAutoSaveInFlightRef = useRef(false);
  /** Unngår å nullstille toast ved hvert felt-synk fra autosave — kun ved bytte aktiv profil. */
  const lastMemberCoreHydrationIdRef = useRef<string | null>(null);
  const periodPlanCompletedDirtyRef = useRef(false);
  const periodPlanDismissedDirtyRef = useRef(false);
  const periodPlanCompletionHydratedMemberRef = useRef<string | null>(null);
  const completedPeriodPlanEntryKeysRef = useRef<string[]>([]);
  const dismissedPeriodPlanEntryKeysRef = useRef<string[]>([]);
  /**
   * Tidsstempel for siste lokale endring av periodeplan-fullføring/avhuking. Sendes med
   * til `reconcilePeriodPlanCompletionKeys` slik at fersk lokal intensjon ikke blir
   * overstyrt av en eldre Supabase-cache (f.eks. når «Logg dagens økt» tømmer en gammel
   * avhuking lokalt — uten dette ville hydrering trekke avhukingen tilbake fra remote).
   */
  const periodPlanCompletionLocalUpdatedAtRef = useRef(0);
  const pendingPeriodPlanWorkoutStartRef = useRef<PeriodPlanWorkoutStartContext | null>(null);
  const periodPlanSwapsDirtyRef = useRef(false);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [programLibraryMenuId, setProgramLibraryMenuId] = useState<string | null>(null);
  const [programLibraryFilter, setProgramLibraryFilter] = useState<"all" | "standalone" | "periodPlan">("all");
  const [editingMemberProgramId, setEditingMemberProgramId] = useState<string | null>(null);
  const nowTimestamp = useMemo(() => Date.now(), []);
  const nowDate = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);

  useEffect(() => {
    completedPeriodPlanEntryKeysRef.current = completedPeriodPlanEntryKeys;
  }, [completedPeriodPlanEntryKeys]);

  useEffect(() => {
    dismissedPeriodPlanEntryKeysRef.current = dismissedPeriodPlanEntryKeys;
  }, [dismissedPeriodPlanEntryKeys]);

  useEffect(() => {
    if (!programLibraryMenuId) return;
    const closeMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-program-library-menu]")) return;
      setProgramLibraryMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProgramLibraryMenuId(null);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [programLibraryMenuId]);
  const [libraryActionStatus, setLibraryActionStatus] = useState<string | null>(null);
  const [showLibraryArchivedSection, setShowLibraryArchivedSection] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const nowDate = new Date();
    return new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  });
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => getMondayStart(new Date()));
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const motusShareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-05-original`;
  const currentMemberByEmail =
    currentUserRole === "member" && normalizedCurrentUserEmail
      ? (() => {
          const row = pickCanonicalMemberRow(normalizedCurrentUserEmail, members, programs, currentUserMemberId);
          return row ? enrichMemberWithBestProfile(row, members) : null;
        })()
      : null;
  useAutoClearStatus(memberChatSendStatus, () => setMemberChatSendStatus(null), getStatusClearDelayMs(memberChatSendStatus));
  useAutoClearStatus(pushRegisterStatus, () => setPushRegisterStatus(null), getStatusClearDelayMs(pushRegisterStatus));
  useAutoClearStatus(groupWorkoutStatus, () => setGroupWorkoutStatus(null), getStatusClearDelayMs(groupWorkoutStatus));
  useAutoClearStatus(progressShareStatus, () => setProgressShareStatus(null), getStatusClearDelayMs(progressShareStatus));
  useAutoClearStatus(motusCardShareStatus, () => setMotusCardShareStatus(null), getStatusClearDelayMs(motusCardShareStatus));
  useAutoClearStatus(periodPlanActionStatus, () => setPeriodPlanActionStatus(null), getStatusClearDelayMs(periodPlanActionStatus));
  useAutoClearStatus(intervalTimerStatus, () => setIntervalTimerStatus(null), getStatusClearDelayMs(intervalTimerStatus));
  useAutoClearStatus(libraryActionStatus, () => setLibraryActionStatus(null), getStatusClearDelayMs(libraryActionStatus));
  useToastStatus(memberChatSendStatus, { title: "Meldinger", tone: inferStatusTone });
  useToastStatus(pushRegisterStatus, { title: "Varsler", tone: inferStatusTone });
  useToastStatus(groupWorkoutStatus, { title: "Gruppetrening", tone: inferStatusTone });
  useToastStatus(progressShareStatus, { title: "Fremgang", tone: inferStatusTone });
  useToastStatus(motusCardShareStatus, { title: "Deling", tone: inferStatusTone });
  useToastStatus(periodPlanActionStatus, { title: "Periodeplan", tone: inferStatusTone });
  useToastStatus(intervalTimerStatus, { title: "Intervalltimer", tone: inferStatusTone });
  useToastStatus(libraryActionStatus, { title: "Mine programmer", tone: inferStatusTone });
  useToastStatus(profileSaveInfo, { title: "Profil", tone: inferStatusTone });
  const editableMember =
    currentUserRole === "member"
      ? currentMemberByEmail ?? viewedMember ?? null
      : viewedMember ?? members[0] ?? null;
  const onboardingCompleteForHome = useMemo(
    () => onboardingSubstantivelyComplete || isMemberOnboardingSubmitted(editableMember, members),
    [editableMember, members, onboardingSubstantivelyComplete],
  );
  if (editableMember?.id !== periodPlanSwapsOwnerId) {
    setPeriodPlanSwapsOwnerId(editableMember?.id ?? null);
    setPeriodPlanSwapsByPlan(
      editableMember?.id && typeof window !== "undefined"
        ? parsePeriodPlanSwapsState(window.localStorage.getItem(getPeriodPlanSwapsStorageKey(editableMember.id)))
        : {},
    );
    periodPlanSwapsDirtyRef.current = false;
  }
  const memberNotificationPrefs = useMemo(
    () => readMemberNotificationPreferencesFromPersonalGoals(editableMember?.personalGoals),
    [editableMember?.personalGoals],
  );
  const seenHiddenBadgeIds = useMemo(
    () => new Set([...(memberNotificationPrefs?.seenHiddenBadgeIds ?? []), ...locallySeenHiddenBadgeIds]),
    [locallySeenHiddenBadgeIds, memberNotificationPrefs?.seenHiddenBadgeIds],
  );
  const persistMemberUiPrefs = useCallback(
    (patch: Parameters<typeof patchMemberNotificationPreferencesInPersonalGoals>[1]) => {
      if (!editableMember) return;
      const anchor = pickCanonicalMemberRowForProfile(editableMember, members);
      const personalGoals = patchMemberNotificationPreferencesInPersonalGoals(
        resolveMemberPersonalGoals(anchor, members),
        patch,
      );
      updateMember({ memberId: anchor.id, changes: { personalGoals } });
    },
    [editableMember, members, updateMember],
  );
  const monthlyCheckInPrompt = useMemo(() => {
    if (!editableMember || currentUserRole !== "member") return null;
    if (!shouldPromptMonthlyCheckIn(editableMember, currentUserRole)) return null;
    const window = resolveCheckInWindow();
    if (!window) return null;
    return { window, copy: buildCheckInNotificationCopy(window) };
  }, [editableMember, currentUserRole]);
  const activeMemberId = editableMember?.id ?? memberViewId;
  useEffect(() => {
    setLocallySeenHiddenBadgeIds([]);
    setHiddenBadgeCelebration(null);
    hiddenBadgeUnlockedBaselineRef.current = null;
  }, [activeMemberId]);
  const markHiddenBadgeSeen = useCallback(
    (badgeId: string) => {
      const nextSeen = Array.from(new Set([...(memberNotificationPrefs?.seenHiddenBadgeIds ?? []), ...locallySeenHiddenBadgeIds, badgeId]));
      setLocallySeenHiddenBadgeIds((previous) => (previous.includes(badgeId) ? previous : [...previous, badgeId]));
      if (typeof window !== "undefined" && activeMemberId) {
        window.localStorage.setItem(`${HIDDEN_BADGE_SEEN_STORAGE_PREFIX}${activeMemberId}:${badgeId}`, "seen");
      }
      persistMemberUiPrefs({ seenHiddenBadgeIds: nextSeen });
    },
    [
      activeMemberId,
      locallySeenHiddenBadgeIds,
      memberNotificationPrefs?.seenHiddenBadgeIds,
      persistMemberUiPrefs,
    ],
  );
  const memberProgramAuthorOptions = useMemo(
    () => ({ viewerAuthUserId: currentUserSupabaseId?.trim() || undefined }),
    [currentUserSupabaseId],
  );
  const relatedMemberIds = useMemo(() => {
    const collectedIds = new Set<string>();
    // Member view should follow the authenticated member email first, not only the current memberViewId.
    // This keeps assigned programs visible even when member_id links are being synchronized.
    const primaryEmail = currentUserRole === "member" ? normalizedCurrentUserEmail : editableMember?.email.trim().toLowerCase() ?? "";
    if (primaryEmail) {
      const matchedByPrimary = members.filter((member) => member.email.trim().toLowerCase() === primaryEmail);
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
    if (currentUserRole === "member") {
      // When several `members` rows share one email (duplicate ids), the assigned program may reference
      // an id that was not picked as `memberViewId`. Link data rows by id + email, and allow orphan ids
      // (no row in memory) only when we already see duplicate profiles for this login — same pattern as
      // resolving related member ids server-side.
      const memberRowById = new Map(members.map((member) => [member.id, member]));
      const primaryLower = normalizedCurrentUserEmail;
      const candidateIds = [
        ...programs.map((program) => program.memberId),
        ...logs.map((log) => log.memberId),
        ...messages.map((message) => message.memberId),
      ];
      for (const rawId of candidateIds) {
        const id = rawId.trim();
        if (!id) continue;
        const row = memberRowById.get(id);
        if (row) {
          if (primaryLower && row.email.trim().toLowerCase() === primaryLower) collectedIds.add(id);
        }
      }
    }
    // Legacy: some program rows used email string as member_id.
    if (currentUserRole === "member" && normalizedCurrentUserEmail) {
      collectedIds.add(normalizedCurrentUserEmail);
    }
    if (currentUserRole === "member" && currentUserMemberId?.trim()) {
      collectedIds.add(currentUserMemberId.trim());
    }
    if (currentUserRole === "member" && currentUserSupabaseId?.trim()) {
      const sid = currentUserSupabaseId.trim();
      collectedIds.add(sid);
      collectedIds.add(`auth-${sid}`);
    }
    if (activeMemberId.trim()) collectedIds.add(activeMemberId.trim());
    const merged = Array.from(collectedIds);
    return merged.length ? merged : [activeMemberId];
  }, [
    members,
    currentUserRole,
    normalizedCurrentUserEmail,
    editableMember,
    activeMemberId,
    programs,
    logs,
    messages,
    currentUserMemberId,
    currentUserSupabaseId,
  ]);
  const relatedMemberIdSet = useMemo(() => new Set(relatedMemberIds), [relatedMemberIds]);
  const trainerPeriodPlanIds = useMemo(
    () => buildTrainerPeriodPlanIdSet(relatedMemberIds, remoteMemberPeriodPlanRows),
    [relatedMemberIds, remoteMemberPeriodPlanRows],
  );
  const periodPlans = useMemo(() => {
    const localByMember = readPeriodPlansByMemberId();
    const combined = mergedPeriodPlanListForMember(relatedMemberIds, localByMember, remoteMemberPeriodPlanRows);
    return combined.sort((a, b) => (parseDateOnly(b.startDate)?.getTime() ?? 0) - (parseDateOnly(a.startDate)?.getTime() ?? 0));
  }, [relatedMemberIds, remoteMemberPeriodPlanRows, periodPlanStorageRevision]);
  const hiddenPeriodPlanIds = useMemo(
    () => readHiddenPeriodPlanIdsForMembers(relatedMemberIds),
    [relatedMemberIds, periodPlanStorageRevision],
  );
  const visiblePeriodPlans = useMemo(
    () => periodPlans.filter((plan) => !hiddenPeriodPlanIds.includes(plan.id)),
    [periodPlans, hiddenPeriodPlanIds],
  );
  const storedActivePeriodPlanId = useMemo(
    () => readActivePeriodPlanIdForMembers(relatedMemberIds),
    [relatedMemberIds, periodPlanStorageRevision],
  );
  const effectiveActiveMemberPeriodPlanId = useMemo(() => {
    if (activeMemberPeriodPlanId && visiblePeriodPlans.some((plan) => plan.id === activeMemberPeriodPlanId)) {
      return activeMemberPeriodPlanId;
    }
    if (storedActivePeriodPlanId && visiblePeriodPlans.some((plan) => plan.id === storedActivePeriodPlanId)) {
      return storedActivePeriodPlanId;
    }
    return visiblePeriodPlans[0]?.id ?? null;
  }, [activeMemberPeriodPlanId, storedActivePeriodPlanId, visiblePeriodPlans]);
  const hiddenPeriodPlans = useMemo(
    () => periodPlans.filter((plan) => hiddenPeriodPlanIds.includes(plan.id)),
    [periodPlans, hiddenPeriodPlanIds],
  );
  const homeWorkoutHydrationPending =
    currentUserRole === "member" && isSupabaseConfigured && !memberRemoteHydrated && !isLocalDemoSession;
  const todayDateKey = useMemo(() => memberLocalDateKey(new Date(nowTimestamp)), [nowTimestamp]);
  const cachedHomeWorkout = useMemo(() => {
    const cached = readMemberHomeWorkoutSnapshot();
    return cached?.dateKey === todayDateKey ? cached : null;
  }, [todayDateKey]);
  const periodPlansForHome = useMemo(() => {
    if (!homeWorkoutHydrationPending) return periodPlans;
    const remoteOnly = mergedPeriodPlanListForMember(relatedMemberIds, {}, remoteMemberPeriodPlanRows);
    return remoteOnly.sort((a, b) => (parseDateOnly(b.startDate)?.getTime() ?? 0) - (parseDateOnly(a.startDate)?.getTime() ?? 0));
  }, [homeWorkoutHydrationPending, periodPlans, relatedMemberIds, remoteMemberPeriodPlanRows]);
  const visiblePeriodPlansForHome = useMemo(
    () => periodPlansForHome.filter((plan) => !hiddenPeriodPlanIds.includes(plan.id)),
    [periodPlansForHome, hiddenPeriodPlanIds],
  );
  const memberHasVisiblePeriodPlan = visiblePeriodPlans.length > 0;
  const selectActiveMemberPeriodPlan = useCallback(
    (planId: string) => {
      const plan = visiblePeriodPlans.find((item) => item.id === planId);
      if (!plan) return;
      setActiveMemberPeriodPlanId(planId);
      writeActivePeriodPlanIdForMembers(relatedMemberIds, planId);
      setSelectedPeriodPlanWeekNumber(resolvePeriodPlanWeekNumberForDate(plan, new Date()));
    },
    [visiblePeriodPlans, relatedMemberIds],
  );
  const primaryMemberIdForPeriodPlans = relatedMemberIds[0] ?? memberViewId ?? "";
  const relatedMembersForProfile = useMemo(
    () => members.filter((member) => relatedMemberIdSet.has(member.id)),
    [members, relatedMemberIdSet],
  );
  /** Stabil på tvers av nye array-referanser — brukes til å hydrate måltall uten å røre tekstutkast. */
  const relatedProfileGoalsSignature = useMemo(
    () =>
      relatedMembersForProfile.map((member) => `${member.id}:${member.personalGoals ?? ""}`).join("|"),
    [relatedMembersForProfile],
  );
  const isMemberLimited = useMemo(() => {
    const candidates = members.filter((member) => {
      if (currentUserMemberId && member.id === currentUserMemberId) return true;
      if (memberViewId && member.id === memberViewId) return true;
      if (editableMember?.id && member.id === editableMember.id) return true;
      return Boolean(normalizedCurrentUserEmail && member.email.trim().toLowerCase() === normalizedCurrentUserEmail);
    });
    if (editableMember) candidates.push(editableMember);
    if (currentUserRole === "member") {
      // Full portal (meldinger, fremgang): alle som ikke bare er ''ren'' Standard-medlem (delt treningssenter-profil).
      // Inkluderer PT-kunde, Premium, Oppfølging og Egentrening — tidligere ble Oppfølging feilaktig låst ute.
      return !candidates.some(
        (member) => member.customerType !== "Medlem" || member.membershipType === "Premium",
      );
    }
    return candidates.some((member) => member.customerType === "Medlem" && member.membershipType !== "Premium");
  }, [currentUserRole, currentUserMemberId, memberViewId, members, normalizedCurrentUserEmail, editableMember]);
  const dbProfileMetrics = useMemo(
    () => {
      for (const member of relatedMembersForProfile) {
        const decoded = decodeMemberProfileMetrics(member.personalGoals);
        if (decoded) return decoded;
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decode nyttes kun når personalGoals-signaturen endrer seg
    [relatedProfileGoalsSignature],
  );
  const dbHomeVisibility = useMemo(
    () => {
      for (const member of relatedMembersForProfile) {
        const decoded = decodeMemberProfilePayload(member.personalGoals);
        if (decoded?.homeVisibility) return decoded.homeVisibility;
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- som dbProfileMetrics
    [relatedProfileGoalsSignature],
  );
  const dbFavoritePersonalRecordNames = useMemo(
    () => {
      for (const member of relatedMembersForProfile) {
        const decoded = decodeMemberProfilePayload(member.personalGoals);
        if (decoded?.favoritePersonalRecords?.length) return decoded.favoritePersonalRecords;
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- som dbProfileMetrics
    [relatedProfileGoalsSignature],
  );
  const resolvedFavoritePersonalRecordNames = useMemo(() => {
    const dbFavorites = normalizeFavoritePersonalRecordNames(dbFavoritePersonalRecordNames ?? undefined) ?? [];
    if (!editableMember || typeof window === "undefined") return dbFavorites;
    try {
      const raw = window.localStorage.getItem(getUiPreferencesStorageKey(editableMember.id));
      if (!raw) return dbFavorites;
      const parsed = JSON.parse(raw) as { favoritePersonalRecords?: string[] };
      return normalizeFavoritePersonalRecordNames(dbFavoritePersonalRecordNames ?? parsed.favoritePersonalRecords) ?? [];
    } catch {
      return dbFavorites;
    }
  }, [editableMember, dbFavoritePersonalRecordNames]);
  const effectiveFavoritePersonalRecordNames = favoritePersonalRecordPreferencesHydrated
    ? favoritePersonalRecordNames
    : resolvedFavoritePersonalRecordNames;
  const memberPrograms = useMemo(() => {
    if (editableMember) {
      const attributedPrograms = programsAttributedToMember(editableMember, members, programs);
      if (attributedPrograms.length > 0) return dedupeTrainingPrograms(attributedPrograms);
    }
    const scopedPrograms = programs.filter((program) => relatedMemberIdSet.has(program.memberId));
    const visiblePrograms =
      currentUserRole === "member" && scopedPrograms.length === 0 && programs.length > 0
        ? programs
        : scopedPrograms;
    if (currentUserRole === "member" && scopedPrograms.length === 0 && programs.length > 0) {
      // Last-resort fallback for legacy member_id drift: in member session the payload is already scoped.
      return dedupeTrainingPrograms(visiblePrograms);
    }
    return dedupeTrainingPrograms(visiblePrograms);
  }, [programs, relatedMemberIdSet, currentUserRole, editableMember, members]);
  const memberAssignedPrograms = useMemo(() => memberPrograms.filter((program) => !program.ephemeral), [memberPrograms]);
  const memberProgramsInActiveLibrary = useMemo(
    () => memberAssignedPrograms.filter((program) => !programIsInMemberArchive(program.memberLibraryStatus)),
    [memberAssignedPrograms],
  );
  /** Alle tildelte program (inkl. arkiverte) — brukes til å koble periodeplan-tekst til Start økt. */
  const memberProgramsForPeriodPlan = memberAssignedPrograms;
  const memberProgramsLibraryArchived = useMemo(
    () => memberAssignedPrograms.filter((program) => programIsInMemberArchive(program.memberLibraryStatus)),
    [memberAssignedPrograms],
  );
  const periodPlanLinkedProgramIds = useMemo(
    () => buildPeriodPlanLinkedProgramIdSet(visiblePeriodPlans, memberProgramsForPeriodPlan),
    [visiblePeriodPlans, memberProgramsForPeriodPlan],
  );
  const periodPlanProgramCount = useMemo(
    () => memberProgramsInActiveLibrary.filter((program) => periodPlanLinkedProgramIds.has(program.id)).length,
    [memberProgramsInActiveLibrary, periodPlanLinkedProgramIds],
  );
  const standaloneProgramCount = memberProgramsInActiveLibrary.length - periodPlanProgramCount;
  const filteredMemberProgramsInActiveLibrary = useMemo(() => {
    if (programLibraryFilter === "periodPlan") {
      return memberProgramsInActiveLibrary.filter((program) => periodPlanLinkedProgramIds.has(program.id));
    }
    if (programLibraryFilter === "standalone") {
      return memberProgramsInActiveLibrary.filter((program) => !periodPlanLinkedProgramIds.has(program.id));
    }
    return memberProgramsInActiveLibrary;
  }, [memberProgramsInActiveLibrary, periodPlanLinkedProgramIds, programLibraryFilter]);
  const showProgramLibraryFilter = periodPlanProgramCount > 0 && memberProgramsInActiveLibrary.length > periodPlanProgramCount;
  const editingMemberProgram = useMemo(
    () => (editingMemberProgramId ? memberPrograms.find((program) => program.id === editingMemberProgramId) ?? null : null),
    [editingMemberProgramId, memberPrograms],
  );
  const memberLogs = useMemo(() => logs.filter((log) => relatedMemberIdSet.has(log.memberId)), [logs, relatedMemberIdSet]);
  const memberMessages = useMemo(() => {
    if (currentUserRole === "member") {
      const anchorEmail = (editableMember?.email ?? normalizedCurrentUserEmail).trim().toLowerCase();
      const anchorName = (editableMember?.name ?? "").trim().toLowerCase();
      const sorted = messages
        .filter((message) => {
          if (relatedMemberIdSet.has(message.memberId)) return true;
          const messageMember = members.find((member) => member.id === message.memberId);
          if (!messageMember) return false;
          const messageEmail = messageMember.email.trim().toLowerCase();
          if (anchorEmail && messageEmail === anchorEmail) return true;
          return false;
        })
        .sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));
      const uniqueById = new Map<string, (typeof sorted)[number]>();
      sorted.forEach((message) => {
        if (!uniqueById.has(message.id)) uniqueById.set(message.id, message);
      });
      const bySignature = new Map<string, (typeof sorted)[number]>();
      Array.from(uniqueById.values()).forEach((message) => {
        const timestampMs = parseChatCreatedAtMs(message.createdAt);
        const normalizedText = message.text.trim().replace(/\s+/g, " ").toLowerCase();
        const minuteBucket = timestampMs > 0 ? Math.floor(timestampMs / 60000) : message.createdAt.trim().toLowerCase();
        const signature = `${message.sender}|${normalizedText}|${minuteBucket}`;
        const existing = bySignature.get(signature);
        if (!existing || timestampMs >= parseChatCreatedAtMs(existing.createdAt)) {
          bySignature.set(signature, message);
        }
      });
      return Array.from(bySignature.values()).sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));
    }
    const anchorEmail = (editableMember?.email ?? normalizedCurrentUserEmail).trim().toLowerCase();
    const anchorName = (editableMember?.name ?? "").trim().toLowerCase();
    const filtered = messages.filter((message) => {
      if (relatedMemberIdSet.has(message.memberId)) return true;
      const messageMember = members.find((member) => member.id === message.memberId);
      // Hydrated member payload is already session-scoped on backend.
      // Keep trainer messages even when legacy member_id row is missing locally.
      if (!messageMember) {
        if (currentUserRole === "member" && message.sender === "trainer") return true;
        return false;
      }
      const messageEmail = messageMember.email.trim().toLowerCase();
      const messageName = messageMember.name.trim().toLowerCase();
      if (anchorEmail && messageEmail === anchorEmail) return true;
      if (anchorName && messageName === anchorName) return true;
      return false;
    }).sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));
    const uniqueById = new Map<string, (typeof filtered)[number]>();
    filtered.forEach((message) => {
      if (!uniqueById.has(message.id)) uniqueById.set(message.id, message);
    });
    const bySignature = new Map<string, (typeof filtered)[number]>();
    Array.from(uniqueById.values()).forEach((message) => {
      const timestampMs = parseChatCreatedAtMs(message.createdAt);
      const normalizedText = message.text.trim().replace(/\s+/g, " ").toLowerCase();
      const minuteBucket = timestampMs > 0 ? Math.floor(timestampMs / 60000) : message.createdAt.trim().toLowerCase();
      const signature = `${message.sender}|${normalizedText}|${minuteBucket}`;
      const existing = bySignature.get(signature);
      if (!existing || timestampMs >= parseChatCreatedAtMs(existing.createdAt)) {
        bySignature.set(signature, message);
      }
    });
    return Array.from(bySignature.values()).sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));
  }, [messages, relatedMemberIdSet, members, editableMember?.email, editableMember?.name, normalizedCurrentUserEmail, currentUserRole]);
  const chatTrainerName = useMemo(() => {
    if (!editableMember) return "Trener";
    return resolveMemberTrainerDisplayName(editableMember, programs) ?? "Trener";
  }, [editableMember, programs]);
  const activeWorkoutProgram = useMemo(() => {
    if (!workoutMode?.programId) return null;
    const programId = workoutMode.programId;
    const fromState =
      programs.find((program) => program.id === programId) ??
      memberPrograms.find((program) => program.id === programId);
    if (fromState) return fromState;

    const memberIdsToTry = [...new Set([activeMemberId, workoutMode.memberId, memberViewId].map((id) => id?.trim()).filter(Boolean))];
    for (const memberId of memberIdsToTry) {
      const snapshot = getPausedWorkoutByProgramId(memberId, programId)?.programSnapshot;
      if (snapshot) return snapshot;
    }

    if (workoutMode.results.length > 0) {
      return buildTrainingProgramFromWorkoutMode(workoutMode);
    }
    return null;
  }, [workoutMode, programs, memberPrograms, activeMemberId, memberViewId]);

  useEffect(() => {
    purgeExpiredPausedWorkouts();
    const timer = window.setInterval(() => {
      purgeExpiredPausedWorkouts();
      setPausedWorkoutsTick((value) => value + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const prevActiveWorkoutProgramIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentProgramId = workoutMode?.programId ?? null;
    if (prevActiveWorkoutProgramIdRef.current && !currentProgramId) {
      setPausedWorkoutsTick((value) => value + 1);
    }
    prevActiveWorkoutProgramIdRef.current = currentProgramId;
  }, [workoutMode?.programId]);

  const pausedWorkouts = useMemo(() => {
    void pausedWorkoutsTick;
    if (!activeMemberId) return [];
    return listPausedWorkouts(activeMemberId).filter((draft) => {
      if (!workoutMode) return true;
      const sameProgram = workoutMode.programId === draft.programId;
      const sameMember = printField(workoutMode.memberId) === activeMemberId || !printField(workoutMode.memberId);
      return !(sameProgram && sameMember);
    });
  }, [activeMemberId, workoutMode, pausedWorkoutsTick]);
  const secondaryPausedWorkouts = pausedWorkouts;
  const nextProgram = memberProgramsInActiveLibrary[0] ?? null;

  async function handleMemberShareProgramClick() {
    if (!nextProgram) {
      setMemberTab("programs");
      setMemberChatSendStatus("Du har ingen aktivt program — gikk til Mine programmer.");
      return;
    }
    const message = buildShareProgramChatMessage({
      programTitle: nextProgram.title,
      goal: nextProgram.goal,
      sender: "member",
    });
    await dispatchMemberMessageToRelatedMembers(message);
  }

  const memberChatQuickActions = useMemo(
    (): MotusChatQuickAction[] => [
      { id: "workout", label: "Send økt", icon: Dumbbell, onClick: () => setMemberTab("home") },
      { id: "program", label: "Del program", icon: Share2, onClick: () => void handleMemberShareProgramClick() },
      { id: "more", label: "Flere", icon: MoreHorizontal },
    ],
    [nextProgram, setMemberTab],
  );

  useEffect(() => {
    if (!isMemberLimited) return;
    if (memberTab === "overview" || memberTab === "programs" || memberTab === "profile" || memberTab === "inspiration") return;
    setMemberTab("overview");
  }, [isMemberLimited, memberTab, setMemberTab]);
  const workoutResultGroups = useMemo(
    () => (workoutMode ? buildWorkoutResultGroups(workoutMode.results, activeWorkoutProgram) : []),
    [workoutMode, activeWorkoutProgram],
  );
  const currentWorkoutGroup = workoutResultGroups[syncedWorkoutExerciseIndex] ?? null;
  const exerciseByName = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.name.trim().toLowerCase(), exercise])),
    [exercises],
  );
  const exerciseCategoryById = useMemo(() => {
    const byId = new Map<string, Exercise["category"]>();
    exercises.forEach((exercise) => {
      byId.set(exercise.id, exercise.category);
    });
    return byId;
  }, [exercises]);
  const intervalPrograms = useMemo(
    () =>
      memberProgramsInActiveLibrary.filter((program) =>
        isConditioningTrainingProgram(program, exerciseCategoryById, exercises),
      ),
    [memberProgramsInActiveLibrary, exerciseCategoryById, exercises],
  );
  const intervalProgramIdSet = useMemo(() => new Set(intervalPrograms.map((program) => program.id)), [intervalPrograms]);
  const activeIntervalProgram = useMemo(
    () => intervalPrograms.find((program) => program.id === selectedIntervalProgramId) ?? intervalPrograms[0] ?? null,
    [intervalPrograms, selectedIntervalProgramId],
  );
  const intervalProgramSteps = useMemo(() => {
    if (!activeIntervalProgram) return [] as IntervalTimerStep[];
    const programTitle = activeIntervalProgram.title;
    const steps: IntervalTimerStep[] = [];
    let workOrdinal = 0;
    let dragOrdinal = 0;
    let lastWorkHeadline = "";

    for (let index = 0; index < activeIntervalProgram.exercises.length; index++) {
      const exercise = activeIntervalProgram.exercises[index];
      const intervalMinutesPart = (Number(exercise.durationMinutes) || 0) * 60;
      const intervalSecondsPart = Number(exercise.holdSeconds) || 0;
      const workDurationSeconds = Math.max(0, Math.round(intervalMinutesPart + intervalSecondsPart));
      const rawRestStr = String(exercise.restSeconds ?? "").trim();
      const rawRestParsed = rawRestStr === "" ? NaN : Number(rawRestStr);
      const rawRestValue = Number.isFinite(rawRestParsed) ? rawRestParsed : 0;
      const normalizedRestSeconds =
        rawRestValue > 0 && rawRestValue <= 15
          ? Math.round(rawRestValue * 60)
          : Math.round(rawRestValue);

      if (workDurationSeconds > 0) {
        const lowerName = exercise.exerciseName.toLowerCase();
        const isCooldown =
          isMemberIntervalCooldownName(exercise.exerciseName) ||
          isLegacyIntervalCooldownDrag(activeIntervalProgram.exercises, index);
        let tone: IntervalTimerStep["tone"] =
          lowerName.includes("oppvarm") ? "warmup" : isCooldown ? "cooldown" : "work";
        const nameImpliesExplicitWorkSegment =
          /\bdrag\b/i.test(exercise.exerciseName) ||
          lowerName.includes("tempo") ||
          lowerName.includes("tabata");
        // Første blokk bruker ofte samme biblioteksnavn som intervallene (f.eks. «Mølle intervall» uten «oppvarm»).
        if (index === 0 && tone === "work" && !nameImpliesExplicitWorkSegment) {
          tone = "warmup";
        }
        const isDragSlot =
          tone === "work" &&
          !lowerName.includes("tempo") &&
          !lowerName.includes("tabata") &&
          (/\bdrag\b/i.test(exercise.exerciseName) ||
            /\bintervall\b/i.test(exercise.exerciseName) ||
            /4x4/i.test(programTitle));

        let headline: string;
        if (tone === "warmup") headline = "Oppvarming";
        else if (tone === "cooldown") headline = "Nedjogg";
        else if (tone === "work") {
          workOrdinal += 1;
          if (lowerName.includes("tabata")) headline = `Tabata ${workOrdinal}`;
          else if (lowerName.includes("tempo")) headline = `Tempo ${workOrdinal}`;
          else if (isDragSlot) {
            dragOrdinal += 1;
            headline = `Drag ${dragOrdinal}`;
          } else headline = `Intervall ${workOrdinal}`;
        } else headline = exercise.exerciseName.trim() || `Intervall ${index + 1}`;

        lastWorkHeadline = headline;
        steps.push({
          headline,
          phaseBadge: computeIntervalPhaseBadge(tone, headline),
          label: headline,
          durationSeconds: workDurationSeconds,
          speedHint: exercise.speed ? `${exercise.speed} km/t` : "-",
          inclineHint: exercise.incline ? `${exercise.incline}%` : "-",
          hrHint: formatIntervalTimerHrHint(exercise.targetHrPercent),
          tone,
        });
      }

      const isClassic4x4Drag = /4x4/i.test(programTitle) && /drag/i.test(exercise.exerciseName);
      // Eksplisitt "0" = ingen pause (trengs etter siste drag før nedjogg). Tom streng = eldre programmer uten hvilefelt → behold 4×4-fallback.
      const legacy4x4DragPauseSeconds = rawRestStr === "" && isClassic4x4Drag ? 180 : 0;
      const restDurationSeconds = normalizedRestSeconds > 0 ? normalizedRestSeconds : legacy4x4DragPauseSeconds;
      const nextIsCooldown =
        isMemberIntervalCooldownName(activeIntervalProgram.exercises[index + 1]?.exerciseName ?? "") ||
        isLegacyIntervalCooldownDrag(activeIntervalProgram.exercises, index + 1);
      if (restDurationSeconds > 0 && index < activeIntervalProgram.exercises.length - 1 && !nextIsCooldown) {
        const afterLabel = lastWorkHeadline || exercise.exerciseName.trim() || `Steg ${index + 1}`;
        steps.push({
          headline: "Pause",
          phaseBadge: "Pause",
          afterExerciseName: afterLabel,
          label: `Pause etter ${afterLabel}`,
          durationSeconds: restDurationSeconds,
          speedHint: "Rolig",
          inclineHint: "0–1%",
          hrHint: "",
          tone: "rest",
        });
      }
    }

    return steps;
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
    return weekdayKeyForDate(new Date(nowTimestamp));
  }, [nowTimestamp]);
  const activePeriodPlan =
    visiblePeriodPlans.find((plan) => plan.id === effectiveActiveMemberPeriodPlanId) ?? visiblePeriodPlans[0] ?? null;
  const activePeriodPlanId = activePeriodPlan?.id ?? null;
  const activePeriodSelectableWeekCount = activePeriodPlan ? periodPlanSelectableWeekCount(activePeriodPlan) : 0;
  const activePeriodPlanStartDate = activePeriodPlan ? parsePeriodPlanStartDate(activePeriodPlan) : null;
  const activePeriodWeekIndex = useMemo(() => {
    if (!activePeriodPlan || !activePeriodPlanStartDate) return null;
    const daysSinceStart = Math.floor((getStartOfDay(new Date(nowTimestamp)).getTime() - getStartOfDay(activePeriodPlanStartDate).getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceStart < 0) return 0;
    const weekIndex = Math.floor(daysSinceStart / 7);
    const planWeekCount = periodPlanSelectableWeekCount(activePeriodPlan);
    if (weekIndex >= planWeekCount) return null;
    return weekIndex;
  }, [activePeriodPlan, activePeriodPlanStartDate, nowTimestamp]);
  const activeWeeklyPlan = useMemo(() => {
    if (!activePeriodPlan || activePeriodWeekIndex === null) return null;
    return resolvePeriodPlanWeek(activePeriodPlan, activePeriodWeekIndex + 1);
  }, [activePeriodPlan, activePeriodWeekIndex]);
  const todayPeriodPlanMatch = useMemo(() => {
    const plansForToday = homeWorkoutHydrationPending ? visiblePeriodPlansForHome : visiblePeriodPlans;
    if (!plansForToday.length) return null;
    return resolveTodayPeriodPlanEntryForHome(
      plansForToday,
      getStartOfDay(new Date(nowTimestamp)),
      periodPlanSwapsByPlan,
      currentWeekdayKey,
    );
  }, [
    homeWorkoutHydrationPending,
    visiblePeriodPlansForHome,
    visiblePeriodPlans,
    nowTimestamp,
    periodPlanSwapsByPlan,
    currentWeekdayKey,
  ]);
  const todayPlanPeriodPlan = todayPeriodPlanMatch?.plan ?? activePeriodPlan;
  const todayPlanDayKey = todayPeriodPlanMatch?.day ?? null;
  const displayedPeriodWeek = useMemo(() => {
    if (!activePeriodPlan) return null;
    const fallbackWeekNumber = activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1;
    const preferredWeekNumber = selectedPeriodPlanWeekNumber ?? fallbackWeekNumber;
    return resolvePeriodPlanWeek(activePeriodPlan, preferredWeekNumber);
  }, [activePeriodPlan, activePeriodWeekIndex, selectedPeriodPlanWeekNumber]);
  const selectedPeriodPlanWeekForView = useMemo(() => {
    const fallbackWeekNumber = activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1;
    return selectedPeriodPlanWeekNumber ?? fallbackWeekNumber;
  }, [activePeriodWeekIndex, selectedPeriodPlanWeekNumber]);
  const activeWeeklyPlanEffectiveDays = useMemo(() => {
    if (!activeWeeklyPlan || !activePeriodPlan) return null;
    const swaps = getSwapsForWeek(periodPlanSwapsByPlan, activePeriodPlan.id, activeWeeklyPlan.weekNumber);
    return applyPeriodPlanSwaps(activeWeeklyPlan.days, swaps);
  }, [activeWeeklyPlan, activePeriodPlan, periodPlanSwapsByPlan]);
  const todayPlanEntry = todayPeriodPlanMatch?.entry?.trim() ?? "";
  const todayPlanIsPassiveDay = isPassivePeriodPlanEntry(todayPlanEntry);
  const todayPlanAction = useMemo(() => {
    if (!todayPlanEntry) return { kind: "none" as const };
    const resolved = resolvePeriodPlanEntryAction(todayPlanEntry, memberProgramsForPeriodPlan);
    if (resolved.kind !== "log-generic") return resolved;
    const rescuedProgram = findProgramForPeriodPlanEntry(todayPlanEntry, memberPrograms);
    if (rescuedProgram) return { kind: "start-program" as const, program: rescuedProgram };
    return resolved;
  }, [todayPlanEntry, memberProgramsForPeriodPlan, memberPrograms]);
  const profileMetricsFromDb = decodeMemberProfileMetrics(editableMember?.personalGoals);
  const profileHasUnsavedChanges = useMemo(() => {
    if (!editableMember) return false;
    return (
      memberNameDraft.trim() !== editableMember.name.trim() ||
      memberEmailDraft.trim().toLowerCase() !== editableMember.email.trim().toLowerCase() ||
      normalizePhone(memberPhoneDraft) !== normalizePhone(editableMember.phone) ||
      normalizeBirthDateToDdMmYyyy(memberBirthDateDraft) !== normalizeBirthDateToDdMmYyyy(editableMember.birthDate) ||
      memberGoalDraft.trim() !== editableMember.goal.trim() ||
      memberFocusDraft.trim() !== editableMember.focus.trim() ||
      memberInjuriesDraft.trim() !== editableMember.injuries.trim() ||
      profileSessionsPerWeekTarget.trim() !== String(profileMetricsFromDb?.sessionsPerWeekTarget ?? "").trim() ||
      profileDailyStepsTarget.trim() !== String(profileMetricsFromDb?.dailyStepsTarget ?? "").trim() ||
      profileTargetWeight.trim() !== String(profileMetricsFromDb?.targetWeight ?? "").trim() ||
      profileCurrentDailySteps.trim() !== String(profileMetricsFromDb?.currentDailySteps ?? "").trim()
    );
  }, [
    editableMember,
    memberNameDraft,
    memberEmailDraft,
    memberPhoneDraft,
    memberBirthDateDraft,
    memberGoalDraft,
    memberFocusDraft,
    memberInjuriesDraft,
    profileSessionsPerWeekTarget,
    profileDailyStepsTarget,
    profileTargetWeight,
    profileCurrentDailySteps,
    profileMetricsFromDb?.sessionsPerWeekTarget,
    profileMetricsFromDb?.dailyStepsTarget,
    profileMetricsFromDb?.targetWeight,
    profileMetricsFromDb?.currentDailySteps,
  ]);

  function resolveSuggestedWorkoutWeight(programExercise: TrainingProgram["exercises"][number]): string {
    const override = suggestedWeightOverridesByProgramExerciseId[programExercise.id];
    if (override !== undefined) return override;
    const fromHistory = findSuggestedWeightForExercise(programExercise.exerciseName);
    if (fromHistory) return fromHistory;
    const meta = exercises.find((e) => e.id === programExercise.exerciseId);
    if (meta?.category && isHoldBasedExerciseCategory(meta.category)) {
      return programExerciseHoldSeconds(programExercise, meta.category) || "30";
    }
    return programExercise.weight;
  }

  function buildStartWorkoutOptions(program: TrainingProgram): StartWorkoutModeOptions {
    const suggestedWeightByProgramExerciseId: Record<string, string> = {};
    program.exercises.forEach((exercise) => {
      if (Number(exercise.durationMinutes) > 0) return;
      const meta = exercises.find((e) => e.id === exercise.exerciseId);
      if (meta?.category === "Kondisjon") return;
      const suggestedWeight = resolveSuggestedWorkoutWeight(exercise).trim();
      if (!suggestedWeight) return;
      suggestedWeightByProgramExerciseId[exercise.id] = suggestedWeight;
    });
    return { suggestedWeightByProgramExerciseId };
  }

  const syncProfileToPtBackend = useCallback(async (payload: {
    email: string;
    emails: string[];
    memberId: string;
    memberIds: string[];
    targetName?: string;
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
  }): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!supabaseClient) return { ok: false, message: "Denne funksjonen er ikke tilgjengelig akkurat nå." };

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
  }, []);

  const completedLogs = useMemo(() => memberLogs.filter((log) => log.status === "Fullført"), [memberLogs]);
  const recentCompletedLogs = useMemo(
    () =>
      [...completedLogs]
        .sort((a, b) => (parseLogDate(b.date)?.getTime() ?? 0) - (parseLogDate(a.date)?.getTime() ?? 0))
        .slice(0, 5),
    [completedLogs],
  );
  const recentCompletedLogsForDisplay = useMemo(() => {
    if (!memberFocusWorkoutLogId) return recentCompletedLogs;
    const focused = completedLogs.find((log) => log.id === memberFocusWorkoutLogId);
    if (!focused) return recentCompletedLogs;
    if (recentCompletedLogs.some((log) => log.id === focused.id)) return recentCompletedLogs;
    return [focused, ...recentCompletedLogs.slice(0, 4)];
  }, [completedLogs, memberFocusWorkoutLogId, recentCompletedLogs]);
  const allMemberLogsSorted = useMemo(
    () =>
      [...memberLogs].sort((a, b) => (parseLogDate(b.date)?.getTime() ?? 0) - (parseLogDate(a.date)?.getTime() ?? 0)),
    [memberLogs],
  );
  const latestCompletedLog = recentCompletedLogs[0] ?? null;
  function findSuggestedWeightForExercise(exerciseName: string): string {
    const normalizedExerciseName = exerciseName.trim().toLowerCase();
    if (!normalizedExerciseName) return "";
    const sorted = [...completedLogs].sort((a, b) => {
      const aDate = parseLogDate(a.date)?.getTime() ?? 0;
      const bDate = parseLogDate(b.date)?.getTime() ?? 0;
      return bDate - aDate;
    });
    for (const log of sorted) {
      for (const result of log.results ?? []) {
        if (!result.completed) continue;
        const normalizedName = result.exerciseName.trim().toLowerCase();
        if (normalizedName !== normalizedExerciseName) continue;
        const parsedWeight = Number(result.performedWeight);
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) continue;
        return String(parsedWeight);
      }
    }
    return "";
  }
  const completedLogDates = useMemo(
    () => completedLogs.map((log) => parseStoredLogDate(log.date)).filter((date): date is Date => Boolean(date)),
    [completedLogs],
  );
  const estimatedSessionsThisMonth = useMemo(
    () => completedLogDates.filter((date) => date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear()).length,
    [completedLogDates, nowDate],
  );
  const memberProgress = useMemo(
    () =>
      computeMemberProgressState({
        completedLogDates,
        nowDate,
        sessionsPerWeekTarget: Number(profileSessionsPerWeekTarget) || 0,
      }),
    [completedLogDates, nowDate, profileSessionsPerWeekTarget],
  );
  const homeLastWeekSessions = useMemo(() => {
    const today = getStartOfDay(new Date(nowTimestamp));
    const mondayOffset = (today.getDay() + 6) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    const prevStart = new Date(weekStart);
    prevStart.setDate(prevStart.getDate() - 7);
    return completedLogDates.filter((date) => {
      const day = getStartOfDay(date);
      return day.getTime() >= prevStart.getTime() && day.getTime() < weekStart.getTime();
    }).length;
  }, [nowTimestamp, completedLogDates]);
  const homeWeeklySummary = useMemo(() => {
    const today = getStartOfDay(new Date(nowTimestamp));
    const mondayOffset = (today.getDay() + 6) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    const completedThisWeek = completedLogDates.filter((date) => {
      const day = getStartOfDay(date);
      return day.getTime() >= weekStart.getTime() && day.getTime() < weekEnd.getTime();
    }).length;
    const plannedThisWeek = activeWeeklyPlanEffectiveDays
      ? Object.values(activeWeeklyPlanEffectiveDays).filter((entry) => entry.trim().length > 0).length
      : 0;
    const completionRate = plannedThisWeek > 0 ? Math.min(100, Math.round((completedThisWeek / plannedThisWeek) * 100)) : 0;
    return { completedThisWeek, plannedThisWeek, completionRate };
  }, [nowTimestamp, completedLogDates, activeWeeklyPlanEffectiveDays]);
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
        sessionsPerWeekTarget: Number(profileSessionsPerWeekTarget) || undefined,
        plannedThisWeek: homeWeeklySummary.plannedThisWeek,
        completedThisWeek: homeWeeklySummary.completedThisWeek,
        recentReflections: recentWorkoutReflections,
      }),
    [
      completedLogDates,
      completedLogs.length,
      nowDate,
      memberProgress.streakWeeks,
      memberProgress.achievedLevel,
      memberProgress.recentStreakWeeks,
      profileSessionsPerWeekTarget,
      homeWeeklySummary.plannedThisWeek,
      homeWeeklySummary.completedThisWeek,
      recentWorkoutReflections,
    ],
  );
  const achievementMaxLevel = ACHIEVEMENT_MAX_LEVEL;
  const achievedLevel = memberProgress.achievedLevel;
  const achievementLevel = memberProgress.workingLevel;
  const hasCompletedAllAchievementLevels = memberProgress.hasCompletedAllLevels;
  const achievements = memberProgress.goals;
  const streakWeeks = memberProgress.streakWeeks;
  const streakSubline = memberProgress.streakSubline;
  const recentStreakWeeks = memberProgress.recentStreakWeeks;
  const currentStreakMilestoneTarget = memberProgress.streakMilestoneTarget;
  const maxLiftKg = useMemo(() => computeMaxLiftKgFromLogs(completedLogs), [completedLogs]);
  const activeCardioMinutes = useMemo(() => computeActiveCardioMinutesFromLogs(completedLogs), [completedLogs]);
  const memberBadgeCollection = useMemo(
    () =>
      computeMemberBadges({
        completedSessionCount: completedLogs.length,
        streakWeeks: memberProgress.streakWeeks,
        maxLiftKg,
        monthSessions: estimatedSessionsThisMonth,
        monthUniqueDays: computeMonthUniqueDays(completedLogDates, nowDate),
        monthWeeksWithSession: computeMonthWeeksWithSession(completedLogDates, nowDate),
        monthGoalTarget: memberProgress.monthGoal.target,
        activeCardioMinutes,
        nowDate,
        completedLogDates,
      }),
    [activeCardioMinutes, completedLogDates, completedLogs.length, estimatedSessionsThisMonth, maxLiftKg, memberProgress.monthGoal.target, memberProgress.streakWeeks, nowDate],
  );

  const calendarDayLoadByDateKey = useMemo(() => {
    const byKey = new Map<string, number>();
    completedLogDates.forEach((date) => {
      const key = toIsoDateInputValue(date);
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    });
    return byKey;
  }, [completedLogDates]);
  const calendarLogsByDateKey = useMemo(() => {
    const byKey = new Map<string, WorkoutLog[]>();
    completedLogs.forEach((log) => {
      const parsed = parseLogDate(log.date);
      if (!parsed) return;
      const key = toIsoDateInputValue(parsed);
      const previous = byKey.get(key) ?? [];
      byKey.set(key, [...previous, log]);
    });
    return byKey;
  }, [completedLogs]);

  function completedLogMatchesProgramForPeriodEntry(log: WorkoutLog, program: TrainingProgram, entry: string): boolean {
    if (log.status !== "Fullført") return false;
    if (periodPlanEntryMatchesCompletedProgram(entry, log.programTitle, memberProgramsForPeriodPlan, program.id)) return true;

    const programExerciseIds = new Set(program.exercises.map((exercise) => exercise.exerciseId.trim()).filter(Boolean));
    const programExerciseNames = new Set(
      program.exercises.map((exercise) => exercise.exerciseName.trim().toLowerCase()).filter(Boolean),
    );
    const logResults = log.results ?? [];
    if (!logResults.length || (!programExerciseIds.size && !programExerciseNames.size)) return false;

    let matches = 0;
    for (const result of logResults) {
      const resultExerciseId = result.exerciseId.trim();
      const resultExerciseName = result.exerciseName.trim().toLowerCase();
      if ((resultExerciseId && programExerciseIds.has(resultExerciseId)) || (resultExerciseName && programExerciseNames.has(resultExerciseName))) {
        matches += 1;
      }
    }
    return matches >= Math.min(2, Math.max(1, program.exercises.length));
  }

  const todayPeriodPlanCompleted = useMemo(() => {
    if (!todayPlanPeriodPlan || !todayPeriodPlanMatch || !todayPlanEntry) return false;
    const todayKey = toCalendarDateKey(nowDate);
    const logsForToday = calendarLogsByDateKey.get(todayKey) ?? [];
    if (
      todayPlanAction.kind === "start-program" &&
      logsForToday.some((log) => completedLogMatchesProgramForPeriodEntry(log, todayPlanAction.program, todayPlanEntry))
    ) {
      return true;
    }
    return isPeriodPlanDayComplete({
      planId: todayPlanPeriodPlan.id,
      weekNumber: todayPeriodPlanMatch.weekNumber,
      day: todayPeriodPlanMatch.day,
      entry: todayPlanEntry,
      completedKeys: completedPeriodPlanEntryKeys,
      dismissedKeys: dismissedPeriodPlanEntryKeys,
      programs: memberProgramsForPeriodPlan,
      logsForDate: logsForToday,
    });
  }, [
    todayPlanPeriodPlan,
    todayPeriodPlanMatch,
    todayPlanEntry,
    completedPeriodPlanEntryKeys,
    dismissedPeriodPlanEntryKeys,
    memberProgramsForPeriodPlan,
    calendarLogsByDateKey,
    nowDate,
    todayPlanAction,
  ]);
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
    if (!activePeriodPlan) return new Map<number, string[]>();
    return buildPeriodPlanPlannedEntriesByMonth({
      plans: [activePeriodPlan],
      swapsByPlan: periodPlanSwapsByPlan,
      calendarMonth,
    });
  }, [activePeriodPlan, periodPlanSwapsByPlan, calendarMonth]);
  const calendarDayStatusByDay = useMemo(() => {
    const statusByDay = new Map<number, TrainingCalendarDayStatus>();
    const todayStart = getStartOfDay(new Date(nowTimestamp));
    calendarPlannedEntriesByDay.forEach((_entries, day) => {
      const candidateDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const hasCompleted = calendarDayLoad.has(day);
      const isFutureDate = candidateDate.getTime() > todayStart.getTime();
      if (hasCompleted && !isFutureDate) {
        statusByDay.set(day, "completed");
        return;
      }
      const plannedMatch = activePeriodPlan
        ? findPeriodPlanEntryForCalendarDate(activePeriodPlan, candidateDate, periodPlanSwapsByPlan)
        : null;
      if (
        plannedMatch?.entry.trim() &&
        !isFutureDate &&
        isPeriodPlanDayComplete({
          planId: activePeriodPlan!.id,
          weekNumber: plannedMatch.weekNumber,
          day: plannedMatch.day,
          entry: plannedMatch.entry,
          completedKeys: completedPeriodPlanEntryKeys,
          dismissedKeys: dismissedPeriodPlanEntryKeys,
          programs: memberProgramsForPeriodPlan,
          logsForDate: calendarLogsByDay.get(day) ?? [],
        })
      ) {
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
      const candidateDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      if (candidateDate.getTime() <= todayStart.getTime()) {
        statusByDay.set(day, "completed");
      }
    });
    return statusByDay;
  }, [
    calendarPlannedEntriesByDay,
    calendarDayLoad,
    calendarMonth,
    nowTimestamp,
    activePeriodPlan,
    periodPlanSwapsByPlan,
    completedPeriodPlanEntryKeys,
    dismissedPeriodPlanEntryKeys,
    memberProgramsForPeriodPlan,
    calendarLogsByDay,
  ]);
  const calendarWeekDays = useMemo(() => {
    const todayStart = getStartOfDay(nowDate);
    const statusByDateKey = new Map<string, TrainingCalendarDayStatus>();
    const workoutLabelByDateKey = new Map<string, string>();
    const sessionCountByDateKey = new Map<string, number>();

    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(
        calendarWeekStart.getFullYear(),
        calendarWeekStart.getMonth(),
        calendarWeekStart.getDate() + offset,
      );
      const dateKey = toCalendarDateKey(date);
      const sessionCount = calendarDayLoadByDateKey.get(dateKey) ?? 0;
      sessionCountByDateKey.set(dateKey, sessionCount);

      const plannedMatch = activePeriodPlan
        ? findPeriodPlanEntryForCalendarDate(activePeriodPlan, date, periodPlanSwapsByPlan)
        : null;
      const plannedEntry = plannedMatch?.entry.trim() ?? "";
      const logs = calendarLogsByDateKey.get(dateKey) ?? [];
      const isFutureDate = date.getTime() > todayStart.getTime();
      const periodCompleted =
        plannedMatch?.entry.trim() && activePeriodPlan && !isFutureDate
          ? isPeriodPlanDayComplete({
              planId: activePeriodPlan.id,
              weekNumber: plannedMatch.weekNumber,
              day: plannedMatch.day,
              entry: plannedMatch.entry,
              completedKeys: completedPeriodPlanEntryKeys,
              dismissedKeys: dismissedPeriodPlanEntryKeys,
              programs: memberProgramsForPeriodPlan,
              logsForDate: logs,
            })
          : false;

      if ((sessionCount > 0 && !isFutureDate) || periodCompleted) {
        statusByDateKey.set(dateKey, "completed");
        workoutLabelByDateKey.set(dateKey, (logs[0]?.programTitle ?? plannedEntry) || "Økt");
      } else if (plannedEntry) {
        workoutLabelByDateKey.set(dateKey, plannedEntry);
        statusByDateKey.set(dateKey, date.getTime() < todayStart.getTime() ? "missed" : "planned");
      } else {
        statusByDateKey.set(dateKey, "none");
        workoutLabelByDateKey.set(dateKey, "—");
      }
    }

    return buildWeekDayModels({
      weekStart: calendarWeekStart,
      today: nowDate,
      statusByDateKey,
      workoutLabelByDateKey,
      sessionCountByDateKey,
    });
  }, [
    activePeriodPlan,
    calendarDayLoadByDateKey,
    calendarLogsByDateKey,
    calendarWeekStart,
    nowDate,
    periodPlanSwapsByPlan,
    completedPeriodPlanEntryKeys,
    dismissedPeriodPlanEntryKeys,
    memberProgramsForPeriodPlan,
  ]);
  const calendarWeekCompletedCount = calendarWeekDays.filter((day) => day.status === "completed").length;
  const calendarWeekPlannedCount = calendarWeekDays.filter((day) => day.workoutLabel !== "—").length;
  const selectedCalendarDate = useMemo(() => {
    if (!selectedCalendarDateKey) return null;
    const [year, month, day] = selectedCalendarDateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  }, [selectedCalendarDateKey]);
  const selectedCalendarLogs = useMemo(() => {
    if (!selectedCalendarDateKey) return [];
    return calendarLogsByDateKey.get(selectedCalendarDateKey) ?? [];
  }, [calendarLogsByDateKey, selectedCalendarDateKey]);
  const selectedCalendarPlannedEntries = useMemo(() => {
    if (!selectedCalendarDate || !activePeriodPlan) return [];
    const match = findPeriodPlanEntryForCalendarDate(activePeriodPlan, selectedCalendarDate, periodPlanSwapsByPlan);
    if (!match?.entry.trim()) return [];
    return [match.entry.trim()];
  }, [selectedCalendarDate, activePeriodPlan, periodPlanSwapsByPlan]);
  const selectedCalendarPeriodMatch = useMemo(() => {
    if (!selectedCalendarDate || !activePeriodPlan) return null;
    const match = findPeriodPlanEntryForCalendarDate(activePeriodPlan, selectedCalendarDate, periodPlanSwapsByPlan);
    if (!match?.entry.trim()) return null;
    return { plan: activePeriodPlan, ...match };
  }, [selectedCalendarDate, activePeriodPlan, periodPlanSwapsByPlan]);
  const selectedCalendarPlanEntry = selectedCalendarPeriodMatch?.entry?.trim() ?? selectedCalendarPlannedEntries[0]?.trim() ?? "";
  const selectedCalendarPlanAction = useMemo(
    () =>
      selectedCalendarPlanEntry
        ? resolvePeriodPlanEntryAction(selectedCalendarPlanEntry, memberProgramsForPeriodPlan)
        : { kind: "none" as const },
    [selectedCalendarPlanEntry, memberProgramsForPeriodPlan],
  );
  const selectedCalendarPeriodPlanCompleted = useMemo(() => {
    if (!selectedCalendarPeriodMatch || !selectedCalendarPlanEntry) return false;
    if (selectedCalendarDate && getStartOfDay(selectedCalendarDate).getTime() > getStartOfDay(nowDate).getTime()) {
      return false;
    }
    return isPeriodPlanDayComplete({
      planId: selectedCalendarPeriodMatch.plan.id,
      weekNumber: selectedCalendarPeriodMatch.weekNumber,
      day: selectedCalendarPeriodMatch.day,
      entry: selectedCalendarPlanEntry,
      completedKeys: completedPeriodPlanEntryKeys,
      dismissedKeys: dismissedPeriodPlanEntryKeys,
      programs: memberProgramsForPeriodPlan,
      logsForDate: selectedCalendarLogs,
    });
  }, [
    selectedCalendarPeriodMatch,
    selectedCalendarPlanEntry,
    completedPeriodPlanEntryKeys,
    dismissedPeriodPlanEntryKeys,
    memberProgramsForPeriodPlan,
    selectedCalendarLogs,
    selectedCalendarDate,
    nowDate,
  ]);
  const selectedCalendarLog = useMemo(() => {
    if (!selectedCalendarLogs.length) return null;
    if (!selectedCalendarLogId) return selectedCalendarLogs[0];
    return selectedCalendarLogs.find((log) => log.id === selectedCalendarLogId) ?? selectedCalendarLogs[0];
  }, [selectedCalendarLogs, selectedCalendarLogId]);
  const _maxCalendarDayLoad = Math.max(0, ...Array.from(calendarDayLoad.values()));
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
    const best = new Map<string, { weight: number; reps: number; score: number; achievedAt: Date | null }>();
    const sortedLogs = completedLogs
      .filter((log) => log.status === "Fullført")
      .slice()
      .sort((a, b) => {
        const aTime = parseStoredLogDate(a.date)?.getTime() ?? 0;
        const bTime = parseStoredLogDate(b.date)?.getTime() ?? 0;
        return aTime - bTime;
      });

    sortedLogs.forEach((log) => {
      const achievedAt = parseStoredLogDate(log.date);
      (log.results ?? []).forEach((r) => {
        if (!r.completed) return;
        const w = Number(r.performedWeight) || 0;
        const reps = Number(r.performedReps) || 0;
        const score = w * Math.max(reps, 1);
        const current = best.get(r.exerciseName);
        if (!current || score > current.score) {
          best.set(r.exerciseName, { weight: w, reps, score, achievedAt: achievedAt ?? null });
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
  const personalRecordExerciseNameSet = useMemo(
    () => new Set(personalRecords.map((r) => r.name)),
    [personalRecords],
  );
  const cleanedFavoritePersonalRecordNames = useMemo(
    () => effectiveFavoritePersonalRecordNames.filter((name) => personalRecordExerciseNameSet.has(name)),
    [effectiveFavoritePersonalRecordNames, personalRecordExerciseNameSet],
  );
  useEffect(() => {
    if (!favoritePersonalRecordPreferencesHydrated) return;
    setFavoritePersonalRecordNames((prev) => {
      const next = prev.filter((name) => personalRecordExerciseNameSet.has(name));
      return next.length === prev.length ? prev : next;
    });
  }, [favoritePersonalRecordPreferencesHydrated, personalRecordExerciseNameSet]);
  const personalRecordsPreview = useMemo(() => {
    if (showAllPersonalRecords) return personalRecords;
    const favorites = cleanedFavoritePersonalRecordNames
      .map((name) => personalRecords.find((record) => record.name === name) ?? null)
      .filter((record): record is (typeof personalRecords)[number] => Boolean(record));
    const fallback = personalRecords.filter((record) => !cleanedFavoritePersonalRecordNames.includes(record.name));
    return [...favorites, ...fallback].slice(0, 3);
  }, [showAllPersonalRecords, personalRecords, cleanedFavoritePersonalRecordNames]);
  const exerciseGroupByName = useMemo(() => buildExerciseGroupByName(exercises), [exercises]);
  const muscleSplitStats = useMemo(
    () =>
      computeMuscleGroupStats(completedLogs, exerciseGroupByName, {
        periodDays: muscleSplitPeriod,
        nowTimestamp,
      }),
    [completedLogs, exerciseGroupByName, muscleSplitPeriod, nowTimestamp],
  );
  const previousPersonalBestsByExercise = useMemo(() => {
    const best = new Map<string, number>();
    memberLogs.forEach((log) => {
      if (log.status !== "Fullført") return;
      (log.results ?? []).forEach((row) => {
        if (!row.completed) return;
        if (row.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) return;
        const w = Number(row.performedWeight) || 0;
        const reps = Number(row.performedReps) || 0;
        if (w <= 0 || reps <= 0) return;
        const score = w * Math.max(reps, 1);
        const key = row.exerciseName.trim().toLowerCase();
        const current = best.get(key) ?? 0;
        if (score > current) best.set(key, score);
      });
    });
    return best;
  }, [memberLogs]);
  const lastSessionResultsByExercise = useMemo(() => {
    const result = new Map<
      string,
      Map<number, { weight?: string; reps?: string; durationMinutes?: string; speed?: string; incline?: string }>
    >();
    const capturedFromExercises = new Set<string>();
    const sortedLogs = memberLogs
      .filter((log) => log.status === "Fullført")
      .slice()
      .sort((a, b) => {
        const aTime = parseStoredLogDate(a.date)?.getTime() ?? 0;
        const bTime = parseStoredLogDate(b.date)?.getTime() ?? 0;
        return bTime - aTime;
      });
    sortedLogs.forEach((log) => {
      const exercisesInThisLog = new Set<string>();
      (log.results ?? []).forEach((row) => {
        if (!row.completed) return;
        const key = row.exerciseName.trim().toLowerCase();
        if (capturedFromExercises.has(key)) return;
        exercisesInThisLog.add(key);
        const setMap = result.get(key) ?? new Map<number, { weight?: string; reps?: string; durationMinutes?: string; speed?: string; incline?: string }>();
        const setNum = row.setNumber ?? row.blockRound ?? 1;
        if (!setMap.has(setNum)) {
          setMap.set(setNum, {
            weight: row.performedWeight,
            reps: row.performedReps,
            durationMinutes: row.performedDurationMinutes,
            speed: row.performedSpeed,
            incline: row.performedIncline,
          });
        }
        result.set(key, setMap);
      });
      exercisesInThisLog.forEach((key) => capturedFromExercises.add(key));
    });
    return result;
  }, [memberLogs]);
  const activeCelebration = liveWorkoutCelebration ?? workoutCelebration;
  const recentlyFinishedLog = useMemo(() => {
    if (!recentlyFinishedLogId) return null;
    return completedLogs.find((log) => log.id === recentlyFinishedLogId) ?? null;
  }, [recentlyFinishedLogId, completedLogs]);
  const recentlyFinishedStats = useMemo(() => {
    if (!recentlyFinishedLog) return null;
    return computeWorkoutCelebrationStats(recentlyFinishedLog, memberLogs);
  }, [recentlyFinishedLog, memberLogs]);
  const showWorkoutCompletionCelebration = Boolean(recentlyFinishedLog && recentlyFinishedStats);
  /** Ny PR / økt rekord: alltid synlig for aktiv bruker (uavhengig av «små feiringer»). */
  const shouldShowPrCelebration =
    Boolean(activeCelebration && activeCelebration.memberId === activeMemberId) && !showWorkoutCompletionCelebration;

  function handleDismissWorkoutCompletionCelebration() {
    dismissRecentlyFinishedLog();
    if (workoutCelebration) dismissWorkoutCelebration();
    setLiveWorkoutCelebration(null);
  }

  const playCelebrationSound = useCallback(() => {
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
  }, [celebrationSoundEnabled]);

  function toggleFavoritePersonalRecord(recordName: string) {
    const normalizedName = recordName.trim();
    if (!normalizedName) return;
    const base = favoritePersonalRecordPreferencesHydrated ? favoritePersonalRecordNames : effectiveFavoritePersonalRecordNames;
    const pruned = base.filter((name) => personalRecordExerciseNameSet.has(name));
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
    setFavoritePersonalRecordPreferencesHydrated(true);
    setProfileSaveInfo(feedback);
  }

  const saveProfile = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!editableMember || typeof window === "undefined") return;
    const trimmedBirthDateDraft = memberBirthDateDraft.trim();
    if (trimmedBirthDateDraft && !isLikelyValidBirthDate(trimmedBirthDateDraft)) {
      if (!silent) {
        setProfileSaveInfo("Fødselsdato må være en gyldig dato på formatet dd.mm.yyyy.");
      }
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
    const metricsForSync = encodeMemberProfileMetrics(
      next,
      {
        homeVisibility,
        favoritePersonalRecords: cleanedFavoritePersonalRecordNames,
      },
      resolveMemberPersonalGoals(editableMember, members),
    );
    const profileAnchor = pickCanonicalMemberRowForProfile(editableMember, members);
    window.localStorage.setItem(getProfileStorageKey(profileAnchor.id), JSON.stringify(next));
    const targetMemberIds = Array.from(
      new Set(
        members
          .filter((member) => {
            const normalizedMemberEmail = member.email.trim().toLowerCase();
            if (member.id === profileAnchor.id) return true;
            if (member.id === editableMember.id) return true;
            if (relatedMemberIds.includes(member.id)) return true;
            if (normalizedMemberEmail && normalizedMemberEmail === fallbackEmail) return true;
            if (normalizedMemberEmail && normalizedMemberEmail === normalizedEmail) return true;
            return false;
          })
          .map((member) => member.id)
      )
    );
    const safeTargetIds = targetMemberIds.length ? targetMemberIds : [profileAnchor.id];
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
        memberId: profileAnchor.id,
        memberIds: safeTargetIds,
        targetName: memberNameDraft,
        // Treat sync as healthy when at least one canonical row is updated.
        // Duplicate legacy rows may lag and be healed by subsequent sync paths.
        expectedMinUpdated: 1,
        changes: {
          name: memberNameDraft,
          phone: normalizePhone(memberPhoneDraft),
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
        if (!silent) {
          setProfileSaveInfo("Profil lagret. E-post ble ikke endret fordi formatet var ugyldig.");
        }
        return;
      } else {
        if (!silent) {
          setProfileSaveInfo("Profil lagret automatisk.");
        }
      }
      return;
    }
    if (normalizedDraftEmail && !normalizedDraftEmail.includes("@")) {
      if (!silent) {
        setProfileSaveInfo("Profil lagret. E-post ble ikke endret fordi formatet var ugyldig.");
      }
      return;
    }
    if (!silent) {
      setProfileSaveInfo("Profil lagret automatisk.");
    }
  }, [
    editableMember,
    memberBirthDateDraft,
    memberEmailDraft,
    profileSessionsPerWeekTarget,
    profileDailyStepsTarget,
    profileTargetWeight,
    profileCurrentDailySteps,
    homeVisibility,
    cleanedFavoritePersonalRecordNames,
    members,
    relatedMemberIds,
    updateMember,
    memberNameDraft,
    memberPhoneDraft,
    memberGoalDraft,
    memberFocusDraft,
    memberInjuriesDraft,
    normalizedCurrentUserEmail,
    syncProfileToPtBackend,
  ]);

  function formatSeconds(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const minutesPart = String(Math.floor(safe / 60)).padStart(2, "0");
    const secondsPart = String(safe % 60).padStart(2, "0");
    return `${minutesPart}:${secondsPart}`;
  }

  useEffect(() => {
    if (!editableMember) return;
    if (lastMemberCoreHydrationIdRef.current !== editableMember.id) {
      lastMemberCoreHydrationIdRef.current = editableMember.id;
      setProfileSaveInfo(null);
    }
    setMemberNameDraft(editableMember.name);
    setMemberEmailDraft(editableMember.email);
    setMemberPhoneDraft(editableMember.phone);
    setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
    setMemberGoalDraft(editableMember.goal);
    setMemberFocusDraft(editableMember.focus);
    setMemberInjuriesDraft(editableMember.injuries);
  }, [
    editableMember?.id,
    editableMember?.name,
    editableMember?.email,
    editableMember?.phone,
    editableMember?.birthDate,
    editableMember?.goal,
    editableMember?.focus,
    editableMember?.injuries,
  ]);

  useEffect(() => {
    if (!editableMember) return;
    setProfileMetricsHydrated(false);

    const fallback: ProfileMetricsDraft = {
      sessionsPerWeekTarget: "",
      dailyStepsTarget: "",
      targetWeight: "",
      currentDailySteps: "",
    };

    let fromDb: ProfileMetricsDraft | null = null;
    for (const member of members) {
      if (!relatedMemberIdSet.has(member.id)) continue;
      const decoded = decodeMemberProfileMetrics(member.personalGoals);
      if (decoded) {
        fromDb = decoded;
        break;
      }
    }

    function applyMetricDrafts(metrics: ProfileMetricsDraft) {
      setProfileSessionsPerWeekTarget(metrics.sessionsPerWeekTarget);
      setProfileDailyStepsTarget(metrics.dailyStepsTarget);
      setProfileTargetWeight(metrics.targetWeight);
      setProfileCurrentDailySteps(metrics.currentDailySteps);
    }

    if (typeof window === "undefined") {
      applyMetricDrafts(fromDb ?? fallback);
      setProfileMetricsHydrated(true);
      return;
    }

    if (fromDb) {
      applyMetricDrafts(fromDb);
      try {
        window.localStorage.setItem(getProfileStorageKey(editableMember.id), JSON.stringify(fromDb));
      } catch {
        /* ignore quota / private mode quirks */
      }
      setProfileMetricsHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getProfileStorageKey(editableMember.id));
      if (!raw) {
        applyMetricDrafts(fallback);
        setProfileMetricsHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<ProfileMetricsDraft>;
      applyMetricDrafts({
        sessionsPerWeekTarget: parsed.sessionsPerWeekTarget ?? "",
        dailyStepsTarget: parsed.dailyStepsTarget ?? "",
        targetWeight: parsed.targetWeight ?? "",
        currentDailySteps: parsed.currentDailySteps ?? "",
      });
      const localHasAnyMetric =
        Boolean((parsed.sessionsPerWeekTarget ?? "").toString().trim()) ||
        Boolean((parsed.dailyStepsTarget ?? "").toString().trim()) ||
        Boolean((parsed.targetWeight ?? "").toString().trim()) ||
        Boolean((parsed.currentDailySteps ?? "").toString().trim());
      if (localHasAnyMetric) {
        const targetIds = Array.from(new Set([editableMember.id, ...relatedMemberIds].filter(Boolean)));
        const encoded = encodeMemberProfileMetrics(
          {
            sessionsPerWeekTarget: String(parsed.sessionsPerWeekTarget ?? ""),
            dailyStepsTarget: String(parsed.dailyStepsTarget ?? ""),
            targetWeight: String(parsed.targetWeight ?? ""),
            currentDailySteps: String(parsed.currentDailySteps ?? ""),
          },
          { homeVisibility: dbHomeVisibility ?? undefined },
          resolveBestPersonalGoalsForRelatedMembers(editableMember, members, relatedMemberIdSet),
        );
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
    }
    setProfileMetricsHydrated(true);
    // Avhengigheter bevisst snevre: «members» leses kun når signaturen sier at personalGoals faktisk endret seg.
  }, [editableMember?.id, relatedProfileGoalsSignature, relatedMemberIds, updateMember]);

  const previousActivePeriodPlanIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activePeriodPlanId || activePeriodSelectableWeekCount === 0 || !activePeriodPlan) {
      setSelectedPeriodPlanWeekNumber(null);
      previousActivePeriodPlanIdRef.current = activePeriodPlanId;
      return;
    }
    const calendarWeekNumber = resolvePeriodPlanWeekNumberForDate(activePeriodPlan, new Date(nowTimestamp));
    const planChanged = previousActivePeriodPlanIdRef.current !== activePeriodPlanId;
    previousActivePeriodPlanIdRef.current = activePeriodPlanId;
    setSelectedPeriodPlanWeekNumber((prev) => {
      if (planChanged || prev == null) return calendarWeekNumber;
      const weekExists = Number(prev) >= 1 && Number(prev) <= activePeriodSelectableWeekCount;
      return weekExists ? prev : calendarWeekNumber;
    });
  }, [activePeriodPlanId, activePeriodSelectableWeekCount, activePeriodPlan, nowTimestamp]);

  useEffect(() => {
    const planId = todayPeriodPlanMatch?.plan.id;
    if (!planId || homeWorkoutHydrationPending) return;
    if (planId === effectiveActiveMemberPeriodPlanId) return;
    setActiveMemberPeriodPlanId(planId);
    writeActivePeriodPlanIdForMembers(relatedMemberIds, planId);
  }, [
    todayPeriodPlanMatch?.plan.id,
    effectiveActiveMemberPeriodPlanId,
    relatedMemberIds,
    homeWorkoutHydrationPending,
  ]);

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
    if (memberTab !== "profile") return;
    if (!editableMember) return;
    if (!profileHasUnsavedChanges) return;
    const timer = window.setTimeout(() => {
      if (profileAutoSaveInFlightRef.current) return;
      profileAutoSaveInFlightRef.current = true;
      void saveProfile({ silent: true }).finally(() => {
        profileAutoSaveInFlightRef.current = false;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [memberTab, editableMember, profileHasUnsavedChanges, saveProfile]);
  useEffect(() => {
    const memberId = editableMember?.id;
    if (!memberId || typeof window === "undefined") {
      setCompletedPeriodPlanEntryKeys([]);
      setDismissedPeriodPlanEntryKeys([]);
      periodPlanCompletionHydratedMemberRef.current = null;
      periodPlanCompletionLocalUpdatedAtRef.current = 0;
      return;
    }

    const isNewMember = periodPlanCompletionHydratedMemberRef.current !== memberId;
    if (isNewMember) {
      periodPlanCompletionHydratedMemberRef.current = memberId;
      periodPlanCompletedDirtyRef.current = false;
      periodPlanDismissedDirtyRef.current = false;
      periodPlanCompletionLocalUpdatedAtRef.current = 0;
    }

    let storedCompleted: string[] = [];
    let storedDismissed: string[] = [];
  const shouldReadLocalStorage = isNewMember || (!periodPlanCompletedDirtyRef.current && !periodPlanDismissedDirtyRef.current);
  if (shouldReadLocalStorage) {
    try {
      const raw = window.localStorage.getItem(getPeriodPlanCompletedStorageKey(memberId));
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          storedCompleted = parsed.map((item) => String(item)).filter(Boolean);
        }
      }
      const dismissedRaw = window.localStorage.getItem(getPeriodPlanDismissedStorageKey(memberId));
      if (dismissedRaw) {
        const parsedDismissed = JSON.parse(dismissedRaw) as unknown;
        if (Array.isArray(parsedDismissed)) {
          storedDismissed = parsedDismissed.map((item) => String(item)).filter(Boolean);
        }
      }
    } catch {
      storedCompleted = [];
      storedDismissed = [];
    }
  } else {
    storedCompleted = completedPeriodPlanEntryKeysRef.current;
    storedDismissed = dismissedPeriodPlanEntryKeysRef.current;
  }

    const remotePrefs = readPeriodPlanCompletionFromPersonalGoals(
      resolveBestPersonalGoalsForRelatedMembers(editableMember, members, relatedMemberIdSet),
    );

    const derived = derivePeriodPlanCompletedEntryKeysFromLogs({
      plans: visiblePeriodPlans,
      swapsByPlan: periodPlanSwapsByPlan,
      programs: memberProgramsForPeriodPlan,
      logs: memberLogs,
      memberId,
      memberIds: relatedMemberIds,
      dismissedKeys: storedDismissed,
    });

    const reconciled = reconcilePeriodPlanCompletionKeys({
      storedCompleted,
      storedDismissed,
      remotePrefs,
      derivedCompleted: derived,
      localUpdatedAt: periodPlanCompletionLocalUpdatedAtRef.current,
    });

    setCompletedPeriodPlanEntryKeys((prev) => {
      const next = reconciled.completedKeys;
      if (prev.length === next.length && prev.every((key, index) => key === next[index])) return prev;
      completedPeriodPlanEntryKeysRef.current = next;
      return next;
    });
    setDismissedPeriodPlanEntryKeys((prev) => {
      const next = reconciled.dismissedKeys;
      if (prev.length === next.length && prev.every((key, index) => key === next[index])) return prev;
      dismissedPeriodPlanEntryKeysRef.current = next;
      return next;
    });
  }, [
    editableMember,
    members,
    relatedMemberIdSet,
    relatedMemberIds,
    visiblePeriodPlans,
    periodPlanSwapsByPlan,
    memberProgramsForPeriodPlan,
    memberLogs,
    memberRemoteHydrated,
    relatedProfileGoalsSignature,
  ]);
  useEffect(() => {
    const memberId = editableMember?.id;
    if (!memberId || typeof window === "undefined") return;
    if (!periodPlanCompletedDirtyRef.current && !periodPlanDismissedDirtyRef.current) return;

    const timer = window.setTimeout(() => {
      try {
        if (periodPlanCompletedDirtyRef.current) {
          window.localStorage.setItem(
            getPeriodPlanCompletedStorageKey(memberId),
            JSON.stringify(completedPeriodPlanEntryKeys),
          );
        }
        if (periodPlanDismissedDirtyRef.current) {
          window.localStorage.setItem(
            getPeriodPlanDismissedStorageKey(memberId),
            JSON.stringify(dismissedPeriodPlanEntryKeys),
          );
        }
      } catch {
        // ignore storage write errors (quota/private mode)
      }

      if (currentUserRole === "member") {
        // Bruk lokalt ref-timestamp slik at sky-ekkoet ikke får et nyere
        // updatedAt enn local. Uten dette ville `mergePeriodPlanCompletionPrefs`
        // anse remote som nyest og overstyre en ferskt fjernet «dismissed»-rad
        // (fix for «Logg dagens økt»-knapp som ikke flipper).
        const localUpdatedAt = periodPlanCompletionLocalUpdatedAtRef.current || Date.now();
        const encoded = mergePeriodPlanCompletionIntoPersonalGoals(
          resolveBestPersonalGoalsForRelatedMembers(editableMember, members, relatedMemberIdSet),
          {
            version: 1,
            completedEntryKeys: completedPeriodPlanEntryKeys,
            dismissedEntryKeys: dismissedPeriodPlanEntryKeys,
            updatedAt: localUpdatedAt,
          },
        );
        const targetIds = Array.from(new Set([memberId, ...relatedMemberIds].filter(Boolean)));
        targetIds.forEach((targetMemberId) => {
          updateMember({
            memberId: targetMemberId,
            changes: { personalGoals: encoded },
          });
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    editableMember,
    members,
    relatedMemberIdSet,
    relatedMemberIds,
    completedPeriodPlanEntryKeys,
    dismissedPeriodPlanEntryKeys,
    currentUserRole,
    updateMember,
  ]);
  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    if (!periodPlanSwapsDirtyRef.current) return;
    try {
      window.localStorage.setItem(
        getPeriodPlanSwapsStorageKey(editableMember.id),
        JSON.stringify(periodPlanSwapsByPlan),
      );
    } catch {
      // ignore storage write errors (quota/private mode)
    }
  }, [editableMember?.id, periodPlanSwapsByPlan]);
  useEffect(() => {
    setFavoritePersonalRecordPreferencesHydrated(false);
    achievementCelebrationBaselineRef.current = null;
    setAchievementCelebration(null);
  }, [editableMember?.id]);

  function resolveFavoritePersonalRecordsForHydration(
    dbFavorites: string[] | undefined,
    localFavorites: string[] | undefined,
    preferLocal: boolean,
  ): string[] {
    const fromDb = normalizeFavoritePersonalRecordNames(dbFavorites) ?? [];
    const fromLocal = normalizeFavoritePersonalRecordNames(localFavorites) ?? [];
    if (preferLocal && fromLocal.length > 0) return fromLocal;
    if (fromDb.length > 0) return fromDb;
    return fromLocal;
  }

  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(getUiPreferencesStorageKey(editableMember.id));
      if (!raw) {
        setMicroCelebrationsEnabled(true);
        setCelebrationSoundEnabled(false);
        setRestCountdownEnabled(true);
        setHomeVisibility({
          ...DEFAULT_HOME_VISIBILITY,
          ...(normalizeHomeVisibilityForStorage(dbHomeVisibility ?? undefined) ?? {}),
        });
        const seeded = resolveFavoritePersonalRecordsForHydration(dbFavoritePersonalRecordNames ?? undefined, undefined, false);
        setFavoritePersonalRecordNames((prev) => (JSON.stringify(prev) === JSON.stringify(seeded) ? prev : seeded));
        setFavoritePersonalRecordPreferencesHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        microCelebrationsEnabled?: boolean;
        celebrationSoundEnabled?: boolean;
        restCountdownEnabled?: boolean;
        homeVisibility?: Partial<Record<HomeSectionKey, boolean>>;
        favoritePersonalRecords?: string[];
      };
      setMicroCelebrationsEnabled(parsed.microCelebrationsEnabled !== false);
      setCelebrationSoundEnabled(parsed.celebrationSoundEnabled === true);
      setRestCountdownEnabled(parsed.restCountdownEnabled !== false);
      const resolvedPatch =
        normalizeHomeVisibilityForStorage(dbHomeVisibility ?? parsed.homeVisibility ?? undefined) ?? {};
      const resolvedFavorites = resolveFavoritePersonalRecordsForHydration(
        dbFavoritePersonalRecordNames ?? undefined,
        parsed.favoritePersonalRecords,
        favoritePersonalRecordPreferencesHydrated,
      );
      setHomeVisibility({
        ...DEFAULT_HOME_VISIBILITY,
        ...resolvedPatch,
      });
      setFavoritePersonalRecordNames((prev) => (JSON.stringify(prev) === JSON.stringify(resolvedFavorites) ? prev : resolvedFavorites));
      setFavoritePersonalRecordPreferencesHydrated(true);
    } catch {
      setMicroCelebrationsEnabled(true);
      setCelebrationSoundEnabled(false);
      setRestCountdownEnabled(true);
      setHomeVisibility({
        ...DEFAULT_HOME_VISIBILITY,
        ...(normalizeHomeVisibilityForStorage(dbHomeVisibility ?? undefined) ?? {}),
      });
      const fallback = resolveFavoritePersonalRecordsForHydration(dbFavoritePersonalRecordNames ?? undefined, undefined, false);
      setFavoritePersonalRecordNames((prev) => (JSON.stringify(prev) === JSON.stringify(fallback) ? prev : fallback));
      setFavoritePersonalRecordPreferencesHydrated(true);
    }
  }, [editableMember?.id, dbFavoritePersonalRecordNames, dbHomeVisibility, favoritePersonalRecordPreferencesHydrated]);

  useEffect(() => {
    if (!editableMember) return;
    const patch = normalizeHomeVisibilityForStorage(dbHomeVisibility ?? undefined);
    if (!patch || Object.keys(patch).length === 0) return;
    setHomeVisibility((prev) => ({
      ...DEFAULT_HOME_VISIBILITY,
      ...prev,
      ...patch,
    }));
  }, [editableMember?.id, dbHomeVisibility]);
  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    if (!favoritePersonalRecordPreferencesHydrated) return;
    const payload = JSON.stringify({
      microCelebrationsEnabled,
      celebrationSoundEnabled,
      restCountdownEnabled,
      homeVisibility,
      favoritePersonalRecords: favoritePersonalRecordNames,
    });
    window.localStorage.setItem(getUiPreferencesStorageKey(editableMember.id), payload);
  }, [editableMember, microCelebrationsEnabled, celebrationSoundEnabled, restCountdownEnabled, homeVisibility, favoritePersonalRecordNames, favoritePersonalRecordPreferencesHydrated]);
  useEffect(() => {
    if (!editableMember) return;
    if (!profileMetricsHydrated) return;
    const normalizedHomeVisibility = normalizeHomeVisibilityForStorage(homeVisibility);
    const dbHomeVisibilityNormalized = normalizeHomeVisibilityForStorage(dbHomeVisibility ?? undefined);
    const nextVisibilitySignature = JSON.stringify(normalizedHomeVisibility ?? {});
    const dbVisibilitySignature = JSON.stringify(dbHomeVisibilityNormalized ?? {});
    if (nextVisibilitySignature === dbVisibilitySignature) return;
    const nextMetrics: ProfileMetricsDraft = {
      sessionsPerWeekTarget: profileSessionsPerWeekTarget.trim(),
      dailyStepsTarget: profileDailyStepsTarget.trim(),
      targetWeight: profileTargetWeight.trim(),
      currentDailySteps: profileCurrentDailySteps.trim(),
    };
    const encoded = encodeMemberProfileMetrics(
      nextMetrics,
      {
        homeVisibility: normalizedHomeVisibility,
        favoritePersonalRecords: cleanedFavoritePersonalRecordNames,
      },
      resolveMemberPersonalGoals(editableMember, members),
    );
    const targetIds = Array.from(new Set([editableMember.id, ...relatedMemberIds].filter(Boolean)));
    targetIds.forEach((memberId) => {
      updateMember({
        memberId,
        changes: {
          personalGoals: encoded,
        },
      });
    });
    if (!supabaseClient) return;
    void syncProfileToPtBackend({
      email: normalizedCurrentUserEmail || editableMember.email.trim().toLowerCase(),
      emails: Array.from(
        new Set(
          [normalizedCurrentUserEmail, editableMember.email.trim().toLowerCase()]
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value && value.includes("@")),
        ),
      ),
      memberId: editableMember.id,
      memberIds: targetIds,
      targetName: editableMember.name,
      expectedMinUpdated: 1,
      changes: {
        personalGoals: encoded,
      },
    });
  }, [
    editableMember,
    syncProfileToPtBackend,
    cleanedFavoritePersonalRecordNames,
    homeVisibility,
    dbHomeVisibility,
    profileSessionsPerWeekTarget,
    profileDailyStepsTarget,
    profileTargetWeight,
    profileCurrentDailySteps,
    relatedMemberIds,
    updateMember,
    normalizedCurrentUserEmail,
    profileMetricsHydrated,
  ]);
  useEffect(() => {
    if (!editableMember) return;
    if (!favoritePersonalRecordPreferencesHydrated) return;
    if (!profileMetricsHydrated) return;
    const normalizedFavorites = normalizeFavoritePersonalRecordNames(favoritePersonalRecordNames) ?? [];
    const dbFavoritesRaw = normalizeFavoritePersonalRecordNames(dbFavoritePersonalRecordNames ?? undefined) ?? [];
    const cleanedLocal = normalizedFavorites.filter((name) => personalRecordExerciseNameSet.has(name));
    const cleanedDb = dbFavoritesRaw.filter((name) => personalRecordExerciseNameSet.has(name));
    const hasStaleEntries =
      normalizedFavorites.length !== cleanedLocal.length || dbFavoritesRaw.length !== cleanedDb.length;
    if (!hasStaleEntries && JSON.stringify(cleanedLocal) === JSON.stringify(cleanedDb)) return;
    const nextMetrics: ProfileMetricsDraft = {
      sessionsPerWeekTarget: profileSessionsPerWeekTarget.trim(),
      dailyStepsTarget: profileDailyStepsTarget.trim(),
      targetWeight: profileTargetWeight.trim(),
      currentDailySteps: profileCurrentDailySteps.trim(),
    };
    const encoded = encodeMemberProfileMetrics(
      nextMetrics,
      {
        homeVisibility: normalizeHomeVisibilityForStorage(homeVisibility),
        favoritePersonalRecords: cleanedLocal,
      },
      resolveMemberPersonalGoals(editableMember, members),
    );
    const targetIds = Array.from(new Set([editableMember.id, ...relatedMemberIds].filter(Boolean)));
    targetIds.forEach((memberId) => {
      updateMember({
        memberId,
        changes: {
          personalGoals: encoded,
        },
      });
    });
    if (!supabaseClient) return;
    void syncProfileToPtBackend({
      email: normalizedCurrentUserEmail || editableMember.email.trim().toLowerCase(),
      emails: Array.from(
        new Set(
          [normalizedCurrentUserEmail, editableMember.email.trim().toLowerCase()]
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value && value.includes("@")),
        ),
      ),
      memberId: editableMember.id,
      memberIds: targetIds,
      targetName: editableMember.name,
      expectedMinUpdated: 1,
      changes: {
        personalGoals: encoded,
      },
    });
  }, [
    dbFavoritePersonalRecordNames,
    editableMember,
    favoritePersonalRecordNames,
    homeVisibility,
    normalizedCurrentUserEmail,
    profileCurrentDailySteps,
    profileDailyStepsTarget,
    profileSessionsPerWeekTarget,
    profileTargetWeight,
    relatedMemberIds,
    syncProfileToPtBackend,
    updateMember,
    favoritePersonalRecordPreferencesHydrated,
    personalRecordExerciseNameSet,
    profileMetricsHydrated,
  ]);
  useEffect(() => {
    if (!shouldShowPrCelebration) return;
    playCelebrationSound();
  }, [shouldShowPrCelebration, playCelebrationSound]);
  useEffect(() => {
    if (memberTab !== "messages") return;
    const container = memberMessagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [memberTab, memberMessages.length]);
  useEffect(() => {
    if (memberTab !== "programs" || trainingSection !== "period") return;
    if (periodPlans.length > 0 && !memberHasVisiblePeriodPlan) {
      setShowPeriodPlanManageSection(true);
      setShowPeriodPlanHiddenSection(true);
    }
  }, [memberTab, trainingSection, periodPlans.length, memberHasVisiblePeriodPlan]);

  useEffect(() => {
    if (!memberFocusWorkoutLogId) return;
    const log = completedLogs.find((item) => item.id === memberFocusWorkoutLogId);
    if (!log) return;
    setExpandedRecentLogId(memberFocusWorkoutLogId);
    setTrainingSection("history");
    if (memberTab !== "programs") {
      setMemberTab("programs");
    }
    const scrollTargetId = `member-workout-log-${memberFocusWorkoutLogId}`;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      clearMemberFocusWorkoutLogId?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [memberFocusWorkoutLogId, completedLogs, memberTab, setMemberTab, clearMemberFocusWorkoutLogId]);

  useEffect(() => {
    if (!memberFocusProgramId) return;
    const program =
      memberProgramsInActiveLibrary.find((item) => item.id === memberFocusProgramId) ??
      memberPrograms.find((item) => item.id === memberFocusProgramId);
    if (!program || programIsInMemberArchive(program.memberLibraryStatus)) {
      clearMemberFocusProgramId?.();
      return;
    }
    setTrainingSection("programs");
    setExpandedProgramId(program.id);
    if (memberTab !== "programs") {
      setMemberTab("programs");
    }
    const scrollTargetId = `member-program-${program.id}`;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      clearMemberFocusProgramId?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    memberFocusProgramId,
    memberPrograms,
    memberProgramsInActiveLibrary,
    memberTab,
    setMemberTab,
    clearMemberFocusProgramId,
  ]);

  useEffect(() => {
    if (memberTab !== "programs" && memberFocusWorkoutLogId) {
      clearMemberFocusWorkoutLogId?.();
    }
  }, [memberTab, memberFocusWorkoutLogId, clearMemberFocusWorkoutLogId]);

  useEffect(() => {
    if (memberTab !== "programs" && memberFocusProgramId) {
      clearMemberFocusProgramId?.();
    }
  }, [memberTab, memberFocusProgramId, clearMemberFocusProgramId]);

  useEffect(() => {
    if (memberTab !== "programs" || typeof window === "undefined") return;
    if (window.sessionStorage.getItem("motus.member.openPeriodPlanOnPrograms") === "1") {
      window.sessionStorage.removeItem("motus.member.openPeriodPlanOnPrograms");
      setShowPeriodPlanPanel(true);
    }
  }, [memberTab]);

  function openProgramsWithPeriodPlan() {
    setTrainingSection("period");
    setShowPeriodPlanPanel(true);
    setMemberTab("programs");
  }

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
    if (isMemberLimited) return;
    const storedBaseline = memberNotificationPrefs?.lastCelebratedAchievedLevel ?? 0;
    if (achievementCelebrationBaselineRef.current === null) {
      achievementCelebrationBaselineRef.current = Math.max(storedBaseline, achievedLevel);
      return;
    }
    if (achievedLevel < achievementCelebrationBaselineRef.current) {
      achievementCelebrationBaselineRef.current = achievedLevel;
      return;
    }
    if (achievedLevel === achievementCelebrationBaselineRef.current) return;
    achievementCelebrationBaselineRef.current = achievedLevel;
    setAchievementCelebration({ achievedLevel });
    persistMemberUiPrefs({ lastCelebratedAchievedLevel: achievedLevel });
  }, [
    achievedLevel,
    isMemberLimited,
    memberNotificationPrefs?.lastCelebratedAchievedLevel,
    persistMemberUiPrefs,
  ]);

  useEffect(() => {
    if (hiddenBadgeMigrationDoneRef.current || !activeMemberId || !editableMember || typeof window === "undefined") {
      return;
    }
    hiddenBadgeMigrationDoneRef.current = true;
    const fromLocal: string[] = [];
    for (const badge of memberBadgeCollection.allBadges) {
      if (!badge.secret) continue;
      const key = `${HIDDEN_BADGE_SEEN_STORAGE_PREFIX}${activeMemberId}:${badge.id}`;
      if (window.localStorage.getItem(key) === "seen") {
        fromLocal.push(badge.id);
      }
    }
    if (!fromLocal.length) return;
    const merged = Array.from(new Set([...(memberNotificationPrefs?.seenHiddenBadgeIds ?? []), ...fromLocal]));
    if (merged.length > (memberNotificationPrefs?.seenHiddenBadgeIds?.length ?? 0)) {
      persistMemberUiPrefs({ seenHiddenBadgeIds: merged });
    }
  }, [
    activeMemberId,
    editableMember,
    memberBadgeCollection.allBadges,
    memberNotificationPrefs?.seenHiddenBadgeIds,
    persistMemberUiPrefs,
  ]);

  useEffect(() => {
    if (isMemberLimited || !activeMemberId) return;
    const unlockedSecretBadgeIds = memberBadgeCollection.allBadges
      .filter((badge) => badge.secret && badge.unlocked)
      .map((badge) => badge.id);
    const baseline = hiddenBadgeUnlockedBaselineRef.current;
    if (baseline?.memberId === activeMemberId) return;
    hiddenBadgeUnlockedBaselineRef.current = {
      memberId: activeMemberId,
      badgeIds: new Set(unlockedSecretBadgeIds),
    };
    const previouslyUnlockedAndUnseen = unlockedSecretBadgeIds.filter((badgeId) => !seenHiddenBadgeIds.has(badgeId));
    if (!previouslyUnlockedAndUnseen.length) return;
    const nextSeen = Array.from(new Set([...seenHiddenBadgeIds, ...previouslyUnlockedAndUnseen]));
    setLocallySeenHiddenBadgeIds((previous) => Array.from(new Set([...previous, ...previouslyUnlockedAndUnseen])));
    persistMemberUiPrefs({ seenHiddenBadgeIds: nextSeen });
  }, [
    activeMemberId,
    isMemberLimited,
    memberBadgeCollection.allBadges,
    persistMemberUiPrefs,
    seenHiddenBadgeIds,
  ]);

  useEffect(() => {
    if (isMemberLimited || !activeMemberId || hiddenBadgeCelebration) return;
    const baseline = hiddenBadgeUnlockedBaselineRef.current;
    if (!baseline || baseline.memberId !== activeMemberId) return;
    const secretBadge = memberBadgeCollection.allBadges.find(
      (badge) => badge.secret && badge.unlocked && !seenHiddenBadgeIds.has(badge.id) && !baseline.badgeIds.has(badge.id),
    );
    if (!secretBadge) return;
    baseline.badgeIds.add(secretBadge.id);
    markHiddenBadgeSeen(secretBadge.id);
    setHiddenBadgeCelebration(secretBadge);
  }, [
    activeMemberId,
    hiddenBadgeCelebration,
    isMemberLimited,
    markHiddenBadgeSeen,
    memberBadgeCollection.allBadges,
    seenHiddenBadgeIds,
  ]);

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
    setIntervalTimerStatus(`Hoppet til: ${nextStep.headline}`);
  }

  async function sharePersonalRecordEntry(
    record: { name: string; weight: number; reps: number },
    previousEstimated1RmKg?: number,
  ) {
    if (typeof window === "undefined") return;
    setMotusCardShareStatus(null);
    try {
      const outcome = await sharePersonalRecordCard({
        logoSrc: motusShareLogoSrc,
        memberDisplayName: memberShareDisplayName,
        exerciseName: record.name,
        weightKg: record.weight,
        reps: record.reps,
        previousEstimated1RmKg,
      });
      setMotusCardShareStatus(motusShareStatusMessage(outcome));
    } catch {
      setMotusCardShareStatus("Kunne ikke dele akkurat nå.");
    }
  }

  async function shareActiveCelebrationPr() {
    if (!activeCelebration || isSharingCelebrationPr) return;
    setIsSharingCelebrationPr(true);
    try {
      await sharePersonalRecordEntry(
        {
          name: activeCelebration.exerciseName,
          weight: activeCelebration.weight,
          reps: activeCelebration.reps,
        },
        activeCelebration.previousEstimated1RM,
      );
    } finally {
      setIsSharingCelebrationPr(false);
    }
  }

  async function shareMonthlyProgressSummary() {
    if (typeof window === "undefined") return;
    try {
      function fillWrappedCanvasText(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number,
      ) {
        const words = text.split(/\s+/).filter(Boolean);
        let line = "";
        let cy = y;
        for (let i = 0; i < words.length; i += 1) {
          const word = words[i] ?? "";
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, cy);
            line = word;
            cy += lineHeight;
          } else {
            line = test;
          }
        }
        if (line) ctx.fillText(line, x, cy);
      }

      function fillRoundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
      ) {
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
      }

      // Kortet eksporteres i samme portrett-format (3:4) som forhåndsvisningen
      // viser på mobil — foto fyller hele bakgrunnen, tekst og stat-fliser ligger
      // overlay, og en mørk footer-stripe sitter nederst.
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1440;
      const context = canvas.getContext("2d");
      if (!context) {
        setProgressShareStatus("Kunne ikke lage bilde akkurat nå.");
        return;
      }

      let shareCardLogo: HTMLImageElement | null = null;
      const shareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-05-original`;
      try {
        shareCardLogo = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error("logo"));
          im.src = shareLogoSrc;
        });
      } catch {
        shareCardLogo = null;
      }

      let heroImage: HTMLImageElement | null = null;
      try {
        heroImage = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error("hero"));
          im.src = "/share/weekly-summary-hero.png";
        });
      } catch {
        heroImage = null;
      }

      const W = canvas.width;
      const H = canvas.height;
      const footerH = 130;
      const footerY = H - footerH;
      const pad = 56;

      // Mørk bakgrunnsgradient (synlig i kanter/fades)
      const bg = context.createRadialGradient(W * 0.1, H * 0.1, 100, W * 0.6, H * 0.7, W);
      bg.addColorStop(0, "#1a2335");
      bg.addColorStop(0.45, "#0d111c");
      bg.addColorStop(1, "#060912");
      context.fillStyle = bg;
      context.fillRect(0, 0, W, H);

      // Foto som fyller hele kortet bak innholdet
      if (heroImage && heroImage.naturalWidth > 0) {
        const photoH = footerY; // stopper rett over footer
        const scale = Math.max(W / heroImage.naturalWidth, photoH / heroImage.naturalHeight);
        const drawW = heroImage.naturalWidth * scale;
        const drawH = heroImage.naturalHeight * scale;
        const drawX = (W - drawW) / 2;
        const drawY = -(drawH - photoH) * 0.35;
        context.save();
        context.beginPath();
        context.rect(0, 0, W, photoH);
        context.clip();
        context.drawImage(heroImage, drawX, drawY, drawW, drawH);

        // Mørkning øverst (rundt header) for kontrast mot logo + pill
        const topGrad = context.createLinearGradient(0, 0, 0, 260);
        topGrad.addColorStop(0, "rgba(13, 17, 28, 0.72)");
        topGrad.addColorStop(1, "rgba(13, 17, 28, 0)");
        context.fillStyle = topGrad;
        context.fillRect(0, 0, W, 260);

        // Mørkning mellom photo og stat-fliser (midten)
        const midGrad = context.createLinearGradient(0, 360, 0, 700);
        midGrad.addColorStop(0, "rgba(13, 17, 28, 0)");
        midGrad.addColorStop(1, "rgba(13, 17, 28, 0.78)");
        context.fillStyle = midGrad;
        context.fillRect(0, 360, W, 340);

        // Solid mørk over stat-fliser-området for lesbarhet
        context.fillStyle = "rgba(13, 17, 28, 0.78)";
        context.fillRect(0, 700, W, photoH - 700);

        context.restore();
      }

      // Topp: MOTUS-logo til venstre
      if (shareCardLogo && shareCardLogo.naturalWidth > 0) {
        const lh = 64;
        const lw = (shareCardLogo.naturalWidth / shareCardLogo.naturalHeight) * lh;
        context.save();
        context.globalAlpha = 0.98;
        context.drawImage(shareCardLogo, pad, 56, lw, lh);
        context.restore();
      } else {
        context.fillStyle = "#ffffff";
        context.font = "900 40px system-ui, -apple-system, Segoe UI, sans-serif";
        context.fillText("MOTUS", pad, 102);
      }

      // Topp: Uke-pille til høyre
      const pillText = progressShareWeekLabel;
      context.font = "700 22px system-ui, -apple-system, Segoe UI, sans-serif";
      const pillTextW = context.measureText(pillText).width;
      const pillW = pillTextW + 44;
      const pillH = 48;
      const pillX = W - pillW - pad;
      const pillY = 64;
      const pillGrad = context.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
      pillGrad.addColorStop(0, "#f472b6");
      pillGrad.addColorStop(1, "#d91278");
      context.fillStyle = pillGrad;
      fillRoundRect(context, pillX, pillY, pillW, pillH, pillH / 2);
      context.fillStyle = "#ffffff";
      context.textBaseline = "middle";
      context.fillText(pillText, pillX + 22, pillY + pillH / 2 + 1);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";

      // UKEN SOM HAR VÆRT eyebrow
      let yCursor = 220;
      context.fillStyle = "#30e3be";
      context.font = "800 22px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("UKEN SOM HAR VÆRT", pad, yCursor);
      // Tittelfonten er 110px — vi må gi den nok plass under eyebrow-teksten
      // slik at de ikke overlapper. Cap-height for 110px font er ca 77px.
      yCursor += 130;

      // Hovedtittel + rosa understrek
      const titleText = progressShareTitle;
      context.save();
      context.shadowColor = "rgba(0, 0, 0, 0.55)";
      context.shadowBlur = 14;
      context.fillStyle = "#ffffff";
      context.font = "900 110px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(titleText, pad, yCursor);
      context.restore();
      const titleW = context.measureText(titleText).width;
      context.strokeStyle = "#d91278";
      context.lineWidth = 9;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(pad, yCursor + 26);
      context.lineTo(pad + Math.min(titleW * 0.9, titleW), yCursor + 26);
      context.stroke();
      yCursor += 80;

      // Subtittel (2 linjer)
      context.save();
      context.shadowColor = "rgba(0, 0, 0, 0.5)";
      context.shadowBlur = 8;
      context.fillStyle = "rgba(241, 245, 249, 0.92)";
      context.font = "500 28px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("Se hva jeg har fått til på Motus.", pad, yCursor);
      yCursor += 38;
      context.fillText("Små steg hver uke gir store resultater!", pad, yCursor);
      context.restore();
      yCursor += 50;

      // Stat-fliser (2 kolonner, 3 rader — 5 fliser, siste flis tar full bredde)
      const groupCount = progressShareLast7Days.groupClasses;
      const kcal = progressShareLast7Days.kcal;
      const minutes = progressShareLast7Days.activityMinutes;
      const statTiles: Array<{
        value: string;
        label: string;
        sub: string;
        tone: "teal" | "pink";
        iconKey: "kg" | "workouts" | "groups" | "kcal" | "time";
      }> = [
        {
          value: Math.round(progressShareLast7Days.volumeKg).toLocaleString("nb-NO"),
          label: "KG LØFTET",
          sub: "Totalt løftet denne uken",
          tone: "teal",
          iconKey: "kg",
        },
        {
          value: String(progressShareLast7Days.workouts),
          label: "TRENINGSØKTER",
          sub: "Jeg har vært skikkelig på!",
          tone: "pink",
          iconKey: "workouts",
        },
        {
          value: String(groupCount),
          label: "GRUPPETIMER",
          sub: groupCount > 0 ? "Bygger fellesskap!" : "Bli med i en time!",
          tone: "teal",
          iconKey: "groups",
        },
        {
          value: Math.round(kcal).toLocaleString("nb-NO"),
          label: "KCAL FORBRUKT",
          sub: "Energi brukt på å bli sterkere",
          tone: "pink",
          iconKey: "kcal",
        },
        {
          value: formatActivityTime(minutes),
          label: "AKTIVITETSTID",
          sub: "Tid investert i meg selv",
          tone: "teal",
          iconKey: "time",
        },
      ];

      const tileGap = 16;
      const tilesAreaW = W - pad * 2;
      const tileW = (tilesAreaW - tileGap) / 2;
      const tileH = 158;
      const tilesStartX = pad;
      const tilesStartY = 760;

      function drawStatTile(tile: (typeof statTiles)[number], tx: number, ty: number, width: number) {
        const toneColor = tile.tone === "teal" ? "#30e3be" : "#f472b6";
        const toneGlow = tile.tone === "teal" ? "rgba(48, 227, 190, 0.18)" : "rgba(244, 114, 182, 0.18)";

        // Flis-bakgrunn
        context.fillStyle = "rgba(255, 255, 255, 0.06)";
        fillRoundRect(context, tx, ty, width, tileH, 18);
        context.strokeStyle = "rgba(255, 255, 255, 0.1)";
        context.lineWidth = 1;
        if (typeof context.roundRect === "function") {
          context.beginPath();
          context.roundRect(tx, ty, width, tileH, 18);
          context.stroke();
        } else {
          context.strokeRect(tx, ty, width, tileH);
        }

        // Ikon-sirkel
        const iconCx = tx + 32;
        const iconCy = ty + 36;
        context.fillStyle = toneGlow;
        context.beginPath();
        context.arc(iconCx, iconCy, 19, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = toneColor;
        context.lineWidth = 1.8;
        context.beginPath();
        context.arc(iconCx, iconCy, 19, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = toneColor;
        context.font = "700 20px system-ui, -apple-system, Segoe UI, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        const glyph =
          tile.iconKey === "kg"
            ? "≡"
            : tile.iconKey === "workouts"
              ? "↗"
              : tile.iconKey === "groups"
                ? "◯"
                : tile.iconKey === "kcal"
                  ? "✦"
                  : "⏱";
        context.fillText(glyph, iconCx, iconCy + 1);
        context.textAlign = "left";
        context.textBaseline = "alphabetic";

        // Verdi
        context.fillStyle = "#ffffff";
        context.font = "900 42px system-ui, -apple-system, Segoe UI, sans-serif";
        context.fillText(tile.value, tx + 20, ty + 96);

        // Label
        context.fillStyle = toneColor;
        context.font = "800 14px system-ui, -apple-system, Segoe UI, sans-serif";
        context.fillText(tile.label, tx + 20, ty + 122);

        // Subtekst
        context.fillStyle = "rgba(241, 245, 249, 0.6)";
        context.font = "500 13px system-ui, -apple-system, Segoe UI, sans-serif";
        fillWrappedCanvasText(context, tile.sub, tx + 20, ty + 144, width - 30, 16);
      }

      statTiles.forEach((tile, idx) => {
        if (idx < 4) {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const tx = tilesStartX + col * (tileW + tileGap);
          const ty = tilesStartY + row * (tileH + tileGap);
          drawStatTile(tile, tx, ty, tileW);
        } else {
          // Femte flis tar venstre kolonne på siste rad
          const ty = tilesStartY + 2 * (tileH + tileGap);
          drawStatTile(tile, tilesStartX, ty, tileW);
        }
      });

      // Bunn-stripe: UKENS SEIER
      context.fillStyle = "rgba(13, 17, 28, 0.92)";
      context.fillRect(0, footerY, W, footerH);
      context.strokeStyle = "rgba(255, 255, 255, 0.08)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, footerY);
      context.lineTo(W, footerY);
      context.stroke();

      // Pokal-sirkel
      const trophyCx = pad + 30;
      const trophyCy = footerY + footerH / 2;
      context.save();
      context.fillStyle = "rgba(48, 227, 190, 0.2)";
      context.beginPath();
      context.arc(trophyCx, trophyCy, 30, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(48, 227, 190, 0.7)";
      context.lineWidth = 1.8;
      context.stroke();
      context.fillStyle = "#30e3be";
      context.font = "900 30px system-ui, -apple-system, Segoe UI, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("\u2605", trophyCx, trophyCy + 1);
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.restore();

      // UKENS SEIER tekst
      const seierX = trophyCx + 50;
      context.fillStyle = "#30e3be";
      context.font = "800 15px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("UKENS SEIER", seierX, footerY + 44);
      context.fillStyle = "rgba(241, 245, 249, 0.95)";
      context.font = "600 22px system-ui, -apple-system, Segoe UI, sans-serif";
      // Reserver plass for MOTUS-logoen i bunn-høyre slik at lang seier-tekst ikke kolliderer
      const seierMaxWidth = W - seierX - 180;
      const seierText = progressShareSeierText;
      const seierFits = context.measureText(seierText).width <= seierMaxWidth;
      if (seierFits) {
        context.fillText(seierText, seierX, footerY + 80);
      } else {
        fillWrappedCanvasText(context, seierText, seierX, footerY + 72, seierMaxWidth, 24);
      }

      // MOTUS-logo i bunn-høyre
      if (shareCardLogo && shareCardLogo.naturalWidth > 0) {
        const lh = 38;
        const lw = (shareCardLogo.naturalWidth / shareCardLogo.naturalHeight) * lh;
        context.save();
        context.globalAlpha = 0.95;
        context.drawImage(shareCardLogo, W - lw - pad, footerY + (footerH - lh) / 2, lw, lh);
        context.restore();
      }

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) {
        setProgressShareStatus("Kunne ikke lage bilde akkurat nå.");
        return;
      }

      const file = new File([blob], "motus-skrytekort-siste-7-dager.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      const canShareFile = typeof nav.canShare === "function" ? nav.canShare({ files: [file] }) : false;
      if (typeof nav.share === "function" && canShareFile) {
        await nav.share({
          title: "Min Motus-oppsummering",
          text: "Siste 7 dager - se tallene mine #Motus",
          files: [file],
        });
        setProgressShareStatus("Kort delt.");
        return;
      }

      const imageUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = "motus-skrytekort-siste-7-dager.png";
      link.click();
      URL.revokeObjectURL(imageUrl);
      setProgressShareStatus("Bilde lastet ned. Del det fra galleriet.");
    } catch {
      setProgressShareStatus("Deling ble avbrutt.");
    }
  }

  async function dispatchMemberMessageToRelatedMembers(text: string): Promise<boolean> {
    if (isSendingMemberMessageRef.current) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    const nowMs = Date.now();
    const duplicateKey = `${(editableMember?.email ?? normalizedCurrentUserEmail).trim().toLowerCase()}|${trimmed.toLowerCase()}`;
    if (lastMemberSendKeyRef.current === duplicateKey && nowMs - lastMemberSendAtRef.current < 10000) {
      setMemberChatSendStatus("Meldingen ble allerede sendt nylig.");
      return false;
    }
    isSendingMemberMessageRef.current = true;
    setIsSendingMemberMessage(true);
    setMemberChatSendStatus("Sender...");
    try {
      const targetMemberIds = relatedMemberIds.length ? relatedMemberIds : activeMemberId ? [activeMemberId] : [];
      let validTargetMemberIds = Array.from(new Set(targetMemberIds)).filter(
        (memberId) => memberId && !memberId.startsWith("auth-") && memberId !== "__template__",
      );
      if (!validTargetMemberIds.length) {
        const anchorEmail = (editableMember?.email || normalizedCurrentUserEmail).trim().toLowerCase();
        if (anchorEmail) {
          validTargetMemberIds = Array.from(
            new Set(
              members
                .filter((member) => member.email.trim().toLowerCase() === anchorEmail)
                .map((member) => member.id)
                .filter((memberId) => memberId && !memberId.startsWith("auth-") && memberId !== "__template__")
            )
          );
        }
      }
      if (!validTargetMemberIds.length && supabaseClient) {
        const anchorEmail = (editableMember?.email || normalizedCurrentUserEmail).trim().toLowerCase();
        if (anchorEmail) {
          const { data: rows } = await supabaseClient.from("members").select("id").eq("email", anchorEmail);
          validTargetMemberIds = Array.from(
            new Set(
              (rows ?? [])
                .map((row) => String((row as { id?: string }).id ?? "").trim())
                .filter((memberId) => memberId && !memberId.startsWith("auth-") && memberId !== "__template__"),
            ),
          );
        }
      }
      if (!validTargetMemberIds.length) {
        setMemberChatSendStatus("Kunne ikke sende melding: ingen gyldig mottaker.");
        return false;
      }
      const primaryTargetId = String(validTargetMemberIds[0] ?? "").trim();
      if (!primaryTargetId) {
        setMemberChatSendStatus("Kunne ikke sende melding: ingen gyldig mottaker.");
        return false;
      }
      sendMemberMessage(primaryTargetId, trimmed);
      lastMemberSendKeyRef.current = duplicateKey;
      lastMemberSendAtRef.current = nowMs;
      setMemberChatSendStatus("Melding sendt.");
      return true;
    } finally {
      isSendingMemberMessageRef.current = false;
      setIsSendingMemberMessage(false);
    }
  }

  async function handleRequestPtChange() {
    const reason = ptChangeReason.trim();
    const message = [
      "Hei! Jeg ønsker å bytte PT.",
      reason ? `Kort forklaring: ${reason}` : "Kan dere hjelpe meg med å finne riktig løsning?",
      "Kan dere ta kontakt med meg om veien videre?",
    ].join("\n");
    setPtChangeRequestStatus(null);
    const sent = await dispatchMemberMessageToRelatedMembers(message);
    if (!sent) {
      setPtChangeRequestStatus("Kunne ikke sende forespørselen akkurat nå. Prøv igjen, eller send vanlig melding til PT.");
      return;
    }
    setPtChangeReason("");
    setPtChangeRequestStatus("Forespørselen er sendt til PT. Du finner den også under Meldinger.");
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

  const progressShareLast7Days = computeShareCardLast7DaysStats(completedLogs, nowTimestamp);
  const progressLiftPlayfulLine = buildProgressLiftPlayfulLine(progressShareLast7Days);
  const progressShareWeekLabel = buildWeeklyShareLabel(nowTimestamp);
  const progressShareTitle = pickWeeklyShareTitle(progressShareLast7Days);
  const progressShareSeierText = pickWeeklyShareSeier(progressShareLast7Days);
  const memberShareDisplayName = viewedMember?.name ?? editableMember?.name ?? "Medlem";
  const nextBestAction = useMemo(() => {
    if (!memberAssignedPrograms.length) {
      return {
        title: "Be om første program",
        description: "Du har ingen program fra trener ennå. Du kan likevel trene: legg din egen økt sammen under Trening, eller send melding til trener.",
        cta: "Åpne Trening",
        action: "programs" as const,
      };
    }
    if (!memberProgramsInActiveLibrary.length) {
      return {
        title: "Program er skjult eller arkivert",
        description: "Gjenopprett et program under Trening, eller start en egen økt.",
        cta: "Åpne Trening",
        action: "programs" as const,
      };
    }
    if (nextProgram) {
      return {
        title: "Neste økt er klar",
        description: "Start neste program når du er klar.",
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
  }, [memberAssignedPrograms.length, memberProgramsInActiveLibrary.length, nextProgram]);
  const homeFirstName = firstNameFromDisplayName(memberShareDisplayName);
  const homeMomentumPct = memberProgressScores.momentum.pct;
  const homeWorkoutProgram = useMemo(() => {
    if (homeWorkoutHydrationPending) return null;
    if (todayPlanAction.kind === "start-program") return todayPlanAction.program;
    if (todayPlanEntry.trim()) {
      return findProgramForPeriodPlanEntry(todayPlanEntry, memberPrograms) ?? null;
    }
    if (memberHasVisiblePeriodPlan) return null;
    if (nextProgram) return nextProgram;
    return null;
  }, [homeWorkoutHydrationPending, todayPlanAction, todayPlanEntry, memberPrograms, nextProgram, memberHasVisiblePeriodPlan]);
  const homePrimaryFocus = useMemo(() => {
    if (todayPlanEntry && homeWorkoutProgram?.title && todayPlanEntry !== homeWorkoutProgram.title) {
      return `${homeWorkoutProgram.title} · ${todayPlanEntry}`;
    }
    return todayPlanEntry || homeWorkoutProgram?.title || (memberHasVisiblePeriodPlan ? "Ingen plan i dag" : "Velg program når du er klar");
  }, [todayPlanEntry, homeWorkoutProgram, memberHasVisiblePeriodPlan]);
  const homeWorkoutDuration = useMemo(() => {
    if (!homeWorkoutProgram) return null;
    const minutes = Math.max(20, Math.round(estimateProgramMinutes(homeWorkoutProgram) / 5) * 5);
    return `${minutes} min`;
  }, [homeWorkoutProgram]);
  const homeWorkoutCoverSrc = useMemo(() => {
    if (todayPlanIsPassiveDay) {
      return resolveRestDayCoverImage();
    }
    if (todayPlanAction.kind === "log-group") {
      return resolveGroupWorkoutCoverImage(todayPlanAction.className);
    }
    if (!homeWorkoutProgram) return null;
    const coverExercise = homeWorkoutProgram.exercises
      .map((item) => exercises.find((exercise) => exercise.id === item.exerciseId))
      .find(Boolean);
    return resolveProgramImageSrc(homeWorkoutProgram, coverExercise ?? null, {
      subTab: getTrainingProgramSubTab(homeWorkoutProgram, exerciseCategoryById, exercises),
    });
  }, [homeWorkoutProgram, todayPlanAction, todayPlanIsPassiveDay, exercises, exerciseCategoryById]);
  const homeDisplayTitle = useMemo(() => {
    if (homeWorkoutHydrationPending) {
      return cachedHomeWorkout?.title ?? "";
    }
    return homePrimaryFocus;
  }, [homeWorkoutHydrationPending, cachedHomeWorkout, homePrimaryFocus]);
  const homeDisplayLoading = homeWorkoutHydrationPending && !cachedHomeWorkout?.title;
  const homeDisplayCoverSrc = useMemo(() => {
    if (homeWorkoutHydrationPending) {
      if (cachedHomeWorkout?.isPassiveDay) return resolveRestDayCoverImage();
      return cachedHomeWorkout?.imageSrc ?? null;
    }
    return homeWorkoutCoverSrc;
  }, [homeWorkoutHydrationPending, cachedHomeWorkout, homeWorkoutCoverSrc]);
  const homeWorkoutZoneLabel = useMemo(() => {
    if (todayPlanAction.kind === "log-group") {
      return extractZoneFromPlanEntry(todayPlanEntry) ?? "Gruppe";
    }
    if (homeWorkoutProgram) {
      return trainingProgramCategoryLabel(homeWorkoutProgram, exerciseCategoryById, exercises);
    }
    if (todayPlanEntry) {
      return extractZoneFromPlanEntry(todayPlanEntry);
    }
    return null;
  }, [homeWorkoutProgram, todayPlanEntry, todayPlanAction, exerciseCategoryById, exercises]);
  const homeWeekSessionsLabel = useMemo(
    () =>
      formatWeekSessionsLabel(
        homeWeeklySummary.completedThisWeek,
        homeWeeklySummary.plannedThisWeek,
        Number(profileSessionsPerWeekTarget) || undefined,
      ),
    [homeWeeklySummary.completedThisWeek, homeWeeklySummary.plannedThisWeek, profileSessionsPerWeekTarget],
  );
  const trainingWeeklyPoints = useMemo(
    () => computeDailyWeekProgress(completedLogDates, nowTimestamp),
    [completedLogDates, nowTimestamp],
  );
  const trainingWeeklyProgressPct = useMemo(
    () => computeWeeklyProgressPct(trainingWeeklyPoints, nowTimestamp),
    [trainingWeeklyPoints, nowTimestamp],
  );
  const trainingWeeklyDeltaLabel = useMemo(() => {
    const delta = computeWeeklyProgressDelta(completedLogDates, nowTimestamp);
    if (delta === null) return null;
    if (delta === 0) return "Samme nivå som forrige uke";
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta}% vs. forrige uke`;
  }, [completedLogDates, nowTimestamp]);
  const trainingPausedCards = useMemo(
    () =>
      pausedWorkouts.map((draft) => {
        const progress = pausedWorkoutProgress(draft.workoutMode);
        const program =
          memberPrograms.find((item) => item.id === draft.programId) ??
          memberPrograms.find((item) => item.title.trim().toLowerCase() === draft.programTitle.trim().toLowerCase()) ??
          null;
        const coverExercise = program?.exercises
          .map((item) => exercises.find((exercise) => exercise.id === item.exerciseId))
          .find(Boolean);
        const imageSrc = program
          ? resolveProgramImageSrc(program, coverExercise ?? null, {
              subTab: getTrainingProgramSubTab(program, exerciseCategoryById, exercises),
            })
          : null;
        const minutes = program ? Math.max(20, Math.round(estimateProgramMinutes(program) / 5) * 5) : 45;
        return {
          id: draft.id,
          title: draft.programTitle,
          imageSrc,
          durationLabel: `${minutes} min`,
          exerciseCountLabel: `${program?.exercises.length ?? progress.total} ${(program?.exercises.length ?? progress.total) === 1 ? "øvelse" : "øvelser"}`,
          progressPct: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
          onResume: () => resumePausedWorkout(draft.id, draft.memberId),
        };
      }),
    [pausedWorkouts, memberPrograms, exercises, exerciseCategoryById, resumePausedWorkout],
  );
  const trainingProgramPreviews = useMemo(
    () =>
      memberProgramsInActiveLibrary.slice(0, 8).map((program) => {
        const coverExercise = program.exercises
          .map((item) => exercises.find((exercise) => exercise.id === item.exerciseId))
          .find(Boolean);
        const programSubTab = getTrainingProgramSubTab(program, exerciseCategoryById, exercises);
        const imageSrc = resolveProgramImageSrc(program, coverExercise ?? null, { subTab: programSubTab });
        const completedProgramLogs = completedLogs.filter(
          (log) => log.programTitle.trim().toLowerCase() === program.title.trim().toLowerCase(),
        ).length;
        return {
          id: program.id,
          title: program.title,
          imageSrc,
          metaLabel: `${program.exercises.length} ${program.exercises.length === 1 ? "øvelse" : "øvelser"}`,
          completedCount: completedProgramLogs,
        };
      }),
    [memberProgramsInActiveLibrary, exercises, exerciseCategoryById, completedLogs],
  );
  const homeWeeklyMinutes = useMemo(() => {
    const today = getStartOfDay(new Date(nowTimestamp));
    const mondayOffset = (today.getDay() + 6) % 7;
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
    let total = 0;
    completedLogs.forEach((log) => {
      if (log.status !== "Fullført") return;
      const logDay = parseDateOnly(log.date);
      if (!logDay) return;
      const day = getStartOfDay(logDay);
      if (day.getTime() < weekStart.getTime() || day.getTime() >= weekEnd.getTime()) return;
      (log.results ?? []).forEach((result) => {
        if (!result.completed) return;
        const duration = Number(result.performedDurationMinutes) || 0;
        if (duration > 0) {
          total += duration;
          return;
        }
        const sets = Math.max(1, Number(result.plannedSets) || 1);
        total += sets * 2.5;
      });
    });
    return Math.round(total);
  }, [completedLogs, nowTimestamp]);
  const homeWeeklyMinutesTarget = useMemo(() => {
    const sessionTarget = Number(profileSessionsPerWeekTarget) || homeWeeklySummary.plannedThisWeek || 4;
    return Math.max(sessionTarget * 45, homeWeeklyMinutes, 60);
  }, [profileSessionsPerWeekTarget, homeWeeklySummary.plannedThisWeek, homeWeeklyMinutes]);
  const homeWeekMinutesLabel = useMemo(
    () => formatWeekMinutesLabel(homeWeeklyMinutes, homeWeeklyMinutesTarget),
    [homeWeeklyMinutes, homeWeeklyMinutesTarget],
  );
  const homeUnseenProgramCount = useMemo(
    () =>
      memberAssignedPrograms.filter(
        (program) => !(memberNotificationPrefs?.seenMemberProgramIds ?? []).includes(program.id),
      ).length,
    [memberAssignedPrograms, memberNotificationPrefs?.seenMemberProgramIds],
  );
  const homeTodayDateLabel = useMemo(
    () =>
      new Date(nowTimestamp).toLocaleDateString("no-NO", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [nowTimestamp],
  );
  const homeHeaderMotivation = useMemo(() => {
    const completed = homeWeeklySummary.completedThisWeek;
    const planned = homeWeeklySummary.plannedThisWeek;
    const progressPct = computeWeekProgressPct(
      completed,
      planned,
      Number(profileSessionsPerWeekTarget) || undefined,
    );
    if (completed >= 2 || progressPct >= 50) return "Sterk uke så langt!";
    if (completed > 0) return "God start på uka!";
    if (streakWeeks > 0) return `${streakWeeks} uke${streakWeeks === 1 ? "" : "r"} på rad — fortsett!`;
    return null;
  }, [
    homeWeeklySummary.completedThisWeek,
    homeWeeklySummary.plannedThisWeek,
    profileSessionsPerWeekTarget,
    streakWeeks,
  ]);
  const homeDashboardSubline = useMemo(() => {
    const nextBadge = memberBadgeCollection.allBadges
      .filter((badge) => !badge.secret && !badge.hidden && getBadgeNextLevel(badge))
      .sort((a, b) => b.progressPct - a.progressPct)[0];
    if (!nextBadge) return memberProgressScores.momentum.subline;
    const nextLevel = getBadgeNextLevel(nextBadge);
    if (!nextLevel) return memberProgressScores.momentum.subline;
    const remaining = Math.max(0, Math.ceil(nextLevel.target - nextBadge.current));
    const unit = formatBadgeMetricValue(nextBadge.id, remaining);
    if (remaining <= 0) return `Nesten i mål med badgen ${nextBadge.title}`;
    return `${unit} igjen til badgen ${nextBadge.title}`;
  }, [memberBadgeCollection.allBadges, memberProgressScores.momentum.subline]);
  const homeDashboardHeadline =
    homeWeeklySummary.completedThisWeek > 0 || streakWeeks > 0 ? "Du er på vei!" : "Klar for en ny uke";
  const homeWorkoutSubtitle = useMemo(() => {
    const goal = homeWorkoutProgram?.goal?.trim();
    if (goal) return goal;
    return null;
  }, [homeWorkoutProgram?.goal]);
  const homeDisplayDuration = homeWorkoutHydrationPending ? null : homeWorkoutDuration;
  const homeDisplayZoneLabel = homeWorkoutHydrationPending ? null : homeWorkoutZoneLabel;
  const homeDisplaySubtitle = homeWorkoutHydrationPending ? null : homeWorkoutSubtitle;

  useEffect(() => {
    if (homeWorkoutHydrationPending || !homePrimaryFocus.trim()) return;
    writeMemberHomeWorkoutSnapshot({
      dateKey: todayDateKey,
      title: homePrimaryFocus,
      imageSrc: homeWorkoutCoverSrc,
      isPassiveDay: todayPlanIsPassiveDay,
    });
  }, [homeWorkoutHydrationPending, homePrimaryFocus, homeWorkoutCoverSrc, todayPlanIsPassiveDay, todayDateKey]);

  const openHomeWorkoutDestination = useCallback(() => {
    setMemberTab("programs");
    setTrainingSection(todayPlanEntry ? "period" : "programs");
  }, [setMemberTab, todayPlanEntry]);
  const homeStatusCard = useMemo(() => {
    if (homeUnseenProgramCount > 0) {
      return {
        title: "Alt er ajour",
        detail: `${homeUnseenProgramCount} n${homeUnseenProgramCount === 1 ? "ytt" : "ye"} program${homeUnseenProgramCount === 1 ? "" : "mer"} tilgjengelig`,
        onClick: () => {
          const seenIds = memberAssignedPrograms.map((program) => program.id);
          persistMemberUiPrefs({
            seenMemberProgramIds: Array.from(
              new Set([...(memberNotificationPrefs?.seenMemberProgramIds ?? []), ...seenIds]),
            ),
          });
          setMemberTab("programs");
        },
      };
    }
    return null;
  }, [
    homeUnseenProgramCount,
    memberAssignedPrograms,
    memberNotificationPrefs?.seenMemberProgramIds,
    persistMemberUiPrefs,
  ]);
  const homePeriodPlanWeeklyDays = useMemo(() => {
    const plan = todayPeriodPlanMatch?.plan ?? activePeriodPlan;
    if (!plan) return null;
    const weekNumber =
      todayPeriodPlanMatch?.weekNumber ??
      (activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1);
    const week = resolvePeriodPlanWeek(plan, weekNumber);
    if (!week) return null;
    const swaps = getSwapsForWeek(periodPlanSwapsByPlan, plan.id, week.weekNumber);
    return applyPeriodPlanSwaps(week.days, swaps);
  }, [todayPeriodPlanMatch, activePeriodPlan, activePeriodWeekIndex, periodPlanSwapsByPlan]);
  let nextPlannedWorkout: { dayLabel: string; entry: string } | null = null;
  if (homePeriodPlanWeeklyDays && todayPlanDayKey) {
    const todayIndex = WEEKDAY_PLAN_ORDER.indexOf(todayPlanDayKey);
    for (let step = 1; step <= 7; step += 1) {
      const index = (todayIndex + step) % 7;
      const dayKey = WEEKDAY_PLAN_ORDER[index];
      const entry = homePeriodPlanWeeklyDays[dayKey]?.trim();
      if (!entry) continue;
      nextPlannedWorkout = { dayLabel: WEEKDAY_PLAN_LABELS[dayKey], entry };
      break;
    }
  }
  const customerStatusLabel = (() => {
    const isPtCustomer = viewedMember?.customerType === "PT-kunde";
    const isPremiumCustomer = viewedMember?.membershipType === "Premium";
    if (isPtCustomer && isPremiumCustomer) return "PT-kunde og Premium-kunde";
    if (isPtCustomer) return "PT-kunde";
    if (isPremiumCustomer) return "Premium-kunde";
    return viewedMember?.customerType || "Ikke satt";
  })();
  const activeWorkoutModeProgramId = workoutMode?.programId ?? "";

  useEffect(() => {
    if (!activeWorkoutModeProgramId) {
      setLiveWorkoutCelebration(null);
      setSyncedWorkoutExerciseIndex(0);
      return;
    }
    setLiveWorkoutCelebration(null);
    setSyncedWorkoutExerciseIndex(0);
  }, [activeWorkoutModeProgramId]);

  useEffect(() => {
    setSelectedCalendarLogId(null);
  }, [selectedCalendarDateKey]);

  function getReflectionEmoji(level: 1 | 2 | 3 | 4 | 5): string {
    if (level <= 1) return "🥳";
    if (level === 2) return "🙂";
    if (level === 3) return "😌";
    if (level === 4) return "😮‍💨";
    return "🥵";
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
    if (!groupWorkoutDateIso.trim()) {
      setGroupWorkoutStatus("Velg en gyldig dato for gruppetime.");
      return;
    }
    const trimmedClassName = groupWorkoutClassName.trim();
    logGroupWorkout({
      memberId: activeMemberId,
      className: trimmedClassName,
      note: groupWorkoutNote.trim(),
      reflection: buildGroupWorkoutReflection(),
      date: groupWorkoutDateIso,
    });
    const completedAt = parseStoredLogDate(groupWorkoutDateIso) ?? new Date();
    applyPeriodPlanAutoComplete({
      programTitle: groupWorkoutLogTitle(trimmedClassName),
      completedAt,
    });
    setGroupWorkoutStatus("Gruppetime lagret. PT kan nå se denne økta.");
    setGroupWorkoutEnergyLevel(3);
    setGroupWorkoutDifficultyLevel(3);
    setGroupWorkoutMotivationLevel(3);
    setGroupWorkoutNote("");
    setGroupWorkoutDateIso(toIsoDateInputValue(new Date()));
  }

  function resolvePeriodPlanEntryDate(plan: PeriodSchedulePlan, weekNumber: number, day: WeekdayPlanKey): string | null {
    const plannedDate = resolvePeriodPlanPlannedDate(plan, weekNumber, day);
    if (!plannedDate) return null;
    return formatDateDdMmYyyy(plannedDate);
  }

  function resolveWorkoutProgramTitle(programId: string, fallbackTitle?: string): string {
    const trimmedFallback = fallbackTitle?.trim() ?? "";
    if (trimmedFallback) return trimmedFallback;
    return (
      memberProgramsForPeriodPlan.find((item) => item.id === programId)?.title ??
      memberProgramsInActiveLibrary.find((item) => item.id === programId)?.title ??
      programs.find((item) => item.id === programId)?.title ??
      ""
    );
  }

  function bumpPeriodPlanLocalUpdatedAt() {
    periodPlanCompletionLocalUpdatedAtRef.current = Date.now();
  }

  function applyPeriodPlanAutoComplete(input: { programId?: string; programTitle: string; completedAt: Date }) {
    if (!activeMemberId || !input.programTitle.trim()) return;

    const targets = findPeriodPlanAutoCompleteTargets({
      plans: visiblePeriodPlans,
      swapsByPlan: periodPlanSwapsByPlan,
      programTitle: input.programTitle,
      programId: input.programId,
      programs: memberProgramsForPeriodPlan,
      completedAt: input.completedAt,
      calendarWeekdayKey: weekdayKeyForDate(input.completedAt),
    });
    if (
      todayPeriodPlanMatch &&
      todayPlanEntry.trim() &&
      getStartOfDay(input.completedAt).getTime() === getStartOfDay(nowDate).getTime() &&
      periodPlanEntryMatchesCompletedProgram(
        todayPlanEntry,
        input.programTitle,
        memberProgramsForPeriodPlan,
        input.programId,
      )
    ) {
      targets.unshift({
        planId: todayPeriodPlanMatch.plan.id,
        weekNumber: todayPeriodPlanMatch.weekNumber,
        day: todayPeriodPlanMatch.day,
      });
    }
    if (!targets.length) return;

    bumpPeriodPlanLocalUpdatedAt();
    periodPlanCompletedDirtyRef.current = true;
    periodPlanDismissedDirtyRef.current = true;
    const targetKeys = targets.map((target) => buildPeriodPlanEntryKey(target.planId, target.weekNumber, target.day));
    dismissedPeriodPlanEntryKeysRef.current = dismissedPeriodPlanEntryKeysRef.current.filter((key) => !targetKeys.includes(key));
    setDismissedPeriodPlanEntryKeys((prev) => {
      const next = prev.filter((key) => !targetKeys.includes(key));
      return next.length === prev.length ? prev : next;
    });
    completedPeriodPlanEntryKeysRef.current = Array.from(new Set([...completedPeriodPlanEntryKeysRef.current, ...targetKeys]));
    setCompletedPeriodPlanEntryKeys((prev) => {
      const next = [...prev];
      let changed = false;
      for (const target of targets) {
        const key = buildPeriodPlanEntryKey(target.planId, target.weekNumber, target.day);
        if (!next.includes(key)) {
          next.push(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function handleFinishWorkoutMode(input?: { reflection?: WorkoutReflection }) {
    const snapshot = workoutMode;
    const periodPlanContext = pendingPeriodPlanWorkoutStartRef.current;
    pendingPeriodPlanWorkoutStartRef.current = null;
    finishWorkoutMode(input);
    if (!snapshot?.programId) return;
    markPeriodPlanContextCompleted(periodPlanContext);
    applyPeriodPlanAutoComplete({
      programId: snapshot.programId,
      programTitle: resolveWorkoutProgramTitle(snapshot.programId, snapshot.programTitle),
      completedAt: new Date(),
    });
  }

  function handleLogIntervalWorkout(input: LogIntervalWorkoutInput) {
    const periodPlanContext = pendingPeriodPlanWorkoutStartRef.current;
    pendingPeriodPlanWorkoutStartRef.current = null;
    logIntervalWorkout(input);
    markPeriodPlanContextCompleted(periodPlanContext);
    applyPeriodPlanAutoComplete({
      programId: input.programId,
      programTitle: input.programTitle?.trim() || resolveWorkoutProgramTitle(input.programId),
      completedAt: new Date(),
    });
  }

  function handleCancelWorkoutMode() {
    pendingPeriodPlanWorkoutStartRef.current = null;
    cancelWorkoutMode();
  }

  function handleDismissWorkoutMode() {
    pendingPeriodPlanWorkoutStartRef.current = null;
    dismissWorkoutMode();
    setPausedWorkoutsTick((value) => value + 1);
  }

  function resolvePeriodPlanTargetMemberIds(): string[] {
    return relatedMemberIds.length > 0 ? relatedMemberIds : [primaryMemberIdForPeriodPlans].filter(Boolean);
  }

  function hideTrainerPeriodPlan(planId: string) {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    const nextHidden = Array.from(new Set([...hiddenPeriodPlanIds, planId]));
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, nextHidden);
    setPeriodPlanStorageRevision((value) => value + 1);
    setShowPeriodPlanManageSection(true);
    setShowPeriodPlanHiddenSection(true);
    setShowPeriodPlanPanel(true);
    if (activePeriodPlan?.id === planId) {
      const nextActive = visiblePeriodPlans.find((plan) => plan.id !== planId)?.id ?? null;
      if (nextActive) selectActiveMemberPeriodPlan(nextActive);
      else {
        setActiveMemberPeriodPlanId(null);
        writeActivePeriodPlanIdForMembers(targetMemberIds, null);
      }
    }
    setPeriodPlanActionStatus("Planen er skjult fra oversikten. Den er ikke slettet — hent den tilbake under «Skjulte planer» nedenfor.");
  }

  function unhideTrainerPeriodPlan(planId: string) {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    const nextHidden = hiddenPeriodPlanIds.filter((id) => id !== planId);
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, nextHidden);
    setPeriodPlanStorageRevision((value) => value + 1);
    selectActiveMemberPeriodPlan(planId);
    setShowPeriodPlanPanel(true);
    setShowPeriodPlanManageSection(true);
    setPeriodPlanActionStatus("Periodeplanen er tilbake i oversikten.");
  }

  function unhideAllTrainerPeriodPlans() {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, []);
    setPeriodPlanStorageRevision((value) => value + 1);
    const firstPlan = visiblePeriodPlans[0] ?? periodPlans[0];
    if (firstPlan) selectActiveMemberPeriodPlan(firstPlan.id);
    setShowPeriodPlanPanel(true);
    setShowPeriodPlanManageSection(true);
    setShowPeriodPlanHiddenSection(false);
    setPeriodPlanActionStatus("Alle periodeplaner er synlige igjen.");
  }

  function deleteMemberOwnedPeriodPlan(plan: PeriodSchedulePlan) {
    if (!isMemberOwnedPeriodPlan(plan, trainerPeriodPlanIds)) return;
    removeMemberOwnedPeriodPlanFromStorage(relatedMemberIds, plan.id);
    setPeriodPlanStorageRevision((value) => value + 1);
    if (activePeriodPlan?.id === plan.id) {
      const nextActive = visiblePeriodPlans.find((item) => item.id !== plan.id)?.id ?? null;
      if (nextActive) selectActiveMemberPeriodPlan(nextActive);
      else {
        setActiveMemberPeriodPlanId(null);
        writeActivePeriodPlanIdForMembers(relatedMemberIds, null);
      }
    }
    setPeriodPlanActionStatus("Periodeplanen er slettet.");
  }

  function isPeriodPlanEntryCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey): boolean {
    const plan = visiblePeriodPlans.find((item) => item.id === planId);
    const week = plan ? resolvePeriodPlanWeek(plan, weekNumber) : null;
    if (!plan || !week) {
      return completedPeriodPlanEntryKeys.includes(buildPeriodPlanEntryKey(planId, weekNumber, day));
    }
    const swaps = getSwapsForWeek(periodPlanSwapsByPlan, planId, weekNumber);
    const entry = applyPeriodPlanSwaps(week.days, swaps)[day]?.trim() ?? "";
    if (!entry) {
      return completedPeriodPlanEntryKeys.includes(buildPeriodPlanEntryKey(planId, weekNumber, day));
    }
    const plannedDate = resolvePeriodPlanPlannedDate(plan, weekNumber, day);
    if (plannedDate && getStartOfDay(plannedDate).getTime() > getStartOfDay(nowDate).getTime()) {
      return false;
    }
    const logsForDate = plannedDate
      ? calendarLogsByDateKey.get(toCalendarDateKey(plannedDate)) ?? []
      : day === currentWeekdayKey
        ? calendarLogsByDateKey.get(toCalendarDateKey(nowDate)) ?? []
      : [];
    const entryAction = resolvePeriodPlanEntryAction(entry, memberProgramsForPeriodPlan);
    if (
      entryAction.kind === "start-program" &&
      logsForDate.some((log) => completedLogMatchesProgramForPeriodEntry(log, entryAction.program, entry))
    ) {
      return true;
    }
    return isPeriodPlanDayComplete({
      planId,
      weekNumber,
      day,
      entry,
      completedKeys: completedPeriodPlanEntryKeys,
      dismissedKeys: dismissedPeriodPlanEntryKeys,
      programs: memberProgramsForPeriodPlan,
      logsForDate,
    });
  }

  function dismissPeriodPlanDay(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    bumpPeriodPlanLocalUpdatedAt();
    periodPlanDismissedDirtyRef.current = true;
    dismissedPeriodPlanEntryKeysRef.current = dismissedPeriodPlanEntryKeysRef.current.includes(key)
      ? dismissedPeriodPlanEntryKeysRef.current
      : [...dismissedPeriodPlanEntryKeysRef.current, key];
    setDismissedPeriodPlanEntryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function clearPeriodPlanDayDismissed(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    bumpPeriodPlanLocalUpdatedAt();
    periodPlanDismissedDirtyRef.current = true;
    dismissedPeriodPlanEntryKeysRef.current = dismissedPeriodPlanEntryKeysRef.current.filter((item) => item !== key);
    setDismissedPeriodPlanEntryKeys((prev) => prev.filter((item) => item !== key));
  }

  function swapPeriodPlanDays(planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    if (dayA === dayB) return;
    periodPlanSwapsDirtyRef.current = true;
    setPeriodPlanSwapsByPlan((prev) => {
      const plan = visiblePeriodPlans.find((item) => item.id === planId);
      const week = plan ? resolvePeriodPlanWeek(plan, weekNumber) : null;
      const current = getSwapsForWeek(prev, planId, weekNumber);
      const currentDays = week ? applyPeriodPlanSwaps(week.days, current) : null;
      const nextDays = currentDays ? { ...currentDays } : null;
      if (nextDays) {
        const valueA = nextDays[dayA];
        nextDays[dayA] = nextDays[dayB];
        nextDays[dayB] = valueA;
      }
      const nextSwaps = week && nextDays
        ? buildPeriodPlanWeekOverride(week.days, nextDays, dayA, dayB)
        : togglePeriodPlanSwap(current, dayA, dayB);
      const reverted = nextSwaps.length === 0;
      setPeriodPlanActionStatus(
        reverted
          ? `Bytte mellom ${WEEKDAY_PLAN_LABELS[dayA]} og ${WEEKDAY_PLAN_LABELS[dayB]} er angret.`
          : `Byttet plan for ${WEEKDAY_PLAN_LABELS[dayA]} og ${WEEKDAY_PLAN_LABELS[dayB]}.`,
      );
      return setSwapsForWeek(prev, planId, weekNumber, nextSwaps);
    });
  }

  function movePeriodPlanDay(planId: string, weekNumber: number, dayA: WeekdayPlanKey, dayB: WeekdayPlanKey) {
    if (dayA === dayB) return;
    periodPlanSwapsDirtyRef.current = true;
    setPeriodPlanSwapsByPlan((prev) => {
      const plan = visiblePeriodPlans.find((item) => item.id === planId);
      const week = plan ? resolvePeriodPlanWeek(plan, weekNumber) : null;
      const current = getSwapsForWeek(prev, planId, weekNumber);
      const currentDays = week ? applyPeriodPlanSwaps(week.days, current) : null;
      const nextDays = currentDays ? { ...currentDays, [dayB]: currentDays[dayA] ?? "", [dayA]: "" } : null;
      const nextSwaps = week && nextDays
        ? buildPeriodPlanWeekOverride(week.days, nextDays, dayA, dayB)
        : togglePeriodPlanMove(current, dayA, dayB);
      const reverted = nextSwaps.length === 0;
      setPeriodPlanActionStatus(
        reverted
          ? `Flytting fra ${WEEKDAY_PLAN_LABELS[dayA]} til ${WEEKDAY_PLAN_LABELS[dayB]} er angret.`
          : `Flyttet plan fra ${WEEKDAY_PLAN_LABELS[dayA]} til ${WEEKDAY_PLAN_LABELS[dayB]}.`,
      );
      return setSwapsForWeek(prev, planId, weekNumber, nextSwaps);
    });
  }

  function resetPeriodPlanSwapsForWeek(planId: string, weekNumber: number) {
    periodPlanSwapsDirtyRef.current = true;
    setPeriodPlanSwapsByPlan((prev) => setSwapsForWeek(prev, planId, weekNumber, []));
    setPeriodPlanActionStatus("Uken er tilbakestilt til original periodeplan.");
  }

  const defaultPeriodPlanReflection = {
    energyLevel: 3 as const,
    difficultyLevel: 3 as const,
    motivationLevel: 3 as const,
    note: "Hurtiglogget fra periodeplan.",
  };

  function markPeriodPlanDayCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    bumpPeriodPlanLocalUpdatedAt();
    periodPlanCompletedDirtyRef.current = true;
    completedPeriodPlanEntryKeysRef.current = completedPeriodPlanEntryKeysRef.current.includes(key)
      ? completedPeriodPlanEntryKeysRef.current
      : [...completedPeriodPlanEntryKeysRef.current, key];
    setCompletedPeriodPlanEntryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function markPeriodPlanContextCompleted(context: PeriodPlanWorkoutStartContext | null) {
    if (!context) return;
    clearPeriodPlanDayDismissed(context.planId, context.weekNumber, context.day);
    markPeriodPlanDayCompleted(context.planId, context.weekNumber, context.day);
  }

  function resolvePeriodPlanContextForProgram(program: TrainingProgram): PeriodPlanWorkoutStartContext | null {
    if (todayPeriodPlanMatch && todayPlanEntry.trim()) {
      const matchesToday = periodPlanEntryMatchesCompletedProgram(
        todayPlanEntry,
        program.title,
        memberProgramsForPeriodPlan,
        program.id,
      );
      if (matchesToday) {
        return {
          planId: todayPeriodPlanMatch.plan.id,
          weekNumber: todayPeriodPlanMatch.weekNumber,
          day: todayPeriodPlanMatch.day,
          entry: todayPlanEntry,
        };
      }
    }

    const targets = findPeriodPlanAutoCompleteTargets({
      plans: visiblePeriodPlans,
      swapsByPlan: periodPlanSwapsByPlan,
      programTitle: program.title,
      programId: program.id,
      programs: memberProgramsForPeriodPlan,
      completedAt: getStartOfDay(new Date(nowTimestamp)),
      calendarWeekdayKey: currentWeekdayKey,
    });
    const target = targets[0];
    if (!target) return null;
    const plan = visiblePeriodPlans.find((item) => item.id === target.planId);
    const week = plan ? resolvePeriodPlanWeek(plan, target.weekNumber) : null;
    if (!plan || !week) return null;
    const swaps = getSwapsForWeek(periodPlanSwapsByPlan, plan.id, week.weekNumber);
    const entry = applyPeriodPlanSwaps(week.days, swaps)[target.day]?.trim() ?? "";
    return {
      planId: target.planId,
      weekNumber: target.weekNumber,
      day: target.day,
      entry,
    };
  }

  function startMemberProgram(program: TrainingProgram, context?: PeriodPlanWorkoutStartContext | null) {
    pendingPeriodPlanWorkoutStartRef.current = context ?? resolvePeriodPlanContextForProgram(program);
    if (intervalProgramIdSet.has(program.id)) {
      openIntervalTimerModal(program.id);
      return;
    }
    startWorkoutMode(program.id, buildStartWorkoutOptions(program));
  }

  function unmarkPeriodPlanDayCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    bumpPeriodPlanLocalUpdatedAt();
    periodPlanCompletedDirtyRef.current = true;
    completedPeriodPlanEntryKeysRef.current = completedPeriodPlanEntryKeysRef.current.filter((item) => item !== key);
    setCompletedPeriodPlanEntryKeys((prev) => prev.filter((item) => item !== key));
  }

  function handlePeriodPlanStartProgram(programId: string, context?: PeriodPlanWorkoutStartContext) {
    const program =
      memberProgramsForPeriodPlan.find((item) => item.id === programId) ??
      memberProgramsInActiveLibrary.find((item) => item.id === programId);
    if (!program) return;
    setMemberTab("programs");
    startMemberProgram(program, context ?? null);
  }

  function handlePeriodPlanLogGroup(input: {
    entry: string;
    plannedDate: string | null;
    planId: string;
    weekNumber: number;
    day: WeekdayPlanKey;
  }) {
    if (!activeMemberId) return;
    const trimmed = input.entry.trim();
    if (!trimmed) return;
    if (isPeriodPlanEntryDateInFuture(input.plannedDate)) {
      setPeriodPlanActionStatus("Du kan ikke logge gruppetimer fra periodeplanen før selve dagen.");
      return;
    }
    if (isPeriodPlanEntryCompleted(input.planId, input.weekNumber, input.day)) {
      setPeriodPlanActionStatus("Denne økten er allerede logget.");
      return;
    }
    logGroupWorkout({
      memberId: activeMemberId,
      className: resolveGroupClassNameFromPeriodEntry(trimmed),
      note: "Logget fra periodeplan.",
      reflection: defaultPeriodPlanReflection,
      keepCurrentTab: true,
      date: input.plannedDate ?? undefined,
    });
    const completedAt = parseStoredLogDate(input.plannedDate ?? "") ?? new Date();
    clearPeriodPlanDayDismissed(input.planId, input.weekNumber, input.day);
    markPeriodPlanDayCompleted(input.planId, input.weekNumber, input.day);
    applyPeriodPlanAutoComplete({
      programTitle: groupWorkoutLogTitle(resolveGroupClassNameFromPeriodEntry(trimmed)),
      completedAt,
    });
    setPeriodPlanActionStatus(`«${trimmed}» er logget.`);
  }

  function resolvePeriodPlanLogTitle(entry: string): string {
    const trimmed = entry.trim();
    if (isGroupPeriodPlanEntry(trimmed)) {
      return groupWorkoutLogTitle(resolveGroupClassNameFromPeriodEntry(trimmed));
    }
    const program = findProgramForPeriodPlanEntry(trimmed, memberProgramsForPeriodPlan);
    return program?.title ?? trimmed;
  }

  function resolvePeriodPlanStoredDate(plannedDate?: string | null): string {
    return resolveWorkoutLogDateTime(plannedDate ?? "");
  }

  function togglePeriodPlanEntryCompleted(input: { planId: string; weekNumber: number; day: WeekdayPlanKey; entry: string; plannedDate?: string | null }) {
    const trimmed = input.entry.trim();
    if (!trimmed || !activeMemberId) return;

    const storedDate = resolvePeriodPlanStoredDate(input.plannedDate);
    const logTitle = resolvePeriodPlanLogTitle(trimmed);
    const linkedProgram = findProgramForPeriodPlanEntry(trimmed, memberProgramsForPeriodPlan);
    const isCompleted = isPeriodPlanEntryCompleted(input.planId, input.weekNumber, input.day);

    if (!isCompleted) {
      if (isPeriodPlanEntryDateInFuture(input.plannedDate)) {
        setPeriodPlanActionStatus("Du kan bare markere økter med dato i dag eller tidligere.");
        return;
      }
      clearPeriodPlanDayDismissed(input.planId, input.weekNumber, input.day);
      if (isGroupPeriodPlanEntry(trimmed)) {
        logGroupWorkout({
          memberId: activeMemberId,
          className: resolveGroupClassNameFromPeriodEntry(trimmed),
          note: "Registrert som gjennomført fra periodeplan.",
          reflection: defaultPeriodPlanReflection,
          keepCurrentTab: true,
          date: storedDate,
        });
      } else {
        logCompletedPlanEntry({
          memberId: activeMemberId,
          programTitle: logTitle,
          note: "Registrert som gjennomført fra periodeplan.",
          reflection: defaultPeriodPlanReflection,
          keepCurrentTab: true,
          date: storedDate,
        });
      }
      markPeriodPlanDayCompleted(input.planId, input.weekNumber, input.day);
      setPeriodPlanActionStatus(`Registrert «${trimmed}» som gjennomført.`);
      return;
    }

    const matchingLogs = memberLogs.filter(
      (log) =>
        log.memberId === activeMemberId &&
        log.status === "Fullført" &&
        storedLogDatesMatch(log.date, storedDate) &&
        periodPlanEntryMatchesCompletedProgram(trimmed, log.programTitle, memberProgramsForPeriodPlan, linkedProgram?.id),
    );

    if (isGroupPeriodPlanEntry(trimmed)) {
      removeGroupWorkoutLog({
        memberId: activeMemberId,
        className: resolveGroupClassNameFromPeriodEntry(trimmed),
        date: storedDate,
      });
    } else {
      for (const log of matchingLogs) {
      removeCompletedPlanEntryLog({
        memberId: activeMemberId,
          programTitle: log.programTitle,
        date: storedDate,
      });
    }
    }

    if (matchingLogs.some((log) => log.id === expandedRecentLogId)) {
      setExpandedRecentLogId(null);
    }

    unmarkPeriodPlanDayCompleted(input.planId, input.weekNumber, input.day);
    dismissPeriodPlanDay(input.planId, input.weekNumber, input.day);
    setPeriodPlanActionStatus(`Fjernet markering for «${trimmed}».`);
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
        if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) return;
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
      if (row.exerciseCategory && isHoldBasedExerciseCategory(row.exerciseCategory)) return;
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

  function handleDeleteLoggedExercise(logId: string, exerciseId: string) {
    setConfirmDialog({
      title: "Slette øvelse fra logg",
      message: "Slette denne øvelsen fra treningsloggen?",
      confirmLabel: "Slett øvelse",
      tone: "danger",
      onConfirm: () => {
        const log = completedLogs.find((item) => item.id === logId);
        if (log) {
          setLastDeletedLogResult({ logId, results: log.results ?? [] });
        }
        removeWorkoutLogResult({ logId, exerciseId });
      },
    });
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

  function escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolvePrintAssetUrl(assetUrl: unknown): string {
    const trimmed = printField(assetUrl);
    if (!trimmed || typeof window === "undefined") return trimmed;
    if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
    try {
      return new URL(trimmed, window.location.href).href;
    } catch {
      return trimmed;
    }
  }

  function handlePrintProgram(program: TrainingProgram) {
    if (typeof window === "undefined") return;
    try {
    const printLogoUrl = resolvePrintAssetUrl(motusLogo);
    const recipientName = printField(viewedMember?.name || editableMember?.name || "Kunde") || "Kunde";
    const trainerLabel = pickFirstName(program.assignedTrainerName) || pickFirstName(MOTUS.name) || "Trener";
    const safeExercises = Array.isArray(program.exercises) ? program.exercises : [];
    const exercisesHtml =
      safeExercises.length > 0
        ? safeExercises
            .map((exercise, index) => {
              const safeExercise =
                exercise && typeof exercise === "object"
                  ? (exercise as Partial<ProgramExercise>)
                  : ({} as Partial<ProgramExercise>);
              const exerciseName = printField(safeExercise.exerciseName) || "Øvelse";
              const exerciseId = printField(safeExercise.exerciseId);
              const libraryMatch =
                exercises.find((item) => item.id === exerciseId) ??
                exercises.find((item) => printField(item.name).toLowerCase() === exerciseName.toLowerCase()) ??
                null;
              const setCount = printField(safeExercise.sets) || "-";
              const reps = printField(safeExercise.reps) || "-";
              const weight = printField(safeExercise.weight) || "-";
              const durationMinutes = printField(safeExercise.durationMinutes);
              const cardioHoldSeconds = printField(safeExercise.holdSeconds);
              const speed = printField(safeExercise.speed);
              const incline = printField(safeExercise.incline);
              const restSeconds = printField(safeExercise.restSeconds) || "0";
              const notes = printField(safeExercise.notes);
              const isCardioExercise = libraryMatch?.category === "Kondisjon" || Boolean(durationMinutes);
              const cardioTimeParts: string[] = [];
              if (durationMinutes) cardioTimeParts.push(`${durationMinutes} min`);
              if (isCardioExercise && cardioHoldSeconds) cardioTimeParts.push(`${cardioHoldSeconds} sek`);
              const cardioTimeLabel = cardioTimeParts.length ? cardioTimeParts.join(" ") : "—";
              const prescription = isCardioExercise
                ? `${setCount} runder × ${cardioTimeLabel}${
                    speed ? ` · ${speed} km/t` : ""
                  }${incline ? ` · ${incline}% incline` : ""} · ${restSeconds}s pause${cardioHrPrescriptionSuffixForMember(safeExercise as ProgramExercise)}`
                : libraryMatch && isHoldBasedExerciseCategory(libraryMatch.category)
                  ? `${setCount} sett × ${programExerciseHoldSeconds(safeExercise, libraryMatch.category) || "-"} sek · ${restSeconds}s pause`
                  : `${setCount} x ${reps} · ${weight} kg · ${restSeconds}s pause`;
              const rawImageUrl = printField(libraryMatch?.imageUrl);
              const imageUrl = rawImageUrl ? resolvePrintAssetUrl(rawImageUrl) : "";
              const description = printField(libraryMatch?.description) || "Ingen forklaring tilgjengelig for denne øvelsen.";
              return `<article class="exercise-card">
  <div class="exercise-image-wrap">
    ${
      imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(exerciseName)}" class="exercise-image" />`
        : `<div class="exercise-image-placeholder">Ingen bilde</div>`
    }
  </div>
  <div class="exercise-body">
    <div class="exercise-title">${index + 1}. ${escapeHtml(exerciseName)}</div>
    <div class="exercise-prescription">${escapeHtml(prescription)}</div>
    <div class="exercise-description">${escapeHtml(description)}</div>
    ${notes ? `<div class="exercise-notes">Coach-notat: ${escapeHtml(notes)}</div>` : ""}
  </div>
</article>`;
            })
            .join("")
        : `<div class="empty-state">Ingen øvelser i programmet.</div>`;
    const html = `<!doctype html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(program.title)} - Utskrift</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
    .page { padding: 10px; max-width: 940px; margin: 0 auto; }
    .header-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-radius: 10px; padding: 8px 10px; background: #30E3BE; color: #fff; }
    .header-main { min-width: 0; padding-top: 1px; }
    .brand-logo-frame { display: inline-flex; align-items: center; flex-shrink: 0; padding: 0; background: transparent; box-shadow: none; }
    .brand-logo { height: 56px; width: auto; max-width: 208px; object-fit: contain; display: block; }
    h1 { margin: 0 0 3px; font-size: 22px; line-height: 1.08; }
    .meta { color: rgba(255,255,255,0.9); font-size: 12px; }
    .meta-line { color: rgba(255,255,255,0.95); font-size: 12px; margin-top: 1px; }
    .notes-card { margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 8px; }
    .notes-title { font-weight: 700; margin-bottom: 4px; }
    .section-title { margin: 8px 0 5px; font-size: 14px; font-weight: 700; color: #334155; }
    .exercise-card { display: grid; grid-template-columns: 96px 1fr; gap: 7px; border: 1px solid #dbeafe; border-radius: 7px; background: #fff; padding: 4px 5px; margin-bottom: 5px; break-inside: avoid; }
    .exercise-image-wrap { width: 88px; aspect-ratio: 1 / 1; border-radius: 7px; overflow: hidden; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .exercise-image { width: 100%; height: 100%; object-fit: cover; display: block; }
    .exercise-image-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 12px; }
    .exercise-title { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
    .exercise-prescription { font-size: 12px; color: #30E3BE; margin-bottom: 3px; }
    .exercise-description { font-size: 11px; color: #475569; line-height: 1.24; }
    .exercise-notes { margin-top: 3px; font-size: 11px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 5px; padding: 3px 4px; }
    .empty-state { border: 1px dashed #cbd5e1; border-radius: 10px; background: #fff; padding: 10px; color: #64748b; }
    .footer { margin-top: 10px; color: #64748b; font-size: 10px; text-align: right; }
    @media print { body { margin: 9mm; } }
    @media print {
      body { background: #fff; }
      .page { padding: 0; }
      .exercise-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header-card">
      <div class="header-main">
        <h1>${escapeHtml(program.title)}</h1>
        <div class="meta">Mål: ${escapeHtml(program.goal || "Ikke satt")} · Opprettet: ${escapeHtml(program.createdAt || "-")}</div>
        <div class="meta-line">Av: ${escapeHtml(trainerLabel)} · Til: ${escapeHtml(recipientName)}</div>
      </div>
      <div>
        <div class="brand-logo-frame"><img src="${escapeHtml(printLogoUrl)}" alt="Motus logo" class="brand-logo" /></div>
      </div>
    </div>
    ${
      program.notes
        ? `<div class="notes-card"><div class="notes-title">Notater</div>${escapeHtml(program.notes)}</div>`
        : ""
    }
    <div class="section-title">Øvelser</div>
    ${exercisesHtml}
    <div class="footer">Generert fra Motus medlemsportal.</div>
  </div>
  <script>
    (function () {
      var hasPrinted = false;
      function doPrintOnce() {
        if (hasPrinted) return;
        hasPrinted = true;
        window.focus();
        window.print();
      }
      function waitForImagesThenPrint() {
        var images = Array.prototype.slice.call(document.images || []);
        if (!images.length) {
          doPrintOnce();
          return;
        }
        var loaded = 0;
        function markLoaded() {
          loaded += 1;
          if (loaded >= images.length) doPrintOnce();
        }
        images.forEach(function (img) {
          if (img.complete) {
            markLoaded();
            return;
          }
          img.addEventListener("load", markLoaded, { once: true });
          img.addEventListener("error", markLoaded, { once: true });
        });
        // Safety timeout so print is never blocked by slow image hosts.
        window.setTimeout(doPrintOnce, 2000);
      }
      if (document.readyState === "complete") {
        waitForImagesThenPrint();
      } else {
        window.addEventListener("load", waitForImagesThenPrint, { once: true });
      }
    })();
  </script>
</body>
</html>`;
      const printResult = printHtmlDocument(html);
      if (!printResult.ok) {
        setConfirmDialog({
          title: printResult.reason === "popup_blocked" ? "Popup blokkert" : "Utskrift feilet",
          message: printResult.message,
          confirmLabel: "OK",
          showCancel: false,
          tone: "default",
          onConfirm: () => setConfirmDialog(null),
        });
      }
    } catch (unexpectedError) {
      console.error("Member print failed before rendering.", unexpectedError);
      const detail = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
      setConfirmDialog({
        title: "Utskrift feilet",
        message: `Kunne ikke generere utskrift (${detail}). Prøv igjen.`,
        confirmLabel: "OK",
        showCancel: false,
        tone: "default",
        onConfirm: () => setConfirmDialog(null),
      });
    }
  }

  const memberHomeCalendarPanel = (
                <section className="motus-home-section-card motus-home-calendar-panel space-y-4 p-4 sm:p-5">
              <div className="min-w-0 w-full">
                  <MemberTrainingCalendar
                    viewMode="month"
                    onViewModeChange={(mode) => {
                      if (mode === "week") {
                        setHomeCalendarViewMode("week");
                      } else {
                        setHomeCalendarViewMode("month");
                        setCalendarMonth(new Date(calendarWeekStart.getFullYear(), calendarWeekStart.getMonth(), 1));
                      }
                    }}
                    weekStart={calendarWeekStart}
                    onWeekStartChange={setCalendarWeekStart}
                    weekDays={calendarWeekDays}
                    weekCompletedCount={calendarWeekCompletedCount}
                    weekPlannedCount={calendarWeekPlannedCount}
                    streakWeeks={streakWeeks}
                    monthLabel={calendarMonthLabel}
                    selectedDateKey={selectedCalendarDateKey}
                    onSelectDateKey={setSelectedCalendarDateKey}
                    onGoToToday={() => {
                      const today = nowDate;
                      setCalendarWeekStart(getMondayStart(today));
                      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                    }}
                    onPreviousMonth={() =>
                      setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    onNextMonth={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    monthWeekdayHeaders={
                      <>
                        <span>Ma</span>
                        <span>Ti</span>
                        <span>On</span>
                        <span>To</span>
                        <span>Fr</span>
                        <span>Lø</span>
                        <span>Sø</span>
                      </>
                    }
                    monthCells={calendarCells.map((day, index) =>
                      day ? (
                        <button
                          type="button"
                          key={`${day}-${index}`}
                          onClick={() => {
                            const dateKey = toCalendarDateKey(
                              new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day),
                            );
                            setSelectedCalendarDateKey((prev) => (prev === dateKey ? null : dateKey));
                          }}
                          className={`rounded-lg px-1 py-2 text-center text-xs transition ${
                            selectedCalendarDateKey ===
                            toCalendarDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
                              ? "ring-2 ring-slate-900/10"
                              : ""
                          } ${
                            calendarDayStatusByDay.get(day) === "completed"
                              ? "motus-brand-fill font-semibold"
                              : calendarDayStatusByDay.get(day) === "missed"
                                ? "bg-rose-50/80 text-rose-700"
                                : calendarDayStatusByDay.get(day) === "planned"
                                  ? "motus-brand-muted font-medium"
                                  : "bg-slate-50/90 text-slate-600"
                          }`}
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
                    monthLegend={
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: MOTUS.turquoise }} />
                          <span>Fullført</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border border-dashed motus-brand-muted-border"
                            style={{ backgroundColor: MOTUS.paleMint }}
                          />
                          <span>Planlagt</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border"
                            style={{ borderColor: "rgba(244,63,94,0.55)", backgroundColor: "rgba(254,226,226,0.9)" }}
                          />
                          <span>Misset</span>
                        </div>
                      </div>
                    }
                  />
                  {selectedCalendarDateKey && selectedCalendarDate ? (
                    <div className="mt-3 rounded-xl bg-slate-50/90 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        Økter {formatDateDdMmYyyy(selectedCalendarDate)}
                      </p>
                      <div className="mt-2 space-y-2">
                        {selectedCalendarPlannedEntries.length > 0 ? (
                          <div className="motus-brand-muted motus-brand-muted-border rounded-lg px-3 py-2 text-xs">
                            <div className="font-semibold">Planlagt økt</div>
                            {selectedCalendarPlannedEntries.map((entry, entryIndex) => (
                              <div key={`${selectedCalendarDateKey}-planned-${entryIndex}`} className="mt-1">
                                {entry}
                              </div>
                            ))}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedCalendarPlanAction.kind === "start-program" ? (
                                <GradientButton
                                  disabled={selectedCalendarPeriodPlanCompleted}
                                  onClick={() => {
                                    if (selectedCalendarPeriodPlanCompleted || !selectedCalendarPeriodMatch) return;
                                    handlePeriodPlanStartProgram(selectedCalendarPlanAction.program.id, {
                                      planId: selectedCalendarPeriodMatch.plan.id,
                                      weekNumber: selectedCalendarPeriodMatch.weekNumber,
                                      day: selectedCalendarPeriodMatch.day,
                                      entry: selectedCalendarPlanEntry,
                                    });
                                  }}
                                  className="w-full sm:w-auto disabled:cursor-default disabled:opacity-100"
                                >
                                  {selectedCalendarPeriodPlanCompleted ? "Fullført" : "Start økt"}
                                </GradientButton>
                              ) : null}
                              {selectedCalendarPlanAction.kind === "log-group" && selectedCalendarPeriodMatch ? (
                                <GradientButton
                                  disabled={selectedCalendarPeriodPlanCompleted}
                                  onClick={() =>
                                    handlePeriodPlanLogGroup({
                                      entry: selectedCalendarPlanEntry,
                                      plannedDate: resolvePeriodPlanEntryDate(
                                        selectedCalendarPeriodMatch.plan,
                                        selectedCalendarPeriodMatch.weekNumber,
                                        selectedCalendarPeriodMatch.day,
                                      ),
                                      planId: selectedCalendarPeriodMatch.plan.id,
                                      weekNumber: selectedCalendarPeriodMatch.weekNumber,
                                      day: selectedCalendarPeriodMatch.day,
                                    })
                                  }
                                  className="w-full sm:w-auto disabled:cursor-default disabled:opacity-100"
                                >
                                  {selectedCalendarPeriodPlanCompleted ? "Gruppetime logget" : "Logg gruppetime"}
                                </GradientButton>
                              ) : null}
                            </div>
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
                                {selectedCalendarLog.trainerComment ? (
                                  <div className="mt-2 rounded-lg border motus-brand-surface px-3 py-2 text-sm text-emerald-900">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Kommentar fra trener</div>
                                    <div className="mt-1">{selectedCalendarLog.trainerComment}</div>
                                  </div>
                                ) : null}
                                {selectedCalendarLog.results?.length ? (
                                  <div className="mt-2 space-y-2">
                                    {selectedCalendarLog.results.map((result, index) => (
                                      <div key={`${selectedCalendarLog.id}-${result.exerciseId}-${index}`} className="rounded-lg border bg-white p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                        <div className="text-sm font-medium text-slate-800">{formatLoggedResultTitle(result)}</div>
                                        <div className="mt-1 text-xs text-slate-600">
                                          {result.performedDurationMinutes
                                            ? `Utført: ${result.performedDurationMinutes || "-"} min${result.performedSpeed ? ` · ${result.performedSpeed} km/t` : ""}${result.performedIncline ? ` · ${result.performedIncline}% incline` : ""}`
                                            : result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)
                                              ? `Utført: ${result.performedWeight || "-"} sek hold`
                                              : `Utført: ${result.performedReps || "-"} reps @ ${result.performedWeight || "-"} kg`}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                          Plan:{" "}
                                          {result.plannedDurationMinutes
                                            ? `${result.plannedDurationMinutes} min${result.plannedSpeed ? ` · ${result.plannedSpeed} km/t` : ""}${result.plannedIncline ? ` · ${result.plannedIncline}% incline` : ""}`
                                            : result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)
                                              ? `${result.plannedSets} sett × ${result.plannedWeight || "0"} sek`
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
              </section>
  );


  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <div className={`grid gap-4 sm:gap-6 ${memberTab === "overview" ? "" : "lg:grid-cols-[280px_1fr]"}`}>
        <Card className={`hidden p-4 h-fit xl:p-5 ${memberTab === "overview" ? "" : "lg:block"}`}>
          <div className="flex items-start gap-3">
            <MotusSectionIcon><UserCircle2 className="h-5 w-5" /></MotusSectionIcon>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Min profil</h2>
              <p className="text-sm text-slate-500">Dine medlemsdata</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {viewedMember ? (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise }}>
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border bg-slate-100 text-slate-400" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                    <ClientAvatarFallback iconClassName="h-7 w-7" />
                    {memberAvatarUrl ? (
                      <img
                        src={memberAvatarUrl}
                        alt={viewedMember.name}
                        className="relative z-10 h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
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

        <div className="min-w-0 w-full max-w-full space-y-4 overflow-x-hidden sm:space-y-6">
          {memberTab === "overview" ? (
            <div className="motus-home-shell space-y-6">
              <MemberHomeOverview
                memberFirstName={homeFirstName}
                todayDateLabel={homeTodayDateLabel}
                headerMotivation={homeHeaderMotivation}
                memberAvatarUrl={memberAvatarUrl}
                onOpenProfile={() => setMemberTab("profile")}
                streakWeeks={streakWeeks}
                dashboardHeadline={homeDashboardHeadline}
                dashboardSubline={homeDashboardSubline}
                momentumPct={homeMomentumPct}
                weekSessionsLabel={homeWeekSessionsLabel}
                weekMinutesLabel={homeWeekMinutesLabel}
                workoutTitle={homeDisplayTitle}
                workoutTitleLoading={homeDisplayLoading}
                workoutSubtitle={homeDisplaySubtitle}
                workoutDuration={homeDisplayDuration}
                workoutImageSrc={homeDisplayCoverSrc}
                workoutZoneLabel={homeDisplayZoneLabel}
                onWorkoutCardClick={openHomeWorkoutDestination}
                quickActions={{
                  onLogWorkout: () => {
                    setMemberTab("programs");
                    setTrainingSection("custom");
                  },
                  onViewPrograms: () => {
                    setMemberTab("programs");
                    setTrainingSection("programs");
                  },
                  onViewPeriodPlan: openProgramsWithPeriodPlan,
                  onViewMessages: () => setMemberTab("messages"),
                }}
                belowWorkout={
                  <MemberHomeBelowWorkout>
                    {memberHasVisiblePeriodPlan && nextPlannedWorkout ? (
                      <MemberHomeNextPlanCard
                        dayLabel={nextPlannedWorkout.dayLabel}
                        entry={nextPlannedWorkout.entry}
                        onClick={openProgramsWithPeriodPlan}
                      />
                    ) : homeStatusCard ? (
                      <MemberHomeStatusGradientCard
                        title={homeStatusCard.title}
                        detail={homeStatusCard.detail}
                        onClick={homeStatusCard.onClick}
                      />
                    ) : null}
                    {homeCalendarViewMode === "week" ? (
                      <MemberHomeWeeklyProgress
                        weekDays={calendarWeekDays}
                        completedSessions={homeWeeklySummary.completedThisWeek}
                        plannedSessions={homeWeeklySummary.plannedThisWeek}
                        weeklyTarget={Number(profileSessionsPerWeekTarget) || undefined}
                        weeklyMinutes={homeWeeklyMinutes}
                        streakWeeks={streakWeeks}
                        streakSubline={streakSubline}
                        momentumTrend={memberProgressScores.momentum.trend}
                        thisWeekSessions={homeWeeklySummary.completedThisWeek}
                        lastWeekSessions={homeLastWeekSessions}
                        completedLogDates={completedLogDates}
                        nowDate={nowDate}
                        showStats={false}
                        onOpenCalendar={() => {
                          setHomeCalendarViewMode("month");
                          setCalendarMonth(new Date(calendarWeekStart.getFullYear(), calendarWeekStart.getMonth(), 1));
                        }}
                        onOpenProgress={() => setMemberTab("progress")}
                      />
                    ) : (
                      memberHomeCalendarPanel
                    )}
                  </MemberHomeBelowWorkout>
                }
                bottomContent={
                  !isMemberLimited ? (
                    <MemberBadgesCarousel
                      collection={memberBadgeCollection}
                      memberDisplayName={memberShareDisplayName}
                      shareLogoSrc={motusShareLogoSrc}
                    />
                  ) : null
                }
                primaryCta={
                  todayPlanAction.kind === "start-program" ? (
                    todayPeriodPlanCompleted ? (
                      <GradientButton
                        type="button"
                        disabled
                        className="motus-pressable h-10 w-full rounded-lg px-4 text-sm font-semibold disabled:cursor-default disabled:opacity-100"
                        aria-disabled
                      >
                        Dagens økt er fullført
                      </GradientButton>
                    ) : (
                      <MemberHomeStartWorkoutButton
                        label="Start dagens økt"
                        onClick={() => {
                          if (!todayPlanPeriodPlan || !todayPeriodPlanMatch) return;
                          handlePeriodPlanStartProgram(todayPlanAction.program.id, {
                            planId: todayPlanPeriodPlan.id,
                            weekNumber: todayPeriodPlanMatch.weekNumber,
                            day: todayPeriodPlanMatch.day,
                            entry: todayPlanEntry,
                          });
                        }}
                      />
                    )
                  ) : todayPlanAction.kind === "log-group" && todayPlanPeriodPlan && todayPeriodPlanMatch ? (
                    <GradientButton
                      type="button"
                      disabled={todayPeriodPlanCompleted}
                      onClick={() =>
                        handlePeriodPlanLogGroup({
                          entry: todayPlanEntry,
                          plannedDate: resolvePeriodPlanEntryDate(
                            todayPlanPeriodPlan,
                            todayPeriodPlanMatch.weekNumber,
                            todayPeriodPlanMatch.day,
                          ),
                          planId: todayPlanPeriodPlan.id,
                          weekNumber: todayPeriodPlanMatch.weekNumber,
                          day: todayPeriodPlanMatch.day,
                        })
                      }
                      className="motus-pressable h-10 rounded-lg px-4 text-sm font-semibold disabled:cursor-default disabled:opacity-100"
                      aria-disabled={todayPeriodPlanCompleted}
                    >
                      {todayPeriodPlanCompleted ? "Dagens økt er logget" : "Logg dagens økt"}
                    </GradientButton>
                  ) : todayPlanIsPassiveDay ? null : homeWorkoutHydrationPending ? null : nextProgram ? (
                    <MemberHomeStartWorkoutButton
                      label="Start dagens økt"
                      onClick={() => startMemberProgram(nextProgram)}
                    />
                  ) : (
                    <GradientButton
                      type="button"
                      onClick={() => setMemberTab(nextBestAction.action === "progress" ? "progress" : "programs")}
                      className="motus-pressable h-10 rounded-lg px-4 text-sm font-semibold"
                    >
                      {nextBestAction.cta}
                    </GradientButton>
                  )
                }
                onboardingPrompt={
                  onOpenOnboarding && showOnboardingHomePrompt && !onboardingCompleteForHome ? (
                    <MemberHomeCompactPrompt
                      title="Fortell oss litt om deg"
                      detail="Ca. 3–5 min · én gang"
                      ctaLabel="Start skjema"
                      onCta={onOpenOnboarding}
                      onDismiss={onDismissOnboardingHomePrompt}
                      dismissLabel="Skjul"
                    />
                  ) : undefined
                }
                monthlyCheckInPrompt={
                  monthlyCheckInPrompt && onOpenMonthlyCheckIn ? (
                    <MemberHomeCompactPrompt
                      title={monthlyCheckInPrompt.copy.text}
                      detail={`${monthlyCheckInPrompt.copy.detail} · ${monthlyCheckInPrompt.window.daysRemaining} dager igjen`}
                      ctaLabel="Start sjekk-inn"
                      onCta={onOpenMonthlyCheckIn}
                    />
                  ) : undefined
                }
              />

            </div>
          ) : null}

          {!isMemberLimited && showWorkoutCompletionCelebration && recentlyFinishedStats ? (
            <WorkoutCelebrationModal
              open={true}
              programTitle={recentlyFinishedLog?.programTitle ?? ""}
              stats={recentlyFinishedStats}
              onClose={handleDismissWorkoutCompletionCelebration}
            />
          ) : null}

          {!isMemberLimited && shouldShowPrCelebration ? (
            <div className="motus-modal-insets fixed inset-0 z-[10020] flex justify-center overflow-y-auto overscroll-contain bg-slate-900/55 px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))]">
              <div
                className="motus-pop-in h-fit w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl ring-2 ring-emerald-500/20"
                style={{ borderColor: "rgba(15,23,42,0.08)" }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pr-celebration-heading"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Trophy className="h-11 w-11" aria-hidden />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ny personlig rekord</p>
                  <h2 id="pr-celebration-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    Sterkere enn før
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                    Du satte ny personlig rekord i øvelsen du nettopp gjorde.
                  </p>
                  <div className="mt-5 w-full rounded-2xl border border-emerald-200/90 bg-emerald-50 px-4 py-4 text-left shadow-inner" style={{ borderColor: "rgba(48,227,190,0.35)" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/80">Øvelse</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{activeCelebration?.exerciseName}</div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="tabular-nums text-slate-600">{activeCelebration?.previousEstimated1RM.toFixed(1)} kg</span>
                      <span className="text-slate-400">→</span>
                      <span className="tabular-nums text-lg font-bold text-emerald-800">{activeCelebration?.newEstimated1RM.toFixed(1)} kg</span>
                      <span className="text-xs font-medium text-emerald-900/70">1RM (estimat)</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      Basert på {activeCelebration?.weight}&nbsp;kg × {activeCelebration?.reps} reps i settet du nettopp logget.
                    </div>
                  </div>
                  <div className="mt-6 flex w-full flex-col gap-2">
                    <OutlineButton
                      type="button"
                      onClick={() => void shareActiveCelebrationPr()}
                      disabled={isSharingCelebrationPr}
                      className="min-h-11 w-full font-semibold"
                    >
                      <Share2 className="mr-2 inline h-4 w-4 shrink-0" aria-hidden />
                      {isSharingCelebrationPr ? "Lager skrytekort…" : "Del rekorden"}
                    </OutlineButton>
                    <GradientButton
                      onClick={() => {
                        if (liveWorkoutCelebration) {
                          setLiveWorkoutCelebration(null);
                          return;
                        }
                        dismissWorkoutCelebration();
                      }}
                      className="w-full min-h-11 text-base font-semibold"
                    >
                      Supert — videre
                    </GradientButton>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {!isMemberLimited && hiddenBadgeCelebration && !shouldShowPrCelebration ? (
            <div className="motus-modal-insets fixed inset-0 z-[10019] flex justify-center overflow-y-auto overscroll-contain bg-slate-900/45 px-4 py-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
              <div
                className="motus-pop-in h-fit w-full max-w-sm overflow-visible rounded-2xl border bg-white text-center shadow-xl"
                style={{ borderColor: "rgba(15,23,42,0.1)" }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="hidden-badge-heading"
              >
                <div className="h-2" style={{ background: `linear-gradient(90deg, #BA0C2F 0%, #FFFFFF 24%, #00205B 50%, #FFFFFF 76%, #BA0C2F 100%)` }} />
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Skjult badge låst opp</p>
                  <div className="mx-auto mt-4 flex justify-center overflow-visible">
                    <BadgeImage src={memberBadgeImageSrc(hiddenBadgeCelebration.id)} size="popup" loading="eager" />
                  </div>
                  <h2 id="hidden-badge-heading" className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                    {hiddenBadgeCelebration.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {HIDDEN_BADGE_POPUP_COPY[hiddenBadgeCelebration.id] ?? hiddenBadgeCelebration.description}
                  </p>
                  <div className="mt-5 rounded-2xl border bg-slate-50 px-4 py-3 text-left" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hemmelig samling</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Denne badgen vises nå i oversikten din.</div>
                  </div>
                  <GradientButton
                    onClick={() => {
                      markHiddenBadgeSeen(hiddenBadgeCelebration.id);
                      setHiddenBadgeCelebration(null);
                    }}
                    className="mt-6 w-full min-h-11 font-semibold"
                  >
                    Hurra — videre
                  </GradientButton>
                </div>
              </div>
            </div>
          ) : null}
          {!isMemberLimited && microCelebrationsEnabled && achievementCelebration && !shouldShowPrCelebration && !hiddenBadgeCelebration ? (
            <div className="motus-modal-insets fixed inset-0 z-[10019] flex justify-center overflow-y-auto overscroll-contain bg-slate-900/40 px-4 py-12 pt-[max(2.5rem,env(safe-area-inset-top))]">
              <div
                className="motus-pop-in h-fit w-full max-w-sm rounded-2xl border bg-white p-6 text-center shadow-xl"
                style={{ borderColor: "rgba(15,23,42,0.1)" }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="milestone-heading"
              >
                <div className="mx-auto inline-flex rounded-full bg-slate-100 p-3 ring-1 ring-slate-200/90">
                  <TrendingUp className="h-8 w-8 text-teal-700" aria-hidden />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nytt steg i treningsflyten</p>
                <h2 id="milestone-heading" className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                  {buildCelebrationCopy(achievementCelebration.achievedLevel).title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {buildCelebrationCopy(achievementCelebration.achievedLevel).body}
                </p>
                <p className="mt-3 text-xs leading-snug text-slate-500">
                  Varsler om ny PR etter økt vises som før og påvirkes ikke av denne innstillingen.
                </p>
                <GradientButton onClick={() => setAchievementCelebration(null)} className="mt-6 w-full min-h-11 font-semibold">
                  OK
                </GradientButton>
              </div>
            </div>
          ) : null}

          {memberTab === "programs" ? (
            <>
              <div className="motus-training-page flex flex-col gap-4">
              <MemberTrainingQuickActions
                activeSection={trainingSection}
                onNavigate={setTrainingSection}
                hideCustom={isMemberLimited}
              />
              {trainingSection === "today" ? (
                <MemberTrainingOverview
                  title={todayPlanEntry || homeWorkoutProgram?.title || (memberHasVisiblePeriodPlan ? "Ingen plan i dag" : nextProgram?.title || "Ingen plan i dag")}
                  imageSrc={homeWorkoutCoverSrc}
                  durationLabel={homeWorkoutDuration}
                  zoneLabel={homeWorkoutZoneLabel}
                  exerciseCountLabel={
                    homeWorkoutProgram?.exercises.length
                      ? `${homeWorkoutProgram.exercises.length} ${homeWorkoutProgram.exercises.length === 1 ? "øvelse" : "øvelser"}`
                      : null
                  }
                  primaryAction={
                    todayPlanAction.kind === "start-program"
                      ? {
                          label: todayPeriodPlanCompleted ? "Fullført" : "Start økt",
                          disabled: todayPeriodPlanCompleted,
                          completed: todayPeriodPlanCompleted,
                          onClick: () => {
                            if (!todayPlanPeriodPlan || !todayPeriodPlanMatch) return;
                            handlePeriodPlanStartProgram(todayPlanAction.program.id, {
                              planId: todayPlanPeriodPlan.id,
                              weekNumber: todayPeriodPlanMatch.weekNumber,
                              day: todayPeriodPlanMatch.day,
                              entry: todayPlanEntry,
                            });
                          },
                        }
                      : todayPlanAction.kind === "log-group" && todayPlanPeriodPlan && todayPeriodPlanMatch
                        ? {
                            label: todayPeriodPlanCompleted ? "Fullført" : "Logg gruppetime",
                            disabled: todayPeriodPlanCompleted,
                            completed: todayPeriodPlanCompleted,
                            onClick: () =>
                              handlePeriodPlanLogGroup({
                                entry: todayPlanEntry,
                                plannedDate: resolvePeriodPlanEntryDate(
                                  todayPlanPeriodPlan,
                                  todayPeriodPlanMatch.weekNumber,
                                  todayPeriodPlanMatch.day,
                                ),
                                planId: todayPlanPeriodPlan.id,
                                weekNumber: todayPeriodPlanMatch.weekNumber,
                                day: todayPeriodPlanMatch.day,
                              }),
                          }
                        : !todayPlanEntry && nextProgram
                          ? {
                              label: "Start neste økt",
                              onClick: () => startMemberProgram(nextProgram),
                            }
                          : undefined
                  }
                  completedHint={todayPeriodPlanCompleted ? "Dagens økt er logget" : null}
                  completedSessions={homeWeeklySummary.completedThisWeek}
                  momentumPct={homeMomentumPct}
                  streakWeeks={streakWeeks}
                  pausedWorkouts={trainingPausedCards}
                  weeklyPoints={trainingWeeklyPoints}
                  weeklyProgressPct={trainingWeeklyProgressPct}
                  weeklyDeltaLabel={trainingWeeklyDeltaLabel}
                  programs={trainingProgramPreviews.map((program) => ({
                    ...program,
                    onOpen: () => {
                      setTrainingSection("programs");
                      setExpandedProgramId(program.id);
                      requestAnimationFrame(() => {
                        document.getElementById(`member-program-${program.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    },
                  }))}
                  onViewAllPrograms={() => setTrainingSection("programs")}
                  records={personalRecords.slice(0, 8)}
                  exercises={exercises}
                  onViewAllRecords={() => setTrainingSection("history")}
                  onOpenRecord={setPrProgressExerciseName}
                />
              ) : null}
              {trainingSection === "programs" ? (
              <>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Mine programmer</div>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">Treningsprogram</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {showProgramLibraryFilter
                        ? "Filtrer listen, eller start økter direkte fra Periodeplan-fanen."
                        : "Start, vis, skjul eller arkiver programmene dine."}
                    </p>
                  </div>
                </div>
                {showProgramLibraryFilter ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setProgramLibraryFilter("all")}
                      className={`motus-pressable motus-surface-chip px-3 py-2 ${programLibraryFilter === "all" ? "motus-surface-chip--active" : ""}`}
                    >
                      Alle <span className={programLibraryFilter === "all" ? "opacity-75" : "text-slate-400"}>{memberProgramsInActiveLibrary.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramLibraryFilter("standalone")}
                      className={`motus-pressable motus-surface-chip px-3 py-2 ${programLibraryFilter === "standalone" ? "motus-surface-chip--active" : ""}`}
                    >
                      Egne <span className={programLibraryFilter === "standalone" ? "opacity-75" : "text-slate-400"}>{standaloneProgramCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProgramLibraryFilter("periodPlan")}
                      className={`motus-pressable motus-surface-chip px-3 py-2 ${programLibraryFilter === "periodPlan" ? "motus-surface-chip--active" : ""}`}
                    >
                      Fra periodeplan{" "}
                      <span className={programLibraryFilter === "periodPlan" ? "opacity-75" : "text-slate-400"}>{periodPlanProgramCount}</span>
                    </button>
                  </div>
                ) : null}
                {secondaryPausedWorkouts.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border motus-brand-surface/80 px-3 py-2">
                      <div className="text-xs font-semibold text-teal-900">Påbegynte økter</div>
                      <p className="mt-0.5 text-[11px] text-teal-800/90">Lagres i 4 timer. Fortsett der du slapp, eller slett.</p>
                    </div>
                    {secondaryPausedWorkouts.map((draft) => {
                      const progress = pausedWorkoutProgress(draft.workoutMode);
                      return (
                        <div
                          key={draft.id}
                          className="rounded-lg border bg-white p-2.5"
                          style={{ borderColor: "rgba(48,227,190,0.35)" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{draft.programTitle}</div>
                              <div className="mt-0.5 text-[11px] text-slate-600">
                                {progress.completed} av {progress.total} sett fullført
                              </div>
                              <div className="mt-0.5 text-[10px] text-slate-400">{formatPausedWorkoutExpiry(draft.expiresAt)}</div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <GradientButton
                                className="!min-h-7 !px-2 !py-1 !text-[10px] !leading-tight"
                                onClick={() => {
                                  resumePausedWorkout(draft.id, draft.memberId);
                                }}
                              >
                                <span className="inline-flex items-center gap-1">
                                  <Play className="h-3 w-3" />
                                  Fortsett
                                </span>
                              </GradientButton>
                              <OutlineButton
                                className="!min-h-7 !px-1.5 !py-1"
                                onClick={() => {
                                  setConfirmDialog({
                                    title: "Slette påbegynt økt?",
                                    message: "Fremgangen i denne økten fjernes permanent.",
                                    confirmLabel: "Slett",
                                    tone: "danger",
                                    onConfirm: () => {
                                      discardPausedWorkoutDraft(activeMemberId, draft.id);
                                      setPausedWorkoutsTick((value) => value + 1);
                                    },
                                  });
                                }}
                                aria-label="Slett påbegynt økt"
                                title="Slett"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                              </OutlineButton>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="mt-4 space-y-3">
                  {memberAssignedPrograms.length === 0 ? (
                    <EmptyState
                      icon="📋"
                      title="Du har ikke fått program fra PT ennå"
                      description={
                        isMemberLimited
                          ? "Treneren din kan tildele et program her."
                          : "Du kan starte egen økt med en gang, eller sende melding til PT."
                      }
                      className="bg-white"
                      action={
                        !isMemberLimited ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                            <GradientButton
                              onClick={() => {
                                setTrainingSection("custom");
                              }}
                              className="w-full sm:w-auto"
                            >
                              Lag egen økt
                            </GradientButton>
                            <OutlineButton onClick={() => setMemberTab("messages")} className="w-full sm:w-auto">
                              Send melding til PT
                            </OutlineButton>
                          </div>
                        ) : null
                      }
                    />
                  ) : null}
                  {memberAssignedPrograms.length > 0 && memberProgramsInActiveLibrary.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Alle program er skjult eller arkivert. Bruk seksjonene nedenfor for å gjenopprette dem i oversikten.
                    </div>
                  ) : null}
                  {memberAssignedPrograms.length > 0 &&
                  memberProgramsInActiveLibrary.length > 0 &&
                  filteredMemberProgramsInActiveLibrary.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Ingen program i dette filteret. Prøv et annet filter, eller gå til Periodeplan for å starte planlagte økter.
                    </div>
                  ) : null}
	                  {filteredMemberProgramsInActiveLibrary.map((program) => {
	                    const isExpanded = expandedProgramId === program.id;
	                    const isLibraryMenuOpen = programLibraryMenuId === program.id;
	                    const coverExercise = program.exercises
	                      .map((item) => exercises.find((exercise) => exercise.id === item.exerciseId))
	                      .find(Boolean);
	                    const programMinutes = Math.max(20, Math.round(estimateProgramMinutes(program) / 5) * 5);
	                    const programCategory = trainingProgramCategoryLabel(program, exerciseCategoryById, exercises);
	                    const programSubTab = getTrainingProgramSubTab(program, exerciseCategoryById, exercises);
	                    const programLevel = coverExercise?.level ?? "Nivå tilpasses";
	                    const programCoverSrc = resolveProgramImageSrc(program, coverExercise, { subTab: programSubTab });
	                    const programUsesCustomCover = programCoverUsesPhotoStyle(program, programCoverSrc);
	                    const completedProgramLogs = completedLogs.filter((log) => log.programTitle.trim().toLowerCase() === program.title.trim().toLowerCase()).length;
	                    const completedTimesLabel = completedProgramLogs === 0
	                      ? "Ikke fullført ennå"
	                      : completedProgramLogs === 1
	                        ? "1 gang fullført"
	                        : `${completedProgramLogs} ganger fullført`;
	                    const linkedPeriodPlan = periodPlanLinkedProgramIds.has(program.id)
	                      ? findPeriodPlanForProgram(program, visiblePeriodPlans, memberProgramsForPeriodPlan)
	                      : null;
	                    return (
	                      <div
	                        key={program.id}
	                        id={`member-program-${program.id}`}
	                        className="motus-member-program-card motus-card overflow-hidden"
	                      >
	                        <div className="motus-member-program-layout">
	                        <div className="motus-member-program-thumb motus-image-frame motus-image-frame--portrait">
	                          {programCoverSrc ? (
	                            <img
	                              src={programCoverSrc}
	                              alt=""
	                              className={`motus-member-program-cover motus-image-media${programUsesCustomCover ? "" : " motus-member-program-cover--exercise"}`}
	                              loading="lazy"
	                              decoding="async"
	                              style={{ objectPosition: imageObjectPositionFromSrc(programCoverSrc) }}
	                            />
	                          ) : (
	                            <div className="motus-member-program-thumb-fallback" aria-hidden />
	                          )}
	                          <span className="motus-member-program-category-badge">{programCategory}</span>
	                        </div>
	                        <div className="motus-member-program-content">
	                          <div className="motus-member-program-summary">
	                            <div className="motus-member-program-header">
	                              <div className="motus-member-program-title">{program.title}</div>
	                              {linkedPeriodPlan ? (
	                                <span
	                                  className="mt-1 inline-flex max-w-full items-center rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 ring-1 ring-teal-200/80"
	                                  title={`Tilhører periodeplanen «${linkedPeriodPlan.title}»`}
	                                >
	                                  Periodeplan
	                                </span>
	                              ) : null}
	                            </div>
	                            <div className="motus-member-program-stats">
	                              <span className="motus-member-program-stat">
	                                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
	                                {programMinutes} min
	                              </span>
	                              <span className="motus-member-program-stat">
	                                <Signal className="h-3.5 w-3.5 shrink-0" aria-hidden />
	                                {programLevel}
	                              </span>
	                              <span className="motus-member-program-stat">
	                                <Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden />
	                                {program.exercises.length} {program.exercises.length === 1 ? "øvelse" : "øvelser"}
	                              </span>
	                            </div>
                            <div className="motus-member-program-progress">
                              <span className="motus-member-program-progress-label">{completedTimesLabel}</span>
                            </div>
	                            <div className="motus-member-program-actions">
                            <TrainingStartButton
                              className="motus-member-program-start"
                              onClick={() => {
                                startMemberProgram(program);
                              }}
                            >
	                              <Play className="h-4 w-4 fill-white text-white" aria-hidden />
	                                Start økt
	                            </TrainingStartButton>
	                              <div className="relative min-w-0" data-program-library-menu>
	                                <OutlineButton
	                                  type="button"
	                                  className={`motus-member-program-secondary-btn w-full ${isLibraryMenuOpen ? "!border-teal-300 !bg-teal-50" : ""}`}
	                                  onClick={() => setProgramLibraryMenuId((prev) => (prev === program.id ? null : program.id))}
	                                  aria-label={isLibraryMenuOpen ? "Lukk meny" : "Flere valg"}
	                                  aria-expanded={isLibraryMenuOpen}
	                                  title="Flere valg"
	                                >
	                                    <MoreHorizontal className="h-4 w-4" aria-hidden />
	                                </OutlineButton>
	                                {isLibraryMenuOpen ? (
	                                  <div
	                                    className="absolute right-0 bottom-[calc(100%+4px)] z-30 w-44 overflow-hidden rounded-xl border bg-white py-1 shadow-lg ring-1 ring-black/5"
	                                    style={{ borderColor: "rgba(15,23,42,0.1)" }}
	                                    role="menu"
	                                  >
	                                    <button
	                                      type="button"
	                                      role="menuitem"
	                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
	                                      onClick={() => {
	                                        setProgramLibraryMenuId(null);
	                                        setExpandedProgramId((prev) => (prev === program.id ? null : program.id));
	                                      }}
	                                    >
	                                      {isExpanded ? <EyeOff className="h-4 w-4 shrink-0 text-slate-500" /> : <Eye className="h-4 w-4 shrink-0 text-slate-500" />}
	                                      {isExpanded ? "Skjul detaljer" : "Vis detaljer"}
	                                    </button>
	                                    <button
	                                      type="button"
	                                      role="menuitem"
	                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
	                                      onClick={() => {
	                                        setProgramLibraryMenuId(null);
	                                        handlePrintProgram(program);
	                                      }}
	                                    >
	                                      <Printer className="h-4 w-4 shrink-0 text-slate-500" />
	                                      PDF
	                                    </button>
	                                    {memberMayEditProgram(program) ? (
	                                      <button
	                                        type="button"
	                                        role="menuitem"
	                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
	                                        onClick={() => {
	                                          setProgramLibraryMenuId(null);
	                                          setEditingMemberProgramId(program.id);
	                                          setTrainingSection("custom");
	                                        }}
	                                      >
	                                        <Pencil className="h-4 w-4 shrink-0 text-slate-500" />
	                                        Rediger
	                                      </button>
	                                    ) : null}
	                                    <button
	                                      type="button"
	                                      role="menuitem"
	                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
	                                      onClick={() => {
	                                        updateProgramMemberLibraryStatus(program.id, "archived");
	                                        const focusedProgram = memberFocusProgramId
	                                          ? memberPrograms.find((item) => item.id === memberFocusProgramId)
	                                          : null;
	                                        const archiveKey = buildTrainingProgramDisplayKey(program);
	                                        if (
	                                          memberFocusProgramId === program.id ||
	                                          (focusedProgram &&
	                                            buildTrainingProgramDisplayKey(focusedProgram) === archiveKey)
	                                        ) {
	                                          clearMemberFocusProgramId?.();
	                                        }
	                                        setExpandedProgramId((prev) => (prev === program.id ? null : prev));
	                                        setLibraryActionStatus("Programmet er arkivert.");
	                                        setProgramLibraryMenuId(null);
	                                      }}
	                                    >
	                                      <Archive className="h-4 w-4 shrink-0 text-slate-500" />
	                                      Arkiver
	                                    </button>
	                                    {memberMayDeleteProgram(program, memberProgramAuthorOptions) ? (
	                                      <button
	                                        type="button"
	                                        role="menuitem"
	                                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
	                                        onClick={() => {
	                                          setProgramLibraryMenuId(null);
	                                          setConfirmDialog({
	                                            title: "Slette program?",
	                                            message: `Dette sletter «${program.title.trim()}» fra biblioteket og tilhørende økter som er logget på dette programmet.`,
	                                            confirmLabel: "Slett",
	                                            tone: "danger",
	                                            onConfirm: () => {
	                                              deleteProgramById(program.id, { requestedBy: "member" });
	                                              setLibraryActionStatus("Programmet er slettet.");
	                                            },
	                                          });
	                                        }}
	                                      >
	                                        <Trash2 className="h-4 w-4 shrink-0" />
	                                        Slett program
	                                      </button>
	                                    ) : null}
	                                  </div>
	                                ) : null}
	                              </div>
	                            </div>
	                          </div>

	                        {isExpanded ? (
                          <>
                            {program.notes ? <div className="rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-slate-600">{program.notes}</div> : null}

                            <div className="space-y-1.5">
                              {program.exercises.length === 0 ? (
                                <EmptyState
                                  icon="🧩"
                                  title="Ingen øvelser i programmet ennå"
                                  description="Programmet er tomt akkurat nå."
                                  className="bg-slate-50 py-4"
                                />
                              ) : null}
                              {program.exercises.map((exercise, exerciseIndex) => {
                                const exerciseName = memberProgramExerciseName(program, exerciseIndex);
                                const lib = exercises.find((e) => e.id === exercise.exerciseId);
                                const isStretch = Boolean(lib?.category && isHoldBasedExerciseCategory(lib.category));
                                const blockPeers = exercise.blockId
                                  ? program.exercises.filter((peer) => peer.blockId?.trim() === exercise.blockId?.trim())
                                  : [];
                                const showBlockHeader =
                                  exercise.blockType && blockPeers.length > 0 && blockPeers[0]?.id === exercise.id;
                                return (
                                <div key={exercise.id} className="rounded-lg border bg-slate-50 px-2 py-1.5" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                                  {showBlockHeader ? (
                                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
                                      {exercise.blockType === "superset"
                                        ? "Supersett"
                                        : exercise.blockType === "triset"
                                          ? "Trisett"
                                          : "Sirkel"}
                                      {" · "}
                                      {blockPeers.map((peer) => peer.exerciseName).join(" → ")}
                                    </div>
                                  ) : null}
                                  <div className="text-xs font-medium text-slate-800">{exerciseName}</div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    {(() => {
                                      const cardioMin = String(exercise.durationMinutes ?? "").trim();
                                      const cardioSek = String(exercise.holdSeconds ?? "").trim();
                                      const isCardio = lib?.category === "Kondisjon" || Boolean(cardioMin);
                                      if (isCardio) {
                                        const timeParts: string[] = [];
                                        if (cardioMin) timeParts.push(`${cardioMin} min`);
                                        if (cardioSek) timeParts.push(`${cardioSek} sek`);
                                        const timeLabel = timeParts.length ? timeParts.join(" ") : "—";
                                        return `${exercise.sets} runder × ${timeLabel}${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}% incline` : ""} · ${exercise.restSeconds}s${cardioHrPrescriptionSuffixForMember(exercise)}`;
                                      }
                                      if (isStretch) {
                                        return `${exercise.sets} sett × ${programExerciseHoldSeconds(exercise, lib?.category) || "-"} sek · ${exercise.restSeconds}s`;
                                      }
                                      return `${exercise.sets}×${exercise.reps} · ${exercise.weight}kg · ${exercise.restSeconds}s`;
                                    })()}
                                  </div>
                                  {!exercise.durationMinutes && !isStretch && lib?.category !== "Kondisjon" ? (
                                    <div className="mt-1.5 rounded-lg border bg-white px-2 py-1.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                      <div className="text-[10px] text-slate-500">Foreslått vekt fra forrige gang (kan endres)</div>
                                      <TextInput
                                        value={resolveSuggestedWorkoutWeight(exercise)}
                                        onChange={(event) =>
                                          setSuggestedWeightOverridesByProgramExerciseId((prev) => ({
                                            ...prev,
                                            [exercise.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="Kg"
                                        className="mt-1 !h-8 !text-xs"
                                      />
                                    </div>
                                  ) : !exercise.durationMinutes && isStretch ? (
                                    <div className="mt-1.5 rounded-lg border bg-white px-2 py-1.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                      <div className="text-[10px] text-slate-500">Foreslått hold fra forrige gang (kan endres)</div>
                                      <TextInput
                                        value={resolveSuggestedWorkoutWeight(exercise)}
                                        onChange={(event) =>
                                          setSuggestedWeightOverridesByProgramExerciseId((prev) => ({
                                            ...prev,
                                            [exercise.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="Sekunder"
                                        className="mt-1 !h-8 !text-xs"
                                      />
                                    </div>
                                  ) : null}
                                  {exercise.notes ? <div className="mt-0.5 text-[10px] text-slate-500">{exercise.notes}</div> : null}
                                </div>
                              );
                              })}
                            </div>
	                          </>
	                        ) : null}
	                        </div>
	                        </div>
	                      </div>
                    );
                  })}
                  {memberProgramsInActiveLibrary.length > 0 ? (
                    <div className="motus-member-program-tips">
                      <div className="motus-member-program-tips-icon" aria-hidden>
                        <Lightbulb className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-teal-900">Tips</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-teal-800/90">
                          Start med dagens program og hold flyten. Små steg hver uke gir størst fremgang over tid.
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {memberProgramsLibraryArchived.length > 0 ? (
                    <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                      <button
                        type="button"
                        onClick={() => setShowLibraryArchivedSection((open) => !open)}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span className="text-xs font-semibold text-slate-800">Arkiverte program ({memberProgramsLibraryArchived.length})</span>
                        <span className="text-xs font-medium text-slate-500">{showLibraryArchivedSection ? "Skjul liste" : "Vis liste"}</span>
                      </button>
                      {showLibraryArchivedSection ? (
                        <div className="mt-3 space-y-2">
                          {memberProgramsLibraryArchived.map((program) => (
                            <div
                              key={program.id}
                              className="flex flex-col gap-2 rounded-xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                              style={{ borderColor: "rgba(15,23,42,0.08)" }}
                            >
                              <div className="min-w-0">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Arkivert</div>
                                <div className="font-medium text-sm text-slate-800">{program.title}</div>
                                {program.goal?.trim() ? (
                                  <div className="text-xs text-slate-500">{program.goal.trim()}</div>
                                ) : null}
                              </div>
                              <OutlineButton
                                type="button"
                                className="w-full shrink-0 px-3 py-2 text-xs sm:w-auto"
                                onClick={() => {
                                  updateProgramMemberLibraryStatus(program.id, undefined);
                                  setLibraryActionStatus("Programmet er tilbake i oversikten.");
                                }}
                              >
                                Gjenopprett
                              </OutlineButton>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
              <div>
                <article className="motus-training-hero motus-image-frame motus-image-frame--training-hero">
                  <img
                    className="motus-training-hero-cover motus-image-media"
                    src="/program-covers/logg-gruppetrening.png"
                    alt=""
                    loading="lazy"
                  />
                  <div className="motus-training-hero-overlay" aria-hidden />
                  <div className="motus-training-hero-content">
                    <p className="motus-training-hero-label">Gruppetrening</p>
                    <h2 className="motus-training-hero-title">Logg gruppetrening</h2>
                    <p className="motus-training-hero-meta">
                      Registrer gruppetimer slik at PT ser all aktivitet. Velg annen dato hvis du glemte å logge.
                    </p>
                    <div className="motus-training-hero-cta">
                      <TrainingStartButton
                        onClick={() => setShowGroupWorkoutLogger((prev) => !prev)}
                        className="w-full sm:w-auto"
                        aria-expanded={showGroupWorkoutLogger}
                      >
                        <Users className="h-4 w-4 text-white" aria-hidden />
                        Logg gruppetrening
                      </TrainingStartButton>
                    </div>
                  </div>
                </article>
                {showGroupWorkoutLogger ? (
                  <div className="mt-4 rounded-xl border bg-slate-50 p-4 space-y-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-slate-600">Dato</span>
                        <TextInput
                          type="date"
                          value={groupWorkoutDateIso}
                          max={toIsoDateInputValue(new Date())}
                          onChange={(event) => setGroupWorkoutDateIso(event.target.value)}
                        />
                      </label>
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
                                  active ? "border-teal-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"
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
              </>
              ) : null}
              {!isMemberLimited ? (
              trainingSection === "custom" ? (
              <CustomWorkoutBuilder
                exercises={exercises}
                completedLogs={completedLogs}
                memberPrograms={memberAssignedPrograms}
                activeMemberId={activeMemberId}
                memberDisplayName={viewedMember?.name?.trim() || editableMember?.name?.trim() || ""}
                currentUserEmail={currentUserEmail}
                nowDate={nowDate}
                startCustomWorkout={startCustomWorkout}
                saveProgramForMember={saveProgramForMember}
                deleteProgramById={(programId) => deleteProgramById(programId)}
                refreshRemoteHydration={refreshRemoteHydration}
                findSuggestedWeightForExercise={findSuggestedWeightForExercise}
                editingProgram={editingMemberProgram}
                onCancelEdit={() => setEditingMemberProgramId(null)}
                onEditSaved={() => {
                  setEditingMemberProgramId(null);
                  setTrainingSection("programs");
                  setLibraryActionStatus("Programmet er oppdatert.");
                }}
              />
              ) : null
              ) : null}


              {trainingSection === "period" ? (
              periodPlans.length > 0 ? (
              <div className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <MotusSectionIcon className="!p-2">
                      <CalendarRange className="h-4 w-4" aria-hidden />
                    </MotusSectionIcon>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Periodeplan</div>
                      <div className="mt-1 text-lg font-bold text-slate-950">Uke for uke</div>
                      <div className="mt-1 text-sm text-slate-600">Start økter, logg aktivitet og bytt dager når hverdagen krever det.</div>
                    </div>
                  </div>
                  {memberHasVisiblePeriodPlan ? (
                    <OutlineButton onClick={() => setShowPeriodPlanPanel((prev) => !prev)} className="w-full sm:w-auto">
                      {showPeriodPlanPanel ? "Minimer ukeplan" : "Vis ukeplan"}
                    </OutlineButton>
                  ) : null}
                </div>
                {!memberHasVisiblePeriodPlan ? (
                  <div
                    className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950"
                    role="status"
                  >
                    <p className="font-semibold">Alle periodeplaner er skjult fra oversikten</p>
                    <p className="mt-1 leading-relaxed text-amber-900/90">
                      Planene er ikke slettet. Trykk <strong>Vis igjen</strong> for å ta dem tilbake, eller legg til en ny plan fra Utforsk.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {hiddenPeriodPlans.length > 1 ? (
                        <GradientButton type="button" onClick={unhideAllTrainerPeriodPlans} className="w-full sm:w-auto">
                          Vis alle planer
                        </GradientButton>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      {hiddenPeriodPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 font-medium text-slate-900">{plan.title}</div>
                          <OutlineButton
                            type="button"
                            className="w-full shrink-0 px-3 py-2 text-xs sm:w-auto"
                            onClick={() => unhideTrainerPeriodPlan(plan.id)}
                          >
                            Vis igjen
                          </OutlineButton>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {memberHasVisiblePeriodPlan && showPeriodPlanPanel ? (
                  <div className="mt-4 space-y-3">
                    {visiblePeriodPlans.length > 1 ? (
                      <div className="flex flex-wrap gap-2">
                        {visiblePeriodPlans.map((plan) => {
                          const active = activePeriodPlan?.id === plan.id;
                          const memberOwned = isMemberOwnedPeriodPlan(plan, trainerPeriodPlanIds);
                          return (
                            <button
                              key={plan.id}
                              type="button"
                              onClick={() => selectActiveMemberPeriodPlan(plan.id)}
                              className={`motus-pressable motus-surface-chip px-3 py-2 text-left ${active ? "motus-surface-chip--active" : ""}`}
                            >
                              {plan.title}
                              <span className="ml-1 font-normal text-slate-500">
                                · {memberOwned ? "Din" : "PT"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    {activePeriodPlan ? (
                      <PeriodPlanActiveView
                        plan={activePeriodPlan}
                        isMemberOwned={isMemberOwnedPeriodPlan(activePeriodPlan, trainerPeriodPlanIds)}
                        swapsByPlan={periodPlanSwapsByPlan}
                            selectedWeekNumber={selectedPeriodPlanWeekForView}
                            onWeekSelectByNumber={setSelectedPeriodPlanWeekNumber}
                            currentWeekNumber={activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : null}
                        resolveEntryDate={resolvePeriodPlanEntryDate}
                              memberPrograms={memberProgramsForPeriodPlan}
                              actionStatus={periodPlanActionStatus}
                              isEntryCompleted={isPeriodPlanEntryCompleted}
                              onToggleCompleted={togglePeriodPlanEntryCompleted}
                              onSwapDays={swapPeriodPlanDays}
                              onMoveDay={movePeriodPlanDay}
                              onResetSwaps={resetPeriodPlanSwapsForWeek}
                              onStartProgram={handlePeriodPlanStartProgram}
                              onLogGroup={handlePeriodPlanLogGroup}
                              exerciseLibrary={exercises}
                            />
                    ) : null}
                  </div>
                ) : memberHasVisiblePeriodPlan ? (
                  <p className="mt-4 text-sm text-slate-600">Ukeplanen er minimert. Trykk «Vis ukeplan» for å se dagene.</p>
                ) : null}
                <div className="mt-4 rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                  <button
                    type="button"
                    onClick={() => setShowPeriodPlanManageSection((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="text-sm font-semibold text-slate-800">Administrer planer</span>
                    <span className="text-xs font-medium text-slate-500">
                      {showPeriodPlanManageSection ? "Skjul" : "Vis"}
                    </span>
                  </button>
                  {showPeriodPlanManageSection ? (
                    <div className="mt-3 space-y-2">
                      {visiblePeriodPlans.length === 0 ? (
                        <p className="text-sm text-slate-600">Ingen synlige planer akkurat nå. Bruk «Skjulte planer» nedenfor.</p>
                      ) : null}
                      {visiblePeriodPlans.map((plan) => {
                              const active = activePeriodPlan?.id === plan.id;
                              const memberOwned = isMemberOwnedPeriodPlan(plan, trainerPeriodPlanIds);
                              return (
                                <div
                                  key={plan.id}
                                  className={`rounded-xl border bg-white p-3 ${active ? "border-teal-200 ring-1 ring-teal-100" : ""}`}
                                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                      type="button"
                                      onClick={() => selectActiveMemberPeriodPlan(plan.id)}
                                      className="min-w-0 text-left"
                                    >
                                      <div className="text-sm font-semibold text-slate-900">{plan.title}</div>
                                      <div className="mt-0.5 text-xs text-slate-500">
                                        {plan.weeks} {plan.weeks === 1 ? "uke" : "uker"} · start {plan.startDate}
                                        {active ? " · Aktiv" : ""}
                                      </div>
                                    </button>
                                    <div className="flex shrink-0 flex-wrap gap-1.5">
                                      {memberOwned ? (
                                        <DangerButton
                                          type="button"
                                          className="rounded-lg px-2 py-1 text-[11px] font-medium"
                                          onClick={() =>
                                            setConfirmDialog({
                                              title: "Slette periodeplan?",
                                              message: `Dette fjerner «${plan.title.trim()}» fra dine periodeplaner.`,
                                              confirmLabel: "Slett",
                                              tone: "danger",
                                              onConfirm: () => deleteMemberOwnedPeriodPlan(plan),
                                            })
                                          }
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span>Slett</span>
                                          </span>
                                        </DangerButton>
                                      ) : (
                                        <OutlineButton
                                          type="button"
                                          className="rounded-lg px-2 py-1 text-[11px] font-medium"
                                          onClick={() => hideTrainerPeriodPlan(plan.id)}
                                        >
                                          <span className="inline-flex items-center gap-1.5">
                                            <EyeOff className="h-3.5 w-3.5" />
                                            <span>Skjul</span>
                                          </span>
                                        </OutlineButton>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {hiddenPeriodPlans.length > 0 ? (
                              <div className="mt-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                <button
                                  type="button"
                                  onClick={() => setShowPeriodPlanHiddenSection((open) => !open)}
                                  className="flex w-full items-center justify-between gap-2 text-left"
                                >
                                  <span className="text-sm font-semibold text-slate-800">
                                    Skjulte planer ({hiddenPeriodPlans.length})
                                  </span>
                                  <span className="text-xs font-medium text-slate-500">
                                    {showPeriodPlanHiddenSection ? "Skjul liste" : "Vis liste"}
                                  </span>
                                </button>
                                {showPeriodPlanHiddenSection ? (
                                  <div className="mt-3 space-y-2">
                                    {hiddenPeriodPlans.map((plan) => (
                                      <div
                                        key={plan.id}
                                        className="flex flex-col gap-2 rounded-xl border bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                                        style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                      >
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Skjult</div>
                                          <div className="font-medium text-sm text-slate-800">{plan.title}</div>
                                        </div>
                                        <OutlineButton
                                          type="button"
                                          className="w-full shrink-0 px-3 py-2 text-xs sm:w-auto"
                                          onClick={() => unhideTrainerPeriodPlan(plan.id)}
                                        >
                                          Vis igjen
                                        </OutlineButton>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              ) : (
                <div className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                  <div className="flex min-w-0 items-start gap-2">
                    <MotusSectionIcon className="!p-2">
                      <CalendarRange className="h-4 w-4" aria-hidden />
                    </MotusSectionIcon>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Periodeplan</div>
                      <div className="mt-1 text-lg font-bold text-slate-950">Ingen ukeplan ennå</div>
                      <p className="mt-1 text-sm text-slate-600">Legg til en plan fra Inspo, eller be PT om en periodeplan.</p>
                    </div>
                  </div>
                </div>
              )
              ) : null}
              {trainingSection === "history" ? (
                <MemberTrainingHistoryView
                  memberLogs={memberLogs}
                  completedLogs={completedLogs}
                  allLogsForSessions={allMemberLogsSorted}
                  personalRecords={personalRecords}
                  exercises={exercises}
                  programs={memberPrograms}
                  nowTimestamp={nowTimestamp}
                  streakWeeks={streakWeeks}
                  muscleSplitStats={muscleSplitStats}
                  muscleSplitMetric={muscleSplitMetric}
                  muscleSplitPeriod={muscleSplitPeriod}
                  onMuscleSplitMetricChange={setMuscleSplitMetric}
                  onMuscleSplitPeriodChange={setMuscleSplitPeriod}
                  onOpenProgress={() => setMemberTab("progress")}
                  onOpenProgressExercise={setPrProgressExerciseName}
                  focusLogId={memberFocusWorkoutLogId}
                  logListProps={{
                    expandedLogId: expandedRecentLogId,
                    onToggleExpanded: (logId) => setExpandedRecentLogId((prev) => (prev === logId ? null : logId)),
                    lastDeletedMessage: Boolean(lastDeletedLogResult),
                    onUndoDelete: undoDeleteLoggedExercise,
                    editingKey: editingLoggedExerciseKey,
                    editingDraft: editingLoggedExerciseDraft,
                    onStartEdit: startEditLoggedExercise,
                    onSaveEdit: saveEditLoggedExercise,
                    onCancelEdit: cancelEditLoggedExercise,
                    onDeleteExercise: handleDeleteLoggedExercise,
                    onDraftChange: setEditingLoggedExerciseDraft,
                  }}
                />
              ) : null}
              </div>
              <IntervalWorkoutSessionModal
                open={showIntervalTimerModal}
                program={activeIntervalProgram}
                exercises={exercises}
                memberId={activeMemberId}
                memberEmail={editableMember?.email ?? currentUserEmail}
                onClose={() => {
                  pendingPeriodPlanWorkoutStartRef.current = null;
                  setShowIntervalTimerModal(false);
                }}
                onSaved={() => {
                  setIntervalTimerStatus("Kondisjonsøkten er lagret. PT kan se den i loggen.");
                  setShowIntervalTimerModal(false);
                }}
                logIntervalWorkout={handleLogIntervalWorkout}
              />
            </>
          ) : null}

          {!isMemberLimited && memberTab === "progress" ? (
            <div className="motus-progress-page">
              <MemberProgressScoresCard
                scores={memberProgressScores}
                memberFirstName={homeFirstName}
                streakWeeks={streakWeeks}
                xpBreakdown={{
                  completedSessions: completedLogs.length,
                  streakWeeks: memberProgress.streakWeeks,
                  achievedLevel: memberProgress.achievedLevel,
                }}
              />
              <MemberProgressStatusBanner
                workoutsLast7Days={progressShareLast7Days.workouts}
                trainingDaysLast7Days={progressShareLast7Days.trainingDays}
              />
              <MemberConsistencyWeekCard
                completedLogs={completedLogs}
                nowTimestamp={nowTimestamp}
              />
              <MemberProgressHighlightRow
                streakWeeks={streakWeeks}
                recentStreakWeeks={recentStreakWeeks}
                personalRecordsCount={personalRecords.length}
              />
              <MemberNextWorkoutCard
                title={
                  todayPlanEntry.trim() ||
                  homeWorkoutProgram?.title ||
                  null
                }
                subline={
                  todayPlanEntry.trim() && homeWorkoutProgram?.title && homeWorkoutProgram.title !== todayPlanEntry.trim()
                    ? `Program: ${homeWorkoutProgram.title}`
                    : homeWorkoutProgram?.goal?.trim() || homeWorkoutProgram?.notes?.trim() || null
                }
                source={
                  todayPlanEntry.trim()
                    ? "plan"
                    : homeWorkoutProgram
                      ? "library"
                      : "empty"
                }
                programId={homeWorkoutProgram?.id ?? null}
                coverSrc={homeDisplayCoverSrc}
                journeyStep={achievementLevel ?? null}
                journeyStepLabel={memberProgress.stepLabel ?? null}
                journeyNextStepLabel={memberProgress.nextStepLabel ?? null}
                onStart={(programId) => {
                  const program = memberPrograms.find((p) => p.id === programId);
                  if (!program) return;
                  startMemberProgram(program);
                }}
              />

              <MemberPersonalRecordsSection
                records={personalRecords}
                previewRecords={personalRecordsPreview}
                showAll={showAllPersonalRecords}
                onToggleShowAll={() => setShowAllPersonalRecords((prev) => !prev)}
                favoriteNames={cleanedFavoritePersonalRecordNames}
                onToggleFavorite={toggleFavoritePersonalRecord}
                onOpenProgress={setPrProgressExerciseName}
                onShare={(record) => void sharePersonalRecordEntry(record)}
                exercises={exercises}
                profileSaveInfo={profileSaveInfo && memberTab === "progress" ? profileSaveInfo : null}
              />

              <MuscleSplitCard
                stats={muscleSplitStats}
                metric={muscleSplitMetric}
                period={muscleSplitPeriod}
                onMetricChange={setMuscleSplitMetric}
                onPeriodChange={setMuscleSplitPeriod}
              />

              <MemberWeeklySummaryCard
                stats={progressShareLast7Days}
                playfulLine={progressLiftPlayfulLine}
                logoSrc={motusShareLogoSrc}
                weekLabel={progressShareWeekLabel}
                title={progressShareTitle}
                seierText={progressShareSeierText}
                formatActivityTime={formatActivityTime}
                onShare={() => void shareMonthlyProgressSummary()}
                shareStatus={progressShareStatus}
              />
            </div>
          ) : null}

          {!isMemberLimited && memberTab === "messages" ? (
            <MotusChat
              variant="member"
              messages={memberMessages}
              viewerRole="member"
              counterpartyName={chatTrainerName}
              composeValue={messageText}
              onComposeChange={(value) => {
                setMessageText(value);
                      if (memberChatSendStatus) setMemberChatSendStatus(null);
                    }}
              onSend={() => {
                    if (!activeMemberId || !messageText.trim()) return;
                    void dispatchMemberMessageToRelatedMembers(messageText);
                    setMessageText("");
              }}
              isSending={isSendingMemberMessage}
              sendDisabled={!messageText.trim()}
              composePlaceholder="Skriv melding..."
              sendStatus={memberChatSendStatus}
              messagesContainerRef={memberMessagesContainerRef}
              quickActions={memberChatQuickActions}
              onToggleReaction={toggleChatMessageReaction}
            />
          ) : null}

          {memberTab === "profile" ? (
            editableMember ? (
              <MemberProfileDashboard
                memberFirstName={homeFirstName}
                memberAvatarUrl={memberAvatarUrl}
                onAvatarFileSelected={handleAvatarFileSelected}
                onRemoveAvatar={() => setMemberAvatarUrl("")}
                customerStatusLabel={customerStatusLabel}
                latestCompletedLog={latestCompletedLog}
                memberNameDraft={memberNameDraft}
                setMemberNameDraft={setMemberNameDraft}
                memberEmailDraft={memberEmailDraft}
                setMemberEmailDraft={setMemberEmailDraft}
                memberPhoneDraft={memberPhoneDraft}
                setMemberPhoneDraft={setMemberPhoneDraft}
                memberBirthDateDraft={memberBirthDateDraft}
                setMemberBirthDateDraft={setMemberBirthDateDraft}
                memberGoalDraft={memberGoalDraft}
                setMemberGoalDraft={setMemberGoalDraft}
                memberInjuriesDraft={memberInjuriesDraft}
                setMemberInjuriesDraft={setMemberInjuriesDraft}
                streakWeeks={streakWeeks}
                streakSubline={streakSubline}
                totalWorkouts={completedLogs.length}
                memberSince={editableMember.invitedAt ?? ""}
                onOpenProgress={() => setMemberTab("progress")}
                onSaveProfile={saveProfile}
                profileSaveInfo={profileSaveInfo}
                isMemberLimited={isMemberLimited}
                onOpenOnboarding={onOpenOnboarding}
                showOnboardingHomePrompt={showOnboardingHomePrompt}
                onboardingSubstantivelyComplete={onboardingSubstantivelyComplete}
                ptChangeReason={ptChangeReason}
                setPtChangeReason={(value) => {
                  setPtChangeReason(value);
                            if (ptChangeRequestStatus) setPtChangeRequestStatus(null);
                          }}
                onRequestPtChange={() => void handleRequestPtChange()}
                isSendingMemberMessage={isSendingMemberMessage}
                ptChangeRequestStatus={ptChangeRequestStatus}
                onOpenMessages={() => setMemberTab("messages")}
                restCountdownEnabled={restCountdownEnabled}
                setRestCountdownEnabled={setRestCountdownEnabled}
                microCelebrationsEnabled={microCelebrationsEnabled}
                setMicroCelebrationsEnabled={setMicroCelebrationsEnabled}
                celebrationSoundEnabled={celebrationSoundEnabled}
                setCelebrationSoundEnabled={setCelebrationSoundEnabled}
                showWebPushSettings={!isMemberLimited && Boolean(supabaseClient) && isWebPushConfigurable()}
                onRegisterWebPush={() => void handleRegisterWebPush()}
                pushRegisterBusy={pushRegisterBusy}
                pushRegisterStatus={pushRegisterStatus}
              />
            ) : (
              <Card className="p-5">
                <EmptyState
                  icon="👤"
                  title="Fant ingen medlemsprofil"
                  description="Prøv å logge ut og inn igjen."
                  className="mt-4"
                  action={
                    <OutlineButton onClick={() => setMemberTab("overview")} className="w-full sm:w-auto">
                      Gå til oversikt
                    </OutlineButton>
                  }
                />
            </Card>
            )
          ) : null}
        </div>
      </div>
    </div>
    <LiveWorkoutSessionModal
      variant="member"
      workoutMode={workoutMode}
      activeProgram={activeWorkoutProgram}
      exercises={exercises}
      onBeforeNextExercise={maybeCelebrateCurrentWorkoutGroup}
      onWorkoutExerciseIndexChange={setSyncedWorkoutExerciseIndex}
      updateWorkoutExerciseResult={updateWorkoutExerciseResult}
      replaceWorkoutExerciseGroup={replaceWorkoutExerciseGroup}
      appendWorkoutSetForProgramExercise={appendWorkoutSetForProgramExercise}
      deferWorkoutExerciseGroup={deferWorkoutExerciseGroup}
      updateWorkoutModeNote={updateWorkoutModeNote}
      updateWorkoutExerciseNote={updateWorkoutExerciseNote}
      finishWorkoutMode={handleFinishWorkoutMode}
      cancelWorkoutMode={handleCancelWorkoutMode}
      restCountdownEnabled={restCountdownEnabled}
      previousPersonalBests={previousPersonalBestsByExercise}
      lastSessionByExercise={lastSessionResultsByExercise}
      onDismissWorkout={() => {
        handleDismissWorkoutMode();
      }}
    />
    {prProgressExerciseName ? (
      <PersonalRecordProgressModal
        exerciseName={prProgressExerciseName}
        logs={completedLogs}
        memberDisplayName={memberShareDisplayName}
        shareLogoSrc={motusShareLogoSrc}
        onShareStatus={setMotusCardShareStatus}
        onClose={() => setPrProgressExerciseName(null)}
      />
    ) : null}
    <ConfirmDialog
      open={Boolean(confirmDialog)}
      title={confirmDialog?.title ?? ""}
      message={confirmDialog?.message ?? ""}
      confirmLabel={confirmDialog?.confirmLabel}
      tone={confirmDialog?.tone}
      onCancel={() => setConfirmDialog(null)}
      onConfirm={() => {
        const action = confirmDialog?.onConfirm;
        setConfirmDialog(null);
        action?.();
      }}
    />
    </>
  );
}
