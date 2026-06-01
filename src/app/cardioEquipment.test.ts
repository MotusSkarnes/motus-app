import { describe, expect, it } from "vitest";
import type { Exercise } from "./types";
import { inferCardioEquipmentIdFromExercise, pickCardioExerciseForEquipment } from "./cardioEquipment";

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

describe("cardioEquipment", () => {
  it("infers equipment from exercise metadata", () => {
    expect(inferCardioEquipmentIdFromExercise(treadmill)).toBe("treadmill");
    expect(inferCardioEquipmentIdFromExercise(rowing)).toBe("rowing");
  });

  it("picks rowing exercise when equipment is rowing", () => {
    const picked = pickCardioExerciseForEquipment([treadmill, rowing], "rowing");
    expect(picked?.id).toBe("e35");
  });
});
