import { useEffect, useMemo, useState } from "react";
import { ClipboardList, MessageSquare, Target, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { Card, GradientButton, OutlineButton, SelectBox, StatCard, TextArea, TextInput } from "../app/ui";
import type { ChatMessage, Member, MemberTab, TrainingProgram, WorkoutCelebration, WorkoutLog, WorkoutModeState } from "../app/types";

type MemberPortalProps = {
  members: Member[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  memberViewId: string;
  setMemberViewId: (id: string) => void;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  sendMemberMessage: (memberId: string, text: string) => void;
  workoutMode: WorkoutModeState | null;
  startWorkoutMode: (programId: string) => void;
  updateWorkoutExerciseResult: (exerciseId: string, field: "performedWeight" | "performedReps" | "completed", value: string | boolean) => void;
  updateWorkoutModeNote: (note: string) => void;
  finishWorkoutMode: () => void;
  cancelWorkoutMode: () => void;
  workoutCelebration: WorkoutCelebration | null;
  dismissWorkoutCelebration: () => void;
};

export function MemberPortal(props: MemberPortalProps) {
  const { members, programs, logs, messages, memberViewId, setMemberViewId, memberTab, setMemberTab, sendMemberMessage, workoutMode, startWorkoutMode, updateWorkoutExerciseResult, updateWorkoutModeNote, finishWorkoutMode, cancelWorkoutMode, workoutCelebration, dismissWorkoutCelebration } = props;
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
  const [workoutExerciseIndex, setWorkoutExerciseIndex] = useState(0);
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const relatedMemberIds = useMemo(() => {
    if (!viewedMember) return [memberViewId];
    const normalizedEmail = viewedMember.email.trim().toLowerCase();
    if (!normalizedEmail) return [memberViewId];
    const ids = members
      .filter((member) => member.email.trim().toLowerCase() === normalizedEmail)
      .map((member) => member.id);
    return ids.length ? ids : [memberViewId];
  }, [members, viewedMember, memberViewId]);
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
  const now = new Date();

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

  const trainingDaysThisMonth = new Set(
    completedLogDates
      .filter((date) => date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear())
      .map((date) => date.getDate()),
  );
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
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
  const shouldShowCelebration = Boolean(workoutCelebration && workoutCelebration.memberId === memberViewId);

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
    if (!viewedMember) return;
    const fallbackWeight = viewedMember.weight ?? "";
    const fallbackGoal = viewedMember.goal ?? "";
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
      return;
    }
    try {
      const raw = window.localStorage.getItem(getProfileStorageKey(viewedMember.id));
      if (!raw) {
        setProfileWeight(fallback.weight);
        setProfileTrainingGoal(fallback.trainingGoal);
        setProfileSessionsPerWeekTarget(fallback.sessionsPerWeekTarget);
        setProfileDailyStepsTarget(fallback.dailyStepsTarget);
        setProfileTargetWeight(fallback.targetWeight);
        setProfileCurrentDailySteps(fallback.currentDailySteps);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<typeof fallback>;
      setProfileWeight(parsed.weight ?? fallback.weight);
      setProfileTrainingGoal(parsed.trainingGoal ?? fallback.trainingGoal);
      setProfileSessionsPerWeekTarget(parsed.sessionsPerWeekTarget ?? "");
      setProfileDailyStepsTarget(parsed.dailyStepsTarget ?? "");
      setProfileTargetWeight(parsed.targetWeight ?? "");
      setProfileCurrentDailySteps(parsed.currentDailySteps ?? "");
    } catch {
      setProfileWeight(fallback.weight);
      setProfileTrainingGoal(fallback.trainingGoal);
      setProfileSessionsPerWeekTarget(fallback.sessionsPerWeekTarget);
      setProfileDailyStepsTarget(fallback.dailyStepsTarget);
      setProfileTargetWeight(fallback.targetWeight);
      setProfileCurrentDailySteps(fallback.currentDailySteps);
    }
  }, [viewedMember]);

  function applyMetricDraftToProfile() {
    const value = goalMetricValueDraft.trim();
    if (!value) return;
    if (goalMetricDraft === "sessionsPerWeek") setProfileSessionsPerWeekTarget(value);
    if (goalMetricDraft === "dailySteps") setProfileDailyStepsTarget(value);
    if (goalMetricDraft === "targetWeight") setProfileTargetWeight(value);
    setGoalMetricValueDraft("");
  }

  function saveProfile() {
    if (!viewedMember || typeof window === "undefined") return;
    const next = {
      weight: profileWeight.trim(),
      trainingGoal: profileTrainingGoal.trim(),
      sessionsPerWeekTarget: profileSessionsPerWeekTarget.trim(),
      dailyStepsTarget: profileDailyStepsTarget.trim(),
      targetWeight: profileTargetWeight.trim(),
      currentDailySteps: profileCurrentDailySteps.trim(),
    };
    window.localStorage.setItem(getProfileStorageKey(viewedMember.id), JSON.stringify(next));
    setProfileSaveInfo("Profil og mål lagret.");
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

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      <Card className="p-3 hidden lg:block">
        <div
          className="flex gap-2 overflow-auto rounded-2xl p-2"
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
              <h2 className="text-xl font-semibold tracking-tight">Velg medlem</h2>
              <p className="text-sm text-slate-500">Simuler medlemsportal</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <SelectBox
              value={memberViewId}
              onChange={setMemberViewId}
              options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
            />
            {viewedMember ? (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise }}>
                <div className="font-medium">{viewedMember.name}</div>
                <div className="text-sm text-slate-500">{viewedMember.email}</div>
                <div className="mt-2 text-sm"><span className="font-medium">Mål:</span> {viewedMember.goal}</div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          <Card className="p-3 lg:hidden">
            <div className="text-xs font-medium text-slate-600 mb-2">Bytt medlem</div>
            <SelectBox
              value={memberViewId}
              onChange={setMemberViewId}
              options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
            />
          </Card>
          {memberTab === "overview" ? (
            <Card className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              <div className="rounded-[22px] p-4 sm:p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                <div className="text-sm text-white/80">Hei{viewedMember ? `, ${viewedMember.name}` : ""}</div>
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
                    {now.toLocaleDateString("no-NO", { month: "long", year: "numeric" })}
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
                    <span>Ma</span><span>Ti</span><span>On</span><span>To</span><span>Fr</span><span>Lo</span><span>So</span>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {calendarCells.map((day, index) =>
                      day ? (
                        <div
                          key={`${day}-${index}`}
                          className={`rounded-lg px-1 py-2 text-center text-xs ${trainingDaysThisMonth.has(day) ? "text-white font-semibold" : "text-slate-600 bg-white"}`}
                          style={
                            trainingDaysThisMonth.has(day)
                              ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }
                              : { border: "1px solid rgba(15,23,42,0.06)" }
                          }
                        >
                          {day}
                        </div>
                      ) : (
                        <div key={`empty-${index}`} />
                      ),
                    )}
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
                {memberPrograms.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Ingen programmer ennå.</div> : null}
                {memberPrograms.map((program) => (
                  <div key={program.id} className="rounded-2xl border p-3 bg-slate-50 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm">{program.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{program.createdAt}</div>
                      </div>
                      <GradientButton className="px-3 py-2 text-xs" onClick={() => startWorkoutMode(program.id)}>
                        Start økt
                      </GradientButton>
                    </div>

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
                  </div>
                ))}
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
                  {memberMessages.length === 0 ? <div className="text-sm text-slate-500">Ingen meldinger ennå.</div> : null}
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
                    if (!memberViewId || !messageText.trim()) return;
                    sendMemberMessage(memberViewId, messageText);
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
                  <h2 className="text-xl font-semibold tracking-tight">Min profil</h2>
                  <p className="text-sm text-slate-500">Enkel medlemsprofil</p>
                </div>
              </div>
              {viewedMember ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput value={viewedMember.name} readOnly />
                    <TextInput value={viewedMember.email} readOnly />
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
                  {profileSaveInfo ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{profileSaveInfo}</div> : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
}
