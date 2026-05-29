import { filterProgramExercisesAfterBankDelete } from "../app/exerciseBankUsage";
import { isHoldBasedExerciseCategory } from "../app/exerciseCategories";
import { prescriptionFieldsForExerciseSave } from "../app/exercisePrescriptionFields";
import { applyFirstLoginStampToMembersByEmail } from "../app/memberInviteStatus";
import {
  buildTrainingProgramDisplayKey,
  expandProgramExercisesToWorkoutResults,
  normalizeLegacyIntervalCooldownExerciseNames,
  normalizeMemberLibraryStatus,
  workoutResultGroupId,
} from "../app/programBlocks";
import { uid } from "../app/storage";
import { toggleReactionInState, type ChatReactionActor, type ChatReactionEmoji } from "../app/chatReactions";
import type {
  AppState,
  ChatMessage,
  Exercise,
  Member,
  MemberProgramLibraryStatus,
  ProgramExercise,
  TrainingProgram,
  WorkoutCelebration,
  WorkoutExerciseResult,
  WorkoutLog,
  WorkoutReflection,
} from "../app/types";
import {
  formatDateDdMmYyyy,
  formatDateTimeDdMmYyyy,
  normalizeStoredLogDate,
  resolveWorkoutLogDateTime,
  storedLogDatesMatch,
} from "../app/dateFormat";

export type CreateMemberResult = { ok: true; member: Member } | { ok: false; message: string };

export type CreateMemberInput = {
  name: string;
  email: string;
  phone?: string;
  goal?: string;
  focus?: string;
  membershipType?: Member["membershipType"];
  customerType?: Member["customerType"];
  nutritionAccess?: boolean;
};

export type SaveProgramInput = {
  id?: string;
  title: string;
  goal: string;
  notes: string;
  memberId: string;
  exercises: ProgramExercise[];
  imageUrl?: string;
  programCreatedBy?: "member" | "trainer";
  programCreatedByName?: string;
  onPersisted?: (result: { ok: boolean; message?: string; ids?: string[] }) => void;
};

export type PersistResult = { ok: boolean; message?: string; ids?: string[] };

export type DeleteProgramContext = {
  memberIds?: string[];
  targetEmail?: string;
  targetName?: string;
  requestedBy?: "member" | "trainer";
};

export type UpdateWorkoutResultInput = {
  exerciseId: string;
  field:
    | "performedWeight"
    | "performedReps"
    | "performedDurationMinutes"
    | "performedSpeed"
    | "performedIncline"
    | "performedLoadUnit"
    | "completed";
  value: string | boolean;
};

export type FinishWorkoutInput = {
  reflection?: WorkoutReflection;
  onPersisted?: (result: PersistResult) => void;
};

export type StartWorkoutModeOptions = {
  suggestedWeightByProgramExerciseId?: Record<string, string>;
  /** PT live-økt: logg alltid på valgt kunde (overstyrer program.memberId ved avvik). */
  memberId?: string;
};

export type StartCustomWorkoutInput = {
  memberId: string;
  exercises: ProgramExercise[];
};

export type LogGroupWorkoutInput = {
  memberId: string;
  className: string;
  note?: string;
  reflection: WorkoutReflection;
  keepCurrentTab?: boolean;
  date?: string;
};

export type ReplaceWorkoutExerciseGroupInput = {
  programExerciseId: string;
  nextExerciseName: string;
};

export type RemoveWorkoutLogResultInput = {
  logId: string;
  exerciseId: string;
};

export type SetWorkoutLogResultsInput = {
  logId: string;
  results: WorkoutLog["results"];
};

export type UpdateWorkoutLogTrainerCommentInput = {
  logId: string;
  trainerComment: string;
  trainerCommentUpdatedAt?: string;
  trainerCommentAuthorName?: string;
};

export type RemoveGroupWorkoutLogInput = {
  memberId: string;
  className: string;
  date?: string;
};

export type LogCompletedPlanEntryInput = {
  memberId: string;
  programTitle: string;
  note?: string;
  reflection?: WorkoutReflection;
  keepCurrentTab?: boolean;
  date?: string;
};

export type LogIntervalWorkoutInput = {
  memberId: string;
  programId: string;
  programTitle?: string;
  /** PT auth.users.id fra programmet — nødvendig for sky-lagring under medlem-RLS. */
  ownerUserId?: string;
  targetEmail?: string;
  results: WorkoutExerciseResult[];
  note?: string;
  reflection: WorkoutReflection;
  keepCurrentTab?: boolean;
  onPersisted?: (result: PersistResult) => void;
};

export type RemoveCompletedPlanEntryLogInput = {
  memberId: string;
  programTitle: string;
  date?: string;
};

export type SaveExerciseInput = {
  id?: string;
  name: string;
  category: Exercise["category"];
  group: string;
  equipment: string;
  level: Exercise["level"];
  description: string;
  imageUrl?: string;
  prescriptionFields?: Exercise["prescriptionFields"];
  customField1Label?: string;
  customField2Label?: string;
};

export type UpdateMemberInput = {
  memberId: string;
  changes: Partial<
    Pick<
      Member,
      | "name"
      | "email"
      | "phone"
      | "birthDate"
      | "gender"
      | "goal"
      | "focus"
      | "level"
      | "injuries"
      | "personalGoals"
      | "membershipType"
      | "customerType"
      | "nutritionAccess"
      | "ownerUserId"
      | "avatarUrl"
    >
  >;
};

export interface AppRepository {
  addMember(state: AppState, input: CreateMemberInput): AppState;
  deactivateMember(state: AppState, memberId: string): AppState;
  deleteMember(state: AppState, memberId: string): AppState;
  markMemberInvited(state: AppState, memberId: string, invitedAtIso?: string): AppState;
  markMembersInvitedByEmail(state: AppState, email: string, invitedAtIso?: string): AppState;
  markMembersFirstLoginByEmail(state: AppState, email: string, firstLoginAtIso?: string): AppState;
  saveProgram(state: AppState, input: SaveProgramInput): AppState;
  deleteProgram(state: AppState, programId: string, context?: DeleteProgramContext): AppState;
  updateProgramMemberLibraryStatus(state: AppState, programId: string, status: MemberProgramLibraryStatus | undefined): AppState;
  appendTrainerMessage(state: AppState, memberId: string, text: string): AppState;
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState;
  toggleChatMessageReaction(state: AppState, messageId: string, emoji: ChatReactionEmoji, actor: ChatReactionActor): AppState;
  startWorkoutMode(state: AppState, programId: string, options?: StartWorkoutModeOptions): AppState;
  startCustomWorkout(state: AppState, input: StartCustomWorkoutInput, options?: StartWorkoutModeOptions): AppState;
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState;
  replaceWorkoutExerciseGroup(state: AppState, input: ReplaceWorkoutExerciseGroupInput): AppState;
  appendWorkoutSetForProgramExercise(state: AppState, programExerciseId: string): AppState;
  deferWorkoutExerciseGroup(state: AppState, programExerciseId: string): AppState;
  removeWorkoutLogResult(state: AppState, input: RemoveWorkoutLogResultInput): AppState;
  removeGroupWorkoutLog(state: AppState, input: RemoveGroupWorkoutLogInput): AppState;
  setWorkoutLogResults(state: AppState, input: SetWorkoutLogResultsInput): AppState;
  updateWorkoutLogTrainerComment(state: AppState, input: UpdateWorkoutLogTrainerCommentInput): AppState;
  updateWorkoutNote(state: AppState, note: string): AppState;
  cancelWorkoutMode(state: AppState): AppState;
  finishWorkoutMode(state: AppState, input?: FinishWorkoutInput): AppState;
  logGroupWorkout(state: AppState, input: LogGroupWorkoutInput): AppState;
  logIntervalWorkout(state: AppState, input: LogIntervalWorkoutInput): AppState;
  logCompletedPlanEntry(state: AppState, input: LogCompletedPlanEntryInput): AppState;
  removeCompletedPlanEntryLog(state: AppState, input: RemoveCompletedPlanEntryLogInput): AppState;
  saveExercise(state: AppState, input: SaveExerciseInput): AppState;
  deleteExercise(state: AppState, exerciseId: string): AppState;
  updateMember(state: AppState, input: UpdateMemberInput): AppState;
}

export function createMember(state: AppState, input: CreateMemberInput): Member {
  return {
    id: uid("member"),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    isActive: true,
    invitedAt: "",
    firstLoginAt: "",
    phone: input.phone?.trim() || "900 00 000",
    birthDate: "",
    gender: "",
    level: "Nybegynner",
    membershipType: input.membershipType ?? "Standard",
    customerType: input.customerType ?? "Oppfølging",
    nutritionAccess: input.nutritionAccess === true,
    daysSinceActivity: "0",
    weight: "",
    height: "",
    goal: input.goal?.trim() || "Nytt mål settes her",
    focus: input.focus?.trim() || "Ikke satt",
    personalGoals: "",
    injuries: "Ingen info ennå",
    coachNotes: "",
  };
}

export function addMemberToState(state: AppState, input: CreateMemberInput): AppState {
  const nextMember = createMember(state, input);
  return {
    ...state,
    members: [...state.members, nextMember],
    selectedMemberId: nextMember.id,
  };
}

export function deactivateMemberInState(state: AppState, memberId: string): AppState {
  const target = state.members.find((member) => member.id === memberId);
  const emailKey = target?.email.trim().toLowerCase() ?? "";
  const members = state.members.map((member) => {
    const samePerson = member.id === memberId || (emailKey && member.email.trim().toLowerCase() === emailKey);
    return samePerson ? { ...member, isActive: false } : member;
  });
  const activeMembers = members.filter((member) => member.isActive !== false);
  const pickNextId = (currentId: string) => (currentId === memberId ? activeMembers[0]?.id ?? "" : currentId);
  return {
    ...state,
    members,
    selectedMemberId: pickNextId(state.selectedMemberId),
    memberViewId: pickNextId(state.memberViewId),
  };
}

export function markMemberInvitedInState(state: AppState, memberId: string, invitedAtIso?: string): AppState {
  const timestamp = invitedAtIso ?? new Date().toISOString();
  return {
    ...state,
    members: state.members.map((member) =>
      member.id === memberId ? { ...member, invitedAt: timestamp } : member
    ),
  };
}

export function markMembersInvitedByEmailInState(
  state: AppState,
  email: string,
  invitedAtIso?: string,
): AppState {
  const emailKey = email.trim().toLowerCase();
  const stamp = (invitedAtIso ?? new Date().toISOString()).trim();
  if (!emailKey.includes("@") || !stamp) return state;
  return {
    ...state,
    members: state.members.map((member) => {
      if (member.email.trim().toLowerCase() !== emailKey) return member;
      if (member.invitedAt?.trim()) return member;
      return { ...member, invitedAt: stamp };
    }),
  };
}

export function markMembersFirstLoginByEmailInState(
  state: AppState,
  email: string,
  firstLoginAtIso?: string,
): AppState {
  return applyFirstLoginStampToMembersByEmail(state, email, firstLoginAtIso ?? new Date().toISOString());
}

export function deleteMemberInState(state: AppState, memberId: string): AppState {
  const remainingMembers = state.members.filter((member) => member.id !== memberId);
  const fallbackMemberId = remainingMembers[0]?.id ?? "";
  return {
    ...state,
    members: remainingMembers,
    programs: state.programs.filter((program) => program.memberId !== memberId),
    logs: state.logs.filter((log) => log.memberId !== memberId),
    messages: state.messages.filter((message) => message.memberId !== memberId),
    selectedMemberId: state.selectedMemberId === memberId ? fallbackMemberId : state.selectedMemberId,
    memberViewId: state.memberViewId === memberId ? fallbackMemberId : state.memberViewId,
  };
}

function mapProgramExercisesForSave(exercises: ProgramExercise[]): ProgramExercise[] {
  return normalizeLegacyIntervalCooldownExerciseNames(exercises).map((exercise) => ({
    ...exercise,
    id: exercise.id || uid("prog-ex"),
  }));
}

export function saveProgramInState(
  state: AppState,
  input: SaveProgramInput
): AppState {
  const exercises = mapProgramExercisesForSave(input.exercises);
  if (input.id) {
    const existingProgram = state.programs.find((program) => program.id === input.id);
    if (existingProgram) {
    return {
      ...state,
      programs: state.programs.map((program) =>
        program.id === input.id
          ? {
              ...program,
              memberId: input.memberId,
              title: input.title.trim(),
              goal: input.goal.trim(),
              notes: input.notes.trim(),
              exercises,
              imageUrl:
                input.imageUrl !== undefined ? input.imageUrl.trim() || undefined : program.imageUrl,
              ...(input.programCreatedBy
                ? {
                    programCreatedBy: input.programCreatedBy,
                    programCreatedByName: input.programCreatedByName?.trim() ?? "",
                  }
                : {}),
            }
          : program
      ),
    };
    }
  }

  const newProgram: TrainingProgram = {
    id: input.id?.trim() || uid("program"),
    memberId: input.memberId,
    title: input.title.trim(),
    goal: input.goal.trim(),
    notes: input.notes.trim(),
    createdAt: formatDateDdMmYyyy(new Date()),
    exercises,
    imageUrl: input.imageUrl?.trim() || undefined,
    ...(input.programCreatedBy
      ? {
          programCreatedBy: input.programCreatedBy,
          programCreatedByName: input.programCreatedByName?.trim() ?? "",
        }
      : {}),
  };

  return { ...state, programs: [newProgram, ...state.programs] };
}

export function deleteProgramInState(state: AppState, programId: string): AppState {
  const programToDelete = state.programs.find((program) => program.id === programId);
  return {
    ...state,
    programs: state.programs.filter((program) => program.id !== programId),
    logs: programToDelete ? state.logs.filter((log) => !(log.memberId === programToDelete.memberId && log.programTitle === programToDelete.title)) : state.logs,
  };
}

export function updateProgramMemberLibraryStatusInState(
  state: AppState,
  programId: string,
  status: MemberProgramLibraryStatus | undefined,
): AppState {
  const anchor = state.programs.find((program) => program.id === programId);
  const matchKey = anchor ? buildTrainingProgramDisplayKey(anchor) : null;
  return {
    ...state,
    programs: state.programs.map((program) => {
      const isTarget =
        program.id === programId ||
        (matchKey !== null && buildTrainingProgramDisplayKey(program) === matchKey);
      if (!isTarget) return program;
      const normalizedStatus = normalizeMemberLibraryStatus(status);
      return {
        ...program,
        ...(normalizedStatus ? { memberLibraryStatus: normalizedStatus } : { memberLibraryStatus: undefined }),
      };
    }),
  };
}

export function appendTrainerMessage(state: AppState, memberId: string, text: string): AppState {
  const nextMessage: ChatMessage = {
    id: uid("msg"),
    memberId,
    sender: "trainer",
    text: text.trim(),
    createdAt: formatDateTimeDdMmYyyy(new Date()),
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
  const nextMessage: ChatMessage = {
    id: uid("msg"),
    memberId,
    sender: "member",
    text: text.trim(),
    createdAt: formatDateTimeDdMmYyyy(new Date()),
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function toggleChatMessageReaction(
  state: AppState,
  messageId: string,
  emoji: ChatReactionEmoji,
  actor: ChatReactionActor,
): AppState {
  if (!messageId.trim()) return state;
  return {
    ...state,
    messages: state.messages.map((message) =>
      message.id === messageId
        ? { ...message, reactions: toggleReactionInState(message.reactions, emoji, actor) }
        : message,
    ),
  };
}

export function startWorkoutModeInState(state: AppState, programId: string, options?: StartWorkoutModeOptions): AppState {
  const program = state.programs.find((p) => p.id === programId);
  if (!program) return state;

  const expandedResults = expandProgramExercisesToWorkoutResults(program.exercises, state.exercises, {
    suggestedWeightByProgramExerciseId: options?.suggestedWeightByProgramExerciseId,
  });

  const memberId = options?.memberId?.trim() || program.memberId;
  return {
    ...state,
    workoutMode: {
      programId,
      memberId,
      programTitle: program.title,
      results: expandedResults,
      note: "",
    },
  };
}

export function updateWorkoutResultInState(
  state: AppState,
  exerciseId: string,
  field:
    | "performedWeight"
    | "performedReps"
    | "performedDurationMinutes"
    | "performedSpeed"
    | "performedIncline"
    | "performedLoadUnit"
    | "completed",
  value: string | boolean
): AppState {
  if (!state.workoutMode) return state;
  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: state.workoutMode.results.map((r) => (r.exerciseId === exerciseId ? { ...r, [field]: value } : r)),
    },
  };
}

export function replaceWorkoutExerciseGroupInState(state: AppState, input: ReplaceWorkoutExerciseGroupInput): AppState {
  if (!state.workoutMode) return state;
  const normalizedName = input.nextExerciseName.trim();
  if (!input.programExerciseId || !normalizedName) return state;
  const replacementExercise = state.exercises.find(
    (exercise) => exercise.name.trim().toLowerCase() === normalizedName.toLowerCase(),
  );
  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: state.workoutMode.results.map((result) =>
        result.programExerciseId === input.programExerciseId
          ? {
              ...result,
              exerciseName: normalizedName,
              ...(replacementExercise
                ? { exerciseCategory: replacementExercise.category, exerciseEquipment: replacementExercise.equipment }
                : {}),
            }
          : result,
      ),
    },
  };
}

/** Øvre grense for antall sett per øvelses-gruppe under økt (plan + ekstra sett underveis). */
export const MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE = 18;

export function appendWorkoutSetForProgramExerciseInState(state: AppState, programExerciseId: string): AppState {
  if (!state.workoutMode) return state;
  const pid = programExerciseId.trim();
  if (!pid) return state;

  const results = state.workoutMode.results;
  const groupIndices: number[] = [];
  results.forEach((r, i) => {
    if (r.programExerciseId === pid) groupIndices.push(i);
  });
  if (!groupIndices.length) return state;

  const insertAfterIndex = groupIndices[groupIndices.length - 1];
  const template = results[insertAfterIndex];
  const maxExistingSet = Math.max(...groupIndices.map((i) => results[i].setNumber ?? 0));
  const nextSetNum = maxExistingSet + 1;
  if (nextSetNum > MAX_SETS_PER_EXERCISE_IN_WORKOUT_MODE) return state;

  const newRow: WorkoutExerciseResult = {
    ...template,
    exerciseId: `${pid}-set-${nextSetNum}`,
    setNumber: nextSetNum,
    completed: false,
    performedWeight: template.plannedWeight,
    performedReps: template.plannedReps,
    performedDurationMinutes: template.plannedDurationMinutes ?? "",
    performedSpeed: template.plannedSpeed ?? "",
    performedIncline: template.plannedIncline ?? "",
  };

  const newResults = [...results.slice(0, insertAfterIndex + 1), newRow, ...results.slice(insertAfterIndex + 1)];
  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: newResults,
    },
  };
}

function buildWorkoutGroupOrder(results: WorkoutExerciseResult[]): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  results.forEach((result) => {
    const groupId = workoutResultGroupId(result);
    if (seen.has(groupId)) return;
    seen.add(groupId);
    order.push(groupId);
  });
  return order;
}

/** Flytt aktiv øvelse/blokk bakover – neste tas først, denne kommer rett etter den neste. */
export function deferWorkoutExerciseGroupInState(state: AppState, groupId: string): AppState {
  if (!state.workoutMode) return state;
  const gid = groupId.trim();
  if (!gid) return state;

  const results = state.workoutMode.results;
  const groupOrder = buildWorkoutGroupOrder(results);
  const currentIndex = groupOrder.indexOf(gid);
  if (currentIndex < 0 || currentIndex >= groupOrder.length - 1) return state;

  const nextGroupId = groupOrder[currentIndex + 1];
  const nextOrder = groupOrder.filter((id) => id !== gid);
  const insertAfterIndex = nextOrder.indexOf(nextGroupId);
  if (insertAfterIndex < 0) return state;
  nextOrder.splice(insertAfterIndex + 1, 0, gid);

  const rowsByGroup = new Map<string, WorkoutExerciseResult[]>();
  results.forEach((result) => {
    const resultGroupId = workoutResultGroupId(result);
    const existing = rowsByGroup.get(resultGroupId);
    if (existing) {
      existing.push(result);
      return;
    }
    rowsByGroup.set(resultGroupId, [result]);
  });

  const reorderedResults = nextOrder.flatMap((groupId) => rowsByGroup.get(groupId) ?? []);

  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: reorderedResults,
    },
  };
}

export function updateWorkoutNoteInState(state: AppState, note: string): AppState {
  if (!state.workoutMode) return state;
  return { ...state, workoutMode: { ...state.workoutMode, note } };
}

export function updateWorkoutExerciseNoteInState(state: AppState, programExerciseId: string, note: string): AppState {
  if (!state.workoutMode) return state;
  const pid = programExerciseId.trim();
  if (!pid) return state;
  const trimmed = note;
  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: state.workoutMode.results.map((result) =>
        result.programExerciseId === pid ? { ...result, exerciseNote: trimmed } : result,
      ),
    },
  };
}

export function cancelWorkoutModeInState(state: AppState): AppState {
  if (!state.workoutMode) {
    return { ...state, workoutMode: null };
  }
  const program = state.programs.find((p) => p.id === state.workoutMode.programId);
  const programs = program?.ephemeral ? state.programs.filter((p) => p.id !== program.id) : state.programs;
  return { ...state, programs, workoutMode: null };
}

export function finishWorkoutModeInState(state: AppState, input?: FinishWorkoutInput): AppState {
  const current = state.workoutMode;
  if (!current) return state;
  const program = state.programs.find((p) => p.id === current.programId);
  const memberId = current.memberId?.trim() || program?.memberId?.trim() || "";
  if (!memberId) return state;
  const programTitle = (program?.title ?? current.programTitle?.trim()) || "Egen økt";

  function estimate1RM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    return weight * (1 + reps / 30);
  }

  function getBestEstimated1RM(logs: WorkoutLog[], exerciseName: string, memberId: string): number {
    let best = 0;
    logs.forEach((log) => {
      if (log.memberId !== memberId) return;
      (log.results ?? []).forEach((result) => {
        if (!result.completed || result.exerciseName !== exerciseName) return;
        if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) return;
        const weight = Number(result.performedWeight) || 0;
        const reps = Number(result.performedReps) || 0;
        const estimated = estimate1RM(weight, reps);
        if (estimated > best) best = estimated;
      });
    });
    return best;
  }

  let bestCelebration: WorkoutCelebration | null = null;
  current.results.forEach((result) => {
    if (!result.completed) return;
    if (result.exerciseCategory && isHoldBasedExerciseCategory(result.exerciseCategory)) return;
    const weight = Number(result.performedWeight) || 0;
    const reps = Number(result.performedReps) || 0;
    const newEstimated = estimate1RM(weight, reps);
    if (newEstimated <= 0) return;
    const previousEstimated = getBestEstimated1RM(state.logs, result.exerciseName, memberId);
    if (newEstimated <= previousEstimated) return;
    if (!bestCelebration || newEstimated - previousEstimated > bestCelebration.newEstimated1RM - bestCelebration.previousEstimated1RM) {
      bestCelebration = {
        memberId,
        exerciseName: result.exerciseName,
        previousEstimated1RM: previousEstimated,
        newEstimated1RM: newEstimated,
        reps,
        weight,
      };
    }
  });

  const seenResultKeys = new Set<string>();
  const deduplicatedResults = current.results.filter((result) => {
    const dedupeKey = `${result.programExerciseId || result.exerciseName.trim().toLowerCase()}::${result.setNumber ?? 0}`;
    if (seenResultKeys.has(dedupeKey)) {
      return false;
    }
    seenResultKeys.add(dedupeKey);
    return true;
  });

  const programsAfter =
    program?.ephemeral === true ? state.programs.filter((p) => p.id !== program.id) : state.programs;

  return {
    ...state,
    programs: programsAfter,
    logs: [
      {
        id: uid("log"),
        memberId,
        programTitle,
        date: formatDateTimeDdMmYyyy(new Date()),
        status: "Fullført",
        note: current.note,
        reflection: input?.reflection,
        results: deduplicatedResults,
      },
      ...state.logs,
    ],
    workoutMode: null,
    workoutCelebration: bestCelebration,
  };
}

export function startCustomWorkoutInState(
  state: AppState,
  input: StartCustomWorkoutInput,
  options?: StartWorkoutModeOptions,
): AppState {
  const memberId = input.memberId.trim();
  if (!memberId || !input.exercises.length) return state;
  const programId = uid("program");
  const exercises = input.exercises.map((exercise) => ({
    ...exercise,
    id: exercise.id?.trim() ? exercise.id : uid("prog-ex"),
  }));
  const newProgram: TrainingProgram = {
    id: programId,
    memberId,
    title: "Egen økt",
    goal: "",
    notes: "",
    createdAt: formatDateDdMmYyyy(new Date()),
    exercises,
    ephemeral: true,
  };
  const withProgram: AppState = { ...state, programs: [newProgram, ...state.programs] };
  return startWorkoutModeInState(withProgram, programId, options);
}

export function logGroupWorkoutInState(state: AppState, input: LogGroupWorkoutInput): AppState {
  const memberId = input.memberId.trim();
  const className = input.className.trim();
  const date = resolveWorkoutLogDateTime(input.date);
  if (!memberId || !className) return state;
  const normalizedTitle = `Gruppetime: ${className}`;
  const duplicateExists = state.logs.some(
    (log) =>
      log.memberId === memberId &&
      log.programTitle.trim().toLowerCase() === normalizedTitle.trim().toLowerCase() &&
      storedLogDatesMatch(log.date, date) &&
      log.status === "Fullført"
  );
  if (duplicateExists) return state;
  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId,
        programTitle: normalizedTitle,
        date,
        status: "Fullført",
        note: input.note?.trim() ?? "",
        reflection: input.reflection,
        results: [],
      },
      ...state.logs,
    ],
  };
}

export function removeGroupWorkoutLogInState(state: AppState, input: RemoveGroupWorkoutLogInput): AppState {
  const memberId = input.memberId.trim();
  const className = input.className.trim();
  const date = input.date?.trim() ? normalizeStoredLogDate(input.date) : "";
  if (!memberId || !className) return state;
  const normalizedTitle = `Gruppetime: ${className}`.trim().toLowerCase();
  return {
    ...state,
    logs: state.logs.filter((log) => {
      if (log.memberId !== memberId) return true;
      if (log.programTitle.trim().toLowerCase() !== normalizedTitle) return true;
      if (date && !storedLogDatesMatch(log.date, date)) return true;
      return false;
    }),
  };
}

export function logIntervalWorkoutInState(state: AppState, input: LogIntervalWorkoutInput): AppState {
  const memberId = input.memberId.trim();
  const programId = input.programId.trim();
  const programTitleHint = String(input.programTitle ?? "").trim();
  const program =
    state.programs.find((item) => item.id === programId) ??
    (programTitleHint
      ? state.programs.find((item) => item.title.trim() === programTitleHint)
      : undefined);
  if (!memberId || !program) return state;
  const date = formatDateTimeDdMmYyyy(new Date());
  const deduplicatedResults = (input.results ?? []).filter((result, index, list) => {
    const key = `${result.programExerciseId || result.exerciseName.trim().toLowerCase()}::${result.setNumber ?? 0}`;
    return list.findIndex((candidate) => {
      const candidateKey = `${candidate.programExerciseId || candidate.exerciseName.trim().toLowerCase()}::${candidate.setNumber ?? 0}`;
      return candidateKey === key;
    }) === index;
  });
  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId,
        programTitle: program.title,
        date,
        status: "Fullført",
        note: input.note?.trim() ?? "",
        reflection: input.reflection,
        results: deduplicatedResults,
      },
      ...state.logs,
    ],
  };
}

export function logCompletedPlanEntryInState(state: AppState, input: LogCompletedPlanEntryInput): AppState {
  const memberId = input.memberId.trim();
  const programTitle = input.programTitle.trim();
  const date = resolveWorkoutLogDateTime(input.date);
  if (!memberId || !programTitle) return state;
  const normalizedTitle = programTitle.toLowerCase();
  const duplicateExists = state.logs.some(
    (log) =>
      log.memberId === memberId &&
      log.programTitle.trim().toLowerCase() === normalizedTitle &&
      storedLogDatesMatch(log.date, date) &&
      log.status === "Fullført",
  );
  if (duplicateExists) return state;
  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId,
        programTitle,
        date,
        status: "Fullført",
        note: input.note?.trim() ?? "",
        reflection: input.reflection,
        results: [],
      },
      ...state.logs,
    ],
  };
}

export function removeCompletedPlanEntryLogInState(state: AppState, input: RemoveCompletedPlanEntryLogInput): AppState {
  const memberId = input.memberId.trim();
  const programTitle = input.programTitle.trim();
  const date = input.date?.trim() ? normalizeStoredLogDate(input.date) : "";
  if (!memberId || !programTitle) return state;
  const normalizedTitle = programTitle.toLowerCase();
  return {
    ...state,
    logs: state.logs.filter((log) => {
      if (log.memberId !== memberId) return true;
      if (log.programTitle.trim().toLowerCase() !== normalizedTitle) return true;
      if (date && !storedLogDatesMatch(log.date, date)) return true;
      return false;
    }),
  };
}

export function removeWorkoutLogResultInState(state: AppState, input: RemoveWorkoutLogResultInput): AppState {
  const logId = input.logId.trim();
  const exerciseId = input.exerciseId.trim();
  if (!logId || !exerciseId) return state;
  const logToUpdate = state.logs.find((log) => log.id === logId);
  if (!logToUpdate) return state;
  const nextResults = (logToUpdate.results ?? []).filter((result) => result.exerciseId !== exerciseId);
  return setWorkoutLogResultsInState(state, { logId, results: nextResults });
}

export function setWorkoutLogResultsInState(state: AppState, input: SetWorkoutLogResultsInput): AppState {
  const logId = input.logId.trim();
  if (!logId) return state;
  const nextResults = (input.results ?? []).map((result) => ({ ...result }));
  return {
    ...state,
    logs: state.logs.map((log) => {
      if (log.id !== logId) return log;
      return {
        ...log,
        results: nextResults,
      };
    }),
  };
}

export function updateWorkoutLogTrainerCommentInState(
  state: AppState,
  input: UpdateWorkoutLogTrainerCommentInput,
): AppState {
  const logId = input.logId.trim();
  if (!logId) return state;
  const nextComment = input.trainerComment.trim();
  const nextUpdatedAt = nextComment ? input.trainerCommentUpdatedAt?.trim() || new Date().toISOString() : undefined;
  const nextAuthorName = nextComment ? input.trainerCommentAuthorName?.trim() || undefined : undefined;
  return {
    ...state,
    logs: state.logs.map((log) =>
      log.id === logId
        ? {
            ...log,
            trainerComment: nextComment || undefined,
            trainerCommentUpdatedAt: nextUpdatedAt,
            trainerCommentAuthorName: nextAuthorName,
          }
        : log,
    ),
  };
}

export function saveExerciseInState(state: AppState, input: SaveExerciseInput): AppState {
  const normalizedName = input.name.trim();
  const normalizedGroup = input.group.trim();
  const normalizedDescription = input.description.trim();
  const normalizedImageUrl = input.imageUrl?.trim() || "";
  if (!normalizedName || !normalizedGroup) return state;

  const savedPrescriptionFields = prescriptionFieldsForExerciseSave(input.prescriptionFields, input.category);

  if (input.id) {
    return {
      ...state,
      exercises: state.exercises.map((exercise) =>
        exercise.id === input.id
          ? {
              ...exercise,
              name: normalizedName,
              category: input.category,
              group: normalizedGroup,
              equipment: input.equipment.trim(),
              level: input.level,
              description: normalizedDescription,
              imageUrl: normalizedImageUrl,
              prescriptionFields: savedPrescriptionFields,
              customField1Label: input.customField1Label?.trim() ?? "",
              customField2Label: input.customField2Label?.trim() ?? "",
            }
          : exercise
      ),
    };
  }

  const nextExercise: Exercise = {
    id: uid("ex"),
    name: normalizedName,
    category: input.category,
    group: normalizedGroup,
    equipment: input.equipment.trim(),
    level: input.level,
    description: normalizedDescription,
    imageUrl: normalizedImageUrl,
    prescriptionFields: savedPrescriptionFields,
    customField1Label: input.customField1Label?.trim() ?? "",
    customField2Label: input.customField2Label?.trim() ?? "",
  };
  return { ...state, exercises: [nextExercise, ...state.exercises] };
}

export function deleteExerciseInState(state: AppState, exerciseId: string): AppState {
  const normalizedExerciseId = exerciseId.trim();
  if (!normalizedExerciseId) return state;
  const deletedExercise = state.exercises.find((exercise) => exercise.id === normalizedExerciseId);
  if (!deletedExercise) {
    return {
      ...state,
      exercises: state.exercises.filter((exercise) => exercise.id !== normalizedExerciseId),
    };
  }
  return {
    ...state,
    exercises: state.exercises.filter((exercise) => exercise.id !== normalizedExerciseId),
    programs: state.programs.map((program) => ({
      ...program,
      exercises: filterProgramExercisesAfterBankDelete(program.exercises, deletedExercise),
    })),
  };
}

export function updateMemberInState(state: AppState, input: UpdateMemberInput): AppState {
  const normalizedEmail = input.changes.email?.trim().toLowerCase();
  return {
    ...state,
    members: state.members.map((member) =>
      member.id === input.memberId
        ? {
            ...member,
            ...input.changes,
            name: input.changes.name !== undefined ? input.changes.name.trim() : member.name,
            email: normalizedEmail ?? member.email,
            phone: input.changes.phone !== undefined ? input.changes.phone.trim() : member.phone,
            birthDate: input.changes.birthDate !== undefined ? input.changes.birthDate.trim() : member.birthDate,
            gender: input.changes.gender !== undefined ? input.changes.gender : member.gender,
            goal: input.changes.goal !== undefined ? input.changes.goal.trim() : member.goal,
            level: input.changes.level !== undefined ? input.changes.level : member.level,
            focus: input.changes.focus !== undefined ? input.changes.focus.trim() : member.focus,
            injuries: input.changes.injuries !== undefined ? input.changes.injuries.trim() : member.injuries,
            personalGoals: input.changes.personalGoals !== undefined ? input.changes.personalGoals.trim() : member.personalGoals,
            avatarUrl: input.changes.avatarUrl !== undefined ? input.changes.avatarUrl.trim() : member.avatarUrl,
            membershipType:
              input.changes.membershipType !== undefined ? input.changes.membershipType : member.membershipType,
            customerType: input.changes.customerType !== undefined ? input.changes.customerType : member.customerType,
            nutritionAccess:
              input.changes.nutritionAccess !== undefined ? input.changes.nutritionAccess : member.nutritionAccess,
            ownerUserId:
              input.changes.ownerUserId !== undefined
                ? String(input.changes.ownerUserId ?? "").trim() || undefined
                : member.ownerUserId,
          }
        : member
    ),
  };
}

export const localAppRepository: AppRepository = {
  addMember: addMemberToState,
  deactivateMember: deactivateMemberInState,
  deleteMember: deleteMemberInState,
  markMemberInvited: markMemberInvitedInState,
  markMembersInvitedByEmail: markMembersInvitedByEmailInState,
  markMembersFirstLoginByEmail: markMembersFirstLoginByEmailInState,
  saveProgram: saveProgramInState,
  deleteProgram: deleteProgramInState,
  updateProgramMemberLibraryStatus: updateProgramMemberLibraryStatusInState,
  appendTrainerMessage,
  appendMemberMessage,
  toggleChatMessageReaction,
  startWorkoutMode: (state, programId, options) => startWorkoutModeInState(state, programId, options),
  startCustomWorkout: (state, input, options) => startCustomWorkoutInState(state, input, options),
  updateWorkoutResult: (state, input) => updateWorkoutResultInState(state, input.exerciseId, input.field, input.value),
  replaceWorkoutExerciseGroup: (state, input) => replaceWorkoutExerciseGroupInState(state, input),
  appendWorkoutSetForProgramExercise: (state, programExerciseId) =>
    appendWorkoutSetForProgramExerciseInState(state, programExerciseId),
  deferWorkoutExerciseGroup: (state, programExerciseId) => deferWorkoutExerciseGroupInState(state, programExerciseId),
  removeWorkoutLogResult: (state, input) => removeWorkoutLogResultInState(state, input),
  removeGroupWorkoutLog: (state, input) => removeGroupWorkoutLogInState(state, input),
  setWorkoutLogResults: (state, input) => setWorkoutLogResultsInState(state, input),
  updateWorkoutLogTrainerComment: (state, input) => updateWorkoutLogTrainerCommentInState(state, input),
  updateWorkoutNote: updateWorkoutNoteInState,
  updateWorkoutExerciseNote: updateWorkoutExerciseNoteInState,
  cancelWorkoutMode: cancelWorkoutModeInState,
  finishWorkoutMode: finishWorkoutModeInState,
  logGroupWorkout: logGroupWorkoutInState,
  logIntervalWorkout: logIntervalWorkoutInState,
  logCompletedPlanEntry: logCompletedPlanEntryInState,
  removeCompletedPlanEntryLog: removeCompletedPlanEntryLogInState,
  saveExercise: saveExerciseInState,
  deleteExercise: deleteExerciseInState,
  updateMember: updateMemberInState,
};
