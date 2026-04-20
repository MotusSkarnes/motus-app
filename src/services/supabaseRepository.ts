import type { AppState, ChatMessage, Member, ProgramExercise, TrainingProgram, WorkoutExerciseResult, WorkoutLog } from "../app/types";
import {
  appendMemberMessage,
  appendTrainerMessage,
  localAppRepository,
  type AppRepository,
  type SaveProgramInput,
  type UpdateWorkoutResultInput,
} from "./appRepository";
import { supabaseClient } from "./supabaseClient";

async function persistMessage(memberId: string, sender: "trainer" | "member", text: string) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("chat_messages").insert({
    member_id: memberId,
    sender,
    text,
    created_at: new Date().toISOString(),
  });
  if (error) {
    // Keep app resilient: local state succeeds even if backend is unavailable.
    console.warn("Supabase message persist failed:", error.message);
  }
}

async function persistProgram(input: SaveProgramInput) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("training_programs").upsert(
    {
      id: input.id ?? crypto.randomUUID(),
      member_id: input.memberId,
      title: input.title.trim(),
      goal: input.goal.trim(),
      notes: input.notes.trim(),
      exercises: input.exercises,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Supabase program persist failed:", error.message);
  }
}

async function persistMember(member: Member) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("members").upsert(
    {
      id: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      birth_date: member.birthDate,
      weight: member.weight,
      height: member.height,
      level: member.level,
      membership_type: member.membershipType,
      customer_type: member.customerType,
      days_since_activity: member.daysSinceActivity,
      goal: member.goal,
      focus: member.focus,
      personal_goals: member.personalGoals,
      injuries: member.injuries,
      coach_notes: member.coachNotes,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Supabase member persist failed:", error.message);
  }
}

async function deleteProgram(programId: string) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("training_programs").delete().eq("id", programId);
  if (error) {
    console.warn("Supabase program delete failed:", error.message);
  }
}

async function persistWorkoutLog(log: WorkoutLog) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.from("workout_logs").upsert(
    {
      id: log.id,
      member_id: log.memberId,
      program_title: log.programTitle,
      date: log.date,
      status: log.status,
      note: log.note,
      results: log.results ?? [],
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("Supabase log persist failed:", error.message);
  }
}

async function deleteLogsForProgram(memberId: string, programTitle: string) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient
    .from("workout_logs")
    .delete()
    .eq("member_id", memberId)
    .eq("program_title", programTitle);
  if (error) {
    console.warn("Supabase log cleanup failed:", error.message);
  }
}

function mapIsoToCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Nå";
  return date.toLocaleString("no-NO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function mapIsoToProgramDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("no-NO");
  }
  return date.toLocaleDateString("no-NO");
}

export async function fetchMessagesFromSupabase(): Promise<ChatMessage[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("chat_messages")
    .select("id, member_id, sender, text, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Supabase messages fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    memberId: String(row.member_id),
    sender: row.sender === "member" ? "member" : "trainer",
    text: String(row.text ?? ""),
    createdAt: mapIsoToCreatedAt(String(row.created_at ?? "")),
  }));
}

export async function fetchProgramsFromSupabase(): Promise<TrainingProgram[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("training_programs")
    .select("id, member_id, title, goal, notes, exercises, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase programs fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    memberId: String(row.member_id),
    title: String(row.title ?? ""),
    goal: String(row.goal ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: mapIsoToProgramDate(String(row.created_at ?? "")),
    exercises: Array.isArray(row.exercises) ? (row.exercises as ProgramExercise[]) : [],
  }));
}

export async function fetchLogsFromSupabase(): Promise<WorkoutLog[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("workout_logs")
    .select("id, member_id, program_title, date, status, note, results")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase logs fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    memberId: String(row.member_id),
    programTitle: String(row.program_title ?? ""),
    date: String(row.date ?? ""),
    status: row.status === "Planlagt" ? "Planlagt" : "Fullført",
    note: String(row.note ?? ""),
    results: Array.isArray(row.results) ? (row.results as WorkoutExerciseResult[]) : undefined,
  }));
}

export async function fetchMembersFromSupabase(): Promise<Member[] | null> {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("members")
    .select(
      "id, name, email, phone, birth_date, weight, height, level, membership_type, customer_type, days_since_activity, goal, focus, personal_goals, injuries, coach_notes"
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Supabase members fetch failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    birthDate: String(row.birth_date ?? ""),
    weight: String(row.weight ?? ""),
    height: String(row.height ?? ""),
    level: row.level === "Litt øvet" || row.level === "Øvet" ? row.level : "Nybegynner",
    membershipType: row.membership_type === "Premium" ? "Premium" : "Standard",
    customerType: row.customer_type === "PT-kunde" || row.customer_type === "Egentrening" ? row.customer_type : "Oppfølging",
    daysSinceActivity: String(row.days_since_activity ?? "0"),
    goal: String(row.goal ?? ""),
    focus: String(row.focus ?? ""),
    personalGoals: String(row.personal_goals ?? ""),
    injuries: String(row.injuries ?? ""),
    coachNotes: String(row.coach_notes ?? ""),
  }));
}

export const supabaseAppRepository: AppRepository = {
  addMember(state: AppState): AppState {
    const nextState = localAppRepository.addMember(state);
    const latestMember = nextState.members[nextState.members.length - 1];
    if (latestMember) {
      void persistMember(latestMember);
    }
    return nextState;
  },
  saveProgram(state: AppState, input: SaveProgramInput): AppState {
    const nextState = localAppRepository.saveProgram(state, input);
    void persistProgram(input);
    return nextState;
  },
  deleteProgram(state: AppState, programId: string): AppState {
    const program = state.programs.find((item) => item.id === programId);
    const nextState = localAppRepository.deleteProgram(state, programId);
    void deleteProgram(programId);
    if (program) {
      void deleteLogsForProgram(program.memberId, program.title);
    }
    return nextState;
  },
  appendTrainerMessage(state: AppState, memberId: string, text: string): AppState {
    const nextState = appendTrainerMessage(state, memberId, text);
    void persistMessage(memberId, "trainer", text.trim());
    return nextState;
  },
  appendMemberMessage(state: AppState, memberId: string, text: string): AppState {
    const nextState = appendMemberMessage(state, memberId, text);
    void persistMessage(memberId, "member", text.trim());
    return nextState;
  },
  startWorkoutMode(state: AppState, programId: string): AppState {
    return localAppRepository.startWorkoutMode(state, programId);
  },
  updateWorkoutResult(state: AppState, input: UpdateWorkoutResultInput): AppState {
    return localAppRepository.updateWorkoutResult(state, input);
  },
  updateWorkoutNote(state: AppState, note: string): AppState {
    return localAppRepository.updateWorkoutNote(state, note);
  },
  cancelWorkoutMode(state: AppState): AppState {
    return localAppRepository.cancelWorkoutMode(state);
  },
  finishWorkoutMode(state: AppState): AppState {
    const nextState = localAppRepository.finishWorkoutMode(state);
    const latestLog = nextState.logs[0];
    if (latestLog) {
      void persistWorkoutLog(latestLog);
    }
    return nextState;
  },
};
