import { describe, expect, it } from "vitest";
import { buildDefaultFoodBankItems } from "./foodBankSeed";
import { computeRecipeIngredients } from "./recipeMacros";
import {
  findRecipeFoodAvoidanceConflicts,
  foodAvoidanceFromLabel,
  mergeFoodAvoidancesAcrossCandidates,
  mergeMemberFoodAvoidancesIntoPersonalGoals,
  patchMemberFoodAvoidancesInPersonalGoals,
  readMemberFoodAvoidancesFromPersonalGoals,
} from "./memberFoodAvoidances";
import { mergePersonalGoalsFromCandidates } from "./memberOnboarding";

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

  it("finner konflikt når manuell ingrediens-matvare er unngått", () => {
    const foods = buildDefaultFoodBankItems();
    const body = "**Til 1 porsjon**\n\n**Ingredienser**\n- 200 g kjøttdeig";
    const meat = computeRecipeIngredients(body, foods)[0];
    const soyafarse = foods.find((item) => item.name === "Soyafarse");
    expect(meat).toBeTruthy();
    expect(soyafarse).toBeTruthy();

    const personalGoals = mergeMemberFoodAvoidancesIntoPersonalGoals("", {
      items: [{ foodId: soyafarse!.id, label: "Soyafarse", key: "soyafarse" }],
      notes: "",
      updatedAt: Date.now(),
    });

    const withoutOverride = findRecipeFoodAvoidanceConflicts(body, foods, [
      { id: "m1", name: "Test Medlem", personalGoals, isActive: true },
    ]);
    const withOverride = findRecipeFoodAvoidanceConflicts(
      body,
      foods,
      [{ id: "m1", name: "Test Medlem", personalGoals, isActive: true }],
      { [meat!.key]: soyafarse!.id },
    );

    expect(withoutOverride).toHaveLength(0);
    expect(withOverride).toHaveLength(1);
    expect(withOverride[0]?.avoidanceLabel).toBe("Soyafarse");
  });

  it("mergeFoodAvoidancesAcrossCandidates unioner rader", () => {
    const rowA = mergeMemberFoodAvoidancesIntoPersonalGoals("", {
      items: [foodAvoidanceFromLabel("Laks")!],
      notes: "",
      updatedAt: 100,
    });
    const rowB = mergeMemberFoodAvoidancesIntoPersonalGoals("", {
      items: [foodAvoidanceFromLabel("Gluten")!],
      notes: "Intoleranse",
      updatedAt: 200,
    });
    const merged = mergeFoodAvoidancesAcrossCandidates([rowA, rowB]);
    expect(merged.items.map((item) => item.label).sort()).toEqual(["Gluten", "Laks"]);
    expect(merged.notes).toBe("Intoleranse");
    expect(merged.updatedAt).toBeGreaterThanOrEqual(200);
  });

  it("mergePersonalGoalsFromCandidates beholder mat unngås når beste blob mangler det", () => {
    const avoidancesOnly = patchMemberFoodAvoidancesInPersonalGoals("", {
      items: [foodAvoidanceFromLabel("Nøtter")!],
      notes: "",
      updatedAt: Date.now(),
    });
    const notificationOnly = `MOTUS_PROFILE_V1:${JSON.stringify({
      notificationPreferences: { seenHiddenBadgeIds: ["badge-1"], openedMemberAlertIds: ["alert-1"] },
      onboardingCompletedAt: "2026-05-01T00:00:00.000Z",
      onboarding: { version: 1, completedAt: "2026-05-01T00:00:00.000Z", trainingGoals: ["Styrke"] },
    })}`;
    const merged = mergePersonalGoalsFromCandidates([notificationOnly, avoidancesOnly]);
    const read = readMemberFoodAvoidancesFromPersonalGoals(merged);
    expect(read.items.some((item) => item.label === "Nøtter")).toBe(true);
  });
});
