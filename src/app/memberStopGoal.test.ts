import { describe, expect, it } from "vitest";
import {
  computeStopGoalDays,
  formatStopGoalTitle,
  formatStopGoalWithoutLabel,
  getStopGoalFromPersonalGoals,
  getStopGoalsFromPersonalGoals,
  recordStopGoalBreak,
} from "./memberStopGoal";

describe("memberStopGoal", () => {
  it("reads a valid stop goal from profile payload", () => {
    const personalGoals = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoal: { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
    })}`;

    expect(getStopGoalFromPersonalGoals(personalGoals)).toEqual({
      target: "Brus",
      customTarget: "",
      startedAt: "2026-07-01",
      breakCount: 0,
    });
  });

  it("reads multiple stop goals from profile payload", () => {
    const personalGoals = `MOTUS_PROFILE_V1:${JSON.stringify({
      stopGoals: [
        { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
        { target: "Røyk", customTarget: "", startedAt: "2026-07-02" },
      ],
    })}`;

    expect(getStopGoalsFromPersonalGoals(personalGoals)).toHaveLength(2);
    expect(getStopGoalFromPersonalGoals(personalGoals)?.target).toBe("Brus");
  });

  it("counts whole stop days after the start date", () => {
    expect(computeStopGoalDays("2026-07-01", new Date("2026-07-01T12:00:00"))).toBe(0);
    expect(computeStopGoalDays("2026-07-01", new Date("2026-07-03T12:00:00"))).toBe(2);
  });

  it("formats Norwegian stop labels without duplicate suffixes", () => {
    expect(formatStopGoalTitle("Røyk")).toBe("Røykestopp");
    expect(formatStopGoalTitle("Brus")).toBe("Brusstopp");
    expect(formatStopGoalTitle("Kaffestopp")).toBe("Kaffestopp");
  });

  it("formats home stop labels as days without the target", () => {
    expect(formatStopGoalWithoutLabel("Godteri")).toBe("godteri");
    expect(formatStopGoalWithoutLabel("Energidrikk")).toBe("energidrikk");
    expect(formatStopGoalWithoutLabel("Kaffestopp")).toBe("kaffe");
  });

  it("records a break by subtracting one day and incrementing break count", () => {
    const now = new Date("2026-07-05T12:00:00");
    const goal = { target: "Godteri", customTarget: "", startedAt: "2026-07-01", breakCount: 1 };

    expect(recordStopGoalBreak(goal, now)).toEqual({
      target: "Godteri",
      customTarget: "",
      startedAt: "2026-07-02",
      breakCount: 2,
    });
    expect(computeStopGoalDays("2026-07-02", now)).toBe(3);
  });

  it("keeps startedAt on zero-day streak but still counts the break", () => {
    const now = new Date("2026-07-05T12:00:00");
    const goal = { target: "Godteri", customTarget: "", startedAt: "2026-07-05", breakCount: 0 };

    expect(recordStopGoalBreak(goal, now)).toEqual({
      target: "Godteri",
      customTarget: "",
      startedAt: "2026-07-05",
      breakCount: 1,
    });
  });
});
