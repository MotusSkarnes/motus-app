import { describe, expect, it } from "vitest";
import { normalizePeriodSchedulePlan } from "./periodPlanMerge";
import { buildExerciseCategoryById, trainingProgramCategoryLabel } from "./trainingProgramKind";
import {
  RUNNING_INSPIRATION_ITEMS,
  SUB45_PROGRAM_TITLES,
  SUB60_LONG_RUN_COVER_IMAGE,
  SUB60_PROGRAM_TITLES,
  RUNNER_STRENGTH_COVER_IMAGE,
  RUNNER_MOBILITY_COVER_IMAGE,
  tidyInspirationRunningProgram,
} from "./inspirationRunningPlans";
import type { TrainingProgram } from "./types";

describe("inspirationRunningPlans", () => {
  it("exposes SUB60 and SUB45 period plans with 12 weeks", () => {
    expect(RUNNING_INSPIRATION_ITEMS).toHaveLength(2);
    const sub60 = RUNNING_INSPIRATION_ITEMS.find((item) => item.id === "default-period-sub60-10k");
    const sub45 = RUNNING_INSPIRATION_ITEMS.find((item) => item.id === "default-period-sub45-10k");
    expect(sub60?.bundledProgramTemplates).toHaveLength(7);
    expect(sub45?.bundledProgramTemplates).toHaveLength(7);

    const plan60 = normalizePeriodSchedulePlan(sub60!.periodPlanTemplate);
    const plan45 = normalizePeriodSchedulePlan(sub45!.periodPlanTemplate);
    expect(plan60.weeks).toBe(12);
    expect(plan60.weeklyPlans).toHaveLength(12);
    expect(plan45.weeks).toBe(12);
    expect(plan45.weeklyPlans).toHaveLength(12);
  });

  it("uses program titles in week 1 that match bundled templates", () => {
    const sub60 = RUNNING_INSPIRATION_ITEMS.find((item) => item.id === "default-period-sub60-10k")!;
    const titles = new Set(sub60.bundledProgramTemplates.map((program) => program.title));
    const week1 = sub60.periodPlanTemplate.weeklyPlans[0]?.days;
    const scheduled = Object.values(week1 ?? {}).filter((entry) => entry && !entry.startsWith("Hvile") && entry !== "Aktiv restitusjon");
    for (const entry of scheduled) {
      expect(titles.has(entry)).toBe(true);
    }
    expect(titles.has(SUB60_PROGRAM_TITLES.strength)).toBe(true);
    const strength = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.strength);
    expect(strength?.imageUrl).toBe(RUNNER_STRENGTH_COVER_IMAGE);
    const mobility = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.mobility);
    expect(mobility?.imageUrl).toBe(RUNNER_MOBILITY_COVER_IMAGE);
    const longRun = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.long);
    expect(longRun?.imageUrl).toBe(SUB60_LONG_RUN_COVER_IMAGE);

    const easy = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.easy)!;
    expect(easy.exercises[0]?.exerciseName).toBe("Rolig løp");
    expect(easy.exercises[0]?.notes).toBe("");
    expect(easy.notes).not.toMatch(/min\/km|→/);

    const tempo = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.tempo)!;
    expect(tempo.exercises.map((exercise) => exercise.exerciseName)).toEqual(["Oppvarming", "Tempo", "Nedjogg"]);
    expect(tempo.notes).not.toMatch(/min\/km|→/);

    const sub45 = RUNNING_INSPIRATION_ITEMS.find((item) => item.id === "default-period-sub45-10k")!;
    const sub45Titles = new Set(sub45.bundledProgramTemplates.map((program) => program.title));
    const lastWeek = sub45.periodPlanTemplate.weeklyPlans[sub45.periodPlanTemplate.weeklyPlans.length - 1];
    expect(lastWeek?.weekNumber).toBe(12);
    expect(lastWeek?.days.saturday?.trim()).toBe(SUB45_PROGRAM_TITLES.race);
    expect(sub45Titles.has(SUB45_PROGRAM_TITLES.race)).toBe(true);
  });

  it("labels bundled mobility programs as Mobilitet", () => {
    const sub60 = RUNNING_INSPIRATION_ITEMS.find((item) => item.id === "default-period-sub60-10k")!;
    const mobility = sub60.bundledProgramTemplates.find((program) => program.title === SUB60_PROGRAM_TITLES.mobility)!;
    expect(
      trainingProgramCategoryLabel(
        {
          id: "mobility-template",
          memberId: "__template__",
          title: mobility.title,
          goal: mobility.goal,
          notes: mobility.notes,
          createdAt: "",
          exercises: mobility.exercises,
        },
        buildExerciseCategoryById([]),
        [],
      ),
    ).toBe("Mobilitet");
  });

  it("names interval steps as warmup, drags and cooldown", () => {
    const interval = RUNNING_INSPIRATION_ITEMS[0]!.bundledProgramTemplates.find(
      (program) => program.title === SUB60_PROGRAM_TITLES.interval,
    )!;
    expect(interval.exercises[0]?.exerciseName).toBe("Oppvarming");
    expect(interval.exercises.some((exercise) => /^Drag \d+$/.test(exercise.exerciseName))).toBe(true);
    expect(interval.exercises.at(-1)?.exerciseName).toBe("Nedjogg");
    expect(interval.exercises.every((exercise) => exercise.notes === "")).toBe(true);
  });

  it("tidies already saved SUB60 copies so steps keep their labels", () => {
    const messy: TrainingProgram = {
      id: "saved-easy",
      memberId: "m1",
      title: SUB60_PROGRAM_TITLES.easy,
      goal: "old",
      notes: "Ca. 6:40 min/km → snakketempo",
      createdAt: "",
      exercises: [
        {
          id: "x1",
          exerciseId: "e45",
          exerciseName: "Nedjogg",
          sets: "1",
          reps: "",
          weight: "",
          durationMinutes: "38",
          notes: "Rolig løp",
        },
      ],
    };
    const tidied = tidyInspirationRunningProgram(messy);
    expect(tidied.exercises[0]?.exerciseName).toBe("Rolig løp");
    expect(tidied.exercises[0]?.notes).toBe("");
    expect(tidied.notes).not.toMatch(/min\/km|→/);
  });
});
