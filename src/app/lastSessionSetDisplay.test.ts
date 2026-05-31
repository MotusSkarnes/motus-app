import { describe, expect, it } from "vitest";
import { formatLastSessionSetLabel, pickLastSetFromLastSession } from "./lastSessionSetDisplay";

const library = [
  {
    id: "ex-1",
    name: "Benkpress",
    category: "Styrke" as const,
    group: "Bryst",
    equipment: "Stang",
    level: "Nybegynner" as const,
    description: "",
    imageUrl: "",
  },
];

describe("pickLastSetFromLastSession", () => {
  it("picks highest set number", () => {
    const map = new Map([
      [1, { weight: "60", reps: "10" }],
      [3, { weight: "80", reps: "6" }],
      [2, { weight: "70", reps: "8" }],
    ]);
    expect(pickLastSetFromLastSession(map)).toEqual({
      setNumber: 3,
      entry: { weight: "80", reps: "6" },
    });
  });
});

describe("formatLastSessionSetLabel", () => {
  it("formats strength last set with set number", () => {
    expect(formatLastSessionSetLabel("Benkpress", { weight: "80", reps: "6" }, library, 3)).toBe(
      "Sett 3 · 6 reps · 80 kg",
    );
  });
});
