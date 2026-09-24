import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PeriodSchedulePlan, TrainingProgram, WeeklySchedulePlan, WorkoutLog } from "../app/types";
import { joinPeriodPlanDayEntries, parsePeriodPlanDayEntries } from "../app/periodPlanSwaps";
import { PeriodPlanWeekView } from "./PeriodPlanWeekView";

afterEach(() => {
  cleanup();
});

const emptyDays = {
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  sunday: "",
};

const plan: PeriodSchedulePlan = {
  id: "plan-1",
  title: "Testplan",
  notes: "",
  startDate: "2026-09-21",
  weeks: 1,
  createdAt: "2026-09-21",
  weeklyPlans: [],
};

const week: WeeklySchedulePlan = {
  id: "w1",
  weekNumber: 1,
  days: { ...emptyDays, monday: "Styrke A", sunday: "Hvile" },
};

const program: TrainingProgram = {
  id: "p1",
  memberId: "m1",
  title: "Styrke A",
  goal: "",
  notes: "",
  createdAt: "2026-01-01",
  exercises: [
    {
      id: "pe-1",
      exerciseId: "ex-1",
      exerciseName: "Knebøy",
      sets: "3",
      reps: "8",
      weight: "40",
      restSeconds: "90",
      notes: "",
    },
  ],
};

const runningProgram: TrainingProgram = {
  ...program,
  id: "p2",
  title: "Løping utendørs",
  exercises: [{ ...program.exercises[0]!, id: "pe-2", exerciseName: "Løping" }],
};

function renderWeek(overrides: Partial<ComponentProps<typeof PeriodPlanWeekView>> = {}) {
  const onChangeDayProgram = vi.fn();
  render(
    <PeriodPlanWeekView
      plan={plan}
      week={week}
      swapsByPlan={{}}
      memberPrograms={[program]}
      actionStatus={null}
      isEntryCompleted={() => false}
      onToggleCompleted={vi.fn()}
      onSwapDays={vi.fn()}
      onMoveDay={vi.fn()}
      onChangeDayProgram={onChangeDayProgram}
      onResetSwaps={vi.fn()}
      onStartProgram={vi.fn()}
      onLogGroup={vi.fn()}
      resolveEntryDate={() => "21.09.2026"}
      {...overrides}
    />,
  );
  return { onChangeDayProgram };
}

describe("PeriodPlanWeekView", () => {
  it("lets the member add a session on empty days", async () => {
    const user = userEvent.setup();
    const { onChangeDayProgram } = renderWeek();

    const addButton = screen.getByRole("button", { name: "Legg til økt på Tirsdag" });
    await user.click(addButton);
    await user.click(screen.getByRole("tab", { name: "Egne programmer" }));
    await user.click(screen.getByRole("button", { name: /Styrke A/ }));

    expect(onChangeDayProgram).toHaveBeenCalledWith("plan-1", 1, "tuesday", "Styrke A");
  });

  it("lets the trainer add a session on empty days without workout logging", async () => {
    const user = userEvent.setup();
    const { onChangeDayProgram } = renderWeek({ canLogWorkouts: false });

    expect(screen.queryByRole("button", { name: "Legg til økt på Mandag" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Legg til økt på Søndag" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Legg til økt på Onsdag" }));
    await user.click(screen.getByRole("tab", { name: "Egne programmer" }));
    await user.click(screen.getByRole("button", { name: /Styrke A/ }));

    expect(onChangeDayProgram).toHaveBeenCalledWith("plan-1", 1, "wednesday", "Styrke A");
  });

  it("hides add-session on days before the plan starts", () => {
    renderWeek({ resolveEntryDate: () => null });
    expect(screen.queryByRole("button", { name: /Legg til økt/ })).toBeNull();
  });

  it("lets the trainer open a session and see the plan plus what the customer logged", async () => {
    const user = userEvent.setup();
    const customerLog: WorkoutLog = {
      id: "log-1",
      memberId: "m1",
      programTitle: "Styrke A",
      date: "21.09.2026",
      status: "Fullført",
      note: "Tungt i dag",
      results: [
        {
          exerciseId: "pe-1-set-1",
          programExerciseId: "pe-1",
          setNumber: 1,
          exerciseName: "Knebøy",
          plannedSets: "3",
          plannedReps: "8",
          plannedWeight: "40",
          performedWeight: "42.5",
          performedReps: "8",
          completed: true,
        },
      ],
    };
    renderWeek({ canLogWorkouts: false, logs: [customerLog] });

    await user.click(screen.getByRole("button", { name: "Se økt for Mandag" }));

    expect(screen.getByRole("dialog", { name: "Styrke A" })).toBeTruthy();
    expect(screen.getByText(/Tungt i dag/)).toBeTruthy();
    expect(screen.getByText(/Plan:/)).toBeTruthy();
    expect(screen.getByText(/42\.5/)).toBeTruthy();
  });

  it("lets member and trainer add rest via the Annet category", async () => {
    const user = userEvent.setup();
    const { onChangeDayProgram } = renderWeek();

    await user.click(screen.getByRole("button", { name: "Legg til økt på Tirsdag" }));
    expect(screen.queryByRole("button", { name: /Smilepuls/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hvile \/ restitusjon/ })).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Annet" }));
    await user.click(screen.getByRole("button", { name: /Hvile \/ restitusjon/ }));

    expect(onChangeDayProgram).toHaveBeenCalledWith("plan-1", 1, "tuesday", "Hvile / restitusjon");
  });

  it("starts either of two sessions planned on the same day", async () => {
    const user = userEvent.setup();
    const onStartProgram = vi.fn();
    renderWeek({
      week: {
        ...week,
        days: { ...emptyDays, friday: joinPeriodPlanDayEntries(["Styrke A", "Løping utendørs"]) },
      },
      memberPrograms: [program, runningProgram],
      onStartProgram,
    });

    await user.click(screen.getByRole("button", { name: "Start Styrke A" }));
    await user.click(screen.getByRole("button", { name: "Start Løping utendørs" }));

    expect(onStartProgram).toHaveBeenNthCalledWith(1, "p1", expect.objectContaining({ entry: "Styrke A" }));
    expect(onStartProgram).toHaveBeenNthCalledWith(2, "p2", expect.objectContaining({ entry: "Løping utendørs" }));
  });

  it("edits only the selected session when a day contains two sessions", async () => {
    const user = userEvent.setup();
    const encoded = joinPeriodPlanDayEntries(["Styrke A", "Løping utendørs"]);
    const { onChangeDayProgram } = renderWeek({
      week: { ...week, days: { ...emptyDays, friday: encoded } },
      memberPrograms: [program, runningProgram],
    });

    await user.click(screen.getByRole("button", { name: "Bytt Løping utendørs" }));
    const strengthChoice = document.querySelector<HTMLButtonElement>(
      ".motus-period-plan-change-list button:not([disabled])",
    );
    expect(strengthChoice).toBeTruthy();
    await user.click(strengthChoice!);

    const updated = onChangeDayProgram.mock.calls[0]?.[3] as string;
    expect(parsePeriodPlanDayEntries(updated)).toEqual(["Styrke A", "Styrke A"]);
  });
});
