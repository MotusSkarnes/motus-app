import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Apple, CalendarRange, ChevronDown, ChevronUp, ClipboardList, Dumbbell, Eye, EyeOff, Mail, MessageSquare, MoreHorizontal, Pencil, Play, Share2, ShieldCheck, Star, Trash2, UserCircle2, Users } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy, getDefaultPeriodPlanStartMondayISO, periodPlanStartDateForDateInput } from "../app/dateFormat";
import {
  getArchiveTombstones,
  hasArchiveTombstone,
  MEMBER_ARCHIVE_TOMBSTONE_EVENT,
  reconcileArchiveTombstonesWithRemoteMembers,
  removeArchiveTombstone,
} from "../app/memberArchiveTombstone";
import { memberHasNutritionAccess } from "../app/memberNutritionAccess";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import { getStatusClearDelayMs, useAutoClearStatus } from "../app/statusAutoClear";
import { isLikelyValidBirthDate, isValidEmail, normalizeBirthDate, normalizePhone } from "../app/validators";
import { buildDeleteExerciseFromBankDialogCopy, findProgramsUsingBankExercise } from "../app/exerciseBankUsage";
import { buildTrainerStatisticsData, type StatsPeriodPreset } from "../app/buildTrainerStatisticsData";
import { computeExercisePopularityScores, isPopularExercise, isRecommendedExercise } from "../app/exerciseBankStats";
import { muscleGroupChipClass } from "../app/customWorkoutBuilder";
import { splitMuscleGroupLabel } from "./muscleSplitStats";
import { ExerciseBankBadges, ExerciseBankListCard } from "./ExerciseBankListCard";
import { programAuthorLabelForTrainer } from "../app/programAuthor";
import { uid } from "../app/storage";
import {
  categoryForSubTab,
  defaultCategoryForExerciseBankTab,
  emptyTemplatesMessage,
  EXERCISE_CATEGORY_OPTIONS,
  exerciseMatchesExerciseBankTab,
  exerciseMatchesSubTab,
  exerciseCategoryAccentColor,
  isHoldBasedExerciseCategory,
  normalizeProgramExerciseForCategory,
  programDraftUsesHoldFields,
  programExerciseHoldSeconds,
  programsBuilderDescription,
  programsBuilderTitle,
  savedTemplatesTitle,
  subTabForExerciseCategory,
  TRAINING_SUB_TAB_OPTIONS,
  type ExerciseBankSubTab,
  type TrainingSubTab,
} from "../app/exerciseCategories";
import {
  buildProgramExerciseFromBank,
  defaultPrescriptionFieldsForCategory,
  prescriptionFieldsForExerciseSave,
  resolveExercisePrescriptionFields,
} from "../app/exercisePrescriptionFields";
import { ProgramExercisePrescriptionFields } from "./ProgramExercisePrescriptionFields";
import {
  formatProgramExercisePrescription,
  formatWorkoutResultPerformedLabel,
  formatWorkoutResultSetPlanLabel,
  resolveProgramExerciseName,
} from "../app/programExercisePresentation";
import {
  buildExerciseCategoryById,
  filterTemplateProgramsBySubTab,
  getTrainingProgramSubTab,
} from "../app/trainingProgramKind";
import { Card, ConfirmDialog, DangerButton, EmptyState, GradientButton, MotusSectionIcon, OutlineButton, PillButton, SelectBox, StatCard, StatusMessage, TextArea, TextInput } from "../app/ui";
import { useToastStatus } from "../app/toast";
import motusLogo from "../assets/motus-logo-transparent.svg";
import type {
  CreateMemberInput,
  CreateMemberResult,
  DeleteProgramContext,
  ReplaceWorkoutExerciseGroupInput,
  StartWorkoutModeOptions,
  UpdateMemberInput,
} from "../services/appRepository";
import type { ExercisePrescriptionFieldKey } from "../app/types";
import {
  filterMemberIdsForRosterSave,
  isMemberIdentityVisibleToTrainer,
  isPrivatePtRosterCustomerType,
  isSharedMedlemCustomerType,
  isSharedMedlemRosterMember,
  mergeRosterFieldsFromMemberCandidates,
  scoreMemberProfileSource,
} from "../services/memberAccessRules";
import {
  ensureMemberAuthLink,
  loadTrainerProfileForCurrentSession,
  saveTrainerProfile,
  type InviteMemberResult,
  type InviteTrainerResult,
} from "../services/supabaseAuth";
import { TrainerProfileCard } from "./TrainerProfileCard";
import { TrainerHomeOverview } from "./TrainerHomeOverview";
import type { TrainerFollowUpCardModel, TrainerPriorityMemberModel, TrainerTodoModel } from "./TrainerHomeOverview";
import { buildShareProgramChatMessage } from "../app/chatFormat";
import type { ChatReactionActor, ChatReactionEmoji } from "../app/chatReactions";
import { MotusChat, type MotusChatQuickAction } from "./MotusChat";
import {
  buildTrainerFocusItems,
  buildTrainerTodayFeed,
  countInactiveLastWeek,
} from "../app/trainerDashboardFeed";
import {
  buildCustomerFollowUpItems,
  buildCustomerMetrics,
  buildCustomerTimeline,
  memberAgeLabel,
} from "./trainer-dashboard/buildCustomerDashboardData";
import { TrainerPtDashboard, type TrainerListFilterTab, type TrainerPtListMember } from "./trainer-dashboard/TrainerPtDashboard";
import { TrainerPtDetailPortal } from "./trainer-dashboard/TrainerPtDetailPortal";
import { TrainerStatisticsView } from "./TrainerStatisticsView";
import { TrainerExerciseBankView } from "./TrainerExerciseBankView";
import { TrainerPeriodPlanCalendar } from "./TrainerPeriodPlanCalendar";
import { TrainerMealPlanEditor } from "./TrainerMealPlanEditor";
import { MemberFoodAvoidancesPanel } from "./nutrition/MemberFoodAvoidancesPanel";
import { MemberQuickFoodLogPanel } from "./nutrition/MemberQuickFoodLogPanel";
import { NutritionHub } from "./nutrition/NutritionHub";
import { TrainerProgramBuilderView } from "./TrainerProgramBuilderView";
import { TrainerPtHomeScreen } from "./trainer-home/TrainerPtHomeScreen";
import {
  buildTrainerPtHomeAttentionClients,
  buildTrainerPtHomeKpis,
  buildTrainerPtHomePlanItems,
  buildTrainerPtHomePopularContent,
  buildTrainerPtHomeProgressSeries,
  computeAverageClientProgressPct,
  countInspirationPostsThisMonth,
  countNewMembersThisWeek,
  countProgramsCreatedThisWeek,
} from "../app/buildTrainerPtHomeData";
import { loadInspirationItemsFromLocalStorage } from "../app/inspirationStorage";
import { CUSTOMER_NUTRITION_TAB_LABEL } from "../app/types";
import type {
  AuthUser,
  ChatMessage,
  CustomerSubTab,
  Exercise,
  Member,
  PeriodSchedulePlan,
  ProgramExercise,
  TrainerTab,
  TrainingProgram,
  WorkoutModeState,
  WorkoutReflection,
  WeekdayPlanKey,
  WeeklyDayPlan,
  WeeklySchedulePlan,
  WorkoutLog,
} from "../app/types";
import {
  daysSinceLastCompletedWorkout,
  formatTrainerMemberActivitySubtitle,
  memberPriorityScore,
  memberPriorityTone,
  memberTrainedWithinDays,
  trainerMemberListStatus,
  programBelongsToMember,
  programsAttributedToMember,
  trainerActivitySortKey,
  trainerInactiveDaysForFollowUp,
  type MemberPriorityTone,
} from "../app/memberActivity";
import { parseLogDateMs } from "../app/workoutLogDate";
import {
  deleteMemberPeriodPlanByPlanId,
  listTrainersForReassignFromSupabase,
  lookupMembersByEmailForTrainer,
  type TrainerRosterOption,
  upsertMemberPeriodPlansForTrainer,
} from "../services/supabaseRepository";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";
import { patchMemberAppUiStateInPersonalGoals } from "../app/memberAppUiState";
import { pickBestMemberDisplayName } from "../app/memberOnboarding";
import { pickBestPersonalGoals } from "../app/memberProfileGoals";
import { memberEffectivelyInvited } from "../app/memberInviteStatus";
import { resolveMemberTrainerDisplayName } from "../app/trainerProfile";
import { printHtmlDocument } from "../app/printHtmlDocument";
import { findProgramForPeriodPlanEntry } from "../app/periodPlanEntryActions";
import {
  dedupePeriodPlansById,
  memberIdsForPeriodPlanMerge,
  pickCanonicalMemberIdForPeriodPlans,
  sortPeriodPlansByRecency,
  syncGradientMarkedWeekDays,
} from "../app/periodPlanMerge";
import { buildDefaultStartWorkoutOptions } from "../app/buildStartWorkoutOptions";
import { MemberMonthlyCheckInSummary } from "./MemberMonthlyCheckInSummary";
import { MemberOnboardingSummary } from "./MemberOnboardingSummary";
import {
  buildTrainingProgramDisplayKey,
  dedupeTrainingPrograms,
  countExercisesInBlock,
  isFirstExerciseInBlock,
  programIsInMemberArchive,
  unlinkProgramExerciseBlock,
} from "../app/programBlocks";
import { LiveWorkoutSessionModal } from "./LiveWorkoutSessionModal";
import { ProgramExerciseBlockActions } from "./ProgramExerciseBlockActions";
import { PeriodPlanWeekNavigator } from "./PeriodPlanWeekNavigator";
import { TrainingProgramPreviewModal } from "./TrainingProgramPreviewModal";
import { ProgramCoverImageField } from "./ProgramCoverImageField";
import { uploadProgramCoverImageToSupabase } from "../app/programImageUpload";

const CUSTOMER_CARD_ACTION_BTN = "!min-h-8 !px-2.5 !py-1.5 !text-xs !rounded-md";

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
    normalized.includes("ryddet") ||
    normalized.includes("gjenopprett") ||
    normalized.includes("fullført") ||
    normalized.includes("lagt til")
  ) {
    return "success";
  }
  return "info";
}

/** Ikke popup for «Sender...»-status (vises allerede i knapper/skjema). */
function trainerPtStatusShouldToast(message: string): boolean {
  return !message.trim().toLowerCase().startsWith("sender");
}

const WORKOUT_LIST_RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function workoutLogMatchesTypeAndSearch(
  log: WorkoutLog,
  workoutTypeFilter: "all" | "program" | "group",
  query: string,
): boolean {
  const isGroupWorkout = log.programTitle.trim().toLowerCase().startsWith("gruppetime:");
  if (workoutTypeFilter === "group" && !isGroupWorkout) return false;
  if (workoutTypeFilter === "program" && isGroupWorkout) return false;
  if (query) {
    const haystack = `${log.programTitle} ${log.note ?? ""} ${log.reflection?.note ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function ClientAvatarFallback({ className = "", iconClassName = "h-5 w-5" }: { className?: string; iconClassName?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${className}`} aria-hidden="true">
      <UserCircle2 className={iconClassName} strokeWidth={1.7} />
    </div>
  );
}

type TrainerPortalProps = {
  members: Member[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  exercises: Exercise[];
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  /** Uleste melding-alerts fra notifications, per memberId. */
  unreadMessagesByMemberId?: Record<string, number>;
  trainerTab: TrainerTab;
  setTrainerTab: (tab: TrainerTab) => void;
  onSwitchToMemberView?: () => void;
  addMember: (input: CreateMemberInput) => Promise<CreateMemberResult>;
  deactivateMember: (memberId: string) => void;
  deleteMember: (memberId: string) => void;
  updateMember: (input: UpdateMemberInput) => void;
  markMemberInvited: (memberId: string, invitedAtIso?: string) => void;
  inviteMember: (
    email: string,
    memberId: string,
    options?: { forceResend?: boolean },
  ) => Promise<InviteMemberResult>;
  inviteTrainer: (email: string) => Promise<InviteTrainerResult>;
  restoreMemberByEmail: (
    email: string,
    options?: { ownerUserId?: string; claimForTrainer?: boolean },
  ) => Promise<{ ok: boolean; message: string }>;
  reassignMemberOwner: (input: {
    memberId: string;
    targetOwnerUserId: string;
  }) => Promise<{ ok: boolean; message: string }>;
  restoreMissingTestData: () => Promise<{ ok: boolean; message: string }>;
  restoreMembersFromRosterBackup: () => Promise<{ ok: boolean; message: string }>;
  restoreOriginalExerciseBank: () => Promise<{ ok: boolean; message: string }>;
  saveProgramForMember: (input: {
    id?: string;
    title: string;
    goal: string;
    notes: string;
    memberId: string;
    exercises: ProgramExercise[];
    imageUrl?: string;
    programCreatedBy?: "member" | "trainer";
    programCreatedByName?: string;
  }) => void;
  deleteProgramById: (programId: string, context?: DeleteProgramContext) => void;
  sendTrainerMessage: (memberId: string, text: string) => void;
  toggleChatMessageReaction: (messageId: string, emoji: ChatReactionEmoji, actor: ChatReactionActor) => void;
  markChatConversationRead: (memberId: string, reader: "trainer" | "member") => void;
  updateWorkoutLogTrainerComment?: (input: {
    logId: string;
    trainerComment: string;
    trainerCommentUpdatedAt?: string;
    trainerCommentAuthorName?: string;
  }) => void;
  clearLocalChatCache?: () => number;
  saveExercise: (input: {
    id?: string;
    name: string;
    category: Exercise["category"];
    group: string;
    equipment: string;
    level: Exercise["level"];
    description: string;
    imageUrl?: string;
    prescriptionFields?: ExercisePrescriptionFieldKey[];
    customField1Label?: string;
    customField2Label?: string;
  }) => void;
  deleteExercise: (exerciseId: string) => void;
  openCustomerMessagesSignal?: number;
  setOpenCustomerMessagesSignal?: Dispatch<SetStateAction<number>>;
  openCustomerOverviewSignal?: number;
  openCustomerNutritionSignal?: number;
  memberAvatarById?: Record<string, string>;
  setMemberAvatarUrlForMember?: (memberId: string, avatarUrl: string) => void;
  isLocalDemoSession?: boolean;
  canAccessAdminTools?: boolean;
  /** Innlogget treners visningsnavn – brukes når program lagres på kunde. */
  trainerAccountName?: string;
  onTrainerProfileSaved?: (user: AuthUser) => void;
  /** Synket fra Supabase ved hydrering (per medlem, inkl. tom liste). */
  remoteTrainerPeriodPlansByMemberId?: Record<string, PeriodSchedulePlan[]>;
  /** Live PT-økt på kundens program – samme tilstand som medlemssiden. */
  workoutMode?: WorkoutModeState | null;
  startWorkoutMode?: (programId: string, options?: StartWorkoutModeOptions) => void;
  updateWorkoutExerciseResult?: (
    exerciseId: string,
    field:
      | "performedWeight"
      | "performedReps"
      | "performedDurationMinutes"
      | "performedSpeed"
      | "performedIncline"
      | "completed",
    value: string | boolean,
  ) => void;
  replaceWorkoutExerciseGroup?: (input: ReplaceWorkoutExerciseGroupInput) => void;
  appendWorkoutSetForProgramExercise?: (programExerciseId: string) => void;
  deferWorkoutExerciseGroup?: (programExerciseId: string) => void;
  updateWorkoutModeNote?: (note: string) => void;
  updateWorkoutExerciseNote?: (programExerciseId: string, note: string) => void;
  finishWorkoutMode?: (input?: { reflection?: WorkoutReflection }) => void;
  cancelWorkoutMode?: () => void;
};

type MemberDedupePreviewMember = {
  id: string;
  ownerUserId?: string;
  email?: string;
  name?: string;
  isActive?: boolean;
  invitedAt?: string;
  daysSinceActivity?: string;
  customerType?: string;
  membershipType?: string;
  action?: "keep" | "deactivate" | string;
};

type MemberDedupePreviewGroup = {
  email: string;
  canonicalId: string;
  duplicateIds: string[];
  canonicalMember?: MemberDedupePreviewMember;
  duplicateMembers?: MemberDedupePreviewMember[];
  members?: MemberDedupePreviewMember[];
};

type MemberDedupeDryRunData = {
  duplicateGroupCount?: number;
  groups?: MemberDedupePreviewGroup[];
};

type FollowUpDetail = {
  id: string;
  at: string;
  method: "melding" | "telefon" | "mote";
  note: string;
};

function parseFollowUpMethod(value: string): FollowUpDetail["method"] {
  const raw = value.trim();
  if (raw === "telefon" || raw === "mote") return raw;
  return "melding";
}

function migrateFollowUpDetailsFromStorage(raw: string | null): Record<string, FollowUpDetail[]> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, FollowUpDetail[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key) continue;
      if (Array.isArray(value)) {
        const list: FollowUpDetail[] = [];
        for (const item of value) {
          if (!item || typeof item !== "object") continue;
          const row = item as Partial<FollowUpDetail>;
          const at = String(row.at ?? "");
          if (!at) continue;
          list.push({
            id: String(row.id || uid()),
            at,
            method: parseFollowUpMethod(String(row.method ?? "")),
            note: String(row.note ?? ""),
          });
        }
        if (list.length) out[key] = list;
      } else if (value && typeof value === "object") {
        const row = value as Partial<FollowUpDetail>;
        const at = String(row.at ?? "");
        if (!at) continue;
        out[key] = [
          {
            id: String(row.id || uid()),
            at,
            method: parseFollowUpMethod(String(row.method ?? "")),
            note: String(row.note ?? ""),
          },
        ];
      }
    }
    return out;
  } catch {
    return {};
  }
}

function mergeFollowUpEntriesForMemberIds(
  memberIds: string[],
  byMemberId: Record<string, FollowUpDetail[]>,
): FollowUpDetail[] {
  const seen = new Set<string>();
  const merged: FollowUpDetail[] = [];
  for (const memberId of memberIds) {
    for (const entry of byMemberId[memberId] ?? []) {
      if (!entry?.id || !entry.at) continue;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
  }
  return merged.sort((a, b) => b.at.localeCompare(a.at));
}

function nextLastFollowUpMapForIds(
  prev: Record<string, string>,
  memberIds: string[],
  detailsMap: Record<string, FollowUpDetail[]>,
): Record<string, string> {
  const out = { ...prev };
  for (const id of memberIds) {
    const logs = detailsMap[id] ?? [];
    if (!logs.length) delete out[id];
    else out[id] = logs.reduce((best, e) => (e.at > best ? e.at : best), logs[0].at);
  }
  return out;
}

/** Øvelse brukt som malrad ved oppretting av kondisjonsintervaller fra øvelsesbanken. */
function pickCardioIntervalExerciseForTemplate(allExercises: Exercise[]): Exercise | undefined {
  if (!allExercises.length) return undefined;
  const eqLo = (e: Exercise) => e.equipment.trim().toLowerCase();
  const nameLo = (e: Exercise) => e.name.trim().toLowerCase();
  const isKond = (e: Exercise) => e.category === "Kondisjon";
  const isTreadmill = (e: Exercise) =>
    eqLo(e).includes("tredem") || eqLo(e).includes("mølle") || nameLo(e).includes("mølle");
  const isBike = (e: Exercise) => eqLo(e).includes("sykkel") || nameLo(e).includes("sykkel");

  return (
    allExercises.find((e) => isKond(e) && isTreadmill(e) && nameLo(e).includes("intervall")) ??
    allExercises.find((e) => isKond(e) && isTreadmill(e)) ??
    allExercises.find((e) => isKond(e) && isBike(e)) ??
    allExercises.find((e) => isKond(e)) ??
    allExercises[0]
  );
}

function hasCardioNedjoggRow(draft: ProgramExercise[]): boolean {
  return draft.some((row) => row.exerciseName.trim().toLowerCase().startsWith("nedjogg"));
}

function countCardioDragRows(draft: ProgramExercise[]): number {
  return draft.filter((row) => /^drag\b/i.test(row.exerciseName.trim())).length;
}

function cardioSetLabel(): string {
  return "Antall drag";
}

function cardioSetPlaceholder(): string {
  return "drag";
}

/** Kondisjonsmal / intervallrader – ikke bare når øvelsesbanken har category «Kondisjon». */
function isCardioDraftRow(
  item: ProgramExercise,
  linkedExercise: Exercise | undefined,
  options?: { conditioningBuilder?: boolean },
): boolean {
  if (options?.conditioningBuilder) return true;
  if (linkedExercise?.category === "Kondisjon") return true;
  const name = item.exerciseName.trim();
  if (/^oppvarming$/i.test(name) || /^nedjogg/i.test(name) || /^drag\b/i.test(name)) return true;
  return Boolean(String(item.durationMinutes ?? "").trim());
}

const PERIOD_PLANS_STORAGE_KEY = "motus.trainer.periodPlansByMemberId";
const WEEKDAY_PLAN_FIELDS: Array<{ key: WeekdayPlanKey; label: string }> = [
  { key: "monday", label: "Mandag" },
  { key: "tuesday", label: "Tirsdag" },
  { key: "wednesday", label: "Onsdag" },
  { key: "thursday", label: "Torsdag" },
  { key: "friday", label: "Fredag" },
  { key: "saturday", label: "Lørdag" },
  { key: "sunday", label: "Søndag" },
];
const GROUP_WORKOUT_PLAN_OPTIONS = [
  "Gruppetime",
  "Gruppetime: Smilepuls",
  "Gruppetime: Sykkel 45",
  "Gruppetime: Mølle 45",
  "Gruppetime: Sterk",
  "Gruppetime: Sirkeltrening",
  "Gruppetime: Stram opp",
  "Gruppetime: Dansemix",
  "Gruppetime: Yoga",
  "Gruppetime: Tabata",
  "Gruppetime: Godt voksen",
  "Gruppetime: Step styrke",
];

const DEFAULT_EXERCISE_GROUP_OPTIONS = [
  "Bryst",
  "Rygg",
  "Skuldre",
  "Biceps",
  "Triceps",
  "Underarm",
  "Kjerne",
  "Mage",
  "Korsrygg",
  "Sete",
  "Hofte",
  "Forside lår",
  "Bakside lår",
  "Innside lår",
  "Utside lår",
  "Legg",
  "Ankel",
  "Nakke",
  "Helkropp",
  "Kondisjon",
  "Mobilitet",
  "Rehab",
];

const DEFAULT_EXERCISE_EQUIPMENT_OPTIONS = [
  "Manualer",
  "Kettlebell",
  "Matte",
  "Benk",
  "Vektskive",
  "Apparat",
  "Vektstang",
  "Egenvekt",
  "Kroppsvekt",
  "Strikk",
  "Kabel",
  "TRX/slynge",
  "Medisinball",
  "Foam roller",
  "Stepkasse",
  "Mølle",
  "Sykkel",
  "Romaskin",
  "Vegg",
  "Dørkarm",
  "Diverse",
];

function splitMultiValue(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function joinMultiValues(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(", ");
}

function addMultiValue(current: string, nextValue: string): string {
  const normalizedNextValue = nextValue.trim();
  if (!normalizedNextValue) return current;
  return joinMultiValues([...splitMultiValue(current), normalizedNextValue]);
}

function removeMultiValue(current: string, valueToRemove: string): string {
  const normalizedValueToRemove = valueToRemove.trim().toLowerCase();
  return joinMultiValues(splitMultiValue(current).filter((value) => value.toLowerCase() !== normalizedValueToRemove));
}

function multiValueIncludes(value: string, candidate: string): boolean {
  const normalizedCandidate = candidate.trim().toLowerCase();
  return splitMultiValue(value).some((item) => item.toLowerCase() === normalizedCandidate);
}

function createEmptyWeeklyDayPlan(): WeeklyDayPlan {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  };
}

function parseChatCreatedAtMs(value: string): number {
  if (!value) return 0;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.getTime();
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

/** Relaterte medlems-ID-er (e-post/navn) for valgt rad – brukes når listen oppdateres uten at det logisk er en annen kunde. */
function computeSelectedMemberRelatedIds(members: Member[], selectedMemberId: string | null): string[] {
  if (selectedMemberId === "__template__") return [];
  if (!selectedMemberId) return [];
  const selected = members.find((member) => member.id === selectedMemberId);
  if (!selected) return [selectedMemberId];
  const normalizedEmail = selected.email.trim().toLowerCase();
  const byEmailIds = normalizedEmail
    ? members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail).map((member) => member.id)
    : [];
  const merged = Array.from(new Set([...byEmailIds, selectedMemberId]));
  return merged.length ? merged : [selectedMemberId];
}

export function TrainerPortal(props: TrainerPortalProps) {
  const EXERCISE_IMAGE_BUCKET = "exercise-images";
  const MAX_EXERCISE_IMAGE_BYTES = 5 * 1024 * 1024;

function escapeHtml(value: unknown): string {
  const safe = String(value ?? "");
  return safe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickFirstName(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  return firstToken.trim();
}

  const ALLOWED_EXERCISE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const {
    members,
    programs,
    logs,
    messages,
    exercises,
    selectedMemberId,
    setSelectedMemberId,
    unreadMessagesByMemberId = {},
    trainerTab,
    setTrainerTab,
    onSwitchToMemberView,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    reassignMemberOwner,
    restoreMissingTestData,
    restoreMembersFromRosterBackup,
    restoreOriginalExerciseBank,
    saveProgramForMember,
  deleteProgramById,
  sendTrainerMessage,
  toggleChatMessageReaction,
  markChatConversationRead,
  updateWorkoutLogTrainerComment,
    clearLocalChatCache,
    saveExercise,
    deleteExercise,
    openCustomerMessagesSignal = 0,
    setOpenCustomerMessagesSignal,
    openCustomerOverviewSignal = 0,
    openCustomerNutritionSignal = 0,
    memberAvatarById = {},
    setMemberAvatarUrlForMember,
    isLocalDemoSession = false,
    canAccessAdminTools = true,
    remoteTrainerPeriodPlansByMemberId = {},
    trainerAccountName = "",
    onTrainerProfileSaved,
    workoutMode = null,
    startWorkoutMode = () => {},
    updateWorkoutExerciseResult = () => {},
    replaceWorkoutExerciseGroup = () => {},
    appendWorkoutSetForProgramExercise = () => {},
    deferWorkoutExerciseGroup = () => {},
    updateWorkoutModeNote = () => {},
    updateWorkoutExerciseNote = () => {},
    finishWorkoutMode = () => {},
    cancelWorkoutMode = () => {},
  } = props;

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [programFormImageUrl, setProgramFormImageUrl] = useState("");
  const [programCoverCleared, setProgramCoverCleared] = useState(false);
  const [isUploadingProgramImage, setIsUploadingProgramImage] = useState(false);
  const [trainerMessage, setTrainerMessage] = useState("");
  const [isSendingTrainerMessage, setIsSendingTrainerMessage] = useState(false);
  const isSendingTrainerMessageRef = useRef(false);
  const pendingInviteSendKeyRef = useRef("");
  const lastTrainerSendKeyRef = useRef<string>("");
  const lastTrainerSendAtRef = useRef<number>(0);
  const trainerMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const trainerSendAttemptRef = useRef(0);
  const [trainerChatSendStatus, setTrainerChatSendStatus] = useState<string | null>(null);
  const [chatShareProgramPickerOpen, setChatShareProgramPickerOpen] = useState(false);
  const [ptListFilterTab, setPtListFilterTab] = useState<TrainerListFilterTab>("all");
  const [statsPeriodPreset, setStatsPeriodPreset] = useState<StatsPeriodPreset>("30d");
  const [customerSubTab, setCustomerSubTab] = useState<CustomerSubTab>("overview");
  const [programsSubTab, setProgramsSubTab] = useState<TrainingSubTab>("strength");
  const [exerciseBankSubTab, setExerciseBankSubTab] = useState<ExerciseBankSubTab>("all");
  const [customerProgramBuilderFocus, setCustomerProgramBuilderFocus] = useState<"training" | "period">("training");
  const [selectedWorkoutLogId, setSelectedWorkoutLogId] = useState<string | null>(null);
  const [programExercisesDraft, setProgramExercisesDraft] = useState<ProgramExercise[]>([]);
  const [templateProgramTitle, setTemplateProgramTitle] = useState("Ny treningsmal");
  const [editingTemplateProgramId, setEditingTemplateProgramId] = useState<string | null>(null);
  const [expandedTemplateProgramId, setExpandedTemplateProgramId] = useState<string | null>(null);
  const [selectedTemplateProgramId, setSelectedTemplateProgramId] = useState("");
  const [templateAssignStatus, setTemplateAssignStatus] = useState<string | null>(null);
  const [draggedExerciseIdFromLibrary, setDraggedExerciseIdFromLibrary] = useState<string | null>(null);
  const [draggedDraftExerciseId, setDraggedDraftExerciseId] = useState<string | null>(null);
  const [isDraftDropZoneActive, setIsDraftDropZoneActive] = useState(false);
  const [dragOverDraftExerciseId, setDragOverDraftExerciseId] = useState<string | null>(null);
  const [programExerciseSearch, setProgramExerciseSearch] = useState("");
  const [programExerciseCategoryFilter, setProgramExerciseCategoryFilter] = useState<"all" | Exercise["category"]>("all");
  const [programExerciseGroupFilter, setProgramExerciseGroupFilter] = useState("all");
  const [periodPlansByMemberId, setPeriodPlansByMemberId] = useState<Record<string, PeriodSchedulePlan[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(PERIOD_PLANS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, PeriodSchedulePlan[]>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [periodPlanTitleDraft, setPeriodPlanTitleDraft] = useState("Periodeplan");
  const [periodPlanNotesDraft, setPeriodPlanNotesDraft] = useState("");
  const [periodPlanStartDateDraft, setPeriodPlanStartDateDraft] = useState(() => getDefaultPeriodPlanStartMondayISO());
  const [periodPlanWeeksDraft, setPeriodPlanWeeksDraft] = useState("1");
  const [periodPlanDraftId, setPeriodPlanDraftId] = useState<string | null>(null);
  const [periodPlanCreatingNew, setPeriodPlanCreatingNew] = useState(false);
  const [periodWeeklyPlansDraft, setPeriodWeeklyPlansDraft] = useState<WeeklySchedulePlan[]>([
    { id: uid("period-week"), weekNumber: 1, days: createEmptyWeeklyDayPlan() },
  ]);
  const [activePeriodWeekId, setActivePeriodWeekId] = useState<string>(periodWeeklyPlansDraft[0]?.id ?? "");
  const [savedPeriodPlanWeekByPlanId, setSavedPeriodPlanWeekByPlanId] = useState<Record<string, number>>({});
  const [periodPlanStatus, setPeriodPlanStatus] = useState<string | null>(null);
  const [periodPlanPreviewProgram, setPeriodPlanPreviewProgram] = useState<TrainingProgram | null>(null);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("motus.trainer.favoriteExerciseIds");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programSaveStatus, setProgramSaveStatus] = useState<string | null>(null);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberGoal, setNewMemberGoal] = useState("");
  const [newMemberFocus, setNewMemberFocus] = useState("");
  const [newMemberInviteType, setNewMemberInviteType] = useState<"PT-kunde" | "Premium-kunde" | "Medlem">("PT-kunde");
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [newMemberSuccess, setNewMemberSuccess] = useState<string | null>(null);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [pendingProgramMemberEmail, setPendingProgramMemberEmail] = useState<string | null>(null);
  const [pendingInviteMemberEmail, setPendingInviteMemberEmail] = useState<string | null>(null);
  const [newTrainerEmail, setNewTrainerEmail] = useState("");
  const [newTrainerName, setNewTrainerName] = useState("");
  const [inviteTrainerStatus, setInviteTrainerStatus] = useState<string | null>(null);
  const [isInvitingTrainer, setIsInvitingTrainer] = useState(false);
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  const [archiveTombstones, setArchiveTombstones] = useState<Set<string>>(() => getArchiveTombstones());
  useEffect(() => {
    function onTombstoneChange() {
      setArchiveTombstones(getArchiveTombstones());
    }
    window.addEventListener(MEMBER_ARCHIVE_TOMBSTONE_EVENT, onTombstoneChange);
    return () => window.removeEventListener(MEMBER_ARCHIVE_TOMBSTONE_EVENT, onTombstoneChange);
  }, []);
  const [databaseEmailLookup, setDatabaseEmailLookup] = useState<Awaited<ReturnType<typeof lookupMembersByEmailForTrainer>> | null>(
    null,
  );
  const [isLookingUpEmail, setIsLookingUpEmail] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "followUp" | "invited" | "notInvited" | "noProgram">("all");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "PT-kunde" | "Premium-kunde" | "Medlem">("all");
  const [memberSort, setMemberSort] = useState<"activityRecent" | "nameAsc" | "nameDesc">("activityRecent");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [memberLinkStatus, setMemberLinkStatus] = useState<string | null>(null);
  const [isRepairingMemberLink, setIsRepairingMemberLink] = useState(false);
  const [memberEditEmail, setMemberEditEmail] = useState("");
  const [memberEditName, setMemberEditName] = useState("");
  const [memberEditPhone, setMemberEditPhone] = useState("");
  const [memberEditBirthDate, setMemberEditBirthDate] = useState("");
  const [memberEditGoal, setMemberEditGoal] = useState("");
  const [memberEditInjuries, setMemberEditInjuries] = useState("");
  const [memberEditIsPtCustomer, setMemberEditIsPtCustomer] = useState(false);
  const [memberEditIsPremiumCustomer, setMemberEditIsPremiumCustomer] = useState(false);
  const [memberEditIsSharedMember, setMemberEditIsSharedMember] = useState(false);
  const [memberEditNutritionAccess, setMemberEditNutritionAccess] = useState(false);
  const [newMemberNutritionAccess, setNewMemberNutritionAccess] = useState(false);
  const [isEditingCustomerCard, setIsEditingCustomerCard] = useState(false);
  const [memberEditStatus, setMemberEditStatus] = useState<string | null>(null);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoringArchivedEmail, setRestoringArchivedEmail] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isRestoringMember, setIsRestoringMember] = useState(false);
  const [memberDedupeStatus, setMemberDedupeStatus] = useState<string | null>(null);
  const [isRunningMemberDedupe, setIsRunningMemberDedupe] = useState(false);
  const [memberDedupePreviewGroups, setMemberDedupePreviewGroups] = useState<MemberDedupePreviewGroup[]>([]);
  const [memberDedupePreviewOwnerUserId, setMemberDedupePreviewOwnerUserId] = useState("");
  const [adminHealthStatus, setAdminHealthStatus] = useState<string | null>(null);
  const [adminCacheStatus, setAdminCacheStatus] = useState<string | null>(null);
  const [currentTrainerOwnerUserId, setCurrentTrainerOwnerUserId] = useState("");
  const [isRefreshingAdminHealth, setIsRefreshingAdminHealth] = useState(false);
  const [adminDuplicateGroupCount, setAdminDuplicateGroupCount] = useState<number | null>(null);
  const [lastMemberCleanupAt, setLastMemberCleanupAt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("motus.admin.lastMemberCleanupAt") ?? "";
  });
  const [reassignMemberId, setReassignMemberId] = useState("");
  const [reassignTargetTrainerId, setReassignTargetTrainerId] = useState("");
  const [trainerOptionsForReassign, setTrainerOptionsForReassign] = useState<TrainerRosterOption[]>([]);
  const [isLoadingTrainerOptions, setIsLoadingTrainerOptions] = useState(false);
  const [reassignStatus, setReassignStatus] = useState<string | null>(null);
  const [isReassigningMember, setIsReassigningMember] = useState(false);
  const [restoreDataStatus, setRestoreDataStatus] = useState<string | null>(null);
  const [isRestoringTestData, setIsRestoringTestData] = useState(false);
  const [rosterBackupStatus, setRosterBackupStatus] = useState<string | null>(null);
  const [isRestoringRosterBackup, setIsRestoringRosterBackup] = useState(false);
  const [restoreExerciseBankStatus, setRestoreExerciseBankStatus] = useState<string | null>(null);
  const [isRestoringExerciseBank, setIsRestoringExerciseBank] = useState(false);
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTodoDate, setSelectedTodoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todoTitle, setTodoTitle] = useState("");
  const [todos, setTodos] = useState<Array<{ id: string; title: string; date: string; done: boolean }>>([]);
  const [lastFollowUpByMemberId, setLastFollowUpByMemberId] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("motus.trainer.lastFollowUpByMemberId");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([key, value]) => typeof key === "string" && typeof value === "string")
      );
    } catch {
      return {};
    }
  });
  const [followUpDetailsByMemberId, setFollowUpDetailsByMemberId] = useState<Record<string, FollowUpDetail[]>>(() => {
    if (typeof window === "undefined") return {};
    return migrateFollowUpDetailsFromStorage(window.localStorage.getItem("motus.trainer.followUpDetailsByMemberId"));
  });
  const [followUpMethodDraft, setFollowUpMethodDraft] = useState<FollowUpDetail["method"]>("melding");
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [followUpSaveStatus, setFollowUpSaveStatus] = useState<string | null>(null);
  const [editingFollowUpEntryId, setEditingFollowUpEntryId] = useState<string | null>(null);
  const [dismissedProgramFingerprints, setDismissedProgramFingerprints] = useState<string[]>([]);
  /** Unngå å laste notatutkast på nytt når `selectedMemberId` byttes mellom duplikat-rader (samme kunde). */
  const followUpDraftHydratedIdentityRef = useRef<string | null>(null);
  const followUpLastSyncedFromLogRef = useRef(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "red" | "orange" | "green">("all");
  const [prioritySort, setPrioritySort] = useState<"highFirst" | "lowFirst">("highFirst");
  const [priorityMemberTypeSort, setPriorityMemberTypeSort] = useState<"none" | "ptFirst" | "premiumFirst" | "standardFirst">("none");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<"all" | Exercise["category"]>("all");
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exerciseFormName, setExerciseFormName] = useState("");
  const [exerciseFormCategory, setExerciseFormCategory] = useState<Exercise["category"]>("Styrke");
  const [exerciseFormGroup, setExerciseFormGroup] = useState("");
  const [exerciseFormEquipment, setExerciseFormEquipment] = useState("");
  const [exerciseFormLevel, setExerciseFormLevel] = useState<Exercise["level"]>("Nybegynner");
  const [exerciseFormDescription, setExerciseFormDescription] = useState("");
  const [exerciseFormImageUrl, setExerciseFormImageUrl] = useState("");
  const [exerciseFormPrescriptionFields, setExerciseFormPrescriptionFields] = useState<ExercisePrescriptionFieldKey[]>([]);
  const [exerciseFormCustomField1Label, setExerciseFormCustomField1Label] = useState("");
  const [exerciseFormCustomField2Label, setExerciseFormCustomField2Label] = useState("");
  const [isUploadingExerciseImage, setIsUploadingExerciseImage] = useState(false);
  const [exerciseFormStatus, setExerciseFormStatus] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [showCustomerToolsMobile, setShowCustomerToolsMobile] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    tone?: "danger" | "default";
    onConfirm: () => void;
  } | null>(null);
  const editLockedMemberIdRef = useRef<string | null>(null);
  const editLockedIdentityRef = useRef<{ email: string } | null>(null);
  const [workoutDateRangeFilter, setWorkoutDateRangeFilter] = useState<"7d" | "30d" | "all">("7d");
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState<"all" | "program" | "group">("all");
  const [workoutSearchQuery, setWorkoutSearchQuery] = useState("");
  const [workoutSortOrder, setWorkoutSortOrder] = useState<"newest" | "oldest">("newest");
  const [trainerWorkoutCommentDraft, setTrainerWorkoutCommentDraft] = useState("");
  const [trainerWorkoutCommentStatus, setTrainerWorkoutCommentStatus] = useState<string | null>(null);
  const [trainerLiveWorkoutSaveStatus, setTrainerLiveWorkoutSaveStatus] = useState<string | null>(null);
  useAutoClearStatus(trainerChatSendStatus, () => setTrainerChatSendStatus(null), getStatusClearDelayMs(trainerChatSendStatus));
  useAutoClearStatus(templateAssignStatus, () => setTemplateAssignStatus(null), getStatusClearDelayMs(templateAssignStatus));
  useAutoClearStatus(periodPlanStatus, () => setPeriodPlanStatus(null), getStatusClearDelayMs(periodPlanStatus));
  useAutoClearStatus(programSaveStatus, () => setProgramSaveStatus(null), getStatusClearDelayMs(programSaveStatus));
  useAutoClearStatus(inviteTrainerStatus, () => setInviteTrainerStatus(null), getStatusClearDelayMs(inviteTrainerStatus));
  useAutoClearStatus(inviteStatus, () => setInviteStatus(null), getStatusClearDelayMs(inviteStatus));
  useAutoClearStatus(memberLinkStatus, () => setMemberLinkStatus(null), getStatusClearDelayMs(memberLinkStatus));
  useAutoClearStatus(memberEditStatus, () => setMemberEditStatus(null), getStatusClearDelayMs(memberEditStatus));
  useAutoClearStatus(restoreStatus, () => setRestoreStatus(null), getStatusClearDelayMs(restoreStatus));
  useAutoClearStatus(memberDedupeStatus, () => setMemberDedupeStatus(null), getStatusClearDelayMs(memberDedupeStatus));
  useAutoClearStatus(adminHealthStatus, () => setAdminHealthStatus(null), getStatusClearDelayMs(adminHealthStatus));
  useAutoClearStatus(adminCacheStatus, () => setAdminCacheStatus(null), getStatusClearDelayMs(adminCacheStatus));
  useAutoClearStatus(restoreDataStatus, () => setRestoreDataStatus(null), getStatusClearDelayMs(restoreDataStatus));
  useAutoClearStatus(restoreExerciseBankStatus, () => setRestoreExerciseBankStatus(null), getStatusClearDelayMs(restoreExerciseBankStatus));
  useAutoClearStatus(followUpSaveStatus, () => setFollowUpSaveStatus(null), getStatusClearDelayMs(followUpSaveStatus));
  useAutoClearStatus(exerciseFormStatus, () => setExerciseFormStatus(null), getStatusClearDelayMs(exerciseFormStatus));
  useAutoClearStatus(trainerWorkoutCommentStatus, () => setTrainerWorkoutCommentStatus(null), getStatusClearDelayMs(trainerWorkoutCommentStatus));
  useAutoClearStatus(trainerLiveWorkoutSaveStatus, () => setTrainerLiveWorkoutSaveStatus(null), getStatusClearDelayMs(trainerLiveWorkoutSaveStatus));
  useToastStatus(trainerChatSendStatus, { title: "Meldinger", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(programSaveStatus, { title: "Treningsprogram", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(inviteTrainerStatus, { title: "PT-invitasjon", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(inviteStatus, { title: "Invitasjon", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(memberEditStatus, { title: "Kundekort", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(memberLinkStatus, { title: "Medlemskobling", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(exerciseFormStatus, { title: "Øvelse", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(trainerWorkoutCommentStatus, { title: "Øktkommentar", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  useToastStatus(trainerLiveWorkoutSaveStatus, { title: "Live økt", tone: inferStatusTone, shouldToast: trainerPtStatusShouldToast });
  function getMemberIdentityKey(member: Member): string {
    const emailKey = member.email.trim().toLowerCase();
    return emailKey || `id:${member.id}`;
  }
  function pickCanonicalMemberProfile(base: Member, candidates: Member[]): Member {
    if (!candidates.length) return base;
    const prioritized = [...candidates].sort(
      (a, b) => scoreMemberProfileSource(b, currentTrainerOwnerUserId) - scoreMemberProfileSource(a, currentTrainerOwnerUserId),
    );
    const pickPreferredNonEmpty = (values: string[]): string => {
      for (let i = 0; i < values.length; i += 1) {
        const value = String(values[i] ?? "").trim();
        if (value) return value;
      }
      return "";
    };
    const phones = prioritized.map((member) => member.phone);
    const birthDates = prioritized.map((member) => member.birthDate);
    const goals = prioritized.map((member) => member.goal);
    const injuries = prioritized.map((member) => member.injuries);
    const focuses = prioritized.map((member) => member.focus);
    const personalGoalsList = candidates.map((member) => member.personalGoals);
    const personalGoals = pickBestPersonalGoals(personalGoalsList) || base.personalGoals;
    const roster = mergeRosterFieldsFromMemberCandidates(candidates, currentTrainerOwnerUserId);
    return {
      ...base,
      ...roster,
      name: pickBestMemberDisplayName(base, candidates, personalGoals) || base.name,
      phone: pickPreferredNonEmpty(phones) || base.phone,
      birthDate: pickPreferredNonEmpty(birthDates) || base.birthDate,
      goal: pickPreferredNonEmpty(goals) || base.goal,
      focus: pickPreferredNonEmpty(focuses) || base.focus,
      injuries: pickPreferredNonEmpty(injuries) || base.injuries,
      personalGoals,
    };
  }
  const deduplicatedMembers = useMemo(() => {
    function memberScore(member: Member): number {
      let score = 0;
      const isOwned = (member.ownerUserId ?? "").trim() === currentTrainerOwnerUserId;
      if (isOwned && member.customerType === "PT-kunde") score += 5000;
      if (isOwned && member.membershipType === "Premium") score += 3000;
      if (member.customerType === "PT-kunde") score += 2500;
      if (member.membershipType === "Premium") score += 800;
      if (isSharedMedlemRosterMember(member)) score += 400;
      if (isOwned) score += 1000;
      if (member.isActive !== false) score += 8;
      if (member.invitedAt) score += 2;
      const days = trainerActivitySortKey(member, members, logs);
      if (days < 999999 && Number.isFinite(days)) {
        score += Math.max(0, 100 - Math.min(100, days));
      }
      return score;
    }

    const pickLatestNonEmpty = (values: string[]): string => {
      for (let i = values.length - 1; i >= 0; i -= 1) {
        const value = String(values[i] ?? "").trim();
        if (value) return value;
      }
      return "";
    };

    const byIdentity = new Map<string, Member[]>();
    members.forEach((member) => {
      const identityKey = getMemberIdentityKey(member);
      const group = byIdentity.get(identityKey) ?? [];
      group.push(member);
      byIdentity.set(identityKey, group);
    });

    const merged: Member[] = [];
    for (const [, group] of byIdentity) {
      if (!group.length) continue;
      const sorted = [...group].sort((a, b) => {
        const aActive = a.isActive !== false ? 1 : 0;
        const bActive = b.isActive !== false ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const scoreDelta = memberScore(b) - memberScore(a);
        if (scoreDelta !== 0) return scoreDelta;
        return a.id.localeCompare(b.id);
      });
      const base = sorted[0] ?? group[0];
      if (!base) continue;
      const phones = group.map((member) => member.phone);
      const birthDates = group.map((member) => member.birthDate);
      const goals = group.map((member) => member.goal);
      const injuries = group.map((member) => member.injuries);
      const personalGoalsList = group.map((member) => member.personalGoals);
      // Lokal tombstone gjelder bare når ingen rader i gruppen er aktive — ellers skjules kunden
      // fra listen mens kundekortet fortsatt vises (selectedMemberId i rå members).
      const identityEmail = base.email.trim().toLowerCase();
      const groupHasActiveRow = group.some((member) => member.isActive !== false);
      const isTombstoned =
        identityEmail.includes("@") && archiveTombstones.has(identityEmail) && !groupHasActiveRow;
      const roster = mergeRosterFieldsFromMemberCandidates(group, currentTrainerOwnerUserId);
      const personalGoals = pickBestPersonalGoals(personalGoalsList) || base.personalGoals;
      const trainerId = currentTrainerOwnerUserId.trim();
      const canonicalId =
        (selectedMemberId && group.some((member) => member.id === selectedMemberId) ? selectedMemberId : "") ||
        group.find(
          (member) =>
            member.customerType === "PT-kunde" &&
            trainerId &&
            String(member.ownerUserId ?? "").trim() === trainerId,
        )?.id ||
        base.id;
      merged.push({
        ...base,
        id: canonicalId,
        ...roster,
        name: pickBestMemberDisplayName(base, group, personalGoals) || base.name,
        phone: pickLatestNonEmpty(phones) || base.phone,
        birthDate: pickLatestNonEmpty(birthDates) || base.birthDate,
        goal: pickLatestNonEmpty(goals) || base.goal,
        injuries: pickLatestNonEmpty(injuries) || base.injuries,
        personalGoals,
        invitedAt: pickLatestNonEmpty(group.map((member) => member.invitedAt)) || base.invitedAt,
        isActive: !isTombstoned && group.some((member) => member.isActive !== false),
      });
    }
    return merged;
  }, [members, currentTrainerOwnerUserId, logs, archiveTombstones, selectedMemberId]);
  const selectedMember = useMemo(() => {
    const byId =
      deduplicatedMembers.find((member) => member.id === selectedMemberId) ??
      members.find((member) => member.id === selectedMemberId);
    if (byId) return byId;
    const raw = members.find((member) => member.id === selectedMemberId);
    const email = raw?.email.trim().toLowerCase() ?? "";
    if (!email.includes("@")) return null;
    return deduplicatedMembers.find((member) => member.email.trim().toLowerCase() === email) ?? raw ?? null;
  }, [deduplicatedMembers, members, selectedMemberId]);
  const selectedMemberHasMessagingAccess = selectedMember
    ? selectedMember.customerType === "PT-kunde" || selectedMember.membershipType === "Premium"
    : false;
  const selectedMemberMessagesLocked = Boolean(selectedMember && !selectedMemberHasMessagingAccess);

  useEffect(() => {
    if (!isSupabaseConfigured || isLocalDemoSession) return;
    reconcileArchiveTombstonesWithRemoteMembers(members);
  }, [members, isLocalDemoSession]);

  useEffect(() => {
    if (!selectedMember?.email) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!email.includes("@")) return;
    if (!hasArchiveTombstone(email)) return;
    if (members.some((m) => m.email.trim().toLowerCase() === email && m.isActive !== false)) {
      removeArchiveTombstone(email);
    }
  }, [selectedMember?.email, members]);

  useEffect(() => {
    if (!selectedMember?.id || selectedMember.id === selectedMemberId) return;
    setSelectedMemberId(selectedMember.id);
  }, [selectedMember?.id, selectedMemberId, setSelectedMemberId]);

  const trainerProgramMemberIds = useMemo(() => {
    const trainerId = currentTrainerOwnerUserId.trim();
    if (!trainerId) return new Set<string>();
    const ids = new Set<string>();
    programs.forEach((program) => {
      if ((program.ownerUserId ?? "").trim() !== trainerId) return;
      const memberId = program.memberId.trim();
      if (memberId && memberId !== "__template__") ids.add(memberId);
    });
    return ids;
  }, [programs, currentTrainerOwnerUserId]);

  const activeMembers = useMemo(() => {
    const trainerId = currentTrainerOwnerUserId.trim();
    const shouldApplyTrainerVisibility = isSupabaseConfigured && !isLocalDemoSession;
    return deduplicatedMembers.filter((member) => {
      if (member.isActive === false) return false;
      if (!shouldApplyTrainerVisibility) return true;
      return isMemberIdentityVisibleToTrainer(member, members, trainerId, {
        programMemberIds: trainerProgramMemberIds,
      });
    });
  }, [
    deduplicatedMembers,
    members,
    currentTrainerOwnerUserId,
    isLocalDemoSession,
    trainerProgramMemberIds,
  ]);
  const archivedMembersForAdmin = useMemo(() => {
    const trainerId = currentTrainerOwnerUserId.trim();
    const activeIdentityKeys = new Set(
      members
        .filter((member) => member.isActive !== false)
        .map((member) => getMemberIdentityKey(member)),
    );
    const byIdentity = new Map<string, Member>();
    members.forEach((member) => {
      if (member.isActive !== false) return;
      const identityKey = getMemberIdentityKey(member);
      if (activeIdentityKeys.has(identityKey)) return;
      const owner = (member.ownerUserId ?? "").trim();
      if (trainerId) {
        const visible = isSharedMedlemRosterMember(member) || owner === trainerId;
        if (!visible) return;
      }
      const existing = byIdentity.get(identityKey);
      if (!existing) {
        byIdentity.set(identityKey, member);
        return;
      }
      const nextScore = scoreMemberProfileSource(member, trainerId);
      const existingScore = scoreMemberProfileSource(existing, trainerId);
      if (nextScore > existingScore) {
        byIdentity.set(identityKey, member);
      }
    });
    return Array.from(byIdentity.values()).sort((a, b) => a.name.localeCompare(b.name, "no"));
  }, [members, currentTrainerOwnerUserId]);
  const visibleMembers = useMemo(() => {
    const trainerId = currentTrainerOwnerUserId.trim();
    if (showInactiveMembers) {
      return deduplicatedMembers.filter((member) =>
        isMemberIdentityVisibleToTrainer(member, members, trainerId, {
          includeInactive: true,
          programMemberIds: trainerProgramMemberIds,
        }),
      );
    }
    return activeMembers;
  }, [
    showInactiveMembers,
    deduplicatedMembers,
    activeMembers,
    members,
    currentTrainerOwnerUserId,
    trainerProgramMemberIds,
  ]);
  const unreadMessagesByIdentityKey = useMemo(() => {
    const counts = new Map<string, number>();
    Object.entries(unreadMessagesByMemberId).forEach(([memberId, count]) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return;
      const key = getMemberIdentityKey(member);
      counts.set(key, (counts.get(key) ?? 0) + Math.max(0, Number(count) || 0));
    });
    return counts;
  }, [unreadMessagesByMemberId, members]);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return visibleMembers
      .filter((member) => {
        const matchesSearch =
          !query ||
          member.name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query) ||
          member.goal.toLowerCase().includes(query);
        if (!matchesSearch) return false;
        if (customerTypeFilter === "PT-kunde" && member.customerType !== "PT-kunde") return false;
        if (customerTypeFilter === "Premium-kunde" && member.membershipType !== "Premium") return false;
        if (customerTypeFilter === "Medlem" && member.customerType !== "Medlem") return false;
        if (memberFilter === "followUp") return (trainerInactiveDaysForFollowUp(member, members, logs) ?? -1) >= 7;
        if (memberFilter === "invited") return memberEffectivelyInvited(member, members, { messages, logs });
        if (memberFilter === "notInvited") return !memberEffectivelyInvited(member, members, { messages, logs });
        if (memberFilter === "noProgram") return !programs.some((program) => program.memberId === member.id);
        if (priorityFilter !== "all" && memberPriorityTone(member, members, logs) !== priorityFilter) return false;
        return true;
      });
  }, [visibleMembers, memberSearch, memberFilter, customerTypeFilter, priorityFilter, members, messages, logs, programs]);
  const memberSearchRecovery = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query || query.length < 3) return null;
    const rawMatches = members.filter((member) => {
      const email = member.email.trim().toLowerCase();
      const name = member.name.trim().toLowerCase();
      return email.includes(query) || name.includes(query);
    });
    if (!rawMatches.length) return null;
    const visibleIdentityKeys = new Set(visibleMembers.map((member) => getMemberIdentityKey(member)));
    const hiddenMatches = rawMatches.filter((member) => !visibleIdentityKeys.has(getMemberIdentityKey(member)));
    const inactiveMatches = rawMatches.filter((member) => member.isActive === false);
    const primaryEmail = rawMatches.find((member) => member.email.trim())?.email.trim().toLowerCase() ?? "";
    return { rawMatches, hiddenMatches, inactiveMatches, primaryEmail };
  }, [memberSearch, members, visibleMembers]);

  useEffect(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query.includes("@") || query.length < 5 || memberSearchRecovery) {
      setDatabaseEmailLookup(null);
      setIsLookingUpEmail(false);
      return;
    }
    let cancelled = false;
    setIsLookingUpEmail(true);
    void lookupMembersByEmailForTrainer(query, currentTrainerOwnerUserId).then((result) => {
      if (cancelled) return;
      setDatabaseEmailLookup(result);
      setIsLookingUpEmail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [memberSearch, memberSearchRecovery, currentTrainerOwnerUserId]);

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      if (memberSort === "nameAsc") return a.name.localeCompare(b.name, "no");
      if (memberSort === "nameDesc") return b.name.localeCompare(a.name, "no");
      const aDays = trainerActivitySortKey(a, members, logs);
      const bDays = trainerActivitySortKey(b, members, logs);
      if (aDays !== bDays) return aDays - bDays;
      return a.name.localeCompare(b.name, "no");
    });
  }, [filteredMembers, memberSort, members, logs]);
  const findNewestPendingMemberByEmail = useCallback((email: string): Member | null => {
    const normalizedEmail = email.trim().toLowerCase();
    const matches = members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail);
    if (!matches.length) return null;
    return [...matches].reverse().sort((a, b) => {
      const aOwned = (a.ownerUserId ?? "").trim() === currentTrainerOwnerUserId ? 1 : 0;
      const bOwned = (b.ownerUserId ?? "").trim() === currentTrainerOwnerUserId ? 1 : 0;
      if (aOwned !== bOwned) return bOwned - aOwned;
      const aActive = a.isActive !== false ? 1 : 0;
      const bActive = b.isActive !== false ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aInvited = a.invitedAt?.trim() ? 1 : 0;
      const bInvited = b.invitedAt?.trim() ? 1 : 0;
      return aInvited - bInvited;
    })[0] ?? null;
  }, [members, currentTrainerOwnerUserId]);
  const memberAvatarByEmail = useMemo(() => {
    const byEmail: Record<string, string> = {};
    const byIdentity: Record<string, string> = {};
    members.forEach((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      const identityKey = getMemberIdentityKey(member);
      if (normalizedEmail) {
        const emailKeyAvatar = memberAvatarById[`email:${normalizedEmail}`];
        if (emailKeyAvatar && !byEmail[normalizedEmail]) {
          byEmail[normalizedEmail] = emailKeyAvatar;
          if (!byIdentity[identityKey]) byIdentity[identityKey] = emailKeyAvatar;
        }
      }
      const avatarUrl = memberAvatarById[member.id];
      if (normalizedEmail && avatarUrl && !byEmail[normalizedEmail]) {
        byEmail[normalizedEmail] = avatarUrl;
        if (!byIdentity[identityKey]) byIdentity[identityKey] = avatarUrl;
      }
    });
    return { byEmail, byIdentity };
  }, [members, memberAvatarById]);
  function resolveMemberAvatarUrl(member: Member): string {
    // Returnerer kun en URL hvis vi vet at avatar-fil faktisk er lastet opp.
    // memberAvatarById hydreres ved å liste konkrete objekter i Supabase Storage,
    // så fravær der => ingen bilde, og vi viser placeholder. Vi GIR IKKE en spekulativ
    // public URL ut basert på e-post — det forårsaker "ødelagt bilde"-ikon i UI når
    // medlemmet ikke har lastet opp avatar.
    const direct = memberAvatarById[member.id];
    if (direct) return direct;
    const normalizedEmail = member.email.trim().toLowerCase();
    if (normalizedEmail) {
      const byEmail = memberAvatarByEmail.byEmail[normalizedEmail];
      if (byEmail) return byEmail;
    }
    const byIdentity = memberAvatarByEmail.byIdentity[getMemberIdentityKey(member)];
    if (byIdentity) return byIdentity;
    return "";
  }
  const selectedMemberRelatedIds = useMemo(
    () => computeSelectedMemberRelatedIds(members, selectedMemberId),
    [members, selectedMemberId]
  );
  const selectedMemberRelatedIdSet = useMemo(() => new Set(selectedMemberRelatedIds), [selectedMemberRelatedIds]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const selectedMemberProfileSourceMembers = useMemo(() => {
    if (!selectedMember) return [] as Member[];
    const selectedEmail = selectedMember.email.trim().toLowerCase();
    if (!selectedEmail) return [selectedMember];
    return members.filter((member) => member.email.trim().toLowerCase() === selectedEmail);
  }, [selectedMember, members]);
  const selectedMemberProfile = useMemo(() => {
    if (!selectedMember) return null;
    const relatedMembers = selectedMemberProfileSourceMembers;
    return pickCanonicalMemberProfile(selectedMember, relatedMembers);
  }, [selectedMember, selectedMemberProfileSourceMembers]);
  const selectedMemberNutritionAccess = memberHasNutritionAccess(selectedMemberProfile ?? selectedMember);
  const selectedMemberCreatedByTrainerLabel = useMemo(() => {
    if (!selectedMember) return null;
    const fromProfile = resolveMemberTrainerDisplayName(selectedMember, programs)?.trim();
    if (fromProfile) return fromProfile;
    const ownerId = (selectedMember.ownerUserId ?? "").trim();
    if (ownerId && ownerId === currentTrainerOwnerUserId.trim()) {
      const selfName = trainerAccountName.trim();
      if (selfName) return selfName;
    }
    return null;
  }, [selectedMember, programs, currentTrainerOwnerUserId, trainerAccountName]);
  const selectedMemberEditSnapshot = useMemo(() => {
    if (!selectedMemberProfile) return null;
    return {
      name: selectedMemberProfile.name.trim(),
      email: selectedMemberProfile.email.trim().toLowerCase(),
      phone: normalizePhone(selectedMemberProfile.phone),
      birthDate: selectedMemberProfile.birthDate.trim() ? normalizeBirthDate(selectedMemberProfile.birthDate) : "",
      goal: selectedMemberProfile.goal,
      injuries: selectedMemberProfile.injuries,
      isPtCustomer: selectedMemberProfile.customerType === "PT-kunde",
      isPremiumCustomer: selectedMemberProfile.membershipType === "Premium",
      isSharedMember: selectedMemberProfile.customerType === "Medlem",
    };
  }, [selectedMemberProfile]);
  const currentMemberEditSnapshot = useMemo(
    () => ({
      name: memberEditName.trim(),
      email: memberEditEmail.trim().toLowerCase(),
      phone: normalizePhone(memberEditPhone),
      birthDate: memberEditBirthDate.trim() ? normalizeBirthDate(memberEditBirthDate) : "",
      goal: memberEditGoal,
      injuries: memberEditInjuries,
      isPtCustomer: memberEditIsPtCustomer,
      isPremiumCustomer: memberEditIsPremiumCustomer,
      isSharedMember: memberEditIsSharedMember,
    }),
    [
      memberEditName,
      memberEditEmail,
      memberEditPhone,
      memberEditBirthDate,
      memberEditGoal,
      memberEditInjuries,
      memberEditIsPtCustomer,
      memberEditIsPremiumCustomer,
      memberEditIsSharedMember,
    ],
  );
  const hasUnsavedCustomerCardChanges =
    isEditingCustomerCard &&
    Boolean(selectedMemberEditSnapshot) &&
    JSON.stringify(currentMemberEditSnapshot) !== JSON.stringify(selectedMemberEditSnapshot);
  const selectedPrograms = useMemo(
    () => {
      const selected = selectedMemberProfile ?? members.find((member) => member.id === selectedMemberId) ?? null;
      if (!selected) return [] as TrainingProgram[];
      return dedupeTrainingPrograms(
        programsAttributedToMember(selected, members, programs).filter(
          (program) => !programIsInMemberArchive(program.memberLibraryStatus),
        ),
      );
    },
    [programs, members, selectedMemberId, selectedMemberProfile]
  );
  const visibleSelectedPrograms = useMemo(() => {
    if (!dismissedProgramFingerprints.length) return selectedPrograms;
    const dismissed = new Set(dismissedProgramFingerprints);
    return selectedPrograms.filter((program) => !dismissed.has(buildTrainingProgramDisplayKey(program)));
  }, [dismissedProgramFingerprints, selectedPrograms]);
  const activeTrainerWorkoutProgram = useMemo(() => {
    if (!workoutMode) return null;
    return programs.find((p) => p.id === workoutMode.programId) ?? null;
  }, [workoutMode, programs]);

  function handleTrainerStartLiveWorkout(program: TrainingProgram) {
    if (!program.exercises.length) {
      window.alert("Programmet har ingen øvelser.");
      return;
    }
    if (!selectedMemberId) {
      window.alert("Velg en kunde før du starter live økt.");
      return;
    }
    if (workoutMode) {
      if (!window.confirm("Det pågår allerede en økt. Vil du avbryte den uten å lagre og starte denne?")) return;
      cancelWorkoutMode();
    }
    startWorkoutMode(program.id, {
      ...buildDefaultStartWorkoutOptions(program, exercises),
      memberId: selectedMemberId,
    });
  }

  function handleFinishTrainerLiveWorkout(input?: {
    reflection?: WorkoutReflection;
    onPersisted?: (result: { ok: boolean; message?: string }) => void;
  }) {
    const customerName = selectedMemberProfile?.name ?? selectedMember?.name ?? "kunden";
    finishWorkoutMode({
      ...input,
      onPersisted: (result) => {
        if (result.ok) {
          setTrainerLiveWorkoutSaveStatus(`Økten er lagret på ${customerName}.`);
        } else {
          setTrainerLiveWorkoutSaveStatus(result.message?.trim() || "Kunne ikke lagre økten i sky. Prøv igjen.");
        }
        input?.onPersisted?.(result);
      },
    });
  }

  const canonicalPeriodPlanMemberId = useMemo(
    () => pickCanonicalMemberIdForPeriodPlans(selectedMemberRelatedIds, members),
    [selectedMemberRelatedIds, members],
  );
  const periodPlanMemberIdsForMerge = useMemo(
    () => memberIdsForPeriodPlanMerge(selectedMemberRelatedIds, canonicalPeriodPlanMemberId),
    [selectedMemberRelatedIds, canonicalPeriodPlanMemberId],
  );
  const selectedPeriodPlans = useMemo(() => {
    if (!periodPlanMemberIdsForMerge.length) return [] as PeriodSchedulePlan[];
    const merged = periodPlanMemberIdsForMerge.flatMap((memberId) => periodPlansByMemberId[memberId] ?? []);
    return sortPeriodPlansByRecency(dedupePeriodPlansById(merged));
  }, [periodPlansByMemberId, periodPlanMemberIdsForMerge]);
  const templatePrograms = useMemo(
    () => programs.filter((program) => program.memberId === "__template__"),
    [programs],
  );
  const exerciseCategoryById = useMemo(() => buildExerciseCategoryById(exercises), [exercises]);
  const activeTemplatePrograms = useMemo(
    () => filterTemplateProgramsBySubTab(templatePrograms, programsSubTab, exerciseCategoryById),
    [templatePrograms, programsSubTab, exerciseCategoryById],
  );
  const selectedLogs = useMemo(() => {
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const isSharedMember = selected?.customerType === "Medlem";
    const selectedEmail = selected?.email.trim().toLowerCase() ?? "";
    return logs
      .filter((log) => {
        if (selectedMemberRelatedIdSet.has(log.memberId)) return true;
        if (!isSharedMember) return false;
        const rawLogMemberId = log.memberId.trim().toLowerCase();
        if (selectedEmail && rawLogMemberId === selectedEmail) return true;
        const ownerMember = memberById.get(log.memberId);
        if (!ownerMember) return false;
        const ownerEmail = ownerMember.email.trim().toLowerCase();
        if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
        return false;
      })
      .sort((a, b) => parseLogDateMs(b.date) - parseLogDateMs(a.date));
  }, [logs, selectedMemberRelatedIdSet, members, selectedMemberId, memberById]);
  const selectedMessages = useMemo(() => {
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const isSharedMember = selected?.customerType === "Medlem";
    const selectedEmail = selected?.email.trim().toLowerCase() ?? "";
    const filtered = messages
      .filter((message) => {
        if (selectedMemberRelatedIdSet.has(message.memberId)) return true;
        if (!isSharedMember) return false;
        const rawMessageMemberId = message.memberId.trim().toLowerCase();
        if (selectedEmail && rawMessageMemberId === selectedEmail) return true;
        const ownerMember = memberById.get(message.memberId);
        if (!ownerMember) return false;
        const ownerEmail = ownerMember.email.trim().toLowerCase();
        if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
        return false;
      })
      .sort((a, b) => parseChatCreatedAtMs(a.createdAt) - parseChatCreatedAtMs(b.createdAt));
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
  }, [messages, selectedMemberRelatedIdSet, members, selectedMemberId, memberById]);
  const selectedMemberFollowUpLog = useMemo(
    () => mergeFollowUpEntriesForMemberIds(selectedMemberRelatedIds, followUpDetailsByMemberId),
    [selectedMemberRelatedIds, followUpDetailsByMemberId]
  );
  const latestCompletedLog = selectedLogs.find((log) => log.status === "Fullført") ?? null;
  const selectedDaysSinceLastCompletedWorkout = useMemo(() => {
    if (!selectedMember) return null;
    return daysSinceLastCompletedWorkout(selectedMember, members, logs);
  }, [selectedMember, members, logs]);
  const selectedLatestMessage = selectedMessages.length ? selectedMessages[selectedMessages.length - 1] : null;
  const selectedLatestFollowUpEntry = selectedMemberFollowUpLog[0] ?? null;
  const selectedFollowUpTone =
    selectedDaysSinceLastCompletedWorkout === null
      ? "neutral"
      : selectedDaysSinceLastCompletedWorkout >= 10
        ? "critical"
        : selectedDaysSinceLastCompletedWorkout >= 7
          ? "watch"
          : "good";
  const selectedNextAction =
    selectedPrograms.length === 0
      ? "Lag første treningsprogram"
      : selectedFollowUpTone === "critical"
        ? "Send oppfølging i dag"
        : selectedFollowUpTone === "watch"
          ? "Sjekk inn med kunden"
          : selectedLogs.length === 0
            ? "Få kunden i gang med første økt"
            : "Følg med på neste økt";
  const selectedNextActionCta = useMemo((): { tab: CustomerSubTab; label: string; presetMessage?: boolean } => {
    if (selectedPrograms.length === 0) {
      return { tab: "programs", label: "Gå til program & planer" };
    }
    if (selectedFollowUpTone === "critical" || selectedFollowUpTone === "watch") {
      return { tab: "messages", label: "Send melding", presetMessage: true };
    }
    if (selectedLogs.length === 0) {
      return { tab: "workouts", label: "Gå til økter" };
    }
    return { tab: "workouts", label: "Se økter" };
  }, [selectedPrograms.length, selectedFollowUpTone, selectedLogs.length]);
  useEffect(() => {
    if (customerSubTab !== "messages") return;
    const container = trainerMessagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [customerSubTab, selectedMessages.length]);
  useEffect(() => {
    setChatShareProgramPickerOpen(false);
  }, [selectedMemberId, customerSubTab]);
  const filteredWorkoutLogs = useMemo(() => {
    const now = Date.now();
    const query = workoutSearchQuery.trim().toLowerCase();
    const withParsedDate = selectedLogs.map((log) => ({ log, dateMs: parseLogDateMs(log.date) }));
    const filtered = withParsedDate.filter(({ log, dateMs }) => {
      if (workoutDateRangeFilter !== "all" && dateMs > 0) {
        const maxAgeMs = workoutDateRangeFilter === "7d" ? WORKOUT_LIST_RECENT_MS : 30 * 24 * 60 * 60 * 1000;
        if (now - dateMs > maxAgeMs) return false;
      }
      return workoutLogMatchesTypeAndSearch(log, workoutTypeFilter, query);
    });
    filtered.sort((a, b) => (workoutSortOrder === "newest" ? b.dateMs - a.dateMs : a.dateMs - b.dateMs));
    return filtered.map((entry) => entry.log);
  }, [selectedLogs, workoutDateRangeFilter, workoutTypeFilter, workoutSearchQuery, workoutSortOrder]);
  const olderMatchingWorkoutCount = useMemo(() => {
    const now = Date.now();
    const query = workoutSearchQuery.trim().toLowerCase();
    let count = 0;
    for (const log of selectedLogs) {
      const dateMs = parseLogDateMs(log.date);
      if (dateMs <= 0 || now - dateMs <= WORKOUT_LIST_RECENT_MS) continue;
      if (!workoutLogMatchesTypeAndSearch(log, workoutTypeFilter, query)) continue;
      count += 1;
    }
    return count;
  }, [selectedLogs, workoutTypeFilter, workoutSearchQuery]);
  const workoutInsights = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let workoutsLast7Days = 0;
    let groupWorkoutsLast30Days = 0;
    let difficultySum = 0;
    let difficultyCount = 0;

    selectedLogs.forEach((log) => {
      const dateMs = parseLogDateMs(log.date);
      if (dateMs > 0) {
        const ageMs = now - dateMs;
        if (ageMs <= sevenDaysMs) {
          workoutsLast7Days += 1;
        }
        if (ageMs <= thirtyDaysMs) {
          const isGroupWorkout = log.programTitle.trim().toLowerCase().startsWith("gruppetime:");
          if (isGroupWorkout) {
            groupWorkoutsLast30Days += 1;
          }
          const difficulty = log.reflection?.difficultyLevel;
          if (difficulty && difficulty >= 1 && difficulty <= 5) {
            difficultySum += difficulty;
            difficultyCount += 1;
          }
        }
      }
    });

    return {
      workoutsLast7Days,
      groupWorkoutsLast30Days,
      averageDifficulty:
        difficultyCount > 0
          ? `${(difficultySum / difficultyCount).toFixed(1)} / 5`
          : "Ingen data",
    };
  }, [selectedLogs]);
  const filteredSelectedWorkoutLog = useMemo(() => {
    if (!filteredWorkoutLogs.length) return null;
    if (!selectedWorkoutLogId) return filteredWorkoutLogs[0];
    return filteredWorkoutLogs.find((log) => log.id === selectedWorkoutLogId) ?? filteredWorkoutLogs[0];
  }, [filteredWorkoutLogs, selectedWorkoutLogId]);

  useEffect(() => {
    setTrainerWorkoutCommentDraft(filteredSelectedWorkoutLog?.trainerComment ?? "");
  }, [filteredSelectedWorkoutLog?.id, filteredSelectedWorkoutLog?.trainerComment]);
  function reflectionEmoji(level?: 1 | 2 | 3 | 4 | 5): string {
    if (!level) return "–";
    return `${level}/5`;
  }
  const exercisePopularityScores = useMemo(
    () => computeExercisePopularityScores(exercises, programs, logs),
    [exercises, programs, logs],
  );
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = exercises.filter((exercise) => {
      const categoryOk =
        trainerTab === "exerciseBank"
          ? exerciseMatchesExerciseBankTab(exercise.category, exerciseBankSubTab)
          : exerciseCategoryFilter === "all" || exercise.category === exerciseCategoryFilter;
      if (!categoryOk) return false;
      if (!query) return true;
      return (
        exercise.name.toLowerCase().includes(query) ||
        exercise.group.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.description.toLowerCase().includes(query)
      );
    });
    return filtered.sort((a, b) => {
      const aFavorite = favoriteExerciseIds.includes(a.id) ? 1 : 0;
      const bFavorite = favoriteExerciseIds.includes(b.id) ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      const aScore = exercisePopularityScores.get(a.id) ?? 0;
      const bScore = exercisePopularityScores.get(b.id) ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name, "no");
    });
  }, [exercises, exerciseSearch, exerciseCategoryFilter, exerciseBankSubTab, favoriteExerciseIds, trainerTab, exercisePopularityScores]);
  const programExerciseGroupOptions = useMemo(() => {
    const groups = Array.from(new Set(exercises.flatMap((exercise) => splitMultiValue(exercise.group))));
    return groups.sort((a, b) => a.localeCompare(b, "no"));
  }, [exercises]);
  const exerciseFormGroupOptions = useMemo(() => {
    const merged = new Set([...DEFAULT_EXERCISE_GROUP_OPTIONS, ...programExerciseGroupOptions]);
    splitMultiValue(exerciseFormGroup).forEach((group) => merged.add(group));
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "no"));
  }, [programExerciseGroupOptions, exerciseFormGroup]);
  const exerciseFormEquipmentOptions = useMemo(() => {
    const existingEquipment = exercises.flatMap((exercise) => splitMultiValue(exercise.equipment));
    const merged = new Set([...DEFAULT_EXERCISE_EQUIPMENT_OPTIONS, ...existingEquipment]);
    splitMultiValue(exerciseFormEquipment).forEach((equipment) => merged.add(equipment));
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "no"));
  }, [exercises, exerciseFormEquipment]);
  const visibleProgramExercises = useMemo(() => {
    const query = programExerciseSearch.trim().toLowerCase();
    const filtered = exercises.filter((exercise) => {
      if (trainerTab === "programs" && !exerciseMatchesSubTab(exercise.category, programsSubTab)) return false;
      if (trainerTab !== "programs" && programExerciseCategoryFilter !== "all" && exercise.category !== programExerciseCategoryFilter) {
        return false;
      }
      if (programExerciseGroupFilter !== "all" && !multiValueIncludes(exercise.group, programExerciseGroupFilter)) return false;
      if (!query) return true;
      return (
        exercise.name.toLowerCase().includes(query) ||
        exercise.group.toLowerCase().includes(query) ||
        exercise.equipment.toLowerCase().includes(query) ||
        exercise.description.toLowerCase().includes(query)
      );
    });
    return filtered.sort((a, b) => {
      const aFavorite = favoriteExerciseIds.includes(a.id) ? 1 : 0;
      const bFavorite = favoriteExerciseIds.includes(b.id) ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      const aScore = exercisePopularityScores.get(a.id) ?? 0;
      const bScore = exercisePopularityScores.get(b.id) ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name, "no");
    });
  }, [exercises, programExerciseSearch, programExerciseCategoryFilter, programExerciseGroupFilter, favoriteExerciseIds, programsSubTab, trainerTab, exercisePopularityScores]);
  const exercisesById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const activePeriodWeek = useMemo(
    () => periodWeeklyPlansDraft.find((week) => week.id === activePeriodWeekId) ?? periodWeeklyPlansDraft[0] ?? null,
    [periodWeeklyPlansDraft, activePeriodWeekId],
  );
  useEffect(() => {
    if (!periodWeeklyPlansDraft.length) {
      setActivePeriodWeekId("");
      return;
    }
    setActivePeriodWeekId((prev) => {
      if (prev && periodWeeklyPlansDraft.some((week) => week.id === prev)) return prev;
      return periodWeeklyPlansDraft[0]?.id ?? "";
    });
  }, [periodWeeklyPlansDraft]);

  useEffect(() => {
    const parsed = Math.max(1, Math.min(12, Number(periodPlanWeeksDraft) || 1));
    setPeriodWeeklyPlansDraft((prev) => {
      if (prev.length === parsed) return prev;
      const normalized = prev.slice(0, parsed).map((week, index) => ({ ...week, weekNumber: index + 1 }));
      while (normalized.length < parsed) {
        normalized.push({
          id: uid("period-week"),
          weekNumber: normalized.length + 1,
          days: createEmptyWeeklyDayPlan(),
        });
      }
      return normalized;
    });
  }, [periodPlanWeeksDraft]);
  const periodPlanProgramOptions = useMemo(() => {
    const baseOptions = [
      { value: "", label: "Ingen plan valgt" },
      { value: "Hvile / restitusjon", label: "Hvile / restitusjon" },
      { value: "Aktiv restitusjon", label: "Aktiv restitusjon" },
      { value: "Valgfri økt", label: "Valgfri økt" },
      ...GROUP_WORKOUT_PLAN_OPTIONS.map((label) => ({ value: label, label })),
    ];
    const programOptions = selectedPrograms.map((program) => ({
      value: program.title,
      label: program.title,
    }));
    const uniqueByValue = new Map<string, { value: string; label: string }>();
    [...baseOptions, ...programOptions].forEach((option) => {
      if (!uniqueByValue.has(option.value)) uniqueByValue.set(option.value, option);
    });
    return Array.from(uniqueByValue.values());
  }, [selectedPrograms]);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberSearch", memberSearch);
  }, [memberSearch]);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberFilter", memberFilter);
  }, [memberFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.favoriteExerciseIds", JSON.stringify(favoriteExerciseIds));
  }, [favoriteExerciseIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PERIOD_PLANS_STORAGE_KEY, JSON.stringify(periodPlansByMemberId));
  }, [periodPlansByMemberId]);

  useEffect(() => {
    if (!isSupabaseConfigured || isLocalDemoSession) return;
    const keys = Object.keys(remoteTrainerPeriodPlansByMemberId);
    if (!keys.length) return;
    setPeriodPlansByMemberId((prev) => {
      const next = { ...prev };
      keys.forEach((memberId) => {
        const remotePlans = remoteTrainerPeriodPlansByMemberId[memberId] ?? [];
        const localPlans = next[memberId] ?? [];
        next[memberId] = dedupePeriodPlansById([...localPlans, ...remotePlans]);
      });
      return next;
    });
  }, [isLocalDemoSession, remoteTrainerPeriodPlansByMemberId]);

  useEffect(() => {
    setDismissedProgramFingerprints([]);
  }, [selectedMemberId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("motus.trainer.todos");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<{ id: string; title: string; date: string; done: boolean }>;
      if (Array.isArray(parsed)) setTodos(parsed);
    } catch {
      // ignore corrupted local todo state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.todos", JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    if (!activeTemplatePrograms.length) {
      setSelectedTemplateProgramId("");
      return;
    }
    if (!activeTemplatePrograms.some((program) => program.id === selectedTemplateProgramId)) {
      setSelectedTemplateProgramId(activeTemplatePrograms[0].id);
    }
  }, [activeTemplatePrograms, selectedTemplateProgramId]);

  useEffect(() => {
    if (trainerTab !== "programs") return;
    setProgramExerciseCategoryFilter(categoryForSubTab(programsSubTab));
  }, [programsSubTab, trainerTab]);

  useEffect(() => {
    if (trainerTab !== "exerciseBank") return;
    if (exerciseBankSubTab === "all") {
      setExerciseCategoryFilter("all");
      return;
    }
    setExerciseCategoryFilter(categoryForSubTab(exerciseBankSubTab));
  }, [exerciseBankSubTab, trainerTab]);

  useEffect(() => {
    if (!pendingProgramMemberEmail) return;
    const createdMember = findNewestPendingMemberByEmail(pendingProgramMemberEmail);
    if (!createdMember) return;
    setSelectedMemberId(createdMember.id);
    setTrainerTab("customers");
    setCustomerSubTab("programs");
    setPendingProgramMemberEmail(null);
  }, [pendingProgramMemberEmail, findNewestPendingMemberByEmail, setSelectedMemberId, setTrainerTab]);

  useEffect(() => {
    if (!pendingInviteMemberEmail) return;
    const createdMember = findNewestPendingMemberByEmail(pendingInviteMemberEmail);
    if (!createdMember) return;
    const inviteKey = `${createdMember.email.trim().toLowerCase()}|${createdMember.id}`;
    if (pendingInviteSendKeyRef.current === inviteKey) return;
    pendingInviteSendKeyRef.current = inviteKey;
    setPendingInviteMemberEmail(null);

    async function sendInviteForNewMember() {
      setSelectedMemberId(createdMember.id);
      setInviteStatus("Sender invitasjon...");
      try {
        const result = await inviteMember(createdMember.email.toLowerCase(), createdMember.id);
        if (result.ok) {
          markMemberInvited(createdMember.id, result.invitedAtIso ?? new Date().toISOString());
        }
        setInviteStatus(result.message);
        setTrainerTab("customers");
        setCustomerSubTab("overview");
      } finally {
        pendingInviteSendKeyRef.current = "";
      }
    }

    void sendInviteForNewMember();
  }, [pendingInviteMemberEmail, findNewestPendingMemberByEmail, inviteMember, markMemberInvited, setSelectedMemberId, setTrainerTab]);

  useEffect(() => {
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    setCustomerSubTab("messages");
  }, [openCustomerMessagesSignal, selectedMemberId]);

  useEffect(() => {
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    setCustomerSubTab("overview");
  }, [openCustomerOverviewSignal, selectedMemberId]);

  useEffect(() => {
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    setCustomerSubTab("nutrition");
  }, [openCustomerNutritionSignal, selectedMemberId]);

  useEffect(() => {
    if (!filteredWorkoutLogs.length) {
      setSelectedWorkoutLogId(null);
      return;
    }
    if (!selectedWorkoutLogId || !filteredWorkoutLogs.some((log) => log.id === selectedWorkoutLogId)) {
      setSelectedWorkoutLogId(filteredWorkoutLogs[0].id);
    }
  }, [filteredWorkoutLogs, selectedWorkoutLogId]);

  function resetPeriodPlanDraftForNewPlan() {
    setPeriodPlanCreatingNew(true);
    setPeriodPlanDraftId(null);
    setPeriodPlanTitleDraft("Periodeplan");
    setPeriodPlanNotesDraft("");
    setPeriodPlanStartDateDraft(getDefaultPeriodPlanStartMondayISO());
    setPeriodPlanWeeksDraft("1");
    const firstWeek = { id: uid("period-week"), weekNumber: 1, days: createEmptyWeeklyDayPlan() };
    setPeriodWeeklyPlansDraft([firstWeek]);
    setActivePeriodWeekId(firstWeek.id);
  }

  function loadPeriodPlanIntoDraft(plan: PeriodSchedulePlan) {
    const weeks = Math.max(1, Math.min(12, plan.weeks || plan.weeklyPlans.length || 1));
    const sortedWeeks = [...plan.weeklyPlans]
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .slice(0, weeks)
      .map((week, index) => ({
        ...week,
        weekNumber: index + 1,
        id: week.id || uid("period-week"),
      }));
    while (sortedWeeks.length < weeks) {
      sortedWeeks.push({
        id: uid("period-week"),
        weekNumber: sortedWeeks.length + 1,
        days: createEmptyWeeklyDayPlan(),
      });
    }
    setPeriodPlanCreatingNew(false);
    setPeriodPlanDraftId(plan.id);
    setPeriodPlanTitleDraft(plan.title.trim() || "Periodeplan");
    setPeriodPlanNotesDraft(plan.notes.trim());
    setPeriodPlanStartDateDraft(periodPlanStartDateForDateInput(plan.startDate));
    setPeriodPlanWeeksDraft(String(weeks));
    const synced = syncGradientMarkedWeekDays(sortedWeeks);
    setPeriodWeeklyPlansDraft(synced);
    setActivePeriodWeekId(synced[0]?.id ?? "");
  }

  useEffect(() => {
    // Reset workout list controls when changing customer so prior filters/search do not hide fresh logs.
    setWorkoutDateRangeFilter("7d");
    setWorkoutTypeFilter("all");
    setWorkoutSearchQuery("");
    setWorkoutSortOrder("newest");
    setCustomerProgramBuilderFocus("training");
    setPeriodPlanStatus(null);
    setPeriodPlanCreatingNew(false);
    const existingPlan = selectedPeriodPlans[0] ?? null;
    if (existingPlan) {
      loadPeriodPlanIntoDraft(existingPlan);
    } else {
      resetPeriodPlanDraftForNewPlan();
    }
  }, [selectedMemberId]);

  useEffect(() => {
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    if (periodPlanCreatingNew || periodPlanDraftId) return;
    const existingPlan = selectedPeriodPlans[0] ?? null;
    if (existingPlan) loadPeriodPlanIntoDraft(existingPlan);
  }, [selectedPeriodPlans, selectedMemberId, periodPlanDraftId, periodPlanCreatingNew]);

  function resetMemberEditDraftFromSelected(member: Member | null) {
    if (!member) {
      setMemberEditName("");
      setMemberEditEmail("");
      setMemberEditPhone("");
      setMemberEditBirthDate("");
      setMemberEditGoal("");
      setMemberEditInjuries("");
      setMemberEditIsPtCustomer(false);
      setMemberEditIsPremiumCustomer(false);
      setMemberEditIsSharedMember(false);
      setMemberEditNutritionAccess(false);
      return;
    }
    setMemberEditName(member.name);
    setMemberEditEmail(member.email);
    setMemberEditPhone(member.phone);
    setMemberEditBirthDate(member.birthDate);
    setMemberEditGoal(member.goal);
    setMemberEditInjuries(member.injuries);
    setMemberEditIsPtCustomer(member.customerType === "PT-kunde");
    setMemberEditIsPremiumCustomer(member.membershipType === "Premium");
    setMemberEditIsSharedMember(isSharedMedlemRosterMember(member));
    setMemberEditNutritionAccess(member.nutritionAccess === true);
  }

  useEffect(() => {
    if (!selectedMemberNutritionAccess && customerSubTab === "nutrition") {
      setCustomerSubTab("overview");
    }
  }, [selectedMemberNutritionAccess, customerSubTab]);

  useEffect(() => {
    resetMemberEditDraftFromSelected(selectedMemberProfile);
    setMemberEditStatus(null);
    // Keep edit mode stable; it should only close on explicit Save/Cancel actions.
    // Background hydration or selection normalization must never close the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId]);

  function closeCustomerCardEditMode() {
    editLockedMemberIdRef.current = null;
    editLockedIdentityRef.current = null;
    setIsEditingCustomerCard(false);
  }

  function selectMemberWithUnsavedChangesGuard(nextMemberId: string, afterSelect?: () => void) {
    if (!nextMemberId || nextMemberId === selectedMemberId) return;
    const applySelection = () => {
      setSelectedMemberId(nextMemberId);
      afterSelect?.();
    };
    if (!isEditingCustomerCard) {
      applySelection();
      return;
    }
    if (!hasUnsavedCustomerCardChanges) {
      closeCustomerCardEditMode();
      applySelection();
      return;
    }
    const nextMemberName = members.find((member) => member.id === nextMemberId)?.name.trim() || "annen kunde";
    setConfirmDialog({
      title: "Ulagrede endringer",
      message: `Du har endringer i kundekortet som ikke er lagret.\n\nVil du gå videre til ${nextMemberName} uten å lagre?`,
      confirmLabel: "Gå videre uten å lagre",
      cancelLabel: "Bli her",
      tone: "danger",
      onConfirm: () => {
        closeCustomerCardEditMode();
        applySelection();
      },
    });
  }

  function formatInvitedAt(iso: string): string {
    if (!iso.trim()) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso.trim();
    try {
      return new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short" }).format(date);
    } catch {
      return iso.trim();
    }
  }

  function inviteSentAtLabel(invitedAt: string): string {
    const formatted = formatInvitedAt(invitedAt);
    return formatted ? `Sendt ${formatted}` : "Ikke sendt ennå";
  }

  /**
   * Kompakt label til klient-kortet: "Invitert i dag kl. 14:32",
   * "Invitert i går kl. 14:32" eller "Invitert 26.05.2026 kl. 14:32".
   */
  function inviteSentAtCompactLabel(invitedAt: string): string | null {
    if (!invitedAt.trim()) return null;
    const date = new Date(invitedAt);
    if (Number.isNaN(date.getTime())) return null;

    const now = new Date();
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const dayDiff = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
    let timePart = "";
    try {
      timePart = new Intl.DateTimeFormat("nb-NO", { timeStyle: "short" }).format(date);
    } catch {
      timePart = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    if (dayDiff === 0) return `Invitert i dag kl. ${timePart}`;
    if (dayDiff === 1) return `Invitert i går kl. ${timePart}`;
    let datePart = "";
    try {
      datePart = new Intl.DateTimeFormat("nb-NO", { dateStyle: "short" }).format(date);
    } catch {
      datePart = invitedAt.slice(0, 10);
    }
    return `Invitert ${datePart} kl. ${timePart}`;
  }

  async function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (!result) {
          reject(new Error("Kunne ikke lese bildefilen."));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error("Kunne ikke lese bildefilen."));
      reader.readAsDataURL(file);
    });
  }

  async function handleCustomerAvatarSelected(file: File | null) {
    if (!selectedMember || !setMemberAvatarUrlForMember) return;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMemberEditStatus("Velg en bildefil.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setMemberAvatarUrlForMember(selectedMember.id, dataUrl);
      setMemberEditStatus("Profilbilde oppdatert.");
    } catch {
      setMemberEditStatus("Kunne ikke lagre profilbildet.");
    }
  }

  function addExerciseToDraft(exercise: Exercise) {
    setProgramExercisesDraft((prev) => [...prev, buildProgramExerciseFromBank(exercise)]);
  }

  function moveDraftExercise(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setProgramExercisesDraft((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === sourceId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function toggleFavoriteExercise(exerciseId: string) {
    setFavoriteExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [exerciseId, ...prev]
    );
  }

  function updateDraftExercise(id: string, field: keyof ProgramExercise, value: string) {
    setProgramExercisesDraft((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeDraftExercise(id: string) {
    setProgramExercisesDraft((prev) => {
      const removed = prev.find((item) => item.id === id);
      let next = prev.filter((item) => item.id !== id);
      if (removed?.blockId?.trim()) {
        const remainingInBlock = next.filter((item) => item.blockId?.trim() === removed.blockId?.trim());
        if (remainingInBlock.length < 2) {
          next = unlinkProgramExerciseBlock(next, removed.blockId);
        }
      }
      return next;
    });
  }

  function moveDraftExerciseByOffset(exerciseId: string, offset: -1 | 1) {
    setProgramExercisesDraft((prev) => {
      const index = prev.findIndex((item) => item.id === exerciseId);
      if (index < 0) return prev;
      const nextIndex = index + offset;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }

  function programSaveImageUrl(): string | undefined {
    const trimmed = programFormImageUrl.trim();
    if (trimmed) return trimmed;
    return programCoverCleared ? "" : undefined;
  }

  function startEditProgram(program: TrainingProgram) {
    setEditingProgramId(program.id);
    setProgramTitle(program.title);
    setProgramGoal(program.goal);
    setProgramNotes(program.notes);
    setProgramFormImageUrl(program.imageUrl ?? "");
    setProgramCoverCleared(false);
    setProgramExercisesDraft(program.exercises.map((exercise) => ({ ...exercise })));
    setCustomerProgramBuilderFocus("training");
    setCustomerSubTab("programs");
    setTrainerTab("customers");
  }

  function resetProgramBuilder() {
    setEditingProgramId(null);
    setProgramTitle("Nytt treningsprogram");
    setProgramGoal("");
    setProgramNotes("");
    setProgramFormImageUrl("");
    setProgramCoverCleared(false);
    setProgramExercisesDraft([]);
  }

  function startNewCardioTemplateDraft() {
    if (programExercisesDraft.length > 0) {
      const ok = typeof window !== "undefined" && window.confirm("Erstatte gjeldende utkast med ny kondisjonsmal (kun oppvarming)?");
      if (!ok) return;
    }
    const base = pickCardioIntervalExerciseForTemplate(exercises);
    if (!base) {
      setTemplateAssignStatus("Fant ingen kondisjonsøvelse i biblioteket. Legg til en mølle- eller kondisjonsøvelse først.");
      return;
    }
    const warmup: ProgramExercise = {
      id: uid("draft-ex"),
      exerciseId: base.id,
      exerciseName: "Oppvarming",
      sets: "1",
      reps: "",
      weight: "",
      durationMinutes: "10",
      speed: "7",
      incline: "1",
      restSeconds: "0",
      notes: "",
      targetHrPercent: "65–75",
    };
    setProgramExercisesDraft([warmup]);
    setEditingTemplateProgramId(null);
    setTemplateAssignStatus("Oppvarming er lagt til. Legg til drag, juster verdier og legg til nedjogg til slutt.");
  }

  function appendCardioDragRow() {
    if (hasCardioNedjoggRow(programExercisesDraft)) return;
    const base = pickCardioIntervalExerciseForTemplate(exercises);
    if (!base) {
      setTemplateAssignStatus("Fant ingen kondisjonsøvelse i biblioteket.");
      return;
    }
    const nextIndex = countCardioDragRows(programExercisesDraft) + 1;
    const drag: ProgramExercise = {
      id: uid("draft-ex"),
      exerciseId: base.id,
      exerciseName: `Drag ${nextIndex}`,
      sets: "4",
      reps: "",
      weight: "",
      durationMinutes: "4",
      speed: "13",
      incline: "1.5",
      restSeconds: "180",
      notes: "",
      targetHrPercent: "85–92",
    };
    setProgramExercisesDraft((prev) => [...prev, drag]);
    setTemplateAssignStatus(null);
  }

  function appendCardioCooldownRow() {
    if (hasCardioNedjoggRow(programExercisesDraft)) return;
    const base = pickCardioIntervalExerciseForTemplate(exercises);
    if (!base) {
      setTemplateAssignStatus("Fant ingen kondisjonsøvelse i biblioteket.");
      return;
    }
    const cooldown: ProgramExercise = {
      id: uid("draft-ex"),
      exerciseId: base.id,
      exerciseName: "Nedjogg",
      sets: "1",
      reps: "",
      weight: "",
      durationMinutes: "5",
      speed: "5.5",
      incline: "0",
      restSeconds: "0",
      notes: "",
      targetHrPercent: "55–65",
    };
    setProgramExercisesDraft((prev) => [...prev, cooldown]);
    setTemplateAssignStatus("Nedjogg lagt til. Fjern nedjogg-raden om du vil legge til flere drag.");
  }

  function handlePeriodPlanWeeksDraftChange(value: string) {
    setPeriodPlanWeeksDraft(value);
    const parsed = Math.max(1, Math.min(12, Number(value) || 1));
    setPeriodWeeklyPlansDraft((prev) => {
      const normalized = prev.slice(0, parsed).map((week, index) => ({ ...week, weekNumber: index + 1 }));
      while (normalized.length < parsed) {
        normalized.push({
          id: uid("period-week"),
          weekNumber: normalized.length + 1,
          days: createEmptyWeeklyDayPlan(),
        });
      }
      return normalized;
    });
  }

  function updateActivePeriodWeekDay(day: WeekdayPlanKey, value: string) {
    if (!activePeriodWeek) return;
    setPeriodWeeklyPlansDraft((prev) => {
      const active = prev.find((w) => w.id === activePeriodWeek.id);
      if (!active) return prev;
      const after =
        active.usesGradientPlan === true
          ? prev.map((w) =>
              w.usesGradientPlan === true ? { ...w, days: { ...w.days, [day]: value } } : w,
            )
          : prev.map((w) =>
              w.id === activePeriodWeek.id ? { ...w, days: { ...w.days, [day]: value } } : w,
            );
      return syncGradientMarkedWeekDays(after);
    });
  }

  async function savePeriodPlanForSelectedMember() {
    if (!selectedMemberId || selectedMemberId === "__template__" || selectedMemberRelatedIds.length === 0) {
      setPeriodPlanStatus("Velg en kunde før du lagrer periodeplan.");
      return;
    }
    const title = periodPlanTitleDraft.trim();
    if (!title) {
      setPeriodPlanStatus("Legg inn navn på periodeplanen.");
      return;
    }
    const weeks = Math.max(1, Math.min(12, Number(periodPlanWeeksDraft) || 1));
    const weeklyPlans = syncGradientMarkedWeekDays(
      periodWeeklyPlansDraft.slice(0, weeks).map((week, index) => ({
        ...week,
        weekNumber: index + 1,
      })),
    );
    const existingPeriodPlan =
      selectedPeriodPlans.find((plan) => plan.id === periodPlanDraftId) ?? selectedPeriodPlans[0] ?? null;
    const periodPlanId = periodPlanDraftId ?? existingPeriodPlan?.id ?? uid("period-plan");
    const isNewPlan = !selectedPeriodPlans.some((plan) => plan.id === periodPlanId);
    const obsoletePeriodPlanIds = isNewPlan
      ? []
      : selectedPeriodPlans.map((plan) => plan.id).filter((planId) => planId && planId !== periodPlanId);
    const newPeriodPlan: PeriodSchedulePlan = {
      id: periodPlanId,
      title,
      notes: periodPlanNotesDraft.trim(),
      startDate: periodPlanStartDateDraft.trim() || getDefaultPeriodPlanStartMondayISO(),
      weeks,
      createdAt: existingPeriodPlan?.createdAt ?? formatDateDdMmYyyy(new Date()),
      weeklyPlans,
      periodPlanAddedBy: "trainer",
      trainerSavedAtIso: new Date().toISOString(),
    };
    setPeriodPlanStatus("Lagrer periodeplan...");
    const storageMemberId =
      pickCanonicalMemberIdForPeriodPlans(selectedMemberRelatedIds, members) || selectedMemberId;
    setPeriodPlansByMemberId((prev) => {
      const next = { ...prev };
      const applyToId = storageMemberId.trim();
      const previous = next[applyToId] ?? [];
      next[applyToId] = isNewPlan
        ? [...previous.filter((plan) => plan.id !== periodPlanId), newPeriodPlan]
        : previous.some((plan) => plan.id === periodPlanId)
          ? previous.map((plan) => (plan.id === periodPlanId ? newPeriodPlan : plan))
          : [newPeriodPlan];
      for (const memberId of selectedMemberRelatedIds) {
        if (memberId === applyToId) continue;
        const list = next[memberId];
        if (!list?.length) continue;
        next[memberId] = list.filter((plan) => plan.id !== periodPlanId);
      }
      return next;
    });
    if (isSupabaseConfigured && !isLocalDemoSession) {
      obsoletePeriodPlanIds.forEach((planId) => {
        void deleteMemberPeriodPlanByPlanId(planId);
      });
      const persist = await upsertMemberPeriodPlansForTrainer(selectedMemberRelatedIds, newPeriodPlan, {
        targetEmail: selectedMember?.email,
      });
      if (!persist.ok) {
        setPeriodPlanStatus(persist.message);
        return;
      }
    }
    setPeriodPlanCreatingNew(false);
    setPeriodPlanDraftId(periodPlanId);
    setPeriodPlanStatus(isNewPlan ? "Periodeplan lagret." : "Periodeplan oppdatert.");
  }

  function toggleGradientPeriodWeek(weekId: string) {
    setActivePeriodWeekId(weekId);
    setPeriodWeeklyPlansDraft((prev) => {
      const current = prev.find((week) => week.id === weekId);
      if (!current) return prev;
      const shouldMark = current.usesGradientPlan !== true;
      const existingGradient = prev.find((week) => week.usesGradientPlan === true);
      const sharedDays = shouldMark && existingGradient ? { ...existingGradient.days } : { ...current.days };
      const next = prev.map((week) =>
        week.id === weekId
          ? { ...week, usesGradientPlan: shouldMark, days: shouldMark ? sharedDays : week.days }
          : week.usesGradientPlan === true && shouldMark
            ? { ...week, days: sharedDays }
            : week,
      );
      return syncGradientMarkedWeekDays(next);
    });
  }
  function removePeriodPlan(planId: string) {
    if (!selectedMemberId || selectedMemberId === "__template__" || selectedMemberRelatedIds.length === 0) return;
    if (isSupabaseConfigured && !isLocalDemoSession) {
      void deleteMemberPeriodPlanByPlanId(planId);
    }
    setPeriodPlansByMemberId((prev) => {
      const next = { ...prev };
      selectedMemberRelatedIds.forEach((memberId) => {
        const previous = next[memberId] ?? [];
        next[memberId] = previous.filter((plan) => plan.id !== planId);
      });
      return next;
    });
    setPeriodPlanStatus("Periodeplan slettet.");
  }

  function saveTemplateFromProgramsTab() {
    const title = templateProgramTitle.trim();
    if (!title) {
      setTemplateAssignStatus("Skriv inn navn på treningsmalen.");
      return;
    }
    if (programExercisesDraft.length === 0) {
      setTemplateAssignStatus("Legg til minst én øvelse før du lagrer malen.");
      return;
    }
    saveProgramForMember({
      id: editingTemplateProgramId ?? undefined,
      title,
      goal: "",
      notes: "",
      memberId: "__template__",
      exercises: editingTemplateProgramId
        ? programExercisesDraft.map((exercise) => ({ ...exercise }))
        : programExercisesDraft.map((exercise) => ({ ...exercise, id: uid("template-ex") })),
      imageUrl: programSaveImageUrl(),
    });
    if (editingTemplateProgramId) {
      setTemplateAssignStatus("Treningsmal oppdatert.");
    } else {
      setTemplateAssignStatus("Treningsmal lagret.");
    }
    setEditingTemplateProgramId(null);
    setTemplateProgramTitle("Ny treningsmal");
    setProgramExercisesDraft([]);
  }

  function startEditTemplateProgram(program: TrainingProgram) {
    setProgramsSubTab(getTrainingProgramSubTab(program, exerciseCategoryById));
    setEditingTemplateProgramId(program.id);
    setExpandedTemplateProgramId(program.id);
    setTemplateProgramTitle(program.title);
    setProgramFormImageUrl(program.imageUrl ?? "");
    setProgramExercisesDraft(program.exercises.map((exercise) => ({ ...exercise })));
    setTemplateAssignStatus(`Redigerer mal: ${program.title}`);
  }

  function resetTemplateProgramBuilder() {
    setEditingTemplateProgramId(null);
    setTemplateProgramTitle("Ny treningsmal");
    setProgramFormImageUrl("");
    setProgramExercisesDraft([]);
    setTemplateAssignStatus(null);
  }

  function deleteTemplateProgram(program: TrainingProgram) {
    setConfirmDialog({
      title: "Slette treningsmal",
      message: `Slette treningsmalen "${program.title}"?`,
      confirmLabel: "Slett treningsmal",
      tone: "danger",
      onConfirm: () => {
        deleteProgramById(program.id);
        if (editingTemplateProgramId === program.id) {
          resetTemplateProgramBuilder();
        }
        if (selectedTemplateProgramId === program.id) {
          setSelectedTemplateProgramId("");
        }
        if (expandedTemplateProgramId === program.id) {
          setExpandedTemplateProgramId(null);
        }
        setTemplateAssignStatus(`Treningsmalen "${program.title}" ble slettet.`);
      },
    });
  }

  function assignSelectedTemplateToMember() {
    if (!selectedMemberId) {
      setTemplateAssignStatus("Velg kunde før tildeling.");
      return;
    }
    const template =
      activeTemplatePrograms.find((program) => program.id === selectedTemplateProgramId) ?? activeTemplatePrograms[0];
    if (!template) {
      setTemplateAssignStatus("Ingen treningsmaler å tildele ennå.");
      return;
    }
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const normalizedEmail = selected?.email.trim().toLowerCase() ?? "";
    const targetMemberIds = normalizedEmail
      ? members
          .filter((member) => member.email.trim().toLowerCase() === normalizedEmail && member.isActive !== false)
          .map((member) => member.id)
      : [selectedMemberId];
    const uniqueTargetIds = Array.from(new Set(targetMemberIds.length ? targetMemberIds : [selectedMemberId]));

    uniqueTargetIds.forEach((memberId) => {
      const trainerAuthor = pickFirstName(trainerAccountName) || pickFirstName(MOTUS.name) || "Trener";
      saveProgramForMember({
        title: template.title,
        goal: template.goal,
        notes: template.notes,
        memberId,
        exercises: template.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
        imageUrl: template.imageUrl,
        programCreatedBy: "trainer",
        programCreatedByName: trainerAuthor,
      });
    });

    const memberName = selected?.name ?? "kunden";
    setTemplateAssignStatus(
      uniqueTargetIds.length > 1
        ? `Malen ble tildelt ${memberName} (${uniqueTargetIds.length} tilknyttede profiler).`
        : `Malen ble tildelt ${memberName}.`
    );
  }

  function saveProgramToSelectedMemberProfiles(input: {
    id?: string;
    title: string;
    goal: string;
    notes: string;
    exercises: ProgramExercise[];
    imageUrl?: string;
  }): boolean {
    if (isLocalDemoSession) {
      setProgramSaveStatus("Demo-innlogging: program lagres ikke til medlem. Logg inn med ekte konto.");
      return false;
    }
    if (!selectedMemberId || selectedMemberId === "__template__") return false;
    if (isSavingProgram) return false;
    const trainerAuthor = pickFirstName(trainerAccountName) || pickFirstName(MOTUS.name) || "Trener";
    const persistMemberId = selectedMemberProfile?.id ?? selectedMemberId;
    const selectedMemberName = selectedMemberProfile?.name ?? members.find((member) => member.id === selectedMemberId)?.name ?? "kunden";
    setIsSavingProgram(true);
    setProgramSaveStatus("Lagrer program ...");
    let saveSettled = false;
    const saveTimeoutId = window.setTimeout(() => {
      if (saveSettled) return;
      saveSettled = true;
      setIsSavingProgram(false);
      setProgramSaveStatus("Lagring tok for lang tid. Sjekk nettverk og prøv igjen.");
    }, 35_000);
    saveProgramForMember({
      id: input.id,
      title: input.title,
      goal: input.goal,
      notes: input.notes,
      memberId: persistMemberId,
      imageUrl: input.imageUrl === "" ? "" : input.imageUrl?.trim() ? input.imageUrl.trim() : undefined,
      exercises: (input.id ? input.exercises : input.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") }))).map(
        (exercise) => normalizeProgramExerciseForCategory(exercise, exercisesById.get(exercise.exerciseId)?.category),
      ),
      programCreatedBy: "trainer",
      programCreatedByName: trainerAuthor,
      onPersisted: (result) => {
        if (saveSettled) return;
        saveSettled = true;
        window.clearTimeout(saveTimeoutId);
        setIsSavingProgram(false);
        if (result.ok) {
          setProgramSaveStatus(`Program lagret på ${selectedMemberName}.`);
          resetProgramBuilder();
          return;
        }
        setProgramSaveStatus(result.message?.trim() || "Kunne ikke lagre program til sky. Prøv igjen.");
      },
    });
    return true;
  }

  async function submitNewMember(options?: { openProgramAfterCreate?: boolean; inviteAfterCreate?: boolean }) {
    const name = newMemberName.trim();
    const email = newMemberEmail.trim().toLowerCase();
    if (!name || !email) {
      setNewMemberError("Navn og e-post er påkrevd.");
      setNewMemberSuccess(null);
      return;
    }
    if (!isValidEmail(email)) {
      setNewMemberError("E-post må være gyldig.");
      setNewMemberSuccess(null);
      return;
    }
    const existingByEmail = members.filter((member) => member.email.trim().toLowerCase() === email);
    if (existingByEmail.some((member) => member.isActive !== false)) {
      setNewMemberError("E-post finnes allerede som aktiv kunde.");
      setNewMemberSuccess(null);
      return;
    }
    if (existingByEmail.some((member) => member.isActive === false)) {
      setNewMemberError("E-post finnes som inaktiv kunde. Bruk «Gjenopprett klient» nedenfor.");
      setNewMemberSuccess(null);
      return;
    }

    const tier = newMemberInviteType;
    const nextMembershipType: Member["membershipType"] = tier === "Premium-kunde" ? "Premium" : "Standard";
    const nextCustomerType: Member["customerType"] =
      tier === "Medlem" ? "Medlem" : tier === "PT-kunde" || tier === "Premium-kunde" ? "PT-kunde" : "Oppfølging";

    setIsCreatingMember(true);
    setNewMemberError(null);
    setNewMemberSuccess(null);

    const result = await addMember({
      name,
      email,
      phone: normalizePhone(newMemberPhone),
      goal: newMemberGoal,
      focus: newMemberFocus,
      membershipType: nextMembershipType,
      customerType: nextCustomerType,
      nutritionAccess: newMemberNutritionAccess,
    });

    setIsCreatingMember(false);

    if (!result.ok) {
      setNewMemberError(result.message);
      return;
    }

    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberPhone("");
    setNewMemberGoal("");
    setNewMemberFocus("");
    setNewMemberSuccess(
      options?.inviteAfterCreate
        ? `Kunde «${name}» opprettet – sender invitasjon...`
        : `Kunde «${name}» er opprettet. Du finner vedkommende under Klienter.`,
    );
    if (options?.openProgramAfterCreate) {
      setPendingProgramMemberEmail(email);
    }
    if (options?.inviteAfterCreate) {
      setPendingInviteMemberEmail(email);
    }
  }

  function handleDeactivateMember(memberId: string) {
    const member = members.find((entry) => entry.id === memberId);
    const displayName = member?.name?.trim() || "kunden";
    setConfirmDialog({
      title: "Arkiver kunde",
      message: `Arkivere ${displayName}? Kunden mister tilgang til appen og skjules fra listen, men økter, programmer og meldinger beholdes. Du kan finne vedkommende igjen under «Vis inaktive» eller trykke «Aktiver kunde igjen» på kundekortet.`,
      confirmLabel: "Arkiver",
      tone: "danger",
      onConfirm: () => {
        deactivateMember(memberId);
        setMemberEditStatus(`${displayName} arkivert. Du finner vedkommende igjen under «Vis inaktive».`);
      },
    });
  }

  function handleReactivateSelectedMember(memberId: string) {
    const member = members.find((entry) => entry.id === memberId);
    const email = member?.email?.trim() ?? "";
    if (!email) {
      setMemberEditStatus("Kunden har ingen e-post – kan ikke aktiveres på nytt.");
      return;
    }
    setConfirmDialog({
      title: "Aktiver kunde igjen",
      message: `Gi ${member?.name?.trim() || "kunden"} tilgang til appen igjen? Medlemsraden med e-post ${email} settes aktiv.`,
      confirmLabel: "Aktiver",
      tone: "default",
      onConfirm: () => {
        void handleRestoreMember(email);
      },
    });
  }

  function handleDeleteMember(memberId: string) {
    if (!canAccessAdminTools) return;
    const member = members.find((entry) => entry.id === memberId);
    setConfirmDialog({
      title: "Slette kunde permanent",
      message: `Dette arkiverer ${member?.name?.trim() || "kunden"} og fjerner vedkommende fra aktiv kundeliste. Programmer og logger beholdes. Vurder «Arkiver kunde» i stedet — det er det vanlige valget.`,
      confirmLabel: "Slett permanent",
      cancelLabel: "Avbryt",
      tone: "danger",
      onConfirm: () => {
        deleteMember(memberId);
      },
    });
  }

  function buildProgramFingerprint(program: ProgramExercise[] | undefined, title: string, goal: string, notes: string): string {
    return buildTrainingProgramDisplayKey({
      title,
      goal,
      notes,
      exercises: program ?? [],
    });
  }

  const programBelongsToSelectedMember = useCallback(
    (program: TrainingProgram): boolean => {
      const selected = members.find((member) => member.id === selectedMemberId) ?? null;
      if (!selected) return false;
      return programBelongsToMember(selected, members, program);
    },
    [members, selectedMemberId],
  );

  function handleDeleteProgram(programId: string) {
    const target = selectedPrograms.find((program) => program.id === programId);
    if (!target) return;
    const fingerprint = buildProgramFingerprint(target.exercises, target.title, target.goal, target.notes);
    const duplicateIds = programs
      .filter((program) => program.id !== target.id)
      .filter((program) => programBelongsToSelectedMember(program))
      .filter((program) => buildProgramFingerprint(program.exercises, program.title, program.goal, program.notes) === fingerprint)
      .map((program) => program.id);
    setConfirmDialog({
      title: "Slette program",
      message: `Slette programmet "${target.title}"?`,
      confirmLabel: "Slett program",
      tone: "danger",
      onConfirm: () => {
        setDismissedProgramFingerprints((prev) => (prev.includes(fingerprint) ? prev : [...prev, fingerprint]));
        const deleteContext = {
          memberIds: selectedMemberRelatedIds,
          targetEmail: selectedMember?.email ?? "",
          targetName: selectedMember?.name ?? "",
        };
        deleteProgramById(target.id, deleteContext);
        duplicateIds.forEach((id) => deleteProgramById(id, deleteContext));
      },
    });
  }

  function handleSaveWorkoutComment() {
    if (!filteredSelectedWorkoutLog) return;
    const trimmedComment = trainerWorkoutCommentDraft.trim();
    if (!updateWorkoutLogTrainerComment) {
      setTrainerWorkoutCommentStatus("Kunne ikke lagre kommentar akkurat nå.");
      return;
    }
    updateWorkoutLogTrainerComment({
      logId: filteredSelectedWorkoutLog.id,
      trainerComment: trimmedComment,
      trainerCommentUpdatedAt: trimmedComment ? new Date().toISOString() : undefined,
      trainerCommentAuthorName: trainerAccountName.trim() || undefined,
    });
    setTrainerWorkoutCommentStatus(trimmedComment ? "Kommentar lagret." : "Kommentar fjernet.");
  }

  function handlePrintProgram(program: TrainingProgram) {
    if (typeof window === "undefined") return;
    try {
      const recipientName = String(selectedMember?.name ?? "Kunde").trim() || "Kunde";
      const trainerLabel = (
        pickFirstName(program.assignedTrainerName ?? "") ||
        pickFirstName(MOTUS.name ?? "") ||
        "Trener"
      ).trim();
      const safeExercises = Array.isArray(program.exercises) ? program.exercises : [];
      const exercisesHtml =
        safeExercises.length > 0
          ? safeExercises
            .map((exercise, index) => {
              const safeExercise =
                exercise && typeof exercise === "object"
                  ? (exercise as Partial<ProgramExercise>)
                  : ({} as Partial<ProgramExercise>);
              const exerciseName =
                resolveProgramExerciseName(safeExercises, index) ||
                String(safeExercise.exerciseName ?? "Øvelse").trim() ||
                "Øvelse";
              const exerciseId = String(safeExercise.exerciseId ?? "").trim();
              const libraryMatch =
                exercises.find((item) => item.id === exerciseId) ??
                exercises.find((item) => String(item.name ?? "").trim().toLowerCase() === exerciseName.toLowerCase()) ??
                null;
              const notes = String(safeExercise.notes ?? "").trim();
              const prescription = formatProgramExercisePrescription(
                safeExercise as ProgramExercise,
                index,
                safeExercises,
                exercises,
                { includePauseLabel: true },
              );
              const imageUrl = libraryMatch?.imageUrl?.trim() || "";
              const description = libraryMatch?.description?.trim() || "Ingen forklaring tilgjengelig for denne øvelsen.";
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
        <div class="brand-logo-frame"><img src="${escapeHtml(motusLogo)}" alt="Motus logo" class="brand-logo" /></div>
      </div>
    </div>
    ${program.notes ? `<div class="notes-card"><div class="notes-title">Notater</div>${escapeHtml(program.notes)}</div>` : ""}
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
          onConfirm: () => {},
        });
      }
    } catch (unexpectedError) {
      console.error("Trainer print failed before rendering.", unexpectedError);
      const detail = unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);
      setConfirmDialog({
        title: "Ugyldige programdata",
        message: `Utskrift feilet pga. ugyldige data i programmet (${detail}). Prøv igjen eller oppdater programfelt.`,
        confirmLabel: "OK",
        showCancel: false,
        tone: "default",
        onConfirm: () => {},
      });
    }
  }

  async function handleSaveSelectedMemberDetails() {
    if (!selectedMember) return;
    const selectedOwnerUserId = (selectedMember.ownerUserId ?? "").trim();
    const storedCustomerType = selectedMember.customerType;
    const crossOwner =
      Boolean(selectedOwnerUserId && currentTrainerOwnerUserId && selectedOwnerUserId !== currentTrainerOwnerUserId);
    const nextCustomerType = memberEditIsPremiumCustomer || memberEditIsPtCustomer
      ? "PT-kunde"
      : memberEditIsSharedMember
        ? "Medlem"
        : "Oppfølging";

    /** PT-rader skal eies av innlogget trener etter lagring – da kan vi «rette» feil owner etter invitasjon/link. */
    const claimingPrivateWithSessionOwner =
      isPrivatePtRosterCustomerType(nextCustomerType) && Boolean(currentTrainerOwnerUserId.trim());

    // Blokker kun når vi ikke kan tilordne raden til gjeldende trener-sesjon (annens privat kunde uten claim-path).
    if (crossOwner && storedCustomerType !== "Medlem" && !claimingPrivateWithSessionOwner) {
      setMemberEditStatus("Denne kunden eies av en annen PT. Be eier-PT oppdatere medlemskapstype.");
      return;
    }

    const nextName = memberEditName.trim();
    const nextEmail = memberEditEmail.trim().toLowerCase();
    if (!nextName) {
      setMemberEditStatus("Navn må fylles ut.");
      return;
    }
    if (!isValidEmail(nextEmail)) {
      setMemberEditStatus("Gyldig e-post må fylles ut.");
      return;
    }
    const trimmedBirthDateDraft = memberEditBirthDate.trim();
    if (trimmedBirthDateDraft && !isLikelyValidBirthDate(trimmedBirthDateDraft)) {
      setMemberEditStatus("Fødselsdato må være en gyldig dato på formatet dd.mm.yyyy.");
      return;
    }
    const previousEmail = selectedMember.email.trim().toLowerCase();
    const nextMembershipType = memberEditIsPremiumCustomer ? "Premium" : "Standard";
    const convertingSharedMedlemToPrivate =
      storedCustomerType === "Medlem" && nextCustomerType !== "Medlem";
    // Ved owner-konflikt: oppdater kun raden du ser på (invitasjon/feil owner_user_id), ikke flere e-posterader.
    const narrowTargetsToSelectedOnly =
      crossOwner &&
      (convertingSharedMedlemToPrivate ||
        (claimingPrivateWithSessionOwner && storedCustomerType !== "Medlem"));
    const uniqueTargetIds = narrowTargetsToSelectedOnly
      ? [selectedMember.id]
      : filterMemberIdsForRosterSave({
          memberRows: members.map((member) => ({
            id: member.id,
            email: member.email,
            ownerUserId: member.ownerUserId,
            customerType: member.customerType,
          })),
          previousEmail,
          nextCustomerType,
          currentTrainerOwnerUserId,
          selectedMemberId: selectedMember.id,
          selectedOwnerUserId,
        });
    const assignOwnerToSession =
      isPrivatePtRosterCustomerType(nextCustomerType) && Boolean(currentTrainerOwnerUserId);
    const normalizedBirthDate = trimmedBirthDateDraft ? normalizeBirthDate(trimmedBirthDateDraft) : "";
    uniqueTargetIds.forEach((memberId) => {
      const targetRow = members.find((member) => member.id === memberId);
      const personalGoals = patchMemberAppUiStateInPersonalGoals(targetRow?.personalGoals, {
        profileDisplayName: nextName,
      });
      updateMember({
        memberId,
        changes: {
          name: nextName,
          email: nextEmail,
          phone: normalizePhone(memberEditPhone),
          birthDate: normalizedBirthDate,
          goal: memberEditGoal,
          injuries: memberEditInjuries,
          membershipType: nextMembershipType,
          customerType: nextCustomerType,
          nutritionAccess: memberEditNutritionAccess,
          personalGoals,
          ...(assignOwnerToSession ? { ownerUserId: currentTrainerOwnerUserId } : {}),
        },
      });
    });
    if (supabaseClient) {
      const syncEmails = Array.from(
        new Set(
          members
            .filter((member) => uniqueTargetIds.includes(member.id))
            .map((member) => member.email.trim().toLowerCase())
            .concat([nextEmail])
            .filter((value) => value && value.includes("@")),
        ),
      );
      const syncResult = await supabaseClient.functions.invoke("update-member-profile", {
        body: {
          email: nextEmail,
          emails: syncEmails,
          memberId: selectedMember.id,
          memberIds: uniqueTargetIds,
          targetName: nextName,
          changes: {
            name: nextName,
            phone: normalizePhone(memberEditPhone),
            birthDate: normalizedBirthDate,
            goal: memberEditGoal,
            injuries: memberEditInjuries,
            membershipType: nextMembershipType,
            customerType: nextCustomerType,
            nutritionAccess: memberEditNutritionAccess,
          },
        },
      });
      let updated =
        syncResult.data && typeof syncResult.data === "object" && "updated" in syncResult.data
          ? Number((syncResult.data as { updated?: unknown }).updated ?? 0)
          : 0;
      let primaryError = syncResult.error?.message ?? "";
      if (updated === 0) {
        const dbChanges: Record<string, unknown> = {
          name: nextName,
          email: nextEmail,
          phone: normalizePhone(memberEditPhone),
          birth_date: normalizedBirthDate,
          goal: memberEditGoal,
          injuries: memberEditInjuries,
          membership_type: nextMembershipType,
          customer_type: nextCustomerType,
          nutrition_access: memberEditNutritionAccess === true,
          personal_goals: patchMemberAppUiStateInPersonalGoals(selectedMember.personalGoals, {
            profileDisplayName: nextName,
          }),
        };
        if (assignOwnerToSession) dbChanges.owner_user_id = currentTrainerOwnerUserId;
        const targetIds = uniqueTargetIds.filter((id) => id && !id.startsWith("auth-"));
        if (targetIds.length > 0) {
          const direct = await supabaseClient.from("members").update(dbChanges).in("id", targetIds).select("id");
          if (!direct.error) {
            updated = Math.max(updated, direct.data?.length ?? 0);
          } else if (!primaryError) {
            primaryError = direct.error.message;
          }
        }
        if (updated === 0) {
          const byEmail = await supabaseClient
            .from("members")
            .update(dbChanges)
            .ilike("email", nextEmail)
            .select("id");
          if (!byEmail.error) {
            updated = Math.max(updated, byEmail.data?.length ?? 0);
          } else if (!primaryError) {
            primaryError = byEmail.error.message;
          }
        }
      }
      const syncSucceeded = updated > 0;
      if (!syncSucceeded) {
        if (primaryError) {
          setMemberEditStatus(`Kundekort lokalt oppdatert, men synk feilet: ${primaryError}`);
        } else {
          setMemberEditStatus("Kundekort lagret, men ingen profiler ble synket. Prøv igjen.");
        }
        return;
      }
      if (nextEmail.includes("@")) {
        await ensureMemberAuthLink(nextEmail, selectedMember.id);
      }
      const typeHint = isSharedMedlemRosterMember({ customerType: nextCustomerType, membershipType: nextMembershipType })
        ? "Delt medlem – synlig for alle PT-er."
        : "PT-kunde – kun synlig for deg.";
      setMemberEditStatus(`Kundekort oppdatert. ${typeHint}`);
      editLockedMemberIdRef.current = null;
      editLockedIdentityRef.current = null;
      setIsEditingCustomerCard(false);
      return;
    }
    setMemberEditStatus("Kundekort oppdatert.");
    editLockedMemberIdRef.current = null;
    editLockedIdentityRef.current = null;
    setIsEditingCustomerCard(false);
  }

  async function dispatchTrainerMessageToSelectedMember(text: string): Promise<boolean> {
    if (isSendingTrainerMessageRef.current) return false;
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (selectedMemberMessagesLocked) {
      setTrainerChatSendStatus("Medlem har ikke tilgang til meldinger.");
      return false;
    }
    trainerSendAttemptRef.current += 1;
    const attemptNo = trainerSendAttemptRef.current;
    isSendingTrainerMessageRef.current = true;
    setIsSendingTrainerMessage(true);
    setTrainerChatSendStatus(`Sender... (#${attemptNo})`);
    try {
      const targetMemberIds =
        selectedMemberRelatedIds.length > 0
          ? selectedMemberRelatedIds
          : selectedMemberId && selectedMemberId !== "__template__"
            ? [selectedMemberId]
            : [];
      let validTargetMemberIds = Array.from(new Set(targetMemberIds)).filter(
        (memberId) =>
          memberId &&
          memberId !== "__template__" &&
          !memberId.startsWith("auth-"),
      );
      if (!validTargetMemberIds.length && selectedMember) {
        const selectedEmail = selectedMember.email.trim().toLowerCase();
        if (selectedEmail) {
          validTargetMemberIds = Array.from(
            new Set(
              members
                .filter((member) => member.email.trim().toLowerCase() === selectedEmail)
                .map((member) => member.id)
                .filter(
                  (memberId) =>
                    memberId &&
                    memberId !== "__template__" &&
                    !memberId.startsWith("auth-"),
                )
            )
          );
        }
      }
      if (!validTargetMemberIds.length && selectedMember && supabaseClient) {
        const selectedEmail = selectedMember.email.trim().toLowerCase();
        if (selectedEmail) {
          const { data: rowsByEmail } = await supabaseClient.from("members").select("id").ilike("email", selectedEmail);
          validTargetMemberIds = Array.from(
            new Set(
              (rowsByEmail ?? [])
                .map((row) => String((row as { id?: string }).id ?? "").trim())
                .filter((memberId) => memberId && memberId !== "__template__" && !memberId.startsWith("auth-")),
            ),
          );
        }
      }
      if (!validTargetMemberIds.length) {
        setTrainerChatSendStatus("Kunne ikke sende melding: ingen gyldig mottaker.");
        return false;
      }
      const uniqueTargetMemberIds = Array.from(new Set(validTargetMemberIds)).sort((a, b) => a.localeCompare(b));
      const selectedEmail = selectedMember?.email.trim().toLowerCase() ?? "";
      const emailMatchedTargetId =
        selectedEmail
          ? uniqueTargetMemberIds.find((id) => {
              const member = members.find((row) => row.id === id);
              return member?.email.trim().toLowerCase() === selectedEmail;
            }) ?? ""
          : "";
      const targetMemberId =
        emailMatchedTargetId ||
        (selectedMemberId && uniqueTargetMemberIds.find((id) => id === selectedMemberId)) ||
        uniqueTargetMemberIds[0] ||
        "";
      if (!targetMemberId) {
        setTrainerChatSendStatus("Kunne ikke sende melding: ingen gyldig mottaker.");
        return false;
      }
      const duplicateTargetKey = (selectedMember?.email ?? selectedMemberId ?? targetMemberId).trim().toLowerCase();
      const duplicateKey = `${duplicateTargetKey}|${trimmed.toLowerCase()}`;
      const nowMs = Date.now();
      if (
        lastTrainerSendKeyRef.current === duplicateKey &&
        nowMs - lastTrainerSendAtRef.current < 10000
      ) {
        setTrainerChatSendStatus(`Meldingen ble allerede sendt nylig. (#${attemptNo})`);
        return false;
      }
      sendTrainerMessage(targetMemberId, trimmed);
      lastTrainerSendKeyRef.current = duplicateKey;
      lastTrainerSendAtRef.current = nowMs;
      setTrainerChatSendStatus(`Melding sendt (#${attemptNo}).`);
      return true;
    } finally {
      setIsSendingTrainerMessage(false);
      isSendingTrainerMessageRef.current = false;
    }
  }

  async function shareSelectedProgramInChat(program: TrainingProgram) {
    const message = buildShareProgramChatMessage({
      programTitle: program.title,
      goal: program.goal,
      sender: "trainer",
    });
    const sent = await dispatchTrainerMessageToSelectedMember(message);
    if (sent) {
      setTrainerMessage("");
      setChatShareProgramPickerOpen(false);
    }
  }

  function handleTrainerShareProgramClick() {
    if (selectedPrograms.length === 0) {
      setChatShareProgramPickerOpen(false);
      setCustomerSubTab("programs");
      setTrainerChatSendStatus("Lag et program først — åpnet Program-fanen.");
      return;
    }
    if (selectedPrograms.length === 1) {
      void shareSelectedProgramInChat(selectedPrograms[0]);
      return;
    }
    setChatShareProgramPickerOpen((open) => !open);
  }

  const trainerChatQuickActions = useMemo(
    (): MotusChatQuickAction[] => [
      { id: "workout", label: "Send økt", icon: Dumbbell, onClick: () => setCustomerSubTab("workouts") },
      { id: "program", label: "Del program", icon: Share2, onClick: handleTrainerShareProgramClick },
      { id: "more", label: "Flere", icon: MoreHorizontal },
    ],
    [selectedPrograms],
  );

  function resetMemberListControls() {
    setMemberSearch("");
    setMemberFilter("all");
    setCustomerTypeFilter("all");
    setPriorityFilter("all");
  }

  function openCustomersWithListFilters(
    options: {
      memberFilter?: typeof memberFilter;
      priorityFilter?: "all" | "red" | "orange" | "green";
    } = {},
  ) {
    setTrainerTab("customers");
    if (options.memberFilter) setMemberFilter(options.memberFilter);
    if (options.priorityFilter) setPriorityFilter(options.priorityFilter);
    setShowCustomerToolsMobile(true);
  }

  function openMemberWithNextAction(member: Member) {
    const hasProgram = programsAttributedToMember(member, members, programs).length > 0;
    const inactiveDays = trainerInactiveDaysForFollowUp(member, members, logs);
    const needsMessage = inactiveDays !== null && inactiveDays >= 7;
    const hasCompletedLogs = logs.some(
      (log) => log.memberId === member.id && String(log.status ?? "").trim() === "Fullført",
    );

    selectMemberWithUnsavedChangesGuard(member.id, () => {
      setTrainerTab("customers");
      if (!hasProgram) {
        setCustomerSubTab("programs");
        return;
      }
      if (needsMessage) {
        setCustomerSubTab("messages");
        setTrainerMessage(`Hei ${member.name}! Hvordan går treningen denne uka?`);
        return;
      }
      if (!hasCompletedLogs) {
        setCustomerSubTab("workouts");
        return;
      }
      setCustomerSubTab("workouts");
    });
  }

  async function handleInviteTrainer() {
    const email = newTrainerEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteTrainerStatus("Skriv inn en gyldig e-post for ny PT.");
      return;
    }
    setIsInvitingTrainer(true);
    setInviteTrainerStatus("Sender PT-invitasjon...");
    const result = await inviteTrainer(email);
    setInviteTrainerStatus(result.message);
    if (result.ok) {
      setNewTrainerEmail("");
      setNewTrainerName("");
    }
    setIsInvitingTrainer(false);
  }

  async function handleInviteSelectedMember() {
    if (isInvitingMember) return;
    if (!selectedMember) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteStatus("Kan ikke sende invitasjon: ugyldig e-post på kunden.");
      return;
    }
    setIsInvitingMember(true);
    setInviteStatus("Sender invitasjon...");
    try {
      const result = await inviteMember(email, selectedMember.id, { forceResend: true });
      if (result.ok) {
        markMemberInvited(selectedMember.id, result.invitedAtIso ?? new Date().toISOString());
      }
      setInviteStatus(result.message);
    } finally {
      setIsInvitingMember(false);
    }
  }

  async function handleRepairSelectedMemberLink() {
    if (!selectedMember) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setMemberLinkStatus("Kan ikke reparere kobling: ugyldig e-post på kunden.");
      return;
    }
    if (!supabaseClient) {
      setMemberLinkStatus("Denne handlingen er ikke tilgjengelig akkurat nå.");
      return;
    }

    setIsRepairingMemberLink(true);
    setMemberLinkStatus("Reparerer medlemskobling...");
    const { error } = await supabaseClient.functions.invoke("link-member-auth", {
      body: { email, memberId: selectedMember.id },
    });
    if (error) {
      setMemberLinkStatus(`Reparasjon feilet: ${error.message}`);
      setIsRepairingMemberLink(false);
      return;
    }
    setMemberLinkStatus("Medlemskobling reparert. Be medlem logge ut og inn.");
    setIsRepairingMemberLink(false);
  }

  async function handleRestoreMember(emailOverride?: string) {
    const email = (emailOverride ?? restoreEmail).trim();
    if (!email) {
      setRestoreStatus("Skriv inn e-post før gjenoppretting.");
      return;
    }
    const normalizedEmail = email.toLowerCase();
    setIsRestoringMember(true);
    setRestoringArchivedEmail(normalizedEmail);
    setRestoreStatus(null);
    const result = await restoreMemberByEmail(email, {
      ownerUserId: currentTrainerOwnerUserId,
      claimForTrainer: true,
    });
    setRestoreStatus(result.message);
    if (result.ok) {
      setRestoreEmail("");
      setShowInactiveMembers(true);
      setMemberSearch(normalizedEmail);
    }
    setRestoringArchivedEmail(null);
    setIsRestoringMember(false);
  }

  async function handleRestoreMissingTestData() {
    setIsRestoringTestData(true);
    setRestoreDataStatus("Gjenoppretter testdata...");
    const result = await restoreMissingTestData();
    setRestoreDataStatus(result.message);
    setIsRestoringTestData(false);
  }

  async function handleRestoreMembersFromRosterBackup() {
    setIsRestoringRosterBackup(true);
    setRosterBackupStatus("Henter kunder fra lokal sikkerhetskopi...");
    const result = await restoreMembersFromRosterBackup();
    setRosterBackupStatus(result.message);
    setIsRestoringRosterBackup(false);
    if (result.ok) {
      setTrainerTab("customers");
    }
  }

  async function handleRestoreOriginalExerciseBank() {
    setIsRestoringExerciseBank(true);
    setRestoreExerciseBankStatus("Gjenoppretter original øvelsesbank...");
    const result = await restoreOriginalExerciseBank();
    setRestoreExerciseBankStatus(result.message);
    setIsRestoringExerciseBank(false);
  }

  async function resolveOwnerUserIdFromSession(): Promise<string> {
    if (!supabaseClient) return "";
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    const fromSessionUser = session?.user?.id?.trim?.() ?? "";
    if (fromSessionUser) return fromSessionUser;

    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser();
    const fromUser = user?.id?.trim?.() ?? "";
    if (!error && fromUser) return fromUser;

    const token = session?.access_token ?? "";
    if (!token) return "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string };
      return String(payload.sub ?? "");
    } catch {
      return "";
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseClient) {
      setCurrentTrainerOwnerUserId("");
      return;
    }
    let cancelled = false;
    void resolveOwnerUserIdFromSession().then((ownerUserId) => {
      if (!cancelled) setCurrentTrainerOwnerUserId(ownerUserId.trim());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reassignableOwnedMembers = useMemo(() => {
    const trainerId = currentTrainerOwnerUserId.trim();
    if (!trainerId) return [] as Member[];
    return members
      .filter(
        (member) =>
          member.isActive !== false &&
          isPrivatePtRosterCustomerType(member.customerType, member.membershipType) &&
          (member.ownerUserId ?? "").trim() === trainerId,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  }, [members, currentTrainerOwnerUserId]);

  useEffect(() => {
    if (trainerTab !== "admin" || !isSupabaseConfigured) return;
    let cancelled = false;
    setIsLoadingTrainerOptions(true);
    void listTrainersForReassignFromSupabase().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setTrainerOptionsForReassign(
          result.trainers.filter((trainer) => trainer.id !== currentTrainerOwnerUserId.trim()),
        );
      } else if (!trainerOptionsForReassign.length) {
        setReassignStatus(result.message);
      }
      setIsLoadingTrainerOptions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [trainerTab, isSupabaseConfigured, currentTrainerOwnerUserId]);

  function memberReassignLabel(member: Member): string {
    const typeLabel =
      member.membershipType === "Premium" && member.customerType === "PT-kunde"
        ? "Premium-kunde"
        : member.customerType;
    return `${member.name} · ${typeLabel}`;
  }

  function handleConfirmReassignMember() {
    const memberId = reassignMemberId.trim();
    const targetOwnerUserId = reassignTargetTrainerId.trim();
    if (!memberId || !targetOwnerUserId) {
      setReassignStatus("Velg kunde og mottaker-PT.");
      return;
    }
    const member = members.find((row) => row.id === memberId);
    const targetTrainer = trainerOptionsForReassign.find((trainer) => trainer.id === targetOwnerUserId);
    if (!member || !targetTrainer) {
      setReassignStatus("Ugyldig valg. Oppdater siden og prøv igjen.");
      return;
    }
    setConfirmDialog({
      title: "Overfør kunde til annen PT?",
      message: `${memberReassignLabel(member)} overføres til ${targetTrainer.name} (${targetTrainer.email}). Programmer, treningslogg og chat følger med.`,
      confirmLabel: "Overfør",
      onConfirm: () => {
        void (async () => {
          setIsReassigningMember(true);
          setReassignStatus(null);
          const result = await reassignMemberOwner({ memberId, targetOwnerUserId });
          setReassignStatus(result.message);
          if (result.ok) {
            setReassignMemberId("");
            setReassignTargetTrainerId("");
          }
          setIsReassigningMember(false);
        })();
      },
    });
  }

  async function handleRefreshAdminHealthCheck() {
    if (!isSupabaseConfigured || !supabaseClient) {
      setAdminHealthStatus("Status er ikke tilgjengelig akkurat nå.");
      return;
    }
    setIsRefreshingAdminHealth(true);
    setAdminHealthStatus(null);
    try {
      const ownerUserId = await resolveOwnerUserIdFromSession();
      if (!ownerUserId) {
        setAdminHealthStatus("Fant ikke nødvendig brukerinformasjon for å oppdatere status.");
        return;
      }
      const dryRunResult = await supabaseClient.functions.invoke("dedupe-members", {
        body: { ownerUserId, apply: false },
      });
      if (dryRunResult.error) {
        setAdminHealthStatus(`Kunne ikke oppdatere status: ${dryRunResult.error.message}`);
        return;
      }
      const dryRunData = (dryRunResult.data ?? {}) as MemberDedupeDryRunData;
      const duplicateGroups = Number(dryRunData.duplicateGroupCount ?? 0);
      setAdminDuplicateGroupCount(duplicateGroups);
      setAdminHealthStatus(`Status oppdatert. Fant ${duplicateGroups} mulig${duplicateGroups === 1 ? "" : "e"} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}.`);
    } catch (error) {
      setAdminHealthStatus(`Kunne ikke oppdatere status: ${String(error)}`);
    } finally {
      setIsRefreshingAdminHealth(false);
    }
  }

  function handleClearLocalChatCache() {
    if (!clearLocalChatCache) {
      setAdminCacheStatus("Rydding av lokale meldinger er ikke tilgjengelig her.");
      return;
    }
    const removed = clearLocalChatCache();
    setAdminCacheStatus(`Lokale meldinger ryddet. Fjernet ${removed} melding${removed === 1 ? "" : "er"}.`);
  }

  function buildLocalMemberDedupePreviewGroups(ownerUserId: string): MemberDedupePreviewGroup[] {
    const ownerId = ownerUserId.trim();
    const byEmail = new Map<string, Member[]>();
    members.forEach((member) => {
      if (ownerId && (member.ownerUserId ?? "").trim() !== ownerId) return;
      const email = member.email.trim().toLowerCase();
      if (!email) return;
      byEmail.set(email, [...(byEmail.get(email) ?? []), member]);
    });

    function localDedupeScore(member: Member): number {
      let score = 0;
      if (member.isActive !== false) score += 8;
      if (member.invitedAt) score += 2;
      if (member.customerType === "PT-kunde") score += 1;
      if (member.membershipType === "Premium") score += 1;
      const days = Number(member.daysSinceActivity || "9999");
      score += Math.max(0, 100 - Math.min(100, Number.isFinite(days) ? days : 9999));
      return score;
    }

    function toPreviewMember(member: Member, action: "keep" | "deactivate"): MemberDedupePreviewMember {
      return {
        id: member.id,
        ownerUserId: member.ownerUserId,
        email: member.email,
        name: member.name,
        isActive: member.isActive !== false,
        invitedAt: member.invitedAt,
        daysSinceActivity: member.daysSinceActivity,
        customerType: member.customerType,
        membershipType: member.membershipType,
        action,
      };
    }

    return Array.from(byEmail.entries())
      .filter(([, rows]) => rows.length > 1)
      .map(([email, rows]) => {
        const sorted = [...rows].sort((a, b) => localDedupeScore(b) - localDedupeScore(a));
        const canonical = sorted[0];
        const duplicates = sorted.slice(1);
        return {
          email,
          canonicalId: canonical.id,
          duplicateIds: duplicates.map((member) => member.id),
          canonicalMember: toPreviewMember(canonical, "keep"),
          duplicateMembers: duplicates.map((member) => toPreviewMember(member, "deactivate")),
          members: sorted.map((member, index) => toPreviewMember(member, index === 0 ? "keep" : "deactivate")),
        };
      });
  }

  function normalizeMemberDedupePreviewGroups(data: MemberDedupeDryRunData, ownerUserId: string): MemberDedupePreviewGroup[] {
    if (Array.isArray(data.groups) && data.groups.length > 0) {
      return data.groups;
    }
    return buildLocalMemberDedupePreviewGroups(ownerUserId);
  }

  async function applyMemberDedupeCleanup(ownerUserId: string, duplicateGroups: number) {
    if (!supabaseClient) return;
    setIsRunningMemberDedupe(true);
    setMemberDedupeStatus(null);
    try {
      const applyResult = await supabaseClient.functions.invoke("dedupe-members", {
        body: { ownerUserId, apply: true },
      });
      if (applyResult.error) {
        setMemberDedupeStatus(`Opprydding feilet: ${applyResult.error.message}`);
        return;
      }

      const applyData = (applyResult.data ?? {}) as { groups?: Array<{ deactivatedMembers?: number }> };
      const deactivatedTotal = (applyData.groups ?? []).reduce((sum, group) => sum + Number(group.deactivatedMembers ?? 0), 0);
      setMemberDedupeStatus(
        `Opprydding fullført: ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}, ${deactivatedTotal} rader satt inaktive. Sjekk «Vis inaktive» om noen mangler i listen.`,
      );
      const cleanedAt = new Date().toISOString();
      setLastMemberCleanupAt(cleanedAt);
      setAdminDuplicateGroupCount(0);
      setMemberDedupePreviewGroups([]);
      setMemberDedupePreviewOwnerUserId("");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("motus.admin.lastMemberCleanupAt", cleanedAt);
      }
    } catch (error) {
      setMemberDedupeStatus(`Opprydding feilet: ${String(error)}`);
    } finally {
      setIsRunningMemberDedupe(false);
    }
  }

  async function handleRunSafeMemberCleanup() {
    if (!isSupabaseConfigured || !supabaseClient) {
      setMemberDedupeStatus("Opprydding er ikke tilgjengelig akkurat nå.");
      return;
    }
    setIsRunningMemberDedupe(true);
    setMemberDedupeStatus(null);
    setMemberDedupePreviewGroups([]);
    setMemberDedupePreviewOwnerUserId("");
    try {
      const ownerUserId = await resolveOwnerUserIdFromSession();
      if (!ownerUserId) {
        setMemberDedupeStatus("Fant ikke owner-id i aktiv trener-session.");
        return;
      }

      const dryRunResult = await supabaseClient.functions.invoke("dedupe-members", {
        body: { ownerUserId, apply: false },
      });
      if (dryRunResult.error) {
        setMemberDedupeStatus(`Dry-run feilet: ${dryRunResult.error.message}`);
        return;
      }

      const dryRunData = (dryRunResult.data ?? {}) as MemberDedupeDryRunData;
      const duplicateGroups = Number(dryRunData.duplicateGroupCount ?? 0);
      if (duplicateGroups <= 0) {
        setMemberDedupeStatus("Ingen duplikater funnet. Alt ser ryddig ut.");
        return;
      }

      const previewGroups = normalizeMemberDedupePreviewGroups(dryRunData, ownerUserId);
      setMemberDedupePreviewGroups(previewGroups);
      setMemberDedupePreviewOwnerUserId(ownerUserId);
      setMemberDedupeStatus(
        `Dry-run: ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}. Se oversikten under og trykk «Gjennomfør opprydding» når dette stemmer.`,
      );
      return;

      setConfirmDialog({
        title: "Bekreft duplikatopprydding",
        message:
          `Fant ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"} (samme e-post, flere medlemsrader). ` +
          "Ekstra rader settes inaktive – de slettes ikke. Kun helt identisk e-post slås sammen (ikke alle med «lene» i adressen). " +
          "Aktive kunder skal fortsatt vises; inaktive finnes under «Vis inaktive» eller «Gjenopprett klient».",
        confirmLabel: "Kjør opprydding",
        cancelLabel: "Avbryt",
        tone: "danger",
        onConfirm: () => {
          void applyMemberDedupeCleanup(ownerUserId, duplicateGroups);
        },
      });
      setMemberDedupeStatus(
        `Dry-run: ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}. Bekreft i dialogen for å kjøre.`,
      );
    } catch (error) {
      setMemberDedupeStatus(`Opprydding feilet: ${String(error)}`);
    } finally {
      setIsRunningMemberDedupe(false);
    }
  }

  function handleApplyPreviewedMemberDedupeCleanup() {
    const ownerUserId = memberDedupePreviewOwnerUserId.trim();
    const duplicateGroups = memberDedupePreviewGroups.length;
    if (!ownerUserId || duplicateGroups <= 0) {
      setMemberDedupeStatus("Kjør dry-run først for å se hvilke kunder som slås sammen.");
      return;
    }
    setConfirmDialog({
      title: "Bekreft duplikatopprydding",
      message:
        `Du er i ferd med å rydde ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}. ` +
        "Ekstra rader settes inaktive, og programmer, økter og meldinger flyttes til raden som beholdes. Ingenting slettes permanent.",
      confirmLabel: "Gjennomfør",
      cancelLabel: "Avbryt",
      tone: "danger",
      onConfirm: () => {
        void applyMemberDedupeCleanup(ownerUserId, duplicateGroups);
      },
    });
  }

  function addTodoItem(forDate?: string) {
    const title = todoTitle.trim();
    const date = forDate ?? selectedTodoDate;
    if (!title || !date) return;
    setTodos((prev) => [{ id: uid("todo"), title, date, done: false }, ...prev]);
    setTodoTitle("");
  }

  function inferTodoPriority(title: string): TrainerTodoModel["priority"] {
    const lower = title.toLowerCase();
    if (lower.includes("program")) return "high";
    if (lower.includes("ring") || lower.includes("følg") || lower.includes("folg")) return "medium";
    return undefined;
  }

  function toggleTodoDone(todoId: string) {
    setTodos((prev) => prev.map((item) => (item.id === todoId ? { ...item, done: !item.done } : item)));
  }

  function deleteTodo(todoId: string) {
    setConfirmDialog({
      title: "Slette oppgave",
      message: "Slette denne oppgaven?",
      confirmLabel: "Slett oppgave",
      tone: "danger",
      onConfirm: () => {
        setTodos((prev) => prev.filter((item) => item.id !== todoId));
      },
    });
  }

  function resetExerciseForm() {
    setEditingExerciseId(null);
    setExerciseFormName("");
    setExerciseFormCategory(defaultCategoryForExerciseBankTab(exerciseBankSubTab));
    setExerciseFormGroup("");
    setExerciseFormEquipment("");
    setExerciseFormLevel("Nybegynner");
    setExerciseFormDescription("");
    setExerciseFormImageUrl("");
    setExerciseFormPrescriptionFields(defaultPrescriptionFieldsForCategory(defaultCategoryForExerciseBankTab(exerciseBankSubTab)));
    setExerciseFormCustomField1Label("");
    setExerciseFormCustomField2Label("");
  }

  function startEditExercise(exercise: Exercise) {
    setExerciseBankSubTab(subTabForExerciseCategory(exercise.category));
    setEditingExerciseId(exercise.id);
    setExpandedExerciseId(exercise.id);
    setExerciseFormName(exercise.name);
    setExerciseFormCategory(exercise.category);
    setExerciseFormGroup(exercise.group);
    setExerciseFormEquipment(exercise.equipment);
    setExerciseFormLevel(exercise.level);
    setExerciseFormDescription(exercise.description);
    setExerciseFormImageUrl(exercise.imageUrl ?? "");
    setExerciseFormPrescriptionFields(resolveExercisePrescriptionFields(exercise));
    setExerciseFormCustomField1Label(exercise.customField1Label ?? "");
    setExerciseFormCustomField2Label(exercise.customField2Label ?? "");
    setExerciseFormStatus(null);
  }

  function submitExerciseForm() {
    const name = exerciseFormName.trim();
    const group = joinMultiValues(splitMultiValue(exerciseFormGroup));
    const equipment = joinMultiValues(splitMultiValue(exerciseFormEquipment));
    const description = exerciseFormDescription.trim();
    if (!name || !group) {
      setExerciseFormStatus("Fyll ut navn og minst én muskelgruppe.");
      return;
    }

    saveExercise({
      id: editingExerciseId ?? undefined,
      name,
      category: exerciseFormCategory,
      group,
      equipment,
      level: exerciseFormLevel,
      description,
      imageUrl: exerciseFormImageUrl.trim(),
      prescriptionFields: prescriptionFieldsForExerciseSave(exerciseFormPrescriptionFields, exerciseFormCategory),
      customField1Label: exerciseFormCustomField1Label,
      customField2Label: exerciseFormCustomField2Label,
    });

    setExerciseFormStatus(editingExerciseId ? "Øvelsen ble oppdatert." : "Ny øvelse ble lagt til i banken.");
    resetExerciseForm();
  }

  function duplicateExercise(exercise: Exercise) {
    saveExercise({
      name: `${exercise.name.trim()} (kopi)`,
      category: exercise.category,
      group: exercise.group,
      equipment: exercise.equipment,
      level: exercise.level,
      description: exercise.description,
      imageUrl: exercise.imageUrl?.trim() ?? "",
      prescriptionFields: resolveExercisePrescriptionFields(exercise),
      customField1Label: exercise.customField1Label,
      customField2Label: exercise.customField2Label,
    });
    setExerciseFormStatus(`Kopi av «${exercise.name}» ble lagt til.`);
    resetExerciseForm();
  }

  function handleDeleteExercise(exercise: Exercise) {
    const usages = findProgramsUsingBankExercise(programs, members, exercise);
    const dialogCopy = buildDeleteExerciseFromBankDialogCopy(exercise.name, usages);
    setConfirmDialog({
      title: dialogCopy.title,
      message: dialogCopy.message,
      confirmLabel: dialogCopy.confirmLabel,
      tone: "danger",
      onConfirm: () => {
        deleteExercise(exercise.id);
        setFavoriteExerciseIds((prev) => prev.filter((id) => id !== exercise.id));
        if (editingExerciseId === exercise.id) resetExerciseForm();
        if (expandedExerciseId === exercise.id) setExpandedExerciseId(null);
        setExerciseFormStatus(`Øvelsen "${exercise.name}" er skjult fra øvelsesbank.`);
      },
    });
  }

  async function handleProgramImageUpload(file: File | null) {
    if (!file) return;
    if (!supabaseClient) {
      setProgramSaveStatus("Bildefunksjonen er ikke tilgjengelig akkurat nå.");
      return;
    }
    setIsUploadingProgramImage(true);
    setProgramSaveStatus("Laster opp programbilde...");
    try {
      const result = await uploadProgramCoverImageToSupabase(file, supabaseClient);
      if (!result.ok) {
        setProgramSaveStatus(result.message);
        return;
      }
      setProgramFormImageUrl(result.publicUrl);
      setProgramCoverCleared(false);
      setProgramSaveStatus("Programbilde lastet opp. Husk å lagre programmet.");
    } catch {
      setProgramSaveStatus("Kunne ikke laste opp bilde akkurat nå. Prøv igjen senere.");
    } finally {
      setIsUploadingProgramImage(false);
    }
  }

  async function handleExerciseImageUpload(file: File | null) {
    if (!file) return;
    if (!supabaseClient) {
      setExerciseFormStatus("Bildefunksjonen er ikke tilgjengelig akkurat nå.");
      return;
    }
    if (!ALLOWED_EXERCISE_IMAGE_TYPES.has(file.type)) {
      setExerciseFormStatus("Kun JPG, PNG eller WEBP er tillatt.");
      return;
    }
    if (file.size > MAX_EXERCISE_IMAGE_BYTES) {
      setExerciseFormStatus("Bildet er for stort. Maks størrelse er 5 MB.");
      return;
    }

    setIsUploadingExerciseImage(true);
    setExerciseFormStatus("Laster opp bilde...");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const imagePath = `exercise-bank/${uid("exercise-image")}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage
        .from(EXERCISE_IMAGE_BUCKET)
        .upload(imagePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        throw new Error(uploadError.message);
      }
      const { data } = supabaseClient.storage.from(EXERCISE_IMAGE_BUCKET).getPublicUrl(imagePath);
      if (!data.publicUrl) {
        throw new Error("Mangler offentlig URL for opplastet bilde.");
      }
      setExerciseFormImageUrl(data.publicUrl);
      setExerciseFormStatus("Bilde lastet opp. Husk å lagre øvelsen.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukjent feil ved opplasting.";
      if (message.toLowerCase().includes("bucket")) {
        setExerciseFormStatus("Kunne ikke laste opp bilde akkurat nå. Prøv igjen senere.");
      } else {
        setExerciseFormStatus("Kunne ikke laste opp bilde akkurat nå. Prøv igjen senere.");
      }
    } finally {
      setIsUploadingExerciseImage(false);
    }
  }

  function getExerciseSketchDataUri(exercise: Exercise): string {
    const accent = exerciseCategoryAccentColor(exercise.category);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
      <rect width='96' height='96' rx='16' fill='#ffffff'/>
      <circle cx='48' cy='20' r='8' fill='${accent}'/>
      <path d='M48 30 L48 50 M48 38 L30 45 M48 38 L66 45 M48 50 L35 72 M48 50 L61 72' stroke='#0f172a' stroke-width='4' stroke-linecap='round' fill='none'/>
      <path d='M12 84 H84' stroke='${accent}' stroke-width='4' stroke-linecap='round'/>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function getExercisePreviewSrc(exercise: Exercise): string {
    const customImage = exercise.imageUrl?.trim();
    return customImage ? customImage : getExerciseSketchDataUri(exercise);
  }

  const membersWithoutProgramCount = useMemo(
    () => activeMembers.filter((member) => !programs.some((program) => program.memberId === member.id)).length,
    [activeMembers, programs],
  );
  const dashboardSummary = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const todaysLogs = logs.filter((log) => {
      const ts = parseLogDateMs(log.date);
      return ts >= start && ts < end;
    });
    const todaysCustomerIds = new Set(todaysLogs.map((log) => log.memberId));
    const newMessages24h = messages.filter((message) => {
      if (message.sender !== "member") return false;
      const ts = parseChatCreatedAtMs(message.createdAt);
      return ts > 0 && now.getTime() - ts <= 24 * 60 * 60 * 1000;
    }).length;
    return {
      todaysCustomers: todaysCustomerIds.size,
      todaysWorkouts: todaysLogs.length,
      newMessages24h,
    };
  }, [logs, messages]);
  const todoItemsForSelectedDate = todos.filter((todo) => todo.date === selectedTodoDate);
  const firstDayOffset = (dashboardMonth.getDay() + 6) % 7;
  const daysInDashboardMonth = new Date(dashboardMonth.getFullYear(), dashboardMonth.getMonth() + 1, 0).getDate();
  const dashboardCalendarCells = Array.from({ length: firstDayOffset + daysInDashboardMonth }, (_, index) => {
    const day = index - firstDayOffset + 1;
    if (day <= 0) return null;
    return day;
  });
  const todoDateSet = new Set(todos.map((todo) => todo.date));
  const monthLabel = dashboardMonth.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });
  const memberRelatedIdSetByCanonicalId = useMemo(() => {
    const byCanonicalId = new Map<string, Set<string>>();
    deduplicatedMembers.forEach((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      const byEmailIds = normalizedEmail
        ? members
            .filter((row) => row.email.trim().toLowerCase() === normalizedEmail)
            .map((row) => row.id)
        : [];
      byCanonicalId.set(member.id, new Set([...byEmailIds, member.id]));
    });
    return byCanonicalId;
  }, [deduplicatedMembers, members]);
  const followUpCandidates = useMemo(() => {
    const nowMs = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return activeMembers
      .map((member) => {
        const relatedIds = Array.from(memberRelatedIdSetByCanonicalId.get(member.id) ?? new Set([member.id]));
        const relatedIdSet = new Set(relatedIds);
        const memberLogs = logs.filter((log) => relatedIdSet.has(log.memberId));
        const recentHardLogs = memberLogs.filter((log) => {
          const dateMs = parseLogDateMs(log.date);
          return dateMs > 0 && nowMs - dateMs <= fourteenDaysMs && (log.reflection?.difficultyLevel ?? 0) >= 4;
        }).length;
        const recentUnfinishedLogs = memberLogs.filter((log) => {
          const dateMs = parseLogDateMs(log.date);
          return dateMs > 0 && nowMs - dateMs <= thirtyDaysMs && log.status !== "Fullført";
        }).length;
        const bestLastFollowUpIso = relatedIds
          .map((id) => lastFollowUpByMemberId[id] ?? "")
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a))[0] ?? "";
        const lastFollowUpMs = bestLastFollowUpIso ? new Date(bestLastFollowUpIso).getTime() : 0;
        const daysInactive = trainerInactiveDaysForFollowUp(member, members, logs);
        let score = 0;
        const reasons: string[] = [];
        if (daysInactive !== null && daysInactive >= 7) {
          score += 2;
          reasons.push(`${daysInactive} dager siden siste økt`);
        }
        if (recentHardLogs >= 2) {
          score += 2;
          reasons.push(`${recentHardLogs} harde økter siste 14 dager`);
        }
        if (recentUnfinishedLogs >= 2) {
          score += 1;
          reasons.push(`${recentUnfinishedLogs} ikke fullførte økter siste 30 dager`);
        }
        if (!lastFollowUpMs || nowMs - lastFollowUpMs > sevenDaysMs) {
          score += 1;
          reasons.push("ikke fulgt opp siste 7 dager");
        }
        return {
          member,
          score,
          reasons,
          lastFollowUpIso: bestLastFollowUpIso,
        };
      })
      .filter((item) => {
        const lastFollowUpMs = item.lastFollowUpIso ? new Date(item.lastFollowUpIso).getTime() : 0;
        if (lastFollowUpMs > 0 && nowMs - lastFollowUpMs <= sevenDaysMs) return false;
        return item.score >= 2;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ak = trainerActivitySortKey(a.member, members, logs);
        const bk = trainerActivitySortKey(b.member, members, logs);
        const aReal = ak < 999999;
        const bReal = bk < 999999;
        if (aReal && bReal) return bk - ak;
        if (aReal && !bReal) return -1;
        if (!aReal && bReal) return 1;
        return a.member.name.localeCompare(b.member.name, "no");
      })
      .slice(0, 6);
  }, [activeMembers, logs, memberRelatedIdSetByCanonicalId, lastFollowUpByMemberId, members]);
  const followUpCount = followUpCandidates.length;
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const inactiveLastWeekCount = useMemo(
    () => countInactiveLastWeek(activeMembers, members, logs),
    [activeMembers, members, logs],
  );
  const trainerFocusItems = useMemo(
    () =>
      buildTrainerFocusItems({
        followUpCount,
        inactiveLastWeekCount,
        membersWithoutProgramCount,
        newMessages24h: dashboardSummary.newMessages24h,
      }),
    [followUpCount, inactiveLastWeekCount, membersWithoutProgramCount, dashboardSummary.newMessages24h],
  );
  const mapFollowUpCard = useCallback(
    (item: (typeof followUpCandidates)[number]): TrainerFollowUpCardModel => ({
      memberId: item.member.id,
      memberName: item.member.name,
      memberEmail: item.member.email,
      avatarUrl: resolveMemberAvatarUrl(item.member) || null,
      customerTypeLabel: getMemberCustomerTypeDisplay(item.member).label,
      primaryReason: item.reasons[0] ?? "Trenger oppfølging",
      secondaryReason: item.reasons.slice(1).join(" · ") || undefined,
      score: item.score,
      lastFollowUpLabel: item.lastFollowUpIso ? formatDateDdMmYyyy(new Date(item.lastFollowUpIso)) : "Aldri",
      priorityTone: memberPriorityTone(item.member, members, logs),
    }),
    [members, logs],
  );
  const primaryFollowUpCard = followUpCandidates[0] ? mapFollowUpCard(followUpCandidates[0]) : null;
  const secondaryFollowUpCards = followUpCandidates.slice(1, 4).map(mapFollowUpCard);
  const criticalFollowUpCount = followUpCandidates.filter(
    (item) => item.score >= 3 || memberPriorityTone(item.member, members, logs) === "red",
  ).length;
  const todoItemsForToday = useMemo(() => todos.filter((todo) => todo.date === todayIso), [todos, todayIso]);
  const trainerTodayFeed = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const todaysLogs = logs.filter((log) => {
      const ts = parseLogDateMs(log.date);
      return ts >= start && ts < end;
    });
    const membersById = new Map(members.map((member) => [member.id, member]));
    return buildTrainerTodayFeed({
      followUpNames: followUpCandidates.map((item) => item.member.name),
      todos: todoItemsForToday,
      todaysLogs,
      membersById,
    });
  }, [followUpCandidates, todoItemsForToday, logs, members]);
  const trainerFirstName = pickFirstName(trainerAccountName) || "PT";
  const trainerTodayDateLabel = new Date().toLocaleDateString("no-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const trainerWeekLabel = useMemo(() => {
    const now = new Date();
    const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `Uke ${week}`;
  }, []);
  const inspirationItemsForHome = useMemo(() => loadInspirationItemsFromLocalStorage(), []);
  const ptHomeKpis = useMemo(
    () =>
      buildTrainerPtHomeKpis({
        activeMemberCount: activeMembers.length,
        newMembersThisWeek: countNewMembersThisWeek(activeMembers),
        programsThisWeek: countProgramsCreatedThisWeek(programs),
        inspirationPostsMonth: countInspirationPostsThisMonth(inspirationItemsForHome?.length ?? 0),
        averageProgressPct: computeAverageClientProgressPct(activeMembers, members, logs),
      }),
    [activeMembers, members, logs, programs, inspirationItemsForHome?.length],
  );
  const ptHomePlanItems = useMemo(() => {
    const membersById = new Map(members.map((member) => [member.id, member]));
    return buildTrainerPtHomePlanItems(trainerTodayFeed, membersById, (member) => resolveMemberAvatarUrl(member) || null);
  }, [trainerTodayFeed, members]);
  const ptHomeAttentionClients = useMemo(
    () =>
      buildTrainerPtHomeAttentionClients({
        followUpCards: [primaryFollowUpCard, ...secondaryFollowUpCards].filter(
          (card): card is TrainerFollowUpCardModel => Boolean(card),
        ),
        members: activeMembers,
        allMembers: members,
        logs,
        messages,
        resolveAvatar: (member) => resolveMemberAvatarUrl(member) || null,
      }),
    [primaryFollowUpCard, secondaryFollowUpCards, activeMembers, members, logs, messages],
  );
  const ptHomeProgress = useMemo(() => buildTrainerPtHomeProgressSeries(logs), [logs]);
  const ptHomePopularContent = useMemo(
    () =>
      buildTrainerPtHomePopularContent(
        (inspirationItemsForHome ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.createdAt,
        })),
      ),
    [inspirationItemsForHome],
  );
  const trainerDashboardHeadline =
    followUpCount > 0 || dashboardSummary.newMessages24h > 0 ? "Du har ting å følge opp" : "Alt ser bra ut";
  const trainerDashboardSubline =
    followUpCount > 0
      ? `${followUpCount} kunder bør prioriteres i dag.`
      : dashboardSummary.newMessages24h > 0
        ? `${dashboardSummary.newMessages24h} nye meldinger siste 24 timer.`
        : "Ingen kritiske oppfølginger akkurat nå.";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.lastFollowUpByMemberId", JSON.stringify(lastFollowUpByMemberId));
  }, [lastFollowUpByMemberId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.followUpDetailsByMemberId", JSON.stringify(followUpDetailsByMemberId));
  }, [followUpDetailsByMemberId]);
  useLayoutEffect(() => {
    if (followUpLastSyncedFromLogRef.current) return;
    followUpLastSyncedFromLogRef.current = true;
    setLastFollowUpByMemberId((prev) => {
      const next = { ...prev };
      for (const [memberId, list] of Object.entries(followUpDetailsByMemberId)) {
        if (!list.length) continue;
        const maxAt = list.reduce((best, e) => (e.at > best ? e.at : best), list[0].at);
        const cur = next[memberId];
        if (!cur || maxAt > cur) next[memberId] = maxAt;
      }
      return next;
    });
  }, [followUpDetailsByMemberId]);
  useEffect(() => {
    if (selectedMemberId === "__template__" || !selectedMemberId) {
      followUpDraftHydratedIdentityRef.current = null;
      setFollowUpMethodDraft("melding");
      setFollowUpNoteDraft("");
      setFollowUpSaveStatus(null);
      setEditingFollowUpEntryId(null);
      return;
    }
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const identity = selected ? getMemberIdentityKey(selected) : selectedMemberId;
    if (followUpDraftHydratedIdentityRef.current === identity) {
      return;
    }
    followUpDraftHydratedIdentityRef.current = identity;
    setFollowUpMethodDraft("melding");
    setFollowUpNoteDraft("");
    setFollowUpSaveStatus(null);
    setEditingFollowUpEntryId(null);
  }, [selectedMemberId, members]);

  const membersWithPriority = useMemo(() => {
    function getMemberTypeOrder(member: Member): { pt: number; premium: number; standard: number } {
      const isPt = member.customerType === "PT-kunde";
      const isPremium = member.membershipType === "Premium";
      const isStandard = member.membershipType !== "Premium";
      return {
        pt: isPt ? 0 : 1,
        premium: isPremium ? 0 : 1,
        standard: isStandard ? 0 : 1,
      };
    }

    function getPriority(member: Member): { tone: MemberPriorityTone; score: number; label: string } {
      const tone = memberPriorityTone(member, members, logs);
      const label =
        tone === "red" ? "Rød" : tone === "orange" ? "Oransje" : tone === "green" ? "Grønn" : "Ukjent";
      return { tone, score: memberPriorityScore(tone), label };
    }

    const mapped = activeMembers.map((member) => ({ member, priority: getPriority(member) }));
    const filtered = priorityFilter === "all" ? mapped : mapped.filter((item) => item.priority.tone === priorityFilter);
    return filtered.sort((a, b) => {
      if (priorityMemberTypeSort !== "none") {
        const aOrder = getMemberTypeOrder(a.member);
        const bOrder = getMemberTypeOrder(b.member);
        if (priorityMemberTypeSort === "ptFirst" && aOrder.pt !== bOrder.pt) return aOrder.pt - bOrder.pt;
        if (priorityMemberTypeSort === "premiumFirst" && aOrder.premium !== bOrder.premium) return aOrder.premium - bOrder.premium;
        if (priorityMemberTypeSort === "standardFirst" && aOrder.standard !== bOrder.standard) return aOrder.standard - bOrder.standard;
      }
      if (prioritySort === "highFirst") return b.priority.score - a.priority.score;
      return a.priority.score - b.priority.score;
    });
  }, [activeMembers, priorityFilter, prioritySort, priorityMemberTypeSort, members, logs]);

  const homePriorityMembers = useMemo((): TrainerPriorityMemberModel[] => {
    const urgent = membersWithPriority.filter((item) => item.priority.tone !== "green").slice(0, 5);
    const stable = membersWithPriority
      .filter((item) => memberTrainedWithinDays(item.member, members, logs, 4))
      .slice(0, 3);
    return [...urgent, ...stable].map(({ member, priority }) => ({
      memberId: member.id,
      memberName: member.name,
      avatarUrl: resolveMemberAvatarUrl(member) || null,
      customerTypeLabel: getMemberCustomerTypeDisplay(member).label,
      activityLabel: formatTrainerMemberActivitySubtitle(member, members, logs),
      statusTone: priority.tone,
    }));
  }, [membersWithPriority, members, logs]);
  const trainerStatisticsData = useMemo(
    () =>
      buildTrainerStatisticsData({
        members: activeMembers,
        allMembers: members,
        logs,
        programs,
        exercises,
        exercisePopularityScores,
        periodPreset: statsPeriodPreset,
        resolveAvatar: (member) => resolveMemberAvatarUrl(member) || null,
      }),
    [activeMembers, members, logs, programs, exercises, exercisePopularityScores, statsPeriodPreset],
  );
  const trainerTodosForHome = useMemo(
    (): TrainerTodoModel[] =>
      todoItemsForToday.map((todo) => ({
        id: todo.id,
        title: todo.title,
        done: todo.done,
        priority: inferTodoPriority(todo.title),
      })),
    [todoItemsForToday],
  );

  const ptListCounts = useMemo(() => {
    const active = visibleMembers.filter((m) => m.isActive !== false);
    const inactive = members.filter((m) => m.isActive === false).length;
    const risk = active.filter((m) => {
      const tone = memberPriorityTone(m, members, logs);
      return tone === "red" || tone === "orange";
    }).length;
    return {
      all: visibleMembers.length,
      active: active.filter((m) => memberTrainedWithinDays(m, members, logs, 4)).length,
      risk,
      inactive,
    };
  }, [visibleMembers, members, logs]);

  const ptFilteredMembers = useMemo(() => {
    if (ptListFilterTab === "inactive") {
      return sortedMembers.filter((m) => m.isActive === false);
    }
    const activeSorted = sortedMembers.filter((m) => m.isActive !== false);
    let base: Member[];
    if (ptListFilterTab === "all") base = activeSorted;
    else if (ptListFilterTab === "active") {
      base = activeSorted.filter((m) => memberTrainedWithinDays(m, members, logs, 4));
    } else {
      base = activeSorted.filter((m) => {
        const tone = memberPriorityTone(m, members, logs);
        return tone === "red" || tone === "orange";
      });
    }
    if (!selectedMemberId || base.some((m) => m.id === selectedMemberId)) return base;
    const pinned =
      deduplicatedMembers.find((m) => m.id === selectedMemberId && m.isActive !== false) ??
      members.find((m) => m.id === selectedMemberId && m.isActive !== false);
    return pinned ? [pinned, ...base] : base;
  }, [sortedMembers, ptListFilterTab, members, logs, selectedMemberId, deduplicatedMembers]);

  const ptListMembers = useMemo((): TrainerPtListMember[] => {
    return ptFilteredMembers.map((member) => {
      const status = trainerMemberListStatus(member, members, logs);
      return {
        member,
        avatarUrl: resolveMemberAvatarUrl(member) || null,
        customerTypeLabel: getMemberCustomerTypeDisplay(member).label,
        activityLabel: status.activityLabel,
        statusLabel: status.statusLabel,
        statusTone: status.statusTone,
        statusHint: status.statusHint,
        selected: member.id === selectedMemberId,
      };
    });
  }, [ptFilteredMembers, members, logs, selectedMemberId]);

  const selectedCustomerMetrics = useMemo(() => {
    if (!selectedMember) return null;
    return buildCustomerMetrics({
      memberLogs: selectedLogs,
      programs: selectedPrograms,
      memberMessages: selectedMessages,
    });
  }, [selectedMember, selectedLogs, selectedMessages, selectedPrograms]);

  const selectedCustomerTimeline = useMemo(() => {
    if (!selectedMember) return [];
    return buildCustomerTimeline({
      memberLogs: selectedLogs,
      memberMessages: selectedMessages,
    });
  }, [selectedMember, selectedLogs, selectedMessages]);

  const selectedCustomerFollowUps = useMemo(() => {
    if (!selectedMember) return [];
    const daysSinceWorkout = daysSinceLastCompletedWorkout(selectedMember, members, logs);
    const candidate = followUpCandidates.find((item) => item.member.id === selectedMember.id);
    return buildCustomerFollowUpItems({
      nextAction: selectedNextAction,
      reasons: candidate?.reasons ?? [],
      hasProgram: selectedPrograms.length > 0,
      daysSinceWorkout,
    });
  }, [selectedMember, members, logs, followUpCandidates, selectedNextAction, selectedPrograms.length]);

  const selectedLatestNote = useMemo(() => {
    const entry = selectedMemberFollowUpLog[0];
    if (!entry) return null;
    const methodTitle =
      entry.method === "telefon" ? "Telefon" : entry.method === "mote" ? "Møte" : "Melding";
    return {
      title: methodTitle,
      preview: entry.note.trim() || "Oppfølgingsnotat",
    };
  }, [selectedMemberFollowUpLog]);

  function getMemberCustomerTypeDisplay(member: Member): { label: string; badgeClass: string } {
    if (member.membershipType === "Premium") {
      return { label: "Premium-kunde", badgeClass: "bg-pink-50 text-pink-800 ring-pink-200" };
    }
    if (isSharedMedlemRosterMember(member)) {
      return { label: "Medlem", badgeClass: "bg-slate-100 text-slate-700 ring-slate-200" };
    }
    if (member.customerType === "PT-kunde") {
      return { label: "PT-kunde", badgeClass: "bg-teal-50 text-teal-800 ring-teal-200" };
    }
    return { label: member.customerType, badgeClass: "bg-slate-100 text-slate-700 ring-slate-200" };
  }

  function getPriorityToneDisplay(tone: "red" | "orange" | "green"): {
    label: string;
    dotClass: string;
    pillClass: string;
  } {
    if (tone === "red") {
      return { label: "Krever oppfølging", dotClass: "bg-rose-500", pillClass: "bg-rose-50 text-rose-800 ring-rose-200" };
    }
    if (tone === "orange") {
      return { label: "Mister momentum", dotClass: "bg-amber-500", pillClass: "bg-amber-50 text-amber-800 ring-amber-200" };
    }
    return { label: "Stabil", dotClass: "bg-teal-500", pillClass: "motus-brand-surface ring-teal-200" };
  }

  function renderMemberTypeBadge(member: Member, compact = false) {
    const typeDisplay = getMemberCustomerTypeDisplay(member);
    const sizeClass = compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";
    return (
      <span className={`inline-flex rounded-full font-semibold ring-1 ring-inset ${sizeClass} ${typeDisplay.badgeClass}`}>
        {typeDisplay.label}
      </span>
    );
  }

  function renderMemberPriorityMeta(member: Member, priority: { tone: "red" | "orange" | "green"; label: string }) {
    const typeDisplay = getMemberCustomerTypeDisplay(member);
    const priorityDisplay = getPriorityToneDisplay(priority.tone);
    return (
      <div className="grid shrink-0 grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 text-right">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Type</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Prioritet</span>
        <span
          className={`inline-flex justify-end rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${typeDisplay.badgeClass}`}
        >
          {typeDisplay.label}
        </span>
        <span
          className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${priorityDisplay.pillClass}`}
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${priorityDisplay.dotClass}`} aria-hidden />
          {priorityDisplay.label}
        </span>
      </div>
    );
  }

  function followUpMethodLabel(method: FollowUpDetail["method"]): string {
    if (method === "telefon") return "Telefon";
    if (method === "mote") return "Møte";
    return "Melding";
  }

  function handleQuickFollowUpMessage(member: Member) {
    selectMemberWithUnsavedChangesGuard(member.id, () => {
      setCustomerSubTab("messages");
      setTrainerTab("customers");
      setTrainerMessage(`Hei ${member.name}! Hvordan går treningen denne uka?`);
    });
  }

  function handleSelectedNextAction() {
    if (!selectedMember) return;
    if (selectedNextActionCta.presetMessage) {
      setCustomerSubTab("messages");
      if (!trainerMessage.trim()) {
        setTrainerMessage(`Hei ${selectedMemberProfile?.name ?? selectedMember.name}! Hvordan går treningen denne uka?`);
      }
      return;
    }
    setCustomerSubTab(selectedNextActionCta.tab);
  }

  function markMemberFollowedUp(member: Member) {
    const relatedIds = Array.from(memberRelatedIdSetByCanonicalId.get(member.id) ?? new Set([member.id]));
    const nowIso = new Date().toISOString();
    const newEntry: FollowUpDetail = {
      id: uid(),
      at: nowIso,
      method: "melding",
      note: "Markert fra oppfølgingsliste.",
    };
    setFollowUpDetailsByMemberId((prev) => {
      const next = { ...prev };
      relatedIds.forEach((id) => {
        next[id] = [...(next[id] ?? []), newEntry];
      });
      return next;
    });
    setLastFollowUpByMemberId((prev) => {
      const next = { ...prev };
      relatedIds.forEach((id) => {
        next[id] = nowIso;
      });
      return next;
    });
  }

  function beginEditFollowUpEntry(entry: FollowUpDetail) {
    setEditingFollowUpEntryId(entry.id);
    setFollowUpMethodDraft(entry.method);
    setFollowUpNoteDraft(entry.note);
    setFollowUpSaveStatus(null);
  }

  function cancelFollowUpFormEdit() {
    setEditingFollowUpEntryId(null);
    setFollowUpMethodDraft("melding");
    setFollowUpNoteDraft("");
    setFollowUpSaveStatus(null);
  }

  function deleteSelectedMemberFollowUpEntry(entryId: string) {
    setConfirmDialog({
      title: "Slette oppføring",
      message: "Slette denne oppføringen?",
      confirmLabel: "Slett oppføring",
      tone: "danger",
      onConfirm: () => {
        if (!selectedMemberRelatedIds.length) return;
        setFollowUpDetailsByMemberId((prev) => {
          const next = { ...prev };
          for (const id of selectedMemberRelatedIds) {
            next[id] = (next[id] ?? []).filter((e) => e.id !== entryId);
          }
          setLastFollowUpByMemberId((pl) => nextLastFollowUpMapForIds(pl, selectedMemberRelatedIds, next));
          return next;
        });
        if (editingFollowUpEntryId === entryId) {
          setEditingFollowUpEntryId(null);
          setFollowUpMethodDraft("melding");
          setFollowUpNoteDraft("");
        }
        setFollowUpSaveStatus("Notat slettet.");
      },
    });
  }

  function saveSelectedMemberFollowUpEntry() {
    if (!selectedMember || !selectedMemberRelatedIds.length) return;
    const trimmed = followUpNoteDraft.trim();
    if (editingFollowUpEntryId) {
      setFollowUpDetailsByMemberId((prev) => {
        const next = { ...prev };
        for (const id of selectedMemberRelatedIds) {
          next[id] = (next[id] ?? []).map((e) =>
            e.id === editingFollowUpEntryId ? { ...e, method: followUpMethodDraft, note: trimmed } : e,
          );
        }
        setLastFollowUpByMemberId((pl) => nextLastFollowUpMapForIds(pl, selectedMemberRelatedIds, next));
        return next;
      });
      setEditingFollowUpEntryId(null);
      setFollowUpMethodDraft("melding");
      setFollowUpNoteDraft("");
      setFollowUpSaveStatus("Notat oppdatert.");
      return;
    }
    const nowIso = new Date().toISOString();
    const newEntry: FollowUpDetail = {
      id: uid(),
      at: nowIso,
      method: followUpMethodDraft,
      note: trimmed,
    };
    setFollowUpDetailsByMemberId((prev) => {
      const next = { ...prev };
      for (const id of selectedMemberRelatedIds) {
        next[id] = [...(next[id] ?? []), newEntry];
      }
      setLastFollowUpByMemberId((pl) => nextLastFollowUpMapForIds(pl, selectedMemberRelatedIds, next));
      return next;
    });
    setFollowUpNoteDraft("");
    setFollowUpMethodDraft("melding");
      setFollowUpSaveStatus("Notat lagret.");
  }

  function renderNewMemberForm(options?: { id?: string; title?: string }) {
    const title = options?.title ?? "Legg til medlem";
    return (
      <div
        id={options?.id}
        className="scroll-mt-24 rounded-xl border bg-slate-50 p-4 space-y-3"
        style={{ borderColor: "rgba(15,23,42,0.08)" }}
      >
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <TextInput value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Navn" />
        <TextInput value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="E-post" />
        <TextInput value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="Telefon (valgfritt)" />
        <TextInput value={newMemberGoal} onChange={(e) => setNewMemberGoal(e.target.value)} placeholder="Hovedmål (valgfritt)" />
        <TextInput value={newMemberFocus} onChange={(e) => setNewMemberFocus(e.target.value)} placeholder="Fokus (valgfritt)" />
        <SelectBox
          value={newMemberInviteType}
          onChange={(value) => setNewMemberInviteType(value as "PT-kunde" | "Premium-kunde" | "Medlem")}
          options={[
            { value: "PT-kunde", label: "Ny kunde: PT-kunde (standard)" },
            { value: "Premium-kunde", label: "Ny kunde: Premium-kunde" },
            { value: "Medlem", label: "Ny kunde: Medlem (delt)" },
          ]}
        />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={newMemberNutritionAccess}
            onChange={(event) => setNewMemberNutritionAccess(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-[#30e3be]"
          />
          <Apple className="h-4 w-4 shrink-0" aria-hidden />
          Tilgang til ernæring (matplan i medlems-app)
        </label>
        {newMemberError ? <StatusMessage message={newMemberError} tone="error" className="!rounded-xl !px-3 !py-2 !text-xs" /> : null}
        {newMemberSuccess ? (
          <StatusMessage message={newMemberSuccess} tone="success" className="!rounded-xl !px-3 !py-2 !text-xs" />
        ) : null}
        <GradientButton
          disabled={isCreatingMember}
          onClick={() => {
            void submitNewMember();
          }}
          className="w-full md:w-auto"
        >
          {isCreatingMember ? "Oppretter..." : "Opprett kunde"}
        </GradientButton>
        <OutlineButton
          disabled={isCreatingMember}
          onClick={() => {
            void submitNewMember({ inviteAfterCreate: true });
          }}
          className="w-full md:w-auto"
        >
          {isCreatingMember ? "Oppretter..." : "Opprett + send invitasjon"}
        </OutlineButton>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      {trainerTab === "dashboard" ? (
        <TrainerPtHomeScreen
          trainerFirstName={trainerFirstName}
          todayDateLabel={trainerTodayDateLabel}
          weekLabel={trainerWeekLabel}
          kpis={ptHomeKpis}
          planItems={ptHomePlanItems}
          attentionClients={ptHomeAttentionClients}
          progressPoints={ptHomeProgress.points}
          progressDeltaPct={ptHomeProgress.monthDeltaPct}
          progressFocusLabel={ptHomeProgress.topFocusLabel}
          popularContent={ptHomePopularContent}
          onOpenCalendar={() => setTrainerTab("calendar")}
          onOpenAllClients={() => openCustomersWithListFilters({ memberFilter: "all" })}
          onOpenClient={(memberId) => {
            setTrainerTab("customers");
            selectMemberWithUnsavedChangesGuard(memberId, () => setCustomerSubTab("overview"));
          }}
          onOpenInsights={() => openCustomersWithListFilters({ priorityFilter: "red" })}
          onSwitchToMemberView={onSwitchToMemberView}
          quickActions={{
            onCreateProgram: () => setTrainerTab("programs"),
            onOpenExerciseBank: () => setTrainerTab("exerciseBank"),
            onOpenNutrition: () => setTrainerTab("mealPlan"),
            onShareContent: () => setTrainerTab("inspiration"),
            onBulkMessage: () => {
              setTrainerTab("customers");
              setOpenCustomerMessagesSignal?.((value) => value + 1);
            },
          }}
        />
      ) : null}

      {trainerTab === "customers" && (
        <TrainerPtDashboard
          listMembers={ptListMembers}
          listFilterTab={ptListFilterTab}
          onListFilterTabChange={(tab) => {
            setPtListFilterTab(tab);
            if (tab === "inactive") setShowInactiveMembers(true);
          }}
          listCounts={ptListCounts}
          memberSearch={memberSearch}
          onMemberSearchChange={setMemberSearch}
          onSelectMember={(memberId) => {
            selectMemberWithUnsavedChangesGuard(memberId, () => setCustomerSubTab("overview"));
          }}
          onResetFilters={resetMemberListControls}
          showInactiveToggle={!showInactiveMembers}
          onToggleInactive={() => setShowInactiveMembers(true)}
          showCustomerChrome={Boolean(selectedMember)}
          customerSubTab={customerSubTab}
          customerName={selectedMemberProfile?.name ?? selectedMember?.name}
          customerEmail={selectedMember?.email}
          customerPhone={selectedMemberProfile?.phone ?? selectedMember?.phone}
          customerAge={memberAgeLabel(selectedMemberProfile?.birthDate ?? selectedMember?.birthDate)}
          customerTypeLabel={selectedMember ? getMemberCustomerTypeDisplay(selectedMember).label : undefined}
          customerStatusLabel={
            selectedFollowUpTone === "critical"
              ? "Trenger oppfølging"
              : selectedFollowUpTone === "watch"
                ? "Følg opp"
                : selectedFollowUpTone === "good"
                  ? "Trent nylig"
                  : selectedMember
                    ? "Ingen økt ennå"
                    : undefined
          }
          customerStatusTone={
            selectedFollowUpTone === "critical"
              ? "critical"
              : selectedFollowUpTone === "watch"
                ? "warning"
                : selectedFollowUpTone === "good"
                  ? "active"
                  : "neutral"
          }
          customerStatusHint={
            selectedMember
              ? "Basert på siste fullførte treningsøkt — ikke sanntid pålogget."
              : undefined
          }
          customerAvatarUrl={selectedMember ? resolveMemberAvatarUrl(selectedMember) : null}
          onMessage={() => {
            if (!selectedMember) return;
            setCustomerSubTab("messages");
            handleQuickFollowUpMessage(selectedMember);
          }}
          onOpenCustomerCard={() => {
            if (!selectedMember) return;
            setCustomerSubTab("overview");
            window.requestAnimationFrame(() => {
              document.getElementById("motus-pt-customer-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
          }}
          onNewTask={() => {
            setTodoTitle(selectedMember ? `Oppfølging: ${selectedMember.name}` : "");
          }}
          subTabs={
            selectedMember ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <PillButton active={customerSubTab === "overview"} onClick={() => setCustomerSubTab("overview")}>
                  Oversikt
                </PillButton>
                <PillButton
                  active={customerSubTab === "programs"}
                  onClick={() => {
                    setCustomerSubTab("programs");
                    setCustomerProgramBuilderFocus("training");
                  }}
                >
                  Programmer
                </PillButton>
                <PillButton
                  active={customerSubTab === "workouts"}
                  onClick={() => {
                    setCustomerSubTab("workouts");
                  }}
                >
                  Økter
                </PillButton>
                <PillButton
                  active={customerSubTab === "messages"}
                  onClick={() => {
                    setCustomerSubTab("messages");
                  }}
                >
                  Meldinger
                </PillButton>
                {selectedMemberNutritionAccess ? (
                  <PillButton active={customerSubTab === "nutrition"} onClick={() => setCustomerSubTab("nutrition")}>
                    {CUSTOMER_NUTRITION_TAB_LABEL}
                  </PillButton>
                ) : null}
              </div>
            ) : null
          }
          metrics={selectedCustomerMetrics}
          followUpItems={selectedCustomerFollowUps}
          timeline={selectedCustomerTimeline}
          onTimelineAction={(item) => {
            if (item.icon === "message") setCustomerSubTab("messages");
            else if (item.icon === "workout") setCustomerSubTab("workouts");
            else setCustomerSubTab("overview");
          }}
          todos={trainerTodosForHome}
          todoDraft={todoTitle}
          onTodoDraftChange={setTodoTitle}
          onAddTodo={() => addTodoItem(todayIso)}
          onToggleTodo={toggleTodoDone}
          latestNote={selectedLatestNote}
          onOpenNote={() => setCustomerSubTab("overview")}
          aggregateOverview={
            !selectedMember ? (
              <div className="motus-pt-dash-empty py-16 text-base">Velg en kunde i listen for å se kundekortet.</div>
            ) : undefined
          }
        />
      )}

      {trainerTab === "statistics" ? (
        <TrainerStatisticsView
          data={trainerStatisticsData}
          periodPreset={statsPeriodPreset}
          onPeriodPresetChange={setStatsPeriodPreset}
          onOpenClient={(memberId) => {
            setSelectedMemberId(memberId);
            setTrainerTab("customers");
          }}
          onOpenCustomers={() => setTrainerTab("customers")}
          onOpenPrograms={() => setTrainerTab("programs")}
          onOpenExerciseBank={() => setTrainerTab("exerciseBank")}
        />
      ) : null}

      {trainerTab === "settings" ? (
        <Card className="p-5 space-y-4">
          <div className="font-semibold text-slate-800">Innstillinger</div>
          <TrainerProfileCard
            loadProfile={loadTrainerProfileForCurrentSession}
            saveProfile={saveTrainerProfile}
            onProfileSaved={onTrainerProfileSaved}
          />
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            Under Klienter finner du søk, filter og vis/skjul inaktive kunder. PT-kortet over styrer navnet kundene ser i appen.
          </div>
          <div className="rounded-xl border bg-amber-50/80 p-3 space-y-2.5" style={{ borderColor: "rgba(245,158,11,0.35)" }}>
            <div className="text-sm font-medium text-amber-950">Gjenopprett kunder fra sikkerhetskopi</div>
            <div className="text-xs text-amber-900">
              Hvis en kunde har forsvunnet fra listen, kan denne enheten ha en automatisk kopi (opptil 90 dager). Bruk
              dette før du oppretter kunden på nytt.
            </div>
            {rosterBackupStatus ? (
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-900">
                {rosterBackupStatus}
              </div>
            ) : null}
            <OutlineButton
              onClick={() => void handleRestoreMembersFromRosterBackup()}
              className="w-full"
              disabled={isRestoringRosterBackup}
            >
              {isRestoringRosterBackup ? "Gjenoppretter..." : "Gjenopprett fra sikkerhetskopi"}
            </OutlineButton>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3 space-y-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-medium text-slate-700">Gjenopprett testmedlemmer</div>
            <div className="text-xs text-slate-600">
              Legger tilbake manglende standard testmedlemmer uten å overskrive eksisterende medlemmer.
            </div>
            {restoreDataStatus ? (
              <div className="rounded-xl border motus-brand-surface px-3 py-2 text-xs text-emerald-700">
                {restoreDataStatus}
              </div>
            ) : null}
            <OutlineButton onClick={() => void handleRestoreMissingTestData()} className="w-full" disabled={isRestoringTestData}>
              {isRestoringTestData ? "Gjenoppretter..." : "Gjenopprett testmedlemmer"}
            </OutlineButton>
          </div>
          <div className="rounded-xl border bg-slate-50 p-3 space-y-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-medium text-slate-700">Gjenopprett original øvelsesbank</div>
            <div className="text-xs text-slate-600">
              Setter øvelsesbanken tilbake til originalversjonen i appen.
            </div>
            {restoreExerciseBankStatus ? (
              <div className="rounded-xl border motus-brand-surface px-3 py-2 text-xs text-emerald-700">
                {restoreExerciseBankStatus}
              </div>
            ) : null}
            <OutlineButton onClick={() => void handleRestoreOriginalExerciseBank()} className="w-full" disabled={isRestoringExerciseBank}>
              {isRestoringExerciseBank ? "Gjenoppretter..." : "Gjenopprett original øvelsesbank"}
            </OutlineButton>
          </div>
        </Card>
      ) : null}

      {trainerTab === "customers" ? (
        <div className="motus-pt-customers-detail-host">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start">
          <div className="motus-pt-dash-mobile-only lg:hidden lg:col-span-2">
            <OutlineButton onClick={() => setShowCustomerToolsMobile((prev) => !prev)} className="w-full">
              {showCustomerToolsMobile ? "Skjul kundeliste" : "Vis kundeliste"}
            </OutlineButton>
          </div>
          <Card className={`motus-pt-dash-mobile-only p-4 ${showCustomerToolsMobile ? "block" : "hidden"} lg:sticky lg:top-4 lg:block`}>
            <div className="flex items-start gap-3">
              <MotusSectionIcon><Users className="h-5 w-5" /></MotusSectionIcon>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Kunder</h2>
                <p className="text-sm text-slate-500">Velg kunde eller filtrer listen.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {sortedMembers.length} treff
                  {memberFilter !== "all" || customerTypeFilter !== "all" || priorityFilter !== "all"
                    ? " med aktivt filter"
                    : ""}
                </div>
                {(memberSearch.trim() ||
                  memberFilter !== "all" ||
                  customerTypeFilter !== "all" ||
                  priorityFilter !== "all") ? (
                  <OutlineButton onClick={resetMemberListControls} className="px-3 py-1.5 text-xs">
                    Nullstill søk/filter
                  </OutlineButton>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <TextInput
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Søk etter navn, e-post eller mal"
                />
                <SelectBox
                  value={memberFilter}
                  onChange={(value) =>
                    setMemberFilter(value as "all" | "followUp" | "invited" | "notInvited" | "noProgram")
                  }
                  options={[
                    { value: "all", label: "Alle kunder" },
                    { value: "followUp", label: "Må følges opp (7+ dager)" },
                    { value: "noProgram", label: "Mangler program" },
                    { value: "invited", label: "Invitert" },
                    { value: "notInvited", label: "Ikke invitert" },
                  ]}
                />
                <SelectBox
                  value={priorityFilter}
                  onChange={(value) => setPriorityFilter(value as "all" | "red" | "orange" | "green")}
                  options={[
                    { value: "all", label: "Alle prioriteter" },
                    { value: "red", label: "Rød prioritet (10+ dager)" },
                    { value: "orange", label: "Oransje (5+ dager)" },
                    { value: "green", label: "Grønn" },
                  ]}
                />
                <SelectBox
                  value={customerTypeFilter}
                  onChange={(value) => setCustomerTypeFilter(value as "all" | "PT-kunde" | "Premium-kunde" | "Medlem")}
                  options={[
                    { value: "all", label: "Alle kundetyper" },
                    { value: "PT-kunde", label: "PT-kunde" },
                    { value: "Premium-kunde", label: "Premium-kunde" },
                    { value: "Medlem", label: "Medlem (deles)" },
                  ]}
                />
                <SelectBox
                  value={memberSort}
                  onChange={(value) => setMemberSort(value as "activityRecent" | "nameAsc" | "nameDesc")}
                  options={[
                    { value: "activityRecent", label: "Siste økt (nyeste først)" },
                    { value: "nameAsc", label: "Navn A-Å" },
                    { value: "nameDesc", label: "Navn Å-A" },
                  ]}
                />
              </div>
              <SelectBox
                className="lg:hidden"
                value={selectedMemberId}
                onChange={selectMemberWithUnsavedChangesGuard}
                options={
                  sortedMembers.length
                    ? sortedMembers.map((member) => ({
                        value: member.id,
                        label: `${member.name} · ${member.customerType}`,
                      }))
                    : [{ value: "", label: "Ingen kunder matcher filteret" }]
                }
              />
              {sortedMembers.length > 0 ? (
                <div className="max-h-[min(72vh,680px)] space-y-1 overflow-auto pr-0.5">
                  {sortedMembers.map((member) => {
                    const selected = member.id === selectedMemberId;
                    const daysSinceWorkout = daysSinceLastCompletedWorkout(member, members, logs);
                    const needsFollowUp = daysSinceWorkout !== null && daysSinceWorkout >= 7;
                    const hasProgram = programsAttributedToMember(member, members, programs).length > 0;
                    const priorityTone = memberPriorityTone(member, members, logs);
                    const unreadMessageCount =
                      unreadMessagesByIdentityKey.get(getMemberIdentityKey(member)) ?? 0;
                    const activityLabel =
                      daysSinceWorkout !== null
                        ? daysSinceWorkout === 0
                          ? "Økt i dag"
                          : `${daysSinceWorkout}d siden økt`
                        : "Ingen økter";
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => selectMemberWithUnsavedChangesGuard(member.id)}
                        className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                          selected
                            ? "border-teal-300 bg-teal-50 shadow-sm ring-1 ring-teal-200"
                            : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400">
                            <ClientAvatarFallback iconClassName="h-4 w-4" />
                            {resolveMemberAvatarUrl(member) ? (
                              <img
                                src={resolveMemberAvatarUrl(member)}
                                alt=""
                                className="relative z-10 h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {priorityTone === "red" || priorityTone === "orange" ? (
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${priorityTone === "red" ? "bg-rose-500" : "bg-amber-500"}`}
                                  title={priorityTone === "red" ? "Rød prioritet" : "Oransje prioritet"}
                                  aria-hidden
                                />
                              ) : null}
                              <div className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-slate-900">
                                {member.name}
                              </div>
                              {needsFollowUp ? (
                                <span
                                  className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-800"
                                  title="7+ dager siden siste økt"
                                >
                                  Følg opp
                                </span>
                              ) : null}
                              {unreadMessageCount > 0 ? (
                                <span
                                  className="shrink-0 rounded-full bg-[#d91278] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                                  title={`${unreadMessageCount} uleste meldinger`}
                                >
                                  Mld {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                              {renderMemberTypeBadge(member, true)}
                              {!hasProgram ? (
                                <span className="rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-semibold text-rose-700">
                                  Mangler program
                                </span>
                              ) : null}
                              <span className="truncate text-[10px] text-slate-500" title={activityLabel}>
                                {activityLabel}
                              </span>
                            </div>
                            {member.invitedAt ? (
                              (() => {
                                const compact = inviteSentAtCompactLabel(member.invitedAt);
                                if (!compact) return null;
                                return (
                                  <div
                                    className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-slate-400"
                                    title={inviteSentAtLabel(member.invitedAt)}
                                  >
                                    <Mail className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.2} aria-hidden />
                                    <span className="truncate">{compact}</span>
                                  </div>
                                );
                              })()
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {sortedMembers.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-500">
                    Ingen kunder matcher søk/filter. Prøv et enklere søk eller bytt filter.
                  </div>
                  {memberSearchRecovery ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="font-semibold">Fant klient i systemet, men ikke i listen</p>
                      <p className="mt-1 text-xs text-amber-900">
                        {memberSearchRecovery.rawMatches.length === 1
                          ? `${memberSearchRecovery.rawMatches[0]?.name || "Ukjent navn"} (${memberSearchRecovery.primaryEmail || "uten e-post"})`
                          : `${memberSearchRecovery.rawMatches.length} rader matcher søket.`}
                        {memberSearchRecovery.inactiveMatches.length
                          ? " Minst en rad er markert inaktiv (ofte etter duplikatopprydding)."
                          : " Raden kan være skjult av filter."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <OutlineButton type="button" onClick={() => setShowInactiveMembers(true)} className="text-xs">
                          Vis inaktive
                        </OutlineButton>
                        {memberSearchRecovery.primaryEmail ? (
                          <GradientButton
                            type="button"
                            disabled={isRestoringMember}
                            onClick={() => void handleRestoreMember(memberSearchRecovery.primaryEmail)}
                            className="text-xs"
                          >
                            {isRestoringMember ? "Gjenoppretter..." : "Gjenopprett klient"}
                          </GradientButton>
                        ) : null}
                      </div>
                      {restoreStatus ? (
                        <StatusMessage
                          message={restoreStatus}
                          tone={restoreStatus.toLowerCase().includes("feilet") || restoreStatus.toLowerCase().includes("fant ingen") ? "error" : "success"}
                          className="mt-3 !rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {!memberSearchRecovery && isLookingUpEmail ? (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-600">
                      Søker i databasen etter e-post...
                    </p>
                  ) : null}
                  {!memberSearchRecovery && databaseEmailLookup?.ok && databaseEmailLookup.members.length > 0 ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                      <p className="font-semibold">Fant klient i databasen, men ikke i PT-listen</p>
                      <p className="mt-1 text-xs text-sky-900">{databaseEmailLookup.message}</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {databaseEmailLookup.members.map((row) => (
                          <li key={row.id}>
                            {row.name || "Ukjent navn"}
                            {row.emailMismatch && row.loginEmail ? (
                              <>
                                {" "}
                                · innlogging <span className="font-medium">{row.loginEmail}</span>
                                {row.linkedMemberEmail ? (
                                  <>
                                    {" "}
                                    · medlemsrad <span className="font-medium">{row.linkedMemberEmail}</span>
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <> · {row.email}</>
                            )}
                            {row.isActive ? "" : " · inaktiv"}
                            {row.ownerUserId && row.ownerUserId !== currentTrainerOwnerUserId ? " · annen eier" : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <OutlineButton type="button" onClick={() => setShowInactiveMembers(true)} className="text-xs">
                          Vis inaktive
                        </OutlineButton>
                        <GradientButton
                          type="button"
                          disabled={isRestoringMember}
                          onClick={() => void handleRestoreMember(memberSearch.trim().toLowerCase())}
                          className="text-xs"
                        >
                          {isRestoringMember ? "Gjenoppretter..." : "Gjenopprett og knytt til meg"}
                        </GradientButton>
                      </div>
                    </div>
                  ) : null}
                  {!memberSearchRecovery &&
                  !isLookingUpEmail &&
                  databaseEmailLookup &&
                  !databaseEmailLookup.members.length &&
                  memberSearch.trim().includes("@") ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
                      Ingen medlemsrad i databasen for denne e-posten. Hvis kunden har logget inn før, kan «Gjenopprett klient» nederst
                      opprette raden på nytt fra Auth.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <OutlineButton onClick={() => setShowInactiveMembers((prev) => !prev)} className="w-full">
                {showInactiveMembers ? "Skjul inaktive" : "Vis inaktive"}
              </OutlineButton>
            </div>
          </Card>

          <Card className="motus-pt-customers-detail-card p-4 sm:p-5 w-full block">
            {selectedMember ? (
              <div className="space-y-5">
                <div className="lg:hidden rounded-xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-medium text-slate-600">Bytt kunde raskt</div>
                  <SelectBox
                    value={selectedMemberId}
                    onChange={selectMemberWithUnsavedChangesGuard}
                    options={visibleMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                  />
                </div>
                <TrainerPtDetailPortal activeTab={customerSubTab} syncKey={selectedMemberId ?? ""}>
                {customerSubTab === "overview" ? (
                  <>
                <div id="motus-pt-customer-card" className="motus-card-hero scroll-mt-4 p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="motus-section-label">Kundekort</div>
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400 sm:h-14 sm:w-14">
                      <ClientAvatarFallback iconClassName="h-8 w-8 sm:h-9 sm:w-9" />
                      {resolveMemberAvatarUrl(selectedMember) ? (
                        <img
                          src={resolveMemberAvatarUrl(selectedMember)}
                          alt={`Profilbilde av ${selectedMember.name}`}
                          className="relative z-10 h-full w-full object-cover"
                          loading="eager"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{selectedMemberProfile?.name ?? selectedMember.name}</div>
                  {selectedMemberCreatedByTrainerLabel ? (
                    <p className="mt-1 text-sm text-slate-600">
                      Kunde lagt til av PT {selectedMemberCreatedByTrainerLabel}
                    </p>
                  ) : null}
                  {isEditingCustomerCard ? (
                    <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium text-slate-700">
                          <span>Navn</span>
                          <TextInput value={memberEditName} onChange={(event) => setMemberEditName(event.target.value)} placeholder="f.eks. Ola Nordmann" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-slate-700">
                          <span>E-post</span>
                          <TextInput value={memberEditEmail} onChange={(event) => setMemberEditEmail(event.target.value)} placeholder="f.eks. navn@epost.no" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-slate-700">
                          <span>Telefon</span>
                          <TextInput value={memberEditPhone} onChange={(event) => setMemberEditPhone(event.target.value)} placeholder="f.eks. 900 00 000" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-slate-700">
                          <span>Fødselsdato</span>
                          <TextInput value={memberEditBirthDate} onChange={(event) => setMemberEditBirthDate(event.target.value)} placeholder="dd.mm.yyyy" />
                        </label>
                      </div>
                      <label className="space-y-1 text-xs font-medium text-slate-700">
                        <span>Mål</span>
                        <SelectBox
                          value={MEMBER_GOAL_OPTIONS.includes(memberEditGoal as (typeof MEMBER_GOAL_OPTIONS)[number]) ? memberEditGoal : ""}
                          onChange={setMemberEditGoal}
                          options={[
                            { value: "", label: "Velg mål" },
                            ...MEMBER_GOAL_OPTIONS.map((goal) => ({ value: goal, label: goal })),
                          ]}
                        />
                      </label>
                      <label className="space-y-1 text-xs font-medium text-slate-700">
                        <span>Skader/hensyn</span>
                        <TextArea value={memberEditInjuries} onChange={(event) => setMemberEditInjuries(event.target.value)} className="min-h-[90px]" placeholder="Skader/hensyn" />
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                        <div className="text-xs font-medium text-slate-700">Kundetype og medlemskap</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsPtCustomer
                              ? "border-teal-300 bg-teal-50 text-teal-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditIsPtCustomer}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setMemberEditIsPtCustomer(checked);
                              if (checked) setMemberEditIsSharedMember(false);
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-[#30e3be]"
                          />
                          PT-kunde
                        </label>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsPremiumCustomer
                              ? "border-teal-300 bg-teal-50 text-teal-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditIsPremiumCustomer}
                            onChange={(event) => setMemberEditIsPremiumCustomer(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 accent-[#30e3be]"
                          />
                          Premium-kunde
                        </label>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsSharedMember
                              ? "border-teal-300 bg-teal-50 text-teal-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditIsSharedMember}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setMemberEditIsSharedMember(checked);
                              if (checked) setMemberEditIsPtCustomer(false);
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-[#30e3be]"
                          />
                          Medlem (vises hos alle PT-er)
                        </label>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition sm:col-span-2 ${
                            memberEditNutritionAccess
                              ? "border-teal-300 bg-teal-50 text-teal-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditNutritionAccess}
                            onChange={(event) => setMemberEditNutritionAccess(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 accent-[#30e3be]"
                          />
                          <Apple className="h-4 w-4 shrink-0" aria-hidden />
                          Tilgang til ernæring (matplan i medlems-app)
                        </label>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="text-xs font-medium text-slate-700">Profilbilde</div>
                        <div className="relative h-14 w-14 overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400">
                          <ClientAvatarFallback iconClassName="h-9 w-9" />
                          {resolveMemberAvatarUrl(selectedMember) ? (
                            <img
                              src={resolveMemberAvatarUrl(selectedMember)}
                              alt={`Profilbilde av ${selectedMember.name}`}
                              className="relative z-10 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : null}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handleCustomerAvatarSelected(event.target.files?.[0] ?? null)}
                          className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-800"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="text-[11px] text-slate-500">E-post</div>
                          <div className="font-medium text-slate-900">{selectedMember.email || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="text-[11px] text-slate-500">Telefon</div>
                          <div className="font-medium text-slate-900">{selectedMemberProfile?.phone || selectedMember.phone || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="text-[11px] text-slate-500">Invitasjon</div>
                          <div className="font-medium text-slate-900">{inviteSentAtLabel(selectedMember.invitedAt)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="text-[11px] text-slate-500">Fødselsdato</div>
                          <div className="font-medium text-slate-900">{selectedMemberProfile?.birthDate || selectedMember.birthDate || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                          <div className="text-[11px] text-slate-500">Mål</div>
                          <div className="font-medium text-slate-900">{selectedMemberProfile?.goal || selectedMember.goal || "Ikke satt"}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div className="text-[11px] text-slate-500">Skader/hensyn</div>
                        <div className="font-medium text-slate-900">{selectedMemberProfile?.injuries || selectedMember.injuries || "Ingen registrerte skader"}</div>
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <MemberOnboardingSummary
                          member={selectedMemberProfile ?? selectedMember}
                          allMembers={members}
                          variant="inline"
                          tone="light"
                        />
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        Sist trening: {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}
                      </div>
                    </>
                  )}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {isEditingCustomerCard ? (
                      <>
                        <GradientButton
                          onClick={handleSaveSelectedMemberDetails}
                          className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                        >
                          Lagre
                        </GradientButton>
                        <OutlineButton
                          onClick={() => {
                            resetMemberEditDraftFromSelected(selectedMember);
                            editLockedMemberIdRef.current = null;
                            editLockedIdentityRef.current = null;
                            setIsEditingCustomerCard(false);
                          }}
                          className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                        >
                          Avbryt
                        </OutlineButton>
                      </>
                    ) : (
                      <OutlineButton
                        onClick={() => {
                          editLockedMemberIdRef.current = selectedMember.id;
                          editLockedIdentityRef.current = {
                            email: selectedMember.email.trim().toLowerCase(),
                          };
                          setIsEditingCustomerCard(true);
                        }}
                        className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                      >
                        Rediger
                      </OutlineButton>
                    )}
                    <OutlineButton
                      onClick={() => void handleInviteSelectedMember()}
                      disabled={isInvitingMember}
                      className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                    >
                      {isInvitingMember ? "Sender..." : "Send invitasjon på nytt"}
                    </OutlineButton>
                    {selectedMember.isActive === false ? (
                      <GradientButton
                        onClick={() => handleReactivateSelectedMember(selectedMember.id)}
                        disabled={isRestoringMember}
                        className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                      >
                        {isRestoringMember ? "Aktiverer..." : "Aktiver kunde igjen"}
                      </GradientButton>
                    ) : (
                      <OutlineButton
                        onClick={() => handleDeactivateMember(selectedMember.id)}
                        aria-label="Arkiver kunde"
                        className={`${CUSTOMER_CARD_ACTION_BTN} w-full sm:w-auto`}
                      >
                        Arkiver
                      </OutlineButton>
                    )}
                  </div>
                </div>

                {inviteStatus ? (
                  <StatusMessage
                    message={inviteStatus}
                    tone={
                      inviteStatus.toLowerCase().includes("sendt") ||
                      inviteStatus.toLowerCase().includes("invitasjon") ||
                      inviteStatus.toLowerCase().includes("e-post")
                        ? "success"
                        : "error"
                    }
                    className="!rounded-xl !px-3 !py-2"
                  />
                ) : null}
                {memberLinkStatus ? (
                  <StatusMessage
                    message={memberLinkStatus}
                    tone={memberLinkStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                    className="!rounded-xl !px-3 !py-2"
                  />
                ) : null}
                {memberEditStatus ? (
                  <StatusMessage
                    message={memberEditStatus}
                    tone={memberEditStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                    className="!rounded-xl !px-3 !py-2 !text-xs"
                  />
                ) : null}
                  </>
                ) : null}
                {customerSubTab === "overview" ? (
                <div className="motus-pt-dash-legacy-hide-xl grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Neste beste handling</div>
                        <div className="mt-1 text-lg font-semibold text-slate-950">{selectedNextAction}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {selectedLatestFollowUpEntry
                            ? `Sist fulgt opp ${formatDateDdMmYyyy(new Date(selectedLatestFollowUpEntry.at))} via ${followUpMethodLabel(selectedLatestFollowUpEntry.method).toLowerCase()}.`
                            : "Ingen oppfølgingsnotater er lagret på kunden ennå."}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          selectedFollowUpTone === "critical"
                            ? "bg-rose-100 text-rose-800"
                            : selectedFollowUpTone === "watch"
                              ? "bg-amber-100 text-amber-800"
                              : selectedFollowUpTone === "good"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {selectedFollowUpTone === "critical"
                          ? "Høy prioritet"
                          : selectedFollowUpTone === "watch"
                            ? "Bør følges opp"
                            : selectedFollowUpTone === "good"
                              ? "I rute"
                              : "Ny kunde"}
                      </span>
                    </div>
                    <div className="mt-4">
                      <GradientButton
                        type="button"
                        onClick={handleSelectedNextAction}
                        disabled={selectedNextActionCta.tab === "messages" && selectedMemberMessagesLocked}
                        className="w-full sm:w-auto"
                      >
                        {selectedNextActionCta.label}
                      </GradientButton>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Siste signaler</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Siste økt</span>
                        <span className="text-right font-medium">{latestCompletedLog ? latestCompletedLog.date : "Ingen"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Siste melding</span>
                        <span className="text-right font-medium">{selectedLatestMessage ? selectedLatestMessage.createdAt : "Ingen"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Program</span>
                        <span className="text-right font-medium">{selectedPrograms.length ? selectedPrograms[0].title : "Mangler"}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500">Notater</span>
                        <span className="text-right font-medium">{selectedMemberFollowUpLog.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
                ) : null}
                {customerSubTab === "overview" ? (
                  <div className="motus-pt-dash-legacy-hide-xl grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Programmer" value={String(selectedPrograms.length)} hint="På denne kunden" />
                    <StatCard label="Logger" value={String(selectedLogs.length)} hint="På denne kunden" />
                    <StatCard label="Meldinger" value={String(selectedMessages.length)} hint="På denne kunden" />
                    <StatCard
                      label="Siste økt"
                      value={selectedDaysSinceLastCompletedWorkout !== null ? `${selectedDaysSinceLastCompletedWorkout} dager` : "–"}
                      hint={
                        selectedDaysSinceLastCompletedWorkout !== null
                          ? "Siden siste fullførte økt"
                          : "Ingen fullførte økter registrert"
                      }
                    />
                  </div>
                ) : null}

                <div className="motus-pt-dash-legacy-hide-xl rounded-xl border bg-slate-50/80 p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <PillButton active={customerSubTab === "overview"} onClick={() => setCustomerSubTab("overview")}>Oversikt og logg</PillButton>
                    <PillButton
                      active={customerSubTab === "programs"}
                      onClick={() => {
                        setCustomerSubTab("programs");
                        setCustomerProgramBuilderFocus("training");
                      }}
                    >
                      Program & planer
                    </PillButton>
                    <PillButton active={customerSubTab === "workouts"} onClick={() => setCustomerSubTab("workouts")}>Økter</PillButton>
                    <PillButton active={customerSubTab === "messages"} onClick={() => setCustomerSubTab("messages")}>Meldinger</PillButton>
                    {selectedMemberNutritionAccess ? (
                      <PillButton active={customerSubTab === "nutrition"} onClick={() => setCustomerSubTab("nutrition")}>
                        {CUSTOMER_NUTRITION_TAB_LABEL}
                      </PillButton>
                    ) : null}
                  </div>
                </div>

                {customerSubTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                    <MemberMonthlyCheckInSummary member={selectedMemberProfile ?? selectedMember} className="xl:col-span-2" />
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="font-semibold">Oppfølgingspunkter</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div>{selectedPrograms.length ? `Aktivt program: ${selectedPrograms[0].title}` : "Kunden mangler treningsprogram."}</div>
                        <div>{latestCompletedLog ? `Siste fullførte økt: ${latestCompletedLog.date}` : "Ingen fullførte økter ennå."}</div>
                        <div>
                          {selectedDaysSinceLastCompletedWorkout !== null && selectedDaysSinceLastCompletedWorkout >= 7
                            ? `${selectedDaysSinceLastCompletedWorkout} dager siden siste økt. Vurder en kort innsjekk.`
                            : selectedDaysSinceLastCompletedWorkout !== null
                              ? "Treningsaktiviteten ser oppdatert ut."
                              : "Få kunden i gang med første registrerte økt."}
                        </div>
                        <div>{selectedLatestMessage ? `Siste melding: ${selectedLatestMessage.createdAt}` : "Ingen meldinger sendt ennå."}</div>
                      </div>
                    </div>
                    </div>
                    <div className="rounded-xl border bg-white p-4">
                      <div className="font-semibold">Oppfølgingslogg</div>
                      <p className="mt-1 text-xs text-slate-500">
                        Hvert lagrede notat er egen oppføring. Bytter du kanal (melding / telefon / møte) nullstilles tekstfeltet slik at neste lagring blir et nytt notat.
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                        <SelectBox
                          value={followUpMethodDraft}
                          onChange={(value) => {
                            const next = value as FollowUpDetail["method"];
                            setFollowUpMethodDraft(next);
                            if (!editingFollowUpEntryId) {
                              setFollowUpNoteDraft("");
                            }
                          }}
                          options={[
                            { value: "melding", label: "Melding" },
                            { value: "telefon", label: "Telefon" },
                            { value: "mote", label: "Møte" },
                          ]}
                        />
                        <TextArea
                          value={followUpNoteDraft}
                          onChange={(event) => setFollowUpNoteDraft(event.target.value)}
                          aria-label="Oppfølgingsnotat"
                          placeholder={editingFollowUpEntryId ? "Rediger notatet ..." : "Skriv notatet her ..."}
                          className="min-h-[92px]"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <GradientButton onClick={() => saveSelectedMemberFollowUpEntry()} className="px-4 py-2 text-xs">
                          {editingFollowUpEntryId ? "Lagre endring" : "Lagre notat"}
                        </GradientButton>
                        {editingFollowUpEntryId ? (
                          <OutlineButton type="button" onClick={cancelFollowUpFormEdit} className="px-4 py-2 text-xs">
                            Avbryt redigering
                          </OutlineButton>
                        ) : null}
                        {followUpSaveStatus ? (
                          <span className="text-xs text-emerald-700">{followUpSaveStatus}</span>
                        ) : null}
                      </div>
                      <div className="mt-4 rounded-xl border bg-slate-50/80 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lagrede notater</div>
                        {selectedMemberFollowUpLog.length === 0 ? (
                          <div className="mt-2 text-sm text-slate-500">Ingen notater ennå.</div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {selectedMemberFollowUpLog.map((entry) => (
                              <div
                                key={entry.id}
                                className={`rounded-xl border bg-slate-50 px-3 py-2.5 ${
                                  entry.id === editingFollowUpEntryId ? "ring-2 ring-teal-300/80" : ""
                                }`}
                                style={{ borderColor: "rgba(15,23,42,0.08)" }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">
                                      <span className="text-slate-700">{formatDateDdMmYyyy(new Date(entry.at))}</span>
                                      <span className="mx-1.5 text-slate-300">·</span>
                                      <span>{followUpMethodLabel(entry.method)}</span>
                                    </div>
                                    <div className="text-xs text-slate-700 whitespace-pre-wrap break-words">{entry.note || "–"}</div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => beginEditFollowUpEntry(entry)}
                                      className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100"
                                      aria-label="Rediger notat"
                                      title="Rediger notat"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteSelectedMemberFollowUpEntry(entry.id)}
                                      className="rounded-lg border border-rose-200 p-1.5 text-rose-700 transition hover:bg-rose-50"
                                      aria-label="Slett notat"
                                      title="Slett notat"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "programs" ? (
                  <div className="space-y-4">
                    <div className="motus-card p-4">
                      <div className="text-sm font-semibold text-slate-900">To ulike verktøy for kunden</div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        <strong className="text-teal-900">Periodeplan</strong> er ukeoversikt (mandag–søndag).{" "}
                        <strong className="text-slate-900">Treningsprogram</strong> er en konkret økt med øvelser, sett og reps som logges.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setCustomerProgramBuilderFocus("period")}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                            customerProgramBuilderFocus === "period"
                              ? "border-teal-400 bg-teal-50/90 ring-2 ring-teal-200"
                              : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
                          }`}
                        >
                          <MotusSectionIcon className="h-10 w-10 !p-0">
                            <CalendarRange className="h-5 w-5" aria-hidden />
                          </MotusSectionIcon>
                          <span>
                            <span className="block text-sm font-bold text-slate-900">Periodeplan</span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-600">Uke-for-uke: hva kunden skal gjøre hver dag</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerProgramBuilderFocus("training")}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                            customerProgramBuilderFocus === "training"
                              ? "border-slate-400 bg-slate-50 ring-2 ring-slate-200"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <MotusSectionIcon className="h-10 w-10 !p-0">
                            <ClipboardList className="h-5 w-5" aria-hidden />
                          </MotusSectionIcon>
                          <span>
                            <span className="block text-sm font-bold text-slate-900">Treningsprogram</span>
                            <span className="mt-0.5 block text-xs leading-snug text-slate-600">Øvelser med sett og reps – logges som økt</span>
                          </span>
                        </button>
                      </div>
                    </div>

                    {customerProgramBuilderFocus === "training" ? (
                    <div className="rounded-xl border-2 border-slate-200 bg-white p-3 sm:p-4 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-base font-semibold text-slate-900">Lagrede treningsprogram</div>
                          <div className="text-xs text-slate-500">På denne kunden</div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {visibleSelectedPrograms.length}
                        </span>
                      </div>
                      {visibleSelectedPrograms.length === 0 ? (
                        <p className="text-sm text-slate-500">Ingen lagrede treningsprogram på kunden ennå.</p>
                      ) : (
                        <div className="max-h-[min(360px,45vh)] space-y-2 overflow-auto pr-1">
                          {visibleSelectedPrograms.map((program) => (
                            <div key={program.id} className="rounded-xl border bg-slate-50/80 p-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800 truncate">{program.title}</div>
                                <div className="text-[11px] text-slate-500">{program.exercises.length} øvelser · {program.createdAt}</div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <OutlineButton
                                  type="button"
                                  onClick={() => handleTrainerStartLiveWorkout(program)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px]"
                                  aria-label={`Start live økt med ${program.title}`}
                                  title="Start live økt (loggføres på kunden)"
                                >
                                  <Play className="h-3 w-3 shrink-0" />
                                  Live økt
                                </OutlineButton>
                                <OutlineButton onClick={() => startEditProgram(program)} className="px-2 py-1 text-[11px]">Rediger</OutlineButton>
                                <OutlineButton onClick={() => handlePrintProgram(program)} className="px-2 py-1 text-[11px]">PDF</OutlineButton>
                                <OutlineButton onClick={() => handleDeleteProgram(program.id)} className="px-2 py-1 text-[11px]">Slett</OutlineButton>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    ) : null}

                    {customerProgramBuilderFocus === "period" ? (
                    <div className="rounded-xl border-2 border-teal-200/80 bg-white p-3 sm:p-5 space-y-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-teal-100 pb-3">
                        <div className="flex items-start gap-3">
                          <MotusSectionIcon className="h-11 w-11 !p-0">
                            <CalendarRange className="h-5 w-5" aria-hidden />
                          </MotusSectionIcon>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">Lag periodeplan</h3>
                            <p className="mt-1 text-sm text-slate-600">Planlegg én eller flere uker. Medlemmet ser planen under Trening – Periodeplan.</p>
                          </div>
                        </div>
                        {selectedPeriodPlans.length > 0 ? (
                          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-900">
                            {selectedPeriodPlans.length} lagret
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-base font-semibold text-slate-900">Navn på periodeplan</span>
                            <TextInput
                              value={periodPlanTitleDraft}
                              onChange={(e) => setPeriodPlanTitleDraft(e.target.value)}
                              placeholder="Sommerblokk"
                              autoComplete="off"
                            />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-base font-semibold text-slate-900">Startdato</span>
                            <TextInput value={periodPlanStartDateDraft} onChange={(e) => setPeriodPlanStartDateDraft(e.target.value)} type="date" />
                          </label>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                          <label className="grid gap-2">
                            <span className="text-base font-semibold text-slate-900">Antall uker</span>
                            <TextInput
                              value={periodPlanWeeksDraft}
                              onChange={(e) => handlePeriodPlanWeeksDraftChange(e.target.value)}
                              placeholder="1–12"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={12}
                              className="text-center md:text-left"
                            />
                          </label>
                          <label className="grid gap-2">
                            <span className="text-base font-semibold text-slate-900">Notat til perioden</span>
                            <TextArea
                              value={periodPlanNotesDraft}
                              onChange={(e) => setPeriodPlanNotesDraft(e.target.value)}
                              className="min-h-[88px]"
                              placeholder="Valgfritt"
                            />
                          </label>
                        </div>
                        {periodWeeklyPlansDraft.length > 0 ? (
                          <div className="rounded-xl border bg-white p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            <div className="text-base font-semibold text-slate-900">Uker i planen</div>
                            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
                              {periodWeeklyPlansDraft.slice(0, Math.max(1, Math.min(12, Number(periodPlanWeeksDraft) || 1))).map((week) => {
                                const marked = week.usesGradientPlan === true;
                                const isActive = activePeriodWeekId === week.id;
                                return (
                                  <button
                                    key={week.id}
                                    type="button"
                                    onClick={() => toggleGradientPeriodWeek(week.id)}
                                    className={`rounded-md border px-1 py-1.5 text-center text-xs font-semibold leading-tight transition ${
                                      marked ? "border-transparent motus-brand-fill shadow-sm" : "bg-white text-slate-700 hover:bg-slate-50"
                                    } ${isActive ? "ring-2 ring-teal-200" : ""}`}
                                    style={marked ? undefined : { borderColor: "rgba(15,23,42,0.08)" }}
                                    aria-pressed={marked}
                                  >
                                    Uke {week.weekNumber}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                        {activePeriodWeek ? (
                          <div className="space-y-3">
                            <div className="text-base font-semibold text-slate-900">Ukedager i uken du redigerer</div>
                            <div className="grid gap-3 lg:grid-cols-2">
                            {WEEKDAY_PLAN_FIELDS.map((field) => {
                              const currentValue = activePeriodWeek.days[field.key];
                              const hasCurrentValueInOptions = periodPlanProgramOptions.some((option) => option.value === currentValue);
                              const options = hasCurrentValueInOptions
                                ? periodPlanProgramOptions
                                : [...periodPlanProgramOptions, { value: currentValue, label: `${currentValue} (tilpasset)` }];
                              const previewProgram = findProgramForPeriodPlanEntry(currentValue, selectedPrograms);
                              return (
                                <label key={field.key} className="grid gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{field.label}</span>
                                    {previewProgram ? (
                                      <button
                                        type="button"
                                        onClick={() => setPeriodPlanPreviewProgram(previewProgram)}
                                        className="inline-flex items-center gap-1 rounded-lg border motus-brand-surface/80 px-2 py-1 text-[11px] font-semibold text-teal-900 transition hover:border-teal-300 hover:bg-teal-100"
                                        aria-label={`Se økt for ${field.label}`}
                                        title="Se økt"
                                      >
                                        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        Se økt
                                      </button>
                                    ) : null}
                                  </div>
                                  <SelectBox
                                    value={currentValue}
                                    onChange={(value) => updateActivePeriodWeekDay(field.key, value)}
                                    options={options}
                                  />
                                </label>
                              );
                            })}
                            </div>
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <GradientButton onClick={() => void savePeriodPlanForSelectedMember()} className="w-full sm:w-auto">
                            Lagre periodeplan
                          </GradientButton>
                          {selectedPeriodPlans.length > 0 ? (
                            <OutlineButton
                              type="button"
                              onClick={() => {
                                resetPeriodPlanDraftForNewPlan();
                                setPeriodPlanStatus(null);
                              }}
                              className="w-full sm:w-auto"
                            >
                              Legg til ny periodeplan
                            </OutlineButton>
                          ) : null}
                          {periodPlanStatus ? (
                            <StatusMessage
                              message={periodPlanStatus}
                              tone={
                                periodPlanStatus.toLowerCase().includes("lagrer")
                                  ? "info"
                                  : periodPlanStatus.toLowerCase().includes("lagret") ||
                                      periodPlanStatus.toLowerCase().includes("oppdatert") ||
                                      periodPlanStatus.toLowerCase().includes("slettet")
                                    ? "success"
                                    : "error"
                              }
                              className="w-full !rounded-xl !px-3 !py-2 !text-sm"
                            />
                          ) : null}
                        </div>
                        <div className="space-y-3">
                          <div className="text-base font-semibold text-slate-900">Lagrede periodeplaner</div>
                          {selectedPeriodPlans.length === 0 ? (
                            <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
                              Ingen periodeplan lagret for kunden ennå.
                            </div>
                          ) : (
                            selectedPeriodPlans.slice(0, 4).map((plan) => {
                              const sortedWeeks = [...plan.weeklyPlans].sort((a, b) => a.weekNumber - b.weekNumber);
                              const selectedWeekNumber = savedPeriodPlanWeekByPlanId[plan.id] ?? sortedWeeks[0]?.weekNumber ?? 1;
                              const selectedWeek = sortedWeeks.find((week) => week.weekNumber === selectedWeekNumber) ?? sortedWeeks[0] ?? null;
                              return (
                                <div key={plan.id} className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="text-base font-semibold text-slate-900">{plan.title}</div>
                                      <div className="mt-1 text-sm text-slate-600">Start: {plan.startDate} · {plan.weeks} uker · Lagret {plan.createdAt}</div>
                                    </div>
                                    <OutlineButton className="px-3 py-1.5 text-sm" onClick={() => removePeriodPlan(plan.id)}>
                                      Slett
                                    </OutlineButton>
                                  </div>
                                  <div className="mt-3">
                                    <PeriodPlanWeekNavigator
                                      weeks={sortedWeeks}
                                      selectedWeekNumber={selectedWeek?.weekNumber ?? 1}
                                      onWeekSelectByNumber={(weekNumber) =>
                                        setSavedPeriodPlanWeekByPlanId((prev) => ({ ...prev, [plan.id]: weekNumber }))
                                      }
                                    />
                                  </div>
                                  {selectedWeek ? (
                                    <div className="mt-3 rounded-lg border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                      <div className="text-sm font-semibold text-slate-900">Uke {selectedWeek.weekNumber}</div>
                                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        {WEEKDAY_PLAN_FIELDS.map((field) => {
                                          const entry = selectedWeek.days[field.key]?.trim();
                                          const previewProgram = entry
                                            ? findProgramForPeriodPlanEntry(entry, selectedPrograms)
                                            : null;
                                          return (
                                            <div key={field.key} className="rounded-lg bg-slate-50 px-3 py-2">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{field.label}</div>
                                                {previewProgram ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => setPeriodPlanPreviewProgram(previewProgram)}
                                                    className="rounded-md border border-teal-200 bg-white p-1 text-teal-800 transition hover:border-teal-300 hover:bg-teal-50"
                                                    aria-label={`Se økt for ${field.label}`}
                                                    title="Se økt"
                                                  >
                                                    <Eye className="h-3.5 w-3.5" aria-hidden />
                                                  </button>
                                                ) : null}
                                              </div>
                                              <div className="mt-1 text-sm text-slate-800">{entry || "Ingen plan"}</div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                        <TrainingProgramPreviewModal
                          program={periodPlanPreviewProgram}
                          open={periodPlanPreviewProgram !== null}
                          onClose={() => setPeriodPlanPreviewProgram(null)}
                          exerciseLibrary={exercises}
                        />
                      </div>
                    </div>
                    ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white p-3 sm:p-4 space-y-3 shadow-sm lg:max-w-[58%]">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-start gap-3">
                          <MotusSectionIcon className="h-11 w-11 !p-0">
                            <ClipboardList className="h-5 w-5" aria-hidden />
                          </MotusSectionIcon>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{editingProgramId ? "Rediger treningsprogram" : "Lag treningsprogram"}</h3>
                            <p className="mt-1 text-sm text-slate-600">Bygg en økt med øvelser. Medlemmet starter og logger under Trening.</p>
                          </div>
                        </div>
                        {editingProgramId ? <OutlineButton onClick={resetProgramBuilder}>Avbryt redigering</OutlineButton> : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på program" />
                      <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål" />
                      </div>
                      <TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} className="min-h-[72px]" placeholder="Notater" />
                      <ProgramCoverImageField
                        imageUrl={programFormImageUrl}
                        onImageUrlChange={(url) => {
                          setProgramFormImageUrl(url);
                          if (!url.trim()) setProgramCoverCleared(true);
                        }}
                        onUploadFile={(file) => handleProgramImageUpload(file)}
                        isUploading={isUploadingProgramImage}
                        disabled={isSavingProgram}
                      />

                      <div
                        className={`space-y-3 rounded-2xl p-1 transition ${
                          isDraftDropZoneActive ? "bg-emerald-50 ring-2 ring-teal-300" : ""
                        }`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggedExerciseIdFromLibrary) setIsDraftDropZoneActive(true);
                        }}
                        onDragLeave={() => setIsDraftDropZoneActive(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggedExerciseIdFromLibrary) return;
                          const exercise = exercises.find((item) => item.id === draggedExerciseIdFromLibrary);
                          if (exercise) addExerciseToDraft(exercise);
                          setDraggedExerciseIdFromLibrary(null);
                          setIsDraftDropZoneActive(false);
                        }}
                      >
                        {programExercisesDraft.length === 0 ? (
                          <EmptyState
                            icon="...?️"
                            title="Ingen øvelser valgt ennå"
                            description="Legg til fra øvelseslisten til høyre."
                            className="!px-3 !py-3 bg-white"
                          />
                        ) : null}
                        {programExercisesDraft.map((item, index) => {
                          const itemExerciseName = resolveProgramExerciseName(programExercisesDraft, index);
                          return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedDraftExerciseId(item.id)}
                            onDragEnd={() => {
                              setDraggedDraftExerciseId(null);
                              setDragOverDraftExerciseId(null);
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (draggedDraftExerciseId) setDragOverDraftExerciseId(item.id);
                            }}
                            onDragLeave={() => {
                              if (dragOverDraftExerciseId === item.id) setDragOverDraftExerciseId(null);
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              if (!draggedDraftExerciseId) return;
                              moveDraftExercise(draggedDraftExerciseId, item.id);
                              setDragOverDraftExerciseId(null);
                            }}
                            className={`motus-program-exercise-card rounded-2xl border bg-white p-4 space-y-3 cursor-move transition ${
                              dragOverDraftExerciseId === item.id ? "ring-2 ring-teal-300 border-teal-300" : ""
                            } ${item.blockId ? "motus-program-exercise-card--in-block" : ""} ${
                              item.blockId && isFirstExerciseInBlock(programExercisesDraft, index)
                                ? "motus-program-exercise-card--block-start"
                                : ""
                            } ${
                              item.blockId &&
                              !isFirstExerciseInBlock(programExercisesDraft, index)
                                ? "motus-program-exercise-card--block-continuation"
                                : ""
                            } ${
                              item.blockId &&
                              countExercisesInBlock(programExercisesDraft, item.blockId) > 0 &&
                              programExercisesDraft.findIndex((other, otherIndex) => other.blockId?.trim() === item.blockId?.trim() && otherIndex > index) === -1
                                ? "motus-program-exercise-card--block-end"
                                : ""
                            }`}
                          >
                            <ProgramExerciseBlockActions exercises={programExercisesDraft} index={index} onChange={setProgramExercisesDraft} />
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">{itemExerciseName}</div>
                              <div className="flex items-center gap-2">
                                <OutlineButton
                                  onClick={() => moveDraftExerciseByOffset(item.id, -1)}
                                  className="px-2 py-1.5 text-xs"
                                  disabled={index === 0}
                                  aria-label="Flytt opp"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </OutlineButton>
                                <OutlineButton
                                  onClick={() => moveDraftExerciseByOffset(item.id, 1)}
                                  className="px-2 py-1.5 text-xs"
                                  disabled={index === programExercisesDraft.length - 1}
                                  aria-label="Flytt ned"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </OutlineButton>
                                <OutlineButton onClick={() => removeDraftExercise(item.id)} className="px-2 py-1.5 text-xs" aria-label="Fjern">
                                  <Trash2 className="h-4 w-4" />
                                </OutlineButton>
                              </div>
                            </div>
                            {(() => {
                              const linkedExercise = exercisesById.get(item.exerciseId);
                              const isCardio = isCardioDraftRow(item, linkedExercise);
                              const isTreadmill = (linkedExercise?.equipment ?? "").trim().toLowerCase().includes("tredem");
                              const prescriptionFields = resolveExercisePrescriptionFields(linkedExercise);
                              return (
                                <ProgramExercisePrescriptionFields
                                  fields={prescriptionFields}
                                  item={item}
                                  exercise={linkedExercise}
                                  onUpdate={(field, value) => updateDraftExercise(item.id, field, value)}
                                  setsLabel={isCardio ? cardioSetLabel() : "Antall sett"}
                                  setsPlaceholder={isCardio ? cardioSetPlaceholder() : "Sett"}
                                  trailing={
                                    <>
                                      {isCardio && isTreadmill ? (
                                        <>
                                          <div className="space-y-1">
                                            <div className="text-[11px] font-medium text-slate-500">Fart (km/t)</div>
                                            <TextInput value={item.speed ?? ""} onChange={(e) => updateDraftExercise(item.id, "speed", e.target.value)} placeholder="Fart" />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-[11px] font-medium text-slate-500">Incline (%)</div>
                                            <TextInput value={item.incline ?? ""} onChange={(e) => updateDraftExercise(item.id, "incline", e.target.value)} placeholder="Incline" />
                                          </div>
                                        </>
                                      ) : null}
                                      {isCardio ? (
                                        <div className="space-y-1">
                                          <div className="text-[11px] font-medium text-slate-500">Puls (% av makspuls)</div>
                                          <TextInput
                                            value={item.targetHrPercent ?? ""}
                                            onChange={(e) => updateDraftExercise(item.id, "targetHrPercent", e.target.value)}
                                            placeholder="f.eks. 85–90"
                                          />
                                        </div>
                                      ) : null}
                                    </>
                                  }
                                />
                              );
                            })()}
                          </div>
                        )})}
                      </div>

                      <GradientButton
                        onClick={() => {
                          saveProgramToSelectedMemberProfiles({
                            id: editingProgramId ?? undefined,
                            title: programTitle,
                            goal: programGoal,
                            notes: programNotes,
                            exercises: programExercisesDraft,
                            imageUrl: programSaveImageUrl(),
                          });
                        }}
                        className="w-full"
                        disabled={isLocalDemoSession || isSavingProgram}
                      >
                        {isSavingProgram ? "Lagrer ..." : editingProgramId ? "Oppdater program" : "Lagre program på kunde"}
                      </GradientButton>
                      {programSaveStatus ? (
                        <StatusMessage
                          message={programSaveStatus}
                          tone={programSaveStatus.toLowerCase().includes("lagret") ? "success" : "error"}
                          className="!rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1 space-y-3 lg:sticky lg:top-4 lg:max-h-[min(78vh,920px)] lg:self-start">
                    <div className="rounded-xl border bg-slate-50 p-3 space-y-2.5 lg:max-h-full lg:overflow-hidden lg:flex lg:flex-col">
                      <div className="text-sm font-semibold text-slate-800">Øvelser</div>
                      <TextInput
                        value={programExerciseSearch}
                        onChange={(e) => setProgramExerciseSearch(e.target.value)}
                        placeholder="Søk øvelse, muskelgruppe eller utstyr"
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <SelectBox
                          value={programExerciseCategoryFilter}
                          onChange={(value) => setProgramExerciseCategoryFilter(value as "all" | Exercise["category"])}
                          options={[
                            { value: "all", label: "Alle typer" },
                            ...EXERCISE_CATEGORY_OPTIONS.map((category) => ({ value: category, label: category })),
                          ]}
                        />
                        <SelectBox
                          value={programExerciseGroupFilter}
                          onChange={setProgramExerciseGroupFilter}
                          options={[
                            { value: "all", label: "Alle muskelgrupper" },
                            ...programExerciseGroupOptions.map((group) => ({ value: group, label: group })),
                          ]}
                        />
                      </div>
                      <div className="max-h-[min(420px,55vh)] space-y-1.5 overflow-auto pr-1">
                        {visibleProgramExercises.length === 0 ? (
                          <div className="rounded-xl border border-dashed p-3 text-sm text-slate-500 bg-white">
                            Ingen øvelser matcher søk/filter.
                          </div>
                        ) : null}
                        {visibleProgramExercises.map((exercise) => {
                          const isFavorite = favoriteExerciseIds.includes(exercise.id);
                          const popularity = exercisePopularityScores.get(exercise.id) ?? 0;
                          return (
                            <div
                              key={exercise.id}
                              draggable
                              onDragStart={() => setDraggedExerciseIdFromLibrary(exercise.id)}
                              onDragEnd={() => setDraggedExerciseIdFromLibrary(null)}
                              className="rounded-xl border bg-white p-2.5 cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button type="button" onClick={() => addExerciseToDraft(exercise)} className="flex flex-1 items-start gap-2 text-left">
                                  <img
                                    src={getExercisePreviewSrc(exercise)}
                                    alt={exercise.name}
                                    className="mt-0.5 h-20 w-20 shrink-0 rounded-xl border object-cover bg-white"
                                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(event) => {
                                      event.currentTarget.src = getExerciseSketchDataUri(exercise);
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <div className="font-medium text-sm">{exercise.name}</div>
                                      <ExerciseBankBadges popularity={popularity} isFavorite={isFavorite} variant="trainer" />
                                    </div>
                                    <div className="text-xs text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteExercise(exercise.id)}
                                  className="motus-favorite-star-toggle"
                                  aria-pressed={isFavorite}
                                  aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                  title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                >
                                  <Star className="h-4 w-4" aria-hidden />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>
                    </div>
                    )}
                  </div>
                ) : null}

                {customerSubTab === "workouts" ? (
                  <div className="grid gap-5 xl:grid-cols-[minmax(300px,22rem)_minmax(0,1fr)] xl:items-start">
                    <div className="flex min-h-0 flex-col rounded-xl border bg-slate-50 p-4 xl:max-h-[min(78vh,920px)]">
                      <div className="mb-3 grid gap-2 sm:grid-cols-3">
                        <StatCard label="Økter siste 7 dager" value={String(workoutInsights.workoutsLast7Days)} hint="Alle økter" />
                        <StatCard label="Gruppetimer siste 30 dager" value={String(workoutInsights.groupWorkoutsLast30Days)} hint="Kun gruppetimer" />
                        <StatCard label="Snitt belastning 30 dager" value={workoutInsights.averageDifficulty} hint="Basert på refleksjon" />
                      </div>
                      <div className="mb-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        <SelectBox
                          value={workoutDateRangeFilter}
                          onChange={(value) => setWorkoutDateRangeFilter(value as "7d" | "30d" | "all")}
                          options={[
                            { value: "7d", label: "Periode: 7 dager" },
                            { value: "30d", label: "Periode: 30 dager" },
                            { value: "all", label: "Periode: Alle" },
                          ]}
                        />
                        <SelectBox
                          value={workoutTypeFilter}
                          onChange={(value) => setWorkoutTypeFilter(value as "all" | "program" | "group")}
                          options={[
                            { value: "all", label: "Type: Alle" },
                            { value: "program", label: "Type: Programøkt" },
                            { value: "group", label: "Type: Gruppetime" },
                          ]}
                        />
                        <TextInput
                          value={workoutSearchQuery}
                          onChange={(event) => setWorkoutSearchQuery(event.target.value)}
                          placeholder="Søk tittel eller notat"
                        />
                        <SelectBox
                          value={workoutSortOrder}
                          onChange={(value) => setWorkoutSortOrder(value as "newest" | "oldest")}
                          options={[
                            { value: "newest", label: "Sorter: Nyeste først" },
                            { value: "oldest", label: "Sorter: Eldste først" },
                          ]}
                        />
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="font-semibold">Siste økter</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {workoutDateRangeFilter === "7d"
                            ? "Viser økter fra de siste 7 dagene"
                            : workoutDateRangeFilter === "30d"
                              ? "Viser økter fra de siste 30 dagene"
                              : "Viser alle økter"}
                        </div>
                      {filteredWorkoutLogs.length ? (
                        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                          {filteredWorkoutLogs.map((log) => (
                            <button
                              key={log.id}
                              type="button"
                              onClick={() => setSelectedWorkoutLogId(log.id)}
                              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                filteredSelectedWorkoutLog?.id === log.id
                                  ? "border-teal-300 bg-emerald-50"
                                  : "border-slate-200 bg-white hover:bg-slate-100"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-slate-800">{log.programTitle}</div>
                                <div className="text-xs text-slate-500">{log.date}</div>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{log.status}</div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">
                          {workoutDateRangeFilter === "7d"
                            ? "Ingen økter de siste 7 dagene."
                            : "Ingen økter matcher filtrene."}
                        </div>
                      )}
                      {workoutDateRangeFilter === "7d" && olderMatchingWorkoutCount > 0 ? (
                        <OutlineButton
                          type="button"
                          className="mt-3 w-full text-xs"
                          onClick={() => setWorkoutDateRangeFilter("all")}
                        >
                          Vis flere økter ({olderMatchingWorkoutCount} eldre)
                        </OutlineButton>
                      ) : null}
                      {workoutDateRangeFilter !== "7d" ? (
                        <button
                          type="button"
                          className="mt-3 w-full text-center text-xs font-semibold text-teal-800 underline-offset-2 hover:text-teal-950 hover:underline"
                          onClick={() => setWorkoutDateRangeFilter("7d")}
                        >
                          Vis kun siste 7 dager
                        </button>
                      ) : null}
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-col rounded-xl border bg-slate-50 p-4 xl:max-h-[min(78vh,920px)]">
                      <div className="font-semibold">Øktdetaljer</div>
                      {filteredSelectedWorkoutLog ? (
                        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                          <div className="rounded-2xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-slate-800">{filteredSelectedWorkoutLog.programTitle}</div>
                              <div className="text-xs text-slate-500">{filteredSelectedWorkoutLog.date}</div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{filteredSelectedWorkoutLog.status}</div>
                            <div className="mt-2 text-xs text-slate-700">
                              Følelse: {reflectionEmoji(filteredSelectedWorkoutLog.reflection?.energyLevel)} · Belastning: {reflectionEmoji(filteredSelectedWorkoutLog.reflection?.difficultyLevel)} · Motivasjon: {reflectionEmoji(filteredSelectedWorkoutLog.reflection?.motivationLevel)}
                            </div>
                            {filteredSelectedWorkoutLog.note ? <div className="mt-2 text-xs text-slate-600">Øktnotat: {filteredSelectedWorkoutLog.note}</div> : null}
                            {filteredSelectedWorkoutLog.reflection?.note ? <div className="mt-1 text-xs text-slate-600">Til PT: {filteredSelectedWorkoutLog.reflection.note}</div> : null}
                          </div>
                          <div className="rounded-2xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium text-slate-800">Kommentar til økten</div>
                              <div className="text-[11px] text-slate-500">Varsler medlemmet</div>
                            </div>
                            <TextArea
                              value={trainerWorkoutCommentDraft}
                              onChange={(event) => setTrainerWorkoutCommentDraft(event.target.value)}
                              placeholder="Skriv en kort kommentar til denne gjennomførte økten"
                              className="mt-3 min-h-[110px]"
                            />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-500">
                                {filteredSelectedWorkoutLog.trainerCommentUpdatedAt ? "Siste kommentar er sendt til medlem." : "Medlem får varsel når du lagrer."}
                              </div>
                              <GradientButton
                                onClick={handleSaveWorkoutComment}
                                className="px-4 py-2 text-xs"
                                disabled={
                                  !updateWorkoutLogTrainerComment ||
                                  trainerWorkoutCommentDraft.trim() === String(filteredSelectedWorkoutLog.trainerComment ?? "").trim()
                                }
                              >
                                Lagre kommentar
                              </GradientButton>
                            </div>
                            {trainerWorkoutCommentStatus ? <div className="mt-2 text-xs text-slate-600">{trainerWorkoutCommentStatus}</div> : null}
                          </div>
                          {filteredSelectedWorkoutLog.results?.length ? (
                            <div className="space-y-2">
                              {filteredSelectedWorkoutLog.results.map((result, index) => (
                                <div key={`${filteredSelectedWorkoutLog.id}-${result.exerciseId}-${index}`} className="rounded-2xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-medium text-slate-800">{result.exerciseName}</div>
                                    <div className={`text-xs font-semibold ${result.completed ? "text-emerald-600" : "text-slate-500"}`}>
                                      {result.completed ? "Fullført" : "Ikke fullført"}
                                    </div>
                                  </div>
                                  <div className="mt-2 grid gap-1.5 text-xs text-slate-600 md:grid-cols-2">
                                    <div className="min-w-0">
                                      Plan: {formatWorkoutResultSetPlanLabel(result, exercises)}
                                    </div>
                                    <div>Utført: {formatWorkoutResultPerformedLabel(result, exercises)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">Ingen detaljerte sett registrert på denne økten.</div>
                          )}
                        </div>
                      ) : (
                        <EmptyState
                          icon="–?"
                          title="Velg en økt for detaljer"
                          description="Trykk på en økt i listen for å se sett, reps og tilbakemelding."
                          className="mt-3 bg-slate-50"
                        />
                      )}
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "nutrition" && selectedMember && selectedMemberNutritionAccess ? (
                  <div className="space-y-3">
                    <NutritionHub
                      mealPlanTabLabel="Ukeplan"
                      avoidances={
                        <MemberFoodAvoidancesPanel
                          memberId={selectedMember.id}
                          personalGoals={selectedMemberProfile?.personalGoals ?? selectedMember.personalGoals ?? ""}
                          onSavePersonalGoals={() => {}}
                          readOnly
                        />
                      }
                      mealPlan={
                        <TrainerMealPlanEditor
                          memberId={selectedMember.id}
                          memberName={selectedMemberProfile?.name ?? selectedMember.name}
                          memberGoal={selectedMemberProfile?.goal ?? selectedMember.goal}
                          memberPersonalGoals={selectedMemberProfile?.personalGoals ?? selectedMember.personalGoals ?? ""}
                          trainerOwnerUserId={currentTrainerOwnerUserId}
                        />
                      }
                    />
                    <MemberQuickFoodLogPanel memberId={selectedMember.id} readOnly />
                  </div>
                ) : null}

                {customerSubTab === "messages" ? (
                  <MotusChat
                    variant="trainer"
                    messages={selectedMessages}
                    viewerRole="trainer"
                    counterpartyName={selectedMemberProfile?.name?.trim() || selectedMember?.name?.trim() || "Kunde"}
                    counterpartyAvatarUrl={selectedMember ? resolveMemberAvatarUrl(selectedMember) : null}
                    locked={selectedMemberMessagesLocked}
                    lockedMessage="Medlem har ikke tilgang til meldinger."
                    composeValue={trainerMessage}
                    onComposeChange={(value) => {
                      setTrainerMessage(value);
                      if (trainerChatSendStatus) setTrainerChatSendStatus(null);
                    }}
                    onSend={() => {
                      if (!selectedMemberId || selectedMemberId === "__template__" || !trainerMessage.trim()) return;
                      void dispatchTrainerMessageToSelectedMember(trainerMessage).then((sent) => {
                        if (sent) setTrainerMessage("");
                      });
                    }}
                    isSending={isSendingTrainerMessage}
                    sendDisabled={!trainerMessage.trim()}
                    composePlaceholder="Skriv melding..."
                    sendStatus={trainerChatSendStatus}
                    messagesContainerRef={trainerMessagesContainerRef}
                    quickActions={trainerChatQuickActions}
                    onToggleReaction={toggleChatMessageReaction}
                    onMarkConversationRead={
                      selectedMemberId && !selectedMemberMessagesLocked
                        ? () => markChatConversationRead(selectedMemberId, "trainer")
                        : undefined
                    }
                    headerExtra={
                      chatShareProgramPickerOpen && selectedPrograms.length > 1 ? (
                        <div className="motus-chat-share-panel">
                          <div className="motus-chat-share-panel-title">Velg program å dele</div>
                          <div className="motus-chat-share-panel-list">
                            {selectedPrograms.map((program) => (
                              <button
                                key={program.id}
                                type="button"
                                className="motus-chat-share-panel-item"
                                onClick={() => void shareSelectedProgramInChat(program)}
                              >
                                <span className="font-medium">{program.title}</span>
                                {program.goal?.trim() ? (
                                  <span className="motus-chat-share-panel-goal">{program.goal.trim()}</span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null
                    }
                  />
                ) : null}
                </TrainerPtDetailPortal>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-dashed bg-slate-50 p-8 text-center text-slate-500">
                <div>Velg en kunde i listen for å se kundekort, programmer og meldinger.</div>
                <div className="mx-auto max-w-sm rounded-xl border bg-white p-4 text-left text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="font-semibold text-slate-700">Forslag til neste steg</div>
                  <ol className="mt-2 space-y-1 text-slate-600">
                    <li>1. Velg en kunde i listen</li>
                    <li>2. Gå til Program og lag en enkel plan</li>
                    <li>3. Send en velkomstmelding</li>
                  </ol>
                </div>
                <OutlineButton onClick={() => setTrainerTab("customers")} className="w-full sm:w-auto">
                  Gå til kunder
                </OutlineButton>
              </div>
            )}
          </Card>
        </div>
        </div>
      ) : null}

      {trainerTab === "programs" ? (
        <TrainerProgramBuilderView
          programsSubTab={programsSubTab}
          onProgramsSubTabChange={setProgramsSubTab}
          templateProgramTitle={templateProgramTitle}
          onTemplateProgramTitleChange={setTemplateProgramTitle}
          programFormImageUrl={programFormImageUrl}
          onProgramFormImageUrlChange={setProgramFormImageUrl}
          onProgramImageUpload={(file) => void handleProgramImageUpload(file)}
          isUploadingProgramImage={isUploadingProgramImage}
          programExercisesDraft={programExercisesDraft}
          editingTemplateProgramId={editingTemplateProgramId}
          exercises={exercises}
          exercisesById={exercisesById}
          visibleProgramExercises={visibleProgramExercises}
          favoriteExerciseIds={favoriteExerciseIds}
          programExerciseSearch={programExerciseSearch}
          onProgramExerciseSearchChange={setProgramExerciseSearch}
          exercisePopularityScores={exercisePopularityScores}
          isDraftDropZoneActive={isDraftDropZoneActive}
          onDraftDropZoneActiveChange={setIsDraftDropZoneActive}
          draggedExerciseIdFromLibrary={draggedExerciseIdFromLibrary}
          onDraggedExerciseIdFromLibraryChange={setDraggedExerciseIdFromLibrary}
          draggedDraftExerciseId={draggedDraftExerciseId}
          onDraggedDraftExerciseIdChange={setDraggedDraftExerciseId}
          dragOverDraftExerciseId={dragOverDraftExerciseId}
          onDragOverDraftExerciseIdChange={setDragOverDraftExerciseId}
          onAddExercise={addExerciseToDraft}
          onMoveDraftExercise={moveDraftExercise}
          onUpdateDraftExercise={updateDraftExercise}
          onRemoveDraftExercise={removeDraftExercise}
          onProgramExercisesDraftChange={setProgramExercisesDraft}
          onSaveTemplate={saveTemplateFromProgramsTab}
          onResetTemplate={resetTemplateProgramBuilder}
          getExercisePreviewSrc={getExercisePreviewSrc}
          getExerciseSketchDataUri={getExerciseSketchDataUri}
          onToggleFavorite={toggleFavoriteExercise}
          activeTemplatePrograms={activeTemplatePrograms}
          expandedTemplateProgramId={expandedTemplateProgramId}
          onExpandedTemplateProgramIdChange={setExpandedTemplateProgramId}
          onStartEditTemplate={startEditTemplateProgram}
          onDeleteTemplate={deleteTemplateProgram}
          programsSubTabConditioningExtras={
            programsSubTab === "conditioning" ? (
              <div className="rounded-xl border bg-white p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">Steg for intervalløkt</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Start med oppvarming, legg inn drag med arbeidstid/pause, og avslutt med nedjogg.
                </p>
                <div className="flex flex-wrap gap-2">
                  <OutlineButton type="button" onClick={startNewCardioTemplateDraft}>
                    Start med oppvarming
                  </OutlineButton>
                  <OutlineButton
                    type="button"
                    onClick={appendCardioDragRow}
                    disabled={programExercisesDraft.length === 0 || hasCardioNedjoggRow(programExercisesDraft)}
                  >
                    Legg til drag
                  </OutlineButton>
                  <OutlineButton
                    type="button"
                    onClick={appendCardioCooldownRow}
                    disabled={programExercisesDraft.length === 0 || hasCardioNedjoggRow(programExercisesDraft)}
                  >
                    Legg til nedjogg
                  </OutlineButton>
                </div>
              </div>
            ) : null
          }
          assignTemplateSection={
            <Card className="mt-4 p-4 space-y-3">
              <div className="font-semibold">Tildel mal til kunde</div>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectBox
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  options={activeMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                />
                <SelectBox
                  value={selectedTemplateProgramId}
                  onChange={setSelectedTemplateProgramId}
                  options={
                    activeTemplatePrograms.length
                      ? activeTemplatePrograms.map((program) => ({ value: program.id, label: program.title }))
                      : [{ value: "", label: emptyTemplatesMessage(programsSubTab) }]
                  }
                />
              </div>
              <GradientButton onClick={assignSelectedTemplateToMember} className="w-full md:w-auto">
                Tildel mal til valgt kunde
              </GradientButton>
              {templateAssignStatus ? (
                <div className="rounded-xl border motus-brand-surface px-3 py-2 text-xs text-emerald-700">
                  {templateAssignStatus}
                </div>
              ) : null}
            </Card>
          }
        />
      ) : null}


      {trainerTab === "calendar" ? (
        <TrainerPeriodPlanCalendar
          members={members}
          periodPlansByMemberId={periodPlansByMemberId}
          logs={logs}
          onOpenClient={(memberId) => {
            setSelectedMemberId(memberId);
            setTrainerTab("customers");
            setCustomerSubTab("programs");
            setCustomerProgramBuilderFocus("period");
          }}
        />
      ) : null}

      {trainerTab === "exerciseBank" ? (
        <TrainerExerciseBankView
          exerciseBankSubTab={exerciseBankSubTab}
          onExerciseBankSubTabChange={setExerciseBankSubTab}
          exercises={exercises}
          visibleExercises={visibleExercises}
          favoriteExerciseIds={favoriteExerciseIds}
          exerciseSearch={exerciseSearch}
          onExerciseSearchChange={setExerciseSearch}
          editingExerciseId={editingExerciseId}
          exerciseFormName={exerciseFormName}
          onExerciseFormNameChange={setExerciseFormName}
          exerciseFormCategory={exerciseFormCategory}
          onExerciseFormCategoryChange={setExerciseFormCategory}
          exerciseFormLevel={exerciseFormLevel}
          onExerciseFormLevelChange={setExerciseFormLevel}
          exerciseFormGroup={exerciseFormGroup}
          onExerciseFormGroupChange={setExerciseFormGroup}
          exerciseFormEquipment={exerciseFormEquipment}
          onExerciseFormEquipmentChange={setExerciseFormEquipment}
          exerciseFormImageUrl={exerciseFormImageUrl}
          onExerciseFormImageUrlChange={setExerciseFormImageUrl}
          exerciseFormDescription={exerciseFormDescription}
          onExerciseFormDescriptionChange={setExerciseFormDescription}
          exerciseFormPrescriptionFields={exerciseFormPrescriptionFields}
          onExerciseFormPrescriptionFieldsChange={setExerciseFormPrescriptionFields}
          exerciseFormCustomField1Label={exerciseFormCustomField1Label}
          exerciseFormCustomField2Label={exerciseFormCustomField2Label}
          onExerciseFormCustomField1LabelChange={setExerciseFormCustomField1Label}
          onExerciseFormCustomField2LabelChange={setExerciseFormCustomField2Label}
          exerciseFormGroupOptions={exerciseFormGroupOptions}
          exerciseFormEquipmentOptions={exerciseFormEquipmentOptions}
          exerciseFormStatus={exerciseFormStatus}
          isUploadingExerciseImage={isUploadingExerciseImage}
          onImageUpload={(file) => void handleExerciseImageUpload(file)}
          onSubmit={submitExerciseForm}
          onReset={resetExerciseForm}
          onStartEdit={startEditExercise}
          onDuplicate={duplicateExercise}
          onDelete={handleDeleteExercise}
          onToggleFavorite={toggleFavoriteExercise}
          getExercisePreviewSrc={getExercisePreviewSrc}
          getExerciseSketchDataUri={getExerciseSketchDataUri}
          exercisePopularityScores={exercisePopularityScores}
        />
      ) : null}

      {trainerTab === "admin" && canAccessAdminTools ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <MotusSectionIcon><ShieldCheck className="h-5 w-5" /></MotusSectionIcon>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Team og tilgang</h2>
              <p className="text-sm text-slate-500">Inviter nye PT-er og hold kundeoversikten ryddig.</p>
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Status</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Tilkobling</div>
                <div className="font-semibold text-slate-800">{isSupabaseConfigured ? "Aktiv" : "Begrenset"}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Brukertype</div>
                <div className="font-semibold text-slate-800">Trener</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Innlogging</div>
                <div className="font-semibold text-slate-800">{isLocalDemoSession ? "Lokal" : "Sikker"}</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Datakvalitet</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Aktive kunder</div>
                <div className="font-semibold text-slate-800">{activeMembers.length}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Arkiverte</div>
                <div className="font-semibold text-slate-800">{archivedMembersForAdmin.length}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Mulige duplikater</div>
                <div className="font-semibold text-slate-800">{adminDuplicateGroupCount ?? "Ukjent"}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Sist oppdatert</div>
                <div className="font-semibold text-slate-800">
                  {lastMemberCleanupAt ? formatDateDdMmYyyy(new Date(lastMemberCleanupAt)) : "Ikke kjørt"}
                </div>
              </div>
            </div>
            {adminHealthStatus ? (
              <StatusMessage
                message={adminHealthStatus}
                tone={adminHealthStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
            <OutlineButton onClick={() => void handleRefreshAdminHealthCheck()} className="w-full md:w-auto" disabled={isRefreshingAdminHealth}>
              {isRefreshingAdminHealth ? "Oppdaterer status..." : "Oppdater status"}
            </OutlineButton>
            <OutlineButton onClick={handleClearLocalChatCache} className="w-full md:w-auto">
              Rydd lokale meldinger
            </OutlineButton>
            {adminCacheStatus ? (
              <StatusMessage
                message={adminCacheStatus}
                tone="success"
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <TextInput value={newTrainerName} onChange={(event) => setNewTrainerName(event.target.value)} placeholder="Navn (valgfritt)" />
            <TextInput value={newTrainerEmail} onChange={(event) => setNewTrainerEmail(event.target.value)} placeholder="E-post til ny PT" />
            <GradientButton onClick={() => void handleInviteTrainer()} disabled={isInvitingTrainer} className="w-full md:w-auto">
              {isInvitingTrainer ? "Sender..." : "Send PT-invitasjon"}
            </GradientButton>
            {inviteTrainerStatus ? (
              <StatusMessage
                message={inviteTrainerStatus}
                tone={inviteTrainerStatus.toLowerCase().includes("sendt") || inviteTrainerStatus.toLowerCase().includes("nylig") ? "success" : "error"}
                className="!rounded-xl !px-3 !py-2"
              />
            ) : null}
          </div>
          {renderNewMemberForm({ id: "admin-legg-til-medlem", title: "Legg til medlem" })}
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Overfør PT- eller Premium-kunde</div>
            <p className="text-xs leading-relaxed text-slate-600">
              Overfør en kunde du eier til en annen PT. Medlemsrader, programmer, treningslogg og chat flyttes til mottaker.
              Felles «Medlem»-kunder kan ikke overføres her.
            </p>
            {reassignableOwnedMembers.length === 0 ? (
              <p className="text-xs text-slate-500">Du har ingen aktive PT- eller Premium-kunder å overføre.</p>
            ) : (
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Kunde</span>
                  <SelectBox
                    value={reassignMemberId}
                    onChange={setReassignMemberId}
                    className="w-full"
                    options={[
                      { value: "", label: "Velg kunde..." },
                      ...reassignableOwnedMembers.map((member) => ({
                        value: member.id,
                        label: memberReassignLabel(member),
                      })),
                    ]}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600">Overfør til PT</span>
                  <SelectBox
                    value={reassignTargetTrainerId}
                    onChange={setReassignTargetTrainerId}
                    className="w-full"
                    disabled={isLoadingTrainerOptions || trainerOptionsForReassign.length === 0}
                    options={[
                      {
                        value: "",
                        label: isLoadingTrainerOptions ? "Laster PT-er..." : "Velg mottaker...",
                      },
                      ...trainerOptionsForReassign.map((trainer) => ({
                        value: trainer.id,
                        label: `${trainer.name} · ${trainer.email}`,
                      })),
                    ]}
                  />
                </label>
                <GradientButton
                  type="button"
                  onClick={handleConfirmReassignMember}
                  disabled={isReassigningMember || !reassignMemberId || !reassignTargetTrainerId}
                  className="w-full md:w-auto"
                >
                  {isReassigningMember ? "Overfører..." : "Overfør til valgt PT"}
                </GradientButton>
              </>
            )}
            {reassignStatus ? (
              <StatusMessage
                message={reassignStatus}
                tone={reassignStatus.toLowerCase().includes("feilet") || reassignStatus.toLowerCase().includes("ugyldig") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Arkiverte kunder</div>
            <p className="text-xs leading-relaxed text-slate-600">
              Kunder du har arkivert vises her. Gjenoppretting gjør dem aktive igjen under Klienter.
            </p>
            {archivedMembersForAdmin.length === 0 ? (
              <p className="text-xs text-slate-500">Ingen arkiverte kunder.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {archivedMembersForAdmin.map((member) => {
                  const email = member.email.trim();
                  const normalizedEmail = email.toLowerCase();
                  const isRestoringThis =
                    isRestoringMember && restoringArchivedEmail === normalizedEmail;
                  return (
                    <li
                      key={member.id}
                      className="flex flex-col gap-2 rounded-xl border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{member.name}</div>
                        <div className="text-xs text-slate-500 truncate">{email}</div>
                      </div>
                      <OutlineButton
                        onClick={() => void handleRestoreMember(email)}
                        disabled={isRestoringMember}
                        className="shrink-0 w-full sm:w-auto"
                      >
                        {isRestoringThis ? "Gjenoppretter..." : "Gjenopprett"}
                      </OutlineButton>
                    </li>
                  );
                })}
              </ul>
            )}
            {restoreStatus ? (
              <StatusMessage
                message={restoreStatus}
                tone={restoreStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Gjenopprett slettet klient</div>
            <TextInput value={restoreEmail} onChange={(e) => setRestoreEmail(e.target.value)} placeholder="E-post til slettet klient" />
            {restoreStatus ? (
              <StatusMessage
                message={restoreStatus}
                tone={restoreStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
            <OutlineButton onClick={() => void handleRestoreMember()} className="w-full md:w-auto" disabled={isRestoringMember}>
              {isRestoringMember ? "Gjenoppretter..." : "Gjenopprett klient"}
            </OutlineButton>
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Reparer medlemskobling</div>
            <p className="text-xs leading-relaxed text-slate-600">
              Kun nødvendig hvis medlem har fått invitasjon, men ikke kommer inn på riktig konto (feil e-post, duplikat-rad eller gammel innlogging).
              Kobler Supabase-brukeren til valgt kundekort på nytt. Be medlemmet logge ut og inn etterpå.
            </p>
            {selectedMember ? (
              <OutlineButton
                onClick={() => void handleRepairSelectedMemberLink()}
                disabled={isRepairingMemberLink}
                className="w-full md:w-auto"
              >
                {isRepairingMemberLink ? "Reparerer kobling..." : `Reparer kobling for ${selectedMember.name}`}
              </OutlineButton>
            ) : (
              <p className="text-xs text-slate-500">Velg kunden under Klienter først.</p>
            )}
            {memberLinkStatus ? (
              <StatusMessage
                message={memberLinkStatus}
                tone={memberLinkStatus.toLowerCase().includes("feilet") || memberLinkStatus.toLowerCase().includes("kan ikke") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3" style={{ borderColor: "rgba(244,63,94,0.25)" }}>
            <div className="text-sm font-semibold text-rose-950">Slett kunde permanent</div>
            <p className="text-xs leading-relaxed text-rose-900/90">
              Sletter all data og kan ikke angres. Bruk «Arkiver kunde» under Klienter i stedet hvis kunden bare skal skjules midlertidig.
            </p>
            {selectedMember ? (
              <DangerButton onClick={() => handleDeleteMember(selectedMember.id)} className="w-full md:w-auto">
                Slett {selectedMember.name} permanent
              </DangerButton>
            ) : (
              <p className="text-xs text-rose-800/80">Velg kunden under Klienter først.</p>
            )}
          </div>
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Slå sammen duplikatkunder</div>
            <div className="text-xs text-slate-600">
              Kun når flere medlemsrader har helt identisk e-postadresse. Ulike adresser som bare inneholder «lene»
              (f.eks. leneruud@msn.com, lene.norex@gmail.com, ruudlene@gmail.com) slås ikke sammen. Inaktive rader kan
              gjenopprettes under Admin. Kjør dry-run og bekreftelse først.
            </div>
            {memberDedupeStatus ? (
              <StatusMessage
                message={memberDedupeStatus}
                tone={memberDedupeStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
            {memberDedupePreviewGroups.length > 0 ? (
              <div className="space-y-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-xs font-semibold text-slate-700">
                  Forhåndsvisning ({memberDedupePreviewGroups.length} gruppe{memberDedupePreviewGroups.length === 1 ? "" : "r"})
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {memberDedupePreviewGroups.map((group) => {
                    const rows =
                      group.members && group.members.length
                        ? group.members
                        : [
                            ...(group.canonicalMember ? [{ ...group.canonicalMember, action: "keep" }] : []),
                            ...(group.duplicateMembers ?? []).map((member) => ({ ...member, action: "deactivate" })),
                          ];
                    return (
                      <div key={`${group.email}:${group.canonicalId}`} className="rounded-xl border bg-slate-50 p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="text-xs font-semibold text-slate-800">{group.email || "Uten e-post"}</div>
                        <div className="mt-2 space-y-2">
                          {rows.map((row) => {
                            const keep = row.action === "keep" || row.id === group.canonicalId;
                            return (
                              <div key={row.id} className="flex flex-col gap-1 rounded-lg border bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold text-slate-800">{row.name?.trim() || "Uten navn"}</div>
                                  <div className="truncate text-[11px] text-slate-500">
                                    ID: {row.id} · {row.customerType || "Ukjent type"} · {row.membershipType || "Ukjent medlemskap"} · {row.isActive === false ? "Inaktiv" : "Aktiv"}
                                  </div>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${keep ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                  {keep ? "Beholdes" : "Settes inaktiv"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <OutlineButton onClick={() => void handleRunSafeMemberCleanup()} className="w-full md:w-auto" disabled={isRunningMemberDedupe}>
              {isRunningMemberDedupe ? "Sjekker..." : "Sjekk duplikater"}
            </OutlineButton>
            {memberDedupePreviewGroups.length > 0 ? (
              <DangerButton onClick={handleApplyPreviewedMemberDedupeCleanup} className="w-full md:w-auto" disabled={isRunningMemberDedupe}>
                Gjennomfør opprydding
              </DangerButton>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
    <LiveWorkoutSessionModal
      variant="trainer"
      workoutMode={workoutMode}
      activeProgram={activeTrainerWorkoutProgram}
      exercises={exercises}
      trainerSubtitle={selectedMemberProfile?.name ?? selectedMember?.name ?? ""}
      updateWorkoutExerciseResult={updateWorkoutExerciseResult}
      replaceWorkoutExerciseGroup={replaceWorkoutExerciseGroup}
      appendWorkoutSetForProgramExercise={appendWorkoutSetForProgramExercise}
      deferWorkoutExerciseGroup={deferWorkoutExerciseGroup}
      updateWorkoutModeNote={updateWorkoutModeNote}
      updateWorkoutExerciseNote={updateWorkoutExerciseNote}
      finishWorkoutMode={handleFinishTrainerLiveWorkout}
      cancelWorkoutMode={cancelWorkoutMode}
    />
    <ConfirmDialog
      open={Boolean(confirmDialog)}
      title={confirmDialog?.title ?? ""}
      message={confirmDialog?.message ?? ""}
      confirmLabel={confirmDialog?.confirmLabel}
      cancelLabel={confirmDialog?.cancelLabel}
      showCancel={confirmDialog?.showCancel}
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
