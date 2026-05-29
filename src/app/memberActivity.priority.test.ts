import { afterEach, describe, expect, it, vi } from "vitest";
import {
  daysSinceLastCompletedWorkout,
  memberPriorityScore,
  memberPriorityTone,
  trainerMemberListStatus,
} from "./memberActivity";
import type { Member, WorkoutLog } from "./types";

const member: Member = {
  id: "m1",
  name: "Test",
  email: "t@example.com",
  phone: "",
  birthDate: "",
  goal: "",
  injuries: "",
  focus: "",
  level: "",
  membershipType: "Standard",
  customerType: "PT-kunde",
  daysSinceActivity: "0",
};

describe("memberPriorityTone", () => {
  it("returns red when inactive 10+ days", () => {
    const logs: WorkoutLog[] = [
      {
        id: "l1",
        memberId: "m1",
        programTitle: "P",
        date: "01.01.2020",
        status: "Fullført",
        exercises: [],
      },
    ];
    expect(memberPriorityTone(member, [member], logs)).toBe("red");
    expect(memberPriorityScore("red")).toBe(3);
  });

  it("returns unknown when no completed logs", () => {
    expect(memberPriorityTone(member, [member], [])).toBe("unknown");
  });
});

describe("trainerMemberListStatus", () => {
  it("does not label members without workouts as active", () => {
    const status = trainerMemberListStatus(member, [member], []);
    expect(status.statusLabel).not.toBe("Aktiv");
    expect(status.statusTone).toBe("neutral");
    expect(status.statusLabel).toBe("Ingen økt");
  });
});

describe("daysSinceLastCompletedWorkout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts yesterday correctly even when workout has late clock time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 28, 12, 0, 0));

    const logs: WorkoutLog[] = [
      {
        id: "l-late-yesterday",
        memberId: "m1",
        programTitle: "P",
        date: "27.05.2026 kl 23:30",
        status: "Fullført",
        exercises: [],
      },
    ];

    expect(daysSinceLastCompletedWorkout(member, [member], logs)).toBe(1);
  });
});
