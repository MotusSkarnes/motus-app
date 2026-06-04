import { describe, expect, it } from "vitest";
import {
  applyImageFocalPointToSrc,
  imageObjectPositionFromSrc,
  parseImageFocalPointFromSrc,
  programCustomCoverImageStyle,
} from "./imageFocalPoint";
import { PROGRAM_COVER_DISPLAY_ZOOM } from "./programImage";

describe("imageFocalPoint", () => {
  it("parses fx/fy from program cover URL", () => {
    expect(parseImageFocalPointFromSrc("https://x/hero.jpg?fx=0.25&fy=0.8")).toEqual({
      focalX: 0.25,
      focalY: 0.8,
    });
  });

  it("applies focal query without dropping other params", () => {
    expect(applyImageFocalPointToSrc("https://x/hero.jpg?v=1", { focalX: 0.4, focalY: 0.6 })).toBe(
      "https://x/hero.jpg?v=1&fx=0.400&fy=0.600",
    );
  });

  it("returns center top when focal query is missing", () => {
    expect(imageObjectPositionFromSrc("https://x/hero.jpg")).toBe("center top");
  });

  it("maps focal query to object-position", () => {
    expect(imageObjectPositionFromSrc("https://x/hero.jpg?fx=0.5&fy=0.32")).toBe("50.0% 32.0%");
  });

  it("uses scale + transform-origin for custom program cover pan", () => {
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=0.2&fy=0.1")).toEqual({
      objectFit: "cover",
      transform: `scale(${PROGRAM_COVER_DISPLAY_ZOOM})`,
      transformOrigin: "20.0% 10.0%",
    });
  });
});
