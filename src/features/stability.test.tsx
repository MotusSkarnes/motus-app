import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemberPortal } from "./MemberPortal";
import { TrainerPortal } from "./TrainerPortal";
import { LiveWorkoutSessionModal } from "./LiveWorkoutSessionModal";
import type { Exercise, Member, ProgramExercise, TrainingProgram, WorkoutModeState } from "../app/types";

function createMember(input: Partial<Member>): Member {
  return {
    id: "m1",
    name: "Test Medlem",
    email: "member@example.com",
    isActive: true,
    invitedAt: "",
    phone: "",
    birthDate: "",
    weight: "",
    height: "",
    level: "Nybegynner",
    membershipType: "Standard",
    customerType: "Oppfølging",
    daysSinceActivity: "0",
    goal: "",
    focus: "",
    personalGoals: "",
    injuries: "",
    coachNotes: "",
    ...input,
  };
}

const baseExercise: Exercise = {
  id: "e1",
  name: "Knebøy",
  category: "Styrke",
  group: "Bein",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

const baseProgramExercise: ProgramExercise = {
  id: "pe1",
  exerciseId: "e1",
  exerciseName: "Knebøy",
  sets: "3",
  reps: "8",
  weight: "40",
  restSeconds: "90",
  notes: "",
};

function createProgram(input: Partial<TrainingProgram>): TrainingProgram {
  return {
    id: "p1",
    memberId: "m1",
    title: "Program",
    goal: "",
    notes: "",
    createdAt: "23.04.2026",
    exercises: [baseProgramExercise],
    ...input,
  };
}

describe("Stability regressions", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows member programs from related profiles with same email", () => {
    const members = [
      createMember({ id: "m1", email: "emma@example.com", name: "Emma A" }),
      createMember({ id: "m2", email: "emma@example.com", name: "Emma B" }),
      // Foreign row so program tied to m3 is excluded by email, not by «missing row» heuristics.
      createMember({ id: "m3", email: "annenkunde@example.com", name: "Annen kunde" }),
    ];
    const programs = [
      createProgram({ id: "p-related", memberId: "m2", title: "Relatert program" }),
      createProgram({ id: "p-other", memberId: "m3", title: "Skal ikke vises" }),
    ];

    render(
      <MemberPortal
        members={members}
        currentUserRole="member"
        currentUserEmail="emma@example.com"
        currentUserMemberId="m1"
        programs={programs}
        logs={[]}
        messages={[]}
        memberViewId="m1"
        memberTab="programs"
        setMemberTab={vi.fn()}
        updateMember={vi.fn()}
        memberAvatarUrl=""
        setMemberAvatarUrl={vi.fn()}
        exercises={[baseExercise]}
        sendMemberMessage={vi.fn()}
        workoutMode={null}
        startWorkoutMode={vi.fn()}
        startCustomWorkout={vi.fn()}
        saveProgramForMember={vi.fn()}
        deleteProgramById={vi.fn()}
        updateProgramMemberLibraryStatus={vi.fn()}
        updateWorkoutExerciseResult={vi.fn()}
        replaceWorkoutExerciseGroup={vi.fn()}
        removeWorkoutLogResult={vi.fn()}
        setWorkoutLogResults={vi.fn()}
        updateWorkoutModeNote={vi.fn()}
        finishWorkoutMode={vi.fn()}
        logGroupWorkout={vi.fn()}
        logActivityWorkout={vi.fn()}
        updateActivityWorkout={vi.fn()}
        updateGroupWorkoutLog={vi.fn()}
        deleteWorkoutLog={vi.fn()}
        logCompletedPlanEntry={vi.fn()}
        removeGroupWorkoutLog={vi.fn()}
        removeCompletedPlanEntryLog={vi.fn()}
        cancelWorkoutMode={vi.fn()}
        workoutCelebration={null}
        dismissWorkoutCelebration={vi.fn()}
        recentlyFinishedLogId={null}
        dismissRecentlyFinishedLog={vi.fn()}
      />,
    );

    expect(screen.getByText("Relatert program")).toBeInTheDocument();
    expect(screen.queryByText("Skal ikke vises")).not.toBeInTheDocument();
  });

  it("blocks saving programs while trainer is in local demo session", async () => {
    const user = userEvent.setup();
    const saveProgramForMember = vi.fn();

    render(
      <TrainerPortal
        members={[createMember({ id: "m1", email: "member@example.com" })]}
        programs={[]}
        logs={[]}
        messages={[]}
        exercises={[baseExercise]}
        selectedMemberId="m1"
        setSelectedMemberId={vi.fn()}
        trainerTab="customers"
        setTrainerTab={vi.fn()}
        addMember={vi.fn()}
        deactivateMember={vi.fn()}
        deleteMember={vi.fn()}
        updateMember={vi.fn()}
        markMemberInvited={vi.fn()}
        inviteMember={vi.fn(async () => ({ ok: true, message: "ok" }))}
        inviteTrainer={vi.fn(async () => ({ ok: true, message: "ok" }))}
        restoreMemberByEmail={vi.fn(async () => ({ ok: true, message: "ok" }))}
        reassignMemberOwner={vi.fn(async () => ({ ok: true, message: "ok" }))}
        restoreMissingTestData={vi.fn(async () => ({ ok: true, message: "ok" }))}
        restoreMembersFromRosterBackup={vi.fn(async () => ({ ok: true, message: "ok" }))}
        restoreOriginalExerciseBank={vi.fn(async () => ({ ok: true, message: "ok" }))}
        saveProgramForMember={saveProgramForMember}
        deleteProgramById={vi.fn()}
        sendTrainerMessage={vi.fn()}
        saveExercise={vi.fn()}
        deleteExercise={vi.fn()}
        isLocalDemoSession={true}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /Program & planer/i })[0]);
    const saveButton = await screen.findByRole("button", { name: "Lagre program på kunde" });

    expect(saveButton).toBeDisabled();
    expect(saveProgramForMember).not.toHaveBeenCalled();
  });

  it("lets members type a completion comment after workout mode", async () => {
    const user = userEvent.setup();
    const finishWorkoutMode = vi.fn();
    const workoutMode: WorkoutModeState = {
      programId: "p1",
      memberId: "m1",
      programTitle: "Program",
      note: "",
      results: [
        {
          exerciseId: "e1",
          programExerciseId: "pe1",
          setNumber: 1,
          exerciseName: "Knebøy",
          exerciseCategory: "Styrke",
          exerciseEquipment: "Stang",
          plannedSets: "1",
          plannedReps: "8",
          plannedWeight: "40",
          performedWeight: "40",
          performedReps: "8",
          completed: true,
        },
      ],
    };

    render(
      <LiveWorkoutSessionModal
        variant="member"
        workoutMode={workoutMode}
        activeProgram={createProgram({ exercises: [{ ...baseProgramExercise, sets: "1" }] })}
        exercises={[baseExercise]}
        updateWorkoutExerciseResult={vi.fn()}
        replaceWorkoutExerciseGroup={vi.fn()}
        addWorkoutExerciseToWorkout={vi.fn()}
        appendWorkoutSetForProgramExercise={vi.fn()}
        removeLastWorkoutSetForProgramExercise={vi.fn()}
        deferWorkoutExerciseGroup={vi.fn()}
        updateWorkoutModeNote={vi.fn()}
        updateWorkoutExerciseNote={vi.fn()}
        finishWorkoutMode={finishWorkoutMode}
        cancelWorkoutMode={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Lagre økt|Avslutt og lagre økt/i }));
    const commentField = screen.getByPlaceholderText("Hvordan gikk økta som helhet?");
    await user.type(commentField, "Fin flyt i dag");
    expect(commentField).toHaveValue("Fin flyt i dag");

    await user.click(screen.getByRole("button", { name: /^Lagre økt$/i }));
    expect(finishWorkoutMode).toHaveBeenCalledWith(expect.objectContaining({ note: "Fin flyt i dag" }));
  });
});
