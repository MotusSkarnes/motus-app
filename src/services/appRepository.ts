import { uid } from "../app/storage";
import type { AppState, ChatMessage, Member, ProgramExercise, TrainingProgram } from "../app/types";

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

export interface AppRepository {
  addMember(state: AppState): AppState;
  saveProgram(state: AppState, input: SaveProgramInput): AppState;
  deleteProgram(state: AppState, programId: string): AppState;
  appendTrainerMessage(state: AppState, memberId: string, text: string): AppState;
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState;
  startWorkoutMode(state: AppState, programId: string): AppState;
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState;
  updateWorkoutNote(state: AppState, note: string): AppState;
  cancelWorkoutMode(state: AppState): AppState;
  finishWorkoutMode(state: AppState): AppState;
}

export function createMember(state: AppState): Member {
  const number = state.members.length + 1;
  return {
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
}

export function addMemberToState(state: AppState): AppState {
  const nextMember = createMember(state);
  return {
    ...state,
    members: [...state.members, nextMember],
    selectedMemberId: nextMember.id,
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

  return {
    ...state,
    workoutMode: {
      programId,
      results: program.exercises.map((ex) => ({
        exerciseId: ex.id,
        exerciseName: ex.exerciseName,
        plannedSets: ex.sets,
        plannedReps: ex.reps,
        plannedWeight: ex.weight,
        performedWeight: ex.weight,
        performedReps: ex.reps,
        completed: false,
      })),
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
  };
}

export const localAppRepository: AppRepository = {
  addMember: addMemberToState,
  saveProgram: saveProgramInState,
  deleteProgram: deleteProgramInState,
  appendTrainerMessage,
  appendMemberMessage,
  startWorkoutMode: startWorkoutModeInState,
  updateWorkoutResult: (state, input) => updateWorkoutResultInState(state, input.exerciseId, input.field, input.value),
  updateWorkoutNote: updateWorkoutNoteInState,
  cancelWorkoutMode: cancelWorkoutModeInState,
  finishWorkoutMode: finishWorkoutModeInState,
};
