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
    saveExercise,
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
  const [templateTitle, setTemplateTitle] = useState("Ny treningsmal");
  const [templateGoal, setTemplateGoal] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");
  const [templateExercisesDraft, setTemplateExercisesDraft] = useState<ProgramExercise[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateAssignStatus, setTemplateAssignStatus] = useState<string | null>(null);
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedTodoDate, setSelectedTodoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [todoTitle, setTodoTitle] = useState("");
  const [todos, setTodos] = useState<Array<{ id: string; title: string; date: string; done: boolean }>>([]);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "red" | "orange" | "green">("all");
  const [prioritySort, setPrioritySort] = useState<"highFirst" | "lowFirst">("highFirst");
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
  const [exerciseFormStatus, setExerciseFormStatus] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
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
  const templatePrograms = programs.filter((program) => program.memberId === "__template__");
  const selectedLogs = logs.filter((log) => log.memberId === selectedMemberId);
  const selectedMessages = messages.filter((message) => message.memberId === selectedMemberId);
  const visibleExercises = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    return exercises.filter((exercise) => {
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
  }, [exercises, exerciseSearch, exerciseCategoryFilter]);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberSearch", memberSearch);
  }, [memberSearch]);

  useEffect(() => {
    window.localStorage.setItem("motus.trainer.memberFilter", memberFilter);
  }, [memberFilter]);

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
      setSelectedTemplateId("");
      return;
    }
    if (!templatePrograms.some((program) => program.id === selectedTemplateId)) {
      setSelectedTemplateId(templatePrograms[0].id);
    }
  }, [templatePrograms, selectedTemplateId]);

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

  function addExerciseToTemplateDraft(exercise: Exercise) {
    setTemplateExercisesDraft((prev) => [
      ...prev,
      {
        id: uid("template-ex"),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: "3",
        reps: "8",
        weight: "",
        restSeconds: "90",
        notes: "",
      },
    ]);
  }

  function updateTemplateDraftExercise(id: string, field: keyof ProgramExercise, value: string) {
    setTemplateExercisesDraft((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeTemplateDraftExercise(id: string) {
    setTemplateExercisesDraft((prev) => prev.filter((item) => item.id !== id));
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

  function saveTemplateProgram() {
    if (!templateTitle.trim()) return;
    saveProgramForMember({
      title: templateTitle,
      goal: templateGoal,
      notes: templateNotes,
      memberId: "__template__",
      exercises: templateExercisesDraft,
    });
    setTemplateTitle("Ny treningsmal");
    setTemplateGoal("");
    setTemplateNotes("");
    setTemplateExercisesDraft([]);
    setTemplateAssignStatus("Treningsmal lagret. Velg kunde og tildel.");
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

  function assignTemplateToSelectedMember() {
    if (!selectedMemberId) {
      setTemplateAssignStatus("Velg kunde før tildeling.");
      return;
    }
    const template = templatePrograms.find((program) => program.id === selectedTemplateId) ?? templatePrograms[0];
    if (!template) {
      setTemplateAssignStatus("Ingen treningsmaler tilgjengelig enda.");
      return;
    }
    saveProgramForMember({
      title: template.title,
      goal: template.goal,
      notes: template.notes,
      memberId: selectedMemberId,
      exercises: template.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
    });
    const memberName = members.find((member) => member.id === selectedMemberId)?.name ?? "kunden";
    setTemplateAssignStatus(`Malen ble tildelt ${memberName}.`);
    setTrainerTab("customers");
    setCustomerSubTab("programs");
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
  const monthLabel = dashboardMonth.toLocaleDateString("no-NO", { month: "long", year: "numeric" });

  const membersWithPriority = useMemo(() => {
    function getPriority(member: Member): { tone: "red" | "orange" | "green"; score: number; label: string } {
      const days = Number(member.daysSinceActivity || "0");
      if (days >= 10) return { tone: "red", score: 3, label: "Rød" };
      if (days >= 5) return { tone: "orange", score: 2, label: "Oransje" };
      return { tone: "green", score: 1, label: "Grønn" };
    }

    const mapped = members.map((member) => ({ member, priority: getPriority(member) }));
    const filtered = priorityFilter === "all" ? mapped : mapped.filter((item) => item.priority.tone === priorityFilter);
    return filtered.sort((a, b) => {
      if (prioritySort === "highFirst") return b.priority.score - a.priority.score;
      return a.priority.score - b.priority.score;
    });
  }, [members, priorityFilter, prioritySort]);

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

      {trainerTab === "dashboard" ? (
        <Card className="p-5 space-y-5">
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
              </div>
            </div>
            <div className="space-y-2">
              {membersWithPriority.map(({ member, priority }) => (
                <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{member.name}</div>
                    <div className="text-xs text-slate-500">{member.email} · {member.daysSinceActivity} dager siden aktivitet</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTrainerTab("customers");
                      setSelectedMemberId(member.id);
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
              ))}
            </div>
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
                              <div className="text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
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
        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><ClipboardList className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Treningsmaler</h2>
                <p className="text-sm text-slate-500">Lag maler med sett/reps og tildel kunder med ett klikk.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <TextInput value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Navn på mal" />
                <TextInput value={templateGoal} onChange={(e) => setTemplateGoal(e.target.value)} placeholder="Mål med malen" />
                <TextArea value={templateNotes} onChange={(e) => setTemplateNotes(e.target.value)} className="min-h-[90px]" placeholder="Notater til trener/medlem" />
                <div>
                  <div className="mb-2 text-sm font-medium text-slate-700">Legg til øvelser i malen</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {exercises.map((exercise) => (
                      <button key={exercise.id} type="button" onClick={() => addExerciseToTemplateDraft(exercise)} className="rounded-2xl border bg-white px-3 py-3 text-left text-sm">
                        <div className="font-medium">{exercise.name}</div>
                        <div className="text-slate-500">{exercise.category} · {exercise.group} · Utstyr: {exercise.equipment}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {templateExercisesDraft.length === 0 ? <div className="rounded-2xl border border-dashed bg-white p-4 text-sm text-slate-500">Ingen øvelser i malen enda.</div> : null}
                  {templateExercisesDraft.map((item) => (
                    <div key={item.id} className="rounded-2xl border bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">{item.exerciseName}</div>
                        <OutlineButton onClick={() => removeTemplateDraftExercise(item.id)} className="px-3 py-1.5 text-xs">Fjern</OutlineButton>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <TextInput value={item.sets} onChange={(e) => updateTemplateDraftExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                        <TextInput value={item.reps} onChange={(e) => updateTemplateDraftExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                        <TextInput value={item.restSeconds} onChange={(e) => updateTemplateDraftExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                        <TextInput value={item.notes} onChange={(e) => updateTemplateDraftExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                      </div>
                    </div>
                  ))}
                </div>
                <GradientButton onClick={saveTemplateProgram} className="w-full">Lagre treningsmal</GradientButton>
              </div>
              <div className="space-y-3 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                <div className="font-semibold">Tildel mal til kunde</div>
                <SelectBox
                  value={selectedTemplateId}
                  onChange={setSelectedTemplateId}
                  options={
                    templatePrograms.length
                      ? templatePrograms.map((program) => ({ value: program.id, label: `${program.title} (${program.exercises.length} øvelser)` }))
                      : [{ value: "", label: "Ingen maler lagret enda" }]
                  }
                />
                <SelectBox
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  options={members.map((member) => ({ value: member.id, label: `${member.name} (${member.email})` }))}
                />
                <GradientButton onClick={assignTemplateToSelectedMember} className="w-full">
                  Tildel mal til valgt kunde
                </GradientButton>
                {templateAssignStatus ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {templateAssignStatus}
                  </div>
                ) : null}
                <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  Medlem fyller inn utført kg selv i øktmodus, og kan justere reps ved behov.
                </div>
                <div className="space-y-2">
                  {templatePrograms.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-3 text-sm text-slate-500">Ingen maler ennå.</div> : null}
                  {templatePrograms.map((program) => (
                    <div key={program.id} className="rounded-xl border bg-white p-3" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="font-medium text-sm">{program.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{program.goal || "Uten mål"} · {program.exercises.length} øvelser</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
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
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleExercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-2xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="flex items-start gap-3">
                      <img
                        src={getExercisePreviewSrc(exercise)}
                        alt={`Skisse av ${exercise.name}`}
                        className="h-14 w-14 rounded-xl border bg-white object-cover"
                        style={{ borderColor: "rgba(15,23,42,0.08)" }}
                        onError={(event) => {
                          event.currentTarget.src = getExerciseSketchDataUri(exercise);
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium leading-tight">{exercise.name}</div>
                          <OutlineButton onClick={() => startEditExercise(exercise)} className="px-3 py-1.5 text-xs">Rediger</OutlineButton>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {exercise.category} · {exercise.group} · Utstyr: {exercise.equipment} · {exercise.level}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {expandedExerciseId === exercise.id
                        ? exercise.description
                        : `${exercise.description.slice(0, 88)}${exercise.description.length > 88 ? "..." : ""}`}
                    </div>
                    {exercise.description.length > 88 ? (
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium text-slate-600 underline"
                        onClick={() => setExpandedExerciseId((prev) => (prev === exercise.id ? null : exercise.id))}
                      >
                        {expandedExerciseId === exercise.id ? "Vis mindre" : "Vis mer"}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
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
