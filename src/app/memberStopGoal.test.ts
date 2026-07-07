import { describe, expect, it } from "vitest";
import {
  computeStopGoalDays,
  formatStopGoalTitle,
  getStopGoalFromPersonalGoals,
  getStopGoalsFromPersonalGoals,
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
});
