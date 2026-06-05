import { describe, expect, it } from "vitest";
import {
  activityTemplateMatchesPeriodEntry,
  buildActivityTemplateNotes,
  enrichProgramWithActivityTemplateKind,
  listActivityTemplates,
  isMemberSessionScopedProgram,
  mergeMemberProgramsWithActivityTemplates,
  periodPlanEntryForActivityTemplate,
  stripActivityTemplateMarker,
} from "./activityTemplate";
import type { TrainingProgram } from "./types";

function templateProgram(kind: "group" | "activity", title: string, notesBody = ""): TrainingProgram {
  return {
    id: `tpl-${kind}-${title}`,
    memberId: "__template__",
    title,
    goal: "",
    notes: buildActivityTemplateNotes(kind, notesBody),
    createdAt: "01.01.2025",
    exercises: [],
  };
}

describe("activityTemplate", () => {
  it("builds and parses template notes", () => {
    expect(buildActivityTemplateNotes("group", "Spinning")).toBe("__motusTemplateKind=group\nSpinning");
    expect(stripActivityTemplateMarker("__motusTemplateKind=activity\nGåtur")).toBe("Gåtur");
  });

  it("enriches programs with activityTemplateKind and strips marker from notes", () => {
    const enriched = enrichProgramWithActivityTemplateKind(templateProgram("group", "Yoga", "Morgenyoga"));
    expect(enriched.activityTemplateKind).toBe("group");
    expect(enriched.notes).toBe("Morgenyoga");
  });

  it("maps templates to period plan cell values", () => {
    expect(periodPlanEntryForActivityTemplate(templateProgram("group", "Tabata"))).toBe("Gruppetime: Tabata");
    expect(periodPlanEntryForActivityTemplate(templateProgram("activity", "Svømming"))).toBe("Aktivitet: Svømming");
  });

  it("matches period plan entries to templates", () => {
    const group = templateProgram("group", "Yoga");
    const activity = templateProgram("activity", "Aktiv hvile");
    expect(activityTemplateMatchesPeriodEntry(group, "Gruppetime: Yoga")).toBe(true);
    expect(activityTemplateMatchesPeriodEntry(activity, "Aktivitet: Aktiv hvile")).toBe(true);
    expect(activityTemplateMatchesPeriodEntry(group, "Gruppetime: Spinning")).toBe(false);
  });

  it("recognises enriched templates after hydrate strips notes marker", () => {
    const enriched = enrichProgramWithActivityTemplateKind(templateProgram("group", "Spinning"));
    expect(listActivityTemplates([enriched])).toHaveLength(1);
    expect(periodPlanEntryForActivityTemplate(enriched)).toBe("Gruppetime: Spinning");
  });

  it("keeps activity templates in member session program scope", () => {
    const group = enrichProgramWithActivityTemplateKind(templateProgram("group", "Testgruppetime"));
    group.imageUrl = "https://cdn.example/test.png";
    expect(isMemberSessionScopedProgram(group, new Set(["member-1"]))).toBe(true);
    expect(
      isMemberSessionScopedProgram(
        {
          id: "p1",
          memberId: "member-1",
          title: "Styrke",
          goal: "",
          notes: "",
          createdAt: "",
          exercises: [],
        },
        new Set(["member-1"]),
      ),
    ).toBe(true);
    expect(
      isMemberSessionScopedProgram(
        {
          id: "p2",
          memberId: "other-member",
          title: "Styrke",
          goal: "",
          notes: "",
          createdAt: "",
          exercises: [],
        },
        new Set(["member-1"]),
      ),
    ).toBe(false);
  });

  it("keeps activity templates when filtering member hydrate programs", () => {
    const group = templateProgram("group", "Testgruppetime");
    group.imageUrl = "https://cdn.example/test.png";
    const assigned: TrainingProgram = {
      id: "p1",
      memberId: "member-1",
      title: "Styrke A",
      goal: "",
      notes: "",
      createdAt: "01.01.2025",
      exercises: [],
    };
    const merged = mergeMemberProgramsWithActivityTemplates([assigned, group], new Set(["member-1"]));
    expect(merged).toHaveLength(2);
    expect(merged.find((program) => program.id === group.id)?.imageUrl).toBe("https://cdn.example/test.png");
  });

  it("lists activity templates by kind", () => {
    const programs: TrainingProgram[] = [
      templateProgram("group", "A"),
      templateProgram("activity", "B"),
      {
        id: "p1",
        memberId: "member-1",
        title: "Fullkropp",
        goal: "",
        notes: "",
        createdAt: "01.01.2025",
        exercises: [],
      },
    ];
    expect(listActivityTemplates(programs)).toHaveLength(2);
    expect(listActivityTemplates(programs, "group")).toHaveLength(1);
    expect(listActivityTemplates(programs, "activity")).toHaveLength(1);
  });
});
