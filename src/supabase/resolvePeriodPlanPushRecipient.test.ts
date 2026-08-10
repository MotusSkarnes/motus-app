import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("period plan push recipient resolution", () => {
  it("resolves the member auth user by email, not the owning trainer", () => {
    const sql = readFileSync(resolve("src/supabase/resolve_period_plan_push_recipient.sql"), "utf8");
    expect(sql).toContain("resolve_period_plan_push_recipient");
    expect(sql).toContain("auth.users");
    expect(sql).toContain("lower(trim(m.email)) = lower(trim(u.email))");
    expect(sql).not.toContain("owner_user_id");

    const edge = readFileSync(resolve("supabase/functions/send-period-plan-push/index.ts"), "utf8");
    expect(edge).toContain('rpc("resolve_period_plan_push_recipient"');
    expect(edge).not.toContain("resolve_member_form_push_recipient");
  });
});
