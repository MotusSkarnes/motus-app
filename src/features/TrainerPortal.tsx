import { useMemo, useState } from "react";
import { ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, Users } from "lucide-react";
import { MOTUS } from "../app/data";
import { uid } from "../app/storage";
import { Card, GradientButton, OutlineButton, PillButton, SelectBox, StatCard, TextArea, TextInput } from "../app/ui";
import type { ChatMessage, CustomerSubTab, Exercise, Member, ProgramExercise, TrainerTab, TrainingProgram, WorkoutLog } from "../app/types";

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
  addMember: () => void;
  saveProgramForMember: (input: { id?: string; title: string; goal: string; notes: string; memberId: string; exercises: ProgramExercise[] }) => void;
  deleteProgramById: (programId: string) => void;
  sendTrainerMessage: (memberId: string, text: string) => void;
};

export function TrainerPortal(props: TrainerPortalProps) {
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
    saveProgramForMember,
    deleteProgramById,
    sendTrainerMessage,
  } = props;

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [trainerMessage, setTrainerMessage] = useState("");
  const [customerSubTab, setCustomerSubTab] = useState<CustomerSubTab>("overview");
  const [programExercisesDraft, setProgramExercisesDraft] = useState<ProgramExercise[]>([]);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const selectedPrograms = programs.filter((program) => program.memberId === selectedMemberId);
  const selectedLogs = logs.filter((log) => log.memberId === selectedMemberId);
  const selectedMessages = messages.filter((message) => message.memberId === selectedMemberId);

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

  function updateDraftExercise(id: string, field: keyof ProgramExercise, value: string) {
    setProgramExercisesDraft((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeDraftExercise(id: string) {
    setProgramExercisesDraft((prev) => prev.filter((item) => item.id !== id));
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

  const followUpCount = useMemo(() => members.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length, [members]);

  return (
    <>
    <div className="space-y-6">
      <Card className="p-3 hidden lg:block">
        <div className="flex gap-2 overflow-auto pb-1">
          <PillButton active={trainerTab === "dashboard"} onClick={() => setTrainerTab("dashboard")}>Oversikt</PillButton>
          <PillButton active={trainerTab === "customers"} onClick={() => setTrainerTab("customers")}>Kunder</PillButton>
          <PillButton active={trainerTab === "programs"} onClick={() => setTrainerTab("programs")}>Programmer</PillButton>
          <PillButton active={trainerTab === "exerciseBank"} onClick={() => setTrainerTab("exerciseBank")}>Øvelsesbank</PillButton>
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Aktiv kunde" value={selectedMember?.name ?? "Ingen valgt"} hint={selectedMember?.goal ?? "Velg kunde"} />
        <StatCard label="Kunder" value={String(members.length)} hint="Totalt i appen" />
        <StatCard label="Må følges opp" value={String(followUpCount)} hint="7 dager eller mer uten aktivitet" />
      </div>

      {trainerTab === "dashboard" ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><LayoutDashboard className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Oversikt</h2>
              <p className="text-sm text-slate-500">Ren og enkel trenerstart</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Programmer" value={String(programs.length)} hint="Totalt" />
            <StatCard label="Logger" value={String(logs.length)} hint="Totalt" />
            <StatCard label="Meldinger" value={String(messages.length)} hint="Totalt" />
            <StatCard label="Øvelser" value={String(exercises.length)} hint="I banken" />
          </div>
        </Card>
      ) : null}

      {trainerTab === "customers" ? (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="p-4 h-fit">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Users className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Kunder</h2>
                <p className="text-sm text-slate-500">Velg kunde</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className="w-full rounded-2xl border p-3 text-left transition hover:shadow-sm"
                  style={selectedMemberId === member.id ? { backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise, boxShadow: "0 0 0 3px rgba(48,227,190,0.08)" } : { borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <div className="font-semibold">{member.name}</div>
                  <div className="text-sm text-slate-500">{member.email}</div>
                  <div className="mt-1 text-sm">Mål: {member.goal}</div>
                </button>
              ))}
              <OutlineButton onClick={addMember} className="w-full">Legg til testkunde</OutlineButton>
            </div>
          </Card>

          <Card className="p-5">
            {selectedMember ? (
              <div className="space-y-5">
                <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.ink} 100%)` }}>
                  <div className="text-sm text-white/80">Kundekort</div>
                  <div className="mt-1 text-2xl font-bold tracking-tight">{selectedMember.name}</div>
                  <div className="mt-2 text-sm text-white/85">{selectedMember.email}</div>
                  <div className="mt-1 text-sm text-white/85">Mål: {selectedMember.goal}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Programmer" value={String(selectedPrograms.length)} hint="På denne kunden" />
                  <StatCard label="Logger" value={String(selectedLogs.length)} hint="På denne kunden" />
                  <StatCard label="Meldinger" value={String(selectedMessages.length)} hint="På denne kunden" />
                  <StatCard label="Inaktivitet" value={`${selectedMember.daysSinceActivity} dager`} hint="Sist aktivitet" />
                </div>

                <div className="rounded-3xl border bg-slate-50/80 p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
                        <div><span className="font-medium text-slate-800">Fokus:</span> {selectedMember.focus}</div>
                        <div><span className="font-medium text-slate-800">Kundetype:</span> {selectedMember.customerType}</div>
                        <div><span className="font-medium text-slate-800">Medlemskap:</span> {selectedMember.membershipType}</div>
                        <div><span className="font-medium text-slate-800">Skader:</span> {selectedMember.injuries}</div>
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
                    <div className="rounded-3xl border bg-slate-50 p-4 space-y-3">
                      <div className="font-semibold">Kontakt og mål</div>
                      <TextInput value={selectedMember.name} readOnly />
                      <TextInput value={selectedMember.email} readOnly />
                      <TextInput value={selectedMember.phone} readOnly />
                      <TextInput value={selectedMember.goal} readOnly />
                      <TextInput value={selectedMember.focus} readOnly />
                    </div>
                    <div className="rounded-3xl border bg-slate-50 p-4 space-y-3">
                      <div className="font-semibold">Bakgrunn</div>
                      <TextArea value={selectedMember.personalGoals} readOnly className="min-h-[120px]" />
                      <TextArea value={selectedMember.injuries} readOnly className="min-h-[120px]" />
                      <TextArea value={selectedMember.coachNotes} readOnly className="min-h-[120px]" />
                    </div>
                  </div>
                ) : null}

                {customerSubTab === "programs" ? (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border bg-slate-50 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{editingProgramId ? "Rediger program" : "Bygg program"}</div>
                        {editingProgramId ? <OutlineButton onClick={resetProgramBuilder}>Avbryt redigering</OutlineButton> : null}
                      </div>
                      <TextInput value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på program" />
                      <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål" />
                      <TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} className="min-h-[110px]" placeholder="Notater" />

                      <div>
                        <div className="mb-2 text-sm font-medium text-slate-700">Legg til øvelse</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {exercises.map((exercise) => (
                            <button key={exercise.id} type="button" onClick={() => addExerciseToDraft(exercise)} className="rounded-2xl border bg-white px-3 py-3 text-left text-sm">
                              <div className="font-medium">{exercise.name}</div>
                              <div className="text-slate-500">{exercise.group} · {exercise.equipment}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {programExercisesDraft.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen øvelser valgt ennå.</div> : null}
                        {programExercisesDraft.map((item) => (
                          <div key={item.id} className="rounded-2xl border bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-medium">{item.exerciseName}</div>
                              <OutlineButton onClick={() => removeDraftExercise(item.id)}>Fjern</OutlineButton>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                              <TextInput value={item.sets} onChange={(e) => updateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                              <TextInput value={item.reps} onChange={(e) => updateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                              <TextInput value={item.weight} onChange={(e) => updateDraftExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                              <TextInput value={item.restSeconds} onChange={(e) => updateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                              <TextInput value={item.notes} onChange={(e) => updateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
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

                    <div className="rounded-3xl border bg-slate-50 p-4">
                      <div className="font-semibold">Eksisterende programmer</div>
                      <div className="mt-4 space-y-3">
                        {selectedPrograms.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center text-slate-500 bg-white">Ingen programmer ennå.</div> : null}
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
                      {selectedMessages.length === 0 ? <div className="text-sm text-slate-500">Ingen meldinger ennå.</div> : null}
                      {selectedMessages.map((message) => (
                        <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.sender === "trainer" ? "text-white ml-auto" : "bg-slate-50 border"}`} style={message.sender === "trainer" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                          <div>{message.text}</div>
                          <div className={`mt-1 text-[11px] ${message.sender === "trainer" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {trainerTab === "programs" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Nytt program</h2>
                <p className="text-sm text-slate-500">Enkel og stabil programoppretting</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <SelectBox value={selectedMemberId} onChange={setSelectedMemberId} options={members.map((member) => member.id)} />
              <TextInput value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på program" />
              <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål" />
              <TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} className="min-h-[120px]" placeholder="Notater" />
              <GradientButton
                onClick={() => {
                  saveProgramForMember({ id: editingProgramId ?? undefined, title: programTitle, goal: programGoal, notes: programNotes, memberId: selectedMemberId, exercises: programExercisesDraft });
                  resetProgramBuilder();
                }}
                className="w-full"
              >
                Lagre program
              </GradientButton>
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xl font-semibold tracking-tight">Programmer på valgt kunde</div>
            <div className="mt-4 space-y-3">
              {selectedPrograms.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Ingen programmer ennå.</div> : null}
              {selectedPrograms.map((program) => (
                <div key={program.id} className="rounded-3xl border p-4 bg-slate-50 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">{program.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"}</div>
                      <div className="mt-1 text-xs text-slate-400">Opprettet {program.createdAt}</div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <OutlineButton onClick={() => startEditProgram(program)}>Rediger</OutlineButton>
                      <OutlineButton onClick={() => deleteProgramById(program.id)}>Slett</OutlineButton>
                    </div>
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
          </Card>
        </div>
      ) : null}

      {trainerTab === "exerciseBank" ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><Dumbbell className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Øvelsesbank</h2>
              <p className="text-sm text-slate-500">Ren liste som ikke krasjer</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="rounded-2xl border bg-slate-50 p-4">
                <div className="font-medium">{exercise.name}</div>
                <div className="mt-1 text-sm text-slate-500">{exercise.group} · {exercise.equipment} · {exercise.level}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

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
    </div>
    </>
  );
}
