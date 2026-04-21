import { useMemo, useState } from "react";
import { ClipboardList, MessageSquare, Target, TrendingUp, UserCircle2 } from "lucide-react";
import { MOTUS } from "../app/data";
import { Card, GradientButton, OutlineButton, PillButton, SelectBox, StatCard, TextArea, TextInput } from "../app/ui";
import type { ChatMessage, Member, MemberTab, TrainingProgram, WorkoutLog, WorkoutModeState } from "../app/types";

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
};

export function MemberPortal(props: MemberPortalProps) {
  const { members, programs, logs, messages, memberViewId, setMemberViewId, memberTab, setMemberTab, sendMemberMessage, workoutMode, startWorkoutMode, updateWorkoutExerciseResult, updateWorkoutModeNote, finishWorkoutMode, cancelWorkoutMode } = props;
  const [messageText, setMessageText] = useState("");
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const memberPrograms = programs.filter((program) => program.memberId === memberViewId);
  const memberLogs = logs.filter((log) => log.memberId === memberViewId);
  const memberMessages = messages.filter((message) => message.memberId === memberViewId);
  const activeWorkoutProgram = workoutMode ? memberPrograms.find((program) => program.id === workoutMode.programId) ?? null : null;

  const completedLogs = memberLogs.filter((log) => log.status === "Fullført");
  const uniqueTrainingDays = new Set(completedLogs.map((log) => log.date)).size;
  const streakWeeks = Math.min(12, completedLogs.length);
  const estimatedSessionsThisMonth = completedLogs.length;

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

  return (
    <>
    <div className="space-y-6">
      <Card className="p-3 hidden lg:block">
        <div className="flex gap-2 overflow-auto pb-1">
          <PillButton active={memberTab === "overview"} onClick={() => setMemberTab("overview")}>Oversikt</PillButton>
          <PillButton active={memberTab === "programs"} onClick={() => setMemberTab("programs")}>Programmer</PillButton>
          <PillButton active={memberTab === "progress"} onClick={() => setMemberTab("progress")}>Fremgang</PillButton>
          <PillButton active={memberTab === "messages"} onClick={() => setMemberTab("messages")}>Meldinger</PillButton>
          <PillButton active={memberTab === "profile"} onClick={() => setMemberTab("profile")}>Profil</PillButton>
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="p-4 h-fit xl:p-5">
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

        <div className="space-y-6">
          {memberTab === "overview" ? (
            <Card className="p-5">
              <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                <div className="text-sm text-white/80">Hei{viewedMember ? `, ${viewedMember.name}` : ""}</div>
                <div className="mt-1 text-3xl font-bold tracking-tight">Klar for neste økt?</div>
                <div className="mt-2 text-sm text-white/90">Dette er en ren medlemsside som er mye enklere å bygge videre på.</div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard label="Programmer" value={String(memberPrograms.length)} hint="Tildelt deg" />
                <StatCard label="Logger" value={String(memberLogs.length)} hint="Registrert" />
                <StatCard label="Meldinger" value={String(memberMessages.length)} hint="I chatten" />
              </div>
            </Card>
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
                          <div className="mt-1 text-sm text-slate-500">{workoutMode.results.filter(r => r.completed).length}/{activeWorkoutProgram.exercises.length} øvelser fullført</div>
                        </div>
                        <OutlineButton onClick={cancelWorkoutMode}>Lukk</OutlineButton>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3 overflow-auto p-4">
                      {workoutMode.results.map((result, index) => {
                        return (
                          <div
                            key={result.exerciseId}
                            className={`w-full rounded-2xl border p-4 text-left transition ${result.completed ? "bg-emerald-50" : "bg-slate-50"}`}
                            style={{ borderColor: result.completed ? "#86efac" : "rgba(15,23,42,0.08)" }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs text-slate-400">Øvelse {index + 1}</div>
                                <div className="font-medium">{result.exerciseName}</div>
                                <div className="mt-1 text-sm text-slate-500">Plan: {result.plannedSets}×{result.plannedReps} · {result.plannedWeight}kg</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateWorkoutExerciseResult(result.exerciseId, "completed", !result.completed)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${result.completed ? "bg-emerald-500 text-white" : "bg-white text-slate-600"}`}
                              >
                                {result.completed ? "Ferdig" : "Marker"}
                              </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <TextInput
                                value={result.performedWeight}
                                onChange={(e) => updateWorkoutExerciseResult(result.exerciseId, "performedWeight", e.target.value)}
                                placeholder="Kg utført"
                              />
                              <TextInput
                                value={result.performedReps}
                                onChange={(e) => updateWorkoutExerciseResult(result.exerciseId, "performedReps", e.target.value)}
                                placeholder="Reps utført"
                              />
                            </div>
                          </div>
                        );
                      })}

                      <TextArea value={workoutMode.note} onChange={(e) => updateWorkoutModeNote(e.target.value)} className="min-h-[110px]" placeholder="Hvordan gikk økta?" />
                    </div>

                    <div className="border-t p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="flex gap-3">
                        <OutlineButton className="flex-1" onClick={cancelWorkoutMode}>Avbryt</OutlineButton>
                        <GradientButton className="flex-1" onClick={finishWorkoutMode}>Logg økt</GradientButton>
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
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <TextInput value={viewedMember.name} readOnly />
                  <TextInput value={viewedMember.email} readOnly />
                  <TextInput value={viewedMember.goal} readOnly />
                  <TextInput value={viewedMember.focus} readOnly />
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
