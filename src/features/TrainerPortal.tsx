import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, Users } from "lucide-react";
import { MOTUS } from "../app/data";
import { uid } from "../app/storage";
import { Card, GradientButton, OutlineButton, PillButton, SelectBox, StatCard, TextArea, TextInput } from "../app/ui";
import type { CreateMemberInput } from "../services/appRepository";
import type { InviteMemberResult } from "../services/supabaseAuth";
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
  addMember: (input: CreateMemberInput) => void;
  deactivateMember: (memberId: string) => void;
  markMemberInvited: (memberId: string, invitedAtIso?: string) => void;
  inviteMember: (email: string, memberId: string) => Promise<InviteMemberResult>;
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
    deactivateMember,
    markMemberInvited,
    inviteMember,
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
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberGoal, setNewMemberGoal] = useState("");
  const [newMemberFocus, setNewMemberFocus] = useState("");
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [pendingProgramMemberEmail, setPendingProgramMemberEmail] = useState<string | null>(null);
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
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
        if (memberFilter === "followUp") return Number(member.daysSinceActivity || "0") >= 7;
        if (memberFilter === "invited") return Boolean(member.invitedAt);
        if (memberFilter === "notInvited") return !member.invitedAt;
        return true;
      })
      .sort((a, b) => {
        const aDays = Number(a.daysSinceActivity || "0");
        const bDays = Number(b.daysSinceActivity || "0");
        if (bDays !== aDays) return bDays - aDays;
        return a.name.localeCompare(b.name, "no");
      });
  }, [visibleMembers, memberSearch, memberFilter]);
  const inviteStatusTone =
    inviteStatus?.toLowerCase().includes("sendt") || inviteStatus?.toLowerCase().includes("invitasjon sendt")
      ? "success"
      : inviteStatus
      ? "error"
      : null;
  const selectedPrograms = programs.filter((program) => program.memberId === selectedMemberId);
  const selectedLogs = logs.filter((log) => log.memberId === selectedMemberId);
  const selectedMessages = messages.filter((message) => message.memberId === selectedMemberId);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberSearch", memberSearch);
  }, [memberSearch]);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberFilter", memberFilter);
  }, [memberFilter]);

  useEffect(() => {
    if (!pendingProgramMemberEmail) return;
    const createdMember = members.find((member) => member.email.toLowerCase() === pendingProgramMemberEmail.toLowerCase());
    if (!createdMember) return;
    setSelectedMemberId(createdMember.id);
    setTrainerTab("customers");
    setCustomerSubTab("programs");
    setPendingProgramMemberEmail(null);
  }, [pendingProgramMemberEmail, members, setSelectedMemberId, setTrainerTab]);

  function formatInvitedAt(iso: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("no-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  function submitNewMember(openProgramAfterCreate = false) {
    const name = newMemberName.trim();
    const email = newMemberEmail.trim().toLowerCase();
    if (!name || !email) {
      setNewMemberError("Navn og e-post er påkrevd.");
      return;
    }
    if (!email.includes("@")) {
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
      phone: newMemberPhone,
      goal: newMemberGoal,
      focus: newMemberFocus,
    });

    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberPhone("");
    setNewMemberGoal("");
    setNewMemberFocus("");
    setNewMemberError(null);
    if (openProgramAfterCreate) {
      setPendingProgramMemberEmail(email);
    }
  }

  function handleDeactivateMember(memberId: string) {
    deactivateMember(memberId);
  }

  function resetMemberListControls() {
    setMemberSearch("");
    setMemberFilter("all");
  }

  async function handleInviteSelectedMember() {
    if (!selectedMember) return;
    const email = inviteEmail.trim().toLowerCase() || selectedMember.email.toLowerCase();
    setInviteStatus("Sender invitasjon...");
    const result = await inviteMember(email, selectedMember.id);
    if (result.ok) {
      markMemberInvited(selectedMember.id, new Date().toISOString());
    }
    setInviteStatus(result.message);
  }

  const followUpCount = useMemo(() => members.filter((member) => Number(member.daysSinceActivity || "0") >= 7).length, [members]);
  const membersWithoutProgramCount = useMemo(
    () => members.filter((member) => !programs.some((program) => program.memberId === member.id)).length,
    [members, programs],
  );

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
        <Card className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><LayoutDashboard className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Oversikt</h2>
              <p className="text-sm text-slate-500">Start her: velg kunde, lag program, folg opp.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Programmer" value={String(programs.length)} hint="Totalt" />
            <StatCard label="Logger" value={String(logs.length)} hint="Totalt" />
            <StatCard label="Meldinger" value={String(messages.length)} hint="Totalt" />
            <StatCard label="Øvelser" value={String(exercises.length)} hint="I banken" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <GradientButton onClick={() => setTrainerTab("customers")} className="w-full">
              1. Velg eller opprett kunde
            </GradientButton>
            <GradientButton onClick={() => setTrainerTab("programs")} className="w-full">
              2. Lag program raskt
            </GradientButton>
            <OutlineButton onClick={() => setTrainerTab("customers")} className="w-full">
              3. Send oppfolging
            </OutlineButton>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
            {followUpCount > 0
              ? `${followUpCount} kunder ma folges opp i dag.`
              : "Ingen kunder trenger oppfolging akkurat na."}{" "}
            {membersWithoutProgramCount > 0 ? `${membersWithoutProgramCount} kunder mangler program.` : "Alle aktive kunder har program."}
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
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  {filteredMembers.length} treff{memberFilter !== "all" ? " med aktivt filter" : ""}
                </div>
                {(memberSearch.trim() || memberFilter !== "all") ? (
                  <OutlineButton onClick={resetMemberListControls} className="px-3 py-1.5 text-xs">
                    Nullstill sok/filter
                  </OutlineButton>
                ) : null}
              </div>
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
              {filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Ingen kunder matcher sok/filter. Proev et enklere sok eller bytt filter.
                </div>
              ) : null}
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className="w-full rounded-2xl border p-3 text-left transition hover:shadow-sm"
                  style={selectedMemberId === member.id ? { backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise, boxShadow: "0 0 0 3px rgba(48,227,190,0.08)" } : { borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <div className="font-semibold">{member.name}</div>
                  <div className="text-sm text-slate-500">
                    {member.email}
                    {member.isActive === false ? " · Inaktiv" : ""}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <div className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${member.invitedAt ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {member.invitedAt ? "Invitert" : "Ikke invitert"}
                    </div>
                    {Number(member.daysSinceActivity || "0") >= 7 ? (
                      <div className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Ma folges opp
                      </div>
                    ) : null}
                  </div>
                  {member.invitedAt ? (
                    <div className="mt-1 text-[11px] text-emerald-700">Dato: {formatInvitedAt(member.invitedAt)}</div>
                  ) : null}
                  <div className="mt-1 text-sm">Mål: {member.goal}</div>
                </button>
              ))}
              <OutlineButton onClick={() => setShowInactiveMembers((prev) => !prev)} className="w-full">
                {showInactiveMembers ? "Skjul inaktive" : "Vis inaktive"}
              </OutlineButton>
              <div className="rounded-2xl border bg-slate-50 p-3 space-y-2.5" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="text-sm font-medium text-slate-700">Nytt medlem</div>
                <TextInput value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Navn" />
                <TextInput value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="E-post" />
                <TextInput value={newMemberPhone} onChange={(e) => setNewMemberPhone(e.target.value)} placeholder="Telefon (valgfritt)" />
                <TextInput value={newMemberGoal} onChange={(e) => setNewMemberGoal(e.target.value)} placeholder="Hovedmål (valgfritt)" />
                <TextInput value={newMemberFocus} onChange={(e) => setNewMemberFocus(e.target.value)} placeholder="Fokus (valgfritt)" />
                {newMemberError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{newMemberError}</div> : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <GradientButton onClick={() => submitNewMember(false)} className="w-full">Opprett medlem</GradientButton>
                  <OutlineButton onClick={() => submitNewMember(true)} className="w-full">Opprett + lag program</OutlineButton>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
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
                  <div className="text-sm text-white/80">Kundekort</div>
                  <div className="mt-1 text-2xl font-bold tracking-tight">{selectedMember.name}</div>
                  <div className="mt-2 text-sm text-white/85">{selectedMember.email}</div>
                  <div className="mt-1 text-sm text-white/85">Mål: {selectedMember.goal}</div>
                  <div className="mt-1 text-xs text-white/85">
                    {selectedMember.invitedAt ? `Invitert: ${formatInvitedAt(selectedMember.invitedAt)}` : "Ikke invitert enda"}
                  </div>
                  <div className="mt-3">
                    <OutlineButton onClick={() => handleDeactivateMember(selectedMember.id)}>
                      Sett medlem som inaktiv
                    </OutlineButton>
                  </div>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4 space-y-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="font-semibold">Inviter medlem til appen (kun e-post)</div>
                  <div className="text-xs text-slate-500">Bruk en ekte e-postadresse (ikke example.com) som matcher valgt medlem.</div>
                  <TextInput
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={selectedMember.email}
                  />
                  <GradientButton onClick={handleInviteSelectedMember}>
                    {selectedMember.invitedAt ? "Send på nytt" : "Send invitasjon"}
                  </GradientButton>
                  {inviteStatus ? (
                    <div
                      className={`rounded-xl border px-3 py-2 text-sm ${inviteStatusTone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
                    >
                      {inviteStatus}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Programmer" value={String(selectedPrograms.length)} hint="På denne kunden" />
                  <StatCard label="Logger" value={String(selectedLogs.length)} hint="På denne kunden" />
                  <StatCard label="Meldinger" value={String(selectedMessages.length)} hint="På denne kunden" />
                  <StatCard label="Inaktivitet" value={`${selectedMember.daysSinceActivity} dager`} hint="Sist aktivitet" />
                </div>

                <div className="rounded-3xl border bg-slate-50/80 p-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="grid grid-cols-3 gap-2">
                    <PillButton active={customerSubTab === "overview"} onClick={() => setCustomerSubTab("overview")}>Oversikt</PillButton>
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
              </div>
            )}
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
              <SelectBox
                value={selectedMemberId}
                onChange={setSelectedMemberId}
                options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
              />
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
