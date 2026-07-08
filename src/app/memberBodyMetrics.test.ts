import { describe, expect, it } from "vitest";
import {
  buildBodyMetricsTimeline,
  computeMetricChange,
  createMemberBodyMetricEntry,
  getBodyMetricsFromPersonalGoals,
  mergeBodyMetricIntoPersonalGoals,
} from "./memberBodyMetrics";
import { mergeCheckInIntoPersonalGoals } from "./memberMonthlyCheckIn";
import { parsePersonalGoalsJson } from "./memberProfilePayload";

const onboardingDone = `MOTUS_PROFILE_V1:${JSON.stringify({
  onboarding: { version: 1, completedAt: "2026-01-01T00:00:00.000Z", skipped: false },
  targetWeight: "75",
})}`;

describe("memberBodyMetrics", () => {
  it("stores and reads member body metrics", () => {
    const entry = createMemberBodyMetricEntry({ weightKg: 82.4, bodyFatPct: 18.2 });
    expect(entry).not.toBeNull();
    const merged = mergeBodyMetricIntoPersonalGoals(onboardingDone, entry!);
    const stored = getBodyMetricsFromPersonalGoals(merged);
    expect(stored).toHaveLength(1);
    expect(stored[0].weightKg).toBe(82.4);
    expect(stored[0].bodyFatPct).toBe(18.2);
    expect(stored[0].source).toBe("member");
  });

  it("replaces member log on the same calendar day", () => {
    const first = createMemberBodyMetricEntry({
      weightKg: 80,
      loggedAt: new Date(2026, 5, 2, 8, 0, 0),
    })!;
    let goals = mergeBodyMetricIntoPersonalGoals(onboardingDone, first);
    const second = createMemberBodyMetricEntry({
      weightKg: 79.5,
      loggedAt: new Date(2026, 5, 2, 20, 0, 0),
    })!;
    goals = mergeBodyMetricIntoPersonalGoals(goals, second);
    expect(getBodyMetricsFromPersonalGoals(goals)).toHaveLength(1);
    expect(getBodyMetricsFromPersonalGoals(goals)[0].weightKg).toBe(79.5);
  });

  it("includes Tanita metrics from monthly check-ins in timeline", () => {
    const goals = mergeCheckInIntoPersonalGoals(onboardingDone, {
      version: 1,
      monthKey: "2026-05",
      trainingGoing: 4,
      metExpectations: 4,
      trainingNeeds: ["Mer variasjon"],
      trainingNeedsNotes: "",
      challengingNotes: "",
      coachNotes: "",
      tanitaMetrics: { weightKg: 81.2, bodyFatPct: 17.5 },
      completedAt: "2026-05-31T10:00:00.000Z",
    });
    const timeline = buildBodyMetricsTimeline(goals);
    expect(timeline.weightSeries).toHaveLength(1);
    expect(timeline.bodyFatSeries).toHaveLength(1);
    expect(timeline.weightSeries[0].value).toBe(81.2);
    expect(timeline.bodyFatSeries[0].source).toBe("check-in");
  });

  it("computes change between first and latest measurement", () => {
    const change = computeMetricChange([
      { dateMs: 1, dateLabel: "1. jan.", value: 85, source: "member", entryId: "a" },
      { dateMs: 2, dateLabel: "2. feb.", value: 82.5, source: "member", entryId: "b" },
    ]);
    expect(change).toBe(-2.5);
  });

  it("preserves monthly check-ins when adding body metrics", () => {
    const withCheckIn = mergeCheckInIntoPersonalGoals(onboardingDone, {
      version: 1,
      monthKey: "2026-04",
      trainingGoing: 3,
      metExpectations: 3,
      trainingNeeds: [],
      trainingNeedsNotes: "",
      challengingNotes: "",
      coachNotes: "",
      tanitaMetrics: { weightKg: 84 },
      completedAt: "2026-04-30T12:00:00.000Z",
    });
    const entry = createMemberBodyMetricEntry({ weightKg: 83 })!;
    const merged = mergeBodyMetricIntoPersonalGoals(withCheckIn, entry);
    const timeline = buildBodyMetricsTimeline(merged);
    expect(getBodyMetricsFromPersonalGoals(merged)).toHaveLength(1);
    expect(timeline.weightSeries).toHaveLength(2);
    expect(timeline.entries.some((row) => row.source === "check-in")).toBe(true);
  });

  it("preserves stop goals when adding body metrics", () => {
    const stopGoals = [
      { target: "Brus", customTarget: "", startedAt: "2026-07-01" },
      { target: "Røyk", customTarget: "", startedAt: "2026-07-02" },
    ];
    const goalsWithStopGoals = `MOTUS_PROFILE_V1:${JSON.stringify({
      onboarding: { version: 1, completedAt: "2026-01-01T00:00:00.000Z", skipped: false },
      stopGoal: stopGoals[0],
      stopGoals,
    })}`;

    const entry = createMemberBodyMetricEntry({ weightKg: 83 })!;
    const merged = mergeBodyMetricIntoPersonalGoals(goalsWithStopGoals, entry);
    const payload = parsePersonalGoalsJson(merged);

    expect(payload?.stopGoal).toEqual(stopGoals[0]);
    expect(payload?.stopGoals).toEqual(stopGoals);
    expect(getBodyMetricsFromPersonalGoals(merged)).toHaveLength(1);
  });
});
