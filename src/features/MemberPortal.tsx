import { useEffect, useMemo, useState } from "react";
import { ClipboardList, MessageSquare, Target, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { formatDateDdMmYyyy } from "../app/dateFormat";
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
  const monthlyTarget = 8;
  const monthlyProgressPercent = Math.min(100, Math.round((estimatedSessionsThisMonth / monthlyTarget) * 100));
  const motivationalMessage =
    streakWeeks >= 4
      ? "Sterk flyt! Du har holdt rytmen i flere uker."
      : estimatedSessionsThisMonth >= 4
      ? "Bra jobba! Du bygger solide treningsvaner."
      : "Små steg teller. En økt i dag bygger momentum.";
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
    const trendTone = delta > 0 ? "text-emerald-700" : delta < 0 ? "text-amber-700" : "text-slate-700";
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
    return { recent14, previous14, delta, trendLabel, trendTone, consistency, nextFocus };
  }, [completedLogDates, now, sessionsRemaining]);
  const achievements = useMemo(() => {
    const items: Array<{ id: string; label: string; hint: string; unlocked: boolean }> = [
      {
        id: "first-session",
        label: "Første økt",
        hint: "Logg minst 1 fullført økt",
        unlocked: completedLogs.length >= 1,
      },
      {
        id: "streak-3",
        label: "3-ukers streak",
        hint: "Hold flyt i 3 uker",
        unlocked: streakWeeks >= 3,
      },
      {
        id: "ten-sessions",
        label: "10 økter",
        hint: "Fullfør totalt 10 økter",
        unlocked: completedLogs.length >= 10,
      },
      {
        id: "five-days",
        label: "5 treningsdager",
        hint: "Tren på 5 ulike dager",
        unlocked: uniqueTrainingDays >= 5,
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
  const shouldShowCelebration = Boolean(workoutCelebration && workoutCelebration.memberId === activeMemberId);

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

  function applyMetricDraftToProfile() {
    const value = goalMetricValueDraft.trim();
    if (!value) return;
    if (goalMetricDraft === "sessionsPerWeek") setProfileSessionsPerWeekTarget(value);
    if (goalMetricDraft === "dailySteps") setProfileDailyStepsTarget(value);
    if (goalMetricDraft === "targetWeight") setProfileTargetWeight(value);
    setGoalMetricValueDraft("");
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
                <div className="text-sm font-semibold text-slate-700">Neste steg</div>
                {nextProgram ? (
                  <div className="mt-2 space-y-3">
                    <div className="text-sm text-slate-600">
                      Neste program: <span className="font-medium text-slate-800">{nextProgram.title}</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <GradientButton
                        onClick={() => {
                          setMemberTab("programs");
                          startWorkoutMode(nextProgram.id);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Start dagens okt
                      </GradientButton>
                      <OutlineButton onClick={() => setMemberTab("programs")} className="w-full sm:w-auto">
                        Se alle programmer
                      </OutlineButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    <div className="text-sm text-slate-600">Du har ingen programmer enda. Send en melding til trener for a fa ditt forste oppsett.</div>
                    <GradientButton onClick={() => setMemberTab("messages")} className="w-full sm:w-auto">
                      Send melding til trener
                    </GradientButton>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4 space-y-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">Målstatus</div>
                {sessionsTargetNumber > 0 ? (
                  <div className="text-sm text-slate-600">
                    Treningsmål: {completedThisWeek}/{sessionsTargetNumber} økter denne uken
                    {sessionsRemaining > 0 ? ` · ${sessionsRemaining} trening${sessionsRemaining === 1 ? "" : "er"} igjen` : " · Ukemålet er nådd!"}
                  </div>
                ) : null}
                {dailyStepsTargetNumber > 0 ? (
                  <div className="text-sm text-slate-600">
                    Skrittmål: {currentDailyStepsNumber}/{dailyStepsTargetNumber} skritt i dag
                    {currentDailyStepsNumber < dailyStepsTargetNumber ? ` · ${dailyStepsTargetNumber - currentDailyStepsNumber} igjen` : " · Skrittmålet er nådd!"}
                  </div>
                ) : null}
                {targetWeightNumber > 0 && currentWeightNumber > 0 ? (
                  <div className="text-sm text-slate-600">
                    Vektmål: nå {currentWeightNumber} kg, mål {targetWeightNumber} kg
                  </div>
                ) : null}
                {sessionsTargetNumber <= 0 && dailyStepsTargetNumber <= 0 && targetWeightNumber <= 0 ? (
                  <div className="text-sm text-slate-500">Sett mål under Min profil for å få status her.</div>
                ) : null}
              </div>
              <div className="rounded-2xl border p-4 text-white" style={{ background: "linear-gradient(135deg, rgba(0,193,212,0.9) 0%, rgba(244,114,182,0.9) 100%)", borderColor: "rgba(255,255,255,0.3)" }}>
                <div className="text-xs uppercase tracking-wide text-white/85">Progress Story</div>
                <div className="mt-1 text-lg font-semibold">
                  {progressStory.recent14 > 0
                    ? `${progressStory.recent14} økter siste 14 dager`
                    : "Start neste kapittel med en ny økt"}
                </div>
                <div className={`mt-1 text-sm ${progressStory.trendTone.replace("text-", "text-white/")}`}>
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
              <div className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-semibold text-slate-700">Streaks + achievements</div>
                <div className="mt-1 text-xs text-slate-500">Små milepæler som holder motivasjonen oppe.</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {achievements.map((achievement) => (
                    <div
                      key={achievement.id}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        achievement.unlocked
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <div className="font-semibold">{achievement.label}</div>
                      <div className="mt-0.5 text-[11px]">{achievement.hint}</div>
                      <div className="mt-1 text-[11px] font-semibold">
                        {achievement.unlocked ? "Låst opp" : "På vei"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Motivasjon og flyt</div>
                      <div className="text-xs text-slate-500">{motivationalMessage}</div>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {streakWeeks} uker streak
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Månedsmål: {monthlyTarget} økter</span>
                      <span>{estimatedSessionsThisMonth}/{monthlyTarget}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200">
                      <div className="h-2 rounded-full" style={{ width: `${monthlyProgressPercent}%`, background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-xs text-slate-500">Unike treningsdager</div>
                      <div className="font-semibold text-slate-800">{uniqueTrainingDays}</div>
                    </div>
                    <div className="rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="text-xs text-slate-500">Økter denne måneden</div>
                      <div className="font-semibold text-slate-800">{estimatedSessionsThisMonth}</div>
                    </div>
                  </div>
                </div>
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
                        <div
                          key={`${day}-${index}`}
                          className={`rounded-lg px-1 py-2 text-center text-xs ${calendarDayLoad.has(day) ? "text-white font-semibold" : "text-slate-600 bg-white"}`}
                          style={
                            calendarDayLoad.has(day)
                              ? {
                                  background: `linear-gradient(135deg, rgba(0,193,212,${Math.max(
                                    0.25,
                                    ((calendarDayLoad.get(day) ?? 1) / Math.max(1, maxCalendarDayLoad)) * 0.95,
                                  )}) 0%, rgba(244,114,182,${Math.max(
                                    0.2,
                                    ((calendarDayLoad.get(day) ?? 1) / Math.max(1, maxCalendarDayLoad)) * 0.8,
                                  )}) 100%)`,
                                }
                              : { border: "1px solid rgba(15,23,42,0.06)" }
                          }
                          title={calendarDayLoad.has(day) ? `${calendarDayLoad.get(day)} økt${calendarDayLoad.get(day) === 1 ? "" : "er"} logget` : "Ingen økter logget"}
                        >
                          {day}
                        </div>
                      ) : (
                        <div key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Lav</span>
                    <div className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, rgba(0,193,212,0.25) 0%, rgba(244,114,182,0.2) 100%)" }} />
                    <div className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, rgba(0,193,212,0.6) 0%, rgba(244,114,182,0.55) 100%)" }} />
                    <div className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(90deg, rgba(0,193,212,0.95) 0%, rgba(244,114,182,0.8) 100%)" }} />
                    <span>Høy</span>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {shouldShowCelebration ? (
            <div className="fixed inset-0 z-[10020] bg-slate-900/45 p-4">
              <div className="mx-auto mt-16 max-w-sm rounded-3xl border bg-white p-5 shadow-2xl" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Ny PR!</div>
                <div className="mt-1 text-xl font-bold tracking-tight text-slate-900">Sterk økning i estimert 1RM</div>
                <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  {workoutCelebration?.exerciseName}: {workoutCelebration?.previousEstimated1RM.toFixed(1)} kg → {workoutCelebration?.newEstimated1RM.toFixed(1)} kg
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Beregnet fra {workoutCelebration?.weight} kg × {workoutCelebration?.reps} reps (omregnet til 1RM).
                </div>
                <GradientButton onClick={dismissWorkoutCelebration} className="mt-4 w-full">Rått! Fortsett</GradientButton>
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
              <div className="mt-5 space-y-3">
                {memberPrograms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center">
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
                  <div key={program.id} className="rounded-2xl border p-3 bg-slate-50 space-y-3">
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
                        {program.notes ? <div className="rounded-2xl border bg-white p-3 text-sm text-slate-600">{program.notes}</div> : null}

                        <div className="space-y-2">
                          {program.exercises.length === 0 ? <div className="rounded-2xl border border-dashed p-4 text-sm text-slate-500 bg-white">Ingen øvelser i programmet ennå.</div> : null}
                          {program.exercises.map((exercise) => (
                            <div key={exercise.id} className="rounded-xl border bg-white p-2.5">
                              <div className="font-medium text-sm">{exercise.exerciseName}</div>
                              <div className="mt-0.5 text-xs text-slate-500">{exercise.sets}×{exercise.reps} · {exercise.weight}kg · {exercise.restSeconds}s</div>
                              {exercise.notes ? <div className="mt-0.5 text-[11px] text-slate-500">{exercise.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                )})}
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
                            {currentWorkoutGroup.rows.map((row) => (
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
                                      value={row.performedWeight}
                                      onChange={(e) => updateWorkoutExerciseResult(row.exerciseId, "performedWeight", e.target.value)}
                                      placeholder="0"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-medium text-slate-500">Reps utført</div>
                                    <TextInput
                                      value={row.performedReps}
                                      onChange={(e) => updateWorkoutExerciseResult(row.exerciseId, "performedReps", e.target.value)}
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
                          <GradientButton className="flex-1" onClick={() => setWorkoutExerciseIndex((prev) => prev + 1)}>
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

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Treningsuker" value={String(streakWeeks)} hint="Sammenhengende flyt" />
                <StatCard label="Økter logget" value={String(completedLogs.length)} hint="Totalt fullført" />
                <StatCard label="Treningsdager" value={String(uniqueTrainingDays)} hint="Unike dager" />
                <StatCard label="Denne perioden" value={String(estimatedSessionsThisMonth)} hint="Loggede økter" />
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border bg-slate-50 p-4">
                  <div className="font-semibold">Personlige rekorder</div>
                  <div className="mt-4 space-y-3">
                    {personalRecords.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen PR-er registrert ennå.</div> : null}
                    {personalRecords.map((record) => (
                      <div key={record.name} className="rounded-2xl border bg-white p-4">
                        <div className="font-medium">{record.name}</div>
                        <div className="mt-1 text-sm text-slate-500">Beste registrerte: {record.weight} kg × {record.reps}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border bg-slate-50 p-4">
                  <div className="font-semibold">Siste økter</div>
                  <div className="mt-4 space-y-3">
                    {completedLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen økter logget ennå.</div> : null}
                    {completedLogs.slice(0, 6).map((log) => (
                      <div key={log.id} className="rounded-2xl border bg-white p-4">
                        <div className="font-medium">{log.programTitle}</div>
                        <div className="mt-1 text-sm text-slate-500">{log.date}</div>
                        {log.note ? <div className="mt-2 text-sm text-slate-600">{log.note}</div> : null}
                      </div>
                    ))}
                  </div>
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
                    <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.sender === "member" ? "text-white ml-auto" : "bg-white border"}`} style={message.sender === "member" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Mål</span>
                        <TextInput value={memberGoalDraft} onChange={(e) => setMemberGoalDraft(e.target.value)} placeholder="Mål" />
                      </label>
                      <label className="space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Fokus</span>
                        <TextInput value={memberFocusDraft} onChange={(e) => setMemberFocusDraft(e.target.value)} placeholder="Fokus" />
                      </label>
                    </div>
                    <label className="space-y-1">
                      <span className="text-sm font-semibold text-slate-700">Skader / hensyn</span>
                      <TextArea value={memberInjuriesDraft} onChange={(e) => setMemberInjuriesDraft(e.target.value)} className="min-h-[90px]" placeholder="Skader / hensyn" />
                    </label>
                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                      <div><span className="font-medium text-slate-800">Status:</span> {customerStatusLabel}</div>
                      <div><span className="font-medium text-slate-800">Siste trening:</span> {latestCompletedLog ? `${latestCompletedLog.date} (${latestCompletedLog.programTitle})` : "Ingen fullførte økter ennå"}</div>
                      <div><span className="font-medium text-slate-800">Invitert:</span> {editableMember.invitedAt || "Ikke invitert enda"}</div>
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
