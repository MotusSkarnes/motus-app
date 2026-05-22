import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  ClipboardPenLine,
  Dumbbell,
  Eye,
  EyeOff,
  History,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Play,
  Printer,
  Search,
  Share2,
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
import motusSkrytekortLogo from "../assets/motus-skrytekort-logo.png";
import { formatDateDdMmYyyy, parseStoredLogDate, resolveWorkoutLogDateTime, storedLogDatesMatch } from "../app/dateFormat";
import { isHoldBasedExerciseCategory, programExerciseHoldSeconds } from "../app/exerciseCategories";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import {
  enrichMemberWithBestProfile,
  hasSubstantiveOnboardingAnswers,
  parsePersonalGoalsJson,
  pickCanonicalMemberRowForProfile,
  readProfileExtensions,
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
import { memberMayDeleteProgram, programAuthorCreditForMember } from "../app/programAuthor";
import {
  buildCheckInNotificationCopy,
  resolveCheckInWindow,
  shouldPromptMonthlyCheckIn,
} from "../app/memberMonthlyCheckIn";
import { isLikelyValidBirthDate, normalizeBirthDate, normalizePhone } from "../app/validators";
import { supabaseClient } from "../services/supabaseClient";
import { isWebPushConfigurable, registerWebPushWithSupabase } from "../services/webPush";
import { Card, ConfirmDialog, DangerButton, EmptyState, GradientButton, MemberTabHero, OutlineButton, SelectBox, StatusMessage, TextArea, TextInput } from "../app/ui";
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
  findProgramForPeriodPlanEntry,
  groupWorkoutLogTitle,
  isGroupPeriodPlanEntry,
  isPeriodPlanEntryDateInFuture,
  resolveGroupClassNameFromPeriodEntry,
  resolvePeriodPlanEntryAction,
} from "../app/periodPlanEntryActions";
import {
  buildPeriodPlanWeekNavItemsFromPlan,
  buildTrainerPeriodPlanIdSet,
  isMemberOwnedPeriodPlan,
  mergedPeriodPlanListForMember,
  periodPlanSelectableWeekCount,
  readHiddenPeriodPlanIdsForMembers,
  readPeriodPlansByMemberId,
  removeMemberOwnedPeriodPlanFromStorage,
  findPeriodPlanEntryForCalendarDateInPlans,
  findTodayPeriodPlanEntryInPlans,
  parsePeriodPlanStartDate,
  resolvePeriodPlanPlannedDate,
  resolvePeriodPlanWeek,
  writeHiddenPeriodPlanIdsForMembers,
} from "../app/periodPlanMerge";
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
  type MemberBadge,
} from "../app/memberBadges";
import {
  ACHIEVEMENT_MAX_LEVEL,
  buildCelebrationCopy,
  computeMemberProgressState,
} from "../app/memberProgressGamification";
import { MemberBadgesCarousel } from "./MemberBadgesCarousel";
import { MemberHabitSummaryCard } from "./MemberHabitSummaryCard";
import { MemberTrainingFlowCard } from "./MemberTrainingFlowCard";
import { MuscleSplitCard } from "./MuscleSplitCard";
import { IntervalWorkoutSessionModal } from "./IntervalWorkoutSessionModal";
import { LiveWorkoutSessionModal } from "./LiveWorkoutSessionModal";
import { PersonalRecordProgressModal } from "./PersonalRecordProgressModal";
import { PeriodPlanWeekNavigator } from "./PeriodPlanWeekNavigator";
import { PeriodPlanWeekView } from "./PeriodPlanWeekView";
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
  memberFocusWorkoutLogId?: string | null;
  clearMemberFocusWorkoutLogId?: () => void;
  memberFocusProgramId?: string | null;
  clearMemberFocusProgramId?: () => void;
  /** Periodeplaner fra Supabase (hydrate-member-data). */
  remoteMemberPeriodPlanRows?: Array<{ memberId: string; plan: PeriodSchedulePlan }>;
  /** Etter lagring: kjør hydrate fra Supabase (persist er asynk) */
  refreshRemoteHydration?: () => void | Promise<void>;
  onOpenMonthlyCheckIn?: () => void;
  onOpenOnboarding?: () => void;
  showOnboardingHomePrompt?: boolean;
  /** Når false: vis knapp for å fylle ut / sende skjema på nytt (f.eks. etter mislykket sky-lagring). */
  onboardingSubstantivelyComplete?: boolean;
};

const MEMBER_AVATAR_BUCKET = "exercise-images";
const MEMBER_AVATAR_PREFIX = "member-avatars";
const EMPTY_REMOTE_PERIOD_PLAN_ROWS: Array<{ memberId: string; plan: PeriodSchedulePlan }> = [];
const PERIOD_PLAN_COMPLETED_STORAGE_PREFIX = "MOTUS_PERIOD_PLAN_COMPLETED_V1:";
const HIDDEN_BADGE_SEEN_STORAGE_PREFIX = "MOTUS_HIDDEN_BADGE_SEEN_V1:";
const HIDDEN_BADGE_IMAGES: Record<string, string> = {
  "may-17-workout": "/badges/21-17-mai.svg",
  "never-two-weeks-without": "/badges/22-aldri-to-uker-uten.svg",
  "back-again": "/badges/23-tilbake-igjen.svg",
  "habit-sticks": "/badges/24-vanen-sitter.svg",
  "before-sunrise": "/badges/25-for-sola.svg",
  "evening-trainer": "/badges/04-kveldsskiftet.png",
  "summer-loyal": "/badges/26-sommertrofast.svg",
  "new-start": "/badges/27-ny-start.svg",
  "easter-pump": "/badges/28-paskepump.svg",
  "christmas-pump": "/badges/29-julepump.svg",
};
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
  return pickBestPersonalGoals(candidates.map((member) => member.personalGoals)) || anchor.personalGoals || "";
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

function computeShareCardLast7DaysStats(
  completedLogs: WorkoutLog[],
  nowTimestamp: number,
): { workouts: number; trainingDays: number; volumeKg: number; completedSets: number } {
  const today = getStartOfDay(new Date(nowTimestamp));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

  const parseNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? "").replace(",", ".").trim());
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  let workouts = 0;
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

  return {
    workouts,
    trainingDays: dayKeys.size,
    volumeKg,
    completedSets,
  };
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
      return "bg-emerald-500/35 text-emerald-50 ring-1 ring-emerald-300/50";
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
    memberFocusWorkoutLogId = null,
    clearMemberFocusWorkoutLogId,
    memberFocusProgramId = null,
    clearMemberFocusProgramId,
    remoteMemberPeriodPlanRows = EMPTY_REMOTE_PERIOD_PLAN_ROWS,
    refreshRemoteHydration,
    onOpenMonthlyCheckIn,
    onOpenOnboarding,
    showOnboardingHomePrompt = false,
    onboardingSubstantivelyComplete = false,
  } = props;
  const [messageText, setMessageText] = useState("");
  const [memberChatSendStatus, setMemberChatSendStatus] = useState<string | null>(null);
  const isSendingMemberMessageRef = useRef(false);
  const [isSendingMemberMessage, setIsSendingMemberMessage] = useState(false);
  const [trainingSection, setTrainingSection] = useState<"today" | "programs" | "custom" | "period" | "history">("today");
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
  const [pushRegisterBusy, setPushRegisterBusy] = useState(false);
  const [pushRegisterStatus, setPushRegisterStatus] = useState<string | null>(null);
  const [customWorkoutSearch, setCustomWorkoutSearch] = useState("");
  const [customWorkoutCategoryFilter, setCustomWorkoutCategoryFilter] = useState<string>("all");
  const [showAllCustomWorkoutOptions, setShowAllCustomWorkoutOptions] = useState(false);
  const [showAllPersonalRecords, setShowAllPersonalRecords] = useState(false);
  const [prProgressExerciseName, setPrProgressExerciseName] = useState<string | null>(null);
  const [muscleSplitPeriod, setMuscleSplitPeriod] = useState<MuscleSplitPeriod>(28);
  const [muscleSplitMetric, setMuscleSplitMetric] = useState<MuscleSplitMetric>("sets");
  const [favoritePersonalRecordNames, setFavoritePersonalRecordNames] = useState<string[]>([]);
  const [favoritePersonalRecordPreferencesHydrated, setFavoritePersonalRecordPreferencesHydrated] = useState(false);
  const [profileMetricsHydrated, setProfileMetricsHydrated] = useState(false);
  const [customWorkoutLines, setCustomWorkoutLines] = useState<
    Array<{ key: string; exerciseId: string; sets: string; reps: string; weight: string; holdSeconds?: string }>
  >([]);
  const [memberSavedProgramTitle, setMemberSavedProgramTitle] = useState("Mitt treningsprogram");
  const [customProgramSaveStatus, setCustomProgramSaveStatus] = useState<string | null>(null);
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
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
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
  const [periodPlans, setPeriodPlans] = useState<PeriodSchedulePlan[]>([]);
  const [showPeriodPlanPanel, setShowPeriodPlanPanel] = useState(true);
  const [activeMemberPeriodPlanId, setActiveMemberPeriodPlanId] = useState<string | null>(null);
  const [selectedPeriodPlanWeekNumber, setSelectedPeriodPlanWeekNumber] = useState<number | null>(null);
  const [periodPlanActionStatus, setPeriodPlanActionStatus] = useState<string | null>(null);
  const [hiddenPeriodPlanIds, setHiddenPeriodPlanIds] = useState<string[]>([]);
  const [showPeriodPlanHiddenSection, setShowPeriodPlanHiddenSection] = useState(false);
  const [showPeriodPlanManageSection, setShowPeriodPlanManageSection] = useState(false);
  const [periodPlanStorageRevision, setPeriodPlanStorageRevision] = useState(0);
  const [completedPeriodPlanEntryKeys, setCompletedPeriodPlanEntryKeys] = useState<string[]>([]);
  const [periodPlanSwapsByPlan, setPeriodPlanSwapsByPlan] = useState<PeriodPlanSwapsByPlan>({});
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
  const periodPlanSwapsDirtyRef = useRef(false);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [programLibraryMenuId, setProgramLibraryMenuId] = useState<string | null>(null);

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
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const motusShareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-02`;
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
  useAutoClearStatus(customProgramSaveStatus, () => setCustomProgramSaveStatus(null), getStatusClearDelayMs(customProgramSaveStatus));
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
      const personalGoals = patchMemberNotificationPreferencesInPersonalGoals(anchor.personalGoals, patch);
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
  const visiblePeriodPlans = useMemo(
    () => periodPlans.filter((plan) => !hiddenPeriodPlanIds.includes(plan.id)),
    [periodPlans, hiddenPeriodPlanIds],
  );
  const hiddenPeriodPlans = useMemo(
    () => periodPlans.filter((plan) => hiddenPeriodPlanIds.includes(plan.id)),
    [periodPlans, hiddenPeriodPlanIds],
  );
  const memberHasVisiblePeriodPlan = visiblePeriodPlans.length > 0;
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
  }, [programs, relatedMemberIdSet, currentUserRole]);
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
  const primaryPausedWorkout = pausedWorkouts[0] ?? null;
  const secondaryPausedWorkouts = pausedWorkouts.slice(1);
  const nextProgram = memberProgramsInActiveLibrary[0] ?? null;
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
  const nowTimestamp = useMemo(() => Date.now(), []);
  const nowDate = useMemo(() => new Date(nowTimestamp), [nowTimestamp]);
  const exerciseCategoryById = useMemo(() => {
    const byId = new Map<string, Exercise["category"]>();
    exercises.forEach((exercise) => {
      byId.set(exercise.id, exercise.category);
    });
    return byId;
  }, [exercises]);
  const intervalPrograms = useMemo(
    () =>
      memberProgramsInActiveLibrary.filter((program) => {
        if (program.exercises.length === 0) return false;
        return program.exercises.every((exercise) => {
          const category = exerciseCategoryById.get(exercise.exerciseId);
          const hasTimedStep = Number(exercise.durationMinutes) > 0;
          return category === "Kondisjon" && hasTimedStep;
        });
      }),
    [memberProgramsInActiveLibrary, exerciseCategoryById],
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
      const workDurationSeconds = Math.max(0, Math.round((Number(exercise.durationMinutes) || 0) * 60));
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
    const day = new Date(nowTimestamp).getDay();
    if (day === 0) return "sunday";
    if (day === 1) return "monday";
    if (day === 2) return "tuesday";
    if (day === 3) return "wednesday";
    if (day === 4) return "thursday";
    if (day === 5) return "friday";
    return "saturday";
  }, [nowTimestamp]);
  const activePeriodPlan =
    visiblePeriodPlans.find((plan) => plan.id === activeMemberPeriodPlanId) ?? visiblePeriodPlans[0] ?? null;
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
    if (!visiblePeriodPlans.length) return null;
    return findTodayPeriodPlanEntryInPlans(
      visiblePeriodPlans,
      getStartOfDay(new Date(nowTimestamp)),
      periodPlanSwapsByPlan,
      activePeriodPlanId,
      activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : null,
      currentWeekdayKey,
    );
  }, [
    visiblePeriodPlans,
    nowTimestamp,
    periodPlanSwapsByPlan,
    activePeriodPlanId,
    activePeriodWeekIndex,
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
      const suggestedWeight = resolveSuggestedWorkoutWeight(exercise).trim();
      if (!suggestedWeight) return;
      suggestedWeightByProgramExerciseId[exercise.id] = suggestedWeight;
    });
    return { suggestedWeightByProgramExerciseId };
  }

  const customWorkoutCategories = useMemo(() => {
    const categories = Array.from(
      new Set(
        exercises
          .map((exercise) => exercise.category.trim())
          .filter(Boolean),
      ),
    );
    return categories.sort((a, b) => a.localeCompare(b, "nb"));
  }, [exercises]);

  const CUSTOM_WORKOUT_BANK_PREVIEW = 40;
  const customWorkoutBankFiltered = useMemo(() => {
    const q = customWorkoutSearch.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (customWorkoutCategoryFilter !== "all" && ex.category !== customWorkoutCategoryFilter) return false;
      if (!q) return true;
      return ex.name.toLowerCase().includes(q) || ex.group.toLowerCase().includes(q) || ex.equipment.toLowerCase().includes(q);
    });
  }, [exercises, customWorkoutSearch, customWorkoutCategoryFilter]);
  const customWorkoutExerciseOptions = useMemo(() => {
    const list = customWorkoutBankFiltered;
    const hasSearch = Boolean(customWorkoutSearch.trim());
    if (showAllCustomWorkoutOptions || hasSearch) return list;
    return list.slice(0, CUSTOM_WORKOUT_BANK_PREVIEW);
  }, [customWorkoutBankFiltered, showAllCustomWorkoutOptions, customWorkoutSearch]);
  const customWorkoutBankOverflow = Math.max(0, customWorkoutBankFiltered.length - CUSTOM_WORKOUT_BANK_PREVIEW);

  useEffect(() => {
    setShowAllCustomWorkoutOptions(false);
  }, [customWorkoutSearch, customWorkoutCategoryFilter]);

  function removeCustomWorkoutLine(key: string) {
    setCustomWorkoutLines((prev) => prev.filter((line) => line.key !== key));
  }

  function updateCustomWorkoutLine(
    key: string,
    patch: Partial<{ exerciseId: string; sets: string; reps: string; weight: string; holdSeconds: string }>,
  ) {
    setCustomWorkoutLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function buildCustomWorkoutProgramExercises(): ProgramExercise[] | null {
    if (!activeMemberId.trim()) return null;
    const built: ProgramExercise[] = [];
    for (const line of customWorkoutLines) {
      const ex = exercises.find((e) => e.id === line.exerciseId);
      if (!ex) continue;
      const isStretch = isHoldBasedExerciseCategory(ex.category);
      built.push({
        id: uid("prog-ex"),
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: line.sets.trim() || (isStretch ? "2" : "3"),
        reps: line.reps.trim() || (isStretch ? "1" : "10"),
        weight: isStretch ? "" : line.weight.trim(),
        holdSeconds: isStretch ? (line.holdSeconds ?? "").trim() || "30" : "",
        restSeconds: "60",
        notes: "",
      });
    }
    return built.length ? built : null;
  }

  function handleStartCustomWorkout() {
    const built = buildCustomWorkoutProgramExercises();
    if (!built) return;
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

  function handleSaveMemberTrainingProgram() {
    const built = buildCustomWorkoutProgramExercises();
    if (!built) return;
    const title = memberSavedProgramTitle.trim() || "Mitt treningsprogram";
    const authorFull = viewedMember?.name?.trim() || currentUserEmail.trim() || "Medlem";
    const optimisticProgramId = uid("program");
    saveProgramForMember({
      id: optimisticProgramId,
      title,
      goal: "",
      notes: "",
      memberId: activeMemberId,
      exercises: built.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
      programCreatedBy: "member",
      programCreatedByName: authorFull,
      onPersisted: (result) => {
        if (!result.ok) {
          deleteProgramById(optimisticProgramId);
          setCustomProgramSaveStatus(`Kunne ikke lagre i skyen: ${result.message?.trim() || "Prøv igjen."}`);
          return;
        }
        setCustomProgramSaveStatus(`«${title}» er lagret og synkronisert.`);
        void refreshRemoteHydration?.();
      },
    });
    setCustomWorkoutLines([]);
    setCustomWorkoutSearch("");
    setCustomProgramSaveStatus(`Lagrer «${title}» i skyen…`);
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
  function addCustomWorkoutLine(exerciseId: string) {
    const id = exerciseId.trim();
    if (!id) return;
    setCustomWorkoutLines((prev) => {
      if (prev.some((line) => line.exerciseId === id)) return prev;
      const ex = exercises.find((e) => e.id === id);
      const isStretch = Boolean(ex?.category && isHoldBasedExerciseCategory(ex.category));
      const weightHint = ex && !isStretch ? findSuggestedWeightForExercise(ex.name) : "";
      const secHint = ex && isStretch ? findSuggestedWeightForExercise(ex.name) : "";
      return [
        ...prev,
        {
          key: uid("row"),
          exerciseId: id,
          sets: isStretch ? "2" : "3",
          reps: isStretch ? "1" : "10",
          weight: isStretch ? "" : weightHint,
          holdSeconds: isStretch ? (secHint || "30") : "",
        },
      ];
    });
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
    const byDay = new Map<number, string[]>();
    visiblePeriodPlans.forEach((plan) => {
      (plan.weeklyPlans ?? []).forEach((week) => {
        WEEKDAY_PLAN_ORDER.forEach((weekdayKey) => {
          const swaps = getSwapsForWeek(periodPlanSwapsByPlan, plan.id, week.weekNumber);
          const effectiveDays = applyPeriodPlanSwaps(week.days, swaps);
          const plannedEntry = effectiveDays[weekdayKey]?.trim() ?? "";
          if (!plannedEntry) return;
          const plannedDate = resolvePeriodPlanPlannedDate(plan, week.weekNumber, weekdayKey);
          if (!plannedDate) return;
          if (plannedDate.getMonth() !== calendarMonth.getMonth() || plannedDate.getFullYear() !== calendarMonth.getFullYear()) return;
          const day = plannedDate.getDate();
          const previous = byDay.get(day) ?? [];
          byDay.set(day, [...previous, plannedEntry]);
        });
      });
    });
    return byDay;
  }, [visiblePeriodPlans, periodPlanSwapsByPlan, calendarMonth]);
  const calendarDayStatusByDay = useMemo(() => {
    const statusByDay = new Map<number, "completed" | "planned" | "missed">();
    const todayStart = getStartOfDay(new Date(nowTimestamp));
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
  }, [calendarPlannedEntriesByDay, calendarDayLoad, calendarMonth, nowTimestamp]);
  const selectedCalendarLogs = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return calendarLogsByDay.get(selectedCalendarDay) ?? [];
  }, [calendarLogsByDay, selectedCalendarDay]);
  const selectedCalendarPlannedEntries = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return calendarPlannedEntriesByDay.get(selectedCalendarDay) ?? [];
  }, [calendarPlannedEntriesByDay, selectedCalendarDay]);
  const selectedCalendarPeriodMatch = useMemo(() => {
    if (!selectedCalendarDay) return null;
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), selectedCalendarDay);
    return findPeriodPlanEntryForCalendarDateInPlans(
      visiblePeriodPlans,
      date,
      periodPlanSwapsByPlan,
      activePeriodPlanId,
    );
  }, [selectedCalendarDay, calendarMonth, visiblePeriodPlans, periodPlanSwapsByPlan, activePeriodPlanId]);
  const selectedCalendarPlanEntry = selectedCalendarPeriodMatch?.entry?.trim() ?? selectedCalendarPlannedEntries[0]?.trim() ?? "";
  const selectedCalendarPlanAction = useMemo(
    () =>
      selectedCalendarPlanEntry
        ? resolvePeriodPlanEntryAction(selectedCalendarPlanEntry, memberProgramsForPeriodPlan)
        : { kind: "none" as const },
    [selectedCalendarPlanEntry, memberProgramsForPeriodPlan],
  );
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
      .sort((a, b) => b.score - a.score);
  }, [completedLogs]);
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
  const activeCelebration = liveWorkoutCelebration ?? workoutCelebration;
  /** Ny PR / økt rekord: alltid synlig for aktiv bruker (uavhengig av «små feiringer»). */
  const shouldShowPrCelebration = Boolean(activeCelebration && activeCelebration.memberId === activeMemberId);

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
      pickCanonicalMemberRowForProfile(editableMember, members).personalGoals ||
        editableMember.personalGoals,
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

  useEffect(() => {
    if (!activePeriodPlanId || activePeriodSelectableWeekCount === 0) {
      setSelectedPeriodPlanWeekNumber(null);
      return;
    }
    const fallbackWeekNumber = activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : 1;
    setSelectedPeriodPlanWeekNumber((prev) => {
      if (prev == null) return fallbackWeekNumber;
      const weekExists = Number(prev) >= 1 && Number(prev) <= activePeriodSelectableWeekCount;
      return weekExists ? prev : fallbackWeekNumber;
    });
  }, [activePeriodPlanId, activePeriodSelectableWeekCount, activePeriodWeekIndex]);

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
    periodPlanCompletedDirtyRef.current = false;
    if (!editableMember || typeof window === "undefined") {
      setCompletedPeriodPlanEntryKeys([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(getPeriodPlanCompletedStorageKey(editableMember.id));
      if (!raw) {
        setCompletedPeriodPlanEntryKeys([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setCompletedPeriodPlanEntryKeys([]);
        return;
      }
      setCompletedPeriodPlanEntryKeys(parsed.map((item) => String(item)).filter(Boolean));
    } catch {
      setCompletedPeriodPlanEntryKeys([]);
    }
  }, [editableMember]);
  useEffect(() => {
    if (!editableMember || typeof window === "undefined") return;
    if (!periodPlanCompletedDirtyRef.current) return;
    try {
      window.localStorage.setItem(
        getPeriodPlanCompletedStorageKey(editableMember.id),
        JSON.stringify(completedPeriodPlanEntryKeys),
      );
    } catch {
      // ignore storage write errors (quota/private mode)
    }
  }, [editableMember, completedPeriodPlanEntryKeys]);
  useEffect(() => {
    periodPlanSwapsDirtyRef.current = false;
    if (!editableMember || typeof window === "undefined") {
      setPeriodPlanSwapsByPlan({});
      return;
    }
    setPeriodPlanSwapsByPlan(parsePeriodPlanSwapsState(window.localStorage.getItem(getPeriodPlanSwapsStorageKey(editableMember.id))));
  }, [editableMember?.id]);
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
      editableMember.personalGoals,
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
      editableMember.personalGoals,
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
    const localByMember = readPeriodPlansByMemberId();
    const combined = mergedPeriodPlanListForMember(relatedMemberIds, localByMember, remoteMemberPeriodPlanRows);
    combined.sort((a, b) => (parseDateOnly(b.startDate)?.getTime() ?? 0) - (parseDateOnly(a.startDate)?.getTime() ?? 0));
    const hiddenIds = readHiddenPeriodPlanIdsForMembers(relatedMemberIds);
    const visible = combined.filter((plan) => !hiddenIds.includes(plan.id));
    setPeriodPlans(combined);
    setHiddenPeriodPlanIds(hiddenIds);
    setActiveMemberPeriodPlanId((prev) => {
      if (prev && visible.some((plan) => plan.id === prev)) return prev;
      return visible[0]?.id ?? null;
    });
  }, [relatedMemberIds, remoteMemberPeriodPlanRows, periodPlanStorageRevision]);

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
    });
    return () => window.cancelAnimationFrame(frame);
  }, [memberFocusWorkoutLogId, completedLogs, memberTab, setMemberTab]);

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

      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d");
      if (!context) {
        setProgressShareStatus("Kunne ikke lage bilde akkurat nå.");
        return;
      }

      let shareCardLogo: HTMLImageElement | null = null;
      const shareLogoSrc = `${motusSkrytekortLogo}${motusSkrytekortLogo.includes("?") ? "&" : "?"}motus_skrytekort=2026-02`;
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

      const memberName = viewedMember?.name ?? "Medlem";
      const displayName = memberName.length > 20 ? `${memberName.slice(0, 20)}…` : memberName;
      const periodTitle = "Siste 7 dager";

      const bg = context.createLinearGradient(0, 0, canvas.width, canvas.height * 1.05);
      bg.addColorStop(0, "#0d9488");
      bg.addColorStop(0.35, MOTUS.turquoise);
      bg.addColorStop(0.72, MOTUS.pink);
      bg.addColorStop(1, "#831843");
      context.fillStyle = bg;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.save();
      context.globalAlpha = 0.14;
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(140, 220, 200, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(980, 420, 260, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(200, 1680, 240, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const headerH = 380;
      context.fillStyle = "rgba(15,23,42,0.28)";
      context.fillRect(0, 0, canvas.width, headerH);

      context.fillStyle = "rgba(255,255,255,0.92)";
      context.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("MOTUS", 72, 95);
      context.font = "300 30px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(periodTitle, 72, 145);
      context.font = "bold 76px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(displayName, 72, 255);
      context.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
      context.globalAlpha = 0.88;
      context.fillText("Ukesoppsummering · mine siste 7 dager", 72, 318);
      context.globalAlpha = 1;

      if (shareCardLogo && shareCardLogo.naturalWidth > 0) {
        const maxW = 292;
        const lw = maxW;
        const lh = (shareCardLogo.naturalHeight / shareCardLogo.naturalWidth) * lw;
        const lx = canvas.width - 56 - lw;
        const ly = 56;
        context.save();
        context.translate(lx, ly);
        context.globalAlpha = 0.98;
        context.drawImage(shareCardLogo, 0, 0, lw, lh);
        context.restore();
      }

      const cardX = 56;
      const cardY = 420;
      const cardW = canvas.width - 112;
      const cardH = 1450;
      const cardR = 40;
      context.shadowColor = "rgba(15, 23, 42, 0.22)";
      context.shadowBlur = 48;
      context.shadowOffsetY = 28;
      context.fillStyle = "rgba(255,255,255,0.96)";
      fillRoundRect(context, cardX, cardY, cardW, cardH, cardR);
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;

      const pad = 52;
      let y = cardY + pad + 36;
      context.fillStyle = MOTUS.ink;
      context.font = "bold 40px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("Mine tall · siste 7 dager", cardX + pad, y);
      y += 52;
      context.fillStyle = "#64748b";
      context.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("Økter, treningsdager, sett og løftevolum jeg har logget", cardX + pad, y);
      y += 72;

      const tileGap = 22;
      const tileW = (cardW - pad * 2 - tileGap) / 2;
      const tileH = 168;
      const stats: Array<{ label: string; value: string; accent: string }> = [
        { label: "Mine økter", value: String(progressShareLast7Days.workouts), accent: MOTUS.turquoise },
        { label: "Mine treningsdager", value: String(progressShareLast7Days.trainingDays), accent: MOTUS.pink },
        { label: "Mine sett", value: String(progressShareLast7Days.completedSets), accent: "#0d9488" },
        { label: "Mitt volum", value: `${Math.round(progressShareLast7Days.volumeKg).toLocaleString("nb-NO")} kg`, accent: "#db2777" },
      ];
      stats.forEach((stat, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const tx = cardX + pad + col * (tileW + tileGap);
        const ty = y + row * (tileH + tileGap);
        context.fillStyle = "#f8fafc";
        if (typeof context.roundRect === "function") {
          context.beginPath();
          context.roundRect(tx, ty, tileW, tileH, 22);
          context.fill();
          context.strokeStyle = "rgba(148,163,184,0.45)";
          context.lineWidth = 1;
          context.stroke();
        } else {
          context.fillRect(tx, ty, tileW, tileH);
          context.strokeStyle = "rgba(148,163,184,0.45)";
          context.lineWidth = 1;
          context.strokeRect(tx, ty, tileW, tileH);
        }
        context.fillStyle = stat.accent;
        context.fillRect(tx, ty, 6, tileH);
        context.fillStyle = "#94a3b8";
        context.font = "22px system-ui, -apple-system, Segoe UI, sans-serif";
        context.fillText(stat.label, tx + 28, ty + 48);
        context.fillStyle = MOTUS.ink;
        context.font = "bold 48px system-ui, -apple-system, Segoe UI, sans-serif";
        context.fillText(stat.value, tx + 28, ty + 118);
      });
      y += 2 * (tileH + tileGap) + 28;

      const playfulBoxH = 152;
      context.fillStyle = "#f8fafc";
      if (typeof context.roundRect === "function") {
        context.beginPath();
        context.roundRect(cardX + pad, y, cardW - pad * 2, playfulBoxH, 22);
        context.fill();
        context.strokeStyle = "rgba(148,163,184,0.45)";
        context.lineWidth = 1;
        context.stroke();
      } else {
        context.fillRect(cardX + pad, y, cardW - pad * 2, playfulBoxH);
        context.strokeStyle = "rgba(148,163,184,0.45)";
        context.lineWidth = 1;
        context.strokeRect(cardX + pad, y, cardW - pad * 2, playfulBoxH);
      }
      context.fillStyle = MOTUS.ink;
      context.font = "bold 24px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("Løftefakta", cardX + pad + 24, y + 42);
      context.fillStyle = "#475569";
      context.font = "24px system-ui, -apple-system, Segoe UI, sans-serif";
      fillWrappedCanvasText(
        context,
        progressLiftPlayfulLine,
        cardX + pad + 24,
        y + 78,
        cardW - pad * 2 - 48,
        30,
      );
      y += playfulBoxH + 22;

      const stripH = 112;
      const stripGrad = context.createLinearGradient(cardX + pad, y, cardX + cardW - pad, y + stripH);
      stripGrad.addColorStop(0, MOTUS.turquoise);
      stripGrad.addColorStop(1, MOTUS.pink);
      context.fillStyle = stripGrad;
      fillRoundRect(context, cardX + pad, y, cardW - pad * 2, stripH, 22);
      context.fillStyle = "#ffffff";
      context.font = "bold 28px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText(`Jeg fullførte ${progressShareLast7Days.workouts} økter på ${progressShareLast7Days.trainingDays} dager.`, cardX + pad + 32, y + 72);
      y += stripH + 28;

      context.fillStyle = "#f1f5f9";
      fillRoundRect(context, cardX + pad, y, cardW - pad * 2, 200, 22);
      context.fillStyle = MOTUS.ink;
      context.font = "bold 26px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("Min siste uke", cardX + pad + 28, y + 48);
      context.fillStyle = "#475569";
      context.font = "26px system-ui, -apple-system, Segoe UI, sans-serif";
      fillWrappedCanvasText(
        context,
        `Jeg logget ${progressShareLast7Days.completedSets} sett og ${Math.round(progressShareLast7Days.volumeKg).toLocaleString("nb-NO")} kg i samlet løftevolum siste 7 dager.`,
        cardX + pad + 28,
        y + 92,
        cardW - pad * 2 - 56,
        36,
      );
      y += 220;

      context.strokeStyle = "rgba(148,163,184,0.5)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cardX + pad, y);
      context.lineTo(cardX + cardW - pad, y);
      context.stroke();
      y += 40;
      context.fillStyle = "#94a3b8";
      context.font = "22px system-ui, -apple-system, Segoe UI, sans-serif";
      context.fillText("motus · del styrken din", cardX + pad, y);

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
  const memberShareDisplayName = viewedMember?.name ?? editableMember?.name ?? "Medlem";
  const _nextBestAction = useMemo(() => {
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
  const _homeWeeklySummary = useMemo(() => {
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
  let nextPlannedWorkout: { dayLabel: string; entry: string } | null = null;
  if (activeWeeklyPlanEffectiveDays && todayPlanDayKey) {
    const todayIndex = WEEKDAY_PLAN_ORDER.indexOf(todayPlanDayKey);
    for (let step = 1; step <= 7; step += 1) {
      const index = (todayIndex + step) % 7;
      const dayKey = WEEKDAY_PLAN_ORDER[index];
      const entry = activeWeeklyPlanEffectiveDays[dayKey]?.trim();
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
  }, [selectedCalendarDay, calendarMonth]);

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
    logGroupWorkout({
      memberId: activeMemberId,
      className: groupWorkoutClassName.trim(),
      note: groupWorkoutNote.trim(),
      reflection: buildGroupWorkoutReflection(),
      date: groupWorkoutDateIso,
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

  function buildPeriodPlanEntryKey(planId: string, weekNumber: number, day: WeekdayPlanKey): string {
    return `${planId}:${weekNumber}:${day}`;
  }

  function resolvePeriodPlanTargetMemberIds(): string[] {
    return relatedMemberIds.length > 0 ? relatedMemberIds : [primaryMemberIdForPeriodPlans].filter(Boolean);
  }

  function hideTrainerPeriodPlan(planId: string) {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    const nextHidden = Array.from(new Set([...hiddenPeriodPlanIds, planId]));
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, nextHidden);
    setHiddenPeriodPlanIds(nextHidden);
    setShowPeriodPlanManageSection(true);
    setShowPeriodPlanHiddenSection(true);
    setShowPeriodPlanPanel(true);
    if (activeMemberPeriodPlanId === planId) {
      const nextActive = visiblePeriodPlans.find((plan) => plan.id !== planId)?.id ?? null;
      setActiveMemberPeriodPlanId(nextActive);
    }
    setPeriodPlanActionStatus("Planen er skjult fra oversikten. Den er ikke slettet — hent den tilbake under «Skjulte planer» nedenfor.");
  }

  function unhideTrainerPeriodPlan(planId: string) {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    const nextHidden = hiddenPeriodPlanIds.filter((id) => id !== planId);
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, nextHidden);
    setHiddenPeriodPlanIds(nextHidden);
    setActiveMemberPeriodPlanId(planId);
    setSelectedPeriodPlanWeekNumber(1);
    setShowPeriodPlanPanel(true);
    setShowPeriodPlanManageSection(true);
    setPeriodPlanActionStatus("Periodeplanen er tilbake i oversikten.");
  }

  function unhideAllTrainerPeriodPlans() {
    const targetMemberIds = resolvePeriodPlanTargetMemberIds();
    if (targetMemberIds.length === 0) return;
    writeHiddenPeriodPlanIdsForMembers(targetMemberIds, []);
    setHiddenPeriodPlanIds([]);
    const firstPlan = periodPlans[0];
    if (firstPlan) {
      setActiveMemberPeriodPlanId(firstPlan.id);
      setSelectedPeriodPlanWeekNumber(1);
    }
    setShowPeriodPlanPanel(true);
    setShowPeriodPlanManageSection(true);
    setShowPeriodPlanHiddenSection(false);
    setPeriodPlanActionStatus("Alle periodeplaner er synlige igjen.");
  }

  function deleteMemberOwnedPeriodPlan(plan: PeriodSchedulePlan) {
    if (!isMemberOwnedPeriodPlan(plan, trainerPeriodPlanIds)) return;
    removeMemberOwnedPeriodPlanFromStorage(relatedMemberIds, plan.id);
    setPeriodPlanStorageRevision((value) => value + 1);
    if (activeMemberPeriodPlanId === plan.id) {
      setActiveMemberPeriodPlanId(null);
    }
    setPeriodPlanActionStatus("Periodeplanen er slettet.");
  }

  function isPeriodPlanEntryCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey): boolean {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    return completedPeriodPlanEntryKeys.includes(key);
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
    periodPlanCompletedDirtyRef.current = true;
    setCompletedPeriodPlanEntryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function unmarkPeriodPlanDayCompleted(planId: string, weekNumber: number, day: WeekdayPlanKey) {
    const key = buildPeriodPlanEntryKey(planId, weekNumber, day);
    periodPlanCompletedDirtyRef.current = true;
    setCompletedPeriodPlanEntryKeys((prev) => prev.filter((item) => item !== key));
  }

  function handlePeriodPlanStartProgram(programId: string) {
    const program =
      memberProgramsForPeriodPlan.find((item) => item.id === programId) ??
      memberProgramsInActiveLibrary.find((item) => item.id === programId);
    if (!program) return;
    setMemberTab("programs");
    if (intervalProgramIdSet.has(program.id)) {
      openIntervalTimerModal(program.id);
      return;
    }
    startWorkoutMode(program.id, buildStartWorkoutOptions(program));
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
    logGroupWorkout({
      memberId: activeMemberId,
      className: resolveGroupClassNameFromPeriodEntry(trimmed),
      note: "Logget fra periodeplan.",
      reflection: defaultPeriodPlanReflection,
      keepCurrentTab: true,
      date: input.plannedDate ?? undefined,
    });
    markPeriodPlanDayCompleted(input.planId, input.weekNumber, input.day);
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
    const key = buildPeriodPlanEntryKey(input.planId, input.weekNumber, input.day);
    const alreadyCompleted = completedPeriodPlanEntryKeys.includes(key);
    const trimmed = input.entry.trim();
    if (!trimmed || !activeMemberId) return;

    const storedDate = resolvePeriodPlanStoredDate(input.plannedDate);
    const logTitle = resolvePeriodPlanLogTitle(trimmed);

    if (!alreadyCompleted) {
      if (isPeriodPlanEntryDateInFuture(input.plannedDate)) {
        setPeriodPlanActionStatus("Du kan bare markere økter med dato i dag eller tidligere.");
        return;
      }
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

    const matchingLog = memberLogs.find(
      (log) =>
        log.memberId === activeMemberId &&
        log.status === "Fullført" &&
        log.programTitle.trim().toLowerCase() === logTitle.trim().toLowerCase() &&
        isPeriodPlanWorkoutLog(log) &&
        storedLogDatesMatch(log.date, storedDate),
    );

    if (isGroupPeriodPlanEntry(trimmed)) {
      removeGroupWorkoutLog({
        memberId: activeMemberId,
        className: resolveGroupClassNameFromPeriodEntry(trimmed),
        date: storedDate,
      });
    } else {
      removeCompletedPlanEntryLog({
        memberId: activeMemberId,
        programTitle: logTitle,
        date: storedDate,
      });
    }
    if (matchingLog?.id === expandedRecentLogId) {
      setExpandedRecentLogId(null);
    }
    unmarkPeriodPlanDayCompleted(input.planId, input.weekNumber, input.day);
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
              const speed = printField(safeExercise.speed);
              const incline = printField(safeExercise.incline);
              const restSeconds = printField(safeExercise.restSeconds) || "0";
              const notes = printField(safeExercise.notes);
              const prescription = durationMinutes
                ? `${setCount} runder × ${durationMinutes} min${
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
    .header-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-radius: 10px; padding: 8px 10px; background: linear-gradient(135deg, #14b8a6 0%, #ec4899 100%); color: #fff; }
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
    .exercise-prescription { font-size: 12px; color: #0f766e; margin-bottom: 3px; }
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

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="hidden p-4 h-fit xl:p-5 lg:block">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><UserCircle2 className="h-5 w-5" /></div>
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

        <div className="min-w-0 w-full space-y-4 sm:space-y-6">
          {memberTab === "overview" ? (
            <div className="space-y-4">
              <MemberTabHero
                title="Hjem"
                description="Kalender, planlagte økter og snarveier — et raskt overblikk over treningsuken din."
              />
              {onOpenOnboarding && (showOnboardingHomePrompt || !onboardingSubstantivelyComplete) ? (
                <Card
                  className="border p-4 sm:p-5"
                  style={{ borderColor: "rgba(20,184,166,0.35)", background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(236,72,153,0.06) 100%)" }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="rounded-xl p-2 text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                      >
                        <UserCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Oppstartsskjema</div>
                        <div className="mt-0.5 text-base font-semibold text-slate-900">Fortell oss litt om deg</div>
                        <p className="mt-1 text-sm text-slate-600">
                          Fyll ut én gang — tar ca. 3–5 minutter. PT bruker svarene dine til å lage et treningsprogram tilpasset deg.
                        </p>
                      </div>
                    </div>
                    <GradientButton type="button" onClick={onOpenOnboarding} className="w-full shrink-0 sm:w-auto">
                      Start skjema
                    </GradientButton>
                  </div>
                </Card>
              ) : null}
              {monthlyCheckInPrompt && onOpenMonthlyCheckIn ? (
                <Card
                  className="border p-4 sm:p-5"
                  style={{ borderColor: "rgba(20,184,166,0.35)", background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(236,72,153,0.06) 100%)" }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="rounded-xl p-2 text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                      >
                        <ClipboardPenLine className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Månedlig sjekk-inn</div>
                        <div className="mt-0.5 text-base font-semibold text-slate-900">{monthlyCheckInPrompt.copy.text}</div>
                        <p className="mt-1 text-sm text-slate-600">{monthlyCheckInPrompt.copy.detail}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {monthlyCheckInPrompt.window.daysRemaining} dager igjen · ca. 2 min
                        </p>
                      </div>
                    </div>
                    <GradientButton type="button" onClick={onOpenMonthlyCheckIn} className="w-full shrink-0 sm:w-auto">
                      Start sjekk-inn
                    </GradientButton>
                  </div>
                </Card>
              ) : null}
            <Card className="min-w-0 w-full p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
              {memberHasVisiblePeriodPlan ? (
              <div className="order-2 w-full">
                  <div className="flex h-full min-w-0 flex-col rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-xl p-2 text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                      >
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">Neste på planen</div>
                        <div className="text-xs text-slate-500">Plan</div>
                      </div>
                    </div>
                  </div>
                  {nextPlannedWorkout ? (
                    <>
                      <div className="mt-1 text-sm font-medium text-slate-800">{nextPlannedWorkout.dayLabel}</div>
                      <div className="mt-1 text-sm text-slate-600">{nextPlannedWorkout.entry}</div>
                      <OutlineButton onClick={openProgramsWithPeriodPlan} className="mt-3 w-full sm:w-auto">
                        Se periodeplan
                      </OutlineButton>
                    </>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <div className="text-sm text-slate-500">Ingen flere planlagte økter denne uken.</div>
                      <OutlineButton onClick={() => setMemberTab("programs")} className="w-full sm:w-auto">
                        Åpne program
                      </OutlineButton>
                    </div>
                  )}
                </div>
                
              </div>
              ) : null}
              <div className="order-1 grid gap-4">
                <div className="min-w-0 w-full overflow-hidden rounded-2xl border bg-slate-50 p-5 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan og økter</div>
                      <div className="mt-1 text-base font-semibold text-slate-800">Treningskalender</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-600 capitalize">{calendarMonthLabel}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OutlineButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    >
                      Forrige
                    </OutlineButton>
                    <OutlineButton
                      className="px-3 py-1.5 text-xs"
                      onClick={() => setCalendarMonth(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1))}
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
                  {todayPlanEntry ? (
                    <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dagens økt</div>
                      <div className="mt-1 text-sm text-slate-700">{todayPlanEntry}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {todayPlanAction.kind === "start-program" ? (
                          <GradientButton
                            onClick={() => handlePeriodPlanStartProgram(todayPlanAction.program.id)}
                            className="w-full sm:w-auto"
                          >
                            Start økt
                          </GradientButton>
                        ) : null}
                        {todayPlanAction.kind === "log-group" && todayPlanPeriodPlan && todayPeriodPlanMatch ? (
                          <OutlineButton
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
                            className="w-full sm:w-auto"
                          >
                            Logg gruppetime
                          </OutlineButton>
                        ) : null}
                        {todayPlanAction.kind === "none" ? (
                          <OutlineButton onClick={() => setMemberTab("programs")} className="w-full sm:w-auto">
                            Se dagens plan
                          </OutlineButton>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
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
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedCalendarPlanAction.kind === "start-program" ? (
                                <GradientButton
                                  onClick={() => handlePeriodPlanStartProgram(selectedCalendarPlanAction.program.id)}
                                  className="w-full sm:w-auto"
                                >
                                  Start økt
                                </GradientButton>
                              ) : null}
                              {selectedCalendarPlanAction.kind === "log-group" && selectedCalendarPeriodMatch ? (
                                <GradientButton
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
                                  className="w-full sm:w-auto"
                                >
                                  Logg gruppetime
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
                                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
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
              </div>
              {!isMemberLimited ? (
              <div className="order-3">
                  <MemberHabitSummaryCard progress={memberProgress} onOpenProgress={() => setMemberTab("progress")} />
                </div>
              ) : null}
            </Card>
              {!isMemberLimited ? (
                <MemberBadgesCarousel
                  collection={memberBadgeCollection}
                  memberDisplayName={memberShareDisplayName}
                  shareLogoSrc={motusShareLogoSrc}
                />
              ) : null}
            </div>
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
                  <div
                    className="rounded-2xl p-4 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, #059669 52%, ${MOTUS.pink} 100%)` }}
                  >
                    <Trophy className="h-11 w-11 text-white drop-shadow-sm" aria-hidden />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Ny personlig rekord</p>
                  <h2 id="pr-celebration-heading" className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    Sterkere enn før
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                    Du satte ny personlig rekord i øvelsen du nettopp gjorde.
                  </p>
                  <div className="mt-5 w-full rounded-2xl border border-emerald-200/90 bg-emerald-50 px-4 py-4 text-left shadow-inner" style={{ borderColor: "rgba(16,185,129,0.35)" }}>
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
                className="motus-pop-in h-fit w-full max-w-sm overflow-hidden rounded-2xl border bg-white text-center shadow-xl"
                style={{ borderColor: "rgba(15,23,42,0.1)" }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="hidden-badge-heading"
              >
                <div className="h-2" style={{ background: `linear-gradient(90deg, #BA0C2F 0%, #FFFFFF 24%, #00205B 50%, #FFFFFF 76%, #BA0C2F 100%)` }} />
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Skjult badge låst opp</p>
                  <img
                    src={HIDDEN_BADGE_IMAGES[hiddenBadgeCelebration.id] ?? "/badges/21-17-mai.svg"}
                    alt=""
                    className="mx-auto mt-4 h-36 w-36 object-contain p-3 drop-shadow-sm"
                  />
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
              <div className="flex flex-col gap-4">
              <MemberTabHero
                title="Trening"
                description={
                  memberHasVisiblePeriodPlan
                    ? "Mine programmer, periodeplan og egen økt — alt samlet på ett sted."
                    : "Mine programmer og egen økt — alt samlet på ett sted."
                }
              />
              <Card className="p-3 sm:p-4">
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Trening-seksjoner">
                  {[
                    { id: "today" as const, label: "Dagens plan" },
                    { id: "programs" as const, label: "Mine programmer" },
                    { id: "custom" as const, label: "Lag egen økt" },
                    { id: "period" as const, label: "Periodeplan" },
                    { id: "history" as const, label: "Historikk" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={trainingSection === item.id}
                      onClick={() => setTrainingSection(item.id)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        trainingSection === item.id
                          ? "border-transparent text-white shadow-sm"
                          : "bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900"
                      }`}
                      style={
                        trainingSection === item.id
                          ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                          : { borderColor: "rgba(15,23,42,0.12)" }
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </Card>
              {primaryPausedWorkout ? (() => {
                const progress = pausedWorkoutProgress(primaryPausedWorkout.workoutMode);
                return (
                  <Card className="border-2 border-teal-200 bg-teal-50 p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-800">
                          <Play className="h-3.5 w-3.5" />
                          Fortsett der du slapp
                        </div>
                        <h3 className="mt-3 text-lg font-bold leading-tight text-slate-950 sm:text-xl">{primaryPausedWorkout.programTitle}</h3>
                        <p className="mt-1 text-sm text-slate-700">
                          {progress.completed} av {progress.total} sett fullført. {formatPausedWorkoutExpiry(primaryPausedWorkout.expiresAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
                        <GradientButton
                          className="w-full !min-h-12 !px-5 !py-3 text-sm font-bold"
                          onClick={() => {
                            resumePausedWorkout(primaryPausedWorkout.id, primaryPausedWorkout.memberId);
                          }}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <Play className="h-4 w-4" />
                            Fortsett økt
                          </span>
                        </GradientButton>
                        <OutlineButton
                          className="w-full !min-h-9 !py-2 text-xs"
                          onClick={() => {
                            setConfirmDialog({
                              title: "Slette påbegynt økt?",
                              message: "Fremgangen i denne økten fjernes permanent.",
                              confirmLabel: "Slett",
                              tone: "danger",
                              onConfirm: () => {
                                discardPausedWorkoutDraft(activeMemberId, primaryPausedWorkout.id);
                                setPausedWorkoutsTick((value) => value + 1);
                              },
                            });
                          }}
                        >
                          Slett utkast
                        </OutlineButton>
                      </div>
                    </div>
                  </Card>
                );
              })() : null}
              {trainingSection === "today" ? (
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Dagens plan</div>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">
                      {todayPlanEntry ? todayPlanEntry : "Ingen planlagt økt i dag"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {todayPlanEntry
                        ? "Start direkte herfra, eller åpne hele periodeplanen."
                        : "Du kan likevel trene: start et program eller bygg en egen økt."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
                    {todayPlanAction.kind === "start-program" ? (
                      <GradientButton onClick={() => handlePeriodPlanStartProgram(todayPlanAction.program.id)} className="w-full">
                        Start dagens økt
                      </GradientButton>
                    ) : null}
                    {todayPlanAction.kind === "log-group" && todayPlanPeriodPlan && todayPeriodPlanMatch ? (
                      <GradientButton
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
                        className="w-full"
                      >
                        Logg gruppetime
                      </GradientButton>
                    ) : null}
                    <OutlineButton
                      onClick={() => setTrainingSection(todayPlanEntry ? "period" : "programs")}
                      className="w-full"
                    >
                      {todayPlanEntry ? "Se periodeplan" : "Se programmer"}
                    </OutlineButton>
                    {!todayPlanEntry && !isMemberLimited ? (
                      <OutlineButton
                        onClick={() => setTrainingSection("custom")}
                        className="w-full"
                      >
                        Lag egen økt
                      </OutlineButton>
                    ) : null}
                  </div>
                </div>
              </Card>
              ) : null}
              {trainingSection === "programs" ? (
              <>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Mine programmer</div>
                    <h3 className="mt-1 text-lg font-bold text-slate-950">Treningsprogram</h3>
                    <p className="mt-1 text-sm text-slate-600">Start, vis, skjul eller arkiver programmene dine.</p>
                  </div>
                </div>
                {secondaryPausedWorkouts.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2">
                      <div className="text-xs font-semibold text-teal-900">Påbegynte økter</div>
                      <p className="mt-0.5 text-[11px] text-teal-800/90">Lagres i 4 timer. Fortsett der du slapp, eller slett.</p>
                    </div>
                    {secondaryPausedWorkouts.map((draft) => {
                      const progress = pausedWorkoutProgress(draft.workoutMode);
                      return (
                        <div
                          key={draft.id}
                          className="rounded-lg border bg-white p-2.5"
                          style={{ borderColor: "rgba(20,184,166,0.35)" }}
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
                <div className="mt-3 space-y-2">
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
                  {memberProgramsInActiveLibrary.map((program) => {
                    const isExpanded = expandedProgramId === program.id;
                    const isLibraryMenuOpen = programLibraryMenuId === program.id;
                    const programAuthorLine = programAuthorCreditForMember(program, memberProgramAuthorOptions);
                    return (
                      <div
                        key={program.id}
                        id={`member-program-${program.id}`}
                        className="rounded-lg border bg-white p-2.5 space-y-2"
                        style={{ borderColor: "rgba(15,23,42,0.08)" }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold leading-snug text-slate-900">{program.title}</div>
                            {program.goal?.trim() ? (
                              <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{program.goal.trim()}</div>
                            ) : null}
                            {programAuthorLine ? (
                              <div className="mt-0.5 text-[10px] font-medium text-slate-600">{programAuthorLine}</div>
                            ) : null}
                            <div className="mt-0.5 text-[10px] text-slate-400">{program.createdAt}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:flex-nowrap sm:items-center">
                            <div className="flex flex-nowrap items-center justify-end gap-1">
                            <OutlineButton
                              className="!min-h-7 !px-2 !py-1 !text-[10px] !leading-tight"
                              onClick={() => setExpandedProgramId((prev) => (prev === program.id ? null : program.id))}
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                <span>{isExpanded ? "Skjul" : "Vis"}</span>
                              </span>
                            </OutlineButton>
                            <OutlineButton className="!min-h-7 !px-2 !py-1 !text-[10px] !leading-tight" onClick={() => handlePrintProgram(program)}>
                              <span className="inline-flex items-center justify-center gap-1">
                                <Printer className="h-3 w-3" />
                                <span>PDF</span>
                              </span>
                            </OutlineButton>
                            <GradientButton
                              className="!min-h-7 !px-2 !py-1 !text-[10px] !leading-tight"
                              onClick={() => {
                                if (intervalProgramIdSet.has(program.id)) {
                                  openIntervalTimerModal(program.id);
                                  return;
                                }
                                startWorkoutMode(program.id, buildStartWorkoutOptions(program));
                              }}
                            >
                              <span className="inline-flex items-center justify-center gap-1">
                                <Play className="h-3 w-3" />
                                <span>Start</span>
                              </span>
                            </GradientButton>
                            <div className="relative shrink-0" data-program-library-menu>
                              <OutlineButton
                                type="button"
                                className={`!min-h-7 !px-1.5 !py-1 !text-[10px] !leading-tight ${isLibraryMenuOpen ? "!border-teal-300 !bg-teal-50" : ""}`}
                                onClick={() => setProgramLibraryMenuId((prev) => (prev === program.id ? null : program.id))}
                                aria-label={isLibraryMenuOpen ? "Lukk meny" : "Flere valg"}
                                aria-expanded={isLibraryMenuOpen}
                                title="Mer"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                              </OutlineButton>
                              {isLibraryMenuOpen ? (
                                <div
                                  className="absolute right-0 top-[calc(100%+4px)] z-30 w-44 overflow-hidden rounded-xl border bg-white py-1 shadow-lg ring-1 ring-black/5"
                                  style={{ borderColor: "rgba(15,23,42,0.1)" }}
                                  role="menu"
                                >
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
                                    {exercise.durationMinutes
                                      ? `${exercise.sets} runder × ${exercise.durationMinutes} min${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}% incline` : ""} · ${exercise.restSeconds}s${cardioHrPrescriptionSuffixForMember(exercise)}`
                                      : isStretch
                                        ? `${exercise.sets} sett × ${programExerciseHoldSeconds(exercise, lib?.category) || "-"} sek · ${exercise.restSeconds}s`
                                        : `${exercise.sets}×${exercise.reps} · ${exercise.weight}kg · ${exercise.restSeconds}s`}
                                  </div>
                                  {!exercise.durationMinutes && !isStretch ? (
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
                    );
                  })}
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
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <div
                      className="shrink-0 rounded-xl p-2 text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                    >
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">Logg gruppetrening</div>
                      <div className="mt-1 text-xs text-slate-500">Registrer gruppetimer slik at PT ser all aktivitet. Velg annen dato hvis du glemte å logge.</div>
                    </div>
                  </div>
                  <OutlineButton onClick={() => setShowGroupWorkoutLogger((prev) => !prev)} className="w-full sm:w-auto">
                    {showGroupWorkoutLogger ? "Skjul logging" : "Logg gruppetrening"}
                  </OutlineButton>
                </div>
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
              </>
              ) : null}
              {!isMemberLimited ? (
              trainingSection === "custom" ? (
              <Card className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl p-2.5 text-white shrink-0" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Lag egen økt</div>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">Bygg og start selv</h2>
                      <p className="mt-1 text-sm text-slate-600">Velg øvelser, start med en gang eller lagre som eget program.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Din økt</div>
                    {customWorkoutLines.length === 0 ? (
                      <EmptyState
                        icon="🏋️"
                        title="Ingen øvelser ennå"
                        description="Finn øvelser i listen under og trykk «Legg til»."
                        className="mt-2"
                      />
                    ) : (
                      <div className="mt-2 space-y-2">
                        {customWorkoutLines.map((line) => {
                          const ex = exercises.find((e) => e.id === line.exerciseId);
                          const isStretch = Boolean(ex?.category && isHoldBasedExerciseCategory(ex.category));
                          return (
                            <div key={line.key} className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 font-medium text-sm text-slate-800">{ex?.name ?? "Ukjent øvelse"}</div>
                                <DangerButton type="button" onClick={() => removeCustomWorkoutLine(line.key)} className="shrink-0 px-2 py-1 text-xs">
                                  Fjern
                                </DangerButton>
                              </div>
                              <div className={`mt-3 grid gap-2 ${isStretch ? "grid-cols-2" : "grid-cols-3"}`}>
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold text-slate-600">Sett</span>
                                  <TextInput value={line.sets} onChange={(e) => updateCustomWorkoutLine(line.key, { sets: e.target.value })} placeholder="3" />
                                </label>
                                {!isStretch ? (
                                  <label className="space-y-1">
                                    <span className="text-[11px] font-semibold text-slate-600">Reps</span>
                                    <TextInput value={line.reps} onChange={(e) => updateCustomWorkoutLine(line.key, { reps: e.target.value })} placeholder="10" />
                                  </label>
                                ) : null}
                                <label className="space-y-1">
                                  <span className="text-[11px] font-semibold text-slate-600">{isStretch ? "Sek. (hold)" : "kg"}</span>
                                  <TextInput
                                    value={isStretch ? (line.holdSeconds ?? "") : line.weight}
                                    onChange={(e) =>
                                      updateCustomWorkoutLine(line.key, isStretch ? { holdSeconds: e.target.value } : { weight: e.target.value })
                                    }
                                    placeholder={isStretch ? "30" : "–"}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <label className="mt-3 block max-w-md space-y-1">
                      <span className="text-[11px] font-semibold text-slate-600">Programnavn (ved lagring som program)</span>
                      <TextInput
                        value={memberSavedProgramTitle}
                        onChange={(e) => setMemberSavedProgramTitle(e.target.value)}
                        placeholder="Mitt treningsprogram"
                      />
                    </label>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <GradientButton
                      onClick={handleStartCustomWorkout}
                      disabled={!customWorkoutLines.length || !activeMemberId.trim()}
                      className="w-full sm:w-auto"
                    >
                      {customWorkoutLines.length
                        ? `Start egen økt (${customWorkoutLines.length} øvelse${customWorkoutLines.length === 1 ? "" : "r"})`
                        : "Legg til øvelser for å starte"}
                    </GradientButton>
                    <OutlineButton
                      type="button"
                      onClick={handleSaveMemberTrainingProgram}
                      disabled={!customWorkoutLines.length || !activeMemberId.trim()}
                      className="w-full sm:w-auto"
                    >
                      Lagre som treningsprogram
                    </OutlineButton>
                    </div>
                    {customProgramSaveStatus ? (
                      <StatusMessage
                        message={customProgramSaveStatus}
                        tone="success"
                        className="mt-2 !rounded-xl !px-3 !py-2 !text-xs"
                      />
                    ) : null}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Øvelsesbank</div>
                    <p className="mt-1 text-sm text-slate-600">Søk eller filtrer, scroll i listen, trykk «Legg til».</p>
                    <div className="relative mt-3">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                      <TextInput
                        value={customWorkoutSearch}
                        onChange={(e) => setCustomWorkoutSearch(e.target.value)}
                        placeholder="Søk etter øvelse…"
                        className="pl-10"
                      />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600">Kategori</span>
                        <select
                          value={customWorkoutCategoryFilter}
                          onChange={(event) => setCustomWorkoutCategoryFilter(event.target.value)}
                          className="h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-700"
                          style={{ borderColor: "rgba(15,23,42,0.12)" }}
                        >
                          <option value="all">Alle</option>
                          {customWorkoutCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="text-xs text-slate-500 sm:pb-2 sm:text-right">
                        {customWorkoutBankFiltered.length === 0 && exercises.length > 0 ? (
                          <span>Ingen treff – prøv annet søk eller kategori.</span>
                        ) : !customWorkoutSearch.trim() && !showAllCustomWorkoutOptions && customWorkoutBankOverflow > 0 ? (
                          <span>
                            Viser {customWorkoutExerciseOptions.length} av {customWorkoutBankFiltered.length} øvelser
                          </span>
                        ) : (
                          <span>{customWorkoutBankFiltered.length} øvelse{customWorkoutBankFiltered.length === 1 ? "" : "r"}</span>
                        )}
                      </div>
                    </div>
                    {exercises.length === 0 ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        Øvelsesbanken er tom. Oppdater siden eller kontakt treneren din.
                      </div>
                    ) : (
                      <div
                        className="mt-3 max-h-[min(50vh,320px)] overflow-y-auto rounded-xl border bg-white"
                        style={{ borderColor: "rgba(15,23,42,0.1)" }}
                      >
                        <ul className="divide-y" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                          {customWorkoutExerciseOptions.map((ex) => {
                            const already = customWorkoutLines.some((line) => line.exerciseId === ex.id);
                            return (
                              <li key={ex.id} className="flex items-center gap-2 px-3 py-2.5 sm:px-3.5">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-800">{ex.name}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {[ex.category, ex.group].filter(Boolean).join(" · ")}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={already}
                                  onClick={() => addCustomWorkoutLine(ex.id)}
                                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                    already
                                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                  }`}
                                >
                                  {already ? "Lagt til" : (
                                    <span className="inline-flex items-center gap-1">
                                      <Plus className="h-3.5 w-3.5" /> Legg til
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    {!customWorkoutSearch.trim() && !showAllCustomWorkoutOptions && customWorkoutBankOverflow > 0 ? (
                      <OutlineButton type="button" onClick={() => setShowAllCustomWorkoutOptions(true)} className="mt-3 w-full sm:w-auto">
                        Vis alle øvelser ({customWorkoutBankFiltered.length})
                      </OutlineButton>
                    ) : null}
                  </div>
                </div>
              </Card>
              ) : null
              ) : null}

              {trainingSection === "period" ? (
              periodPlans.length > 0 ? (
              <div className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <div
                      className="shrink-0 rounded-xl p-2 text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                    >
                      <CalendarRange className="h-4 w-4" aria-hidden />
                    </div>
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
                      Planene er ikke slettet. Trykk <strong>Vis igjen</strong> for å ta dem tilbake, eller legg til en ny plan fra Inspirasjon.
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
                              onClick={() => {
                                setActiveMemberPeriodPlanId(plan.id);
                                setSelectedPeriodPlanWeekNumber(1);
                              }}
                              className={`rounded-full px-3 py-1.5 text-left text-xs font-semibold transition ${
                                active
                                  ? "bg-teal-100 text-teal-900 ring-2 ring-teal-200"
                                  : "bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                              }`}
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
                      <div
                        className="overflow-hidden rounded-2xl border-0 p-0 shadow-md ring-1 ring-teal-500/15"
                        style={{
                          background: `linear-gradient(145deg, ${MOTUS.paleMint} 0%, #ffffff 55%, #f1f5f9 100%)`,
                        }}
                      >
                        <div className="border-b border-teal-900/10 px-4 py-3 sm:px-5 sm:py-4" style={{ background: "rgba(255,255,255,0.55)" }}>
                          <div className="text-base font-bold leading-snug text-slate-900 sm:text-lg">{activePeriodPlan.title}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-teal-950 shadow-sm ring-1 ring-teal-200/60">
                              Start {activePeriodPlan.startDate}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/80">
                              {activePeriodPlan.weeks} {activePeriodPlan.weeks === 1 ? "uke" : "uker"}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/60">
                              {isMemberOwnedPeriodPlan(activePeriodPlan, trainerPeriodPlanIds) ? "Lagt til av deg" : "Fra trener"}
                            </span>
                          </div>
                        </div>
                        {activePeriodPlan.notes ? (
                          <div className="mx-4 mt-3 rounded-xl border border-teal-200/50 bg-white/70 px-3 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm sm:mx-5">
                            {activePeriodPlan.notes}
                          </div>
                        ) : null}
                        {(activePeriodPlan.weeklyPlans ?? []).length > 0 ? (
                          <PeriodPlanWeekNavigator
                            className="mt-4 px-4 sm:px-5"
                            weeks={buildPeriodPlanWeekNavItemsFromPlan(activePeriodPlan)}
                            selectedWeekNumber={selectedPeriodPlanWeekForView}
                            onWeekSelectByNumber={setSelectedPeriodPlanWeekNumber}
                            currentWeekNumber={activePeriodWeekIndex !== null ? activePeriodWeekIndex + 1 : null}
                            formatWeekRange={(weekNumber) => {
                              const monday = resolvePeriodPlanEntryDate(activePeriodPlan, weekNumber, "monday");
                              const sunday = resolvePeriodPlanEntryDate(activePeriodPlan, weekNumber, "sunday");
                              if (!monday || !sunday) return null;
                              return `${monday} – ${sunday}`;
                            }}
                          />
                        ) : null}
                        {resolvePeriodPlanWeek(activePeriodPlan, selectedPeriodPlanWeekForView) ? (
                          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                            <PeriodPlanWeekView
                              key={`${activePeriodPlan.id}-${selectedPeriodPlanWeekForView}`}
                              plan={activePeriodPlan}
                              week={resolvePeriodPlanWeek(activePeriodPlan, selectedPeriodPlanWeekForView)!}
                              swapsByPlan={periodPlanSwapsByPlan}
                              memberPrograms={memberProgramsForPeriodPlan}
                              actionStatus={periodPlanActionStatus}
                              isEntryCompleted={isPeriodPlanEntryCompleted}
                              onToggleCompleted={togglePeriodPlanEntryCompleted}
                              onSwapDays={swapPeriodPlanDays}
                              onMoveDay={movePeriodPlanDay}
                              onResetSwaps={resetPeriodPlanSwapsForWeek}
                              onStartProgram={handlePeriodPlanStartProgram}
                              onLogGroup={handlePeriodPlanLogGroup}
                              resolveEntryDate={resolvePeriodPlanEntryDate}
                            />
                          </div>
                        ) : null}
                      </div>
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
                                      onClick={() => {
                                        setActiveMemberPeriodPlanId(plan.id);
                                        setSelectedPeriodPlanWeekNumber(1);
                                      }}
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
                    <div
                      className="shrink-0 rounded-xl p-2 text-white shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                    >
                      <CalendarRange className="h-4 w-4" aria-hidden />
                    </div>
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
              <>
              <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-xl p-2 text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                  >
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Historikk</div>
                    <div className="mt-1 text-lg font-bold text-slate-950">Siste 5 økter</div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {lastDeletedLogResult ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Øvelse slettet fra loggen.
                      <button type="button" onClick={undoDeleteLoggedExercise} className="ml-2 font-semibold underline">
                        Angre
                      </button>
                    </div>
                  ) : null}
                  {completedLogs.length === 0 ? (
                    <EmptyState
                      icon="🧾"
                      title="Ingen økter logget ennå"
                      description="Start en økt for å bygge historikk og fremgang."
                      className="bg-white"
                    />
                  ) : null}
                  {recentCompletedLogsForDisplay.map((log) => {
                    const isExpanded = expandedRecentLogId === log.id;
                    const fromPeriodPlan = isPeriodPlanWorkoutLog(log);
                    const isFocusedFromNotification = memberFocusWorkoutLogId === log.id;
                    return (
                    <div
                      key={log.id}
                      id={`member-workout-log-${log.id}`}
                      className={`overflow-hidden rounded-lg border bg-white ${isFocusedFromNotification ? "ring-2 ring-teal-400/80 ring-offset-1" : ""}`}
                      style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedRecentLogId((prev) => (prev === log.id ? null : log.id))}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900">{log.date}</div>
                          <div className="truncate text-xs text-slate-500">{log.programTitle}</div>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-teal-700">
                          {isExpanded ? "Skjul" : "Detaljer"}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-slate-400 transition ${isExpanded ? "rotate-90" : ""}`}
                          aria-hidden
                        />
                      </button>
                      {isExpanded ? (
                        <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
                          {fromPeriodPlan && log.note ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900">
                              {log.note}
                            </div>
                          ) : null}
                          {!fromPeriodPlan && log.note ? (
                            <div className="text-sm text-slate-600">{log.note}</div>
                          ) : null}
                          {log.trainerComment ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Kommentar fra trener</div>
                              <div className="mt-1">{log.trainerComment}</div>
                            </div>
                          ) : null}
                          <div className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Utført i økta</div>
                          <div className="mt-2 space-y-2">
                            {(log.results ?? []).length === 0 ? (
                              <div className="text-sm text-slate-500">Ingen settdata registrert for denne økta.</div>
                            ) : (
                              groupLoggedResultsForDisplay(log.results ?? []).map((group) => (
                                <div key={group.key} className="rounded-lg border bg-white px-3 py-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-medium text-slate-800">{group.exerciseName}</div>
                                      <div className="mt-0.5 text-[11px] text-slate-500">
                                        {group.rows.length === 1 ? "1 sett logget" : `${group.rows.length} sett logget`}
                                      </div>
                                      {group.exerciseNote ? (
                                        <div className="mt-1 text-xs text-slate-600 italic">«{group.exerciseNote}»
                                      </div>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLoggedExercise(log.id, group.rows[0]?.result.exerciseId ?? "")}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
                                    >
                                      Slett øvelse
                                    </button>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {group.rows.map(({ result, originalIndex }) => {
                                      const editKey = `${log.id}:${result.exerciseId}:${originalIndex}`;
                                      const isEditing = editingLoggedExerciseKey === editKey && Boolean(editingLoggedExerciseDraft);
                                      const setLabel = result.setNumber && result.setNumber > 0 ? `Sett ${result.setNumber}` : "Sett";
                                      return (
                                        <div key={`${group.key}:${originalIndex}`} className="rounded-lg border bg-slate-50 px-3 py-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="font-medium text-slate-700">{setLabel}</div>
                                            <div className="flex items-center gap-1.5">
                                              {isEditing ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => saveEditLoggedExercise(log.id, originalIndex)}
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
                                                  onClick={() => startEditLoggedExercise(log.id, result, originalIndex)}
                                                  className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                                                >
                                                  Rediger sett
                                                </button>
                                              )}
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
                                              ) : result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory) ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                  <TextInput
                                                    value={editingLoggedExerciseDraft.performedWeight}
                                                    onChange={(e) => setEditingLoggedExerciseDraft((prev) => prev ? { ...prev, performedWeight: e.target.value } : prev)}
                                                    placeholder="Sekunder"
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
                                                : result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)
                                                  ? `Utført: ${result.performedWeight || "0"} sek`
                                                  : `Utført: ${result.performedWeight || "0"} kg x ${result.performedReps || "0"} reps`}
                                              {result.completed ? " - Fullført" : " - Ikke markert fullført"}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
              </>
              ) : null}
              </div>
              <IntervalWorkoutSessionModal
                open={showIntervalTimerModal}
                program={activeIntervalProgram}
                exercises={exercises}
                memberId={activeMemberId}
                memberEmail={editableMember?.email ?? currentUserEmail}
                onClose={() => setShowIntervalTimerModal(false)}
                onSaved={() => {
                  setIntervalTimerStatus("Kondisjonsøkten er lagret. PT kan se den i loggen.");
                  setShowIntervalTimerModal(false);
                }}
                logIntervalWorkout={logIntervalWorkout}
              />
            </>
          ) : null}

          {!isMemberLimited && memberTab === "progress" ? (
            <div className="space-y-4">
                            <MemberTabHero
                title="Fremgang"
                description="Streak, treningsmål, personlige rekorder og muskelfordeling."
              />
              <MemberTrainingFlowCard
                achievementLevel={achievementLevel}
                achievementMaxLevel={achievementMaxLevel}
                achievedLevel={achievedLevel}
                hasCompletedAllLevels={hasCompletedAllAchievementLevels}
                stepLabel={memberProgress.stepLabel}
                nextStepLabel={memberProgress.nextStepLabel}
                goals={achievements}
                streakWeeks={streakWeeks}
                streakSubline={streakSubline}
                recentStreakWeeks={recentStreakWeeks}
                currentStreakMilestoneTarget={currentStreakMilestoneTarget}
              />

              <Card className="p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-slate-900">Personlige rekorder</h3>
                <p className="mt-0.5 text-xs text-slate-500">Trykk på en øvelse for styrkeutvikling over tid. Stjernemerk opptil tre rekorder du vil fremheve først.</p>
                {profileSaveInfo && memberTab === "progress" ? (
                  <StatusMessage
                    message={profileSaveInfo}
                    tone={
                      profileSaveInfo.toLowerCase().includes("maks tre") || profileSaveInfo.toLowerCase().includes("feilet")
                        ? "error"
                        : "success"
                    }
                    className="mt-3 !rounded-xl !px-3 !py-2 !text-sm"
                  />
                ) : null}
                <div className="mt-4 space-y-3">
                  {personalRecords.length === 0 ? (
                    <EmptyState
                      icon="🏅"
                      title="Ingen PR-er registrert ennå"
                      description="Når du logger styrkeøkter, vises personlige rekorder her."
                      className="bg-white"
                    />
                  ) : null}
                  {personalRecordsPreview.map((record) => (
                    <div key={record.name} className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setPrProgressExerciseName(record.name)}
                          className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
                        >
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            <span className="truncate">{record.name}</span>
                            <TrendingUp className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                          </div>
                          <div className="mt-1 text-sm text-slate-500">Beste registrerte: {record.weight} kg × {record.reps}</div>
                          <div className="mt-0.5 text-xs font-medium text-teal-700">Se styrkeutvikling</div>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void sharePersonalRecordEntry(record);
                          }}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                          aria-label={`Del personlig rekord for ${record.name}`}
                          title="Del på Facebook eller andre apper"
                        >
                          <Share2 className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavoritePersonalRecord(record.name);
                          }}
                          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border p-1.5 transition ${
                            cleanedFavoritePersonalRecordNames.includes(record.name)
                              ? "border-transparent text-white"
                              : "border-slate-200 bg-white text-slate-400"
                          }`}
                          style={
                            cleanedFavoritePersonalRecordNames.includes(record.name)
                              ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                              : { borderColor: "rgba(148,163,184,0.45)" }
                          }
                          aria-label={
                            cleanedFavoritePersonalRecordNames.includes(record.name)
                              ? "Fjern fra fremhevede PR-er"
                              : "Fremhev denne PR-en"
                          }
                          title={
                            cleanedFavoritePersonalRecordNames.includes(record.name)
                              ? "Fjern fra fremhevede PR-er"
                              : "Fremhev denne PR-en"
                          }
                        >
                          <Star
                            className={`h-4 w-4 ${cleanedFavoritePersonalRecordNames.includes(record.name) ? "text-white" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                  {personalRecords.length > 3 ? (
                    <OutlineButton
                      type="button"
                      onClick={() => setShowAllPersonalRecords((prev) => !prev)}
                      className="w-full sm:w-auto"
                    >
                      {showAllPersonalRecords ? "Vis bare fremhevede / topp 3" : `Se alle personlige rekorder (${personalRecords.length})`}
                    </OutlineButton>
                  ) : null}
                </div>
              </Card>

              <MuscleSplitCard
                stats={muscleSplitStats}
                metric={muscleSplitMetric}
                period={muscleSplitPeriod}
                onMetricChange={setMuscleSplitMetric}
                onPeriodChange={setMuscleSplitPeriod}
              />

              <div
                className="relative mt-6 overflow-hidden rounded-2xl border shadow-xl ring-1 ring-white/10"
                style={{
                  borderColor: "rgba(255,255,255,0.22)",
                  background: `linear-gradient(155deg, #0f766e 0%, ${MOTUS.turquoise} 32%, ${MOTUS.pink} 68%, #9d174d 100%)`,
                }}
              >
                <img
                  src={motusSkrytekortLogo}
                  alt=""
                  className="pointer-events-none absolute right-4 top-4 z-[1] h-auto max-h-[5.75rem] w-auto max-w-[44%] object-contain opacity-95 drop-shadow-[0_3px_12px_rgba(255,255,255,0.18)] sm:max-h-24"
                  aria-hidden
                />
                <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" aria-hidden />

                <div className="relative p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/30 backdrop-blur-sm">
                          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Ukesoppsummering
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold tracking-tight text-white drop-shadow-sm sm:text-2xl">Ukesoppsummering</h3>
                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/88">
                          Siste 7 dager — et delbart kort med mine tall og løftefakta, laget for treningsfeed.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { k: "Mine økter", v: String(progressShareLast7Days.workouts) },
                          { k: "Treningsdager", v: String(progressShareLast7Days.trainingDays) },
                          { k: "Mine sett", v: String(progressShareLast7Days.completedSets) },
                          { k: "Mitt volum", v: `${Math.round(progressShareLast7Days.volumeKg).toLocaleString("nb-NO")} kg` },
                        ].map((cell) => (
                          <div
                            key={cell.k}
                            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-left shadow-sm backdrop-blur-md"
                          >
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{cell.k}</div>
                            <div className="mt-0.5 text-lg font-bold tabular-nums text-white">{cell.v}</div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-left shadow-sm backdrop-blur-md">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Løftefakta</div>
                        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/92">{progressLiftPlayfulLine}</p>
                      </div>

                      <p className="text-xs font-medium text-white/80">
                        Siste 7 dager: {progressShareLast7Days.workouts} økter fordelt på {progressShareLast7Days.trainingDays} treningsdager.
                      </p>
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-xs lg:w-56">
                      <button
                        type="button"
                        onClick={() => void shareMonthlyProgressSummary()}
                        className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/25 ring-2 ring-white/50 transition hover:bg-white/95 hover:shadow-xl active:scale-[0.98]"
                      >
                        <Share2 className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
                        Last ned eller del bilde
                      </button>
                      <p className="text-center text-[11px] leading-snug text-white/75 lg:text-left">
                        Bildet kan lagres eller deles videre fra galleriet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {progressShareStatus ? (
                <StatusMessage
                  message={progressShareStatus}
                  tone={progressShareStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
                  className="mt-3 !rounded-xl !px-3 !py-2 !text-xs"
                />
              ) : null}
            </div>
          ) : null}

          {!isMemberLimited && memberTab === "messages" ? (
            <div className="space-y-4">
              <MemberTabHero
                title="Meldinger"
                description="Skriv med personlig trener. Samtalen lagres her slik at dere begge ser oppdateringene."
              />
            <Card className="p-5">
              <div className="space-y-4">
                <div ref={memberMessagesContainerRef} className="max-h-[min(52vh,20rem)] space-y-3 overflow-auto rounded-xl border bg-white p-3 sm:p-4">
                  {memberMessages.length === 0 ? (
                    <EmptyState
                      icon="💬"
                      title="Ingen meldinger ennå"
                      description="Start med en kort oppdatering til trener."
                      className="bg-slate-50"
                      action={
                        <OutlineButton onClick={() => setMessageText("Hei! Kort status:")} className="w-full sm:w-auto">
                          Sett inn forslag
                        </OutlineButton>
                      }
                    />
                  ) : null}
                  {memberMessages.map((message) => (
                    <div key={message.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${message.id === memberMessages[memberMessages.length - 1]?.id ? "motus-fade-in-up" : ""} ${message.sender === "member" ? "text-white ml-auto" : "bg-white border"}`} style={message.sender === "member" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                      <div>{message.text}</div>
                      <div className={`mt-1 text-[11px] ${message.sender === "member" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <TextInput
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value);
                      if (memberChatSendStatus) setMemberChatSendStatus(null);
                    }}
                    placeholder="Skriv melding til trener"
                  />
                  <GradientButton className="w-full sm:w-auto" onClick={() => {
                    if (!activeMemberId || !messageText.trim()) return;
                    void dispatchMemberMessageToRelatedMembers(messageText);
                    setMessageText("");
                  }} disabled={!messageText.trim() || isSendingMemberMessage}>{isSendingMemberMessage ? "Sender..." : "Send"}</GradientButton>
                </div>
                {memberChatSendStatus ? (
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs ${memberChatSendStatus.startsWith("Melding sendt") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
                    style={{ borderColor: memberChatSendStatus.startsWith("Melding sendt") ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)" }}
                  >
                    {memberChatSendStatus}
                  </div>
                ) : null}
              </div>
            </Card>
            </div>
          ) : null}

          {memberTab === "profile" ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Target className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Medlemsprofil</h2>
                  <p className="text-sm text-slate-500">Se og rediger kundeinformasjon</p>
                </div>
              </div>
              {editableMember ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Om meg</div>
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
                  {onOpenOnboarding ? (
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: "rgba(20,184,166,0.35)",
                        background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(236,72,153,0.06) 100%)",
                      }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="rounded-xl p-2 text-white shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                          >
                            <UserCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Oppstartsskjema</div>
                            <p className="mt-1 text-sm text-slate-600">
                              {showOnboardingHomePrompt || !onboardingSubstantivelyComplete
                                ? "Fyll ut én gang — PT bruker svarene til å lage et treningsprogram tilpasset deg."
                                : "Send inn på nytt hvis treneren ikke ser svarene dine, eller oppdater svarene."}
                            </p>
                          </div>
                        </div>
                        <GradientButton type="button" onClick={onOpenOnboarding} className="w-full shrink-0 sm:w-auto">
                          {showOnboardingHomePrompt || !onboardingSubstantivelyComplete ? "Start skjema" : "Åpne skjema"}
                        </GradientButton>
                      </div>
                    </div>
                  ) : null}
                  {!isMemberLimited ? (
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: "rgba(20,184,166,0.25)",
                        background: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(248,250,252,0.92) 100%)",
                      }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className="rounded-xl p-2 text-white shadow-sm"
                            style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}
                          >
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">Behov for å bytte PT?</div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">
                              Send en forespørsel til PT. Selve byttet bekreftes og gjennomføres av PT/admin, slik at program, logg og meldinger følger riktig med.
                            </p>
                          </div>
                        </div>
                      </div>
                      <label className="mt-3 block space-y-1">
                        <span className="text-xs font-medium text-slate-600">Kort forklaring (valgfritt)</span>
                        <TextArea
                          value={ptChangeReason}
                          onChange={(event) => {
                            setPtChangeReason(event.target.value);
                            if (ptChangeRequestStatus) setPtChangeRequestStatus(null);
                          }}
                          className="min-h-[76px]"
                          placeholder="F.eks. ønsker annen oppfølging, byttet treningsmål eller praktiske årsaker."
                        />
                      </label>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <GradientButton type="button" onClick={() => void handleRequestPtChange()} disabled={isSendingMemberMessage} className="w-full sm:w-auto">
                          {isSendingMemberMessage ? "Sender..." : "Be om PT-bytte"}
                        </GradientButton>
                        <OutlineButton type="button" onClick={() => setMemberTab("messages")} className="w-full sm:w-auto">
                          Åpne meldinger
                        </OutlineButton>
                      </div>
                      {ptChangeRequestStatus ? (
                        <StatusMessage
                          message={ptChangeRequestStatus}
                          tone={ptChangeRequestStatus.toLowerCase().includes("kunne ikke") ? "error" : "success"}
                          className="mt-3 !rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Profilbilde</div>
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border bg-slate-100 text-slate-400" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                      <ClientAvatarFallback iconClassName="h-12 w-12" />
                      {memberAvatarUrl ? (
                        <img
                          src={memberAvatarUrl}
                          alt="Ditt profilbilde"
                          className="relative z-10 h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>
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
                  {!isMemberLimited ? (
                  <div className="rounded-xl border bg-slate-50 p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-sm font-semibold text-slate-700">Øktmodus, feiring og varsler</div>
                    <p className="text-xs leading-snug text-slate-600">
                      Ny PR etter økt vises alltid. Du kan slå av den ekstra meldingen som kommer når du går opp et nivå i fremdriftssystemet på oversikten.
                    </p>
                    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <span>Pausenedtelling etter sett</span>
                      <input
                        type="checkbox"
                        checked={restCountdownEnabled}
                        onChange={(e) => setRestCountdownEnabled(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <span>Melding ved nytt fremdriftsnivå</span>
                      <input
                        type="checkbox"
                        checked={microCelebrationsEnabled}
                        onChange={(e) => setMicroCelebrationsEnabled(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <span>Lyd når du setter ny PR etter økt</span>
                      <input
                        type="checkbox"
                        checked={celebrationSoundEnabled}
                        onChange={(e) => setCelebrationSoundEnabled(e.target.checked)}
                      />
                    </label>
                  </div>
                  ) : null}
                  {!isMemberLimited && supabaseClient && isWebPushConfigurable() ? (
                    <div className="rounded-xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-sm font-semibold text-slate-700">Varsler på denne enheten</div>
                      <p className="text-xs text-slate-600">
                        Slå på varsler for å få beskjed når treneren sender deg en ny melding.
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
              )}
            </Card>
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
      finishWorkoutMode={finishWorkoutMode}
      cancelWorkoutMode={cancelWorkoutMode}
      restCountdownEnabled={restCountdownEnabled}
      onDismissWorkout={() => {
        dismissWorkoutMode();
        setPausedWorkoutsTick((value) => value + 1);
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
