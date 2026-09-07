import { describe, expect, it } from "vitest";
import {
  computeStopGoalDays,
  computeStopGoalProgress,
  formatStopGoalRatioSummary,
  formatStopGoalTitle,
  formatStopGoalWithoutLabel,
  getStopGoalFromPersonalGoals,
  getStopGoalsFromPersonalGoals,
  normalizeStopGoals,
  recordStopGoalBreak,
  resolveStopGoalJourneyStart,
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
      originalStartedAt: "2026-07-01",
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

  it("records a break by only incrementing break count", () => {
    const now = new Date("2026-07-05T12:00:00");
    const goal = normalizeStopGoals([
      { target: "Godteri", customTarget: "", startedAt: "2026-07-01", originalStartedAt: "2026-07-01", breakCount: 1 },
    ])[0];

    expect(recordStopGoalBreak(goal, now)).toEqual({
      target: "Godteri",
      customTarget: "",
      startedAt: "2026-07-01",
      originalStartedAt: "2026-07-01",
      breakCount: 2,
    });
    expect(computeStopGoalDays("2026-07-01", now)).toBe(4);
  });

  it("normalizes legacy goals before recording a break so journey start is preserved", () => {
    const now = new Date("2026-07-05T12:00:00");
    const legacy = normalizeStopGoals([{ target: "Godteri", customTarget: "", startedAt: "2026-07-03", breakCount: 2 }])[0];
    const afterBreak = recordStopGoalBreak(legacy, now);

    expect(afterBreak.startedAt).toBe("2026-07-01");
    expect(afterBreak.breakCount).toBe(3);
    expect(computeStopGoalProgress(afterBreak, now).totalDays).toBe(4);
  });

  it("keeps total days growing after breaks", () => {
    const now = new Date("2026-07-05T12:00:00");
    const goal = { target: "Godteri", customTarget: "", startedAt: "2026-07-01", breakCount: 0 };
    const afterBreak = recordStopGoalBreak(goal, now);
    const progress = computeStopGoalProgress(afterBreak, now);

    expect(progress.totalDays).toBe(4);
    expect(progress.breakCount).toBe(1);
    expect(progress.cleanDays).toBe(3);
  });

  it("recovers journey start for legacy goals that moved startedAt on break", () => {
    const legacy = { target: "Godteri", customTarget: "", startedAt: "2026-07-03", breakCount: 2 };
    expect(resolveStopGoalJourneyStart(legacy)).toBe("2026-07-01");
    expect(computeStopGoalProgress(legacy, new Date("2026-07-05T12:00:00"))).toMatchObject({
      totalDays: 4,
      breakCount: 2,
      cleanDays: 2,
    });
  });

  it("summarizes the clean-to-break ratio", () => {
    expect(
      formatStopGoalRatioSummary({
        totalDays: 30,
        breakCount: 0,
        cleanDays: 30,
        cleanRatio: 1,
      }),
    ).toBe("Ingen brudd — sterkt holdt!");
    expect(
      formatStopGoalRatioSummary({
        totalDays: 0,
        breakCount: 0,
        cleanDays: 0,
        cleanRatio: 1,
      }),
    ).toMatch(/Startet i dag/);
    expect(
      formatStopGoalRatioSummary({
        totalDays: 20,
        breakCount: 2,
        cleanDays: 18,
        cleanRatio: 18 / 20,
      }),
    ).toMatch(/18 dager uten/);
  });

  it("merges duplicate stop goals by target instead of start date", () => {
    const merged = normalizeStopGoals([
      { target: "Godteri", customTarget: "", startedAt: "2026-07-01", breakCount: 0 },
      { target: "Godteri", customTarget: "", startedAt: "2026-07-02", breakCount: 2 },
    ]);

    expect(merged).toEqual([
      {
        target: "Godteri",
        customTarget: "",
        startedAt: "2026-06-30",
        originalStartedAt: "2026-06-30",
        breakCount: 2,
      },
    ]);
  });
});
