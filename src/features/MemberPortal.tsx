import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, MessageSquare, Target, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
import { MEMBER_GOAL_OPTIONS } from "../app/memberGoals";
import { isLikelyValidBirthDate, normalizeBirthDate, normalizePhone } from "../app/validators";
import { supabaseClient } from "../services/supabaseClient";
import { Card, GradientButton, OutlineButton, SelectBox, StatCard, StatusMessage, TextArea, TextInput } from "../app/ui";
import type { ReplaceWorkoutExerciseGroupInput, UpdateMemberInput } from "../services/appRepository";
import type { ChatMessage, Exercise, Member, MemberTab, TrainingProgram, WorkoutCelebration, WorkoutLog, WorkoutModeState } from "../app/types";

type MemberPortalProps = {
  members: Member[];
  currentUserRole: "trainer" | "member";
  currentUserEmail: string;
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
  startWorkoutMode: (programId: string) => void;
  updateWorkoutExerciseResult: (exerciseId: string, field: "performedWeight" | "performedReps" | "completed", value: string | boolean) => void;
  replaceWorkoutExerciseGroup: (input: ReplaceWorkoutExerciseGroupInput) => void;
  updateWorkoutModeNote: (note: string) => void;
  finishWorkoutMode: () => void;
  cancelWorkoutMode: () => void;
  workoutCelebration: WorkoutCelebration | null;
  dismissWorkoutCelebration: () => void;
};

const MEMBER_PROFILE_OVERRIDES_KEY = "motus.member.profileOverridesByEmail";

export function MemberPortal(props: MemberPortalProps) {
  const { members, currentUserRole, currentUserEmail, programs, logs, messages, memberViewId, memberTab, setMemberTab, updateMember, memberAvatarUrl, setMemberAvatarUrl, exercises, sendMemberMessage, workoutMode, startWorkoutMode, updateWorkoutExerciseResult, replaceWorkoutExerciseGroup, updateWorkoutModeNote, finishWorkoutMode, cancelWorkoutMode, workoutCelebration, dismissWorkoutCelebration } = props;
  const [messageText, setMessageText] = useState("");
  const [profileWeight, setProfileWeight] = useState("");
  const [profileTrainingGoal, setProfileTrainingGoal] = useState("");
  const [profileSessionsPerWeekTarget, setProfileSessionsPerWeekTarget] = useState("");
  const [profileDailyStepsTarget, setProfileDailyStepsTarget] = useState("");
  const [profileTargetWeight, setProfileTargetWeight] = useState("");
  const [profileCurrentDailySteps, setProfileCurrentDailySteps] = useState("");
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
  const [replacementExerciseIdDraft, setReplacementExerciseIdDraft] = useState("");
  const [workoutExerciseIndex, setWorkoutExerciseIndex] = useState(0);
  const [expandedRecentLogId, setExpandedRecentLogId] = useState<string | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [progressShareStatus, setProgressShareStatus] = useState<string | null>(null);
  const [achievementCelebration, setAchievementCelebration] = useState<{ id: string; label: string } | null>(null);
  const [liveWorkoutCelebration, setLiveWorkoutCelebration] = useState<WorkoutCelebration | null>(null);
  const [seenUnlockedAchievementIds, setSeenUnlockedAchievementIds] = useState<string[]>([]);
  const hasInitializedAchievementTracking = useRef(false);
  const workoutWeightInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const nowDate = new Date();
    return new Date(nowDate.getFullYear(), nowDate.getMonth(), 1);
  });
  const normalizedCurrentUserEmail = currentUserEmail.trim().toLowerCase();
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const currentMemberByEmail =
    currentUserRole === "member" && normalizedCurrentUserEmail
      ? members.find((member) => member.email.trim().toLowerCase() === normalizedCurrentUserEmail) ?? null
      : null;
  const editableMember =
    currentUserRole === "member"
      ? currentMemberByEmail ?? viewedMember ?? null
      : viewedMember ?? members[0] ?? null;
  const activeMemberId = editableMember?.id ?? memberViewId;
  const relatedMemberIds = useMemo(() => {
    const sourceMember = editableMember;
    if (!sourceMember) return [activeMemberId];
    const normalizedEmail = sourceMember.email.trim().toLowerCase();
    if (!normalizedEmail) return [activeMemberId];
    const ids = members
      .filter((member) => member.email.trim().toLowerCase() === normalizedEmail)
      .map((member) => member.id);
    return ids.length ? ids : [activeMemberId];
  }, [members, editableMember, activeMemberId]);
  const relatedMemberIdSet = useMemo(() => new Set(relatedMemberIds), [relatedMemberIds]);
  const memberPrograms = programs.filter((program) => relatedMemberIdSet.has(program.memberId));
  const memberLogs = logs.filter((log) => relatedMemberIdSet.has(log.memberId));
  const memberMessages = messages.filter((message) => relatedMemberIdSet.has(message.memberId));
  const activeWorkoutProgram = workoutMode ? memberPrograms.find((program) => program.id === workoutMode.programId) ?? null : null;
  const nextProgram = memberPrograms[0] ?? null;
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
  const now = new Date();

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
  const achievements = useMemo(() => {
    const items: Array<{ id: string; label: string; hint: string; unlocked: boolean; current: number; target: number; icon: string }> = [
      {
        id: "first-session",
        label: "Første økt",
        hint: "Logg minst 1 fullført økt",
        unlocked: completedLogs.length >= 1,
        current: completedLogs.length,
        target: 1,
        icon: "🚀",
      },
      {
        id: "streak-3",
        label: "3-ukers streak",
        hint: "Hold flyt i 3 uker",
        unlocked: streakWeeks >= 3,
        current: streakWeeks,
        target: 3,
        icon: "🔥",
      },
      {
        id: "ten-sessions",
        label: "10 økter",
        hint: "Fullfør totalt 10 økter",
        unlocked: completedLogs.length >= 10,
        current: completedLogs.length,
        target: 10,
        icon: "💪",
      },
      {
        id: "five-days",
        label: "5 treningsdager",
        hint: "Tren på 5 ulike dager",
        unlocked: uniqueTrainingDays >= 5,
        current: uniqueTrainingDays,
        target: 5,
        icon: "📅",
      },
    ];
    return items;
  }, [completedLogs.length, streakWeeks, uniqueTrainingDays]);

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
  const maxCalendarDayLoad = Math.max(0, ...Array.from(calendarDayLoad.values()));
  const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
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
  const activeCelebration = liveWorkoutCelebration ?? workoutCelebration;
  const shouldShowCelebration = Boolean(activeCelebration && activeCelebration.memberId === activeMemberId);

  function getProfileStorageKey(memberId: string): string {
    return `motus.member.profile.${memberId}`;
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
    const fallbackWeight = editableMember.weight ?? "";
    const fallbackGoal = editableMember.goal ?? "";
    const fallback = {
      weight: fallbackWeight,
      trainingGoal: fallbackGoal,
      sessionsPerWeekTarget: "",
      dailyStepsTarget: "",
      targetWeight: "",
      currentDailySteps: "",
    };
    if (typeof window === "undefined") {
      setProfileWeight(fallback.weight);
      setProfileTrainingGoal(fallback.trainingGoal);
      setProfileSessionsPerWeekTarget(fallback.sessionsPerWeekTarget);
      setProfileDailyStepsTarget(fallback.dailyStepsTarget);
      setProfileTargetWeight(fallback.targetWeight);
      setProfileCurrentDailySteps(fallback.currentDailySteps);
      setMemberNameDraft(editableMember.name);
      setMemberEmailDraft(editableMember.email);
      setMemberPhoneDraft(editableMember.phone);
      setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
      setMemberGoalDraft(editableMember.goal);
      setMemberFocusDraft(editableMember.focus);
      setMemberInjuriesDraft(editableMember.injuries);
      return;
    }
    try {
      const raw = window.localStorage.getItem(getProfileStorageKey(editableMember.id));
      if (!raw) {
        setProfileWeight(fallback.weight);
        setProfileTrainingGoal(fallback.trainingGoal);
        setProfileSessionsPerWeekTarget(fallback.sessionsPerWeekTarget);
        setProfileDailyStepsTarget(fallback.dailyStepsTarget);
        setProfileTargetWeight(fallback.targetWeight);
        setProfileCurrentDailySteps(fallback.currentDailySteps);
        setMemberNameDraft(editableMember.name);
        setMemberEmailDraft(editableMember.email);
        setMemberPhoneDraft(editableMember.phone);
        setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
        setMemberGoalDraft(editableMember.goal);
        setMemberFocusDraft(editableMember.focus);
        setMemberInjuriesDraft(editableMember.injuries);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<typeof fallback>;
      setProfileWeight(parsed.weight ?? fallback.weight);
      setProfileTrainingGoal(parsed.trainingGoal ?? fallback.trainingGoal);
      setProfileSessionsPerWeekTarget(parsed.sessionsPerWeekTarget ?? "");
      setProfileDailyStepsTarget(parsed.dailyStepsTarget ?? "");
      setProfileTargetWeight(parsed.targetWeight ?? "");
      setProfileCurrentDailySteps(parsed.currentDailySteps ?? "");
      setMemberNameDraft(editableMember.name);
      setMemberEmailDraft(editableMember.email);
      setMemberPhoneDraft(editableMember.phone);
      setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
      setMemberGoalDraft(editableMember.goal);
      setMemberFocusDraft(editableMember.focus);
      setMemberInjuriesDraft(editableMember.injuries);
    } catch {
      setProfileWeight(fallback.weight);
      setProfileTrainingGoal(fallback.trainingGoal);
      setProfileSessionsPerWeekTarget(fallback.sessionsPerWeekTarget);
      setProfileDailyStepsTarget(fallback.dailyStepsTarget);
      setProfileTargetWeight(fallback.targetWeight);
      setProfileCurrentDailySteps(fallback.currentDailySteps);
      setMemberNameDraft(editableMember.name);
      setMemberEmailDraft(editableMember.email);
      setMemberPhoneDraft(editableMember.phone);
      setMemberBirthDateDraft(normalizeBirthDateToDdMmYyyy(editableMember.birthDate));
      setMemberGoalDraft(editableMember.goal);
      setMemberFocusDraft(editableMember.focus);
      setMemberInjuriesDraft(editableMember.injuries);
    }
  }, [editableMember]);

  useEffect(() => {
    if (!profileSaveInfo) return;
    if (profileSaveInfo.toLowerCase().includes("feilet")) return;
    const timer = window.setTimeout(() => {
      setProfileSaveInfo(null);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [profileSaveInfo]);

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
    const next = {
      weight: profileWeight.trim(),
      trainingGoal: profileTrainingGoal.trim(),
      sessionsPerWeekTarget: profileSessionsPerWeekTarget.trim(),
      dailyStepsTarget: profileDailyStepsTarget.trim(),
      targetWeight: profileTargetWeight.trim(),
      currentDailySteps: profileCurrentDailySteps.trim(),
    };
    window.localStorage.setItem(getProfileStorageKey(editableMember.id), JSON.stringify(next));
    try {
      const existingRaw = window.localStorage.getItem(MEMBER_PROFILE_OVERRIDES_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
      const safeExisting = existing && typeof existing === "object" ? existing : {};
      const overrideEmail = (normalizedCurrentUserEmail || normalizedEmail || fallbackEmail).trim().toLowerCase();
      if (overrideEmail && overrideEmail.includes("@")) {
        const nextOverrides = {
          ...safeExisting,
          [overrideEmail]: {
            name: memberNameDraft.trim(),
            phone: memberPhoneDraft.trim(),
            birthDate: normalizeBirthDateToDdMmYyyy(memberBirthDateDraft),
            goal: memberGoalDraft.trim(),
            focus: memberFocusDraft.trim(),
            injuries: memberInjuriesDraft.trim(),
          },
        };
        window.localStorage.setItem(MEMBER_PROFILE_OVERRIDES_KEY, JSON.stringify(nextOverrides));
      }
    } catch {
      // Ignore local override cache write errors.
    }
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
        expectedMinUpdated: safeTargetIds.length,
        changes: {
          name: memberNameDraft,
          phone: memberPhoneDraft,
          birthDate: normalizeBirthDateToDdMmYyyy(memberBirthDateDraft),
          goal: memberGoalDraft,
          focus: memberFocusDraft,
          injuries: memberInjuriesDraft,
        },
      });
      if (!syncResult.ok) {
        setProfileSaveInfo(`Profil lagret lokalt. Synk til PT kjører i bakgrunnen (${syncResult.message}).`);
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
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileSaveInfo("Velg en bildefil.");
      return;
    }
    try {
      const originalDataUrl = await readFileAsDataUrl(file);
      const compressedDataUrl = await compressImageDataUrl(originalDataUrl);
      setMemberAvatarUrl(compressedDataUrl);
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
  const currentWeightNumber = Number(profileWeight) || 0;
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
    if (!memberPrograms.length) {
      return {
        title: "Be om første program",
        description: "Du har ingen aktive programmer. Send melding til trener for å få et oppsett.",
        cta: "Send melding",
        action: "messages" as const,
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
  }, [memberPrograms.length, sessionsTargetNumber, sessionsRemaining, nextProgram]);
  const latestCompletedLog = memberLogs.find((log) => log.status === "Fullført") ?? null;
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
      return;
    }
    setWorkoutExerciseIndex(0);
  }, [workoutMode?.programId]);

  useEffect(() => {
    if (!workoutResultGroups.length) return;
    if (workoutExerciseIndex <= workoutResultGroups.length - 1) return;
    setWorkoutExerciseIndex(workoutResultGroups.length - 1);
  }, [workoutResultGroups, workoutExerciseIndex]);

  useEffect(() => {
    setReplacementExerciseIdDraft(replacementCandidates[0]?.id ?? "");
  }, [replacementCandidates, currentWorkoutGroup?.groupId]);

  function handleReplaceCurrentWorkoutExercise() {
    if (!currentWorkoutGroup || !replacementExerciseIdDraft) return;
    const replacementExercise = exercises.find((exercise) => exercise.id === replacementExerciseIdDraft);
    if (!replacementExercise) return;
    replaceWorkoutExerciseGroup({
      programExerciseId: currentWorkoutGroup.groupId,
      nextExerciseName: replacementExercise.name,
    });
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

  function handleWorkoutResultInputChange(
    row: WorkoutModeState["results"][number],
    field: "performedWeight" | "performedReps",
    value: string,
    rowIndex: number,
    rows: WorkoutModeState["results"],
  ) {
    updateWorkoutExerciseResult(row.exerciseId, field, value);
    const nextWeight = field === "performedWeight" ? value.trim() : row.performedWeight.trim();
    const nextReps = field === "performedReps" ? value.trim() : row.performedReps.trim();
    const isCompleted = Number(nextWeight) > 0 && Number(nextReps) > 0;
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
            { id: "programs", label: "Programmer" },
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

        <div className="space-y-4 sm:space-y-6">
          {memberTab === "overview" ? (
            <Card className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="hidden sm:block rounded-[22px] p-4 sm:p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-white/80">Hei{viewedMember ? `, ${viewedMember.name}` : ""}</div>
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-white/40 bg-white/20">
                    {memberAvatarUrl ? <img src={memberAvatarUrl} alt="Profilbilde" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
                  </div>
                </div>
                <div className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Klar for neste økt?</div>
                <div className="mt-2 text-sm text-white/90">Trykk pa neste steg under for a komme raskt i gang.</div>
              </div>
              <div className="hidden sm:grid gap-3 sm:grid-cols-3">
                <StatCard label="Programmer" value={String(memberPrograms.length)} hint="Tildelt deg" />
                <StatCard label="Logger" value={String(memberLogs.length)} hint="Registrert" />
                <StatCard label="Meldinger" value={String(memberMessages.length)} hint="I chatten" />
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                      if (nextBestAction.action === "start-workout" && nextProgram) {
                        setMemberTab("programs");
                        startWorkoutMode(nextProgram.id);
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
              <div className="rounded-2xl border bg-white p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                <div className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="text-sm font-semibold text-slate-700">Treningskalender</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDateDdMmYyyy(calendarMonth)}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
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
                          className={`rounded-lg px-1 py-2 text-center text-xs ${calendarDayLoad.has(day) ? "text-white font-semibold" : "text-slate-600 bg-white"}`}
                          style={
                            calendarDayLoad.has(day)
                              ? {
                                  background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`,
                                  boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(15,23,42,0.2) inset" : "none",
                                }
                              : {
                                  border: "1px solid rgba(15,23,42,0.06)",
                                  boxShadow: selectedCalendarDay === day ? "0 0 0 2px rgba(15,23,42,0.12) inset" : "none",
                                }
                          }
                          title={calendarDayLoad.has(day) ? `${calendarDayLoad.get(day)} økt${calendarDayLoad.get(day) === 1 ? "" : "er"} logget` : "Ingen økter logget"}
                        >
                          {day}
                        </button>
                      ) : (
                        <div key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Lav aktivitet</span>
                    <div className="h-2 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`, opacity: 0.3 }} />
                    <div className="h-2 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`, opacity: 0.6 }} />
                    <div className="h-2 w-20 rounded-full" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)`, opacity: 1 }} />
                    <span>Høy aktivitet</span>
                  </div>
                  {selectedCalendarDay ? (
                    <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Økter {String(selectedCalendarDay).padStart(2, "0")}.{String(calendarMonth.getMonth() + 1).padStart(2, "0")}.{calendarMonth.getFullYear()}
                      </div>
                      <div className="mt-2 space-y-2">
                        {(calendarLogsByDay.get(selectedCalendarDay) ?? []).length === 0 ? (
                          <div className="text-sm text-slate-500">Ingen logg på valgt dag.</div>
                        ) : (
                          (calendarLogsByDay.get(selectedCalendarDay) ?? []).map((log) => (
                            <div key={log.id} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="font-medium text-slate-800">{log.programTitle}</div>
                              {log.note ? <div className="mt-1 text-xs text-slate-600">{log.note}</div> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : null}

          {shouldShowCelebration ? (
            <div className="fixed inset-0 z-[10020] bg-slate-900/45 p-4">
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
          {achievementCelebration ? (
            <div className="fixed inset-0 z-[10030] bg-slate-900/35 p-4">
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
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Mine programmer</h2>
                  <p className="text-sm text-slate-500">Enkel oversikt</p>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.12)" }}>
                <div className="font-semibold">📋 Programoversikt</div>
                <div className="mt-4 space-y-3">
                  {memberPrograms.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-white p-6 text-center">
                      <div className="text-sm font-semibold text-slate-700">Ingen programmer ennå</div>
                      <div className="mt-1 text-sm text-slate-500">Be trener tildele et program for å komme i gang.</div>
                      <GradientButton onClick={() => setMemberTab("messages")} className="mt-3 w-full sm:w-auto">
                        Send melding til trener
                      </GradientButton>
                    </div>
                  ) : null}
                  {memberPrograms.map((program) => {
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
                            <GradientButton className="px-3 py-2 text-xs" onClick={() => startWorkoutMode(program.id)}>
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
                                  <div className="mt-0.5 text-xs text-slate-500">{exercise.sets}×{exercise.reps} · {exercise.weight}kg · {exercise.restSeconds}s</div>
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
                <div className="font-semibold">📝 Siste 5 økter</div>
                <div className="mt-4 space-y-3">
                  {completedLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen økter logget ennå.</div> : null}
                  {completedLogs.slice(0, 5).map((log) => (
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
                                  <div className="font-medium text-slate-800">{result.exerciseName}</div>
                                  <div className="mt-1 text-xs text-slate-600">
                                    Utført: {result.performedWeight || "0"} kg x {result.performedReps || "0"} reps
                                    {result.completed ? " - Fullført" : " - Ikke markert fullført"}
                                  </div>
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

              {activeWorkoutProgram && workoutMode ? (
                <div className="fixed inset-0 z-[10010] bg-slate-900/40 p-3 sm:p-6">
                  <div className="mx-auto flex h-full max-w-xl flex-col rounded-[28px] bg-white shadow-2xl pb-24 sm:pb-0">
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

                    <div className="flex-1 space-y-3 overflow-auto p-4">
                      {currentWorkoutGroup ? (
                        <div
                          key={currentWorkoutGroup.groupId}
                          className="w-full rounded-2xl border p-4 text-left transition bg-slate-50"
                          style={{ borderColor: "rgba(15,23,42,0.08)" }}
                        >
                          <div>
                            <div className="text-xs text-slate-400">Øvelse {workoutExerciseIndex + 1} av {workoutResultGroups.length}</div>
                            <div className="font-medium">{currentWorkoutGroup.exerciseName}</div>
                            <div className="mt-1 text-sm text-slate-500">Plan: {currentWorkoutGroup.rows.length} sett × {currentWorkoutGroup.plannedReps} reps · {currentWorkoutGroup.plannedWeight}kg</div>
                          </div>
                          {replacementCandidates.length > 0 ? (
                            <div className="mt-3 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                              <div className="text-xs font-medium text-slate-600">Bytt øvelse (samme muskelgruppe)</div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                <SelectBox
                                  value={replacementExerciseIdDraft}
                                  onChange={setReplacementExerciseIdDraft}
                                  options={replacementCandidates.map((exercise) => ({
                                    value: exercise.id,
                                    label: `${exercise.name} · ${exercise.group}`,
                                  }))}
                                />
                                <OutlineButton onClick={handleReplaceCurrentWorkoutExercise}>Bytt</OutlineButton>
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-3 space-y-2">
                            {currentWorkoutGroup.rows.map((row, index) => (
                              <div key={row.exerciseId} className={`rounded-xl border bg-white p-3 ${row.completed ? "border-emerald-300" : "border-slate-200"}`}>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-slate-600">Sett {row.setNumber ?? 1}</div>
                                  <button
                                    type="button"
                                    onClick={() => updateWorkoutExerciseResult(row.exerciseId, "completed", !row.completed)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${row.completed ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-700"}`}
                                  >
                                    {row.completed ? "Fullført" : "Marker"}
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">Kg utført</div>
                                    <TextInput
                                      ref={(input) => {
                                        workoutWeightInputRefs.current[row.exerciseId] = input;
                                      }}
                                      value={row.performedWeight}
                                      onChange={(e) => handleWorkoutResultInputChange(row, "performedWeight", e.target.value, index, currentWorkoutGroup.rows)}
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">Reps utført</div>
                                    <TextInput
                                      value={row.performedReps}
                                      onChange={(e) => handleWorkoutResultInputChange(row, "performedReps", e.target.value, index, currentWorkoutGroup.rows)}
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <TextArea value={workoutMode.note} onChange={(e) => updateWorkoutModeNote(e.target.value)} className="min-h-[110px]" placeholder="Hvordan gikk økta?" />
                    </div>

                    <div className="border-t p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
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
                          <GradientButton className="flex-1" onClick={finishWorkoutMode}>Ferdig og logg økt</GradientButton>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </Card>
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
                <div className="mt-1 text-xs text-slate-500">Små milepæler som holder motivasjonen oppe.</div>
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
                <div className="max-h-64 space-y-3 overflow-auto rounded-2xl border bg-slate-50 p-4">
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
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput value={profileWeight} onChange={(e) => setProfileWeight(e.target.value)} placeholder="Vekt (kg)" />
                    <TextInput value={profileTrainingGoal} onChange={(e) => setProfileTrainingGoal(e.target.value)} placeholder="Treningsmål (tekst)" />
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
