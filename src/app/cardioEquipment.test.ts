import { describe, expect, it } from "vitest";
import type { Exercise } from "./types";
import {
  buildCardioTemplateRow,
  CARDIO_COOLDOWN_STEP_NAME,
  inferCardioEquipmentIdFromExercise,
  isCardioCooldownStepName,
  pickCardioExerciseForEquipment,
} from "./cardioEquipment";

const treadmill: Exercise = {
  id: "e33",
  name: "Mølle intervall løp",
  category: "Kondisjon",
  group: "Kondisjon",
  equipment: "Tredemølle",
  level: "Litt øvet",
  description: "",
};

const rowing: Exercise = {
  id: "e35",
  name: "Romaskin intervall",
  category: "Kondisjon",
  group: "Kondisjon",
  equipment: "Romaskin",
  level: "Nybegynner",
  description: "",
};

const skierg: Exercise = {
  id: "e236",
  name: "Stakemaskin intervall",
  category: "Kondisjon",
  group: "Kondisjon",
  equipment: "Stakemaskin",
  level: "Nybegynner",
  description: "",
};

describe("cardioEquipment", () => {
  it("infers equipment from exercise metadata", () => {
    expect(inferCardioEquipmentIdFromExercise(treadmill)).toBe("treadmill");
    expect(inferCardioEquipmentIdFromExercise(rowing)).toBe("rowing");
    expect(inferCardioEquipmentIdFromExercise(skierg)).toBe("skierg");
  });

  it("picks rowing exercise when equipment is rowing", () => {
    const picked = pickCardioExerciseForEquipment([treadmill, rowing], "rowing");
    expect(picked?.id).toBe("e35");
  });

  it("picks ski erg exercise when equipment is skierg", () => {
    const picked = pickCardioExerciseForEquipment([treadmill, rowing, skierg], "skierg");
    expect(picked?.id).toBe("e236");
  });

  it("names cooldown step Nedtrapping and recognizes legacy Nedjogg", () => {
    const cooldown = buildCardioTemplateRow(rowing, "cooldown", "rowing");
    expect(cooldown.exerciseName).toBe(CARDIO_COOLDOWN_STEP_NAME);
    expect(isCardioCooldownStepName("Nedjogg")).toBe(true);
    expect(isCardioCooldownStepName(CARDIO_COOLDOWN_STEP_NAME)).toBe(true);
  });
});
