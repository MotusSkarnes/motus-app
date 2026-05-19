import { describe, expect, it } from "vitest";
import { memberPriorityScore, memberPriorityTone } from "./memberActivity";
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

  it("returns green when no completed logs", () => {
    expect(memberPriorityTone(member, [member], [])).toBe("green");
  });
});
