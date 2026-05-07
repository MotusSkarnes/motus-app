import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { TrainerPortal } from "./features/TrainerPortal";
import type { Exercise, Member, WorkoutLog } from "./app/types";

vi.mock("./services/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabaseClient: null,
}));

describe("Trainer flows", () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it("allows trainer to add a customer from admin form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.type(screen.getByPlaceholderText("Navn"), "Ny Kunde");
    await user.type(screen.getByPlaceholderText("E-post"), "ny.kunde@example.com");
    await user.click(screen.getByRole("button", { name: "Opprett medlem" }));

    expect(screen.getByPlaceholderText("Navn")).toHaveValue("");
    expect(screen.getByPlaceholderText("E-post")).toHaveValue("");
  });

  it("shows dedupe helper message when Supabase is unavailable", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.click(screen.getByRole("button", { name: "Start opprydding" }));

    expect(screen.getByText("Opprydding er ikke tilgjengelig akkurat nå.")).toBeInTheDocument();
  });

  it("shows health check message when Supabase is unavailable", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Admin" })[0]);
    await user.click(screen.getByRole("button", { name: "Oppdater status" }));

    expect(screen.getByText("Status er ikke tilgjengelig akkurat nå.")).toBeInTheDocument();
  });

  it("shows customer program builder for trainer", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Program" })[0]);

    expect(screen.getByText("Bygg program")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lagre program på kunde" })).toBeInTheDocument();
  });

  it("supports messaging from trainer to member", async () => {
    const user = userEvent.setup();
    render(<App />);

    const trainerMessage = "Trener testmelding";
    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Meldinger" })[0]);
    await user.type(screen.getByPlaceholderText("Skriv melding til kunden"), trainerMessage);
    await user.click(screen.getAllByRole("button", { name: "Send" })[0]);

    expect(screen.getByPlaceholderText("Skriv melding til kunden")).toHaveValue("");
  });

  it("lets trainer deactivate a member and reveal inactive list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: /Logg inn som trener/i })[0]);
    await user.click(screen.getAllByRole("button", { name: "Klienter" })[0]);
    await user.click(screen.getByRole("button", { name: "Sett medlem som inaktiv" }));
    expect(screen.getByRole("button", { name: "Vis inaktive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vis inaktive" }));
    expect(screen.getByRole("button", { name: "Skjul inaktive" })).toBeInTheDocument();
  });

  it("shows workouts from legacy related member ids on customer workouts tab", async () => {
    const user = userEvent.setup();
    const members: Member[] = [
      {
        id: "m2",
        name: "Emma Hansen",
        email: "emma@motus.no",
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
      },
      {
        id: "m1",
        name: "Emma Hansen",
        email: "legacy+emma@motus.no",
        isActive: false,
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
      },
    ];
    const logs: WorkoutLog[] = [
      {
        id: "legacy-log-1",
        memberId: "m1",
        programTitle: "Legacy styrkeøkt",
        date: "23.04.2026",
        status: "Fullført",
        note: "Fra legacy member-id",
      },
    ];

    render(
      <TrainerPortal
        members={members}
        programs={[]}
        logs={logs}
        messages={[]}
        exercises={[] as Exercise[]}
        selectedMemberId="m2"
        setSelectedMemberId={() => {}}
        trainerTab="customers"
        setTrainerTab={() => {}}
        addMember={() => {}}
        deactivateMember={() => {}}
        deleteMember={() => {}}
        updateMember={() => {}}
        markMemberInvited={() => {}}
        inviteMember={async () => ({ ok: true, message: "ok" })}
        inviteTrainer={async () => ({ ok: true, message: "ok" })}
        restoreMemberByEmail={async () => ({ ok: true, message: "ok" })}
        restoreMissingTestData={async () => ({ ok: true, message: "ok" })}
        restoreOriginalExerciseBank={async () => ({ ok: true, message: "ok" })}
        saveProgramForMember={() => {}}
        deleteProgramById={() => {}}
        sendTrainerMessage={() => {}}
        saveExercise={() => {}}
        deleteExercise={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Økter" }));
    expect(screen.getAllByText("Legacy styrkeøkt").length).toBeGreaterThan(0);
  });

  it("shows workout insight cards for last 7 and 30 days", async () => {
    const user = userEvent.setup();
    const formatDate = (date: Date) =>
      `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(now.getDate() - 10);

    const members: Member[] = [
      {
        id: "m2",
        name: "Emma Hansen",
        email: "emma@motus.no",
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
      },
    ];
    const logs: WorkoutLog[] = [
      {
        id: "recent-program-log",
        memberId: "m2",
        programTitle: "Helkropp A",
        date: formatDate(threeDaysAgo),
        status: "Fullført",
        note: "",
        reflection: {
          energyLevel: 3,
          difficultyLevel: 4,
          motivationLevel: 3,
          note: "",
        },
      },
      {
        id: "group-log",
        memberId: "m2",
        programTitle: "Gruppetime: Yoga",
        date: formatDate(tenDaysAgo),
        status: "Fullført",
        note: "",
        reflection: {
          energyLevel: 4,
          difficultyLevel: 2,
          motivationLevel: 4,
          note: "",
        },
      },
    ];

    render(
      <TrainerPortal
        members={members}
        programs={[]}
        logs={logs}
        messages={[]}
        exercises={[] as Exercise[]}
        selectedMemberId="m2"
        setSelectedMemberId={() => {}}
        trainerTab="customers"
        setTrainerTab={() => {}}
        addMember={() => {}}
        deactivateMember={() => {}}
        deleteMember={() => {}}
        updateMember={() => {}}
        markMemberInvited={() => {}}
        inviteMember={async () => ({ ok: true, message: "ok" })}
        inviteTrainer={async () => ({ ok: true, message: "ok" })}
        restoreMemberByEmail={async () => ({ ok: true, message: "ok" })}
        restoreMissingTestData={async () => ({ ok: true, message: "ok" })}
        restoreOriginalExerciseBank={async () => ({ ok: true, message: "ok" })}
        saveProgramForMember={() => {}}
        deleteProgramById={() => {}}
        sendTrainerMessage={() => {}}
        saveExercise={() => {}}
        deleteExercise={() => {}}
      />
    );

    await user.click(screen.getByRole("button", { name: "Økter" }));
    expect(screen.getByText("Økter siste 7 dager")).toBeInTheDocument();
    expect(screen.getByText("Gruppetimer siste 30 dager")).toBeInTheDocument();
    expect(screen.getByText("Snitt belastning 30 dager")).toBeInTheDocument();
    expect(screen.getAllByText(/^1$/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("3.0 / 5")).toBeInTheDocument();
  });

  it("deduplicates repeated customers in trainer dashboard overview", () => {
    const members: Member[] = [
      {
        id: "member-new",
        name: "Lene",
        email: "lene@example.com",
        isActive: true,
        invitedAt: "01.01.2026",
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
      },
      {
        id: "member-old",
        name: "Lene",
        email: "lene@example.com",
        isActive: false,
        invitedAt: "",
        phone: "",
        birthDate: "",
        weight: "",
        height: "",
        level: "Nybegynner",
        membershipType: "Standard",
        customerType: "Oppfølging",
        daysSinceActivity: "12",
        goal: "",
        focus: "",
        personalGoals: "",
        injuries: "",
        coachNotes: "",
      },
    ];

    render(
      <TrainerPortal
        members={members}
        programs={[]}
        logs={[]}
        messages={[]}
        exercises={[] as Exercise[]}
        selectedMemberId="member-new"
        setSelectedMemberId={() => {}}
        trainerTab="dashboard"
        setTrainerTab={() => {}}
        addMember={() => {}}
        deactivateMember={() => {}}
        deleteMember={() => {}}
        updateMember={() => {}}
        markMemberInvited={() => {}}
        inviteMember={async () => ({ ok: true, message: "ok" })}
        inviteTrainer={async () => ({ ok: true, message: "ok" })}
        restoreMemberByEmail={async () => ({ ok: true, message: "ok" })}
        restoreMissingTestData={async () => ({ ok: true, message: "ok" })}
        restoreOriginalExerciseBank={async () => ({ ok: true, message: "ok" })}
        saveProgramForMember={() => {}}
        deleteProgramById={() => {}}
        sendTrainerMessage={() => {}}
        saveExercise={() => {}}
        deleteExercise={() => {}}
      />
    );

    expect(screen.getAllByText(/lene@example\.com/i).length).toBe(1);
  });

  it("allows marking follow-up from suggested contact list", async () => {
    const user = userEvent.setup();
    const formatDate = (date: Date) =>
      `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    const now = new Date();
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(now.getDate() - 10);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);

    const members: Member[] = [
      {
        id: "m-followup",
        name: "Lene",
        email: "lene@example.com",
        isActive: true,
        invitedAt: "",
        phone: "",
        birthDate: "",
        weight: "",
        height: "",
        level: "Nybegynner",
        membershipType: "Standard",
        customerType: "Oppfølging",
        daysSinceActivity: "10",
        goal: "",
        focus: "",
        personalGoals: "",
        injuries: "",
        coachNotes: "",
      },
    ];
    const logs: WorkoutLog[] = [
      {
        id: "hard-log-1",
        memberId: "m-followup",
        programTitle: "Styrke A",
        date: formatDate(tenDaysAgo),
        status: "Fullført",
        note: "",
        reflection: { energyLevel: 3, difficultyLevel: 4, motivationLevel: 3, note: "" },
      },
      {
        id: "hard-log-2",
        memberId: "m-followup",
        programTitle: "Styrke B",
        date: formatDate(threeDaysAgo),
        status: "Fullført",
        note: "",
        reflection: { energyLevel: 3, difficultyLevel: 5, motivationLevel: 3, note: "" },
      },
    ];

    render(
      <TrainerPortal
        members={members}
        programs={[]}
        logs={logs}
        messages={[]}
        exercises={[] as Exercise[]}
        selectedMemberId="m-followup"
        setSelectedMemberId={() => {}}
        trainerTab="dashboard"
        setTrainerTab={() => {}}
        addMember={() => {}}
        deactivateMember={() => {}}
        deleteMember={() => {}}
        updateMember={() => {}}
        markMemberInvited={() => {}}
        inviteMember={async () => ({ ok: true, message: "ok" })}
        inviteTrainer={async () => ({ ok: true, message: "ok" })}
        restoreMemberByEmail={async () => ({ ok: true, message: "ok" })}
        restoreMissingTestData={async () => ({ ok: true, message: "ok" })}
        restoreOriginalExerciseBank={async () => ({ ok: true, message: "ok" })}
        saveProgramForMember={() => {}}
        deleteProgramById={() => {}}
        sendTrainerMessage={() => {}}
        saveExercise={() => {}}
        deleteExercise={() => {}}
      />
    );

    expect(screen.getByText("Bør kontaktes nå")).toBeInTheDocument();
    expect(screen.getByText("Sist fulgt opp: Aldri")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marker fulgt opp" }));
    expect(screen.queryByText("Sist fulgt opp: Aldri")).not.toBeInTheDocument();
  });

});
