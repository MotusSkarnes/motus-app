import { describe, expect, it } from "vitest";
import {
  REASSIGN_MEMBER_OWNER_TABLES,
  filterTrainerAccessibleMemberIds,
} from "./trainerMealPlanAccess";

describe("filterTrainerAccessibleMemberIds", () => {
  it("drops duplicate-email member ids the trainer cannot access", () => {
    expect(
      filterTrainerAccessibleMemberIds(
        ["owned-member", "other-trainer-member", "owned-member"],
        ["owned-member"],
      ),
    ).toEqual(["owned-member"]);
  });

  it("returns empty when the trainer has no access to any expanded id", () => {
    expect(
      filterTrainerAccessibleMemberIds(["other-a", "other-b"], ["owned-member"]),
    ).toEqual([]);
  });

  it("preserves accessible same-email duplicate rows for the same trainer", () => {
    expect(
      filterTrainerAccessibleMemberIds(
        ["member-a", "member-b", "member-c"],
        ["member-c", "member-a"],
      ),
    ).toEqual(["member-a", "member-c"]);
  });
});

describe("REASSIGN_MEMBER_OWNER_TABLES", () => {
  it("migrates meal plan ownership with the other member-owned tables", () => {
    expect(REASSIGN_MEMBER_OWNER_TABLES).toContain("member_meal_plans");
    expect(REASSIGN_MEMBER_OWNER_TABLES).toEqual([
      "training_programs",
      "workout_logs",
      "chat_messages",
      "member_period_plans",
      "member_meal_plans",
    ]);
  });
});
