import { uid } from "../app/storage";
import type { AppState, ChatMessage, Exercise, Member, ProgramExercise, TrainingProgram, WorkoutCelebration, WorkoutLog, WorkoutReflection } from "../app/types";
import { formatDateDdMmYyyy } from "../app/dateFormat";

export type CreateMemberInput = {
  name: string;
  email: string;
  phone?: string;
  goal?: string;
  focus?: string;
};

export type SaveProgramInput = {
  id?: string;
  title: string;
  goal: string;
  notes: string;
  memberId: string;
  exercises: ProgramExercise[];
};

export type UpdateWorkoutResultInput = {
  exerciseId: string;
  field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline" | "completed";
  value: string | boolean;
};

export type FinishWorkoutInput = {
  reflection?: WorkoutReflection;
};

export type StartWorkoutModeOptions = {
  suggestedWeightByProgramExerciseId?: Record<string, string>;
};

export type LogGroupWorkoutInput = {
  memberId: string;
  className: string;
  note?: string;
  reflection: WorkoutReflection;
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

export type SaveExerciseInput = {
  id?: string;
  name: string;
  category: Exercise["category"];
  group: string;
  equipment: string;
  level: Exercise["level"];
  description: string;
  imageUrl?: string;
};

export type UpdateMemberInput = {
  memberId: string;
  changes: Partial<Pick<Member, "name" | "email" | "phone" | "birthDate" | "goal" | "focus" | "injuries" | "membershipType" | "customerType" | "avatarUrl">>;
};

export interface AppRepository {
  addMember(state: AppState, input: CreateMemberInput): AppState;
  deactivateMember(state: AppState, memberId: string): AppState;
  deleteMember(state: AppState, memberId: string): AppState;
  markMemberInvited(state: AppState, memberId: string, invitedAtIso?: string): AppState;
  saveProgram(state: AppState, input: SaveProgramInput): AppState;
  deleteProgram(state: AppState, programId: string): AppState;
  appendTrainerMessage(state: AppState, memberId: string, text: string): AppState;
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState;
  startWorkoutMode(state: AppState, programId: string, options?: StartWorkoutModeOptions): AppState;
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState;
  replaceWorkoutExerciseGroup(state: AppState, input: ReplaceWorkoutExerciseGroupInput): AppState;
  removeWorkoutLogResult(state: AppState, input: RemoveWorkoutLogResultInput): AppState;
  setWorkoutLogResults(state: AppState, input: SetWorkoutLogResultsInput): AppState;
  updateWorkoutNote(state: AppState, note: string): AppState;
  cancelWorkoutMode(state: AppState): AppState;
  finishWorkoutMode(state: AppState, input?: FinishWorkoutInput): AppState;
  logGroupWorkout(state: AppState, input: LogGroupWorkoutInput): AppState;
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
    phone: input.phone?.trim() || "900 00 000",
    birthDate: "",
    level: "Nybegynner",
    membershipType: "Standard",
    customerType: "Oppfølging",
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
  const activeMembers = state.members.filter((member) => member.id !== memberId && member.isActive !== false);
  return {
    ...state,
    members: state.members.map((member) =>
      member.id === memberId ? { ...member, isActive: false } : member
    ),
    selectedMemberId: state.selectedMemberId === memberId ? activeMembers[0]?.id ?? "" : state.selectedMemberId,
    memberViewId: state.memberViewId === memberId ? activeMembers[0]?.id ?? "" : state.memberViewId,
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

export function saveProgramInState(
  state: AppState,
  input: SaveProgramInput
): AppState {
  if (input.id) {
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
              exercises: input.exercises.map((exercise) => ({ ...exercise, id: exercise.id || uid("prog-ex") })),
            }
          : program
      ),
    };
  }

  const newProgram: TrainingProgram = {
    id: uid("program"),
    memberId: input.memberId,
    title: input.title.trim(),
    goal: input.goal.trim(),
    notes: input.notes.trim(),
    createdAt: formatDateDdMmYyyy(new Date()),
    exercises: input.exercises.map((exercise) => ({ ...exercise, id: uid("prog-ex") })),
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

export function appendTrainerMessage(state: AppState, memberId: string, text: string): AppState {
  const nextMessage: ChatMessage = {
    id: uid("msg"),
    memberId,
    sender: "trainer",
    text: text.trim(),
    createdAt: formatDateDdMmYyyy(new Date()),
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
  const nextMessage: ChatMessage = {
    id: uid("msg"),
    memberId,
    sender: "member",
    text: text.trim(),
    createdAt: formatDateDdMmYyyy(new Date()),
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function startWorkoutModeInState(state: AppState, programId: string, options?: StartWorkoutModeOptions): AppState {
  const program = state.programs.find((p) => p.id === programId);
  if (!program) return state;

  const expandedResults = program.exercises.flatMap((ex) => {
    const suggestedWeightRaw = options?.suggestedWeightByProgramExerciseId?.[ex.id];
    const suggestedWeight = suggestedWeightRaw !== undefined ? suggestedWeightRaw.trim() : "";
    const initialWeight = suggestedWeight || ex.weight;
    const setCount = Math.max(1, Math.min(12, Number(ex.sets) || 1));
    return Array.from({ length: setCount }, (_, index) => ({
      exerciseId: `${ex.id}-set-${index + 1}`,
      programExerciseId: ex.id,
      setNumber: index + 1,
      exerciseName: ex.exerciseName,
      exerciseCategory: state.exercises.find((item) => item.id === ex.exerciseId)?.category,
      exerciseEquipment: state.exercises.find((item) => item.id === ex.exerciseId)?.equipment,
      plannedSets: ex.sets,
      plannedReps: ex.reps,
      plannedWeight: initialWeight,
      plannedDurationMinutes: ex.durationMinutes ?? "",
      plannedSpeed: ex.speed ?? "",
      plannedIncline: ex.incline ?? "",
      performedWeight: initialWeight,
      performedReps: ex.reps,
      performedDurationMinutes: ex.durationMinutes ?? "",
      performedSpeed: ex.speed ?? "",
      performedIncline: ex.incline ?? "",
      completed: false,
    }));
  });

  return {
    ...state,
    workoutMode: {
      programId,
      results: expandedResults,
      note: "",
    },
  };
}

export function updateWorkoutResultInState(
  state: AppState,
  exerciseId: string,
  field: "performedWeight" | "performedReps" | "performedDurationMinutes" | "performedSpeed" | "performedIncline" | "completed",
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
  return {
    ...state,
    workoutMode: {
      ...state.workoutMode,
      results: state.workoutMode.results.map((result) =>
        result.programExerciseId === input.programExerciseId ? { ...result, exerciseName: normalizedName } : result
      ),
    },
  };
}

export function updateWorkoutNoteInState(state: AppState, note: string): AppState {
  if (!state.workoutMode) return state;
  return { ...state, workoutMode: { ...state.workoutMode, note } };
}

export function cancelWorkoutModeInState(state: AppState): AppState {
  return { ...state, workoutMode: null };
}

export function finishWorkoutModeInState(state: AppState, input?: FinishWorkoutInput): AppState {
  const current = state.workoutMode;
  if (!current) return state;
  const program = state.programs.find((p) => p.id === current.programId);
  if (!program) return state;

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
    const weight = Number(result.performedWeight) || 0;
    const reps = Number(result.performedReps) || 0;
    const newEstimated = estimate1RM(weight, reps);
    if (newEstimated <= 0) return;
    const previousEstimated = getBestEstimated1RM(state.logs, result.exerciseName, program.memberId);
    if (newEstimated <= previousEstimated) return;
    if (!bestCelebration || newEstimated - previousEstimated > bestCelebration.newEstimated1RM - bestCelebration.previousEstimated1RM) {
      bestCelebration = {
        memberId: program.memberId,
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

  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId: program.memberId,
        programTitle: program.title,
        date: formatDateDdMmYyyy(new Date()),
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

export function logGroupWorkoutInState(state: AppState, input: LogGroupWorkoutInput): AppState {
  const memberId = input.memberId.trim();
  const className = input.className.trim();
  if (!memberId || !className) return state;
  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId,
        programTitle: `Gruppetime: ${className}`,
        date: formatDateDdMmYyyy(new Date()),
        status: "Fullført",
        note: input.note?.trim() ?? "",
        reflection: input.reflection,
        results: [],
      },
      ...state.logs,
    ],
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

export function saveExerciseInState(state: AppState, input: SaveExerciseInput): AppState {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim();
  const normalizedImageUrl = input.imageUrl?.trim() || "";
  if (!normalizedName || !normalizedDescription) return state;

  if (input.id) {
    return {
      ...state,
      exercises: state.exercises.map((exercise) =>
        exercise.id === input.id
          ? {
              ...exercise,
              name: normalizedName,
              category: input.category,
              group: input.group.trim(),
              equipment: input.equipment.trim(),
              level: input.level,
              description: normalizedDescription,
              imageUrl: normalizedImageUrl,
            }
          : exercise
      ),
    };
  }

  const nextExercise: Exercise = {
    id: uid("ex"),
    name: normalizedName,
    category: input.category,
    group: input.group.trim(),
    equipment: input.equipment.trim(),
    level: input.level,
    description: normalizedDescription,
    imageUrl: normalizedImageUrl,
  };
  return { ...state, exercises: [nextExercise, ...state.exercises] };
}

export function deleteExerciseInState(state: AppState, exerciseId: string): AppState {
  const normalizedExerciseId = exerciseId.trim();
  if (!normalizedExerciseId) return state;
  return {
    ...state,
    exercises: state.exercises.filter((exercise) => exercise.id !== normalizedExerciseId),
    programs: state.programs.map((program) => ({
      ...program,
      exercises: program.exercises.filter((exercise) => exercise.exerciseId !== normalizedExerciseId),
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
            goal: input.changes.goal !== undefined ? input.changes.goal.trim() : member.goal,
            focus: input.changes.focus !== undefined ? input.changes.focus.trim() : member.focus,
            injuries: input.changes.injuries !== undefined ? input.changes.injuries.trim() : member.injuries,
            avatarUrl: input.changes.avatarUrl !== undefined ? input.changes.avatarUrl.trim() : member.avatarUrl,
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
  saveProgram: saveProgramInState,
  deleteProgram: deleteProgramInState,
  appendTrainerMessage,
  appendMemberMessage,
  startWorkoutMode: (state, programId, options) => startWorkoutModeInState(state, programId, options),
  updateWorkoutResult: (state, input) => updateWorkoutResultInState(state, input.exerciseId, input.field, input.value),
  replaceWorkoutExerciseGroup: (state, input) => replaceWorkoutExerciseGroupInState(state, input),
  removeWorkoutLogResult: (state, input) => removeWorkoutLogResultInState(state, input),
  setWorkoutLogResults: (state, input) => setWorkoutLogResultsInState(state, input),
  updateWorkoutNote: updateWorkoutNoteInState,
  cancelWorkoutMode: cancelWorkoutModeInState,
  finishWorkoutMode: finishWorkoutModeInState,
  logGroupWorkout: logGroupWorkoutInState,
  saveExercise: saveExerciseInState,
  deleteExercise: deleteExerciseInState,
  updateMember: updateMemberInState,
};
