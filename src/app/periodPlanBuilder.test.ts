import { describe, expect, it } from "vitest";
import { buildActivityTemplateNotes } from "./activityTemplate";
import { buildPeriodPlanProgramSelectOptions } from "./periodPlanBuilder";
import type { TrainingProgram } from "./types";

describe("buildPeriodPlanProgramSelectOptions", () => {
  it("includes base options and program templates", () => {
    const options = buildPeriodPlanProgramSelectOptions(["Fullkropp A", "Fullkropp A"]);
    expect(options.some((option) => option.value === "Hvile / restitusjon")).toBe(true);
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
