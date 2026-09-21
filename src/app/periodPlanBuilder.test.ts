import { describe, expect, it } from "vitest";
import { buildActivityTemplateNotes } from "./activityTemplate";
import { buildPeriodPlanChangeOptions, buildPeriodPlanProgramSelectOptions } from "./periodPlanBuilder";
import type { TrainingProgram } from "./types";

describe("buildPeriodPlanProgramSelectOptions", () => {
  it("includes base options and program templates", () => {
    const options = buildPeriodPlanProgramSelectOptions(["Fullkropp A", "Fullkropp A"]);
    expect(options.some((option) => option.value === "Hvile / restitusjon")).toBe(true);
    expect(options.some((option) => option.value === "Gruppetime")).toBe(true);
    expect(options.some((option) => option.value === "Gruppetime: Smilepuls")).toBe(true);
    expect(options.some((option) => option.value === "Fullkropp A")).toBe(true);
    expect(options.filter((option) => option.value === "Fullkropp A")).toHaveLength(1);
  });

  it("includes activity templates in dropdown options", () => {
    const templates: TrainingProgram[] = [
      {
        id: "tpl-1",
        memberId: "__template__",
        title: "Morgenyoga",
        goal: "",
        notes: buildActivityTemplateNotes("group", ""),
        createdAt: "01.01.2025",
        exercises: [],
      },
      {
        id: "tpl-2",
        memberId: "__template__",
        title: "Aktiv hvile",
        goal: "",
        notes: buildActivityTemplateNotes("activity", ""),
        createdAt: "01.01.2025",
        exercises: [],
      },
    ];
    const options = buildPeriodPlanProgramSelectOptions(["Fullkropp A"], templates);
    const groupOption = options.find((option) => option.value === "Gruppetime: Morgenyoga");
    const activityOption = options.find((option) => option.value === "Aktivitet: Aktiv hvile");
    expect(groupOption?.label).toBe("Gruppetime: Morgenyoga");
    expect(activityOption?.label).toBe("Aktivitet: Aktiv hvile");
  });
});

describe("buildPeriodPlanChangeOptions", () => {
  it("puts rest in other so group classes do not hide it", () => {
    const program: TrainingProgram = {
      id: "p1",
      memberId: "m1",
      title: "Styrke A",
      goal: "",
      notes: "",
      createdAt: "2026-01-01",
      exercises: [
        {
          id: "pe-1",
          exerciseId: "ex-1",
          exerciseName: "Knebøy",
          sets: "3",
          reps: "8",
          weight: "40",
          restSeconds: "90",
          notes: "",
        },
      ],
    };
    const options = buildPeriodPlanChangeOptions({ memberPrograms: [program] });
    expect(options.find((option) => option.value === "Hvile / restitusjon")?.category).toBe("other");
    expect(options.find((option) => option.value === "Styrke A")?.category).toBe("programs");
    expect(options.find((option) => option.value === "Gruppetime: Smilepuls")?.category).toBe("group");
    expect(options.filter((option) => option.category === "group").length).toBeGreaterThan(5);
  });
});
