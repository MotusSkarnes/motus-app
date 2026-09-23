import { describe, expect, it } from "vitest";
import { filterTrainerNutritionFanoutMemberIds } from "./memberProfileNutritionFanout";

describe("filterTrainerNutritionFanoutMemberIds", () => {
  const trainerId = "trainer-a";

  it("keeps owned and shared Medlem rows for the target email", () => {
    expect(
      filterTrainerNutritionFanoutMemberIds(
        [
          { id: "owned", email: "client@example.com", owner_user_id: trainerId, customer_type: "PT-kunde" },
          { id: "shared", email: "client@example.com", owner_user_id: "other", customer_type: "Medlem" },
          { id: "other-pt", email: "client@example.com", owner_user_id: "trainer-b", customer_type: "PT-kunde" },
        ],
        ["client@example.com"],
        trainerId,
      ),
    ).toEqual(["owned", "shared"]);
  });

  it("blocks cross-trainer nutrition toggles that only match by email", () => {
    expect(
      filterTrainerNutritionFanoutMemberIds(
        [
          {
            id: "victim",
            email: "victim@example.com",
            owner_user_id: "trainer-b",
            customer_type: "PT-kunde",
          },
        ],
        ["victim@example.com"],
        trainerId,
      ),
    ).toEqual([]);
  });

  it("allows ownerless legacy rows and ignores unrelated emails", () => {
    expect(
      filterTrainerNutritionFanoutMemberIds(
        [
          { id: "legacy", email: "client@example.com", owner_user_id: null, customer_type: "PT-kunde" },
          { id: "other-email", email: "other@example.com", owner_user_id: trainerId, customer_type: "PT-kunde" },
        ],
        ["client@example.com"],
        trainerId,
      ),
    ).toEqual(["legacy"]);
  });
});
