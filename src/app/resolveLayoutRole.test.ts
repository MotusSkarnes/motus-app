import { describe, expect, it } from "vitest";
import { isTrainerMemberPreview, resolveLayoutRole } from "./resolveLayoutRole";
import type { AppState } from "./types";

function state(partial: Partial<AppState>): Pick<AppState, "role" | "currentUser"> {
  return {
    role: "trainer",
    currentUser: null,
    ...partial,
  };
}

describe("resolveLayoutRole", () => {
  it("uses appState.role when logged in as trainer", () => {
    expect(
      resolveLayoutRole(
        state({
          role: "member",
          currentUser: { id: "t1", role: "trainer", name: "PT", email: "pt@test.no", password: "" },
        }),
      ),
    ).toBe("member");
  });

  it("uses currentUser.role for members", () => {
    expect(
      resolveLayoutRole(
        state({
          role: "trainer",
          currentUser: { id: "m1", role: "member", name: "Medlem", email: "m@test.no", password: "", memberId: "mem-1" },
        }),
      ),
    ).toBe("member");
  });

  it("detects trainer member preview", () => {
    expect(
      isTrainerMemberPreview(
        state({
          role: "member",
          currentUser: { id: "t1", role: "trainer", name: "PT", email: "pt@test.no", password: "" },
        }),
      ),
    ).toBe(true);
  });
});
