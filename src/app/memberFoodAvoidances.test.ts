import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import {
  findRecipeFoodAvoidanceConflicts,
  foodAvoidanceFromLabel,
  mergeMemberFoodAvoidancesIntoPersonalGoals,
  patchMemberFoodAvoidancesInPersonalGoals,
  readMemberFoodAvoidancesFromPersonalGoals,
} from "./memberFoodAvoidances";

describe("memberFoodAvoidances", () => {
  it("lagrer og leser mat unngås fra personalGoals", () => {
    const stored = patchMemberFoodAvoidancesInPersonalGoals("", {
      items: [foodAvoidanceFromLabel("Laks")!],
      notes: "Allergi",
      updatedAt: 0,
    });
    const read = readMemberFoodAvoidancesFromPersonalGoals(stored);
    expect(read.items).toHaveLength(1);
    expect(read.items[0]?.label).toBe("Laks");
    expect(read.notes).toBe("Allergi");
  });

  it("finner konflikt mellom oppskrift og medlems unngåelser", () => {
    const foods = buildDefaultFoodBankItems();
    const laks = foods.find((f) => f.name === "Laks");
    expect(laks).toBeDefined();

    const personalGoals = mergeMemberFoodAvoidancesIntoPersonalGoals("", {
      items: [{ foodId: laks!.id, label: "Laks", key: "laks" }],
      notes: "",
      updatedAt: Date.now(),
    });

    const body = `**Til 2 porsjoner**

**Ingredienser**
- 2 laksefileter (ca. 150 g per stk.)
- 1 ss olivenolje`;

    const conflicts = findRecipeFoodAvoidanceConflicts(body, foods, [
      { id: "m1", name: "Test Medlem", personalGoals, isActive: true },
    ]);

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.avoidanceLabel).toBe("Laks");
  });
});
