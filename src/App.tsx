import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Users,
  UserCircle2,
  Dumbbell,
  MessageSquare,
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  Phone,
  Target,
  HeartPulse,
  AlertTriangle,
  Filter,
  Sparkles,
  Search,
} from "lucide-react";

type Role = "trainer" | "member";
type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  memberId?: string;
};
type PersistedAppState = {
  members: Member[];
  exercises: Exercise[];
  programs: TrainingProgram[];
  templates: ProgramTemplate[];
  schedule: ScheduleItem[];
  logs: WorkoutLog[];
  messages: ChatMessage[];
};

type TrainerTab = "dashboard" | "customers" | "templates" | "exerciseBank";
type CustomerTab = "profile" | "programs" | "schedule" | "logs" | "messages";
type MemberTab = "overview" | "programs" | "progress" | "messages" | "profile";
type Level = "Nybegynner" | "Litt øvet" | "Øvet";
type Weekday = "Mandag" | "Tirsdag" | "Onsdag" | "Torsdag" | "Fredag" | "Lørdag" | "Søndag";
type MembershipType = "Standard" | "Premium";
type CustomerType = "PT-kunde" | "Oppfølging" | "Egentrening";
type StatusColor = "green" | "yellow" | "red";

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
  imageUrl?: string;
  technicalNotes?: string;
  primaryMuscles?: string;
  coachingTips?: string;
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

type LoggedExercise = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  volume: number;
  estimated1RM?: number;
  previousBest1RM?: number;
  isPR?: boolean;
  setRows?: WorkoutSetRow[];
};

type WorkoutSetRow = {
  kg: string;
  reps: string;
};

type MemberWorkoutDraftValue = {
  sets: string;
  reps: string;
  weight: string;
  completed: boolean;
  setRows: WorkoutSetRow[];
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

type ProgramTemplate = {
  id: string;
  title: string;
  goal: string;
  notes: string;
  level: Level;
  exercises: ProgramExercise[];
  favorite?: boolean;
};

type ScheduleItem = {
  id: string;
  memberId: string;
  day: Weekday;
  title: string;
  focus: string;
};

type WorkoutLog = {
  id: string;
  memberId: string;
  programTitle: string;
  date: string;
  status: "Planlagt" | "Fullført";
  note: string;
  loggedExercises: LoggedExercise[];
};

type ChatMessage = {
  id: string;
  memberId: string;
  sender: "trainer" | "member";
  text: string;
  createdAt: string;
};

type CustomerInsight = {
  member: Member;
  programsCount: number;
  logsCount: number;
  messagesCount: number;
  hasUnreadMemberMessage: boolean;
  daysInactive: number;
  statusColor: StatusColor;
  statusLabel: string;
  recommendedAction: string;
  followUpReason: string;
  priorityScore: number;
};

const MOTUS = {
  turquoise: "#30e3be",
  pink: "#d91278",
  acid: "#daff01",
  paleMint: "#d6fbf1",
  softTurquoise: "#8ff1db",
  ink: "#0f172a",
};

const weekdays: Weekday[] = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

const runtimeEnv = typeof import.meta !== "undefined" ? ((import.meta as any)?.env ?? {}) : {};
const SUPABASE_URL = runtimeEnv.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = runtimeEnv.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const APP_STATE_ROW_ID = "motus-pt-demo";

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
  {
    id: "m3",
    name: "Sara Nilsen",
    email: "sara@example.com",
    phone: "900 33 333",
    birthDate: "1996-11-22",
    weight: "64",
    height: "170",
    level: "Nybegynner",
    membershipType: "Premium",
    customerType: "Egentrening",
    daysSinceActivity: "4",
    goal: "Bygge styrke etter pause",
    focus: "Baseløft og stabilitet",
    personalGoals: "Bygge opp styrke igjen og føle meg trygg i øvelsene.",
    injuries: "Tidligere vond korsrygg",
    coachNotes: "Rolig oppstart og fokus på mestring.",
  },
];

const initialExercises: Exercise[] = [
  {
    id: "e1",
    name: "Knebøy",
    group: "Bein",
    equipment: "Stang",
    level: "Litt øvet",
    primaryMuscles: "Forside lår, sete, kjerne",
    coachingTips: "Brystet opp, trykk knær lett ut, hold trykket i foten.",
    technicalNotes: "Start med hoftebredde, stabil rygg og kontrollert dybde.",
  },
  {
    id: "e2",
    name: "Beinpress",
    group: "Bein",
    equipment: "Maskin",
    level: "Nybegynner",
    primaryMuscles: "Forside lår og sete",
    coachingTips: "Press jevnt gjennom hele foten.",
    technicalNotes: "Unngå å låse knærne helt ut.",
  },
  {
    id: "e3",
    name: "Nedtrekk",
    group: "Rygg",
    equipment: "Kabel",
    level: "Nybegynner",
    primaryMuscles: "Rygg",
    coachingTips: "Trekk albuene ned.",
    technicalNotes: "Hold brystet opp.",
  },
  {
    id: "e4",
    name: "Push-up",
    group: "Bryst",
    equipment: "Kroppsvekt",
    level: "Nybegynner",
  },
  {
    id: "e5",
    name: "Planke",
    group: "Kjerne",
    equipment: "Kroppsvekt",
    level: "Nybegynner",
  },

  // NYE ØVELSER
  { id: "e6", name: "Markløft", group: "Bein", equipment: "Stang", level: "Øvet" },
  { id: "e7", name: "Hip thrust", group: "Bein", equipment: "Stang", level: "Litt øvet" },
  { id: "e8", name: "Utfall", group: "Bein", equipment: "Manualer", level: "Nybegynner" },
  { id: "e9", name: "Leg curl", group: "Bein", equipment: "Maskin", level: "Nybegynner" },
  { id: "e10", name: "Leg extension", group: "Bein", equipment: "Maskin", level: "Nybegynner" },

  { id: "e11", name: "Benkpress", group: "Bryst", equipment: "Stang", level: "Litt øvet" },
  { id: "e12", name: "Skrå manualpress", group: "Bryst", equipment: "Manualer", level: "Nybegynner" },
  { id: "e13", name: "Chest flyes", group: "Bryst", equipment: "Manualer", level: "Nybegynner" },

  { id: "e14", name: "Roing med stang", group: "Rygg", equipment: "Stang", level: "Litt øvet" },
  { id: "e15", name: "Sittende roing", group: "Rygg", equipment: "Kabel", level: "Nybegynner" },
  { id: "e16", name: "Face pull", group: "Rygg", equipment: "Kabel", level: "Nybegynner" },

  { id: "e17", name: "Skulderpress", group: "Skuldre", equipment: "Manualer", level: "Nybegynner" },
  { id: "e18", name: "Sidehev", group: "Skuldre", equipment: "Manualer", level: "Nybegynner" },

  { id: "e19", name: "Biceps curl", group: "Armer", equipment: "Manualer", level: "Nybegynner" },
  { id: "e20", name: "Triceps pushdown", group: "Armer", equipment: "Kabel", level: "Nybegynner" },

  { id: "e21", name: "Russian twist", group: "Kjerne", equipment: "Kroppsvekt", level: "Nybegynner" },
  { id: "e22", name: "Hanging leg raise", group: "Kjerne", equipment: "Kroppsvekt", level: "Litt øvet" },

  { id: "e23", name: "SkiErg", group: "Kondisjon", equipment: "Maskin", level: "Nybegynner" },
  { id: "e24", name: "Romaskin", group: "Kondisjon", equipment: "Maskin", level: "Nybegynner" },
  { id: "e25", name: "Airbike", group: "Kondisjon", equipment: "Maskin", level: "Nybegynner" },
];

const initialTemplates: ProgramTemplate[] = [
  {
    id: "tpl1",
    title: "Helkropp nybegynner",
    goal: "Trygg oppstart og gode vaner",
    notes: "Passer fint for nye medlemmer som trenger enkel struktur.",
    level: "Nybegynner",
    exercises: [
      { id: "tp1", exerciseId: "e2", exerciseName: "Beinpress", sets: "3", reps: "10", weight: "60", restSeconds: "90", notes: "Rolig kontroll" },
      { id: "tp2", exerciseId: "e3", exerciseName: "Nedtrekk", sets: "3", reps: "10", weight: "30", restSeconds: "75", notes: "Trekk til bryst" },
      { id: "tp3", exerciseId: "e5", exerciseName: "Planke", sets: "3", reps: "30", weight: "0", restSeconds: "45", notes: "Sekunder" },
    ],
  },
  {
    id: "tpl2",
    title: "Styrke overkropp",
    goal: "Bygge styrke i rygg, bryst og skuldre",
    notes: "Fin mal for medlemmer som vil ha fokus på overkropp.",
    level: "Litt øvet",
    exercises: [
      { id: "tp4", exerciseId: "e3", exerciseName: "Nedtrekk", sets: "4", reps: "8", weight: "35", restSeconds: "90", notes: "Hold brystet opp" },
      { id: "tp5", exerciseId: "e4", exerciseName: "Push-up", sets: "3", reps: "12", weight: "20", restSeconds: "60", notes: "Kontrollert tempo" },
    ],
  },
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
      { id: "pe3", exerciseId: "e4", exerciseName: "Push-up", sets: "3", reps: "8-12", weight: "20", restSeconds: "60", notes: "På knær ved behov" },
    ],
  },
];

const initialSchedule: ScheduleItem[] = [
  { id: "s1", memberId: "m1", day: "Mandag", title: "Helkropp A", focus: "Bein og rygg" },
  { id: "s2", memberId: "m1", day: "Torsdag", title: "Helkropp B", focus: "Bryst og kjerne" },
  { id: "s3", memberId: "m2", day: "Tirsdag", title: "Intervalløkt", focus: "Kondisjon" },
];

const initialLogs: WorkoutLog[] = [
  {
    id: "l1",
    memberId: "m1",
    programTitle: "Helkropp 2 dager i uka",
    date: new Date().toLocaleDateString("no-NO"),
    status: "Fullført",
    note: "Fin økt. Litt tungt på siste sett.",
    loggedExercises: [
      { id: "le1", exerciseName: "Knebøy", sets: 3, reps: 8, weight: 40, volume: 960, estimated1RM: estimate1RM(40, 8), previousBest1RM: 0, isPR: true },
      { id: "le2", exerciseName: "Nedtrekk", sets: 3, reps: 10, weight: 35, volume: 1050, estimated1RM: estimate1RM(35, 10), previousBest1RM: 0, isPR: true },
      { id: "le3", exerciseName: "Push-up", sets: 3, reps: 10, weight: 20, volume: 600, estimated1RM: estimate1RM(20, 10), previousBest1RM: 0, isPR: true },
    ],
  },
];

const demoUsers: Array<AuthUser & { password: string }> = [
  { id: "u1", role: "trainer", name: "Motus PT", email: "trainer@motus.no", password: "123456" },
  { id: "u2", role: "member", name: "Emma Hansen", email: "emma@example.com", password: "123456", memberId: "m1" },
  { id: "u3", role: "member", name: "Martin Johansen", email: "martin@example.com", password: "123456", memberId: "m2" },
  { id: "u4", role: "member", name: "Sara Nilsen", email: "sara@example.com", password: "123456", memberId: "m3" },
];

const initialMessages: ChatMessage[] = [
  { id: "c1", memberId: "m1", sender: "trainer", text: "Husk rolig start denne uka.", createdAt: "I dag 09:10" },
  { id: "c2", memberId: "m1", sender: "member", text: "Supert, jeg logger økten i kveld.", createdAt: "I dag 09:14" },
  { id: "c3", memberId: "m2", sender: "member", text: "Kan du se over ukeplanen min?", createdAt: "I dag 08:21" },
];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function estimate1RM(weight: number, reps: number) {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

function calculateAge(birthDate: string) {
  if (!birthDate) return "";
  const today = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "";
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return String(age);
}

function createDefaultSetRows(sets: string, reps: string, weight: string) {
  const setCount = Math.max(1, Number(sets) || 1);
  const safeReps = (reps.split("-")[0] || reps).trim();
  return Array.from({ length: setCount }, () => ({ kg: weight || "", reps: safeReps || "" }));
}

function normalizeSetRowsLength(setRows: WorkoutSetRow[], sets: string, fallbackReps: string, fallbackWeight: string) {
  const setCount = Math.max(1, Number(sets) || 1);
  const safeRows = Array.isArray(setRows) ? [...setRows] : [];
  const safeReps = (fallbackReps.split("-")[0] || fallbackReps).trim();
  while (safeRows.length < setCount) {
    safeRows.push({ kg: fallbackWeight || "", reps: safeReps || "" });
  }
  return safeRows.slice(0, setCount);
}

function addSetRow(setRows: WorkoutSetRow[], fallbackReps: string, fallbackWeight: string) {
  const safeReps = (fallbackReps.split("-")[0] || fallbackReps).trim();
  return [...(setRows || []), { kg: fallbackWeight || "", reps: safeReps || "" }];
}

function removeSetRow(setRows: WorkoutSetRow[], index: number) {
  if (!Array.isArray(setRows)) return [];
  if (setRows.length <= 1) return setRows;
  return setRows.filter((_, i) => i !== index);
}

function getStatusStyles(color: StatusColor) {
  if (color === "red") {
    return { backgroundColor: "#fff1f2", borderColor: "#fecdd3", textColor: "#be123c" };
  }
  if (color === "yellow") {
    return { backgroundColor: "#fffbeb", borderColor: "#fde68a", textColor: "#a16207" };
  }
  return { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", textColor: "#047857" };
}

function loadStoredState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStoredState<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function getInitialPersistedState(): PersistedAppState {
  return {
    members: loadStoredState("motus_members", initialMembers),
    exercises: loadStoredState("motus_exercises", initialExercises),
    programs: loadStoredState("motus_programs", initialPrograms),
    templates: loadStoredState("motus_templates", initialTemplates),
    schedule: loadStoredState("motus_schedule", initialSchedule),
    logs: loadStoredState("motus_logs", initialLogs),
    messages: loadStoredState("motus_messages", initialMessages),
  };
}

function buildCustomerInsights(members: Member[], programs: TrainingProgram[], logs: WorkoutLog[], messages: ChatMessage[]): CustomerInsight[] {
  return members.map((member) => {
    const programsForMember = programs.filter((program) => program.memberId === member.id);
    const logsForMember = logs.filter((log) => log.memberId === member.id);
    const messagesForMember = messages.filter((message) => message.memberId === member.id);
    const lastMessage = messagesForMember[messagesForMember.length - 1];
    const hasUnreadMemberMessage = lastMessage?.sender === "member";
    const daysInactive = Number(member.daysSinceActivity || "0");

    let statusColor: StatusColor = "green";
    let statusLabel = "På sporet";
    let recommendedAction = "Ingen hast";
    let followUpReason = "Alt ser greit ut akkurat nå.";
    let priorityScore = 0;

    if (programsForMember.length === 0) {
      statusColor = "red";
      statusLabel = "Mangler program";
      recommendedAction = "Lag første program";
      followUpReason = "Kunden mangler aktivt program.";
      priorityScore += 4;
    }

    if (daysInactive >= 7) {
      statusColor = "red";
      statusLabel = "Inaktiv";
      recommendedAction = "Følg opp inaktiv kunde";
      followUpReason = `${daysInactive} dager siden aktivitet.`;
      priorityScore += 5;
    } else if (daysInactive >= 4 && statusColor !== "red") {
      statusColor = "yellow";
      statusLabel = "Bør følges opp";
      recommendedAction = "Send en oppfølging";
      followUpReason = `${daysInactive} dager siden aktivitet.`;
      priorityScore += 3;
    }

    if (hasUnreadMemberMessage) {
      if (statusColor === "green") {
        statusColor = "yellow";
        statusLabel = "Ny melding";
      }
      recommendedAction = "Svar på melding";
      followUpReason = "Det ligger en ny melding fra kunden.";
      priorityScore += 4;
    }

    if (logsForMember.length === 0 && programsForMember.length > 0 && statusColor !== "red") {
      statusColor = "yellow";
      statusLabel = "Ingen logger";
      recommendedAction = "Be kunden logge første økt";
      followUpReason = "Program finnes, men ingen økter er logget ennå.";
      priorityScore += 2;
    }

    if (statusColor === "green") {
      recommendedAction = "Fortsett som nå";
      followUpReason = "Kunden er aktiv og oppdatert.";
    }

    return {
      member,
      programsCount: programsForMember.length,
      logsCount: logsForMember.length,
      messagesCount: messagesForMember.length,
      hasUnreadMemberMessage,
      daysInactive,
      statusColor,
      statusLabel,
      recommendedAction,
      followUpReason,
      priorityScore,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore || a.member.name.localeCompare(b.member.name));
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

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl p-2.5 text-white" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>{icon}</div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
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

function Badge({ children, tone = "mint" }: { children: React.ReactNode; tone?: "mint" | "red" | "yellow" | "green" }) {
  const styles = tone === "red"
    ? { backgroundColor: "#fff1f2", color: "#be123c", borderColor: "#fecdd3" }
    : tone === "yellow"
      ? { backgroundColor: "#fffbeb", color: "#a16207", borderColor: "#fde68a" }
      : tone === "green"
        ? { backgroundColor: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }
        : { backgroundColor: MOTUS.paleMint, color: MOTUS.ink, borderColor: MOTUS.softTurquoise };

  return <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={styles}>{children}</span>;
}

function SearchableMemberSelect({ members, selectedMemberId, onSelect }: { members: Member[]; selectedMemberId: string; onSelect: (id: string) => void }) {
  return (
    <select value={selectedMemberId} onChange={(e) => onSelect(e.target.value)} className="h-11 w-full rounded-2xl border px-3 text-sm outline-none bg-white" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
    </select>
  );
}

function SearchableExerciseSelect({ exercises, onAdd }: { exercises: Exercise[]; onAdd: (exercise: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((exercise) => `${exercise.name} ${exercise.group} ${exercise.equipment}`.toLowerCase().includes(q));
  }, [exercises, query]);

  return (
    <div className="relative">
      <OutlineButton onClick={() => setOpen((v) => !v)}>Legg til øvelse</OutlineButton>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[320px] max-w-[90vw] rounded-3xl border bg-white p-3 shadow-lg" style={{ borderColor: "rgba(15,23,42,0.10)" }}>
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk øvelse" />
          <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
            {filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => {
                  onAdd(exercise);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full rounded-2xl border bg-slate-50 p-3 text-left"
                style={{ borderColor: "rgba(15,23,42,0.08)" }}
              >
                <div className="font-medium">{exercise.name}</div>
                <div className="text-xs text-slate-500">{exercise.group} · {exercise.equipment} · {exercise.level}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
            <Badge>Login</Badge>
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Logg inn i Motus PT-app</h1>
            <p className="mt-2 text-slate-500">Egen flyt for trener og medlem, med riktig dashboard etter innlogging.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Trenerrolle" value="1" hint="Full tilgang" />
            <StatCard label="Medlemsroller" value="3" hint="Egen side per medlem" />
            <StatCard label="Testlogin" value="Klar" hint="Bruk demo-knappene" />
          </div>
        </div>
      </Card>

      <Card className="p-6 sm:p-8">
        <SectionTitle icon={<UserCircle2 className="h-5 w-5" />} title="Innlogging" subtitle="Bruk demo-bruker for testing" />
        <div className="mt-6 space-y-4">
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post" />
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passord" />
          {loginError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loginError}</div> : null}
          <GradientButton onClick={onLogin} className="w-full">Logg inn</GradientButton>
        </div>

        <div className="mt-6 space-y-3">
          <div className="text-sm font-medium text-slate-700">Hurtigvalg for test</div>
          <div className="grid gap-2">
            <button type="button" onClick={() => quickLogin("trainer@motus.no")} className="rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm"><div className="font-medium">Logg inn som trener</div><div className="text-slate-500">trainer@motus.no</div></button>
            <button type="button" onClick={() => quickLogin("emma@example.com")} className="rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm"><div className="font-medium">Logg inn som Emma</div><div className="text-slate-500">Medlem</div></button>
            <button type="button" onClick={() => quickLogin("martin@example.com")} className="rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm"><div className="font-medium">Logg inn som Martin</div><div className="text-slate-500">Medlem</div></button>
            <button type="button" onClick={() => quickLogin("sara@example.com")} className="rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm"><div className="font-medium">Logg inn som Sara</div><div className="text-slate-500">Medlem</div></button>
          </div>
          <div className="rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">Testpassord på alle brukere: <span className="font-semibold">123456</span></div>
        </div>
      </Card>
    </div>
  );
}

function DashboardCustomerCard({ insight, onOpenCustomer }: { insight: CustomerInsight; onOpenCustomer: (memberId: string) => void }) {
  const tone = insight.statusColor;
  const toneStyles = getStatusStyles(tone);

  return (
    <button
      type="button"
      onClick={() => onOpenCustomer(insight.member.id)}
      className="w-full rounded-3xl border p-4 text-left transition hover:shadow-md bg-white"
      style={{ borderColor: toneStyles.borderColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold">{insight.member.name}</div>
            <Badge tone={tone}>{insight.statusLabel}</Badge>
            <Badge>{insight.member.membershipType}</Badge>
            <Badge>{insight.member.customerType}</Badge>
          </div>
          <div className="mt-1 text-sm text-slate-500">{insight.member.goal}</div>
        </div>
        {insight.hasUnreadMemberMessage ? <Badge tone="yellow">Ny melding</Badge> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl p-3" style={{ backgroundColor: toneStyles.backgroundColor }}>
          <div className="text-[11px] uppercase tracking-wide" style={{ color: toneStyles.textColor }}>Anbefalt handling</div>
          <div className="mt-1 text-sm font-medium text-slate-800">{insight.recommendedAction}</div>
        </div>
        <div className="rounded-2xl border p-3 bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Inaktivitet</div>
          <div className="mt-1 text-sm font-medium">{insight.daysInactive} dager</div>
        </div>
        <div className="rounded-2xl border p-3 bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Notifikasjoner</div>
          <div className="mt-1 text-sm font-medium">{insight.messagesCount} meldinger</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-600">{insight.followUpReason}</div>
    </button>
  );
}

function TrainerPortal(props: {
  celebrationMessage: string | null;
  dismissCelebration: () => void;
  saveAsTemplate: () => void;
  toggleTemplateFavorite: (id: string) => void;
  moveExercise: (id: string, direction: "up" | "down") => void;
  toggleFavorite: (id: string) => void;
  setProgramExercises: React.Dispatch<React.SetStateAction<ProgramExercise[]>>;
  members: Member[];
  selectedMember: Member | null;
  selectedMemberId: string;
  setSelectedMemberId: (id: string) => void;
  trainerTab: TrainerTab;
  setTrainerTab: (tab: TrainerTab) => void;
  trainerProgramsForSelected: TrainingProgram[];
  trainerLogsForSelected: WorkoutLog[];
  trainerMessagesForSelected: ChatMessage[];
  trainerScheduleForSelected: ScheduleItem[];
  allPrograms: TrainingProgram[];
  allLogs: WorkoutLog[];
  allMessages: ChatMessage[];
  templates: ProgramTemplate[];
  useTemplate: (templateId: string) => void;
  assignTemplateToMember: (templateId: string, memberId: string) => void;
  exercises: Exercise[];
  exerciseName: string;
  setExerciseName: (value: string) => void;
  exerciseGroup: string;
  setExerciseGroup: (value: string) => void;
  exerciseEquipment: string;
  setExerciseEquipment: (value: string) => void;
  exerciseLevel: Level;
  setExerciseLevel: (value: Level) => void;
  exerciseImageUrl: string;
  setExerciseImageUrl: (value: string) => void;
  exercisePrimaryMuscles: string;
  setExercisePrimaryMuscles: (value: string) => void;
  exerciseCoachingTips: string;
  setExerciseCoachingTips: (value: string) => void;
  exerciseTechnicalNotes: string;
  setExerciseTechnicalNotes: (value: string) => void;
  editingExerciseId: string | null;
  startEditExercise: (exerciseId: string) => void;
  cancelEditExercise: () => void;
  saveExerciseBankEntry: () => void;
  exerciseSearch: string;
  setExerciseSearch: (value: string) => void;
  programTitle: string;
  setProgramTitle: (value: string) => void;
  programGoal: string;
  setProgramGoal: (value: string) => void;
  programNotes: string;
  setProgramNotes: (value: string) => void;
  programExercises: ProgramExercise[];
  addExerciseToProgram: (exercise: Exercise) => void;
  updateProgramExercise: (id: string, field: keyof ProgramExercise, value: string) => void;
  removeProgramExercise: (id: string) => void;
  saveProgram: () => void;
  scheduleDay: Weekday;
  setScheduleDay: (value: Weekday) => void;
  scheduleTitle: string;
  setScheduleTitle: (value: string) => void;
  scheduleFocus: string;
  setScheduleFocus: (value: string) => void;
  addScheduleItem: () => void;
  removeScheduleItem: (id: string) => void;
  selectedProgramIdForLog: string;
  setSelectedProgramIdForLog: (value: string) => void;
  logDate: string;
  setLogDate: (value: string) => void;
  createDraftWorkoutLog: () => void;
  draftLogStatusText: string;
  saveDraftAsPlanned: () => void;
  saveDraftAsCompleted: () => void;
  trainerMessage: string;
  setTrainerMessage: (value: string) => void;
  sendTrainerMessage: () => void;
  addMember: () => void;
  updateSelectedMemberField: (field: keyof Member, value: string) => void;
}) {
  const {
    celebrationMessage,
    dismissCelebration,
    members,
    selectedMember,
    selectedMemberId,
    setSelectedMemberId,
    trainerTab,
    setTrainerTab,
    trainerProgramsForSelected,
    trainerLogsForSelected,
    trainerMessagesForSelected,
    trainerScheduleForSelected,
    allPrograms,
    allLogs,
    allMessages,
    templates,
    useTemplate,
    assignTemplateToMember,
    saveAsTemplate,
    toggleTemplateFavorite,
    moveExercise,
    toggleFavorite,
    setProgramExercises,
    exercises,
    exerciseName,
    setExerciseName,
    exerciseGroup,
    setExerciseGroup,
    exerciseEquipment,
    setExerciseEquipment,
    exerciseLevel,
    setExerciseLevel,
    exerciseImageUrl,
    setExerciseImageUrl,
    exercisePrimaryMuscles,
    setExercisePrimaryMuscles,
    exerciseCoachingTips,
    setExerciseCoachingTips,
    exerciseTechnicalNotes,
    setExerciseTechnicalNotes,
    editingExerciseId,
    startEditExercise,
    cancelEditExercise,
    saveExerciseBankEntry,
    exerciseSearch,
    setExerciseSearch,
    programTitle,
    setProgramTitle,
    programGoal,
    setProgramGoal,
    programNotes,
    setProgramNotes,
    programExercises,
    addExerciseToProgram,
    updateProgramExercise,
    removeProgramExercise,
    saveProgram,
    scheduleDay,
    setScheduleDay,
    scheduleTitle,
    setScheduleTitle,
    scheduleFocus,
    setScheduleFocus,
    addScheduleItem,
    removeScheduleItem,
    selectedProgramIdForLog,
    setSelectedProgramIdForLog,
    logDate,
    setLogDate,
    createDraftWorkoutLog,
    draftLogStatusText,
    saveDraftAsPlanned,
    saveDraftAsCompleted,
    trainerMessage,
    setTrainerMessage,
    sendTrainerMessage,
    addMember,
    updateSelectedMemberField,
  } = props;

  const [customerTab, setCustomerTab] = useState<CustomerTab>("profile");
  const [overviewMembershipFilter, setOverviewMembershipFilter] = useState<"all" | MembershipType>("all");
  const [overviewTypeFilter, setOverviewTypeFilter] = useState<"all" | CustomerType>("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [pendingQuickAction, setPendingQuickAction] = useState<"program" | "log" | "message" | null>(null);
  const [draggedProgramExerciseId, setDraggedProgramExerciseId] = useState<string | null>(null);
  const [templateAssignTargets, setTemplateAssignTargets] = useState<Record<string, string>>({});
  const programTitleRef = useRef<HTMLInputElement | null>(null);
  const logDateRef = useRef<HTMLInputElement | null>(null);
  const trainerMessageRef = useRef<HTMLInputElement | null>(null);

  const hasPrograms = trainerProgramsForSelected.length > 0;
  const hasLogs = trainerLogsForSelected.length > 0;
  const hasMessages = trainerMessagesForSelected.length > 0;
  const programButtonLabel = hasPrograms ? "+ Nytt program" : "Opprett første program";
  const logButtonLabel = hasPrograms ? (hasLogs ? "Logg ny økt" : "Logg første økt") : "Lag program først";
  const messageButtonLabel = hasMessages ? "Svar på siste melding" : "Send første melding";

  const lastLog = trainerLogsForSelected[0];
  const lastMessage = trainerMessagesForSelected[trainerMessagesForSelected.length - 1];
  const lastMessageFromMember = lastMessage?.sender === "member";
  const todayNo = new Date().toLocaleDateString("no-NO");
  const needsLog = hasPrograms && (!lastLog || lastLog.date !== todayNo);
  const needsReply = Boolean(lastMessageFromMember);
  const smartHint = !hasPrograms ? "Start med å lage et program" : needsLog ? "Kunden bør logge en økt" : needsReply ? "Kunden venter på svar" : "Alt ser bra ut";

  const dashboardCustomers = useMemo(() => {
    return buildCustomerInsights(members, allPrograms, allLogs, allMessages);
  }, [members, allPrograms, allLogs, allMessages]);

  const filteredDashboardCustomers = useMemo(() => {
    return dashboardCustomers.filter((insight) => {
      const membershipOk = overviewMembershipFilter === "all" || insight.member.membershipType === overviewMembershipFilter;
      const typeOk = overviewTypeFilter === "all" || insight.member.customerType === overviewTypeFilter;
      return membershipOk && typeOk;
    });
  }, [dashboardCustomers, overviewMembershipFilter, overviewTypeFilter]);

  const filteredMembers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) => `${member.name} ${member.email} ${member.goal}`.toLowerCase().includes(q));
  }, [members, customerSearch]);

  const unreadNotificationsCount = useMemo(() => dashboardCustomers.filter((insight) => insight.hasUnreadMemberMessage).length, [dashboardCustomers]);
  const inactiveCustomersCount = useMemo(() => dashboardCustomers.filter((insight) => insight.daysInactive >= 7).length, [dashboardCustomers]);
  const needsFollowUpCount = useMemo(() => dashboardCustomers.filter((insight) => insight.statusColor !== "green").length, [dashboardCustomers]);

  useEffect(() => {
    if (!pendingQuickAction) return;
    const timer = window.setTimeout(() => {
      if (pendingQuickAction === "program" && customerTab === "programs") {
        programTitleRef.current?.focus();
        programTitleRef.current?.select();
      }
      if (pendingQuickAction === "log" && customerTab === "logs") {
        logDateRef.current?.focus();
      }
      if (pendingQuickAction === "message" && customerTab === "messages") {
        trainerMessageRef.current?.focus();
      }
      setPendingQuickAction(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [customerTab, pendingQuickAction]);

  function openQuickProgram() {
    setCustomerTab("programs");
    setPendingQuickAction("program");
  }

  function openQuickLog() {
    if (!hasPrograms) {
      setCustomerTab("programs");
      setPendingQuickAction("program");
      return;
    }
    setCustomerTab("logs");
    setPendingQuickAction("log");
  }

  function openQuickMessage() {
    setCustomerTab("messages");
    setPendingQuickAction("message");
  }

  function handleExerciseDrop(targetId: string) {
    if (!draggedProgramExerciseId || draggedProgramExerciseId === targetId) return;
    setProgramExercises((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === draggedProgramExerciseId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedProgramExerciseId(null);
  }

  const filteredExerciseBank = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    const sorted = [...exercises].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((exercise) => `${exercise.name} ${exercise.group} ${exercise.equipment} ${exercise.level} ${exercise.primaryMuscles ?? ""} ${exercise.coachingTips ?? ""} ${exercise.technicalNotes ?? ""}`.toLowerCase().includes(q));
  }, [exerciseSearch, exercises]);

  return (
    <div className="space-y-6">
      {celebrationMessage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 text-center shadow-2xl">
            <div className="text-4xl">🎉</div>
            <div className="mt-3 text-2xl font-bold tracking-tight">Ny rekord!</div>
            <div className="mt-2 text-sm text-slate-600">{celebrationMessage}</div>
            <GradientButton onClick={dismissCelebration} className="mt-5 w-full">Rått! Fortsett sånn</GradientButton>
          </div>
        </div>
      ) : null}
      <Card className="p-3 hidden sm:block">
        <div className="flex gap-2 overflow-auto pb-1">
          <PillButton active={trainerTab === "dashboard"} onClick={() => setTrainerTab("dashboard")}>Oversikt</PillButton>
          <PillButton active={trainerTab === "customers"} onClick={() => setTrainerTab("customers")}>Kunder</PillButton>
          <PillButton active={trainerTab === "templates"} onClick={() => setTrainerTab("templates")}>Programmaler</PillButton>
          <PillButton active={trainerTab === "exerciseBank"} onClick={() => setTrainerTab("exerciseBank")}>Øvelsesbank</PillButton>
        </div>
      </Card>

      {(trainerTab === "dashboard" || trainerTab === "customers") ? (
      <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Aktiv kunde" value={selectedMember?.name ?? "Ingen valgt"} hint={selectedMember?.goal ?? "Velg kunde i kundefanen"} />
        <StatCard label="Kunder" value={String(members.length)} hint="Totalt i appen" />
        <StatCard label="Må følges opp" value={String(needsFollowUpCount)} hint="Basert på status, aktivitet og meldinger" />
      </div>
      ) : null}

      {trainerTab === "dashboard" ? (
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle icon={<LayoutDashboard className="h-5 w-5" />} title="Oversikt" subtitle="Hvem bør du følge opp nå?" />
            <div className="mt-5 grid gap-3 sm:gap-4 lg:grid-cols-4">
              <StatCard label="Nye meldinger" value={String(unreadNotificationsCount)} hint="Kunder som venter på svar" />
              <StatCard label="Inaktive kunder" value={String(inactiveCustomersCount)} hint="7 dager eller mer uten aktivitet" />
              <StatCard label="Røde kunder" value={String(dashboardCustomers.filter((item) => item.statusColor === "red").length)} hint="Bør prioriteres først" />
              <StatCard label="Gule kunder" value={String(dashboardCustomers.filter((item) => item.statusColor === "yellow").length)} hint="Bør sjekkes snart" />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
              <div className="rounded-3xl border bg-slate-50 p-4" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Sparkles className="h-4 w-4" /> Anbefalt neste steg</div>
                <div className="mt-2 text-lg font-semibold">
                  {filteredDashboardCustomers[0] ? `${filteredDashboardCustomers[0].recommendedAction} – ${filteredDashboardCustomers[0].member.name}` : "Ingen kunder matcher filtrene akkurat nå."}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {filteredDashboardCustomers[0]?.followUpReason ?? "Juster filtrene eller åpne Kunder for detaljvisning."}
                </div>
              </div>

              <div className="rounded-3xl border p-4 bg-white" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Filter className="h-4 w-4" /> Medlemskap</div>
                <div className="mt-3">
                  <SelectBox
                    value={overviewMembershipFilter}
                    onChange={(value) => setOverviewMembershipFilter(value as "all" | MembershipType)}
                    options={["all", "Premium", "Standard"]}
                  />
                </div>
              </div>

              <div className="rounded-3xl border p-4 bg-white" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Filter className="h-4 w-4" /> Kundetype</div>
                <div className="mt-3">
                  <SelectBox
                    value={overviewTypeFilter}
                    onChange={(value) => setOverviewTypeFilter(value as "all" | CustomerType)}
                    options={["all", "PT-kunde", "Oppfølging", "Egentrening"]}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={<AlertTriangle className="h-5 w-5" />} title="Kunder som bør følges opp" subtitle="Sortert etter prioritet" />
            <div className="mt-4 space-y-3">
              {filteredDashboardCustomers.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Ingen kunder matcher filtrene.</div> : null}
              {filteredDashboardCustomers.map((insight) => (
                <DashboardCustomerCard
                  key={insight.member.id}
                  insight={insight}
                  onOpenCustomer={(memberId) => {
                    setSelectedMemberId(memberId);
                    setTrainerTab("customers");
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {trainerTab === "customers" ? (
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="p-4 lg:sticky lg:top-4 h-fit">
            <SectionTitle icon={<Users className="h-5 w-5" />} title="Kunder" subtitle="Velg kunde og jobb videre inne på kundekortet" />
            <div className="mt-5 space-y-4">
              <SearchableMemberSelect members={members} selectedMemberId={selectedMemberId} onSelect={setSelectedMemberId} />
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Søk kunde" className="pl-9" />
              </div>
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  className="w-full rounded-2xl border p-3 text-left transition hover:shadow-sm"
                  style={selectedMemberId === member.id ? { backgroundColor: "#f8fffd", borderColor: MOTUS.turquoise, boxShadow: "0 0 0 3px rgba(48,227,190,0.08)" } : { borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{member.name}</div>
                      <div className="text-sm text-slate-500">{member.email}</div>
                      <div className="mt-1 text-sm">Mål: {member.goal}</div>
                    </div>
                    {selectedMemberId === member.id ? <Badge>Aktiv</Badge> : null}
                  </div>
                </button>
              ))}
              <OutlineButton onClick={addMember} className="w-full">Legg til testkunde</OutlineButton>
            </div>
          </Card>

          <Card className="overflow-hidden relative">
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 70%, ${MOTUS.acid} 100%)` }} />
            <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full blur-3xl opacity-30" style={{ background: MOTUS.softTurquoise }} />
            <div className="pointer-events-none absolute right-20 top-24 h-32 w-32 rounded-full blur-3xl opacity-20" style={{ background: "#f7b3d2" }} />
            <div className="p-4 space-y-4">
              {selectedMember ? (
                <div className="rounded-[24px] p-4 sm:p-5 text-white relative overflow-hidden shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.ink} 100%)` }}>
                  <div className="pointer-events-none absolute -right-6 -bottom-8 text-[120px] font-black leading-none opacity-10">M</div>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_35%)]" />
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white/90 border border-white/10">Kundekort</div>
                      <div className="text-2xl sm:text-3xl font-bold tracking-tight">{selectedMember.name}</div>
                      <div className="text-sm text-white/80">{selectedMember.email}</div>
                      <div className="text-sm text-white/80">Mål: {selectedMember.goal || "Ikke satt"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm min-w-[200px] sm:min-w-[240px]">
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 backdrop-blur-sm"><div className="text-white/70 text-xs uppercase tracking-wide">Programmer</div><div className="mt-1 font-semibold text-lg">{trainerProgramsForSelected.length}</div></div>
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 backdrop-blur-sm"><div className="text-white/70 text-xs uppercase tracking-wide">Logger</div><div className="mt-1 font-semibold text-lg">{trainerLogsForSelected.length}</div></div>
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 backdrop-blur-sm"><div className="text-white/70 text-xs uppercase tracking-wide">Meldinger</div><div className="mt-1 font-semibold text-lg">{trainerMessagesForSelected.length}</div></div>
                      <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5 backdrop-blur-sm"><div className="text-white/70 text-xs uppercase tracking-wide">Ukeplan</div><div className="mt-1 font-semibold text-lg">{trainerScheduleForSelected.length}</div></div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {selectedMember ? (
                  <>
                    <div className="rounded-2xl border px-3 py-2.5 text-sm bg-white flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                      <div className="font-medium">{smartHint}</div>
                      <div className="flex gap-2">
                        {needsLog ? <Badge tone="yellow">Logg mangler</Badge> : null}
                        {needsReply ? <Badge tone="yellow">Svar mangler</Badge> : null}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <OutlineButton className="w-full justify-center" onClick={openQuickProgram}>{programButtonLabel}</OutlineButton>
                      <OutlineButton className="w-full justify-center" onClick={openQuickLog}>{logButtonLabel}</OutlineButton>
                      <OutlineButton className="w-full justify-center" onClick={openQuickMessage}>{messageButtonLabel}</OutlineButton>
                    </div>
                  </>
                ) : null}

                <SectionTitle icon={<UserCircle2 className="h-5 w-5" />} title={selectedMember ? selectedMember.name : "Kundekort"} subtitle={selectedMember ? "All info om valgt kunde samlet her" : "Velg kunde for å åpne kundekort"} />

                {selectedMember ? (
                  <div className="rounded-3xl border bg-slate-50/80 p-2 shadow-sm" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => setCustomerTab("profile")}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${customerTab === "profile" ? "text-white shadow-sm" : "bg-white text-slate-700"}`}
                        style={customerTab === "profile" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { border: "1px solid rgba(15,23,42,0.06)" }}
                      >
                        <UserCircle2 className="h-4 w-4" />
                        Profil
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerTab("programs")}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${customerTab === "programs" ? "text-white shadow-sm" : "bg-white text-slate-700"}`}
                        style={customerTab === "programs" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { border: "1px solid rgba(15,23,42,0.06)" }}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Programmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerTab("schedule")}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${customerTab === "schedule" ? "text-white shadow-sm" : "bg-white text-slate-700"}`}
                        style={customerTab === "schedule" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { border: "1px solid rgba(15,23,42,0.06)" }}
                      >
                        <Target className="h-4 w-4" />
                        Ukeplan
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerTab("logs")}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${customerTab === "logs" ? "text-white shadow-sm" : "bg-white text-slate-700"}`}
                        style={customerTab === "logs" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { border: "1px solid rgba(15,23,42,0.06)" }}
                      >
                        <TrendingUp className="h-4 w-4" />
                        Logger
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerTab("messages")}
                        className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-medium transition ${customerTab === "messages" ? "text-white shadow-sm" : "bg-white text-slate-700"}`}
                        style={customerTab === "messages" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { border: "1px solid rgba(15,23,42,0.06)" }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Meldinger
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {!selectedMember ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Velg en kunde til venstre for å åpne kundekortet.</div>
              ) : (
                <div className="rounded-3xl border bg-slate-50/70 p-3 text-sm text-slate-600" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                  <div className="font-medium text-slate-800">
                    {customerTab === "profile" ? "Profil og grunninfo" : customerTab === "programs" ? "Programbygging og aktive program" : customerTab === "schedule" ? "Fast ukeplan og struktur" : customerTab === "logs" ? "Historikk og øktlogging" : "Dialog med kunden"}
                  </div>
                  <div className="mt-1">
                    {customerTab === "profile" ? "Her legger du inn kontaktinfo, mål, skader og annen viktig info om kunden." : customerTab === "programs" ? "Lag nye program, bygg med øvelser og se alt som allerede er tildelt." : customerTab === "schedule" ? "Legg inn faste økter så kunden får tydelig struktur i uka." : customerTab === "logs" ? "Opprett utkast til økter og hold oversikt over hva som er gjennomført." : "Send meldinger og svar raskt når kunden trenger oppfølging."}
                  </div>
                </div>
              )}

              {selectedMember && customerTab === "profile" ? (
                <div className="space-y-4">
                  <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Navn</div><TextInput value={selectedMember.name} onChange={(e) => updateSelectedMemberField("name", e.target.value)} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">E-post</div><TextInput value={selectedMember.email} onChange={(e) => updateSelectedMemberField("email", e.target.value)} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Telefon</div><div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-500" /><TextInput value={selectedMember.phone} onChange={(e) => updateSelectedMemberField("phone", e.target.value)} /></div></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Fødselsdato</div><TextInput type="date" value={selectedMember.birthDate} onChange={(e) => updateSelectedMemberField("birthDate", e.target.value)} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Vekt (kg)</div><TextInput value={selectedMember.weight} onChange={(e) => updateSelectedMemberField("weight", e.target.value)} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Høyde (cm)</div><TextInput value={selectedMember.height} onChange={(e) => updateSelectedMemberField("height", e.target.value)} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Nivå</div><SelectBox value={selectedMember.level} onChange={(value) => updateSelectedMemberField("level", value)} options={["Nybegynner", "Litt øvet", "Øvet"]} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Medlemskap</div><SelectBox value={selectedMember.membershipType} onChange={(value) => updateSelectedMemberField("membershipType", value)} options={["Standard", "Premium"]} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Kundetype</div><SelectBox value={selectedMember.customerType} onChange={(value) => updateSelectedMemberField("customerType", value)} options={["PT-kunde", "Oppfølging", "Egentrening"]} /></div>
                    <div className="rounded-2xl border p-3 bg-slate-50/80 space-y-1.5 shadow-sm"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Dager siden aktivitet</div><TextInput value={selectedMember.daysSinceActivity} onChange={(e) => updateSelectedMemberField("daysSinceActivity", e.target.value)} /></div>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                    <details className="rounded-3xl border bg-slate-50/80 p-4 shadow-sm" open>
                      <summary className="cursor-pointer font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Mål og fokus</summary>
                      <div className="mt-3 space-y-2">
                        <TextInput value={selectedMember.goal} onChange={(e) => updateSelectedMemberField("goal", e.target.value)} placeholder="Mål" />
                        <TextInput value={selectedMember.focus} onChange={(e) => updateSelectedMemberField("focus", e.target.value)} placeholder="Fokus" />
                        <TextArea value={selectedMember.personalGoals} onChange={(e) => updateSelectedMemberField("personalGoals", e.target.value)} className="min-h-[100px]" placeholder="Medlemmets egne målsetninger" />
                        <TextArea value={selectedMember.coachNotes} onChange={(e) => updateSelectedMemberField("coachNotes", e.target.value)} className="min-h-[100px]" placeholder="PT-notater" />
                      </div>
                    </details>
                    <details className="rounded-3xl border bg-slate-50/80 p-4 h-fit shadow-sm" open>
                      <summary className="cursor-pointer font-semibold flex items-center gap-2"><HeartPulse className="h-4 w-4" /> Skader og hensyn</summary>
                      <div className="mt-3">
                        <TextArea value={selectedMember.injuries} onChange={(e) => updateSelectedMemberField("injuries", e.target.value)} className="min-h-[150px]" placeholder="Skader, hensyn og viktige detaljer" />
                      </div>
                    </details>
                  </div>
                </div>
              ) : customerTab === "programs" ? (
                <div className="space-y-6">
                  <Card className="border-0 shadow-none bg-slate-50 p-4 sm:p-5">
                    <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                      <TextInput ref={programTitleRef} value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på program" />
                      <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål med programmet" />
                    </div>
                    <div className="mt-3"><TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} className="min-h-[100px]" placeholder="Notater til medlemmet" /></div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-500">Bygg program direkte på valgt kunde. Du kan dra øvelsene for å endre rekkefølge.</div>
                      <SearchableExerciseSelect exercises={exercises} onAdd={addExerciseToProgram} />
                    </div>
                    <div className="mt-3 space-y-3">
                      {programExercises.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500 bg-white">Ingen øvelser lagt til ennå.</div> : null}
                      {programExercises.map((item, index) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedProgramExerciseId(item.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleExerciseDrop(item.id)}
                          onDragEnd={() => setDraggedProgramExerciseId(null)}
                          className={`rounded-3xl border p-4 bg-white space-y-4 transition ${draggedProgramExerciseId === item.id ? "opacity-60" : "opacity-100"}`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">Dra</span>
                              <button onClick={() => moveExercise(item.id, "up")}>⬆️</button>
                              <button onClick={() => moveExercise(item.id, "down")}>⬇️</button>
                            </div>
                            <span className="text-slate-400">Hold og dra for å endre rekkefølge</span>
                          </div>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-xs text-slate-500">Øvelse {index + 1}</div>
                              <div className="font-semibold text-lg">{item.exerciseName}</div>
                            </div>
                            <OutlineButton onClick={() => removeProgramExercise(item.id)}>Fjern</OutlineButton>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <TextInput value={item.sets} onChange={(e) => updateProgramExercise(item.id, "sets", e.target.value)} placeholder="Sett" />
                            <TextInput value={item.reps} onChange={(e) => updateProgramExercise(item.id, "reps", e.target.value)} placeholder="Reps" />
                            <TextInput value={item.weight} onChange={(e) => updateProgramExercise(item.id, "weight", e.target.value)} placeholder="Kg" />
                            <TextInput value={item.restSeconds} onChange={(e) => updateProgramExercise(item.id, "restSeconds", e.target.value)} placeholder="Hvile sek" />
                            <TextInput value={item.notes} onChange={(e) => updateProgramExercise(item.id, "notes", e.target.value)} placeholder="Notat" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-slate-500">Programmet lagres på valgt kunde og blir synlig på medlemsportalen.</div>
                      <GradientButton onClick={saveProgram}>Lagre og tildel program</GradientButton>
                    </div>
                  </Card>

                  <div className="space-y-4">
                    {trainerProgramsForSelected.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Ingen programmer på denne kunden ennå.</div> : null}
                    {trainerProgramsForSelected.map((program) => (
                      <div key={program.id} className="rounded-3xl border p-4 sm:p-5 bg-slate-50 space-y-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold">{program.title}</div>
                            <div className="text-sm text-slate-500">Opprettet {program.createdAt}</div>
                          </div>
                          {program.goal ? <Badge>{program.goal}</Badge> : null}
                        </div>
                        {program.notes ? <div className="text-sm text-slate-500">{program.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : customerTab === "schedule" ? (
                <div className="space-y-4">
                  <Card className="border-0 shadow-none bg-slate-50 p-4 sm:p-5">
                    <div className="space-y-3">
                      <SelectBox value={scheduleDay} onChange={(value) => setScheduleDay(value as Weekday)} options={weekdays} />
                      <TextInput value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="Navn på økt" />
                      <TextInput value={scheduleFocus} onChange={(e) => setScheduleFocus(e.target.value)} placeholder="Fokus" />
                      <GradientButton onClick={addScheduleItem} className="w-full">Legg til i ukeplan</GradientButton>
                    </div>
                  </Card>
                  <div className="space-y-2">
                    {trainerScheduleForSelected.length === 0 ? <div className="text-sm text-slate-500">Ingen faste økter lagt inn ennå.</div> : null}
                    {trainerScheduleForSelected.map((item) => (
                      <div key={item.id} className="rounded-2xl border p-3 bg-slate-50 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.day} · {item.title}</div>
                          <div className="text-sm text-slate-500">{item.focus}</div>
                        </div>
                        <OutlineButton onClick={() => removeScheduleItem(item.id)}>Fjern</OutlineButton>
                      </div>
                    ))}
                  </div>
                </div>
              ) : customerTab === "logs" ? (
                <div className="space-y-4">
                  <Card className="border-0 shadow-none bg-slate-50 p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px]">
                      <SelectBox value={selectedProgramIdForLog} onChange={setSelectedProgramIdForLog} options={trainerProgramsForSelected.length ? trainerProgramsForSelected.map((program) => program.id) : ["ingen-program"]} />
                      <TextInput ref={logDateRef} type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                      <GradientButton onClick={createDraftWorkoutLog}>Opprett logg</GradientButton>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <OutlineButton onClick={saveDraftAsPlanned}>Lagre som planlagt</OutlineButton>
                      <GradientButton onClick={saveDraftAsCompleted}>Lagre som fullført</GradientButton>
                    </div>
                    <div className="mt-3 text-sm text-slate-500">{draftLogStatusText}</div>
                  </Card>
                  <div className="space-y-3">
                    {trainerLogsForSelected.length === 0 ? <div className="text-sm text-slate-500">Ingen logger på denne kunden ennå.</div> : null}
                    {trainerLogsForSelected.map((log) => (
                      <div key={log.id} className="rounded-3xl border p-4 bg-slate-50">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold">{log.programTitle}</div>
                            <div className="text-sm text-slate-500">{log.date}</div>
                          </div>
                          <Badge>{log.status}</Badge>
                        </div>
                        {log.note ? <div className="mt-2 text-sm text-slate-500">{log.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-64 space-y-3 overflow-auto rounded-2xl border bg-slate-50 p-4">
                    {trainerMessagesForSelected.length === 0 ? <div className="text-sm text-slate-500">Ingen meldinger ennå.</div> : null}
                    {trainerMessagesForSelected.map((message) => (
                      <div key={message.id} className={`max-w-[85%] rounded-2xl p-3 text-sm ${message.sender === "trainer" ? "text-white ml-auto" : "bg-white border"}`} style={message.sender === "trainer" ? { background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` } : { borderColor: "rgba(15,23,42,0.08)" }}>
                        <div>{message.text}</div>
                        <div className={`mt-1 text-[11px] ${message.sender === "trainer" ? "text-white/80" : "text-slate-500"}`}>{message.createdAt}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <TextInput ref={trainerMessageRef} value={trainerMessage} onChange={(e) => setTrainerMessage(e.target.value)} placeholder="Skriv melding til kunden" />
                    <GradientButton onClick={sendTrainerMessage}>Send</GradientButton>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {trainerTab === "templates" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Programmaler" subtitle="Builder-mode + raskt søk" />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[420px] w-full lg:w-auto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput placeholder="Søk mal (navn, mål, nivå)" className="pl-9" />
                </div>
                <OutlineButton onClick={() => {
                  setProgramTitle("Ny mal");
                  setProgramGoal("");
                  setProgramNotes("");
                  setProgramExercises([]);
                }}>+ Ny mal</OutlineButton>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            {/* BUILDER */}
            <Card className="p-4 h-fit xl:sticky xl:top-4">
              <div className="space-y-3">
                <div className="text-base font-semibold">Bygg programmal</div>
                <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                  Legg til øvelser og dra dem i ønsket rekkefølge. Perfekt når du vil bygge en mal raskt og ryddig.
                </div>
                <TextInput value={programTitle} onChange={(e) => setProgramTitle(e.target.value)} placeholder="Navn på mal" />
                <TextInput value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} placeholder="Mål" />
                <TextArea value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} placeholder="Notater" />

                <div className="flex justify-between items-center">
                  <div className="text-sm text-slate-500">Legg til øvelser</div>
                  <SearchableExerciseSelect exercises={exercises} onAdd={addExerciseToProgram} />
                </div>

                <div className="space-y-2">
                  {programExercises.map((ex, index) => (
                    <div
                      key={ex.id}
                      draggable
                      onDragStart={() => setDraggedProgramExerciseId(ex.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleExerciseDrop(ex.id)}
                      onDragEnd={() => setDraggedProgramExerciseId(null)}
                      className={`rounded-2xl border p-2 text-sm flex justify-between items-center bg-slate-50 transition ${draggedProgramExerciseId === ex.id ? "opacity-60" : "opacity-100"}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{index + 1}. {ex.exerciseName}</div>
                        <div className="text-[11px] text-slate-500">Dra for å flytte · eller bruk builder videre</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => moveExercise(ex.id, "up")} className="text-xs">⬆️</button>
                        <button onClick={() => moveExercise(ex.id, "down")} className="text-xs">⬇️</button>
                        <button onClick={() => removeProgramExercise(ex.id)} className="text-xs">Fjern</button>
                      </div>
                    </div>
                  ))}
                </div>

                <GradientButton onClick={saveAsTemplate} className="w-full">Lagre som mal</GradientButton>
              </div>
            </Card>

            {/* LISTE */}
            <Card className="p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
                <div>{templates.length} maler</div>
                <div>Velg kunde direkte på hvert programkort</div>
              </div>
              <div className="space-y-2">
                {[...templates]
                  .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)))
                  .map((template) => (
                    <div key={template.id} className="rounded-2xl border bg-slate-50 px-3 py-2.5">
                      <div className="flex justify-end mb-1">
                        <button onClick={() => toggleTemplateFavorite(template.id)} className="text-xs">
                          {template.favorite ? "⭐" : "☆"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{template.title}</div>
                          <div className="truncate text-xs text-slate-500">{template.goal} · {template.level}</div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={templateAssignTargets[template.id] ?? selectedMemberId}
                            onChange={(e) => setTemplateAssignTargets((prev) => ({ ...prev, [template.id]: e.target.value }))}
                            className="h-8 rounded-xl border px-2 text-xs bg-white"
                            style={{ borderColor: "rgba(15,23,42,0.08)" }}
                          >
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>{member.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignTemplateToMember(template.id, templateAssignTargets[template.id] ?? selectedMemberId)}
                            className="text-xs px-2 py-1 border rounded-xl bg-white"
                            style={{ borderColor: "rgba(15,23,42,0.08)" }}
                          >
                            Tildel kunde
                          </button>
                        </div>
                        <button onClick={() => useTemplate(template.id)} className="text-xs px-2 py-1 border rounded-xl bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>Bruk i builder</button>
                          <button onClick={() => {
                            setProgramTitle(template.title);
                            setProgramGoal(template.goal);
                            setProgramNotes(template.notes);
                            setProgramExercises(template.exercises);
                          }} className="text-xs px-2 py-1 border rounded-xl bg-white" style={{ borderColor: "rgba(15,23,42,0.08)" }}>Rediger</button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {trainerTab === "exerciseBank" ? (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SectionTitle icon={<Dumbbell className="h-5 w-5" />} title="Øvelsesbank" subtitle="Kompakt liste med raskt søk og redigering" />
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[460px] w-full lg:w-auto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Søk navn, muskelgruppe, utstyr eller teknisk info" className="pl-9" />
                </div>
                <OutlineButton onClick={cancelEditExercise}>{editingExerciseId ? "Ny øvelse" : "Tøm skjema"}</OutlineButton>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
            <Card className="p-4 h-fit xl:sticky xl:top-4">
              <details open>
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">Legg til ny øvelse</div>
                      <div className="text-sm text-slate-500">Fast skjema for nye øvelser i banken</div>
                    </div>
                    <Badge>Ny</Badge>
                  </div>
                </summary>
                <div className="mt-4 space-y-3">
                  <TextInput value={editingExerciseId ? "" : exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Navn på øvelse" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectBox value={editingExerciseId ? "Bein" : exerciseGroup} onChange={setExerciseGroup} options={["Bryst", "Rygg", "Bein", "Skuldre", "Armer", "Kjerne", "Kondisjon", "Fullkropp"]} />
                    <SelectBox value={editingExerciseId ? "Nybegynner" : exerciseLevel} onChange={(value) => setExerciseLevel(value as Level)} options={["Nybegynner", "Litt øvet", "Øvet"]} />
                  </div>
                  <TextInput value={editingExerciseId ? "" : exerciseEquipment} onChange={(e) => setExerciseEquipment(e.target.value)} placeholder="Utstyr" />
                  <TextInput value={editingExerciseId ? "" : exerciseImageUrl} onChange={(e) => setExerciseImageUrl(e.target.value)} placeholder="Bilde-URL" />
                  <TextInput value={editingExerciseId ? "" : exercisePrimaryMuscles} onChange={(e) => setExercisePrimaryMuscles(e.target.value)} placeholder="Primære muskler" />
                  <TextInput value={editingExerciseId ? "" : exerciseCoachingTips} onChange={(e) => setExerciseCoachingTips(e.target.value)} placeholder="Coaching-tips" />
                  <TextArea value={editingExerciseId ? "" : exerciseTechnicalNotes} onChange={(e) => setExerciseTechnicalNotes(e.target.value)} className="min-h-[88px]" placeholder="Teknisk info" />
                  {!editingExerciseId && exerciseImageUrl ? (
                    <div className="overflow-hidden rounded-2xl border bg-slate-50">
                      <img src={exerciseImageUrl} alt={exerciseName || "Øvelse"} className="h-40 w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="flex gap-3">
                    <GradientButton onClick={saveExerciseBankEntry} className="w-full">Lagre ny øvelse</GradientButton>
                    <OutlineButton onClick={cancelEditExercise} className="w-full">Tøm skjema</OutlineButton>
                  </div>
                  {editingExerciseId ? (
                    <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                      Du redigerer en eksisterende øvelse lenger ned i lista. Dette skjemaet er kun for å legge til nye øvelser.
                    </div>
                  ) : null}
                </div>
              </details>
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm text-slate-500">{filteredExerciseBank.length} øvelser</div>
                <div className="text-sm text-slate-500">Trykk rediger for full info</div>
              </div>
              <div className="space-y-2">
                {filteredExerciseBank.map((exercise) => {
                  const isEditing = editingExerciseId === exercise.id;
                  return (
                    <div key={exercise.id} className={`rounded-2xl border bg-slate-50 px-3 py-2.5 transition-all ${isEditing ? "p-4" : ""}`}>
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 overflow-hidden rounded-xl border bg-white flex items-center justify-center text-[10px] text-slate-400 ${isEditing ? "h-20 w-20" : "h-12 w-12"}`}>
                          {exercise.imageUrl ? <img src={exercise.imageUrl} alt={exercise.name} className="h-full w-full object-cover" /> : <span>Ingen bilde</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate font-medium">{exercise.name}</div>
                            {exercise.favorite ? <span className="text-xs">⭐</span> : null}
                          </div>
                          <div className="truncate text-xs text-slate-500">{exercise.group} · {exercise.equipment} · {exercise.level}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button onClick={() => toggleFavorite(exercise.id)} className="rounded-xl px-2 py-1 text-xs bg-white border" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            {exercise.favorite ? "⭐" : "☆"}
                          </button>
                          <button onClick={() => addExerciseToProgram(exercise)} className="rounded-xl px-2.5 py-1.5 text-xs font-medium bg-white border" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            + Legg til
                          </button>
                          <button onClick={() => startEditExercise(exercise.id)} className="rounded-xl px-2.5 py-1.5 text-xs font-medium bg-white border" style={{ borderColor: "rgba(15,23,42,0.08)" }}>
                            {isEditing ? "Redigerer" : "Rediger"}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <div className="space-y-3">
                            <TextInput value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} placeholder="Navn på øvelse" />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <SelectBox value={exerciseGroup} onChange={setExerciseGroup} options={["Bryst", "Rygg", "Bein", "Skuldre", "Armer", "Kjerne", "Kondisjon", "Fullkropp"]} />
                              <SelectBox value={exerciseLevel} onChange={(value) => setExerciseLevel(value as Level)} options={["Nybegynner", "Litt øvet", "Øvet"]} />
                            </div>
                            <TextInput value={exerciseEquipment} onChange={(e) => setExerciseEquipment(e.target.value)} placeholder="Utstyr" />
                            <TextInput value={exerciseImageUrl} onChange={(e) => setExerciseImageUrl(e.target.value)} placeholder="Bilde-URL" />
                            <TextInput value={exercisePrimaryMuscles} onChange={(e) => setExercisePrimaryMuscles(e.target.value)} placeholder="Primære muskler" />
                          </div>
                          <div className="space-y-3">
                            <TextInput value={exerciseCoachingTips} onChange={(e) => setExerciseCoachingTips(e.target.value)} placeholder="Coaching-tips" />
                            <TextArea value={exerciseTechnicalNotes} onChange={(e) => setExerciseTechnicalNotes(e.target.value)} className="min-h-[120px]" placeholder="Teknisk info" />
                            {exerciseImageUrl ? (
                              <div className="overflow-hidden rounded-2xl border bg-white">
                                <img src={exerciseImageUrl} alt={exerciseName || "Øvelse"} className="h-40 w-full object-cover" />
                              </div>
                            ) : null}
                          </div>
                          <div className="lg:col-span-2 flex gap-3">
                            <GradientButton onClick={saveExerciseBankEntry} className="w-full">Lagre endringer</GradientButton>
                            <OutlineButton onClick={cancelEditExercise} className="w-full">Avbryt</OutlineButton>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {filteredExerciseBank.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Ingen øvelser matcher søket ditt.</div> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemberPortal(props: {
  members: Member[];
  memberViewId: string;
  setMemberViewId: (id: string) => void;
  viewedMember: Member | null;
  memberPrograms: TrainingProgram[];
  memberLogs: WorkoutLog[];
  memberMessages: ChatMessage[];
  memberTab: MemberTab;
  setMemberTab: (tab: MemberTab) => void;
  memberMessage: string;
  setMemberMessage: (value: string) => void;
  sendMemberMessage: () => void;
  celebrationMessage: string | null;
  dismissCelebration: () => void;
  memberWorkoutDrafts: Record<string, Record<string, MemberWorkoutDraftValue>>;
  memberProgramSteps: Record<string, number>;
  memberRestTimers: Record<string, number>;
  startMemberWorkout: (program: TrainingProgram) => void;
  updateMemberWorkoutDraft: (program: TrainingProgram, exerciseId: string, field: keyof MemberWorkoutDraftValue, value: string) => void;
  updateMemberWorkoutSetRow: (programId: string, exerciseId: string, setIndex: number, field: keyof WorkoutSetRow, value: string) => void;
  addMemberWorkoutSet: (programId: string, exerciseId: string) => void;
  removeMemberWorkoutSet: (programId: string, exerciseId: string, index: number) => void;
  toggleWorkoutExerciseCompleted: (program: TrainingProgram, exerciseId: string) => void;
  startRestTimer: (program: TrainingProgram, exercise: ProgramExercise) => void;
  goToPreviousWorkoutExercise: (program: TrainingProgram) => void;
  goToNextWorkoutExercise: (program: TrainingProgram) => void;
  completeMemberWorkout: (program: TrainingProgram) => void;
  updateViewedMemberField: (field: keyof Member, value: string) => void;
}) {
  const {
    members,
    memberViewId,
    setMemberViewId,
    viewedMember,
    memberPrograms,
    memberLogs,
    memberMessages,
    memberTab,
    setMemberTab,
    memberMessage,
    setMemberMessage,
    sendMemberMessage,
    celebrationMessage,
    dismissCelebration,
    memberWorkoutDrafts,
    memberProgramSteps,
    memberRestTimers,
    startMemberWorkout,
    updateMemberWorkoutDraft,
    updateMemberWorkoutSetRow,
    addMemberWorkoutSet,
    removeMemberWorkoutSet,
    toggleWorkoutExerciseCompleted,
    startRestTimer,
    goToPreviousWorkoutExercise,
    goToNextWorkoutExercise,
    completeMemberWorkout,
    updateViewedMemberField,
  } = props;

  const prHistory = useMemo(() => {
    return memberLogs
      .filter((log) => log.status === "Fullført")
      .flatMap((log) =>
        (log.loggedExercises ?? [])
          .filter((exercise) => exercise.isPR && (exercise.estimated1RM ?? 0) > 0)
          .map((exercise) => ({
            id: `${log.id}-${exercise.id}`,
            date: log.date,
            exerciseName: exercise.exerciseName,
            estimated1RM: Math.round(exercise.estimated1RM ?? 0),
            previousBest1RM: Math.round(exercise.previousBest1RM ?? 0),
          }))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [memberLogs]);

  const memberOverviewStats = useMemo(() => {
    const completedLogs = memberLogs.filter((log) => log.status === "Fullført");
    const completedCount = completedLogs.length;
    const daysInactive = Number(viewedMember?.daysSinceActivity ?? "0");
    const streakWeeks = completedCount === 0 ? 0 : daysInactive < 7 ? Math.min(8, Math.max(1, completedCount)) : 0;
    const weeklyGoal = 3;
    const weeklyDone = Math.min(completedCount, weeklyGoal);
    const progressPercent = Math.min(100, Math.round((weeklyDone / weeklyGoal) * 100));
    const allLoggedExercises = completedLogs.flatMap((log) => log.loggedExercises ?? []);
    const totalMovedKg = allLoggedExercises.reduce((sum, exercise) => sum + exercise.volume, 0);
    const estimatedWeeklyVolume = completedCount === 0 ? 0 : Math.round(totalMovedKg / Math.max(1, Math.min(completedCount, 3)));
    const topProgram = memberPrograms[0]?.title ?? "Ingen program ennå";
    const prsMap = allLoggedExercises.reduce<Record<string, number>>((acc, exercise) => {
      const current = acc[exercise.exerciseName] ?? 0;
      const currentEstimate = exercise.estimated1RM ?? estimate1RM(exercise.weight, exercise.reps);
      if (currentEstimate > current) acc[exercise.exerciseName] = currentEstimate;
      return acc;
    }, {});
    const personalRecords = Object.entries(prsMap)
      .map(([exerciseName, estimated1RM]) => ({ exerciseName, estimated1RM: Math.round(estimated1RM) }))
      .sort((a, b) => b.estimated1RM - a.estimated1RM)
      .slice(0, 4);

    return {
      completedCount,
      daysInactive,
      streakWeeks,
      weeklyGoal,
      weeklyDone,
      progressPercent,
      estimatedWeeklyVolume,
      topProgram,
      bestStreak: Math.max(streakWeeks, completedCount >= 6 ? 6 : streakWeeks),
      personalRecords,
      totalMovedKg,
    };
  }, [memberLogs, memberPrograms, viewedMember]);

  return (
    <div className="space-y-6">
      {celebrationMessage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 text-center shadow-2xl">
            <div className="text-4xl">🎉</div>
            <div className="mt-3 text-2xl font-bold tracking-tight">Ny rekord!</div>
            <div className="mt-2 text-sm text-slate-600">{celebrationMessage}</div>
            <GradientButton onClick={dismissCelebration} className="mt-5 w-full">Rått! Fortsett sånn</GradientButton>
          </div>
        </div>
      ) : null}

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
        <Card className="hidden p-5 h-fit xl:sticky xl:top-4 xl:block">
          <SectionTitle icon={<UserCircle2 className="h-5 w-5" />} title="Velg medlem" subtitle="Simuler medlemsportal" />
          <div className="mt-5 space-y-3">
            <SearchableMemberSelect members={members} selectedMemberId={memberViewId} onSelect={setMemberViewId} />
            {viewedMember ? (
              <div className="rounded-2xl border p-4" style={{ backgroundColor: "#f8fffd", borderColor: MOTUS.softTurquoise }}>
                <div className="font-medium">{viewedMember.name}</div>
                <div className="text-sm text-slate-500">{viewedMember.email}</div>
                <div className="mt-2 text-sm"><span className="font-medium">Alder:</span> {calculateAge(viewedMember.birthDate) || "Ikke satt"}</div>
                <div className="mt-1 text-sm"><span className="font-medium">Mål:</span> {viewedMember.goal}</div>
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-6">
          {memberTab === "overview" ? (
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={<LayoutDashboard className="h-5 w-5" />} title="Din fremside" subtitle="Kort oversikt, fremgang og litt ekstra motivasjon" />
              <div className="mt-4 space-y-4">
                <div className="rounded-[26px] p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${MOTUS.turquoise} 0%, ${MOTUS.pink} 100%)` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/80">Hei{viewedMember ? `, ${viewedMember.name}` : ""}</div>
                      <div className="mt-1 text-2xl sm:text-3xl font-bold">
                        {memberOverviewStats.completedCount === 0 ? "Klar for å komme i gang?" : memberOverviewStats.streakWeeks >= 3 ? "Nå er du i flyt 🔥" : "Sterk start 💪"}
                      </div>
                      <div className="mt-2 text-sm text-white/90 max-w-xl">
                        {memberOverviewStats.completedCount === 0
                          ? "Start i dag – vi tar det steg for steg sammen"
                          : memberOverviewStats.daysInactive >= 5
                            ? "Vi savner deg litt her inne 👀 Klar for en økt igjen?"
                            : `Du har ${memberOverviewStats.completedCount} fullførte økter. Det bygger seg opp nå.`}
                      </div>
                    </div>
                    <div className="hidden sm:block rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur-sm">
                      <div className="text-[11px] uppercase tracking-wide text-white/70">Streak</div>
                      <div className="text-2xl font-bold">{memberOverviewStats.streakWeeks}</div>
                      <div className="text-xs text-white/75">uker på rad</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <GradientButton onClick={() => setMemberTab("programs")}>Start økta</GradientButton>
                    {memberOverviewStats.daysInactive >= 5 ? <OutlineButton onClick={() => setMemberTab("programs")}>Kom i gang igjen</OutlineButton> : null}
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {memberTab === "programs" ? (
            <Card className="p-5">
              <SectionTitle icon={<ClipboardList className="h-5 w-5" />} title="Mine treningsprogram" subtitle="Start valgfri økt, registrer underveis, og fullfør på slutten" />
              <div className="mt-5 space-y-4">
                {memberPrograms.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Dette medlemmet har ingen programmer ennå.</div> : null}
                {memberPrograms.map((program) => {
                  const currentStep = memberProgramSteps[program.id] ?? -1;
                  const isStarted = currentStep >= 0;
                  const safeStep = isStarted ? Math.min(currentStep, Math.max(program.exercises.length - 1, 0)) : 0;
                  const activeExercise = program.exercises[safeStep];
                  const activeDraft = activeExercise ? (memberWorkoutDrafts[program.id]?.[activeExercise.id] ?? { sets: activeExercise.sets, reps: activeExercise.reps, weight: activeExercise.weight, completed: false, setRows: createDefaultSetRows(activeExercise.sets, activeExercise.reps, activeExercise.weight) }) : null;
                  const completedCount = Object.values(memberWorkoutDrafts[program.id] ?? {}).filter((item) => item.completed).length;
                  const activeRestTimer = activeExercise ? (memberRestTimers[`${program.id}::${activeExercise.id}`] ?? 0) : 0;

                  return (
                    <div key={program.id} className="rounded-3xl border p-5 bg-slate-50 space-y-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{program.title}</h3>
                          <p className="text-sm text-slate-500">Opprettet: {program.createdAt}</p>
                          {isStarted ? <div className="mt-2 text-xs text-slate-500">Fullført i økta: {completedCount}/{program.exercises.length} øvelser</div> : null}
                          {program.goal ? <div className="mt-2"><Badge>{program.goal}</Badge></div> : null}
                        </div>
                        <div className="flex gap-2">
                          {!isStarted ? <GradientButton onClick={() => startMemberWorkout(program)}>Start økt</GradientButton> : null}
                          {isStarted ? <OutlineButton onClick={() => goToPreviousWorkoutExercise(program)} disabled={safeStep === 0}>Forrige</OutlineButton> : null}
                          {isStarted && safeStep < program.exercises.length - 1 ? <GradientButton onClick={() => goToNextWorkoutExercise(program)}>Neste øvelse</GradientButton> : null}
                        </div>
                      </div>

                      {program.notes ? <div className="rounded-2xl border bg-white p-4 text-sm"><span className="font-medium">Kommentar fra PT:</span> {program.notes}</div> : null}

                      {!isStarted ? (
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div>
                              <div className="font-medium">Programoversikt</div>
                              <div className="mt-1 text-slate-500">{program.exercises.length} øvelser · klar til start</div>
                            </div>
                            <Badge>{program.exercises.length} øvelser</Badge>
                          </div>
                          <div className="mt-3 text-sm text-slate-500">
                            Trykk <span className="font-medium">Start økt</span> for å åpne øvelsene én etter én og registrere treningen underveis.
                          </div>
                        </div>
                      ) : null}

                      {isStarted && activeExercise && activeDraft ? (
                        <div className="rounded-3xl border bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-slate-500">Pågående økt · øvelse {safeStep + 1} av {program.exercises.length}</div>
                              <div className="mt-1 text-2xl font-bold tracking-tight">{activeExercise.exerciseName}</div>
                            </div>
                            <Badge tone="mint">Registreres automatisk</Badge>
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                            <div className="font-medium text-slate-800">Anbefaling fra PT</div>
                            <div className="mt-1">{activeExercise.sets} sett · {activeExercise.reps} reps · ca. {activeExercise.weight || "0"} kg</div>
                            <div className="mt-1">Hvile mellom sett: {activeExercise.restSeconds || "0"} sek</div>
                            {activeExercise.notes ? <div className="mt-2">Notat: {activeExercise.notes}</div> : null}
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-1 lg:grid-cols-[180px_1fr]">
                            <div className="rounded-2xl border bg-slate-50 p-3">
                              <div className="text-[11px] uppercase tracking-wide text-slate-500">Antall sett</div>
                              <TextInput value={activeDraft.sets} onChange={(e) => updateMemberWorkoutDraft(program, activeExercise.id, "sets", e.target.value)} className="mt-2" />
                            </div>
                            <div className="rounded-2xl border bg-slate-50 p-3">
                              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">Kg og reps pr sett</div>
                              <div className="space-y-2">
                                {(activeDraft.setRows ?? []).map((setRow, setIndex) => (
                                  <div key={`${activeExercise.id}-set-${setIndex}`} className="grid grid-cols-[60px_1fr_1fr_auto] gap-2 items-center">
                                    <div className="text-sm font-medium text-slate-600">#{setIndex + 1}</div>
                                    <TextInput value={setRow.kg} onChange={(e) => updateMemberWorkoutSetRow(program.id, activeExercise.id, setIndex, "kg", e.target.value)} placeholder="Kg" />
                                    <TextInput value={setRow.reps} onChange={(e) => updateMemberWorkoutSetRow(program.id, activeExercise.id, setIndex, "reps", e.target.value)} placeholder="Reps" />
                                    <button onClick={() => removeMemberWorkoutSet(program.id, activeExercise.id, setIndex)} className="text-xs text-red-500">Slett</button>
                                  </div>
                                ))}
                                <button onClick={() => addMemberWorkoutSet(program.id, activeExercise.id)} className="mt-2 text-sm text-emerald-600 font-medium">+ Legg til sett</button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                            <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                              <div className="font-medium text-slate-800">Hviletid</div>
                              <div className="mt-1">Tallene lagres automatisk mens du skriver. Start hviletid mellom settene og huk av når øvelsen er ferdig.</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <OutlineButton onClick={() => startRestTimer(program, activeExercise)}>Start hviletid</OutlineButton>
                                {activeRestTimer > 0 ? <Badge tone="yellow">{activeRestTimer}s igjen</Badge> : <Badge>{activeExercise.restSeconds || "0"} sek standard</Badge>}
                                <OutlineButton onClick={() => toggleWorkoutExerciseCompleted(program, activeExercise.id)}>{activeDraft.completed ? "Marker som ikke fullført" : "Huk av fullført"}</OutlineButton>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                              {safeStep === program.exercises.length - 1 ? <GradientButton onClick={() => completeMemberWorkout(program)}>Fullfør økt</GradientButton> : <GradientButton onClick={() => goToNextWorkoutExercise(program)}>Neste øvelse</GradientButton>}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {memberTab === "progress" ? (
            <Card className="p-5">
              <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Fremgang" subtitle="Økter, rekorder og utvikling samlet" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Fullførte økter" value={String(memberOverviewStats.completedCount)} hint="Totalt registrert" />
                <StatCard label="Streak" value={`${memberOverviewStats.streakWeeks} uker`} hint="På rad akkurat nå" />
                <StatCard label="Flyttet totalt" value={`${memberOverviewStats.totalMovedKg.toLocaleString("no-NO")} kg`} hint="Summert volum" />
                <StatCard label="Denne uka" value={`${memberOverviewStats.estimatedWeeklyVolume.toLocaleString("no-NO")} kg`} hint="Estimert ukesvolum" />
              </div>

              <div className="mt-6">
                <div className="text-base font-semibold">Siste økter</div>
                <div className="mt-3 space-y-4">
                  {memberLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Ingen økter logget ennå.</div> : null}
                  {memberLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="rounded-3xl border p-5 bg-slate-50 space-y-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold">{log.programTitle}</div>
                          <div className="text-sm text-slate-500">Dato: {log.date}</div>
                        </div>
                        <Badge>{log.status}</Badge>
                      </div>
                      {log.note ? <div className="text-sm text-slate-500">Kommentar: {log.note}</div> : null}
                      {log.loggedExercises?.length ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {log.loggedExercises.map((exercise) => (
                            <div key={exercise.id} className="rounded-2xl border bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium">{exercise.exerciseName}</div>
                                {exercise.isPR ? <Badge tone="green">PR</Badge> : null}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{exercise.sets} sett × {exercise.reps} reps × {exercise.weight} kg</div>
                              <div className="mt-1 text-sm font-semibold">Volum: {exercise.volume.toLocaleString("no-NO")} kg</div>
                              <div className="mt-1 text-xs text-slate-500">Estimert 1RM: {Math.round(exercise.estimated1RM ?? estimate1RM(exercise.weight, exercise.reps))} kg</div>
                              {exercise.isPR ? <div className="mt-1 text-xs text-emerald-700">Ny rekord: fra {Math.round(exercise.previousBest1RM ?? 0)} kg til {Math.round(exercise.estimated1RM ?? 0)} kg</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="text-base font-semibold">Rekordhistorikk</div>
                <div className="mt-3 space-y-3">
                  {prHistory.length === 0 ? <div className="text-sm text-slate-500">Ingen rekorder registrert ennå.</div> : null}
                  {prHistory.map((record) => (
                    <div key={record.id} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{record.exerciseName}</div>
                          <div className="text-xs text-slate-500">{record.date}</div>
                        </div>
                        <Badge tone="green">PR</Badge>
                      </div>
                      <div className="mt-2 text-sm text-slate-600">Fra {record.previousBest1RM} kg til {record.estimated1RM} kg estimert 1RM</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}


          {memberTab === "messages" ? (
            <Card className="p-5">
              <SectionTitle icon={<MessageSquare className="h-5 w-5" />} title="Meldinger" />
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
                  <TextInput value={memberMessage} onChange={(e) => setMemberMessage(e.target.value)} placeholder="Skriv melding til trener" />
                  <GradientButton onClick={sendMemberMessage}>Send</GradientButton>
                </div>
              </div>
            </Card>
          ) : null}

          {memberTab === "profile" ? (
            <Card className="p-5">
              <SectionTitle icon={<UserCircle2 className="h-5 w-5" />} title="Min profil" subtitle="Dette er synlig for PT" />
              {viewedMember ? <div className="mt-3 text-sm text-slate-500">Alder beregnes automatisk: {calculateAge(viewedMember.birthDate) || "Ikke satt"} år</div> : null}
              {viewedMember ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Navn</div><TextInput value={viewedMember.name} onChange={(e) => updateViewedMemberField("name", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">E-post</div><TextInput value={viewedMember.email} onChange={(e) => updateViewedMemberField("email", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Telefon</div><TextInput value={viewedMember.phone} onChange={(e) => updateViewedMemberField("phone", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Fødselsdato</div><TextInput type="date" value={viewedMember.birthDate} onChange={(e) => updateViewedMemberField("birthDate", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Vekt (kg)</div><TextInput value={viewedMember.weight} onChange={(e) => updateViewedMemberField("weight", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Høyde (cm)</div><TextInput value={viewedMember.height} onChange={(e) => updateViewedMemberField("height", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Hovedmål</div><TextInput value={viewedMember.goal} onChange={(e) => updateViewedMemberField("goal", e.target.value)} /></div>
                    <div className="rounded-2xl border p-4 bg-slate-50/80 space-y-2"><div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Fokus</div><TextInput value={viewedMember.focus} onChange={(e) => updateViewedMemberField("focus", e.target.value)} /></div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-3xl border bg-slate-50/80 p-5 space-y-3">
                      <div className="font-semibold">Målsetninger</div>
                      <TextArea value={viewedMember.personalGoals} onChange={(e) => updateViewedMemberField("personalGoals", e.target.value)} className="min-h-[140px]" placeholder="Skriv litt om målsetningene dine" />
                    </div>
                    <div className="rounded-3xl border bg-slate-50/80 p-5 space-y-3">
                      <div className="font-semibold">Skader og hensyn</div>
                      <TextArea value={viewedMember.injuries} onChange={(e) => updateViewedMemberField("injuries", e.target.value)} className="min-h-[140px]" placeholder="Skader, hensyn eller annen viktig info" />
                    </div>
                  </div>
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
  const [role, setRole] = useState<Role>("trainer");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [trainerTab, setTrainerTab] = useState<TrainerTab>("dashboard");
  const [memberTab, setMemberTab] = useState<MemberTab>("overview");
  const initialPersistedState = useMemo(() => getInitialPersistedState(), []);
  const [members, setMembers] = useState<Member[]>(initialPersistedState.members);
  const [exercises, setExercises] = useState<Exercise[]>(initialPersistedState.exercises);
  const [programs, setPrograms] = useState<TrainingProgram[]>(initialPersistedState.programs);
  const [templates, setTemplates] = useState<ProgramTemplate[]>(initialPersistedState.templates);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialPersistedState.schedule);
  const [logs, setLogs] = useState<WorkoutLog[]>(initialPersistedState.logs);
  const [messages, setMessages] = useState<ChatMessage[]>(initialPersistedState.messages);

  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMembers[0]?.id ?? "");
  const [memberViewId, setMemberViewId] = useState<string>(initialMembers[0]?.id ?? "");

  const [exerciseName, setExerciseName] = useState("");
  const [exerciseGroup, setExerciseGroup] = useState("Bein");
  const [exerciseEquipment, setExerciseEquipment] = useState("");
  const [exerciseLevel, setExerciseLevel] = useState<Level>("Nybegynner");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseImageUrl, setExerciseImageUrl] = useState("");
  const [exercisePrimaryMuscles, setExercisePrimaryMuscles] = useState("");
  const [exerciseCoachingTips, setExerciseCoachingTips] = useState("");
  const [exerciseTechnicalNotes, setExerciseTechnicalNotes] = useState("");
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

  const [programTitle, setProgramTitle] = useState("Nytt treningsprogram");
  const [programGoal, setProgramGoal] = useState("");
  const [programNotes, setProgramNotes] = useState("");
  const [programExercises, setProgramExercises] = useState<ProgramExercise[]>([]);

  const [scheduleDay, setScheduleDay] = useState<Weekday>("Mandag");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleFocus, setScheduleFocus] = useState("");

  const [selectedProgramIdForLog, setSelectedProgramIdForLog] = useState<string>(initialPrograms[0]?.id ?? "");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [draftLogStatusText, setDraftLogStatusText] = useState("Ingen draft-logg opprettet ennå.");

  const [trainerMessage, setTrainerMessage] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [memberWorkoutDrafts, setMemberWorkoutDrafts] = useState<Record<string, Record<string, MemberWorkoutDraftValue>>>({});
  const [memberProgramSteps, setMemberProgramSteps] = useState<Record<string, number>>({});
  const [memberRestTimers, setMemberRestTimers] = useState<Record<string, number>>({});
  const [pendingAdvanceAfterCelebration, setPendingAdvanceAfterCelebration] = useState<{ programId: string; nextStep: number } | null>(null);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);
  const applyingRemoteStateRef = useRef(false);
  const remoteSaveTimerRef = useRef<number | null>(null);
  const [supabaseBootstrapped, setSupabaseBootstrapped] = useState(!supabase);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<string>(supabase ? "Kobler til Supabase..." : "Lagrer lokalt i nettleseren");

  useEffect(() => {
    saveStoredState("motus_members", members);
  }, [members]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSupabaseState() {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("app_state")
          .select("payload")
          .eq("id", APP_STATE_ROW_ID)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled && data?.payload) {
          const remote = data.payload as Partial<PersistedAppState>;
          applyingRemoteStateRef.current = true;
          setMembers(Array.isArray(remote.members) ? remote.members : initialPersistedState.members);
          setExercises(Array.isArray(remote.exercises) ? remote.exercises : initialPersistedState.exercises);
          setPrograms(Array.isArray(remote.programs) ? remote.programs : initialPersistedState.programs);
          setTemplates(Array.isArray(remote.templates) ? remote.templates : initialPersistedState.templates);
          setSchedule(Array.isArray(remote.schedule) ? remote.schedule : initialPersistedState.schedule);
          setLogs(Array.isArray(remote.logs) ? remote.logs : initialPersistedState.logs);
          setMessages(Array.isArray(remote.messages) ? remote.messages : initialPersistedState.messages);
          window.setTimeout(() => {
            applyingRemoteStateRef.current = false;
          }, 50);
          setSupabaseSyncStatus("Supabase-data lastet inn");
        } else if (!cancelled) {
          setSupabaseSyncStatus("Supabase klar – ingen lagret skydata ennå");
        }
      } catch {
        if (!cancelled) {
          setSupabaseSyncStatus("Supabase utilgjengelig – bruker lokal lagring");
        }
      } finally {
        if (!cancelled) {
          setSupabaseBootstrapped(true);
        }
      }
    }

    void bootstrapSupabaseState();

    return () => {
      cancelled = true;
    };
  }, [initialPersistedState]);

  useEffect(() => {
    saveStoredState("motus_exercises", exercises);
  }, [exercises]);

  useEffect(() => {
    saveStoredState("motus_programs", programs);
  }, [programs]);

  useEffect(() => {
    saveStoredState("motus_templates", templates);
  }, [templates]);

  useEffect(() => {
    saveStoredState("motus_schedule", schedule);
  }, [schedule]);

  useEffect(() => {
    saveStoredState("motus_logs", logs);
  }, [logs]);

  useEffect(() => {
    saveStoredState("motus_messages", messages);
  }, [messages]);

  useEffect(() => {
    if (!supabase || !supabaseBootstrapped || applyingRemoteStateRef.current) return;

    const payload: PersistedAppState = {
      members,
      exercises,
      programs,
      templates,
      schedule,
      logs,
      messages,
    };

    if (remoteSaveTimerRef.current) {
      window.clearTimeout(remoteSaveTimerRef.current);
    }

    remoteSaveTimerRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("app_state")
          .upsert({ id: APP_STATE_ROW_ID, payload, updated_at: new Date().toISOString() }, { onConflict: "id" });
        if (error) throw error;
        setSupabaseSyncStatus("Lagret til Supabase");
      } catch {
        setSupabaseSyncStatus("Kun lokal lagring akkurat nå");
      }
    }, 500);

    return () => {
      if (remoteSaveTimerRef.current) {
        window.clearTimeout(remoteSaveTimerRef.current);
      }
    };
  }, [members, exercises, programs, templates, schedule, logs, messages, supabaseBootstrapped]);

  useEffect(() => {
    const hasActive = Object.values(memberRestTimers).some((value) => value > 0);
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      setMemberRestTimers((prev) => {
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([key, value]) => {
          next[key] = value > 0 ? value - 1 : 0;
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [memberRestTimers]);

  function handleLogin() {
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === loginEmail.trim().toLowerCase() && user.password === loginPassword);
    if (!matchedUser) {
      setLoginError("Feil e-post eller passord.");
      return;
    }
    const { password: _password, ...safeUser } = matchedUser;
    setCurrentUser(safeUser);
    setRole(safeUser.role);
    setLoginError(null);
    if (safeUser.role === "member" && safeUser.memberId) {
      setMemberViewId(safeUser.memberId);
      setSelectedMemberId(safeUser.memberId);
      setMemberTab("overview");
    }
    if (safeUser.role === "trainer") {
      setTrainerTab("dashboard");
    }
  }

  function handleQuickLogin(email: string) {
    setLoginEmail(email);
    setLoginPassword("123456");
    const matchedUser = demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
    if (!matchedUser) return;
    const { password: _password, ...safeUser } = matchedUser;
    setCurrentUser(safeUser);
    setRole(safeUser.role);
    setLoginError(null);
    if (safeUser.role === "member" && safeUser.memberId) {
      setMemberViewId(safeUser.memberId);
      setSelectedMemberId(safeUser.memberId);
      setMemberTab("overview");
    }
    if (safeUser.role === "trainer") {
      setTrainerTab("dashboard");
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError(null);
  }

  function resetAllDemoData() {
    setMembers(initialMembers);
    setExercises(initialExercises);
    setPrograms(initialPrograms);
    setTemplates(initialTemplates);
    setSchedule(initialSchedule);
    setLogs(initialLogs);
    setMessages(initialMessages);
    setMemberWorkoutDrafts({});
    setMemberProgramSteps({});
    setMemberRestTimers({});
    setCelebrationMessage(null);
    setPendingAdvanceAfterCelebration(null);
    setSelectedMemberId(initialMembers[0]?.id ?? "");
    setMemberViewId(initialMembers[0]?.id ?? "");
    if (typeof window !== "undefined") {
      [
        "motus_members",
        "motus_exercises",
        "motus_programs",
        "motus_templates",
        "motus_schedule",
        "motus_logs",
        "motus_messages",
      ].forEach((key) => window.localStorage.removeItem(key));
    }
    if (supabase) {
      void supabase.from("app_state").delete().eq("id", APP_STATE_ROW_ID);
    }
  }

  function dismissCelebration() {
    setCelebrationMessage(null);
    if (pendingAdvanceAfterCelebration) {
      setMemberProgramSteps((prev) => ({ ...prev, [pendingAdvanceAfterCelebration.programId]: pendingAdvanceAfterCelebration.nextStep }));
      setPendingAdvanceAfterCelebration(null);
    }
  }

  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;
  const viewedMember = members.find((member) => member.id === memberViewId) ?? null;

  const trainerProgramsForSelected = programs.filter((program) => program.memberId === selectedMemberId);
  const trainerLogsForSelected = logs.filter((log) => log.memberId === selectedMemberId);
  const trainerMessagesForSelected = messages.filter((message) => message.memberId === selectedMemberId);
  const trainerScheduleForSelected = schedule.filter((item) => item.memberId === selectedMemberId);

  const memberPrograms = programs.filter((program) => program.memberId === memberViewId);
  const memberLogs = logs.filter((log) => log.memberId === memberViewId);
  const memberMessages = messages.filter((message) => message.memberId === memberViewId);

  function resetExerciseForm() {
    setExerciseName("");
    setExerciseEquipment("");
    setExerciseGroup("Bein");
    setExerciseLevel("Nybegynner");
    setExerciseImageUrl("");
    setExercisePrimaryMuscles("");
    setExerciseCoachingTips("");
    setExerciseTechnicalNotes("");
    setEditingExerciseId(null);
  }

  function startEditExercise(exerciseId: string) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setEditingExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setExerciseGroup(exercise.group);
    setExerciseEquipment(exercise.equipment);
    setExerciseLevel(exercise.level);
    setExerciseImageUrl(exercise.imageUrl || "");
    setExercisePrimaryMuscles(exercise.primaryMuscles || "");
    setExerciseCoachingTips(exercise.coachingTips || "");
    setExerciseTechnicalNotes(exercise.technicalNotes || "");
    setTrainerTab("exerciseBank");
  }

  function cancelEditExercise() {
    resetExerciseForm();
  }

  function saveExerciseBankEntry() {
    if (!exerciseName.trim() || !exerciseEquipment.trim()) return;
    const payload: Exercise = {
      id: editingExerciseId || uid("exercise"),
      name: exerciseName.trim(),
      group: exerciseGroup,
      equipment: exerciseEquipment.trim(),
      level: exerciseLevel,
      imageUrl: exerciseImageUrl.trim(),
      primaryMuscles: exercisePrimaryMuscles.trim(),
      coachingTips: exerciseCoachingTips.trim(),
      technicalNotes: exerciseTechnicalNotes.trim(),
      favorite: exercises.find((item) => item.id === editingExerciseId)?.favorite,
    };
    if (editingExerciseId) {
      setExercises((prev) => prev.map((item) => (item.id === editingExerciseId ? payload : item)));
    } else {
      setExercises((prev) => [payload, ...prev]);
    }
    resetExerciseForm();
  }

  function addExerciseToProgram(exercise: Exercise) {
    setProgramExercises((prev) => [
      ...prev,
      {
        id: uid("pe"),
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

  function moveExercise(id: string, direction: "up" | "down") {
    setProgramExercises((prev) => {
      const index = prev.findIndex((e) => e.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }

  function toggleFavorite(exId: string) {
    setExercises((prev) => prev.map((e) => (e.id === exId ? { ...e, favorite: !e.favorite } : e)));
  }

  function updateProgramExercise(id: string, field: keyof ProgramExercise, value: string) {
    setProgramExercises((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeProgramExercise(id: string) {
    setProgramExercises((prev) => prev.filter((item) => item.id !== id));
  }

  function useTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setProgramTitle(template.title);
    setProgramGoal(template.goal);
    setProgramNotes(template.notes);
    setProgramExercises(template.exercises.map((exercise) => ({ ...exercise, id: uid("pe") })));
    setTrainerTab("customers");
  }

  function saveAsTemplate() {
    if (!programTitle.trim() || programExercises.length === 0) return;
    const newTemplate: ProgramTemplate = {
      id: uid("tpl"),
      title: programTitle,
      goal: programGoal,
      notes: programNotes,
      level: "Nybegynner",
      exercises: programExercises,
    };
    setTemplates((prev) => [newTemplate, ...prev]);
  }

  function toggleTemplateFavorite(id: string) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));
  }

  function assignTemplateToMember(templateId: string, memberId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const nextProgram: TrainingProgram = {
      id: uid("program"),
      memberId,
      title: template.title,
      goal: template.goal,
      notes: template.notes,
      createdAt: new Date().toLocaleDateString("no-NO"),
      exercises: template.exercises.map((exercise) => ({ ...exercise, id: uid("pe") })),
    };
    setPrograms((prev) => [nextProgram, ...prev]);
    setSelectedMemberId(memberId);
    setSelectedProgramIdForLog(nextProgram.id);
    setTrainerTab("customers");
  }

  function saveProgram() {
    if (!selectedMember || !programTitle.trim() || programExercises.length === 0) return;
    const nextProgram: TrainingProgram = {
      id: uid("program"),
      memberId: selectedMember.id,
      title: programTitle.trim(),
      goal: programGoal.trim(),
      notes: programNotes.trim(),
      createdAt: new Date().toLocaleDateString("no-NO"),
      exercises: programExercises,
    };
    setPrograms((prev) => [nextProgram, ...prev]);
    setSelectedProgramIdForLog(nextProgram.id);
    setProgramTitle("Nytt treningsprogram");
    setProgramGoal("");
    setProgramNotes("");
    setProgramExercises([]);
  }

  function addScheduleItem() {
    if (!selectedMember || !scheduleTitle.trim()) return;
    const nextItem: ScheduleItem = { id: uid("schedule"), memberId: selectedMember.id, day: scheduleDay, title: scheduleTitle.trim(), focus: scheduleFocus.trim() || "Ikke satt" };
    setSchedule((prev) => [...prev, nextItem]);
    setScheduleTitle("");
    setScheduleFocus("");
  }

  function removeScheduleItem(id: string) {
    setSchedule((prev) => prev.filter((item) => item.id !== id));
  }

  function createDraftWorkoutLog() {
    setDraftLogStatusText(`Draft opprettet for ${selectedProgramIdForLog || "valgt program"} på ${logDate}.`);
  }

  function saveDraftAsPlanned() {
    if (!selectedMember) return;
    const templateProgram = trainerProgramsForSelected.find((program) => program.id === selectedProgramIdForLog);
    setLogs((prev) => [{
      id: uid("log"),
      memberId: selectedMember.id,
      programTitle: templateProgram?.title || "Program",
      date: logDate,
      status: "Planlagt",
      note: "Lagt inn fra PT-portalen.",
      loggedExercises: (templateProgram?.exercises || []).map((exercise) => {
        const sets = Number(exercise.sets) || 0;
        const reps = Number((exercise.reps.split("-")[0] || exercise.reps).trim()) || 0;
        const weight = Number(exercise.weight) || 0;
        return { id: uid("logged-exercise"), exerciseName: exercise.exerciseName, sets, reps, weight, volume: sets * reps * weight };
      }),
    }, ...prev]);
    setDraftLogStatusText("Lagret som planlagt.");
  }

  function saveDraftAsCompleted() {
    if (!selectedMember) return;
    const templateProgram = trainerProgramsForSelected.find((program) => program.id === selectedProgramIdForLog);
    setLogs((prev) => [{
      id: uid("log"),
      memberId: selectedMember.id,
      programTitle: templateProgram?.title || "Program",
      date: logDate,
      status: "Fullført",
      note: "Registrert som fullført fra PT-portalen.",
      loggedExercises: (templateProgram?.exercises || []).map((exercise) => {
        const sets = Number(exercise.sets) || 0;
        const reps = Number((exercise.reps.split("-")[0] || exercise.reps).trim()) || 0;
        const weight = Number(exercise.weight) || 0;
        return { id: uid("logged-exercise"), exerciseName: exercise.exerciseName, sets, reps, weight, volume: sets * reps * weight };
      }),
    }, ...prev]);
    setDraftLogStatusText("Lagret som fullført.");
  }

  function sendTrainerMessage() {
    if (!selectedMember || !trainerMessage.trim()) return;
    setMessages((prev) => [...prev, { id: uid("msg"), memberId: selectedMember.id, sender: "trainer", text: trainerMessage.trim(), createdAt: "Nå" }]);
    setTrainerMessage("");
  }

  function ensureMemberWorkoutDraft(program: TrainingProgram) {
    setMemberWorkoutDrafts((prev) => {
      if (prev[program.id]) return prev;
      return {
        ...prev,
        [program.id]: Object.fromEntries(
          program.exercises.map((exercise) => [exercise.id, {
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            completed: false,
            setRows: createDefaultSetRows(exercise.sets, exercise.reps, exercise.weight),
          }])
        ),
      };
    });
  }

  function toggleWorkoutExerciseCompleted(program: TrainingProgram, exerciseId: string) {
    setMemberWorkoutDrafts((prev) => ({
      ...prev,
      [program.id]: {
        ...(prev[program.id] ?? {}),
        [exerciseId]: {
          ...((prev[program.id] ?? {})[exerciseId] ?? { sets: "", reps: "", weight: "", completed: false, setRows: [] }),
          completed: !((prev[program.id] ?? {})[exerciseId]?.completed),
        },
      },
    }));
  }

  function startRestTimer(program: TrainingProgram, exercise: ProgramExercise) {
    const key = `${program.id}::${exercise.id}`;
    setMemberRestTimers((prev) => ({ ...prev, [key]: Number(exercise.restSeconds || 0) || 0 }));
  }

  function startMemberWorkout(program: TrainingProgram) {
    ensureMemberWorkoutDraft(program);
    setMemberProgramSteps((prev) => ({ ...prev, [program.id]: 0 }));
  }

  function updateMemberWorkoutDraft(program: TrainingProgram, exerciseId: string, field: keyof MemberWorkoutDraftValue, value: string) {
    setMemberWorkoutDrafts((prev) => {
      const existing = (prev[program.id] ?? {})[exerciseId];
      const programExercise = program.exercises.find((exercise) => exercise.id === exerciseId);
      const base = existing ?? {
        sets: programExercise?.sets ?? "1",
        reps: programExercise?.reps ?? "",
        weight: programExercise?.weight ?? "",
        completed: false,
        setRows: createDefaultSetRows(programExercise?.sets ?? "1", programExercise?.reps ?? "", programExercise?.weight ?? ""),
      };
      const nextValue = { ...base, [field]: value } as MemberWorkoutDraftValue;
      if (field === "sets") {
        nextValue.setRows = normalizeSetRowsLength(base.setRows, value, base.reps, base.weight);
      }
      return {
        ...prev,
        [program.id]: {
          ...(prev[program.id] ?? {}),
          [exerciseId]: nextValue,
        },
      };
    });
  }

  function updateMemberWorkoutSetRow(programId: string, exerciseId: string, setIndex: number, field: keyof WorkoutSetRow, value: string) {
    setMemberWorkoutDrafts((prev) => {
      const existing = (prev[programId] ?? {})[exerciseId];
      if (!existing) return prev;
      const nextRows = [...(existing.setRows ?? [])];
      const currentRow = nextRows[setIndex] ?? { kg: "", reps: "" };
      nextRows[setIndex] = { ...currentRow, [field]: value };
      const primaryRow = nextRows.find((row) => (Number(row.kg) || 0) > 0 || (Number(row.reps) || 0) > 0) ?? nextRows[0] ?? { kg: "", reps: "" };
      return {
        ...prev,
        [programId]: {
          ...(prev[programId] ?? {}),
          [exerciseId]: {
            ...existing,
            weight: primaryRow.kg,
            reps: primaryRow.reps,
            setRows: nextRows,
            sets: String(nextRows.length),
          },
        },
      };
    });
  }

  function addMemberWorkoutSet(programId: string, exerciseId: string) {
    setMemberWorkoutDrafts((prev) => {
      const existing = (prev[programId] ?? {})[exerciseId];
      if (!existing) return prev;
      const nextRows = addSetRow(existing.setRows ?? [], existing.reps, existing.weight);
      return {
        ...prev,
        [programId]: {
          ...(prev[programId] ?? {}),
          [exerciseId]: {
            ...existing,
            setRows: nextRows,
            sets: String(nextRows.length),
          },
        },
      };
    });
  }

  function removeMemberWorkoutSet(programId: string, exerciseId: string, index: number) {
    setMemberWorkoutDrafts((prev) => {
      const existing = (prev[programId] ?? {})[exerciseId];
      if (!existing) return prev;
      const nextRows = removeSetRow(existing.setRows ?? [], index);
      const primaryRow = nextRows.find((row) => (Number(row.kg) || 0) > 0 || (Number(row.reps) || 0) > 0) ?? nextRows[0] ?? { kg: "", reps: "" };
      return {
        ...prev,
        [programId]: {
          ...(prev[programId] ?? {}),
          [exerciseId]: {
            ...existing,
            weight: primaryRow.kg,
            reps: primaryRow.reps,
            setRows: nextRows,
            sets: String(nextRows.length),
          },
        },
      };
    });
  }

  function getPreviousBest1RM(memberId: string, exerciseName: string) {
    return logs
      .filter((log) => log.memberId === memberId && log.status === "Fullført")
      .flatMap((log) => log.loggedExercises ?? [])
      .filter((exercise) => exercise.exerciseName === exerciseName)
      .reduce((best, exercise) => Math.max(best, exercise.estimated1RM ?? estimate1RM(exercise.weight, exercise.reps)), 0);
  }

  function goToPreviousWorkoutExercise(program: TrainingProgram) {
    setMemberProgramSteps((prev) => ({ ...prev, [program.id]: Math.max(0, (prev[program.id] ?? 0) - 1) }));
  }

  function goToNextWorkoutExercise(program: TrainingProgram) {
    if (!viewedMember) return;
    const currentIndex = memberProgramSteps[program.id] ?? 0;
    const currentExercise = program.exercises[currentIndex];
    const currentDraft = memberWorkoutDrafts[program.id]?.[currentExercise.id] ?? { sets: currentExercise.sets, reps: currentExercise.reps, weight: currentExercise.weight, completed: false, setRows: createDefaultSetRows(currentExercise.sets, currentExercise.reps, currentExercise.weight) };
    const setRows = currentDraft.setRows ?? [];
    const bestSetEstimate = setRows.reduce((best, row) => {
      const reps = Number(row.reps) || 0;
      const weight = Number(row.kg) || 0;
      return Math.max(best, estimate1RM(weight, reps));
    }, 0);
    const fallbackReps = Number((currentDraft.reps.split("-")[0] || currentDraft.reps).trim()) || 0;
    const fallbackWeight = Number(currentDraft.weight) || 0;
    const estimated1RM = bestSetEstimate || estimate1RM(fallbackWeight, fallbackReps);
    const previousBest = getPreviousBest1RM(viewedMember.id, currentExercise.exerciseName);
    const nextStep = Math.min(program.exercises.length - 1, currentIndex + 1);
    if (estimated1RM > previousBest && currentIndex < program.exercises.length - 1) {
      setCelebrationMessage(`${currentExercise.exerciseName}: ny rekord! Fra ${Math.round(previousBest)} kg til ${Math.round(estimated1RM)} kg estimert 1RM`);
      setPendingAdvanceAfterCelebration({ programId: program.id, nextStep });
      return;
    }
    setMemberProgramSteps((prev) => ({ ...prev, [program.id]: nextStep }));
  }

  function completeMemberWorkout(program: TrainingProgram) {
    if (!viewedMember) return;
    const previousBestByExercise = logs
      .filter((log) => log.memberId === viewedMember.id && log.status === "Fullført")
      .flatMap((log) => log.loggedExercises ?? [])
      .reduce<Record<string, number>>((acc, exercise) => {
        const est = exercise.estimated1RM ?? estimate1RM(exercise.weight, exercise.reps);
        acc[exercise.exerciseName] = Math.max(acc[exercise.exerciseName] ?? 0, est);
        return acc;
      }, {});

    const draft = memberWorkoutDrafts[program.id] ?? {};
    const loggedExercises: LoggedExercise[] = program.exercises.map((exercise) => {
      const values = draft[exercise.id] ?? { sets: exercise.sets, reps: exercise.reps, weight: exercise.weight, completed: false, setRows: createDefaultSetRows(exercise.sets, exercise.reps, exercise.weight) };
      const safeSetRows = values.setRows ?? [];
      const filledSetRows = safeSetRows.filter((row) => (Number(row.kg) || 0) > 0 || (Number(row.reps) || 0) > 0);
      const sets = filledSetRows.length || Number(values.sets) || 0;
      const reps = filledSetRows.length ? Math.max(...filledSetRows.map((row) => Number(row.reps) || 0)) : Number((values.reps.split("-")[0] || values.reps).trim()) || 0;
      const actualWeight = filledSetRows.length ? Math.max(...filledSetRows.map((row) => Number(row.kg) || 0)) : Number(values.weight) || 0;
      const volume = filledSetRows.length ? filledSetRows.reduce((sum, row) => sum + (Number(row.kg) || 0) * (Number(row.reps) || 0), 0) : sets * reps * actualWeight;
      const estimated1RM = filledSetRows.length ? filledSetRows.reduce((best, row) => Math.max(best, estimate1RM(Number(row.kg) || 0, Number(row.reps) || 0)), 0) : estimate1RM(actualWeight, reps);
      const previousBest1RM = previousBestByExercise[exercise.exerciseName] ?? 0;
      return {
        id: uid("logged-exercise"),
        exerciseName: exercise.exerciseName,
        sets,
        reps,
        weight: actualWeight,
        volume,
        setRows: safeSetRows,
        estimated1RM,
        previousBest1RM,
        isPR: estimated1RM > previousBest1RM,
      };
    });

    const newRecords = loggedExercises.filter((exercise) => exercise.isPR).map((exercise) => `${exercise.exerciseName}: fra ${Math.round(exercise.previousBest1RM ?? 0)} kg til ${Math.round(exercise.estimated1RM ?? 0)} kg estimert 1RM`);

    const savedWorkout: WorkoutLog = {
      id: uid("log"),
      memberId: viewedMember.id,
      programTitle: program.title,
      date: new Date().toLocaleDateString("no-NO"),
      status: "Fullført",
      note: "Logget av medlem i appen.",
      loggedExercises,
    };

    setLogs((prev) => [savedWorkout, ...prev]);
    setMembers((prev) => prev.map((member) => member.id === viewedMember.id ? { ...member, daysSinceActivity: "0" } : member));
    setMemberWorkoutDrafts((prev) => {
      const next = { ...prev };
      delete next[program.id];
      return next;
    });
    setMemberProgramSteps((prev) => {
      const next = { ...prev };
      delete next[program.id];
      return next;
    });
    if (newRecords.length > 0) {
      setCelebrationMessage(newRecords.length === 1 ? newRecords[0] : `${newRecords.length} nye rekorder! ${newRecords.join(" · ")}`);
    }
    setMemberTab("progress");
  }

  function sendMemberMessage() {
    if (!viewedMember || !memberMessage.trim()) return;
    setMessages((prev) => [...prev, { id: uid("msg"), memberId: viewedMember.id, sender: "member", text: memberMessage.trim(), createdAt: "Nå" }]);
    setMemberMessage("");
  }

  function addMember() {
    const number = members.length + 1;
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
    setMembers((prev) => [...prev, nextMember]);
  }

  function updateSelectedMemberField(field: keyof Member, value: string) {
    if (!selectedMember) return;
    setMembers((prev) => prev.map((member) => (member.id === selectedMember.id ? { ...member, [field]: value } : member)));
  }

  return (
    <AppShell>
      {!currentUser ? (
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
                <Badge>{currentUser.role === "trainer" ? "PT" : "Medlem"}</Badge>
                <Badge>{currentUser.name}</Badge>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Motus PT-app</h1>
                <p className="mt-2 text-sm md:text-base text-slate-500 max-w-3xl">PT og medlem i samme app, med egen kundefane og kundekort for treneren.</p>
                <div className="mt-2 text-xs text-slate-400">{supabaseSyncStatus}</div>
              </div>
            </div>
            <Card className="p-1 w-full md:w-auto self-stretch md:self-auto">
              <div className="grid w-full grid-cols-2 md:w-[280px] gap-1 rounded-2xl bg-slate-50 p-1">
                <PillButton active={role === "trainer"} onClick={() => {
                  const trainerUser = demoUsers.find((user) => user.role === "trainer");
                  if (!trainerUser) return;
                  const { password: _password, ...safeUser } = trainerUser;
                  setCurrentUser(safeUser);
                  setRole("trainer");
                  setTrainerTab("dashboard");
                }}>PT-side</PillButton>
                <PillButton active={role === "member"} onClick={() => {
                  if (currentUser.role === "member") {
                    setRole("member");
                    setMemberTab("overview");
                    return;
                  }
                  const firstMemberUser = demoUsers.find((user) => user.role === "member");
                  if (!firstMemberUser) return;
                  const { password: _password, ...safeUser } = firstMemberUser;
                  setCurrentUser(safeUser);
                  setRole("member");
                  if (safeUser.memberId) {
                    setMemberViewId(safeUser.memberId);
                    setSelectedMemberId(safeUser.memberId);
                  }
                  setMemberTab("overview");
                }}>Medlemsside</PillButton>
              </div>
            </Card>
            <div className="flex flex-col gap-2 sm:flex-row">
              <OutlineButton onClick={resetAllDemoData}>Nullstill testdata</OutlineButton>
              <OutlineButton onClick={handleLogout}>Logg ut</OutlineButton>
            </div>
          </div>
        </Card>

        {role === "trainer" ? (
          <TrainerPortal
            celebrationMessage={celebrationMessage}
            dismissCelebration={dismissCelebration}
            saveAsTemplate={saveAsTemplate}
            toggleTemplateFavorite={toggleTemplateFavorite}
            moveExercise={moveExercise}
            toggleFavorite={toggleFavorite}
            setProgramExercises={setProgramExercises}
            members={members}
            selectedMember={selectedMember}
            selectedMemberId={selectedMemberId}
            setSelectedMemberId={setSelectedMemberId}
            trainerTab={trainerTab}
            setTrainerTab={setTrainerTab}
            trainerProgramsForSelected={trainerProgramsForSelected}
            trainerLogsForSelected={trainerLogsForSelected}
            trainerMessagesForSelected={trainerMessagesForSelected}
            trainerScheduleForSelected={trainerScheduleForSelected}
            allPrograms={programs}
            allLogs={logs}
            allMessages={messages}
            templates={templates}
            useTemplate={useTemplate}
            assignTemplateToMember={assignTemplateToMember}
            exercises={exercises}
            exerciseName={exerciseName}
            setExerciseName={setExerciseName}
            exerciseGroup={exerciseGroup}
            setExerciseGroup={setExerciseGroup}
            exerciseEquipment={exerciseEquipment}
            setExerciseEquipment={setExerciseEquipment}
            exerciseLevel={exerciseLevel}
            setExerciseLevel={setExerciseLevel}
            exerciseImageUrl={exerciseImageUrl}
            setExerciseImageUrl={setExerciseImageUrl}
            exercisePrimaryMuscles={exercisePrimaryMuscles}
            setExercisePrimaryMuscles={setExercisePrimaryMuscles}
            exerciseCoachingTips={exerciseCoachingTips}
            setExerciseCoachingTips={setExerciseCoachingTips}
            exerciseTechnicalNotes={exerciseTechnicalNotes}
            setExerciseTechnicalNotes={setExerciseTechnicalNotes}
            editingExerciseId={editingExerciseId}
            startEditExercise={startEditExercise}
            cancelEditExercise={cancelEditExercise}
            saveExerciseBankEntry={saveExerciseBankEntry}
            exerciseSearch={exerciseSearch}
            setExerciseSearch={setExerciseSearch}
            programTitle={programTitle}
            setProgramTitle={setProgramTitle}
            programGoal={programGoal}
            setProgramGoal={setProgramGoal}
            programNotes={programNotes}
            setProgramNotes={setProgramNotes}
            programExercises={programExercises}
            addExerciseToProgram={addExerciseToProgram}
            updateProgramExercise={updateProgramExercise}
            removeProgramExercise={removeProgramExercise}
            saveProgram={saveProgram}
            scheduleDay={scheduleDay}
            setScheduleDay={setScheduleDay}
            scheduleTitle={scheduleTitle}
            setScheduleTitle={setScheduleTitle}
            scheduleFocus={scheduleFocus}
            setScheduleFocus={setScheduleFocus}
            addScheduleItem={addScheduleItem}
            removeScheduleItem={removeScheduleItem}
            selectedProgramIdForLog={selectedProgramIdForLog}
            setSelectedProgramIdForLog={setSelectedProgramIdForLog}
            logDate={logDate}
            setLogDate={setLogDate}
            createDraftWorkoutLog={createDraftWorkoutLog}
            draftLogStatusText={draftLogStatusText}
            saveDraftAsPlanned={saveDraftAsPlanned}
            saveDraftAsCompleted={saveDraftAsCompleted}
            trainerMessage={trainerMessage}
            setTrainerMessage={setTrainerMessage}
            sendTrainerMessage={sendTrainerMessage}
            addMember={addMember}
            updateSelectedMemberField={updateSelectedMemberField}
          />
        ) : (
          <MemberPortal
            members={members}
            memberViewId={memberViewId}
            setMemberViewId={setMemberViewId}
            viewedMember={viewedMember}
            memberPrograms={memberPrograms}
            memberLogs={memberLogs}
            memberMessages={memberMessages}
            memberTab={memberTab}
            setMemberTab={setMemberTab}
            memberMessage={memberMessage}
            setMemberMessage={setMemberMessage}
            sendMemberMessage={sendMemberMessage}
            celebrationMessage={celebrationMessage}
            dismissCelebration={dismissCelebration}
            memberWorkoutDrafts={memberWorkoutDrafts}
            memberProgramSteps={memberProgramSteps}
            memberRestTimers={memberRestTimers}
            startMemberWorkout={startMemberWorkout}
            updateMemberWorkoutDraft={updateMemberWorkoutDraft}
            updateMemberWorkoutSetRow={updateMemberWorkoutSetRow}
            addMemberWorkoutSet={addMemberWorkoutSet}
            removeMemberWorkoutSet={removeMemberWorkoutSet}
            toggleWorkoutExerciseCompleted={toggleWorkoutExerciseCompleted}
            startRestTimer={startRestTimer}
            goToPreviousWorkoutExercise={goToPreviousWorkoutExercise}
            goToNextWorkoutExercise={goToNextWorkoutExercise}
            completeMemberWorkout={completeMemberWorkout}
            updateViewedMemberField={(field, value) => {
              if (!viewedMember) return;
              setMembers((prev) => prev.map((member) => (member.id === viewedMember.id ? { ...member, [field]: value } : member)));
            }}
          />
        )}
      </div>
      )}
    </AppShell>
  );
}

