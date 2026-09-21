import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PeriodSchedulePlan, TrainingProgram, WeeklySchedulePlan, WorkoutLog } from "../app/types";
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
    await user.click(screen.getByRole("button", { name: /Styrke A/ }));

    expect(onChangeDayProgram).toHaveBeenCalledWith("plan-1", 1, "tuesday", "Styrke A");
  });

  it("lets the trainer add a session on empty days without workout logging", async () => {
    const user = userEvent.setup();
    const { onChangeDayProgram } = renderWeek({ canLogWorkouts: false });

    expect(screen.queryByRole("button", { name: "Legg til økt på Mandag" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Legg til økt på Søndag" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Legg til økt på Onsdag" }));
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
});
