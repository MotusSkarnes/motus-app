import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  LayoutDashboard,
  MessageSquare,
  TrendingUp,
  UserCircle2,
  Users,
  Dumbbell,
  Target,
} from "lucide-react";

type Role = "trainer" | "member";
type Level = "Nybegynner" | "Litt øvet" | "Øvet";
type MembershipType = "Standard" | "Premium";
type CustomerType = "PT-kunde" | "Oppfølging" | "Egentrening";
type TrainerTab = "dashboard" | "customers" | "programs" | "exerciseBank";
type CustomerSubTab = "overview" | "profile" | "programs" | "messages";
type MemberTab = "overview" | "programs" | "progress" | "messages" | "profile";

type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  memberId?: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  weight: string;
  height: string;
  level: Level;
  membershipType: MembershipType;
  customerType: CustomerType;
  daysSinceActivity: string;
  goal: string;
  focus: string;
  personalGoals: string;
  injuries: string;
  coachNotes: string;
};

type Exercise = {
  id: string;
  name: string;
  group: string;
  equipment: string;
  level: Level;
  favorite?: boolean;
};

type ProgramExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  restSeconds: string;
  notes: string;
};

type TrainingProgram = {
  id: string;
  memberId: string;
  title: string;
  goal: string;
  notes: string;
  createdAt: string;
  exercises: ProgramExercise[];
};

type WorkoutLog = {
  id: string;
  memberId: string;
  programTitle: string;
  date: string;
  status: "Planlagt" | "Fullført";
  note: string;
};

type ChatMessage = {
  id: string;
  memberId: string;
  sender: "trainer" | "member";
  text: string;
  createdAt: string;
};

type AppState = {
  members: Member[];
  exercises: Exercise[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  currentUser: AuthUser | null;
  role: Role;
  selectedMemberId: string;
  memberViewId: string;
};

const MOTUS = {
  turquoise: "#30e3be",
  pink: "#d91278",
  acid: "#daff01",
  paleMint: "#d6fbf1",
  ink: "#0f172a",
};

const STORAGE_KEY = "motus_pt_app_v2";

const demoUsers: Array<AuthUser & { password: string }> = [
  { id: "u1", role: "trainer", name: "Motus PT", email: "trainer@motus.no", password: "123456" },
  { id: "u2", role: "member", name: "Emma Hansen", email: "emma@example.com", password: "123456", memberId: "m1" },
  { id: "u3", role: "member", name: "Martin Johansen", email: "martin@example.com", password: "123456", memberId: "m2" },
];

const initialMembers: Member[] = [
  {
    id: "m1",
    name: "Emma Hansen",
    email: "emma@example.com",
    phone: "900 11 111",
    birthDate: "1991-06-14",
    weight: "72",
    height: "168",
    level: "Litt øvet",
    membershipType: "Premium",
    customerType: "PT-kunde",
    daysSinceActivity: "1",
    goal: "Bli sterkere i hele kroppen",
    focus: "Helkroppsstyrke og trygg progresjon",
    personalGoals: "Bli sterkere, få mer energi og trene jevnt gjennom uka.",
    injuries: "Ingen registrerte skader",
    coachNotes: "Svarte godt på første program.",
  },
  {
    id: "m2",
    name: "Martin Johansen",
    email: "martin@example.com",
    phone: "900 22 222",
    birthDate: "1984-03-05",
    weight: "96",
    height: "182",
    level: "Nybegynner",
    membershipType: "Standard",
    customerType: "Oppfølging",
    daysSinceActivity: "9",
    goal: "Gå ned i fettprosent",
    focus: "Vaner og jevn aktivitet",
    personalGoals: "Få bedre kondisjon og komme inn i faste rutiner.",
    injuries: "Stiv hofte ved mye løping",
    coachNotes: "Trenger enkel og tydelig struktur.",
  },
];

const initialExercises: Exercise[] = [
  { id: "e1", name: "Knebøy", group: "Bein", equipment: "Stang", level: "Litt øvet" },
  { id: "e2", name: "Beinpress", group: "Bein", equipment: "Maskin", level: "Nybegynner" },
  { id: "e3", name: "Nedtrekk", group: "Rygg", equipment: "Kabel", level: "Nybegynner" },
  { id: "e4", name: "Push-up", group: "Bryst", equipment: "Kroppsvekt", level: "Nybegynner" },
  { id: "e5", name: "Planke", group: "Kjerne", equipment: "Kroppsvekt", level: "Nybegynner" },
];

const initialPrograms: TrainingProgram[] = [
  {
    id: "p1",
    memberId: "m1",
    title: "Helkropp 2 dager i uka",
    goal: "Bygge grunnstyrke",
    notes: "Start rolig og fokuser på teknikk.",
    createdAt: new Date().toLocaleDateString("no-NO"),
    exercises: [
      { id: "pe1", exerciseId: "e1", exerciseName: "Knebøy", sets: "3", reps: "8", weight: "40", restSeconds: "120", notes: "Kontrollert tempo" },
      { id: "pe2", exerciseId: "e3", exerciseName: "Nedtrekk", sets: "3", reps: "10", weight: "35", restSeconds: "75", notes: "Trekk til bryst" },
    ],
  },
];

const initialLogs: WorkoutLog[] = [
  {
    id: "l1",
    memberId: "m1",
    programTitle: "Helkropp 2 dager i uka",
    date: new Date().toLocaleDateString("no-NO"),
    status: "Fullført",
    note: "Fin økt.",
  },
];

const initialMessages: ChatMessage[] = [
  { id: "c1", memberId: "m1", sender: "trainer", text: "Husk rolig start denne uka.", createdAt: "I dag 09:10" },
  { id: "c2", memberId: "m1", sender: "member", text: "Supert, jeg logger økten i kveld.", createdAt: "I dag 09:14" },
  { id: "c3", memberId: "m2", sender: "member", text: "Kan du se over ukeplanen min?", createdAt: "I dag 08:21" },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDefaultState(): AppState {
  return {
    members: initialMembers,
    exercises: initialExercises,
    programs: initialPrograms,
    logs: initialLogs,
    messages: initialMessages,
    currentUser: null,
    role: "trainer",
    selectedMemberId: initialMembers[0]?.id ?? "",
    memberViewId: initialMembers[0]?.id ?? "",
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return getDefaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const defaults = getDefaultState();
    return {
      members: Array.isArray(parsed.members) ? parsed.members : defaults.members,
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : defaults.exercises,
      programs: Array.isArray(parsed.programs) ? parsed.programs : defaults.programs,
      logs: Array.isArray(parsed.logs) ? parsed.logs : defaults.logs,
      messages: Array.isArray(parsed.messages) ? parsed.messages : defaults.messages,
      currentUser: parsed.currentUser ?? defaults.currentUser,
      role: parsed.role ?? defaults.role,
      selectedMemberId: parsed.selectedMemberId ?? defaults.selectedMemberId,
      memberViewId: parsed.memberViewId ?? defaults.memberViewId,
    };
  } catch {
    return getDefaultState();
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8 text-slate-900" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f7fffd 35%, #fff3f9 100%)" }}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border bg-white/95 shadow-sm ${className}`} style={{ borderColor: "rgba(15,23,42,0.06)" }}>{children}</div>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={{ backgroundColor: MOTUS.paleMint, color: MOTUS.ink, borderColor: MOTUS.turquoise }}>{children}</span>;
}

function PillButton({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition ${active ? "text-white" : "text-slate-700 bg-slate-50"}`}
      style={active ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : {}}
    >
      {children}
    </button>
  );
}

const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return <input ref={ref} {...props} className={`h-11 w-full rounded-2xl border px-3 text-sm outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.10)" }} />;
});

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-2xl border px-3 py-3 text-sm outline-none ${props.className ?? ""}`} style={{ borderColor: "rgba(15,23,42,0.10)" }} />;
}

function SelectBox({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-2xl border px-3 text-sm outline-none bg-white" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function GradientButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return <button {...props} className={`rounded-2xl px-4 py-2.5 text-sm font-medium text-white ${className}`} style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>{children}</button>;
}

function OutlineButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) {
  return <button {...props} className={`rounded-2xl border px-4 py-2.5 text-sm font-medium text-slate-700 bg-white ${className}`} style={{ borderColor: "rgba(15,23,42,0.10)" }}>{children}</button>;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border p-4 shadow-sm relative overflow-hidden bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 78%, ${MOTUS.acid} 100%)` }} />
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function LoginScreen(props: {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  onLogin: () => void;
  loginError: string | null;
  quickLogin: (email: string) => void;
}) {
  const { email, setEmail, password, setPassword, onLogin, loginError, quickLogin } = props;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden p-6 sm:p-8">
        <div className="h-1.5 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
        <div className="max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl px-4 py-2 shadow-sm text-white font-black tracking-tight" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>MOTUS</div>
            <Badge>PT App</Badge>
            <Badge>Stabil base</Badge>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Logg inn i Motus PT-app</h1>
            <p className="mt-2 text-slate-500">En ny, ren og stabil startfil med trygg lokal lagring.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Brukere" value="3" hint="Demo-kontoer klare" />
            <StatCard label="Lagring" value="Stabil" hint="LocalStorage" />
            <StatCard label="Mål" value="Ren base" hint="Bygg videre herfra" />
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Innlogging</h2>
            <p className="text-sm text-slate-500">Bruk demo-bruker for testing</p>
          </div>
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" />
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passord" />
          {loginError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loginError}</div> : null}
          <GradientButton onClick={onLogin} className="w-full">Logg inn</GradientButton>

          <div className="pt-4 space-y-2">
            <button type="button" onClick={() => quickLogin("trainer@motus.no")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
              <div className="font-medium">Logg inn som trener</div>
              <div className="text-slate-500">trainer@motus.no</div>
            </button>
            <button type="button" onClick={() => quickLogin("emma@example.com")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
              <div className="font-medium">Logg inn som Emma</div>
              <div className="text-slate-500">Medlem</div>
            </button>
            <button type="button" onClick={() => quickLogin("martin@example.com")} className="w-full rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm">
              <div className="font-medium">Logg inn som Martin</div>
              <div className="text-slate-500">Medlem</div>
            </button>
          </div>
          <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">Testpassord på alle brukere: <span className="font-semibold">123456</span></div>
        </div>
      </Card>
    </div>
  );
}

function TrainerPortal(props: {
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
}) {
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
    <div className="space-y-6">
      <Card className="p-3 hidden sm:block">
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
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
                            <div className="mt-1 text-sm text-slate-500">{program.goal || "Uten mål"}</div>
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
                <div key={program.id} className="rounded-3xl border p-4 bg-slate-50">
                  <div className="font-semibold">{program.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{program.goal || "Uten mål"}</div>
                  <div className="mt-1 text-xs text-slate-400">Opprettet {program.createdAt}</div>
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
  );
}

function MemberPortal(props: {
  members: Member[];
  programs: TrainingProgram[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
  memberViewId: string;
  setMemberViewId: (id: string) => void;
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  sendMemberMessage: (memberId: string, text: string) => void;
  addWorkoutLog: (memberId: string, programTitle: string, note: string) => void;
}) {
  const { members, programs, logs, messages, memberViewId, setMemberViewId, memberTab, setMemberTab, sendMemberMessage, addWorkoutLog } = props;
  const [messageText, setMessageText] = useState("");
  const [logProgramTitle, setLogProgramTitle] = useState("");
  const [logNote, setLogNote] = useState("");
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;
  const memberPrograms = programs.filter((program) => program.memberId === memberViewId);
  const memberLogs = logs.filter((log) => log.memberId === memberViewId);
  const memberMessages = messages.filter((message) => message.memberId === memberViewId);

  return (
    <div className="space-y-6">
      <Card className="p-3 hidden sm:block">
        <div className="flex gap-2 overflow-auto pb-1">
          <PillButton active={memberTab === "overview"} onClick={() => setMemberTab("overview")}>Oversikt</PillButton>
          <PillButton active={memberTab === "programs"} onClick={() => setMemberTab("programs")}>Programmer</PillButton>
          <PillButton active={memberTab === "progress"} onClick={() => setMemberTab("progress")}>Fremgang</PillButton>
          <PillButton active={memberTab === "messages"} onClick={() => setMemberTab("messages")}>Meldinger</PillButton>
          <PillButton active={memberTab === "profile"} onClick={() => setMemberTab("profile")}>Profil</PillButton>
        </div>
      </Card>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[300px_1fr]">
        <Card className="hidden p-5 h-fit xl:block">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><UserCircle2 className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Velg medlem</h2>
              <p className="text-sm text-slate-500">Simuler medlemsportal</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <SelectBox value={memberViewId} onChange={setMemberViewId} options={members.map((member) => member.id)} />
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
                  <div key={program.id} className="rounded-3xl border p-4 bg-slate-50">
                    <div className="font-semibold">{program.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{program.goal || "Uten mål"}</div>
                    <div className="mt-2 text-xs text-slate-400">Opprettet {program.createdAt}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {memberTab === "progress" ? (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}><TrendingUp className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Fremgang</h2>
                  <p className="text-sm text-slate-500">Logg økter + historikk</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                <SelectBox value={logProgramTitle} onChange={setLogProgramTitle} options={memberPrograms.map((p) => p.title)} />
                <TextInput value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Kort notat" />
                <GradientButton onClick={() => {
                  if (!memberViewId || !logProgramTitle) return;
                  addWorkoutLog(memberViewId, logProgramTitle, logNote);
                  setLogNote("");
                }}>Logg økt</GradientButton>
              </div>
              {memberLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Ingen logger ennå.</div> : null}
                {memberLogs.map((log) => (
                  <div key={log.id} className="rounded-3xl border p-4 bg-slate-50">
                    <div className="font-semibold">{log.programTitle}</div>
                    <div className="mt-1 text-sm text-slate-500">{log.date} · {log.status}</div>
                    {log.note ? <div className="mt-2 text-sm text-slate-600">{log.note}</div> : null}
                  </div>
                ))}
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
  );
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [trainerTab, setTrainerTab] = useState<TrainerTab>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("overview");

  useEffect(() => {
    saveState(appState);
  }, [appState]);

  useEffect(() => {
    if (!appState.members.length) return;
    const selectedExists = appState.members.some((member) => member.id === appState.selectedMemberId);
    const viewedExists = appState.members.some((member) => member.id === appState.memberViewId);

    if (!selectedExists || !viewedExists) {
      setAppState((prev) => ({
        ...prev,
        selectedMemberId: selectedExists ? prev.selectedMemberId : prev.members[0]?.id ?? "",
        memberViewId: viewedExists ? prev.memberViewId : prev.members[0]?.id ?? "",
      }));
    }
  }, [appState.members, appState.selectedMemberId, appState.memberViewId]);

  function patchState(patch: Partial<AppState>) {
    setAppState((prev) => ({ ...prev, ...patch }));
  }

  function handleLogin() {
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === loginEmail.trim().toLowerCase() && user.password === loginPassword);
    if (!matchedUser) {
      setLoginError("Feil e-post eller passord.");
      return;
    }
    const { password: _password, ...safeUser } = matchedUser;
    setAppState((prev) => ({
      ...prev,
      currentUser: safeUser,
      role: safeUser.role,
      selectedMemberId: safeUser.memberId ?? prev.selectedMemberId,
      memberViewId: safeUser.memberId ?? prev.memberViewId,
    }));
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginError(null);
  }

  function handleQuickLogin(email: string) {
    setLoginEmail(email);
    setLoginPassword("123456");
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!matchedUser) return;
    const { password: _password, ...safeUser } = matchedUser;
    setAppState((prev) => ({
      ...prev,
      currentUser: safeUser,
      role: safeUser.role,
      selectedMemberId: safeUser.memberId ?? prev.selectedMemberId,
      memberViewId: safeUser.memberId ?? prev.memberViewId,
    }));
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginError(null);
  }

  function handleLogout() {
    setAppState((prev) => ({ ...prev, currentUser: null, role: "trainer" }));
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
  }

  function resetAllData() {
    setAppState(getDefaultState());
    setTrainerTab("dashboard");
    setMemberTab("overview");
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  function addMember() {
    const number = appState.members.length + 1;
    const nextMember: Member = {
      id: uid("member"),
      name: `Nytt medlem ${number}`,
      email: `medlem${number}@example.com`,
      phone: "900 00 000",
      birthDate: "",
      level: "Nybegynner",
      membershipType: "Standard",
      customerType: "Oppfølging",
      daysSinceActivity: "0",
      weight: "",
      height: "",
      goal: "Nytt mål settes her",
      focus: "Ikke satt",
      personalGoals: "",
      injuries: "Ingen info ennå",
      coachNotes: "",
    };

    setAppState((prev) => ({
      ...prev,
      members: [...prev.members, nextMember],
      selectedMemberId: nextMember.id,
    }));
  }

  function saveProgramForMember(input: { id?: string; title: string; goal: string; notes: string; memberId: string; exercises: ProgramExercise[] }) {
    if (!input.title.trim() || !input.memberId) return;

    if (input.id) {
      setAppState((prev) => ({
        ...prev,
        programs: prev.programs.map((program) =>
          program.id === input.id
            ? {
                ...program,
                memberId: input.memberId,
                title: input.title.trim(),
                goal: input.goal.trim(),
                notes: input.notes.trim(),
                exercises: input.exercises.map((exercise) => ({ ...exercise, id: exercise.id || uid("prog-ex") })),
              }
            : program
        ),
      }));
      return;
    }

    const newProgram: TrainingProgram = {
      id: uid("program"),
      memberId: input.memberId,
      title: input.title.trim(),
      goal: input.goal.trim(),
      notes: input.notes.trim(),
      createdAt: new Date().toLocaleDateString("no-NO"),
      exercises: input.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
    };
    setAppState((prev) => ({ ...prev, programs: [newProgram, ...prev.programs] }));
  }

  function deleteProgramById(programId: string) {
    const programToDelete = appState.programs.find((program) => program.id === programId);
    setAppState((prev) => ({
      ...prev,
      programs: prev.programs.filter((program) => program.id !== programId),
      logs: programToDelete ? prev.logs.filter((log) => !(log.memberId === programToDelete.memberId && log.programTitle === programToDelete.title)) : prev.logs,
    }));
  }

  function sendTrainerMessage(memberId: string, text: string) {
    if (!text.trim()) return;
    const nextMessage: ChatMessage = {
      id: uid("msg"),
      memberId,
      sender: "trainer",
      text: text.trim(),
      createdAt: "Nå",
    };
    setAppState((prev) => ({ ...prev, messages: [...prev.messages, nextMessage] }));
  }

  function addWorkoutLog(memberId: string, programTitle: string, note: string) {
    const newLog: WorkoutLog = {
      id: uid("log"),
      memberId,
      programTitle,
      date: new Date().toLocaleDateString("no-NO"),
      status: "Fullført",
      note: note.trim(),
    };
    setAppState((prev) => ({ ...prev, logs: [newLog, ...prev.logs] }));
  }

  function sendMemberMessage(memberId: string, text: string) {
    if (!text.trim()) return;
    const nextMessage: ChatMessage = {
      id: uid("msg"),
      memberId,
      sender: "member",
      text: text.trim(),
      createdAt: "Nå",
    };
    setAppState((prev) => ({ ...prev, messages: [...prev.messages, nextMessage] }));
  }

  return (
    <AppShell>
      {!appState.currentUser ? (
        <LoginScreen
          email={loginEmail}
          setEmail={setLoginEmail}
          password={loginPassword}
          setPassword={setLoginPassword}
          onLogin={handleLogin}
          loginError={loginError}
          quickLogin={handleQuickLogin}
        />
      ) : (
        <div className="space-y-6 pb-24 sm:pb-6">
          <Card className="overflow-hidden p-4 sm:p-5 md:p-6">
            <div className="h-1.5 -mx-4 sm:-mx-5 md:-mx-6 -mt-4 sm:-mt-5 md:-mt-6 mb-5" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl px-4 py-2 shadow-sm text-white font-black tracking-tight" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>MOTUS</div>
                  <Badge>{appState.currentUser.role === "trainer" ? "PT" : "Medlem"}</Badge>
                  <Badge>{appState.currentUser.name}</Badge>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus PT-app</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">Ny, ren startfil med trygg lagring og enklere struktur.</p>
                </div>
              </div>
              <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
                <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-2xl bg-slate-50 p-1">
                  <PillButton active={appState.role === "trainer"} onClick={() => patchState({ role: "trainer" })}>PT-side</PillButton>
                  <PillButton active={appState.role === "member"} onClick={() => patchState({ role: "member" })}>Medlemsside</PillButton>
                </div>
              </Card>
              <div className="flex flex-col gap-2 sm:flex-row">
                <OutlineButton onClick={resetAllData}>Nullstill testdata</OutlineButton>
                <OutlineButton onClick={handleLogout}>Logg ut</OutlineButton>
              </div>
            </div>
          </Card>

          {appState.role === "trainer" ? (
            <TrainerPortal
              members={appState.members}
              programs={appState.programs}
              logs={appState.logs}
              messages={appState.messages}
              exercises={appState.exercises}
              selectedMemberId={appState.selectedMemberId}
              setSelectedMemberId={(id) => patchState({ selectedMemberId: id })}
              trainerTab={trainerTab}
              setTrainerTab={setTrainerTab}
              addMember={addMember}
              saveProgramForMember={saveProgramForMember}
              deleteProgramById={deleteProgramById}
              sendTrainerMessage={sendTrainerMessage}
            />
          ) : (
            <MemberPortal
              members={appState.members}
              programs={appState.programs}
              logs={appState.logs}
              messages={appState.messages}
              memberViewId={appState.memberViewId}
              setMemberViewId={(id) => patchState({ memberViewId: id })}
              memberTab={memberTab}
              setMemberTab={setMemberTab}
              sendMemberMessage={sendMemberMessage}
              addWorkoutLog={addWorkoutLog}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
