import { describe, expect, it } from "vitest";
import { parseTrainerProfile, trainerProfileFromUserMetadata } from "./trainerProfile";

describe("trainerProfile", () => {
  it("parses stored profile fields", () => {
    expect(
      parseTrainerProfile({
        phone: " 900 11 111 ",
        title: "PT",
        focus: "Styrke",
        bio: "Hei",
      }),
    ).toEqual({
      phone: "900 11 111",
      title: "PT",
      focus: "Styrke",
      bio: "Hei",
    });
  });

  it("reads profile from user metadata key", () => {
    expect(
      trainerProfileFromUserMetadata({
        motus_trainer_profile: { phone: "1", title: "Trener", focus: "", bio: "" },
      }),
    ).toEqual({
      phone: "1",
      title: "Trener",
      focus: "",
      bio: "",
    });
  });
});
