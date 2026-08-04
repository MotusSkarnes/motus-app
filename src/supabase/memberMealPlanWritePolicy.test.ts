import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "../..");

function readSql(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

/** Guard that meal-plan write policies require roster ownership, not only plan owner_user_id. */
function assertWritePolicyRequiresMemberOwner(sql: string) {
  expect(sql).toContain("member_meal_plans_insert_own");
  expect(sql).toContain("member_meal_plans_update_own");
  expect(sql).toMatch(/m\.owner_user_id\s*=\s*auth\.uid\(\)/);
  expect(sql).toMatch(/m\.id::text\s*=\s*member_meal_plans\.member_id/);
  // Must not ship the old owner-only insert check as the sole with-check clause.
  expect(sql).not.toMatch(
    /create policy "member_meal_plans_insert_own"[\s\S]*?with check \(\s*auth\.uid\(\) = owner_user_id\s*\);/,
  );
}

describe("member_meal_plans write RLS", () => {
  it("schema requires member roster ownership on insert/update", () => {
    assertWritePolicyRequiresMemberOwner(readSql("src/supabase/member_meal_plans_schema.sql"));
  });

  it("full patch requires member roster ownership on insert/update", () => {
    assertWritePolicyRequiresMemberOwner(readSql("src/supabase/patch_member_meal_plans_full.sql"));
  });

  it("ownership patch requires member roster ownership on insert/update", () => {
    assertWritePolicyRequiresMemberOwner(
      readSql("src/supabase/patch_member_meal_plans_rls_require_member_owner.sql"),
    );
  });
});
