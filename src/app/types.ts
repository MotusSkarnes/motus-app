import type { ChatReactionState } from "./chatReactions";
import type { MemberGender } from "./memberGender";
import type { TrainerVacation } from "./trainerProfile";

export type Role = "trainer" | "member";
export type Level = "Nybegynner" | "Litt øvet" | "Øvet";
export type MembershipType = "Standard" | "Premium";
export type CustomerType = "PT-kunde" | "Oppfølging" | "Egentrening" | "Medlem";
export type TrainerTab =
  | "dashboard"
  | "customers"
  | "calendar"
  | "programs"
  | "exerciseBank"
  | "admin"
  | "inspiration"
  | "nutrition"
  | "mealPlan"
  | "badges"
  | "statistics"
  | "settings";
export type CustomerSubTab = "overview" | "profile" | "programs" | "workouts" | "messages" | "nutrition";

/** Vist på klientfane-raden i trenervisning (Klienter → valgt kunde). */
export const CUSTOMER_NUTRITION_TAB_LABEL = "Ernæring";
export type MemberTab = "overview" | "programs" | "progress" | "messages" | "profile" | "inspiration" | "nutrition";

export type ExerciseBlockType = "superset" | "triset" | "circuit";

export type WorkoutExerciseResult = {
  exerciseId: string;
  programExerciseId?: string;
  setNumber?: number;
  /** Felles id for supersett/trisett/sirkel i øktmodus. */
  blockId?: string;
  blockType?: ExerciseBlockType;
  blockRound?: number;
  exerciseName: string;
  exerciseCategory?: Exercise["category"];
  exerciseEquipment?: string;
  plannedSets: string;
  plannedRepsUnit?: "reps" | "minutes";
  plannedReps: string;
  plannedWeightUnit?: "kg" | "seconds";
  plannedWeight: string;
  plannedDurationMinutes?: string;
  plannedSpeed?: string;
  plannedIncline?: string;
  plannedDistanceKm?: string;
  plannedHeartRate?: string;
  plannedCustom1?: string;
  plannedCustom2?: string;
  /** Kondisjon logg-etter: hvilke felt som vises i øktmodus. */
  logFieldKeys?: ExercisePrescriptionFieldKey[];
  customField1Label?: string;
  customField2Label?: string;
  performedWeight: string;
  /** Midlertidig enhetsvalg i live-økt for styrke (kg/sek). */
  performedLoadUnit?: "kg" | "sec";
  performedReps: string;
  performedDurationMinutes?: string;
  performedSpeed?: string;
  performedIncline?: string;
  performedDistanceKm?: string;
  performedHeartRate?: string;
  performedCustom1?: string;
  performedCustom2?: string;
  completed: boolean;
  /** Valgfri kommentar til øvelsen (lagres på alle sett for samme programExerciseId). */
  exerciseNote?: string;
  /** Satt til true når sett er lagt til med «Legg til sett» under pågående økt. */
  addedDuringWorkout?: boolean;
};

export type WorkoutModeState = {
  programId: string;
  memberId?: string;
  programTitle?: string;
  results: WorkoutExerciseResult[];
  note: string;
  /** Antall sett per programExerciseId da økten startet (før ekstra sett underveis). */
  baselineSetCountByProgramExerciseId?: Record<string, number>;
  /** Plan-tekst per programExerciseId, fryst ved øktstart (endres ikke ved «Legg til sett»). */
  frozenPlanLabelByProgramExerciseId?: Record<string, string>;
  /** Plan vist i økt — satt ved start, endres aldri under økta (nøkkel = groupId / programExerciseId). */
  planDisplayByGroupId?: Record<string, string>;
  /** Antall planlagte sett ved start per groupId / programExerciseId. */
  plannedSetCountAtStartByGroupId?: Record<string, number>;
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
  ownerUserId?: string;
  /** Fornavn på PT (fra owner_user_id), satt ved hydrate-member-data. */
  assignedTrainerName?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isActive: boolean;
  archiveScheduledFor?: string;
  invitedAt: string;
  /** Første gang medlem logget inn i appen (link-member-auth). */
  firstLoginAt: string;
  phone: string;
  birthDate: string;
  /** PT-definert — brukes til personlige næringsreferanser (female | male). */
  gender: MemberGender;
  weight: string;
  height: string;
  level: Level;
  membershipType: MembershipType;
  customerType: CustomerType;
  /** PT aktiverer — medlem får fanen Ernæring og matplan. */
  nutritionAccess?: boolean;
  daysSinceActivity: string;
  goal: string;
  focus: string;
  personalGoals: string;
  injuries: string;
  coachNotes: string;
  /** PT sitt «Ingen plan i dag»-forsidebilde (fra hydrate-member-data). */
  noPlanDayCoverImageUrl?: string;
  /** PT sin ferieinfo (fra hydrate-member-data). */
  trainerVacation?: TrainerVacation;
};

/** Variabler PT kan konfigurere per øvelse i øvelsesbanken. */
export type ExercisePrescriptionFieldKey =
  | "minutes"
  | "seconds"
  | "kg"
  | "reps"
  | "pause"
  | "seatSettings"
  | "distance"
  | "heartRate"
  | "speed"
  | "incline"
  | "custom1"
  | "custom2";

export type Exercise = {
  id: string;
  name: string;
  category: "Styrke" | "Kondisjon" | "Mobilitet" | "Rehab" | "Uttøyning";
  group: string;
  equipment: string;
  level: Level;
  description: string;
  imageUrl?: string;
  /** Eget bilde for PR-kort under Fremgang. Faller tilbake til vanlig øvelsesbilde når tomt. */
  personalRecordImageUrl?: string;
  favorite?: boolean;
  /** Hvilke programfelter som vises når øvelsen legges i et program (tom = standard for kategori). */
  prescriptionFields?: ExercisePrescriptionFieldKey[];
  /** Egendefinert felt 1 — navnet vises i programbygger (f.eks. «Tempo», «ROM»). */
  customField1Label?: string;
  /** Egendefinert felt 2 — navnet vises i programbygger. */
  customField2Label?: string;
};

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: string;
  /** Enhet for volum-feltet (reps/minutter) i styrkeøvelser. */
  repsUnit?: "reps" | "minutes";
  reps: string;
  /** Enhet for belastning-feltet (kg/sekunder) i styrkeøvelser. */
  weightUnit?: "kg" | "seconds";
  weight: string;
  /** Hold/strekk: sekunder per sett (mobilitet, rehab, uttøyning). */
  holdSeconds?: string;
  durationMinutes?: string;
  /** Distanse i km (kondisjon logg etter økt). */
  distanceKm?: string;
  speed?: string;
  incline?: string;
  /** Målpuls som prosent av makspuls (f.eks. 85–90); fritekst. */
  targetHrPercent?: string;
  /** Hvilke verdier medlem skal logge etter økt (kondisjon logg-etter-modus). */
  logFieldKeys?: ExercisePrescriptionFieldKey[];
  /** PT-merket intensitet på kondisjonssteg (fart/stigning/puls fylles inn manuelt). */
  cardioIntensity?: "low" | "medium" | "high";
  /** Maskin: sete/høyde/backrest (fra øvelsesbank «seteinnstillinger»). */
  seatSetting?: string;
  customField1?: string;
  customField2?: string;
  restSeconds: string;
  notes: string;
  /** Supersett, trisett eller sirkel – delt blockId med andre øvelser i samme blokk. */
  blockId?: string;
  blockType?: ExerciseBlockType;
  /** Antall runder i sirkel (valgfritt; ellers høyeste «sett» i blokken). */
  blockRounds?: string;
};

/** Medlemsbibliotek: arkiver fra hovedlisten under «Mine treningsprogram» (synkes via Supabase). «hidden» er legacy. */
export type MemberProgramLibraryStatus = "hidden" | "archived";

export type TrainingProgram = {
  id: string;
  memberId: string;
  title: string;
  goal: string;
  notes: string;
  createdAt: string;
  exercises: ProgramExercise[];
  assignedTrainerName?: string;
  /** auth.users.id for programmets eier (PT ved tildeling, medlem ved eget program). */
  ownerUserId?: string;
  /** Hvem som satte programmet inn i appen (synlig for medlem under Mine programmer). */
  programCreatedBy?: "member" | "trainer";
  programCreatedByName?: string;
  /** Medlem: arkiver fra hovedlisten (ikke sletting). */
  memberLibraryStatus?: MemberProgramLibraryStatus;
  /** Valgfritt forsidebilde på programkort (URL). */
  imageUrl?: string;
  /** Gruppetrening/aktivitetsmal (parsed fra notes, brukes i periodeplan). */
  activityTemplateKind?: "group" | "activity" | "no-plan";
  /** Kondisjonsmal: intervalløkt med timer vs. logg etter økt (parsed fra notes). */
  conditioningDeliveryMode?: "interval" | "logAfter";
  /** Not persisted; removed after økt fullføres eller avbrytes. */
  ephemeral?: boolean;
};

export type WorkoutLog = {
  id: string;
  memberId: string;
  programTitle: string;
  date: string;
  status: "Planlagt" | "Fullført";
  note: string;
  reflection?: WorkoutReflection;
  /** Varighet i minutter (egen aktivitet / annen trening). */
  activityDurationMinutes?: string;
  /** Valgfritt bilde (URL eller komprimert data-URL). */
  activityPhotoUrl?: string;
  trainerComment?: string;
  trainerCommentUpdatedAt?: string;
  trainerCommentAuthorName?: string;
  results?: WorkoutExerciseResult[];
};

export type ChatMessage = {
  id: string;
  memberId: string;
  sender: "trainer" | "member";
  text: string;
  createdAt: string;
  /** Satt når medlem har åpnet chat og sett PT-meldingen. */
  readByMemberAt?: string;
  /** Satt når PT har åpnet chat og sett medlemsmeldingen. */
  readByTrainerAt?: string;
  reactions?: ChatReactionState;
};

export type WeekdayPlanKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type WeeklyDayPlan = Record<WeekdayPlanKey, string>;

export type WeeklySchedulePlan = {
  id: string;
  weekNumber: number;
  days: WeeklyDayPlan;
  /**
   * Merket som «gradient» = denne uken deler samme dagplan som alle andre gradient-merkede uker i perioden.
   * Umerket = egen dagplan for denne uken.
   */
  usesGradientPlan?: boolean;
};

export type PeriodSchedulePlan = {
  id: string;
  title: string;
  notes: string;
  startDate: string;
  weeks: number;
  createdAt: string;
  weeklyPlans: WeeklySchedulePlan[];
  /** Hvem la planen inn i medlemmets bibliotek (inspirasjon = member). */
  periodPlanAddedBy?: "trainer" | "member";
  /** Medlem kan skjule trenerplaner lokalt uten å slette dem hos trener. */
  memberPeriodPlanStatus?: "hidden";
  /** Sist lagret av trener (ISO) – brukes til varsler ved oppdatering. */
  trainerSavedAtIso?: string;
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
