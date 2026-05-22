import { describe, expect, it } from "vitest";
import {
  parseTrainerProfile,
  resolveMemberTrainerDisplayName,
  trainerDisplayNameFromAuthMetadata,
  trainerProfileFromUserMetadata,
} from "./trainerProfile";

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

  it("uses full name from auth metadata like PT settings card", () => {
    expect(
      trainerDisplayNameFromAuthMetadata({ full_name: "Lene Ruud", name: "Lene" }, "lene@motus-skarnes.no"),
    ).toBe("Lene Ruud");
  });

  it("resolves member trainer display from assigned trainer name", () => {
    expect(
      resolveMemberTrainerDisplayName(
        { id: "m1", ownerUserId: "pt1", assignedTrainerName: "Lene Ruud" },
        [{ memberId: "m1", ownerUserId: "pt1", assignedTrainerName: "Lene Ruud" }],
      ),
    ).toBe("Lene Ruud");
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
