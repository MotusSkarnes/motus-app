import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Exercise, WorkoutLog } from "../app/types";
import { TrainerMemberProgressView } from "./TrainerMemberProgressView";

const bench: Exercise = {
  id: "e-bench",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  equipment: "Stang",
  level: "Nybegynner",
  description: "",
};

function completedLog(id: string, date: string, weight: string): WorkoutLog {
  return {
    id,
    memberId: "m1",
    programTitle: "Styrke A",
    date,
    status: "Fullført",
    note: "",
    results: [
      {
        exerciseId: "e-bench",
        exerciseName: "Benkpress",
        plannedSets: "3",
        plannedReps: "5",
        plannedWeight: weight,
        performedWeight: weight,
        performedReps: "5",
        completed: true,
      },
    ],
  };
}

describe("TrainerMemberProgressView", () => {
  afterEach(() => cleanup());
  it("shows weekly session and strength progress for a selected member", () => {
    render(
      <TrainerMemberProgressView
        memberName="Kari Nordmann"
        exercises={[bench]}
        nowTimestamp={Date.parse("2026-09-14T12:00:00.000Z")}
        logs={[
          completedLog("a", "17.08.2026", "60"),
          completedLog("b", "24.08.2026", "70"),
          completedLog("c", "07.09.2026", "75"),
        ]}
      />,
    );

    expect(screen.getByText("Økter / uke")).toBeInTheDocument();
    expect(screen.getByText("Styrkeutvikling")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Benkpress/i })).toBeInTheDocument();
  });

  it("shows empty states when the member has no completed workouts", () => {
    render(
      <TrainerMemberProgressView memberName="Ola" logs={[]} exercises={[bench]} />,
    );

    expect(screen.getByText("Ingen fullførte økter i perioden")).toBeInTheDocument();
    expect(screen.getByText("Ingen styrkedata ennå")).toBeInTheDocument();
    expect(screen.getByText("Ola har ikke aktivert deling")).toBeInTheDocument();
  });

  it("shows shared weight measurements for the trainer", () => {
    const personalGoals = `MOTUS_PROFILE_V1:${JSON.stringify({
      shareBodyMetricsWithTrainer: true,
      bodyMetrics: [
        {
          version: 1,
          id: "m-1",
          dateKey: "2026-09-10",
          loggedAt: "2026-09-10T08:00:00.000Z",
          weightKg: 78.5,
          source: "member",
        },
        {
          version: 1,
          id: "m-2",
          dateKey: "2026-09-16",
          loggedAt: "2026-09-16T08:00:00.000Z",
          weightKg: 77.9,
          source: "member",
        },
      ],
    })}`;
    render(
      <TrainerMemberProgressView
        memberName="Iben"
        logs={[]}
        exercises={[bench]}
        personalGoals={personalGoals}
      />,
    );

    expect(screen.getByRole("button", { name: "Vis alle vekt-målinger" })).toHaveTextContent("2");
    expect(screen.queryByText("Iben har ikke aktivert deling")).not.toBeInTheDocument();
  });
});
