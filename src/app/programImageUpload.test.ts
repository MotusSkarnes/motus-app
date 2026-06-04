import { describe, expect, it } from "vitest";
import {
  MEMBER_PROGRAM_THUMB_ASPECT,
  PROGRAM_COVER_HERO_CANVAS_HEIGHT_PX,
  PROGRAM_COVER_HERO_CANVAS_WIDTH_PX,
  resolveProgramCoverDisplayUrl,
} from "./programImage";
import { PRIMARY_PROGRAM_COVER_VARIANT } from "./programImageUpload";

describe("program cover upload", () => {
  it("uses hero as primary stored variant", () => {
    expect(PRIMARY_PROGRAM_COVER_VARIANT).toBe("hero");
  });

  it("hero canvas matches program card aspect so display does not crop upload", () => {
    const canvasAspect = PROGRAM_COVER_HERO_CANVAS_WIDTH_PX / PROGRAM_COVER_HERO_CANVAS_HEIGHT_PX;
    expect(canvasAspect).toBeCloseTo(MEMBER_PROGRAM_THUMB_ASPECT, 2);
  });
});

describe("resolveProgramCoverDisplayUrl", () => {
  it("rewrites legacy portrait URLs to hero", () => {
    expect(resolveProgramCoverDisplayUrl("https://x/storage/v1/object/public/exercise-images/program-covers/abc-portrait.jpg")).toBe(
      "https://x/storage/v1/object/public/exercise-images/program-covers/abc-hero.jpg",
    );
  });

  it("preserves focal point query on rewrite", () => {
    expect(resolveProgramCoverDisplayUrl("https://x/abc-portrait.jpg?fx=0.5&fy=0.4")).toBe(
      "https://x/abc-hero.jpg?fx=0.5&fy=0.4",
    );
  });

  it("leaves hero URLs unchanged", () => {
    const url = "https://x/abc-hero.jpg";
    expect(resolveProgramCoverDisplayUrl(url)).toBe(url);
  });
});
