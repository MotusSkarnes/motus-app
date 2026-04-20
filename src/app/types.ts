export type Role = "trainer" | "member";
export type Level = "Nybegynner" | "Litt øvet" | "Øvet";
export type MembershipType = "Standard" | "Premium";
export type CustomerType = "PT-kunde" | "Oppfølging" | "Egentrening";
export type TrainerTab = "dashboard" | "customers" | "programs" | "exerciseBank";
export type CustomerSubTab = "overview" | "profile" | "programs" | "messages";
export type MemberTab = "overview" | "programs" | "progress" | "messages" | "profile";

export type WorkoutExerciseResult = {
  exerciseId: string;
  exerciseName: string;
  plannedSets: string;
  plannedReps: string;
  plannedWeight: string;
  performedWeight: string;
  performedReps: string;
  completed: boolean;
};

export type WorkoutModeState = {
  programId: string;
  results: WorkoutExerciseResult[];
  note: string;
};

export type AuthUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
  memberId?: string;
};

export type Member = {
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

export type Exercise = {
  id: string;
  name: string;
  group: string;
  equipment: string;
  level: Level;
  favorite?: boolean;
};

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  restSeconds: string;
  notes: string;
};

export type TrainingProgram = {
  id: string;
  memberId: string;
  title: string;
  goal: string;
  notes: string;
  createdAt: string;
  exercises: ProgramExercise[];
};

export type WorkoutLog = {
  id: string;
  memberId: string;
  programTitle: string;
  date: string;
  status: "Planlagt" | "Fullført";
  note: string;
  results?: WorkoutExerciseResult[];
};

export type ChatMessage = {
  id: string;
  memberId: string;
  sender: "trainer" | "member";
  text: string;
  createdAt: string;
};

export type AppState = {
  workoutMode: WorkoutModeState | null;
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
