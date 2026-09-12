import { describe, expect, it } from "vitest";
import { patchPersonalGoalsJson, PROFILE_METRICS_PREFIX } from "./memberProfilePayload";
import {
  parseMemberWeightKg,
  patchNutritionTargetsInPersonalGoals,
  pickPreferredNutritionTargets,
  readNutritionTargetsFromPersonalGoals,
  resolveDailyNutritionTargets,
  resolveMemberBodyWeight,
} from "./memberNutritionTargets";

describe("memberNutritionTargets", () => {
  it("parser vekt fra profilfelt", () => {
    expect(parseMemberWeightKg("72,5 kg")).toBe(72.5);
    expect(parseMemberWeightKg("")).toBeNull();
  });

  it("foretrekker siste kroppsmål fremfor profilvekt", () => {
    const goals = patchPersonalGoalsJson("", {
      bodyMetrics: [
        {
          version: 1,
          id: "m1",
          dateKey: "2026-09-01",
          loggedAt: "2026-09-01T10:00:00.000Z",
          weightKg: 81.2,
          source: "member",
        },
      ],
    });
    const resolved = resolveMemberBodyWeight("74", goals);
    expect(resolved?.kg).toBe(81.2);
    expect(resolved?.source).toBe("metrics");
  });

  it("lagrer og leser daglige mål i personal_goals", () => {
    const next = patchNutritionTargetsInPersonalGoals("", {
      kcal: 2000,
      proteinPerKg: 1.6,
      protein: 120,
      carbs: 200,
      fat: 67,
      kcalLocked: true,
    });
    expect(next.startsWith(PROFILE_METRICS_PREFIX)).toBe(true);
    const stored = readNutritionTargetsFromPersonalGoals(next);
    expect(stored?.kcal).toBe(2000);
    expect(stored?.proteinPerKg).toBe(1.6);
    expect(stored?.kcalLocked).toBe(true);
  });

  it("foretrekker nyere profilmål fremfor matplan", () => {
    const goals = patchNutritionTargetsInPersonalGoals("", {
      kcal: 1800,
      protein: 130,
      updatedAt: 200,
    });
    const resolved = resolveDailyNutritionTargets(goals, { kcal: 2200, protein: 90, updatedAt: 50 });
    expect(resolved?.kcal).toBe(1800);
    expect(resolved?.protein).toBe(130);
  });

  it("pickPreferredNutritionTargets keeps the newest targets across duplicate rows", () => {
    const older = patchNutritionTargetsInPersonalGoals("", { kcal: 1800, protein: 120, updatedAt: 100 });
    const newer = patchNutritionTargetsInPersonalGoals("", { kcal: 2100, protein: 150, updatedAt: 300 });
    const onboardingOnly = patchPersonalGoalsJson("", {
      onboardingCompletedAt: "2026-05-16T12:00:00.000Z",
    });
    const picked = pickPreferredNutritionTargets([onboardingOnly, older, newer]);
    expect(picked?.kcal).toBe(2100);
    expect(picked?.protein).toBe(150);
  });
});
