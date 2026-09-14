import { describe, expect, it } from "vitest";
import {
  countTrainingGroupMembersAtLevel,
  normalizeTrainingGroupMemberLevels,
  parseTrainingGroupLevel,
  parseTrainingGroupLevelSetup,
  serializeTrainingGroupLevelSetup,
  trainingGroupLevelLabel,
  trainingGroupMemberLevel,
  trainingGroupLevelPreference,
} from "./trainingGroups";

describe("training group levels", () => {
  it("parses nivå 1–3 and ignores other values", () => {
    expect(parseTrainingGroupLevel(1)).toBe(1);
    expect(parseTrainingGroupLevel("2")).toBe(2);
    expect(parseTrainingGroupLevel(3)).toBe(3);
    expect(parseTrainingGroupLevel(0)).toBeUndefined();
    expect(parseTrainingGroupLevel("x")).toBeUndefined();
  });

  it("defaults members in the group to nivå 1", () => {
    expect(normalizeTrainingGroupMemberLevels(["a", "b"], { a: 2 })).toEqual({ a: 2, b: 1 });
    expect(trainingGroupMemberLevel({ memberIds: ["a"], memberLevels: { a: 3 } }, "a")).toBe(3);
    expect(trainingGroupMemberLevel({ memberIds: ["a"] }, "a")).toBe(1);
    expect(trainingGroupMemberLevel({ memberIds: ["a"] }, "missing")).toBeUndefined();
  });

  it("keeps per-group preferences under each nivå", () => {
    const setup = parseTrainingGroupLevelSetup({
      memberLevels: { m1: 2, m2: "3" },
      preferences: { 1: "Gå/jogg", "2": "Sone 2", 3: "  " },
    });
    expect(setup.memberLevels).toEqual({ m1: 2, m2: 3 });
    expect(setup.levelPreferences).toEqual({ 1: "Gå/jogg", 2: "Sone 2" });
    const serialized = serializeTrainingGroupLevelSetup({
      memberIds: ["m1", "m3"],
      memberLevels: setup.memberLevels,
      levelPreferences: setup.levelPreferences,
    });
    expect(serialized.memberLevels).toEqual({ m1: 2, m3: 1 });
    expect(serialized.preferences).toEqual({ 1: "Gå/jogg", 2: "Sone 2" });
    expect(trainingGroupLevelLabel(2)).toBe("Nivå 2");
    expect(
      trainingGroupLevelPreference({ levelPreferences: setup.levelPreferences }, 1),
    ).toBe("Gå/jogg");
    expect(
      countTrainingGroupMembersAtLevel({ memberIds: ["m1", "m3"], memberLevels: serialized.memberLevels }, 1),
    ).toBe(1);
  });
});
