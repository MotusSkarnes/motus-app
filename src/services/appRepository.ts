import { uid } from "../app/storage";
import type { AppState, ChatMessage, Exercise, Member, ProgramExercise, TrainingProgram, WorkoutCelebration, WorkoutLog } from "../app/types";

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
  field: "performedWeight" | "performedReps" | "completed";
  value: string | boolean;
};

export type ReplaceWorkoutExerciseGroupInput = {
  programExerciseId: string;
  nextExerciseName: string;
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
  changes: Partial<Pick<Member, "name" | "email" | "phone" | "birthDate" | "goal" | "focus" | "injuries" | "membershipType" | "customerType">>;
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
  startWorkoutMode(state: AppState, programId: string): AppState;
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState;
  replaceWorkoutExerciseGroup(state: AppState, input: ReplaceWorkoutExerciseGroupInput): AppState;
  updateWorkoutNote(state: AppState, note: string): AppState;
  cancelWorkoutMode(state: AppState): AppState;
  finishWorkoutMode(state: AppState): AppState;
  saveExercise(state: AppState, input: SaveExerciseInput): AppState;
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
    createdAt: new Date().toLocaleDateString("no-NO"),
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
    createdAt: "Nå",
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
  const nextMessage: ChatMessage = {
    id: uid("msg"),
    memberId,
    sender: "member",
    text: text.trim(),
    createdAt: "Nå",
  };
  return { ...state, messages: [...state.messages, nextMessage] };
}

export function startWorkoutModeInState(state: AppState, programId: string): AppState {
  const program = state.programs.find((p) => p.id === programId);
  if (!program) return state;

  const expandedResults = program.exercises.flatMap((ex) => {
    const setCount = Math.max(1, Math.min(12, Number(ex.sets) || 1));
    return Array.from({ length: setCount }, (_, index) => ({
      exerciseId: `${ex.id}-set-${index + 1}`,
      programExerciseId: ex.id,
      setNumber: index + 1,
      exerciseName: ex.exerciseName,
      plannedSets: ex.sets,
      plannedReps: ex.reps,
      plannedWeight: ex.weight,
      performedWeight: ex.weight,
      performedReps: ex.reps,
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
  field: "performedWeight" | "performedReps" | "completed",
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

export function finishWorkoutModeInState(state: AppState): AppState {
  const current = state.workoutMode;
  if (!current) return state;
  const program = state.programs.find((p) => p.id === current.programId);
  if (!program) return state;

  function estimate1RM(weight: number, reps: number): number {
    if (weight <= 0 || reps <= 0) return 0;
    return weight * (1 + reps / 30);
  }

  function getBestEstimated1RM(logs: WorkoutLog[], exerciseName: string): number {
    let best = 0;
    logs.forEach((log) => {
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
    const previousEstimated = getBestEstimated1RM(state.logs, result.exerciseName);
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

  return {
    ...state,
    logs: [
      {
        id: uid("log"),
        memberId: program.memberId,
        programTitle: program.title,
        date: new Date().toLocaleDateString("no-NO"),
        status: "Fullført",
        note: current.note,
        results: current.results,
      },
      ...state.logs,
    ],
    workoutMode: null,
    workoutCelebration: bestCelebration,
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
  startWorkoutMode: startWorkoutModeInState,
  updateWorkoutResult: (state, input) => updateWorkoutResultInState(state, input.exerciseId, input.field, input.value),
  replaceWorkoutExerciseGroup: (state, input) => replaceWorkoutExerciseGroupInState(state, input),
  updateWorkoutNote: updateWorkoutNoteInState,
  cancelWorkoutMode: cancelWorkoutModeInState,
  finishWorkoutMode: finishWorkoutModeInState,
  saveExercise: saveExerciseInState,
  updateMember: updateMemberInState,
};
