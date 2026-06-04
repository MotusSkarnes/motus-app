import { describe, expect, it } from "vitest";
import {
  applyImageFocalPointToSrc,
  imageObjectPositionFromSrc,
  parseImageFocalPointFromSrc,
  programCustomCoverImageStyle,
} from "./imageFocalPoint";

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

  it("pans custom program cover via object-position only (no zoom)", () => {
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=0.5&fy=0.5")).toEqual({
      objectFit: "cover",
      objectPosition: "50.0% 50.0%",
      transform: "none",
    });
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=0&fy=0")).toEqual({
      objectFit: "cover",
      objectPosition: "0.0% 0.0%",
      transform: "none",
    });
    expect(programCustomCoverImageStyle("https://x/hero.jpg?fx=1&fy=1")).toEqual({
      objectFit: "cover",
      objectPosition: "100.0% 100.0%",
      transform: "none",
    });
  });
});
