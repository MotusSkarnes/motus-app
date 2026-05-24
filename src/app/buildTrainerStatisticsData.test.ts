import { describe, expect, it } from "vitest";
import { buildTrainerStatisticsData } from "./buildTrainerStatisticsData";
import type { Member, TrainingProgram, WorkoutLog } from "./types";

const member: Member = {
  id: "m1",
  name: "Emma Hansen",
  email: "emma@test.no",
  isActive: true,
  invitedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  phone: "",
  birthDate: "",
  weight: "",
  height: "",
  level: "",
  membershipType: "Premium",
  customerType: "PT-kunde",
  daysSinceActivity: "1",
  goal: "",
  focus: "",
  personalGoals: "",
  injuries: "",
  coachNotes: "",
};

function log(id: string, memberId: string, date: string, status = "Fullført"): WorkoutLog {
  return {
    id,
    memberId,
    date,
    status,
    programTitle: "Test",
    results: [],
  };
}

describe("buildTrainerStatisticsData", () => {
  it("returns six KPI cards and activity series", () => {
    const now = new Date("2025-04-30T12:00:00");
    const logs = [
      log("l1", "m1", "28.04.2025"),
      log("l2", "m1", "25.04.2025"),
      log("l3", "m1", "20.04.2025", "Påbegynt"),
    ];
    const data = buildTrainerStatisticsData({
      members: [member],
      allMembers: [member],
      logs,
      programs: [{ id: "p1", memberId: "m1", title: "Styrke A", exercises: [], createdAt: "" } as TrainingProgram],
      exercises: [{ id: "e1", name: "Knebøy", category: "strength", group: "Bein", equipment: "", description: "" }],
      exercisePopularityScores: new Map([["e1", 5]]),
      periodPreset: "30d",
      resolveAvatar: () => null,
      now,
    });

    expect(data.kpis).toHaveLength(6);
    expect(data.activitySeries).toHaveLength(30);
    expect(data.topExercises[0]?.name).toBe("Knebøy");
    expect(data.programSlices[0]?.label).toBe("Styrke A");
    expect(data.businessKpis.some((row) => row.id === "revenue")).toBe(true);
  });
});
