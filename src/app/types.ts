export type Role = "trainer" | "member";
export type Level = "Nybegynner" | "Litt øvet" | "Øvet";
export type MembershipType = "Standard" | "Premium";
export type CustomerType = "PT-kunde" | "Oppfølging" | "Egentrening";
export type TrainerTab =
  | "dashboard"
  | "customers"
  | "programs"
  | "exerciseBank"
  | "admin"
  | "calendar"
  | "messages"
  | "statistics"
  | "settings";
export type CustomerSubTab = "overview" | "profile" | "programs" | "workouts" | "messages";
export type MemberTab = "overview" | "programs" | "progress" | "messages" | "profile";

export type WorkoutExerciseResult = {
  exerciseId: string;
  programExerciseId?: string;
  setNumber?: number;
  exerciseName: string;
  exerciseCategory?: Exercise["category"];
  exerciseEquipment?: string;
  plannedSets: string;
  plannedReps: string;
  plannedWeight: string;
  plannedDurationMinutes?: string;
  plannedSpeed?: string;
  plannedIncline?: string;
  performedWeight: string;
  performedReps: string;
  performedDurationMinutes?: string;
  performedSpeed?: string;
  performedIncline?: string;
  completed: boolean;
};

export type WorkoutModeState = {
  programId: string;
  results: WorkoutExerciseResult[];
  note: string;
};

export type WorkoutCelebration = {
  memberId: string;
  exerciseName: string;
  previousEstimated1RM: number;
  newEstimated1RM: number;
  reps: number;
  weight: number;
};

export type WorkoutReflection = {
  energyLevel: 1 | 2 | 3 | 4 | 5;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  motivationLevel: 1 | 2 | 3 | 4 | 5;
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
  avatarUrl?: string;
  isActive: boolean;
  invitedAt: string;
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
  category: "Styrke" | "Kondisjon" | "Uttøyning";
  group: string;
  equipment: string;
  level: Level;
  description: string;
  imageUrl?: string;
  favorite?: boolean;
};

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: string;
  reps: string;
  weight: string;
  durationMinutes?: string;
  speed?: string;
  incline?: string;
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
  reflection?: WorkoutReflection;
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
  workoutCelebration: WorkoutCelebration | null;
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
