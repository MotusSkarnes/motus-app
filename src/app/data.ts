import type { AppState, AuthUser, ChatMessage, Exercise, Member, TrainingProgram, WorkoutLog } from "./types";

export const MOTUS = {
  turquoise: "#30e3be",
  pink: "#d91278",
  acid: "#daff01",
  paleMint: "#d6fbf1",
  ink: "#0f172a",
};

export const STORAGE_KEY = "motus_pt_app_v2";

export const demoUsers: Array<AuthUser & { password: string }> = [
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

export function getDefaultState(): AppState {
  return {
    workoutMode: null,
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
