import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Dumbbell, Eye, EyeOff, Pencil, ShieldCheck, Star, Trash2, Users } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import { getStatusClearDelayMs, useAutoClearStatus } from "../app/statusAutoClear";
import { isLikelyValidBirthDate, isValidEmail, normalizeBirthDate, normalizePhone } from "../app/validators";
import { uid } from "../app/storage";
import { Card, ConfirmDialog, DangerButton, EmptyState, GradientButton, OutlineButton, PillButton, SelectBox, StatCard, StatusMessage, TextArea, TextInput } from "../app/ui";
import { useToastStatus } from "../app/toast";
import motusSkrytekortLogo from "../assets/motus-skrytekort-logo.png";
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

function getMemberInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "M";
}

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
  saveProgramForMember: (input: {
    id?: string;
    title: string;
    goal: string;
    notes: string;
    memberId: string;
    exercises: ProgramExercise[];
    programCreatedBy?: "member" | "trainer";
    programCreatedByName?: string;
  }) => void;
  deleteProgramById: (programId: string) => void;
  sendTrainerMessage: (memberId: string, text: string) => void;
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
  }) => void;
  deleteExercise: (exerciseId: string) => void;
  openCustomerMessagesSignal?: number;
  memberAvatarById?: Record<string, string>;
  setMemberAvatarUrlForMember?: (memberId: string, avatarUrl: string) => void;
  isLocalDemoSession?: boolean;
  canAccessAdminTools?: boolean;
  /** Innlogget treners visningsnavn — brukes når program lagres på kunde. */
  trainerAccountName?: string;
  /** Synket fra Supabase ved hydrering (per medlem, inkl. tom liste). */
  remoteTrainerPeriodPlansByMemberId?: Record<string, PeriodSchedulePlan[]>;
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
  // Norwegian dd.mm.yyyy must be parsed explicitly; `new Date("04.05.2026")` is often read as US m/d/y.
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  const iso = new Date(value);
  if (!Number.isNaN(iso.getTime())) return iso.getTime();
  return 0;
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

/** Relaterte medlems-ID-er (e-post/navn) for valgt rad — brukes når listen oppdateres uten at det logisk er en annen kunde. */
function computeSelectedMemberRelatedIds(members: Member[], selectedMemberId: string | null): string[] {
  if (selectedMemberId === "__template__") return [];
  if (!selectedMemberId) return [];
  const selected = members.find((member) => member.id === selectedMemberId);
  if (!selected) return [selectedMemberId];
  const normalizedEmail = selected.email.trim().toLowerCase();
  const normalizedName = selected.name.trim().toLowerCase();
  const byEmailIds = normalizedEmail
    ? members.filter((member) => member.email.trim().toLowerCase() === normalizedEmail).map((member) => member.id)
    : [];
  // Legacy data may contain duplicated member rows where email changed between IDs.
  // Include name matches so trainer still sees historical logs/programs.
  const byNameIds = normalizedName
    ? members.filter((member) => member.name.trim().toLowerCase() === normalizedName).map((member) => member.id)
    : [];
  const merged = Array.from(new Set([...byEmailIds, ...byNameIds, selectedMemberId]));
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

function programAuthorLabel(program: TrainingProgram): string | null {
  if (program.programCreatedBy === "member") {
    const memberName = pickFirstName(program.programCreatedByName ?? "");
    return memberName ? `Lagret av medlem ${memberName}` : "Lagret av medlem";
  }
  if (program.programCreatedBy === "trainer") {
    const trainerName = pickFirstName(program.programCreatedByName ?? "");
    return trainerName ? `Lagret av trener ${trainerName}` : "Lagret av trener";
  }
  const legacyTrainer = pickFirstName(program.assignedTrainerName ?? "");
  return legacyTrainer ? `Lagret av trener ${legacyTrainer}` : null;
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
    clearLocalChatCache,
    saveExercise,
    deleteExercise,
    openCustomerMessagesSignal = 0,
    memberAvatarById = {},
    setMemberAvatarUrlForMember,
    isLocalDemoSession = false,
    canAccessAdminTools = true,
    remoteTrainerPeriodPlansByMemberId = {},
    trainerAccountName = "",
  } = props;

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [isSendingTrainerMessage, setIsSendingTrainerMessage] = useState(false);
  const isSendingTrainerMessageRef = useRef(false);
  const pendingInviteSendKeyRef = useRef("");
  const manualInviteSendKeyRef = useRef("");
  const lastTrainerSendKeyRef = useRef<string>("");
  const lastTrainerSendAtRef = useRef<number>(0);
  const trainerMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  const trainerSendAttemptRef = useRef(0);
  const [trainerChatSendStatus, setTrainerChatSendStatus] = useState<string | null>(null);
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
  const [newMemberInviteType, setNewMemberInviteType] = useState<"PT-kunde" | "Premium-kunde" | "Medlem">("PT-kunde");
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [pendingProgramMemberEmail, setPendingProgramMemberEmail] = useState<string | null>(null);
  const [pendingInviteMemberEmail, setPendingInviteMemberEmail] = useState<string | null>(null);
  const [newTrainerEmail, setNewTrainerEmail] = useState("");
  const [newTrainerName, setNewTrainerName] = useState("");
  const [inviteTrainerStatus, setInviteTrainerStatus] = useState<string | null>(null);
  const [isInvitingTrainer, setIsInvitingTrainer] = useState(false);
  const [showInactiveMembers, setShowInactiveMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "followUp" | "invited" | "notInvited">("all");
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
  const [isEditingCustomerCard, setIsEditingCustomerCard] = useState(false);
  const [memberEditStatus, setMemberEditStatus] = useState<string | null>(null);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [isRestoringMember, setIsRestoringMember] = useState(false);
  const [memberDedupeStatus, setMemberDedupeStatus] = useState<string | null>(null);
  const [isRunningMemberDedupe, setIsRunningMemberDedupe] = useState(false);
  const [adminHealthStatus, setAdminHealthStatus] = useState<string | null>(null);
  const [adminCacheStatus, setAdminCacheStatus] = useState<string | null>(null);
  const [currentTrainerOwnerUserId, setCurrentTrainerOwnerUserId] = useState("");
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
  const [followUpDetailsByMemberId, setFollowUpDetailsByMemberId] = useState<Record<string, FollowUpDetail[]>>(() => {
    if (typeof window === "undefined") return {};
    return migrateFollowUpDetailsFromStorage(window.localStorage.getItem("motus.trainer.followUpDetailsByMemberId"));
  });
  const [followUpMethodDraft, setFollowUpMethodDraft] = useState<FollowUpDetail["method"]>("melding");
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [followUpSaveStatus, setFollowUpSaveStatus] = useState<string | null>(null);
  const [editingFollowUpEntryId, setEditingFollowUpEntryId] = useState<string | null>(null);
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
  const editLockedIdentityRef = useRef<{ email: string; name: string } | null>(null);
  const [workoutDateRangeFilter, setWorkoutDateRangeFilter] = useState<"7d" | "30d" | "all">("all");
  const [workoutTypeFilter, setWorkoutTypeFilter] = useState<"all" | "program" | "group">("all");
  const [workoutSearchQuery, setWorkoutSearchQuery] = useState("");
  const [workoutSortOrder, setWorkoutSortOrder] = useState<"newest" | "oldest">("newest");
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
  useToastStatus(trainerChatSendStatus, { title: "Meldinger", tone: inferStatusTone });
  useToastStatus(programSaveStatus, { title: "Treningsprogram", tone: inferStatusTone });
  useToastStatus(inviteTrainerStatus, { title: "PT-invitasjon", tone: inferStatusTone });
  useToastStatus(inviteStatus, { title: "Invitasjon", tone: inferStatusTone });
  useToastStatus(memberEditStatus, { title: "Kundekort", tone: inferStatusTone });
  useToastStatus(memberLinkStatus, { title: "Medlemskobling", tone: inferStatusTone });
  useToastStatus(exerciseFormStatus, { title: "Øvelse", tone: inferStatusTone });
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const selectedMemberHasMessagingAccess = selectedMember
    ? selectedMember.customerType === "PT-kunde" || selectedMember.membershipType === "Premium"
    : false;
  const selectedMemberMessagesLocked = Boolean(selectedMember && !selectedMemberHasMessagingAccess);
  function getMemberIdentityKey(member: Member): string {
    const emailKey = member.email.trim().toLowerCase();
    const nameKey = member.name.trim().toLowerCase();
    return emailKey || `name:${nameKey}`;
  }
  function pickCanonicalMemberProfile(base: Member, candidates: Member[]): Member {
    if (!candidates.length) return base;
    const scoreProfileSource = (member: Member): number => {
      let score = 0;
      if (member.customerType === "Medlem") score += 1000;
      if (member.isActive !== false) score += 100;
      if (member.membershipType === "Premium") score += 10;
      return score;
    };
    const prioritized = [...candidates].sort((a, b) => scoreProfileSource(b) - scoreProfileSource(a));
    const pickPreferredNonEmpty = (values: string[]): string => {
      for (let i = 0; i < values.length; i += 1) {
        const value = String(values[i] ?? "").trim();
        if (value) return value;
      }
      return "";
    };
    const names = prioritized.map((member) => member.name);
    const phones = prioritized.map((member) => member.phone);
    const birthDates = prioritized.map((member) => member.birthDate);
    const goals = prioritized.map((member) => member.goal);
    const injuries = prioritized.map((member) => member.injuries);
    return {
      ...base,
      name: pickPreferredNonEmpty(names) || base.name,
      phone: pickPreferredNonEmpty(phones) || base.phone,
      birthDate: pickPreferredNonEmpty(birthDates) || base.birthDate,
      goal: pickPreferredNonEmpty(goals) || base.goal,
      injuries: pickPreferredNonEmpty(injuries) || base.injuries,
    };
  }
  const deduplicatedMembers = useMemo(() => {
    function memberScore(member: Member): number {
      let score = 0;
      if (member.customerType === "Medlem") score += 2000;
      if ((member.ownerUserId ?? "").trim() && (member.ownerUserId ?? "").trim() === currentTrainerOwnerUserId) score += 1000;
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
      const sorted = [...group].sort((a, b) => memberScore(b) - memberScore(a));
      const base = sorted[0] ?? group[0];
      if (!base) continue;
      const names = group.map((member) => member.name);
      const phones = group.map((member) => member.phone);
      const birthDates = group.map((member) => member.birthDate);
      const goals = group.map((member) => member.goal);
      const injuries = group.map((member) => member.injuries);
      merged.push({
        ...base,
        name: pickLatestNonEmpty(names) || base.name,
        phone: pickLatestNonEmpty(phones) || base.phone,
        birthDate: pickLatestNonEmpty(birthDates) || base.birthDate,
        goal: pickLatestNonEmpty(goals) || base.goal,
        injuries: pickLatestNonEmpty(injuries) || base.injuries,
      });
    }
    return merged;
  }, [members, currentTrainerOwnerUserId]);
  const activeMembers = useMemo(
    () => deduplicatedMembers.filter((member) => member.isActive !== false),
    [deduplicatedMembers]
  );
  const visibleMembers = showInactiveMembers
    ? deduplicatedMembers
    : activeMembers;
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
      const aInvited = a.invitedAt ? 1 : 0;
      const bInvited = b.invitedAt ? 1 : 0;
      return aInvited - bInvited;
    })[0] ?? null;
  }, [members, currentTrainerOwnerUserId]);
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
  const selectedMemberRelatedIds = useMemo(
    () => computeSelectedMemberRelatedIds(members, selectedMemberId),
    [members, selectedMemberId]
  );
  const selectedMemberRelatedIdSet = useMemo(() => new Set(selectedMemberRelatedIds), [selectedMemberRelatedIds]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const selectedMemberProfileSourceMembers = useMemo(() => {
    if (!selectedMember) return [] as Member[];
    const selectedEmail = selectedMember.email.trim().toLowerCase();
    const selectedName = selectedMember.name.trim().toLowerCase();
    const byEmail = selectedEmail
      ? members.filter((member) => member.email.trim().toLowerCase() === selectedEmail)
      : [];
    if (byEmail.length > 0) return byEmail;
    if (selectedName) {
      return members.filter((member) => member.name.trim().toLowerCase() === selectedName);
    }
    return [selectedMember];
  }, [selectedMember, members]);
  const selectedMemberProfile = useMemo(() => {
    if (!selectedMember) return null;
    const relatedMembers = selectedMemberProfileSourceMembers;
    return pickCanonicalMemberProfile(selectedMember, relatedMembers);
  }, [selectedMember, selectedMemberProfileSourceMembers]);
  const selectedPrograms = useMemo(
    () => {
      const selected = members.find((member) => member.id === selectedMemberId) ?? null;
      const isSharedMember = selected?.customerType === "Medlem";
      const selectedEmail = selected?.email.trim().toLowerCase() ?? "";
      const selectedName = selected?.name.trim().toLowerCase() ?? "";
      const matchingPrograms = programs
        .filter((program) => {
          if (selectedMemberRelatedIdSet.has(program.memberId)) return true;
          if (!isSharedMember) return false;
          const rawProgramMemberId = program.memberId.trim().toLowerCase();
          if (selectedEmail && rawProgramMemberId === selectedEmail) return true;
          const ownerMember = memberById.get(program.memberId);
          if (!ownerMember) return false;
          const ownerEmail = ownerMember.email.trim().toLowerCase();
          const ownerName = ownerMember.name.trim().toLowerCase();
          if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
          if (selectedName && ownerName && ownerName === selectedName) return true;
          return false;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const uniqueByFingerprint = new Map<string, TrainingProgram>();
      matchingPrograms.forEach((program) => {
        const fingerprint = buildProgramFingerprint(program.exercises, program.title, program.goal, program.notes);
        const existing = uniqueByFingerprint.get(fingerprint);
        if (!existing || program.createdAt.localeCompare(existing.createdAt) > 0) {
          uniqueByFingerprint.set(fingerprint, program);
        }
      });
      return Array.from(uniqueByFingerprint.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    [programs, selectedMemberRelatedIdSet, members, selectedMemberId, memberById]
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
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const isSharedMember = selected?.customerType === "Medlem";
    const selectedEmail = selected?.email.trim().toLowerCase() ?? "";
    const selectedName = selected?.name.trim().toLowerCase() ?? "";
    return logs
      .filter((log) => {
        if (selectedMemberRelatedIdSet.has(log.memberId)) return true;
        if (!isSharedMember) return false;
        const rawLogMemberId = log.memberId.trim().toLowerCase();
        if (selectedEmail && rawLogMemberId === selectedEmail) return true;
        const ownerMember = memberById.get(log.memberId);
        if (!ownerMember) return false;
        const ownerEmail = ownerMember.email.trim().toLowerCase();
        const ownerName = ownerMember.name.trim().toLowerCase();
        if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
        if (selectedName && ownerName && ownerName === selectedName) return true;
        return false;
      })
      .sort((a, b) => parseLogDateMs(b.date) - parseLogDateMs(a.date));
  }, [logs, selectedMemberRelatedIdSet, members, selectedMemberId, memberById]);
  const selectedMessages = useMemo(() => {
    const selected = members.find((member) => member.id === selectedMemberId) ?? null;
    const isSharedMember = selected?.customerType === "Medlem";
    const selectedEmail = selected?.email.trim().toLowerCase() ?? "";
    const selectedName = selected?.name.trim().toLowerCase() ?? "";
    const filtered = messages
      .filter((message) => {
        if (selectedMemberRelatedIdSet.has(message.memberId)) return true;
        if (!isSharedMember) return false;
        const rawMessageMemberId = message.memberId.trim().toLowerCase();
        if (selectedEmail && rawMessageMemberId === selectedEmail) return true;
        const ownerMember = memberById.get(message.memberId);
        if (!ownerMember) return false;
        const ownerEmail = ownerMember.email.trim().toLowerCase();
        const ownerName = ownerMember.name.trim().toLowerCase();
        if (selectedEmail && ownerEmail && ownerEmail === selectedEmail) return true;
        if (selectedName && ownerName && ownerName === selectedName) return true;
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
  useEffect(() => {
    if (customerSubTab !== "messages") return;
    const container = trainerMessagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [customerSubTab, selectedMessages.length]);
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
      if (programExerciseCategoryFilter !== "all" && exercise.category !== programExerciseCategoryFilter) return false;
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
  }, [isLocalDemoSession, remoteTrainerPeriodPlansByMemberId]);

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
          markMemberInvited(createdMember.id, new Date().toISOString());
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
      setMemberEditIsSharedMember(false);
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
    setMemberEditIsSharedMember(member.customerType === "Medlem");
  }

  useEffect(() => {
    resetMemberEditDraftFromSelected(selectedMemberProfile);
    setMemberEditStatus(null);
    // Keep edit mode stable; it should only close on explicit Save/Cancel actions.
    // Background hydration or selection normalization must never close the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId]);

  useEffect(() => {
    if (!isEditingCustomerCard) return;
    const lockedId = String(editLockedMemberIdRef.current ?? "").trim();
    if (!lockedId) return;
    if (selectedMemberId === lockedId) return;
    const lockedStillExists = members.some((member) => member.id === lockedId);
    if (!lockedStillExists) {
      const lockedEmail = editLockedIdentityRef.current?.email ?? "";
      const lockedName = editLockedIdentityRef.current?.name ?? "";
      const replacement =
        members.find((member) => lockedEmail && member.email.trim().toLowerCase() === lockedEmail) ??
        members.find((member) => lockedName && member.name.trim().toLowerCase() === lockedName) ??
        null;
      if (replacement?.id) {
        editLockedMemberIdRef.current = replacement.id;
        setSelectedMemberId(replacement.id);
        return;
      }
      editLockedMemberIdRef.current = null;
      editLockedIdentityRef.current = null;
      setIsEditingCustomerCard(false);
      setMemberEditStatus("Redigering ble avsluttet fordi valgt kunde ikke lenger er tilgjengelig.");
      return;
    }
    setSelectedMemberId(lockedId);
  }, [isEditingCustomerCard, selectedMemberId, members, setSelectedMemberId]);

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
    const isStretch = exercise.category === "Uttøyning";
    const isTreadmill = exercise.equipment.trim().toLowerCase().includes("tredem");
    setProgramExercisesDraft((prev) => [
      ...prev,
      {
        id: uid("draft-ex"),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: isStretch ? "2" : "3",
        reps: isCardio ? "" : isStretch ? "1" : "10",
        weight: isCardio || isStretch ? "" : "0",
        holdSeconds: isStretch ? "30" : "",
        durationMinutes: isCardio ? "20" : "",
        speed: isTreadmill ? "8" : "",
        incline: isTreadmill ? "1" : "",
        restSeconds: isStretch ? "30" : "90",
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
      const trainerAuthor = pickFirstName(trainerAccountName) || pickFirstName(MOTUS.name) || "Trener";
      saveProgramForMember({
        title: template.title,
        goal: template.goal,
        notes: template.notes,
        memberId,
        exercises: template.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
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
  }): boolean {
    if (isLocalDemoSession) {
      setProgramSaveStatus("Demo-innlogging: program lagres ikke til medlem. Logg inn med ekte konto.");
      return false;
    }
    if (!selectedMemberId || selectedMemberId === "__template__") return false;
    const trainerAuthor = pickFirstName(trainerAccountName) || pickFirstName(MOTUS.name) || "Trener";
    saveProgramForMember({
      id: input.id,
      title: input.title,
      goal: input.goal,
      notes: input.notes,
      memberId: selectedMemberId,
      exercises: input.id ? input.exercises : input.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
      programCreatedBy: "trainer",
      programCreatedByName: trainerAuthor,
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

    const selectedInviteType = options?.inviteAfterCreate ? newMemberInviteType : "PT-kunde";
    const nextMembershipType: Member["membershipType"] = selectedInviteType === "Premium-kunde" ? "Premium" : "Standard";
    const nextCustomerType: Member["customerType"] =
      selectedInviteType === "Medlem" ? "Medlem" : selectedInviteType === "PT-kunde" ? "PT-kunde" : "Oppfølging";

    addMember({
      name,
      email,
      phone: normalizePhone(newMemberPhone),
      goal: newMemberGoal,
      focus: newMemberFocus,
      membershipType: nextMembershipType,
      customerType: nextCustomerType,
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
    if (!canAccessAdminTools) return;
    setConfirmDialog({
      title: "Slette kunde permanent",
      message: "Admin: Slette kunden permanent? Dette sletter også programmer, logger og meldinger, og kan ikke angres.",
      confirmLabel: "Slett permanent",
      tone: "danger",
      onConfirm: () => {
        deleteMember(memberId);
      },
    });
  }

  function buildProgramFingerprint(program: ProgramExercise[] | undefined, title: string, goal: string, notes: string): string {
    const exerciseFingerprint = (program ?? [])
      .map((item) => `${item.exerciseName}|${item.sets}|${item.reps}|${item.weight}|${item.holdSeconds ?? ""}|${item.durationMinutes ?? ""}|${item.speed ?? ""}|${item.incline ?? ""}|${item.restSeconds}|${item.notes}`)
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
    setConfirmDialog({
      title: "Slette program",
      message: `Slette programmet "${target.title}"?`,
      confirmLabel: "Slett program",
      tone: "danger",
      onConfirm: () => {
        deleteProgramById(target.id);
        duplicateIds.forEach((id) => deleteProgramById(id));
      },
    });
  }

  function handlePrintProgram(program: TrainingProgram) {
    if (typeof window === "undefined") return;
    try {
      // Open tab immediately within click gesture to avoid popup blockers in Edge.
      const printTab = window.open("about:blank", "_blank");
      if (!printTab) {
        setConfirmDialog({
          title: "Popup blokkert",
          message: "Nettleseren blokkerte popup-vinduet for utskrift. Tillat popup for denne siden.",
          confirmLabel: "OK",
          showCancel: false,
          tone: "default",
          onConfirm: () => {},
        });
        return;
      }
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
              const exerciseName = String(safeExercise.exerciseName ?? "Øvelse").trim() || "Øvelse";
              const exerciseId = String(safeExercise.exerciseId ?? "").trim();
              const libraryMatch =
                exercises.find((item) => item.id === exerciseId) ??
                exercises.find((item) => String(item.name ?? "").trim().toLowerCase() === exerciseName.toLowerCase()) ??
                null;
              const setCount = String(safeExercise.sets ?? "").trim() || "-";
              const reps = String(safeExercise.reps ?? "").trim() || "-";
              const weight = String(safeExercise.weight ?? "").trim() || "-";
              const durationMinutes = String(safeExercise.durationMinutes ?? "").trim();
              const speed = String(safeExercise.speed ?? "").trim();
              const incline = String(safeExercise.incline ?? "").trim();
              const restSeconds = String(safeExercise.restSeconds ?? "").trim() || "0";
              const notes = String(safeExercise.notes ?? "").trim();
              const prescription = durationMinutes
                ? `${setCount} runder × ${durationMinutes} min${
                    speed ? ` · ${speed} km/t` : ""
                  }${incline ? ` · ${incline}% incline` : ""} · ${restSeconds}s pause`
                : libraryMatch?.category === "Uttøyning"
                  ? `${setCount} sett × ${String(safeExercise.holdSeconds ?? "").trim() || weight || "-"} sek hold · ${restSeconds}s pause`
                  : `${setCount} x ${reps} · ${weight} kg · ${restSeconds}s pause`;
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
        <div class="brand-logo-frame"><img src="${escapeHtml(motusSkrytekortLogo)}" alt="Motus logo" class="brand-logo" /></div>
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
      try {
      // Prefer direct write to the pre-opened tab (most stable in Edge).
      printTab.document.open();
      printTab.document.write(html);
      printTab.document.close();
      window.setTimeout(() => {
        try {
          printTab.focus();
          printTab.print();
        } catch {
          // ignore
        }
      }, 700);
        return;
      } catch (writeError) {
      console.warn("Trainer print: direct tab write failed, trying blob fallback.", writeError);
      }

      try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      printTab.location.href = blobUrl;
      window.setTimeout(() => {
        try {
          printTab.focus();
          printTab.print();
        } catch {
          // ignore
        }
      }, 900);
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } catch (error) {
      console.warn("Trainer print: blob print failed.", error);
      try {
        printTab.close();
      } catch {
        // ignore
      }
      setConfirmDialog({
        title: "Utskrift feilet",
        message: "Kunne ikke generere PDF/utskrift. Prøv igjen.",
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
    const isSharedMemberProfile = selectedMember.customerType === "Medlem" || memberEditIsSharedMember;
    if (!isSharedMemberProfile && selectedOwnerUserId && currentTrainerOwnerUserId && selectedOwnerUserId !== currentTrainerOwnerUserId) {
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
      setMemberEditStatus("Fødselsdato må være på formatet dd.mm.yyyy.");
      return;
    }
    const previousEmail = selectedMember.email.trim().toLowerCase();
    const previousName = (selectedMemberProfile?.name ?? selectedMember.name).trim().toLowerCase();
    const shouldFanOutSharedMemberUpdates = isSharedMemberProfile;
    const targetMemberIds = members
      .filter((member) => {
        const memberEmail = member.email.trim().toLowerCase();
        const memberName = member.name.trim().toLowerCase();
        if (memberEmail && memberEmail === previousEmail) return true;
        // Some legacy shared rows are connected by name only.
        if (shouldFanOutSharedMemberUpdates && memberName && memberName === previousName) return true;
        return false;
      })
      .filter((member) => {
        if (shouldFanOutSharedMemberUpdates) return true;
        const owner = (member.ownerUserId ?? "").trim();
        if (!owner) return true;
        if (currentTrainerOwnerUserId && owner === currentTrainerOwnerUserId) return true;
        if (selectedOwnerUserId && owner === selectedOwnerUserId) return true;
        return false;
      })
      .map((member) => member.id);
    const uniqueTargetIds = Array.from(new Set(targetMemberIds.length ? targetMemberIds : [selectedMember.id]));
    const normalizedBirthDate = trimmedBirthDateDraft ? normalizeBirthDate(trimmedBirthDateDraft) : "";
    uniqueTargetIds.forEach((memberId) => {
      updateMember({
        memberId,
        changes: {
          name: nextName,
          email: nextEmail,
          phone: normalizePhone(memberEditPhone),
          birthDate: normalizedBirthDate,
          goal: memberEditGoal,
          injuries: memberEditInjuries,
          membershipType: memberEditIsPremiumCustomer ? "Premium" : "Standard",
          customerType: memberEditIsSharedMember ? "Medlem" : memberEditIsPtCustomer ? "PT-kunde" : "Oppfølging",
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
          },
        },
      });
      const forceResult = await supabaseClient.functions.invoke("dedupe-members", {
        body: {
          sharedGlobal: true,
          apply: true,
          email: nextEmail,
          forceProfile: {
            name: nextName,
            phone: normalizePhone(memberEditPhone),
            birthDate: normalizedBirthDate,
          },
        },
      });
      const updated =
        syncResult.data && typeof syncResult.data === "object" && "updated" in syncResult.data
          ? Number((syncResult.data as { updated?: unknown }).updated ?? 0)
          : 0;
      const forcedUpdated =
        forceResult.data && typeof forceResult.data === "object" && "updatedMembers" in forceResult.data
          ? Array.isArray((forceResult.data as { updatedMembers?: unknown }).updatedMembers)
            ? ((forceResult.data as { updatedMembers?: unknown[] }).updatedMembers ?? []).length
            : 0
          : 0;
      const primaryError = syncResult.error?.message ?? "";
      const forceError = forceResult.error?.message ?? "";
      const syncSucceeded = updated > 0 || forcedUpdated > 0;
      if (!syncSucceeded) {
        if (primaryError || forceError) {
          setMemberEditStatus(
            `Kundekort lokalt oppdatert, men synk feilet: ${[primaryError, forceError].filter(Boolean).join(" | ")}`,
          );
        } else {
          setMemberEditStatus("Kundekort lagret, men ingen profiler ble synket. Prøv igjen.");
        }
        return;
      }
      setMemberEditStatus(`Kundekort oppdatert. Synk: primary=${updated}, force=${forcedUpdated}.`);
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
          const selectedName = selectedMember.name.trim();
          const { data: rowsByName } = selectedName
            ? await supabaseClient.from("members").select("id").ilike("name", selectedName)
            : { data: [] as Array<{ id?: string }> };
          validTargetMemberIds = Array.from(
            new Set(
              [...(rowsByEmail ?? []), ...(rowsByName ?? [])]
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
    if (isInvitingMember) return;
    if (!selectedMember) return;
    const email = selectedMember.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteStatus("Kan ikke sende invitasjon: ugyldig e-post på kunden.");
      return;
    }
    const inviteKey = `${email}|${selectedMember.id}`;
    if (manualInviteSendKeyRef.current === inviteKey) return;
    manualInviteSendKeyRef.current = inviteKey;
    setIsInvitingMember(true);
    setInviteStatus(null);
    try {
      const result = await inviteMember(email, selectedMember.id);
      if (result.ok) {
        markMemberInvited(selectedMember.id, new Date().toISOString());
      }
      setInviteStatus(result.message);
    } finally {
      setIsInvitingMember(false);
      manualInviteSendKeyRef.current = "";
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
      const dryRunData = (dryRunResult.data ?? {}) as { duplicateGroupCount?: number };
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

  async function handleRunSafeMemberCleanup() {
    if (!isSupabaseConfigured || !supabaseClient) {
      setMemberDedupeStatus("Opprydding er ikke tilgjengelig akkurat nå.");
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
    });

    setExerciseFormStatus(editingExerciseId ? "Øvelsen ble oppdatert." : "Ny øvelse ble lagt til i banken.");
    resetExerciseForm();
  }
  function handleDeleteExercise(exercise: Exercise) {
    const isUsedInPrograms = programs.some((program) => program.exercises.some((item) => item.exerciseId === exercise.id));
    const confirmMessage = isUsedInPrograms
      ? `Fjern "${exercise.name}" fra øvelsesbank?\n\nØvelsen skjules også i programmer der den er brukt.`
      : `Fjern "${exercise.name}" fra øvelsesbank?`;
    setConfirmDialog({
      title: "Fjerne øvelse",
      message: confirmMessage,
      confirmLabel: "Fjern øvelse",
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

  function renderExerciseMultiSelectField({
    label,
    value,
    options,
    onChange,
    placeholder,
    emptyText,
    required = false,
  }: {
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
    placeholder: string;
    emptyText: string;
    required?: boolean;
  }) {
    const selectedValues = splitMultiValue(value);
    const availableOptions = options.filter((option) => !multiValueIncludes(value, option));
    return (
      <div className="rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            {label}{required ? " *" : ""}
          </div>
          <div className="text-[11px] text-slate-400">{selectedValues.length ? `${selectedValues.length} valgt` : emptyText}</div>
        </div>
        <SelectBox
          value=""
          onChange={(nextValue) => {
            if (!nextValue) return;
            onChange(addMultiValue(value, nextValue));
          }}
          options={[
            { value: "", label: placeholder },
            ...availableOptions.map((option) => ({ value: option, label: option })),
          ]}
        />
        <div className="mt-2 flex min-h-7 flex-wrap gap-1.5">
          {selectedValues.map((selectedValue) => (
            <button
              key={selectedValue}
              type="button"
              onClick={() => onChange(removeMultiValue(value, selectedValue))}
              className="rounded-full border bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
              style={{ borderColor: "rgba(15,23,42,0.1)" }}
              title={`Fjern ${selectedValue}`}
            >
              {selectedValue} ×
            </button>
          ))}
          {selectedValues.length === 0 ? <span className="text-xs text-slate-400">{emptyText}</span> : null}
        </div>
      </div>
    );
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
    () => activeMembers.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length,
    [activeMembers]
  );
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
  }, [activeMembers, logs, memberRelatedIdSetByCanonicalId, lastFollowUpByMemberId]);

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
    const identity = selected
      ? selected.email.trim().toLowerCase() || `name:${selected.name.trim().toLowerCase()}`
      : selectedMemberId;
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

    function getPriority(member: Member): { tone: "red" | "orange" | "green"; score: number; label: string } {
      const days = Number(member.daysSinceActivity || "0");
      if (days >= 10) return { tone: "red", score: 3, label: "Rød" };
      if (days >= 5) return { tone: "orange", score: 2, label: "Oransje" };
      return { tone: "green", score: 1, label: "Grønn" };
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
  }, [activeMembers, priorityFilter, prioritySort, priorityMemberTypeSort]);

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
      setLastFollowUpByMemberId((pl) => nextLastFollowUpMapForIds(pl, relatedIds, next));
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

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      {trainerTab === "dashboard" ? (
        <Card className="p-5 shadow-sm ring-1 ring-black/5 space-y-5 sm:p-6">
          <div
            className="rounded-2xl border p-4 text-sm text-slate-600 shadow-sm"
            style={{
              borderColor: "rgba(15,23,42,0.08)",
              background: "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(236,72,153,0.08) 100%)",
            }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dagens fokus</div>
            <div className="mt-1 text-base font-semibold text-slate-800">Drift og oppfølging</div>
            <div className="mt-2">
            {followUpCount > 0
              ? `${followUpCount} kunder må følges opp i dag.`
              : "Ingen kunder trenger oppfølging akkurat nå."}{" "}
            {membersWithoutProgramCount > 0 ? `${membersWithoutProgramCount} kunder mangler program.` : "Alle aktive kunder har program."}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Dagens kunder" value={String(dashboardSummary.todaysCustomers)} hint="Unike med aktivitet i dag" />
            <StatCard label="Dagens økter" value={String(dashboardSummary.todaysWorkouts)} hint="Loggede økter i dag" />
            <StatCard label="Nye meldinger" value={String(dashboardSummary.newMessages24h)} hint="Fra kunder siste 24 timer" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planlegging</div>
                <div className="mt-1 font-semibold text-slate-800">To-do per dag</div>
              </div>
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
            <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oversikt</div>
                  <div className="mt-1 font-semibold text-slate-800">Kalender</div>
                </div>
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
          <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kundeoversikt</div>
                <div className="mt-1 font-semibold text-slate-800">Kundeprioritering</div>
                <div className="mt-1 text-xs text-slate-500">Rød prioritet haster mest.</div>
              </div>
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
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setTrainerTab("customers");
                    setSelectedMemberId(member.id);
                    setCustomerSubTab("overview");
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                  aria-label={`Åpne kundekort for ${member.name}`}
                >
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
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          priority.tone === "red"
                            ? "bg-rose-100 text-rose-700"
                            : priority.tone === "orange"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {priority.label}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Oppfølging</div>
              <div className="mt-1 font-semibold text-slate-800">Bør kontaktes nå</div>
            </div>
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
          <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
            <StatCard
              label="Kunder i listen"
              value={String(visibleMembers.length)}
              hint={showInactiveMembers ? "Aktive + inaktive" : "Kun aktive"}
            />
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
              <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Users className="h-5 w-5" /></div>
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
                <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-500">
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
                <div className="lg:hidden rounded-xl border bg-slate-50 p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-xs font-medium text-slate-600">Bytt kunde raskt</div>
                  <SelectBox
                    value={selectedMemberId}
                    onChange={setSelectedMemberId}
                    options={visibleMembers.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                  />
                </div>
                <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.ink} 100%)` }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="text-sm text-white/80">Kundekort</div>
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/40 bg-white/15 sm:h-14 sm:w-14">
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/85">
                        {getMemberInitials(selectedMember.name)}
                      </div>
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
                  <div className="mt-1 text-2xl font-bold tracking-tight">{selectedMemberProfile?.name ?? selectedMember.name}</div>
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
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setMemberEditIsPtCustomer(checked);
                              if (checked) setMemberEditIsSharedMember(false);
                            }}
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
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            memberEditIsSharedMember
                              ? "border-white/70 bg-white/25 text-white"
                              : "border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
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
                            className="h-4 w-4 rounded border-white/40 bg-white/20 accent-emerald-500"
                          />
                          Medlem (vises hos alle PT-er)
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
                          <div className="font-medium text-white/95">{selectedMemberProfile?.phone || selectedMember.phone || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">Fødselsdato</div>
                          <div className="font-medium text-white/95">{selectedMemberProfile?.birthDate || selectedMember.birthDate || "Ikke satt"}</div>
                        </div>
                        <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                          <div className="text-[11px] text-white/70">Mål</div>
                          <div className="font-medium text-white/95">{selectedMemberProfile?.goal || selectedMember.goal || "Ikke satt"}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                        <div className="text-[11px] text-white/70">Skader/hensyn</div>
                        <div className="font-medium text-white/95">{selectedMemberProfile?.injuries || selectedMember.injuries || "Ingen registrerte skader"}</div>
                      </div>
                      <div className="mt-2 text-sm text-white/85">
                        Sist trening: {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}
                      </div>
                      <div className="mt-1 text-xs text-white/80">
                        {selectedMember.invitedAt ? `Invitert: ${formatInvitedAt(selectedMember.invitedAt)}` : "Ikke invitert enda"}
                      </div>
                    </>
                  )}
                  <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                    {isEditingCustomerCard ? (
                      <>
                        <GradientButton onClick={handleSaveSelectedMemberDetails} className="w-full sm:w-auto">
                          Lagre endringer
                        </GradientButton>
                        <OutlineButton
                          onClick={() => {
                            resetMemberEditDraftFromSelected(selectedMember);
                            editLockedMemberIdRef.current = null;
                            editLockedIdentityRef.current = null;
                            setIsEditingCustomerCard(false);
                          }}
                          className="w-full sm:w-auto"
                        >
                          Avbryt redigering
                        </OutlineButton>
                      </>
                    ) : (
                      <OutlineButton
                        onClick={() => {
                          editLockedMemberIdRef.current = selectedMember.id;
                          editLockedIdentityRef.current = {
                            email: selectedMember.email.trim().toLowerCase(),
                            name: selectedMember.name.trim().toLowerCase(),
                          };
                          setIsEditingCustomerCard(true);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Rediger kundekort
                      </OutlineButton>
                    )}
                    <OutlineButton onClick={() => void handleInviteSelectedMember()} disabled={isInvitingMember} className="w-full sm:w-auto">
                      {isInvitingMember ? "Sender invitasjon..." : "Send invitasjon på nytt"}
                    </OutlineButton>
                    {canAccessAdminTools ? (
                      <OutlineButton onClick={() => void handleRepairSelectedMemberLink()} disabled={isRepairingMemberLink} className="w-full sm:w-auto">
                        {isRepairingMemberLink ? "Reparerer kobling..." : "Reparer medlemskobling"}
                      </OutlineButton>
                    ) : null}
                    <OutlineButton onClick={() => handleDeactivateMember(selectedMember.id)} className="w-full sm:w-auto">
                      Arkiver kunde
                    </OutlineButton>
                    {canAccessAdminTools ? (
                      <DangerButton onClick={() => handleDeleteMember(selectedMember.id)} className="w-full sm:w-auto">
                        Slett kunde permanent
                      </DangerButton>
                    ) : null}
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

                <div className="rounded-xl border bg-slate-50/80 p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="font-semibold">Kort status</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-800">Mål:</span> {selectedMemberProfile?.goal || selectedMember.goal || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Kundetype:</span> {selectedMember.customerType}</div>
                        <div><span className="font-medium text-slate-800">Medlemskap:</span> {selectedMember.membershipType}</div>
                        <div><span className="font-medium text-slate-800">Skader/hensyn:</span> {selectedMemberProfile?.injuries || selectedMember.injuries || "Ingen registrerte skader"}</div>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="font-semibold">Siste aktivitet</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div>{selectedLogs[0] ? `Siste logg: ${selectedLogs[0].date}` : "Ingen logger ennå"}</div>
                        <div>{selectedMessages.length ? `Siste melding: ${selectedMessages[0].createdAt}` : "Ingen meldinger ennå"}</div>
                        <div>{selectedPrograms.length ? `Siste program: ${selectedPrograms[0].title}` : "Ingen program ennå"}</div>
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
                          placeholder={editingFollowUpEntryId ? "Rediger notatet …" : "Skriv notatet her …"}
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
                                  entry.id === editingFollowUpEntryId ? "ring-2 ring-emerald-300/80" : ""
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
                                    <div className="text-xs text-slate-700 whitespace-pre-wrap break-words">{entry.note || "—"}</div>
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
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-xl border bg-white p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{editingProgramId ? "Rediger program" : "Bygg program"}</div>
                        {editingProgramId ? <OutlineButton onClick={resetProgramBuilder}>Avbryt redigering</OutlineButton> : null}
                      </div>
                      <div className="rounded-xl border bg-white p-3 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                        {programExercisesDraft.length === 0 ? (
                          <EmptyState
                            icon="🏋️"
                            title="Ingen øvelser valgt ennå"
                            description="Legg til øvelser fra biblioteket for å bygge programmet."
                            className="bg-white"
                          />
                        ) : null}
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
                              const isStretch = linkedExercise?.category === "Uttøyning";
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
                              ) : isStretch ? (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-medium text-slate-500">Hold (sek)</div>
                                  <TextInput
                                    value={item.holdSeconds ?? ""}
                                    onChange={(e) => updateDraftExercise(item.id, "holdSeconds", e.target.value)}
                                    placeholder="Sekunder"
                                  />
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

                    <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
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

                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="font-semibold">Eksisterende programmer</div>
                      <div className="mt-4 space-y-3">
                        {selectedPrograms.length === 0 ? (
                          <EmptyState
                            icon="📋"
                            title="Ingen programmer ennå"
                            description="Lag et enkelt program for å komme i gang med kunden."
                            className="bg-white"
                            action={
                              <GradientButton onClick={() => setCustomerSubTab("programs")} className="w-full sm:w-auto">
                                Opprett program
                              </GradientButton>
                            }
                          />
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
                                {program.goal?.trim() ? (
                                  <div className="mt-0.5 text-xs text-slate-500">{program.goal.trim()}</div>
                                ) : null}
                                {programAuthorLabel(program) ? (
                                  <div className="mt-1 text-[11px] font-medium text-slate-600">{programAuthorLabel(program)}</div>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-400">{program.exercises.length} øvelser · {program.createdAt}</div>

                            <div className="mt-3 flex gap-2">
                              <OutlineButton onClick={() => startEditProgram(program)}>
                                Rediger
                              </OutlineButton>
                              <OutlineButton onClick={() => handlePrintProgram(program)}>
                                Skriv ut / PDF
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
                    <div className="rounded-xl border bg-slate-50 p-4">
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
                    <div className="rounded-xl border bg-slate-50 p-4">
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
                                    <div>
                                      Plan:{" "}
                                      {result.exerciseCategory === "Kondisjon" && (result.plannedDurationMinutes ?? "").trim()
                                        ? `${result.plannedSets} runder × ${result.plannedDurationMinutes} min`
                                        : result.exerciseCategory === "Uttøyning"
                                          ? `${result.plannedSets} sett × ${result.plannedWeight || "0"} sek`
                                          : `${result.plannedSets} x ${result.plannedReps} @ ${result.plannedWeight || "0"} kg`}
                                    </div>
                                    <div>
                                      Utført:{" "}
                                      {result.exerciseCategory === "Kondisjon" && (result.performedDurationMinutes ?? "").trim()
                                        ? `${result.performedDurationMinutes || "-"} min`
                                        : result.exerciseCategory === "Uttøyning"
                                          ? `${result.performedWeight || "-"} sek`
                                          : `${result.performedReps || "-"} reps @ ${result.performedWeight || "-"} kg`}
                                    </div>
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
                          icon="📋"
                          title="Velg en økt for detaljer"
                          description="Trykk på en økt i listen for å se sett, reps og tilbakemelding."
                          className="mt-3 bg-slate-50"
                        />
                      )}
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "messages" ? (
                  <div className="rounded-xl border bg-slate-50 p-3 sm:p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">Dialog med kunde</div>
                      <div className="text-xs text-slate-500">Direkte chat</div>
                    </div>
                    {selectedMemberMessagesLocked ? (
                      <div className="rounded-xl border bg-white p-5 text-sm font-medium text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        Medlem har ikke tilgang til meldinger.
                      </div>
                    ) : (
                      <>
                    <div ref={trainerMessagesContainerRef} className="max-h-[min(52vh,420px)] space-y-3 overflow-auto rounded-xl border bg-white p-3 sm:p-4">
                      {selectedMessages.length === 0 ? (
                        <EmptyState
                          icon="💬"
                          title="Ingen meldinger ennå"
                          description="Send en kort velkomstmelding for bedre oppstart."
                          className="bg-slate-50"
                          action={
                            <OutlineButton onClick={() => setTrainerMessage("Hei! Klar for en god uke?")} className="w-full sm:w-auto">
                              Sett inn forslag
                            </OutlineButton>
                          }
                        />
                      ) : null}
                      {selectedMessages.map((message, index) => {
                        const timestamp = parseChatCreatedAtMs(message.createdAt);
                        const dateKey = timestamp > 0 ? new Date(timestamp).toLocaleDateString("nb-NO") : message.createdAt;
                        const prevTimestamp = index > 0 ? parseChatCreatedAtMs(selectedMessages[index - 1].createdAt) : 0;
                        const prevDateKey = prevTimestamp > 0 ? new Date(prevTimestamp).toLocaleDateString("nb-NO") : "";
                        const showDateDivider = index === 0 || dateKey !== prevDateKey;
                        return (
                          <div key={message.id}>
                            {showDateDivider ? (
                              <div className="my-2 text-center text-[11px] font-medium text-slate-400">{dateKey}</div>
                            ) : null}
                            <div className={`max-w-[88%] rounded-xl p-3 text-sm ${message.id === selectedMessages[selectedMessages.length - 1]?.id ? "motus-fade-in-up" : ""} ${message.sender === "trainer" ? "ml-auto border border-transparent text-white" : "border bg-slate-50 text-slate-700"}`} style={message.sender === "trainer" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                              <div>{message.text}</div>
                              <div className={`mt-1 text-[11px] ${message.sender === "trainer" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="sticky bottom-0 -mx-3 flex flex-col gap-3 border-t border-slate-200 bg-slate-50/95 px-3 pb-3 pt-3 backdrop-blur sm:mx-0 sm:px-0 sm:pb-0 sm:flex-row">
                      <TextInput
                        value={trainerMessage}
                        onChange={(e) => {
                          setTrainerMessage(e.target.value);
                          if (trainerChatSendStatus) setTrainerChatSendStatus(null);
                        }}
                        placeholder="Skriv melding til kunden"
                      />
                      <GradientButton
                        onClick={async () => {
                          if (!selectedMemberId || selectedMemberId === "__template__" || !trainerMessage.trim()) return;
                          const sent = await dispatchTrainerMessageToSelectedMember(trainerMessage);
                          if (sent) setTrainerMessage("");
                        }}
                        className="w-full sm:w-auto"
                        disabled={!trainerMessage.trim() || isSendingTrainerMessage}
                      >
                        {isSendingTrainerMessage ? "Sender..." : "Send"}
                      </GradientButton>
                    </div>
                      </>
                    )}
                    {trainerChatSendStatus ? (
                      <div
                        className={`rounded-xl border px-3 py-2 text-xs ${trainerChatSendStatus.startsWith("Melding sendt") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
                        style={{ borderColor: trainerChatSendStatus.startsWith("Melding sendt") ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)" }}
                      >
                        {trainerChatSendStatus}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-dashed bg-slate-50 p-8 text-center text-slate-500">
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
          <Card className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Lag treningsmal</h2>
                <p className="text-sm text-slate-500">Bygg mal med filtrering, favoritter og drag-and-drop</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-3">
                <TextInput value={templateProgramTitle} onChange={(e) => setTemplateProgramTitle(e.target.value)} placeholder="Navn på treningsmal" />
                <div className="rounded-xl border bg-white p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                  {programExercisesDraft.length === 0 ? (
                    <EmptyState
                      icon="🏋️"
                      title="Ingen øvelser valgt ennå"
                      description="Legg til øvelser fra biblioteket for å bygge programmet."
                      className="bg-white"
                    />
                  ) : null}
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
                      className={`rounded-2xl border bg-white p-3 sm:p-4 space-y-3 cursor-move transition ${
                        dragOverDraftExerciseId === item.id ? "ring-2 ring-emerald-300 border-emerald-300" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-medium">{item.exerciseName}</div>
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                          <OutlineButton
                            onClick={() => moveDraftExerciseByOffset(item.id, -1)}
                            className="w-full px-3 py-1.5 text-xs sm:w-auto"
                            disabled={index === 0}
                          >
                            Opp
                          </OutlineButton>
                          <OutlineButton
                            onClick={() => moveDraftExerciseByOffset(item.id, 1)}
                            className="w-full px-3 py-1.5 text-xs sm:w-auto"
                            disabled={index === programExercisesDraft.length - 1}
                          >
                            Ned
                          </OutlineButton>
                          <OutlineButton onClick={() => removeDraftExercise(item.id)} className="w-full sm:w-auto">Fjern</OutlineButton>
                        </div>
                      </div>
                      {(() => {
                        const linkedExercise = exercisesById.get(item.exerciseId);
                        const isCardio = linkedExercise?.category === "Kondisjon";
                        const isStretch = linkedExercise?.category === "Uttøyning";
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
                        ) : isStretch ? (
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500">Hold (sek)</div>
                            <TextInput
                              value={item.holdSeconds ?? ""}
                              onChange={(e) => updateDraftExercise(item.id, "holdSeconds", e.target.value)}
                              placeholder="Sekunder"
                            />
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
              <div className="rounded-xl border bg-slate-50 p-3 sm:p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                    <EmptyState
                      icon="🔎"
                      title="Ingen øvelser matcher søk/filter"
                      description="Prøv en annen muskelgruppe eller et kortere søk."
                      className="bg-white py-4"
                    />
                  ) : null}
                  {visibleProgramExercises.map((exercise) => {
                    const isFavorite = favoriteExerciseIds.includes(exercise.id);
                    return (
                      <div
                        key={exercise.id}
                        draggable
                        onDragStart={() => setDraggedExerciseIdFromLibrary(exercise.id)}
                        onDragEnd={() => setDraggedExerciseIdFromLibrary(null)}
                        className="rounded-2xl border bg-white p-2.5 sm:p-3 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-2.5">
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
                              <div className="text-xs leading-5 text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
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
              <div className="rounded-xl border bg-slate-50 p-3 sm:p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">Lagrede treningsmaler</div>
                  <div className="text-xs text-slate-500">{templatePrograms.length} maler</div>
                </div>
                {templatePrograms.length === 0 ? (
                  <div className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">
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
                          {programAuthorLabel(program) ? (
                            <div className="mt-1 text-[11px] font-medium text-slate-600">{programAuthorLabel(program)}</div>
                          ) : null}
                          <div className="mt-0.5 text-xs text-slate-500">
                            {program.exercises.length} øvelse(r){program.createdAt ? ` · ${program.createdAt}` : ""}
                          </div>
                        </div>
                        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                          <OutlineButton onClick={() => setExpandedTemplateProgramId((prev) => (prev === program.id ? null : program.id))} className="w-full px-2 py-1.5 text-xs sm:w-auto sm:px-3">
                            {isExpanded ? "Skjul" : "Vis"}
                          </OutlineButton>
                          <OutlineButton onClick={() => startEditTemplateProgram(program)} className="w-full px-2 py-1.5 text-xs sm:w-auto sm:px-3">
                            Rediger
                          </OutlineButton>
                          <OutlineButton onClick={() => deleteTemplateProgram(program)} className="w-full px-2 py-1.5 text-xs text-rose-700 sm:w-auto sm:px-3">
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
                                      : exercises.find((e) => e.id === exercise.exerciseId)?.category === "Uttøyning"
                                        ? `${exercise.sets || "-"} sett × ${(exercise.holdSeconds ?? "").trim() || exercise.weight || "-"} sek · ${exercise.restSeconds || "0"}s`
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
            <div className="mt-5 rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
            <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Dumbbell className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Øvelsesbank</h2>
              <p className="text-sm text-slate-500">Opprett og rediger øvelser. Navn og muskelgruppe må fylles ut.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
              {renderExerciseMultiSelectField({
                label: "Muskelgruppe",
                value: exerciseFormGroup,
                options: exerciseFormGroupOptions,
                onChange: setExerciseFormGroup,
                placeholder: "Legg til muskelgruppe",
                emptyText: "Ingen muskelgruppe valgt",
                required: true,
              })}
              {renderExerciseMultiSelectField({
                label: "Utstyr",
                value: exerciseFormEquipment,
                options: exerciseFormEquipmentOptions,
                onChange: setExerciseFormEquipment,
                placeholder: "Legg til utstyr",
                emptyText: "Valgfritt / blank",
              })}
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
              <TextArea value={exerciseFormDescription} onChange={(e) => setExerciseFormDescription(e.target.value)} className="min-h-[110px]" placeholder="Forklaring av teknikk og utførelse (valgfritt)" />
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
                {visibleExercises.length === 0 ? (
                  <EmptyState
                    icon="🏋️"
                    title="Ingen øvelser lagt til ennå"
                    description="Juster søk/filter eller legg til en ny øvelse for å komme i gang."
                    className="bg-white"
                    action={<GradientButton onClick={resetExerciseForm}>Legg til øvelse</GradientButton>}
                  />
                ) : null}
                {visibleExercises.map((exercise) => {
                  const isFavorite = favoriteExerciseIds.includes(exercise.id);
                  return (
                  <div
                    key={exercise.id}
                    className="rounded-xl border bg-slate-50 px-3 py-2.5"
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
                          <div className="truncate text-sm font-semibold leading-tight text-slate-800">{exercise.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                            <span className="rounded-full border bg-white px-2 py-0.5 text-slate-600" style={{ borderColor: "rgba(15,23,42,0.1)" }}>{exercise.category}</span>
                            <span className="rounded-full border bg-white px-2 py-0.5 text-slate-600" style={{ borderColor: "rgba(15,23,42,0.1)" }}>{exercise.group}</span>
                            <span className="rounded-full border bg-white px-2 py-0.5 text-slate-600" style={{ borderColor: "rgba(15,23,42,0.1)" }}>{exercise.equipment || "Uten utstyr"}</span>
                            <span className="rounded-full border bg-white px-2 py-0.5 text-slate-600" style={{ borderColor: "rgba(15,23,42,0.1)" }}>{exercise.level}</span>
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
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditExercise(exercise);
                          }}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100"
                          aria-label="Rediger øvelse"
                          title="Rediger øvelse"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(exercise)}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-700 transition hover:bg-rose-50"
                          aria-label="Skjul øvelse"
                          title="Skjul øvelse"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-100"
                          aria-label={expandedExerciseId === exercise.id ? "Skjul beskrivelse" : "Vis beskrivelse"}
                          title={expandedExerciseId === exercise.id ? "Skjul beskrivelse" : "Vis beskrivelse"}
                        >
                          {expandedExerciseId === exercise.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
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
                        {renderExerciseMultiSelectField({
                          label: "Muskelgruppe",
                          value: exerciseFormGroup,
                          options: exerciseFormGroupOptions,
                          onChange: setExerciseFormGroup,
                          placeholder: "Legg til muskelgruppe",
                          emptyText: "Ingen muskelgruppe valgt",
                          required: true,
                        })}
                        {renderExerciseMultiSelectField({
                          label: "Utstyr",
                          value: exerciseFormEquipment,
                          options: exerciseFormEquipmentOptions,
                          onChange: setExerciseFormEquipment,
                          placeholder: "Legg til utstyr",
                          emptyText: "Valgfritt / blank",
                        })}
                        <TextInput value={exerciseFormImageUrl} onChange={(e) => setExerciseFormImageUrl(e.target.value)} placeholder="Bilde-URL (valgfritt)" />
                        <TextArea value={exerciseFormDescription} onChange={(e) => setExerciseFormDescription(e.target.value)} className="min-h-[90px]" placeholder="Forklaring av teknikk og utførelse (valgfritt)" />
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

      {trainerTab === "admin" && canAccessAdminTools ? (
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
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
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border bg-white px-3 py-2 text-xs" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-slate-500">Aktive kunder</div>
                <div className="font-semibold text-slate-800">{activeMembers.length}</div>
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
          <div
            id="admin-legg-til-medlem"
            className="scroll-mt-24 rounded-xl border bg-slate-50 p-4 space-y-3"
            style={{ borderColor: "rgba(15,23,42,0.08)" }}
          >
            <div className="text-sm font-semibold text-slate-700">Legg til medlem</div>
            <TextInput value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Navn" />
            <TextInput value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="E-post" />
            <TextInput value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="Telefon (valgfritt)" />
            <TextInput value={newMemberGoal} onChange={(e) => setNewMemberGoal(e.target.value)} placeholder="Hovedmål (valgfritt)" />
            <TextInput value={newMemberFocus} onChange={(e) => setNewMemberFocus(e.target.value)} placeholder="Fokus (valgfritt)" />
            <SelectBox
              value={newMemberInviteType}
              onChange={(value) => setNewMemberInviteType(value as "PT-kunde" | "Premium-kunde" | "Medlem")}
              options={[
                { value: "PT-kunde", label: "Type ved invitasjon: PT-kunde" },
                { value: "Premium-kunde", label: "Type ved invitasjon: Premium-kunde" },
                { value: "Medlem", label: "Type ved invitasjon: Medlem" },
              ]}
            />
            {newMemberError ? <StatusMessage message={newMemberError} tone="error" className="!rounded-xl !px-3 !py-2 !text-xs" /> : null}
            <GradientButton onClick={() => submitNewMember()} className="w-full md:w-auto">Opprett medlem</GradientButton>
            <OutlineButton onClick={() => submitNewMember({ inviteAfterCreate: true })} className="w-full md:w-auto">
              Opprett + send invitasjon
            </OutlineButton>
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
            <div className="text-sm font-semibold text-slate-700">Slå sammen duplikatkunder</div>
            <div className="text-xs text-slate-600">
              Går gjennom kunder med samme e-post og rydder opp trygt.
            </div>
            {memberDedupeStatus ? (
              <StatusMessage
                message={memberDedupeStatus}
                tone={memberDedupeStatus.toLowerCase().includes("feilet") ? "error" : "success"}
                className="!rounded-xl !px-3 !py-2 !text-xs"
              />
            ) : null}
            <OutlineButton onClick={() => void handleRunSafeMemberCleanup()} className="w-full md:w-auto" disabled={isRunningMemberDedupe}>
              {isRunningMemberDedupe ? "Rydder..." : "Start opprydding"}
            </OutlineButton>
          </div>
        </Card>
      ) : null}
    </div>
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
