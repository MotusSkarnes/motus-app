import { describe, expect, it } from "vitest";
import { coverCropRect } from "./imageCompress";

describe("coverCropRect", () => {
  it("crops top and bottom of a square to 5:4 landscape", () => {
    expect(coverCropRect(1000, 1000, 5, 4)).toEqual({ sx: 0, sy: 100, sw: 1000, sh: 800 });
  });

  it("crops the sides of a wide image to 5:4", () => {
    expect(coverCropRect(1600, 900, 5, 4)).toEqual({ sx: 237, sy: 0, sw: 1125, sh: 900 });
  });
});
