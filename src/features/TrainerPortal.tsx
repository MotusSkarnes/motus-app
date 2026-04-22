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
import type { ChatMessage, CustomerSubTab, Exercise, Member, ProgramExercise, TrainerTab, TrainingProgram, WorkoutLog } from "../app/types";
import { supabaseClient } from "../services/supabaseClient";

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
  openCustomerMessagesSignal?: number;
  memberAvatarById?: Record<string, string>;
  setMemberAvatarUrlForMember?: (memberId: string, avatarUrl: string) => void;
};

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
    openCustomerMessagesSignal = 0,
    memberAvatarById = {},
    setMemberAvatarUrlForMember,
  } = props;

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [customerSubTab, setCustomerSubTab] = useState<CustomerSubTab>("overview");
  const [programExercisesDraft, setProgramExercisesDraft] = useState<ProgramExercise[]>([]);
  const [templateProgramTitle, setTemplateProgramTitle] = useState("Ny treningsmal");
  const [selectedTemplateProgramId, setSelectedTemplateProgramId] = useState("");
  const [templateAssignStatus, setTemplateAssignStatus] = useState<string | null>(null);
  const [draggedExerciseIdFromLibrary, setDraggedExerciseIdFromLibrary] = useState<string | null>(null);
  const [draggedDraftExerciseId, setDraggedDraftExerciseId] = useState<string | null>(null);
  const [isDraftDropZoneActive, setIsDraftDropZoneActive] = useState(false);
  const [dragOverDraftExerciseId, setDragOverDraftExerciseId] = useState<string | null>(null);
  const [programExerciseSearch, setProgramExerciseSearch] = useState("");
  const [programExerciseCategoryFilter, setProgramExerciseCategoryFilter] = useState<"all" | "Styrke" | "Kondisjon">("all");
  const [programExerciseGroupFilter, setProgramExerciseGroupFilter] = useState("all");
  const [quickPlanGoal, setQuickPlanGoal] = useState<"styrke" | "muskelvekst" | "fettreduksjon">("styrke");
  const [quickPlanLevel, setQuickPlanLevel] = useState<"nybegynner" | "middels" | "avansert">("nybegynner");
  const [quickPlanMinutes, setQuickPlanMinutes] = useState<"30" | "45" | "60">("45");
  const [quickPlanStatus, setQuickPlanStatus] = useState<string | null>(null);
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
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const visibleMembers = showInactiveMembers ? members : members.filter((member) => member.isActive !== false);
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
    members.forEach((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      if (!normalizedEmail) return;
      const avatarUrl = memberAvatarById[member.id];
      if (avatarUrl && !byEmail[normalizedEmail]) {
        byEmail[normalizedEmail] = avatarUrl;
      }
    });
    return byEmail;
  }, [members, memberAvatarById]);
  function resolveMemberAvatarUrl(member: Member): string {
    const direct = memberAvatarById[member.id];
    if (direct) return direct;
    const normalizedEmail = member.email.trim().toLowerCase();
    if (!normalizedEmail) return "";
    return memberAvatarByEmail[normalizedEmail] ?? "";
  }
  const selectedPrograms = programs.filter((program) => program.memberId === selectedMemberId);
  const templatePrograms = programs.filter((program) => program.memberId === "__template__");
  const selectedLogs = useMemo(() => {
    function parseLogDate(value: string): number {
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
    return logs
      .filter((log) => log.memberId === selectedMemberId)
      .sort((a, b) => parseLogDate(b.date) - parseLogDate(a.date));
  }, [logs, selectedMemberId]);
  const selectedMemberRelatedIds = useMemo(() => {
    if (selectedMemberId === "__template__") return [];
    if (!selectedMemberId) return [];
    const selected = members.find((member) => member.id === selectedMemberId);
    if (!selected) return [selectedMemberId];
    const normalizedEmail = selected.email.trim().toLowerCase();
    if (!normalizedEmail) return [selectedMemberId];
    return members
      .filter((member) => member.email.trim().toLowerCase() === normalizedEmail)
      .map((member) => member.id);
  }, [members, selectedMemberId]);
  const selectedMessages = useMemo(
    () =>
      messages.filter((message) =>
        selectedMemberRelatedIds.includes(message.memberId)
      ),
    [messages, selectedMemberRelatedIds]
  );
  const latestCompletedLog = selectedLogs.find((log) => log.status === "Fullført") ?? null;
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
    if (!selectedMemberId || selectedMemberId === "__template__") return;
    setCustomerSubTab("messages");
  }, [openCustomerMessagesSignal, selectedMemberId]);

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
  }, [selectedMember]);

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
    setProgramExercisesDraft((prev) => [
      ...prev,
      {
        id: uid("draft-ex"),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: "3",
        reps: "10",
        weight: "0",
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

  function generateQuickWeeklyPlan() {
    if (!selectedMemberId || selectedMemberId === "__template__") {
      setQuickPlanStatus("Velg en kunde før du lager ukesoppsett.");
      return;
    }
    const preferredGroupsByGoal: Record<"styrke" | "muskelvekst" | "fettreduksjon", string[]> = {
      styrke: ["Bein", "Rygg", "Bryst", "Skuldre", "Kjerne"],
      muskelvekst: ["Bryst", "Rygg", "Bein", "Skuldre", "Armer"],
      fettreduksjon: ["Bein", "Kjerne", "Rygg", "Kondisjon", "Helkropp"],
    };
    const availableStrength = exercises.filter((exercise) => exercise.category === "Styrke");
    const availableConditioning = exercises.filter((exercise) => exercise.category === "Kondisjon");
    const preferredGroups = preferredGroupsByGoal[quickPlanGoal];

    function pickExerciseForGroup(group: string, usedIds: Set<string>): Exercise | null {
      const direct = availableStrength.find((exercise) => exercise.group === group && !usedIds.has(exercise.id));
      if (direct) return direct;
      const fallbackStrength = availableStrength.find((exercise) => !usedIds.has(exercise.id));
      if (fallbackStrength) return fallbackStrength;
      return availableConditioning.find((exercise) => !usedIds.has(exercise.id)) ?? null;
    }

    const used = new Set<string>();
    const targetExerciseCount = quickPlanMinutes === "30" ? 4 : quickPlanMinutes === "45" ? 5 : 6;
    const pickedExercises: ProgramExercise[] = [];
    const sets = quickPlanLevel === "nybegynner" ? "3" : quickPlanLevel === "middels" ? "4" : "5";
    const reps = quickPlanGoal === "styrke" ? "5-8" : quickPlanGoal === "muskelvekst" ? "8-12" : "10-15";
    const restSeconds = quickPlanGoal === "styrke" ? "120" : quickPlanGoal === "muskelvekst" ? "90" : "60";

    for (let index = 0; index < targetExerciseCount; index += 1) {
      const group = preferredGroups[index % preferredGroups.length];
      const exercise = pickExerciseForGroup(group, used);
      if (!exercise) continue;
      used.add(exercise.id);
      pickedExercises.push({
        id: uid("draft-ex"),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets,
        reps,
        weight: "0",
        restSeconds,
        notes: quickPlanGoal === "fettreduksjon" ? "Hold jevn puls mellom settene" : "",
      });
    }

    if (!pickedExercises.length) {
      setQuickPlanStatus("Fant ingen øvelser å bygge program fra.");
      return;
    }

    const goalLabel = quickPlanGoal === "styrke" ? "Styrke" : quickPlanGoal === "muskelvekst" ? "Muskelvekst" : "Fettreduksjon";
    setProgramTitle(`Ukesoppsett - ${goalLabel}`);
    setProgramGoal(`${goalLabel} (${quickPlanLevel}, ${quickPlanMinutes} min)`);
    setProgramNotes("Generert forslag. Juster øvelser, sett og notater før lagring.");
    setProgramExercisesDraft(pickedExercises);
    setQuickPlanStatus(`Ukesoppsett klart: ${pickedExercises.length} øvelser lagt inn.`);
  }

  function saveTemplateFromProgramsTab() {
    const title = templateProgramTitle.trim();
    if (!title) return;
    saveProgramForMember({
      title,
      goal: "",
      notes: "",
      memberId: "__template__",
      exercises: programExercisesDraft.map((exercise) => ({ ...exercise, id: uid("template-ex") })),
    });
    setTemplateProgramTitle("Ny treningsmal");
    setProgramExercisesDraft([]);
    setTemplateAssignStatus("Treningsmal lagret.");
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
    setInviteStatus("Sender invitasjon...");
    const result = await inviteMember(email, selectedMember.id);
    if (result.ok) {
      markMemberInvited(selectedMember.id, new Date().toISOString());
    }
    setInviteStatus(result.message);
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
    const result = await restoreMemberByEmail(restoreEmail);
    setRestoreStatus(result.message);
    if (result.ok) {
      setRestoreEmail("");
    }
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

  const followUpCount = useMemo(() => members.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length, [members]);
  const membersWithoutProgramCount = useMemo(
    () => members.filter((member) => !programs.some((program) => program.memberId === member.id)).length,
    [members, programs],
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
  const monthLabel = formatDateDdMmYyyy(dashboardMonth);

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

    const mapped = members.map((member) => ({ member, priority: getPriority(member) }));
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
  }, [members, priorityFilter, prioritySort, priorityMemberTypeSort]);

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

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-3 md:hidden">
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
        </Card>
      ) : null}

      {trainerTab === "tasks" ? (
        <Card className="p-5 space-y-4">
          <div className="font-semibold text-slate-800">Oppgaver</div>
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
        </Card>
      ) : null}

      {trainerTab === "statistics" ? (
        <Card className="p-5 space-y-4">
          <div className="font-semibold text-slate-800">Statistikk og prioritering</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Totalt kunder" value={String(members.length)} hint="Alle kunder" />
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
                    options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
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
                      <div className="mt-2 text-sm text-white/85">{selectedMember.email}</div>
                      <div className="mt-1 text-sm text-white/85">Telefon: {selectedMember.phone || "Ikke satt"}</div>
                      <div className="mt-1 text-sm text-white/85">Fødselsdato: {selectedMember.birthDate || "Ikke satt"}</div>
                      <div className="mt-1 text-sm text-white/85">Mål: {selectedMember.goal || "Ikke satt"}</div>
                      <div className="mt-1 text-sm text-white/85">Skader/hensyn: {selectedMember.injuries || "Ingen registrerte skader"}</div>
                      <div className="mt-1 text-sm text-white/85">
                        Sist trening: {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}
                      </div>
                      <div className="mt-1 text-xs text-white/85">
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
                    <OutlineButton onClick={handleInviteSelectedMember}>
                      Send invitasjon på nytt
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
                    <PillButton active={customerSubTab === "profile"} onClick={() => setCustomerSubTab("profile")}>Profil</PillButton>
                    <PillButton active={customerSubTab === "programs"} onClick={() => setCustomerSubTab("programs")}>Program</PillButton>
                    <PillButton active={customerSubTab === "messages"} onClick={() => setCustomerSubTab("messages")}>Meldinger</PillButton>
                  </div>
                </div>

                {customerSubTab === "overview" ? (
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
                ) : null}

                {customerSubTab === "profile" ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Kontakt</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-800">E-post:</span> {selectedMember.email || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Telefon:</span> {selectedMember.phone || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Fødselsdato:</span> {selectedMember.birthDate || "Ikke satt"}</div>
                      </div>
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Kundestatus</div>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-800">Kundetype:</span> {selectedMember.customerType || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Medlemskap:</span> {selectedMember.membershipType || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Mål:</span> {selectedMember.goal || "Ikke satt"}</div>
                        <div><span className="font-medium text-slate-800">Skader/hensyn:</span> {selectedMember.injuries || "Ingen registrerte skader"}</div>
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
                      <div className="rounded-2xl border bg-white p-3 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                        <div className="text-sm font-semibold text-slate-700">One-click weekly plan</div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <SelectBox
                            value={quickPlanGoal}
                            onChange={(value) => setQuickPlanGoal(value as "styrke" | "muskelvekst" | "fettreduksjon")}
                            options={[
                              { value: "styrke", label: "Mål: Styrke" },
                              { value: "muskelvekst", label: "Mål: Muskelvekst" },
                              { value: "fettreduksjon", label: "Mål: Fettreduksjon" },
                            ]}
                          />
                          <SelectBox
                            value={quickPlanLevel}
                            onChange={(value) => setQuickPlanLevel(value as "nybegynner" | "middels" | "avansert")}
                            options={[
                              { value: "nybegynner", label: "Nivå: Nybegynner" },
                              { value: "middels", label: "Nivå: Middels" },
                              { value: "avansert", label: "Nivå: Avansert" },
                            ]}
                          />
                          <SelectBox
                            value={quickPlanMinutes}
                            onChange={(value) => setQuickPlanMinutes(value as "30" | "45" | "60")}
                            options={[
                              { value: "30", label: "Tid: 30 min" },
                              { value: "45", label: "Tid: 45 min" },
                              { value: "60", label: "Tid: 60 min" },
                            ]}
                          />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <GradientButton onClick={generateQuickWeeklyPlan} className="w-full sm:w-auto">
                            Lag ukesoppsett automatisk
                          </GradientButton>
                          {quickPlanStatus ? (
                            <StatusMessage
                              message={quickPlanStatus}
                              tone={quickPlanStatus.toLowerCase().includes("ingen") || quickPlanStatus.toLowerCase().includes("velg") ? "error" : "success"}
                              className="w-full !rounded-xl !px-3 !py-2 !text-xs"
                            />
                          ) : null}
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
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Antall sett</div>
                                <TextInput value={item.sets} onChange={(e) => updateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Antall reps</div>
                                <TextInput value={item.reps} onChange={(e) => updateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Kg</div>
                                <TextInput value={item.weight} onChange={(e) => updateDraftExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Hvile (sekunder)</div>
                                <TextInput value={item.restSeconds} onChange={(e) => updateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                              </div>
                              <div className="space-y-1">
                                <div className="text-[11px] font-medium text-slate-500">Notat til øvelsen</div>
                                <TextInput value={item.notes} onChange={(e) => updateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <GradientButton
                        onClick={() => {
                          saveProgramForMember({ id: editingProgramId ?? undefined, title: programTitle, goal: programGoal, notes: programNotes, memberId: selectedMemberId, exercises: programExercisesDraft });
                          resetProgramBuilder();
                        }}
                        className="w-full"
                      >
                        {editingProgramId ? "Oppdater program" : "Lagre program på kunde"}
                      </GradientButton>
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
                                <button type="button" onClick={() => addExerciseToDraft(exercise)} className="flex-1 text-left">
                                  <div className="font-medium text-sm">{exercise.name}</div>
                                  <div className="text-xs text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleFavoriteExercise(exercise.id)}
                                  className={`rounded-lg border p-1.5 ${isFavorite ? "" : "border-slate-200 text-slate-400"}`}
                                  style={
                                    isFavorite
                                      ? { borderColor: "rgba(244,114,182,0.45)", backgroundColor: "rgba(244,114,182,0.12)", color: MOTUS.pink }
                                      : { borderColor: "rgba(148,163,184,0.45)" }
                                  }
                                  aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                  title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                                >
                                  <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
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
                        {selectedPrograms.map((program) => (
                          <div key={program.id} className="rounded-2xl border bg-white p-4">
                            <div className="font-medium">{program.title}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"}</div>
                            <div className="mt-2 text-xs text-slate-400">{program.exercises.length} øvelser · {program.createdAt}</div>

                            <div className="mt-3 flex gap-2">
                              <OutlineButton onClick={() => startEditProgram(program)}>
                                Rediger
                              </OutlineButton>
                              <OutlineButton onClick={() => deleteProgramById(program.id)}>
                                Slett
                              </OutlineButton>
                            </div>
                          </div>
                        ))}
                      </div>
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Antall sett</div>
                          <TextInput value={item.sets} onChange={(e) => updateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Antall reps</div>
                          <TextInput value={item.reps} onChange={(e) => updateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Kg</div>
                          <TextInput value={item.weight} onChange={(e) => updateDraftExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Hvile (sekunder)</div>
                          <TextInput value={item.restSeconds} onChange={(e) => updateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500">Notat til øvelsen</div>
                          <TextInput value={item.notes} onChange={(e) => updateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <GradientButton
                  onClick={saveTemplateFromProgramsTab}
                  className="w-full"
                >
                  Lagre treningsmal
                </GradientButton>
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
                          <button type="button" onClick={() => addExerciseToDraft(exercise)} className="flex-1 text-left">
                            <div className="font-medium text-sm">{exercise.name}</div>
                            <div className="text-xs text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFavoriteExercise(exercise.id)}
                            className={`rounded-lg border p-1.5 ${isFavorite ? "" : "border-slate-200 text-slate-400"}`}
                            style={
                              isFavorite
                                ? { borderColor: "rgba(244,114,182,0.45)", backgroundColor: "rgba(244,114,182,0.12)", color: MOTUS.pink }
                                : { borderColor: "rgba(148,163,184,0.45)" }
                            }
                            aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                            title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                          >
                            <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
              <div className="font-semibold">Tildel mal til kunde</div>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectBox
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
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
              <TextInput value={exerciseFormGroup} onChange={(e) => setExerciseFormGroup(e.target.value)} placeholder="Muskelgruppe / fokusområde" />
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
                  <div key={exercise.id} className="rounded-2xl border bg-slate-50 px-3 py-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium leading-tight">{exercise.name}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {exercise.category} · {exercise.group} · Utstyr: {exercise.equipment} · {exercise.level}
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavoriteExercise(exercise.id)}
                          className={`rounded-lg border p-1.5 ${isFavorite ? "" : "border-slate-200 text-slate-400"}`}
                          style={
                            isFavorite
                              ? { borderColor: "rgba(244,114,182,0.45)", backgroundColor: "rgba(244,114,182,0.12)", color: MOTUS.pink }
                              : { borderColor: "rgba(148,163,184,0.45)" }
                          }
                          aria-label={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                          title={isFavorite ? "Fjern favoritt" : "Marker som favoritt"}
                        >
                          <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                        </button>
                        <OutlineButton onClick={() => startEditExercise(exercise)} className="px-3 py-1.5 text-xs">Rediger</OutlineButton>
                        <OutlineButton onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))} className="px-3 py-1.5 text-xs">
                          {expandedExerciseId === exercise.id ? "Skjul" : "Vis"}
                        </OutlineButton>
                      </div>
                    </div>
                    {expandedExerciseId === exercise.id ? (
                      <div className="mt-2 text-sm text-slate-700">
                        {exercise.description}
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
            <OutlineButton onClick={() => void handleRestoreMember()} className="w-full md:w-auto">
              Gjenopprett klient
            </OutlineButton>
          </div>
        </Card>
      ) : null}
    </div>
    </>
  );
}
