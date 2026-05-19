import { describe, expect, it } from "vitest";
import { resolveSessionAuthRole } from "./supabaseAuth";

describe("resolveSessionAuthRole", () => {
  it("treats @motus-skarnes.no as trainer when metadata has no role", () => {
    expect(
      resolveSessionAuthRole({
        email: "lene@motus-skarnes.no",
        app_metadata: {},
        user_metadata: {},
      }),
    ).toBe("trainer");
  });

  it("honours explicit member role for staff email (resepsjon premium)", () => {
    expect(
      resolveSessionAuthRole({
        email: "resepsjon@motus-skarnes.no",
        app_metadata: { role: "member", member_id: "auth-uuid-resepsjon" },
        user_metadata: { role: "member" },
      }),
    ).toBe("member");
  });

  it("honours explicit trainer role in metadata", () => {
    expect(
      resolveSessionAuthRole({
        email: "iben@motus-skarnes.no",
        app_metadata: { role: "trainer" },
        user_metadata: {},
      }),
    ).toBe("trainer");
  });
});
