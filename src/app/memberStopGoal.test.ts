import { describe, expect, it } from "vitest";
import {
  computeStopGoalDays,
  formatStopGoalTitle,
  getStopGoalFromPersonalGoals,
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

  it("counts the start date as day one", () => {
    expect(computeStopGoalDays("2026-07-01", new Date("2026-07-03T12:00:00"))).toBe(3);
  });

  it("formats Norwegian stop labels without duplicate suffixes", () => {
    expect(formatStopGoalTitle("Røyk")).toBe("Røykestopp");
    expect(formatStopGoalTitle("Brus")).toBe("Brusstopp");
    expect(formatStopGoalTitle("Kaffestopp")).toBe("Kaffestopp");
  });
});
