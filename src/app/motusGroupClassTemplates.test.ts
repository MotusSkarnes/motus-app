import { describe, expect, it } from "vitest";
import { buildActivityTemplateNotes } from "./activityTemplate";
import { buildPeriodPlanProgramSelectOptions } from "./periodPlanBuilder";
import {
  DEFAULT_MOTUS_GROUP_CLASS_NAMES,
  ensureDefaultMotusGroupClassTemplates,
} from "./motusGroupClassTemplates";
import type { TrainingProgram } from "./types";

describe("ensureDefaultMotusGroupClassTemplates", () => {
  it("injects all standard Motus group classes as shared templates", () => {
    const templates = ensureDefaultMotusGroupClassTemplates([]);
    expect(templates).toHaveLength(DEFAULT_MOTUS_GROUP_CLASS_NAMES.length);
    expect(templates.map((program) => program.title).sort()).toEqual(
      [...DEFAULT_MOTUS_GROUP_CLASS_NAMES].sort(),
    );
    expect(templates.every((program) => program.memberId === "__template__")).toBe(true);
    expect(templates.every((program) => program.activityTemplateKind === "group")).toBe(true);
  });

  it("does not duplicate an existing group template from the database", () => {
    const existing: TrainingProgram = {
      id: "db-yoga",
      memberId: "__template__",
      title: "Yoga",
      goal: "",
      notes: buildActivityTemplateNotes("group", "PT-tilpasset"),
      createdAt: "01.01.2026",
      exercises: [],
      imageUrl: "https://cdn.example/yoga-custom.png",
    };
    const templates = ensureDefaultMotusGroupClassTemplates([existing]);
    const yogaTemplates = templates.filter((program) => program.title === "Yoga");
    expect(yogaTemplates).toHaveLength(1);
    expect(yogaTemplates[0]?.id).toBe("db-yoga");
    expect(yogaTemplates[0]?.imageUrl).toBe("https://cdn.example/yoga-custom.png");
  });

  it("feeds period plan dropdown from default group templates", () => {
    const templates = ensureDefaultMotusGroupClassTemplates([]);
    const options = buildPeriodPlanProgramSelectOptions([], templates);
    expect(options.some((option) => option.value === "Gruppetime: Smilepuls")).toBe(true);
    expect(options.some((option) => option.value === "Gruppetime: Godt voksen")).toBe(true);
    expect(options.some((option) => option.value === "Gruppetime: Step styrke")).toBe(true);
  });
});
