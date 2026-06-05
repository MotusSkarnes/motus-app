import { describe, expect, it } from "vitest";
import { buildActivityTemplateNotes, enrichProgramWithActivityTemplateKind } from "./activityTemplate";
import {
  CONDITIONING_TRAINING_COVER_IMAGE,
  MOBILITY_TRAINING_COVER_IMAGE,
  NO_PLAN_DAY_COVER_IMAGE,
  SENIORS_GROUP_COVER_IMAGE,
  STRENGTH_TRAINING_COVER_IMAGE,
  mergeProgramImageUrl,
  pickProgramImageUrlAfterServerSync,
  pickProgramImageUrlFromDuplicateMerge,
  programCoverUsesPhotoStyle,
  resolveFirstProgramCoverExercise,
  resolveGroupWorkoutCoverImage,
  resolveNoPlanDayCoverImage,
  resolvePeriodPlanEntryCoverImage,
  resolveProgramCoverDisplayUrl,
  resolveProgramImageSrc,
} from "./programImage";
import { RUNNER_STRENGTH_COVER_IMAGE, RUNNER_MOBILITY_COVER_IMAGE, SUB60_PROGRAM_TITLES } from "./inspirationRunningPlans";
import type { Exercise, ProgramExercise, TrainingProgram } from "./types";

const strengthExercise: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> = {
  id: "e1",
  name: "Benkpress",
  category: "Styrke",
  group: "Bryst",
  imageUrl: "/exercises/bench.png",
};

const program = (imageUrl?: string, title = "Helkropp"): Pick<TrainingProgram, "imageUrl" | "title"> => ({
  imageUrl,
  title,
});

const cardioExercise: Pick<Exercise, "id" | "imageUrl" | "category" | "group" | "name"> = {
  id: "e2",
  name: "Nedjogg",
  category: "Kondisjon",
  group: "Bein",
  imageUrl: "/exercises/treadmill.png",
};

describe("mergeProgramImageUrl", () => {
  it("prefers primary when set", () => {
    expect(mergeProgramImageUrl("/a.png", "/b.png")).toBe("/a.png");
  });

  it("falls back to secondary when primary is empty", () => {
    expect(mergeProgramImageUrl("", "/b.png")).toBe("/b.png");
  });
});

describe("program image sync merge", () => {
  it("does not resurrect deleted cover from local cache", () => {
    const remote = { imageUrl: undefined } satisfies Pick<TrainingProgram, "imageUrl">;
    const local = { imageUrl: "https://cdn.example/old.png" };
    expect(pickProgramImageUrlAfterServerSync(remote)).toBeUndefined();
    expect(mergeProgramImageUrl(local.imageUrl, remote.imageUrl)).toBe("https://cdn.example/old.png");
  });

  it("keeps only newer duplicate program cover", () => {
    const newer = { imageUrl: undefined } satisfies Pick<TrainingProgram, "imageUrl">;
    const older = { imageUrl: "https://cdn.example/old.png" };
    expect(pickProgramImageUrlFromDuplicateMerge(newer)).toBeUndefined();
    expect(pickProgramImageUrlFromDuplicateMerge(older)).toBe("https://cdn.example/old.png");
  });
});

describe("resolveFirstProgramCoverExercise", () => {
  it("uses first program exercise in order", () => {
    const program: Pick<TrainingProgram, "exercises"> = {
      exercises: [
        { exerciseId: "missing" } as ProgramExercise,
        { exerciseId: "e2" } as ProgramExercise,
      ],
    };
    const exercises = [strengthExercise, cardioExercise];
    expect(resolveFirstProgramCoverExercise(program, exercises)?.id).toBe("e2");
  });
});

describe("resolveProgramCoverDisplayUrl", () => {
  it("maps portrait file to hero for display", () => {
    expect(resolveProgramCoverDisplayUrl("https://cdn/uid-portrait.jpg")).toBe("https://cdn/uid-hero.jpg");
  });
});

describe("resolveProgramImageSrc", () => {
  it("prefers custom program cover", () => {
    expect(
      resolveProgramImageSrc(program("/program-covers/custom.png"), strengthExercise, { subTab: "strength" }),
    ).toBe("/program-covers/custom.png");
  });

  it("rewrites portrait custom cover to hero", () => {
    expect(resolveProgramImageSrc(program("https://cdn/p1-portrait.jpg"), strengthExercise)).toBe(
      "https://cdn/p1-hero.jpg",
    );
  });

  it("uses first exercise cover for styrkeprogrammer uten eget forsidebilde", () => {
    expect(resolveProgramImageSrc(program(), strengthExercise, { subTab: "strength" })).toBe(
      "/exercises/bench.png",
    );
  });

  it("uses strength default cover when program has no exercises", () => {
    expect(resolveProgramImageSrc(program(), null, { subTab: "strength" })).toBe(STRENGTH_TRAINING_COVER_IMAGE);
  });

  it("uses runner strength cover for styrke løper-programmer", () => {
    expect(
      resolveProgramImageSrc(program(undefined, SUB60_PROGRAM_TITLES.strength), strengthExercise, {
        subTab: "strength",
      }),
    ).toBe(RUNNER_STRENGTH_COVER_IMAGE);
  });

  it("uses runner mobility cover for mobilitet løper-programmer", () => {
    expect(
      resolveProgramImageSrc(program(undefined, SUB60_PROGRAM_TITLES.mobility), strengthExercise, {
        subTab: "mobility",
      }),
    ).toBe(RUNNER_MOBILITY_COVER_IMAGE);
  });

  it("uses first exercise cover for kondisjonsprogrammer uten eget forsidebilde", () => {
    expect(resolveProgramImageSrc(program(), cardioExercise, { subTab: "conditioning" })).toBe(
      "/exercises/treadmill.png",
    );
  });

  it("uses conditioning default cover when program has no exercises", () => {
    expect(resolveProgramImageSrc(program(), null, { subTab: "conditioning" })).toBe(
      CONDITIONING_TRAINING_COVER_IMAGE,
    );
  });

  it("uses mobility default cover when program has no exercises", () => {
    expect(resolveProgramImageSrc(program(), null, { subTab: "mobility" })).toBe(
      MOBILITY_TRAINING_COVER_IMAGE,
    );
  });

  it("falls back to exercise illustration for other program types", () => {
    expect(resolveProgramImageSrc(program(), strengthExercise)).toBe("/exercises/bench.png");
  });
});

describe("resolvePeriodPlanEntryCoverImage", () => {
  it("uses custom image from matched gruppetime-mal", () => {
    const template = enrichProgramWithActivityTemplateKind({
      id: "tpl-1",
      memberId: "__template__",
      title: "Testgruppetime",
      goal: "",
      notes: "__motusTemplateKind=group",
      createdAt: "01.01.2025",
      exercises: [],
      imageUrl: "https://cdn.example/testgruppetime.png",
    });
    expect(
      resolvePeriodPlanEntryCoverImage("Gruppetime: Testgruppetime", {
        activityTemplates: [template],
      }),
    ).toBe("https://cdn.example/testgruppetime.png");
  });

  it("falls back to generic group cover when template is missing", () => {
    expect(resolvePeriodPlanEntryCoverImage("Gruppetime: Testgruppetime", { activityTemplates: [] })).toBe(
      CONDITIONING_TRAINING_COVER_IMAGE,
    );
  });
});

describe("resolveGroupWorkoutCoverImage", () => {
  it("maps Godt voksen gruppetime to seniors cover", () => {
    expect(resolveGroupWorkoutCoverImage("Godt voksen")).toBe(SENIORS_GROUP_COVER_IMAGE);
  });
});

describe("programCoverUsesPhotoStyle", () => {
  it("treats strength default cover as photo style", () => {
    expect(programCoverUsesPhotoStyle(program(), STRENGTH_TRAINING_COVER_IMAGE)).toBe(true);
  });
});

describe("resolveNoPlanDayCoverImage", () => {
  it("uses PT template image when available", () => {
    const programs: TrainingProgram[] = [
      {
        id: "tpl-no-plan",
        memberId: "__template__",
        title: "Ingen plan i dag",
        goal: "",
        notes: buildActivityTemplateNotes("no-plan", ""),
        createdAt: "",
        exercises: [],
        imageUrl: "https://cdn.example/custom-no-plan.png",
      },
    ];
    expect(resolveNoPlanDayCoverImage(programs)).toBe("https://cdn.example/custom-no-plan.png");
  });

  it("falls back to cached src before default cover", () => {
    expect(resolveNoPlanDayCoverImage([], "https://cdn.example/cached.png")).toBe(
      "https://cdn.example/cached.png",
    );
    expect(resolveNoPlanDayCoverImage([], NO_PLAN_DAY_COVER_IMAGE)).toBe(NO_PLAN_DAY_COVER_IMAGE);
    expect(resolveNoPlanDayCoverImage([], null)).toBe(NO_PLAN_DAY_COVER_IMAGE);
  });

  it("uses title-only no-plan template without notes marker", () => {
    const programs: TrainingProgram[] = [
      {
        id: "legacy-no-plan",
        memberId: "__template__",
        title: "Ingen plan i dag",
        goal: "",
        notes: "",
        createdAt: "",
        exercises: [],
        imageUrl: "https://cdn.example/legacy-no-plan.png",
      },
    ];
    expect(resolveNoPlanDayCoverImage(programs)).toBe("https://cdn.example/legacy-no-plan.png");
  });
});
