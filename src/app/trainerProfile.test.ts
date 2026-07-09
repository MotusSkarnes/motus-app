import { describe, expect, it } from "vitest";
import {
  buildTrainerVacationNotice,
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
        vacation: { enabled: true, startDate: "2026-07-01", endDate: "2026-07-14", message: "Tilbake snart" },
      }),
    ).toEqual({
      phone: "900 11 111",
      title: "PT",
      focus: "Styrke",
      bio: "Hei",
      vacation: { enabled: true, startDate: "2026-07-01", endDate: "2026-07-14", message: "Tilbake snart" },
    });
  });

  it("builds vacation notice only inside the configured date range", () => {
    const vacation = { enabled: true, startDate: "2026-07-01", endDate: "2026-07-14", message: "" };
    expect(buildTrainerVacationNotice(vacation, new Date(2026, 6, 5))?.detail).toContain("1. juli til 14. juli");
    expect(buildTrainerVacationNotice(vacation, new Date(2026, 6, 20))).toBeNull();
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
      vacation: { enabled: false, startDate: "", endDate: "", message: "" },
    });
  });
});
