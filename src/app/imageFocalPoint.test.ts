import { describe, expect, it } from "vitest";
import {
  applyImageFocalPointToSrc,
  applyProgramCoverFrameToSrc,
  imageObjectPositionFromSrc,
  parseProgramCoverFrameFromSrc,
  programCoverPanTranslatePercent,
  programCustomCoverImageStyle,
} from "./imageFocalPoint";

describe("imageFocalPoint", () => {
  it("parses fx/fy/fz from program cover URL", () => {
    expect(parseProgramCoverFrameFromSrc("https://x/hero.jpg?fx=0.25&fy=0.8&fz=1.5")).toEqual({
      focalX: 0.25,
      focalY: 0.8,
      zoom: 1.5,
    });
  });

  it("defaults zoom to 1 when fz is missing", () => {
    expect(parseProgramCoverFrameFromSrc("https://x/hero.jpg?fx=0.5&fy=0.5")).toEqual({
      focalX: 0.5,
      focalY: 0.5,
      zoom: 1,
    });
  });

  it("applies frame query without dropping other params", () => {
    expect(
      applyProgramCoverFrameToSrc("https://x/hero.jpg?v=1", { focalX: 0.4, focalY: 0.6, zoom: 1.2 }),
    ).toBe("https://x/hero.jpg?v=1&fx=0.400&fy=0.600&fz=1.200");
  });

  it("merges partial updates via applyImageFocalPointToSrc", () => {
    expect(applyImageFocalPointToSrc("https://x/hero.jpg?fx=0.5&fy=0.5&fz=1", { zoom: 1.8 })).toBe(
      "https://x/hero.jpg?fx=0.500&fy=0.500&fz=1.800",
    );
  });

  it("returns center top when focal query is missing", () => {
    expect(imageObjectPositionFromSrc("https://x/hero.jpg")).toBe("center top");
  });

  it("uses object-position at zoom 1", () => {
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=0.2&fy=0.3&fz=1")).toEqual({
      objectFit: "cover",
      objectPosition: "20.0% 30.0%",
      transform: "none",
      transformOrigin: "50% 50%",
    });
  });

  it("uses scale and translate when zoomed in", () => {
    expect(programCoverPanTranslatePercent(0, 0.5, 1.5)).toEqual({ x: 25, y: 0 });
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=0&fy=0.5&fz=1.5")).toEqual({
      objectFit: "cover",
      transform: "scale(1.500) translate(25.00%, 0.00%)",
      transformOrigin: "50% 50%",
    });
  });
});
