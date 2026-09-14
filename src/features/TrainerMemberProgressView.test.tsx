import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  });
});
