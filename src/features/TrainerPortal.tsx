import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, ShieldCheck, Star, Users } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import { isLikelyValidBirthDate, isValidEmail, normalizeBirthDate, normalizePhone } from "../app/validators";
import { uid } from "../app/storage";
import { Card, GradientButton, OutlineButton, PillButton, SelectBox, StatCard, StatusMessage, TextArea, TextInput } from "../app/ui";
import type { CreateMemberInput, UpdateMemberInput } from "../services/appRepository";
import type { InviteMemberResult, InviteTrainerResult } from "../services/supabaseAuth";
import type {
  ChatMessage,
  CustomerSubTab,
  Exercise,
  Member,
  PeriodSchedulePlan,
  ProgramExercise,
  TrainerTab,
  TrainingProgram,
  WeekdayPlanKey,
  WeeklyDayPlan,
  WeeklySchedulePlan,
  WorkoutLog,
} from "../app/types";
import {
  deleteMemberPeriodPlanByPlanId,
  upsertMemberPeriodPlansForTrainer,
} from "../services/supabaseRepository";
import { isSupabaseConfigured, supabaseClient } from "../services/supabaseClient";

type TrainerPortalProps = {
  members: Member[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  exercises: Exercise[];
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  trainerTab: TrainerTab;
  setTrainerTab: (tab: TrainerTab) => void;
  addMember: (input: CreateMemberInput) => void;
  deactivateMember: (memberId: string) => void;
  deleteMember: (memberId: string) => void;
  updateMember: (input: UpdateMemberInput) => void;
  markMemberInvited: (memberId: string, invitedAtIso?: string) => void;
  inviteMember: (email: string, memberId: string) => Promise<InviteMemberResult>;
  inviteTrainer: (email: string) => Promise<InviteTrainerResult>;
  restoreMemberByEmail: (email: string) => Promise<{ ok: boolean; message: string }>;
  restoreMissingTestData: () => Promise<{ ok: boolean; message: string }>;
  restoreOriginalExerciseBank: () => Promise<{ ok: boolean; message: string }>;
  saveProgramForMember: (input: { id?: string; title: string; goal: string; notes: string; memberId: string; exercises: ProgramExercise[] }) => void;
  deleteProgramById: (programId: string) => void;
  sendTrainerMessage: (memberId: string, text: string) => void;
  saveExercise: (input: {
    id?: string;
    name: string;
    category: Exercise["category"];
    group: string;
    equipment: string;
    level: Exercise["level"];
    description: string;
    imageUrl?: string;
  }) => void;
  deleteExercise: (exerciseId: string) => void;
  openCustomerMessagesSignal?: number;
  memberAvatarById?: Record<string, string>;
  setMemberAvatarUrlForMember?: (memberId: string, avatarUrl: string) => void;
  isLocalDemoSession?: boolean;
  /** Synket fra Supabase ved hydrering (per medlem, inkl. tom liste). */
  remoteTrainerPeriodPlansByMemberId?: Record<string, PeriodSchedulePlan[]>;
};

type FollowUpDetail = {
  at: string;
  method: "melding" | "telefon" | "mote";
  note: string;
};

type IntervalPreset = {
  id: string;
  name: string;
  description: string;
  steps: Array<{ name: string; minutes: number; speed: string; incline: string; restSeconds: string }>;
};

const MEMBER_AVATAR_BUCKET = "exercise-images";
const MEMBER_AVATAR_PREFIX = "member-avatars";
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

function parseLogDateMs(value: string): number {
  if (!value) return 0;
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.getTime();
  const parts = value.split(".");
  if (parts.length < 3) return 0;
  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);
  const parsed = new Date(year, month, day);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function TrainerPortal(props: TrainerPortalProps) {
  const EXERCISE_IMAGE_BUCKET = "exercise-images";
  const MAX_EXERCISE_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_EXERCISE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const {
    members,
    programs,
    logs,
    messages,
    exercises,
    selectedMemberId,
    setSelectedMemberId,
    trainerTab,
    setTrainerTab,
    addMember,
    deactivateMember,
    deleteMember,
    updateMember,
    markMemberInvited,
    inviteMember,
    inviteTrainer,
    restoreMemberByEmail,
    restoreMissingTestData,
    restoreOriginalExerciseBank,
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
    saveExercise,
    deleteExercise,
    openCustomerMessagesSignal = 0,
    memberAvatarById = {},
    setMemberAvatarUrlForMember,
    isLocalDemoSession = false,
    remoteTrainerPeriodPlansByMemberId = {},
  } = props;

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [customerSubTab, setCustomerSubTab] = useState<CustomerSubTab>("overview");
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
  const [programExerciseCategoryFilter, setProgramExerciseCategoryFilter] = useState<"all" | "Styrke" | "Kondisjon">("all");
  const [programExerciseGroupFilter, setProgramExerciseGroupFilter] = useState("all");
  const intervalPresets = useMemo<IntervalPreset[]>(
    () => [
      {
        id: "classic-4x4",
        name: "4x4 klassisk",
        description: "10 min oppvarming, 4x4 min med 3 min pause, 5 min nedjogg.",
        steps: [
          { name: "Oppvarming", minutes: 10, speed: "7", incline: "1", restSeconds: "0" },
          { name: "Drag 1", minutes: 4, speed: "13", incline: "1.5", restSeconds: "180" },
          { name: "Drag 2", minutes: 4, speed: "13", incline: "1.5", restSeconds: "180" },
          { name: "Drag 3", minutes: 4, speed: "13", incline: "1.5", restSeconds: "180" },
          { name: "Drag 4", minutes: 4, speed: "13", incline: "1.5", restSeconds: "0" },
          { name: "Nedjogg", minutes: 5, speed: "5.5", incline: "0", restSeconds: "0" },
        ],
      },
      {
        id: "tempo-30",
        name: "Tempo 30",
        description: "8 min oppvarming, 3 tempo-drag, 5 min nedjogg.",
        steps: [
          { name: "Oppvarming", minutes: 8, speed: "7", incline: "1", restSeconds: "0" },
          { name: "Tempo 1", minutes: 3, speed: "11", incline: "1", restSeconds: "90" },
          { name: "Tempo 2", minutes: 4, speed: "11.5", incline: "1", restSeconds: "90" },
          { name: "Tempo 3", minutes: 5, speed: "12", incline: "1", restSeconds: "0" },
          { name: "Nedjogg", minutes: 5, speed: "5.5", incline: "0", restSeconds: "0" },
        ],
      },
      {
        id: "short-hiit-20",
        name: "Kort HIIT 20",
        description: "6 min oppvarming, 10 korte drag, 4 min nedjogg.",
        steps: [
          { name: "Oppvarming", minutes: 6, speed: "7", incline: "1", restSeconds: "0" },
          { name: "10x kortintervall", minutes: 20, speed: "13-16", incline: "1", restSeconds: "0" },
          { name: "Nedjogg", minutes: 4, speed: "5.5", incline: "0", restSeconds: "0" },
        ],
      },
    ],
    [],
  );
  const [selectedIntervalPresetId, setSelectedIntervalPresetId] = useState("classic-4x4");
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
  const [periodPlanStartDateDraft, setPeriodPlanStartDateDraft] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodPlanWeeksDraft, setPeriodPlanWeeksDraft] = useState("4");
  const [periodWeeklyPlansDraft, setPeriodWeeklyPlansDraft] = useState<WeeklySchedulePlan[]>([
    { id: uid("period-week"), weekNumber: 1, days: createEmptyWeeklyDayPlan() },
  ]);
  const [activePeriodWeekId, setActivePeriodWeekId] = useState<string>(periodWeeklyPlansDraft[0]?.id ?? "");
  const [matchingWeekIdsDraft, setMatchingWeekIdsDraft] = useState<string[]>([]);
  const [periodPlanStatus, setPeriodPlanStatus] = useState<string | null>(null);
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
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberGoal, setNewMemberGoal] = useState("");
  const [newMemberFocus, setNewMemberFocus] = useState("");
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [pendingProgramMemberEmail, setPendingProgramMemberEmail] = useState<string | null>(null);
  const [pendingInviteMemberEmail, setPendingInviteMemberEmail] = useState<string | null>(null);
  const [newTrainerEmail, setNewTrainerEmail] = useState("");
  const [newTrainerName, setNewTrainerName] = useState("");
  const [inviteTrainerStatus, setInviteTrainerStatus] = useState<string | null>(null);
  const [isInvitingTrainer, setIsInvitingTrainer] = useState(false);
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("motus.trainer.memberSearch") ?? "";
  });
  const [memberFilter, setMemberFilter] = useState<"all" | "followUp" | "invited" | "notInvited">(() => {
    if (typeof window === "undefined") return "all";
    const stored = window.localStorage.getItem("motus.trainer.memberFilter");
    if (stored === "followUp" || stored === "invited" || stored === "notInvited" || stored === "all") {
      return stored;
    }
    return "all";
  });
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "PT-kunde" | "Premium-kunde">("all");
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
  const [isEditingCustomerCard, setIsEditingCustomerCard] = useState(false);
  const [memberEditStatus, setMemberEditStatus] = useState<string | null>(null);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isRestoringMember, setIsRestoringMember] = useState(false);
  const [memberDedupeStatus, setMemberDedupeStatus] = useState<string | null>(null);
  const [isRunningMemberDedupe, setIsRunningMemberDedupe] = useState(false);
  const [adminHealthStatus, setAdminHealthStatus] = useState<string | null>(null);
  const [isRefreshingAdminHealth, setIsRefreshingAdminHealth] = useState(false);
  const [adminDuplicateGroupCount, setAdminDuplicateGroupCount] = useState<number | null>(null);
  const [lastMemberCleanupAt, setLastMemberCleanupAt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("motus.admin.lastMemberCleanupAt") ?? "";
  });
  const [restoreDataStatus, setRestoreDataStatus] = useState<string | null>(null);
  const [isRestoringTestData, setIsRestoringTestData] = useState(false);
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
  const [followUpDetailsByMemberId, setFollowUpDetailsByMemberId] = useState<Record<string, FollowUpDetail>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("motus.trainer.followUpDetailsByMemberId");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object") return {};
      const entries = Object.entries(parsed)
        .map(([key, value]) => {
          if (!key || !value || typeof value !== "object") return null;
          const row = value as Partial<FollowUpDetail>;
          const at = String(row.at ?? "");
          const methodRaw = String(row.method ?? "");
          const note = String(row.note ?? "");
          if (!at) return null;
          const method: FollowUpDetail["method"] =
            methodRaw === "telefon" || methodRaw === "mote" ? methodRaw : "melding";
          return [key, { at, method, note }] as const;
        })
        .filter(Boolean) as Array<readonly [string, FollowUpDetail]>;
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  });
  const [followUpMethodDraft, setFollowUpMethodDraft] = useState<FollowUpDetail["method"]>("melding");
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [followUpSaveStatus, setFollowUpSaveStatus] = useState<string | null>(null);
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
  const [isUploadingExerciseImage, setIsUploadingExerciseImage] = useState(false);
  const [exerciseFormStatus, setExerciseFormStatus] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [compactExerciseBank, setCompactExerciseBank] = useState(true);
  const [showCustomerToolsMobile, setShowCustomerToolsMobile] = useState(false);
  const [workoutDateRangeFilter, setWorkoutDateRangeFilter] = useState<"7d" | "30d" | "all">("all");
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState<"all" | "program" | "group">("all");
  const [workoutSearchQuery, setWorkoutSearchQuery] = useState("");
  const [workoutSortOrder, setWorkoutSortOrder] = useState<"newest" | "oldest">("newest");
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  function getMemberIdentityKey(member: Member): string {
    const emailKey = member.email.trim().toLowerCase();
    const nameKey = member.name.trim().toLowerCase();
    return emailKey || `name:${nameKey}`;
  }
  const deduplicatedMembers = useMemo(() => {
    function memberScore(member: Member): number {
      let score = 0;
      if (member.isActive !== false) score += 8;
      if (member.invitedAt) score += 2;
      if (member.customerType === "PT-kunde") score += 1;
      if (member.membershipType === "Premium") score += 1;
      const days = Number(member.daysSinceActivity || "9999");
      if (Number.isFinite(days)) {
        score += Math.max(0, 100 - Math.min(100, days));
      }
      return score;
    }

    const byIdentity = new Map<string, Member>();
    members.forEach((member) => {
      const identityKey = getMemberIdentityKey(member);
      const existing = byIdentity.get(identityKey);
      if (!existing) {
        byIdentity.set(identityKey, member);
        return;
      }
      if (memberScore(member) > memberScore(existing)) {
        byIdentity.set(identityKey, member);
      }
    });
    return Array.from(byIdentity.values());
  }, [members]);
  const visibleMembers = showInactiveMembers
    ? deduplicatedMembers
    : deduplicatedMembers.filter((member) => member.isActive !== false);
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
        if (memberFilter === "followUp") return Number(member.daysSinceActivity || "0") >= 7;
        if (memberFilter === "invited") return Boolean(member.invitedAt);
        if (memberFilter === "notInvited") return !member.invitedAt;
        return true;
      });
  }, [visibleMembers, memberSearch, memberFilter, customerTypeFilter]);
  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      if (memberSort === "nameAsc") return a.name.localeCompare(b.name, "no");
      if (memberSort === "nameDesc") return b.name.localeCompare(a.name, "no");
      const aDays = Number(a.daysSinceActivity || "0");
      const bDays = Number(b.daysSinceActivity || "0");
      if (aDays !== bDays) return aDays - bDays;
      return a.name.localeCompare(b.name, "no");
    });
  }, [filteredMembers, memberSort]);
  const memberAvatarByEmail = useMemo(() => {
    const byEmail: Record<string, string> = {};
    const byName: Record<string, string> = {};
    const byIdentity: Record<string, string> = {};
    members.forEach((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      const normalizedName = member.name.trim().toLowerCase();
      const identityKey = getMemberIdentityKey(member);
      if (normalizedEmail) {
        const emailKeyAvatar = memberAvatarById[`email:${normalizedEmail}`];
        if (emailKeyAvatar && !byEmail[normalizedEmail]) {
          byEmail[normalizedEmail] = emailKeyAvatar;
          if (!byIdentity[identityKey]) byIdentity[identityKey] = emailKeyAvatar;
        }
      }
      if (normalizedName) {
        const nameKeyAvatar = memberAvatarById[`name:${normalizedName}`];
        if (nameKeyAvatar && !byName[normalizedName]) {
          byName[normalizedName] = nameKeyAvatar;
          if (!byIdentity[identityKey]) byIdentity[identityKey] = nameKeyAvatar;
        }
      }
      const avatarUrl = memberAvatarById[member.id];
      if (normalizedEmail && avatarUrl && !byEmail[normalizedEmail]) {
        byEmail[normalizedEmail] = avatarUrl;
        if (!byIdentity[identityKey]) byIdentity[identityKey] = avatarUrl;
      }
      if (normalizedName && avatarUrl && !byName[normalizedName]) {
        byName[normalizedName] = avatarUrl;
        if (!byIdentity[identityKey]) byIdentity[identityKey] = avatarUrl;
      }
    });
    return { byEmail, byName, byIdentity };
  }, [members, memberAvatarById]);
  const avatarCacheBust = useMemo(() => String(Date.now()), []);
  function resolveMemberAvatarUrl(member: Member): string {
    const direct = memberAvatarById[member.id];
    if (direct) return direct;
    const normalizedEmail = member.email.trim().toLowerCase();
    if (normalizedEmail) {
      const byEmail = memberAvatarByEmail.byEmail[normalizedEmail];
      if (byEmail) return byEmail;
    }
    const normalizedName = member.name.trim().toLowerCase();
    if (normalizedName) {
      const byName = memberAvatarByEmail.byName[normalizedName];
      if (byName) return byName;
    }
    const byIdentity = memberAvatarByEmail.byIdentity[getMemberIdentityKey(member)];
    if (byIdentity) return byIdentity;
    if (!supabaseClient || !normalizedEmail || !normalizedEmail.includes("@")) return "";
    const encodedEmail = encodeEmailForPath(normalizedEmail);
    if (encodedEmail) {
      const path = `${MEMBER_AVATAR_PREFIX}/email-${encodedEmail}.jpg`;
      const { data } = supabaseClient.storage.from(MEMBER_AVATAR_BUCKET).getPublicUrl(path);
      if (data.publicUrl) return `${data.publicUrl}?v=${avatarCacheBust}`;
    }
    const encodedName = encodeNameForPath(member.name);
    if (!encodedName) return "";
    const namePath = `${MEMBER_AVATAR_PREFIX}/name-${encodedName}.jpg`;
    const { data: nameData } = supabaseClient.storage.from(MEMBER_AVATAR_BUCKET).getPublicUrl(namePath);
    return nameData.publicUrl ? `${nameData.publicUrl}?v=${avatarCacheBust}` : "";
  }
  const selectedMemberRelatedIds = useMemo(() => {
    if (selectedMemberId === "__template__") return [];
    if (!selectedMemberId) return [];
    const selected = members.find((member) => member.id === selectedMemberId);
    if (!selected) return [selectedMemberId];
    const normalizedEmail = selected.email.trim().toLowerCase();
    const normalizedName = selected.name.trim().toLowerCase();
    const byEmailIds = normalizedEmail
      ? members
          .filter((member) => member.email.trim().toLowerCase() === normalizedEmail)
          .map((member) => member.id)
      : [];
    // Legacy data may contain duplicated member rows where email changed between IDs.
    // Include name matches so trainer still sees historical logs/programs.
    const byNameIds = normalizedName
      ? members
          .filter((member) => member.name.trim().toLowerCase() === normalizedName)
          .map((member) => member.id)
      : [];
    const merged = Array.from(new Set([...byEmailIds, ...byNameIds, selectedMemberId]));
    return merged.length ? merged : [selectedMemberId];
  }, [members, selectedMemberId]);
  const selectedMemberRelatedIdSet = useMemo(() => new Set(selectedMemberRelatedIds), [selectedMemberRelatedIds]);
  const selectedPrograms = useMemo(
    () =>
      programs
        .filter((program) => selectedMemberRelatedIdSet.has(program.memberId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [programs, selectedMemberRelatedIdSet]
  );
  const selectedPeriodPlans = useMemo(() => {
    if (!selectedMemberRelatedIds.length) return [] as PeriodSchedulePlan[];
    const merged = selectedMemberRelatedIds.flatMap((memberId) => periodPlansByMemberId[memberId] ?? []);
    const deduplicated = new Map<string, PeriodSchedulePlan>();
    merged.forEach((plan) => {
      if (!deduplicated.has(plan.id)) {
        deduplicated.set(plan.id, plan);
      }
    });
    return Array.from(deduplicated.values());
  }, [periodPlansByMemberId, selectedMemberRelatedIds]);
  const templatePrograms = programs.filter((program) => program.memberId === "__template__");
  const selectedLogs = useMemo(() => {
    return logs
      .filter((log) => selectedMemberRelatedIdSet.has(log.memberId))
      .sort((a, b) => parseLogDateMs(b.date) - parseLogDateMs(a.date));
  }, [logs, selectedMemberRelatedIdSet]);
  const selectedMessages = useMemo(
    () =>
      messages.filter((message) =>
        selectedMemberRelatedIdSet.has(message.memberId)
      ),
    [messages, selectedMemberRelatedIdSet]
  );
  function resolveLatestFollowUpDetail(memberIds: string[]): FollowUpDetail | null {
    const details = memberIds
      .map((id) => followUpDetailsByMemberId[id])
      .filter((item): item is FollowUpDetail => Boolean(item));
    if (!details.length) return null;
    return [...details].sort((a, b) => b.at.localeCompare(a.at))[0];
  }
  const selectedMemberLatestFollowUp = useMemo(
    () => resolveLatestFollowUpDetail(selectedMemberRelatedIds),
    [selectedMemberRelatedIds, followUpDetailsByMemberId]
  );
  const latestCompletedLog = selectedLogs.find((log) => log.status === "Fullført") ?? null;
  const filteredWorkoutLogs = useMemo(() => {
    const now = Date.now();
    const query = workoutSearchQuery.trim().toLowerCase();
    const withParsedDate = selectedLogs.map((log) => ({ log, dateMs: parseLogDateMs(log.date) }));
    const filtered = withParsedDate.filter(({ log, dateMs }) => {
      if (workoutDateRangeFilter !== "all" && dateMs > 0) {
        const maxAgeMs = workoutDateRangeFilter === "7d" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        if (now - dateMs > maxAgeMs) return false;
      }
      const isGroupWorkout = log.programTitle.trim().toLowerCase().startsWith("gruppetime:");
      if (workoutTypeFilter === "group" && !isGroupWorkout) return false;
      if (workoutTypeFilter === "program" && isGroupWorkout) return false;
      if (query) {
        const haystack = `${log.programTitle} ${log.note ?? ""} ${log.reflection?.note ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    filtered.sort((a, b) => (workoutSortOrder === "newest" ? b.dateMs - a.dateMs : a.dateMs - b.dateMs));
    return filtered.map((entry) => entry.log);
  }, [selectedLogs, workoutDateRangeFilter, workoutTypeFilter, workoutSearchQuery, workoutSortOrder]);
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
  function reflectionEmoji(level?: 1 | 2 | 3 | 4 | 5): string {
    if (!level) return "—";
    if (level <= 1) return "🥳";
    if (level === 2) return "🙂";
    if (level === 3) return "😌";
    if (level === 4) return "😮‍💨";
    return "🥵";
  }
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = exercises.filter((exercise) => {
      const categoryOk = exerciseCategoryFilter === "all" || exercise.category === exerciseCategoryFilter;
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
      return a.name.localeCompare(b.name, "no");
    });
  }, [exercises, exerciseSearch, exerciseCategoryFilter, favoriteExerciseIds]);
  const programExerciseGroupOptions = useMemo(() => {
    const groups = Array.from(new Set(exercises.map((exercise) => exercise.group.trim()).filter(Boolean)));
    return groups.sort((a, b) => a.localeCompare(b, "no"));
  }, [exercises]);
  const exerciseFormGroupOptions = useMemo(() => {
    const merged = new Set(programExerciseGroupOptions);
    const currentDraftGroup = exerciseFormGroup.trim();
    if (currentDraftGroup) merged.add(currentDraftGroup);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "no"));
  }, [programExerciseGroupOptions, exerciseFormGroup]);
  const visibleProgramExercises = useMemo(() => {
    const query = programExerciseSearch.trim().toLowerCase();
    const filtered = exercises.filter((exercise) => {
      if (programExerciseCategoryFilter !== "all" && exercise.category !== programExerciseCategoryFilter) return false;
      if (programExerciseGroupFilter !== "all" && exercise.group !== programExerciseGroupFilter) return false;
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
      return a.name.localeCompare(b.name, "no");
    });
  }, [exercises, programExerciseSearch, programExerciseCategoryFilter, programExerciseGroupFilter, favoriteExerciseIds]);
  const exercisesById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const activePeriodWeek = useMemo(
    () => periodWeeklyPlansDraft.find((week) => week.id === activePeriodWeekId) ?? periodWeeklyPlansDraft[0] ?? null,
    [periodWeeklyPlansDraft, activePeriodWeekId],
  );
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
        next[memberId] = remoteTrainerPeriodPlansByMemberId[memberId] ?? [];
      });
      return next;
    });
  }, [isSupabaseConfigured, isLocalDemoSession, remoteTrainerPeriodPlansByMemberId]);

  useEffect(() => {
    setMatchingWeekIdsDraft((prev) => prev.filter((id) => periodWeeklyPlansDraft.some((week) => week.id === id)));
  }, [periodWeeklyPlansDraft]);

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
    if (!templatePrograms.length) {
      setSelectedTemplateProgramId("");
      return;
    }
    if (!templatePrograms.some((program) => program.id === selectedTemplateProgramId)) {
      setSelectedTemplateProgramId(templatePrograms[0].id);
    }
  }, [templatePrograms, selectedTemplateProgramId]);

  useEffect(() => {
    if (!pendingProgramMemberEmail) return;
    const createdMember = members.find((member) => member.email.toLowerCase() === pendingProgramMemberEmail.toLowerCase());
    if (!createdMember) return;
    setSelectedMemberId(createdMember.id);
    setTrainerTab("customers");
    setCustomerSubTab("programs");
    setPendingProgramMemberEmail(null);
  }, [pendingProgramMemberEmail, members, setSelectedMemberId, setTrainerTab]);

  useEffect(() => {
    if (!pendingInviteMemberEmail) return;
    const createdMember = members.find((member) => member.email.toLowerCase() === pendingInviteMemberEmail.toLowerCase());
    if (!createdMember) return;

    async function sendInviteForNewMember() {
      setSelectedMemberId(createdMember.id);
      setInviteStatus("Sender invitasjon...");
      const result = await inviteMember(createdMember.email.toLowerCase(), createdMember.id);
      if (result.ok) {
        markMemberInvited(createdMember.id, new Date().toISOString());
      }
      setInviteStatus(result.message);
      setTrainerTab("customers");
      setCustomerSubTab("overview");
      setPendingInviteMemberEmail(null);
    }

    void sendInviteForNewMember();
  }, [pendingInviteMemberEmail, members, inviteMember, markMemberInvited, setSelectedMemberId, setTrainerTab]);

  useEffect(() => {
    if (!editingExerciseId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`inline-exercise-edit-${editingExerciseId}`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingExerciseId]);

  useEffect(() => {
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    setCustomerSubTab("messages");
  }, [openCustomerMessagesSignal, selectedMemberId]);

  useEffect(() => {
    if (!filteredWorkoutLogs.length) {
      setSelectedWorkoutLogId(null);
      return;
    }
    if (!selectedWorkoutLogId || !filteredWorkoutLogs.some((log) => log.id === selectedWorkoutLogId)) {
      setSelectedWorkoutLogId(filteredWorkoutLogs[0].id);
    }
  }, [filteredWorkoutLogs, selectedWorkoutLogId]);

  useEffect(() => {
    // Reset workout list controls when changing customer so prior filters/search do not hide fresh logs.
    setWorkoutDateRangeFilter("all");
    setWorkoutTypeFilter("all");
    setWorkoutSearchQuery("");
    setWorkoutSortOrder("newest");
    setPeriodPlanStatus(null);
    setPeriodPlanTitleDraft("Periodeplan");
    setPeriodPlanNotesDraft("");
    setPeriodPlanStartDateDraft(new Date().toISOString().slice(0, 10));
    setPeriodPlanWeeksDraft("4");
    const firstWeek = { id: uid("period-week"), weekNumber: 1, days: createEmptyWeeklyDayPlan() };
    setPeriodWeeklyPlansDraft([firstWeek]);
    setActivePeriodWeekId(firstWeek.id);
    setMatchingWeekIdsDraft([]);
  }, [selectedMemberId]);

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
  }

  useEffect(() => {
    resetMemberEditDraftFromSelected(selectedMember);
    setMemberEditStatus(null);
    setIsEditingCustomerCard(false);
    // Only reset edit mode when selected customer actually changes.
    // Background hydration can replace member objects and should not close the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId]);

  function formatInvitedAt(iso: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return formatDateDdMmYyyy(date);
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
    const isCardio = exercise.category === "Kondisjon";
    const isTreadmill = exercise.equipment.trim().toLowerCase().includes("tredem");
    setProgramExercisesDraft((prev) => [
      ...prev,
      {
        id: uid("draft-ex"),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: "3",
        reps: isCardio ? "" : "10",
        weight: isCardio ? "" : "0",
        durationMinutes: isCardio ? "20" : "",
        speed: isTreadmill ? "8" : "",
        incline: isTreadmill ? "1" : "",
        restSeconds: "90",
        notes: "",
      },
    ]);
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
    setProgramExercisesDraft((prev) => prev.filter((item) => item.id !== id));
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

  function startEditProgram(program: TrainingProgram) {
    setEditingProgramId(program.id);
    setProgramTitle(program.title);
    setProgramGoal(program.goal);
    setProgramNotes(program.notes);
    setProgramExercisesDraft(program.exercises.map((exercise) => ({ ...exercise })));
    setCustomerSubTab("programs");
    setTrainerTab("customers");
  }

  function resetProgramBuilder() {
    setEditingProgramId(null);
    setProgramTitle("Nytt treningsprogram");
    setProgramGoal("");
    setProgramNotes("");
    setProgramExercisesDraft([]);
  }

  function generateIntervalTemplateDraft() {
    const preset = intervalPresets.find((item) => item.id === selectedIntervalPresetId) ?? intervalPresets[0];
    if (!preset) return;
    const treadmillExercise =
      exercises.find((exercise) => exercise.equipment.trim().toLowerCase().includes("tredem")) ??
      exercises.find((exercise) => exercise.category === "Kondisjon") ??
      exercises[0];
    if (!treadmillExercise) {
      setTemplateAssignStatus("Fant ingen kondisjonsøvelse å bygge nedtellingsmal fra.");
      return;
    }
    const draftExercises: ProgramExercise[] = preset.steps.map((step) => ({
      id: uid("draft-ex"),
      exerciseId: treadmillExercise.id,
      exerciseName: step.name,
      sets: "1",
      reps: "",
      weight: "",
      durationMinutes: String(step.minutes),
      speed: step.speed,
      incline: step.incline,
      restSeconds: step.restSeconds,
      notes: "Intervallsteg",
    }));
    setTemplateProgramTitle(`Intervall: ${preset.name}`);
    setProgramExercisesDraft(draftExercises);
    setEditingTemplateProgramId(null);
    setTemplateAssignStatus(`Kondisjonsmal klar: ${preset.name}. Lagre malen og tildel kunden.`);
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
    setPeriodWeeklyPlansDraft((prev) =>
      prev.map((week) =>
        week.id === activePeriodWeek.id
          ? {
              ...week,
              days: {
                ...week.days,
                [day]: value,
              },
            }
          : week,
      ),
    );
  }

  function savePeriodPlanForSelectedMember() {
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
    const weeklyPlans = periodWeeklyPlansDraft.slice(0, weeks).map((week, index) => ({
      ...week,
      weekNumber: index + 1,
    }));
    const newPeriodPlan: PeriodSchedulePlan = {
      id: uid("period-plan"),
      title,
      notes: periodPlanNotesDraft.trim(),
      startDate: periodPlanStartDateDraft || new Date().toISOString().slice(0, 10),
      weeks,
      createdAt: formatDateDdMmYyyy(new Date()),
      weeklyPlans,
    };
    setPeriodPlansByMemberId((prev) => {
      const next = { ...prev };
      selectedMemberRelatedIds.forEach((memberId) => {
        const previous = next[memberId] ?? [];
        next[memberId] = [newPeriodPlan, ...previous];
      });
      return next;
    });
    if (isSupabaseConfigured && !isLocalDemoSession) {
      void upsertMemberPeriodPlansForTrainer(selectedMemberRelatedIds, newPeriodPlan);
    }
    setPeriodPlanStatus("Periodeplan lagret.");
  }

  function toggleMatchingWeek(weekId: string) {
    setMatchingWeekIdsDraft((prev) => (prev.includes(weekId) ? prev.filter((id) => id !== weekId) : [...prev, weekId]));
  }

  function applyActiveWeekToMatchingWeeks() {
    if (!activePeriodWeek || matchingWeekIdsDraft.length === 0) {
      setPeriodPlanStatus("Velg minst én uke å kopiere til.");
      return;
    }
    setPeriodWeeklyPlansDraft((prev) =>
      prev.map((week) =>
        matchingWeekIdsDraft.includes(week.id)
          ? {
              ...week,
              days: { ...activePeriodWeek.days },
            }
          : week,
      ),
    );
    setPeriodPlanStatus(`Kopierte uke ${activePeriodWeek.weekNumber} til ${matchingWeekIdsDraft.length} uke(r).`);
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
    setEditingTemplateProgramId(program.id);
    setExpandedTemplateProgramId(program.id);
    setTemplateProgramTitle(program.title);
    setProgramExercisesDraft(program.exercises.map((exercise) => ({ ...exercise })));
    setTemplateAssignStatus(`Redigerer mal: ${program.title}`);
  }

  function resetTemplateProgramBuilder() {
    setEditingTemplateProgramId(null);
    setTemplateProgramTitle("Ny treningsmal");
    setProgramExercisesDraft([]);
    setTemplateAssignStatus(null);
  }

  function deleteTemplateProgram(program: TrainingProgram) {
    const shouldDelete = window.confirm(`Slette treningsmalen "${program.title}"?`);
    if (!shouldDelete) return;
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
  }

  function assignSelectedTemplateToMember() {
    if (!selectedMemberId) {
      setTemplateAssignStatus("Velg kunde før tildeling.");
      return;
    }
    const template = templatePrograms.find((program) => program.id === selectedTemplateProgramId) ?? templatePrograms[0];
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
      saveProgramForMember({
        title: template.title,
        goal: template.goal,
        notes: template.notes,
        memberId,
        exercises: template.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
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
  }): boolean {
    if (isLocalDemoSession) {
      setProgramSaveStatus("Demo-innlogging: program lagres ikke til medlem. Logg inn med ekte konto.");
      return false;
    }
    if (!selectedMemberId || selectedMemberId === "__template__") return false;
    saveProgramForMember({
      id: input.id,
      title: input.title,
      goal: input.goal,
      notes: input.notes,
      memberId: selectedMemberId,
      exercises: input.id ? input.exercises : input.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
    });
    const selectedMemberName = members.find((member) => member.id === selectedMemberId)?.name ?? "kunden";
    setProgramSaveStatus(`Program lagret på ${selectedMemberName}.`);
    return true;
  }

  function submitNewMember(options?: { openProgramAfterCreate?: boolean; inviteAfterCreate?: boolean }) {
    const name = newMemberName.trim();
    const email = newMemberEmail.trim().toLowerCase();
    if (!name || !email) {
      setNewMemberError("Navn og e-post er påkrevd.");
      return;
    }
    if (!isValidEmail(email)) {
      setNewMemberError("E-post må være gyldig.");
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === email)) {
      setNewMemberError("E-post finnes allerede.");
      return;
    }

    addMember({
      name,
      email,
      phone: normalizePhone(newMemberPhone),
      goal: newMemberGoal,
      focus: newMemberFocus,
    });

    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberPhone("");
    setNewMemberGoal("");
    setNewMemberFocus("");
    setNewMemberError(null);
    if (options?.openProgramAfterCreate) {
      setPendingProgramMemberEmail(email);
    }
    if (options?.inviteAfterCreate) {
      setPendingInviteMemberEmail(email);
    }
  }

  function handleDeactivateMember(memberId: string) {
    deactivateMember(memberId);
  }

  function handleDeleteMember(memberId: string) {
    const confirmed = window.confirm("Er du sikker på at du vil slette kunden permanent? Dette sletter også programmer, logger og meldinger, og kan ikke angres.");
    if (!confirmed) return;
    deleteMember(memberId);
  }

  function buildProgramFingerprint(program: ProgramExercise[] | undefined, title: string, goal: string, notes: string): string {
    const exerciseFingerprint = (program ?? [])
      .map((item) => `${item.exerciseName}|${item.sets}|${item.reps}|${item.weight}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.notes}`)
      .join("||");
    return `${title.trim()}::${goal.trim()}::${notes.trim()}::${exerciseFingerprint}`;
  }

  function handleDeleteProgram(programId: string) {
    const target = selectedPrograms.find((program) => program.id === programId);
    if (!target) return;
    const fingerprint = buildProgramFingerprint(target.exercises, target.title, target.goal, target.notes);
    const duplicateIds = selectedPrograms
      .filter((program) => program.id !== target.id)
      .filter((program) => buildProgramFingerprint(program.exercises, program.title, program.goal, program.notes) === fingerprint)
      .map((program) => program.id);
    deleteProgramById(target.id);
    duplicateIds.forEach((id) => deleteProgramById(id));
  }

  function handleSaveSelectedMemberDetails() {
    if (!selectedMember) return;
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
    if (!isLikelyValidBirthDate(memberEditBirthDate)) {
      setMemberEditStatus("Fødselsdato må være på formatet dd.mm.yyyy.");
      return;
    }
    const previousEmail = selectedMember.email.trim().toLowerCase();
    const targetMemberIds = members
      .filter((member) => member.email.trim().toLowerCase() === previousEmail)
      .map((member) => member.id);
    const uniqueTargetIds = Array.from(new Set(targetMemberIds.length ? targetMemberIds : [selectedMember.id]));
    uniqueTargetIds.forEach((memberId) => {
      updateMember({
        memberId,
        changes: {
          name: nextName,
          email: nextEmail,
          phone: normalizePhone(memberEditPhone),
          birthDate: normalizeBirthDate(memberEditBirthDate),
          goal: memberEditGoal,
          injuries: memberEditInjuries,
          membershipType: memberEditIsPremiumCustomer ? "Premium" : "Standard",
          customerType: memberEditIsPtCustomer ? "PT-kunde" : "Oppfølging",
        },
      });
    });
    setMemberEditStatus("Kundekort oppdatert.");
    setIsEditingCustomerCard(false);
  }

  function resetMemberListControls() {
    setMemberSearch("");
    setMemberFilter("all");
    setCustomerTypeFilter("all");
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
    if (!selectedMember) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteStatus("Kan ikke sende invitasjon: ugyldig e-post på kunden.");
      return;
    }
    setIsInvitingMember(true);
    setInviteStatus(null);
    const result = await inviteMember(email, selectedMember.id);
    if (result.ok) {
      markMemberInvited(selectedMember.id, new Date().toISOString());
    }
    setInviteStatus(result.message);
    setIsInvitingMember(false);
  }

  async function handleRepairSelectedMemberLink() {
    if (!selectedMember) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setMemberLinkStatus("Kan ikke reparere kobling: ugyldig e-post på kunden.");
      return;
    }
    if (!supabaseClient) {
      setMemberLinkStatus("Kan ikke reparere kobling uten Supabase-oppsett.");
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

  async function handleRestoreMember() {
    if (!restoreEmail.trim()) {
      setRestoreStatus("Skriv inn e-post før gjenoppretting.");
      return;
    }
    setIsRestoringMember(true);
    setRestoreStatus(null);
    const result = await restoreMemberByEmail(restoreEmail);
    setRestoreStatus(result.message);
    if (result.ok) {
      setRestoreEmail("");
    }
    setIsRestoringMember(false);
  }

  async function handleRestoreMissingTestData() {
    setIsRestoringTestData(true);
    setRestoreDataStatus("Gjenoppretter testdata...");
    const result = await restoreMissingTestData();
    setRestoreDataStatus(result.message);
    setIsRestoringTestData(false);
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

  async function handleRefreshAdminHealthCheck() {
    if (!isSupabaseConfigured || !supabaseClient) {
      setAdminHealthStatus("Helsesjekk krever Supabase-oppsett.");
      return;
    }
    setIsRefreshingAdminHealth(true);
    setAdminHealthStatus(null);
    try {
      const ownerUserId = await resolveOwnerUserIdFromSession();
      if (!ownerUserId) {
        setAdminHealthStatus("Fant ikke owner-id i aktiv trener-session.");
        return;
      }
      const dryRunResult = await supabaseClient.functions.invoke("dedupe-members", {
        body: { ownerUserId, apply: false },
      });
      if (dryRunResult.error) {
        setAdminHealthStatus(`Helsesjekk feilet: ${dryRunResult.error.message}`);
        return;
      }
      const dryRunData = (dryRunResult.data ?? {}) as { duplicateGroupCount?: number };
      const duplicateGroups = Number(dryRunData.duplicateGroupCount ?? 0);
      setAdminDuplicateGroupCount(duplicateGroups);
      setAdminHealthStatus(`Helsesjekk oppdatert. Fant ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}.`);
    } catch (error) {
      setAdminHealthStatus(`Helsesjekk feilet: ${String(error)}`);
    } finally {
      setIsRefreshingAdminHealth(false);
    }
  }

  async function handleRunSafeMemberCleanup() {
    if (!isSupabaseConfigured || !supabaseClient) {
      setMemberDedupeStatus("Opprydding krever Supabase-oppsett.");
      return;
    }
    setIsRunningMemberDedupe(true);
    setMemberDedupeStatus(null);
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

      const dryRunData = (dryRunResult.data ?? {}) as { duplicateGroupCount?: number };
      const duplicateGroups = Number(dryRunData.duplicateGroupCount ?? 0);
      if (duplicateGroups <= 0) {
        setMemberDedupeStatus("Ingen duplikater funnet. Alt ser ryddig ut.");
        return;
      }

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
        `Opprydding fullført: ${duplicateGroups} duplikatgruppe${duplicateGroups === 1 ? "" : "r"}, ${deactivatedTotal} rader satt inaktive.`
      );
      const cleanedAt = new Date().toISOString();
      setLastMemberCleanupAt(cleanedAt);
      setAdminDuplicateGroupCount(0);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("motus.admin.lastMemberCleanupAt", cleanedAt);
      }
    } catch (error) {
      setMemberDedupeStatus(`Opprydding feilet: ${String(error)}`);
    } finally {
      setIsRunningMemberDedupe(false);
    }
  }

  function addTodoItem() {
    const title = todoTitle.trim();
    if (!title || !selectedTodoDate) return;
    setTodos((prev) => [{ id: uid("todo"), title, date: selectedTodoDate, done: false }, ...prev]);
    setTodoTitle("");
  }

  function toggleTodoDone(todoId: string) {
    setTodos((prev) => prev.map((item) => (item.id === todoId ? { ...item, done: !item.done } : item)));
  }

  function deleteTodo(todoId: string) {
    setTodos((prev) => prev.filter((item) => item.id !== todoId));
  }

  function resetExerciseForm() {
    setEditingExerciseId(null);
    setExerciseFormName("");
    setExerciseFormCategory("Styrke");
    setExerciseFormGroup("");
    setExerciseFormEquipment("");
    setExerciseFormLevel("Nybegynner");
    setExerciseFormDescription("");
    setExerciseFormImageUrl("");
  }

  function startEditExercise(exercise: Exercise) {
    setEditingExerciseId(exercise.id);
    setExpandedExerciseId(exercise.id);
    setExerciseFormName(exercise.name);
    setExerciseFormCategory(exercise.category);
    setExerciseFormGroup(exercise.group);
    setExerciseFormEquipment(exercise.equipment);
    setExerciseFormLevel(exercise.level);
    setExerciseFormDescription(exercise.description);
    setExerciseFormImageUrl(exercise.imageUrl ?? "");
    setExerciseFormStatus(null);
  }

  function submitExerciseForm() {
    const name = exerciseFormName.trim();
    const group = exerciseFormGroup.trim();
    const equipment = exerciseFormEquipment.trim();
    const description = exerciseFormDescription.trim();
    if (!name || !group || !equipment || !description) {
      setExerciseFormStatus("Fyll ut navn, kategori, muskelgruppe, utstyr og forklaring.");
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
    });

    setExerciseFormStatus(editingExerciseId ? "Øvelsen ble oppdatert." : "Ny øvelse ble lagt til i banken.");
    resetExerciseForm();
  }
  function handleDeleteExercise(exercise: Exercise) {
    const isUsedInPrograms = programs.some((program) => program.exercises.some((item) => item.exerciseId === exercise.id));
    const confirmMessage = isUsedInPrograms
      ? `Slette "${exercise.name}" fra øvelsesbanken?\n\nØvelsen blir også fjernet fra programmer der den er brukt.`
      : `Slette "${exercise.name}" fra øvelsesbanken?`;
    const shouldDelete = window.confirm(confirmMessage);
    if (!shouldDelete) return;
    deleteExercise(exercise.id);
    setFavoriteExerciseIds((prev) => prev.filter((id) => id !== exercise.id));
    if (editingExerciseId === exercise.id) resetExerciseForm();
    if (expandedExerciseId === exercise.id) setExpandedExerciseId(null);
    setExerciseFormStatus(`Øvelsen "${exercise.name}" ble slettet.`);
  }

  async function handleExerciseImageUpload(file: File | null) {
    if (!file) return;
    if (!supabaseClient) {
      setExerciseFormStatus("Bildefunksjon krever Supabase-oppsett.");
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
        setExerciseFormStatus("Opplasting feilet: bucket 'exercise-images' mangler i Supabase Storage.");
      } else {
        setExerciseFormStatus(`Opplasting feilet: ${message}`);
      }
    } finally {
      setIsUploadingExerciseImage(false);
    }
  }

  function getExerciseSketchDataUri(exercise: Exercise): string {
    const accent = exercise.category === "Kondisjon" ? "#f97316" : exercise.category === "Uttøyning" ? "#0ea5e9" : "#14b8a6";
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

  const followUpCount = useMemo(
    () => deduplicatedMembers.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length,
    [deduplicatedMembers]
  );
  const membersWithoutProgramCount = useMemo(
    () => deduplicatedMembers.filter((member) => !programs.some((program) => program.memberId === member.id)).length,
    [deduplicatedMembers, programs],
  );
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
      const normalizedName = member.name.trim().toLowerCase();
      const byEmailIds = normalizedEmail
        ? members
            .filter((row) => row.email.trim().toLowerCase() === normalizedEmail)
            .map((row) => row.id)
        : [];
      const byNameIds = normalizedName
        ? members
            .filter((row) => row.name.trim().toLowerCase() === normalizedName)
            .map((row) => row.id)
        : [];
      byCanonicalId.set(member.id, new Set([...byEmailIds, ...byNameIds, member.id]));
    });
    return byCanonicalId;
  }, [deduplicatedMembers, members]);
  const followUpCandidates = useMemo(() => {
    const nowMs = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return deduplicatedMembers
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
        const daysInactive = Number(member.daysSinceActivity || "0");
        let score = 0;
        const reasons: string[] = [];
        if (daysInactive >= 7) {
          score += 2;
          reasons.push(`${daysInactive} dager siden aktivitet`);
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
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score || b.member.daysSinceActivity.localeCompare(a.member.daysSinceActivity))
      .slice(0, 6);
  }, [deduplicatedMembers, logs, memberRelatedIdSetByCanonicalId, lastFollowUpByMemberId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.lastFollowUpByMemberId", JSON.stringify(lastFollowUpByMemberId));
  }, [lastFollowUpByMemberId]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("motus.trainer.followUpDetailsByMemberId", JSON.stringify(followUpDetailsByMemberId));
  }, [followUpDetailsByMemberId]);
  useEffect(() => {
    const latest = resolveLatestFollowUpDetail(selectedMemberRelatedIds);
    if (!latest) {
      setFollowUpMethodDraft("melding");
      setFollowUpNoteDraft("");
      setFollowUpSaveStatus(null);
      return;
    }
    setFollowUpMethodDraft(latest.method);
    setFollowUpNoteDraft(latest.note);
    setFollowUpSaveStatus(null);
    // only when customer changes / details update
  }, [selectedMemberRelatedIds, followUpDetailsByMemberId]);

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

    function getPriority(member: Member): { tone: "red" | "orange" | "green"; score: number; label: string } {
      const days = Number(member.daysSinceActivity || "0");
      if (days >= 10) return { tone: "red", score: 3, label: "Rød" };
      if (days >= 5) return { tone: "orange", score: 2, label: "Oransje" };
      return { tone: "green", score: 1, label: "Grønn" };
    }

    const mapped = deduplicatedMembers.map((member) => ({ member, priority: getPriority(member) }));
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
  }, [deduplicatedMembers, priorityFilter, prioritySort, priorityMemberTypeSort]);

  function memberTypeBadges(member: Member): Array<{ label: string; style: { backgroundColor: string; color: string } }> {
    const badges: Array<{ label: string; style: { backgroundColor: string; color: string } }> = [];
    if (member.customerType === "PT-kunde") {
      badges.push({
        label: "PT-kunde",
        style: { backgroundColor: "rgba(0, 193, 212, 0.16)", color: "#0F5C66" },
      });
    }
    if (member.membershipType === "Premium") {
      badges.push({
        label: "Premium",
        style: { backgroundColor: "rgba(244, 114, 182, 0.16)", color: "#9D2F67" },
      });
    }
    if (badges.length === 0) {
      badges.push({
        label: "Standard",
        style: { backgroundColor: "rgba(148, 163, 184, 0.16)", color: "#475569" },
      });
    }
    return badges;
  }

  function followUpMethodLabel(method: FollowUpDetail["method"]): string {
    if (method === "telefon") return "Telefon";
    if (method === "mote") return "Møte";
    return "Melding";
  }

  function handleQuickFollowUpMessage(member: Member) {
    setSelectedMemberId(member.id);
    setCustomerSubTab("messages");
    setTrainerTab("customers");
    setTrainerMessage(`Hei ${member.name}! Hvordan går treningen denne uka?`);
  }

  function markMemberFollowedUp(member: Member) {
    const relatedIds = Array.from(memberRelatedIdSetByCanonicalId.get(member.id) ?? new Set([member.id]));
    const nowIso = new Date().toISOString();
    setLastFollowUpByMemberId((prev) => {
      const next = { ...prev };
      relatedIds.forEach((id) => {
        next[id] = nowIso;
      });
      return next;
    });
    setFollowUpDetailsByMemberId((prev) => {
      const next = { ...prev };
      relatedIds.forEach((id) => {
        next[id] = {
          at: nowIso,
          method: "melding",
          note: "Markert fra oppfølgingsliste.",
        };
      });
      return next;
    });
  }

  function saveSelectedMemberFollowUpEntry() {
    if (!selectedMember || !selectedMemberRelatedIds.length) return;
    const nowIso = new Date().toISOString();
    const detail: FollowUpDetail = {
      at: nowIso,
      method: followUpMethodDraft,
      note: followUpNoteDraft.trim(),
    };
    setLastFollowUpByMemberId((prev) => {
      const next = { ...prev };
      selectedMemberRelatedIds.forEach((id) => {
        next[id] = nowIso;
      });
      return next;
    });
    setFollowUpDetailsByMemberId((prev) => {
      const next = { ...prev };
      selectedMemberRelatedIds.forEach((id) => {
        next[id] = detail;
      });
      return next;
    });
    setFollowUpSaveStatus("Oppfølging lagret.");
  }

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-3 lg:hidden">
        <div className="flex gap-2 overflow-auto pb-1">
          <PillButton active={trainerTab === "dashboard"} onClick={() => setTrainerTab("dashboard")}>Oversikt</PillButton>
          <PillButton active={trainerTab === "customers"} onClick={() => setTrainerTab("customers")}>Kunder</PillButton>
          <PillButton active={trainerTab === "programs"} onClick={() => setTrainerTab("programs")}>Programmer</PillButton>
          <PillButton active={trainerTab === "messages"} onClick={() => setTrainerTab("messages")}>Meldinger</PillButton>
          <PillButton active={trainerTab === "exerciseBank"} onClick={() => setTrainerTab("exerciseBank")}>Øvelsesbank</PillButton>
          <PillButton active={trainerTab === "admin"} onClick={() => setTrainerTab("admin")}>Admin</PillButton>
        </div>
      </Card>

      {trainerTab === "dashboard" ? (
        <Card className="p-5 space-y-5">
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            {followUpCount > 0
              ? `${followUpCount} kunder ma folges opp i dag.`
              : "Ingen kunder trenger oppfolging akkurat na."}{" "}
            {membersWithoutProgramCount > 0 ? `${membersWithoutProgramCount} kunder mangler program.` : "Alle aktive kunder har program."}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="font-semibold text-slate-800">To-do per dag</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <TextInput value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="Ny oppgave (f.eks. ring Martin)" />
                <TextInput type="date" value={selectedTodoDate} onChange={(e) => setSelectedTodoDate(e.target.value)} />
                <GradientButton onClick={addTodoItem}>Legg til</GradientButton>
              </div>
              <div className="space-y-2">
                {todoItemsForSelectedDate.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-3 text-sm text-slate-500">Ingen oppgaver for valgt dag.</div> : null}
                {todoItemsForSelectedDate.map((todo) => (
                  <div key={todo.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <button type="button" onClick={() => toggleTodoDone(todo.id)} className={`text-left text-sm ${todo.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                      {todo.title}
                    </button>
                    <OutlineButton onClick={() => deleteTodo(todo.id)} className="px-3 py-1.5 text-xs">Slett</OutlineButton>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">Kalender</div>
                <div className="flex items-center gap-2">
                  <OutlineButton onClick={() => setDashboardMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="px-3 py-1.5 text-xs">Forrige</OutlineButton>
                  <OutlineButton onClick={() => setDashboardMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="px-3 py-1.5 text-xs">Neste</OutlineButton>
                </div>
              </div>
              <div className="text-sm text-slate-600">{monthLabel}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
                <span>Ma</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lo</span><span>So</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dashboardCalendarCells.map((day, index) => {
                  if (!day) return <div key={`empty-${index}`} />;
                  const dateIso = `${dashboardMonth.getFullYear()}-${String(dashboardMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const hasTodo = todoDateSet.has(dateIso);
                  const isSelected = selectedTodoDate === dateIso;
                  return (
                    <button
                      key={dateIso}
                      type="button"
                      onClick={() => setSelectedTodoDate(dateIso)}
                      className={`rounded-lg px-1 py-2 text-center text-xs ${isSelected ? "text-white font-semibold" : "text-slate-600 bg-white"}`}
                      style={
                        isSelected
                          ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                          : hasTodo
                          ? { border: `1px solid ${MOTUS.turquoise}` }
                          : { border: "1px solid rgba(15,23,42,0.06)" }
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-slate-800">Kundeprioritering (rød haster mest)</div>
              <div className="flex flex-wrap items-center gap-2">
                <SelectBox
                  value={priorityFilter}
                  onChange={(value) => setPriorityFilter(value as "all" | "red" | "orange" | "green")}
                  options={[
                    { value: "all", label: "Alle" },
                    { value: "red", label: "Rød" },
                    { value: "orange", label: "Oransje" },
                    { value: "green", label: "Grønn" },
                  ]}
                />
                <SelectBox
                  value={prioritySort}
                  onChange={(value) => setPrioritySort(value as "highFirst" | "lowFirst")}
                  options={[
                    { value: "highFirst", label: "Sorter: høy prioritet først" },
                    { value: "lowFirst", label: "Sorter: lav prioritet først" },
                  ]}
                />
                <SelectBox
                  value={priorityMemberTypeSort}
                  onChange={(value) => setPriorityMemberTypeSort(value as "none" | "ptFirst" | "premiumFirst" | "standardFirst")}
                  options={[
                    { value: "none", label: "Type: ingen" },
                    { value: "ptFirst", label: "Type: PT-kunde først" },
                    { value: "premiumFirst", label: "Type: Premium først" },
                    { value: "standardFirst", label: "Type: Standard først" },
                  ]}
                />
                <OutlineButton
                  onClick={() => {
                    setPriorityFilter("all");
                    setPrioritySort("highFirst");
                    setPriorityMemberTypeSort("none");
                  }}
                  className="px-3 py-2 text-xs"
                >
                  Nullstill
                </OutlineButton>
              </div>
            </div>
            <div className="space-y-2">
              {membersWithPriority.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">
                  Ingen kunder matcher valgt prioritet/type-sortering akkurat nå.
                </div>
              ) : null}
              {membersWithPriority.map(({ member, priority }) => (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 overflow-hidden rounded-full border bg-slate-100" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                      {resolveMemberAvatarUrl(member) ? <img src={resolveMemberAvatarUrl(member)} alt={member.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.email} · {member.daysSinceActivity} dager siden aktivitet</div>
                    </div>
                  </div>
                  <div className="min-w-[172px] space-y-1">
                    <div className="flex items-center justify-end gap-1">
                      {memberTypeBadges(member).map((badge) => (
                        <span key={`${member.id}-${badge.label}`} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={badge.style}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTrainerTab("customers");
                          setSelectedMemberId(member.id);
                          setCustomerSubTab("overview");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          priority.tone === "red"
                            ? "bg-rose-100 text-rose-700"
                            : priority.tone === "orange"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {priority.label}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="font-semibold text-slate-800">Bør kontaktes nå</div>
            {followUpCandidates.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white p-3 text-sm text-slate-500">
                Ingen kunder trenger ekstra oppfølging akkurat nå.
              </div>
            ) : (
              <div className="space-y-2">
                {followUpCandidates.map((item) => (
                  <div key={`followup-${item.member.id}`} className="rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{item.member.name}</div>
                        <div className="text-xs text-slate-500">{item.member.email}</div>
                        <div className="mt-1 text-xs text-slate-600">{item.reasons.join(" · ")}</div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Sist fulgt opp: {item.lastFollowUpIso ? formatDateDdMmYyyy(new Date(item.lastFollowUpIso)) : "Aldri"}
                        </div>
                      </div>
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">Prioritet {item.score}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <OutlineButton onClick={() => handleQuickFollowUpMessage(item.member)} className="px-3 py-1.5 text-xs">
                        Send melding
                      </OutlineButton>
                      <OutlineButton onClick={() => markMemberFollowedUp(item.member)} className="px-3 py-1.5 text-xs">
                        Marker fulgt opp
                      </OutlineButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {trainerTab === "calendar" ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-800">Kalender</div>
            <div className="flex items-center gap-2">
              <OutlineButton onClick={() => setDashboardMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))} className="px-3 py-1.5 text-xs">Forrige</OutlineButton>
              <OutlineButton onClick={() => setDashboardMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))} className="px-3 py-1.5 text-xs">Neste</OutlineButton>
            </div>
          </div>
          <div className="text-sm text-slate-600">{monthLabel}</div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
            <span>Ma</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lo</span><span>So</span>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dashboardCalendarCells.map((day, index) => {
              if (!day) return <div key={`cal-empty-${index}`} />;
              const dateIso = `${dashboardMonth.getFullYear()}-${String(dashboardMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasTodo = todoDateSet.has(dateIso);
              const isSelected = selectedTodoDate === dateIso;
              return (
                <button
                  key={dateIso}
                  type="button"
                  onClick={() => setSelectedTodoDate(dateIso)}
                  className={`rounded-lg px-1 py-2 text-center text-xs ${isSelected ? "text-white font-semibold" : "text-slate-600 bg-white"}`}
                  style={
                    isSelected
                      ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                      : hasTodo
                      ? { border: `1px solid ${MOTUS.turquoise}` }
                      : { border: "1px solid rgba(15,23,42,0.06)" }
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="font-semibold text-slate-800">Oppgaver for valgt dag</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <TextInput value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="Ny oppgave (f.eks. ring Martin)" />
              <TextInput type="date" value={selectedTodoDate} onChange={(e) => setSelectedTodoDate(e.target.value)} />
              <GradientButton onClick={addTodoItem}>Legg til</GradientButton>
            </div>
            <div className="space-y-2">
              {todoItemsForSelectedDate.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-3 text-sm text-slate-500">Ingen oppgaver for valgt dag.</div> : null}
              {todoItemsForSelectedDate.map((todo) => (
                <div key={todo.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <button type="button" onClick={() => toggleTodoDone(todo.id)} className={`text-left text-sm ${todo.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                    {todo.title}
                  </button>
                  <OutlineButton onClick={() => deleteTodo(todo.id)} className="px-3 py-1.5 text-xs">Slett</OutlineButton>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {trainerTab === "statistics" ? (
        <Card className="p-5 space-y-4">
          <div className="font-semibold text-slate-800">Statistikk og prioritering</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Totalt kunder" value={String(deduplicatedMembers.length)} hint="Alle kunder" />
            <StatCard label="Må følges opp" value={String(followUpCount)} hint="7+ dager inaktiv" />
            <StatCard label="Uten program" value={String(membersWithoutProgramCount)} hint="Mangler aktiv plan" />
            <StatCard label="Filtrerte kunder" value={String(filteredMembers.length)} hint="Etter søk/filter" />
          </div>
          <div className="space-y-2">
            {membersWithPriority.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">
                Ingen kunder matcher valgt prioritet/type-sortering akkurat nå.
              </div>
            ) : null}
            {membersWithPriority.map(({ member, priority }) => (
              <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 overflow-hidden rounded-full border bg-slate-100" style={{ borderColor: "rgba(15,23,42,0.1)" }}>
                    {resolveMemberAvatarUrl(member) ? <img src={resolveMemberAvatarUrl(member)} alt={member.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{member.name}</div>
                    <div className="text-xs text-slate-500">{member.email} · {member.daysSinceActivity} dager siden aktivitet</div>
                  </div>
                </div>
                <div className="min-w-[172px] space-y-1">
                  <div className="flex items-center justify-end gap-1">
                    {memberTypeBadges(member).map((badge) => (
                      <span key={`${member.id}-${badge.label}`} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={badge.style}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <div className="text-right text-xs font-semibold text-slate-600">{priority.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {trainerTab === "settings" ? (
        <Card className="p-5 space-y-4">
          <div className="font-semibold text-slate-800">Innstillinger</div>
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            Her samles PT-innstillinger. Foreløpig kan du styre medlemsvisning via:
            søk/filter i klientlisten, vis/skjul inaktive kunder, og prioritetssortering i statistikk.
          </div>
          <div className="rounded-xl border bg-slate-50 p-3 space-y-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-medium text-slate-700">Gjenopprett testmedlemmer</div>
            <div className="text-xs text-slate-600">
              Legger tilbake manglende standard testmedlemmer uten å overskrive eksisterende medlemmer.
            </div>
            {restoreDataStatus ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
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
        <div className="grid gap-4">
          <div className="lg:hidden">
            <OutlineButton onClick={() => setShowCustomerToolsMobile((prev) => !prev)} className="w-full">
              {showCustomerToolsMobile ? "Skjul kundeliste og oppretting" : "Vis kundeliste og oppretting"}
            </OutlineButton>
          </div>
          <Card className={`p-4 ${showCustomerToolsMobile ? "block" : "hidden"} lg:block`}>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Users className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Kunder</h2>
                <p className="text-sm text-slate-500">Velg kunde fra rullgardin og filtrer listen</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {sortedMembers.length} treff{memberFilter !== "all" || customerTypeFilter !== "all" ? " med aktivt filter" : ""}
                </div>
                {(memberSearch.trim() || memberFilter !== "all" || customerTypeFilter !== "all") ? (
                  <OutlineButton onClick={resetMemberListControls} className="px-3 py-1.5 text-xs">
                    Nullstill sok/filter
                  </OutlineButton>
                ) : null}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <TextInput
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Sok etter navn, e-post eller mal"
                />
                <SelectBox
                  value={memberFilter}
                  onChange={(value) => setMemberFilter(value as "all" | "followUp" | "invited" | "notInvited")}
                  options={[
                    { value: "all", label: "Alle kunder" },
                    { value: "followUp", label: "Må følges opp (7+ dager)" },
                    { value: "invited", label: "Invitert" },
                    { value: "notInvited", label: "Ikke invitert" },
                  ]}
                />
                <SelectBox
                  value={customerTypeFilter}
                  onChange={(value) => setCustomerTypeFilter(value as "all" | "PT-kunde" | "Premium-kunde")}
                  options={[
                    { value: "all", label: "Alle kundetyper" },
                    { value: "PT-kunde", label: "PT-kunde" },
                    { value: "Premium-kunde", label: "Premium-kunde" },
                  ]}
                />
                <SelectBox
                  value={memberSort}
                  onChange={(value) => setMemberSort(value as "activityRecent" | "nameAsc" | "nameDesc")}
                  options={[
                    { value: "activityRecent", label: "Siste aktivitet (nyeste først)" },
                    { value: "nameAsc", label: "Navn A-Å" },
                    { value: "nameDesc", label: "Navn Å-A" },
                  ]}
                />
              </div>
              <SelectBox
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                options={
                  sortedMembers.length
                    ? sortedMembers.map((member) => ({
                        value: member.id,
                        label: `${member.name} (${member.email}) · ${member.customerType}`,
                      }))
                    : [{ value: "", label: "Ingen kunder matcher filteret" }]
                }
              />
              {sortedMembers.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Ingen kunder matcher sok/filter. Proev et enklere sok eller bytt filter.
                </div>
              ) : null}
              <OutlineButton onClick={() => setShowInactiveMembers((prev) => !prev)} className="w-full">
                {showInactiveMembers ? "Skjul inaktive" : "Vis inaktive"}
              </OutlineButton>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 w-full">
            {selectedMember ? (
              <div className="space-y-5">
                <div className="lg:hidden rounded-2xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-medium text-slate-600">Bytt kunde raskt</div>
                  <SelectBox
                    value={selectedMemberId}
                    onChange={setSelectedMemberId}
                    options={deduplicatedMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                  />
                </div>
                <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.ink} 100%)` }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-sm text-white/80">Kundekort</div>
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-white/40 bg-white/20">
                      {resolveMemberAvatarUrl(selectedMember) ? (
                        <img src={resolveMemberAvatarUrl(selectedMember)} alt={`Profilbilde av ${selectedMember.name}`} className="h-full w-full object-cover" loading="eager" decoding="async" />
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-2xl font-bold tracking-tight">{selectedMember.name}</div>
                  {isEditingCustomerCard ? (
                    <div className="mt-3 space-y-3 rounded-2xl border border-white/25 bg-white/10 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1 text-xs font-medium text-white">
                          <span>Navn</span>
                          <TextInput value={memberEditName} onChange={(event) => setMemberEditName(event.target.value)} placeholder="f.eks. Ola Nordmann" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-white">
                          <span>E-post</span>
                          <TextInput value={memberEditEmail} onChange={(event) => setMemberEditEmail(event.target.value)} placeholder="f.eks. navn@epost.no" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-white">
                          <span>Telefon</span>
                          <TextInput value={memberEditPhone} onChange={(event) => setMemberEditPhone(event.target.value)} placeholder="f.eks. 900 00 000" />
                        </label>
                        <label className="space-y-1 text-xs font-medium text-white">
                          <span>Fødselsdato</span>
                          <TextInput value={memberEditBirthDate} onChange={(event) => setMemberEditBirthDate(event.target.value)} placeholder="dd.mm.yyyy" />
                        </label>
                      </div>
                      <label className="space-y-1 text-xs font-medium text-white">
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
                      <label className="space-y-1 text-xs font-medium text-white">
                        <span>Skader/hensyn</span>
                        <TextArea value={memberEditInjuries} onChange={(event) => setMemberEditInjuries(event.target.value)} className="min-h-[90px]" placeholder="Skader/hensyn" />
                      </label>
                      <div className="rounded-xl border border-white/25 bg-white/10 p-3 space-y-2.5">
                        <div className="text-xs font-medium text-white">Kundetype og medlemskap</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsPtCustomer
                              ? "border-white/70 bg-white/25 text-white"
                              : "border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditIsPtCustomer}
                            onChange={(event) => setMemberEditIsPtCustomer(event.target.checked)}
                            className="h-4 w-4 rounded border-white/40 bg-white/20 accent-emerald-500"
                          />
                          PT-kunde
                        </label>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsPremiumCustomer
                              ? "border-white/70 bg-white/25 text-white"
                              : "border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={memberEditIsPremiumCustomer}
                            onChange={(event) => setMemberEditIsPremiumCustomer(event.target.checked)}
                            className="h-4 w-4 rounded border-white/40 bg-white/20 accent-emerald-500"
                          />
                          Premium-kunde
                        </label>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/25 bg-white/10 p-3 space-y-2">
                        <div className="text-xs font-medium text-white">Profilbilde</div>
                        <div className="h-14 w-14 overflow-hidden rounded-full border border-white/40 bg-white/20">
                          {resolveMemberAvatarUrl(selectedMember) ? <img src={resolveMemberAvatarUrl(selectedMember)} alt={`Profilbilde av ${selectedMember.name}`} className="h-full w-full object-cover" /> : null}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void handleCustomerAvatarSelected(event.target.files?.[0] ?? null)}
                          className="block w-full text-xs text-white/90 file:mr-3 file:rounded-xl file:border-0 file:bg-white/80 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-800"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">E-post</div>
                          <div className="font-medium text-white/95">{selectedMember.email || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">Telefon</div>
                          <div className="font-medium text-white/95">{selectedMember.phone || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">Fødselsdato</div>
                          <div className="font-medium text-white/95">{selectedMember.birthDate || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">Mål</div>
                          <div className="font-medium text-white/95">{selectedMember.goal || "Ikke satt"}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                        <div className="text-[11px] text-white/70">Skader/hensyn</div>
                        <div className="font-medium text-white/95">{selectedMember.injuries || "Ingen registrerte skader"}</div>
                      </div>
                      <div className="mt-2 text-sm text-white/85">
                        Sist trening: {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}
                      </div>
                      <div className="mt-1 text-xs text-white/80">
                        {selectedMember.invitedAt ? `Invitert: ${formatInvitedAt(selectedMember.invitedAt)}` : "Ikke invitert enda"}
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isEditingCustomerCard ? (
                      <>
                        <GradientButton onClick={handleSaveSelectedMemberDetails}>
                          Lagre endringer
                        </GradientButton>
                        <OutlineButton
                          onClick={() => {
                            resetMemberEditDraftFromSelected(selectedMember);
                            setIsEditingCustomerCard(false);
                          }}
                        >
                          Avbryt redigering
                        </OutlineButton>
                      </>
                    ) : (
                      <OutlineButton onClick={() => setIsEditingCustomerCard(true)}>
                        Rediger kundekort
                      </OutlineButton>
                    )}
                    <OutlineButton onClick={() => void handleInviteSelectedMember()} disabled={isInvitingMember}>
                      {isInvitingMember ? "Sender invitasjon..." : "Send invitasjon på nytt"}
                    </OutlineButton>
                    <OutlineButton onClick={() => void handleRepairSelectedMemberLink()} disabled={isRepairingMemberLink}>
                      {isRepairingMemberLink ? "Reparerer kobling..." : "Reparer medlemskobling"}
                    </OutlineButton>
                    <OutlineButton onClick={() => handleDeactivateMember(selectedMember.id)}>
                      Sett medlem som inaktiv
                    </OutlineButton>
                    <button
                      type="button"
                      onClick={() => handleDeleteMember(selectedMember.id)}
                      className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Slett kunde permanent
                    </button>
                  </div>
                </div>

                {inviteStatus ? (
                  <StatusMessage
                    message={inviteStatus}
                    tone={inviteStatus.toLowerCase().includes("sendt") || inviteStatus.toLowerCase().includes("invitasjon sendt") ? "success" : "error"}
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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Programmer" value={String(selectedPrograms.length)} hint="På denne kunden" />
                  <StatCard label="Logger" value={String(selectedLogs.length)} hint="På denne kunden" />
                  <StatCard label="Meldinger" value={String(selectedMessages.length)} hint="På denne kunden" />
                  <StatCard label="Inaktivitet" value={`${selectedMember.daysSinceActivity} dager`} hint="Sist aktivitet" />
                </div>

                <div className="rounded-3xl border bg-slate-50/80 p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="grid grid-cols-4 gap-2">
                    <PillButton active={customerSubTab === "overview"} onClick={() => setCustomerSubTab("overview")}>Oversikt</PillButton>
                    <PillButton active={customerSubTab === "programs"} onClick={() => setCustomerSubTab("programs")}>Program</PillButton>
                    <PillButton active={customerSubTab === "workouts"} onClick={() => setCustomerSubTab("workouts")}>Økter</PillButton>
                    <PillButton active={customerSubTab === "messages"} onClick={() => setCustomerSubTab("messages")}>Meldinger</PillButton>
                  </div>
                </div>

                {customerSubTab === "overview" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Kort status</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-800">Mål:</span> {selectedMember.goal || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Kundetype:</span> {selectedMember.customerType}</div>
                        <div><span className="font-medium text-slate-800">Medlemskap:</span> {selectedMember.membershipType}</div>
                        <div><span className="font-medium text-slate-800">Skader/hensyn:</span> {selectedMember.injuries || "Ingen registrerte skader"}</div>
                      </div>
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Siste aktivitet</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div>{selectedLogs[0] ? `Siste logg: ${selectedLogs[0].date}` : "Ingen logger ennå"}</div>
                        <div>{selectedMessages.length ? `Siste melding: ${selectedMessages[selectedMessages.length - 1].createdAt}` : "Ingen meldinger ennå"}</div>
                        <div>{selectedPrograms.length ? `Siste program: ${selectedPrograms[0].title}` : "Ingen program ennå"}</div>
                      </div>
                    </div>
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Siste økter og tilbakemeldinger</div>
                      {selectedLogs.length ? (
                        <div className="mt-3 space-y-3">
                          {selectedLogs.slice(0, 5).map((log) => (
                            <div key={log.id} className="rounded-2xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-medium text-slate-800">{log.programTitle}</div>
                                <div className="text-xs text-slate-500">{log.date}</div>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{log.status}</div>
                              {log.results?.length ? (
                                <div className="mt-2 text-xs text-slate-600">
                                  Utførte sett: {log.results.filter((result) => result.completed).length}/{log.results.length}
                                </div>
                              ) : null}
                              <div className="mt-2 text-xs text-slate-700">
                                Følelse: {reflectionEmoji(log.reflection?.energyLevel)} · Belastning: {reflectionEmoji(log.reflection?.difficultyLevel)} · Motivasjon: {reflectionEmoji(log.reflection?.motivationLevel)}
                              </div>
                              {log.note ? <div className="mt-2 text-xs text-slate-600">Øktnotat: {log.note}</div> : null}
                              {log.reflection?.note ? <div className="mt-1 text-xs text-slate-600">Til PT: {log.reflection.note}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">Ingen økter logget ennå.</div>
                      )}
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Oppfølgingslogg</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                        <SelectBox
                          value={followUpMethodDraft}
                          onChange={(value) => setFollowUpMethodDraft(value as FollowUpDetail["method"])}
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
                          placeholder="Kort notat fra oppfølgingen..."
                          className="min-h-[92px]"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <GradientButton onClick={saveSelectedMemberFollowUpEntry} className="px-4 py-2 text-xs">
                          Lagre oppfølging
                        </GradientButton>
                        {followUpSaveStatus ? (
                          <span className="text-xs text-emerald-700">{followUpSaveStatus}</span>
                        ) : null}
                      </div>
                      <div className="mt-3 rounded-2xl border bg-white p-3 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        {selectedMemberLatestFollowUp ? (
                          <>
                            <div><span className="font-semibold text-slate-800">Sist fulgt opp:</span> {formatDateDdMmYyyy(new Date(selectedMemberLatestFollowUp.at))}</div>
                            <div><span className="font-semibold text-slate-800">Metode:</span> {followUpMethodLabel(selectedMemberLatestFollowUp.method)}</div>
                            <div><span className="font-semibold text-slate-800">Notat:</span> {selectedMemberLatestFollowUp.note || "Ingen notat."}</div>
                          </>
                        ) : (
                          <div>Ingen oppfølging registrert ennå.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "programs" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border bg-slate-50 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{editingProgramId ? "Rediger program" : "Bygg program"}</div>
                        {editingProgramId ? <OutlineButton onClick={resetProgramBuilder}>Avbryt redigering</OutlineButton> : null}
                      </div>
                      <div className="rounded-2xl border bg-white p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="text-sm font-semibold text-slate-700">Periodeplan + ukesplan (per dag)</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <TextInput value={periodPlanTitleDraft} onChange={(e) => setPeriodPlanTitleDraft(e.target.value)} placeholder="Navn (f.eks. Sommerblokk uke 1-4)" />
                          <TextInput value={periodPlanStartDateDraft} onChange={(e) => setPeriodPlanStartDateDraft(e.target.value)} type="date" />
                        </div>
                        <div className="grid gap-2 md:grid-cols-[160px_1fr]">
                          <TextInput
                            value={periodPlanWeeksDraft}
                            onChange={(e) => handlePeriodPlanWeeksDraftChange(e.target.value)}
                            placeholder="Antall uker"
                            type="number"
                          />
                          <TextArea
                            value={periodPlanNotesDraft}
                            onChange={(e) => setPeriodPlanNotesDraft(e.target.value)}
                            className="min-h-[70px]"
                            placeholder="Overordnet fokus for perioden"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {periodWeeklyPlansDraft.map((week) => (
                            <button
                              key={week.id}
                              type="button"
                              onClick={() => setActivePeriodWeekId(week.id)}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                                activePeriodWeek?.id === week.id
                                  ? "border-transparent text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              style={activePeriodWeek?.id === week.id ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : undefined}
                            >
                              Uke {week.weekNumber}
                            </button>
                          ))}
                        </div>
                        {activePeriodWeek ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {WEEKDAY_PLAN_FIELDS.map((field) => {
                              const currentValue = activePeriodWeek.days[field.key];
                              const hasCurrentValueInOptions = periodPlanProgramOptions.some((option) => option.value === currentValue);
                              const options = hasCurrentValueInOptions
                                ? periodPlanProgramOptions
                                : [...periodPlanProgramOptions, { value: currentValue, label: `${currentValue} (tilpasset)` }];
                              return (
                                <label key={field.key} className="space-y-1">
                                  <span className="text-xs font-medium text-slate-600">{field.label}</span>
                                  <SelectBox
                                    value={currentValue}
                                    onChange={(value) => updateActivePeriodWeekDay(field.key, value)}
                                    options={options}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                        {activePeriodWeek && periodWeeklyPlansDraft.length > 1 ? (
                          <div className="rounded-xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kopier ukeplan til flere uker</div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {periodWeeklyPlansDraft
                                .filter((week) => week.id !== activePeriodWeek.id)
                                .map((week) => (
                                  <label key={week.id} className="inline-flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                    <input
                                      type="checkbox"
                                      checked={matchingWeekIdsDraft.includes(week.id)}
                                      onChange={() => toggleMatchingWeek(week.id)}
                                    />
                                    <span>Uke {week.weekNumber}</span>
                                  </label>
                                ))}
                            </div>
                            <OutlineButton onClick={applyActiveWeekToMatchingWeeks} className="w-full sm:w-auto">
                              Bruk samme plan på valgte uker
                            </OutlineButton>
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <GradientButton onClick={savePeriodPlanForSelectedMember} className="w-full sm:w-auto">
                            Lagre periodeplan
                          </GradientButton>
                          {periodPlanStatus ? (
                            <StatusMessage
                              message={periodPlanStatus}
                              tone={periodPlanStatus.toLowerCase().includes("lagret") || periodPlanStatus.toLowerCase().includes("slettet") ? "success" : "error"}
                              className="w-full !rounded-xl !px-3 !py-2 !text-xs"
                            />
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lagrede periodeplaner</div>
                          {selectedPeriodPlans.length === 0 ? (
                            <div className="rounded-xl border border-dashed bg-slate-50 p-3 text-xs text-slate-500">
                              Ingen periodeplan lagret for kunden ennå.
                            </div>
                          ) : (
                            selectedPeriodPlans.slice(0, 4).map((plan) => (
                              <div key={plan.id} className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-slate-800">{plan.title}</div>
                                    <div className="mt-0.5">Start: {plan.startDate} · {plan.weeks} uker · Lagret {plan.createdAt}</div>
                                  </div>
                                  <OutlineButton className="px-2 py-1 text-xs" onClick={() => removePeriodPlan(plan.id)}>
                                    Slett
                                  </OutlineButton>
                                </div>
                                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                  {plan.weeklyPlans.slice(0, 2).map((week) => (
                                    <div key={week.id} className="rounded-lg border bg-white px-2 py-1" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                      <div className="font-medium text-slate-700">Uke {week.weekNumber}</div>
                                      <div className="mt-0.5 text-[11px] text-slate-500">
                                        {WEEKDAY_PLAN_FIELDS.map((field) => week.days[field.key]).filter((entry) => entry.trim()).length} planlagte dager
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <TextInput value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på program" />
                      <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål" />
                      <TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} className="min-h-[110px]" placeholder="Notater" />

                      <div
                        className={`space-y-3 rounded-2xl p-1 transition ${
                          isDraftDropZoneActive ? "bg-emerald-50 ring-2 ring-emerald-300" : ""
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
                        {programExercisesDraft.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen øvelser valgt ennå.</div> : null}
                        {programExercisesDraft.map((item, index) => (
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
                            className={`rounded-2xl border bg-white p-4 space-y-3 cursor-move transition ${
                              dragOverDraftExerciseId === item.id ? "ring-2 ring-emerald-300 border-emerald-300" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">{item.exerciseName}</div>
                              <div className="flex items-center gap-2">
                                <OutlineButton
                                  onClick={() => moveDraftExerciseByOffset(item.id, -1)}
                                  className="px-3 py-1.5 text-xs"
                                  disabled={index === 0}
                                >
                                  Opp
                                </OutlineButton>
                                <OutlineButton
                                  onClick={() => moveDraftExerciseByOffset(item.id, 1)}
                                  className="px-3 py-1.5 text-xs"
                                  disabled={index === programExercisesDraft.length - 1}
                                >
                                  Ned
                                </OutlineButton>
                                <OutlineButton onClick={() => removeDraftExercise(item.id)}>Fjern</OutlineButton>
                              </div>
                            </div>
                            {(() => {
                              const linkedExercise = exercisesById.get(item.exerciseId);
                              const isCardio = linkedExercise?.category === "Kondisjon";
                              const isTreadmill = (linkedExercise?.equipment ?? "").trim().toLowerCase().includes("tredem");
                              return (
                            <div className={`grid gap-3 sm:grid-cols-2 ${isCardio ? "xl:grid-cols-5" : "xl:grid-cols-5"}`}>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Antall sett</div>
                                <TextInput value={item.sets} onChange={(e) => updateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                              </div>
                              {isCardio ? (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-medium text-slate-500">Tid (min)</div>
                                  <TextInput value={item.durationMinutes ?? ""} onChange={(e) => updateDraftExercise(item.id, "durationMinutes", e.target.value)} placeholder="Minutter" />
                                </div>
                              ) : (
                                <>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">Antall reps</div>
                                    <TextInput value={item.reps} onChange={(e) => updateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">Kg</div>
                                    <TextInput value={item.weight} onChange={(e) => updateDraftExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                                  </div>
                                </>
                              )}
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
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Hvile (sekunder)</div>
                                <TextInput value={item.restSeconds} onChange={(e) => updateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Notat til øvelsen</div>
                                <TextInput value={item.notes} onChange={(e) => updateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                              </div>
                            </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>

                      <GradientButton
                        onClick={() => {
                          const didSave = saveProgramToSelectedMemberProfiles({
                            id: editingProgramId ?? undefined,
                            title: programTitle,
                            goal: programGoal,
                            notes: programNotes,
                            exercises: programExercisesDraft,
                          });
                          if (didSave) {
                            resetProgramBuilder();
                          }
                        }}
                        className="w-full"
                        disabled={isLocalDemoSession}
                      >
                        {editingProgramId ? "Oppdater program" : "Lagre program på kunde"}
                      </GradientButton>
                      {programSaveStatus ? (
                        <StatusMessage
                          message={programSaveStatus}
                          tone={programSaveStatus.toLowerCase().includes("lagret") ? "success" : "error"}
                          className="!rounded-xl !px-3 !py-2 !text-xs"
                        />
                      ) : null}
                    </div>

                    <div className="rounded-3xl border bg-slate-50 p-4 space-y-3">
                      <div className="font-semibold">Øvelser</div>
                      <TextInput
                        value={programExerciseSearch}
                        onChange={(e) => setProgramExerciseSearch(e.target.value)}
                        placeholder="Søk øvelse, muskelgruppe eller utstyr"
                      />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <SelectBox
                          value={programExerciseCategoryFilter}
                          onChange={(value) => setProgramExerciseCategoryFilter(value as "all" | "Styrke" | "Kondisjon")}
                          options={[
                            { value: "all", label: "Alle typer" },
                            { value: "Styrke", label: "Styrke" },
                            { value: "Kondisjon", label: "Kondisjon" },
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
                      <div className="text-xs text-slate-500">
                        Favoritter vises alltid øverst, resten sorteres alfabetisk.
                      </div>
                      <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                        {visibleProgramExercises.length === 0 ? (
                          <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500 bg-white">
                            Ingen øvelser matcher søk/filter.
                          </div>
                        ) : null}
                        {visibleProgramExercises.map((exercise) => {
                          const isFavorite = favoriteExerciseIds.includes(exercise.id);
                          return (
                            <div
                              key={exercise.id}
                              draggable
                              onDragStart={() => setDraggedExerciseIdFromLibrary(exercise.id)}
                              onDragEnd={() => setDraggedExerciseIdFromLibrary(null)}
                              className="rounded-2xl border bg-white p-3 cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button type="button" onClick={() => addExerciseToDraft(exercise)} className="flex flex-1 items-start gap-2 text-left">
                                  <img
                                    src={getExercisePreviewSrc(exercise)}
                                    alt={exercise.name}
                                    className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover bg-white"
                                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(event) => {
                                      event.currentTarget.src = getExerciseSketchDataUri(exercise);
                                    }}
                                  />
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm">{exercise.name}</div>
                                    <div className="text-xs text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteExercise(exercise.id)}
                                  className={`rounded-lg border p-1.5 ${isFavorite ? "border-transparent text-white" : "border-slate-200 text-slate-400"}`}
                                  style={
                                    isFavorite
                                      ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                                      : { borderColor: "rgba(148,163,184,0.45)" }
                                  }
                                  aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                  title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? "text-white" : ""}`} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    </div>

                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Eksisterende programmer</div>
                      <div className="mt-4 space-y-3">
                        {selectedPrograms.length === 0 ? (
                          <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
                            <div className="text-sm font-semibold text-slate-700">Ingen programmer ennå</div>
                            <div className="mt-1 text-sm text-slate-500">Lag et enkelt program for å komme i gang med kunden.</div>
                            <GradientButton onClick={() => setCustomerSubTab("programs")} className="mt-3 w-full sm:w-auto">
                              Opprett program
                            </GradientButton>
                          </div>
                        ) : null}
                        {selectedPrograms.map((program) => {
                          const firstExercise = exercisesById.get(program.exercises[0]?.exerciseId ?? "");
                          return (
                          <div key={program.id} className="rounded-2xl border bg-white p-4">
                            <div className="flex items-start gap-2">
                              {firstExercise ? (
                                <img
                                  src={getExercisePreviewSrc(firstExercise)}
                                  alt={program.title}
                                  className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover bg-white"
                                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                                  loading="lazy"
                                  decoding="async"
                                  onError={(event) => {
                                    event.currentTarget.src = getExerciseSketchDataUri(firstExercise);
                                  }}
                                />
                              ) : (
                                <div className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.08)" }} />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium">{program.title}</div>
                                <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">{program.exercises.length} øvelser · {program.createdAt}</div>

                            <div className="mt-3 flex gap-2">
                              <OutlineButton onClick={() => startEditProgram(program)}>
                                Rediger
                              </OutlineButton>
                              <OutlineButton onClick={() => handleDeleteProgram(program.id)}>
                                Slett
                              </OutlineButton>
                            </div>
                          </div>
                        )})}
                      </div>
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "workouts" ? (
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="mb-3 grid gap-2 sm:grid-cols-3">
                        <StatCard label="Økter siste 7 dager" value={String(workoutInsights.workoutsLast7Days)} hint="Alle økter" />
                        <StatCard label="Gruppetimer siste 30 dager" value={String(workoutInsights.groupWorkoutsLast30Days)} hint="Kun gruppetimer" />
                        <StatCard label="Snitt belastning 30 dager" value={workoutInsights.averageDifficulty} hint="Basert på refleksjon" />
                      </div>
                      <div className="mb-3 grid gap-2 sm:grid-cols-2">
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
                      <div className="font-semibold">Siste økter</div>
                      {filteredWorkoutLogs.length ? (
                        <div className="mt-3 space-y-2">
                          {filteredWorkoutLogs.slice(0, 12).map((log) => (
                            <button
                              key={log.id}
                              type="button"
                              onClick={() => setSelectedWorkoutLogId(log.id)}
                              className={`w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                filteredSelectedWorkoutLog?.id === log.id
                                  ? "border-emerald-300 bg-emerald-50"
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
                        <div className="mt-3 text-sm text-slate-500">Ingen økter matcher filtrene.</div>
                      )}
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Øktdetaljer</div>
                      {filteredSelectedWorkoutLog ? (
                        <div className="mt-3 space-y-3">
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
                                  <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                                    <div>Plan: {result.plannedSets} x {result.plannedReps} @ {result.plannedWeight || "0"} kg</div>
                                    <div>Utført: {result.performedReps || "-"} reps @ {result.performedWeight || "-"} kg</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">Ingen detaljerte sett registrert på denne økten.</div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500">Velg en økt for å se detaljer.</div>
                      )}
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "messages" ? (
                  <div className="rounded-3xl border bg-slate-50 p-4 space-y-4">
                    <div className="font-semibold">Dialog med kunde</div>
                    <div className="max-h-64 space-y-3 overflow-auto rounded-2xl border bg-white p-4">
                      {selectedMessages.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-500">
                          Ingen meldinger ennå. Send en kort velkomstmelding for bedre oppstart.
                        </div>
                      ) : null}
                      {selectedMessages.map((message) => (
                        <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.id === selectedMessages[selectedMessages.length - 1]?.id ? "motus-fade-in-up" : ""} ${message.sender === "trainer" ? "text-white ml-auto" : "bg-slate-50 border"}`} style={message.sender === "trainer" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                          <div>{message.text}</div>
                          <div className={`mt-1 text-[11px] ${message.sender === "trainer" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <TextInput
                        value={trainerMessage}
                        onChange={(e) => setTrainerMessage(e.target.value)}
                        placeholder="Skriv melding til kunden"
                      />
                      <GradientButton
                        onClick={() => {
                          if (!selectedMemberId || selectedMemberId === "__template__" || !trainerMessage.trim()) return;
                          sendTrainerMessage(selectedMemberId, trainerMessage);
                          setTrainerMessage("");
                        }}
                      >
                        Send
                      </GradientButton>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-slate-500">
                <div>Velg en kunde i listen for å se kundekort, programmer og meldinger.</div>
                <div className="mx-auto max-w-sm rounded-xl border bg-white p-4 text-left text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="font-semibold text-slate-700">Forslag til neste steg</div>
                  <ol className="mt-2 space-y-1 text-slate-600">
                    <li>1. Opprett eller velg en kunde</li>
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
      ) : null}

      {trainerTab === "programs" ? (
        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Lag treningsmal</h2>
                <p className="text-sm text-slate-500">Bygg mal med filtrering, favoritter og drag-and-drop</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3">
                <TextInput value={templateProgramTitle} onChange={(e) => setTemplateProgramTitle(e.target.value)} placeholder="Navn på treningsmal" />
                <div className="rounded-2xl border bg-white p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-700">Kondisjonsmal med nedtelling</div>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <SelectBox
                      value={selectedIntervalPresetId}
                      onChange={setSelectedIntervalPresetId}
                      options={intervalPresets.map((preset) => ({ value: preset.id, label: preset.name }))}
                    />
                    <GradientButton onClick={generateIntervalTemplateDraft} className="w-full md:w-auto">
                      Lag kondisjonsmal
                    </GradientButton>
                  </div>
                  <div className="text-xs text-slate-500">
                    {intervalPresets.find((preset) => preset.id === selectedIntervalPresetId)?.description}
                    {" "}Lager malutkast med nedtelling som kan lagres og tildeles kunde.
                  </div>
                </div>
                <div
                  className={`space-y-3 rounded-2xl p-1 transition ${
                    isDraftDropZoneActive ? "bg-emerald-50 ring-2 ring-emerald-300" : ""
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
                  {programExercisesDraft.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen øvelser valgt ennå.</div> : null}
                  {programExercisesDraft.map((item, index) => (
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
                      className={`rounded-2xl border bg-white p-4 space-y-3 cursor-move transition ${
                        dragOverDraftExerciseId === item.id ? "ring-2 ring-emerald-300 border-emerald-300" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{item.exerciseName}</div>
                        <div className="flex items-center gap-2">
                          <OutlineButton
                            onClick={() => moveDraftExerciseByOffset(item.id, -1)}
                            className="px-3 py-1.5 text-xs"
                            disabled={index === 0}
                          >
                            Opp
                          </OutlineButton>
                          <OutlineButton
                            onClick={() => moveDraftExerciseByOffset(item.id, 1)}
                            className="px-3 py-1.5 text-xs"
                            disabled={index === programExercisesDraft.length - 1}
                          >
                            Ned
                          </OutlineButton>
                          <OutlineButton onClick={() => removeDraftExercise(item.id)}>Fjern</OutlineButton>
                        </div>
                      </div>
                      {(() => {
                        const linkedExercise = exercisesById.get(item.exerciseId);
                        const isCardio = linkedExercise?.category === "Kondisjon";
                        const isTreadmill = (linkedExercise?.equipment ?? "").trim().toLowerCase().includes("tredem");
                        return (
                      <div className={`grid gap-3 sm:grid-cols-2 ${isCardio ? "xl:grid-cols-5" : "xl:grid-cols-5"}`}>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Antall sett</div>
                          <TextInput value={item.sets} onChange={(e) => updateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                        </div>
                        {isCardio ? (
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500">Tid (min)</div>
                            <TextInput value={item.durationMinutes ?? ""} onChange={(e) => updateDraftExercise(item.id, "durationMinutes", e.target.value)} placeholder="Minutter" />
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-slate-500">Antall reps</div>
                              <TextInput value={item.reps} onChange={(e) => updateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-[11px] font-medium text-slate-500">Kg</div>
                              <TextInput value={item.weight} onChange={(e) => updateDraftExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                            </div>
                          </>
                        )}
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
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Hvile (sekunder)</div>
                          <TextInput value={item.restSeconds} onChange={(e) => updateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Notat til øvelsen</div>
                          <TextInput value={item.notes} onChange={(e) => updateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
                <GradientButton
                  onClick={saveTemplateFromProgramsTab}
                  className="w-full"
                >
                  {editingTemplateProgramId ? "Lagre endringer i mal" : "Lagre treningsmal"}
                </GradientButton>
                {editingTemplateProgramId ? (
                  <OutlineButton onClick={resetTemplateProgramBuilder} className="w-full">
                    Avbryt redigering
                  </OutlineButton>
                ) : null}
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="font-semibold">Øvelser</div>
                <TextInput
                  value={programExerciseSearch}
                  onChange={(e) => setProgramExerciseSearch(e.target.value)}
                  placeholder="Søk øvelse, muskelgruppe eller utstyr"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <SelectBox
                    value={programExerciseCategoryFilter}
                    onChange={(value) => setProgramExerciseCategoryFilter(value as "all" | "Styrke" | "Kondisjon")}
                    options={[
                      { value: "all", label: "Alle typer" },
                      { value: "Styrke", label: "Styrke" },
                      { value: "Kondisjon", label: "Kondisjon" },
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
                <div className="text-xs text-slate-500">Favoritter vises alltid øverst, resten sorteres alfabetisk.</div>
                <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
                  {visibleProgramExercises.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500 bg-white">Ingen øvelser matcher søk/filter.</div>
                  ) : null}
                  {visibleProgramExercises.map((exercise) => {
                    const isFavorite = favoriteExerciseIds.includes(exercise.id);
                    return (
                      <div
                        key={exercise.id}
                        draggable
                        onDragStart={() => setDraggedExerciseIdFromLibrary(exercise.id)}
                        onDragEnd={() => setDraggedExerciseIdFromLibrary(null)}
                        className="rounded-2xl border bg-white p-3 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button type="button" onClick={() => addExerciseToDraft(exercise)} className="flex flex-1 items-start gap-2 text-left">
                            <img
                              src={getExercisePreviewSrc(exercise)}
                              alt={exercise.name}
                              className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover bg-white"
                              style={{ borderColor: "rgba(15,23,42,0.08)" }}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.src = getExerciseSketchDataUri(exercise);
                              }}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-sm">{exercise.name}</div>
                              <div className="text-xs text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavoriteExercise(exercise.id)}
                            className={`rounded-lg border p-1.5 ${isFavorite ? "border-transparent text-white" : "border-slate-200 text-slate-400"}`}
                            style={
                              isFavorite
                                ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                                : { borderColor: "rgba(148,163,184,0.45)" }
                            }
                            aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                            title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                          >
                            <Star className={`h-4 w-4 ${isFavorite ? "text-white" : ""}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Lagrede treningsmaler</div>
                  <div className="text-xs text-slate-500">{templatePrograms.length} maler</div>
                </div>
                {templatePrograms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-slate-500">
                    Ingen treningsmaler lagret ennå.
                  </div>
                ) : null}
                <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                  {templatePrograms.map((program) => {
                    const isExpanded = expandedTemplateProgramId === program.id;
                    return (
                    <div key={program.id} className="rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">{program.title}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {program.exercises.length} øvelse(r){program.createdAt ? ` · ${program.createdAt}` : ""}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <OutlineButton onClick={() => setExpandedTemplateProgramId((prev) => (prev === program.id ? null : program.id))} className="px-3 py-1.5 text-xs">
                            {isExpanded ? "Skjul" : "Vis"}
                          </OutlineButton>
                          <OutlineButton onClick={() => startEditTemplateProgram(program)} className="px-3 py-1.5 text-xs">
                            Rediger
                          </OutlineButton>
                          <OutlineButton onClick={() => deleteTemplateProgram(program)} className="px-3 py-1.5 text-xs text-rose-700">
                            Slett
                          </OutlineButton>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="mt-3 space-y-2">
                          {program.notes ? (
                            <div className="rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              {program.notes}
                            </div>
                          ) : null}
                          {program.exercises.length === 0 ? (
                            <div className="rounded-lg border border-dashed bg-slate-50 px-2.5 py-2 text-xs text-slate-500">
                              Ingen øvelser i malen ennå.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {program.exercises.map((exercise) => (
                                <div key={exercise.id} className="rounded-lg border bg-slate-50 px-2.5 py-2 text-xs text-slate-700" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                                  <div className="font-medium text-slate-800">{exercise.exerciseName}</div>
                                  <div className="mt-0.5 text-slate-500">
                                    {exercise.durationMinutes
                                      ? `${exercise.sets || "-"} runder × ${exercise.durationMinutes || "-"} min${exercise.speed ? ` · ${exercise.speed} km/t` : ""}${exercise.incline ? ` · ${exercise.incline}%` : ""} · ${exercise.restSeconds || "0"}s`
                                      : `${exercise.sets || "-"}×${exercise.reps || "-"} · ${exercise.weight || "0"}kg · ${exercise.restSeconds || "0"}s`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )})}
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="font-semibold">Tildel mal til kunde</div>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectBox
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  options={deduplicatedMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                />
                <SelectBox
                  value={selectedTemplateProgramId}
                  onChange={setSelectedTemplateProgramId}
                  options={
                    templatePrograms.length
                      ? templatePrograms.map((program) => ({ value: program.id, label: program.title }))
                      : [{ value: "", label: "Ingen treningsmaler lagret ennå" }]
                  }
                />
              </div>
              <GradientButton onClick={assignSelectedTemplateToMember} className="w-full md:w-auto">
                Tildel mal til valgt kunde
              </GradientButton>
              {templateAssignStatus ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {templateAssignStatus}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {trainerTab === "exerciseBank" ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Dumbbell className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Øvelsesbank</h2>
              <p className="text-sm text-slate-500">Opprett og rediger øvelser med forklaring, kategori og utstyr.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="font-semibold">{editingExerciseId ? "Rediger øvelse" : "Legg til ny øvelse"}</div>
              <TextInput value={exerciseFormName} onChange={(e) => setExerciseFormName(e.target.value)} placeholder="Navn på øvelse" />
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectBox
                  value={exerciseFormCategory}
                  onChange={(value) => setExerciseFormCategory(value as Exercise["category"])}
                  options={["Styrke", "Kondisjon", "Uttøyning"]}
                />
                <SelectBox
                  value={exerciseFormLevel}
                  onChange={(value) => setExerciseFormLevel(value as Exercise["level"])}
                  options={["Nybegynner", "Litt øvet", "Øvet"]}
                />
              </div>
              <SelectBox
                value={exerciseFormGroup}
                onChange={setExerciseFormGroup}
                options={[
                  { value: "", label: "Velg muskelgruppe / fokusområde" },
                  ...exerciseFormGroupOptions.map((group) => ({ value: group, label: group })),
                ]}
              />
              <TextInput value={exerciseFormEquipment} onChange={(e) => setExerciseFormEquipment(e.target.value)} placeholder="Utstyr (f.eks. stang, manualer, kroppsvekt)" />
              <TextInput value={exerciseFormImageUrl} onChange={(e) => setExerciseFormImageUrl(e.target.value)} placeholder="Bilde-URL (valgfritt). La stå tom for auto-skisse." />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(event) => {
                        const selectedFile = event.currentTarget.files?.[0] ?? null;
                        void handleExerciseImageUpload(selectedFile);
                        event.currentTarget.value = "";
                      }}
                      disabled={isUploadingExerciseImage}
                    />
                    <span
                      className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-medium ${
                        isUploadingExerciseImage ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"
                      }`}
                    >
                      {isUploadingExerciseImage ? "Laster opp..." : "Last opp bilde"}
                    </span>
                  </label>
                  <div className="text-xs text-slate-500">JPG/PNG/WEBP, maks 5 MB.</div>
                </div>
                {exerciseFormImageUrl.trim() ? (
                  <img
                    src={exerciseFormImageUrl}
                    alt="Forhåndsvisning av øvelsesbilde"
                    className="h-20 w-20 rounded-xl border bg-white object-cover"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                    onError={(event) => {
                      event.currentTarget.src = getExerciseSketchDataUri({
                        id: "preview",
                        name: exerciseFormName || "preview",
                        category: exerciseFormCategory,
                        group: exerciseFormGroup || "",
                        equipment: exerciseFormEquipment || "",
                        level: exerciseFormLevel,
                        description: exerciseFormDescription || "",
                      });
                    }}
                  />
                ) : null}
              </div>
              <TextArea value={exerciseFormDescription} onChange={(e) => setExerciseFormDescription(e.target.value)} className="min-h-[110px]" placeholder="Forklaring av teknikk og utførelse" />
              {exerciseFormStatus ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{exerciseFormStatus}</div> : null}
              <div className="grid gap-2 sm:grid-cols-2">
                <GradientButton onClick={submitExerciseForm} className="w-full">
                  {editingExerciseId ? "Lagre endring" : "Legg til øvelse"}
                </GradientButton>
                {editingExerciseId ? <OutlineButton onClick={resetExerciseForm} className="w-full">Avbryt</OutlineButton> : null}
              </div>
              <div className="text-xs text-slate-500">
                Øvelser lagres i felles øvelsesbank slik at alle trenere kan bruke dem.
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <TextInput value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Søk på navn, muskelgruppe, utstyr eller forklaring" />
                <SelectBox
                  value={exerciseCategoryFilter}
                  onChange={(value) => setExerciseCategoryFilter(value as "all" | Exercise["category"])}
                  options={[
                    { value: "all", label: "Alle kategorier" },
                    { value: "Styrke", label: "Styrke" },
                    { value: "Kondisjon", label: "Kondisjon" },
                    { value: "Uttøyning", label: "Uttøyning" },
                  ]}
                />
              </div>
              <div className="text-xs text-slate-500">{visibleExercises.length} øvelser vist</div>
              <div className="text-xs text-slate-500">Favoritter vises alltid øverst.</div>
              <div className="space-y-2">
                {visibleExercises.map((exercise) => {
                  const isFavorite = favoriteExerciseIds.includes(exercise.id);
                  return (
                  <div
                    key={exercise.id}
                    className="rounded-2xl border bg-slate-50 px-3 py-2.5"
                    style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                        className="min-w-0 flex flex-1 items-start gap-2 text-left"
                      >
                        <img
                          src={getExercisePreviewSrc(exercise)}
                          alt={exercise.name}
                          className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border object-cover bg-white"
                          style={{ borderColor: "rgba(15,23,42,0.08)" }}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.src = getExerciseSketchDataUri(exercise);
                          }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium leading-tight">{exercise.name}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {exercise.category} · {exercise.group} · Utstyr: {exercise.equipment} · {exercise.level}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteExercise(exercise.id)}
                          className={`rounded-lg border p-1.5 ${isFavorite ? "border-transparent text-white" : "border-slate-200 text-slate-400"}`}
                          style={
                            isFavorite
                              ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                              : { borderColor: "rgba(148,163,184,0.45)" }
                          }
                          aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                          title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? "text-white" : ""}`} />
                        </button>
                        <OutlineButton
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditExercise(exercise);
                          }}
                          className="px-3 py-1.5 text-xs"
                        >
                          Rediger
                        </OutlineButton>
                        <OutlineButton onClick={() => handleDeleteExercise(exercise)} className="px-3 py-1.5 text-xs text-rose-700">
                          Slett
                        </OutlineButton>
                        <OutlineButton onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))} className="px-3 py-1.5 text-xs">
                          {expandedExerciseId === exercise.id ? "Skjul" : "Vis"}
                        </OutlineButton>
                      </div>
                    </div>
                    {expandedExerciseId === exercise.id && editingExerciseId !== exercise.id ? (
                      <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{exercise.description}</div>
                    ) : null}
                    {editingExerciseId === exercise.id ? (
                      <div id={`inline-exercise-edit-${exercise.id}`} className="mt-3 rounded-xl border bg-white p-3 space-y-2.5" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
                        <div className="text-xs font-semibold text-slate-600">Rediger øvelse her</div>
                        <TextInput value={exerciseFormName} onChange={(e) => setExerciseFormName(e.target.value)} placeholder="Navn på øvelse" />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <SelectBox
                            value={exerciseFormCategory}
                            onChange={(value) => setExerciseFormCategory(value as Exercise["category"])}
                            options={["Styrke", "Kondisjon", "Uttøyning"]}
                          />
                          <SelectBox
                            value={exerciseFormLevel}
                            onChange={(value) => setExerciseFormLevel(value as Exercise["level"])}
                            options={["Nybegynner", "Litt øvet", "Øvet"]}
                          />
                        </div>
                        <SelectBox
                          value={exerciseFormGroup}
                          onChange={setExerciseFormGroup}
                          options={[
                            { value: "", label: "Velg muskelgruppe / fokusområde" },
                            ...exerciseFormGroupOptions.map((group) => ({ value: group, label: group })),
                          ]}
                        />
                        <TextInput value={exerciseFormEquipment} onChange={(e) => setExerciseFormEquipment(e.target.value)} placeholder="Utstyr (f.eks. stang, manualer, kroppsvekt)" />
                        <TextInput value={exerciseFormImageUrl} onChange={(e) => setExerciseFormImageUrl(e.target.value)} placeholder="Bilde-URL (valgfritt)" />
                        <TextArea value={exerciseFormDescription} onChange={(e) => setExerciseFormDescription(e.target.value)} className="min-h-[90px]" placeholder="Forklaring av teknikk og utførelse" />
                        <div className="flex gap-2">
                          <GradientButton onClick={submitExerciseForm} className="w-full">
                            Lagre endring
                          </GradientButton>
                          <OutlineButton onClick={resetExerciseForm} className="w-full">
                            Avbryt
                          </OutlineButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )})}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {trainerTab === "messages" ? (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><MessageSquare className="h-5 w-5" /></div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Rask melding til valgt kunde</h2>
            <p className="text-sm text-slate-500">Enklere melding enn i den store fila</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <TextInput value={trainerMessage} onChange={(e) => setTrainerMessage(e.target.value)} placeholder="Skriv melding til kunden" />
          <GradientButton onClick={() => {
            if (!selectedMemberId || !trainerMessage.trim()) return;
            sendTrainerMessage(selectedMemberId, trainerMessage);
            setTrainerMessage("");
          }}>Send</GradientButton>
        </div>
      </Card>
      ) : null}

      {trainerTab === "admin" ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Admin</h2>
              <p className="text-sm text-slate-500">Inviter nye PT-er til appen</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Driftsstatus</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Backend</div>
                <div className="font-semibold text-slate-800">{isSupabaseConfigured ? "Supabase tilkoblet" : "Lokal modus"}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Rolle</div>
                <div className="font-semibold text-slate-800">Trener</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Sesjon</div>
                <div className="font-semibold text-slate-800">{isLocalDemoSession ? "Demo (lokal)" : "Ekte innlogging"}</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Helsesjekk</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Aktive kunder</div>
                <div className="font-semibold text-slate-800">{deduplicatedMembers.filter((member) => member.isActive !== false).length}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Duplikatgrupper</div>
                <div className="font-semibold text-slate-800">{adminDuplicateGroupCount ?? "Ukjent"}</div>
              </div>
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Siste opprydding</div>
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
              {isRefreshingAdminHealth ? "Oppdaterer helsesjekk..." : "Oppdater helsesjekk"}
            </OutlineButton>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Legg til medlem</div>
            <TextInput value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Navn" />
            <TextInput value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="E-post" />
            <TextInput value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="Telefon (valgfritt)" />
            <TextInput value={newMemberGoal} onChange={(e) => setNewMemberGoal(e.target.value)} placeholder="Hovedmål (valgfritt)" />
            <TextInput value={newMemberFocus} onChange={(e) => setNewMemberFocus(e.target.value)} placeholder="Fokus (valgfritt)" />
            {newMemberError ? <StatusMessage message={newMemberError} tone="error" className="!rounded-xl !px-3 !py-2 !text-xs" /> : null}
            <GradientButton onClick={() => submitNewMember()} className="w-full md:w-auto">Opprett medlem</GradientButton>
            <OutlineButton onClick={() => submitNewMember({ inviteAfterCreate: true })} className="w-full md:w-auto">
              Opprett + send invitasjon
            </OutlineButton>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
          <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="text-sm font-semibold text-slate-700">Sikker opprydding av duplikatkunder</div>
            <div className="text-xs text-slate-600">
              Kjører dry-run først og deretter sikker sammenslåing av duplikater per e-post (ingen hard delete).
            </div>
            {memberDedupeStatus ? (
              <StatusMessage
                message={memberDedupeStatus}
                tone={memberDedupeStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
            <OutlineButton onClick={() => void handleRunSafeMemberCleanup()} className="w-full md:w-auto" disabled={isRunningMemberDedupe}>
              {isRunningMemberDedupe ? "Kjører opprydding..." : "Kjør sikker opprydding"}
            </OutlineButton>
          </div>
        </Card>
      ) : null}
    </div>
    </>
  );
}
