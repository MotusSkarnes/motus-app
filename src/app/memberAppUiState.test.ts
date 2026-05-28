import { describe, expect, it } from "vitest";
import { patchMemberAppUiStateInPersonalGoals, readMemberAppUiState, readProfileDisplayName } from "./memberAppUiState";

describe("memberAppUiState", () => {
  it("lagrer og leser velkomst og visningsnavn i personal_goals", () => {
    const encoded = patchMemberAppUiStateInPersonalGoals("", {
      welcomeSeenAt: "2026-05-01T10:00:00.000Z",
      profileDisplayName: "Lene Ruud",
    });
    expect(readMemberAppUiState(encoded).welcomeSeenAt).toBe("2026-05-01T10:00:00.000Z");
    expect(readProfileDisplayName(encoded)).toBe("Lene Ruud");
  });
});
